// Run from app: node --test src/__tests__/tasks.test.cjs
// Uses the installed TypeScript compiler and real Zustand; no native runtime needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { create } = require('zustand');
const source = fs.readFileSync(require.resolve('../store/useTaskStore.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const task = (id, status = 'pending') => ({ id, title: id, status });
const page = (tasks, total = tasks.length, limit = 20) => ({ tasks, total, limit, page: 1 });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
function setup() {
  const auth = create(() => ({ user: { id: 'a' } }));
  const calls = [];
  const service = { list: (filters) => {
    const request = deferred();
    calls.push({ filters, ...request });
    return request.promise;
  } };
  let now = 0, next = 0;
  const timers = new Map();
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: name => name === 'zustand' ? { create } : name.includes('useAuthStore') ? { useAuthStore: auth } : { taskService: service },
    setTimeout: (callback, delay) => { timers.set(++next, { callback, at: now + delay }); return next; },
    clearTimeout: id => timers.delete(id),
  });
  return { store: exports.useTaskStore, auth, service, calls,
    tick: ms => { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); } },
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('300 ms debounce reduces five character requests to one and ignores redundant filters', async () => {
  const { store, calls, tick } = setup();
  for (const query of ['h', 'he', 'hel', 'hell', 'hello']) { store.getState().setSearch(query); tick(40); }
  assert.equal(calls.length, 0);
  tick(259);
  assert.equal(calls.length, 0);
  tick(1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filters.search, 'hello');
  calls[0].resolve(page([])); await flush();
  store.getState().setFilters({ status: undefined });
  assert.equal(calls.length, 1);
});

test('out-of-order success and failure cannot overwrite the newest query', async () => {
  const { store, calls } = setup();
  const old = store.getState().loadTasks();
  store.getState().setFilters({ status: 'completed' });
  calls[1].resolve(page([task('new')])); await flush();
  calls[0].resolve(page([task('old')])); await old;
  assert.equal(store.getState().tasks[0].id, 'new');
  store.getState().setFilters({ status: 'pending' });
  store.getState().setFilters({ priority: 'high' });
  calls[2].reject(new Error('stale')); await flush();
  assert.equal(store.getState().error, null);
  assert.equal(store.getState().isRefreshing, true);
  calls[3].resolve(page([])); await flush();
});

test('pagination serializes requests, deduplicates rows, and stops at total', async () => {
  const { store, calls } = setup();
  const first = store.getState().loadTasks();
  calls[0].resolve(page(Array.from({ length: 20 }, (_, i) => task(String(i))), 39)); await first;
  const more = store.getState().loadMore();
  await store.getState().loadMore();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].filters.page, 2);
  calls[1].resolve(page([task('19'), ...Array.from({ length: 19 }, (_, i) => task(String(i + 20)))], 39)); await more;
  assert.equal(store.getState().tasks.length, 39);
  assert.equal(store.getState().hasMore, false);
  await store.getState().loadMore(); assert.equal(calls.length, 2);
});

test('refresh preserves rows, and an empty page ends pagination', async () => {
  const { store, calls } = setup();
  let request = store.getState().loadTasks(); calls[0].resolve(page([task('a')], 30)); await request;
  request = store.getState().loadTasks();
  assert.equal(store.getState().tasks[0].id, 'a');
  assert.equal(store.getState().isLoading, false);
  assert.equal(store.getState().isRefreshing, true);
  calls[1].resolve(page([task('a')], 30)); await request;
  request = store.getState().loadMore(); calls[2].resolve(page([], 30)); await request;
  assert.equal(store.getState().hasMore, false);
});

test('account switch resets cache and ignores old list, detail, mutation and debounce', async () => {
  const { store, calls, auth, service, tick } = setup();
  const detail = deferred(), mutation = deferred();
  service.getById = () => detail.promise; service.create = () => mutation.promise;
  const listPromise = store.getState().loadTasks();
  const detailPromise = store.getState().loadTask('old');
  const mutationPromise = store.getState().createTask({ title: 'old' });
  store.getState().setSearch('old');
  auth.setState({ user: { id: 'b' } });
  tick(300);
  assert.equal(calls.length, 1);
  const newPromise = store.getState().loadTasks();
  calls[1].resolve(page([task('new')])); await newPromise;
  calls[0].resolve(page([task('old')])); detail.resolve(task('old')); mutation.resolve(task('old'));
  await Promise.all([listPromise, detailPromise, mutationPromise]);
  assert.equal(store.getState().tasks[0].id, 'new');
  assert.equal(store.getState().selectedTask, null);
  auth.setState({ user: null });
  assert.equal(store.getState().tasks.length, 0);
});

test('optimistic completion deduplicates taps, ignores stale lists and rolls back failure', async () => {
  const { store, calls, service } = setup();
  const first = store.getState().loadTasks(); calls[0].resolve(page([task('a')])); await first;
  const stale = store.getState().loadTasks();
  const completion = deferred(); let count = 0;
  service.complete = () => { count++; return completion.promise; };
  const pending = store.getState().completeTask('a');
  await store.getState().completeTask('a');
  assert.equal(count, 1);
  assert.equal(store.getState().tasks[0].status, 'completed');
  calls[1].resolve(page([task('a')])); await stale;
  assert.equal(store.getState().tasks[0].status, 'completed');
  completion.reject(new Error('offline')); await pending;
  assert.equal(store.getState().tasks[0].status, 'pending');
  assert.equal(store.getState().error, 'offline');
});

test('failed pagination retries the same page', async () => {
  const { store, calls } = setup();
  let request = store.getState().loadTasks(); calls[0].resolve(page([task('a')], 40)); await request;
  request = store.getState().loadMore(); calls[1].reject(new Error('offline')); await request;
  assert.equal(store.getState().page, 1);
  request = store.getState().loadMore(); assert.equal(calls[2].filters.page, 2);
  calls[2].resolve(page([task('b')], 40)); await request;
});


test('detail loading remains independent of list completion and ignores cleared detail', async () => {
  const { store, calls, service } = setup();
  const detail = deferred(); service.getById = () => detail.promise;
  const loading = store.getState().loadTask('a');
  const listing = store.getState().loadTasks();
  calls[0].resolve(page([task('a')])); await listing;
  assert.equal(store.getState().isLoading, true);
  store.getState().clearSelectedTask();
  detail.resolve(task('a')); await loading;
  assert.equal(store.getState().selectedTask, null);
  assert.equal(store.getState().isLoading, false);
});

test('typing invalidates a running response immediately, before debounce fires', async () => {
  const { store, calls, tick } = setup();
  const old = store.getState().loadTasks();
  store.getState().setSearch('new');
  calls[0].resolve(page([task('old')])); await old;
  assert.equal(store.getState().tasks.length, 0);
  tick(300);
  calls[1].resolve(page([task('new')])); await flush();
  assert.equal(store.getState().tasks[0].id, 'new');
});

test('completion from an old account cannot modify the new account', async () => {
  const { store, calls, auth, service } = setup();
  let request = store.getState().loadTasks(); calls[0].resolve(page([task('same')])); await request;
  const completion = deferred(); service.complete = () => completion.promise;
  const pending = store.getState().completeTask('same');
  auth.setState({ user: { id: 'b' } });
  request = store.getState().loadTasks(); calls[1].resolve(page([task('same')])); await request;
  completion.resolve(task('same', 'completed')); await pending;
  assert.equal(store.getState().tasks[0].status, 'pending');
  assert.equal(calls.length, 2);
});
