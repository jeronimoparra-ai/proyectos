// Only disposable local Postgres; synthetic data is rolled back after measurement.
import pg from 'pg';
const host = process.env.TEST_DB_HOST ?? '127.0.0.1';
const database = process.env.TEST_DB_NAME ?? 'productivity_test';
if (!['localhost', '127.0.0.1'].includes(host) || database !== 'productivity_test') throw new Error('Disposable local test database required');
const client = new pg.Client({ host, database, port: Number(process.env.TEST_DB_PORT ?? 55434), user: 'test_user', password: 'test_password' });
await client.connect();
try {
  await client.query('BEGIN');
  // Benchmark the pre-index plan; rollback restores any existing test index.
  await client.query('DROP INDEX IF EXISTS public.idx_reminders_pending_due');
  const { rows: [user] } = await client.query("INSERT INTO auth.users(email) VALUES ('query-plan-synthetic@example.test') RETURNING id");
  const owner = user.id;
  await client.query(`INSERT INTO tasks(user_id,title,due_date) SELECT $1,'Synthetic '||g,now()+g*interval '1 minute' FROM generate_series(1,20000) g`, [owner]);
  await client.query(`INSERT INTO reminders(user_id,task_id,remind_at,is_sent,sent_at)
    SELECT $1,t.id,now() + (g-5)*interval '1 hour', g>5, CASE WHEN g>5 THEN now() END
    FROM tasks t CROSS JOIN generate_series(1,10) g WHERE user_id=$1`, [owner]);
  await client.query(`INSERT INTO academic_tasks(user_id,title,total_reviews,next_review_at)
    SELECT $1,'Synthetic '||g,g%20,now()-g*interval '1 minute' FROM generate_series(1,20000) g`, [owner]);
  await client.query('ANALYZE tasks; ANALYZE reminders; ANALYZE academic_tasks');
  const queries = {
    'Task page, existing indexes': `SELECT * FROM tasks WHERE user_id=$1 AND deleted_at IS NULL ORDER BY due_date ASC NULLS LAST,created_at DESC,id LIMIT 25`,
    'Reminder claim candidates, existing indexes': `SELECT r.id FROM reminders r JOIN tasks t ON t.id=r.task_id AND t.user_id=r.user_id
      WHERE NOT r.is_sent AND r.sent_at IS NULL AND r.remind_at<=now() AND t.deleted_at IS NULL AND r.retry_count<20
      AND (r.claimed_at IS NULL OR r.claimed_at<now()-interval '300 seconds') AND (r.retry_at IS NULL OR r.retry_at<=now())
      ORDER BY r.remind_at,r.id LIMIT 25 FOR UPDATE OF r SKIP LOCKED`,
    'Stats before: download (PostgREST default cap)': `SELECT id,next_review_at,review_count,total_reviews FROM academic_tasks WHERE user_id=$1 AND deleted_at IS NULL LIMIT 1000`,
    'Stats before: second exact count': `SELECT count(*) FROM academic_tasks WHERE user_id=$1 AND deleted_at IS NULL`,
    'Stats after: aggregate all rows': `SELECT count(*),count(*) FILTER(WHERE next_review_at<=now()),coalesce(sum(total_reviews),0) FROM academic_tasks WHERE user_id=$1 AND deleted_at IS NULL`,
  };
  console.log('# P4 synthetic EXPLAIN (ANALYZE, BUFFERS)\n\nPostgreSQL 16; 20,000 tasks, 200,000 reminders (50% sent), 20,000 academic tasks; one heavy tenant. Existing indexes first, then one candidate partial index measured in the same rollback transaction.\n');
  for (const [title, sql] of Object.entries(queries)) {
    const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, sql.includes('$1') ? [owner] : []);
    console.log(`## ${title}\n\n\`\`\`text\n${result.rows.map((r) => r['QUERY PLAN']).join('\n')}\n\`\`\`\n`);
  }
  await client.query('CREATE INDEX idx_reminders_pending_due ON public.reminders(remind_at,id) WHERE NOT is_sent AND sent_at IS NULL AND retry_count < 20');
  const candidate = queries['Reminder claim candidates, existing indexes'];
  const after = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${candidate}`);
  console.log(`## Reminder claim candidates after partial index\n\n\`\`\`text\n${after.rows.map((r) => r['QUERY PLAN']).join('\n')}\n\`\`\`\n`);

} finally { await client.query('ROLLBACK'); await client.end(); }
