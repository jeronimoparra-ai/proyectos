-- Run with psql as database owner, before 004. This report is read-only.
-- Export its output into restricted incident storage (contains user identifiers).
SELECT r.id AS reminder_id, r.user_id AS reminder_user_id, r.task_id,
       t.user_id AS task_user_id, r.remind_at, r.type, r.is_sent, r.created_at
FROM public.reminders r LEFT JOIN public.tasks t ON t.id = r.task_id
WHERE t.id IS NULL OR t.user_id IS DISTINCT FROM r.user_id
ORDER BY r.id;

-- REVIEWED REPAIR TEMPLATE ONLY. Do not infer which user's ownership is correct.
-- Back up first; stop API/checkers until repair AND migration 004 have committed.
-- Prefer assigning the reminder to an explicitly confirmed task owned by its
-- existing user, retaining reminder id, timestamp, type and delivery state.
-- BEGIN;
-- LOCK TABLE public.tasks, public.reminders IN SHARE ROW EXCLUSIVE MODE;
-- UPDATE public.reminders r
-- SET task_id = '<reviewed replacement task UUID>'::uuid
-- WHERE r.id = '<reviewed reminder UUID>'::uuid
--   AND r.user_id = '<expected reminder owner UUID>'::uuid
--   AND r.task_id = '<original task UUID>'::uuid
--   AND EXISTS (SELECT 1 FROM public.tasks t
--               WHERE t.id = '<reviewed replacement task UUID>'::uuid
--                 AND t.user_id = r.user_id);
-- Verify exactly one row changed, re-run report, and review before COMMIT.
-- COMMIT;
-- No automated deletion, reassignment of user_id, or disabling RLS is provided.

-- Deployment audit: these are observations, not evidence from this local test.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('tasks', 'reminders');
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid IN ('public.tasks'::regclass, 'public.reminders'::regclass);
SELECT role_name, table_name,
       has_table_privilege(role_name, table_name, 'SELECT') AS can_select,
       has_table_privilege(role_name, table_name, 'INSERT') AS can_insert,
       has_table_privilege(role_name, table_name, 'UPDATE') AS can_update,
       has_table_privilege(role_name, table_name, 'DELETE') AS can_delete,
       has_table_privilege(role_name, table_name, 'TRUNCATE') AS can_truncate
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) roles(role_name)
CROSS JOIN (VALUES ('public.tasks'), ('public.reminders')) tables(table_name);
SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN ('tasks', 'reminders');
SELECT conname, convalidated, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'public.reminders'::regclass;
