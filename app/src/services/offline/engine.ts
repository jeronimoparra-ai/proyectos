export interface OfflineOp {
  id: string;
  idempotencyKey: string;
  userId: string;
  timestamp: number;
  endpoint: string;
  method: string;
  body: Record<string, unknown>;
  local: Record<string, unknown>;
  status: 'pending' | 'conflict';
  attempts: number;
  resolution?: 'local';
}
export interface OfflineState {
  pending: OfflineOp[];
  isSyncing: boolean;
  lastSyncAt: number | null;
  conflict: OfflineOp | null;
}
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface Session { userId: string; token: string }
export type Transport = (endpoint: string, method: string, body: unknown, session: Session,
  key: string, signal: AbortSignal) => Promise<unknown>;
type Cache = Record<string, { expires: number; data: unknown }>;
const empty = (): OfflineState => ({ pending: [], isSyncing: false, lastSyncAt: null, conflict: null });
export const isMutation = (path: string, method: string) =>
  (method === 'POST' && /^\/(tasks|events)$/.test(path)) ||
  (['PATCH', 'PUT'].includes(method) && /^\/tasks\/[^/?]+(?:\/complete)?$/.test(path));
export const isList = (path: string) => /^\/(tasks|events)(?:\?|$)/.test(path) ||
  /^\/(tasks\/(overdue|upcoming)|events\/range)(?:\?|$)/.test(path);
export function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
    c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
}
// Persist only domain fields, never headers, session objects or arbitrary input properties.
const fields = new Set('title description due_date due_time status priority category_id estimated_minutes actual_minutes color is_recurring recurrence_rule tags start_date end_date all_day location'.split(' '));
function clean(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (fields.has(key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value))) result[key] = value;
    if (key === 'tags' && Array.isArray(value)) result[key] = value.filter(v => typeof v === 'string');
  }
  return result;
}
export class OfflineEngine {
  state = empty();
  userId: string | null = null;
  private cache: Cache = {};
  private epoch = 0;
  private ready: Promise<void> = Promise.resolve();
  private writes: Promise<void> = Promise.resolve();
  private flight: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private listeners = new Set<(state: OfflineState) => void>();
  transport?: Transport;
  constructor(private storage: Storage, private session: () => Promise<Session | null>,
    private sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
    private now = () => Date.now()) {}
  subscribe(listener: (state: OfflineState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() {
    this.state = { ...this.state, conflict: this.state.pending.find(op => op.status === 'conflict') ?? null };
    this.listeners.forEach(fn => fn(this.state));
  }
  private key(userId: string) { return `offline:v1:${encodeURIComponent(userId)}`; }
  setUser(userId: string | null): Promise<void> {
    if (userId === this.userId) return this.ready;
    this.controller?.abort();
    const epoch = ++this.epoch;
    this.userId = userId; this.state = empty(); this.cache = {}; this.emit();
    this.ready = (async () => {
      await this.writes;
      if (!userId) return;
      const raw = await this.storage.getItem(this.key(userId));
      if (epoch !== this.epoch || !raw) return;
      const data = JSON.parse(raw);
      const seen = new Set<string>();
      this.state.pending = (data.pending ?? []).filter((op: OfflineOp) => {
        if (op.userId !== userId || !isMutation(op.endpoint, op.method) || seen.has(op.idempotencyKey)) return false;
        seen.add(op.idempotencyKey); return true;
      });
      this.state.lastSyncAt = data.lastSyncAt ?? null;
      this.cache = data.cache ?? {}; this.emit();
    })();
    return this.ready;
  }
  private persist() {
    if (!this.userId) return Promise.resolve();
    const key = this.key(this.userId);
    const data = JSON.stringify({ pending: this.state.pending, lastSyncAt: this.state.lastSyncAt, cache: this.cache });
    const write = this.writes.catch(() => {}).then(() => this.storage.setItem(key, data));
    this.writes = write; return write;
  }
  async clearForUser() {
    await this.ready;
    this.controller?.abort(); ++this.epoch;
    this.state = empty(); this.cache = {}; this.emit(); await this.persist();
  }
  async cacheList(endpoint: string, data: unknown, userId: string, ttl = 300_000) {
    await this.ready;
    if (userId !== this.userId || !isList(endpoint)) return;
    this.cache[endpoint] = { data, expires: this.now() + ttl };
    // Bound disk usage and avoid retaining expired entries indefinitely.
    this.cache = Object.fromEntries(Object.entries(this.cache).filter(([, v]) => v.expires > this.now()).slice(-50));
    await this.persist();
  }
  async cached(endpoint: string, userId: string) {
    await this.ready;
    if (this.userId !== userId) return undefined;
    const entry = this.cache[endpoint];
    return entry && entry.expires > this.now() ? entry.data : undefined;
  }
  async invalidate(userId: string) {
    await this.ready;
    if (userId !== this.userId) return;
    this.cache = {}; await this.persist();
  }
  async enqueue(endpoint: string, method: string, body: Record<string, unknown>, userId: string, key = uuid()) {
    await this.ready;
    if (userId !== this.userId) throw new Error('Offline session changed');
    if (!isMutation(endpoint, method)) throw new Error('Unsupported offline operation');
    const existing = this.state.pending.find(op => op.idempotencyKey === key);
    if (existing) return existing.local;
    const timestamp = this.now(), data = clean(body), id = method === 'POST' ? `local-${key}` : endpoint.split('/')[2];
    const previous = this.state.pending.filter(op => op.local.id === id).at(-1)?.local;
    let cached: Record<string, unknown> | undefined;
    for (const entry of Object.values(this.cache)) {
      const rows = Array.isArray(entry.data) ? entry.data : (entry.data as { tasks?: unknown[]; events?: unknown[] })?.tasks ?? (entry.data as { events?: unknown[] })?.events;
      cached ??= rows?.find((row: any) => row.id === id) as Record<string, unknown> | undefined;
    }
    const local = { description: null, due_date: null, due_time: null, category_id: null, color: null,
      estimated_minutes: null, actual_minutes: null, is_recurring: false, recurrence_rule: null,
      deleted_at: null, location: null, external_id: null, all_day: false, source: 'local',
      title: '', status: 'pending', priority: 'medium', created_at: new Date(timestamp).toISOString(),
      ...cached, ...previous, ...data, id, user_id: userId, updated_at: new Date(timestamp).toISOString(),
      ...(endpoint.endsWith('/complete') ? { status: 'completed' } : {}) };
    this.state.pending = [...this.state.pending, { id: key, idempotencyKey: key, userId, timestamp,
      endpoint, method, body: data, local, status: 'pending', attempts: 0 }];
    await this.persist(); this.emit(); return local;
  }
  syncNow(): Promise<void> {
    if (this.flight) return this.flight;
    this.flight = this.run().finally(() => { this.flight = null; });
    return this.flight;
  }
  private async run() {
    await this.ready;
    if (!this.userId || !this.transport) return;
    const epoch = this.epoch;
    this.controller = new AbortController(); const signal = this.controller.signal;
    this.state.isSyncing = true; this.emit();
    try {
      while (epoch === this.epoch && this.state.pending.length) {
        const op = this.state.pending[0];
        if (op.status === 'conflict') break;
        // The current backend has no atomic version precondition. Require an explicit
        // local decision for replayed edits; a read-before-write alone has a race.
        if (op.method !== 'POST' && op.resolution !== 'local') {
          op.status = 'conflict'; await this.persist(); this.emit(); break;
        }
        let succeeded = false;
        for (let attempt = 0; attempt < 3 && epoch === this.epoch; attempt++) {
          const session = await this.session();
          if (epoch !== this.epoch || signal.aborted || session?.userId !== op.userId || !session.token) return;
          try {
            op.attempts++; await this.persist();
            if (epoch !== this.epoch || signal.aborted) return;
            const result = await this.transport(op.endpoint, op.method, op.body, session, op.idempotencyKey, signal) as { id?: string } | undefined;
            if (epoch !== this.epoch) return;
            if (op.method === 'POST' && result?.id) {
              this.state.pending = this.state.pending.map(next => next === op ? next : {
                ...next, endpoint: next.endpoint.replace(String(op.local.id), result.id!),
                local: next.local.id === op.local.id ? { ...next.local, id: result.id } : next.local,
              });
            }
            this.state.pending = this.state.pending.filter(next => next.id !== op.id);
            this.cache = {}; this.state.lastSyncAt = this.now();
            await this.persist(); this.emit(); succeeded = true; break;
          } catch (error) {
            if (epoch !== this.epoch || signal.aborted) return;
            const status = (error as { status?: number }).status;
            if (status && status < 500) {
              if (status !== 401 && status !== 403) { op.status = 'conflict'; await this.persist(); this.emit(); }
              return;
            }
            if (attempt < 2) await this.sleep(Math.min(500 * 2 ** attempt, 2000));
          }
        }
        if (!succeeded) break;
      }
    } finally {
      if (epoch === this.epoch) { this.state.isSyncing = false; this.emit(); }
    }
  }
  async markConflict(id: string) {
    await this.ready;
    const op = this.state.pending.find(item => item.id === id);
    if (op) { op.status = 'conflict'; await this.persist(); this.emit(); }
  }
  async resolveConflict(id: string, choice: 'local' | 'remote' | 'retry') {
    await this.ready;
    if (this.state.isSyncing) return;
    const op = this.state.pending.find(item => item.id === id && item.status === 'conflict');
    if (!op) return;
    if (choice === 'remote') {
      // A discarded local create also discards mutations that depend on its local ID.
      this.state.pending = this.state.pending.filter(item => item.id !== id && !(op.method === 'POST' && item.endpoint.includes(String(op.local.id))));
      this.cache = {};
    } else { op.status = 'pending'; op.resolution = choice === 'local' ? 'local' : undefined; }
    await this.persist(); this.emit(); await this.syncNow();
  }
}
