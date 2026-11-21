// Real engine/API/store code, transpiled with the installed compiler. Only platform IO is replaced.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { create } = require('zustand');
function load(file, modules = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(require.resolve(file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; },
      setTimeout, clearTimeout, AbortController, DOMException, TypeError, Error, console,
      process: { env: {} }, ...globals });
  return exports;
}
const engineModule = load('../services/offline/engine.ts');
const { OfflineEngine } = engineModule;
function setup(disk = new Map()) {
  let session = { userId: 'a', token: 'secret-a' }, now = 1000;
  const delays = [], sent = [];
  const storage = { getItem: async k => disk.get(k) ?? null, setItem: async (k, v) => { disk.set(k, v); } };
  const engine = new OfflineEngine(storage, async () => session, async ms => { delays.push(ms); }, () => now);
  engine.transport = async (...args) => { sent.push(args); return { id: 'remote-id' }; };
  return { engine, disk, delays, sent, storage, session: () => session, change: s => { session = s; return engine.setUser(s?.userId ?? null); }, tick: ms => { now += ms; } };
}
const add = (e, key = 'key') => e.enqueue('/tasks', 'POST', { title: 'Offline task', token: 'never-store', password: 'never-store' }, 'a', key);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('offline creation persists domain fields, UUID key, user and timestamp; store contract works', async () => {
  const h = setup(); await h.engine.setUser('a');
  const store = load('../store/useOfflineStore.ts', { zustand: { create }, '../services/offline/runtime': { offlineEngine: h.engine } }).useOfflineStore;
  const local = await h.engine.enqueue('/tasks', 'POST', { title: 'Task', token: 'secret' }, 'a');
  assert.equal(local.title, 'Task'); assert.equal(local.user_id, 'a'); assert.equal(local.status, 'pending');
  assert.match(store.getState().pending[0].idempotencyKey, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  assert.equal(store.getState().pending[0].timestamp, 1000);
  assert.ok(![...h.disk.values()].join('').includes('secret'));
  await store.getState().clearForUser(); assert.equal(store.getState().pending.length, 0);
});

test('reconnect retries with bounded backoff, dedupes simultaneous syncs and invalidates cache', async () => {
  const h = setup(); await h.engine.setUser('a'); await add(h.engine);
  await h.engine.cacheList('/tasks', { tasks: [], total: 0 }, 'a');
  let calls = 0;
  h.engine.transport = async () => { if (++calls < 3) throw new TypeError('offline'); return { id: 'server' }; };
  await Promise.all([h.engine.syncNow(), h.engine.syncNow()]);
  assert.equal(calls, 3); assert.deepEqual(h.delays, [500, 1000]);
  assert.equal(h.engine.state.pending.length, 0); assert.equal(h.engine.state.lastSyncAt, 1000);
  assert.equal(await h.engine.cached('/tasks', 'a'), undefined);
});

test('dedupe by key survives restart; distinct keys remain distinct', async () => {
  const h = setup(); await h.engine.setUser('a');
  await Promise.all([add(h.engine), add(h.engine)]);
  const restarted = setup(h.disk); await restarted.engine.setUser('a');
  await add(restarted.engine); await add(restarted.engine, 'second');
  assert.equal(restarted.engine.state.pending.length, 2);
  await restarted.engine.syncNow(); assert.equal(restarted.sent.length, 2);
  assert.equal(restarted.sent[0][4], 'key');
});

test('account change during slow replay aborts A; B never sends A operations', async () => {
  const h = setup(); await h.engine.setUser('a'); await add(h.engine);
  const started = deferred(), response = deferred(); let signal;
  h.engine.transport = async (...args) => { signal = args[5]; started.resolve(); return response.promise; };
  const sync = h.engine.syncNow(); await started.promise;
  await h.change({ userId: 'b', token: 'secret-b' });
  assert.equal(signal.aborted, true); assert.equal(h.engine.state.pending.length, 0);
  response.resolve({ id: 'a-result' }); await sync;
  assert.equal(h.engine.state.lastSyncAt, null);
  await h.engine.syncNow();
  await h.change({ userId: 'a', token: 'secret-a' });
  assert.equal(h.engine.state.pending.length, 1);
});

test('session mismatch never dispatches even when queue belongs to previous user', async () => {
  const h = setup(); await h.engine.setUser('b');
  await h.engine.enqueue('/events', 'POST', { title: 'Event', start_date: '2026-01-01', end_date: '2026-01-02' }, 'b');
  await h.engine.syncNow(); assert.equal(h.sent.length, 0); assert.equal(h.engine.state.pending.length, 1);
});

test('HTTP conflict is persisted, retry retries, remote discards, local explicitly permits edit', async () => {
  const h = setup(); await h.engine.setUser('a'); await add(h.engine);
  h.engine.transport = async () => { throw Object.assign(new Error('conflict'), { status: 409 }); };
  await h.engine.syncNow(); assert.equal(h.engine.state.conflict.id, 'key');
  const restarted = setup(h.disk); await restarted.engine.setUser('a');
  assert.equal(restarted.engine.state.conflict.id, 'key');
  await restarted.engine.resolveConflict('key', 'retry'); assert.equal(restarted.engine.state.pending.length, 0);
  await h.engine.resolveConflict('key', 'remote'); assert.equal(h.engine.state.conflict, null);
  await h.engine.enqueue('/tasks/server/complete', 'PATCH', {}, 'a', 'edit');
  await h.engine.syncNow(); assert.equal(h.engine.state.conflict.id, 'edit');
  h.engine.transport = async () => ({ id: 'server' });
  await h.engine.resolveConflict('edit', 'local'); assert.equal(h.engine.state.pending.length, 0);
});

test('create then complete remaps the dependent endpoint after restart', async () => {
  const h = setup(); await h.engine.setUser('a'); const local = await add(h.engine);
  await h.engine.enqueue(`/tasks/${local.id}/complete`, 'PATCH', {}, 'a', 'complete');
  const restarted = setup(h.disk); await restarted.engine.setUser('a'); await restarted.engine.syncNow();
  assert.equal(restarted.engine.state.conflict.endpoint, '/tasks/remote-id/complete');
  await restarted.engine.resolveConflict('complete', 'local');
  assert.equal(restarted.sent[1][0], '/tasks/remote-id/complete');
});

test('cache TTL, partitioning and restart are enforced', async () => {
  const h = setup(); await h.engine.setUser('a'); await h.engine.cacheList('/events?page=1', { events: [{ id: 'e' }] }, 'a', 200);
  const restarted = setup(h.disk); await restarted.engine.setUser('a');
  assert.equal((await restarted.engine.cached('/events?page=1', 'a')).events[0].id, 'e');
  assert.equal(await restarted.engine.cached('/events?page=1', 'b'), undefined);
  restarted.tick(201); assert.equal(await restarted.engine.cached('/events?page=1', 'a'), undefined);
});

function apiSetup(h, fetch) {
  return load('../services/api.ts', {
    './offline/runtime': { offlineEngine: h.engine, currentSession: async () => h.session() },
    './offline/engine': engineModule,
  }, { fetch }).apiClient;
}
test('actual API queues failed fetch, preserves list cache and replays with same idempotency key', async () => {
  const h = setup(); await h.engine.setUser('a'); let online = true; const requests = [];
  const api = apiSetup(h, async (url, options) => {
    requests.push({ url, options }); if (!online) throw new TypeError('Network request failed');
    return { ok: true, status: 200, json: async () => options.method === 'GET' ? { tasks: [{ id: 'existing' }] } : { id: 'server' } };
  });
  await api.get('/tasks', 'secret-a'); online = false;
  assert.equal((await api.get('/tasks', 'secret-a')).tasks[0].id, 'existing');
  const local = await api.post('/tasks', { title: 'New' }, 'secret-a');
  assert.match(local.id, /^local-/); await h.engine.syncNow();
  assert.equal(h.engine.state.pending.length, 1);
  const key = h.engine.state.pending[0].idempotencyKey;
  online = true; await api.get('/tasks', 'secret-a'); await h.engine.syncNow();
  assert.equal(h.engine.state.pending.length, 0);
  assert.ok(requests.filter(r => r.options.method === 'POST').every(r => r.options.headers['Idempotency-Key'] === key));
});

test('slow API response does not enqueue twice; timeout is distinct from cancellation', async () => {
  const h = setup(); await h.engine.setUser('a'); const waiting = deferred();
  const api = apiSetup(h, async () => waiting.promise);
  const request = api.post('/tasks', { title: 'Slow' }, 'secret-a');
  await new Promise(r => setTimeout(r, 10)); assert.equal(h.engine.state.pending.length, 0);
  waiting.resolve({ ok: true, status: 200, json: async () => ({ id: 'slow-server' }) });
  assert.equal((await request).id, 'slow-server'); assert.equal(h.engine.state.pending.length, 0);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(api.post('/tasks', { title: 'Cancelled' }, 'secret-a', cancelled.signal), { name: 'AbortError' });
  const timeoutApi = apiSetup(h, async (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  await assert.rejects(timeoutApi.network('/tasks', { timeoutMs: 5 }), { name: 'TimeoutError' });
  assert.equal(h.engine.state.pending.length, 0);
});

test('HTTP validation failures and unsupported writes are never queued', async () => {
  const h = setup(); await h.engine.setUser('a');
  const api = apiSetup(h, async () => ({ ok: false, status: 400, json: async () => ({ message: 'invalid' }) }));
  await assert.rejects(api.post('/tasks', {}, 'secret-a'), /invalid/);
  assert.equal(h.engine.state.pending.length, 0);
  await assert.rejects(h.engine.enqueue('/auth/login', 'POST', { password: 'secret' }, 'a'), /Unsupported/);
});

test('slow response body remains covered by timeout and permanent outage stops after three attempts', async () => {
  const h = setup(); await h.engine.setUser('a');
  const api = apiSetup(h, async (_, options) => ({ ok: true, status: 200,
    json: () => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) }));
  await assert.rejects(api.network('/tasks', { timeoutMs: 5 }), { name: 'TimeoutError' });
  await add(h.engine); let calls = 0;
  h.engine.transport = async () => { calls++; throw new TypeError('offline'); };
  await h.engine.syncNow(); assert.equal(calls, 3); assert.equal(h.engine.state.isSyncing, false);
  assert.equal(h.engine.state.pending.length, 1); assert.deepEqual(h.delays, [500, 1000]);
});

test('clear during slow sync cannot resurrect a deleted queue or cache', async () => {
  const h = setup(); await h.engine.setUser('a'); await add(h.engine);
  const started = deferred(), response = deferred();
  h.engine.transport = async () => { started.resolve(); return response.promise; };
  const sync = h.engine.syncNow(); await started.promise;
  await h.engine.clearForUser(); response.resolve({ id: 'remote' }); await sync;
  const restarted = setup(h.disk); await restarted.engine.setUser('a');
  assert.equal(restarted.engine.state.pending.length, 0); assert.equal(restarted.engine.state.lastSyncAt, null);
});

test('initial online HTTP conflict is exposed in the store instead of silently overwriting', async () => {
  const h = setup(); await h.engine.setUser('a');
  const api = apiSetup(h, async () => ({ ok: false, status: 412, json: async () => ({ message: 'Version changed' }) }));
  const local = await api.patch('/tasks/server', { title: 'My edit' }, 'secret-a');
  assert.equal(local.title, 'My edit'); assert.equal(h.engine.state.conflict.endpoint, '/tasks/server');
  assert.equal(h.engine.state.conflict.status, 'conflict');
  await h.engine.resolveConflict(h.engine.state.conflict.id, 'remote');
  assert.equal(h.engine.state.pending.length, 0);
});
