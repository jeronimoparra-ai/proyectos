-- Atomic: stop on historical inconsistencies; never delete or reassign user data.
-- Run docs/t1-postgres-remediation.sql as the database owner before deployment.
BEGIN;
LOCK TABLE public.tasks, public.reminders IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE invalid_count bigint;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM public.reminders r
  LEFT JOIN public.tasks t ON t.id = r.task_id AND t.user_id = r.user_id
  WHERE t.id IS NULL;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION '004 blocked: % reminder ownership violations; review docs/t1-postgres-remediation.sql', invalid_count;
  END IF;
END $$;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_id_user_id_key UNIQUE (id, user_id);
-- Replace, rather than supplement, the old FK: PostgREST embedding stays unambiguous.
ALTER TABLE public.reminders DROP CONSTRAINT reminders_task_id_fkey;
ALTER TABLE public.reminders ADD CONSTRAINT reminders_task_id_user_id_fkey
  FOREIGN KEY (task_id, user_id) REFERENCES public.tasks (id, user_id)
  ON DELETE CASCADE;

DROP POLICY "Users can manage own reminders" ON public.reminders;
CREATE POLICY "Users can manage own reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()
  ));

-- RLS remains enabled. Remove inherited public/anonymous access and TRUNCATE,
-- REFERENCES and TRIGGER privileges, which normal Data API callers do not need.
REVOKE ALL ON public.tasks, public.reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks, public.reminders TO authenticated;
REVOKE ALL ON public.reminders FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
