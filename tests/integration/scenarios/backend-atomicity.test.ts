import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getTestPool, closeTestPool } from '../helpers/db';
import { prepareCleanDatabase, insertAuthUser, asUser, asServiceRole } from '../helpers/bootstrap';

describe('P4 real PostgreSQL atomicity and isolation', () => {
  const pool = getTestPool();
  let owner: string;
  let other: string;
  beforeAll(async () => {
    await prepareCleanDatabase(pool);
    owner = await insertAuthUser(pool, 'p4-owner@example.test');
    other = await insertAuthUser(pool, 'p4-other@example.test');
  });
  afterAll(closeTestPool);

  async function task() {
    const r = await pool.query(`INSERT INTO academic_tasks(user_id,title) VALUES($1,'Synthetic') RETURNING id`, [owner]);
    return r.rows[0].id as string;
  }
  async function reminder(offset: string, extra = '') {
    const t = await pool.query(`INSERT INTO tasks(user_id,title) VALUES($1,'Synthetic') RETURNING id`, [owner]);
    const r = await pool.query(`INSERT INTO reminders(user_id,task_id,remind_at) VALUES($1,$2,now()+$3::interval) RETURNING id`, [owner, t.rows[0].id, offset]);
    if (extra) await pool.query(`UPDATE reminders SET ${extra} WHERE id=$1`, [r.rows[0].id]);
    return r.rows[0].id as string;
  }
  const review = 'SELECT * FROM record_review_atomic($1,$2,$3,null,null,$4)';

  it('rejects anon and missing subject for SECURITY DEFINER RPCs', async () => {
    const c = await pool.connect();
    try {
      await c.query('SET ROLE anon');
      await expect(c.query(`SELECT create_academic_task_atomic($1,'Forbidden')`, [owner])).rejects.toMatchObject({ code: '42501' });
      await c.query('RESET ROLE');
      await c.query("SELECT set_config('request.jwt.claim.sub','',false)");
      await c.query('SET ROLE authenticated');
      await expect(c.query(`SELECT create_academic_task_atomic($1,'Forbidden')`, [owner])).rejects.toMatchObject({ code: '42501' });
    } finally { await c.query('RESET ROLE'); c.release(); }
  });

  it('serializes same-key concurrent reviews and counts one historical review', async () => {
    const id = await task(); const key = randomUUID();
    const a = await pool.connect(); const b = await pool.connect();
    try {
      await asUser(a, owner); await asUser(b, owner);
      await a.query('BEGIN');
      const first = await a.query(review, [owner, id, 5, key]);
      const pid = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const pending = b.query(review, [owner, id, 5, key]);
      // Confirm the second database session actually waits on the first lock.
      let blocked = false;
      for (let i = 0; i < 100; i++) {
        const state = await pool.query(`SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1`, [pid]);
        if (state.rows[0]?.wait_event_type === 'Lock') { blocked = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await a.query('COMMIT');
      const second = await pending;
      expect(blocked).toBe(true);
      expect(second.rows[0].review_id).toBe(first.rows[0].review_id);
      expect(second.rows[0].is_duplicate).toBe(true);
      const state = await pool.query('SELECT review_count,total_reviews FROM academic_tasks WHERE id=$1', [id]);
      expect(state.rows[0]).toEqual({ review_count: 1, total_reviews: 1 });
    } finally { await a.query('ROLLBACK'); await a.query('RESET ROLE'); await b.query('RESET ROLE'); a.release(); b.release(); }
  });

  it('keeps history when SM-2 streak resets and rejects deleted tasks', async () => {
    const id = await task(); const c = await pool.connect();
    try {
      await asUser(c, owner);
      await c.query(review, [owner, id, 5, randomUUID()]);
      const failedRecall = await c.query(review, [owner, id, 1, randomUUID()]);
      expect(failedRecall.rows[0]).toMatchObject({ total_reviews: 2, sm2_repetitions: 0 });
      await c.query('RESET ROLE');
      await c.query('UPDATE academic_tasks SET deleted_at=now() WHERE id=$1', [id]);
      await asUser(c, owner);
      await expect(c.query(review, [owner, id, 5, randomUUID()])).rejects.toThrow('Academic task not found');
    } finally { await c.query('RESET ROLE'); c.release(); }
  });

  it('claims only due, live, non-exhausted reminders; recovers expired claims', async () => {
    await pool.query('DELETE FROM reminders');
    const due = await reminder('-1 hour');
    const expired = await reminder('-2 hours', "claimed_at=now()-interval '10 minutes', locked_by='dead'");
    await reminder('1 day');
    await reminder('-1 hour', "claimed_at=now(), locked_by='active'");
    await reminder('-1 hour', "retry_at=now()+interval '1 hour'");
    await reminder('-1 hour', 'retry_count=20');
    const deleted = await reminder('-1 hour');
    await pool.query('UPDATE tasks SET deleted_at=now() WHERE id=(SELECT task_id FROM reminders WHERE id=$1)', [deleted]);
    const c = await pool.connect();
    try {
      await asServiceRole(c);
      const result = await c.query("SELECT * FROM claim_due_reminders('worker',25,300)");
      expect(result.rows.map((r) => r.id)).toEqual([expired, due]);
    } finally { await c.query('RESET ROLE'); c.release(); }
  });

  it('SKIP LOCKED gives disjoint batches while a prior claim is uncommitted', async () => {
    await pool.query('DELETE FROM reminders');
    await reminder('-2 hours'); await reminder('-1 hour');
    const a = await pool.connect(); const b = await pool.connect();
    try {
      await asServiceRole(a); await asServiceRole(b);
      await a.query('BEGIN');
      const first = await a.query("SELECT * FROM claim_due_reminders('worker-a',1,300)");
      await b.query("SET statement_timeout='2s'");
      const second = await b.query("SELECT * FROM claim_due_reminders('worker-b',1,300)");
      expect(first.rowCount).toBe(1); expect(second.rowCount).toBe(1);
      expect(second.rows[0].id).not.toBe(first.rows[0].id);
    } finally { await a.query('ROLLBACK'); await a.query('RESET ROLE'); await b.query('RESET ROLE'); await b.query('RESET statement_timeout'); a.release(); b.release(); }
  });

  it('atomically reassigns tokens, ignores stale registration, isolates late logout', async () => {
    const c = await pool.connect();
    const sql = 'SELECT * FROM register_push_token_atomic($1,$2,$3,$4)';
    try {
      await asUser(c, owner);
      await c.query(sql, [owner, 'synthetic-push', 'android', null]);
      await asUser(c, other);
      const assigned = await c.query(sql, [other, 'synthetic-push', 'ios', null]);
      expect(assigned.rows[0].user_id).toBe(other);
      await asUser(c, owner);
      expect((await c.query(sql, [owner, 'synthetic-push', 'android', '2000-01-01'])).rows).toEqual([]);
      expect((await c.query('DELETE FROM push_tokens WHERE user_id=$1 AND token=$2', [owner, 'synthetic-push'])).rowCount).toBe(0);
      await expect(c.query(sql, [other, 'synthetic-push', 'android', null])).rejects.toMatchObject({ code: '42501' });
      await asUser(c, other);
      expect((await c.query("SELECT token FROM push_tokens WHERE active")).rows).toEqual([{ token: 'synthetic-push' }]);
    } finally { await c.query('RESET ROLE'); c.release(); }
  });

  it('does not overwrite a local event on an external identity conflict', async () => {
    const conn = await pool.query("INSERT INTO calendar_integrations(user_id,provider,calendar_id,sync_enabled,access_token) VALUES($1,'google','primary',true,'synthetic') RETURNING id", [owner]);
    await pool.query("INSERT INTO events(user_id,title,source,calendar_id,external_id,start_date,end_date) VALUES($1,'Local','local','primary','collision',now(),now()+interval '1 hour')", [owner]);
    const c = await pool.connect();
    try {
      await asServiceRole(c);
      const imported = await c.query('SELECT import_calendar_events($1,$2,$3) AS result', [owner, conn.rows[0].id, JSON.stringify([{ external_id: 'collision', title: 'Imported', start_date: '2026-01-01T00:00:00Z', end_date: '2026-01-01T01:00:00Z', all_day: false }])]);
      expect(imported.rows[0].result.imported).toBe(0);
      const event = await c.query("SELECT title,source FROM events WHERE external_id='collision'");
      expect(event.rows).toEqual([{ title: 'Local', source: 'local' }]);
    } finally { await c.query('RESET ROLE'); c.release(); }
  });
  it('returns full aggregate stats beyond the API row cap with owner isolation', async () => {
    const user = await insertAuthUser(pool, 'p4-stats@example.test');
    await pool.query(`INSERT INTO academic_tasks(user_id,title,total_reviews,next_review_at)
      SELECT $1,'Synthetic',2,now()-interval '1 hour' FROM generate_series(1,1501)`, [user]);
    const c = await pool.connect();
    try {
      await asUser(c, user);
      expect((await c.query('SELECT * FROM get_review_stats($1)', [user])).rows).toEqual([
        { total_tasks: '1501', due_today: '1501', total_reviews: '3002' },
      ]);
      await asUser(c, other);
      expect((await c.query('SELECT * FROM get_review_stats($1)', [user])).rows).toEqual([
        { total_tasks: '0', due_today: '0', total_reviews: '0' },
      ]);
    } finally { await c.query('RESET ROLE'); c.release(); }
  });

  it('serializes concurrent push registrations using the unique token constraint', async () => {
    const a = await pool.connect(); const b = await pool.connect();
    const sql = "SELECT * FROM register_push_token_atomic($1,'concurrent-token','android',null)";
    try {
      await asUser(a, owner); await asUser(b, other);
      await a.query('BEGIN');
      await a.query(sql, [owner]);
      const pending = b.query(sql, [other]);
      await a.query('COMMIT');
      expect((await pending).rows[0].user_id).toBe(other);
      expect((await b.query("SELECT * FROM push_tokens WHERE token='concurrent-token'")).rowCount).toBe(1);
    } finally { await a.query('ROLLBACK'); await a.query('RESET ROLE'); await b.query('RESET ROLE'); a.release(); b.release(); }
  });

  it('rejects a stale worker lease and prevents stale completion overwrites', async () => {
    const id = await reminder('-1 hour', "locked_by='new-worker',claimed_at=now()");
    const c = await pool.connect();
    try {
      await asServiceRole(c);
      expect((await c.query("SELECT renew_reminder_claim($1,'old-worker') AS renewed", [id])).rows[0].renewed).toBe(false);
      expect((await c.query("UPDATE reminders SET is_sent=true WHERE id=$1 AND locked_by='old-worker'", [id])).rowCount).toBe(0);
      expect((await c.query("SELECT renew_reminder_claim($1,'new-worker') AS renewed", [id])).rows[0].renewed).toBe(true);
    } finally { await c.query('RESET ROLE'); c.release(); }
  });

});
