# Offline (Equipo B)

Import `useOfflineStore` from `src/store/useOfflineStore`; `OfflineOp` is exported
there and from `services/offline/engine`. Mount `useOfflineSync()` once in the
 authenticated root for mount/foreground/web-online recovery. Successful API
requests also trigger recovery. No polling or background worker is installed.

The store exposes `pending`, `isSyncing`, `lastSyncAt` (epoch milliseconds),
`conflict`, and async `syncNow`, `resolveConflict(id, choice)`, `clearForUser`.
Queue and list cache share `offline:v1:<encoded userId>` in AsyncStorage.
Account changes abort replay and reset memory; the old account's disk queue is
retained for its next login. `clearForUser()` clears only the active account.
Tokens are obtained afresh from Supabase for each replay and never persisted.

Supported writes: POST /tasks, PATCH or PUT /tasks/:id, PATCH /tasks/:id/complete,
and POST /events. Other mutations retain their original API behavior. The UUID
Idempotency-Key remains stable across the first request and every retry. Local
creations have a `local-<uuid>` ID; queued dependent edits are remapped after
creation. UI stores must reload after lastSyncAt changes to replace local IDs.
List caches are partitioned by full endpoint (including filters), expire after
five minutes, are bounded to 50 entries, and are invalidated on successful
writes/replay or remote conflict resolution. They are snapshots; pending local
operations remain separately available in `pending` across restarts.

No NetInfo dependency is installed. Native recovery happens on foreground,
successful fetch, manual sync, or the three bounded attempts of an active sync
(500/1000 ms backoff; 15 s network deadline per attempt). Remaining offline in
foreground without requests after retries are exhausted needs manual sync.

Conflicts stop FIFO replay. HTTP 409/412 and other non-auth client failures are
surfaced, not discarded. Because this backend does not implement atomic version
preconditions, replayed edits/completions conservatively require explicit local
resolution even when a preflight GET could look unchanged. `local` authorizes
sending the queued content; `remote` discards it (and dependent edits for a
 discarded local creation); `retry` retries without authorizing overwrite and
will surface the edit conflict again. Auth errors retain the queue.

Backend limitation: the current controllers do not enforce Idempotency-Key.
Client queue deduplication is implemented, but exactly-once delivery after an
ambiguous timeout/crash requires server-side transactional idempotency. HTTP
conflicts still depend on server responses for creations. This change does not
claim server-side deduplication or automatic merge support.

Verification: `npx tsc --noEmit` and
`node --test src/__tests__/offline.test.cjs`. Tests execute the production engine,
store and API with platform IO doubles; they do not replace device testing.
