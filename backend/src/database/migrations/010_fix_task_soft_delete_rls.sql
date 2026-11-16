-- ============================================================
-- 010_fix_task_soft_delete_rls.sql
-- Fix de producción: DELETE de tareas devolvía 403/500
-- "new row violates row-level security policy for table tasks".
--
-- Causa raíz:
--   La política SELECT de `tasks` incluía `deleted_at IS NULL`. PostgreSQL
--   exige que la fila RESULTANTE de un UPDATE siga cumpliendo las políticas
--   SELECT aplicables, así que marcar `deleted_at` (soft delete) rompía RLS.
--
-- Solución:
--   La política SELECT pasa a filtrar SOLO por dueño (`auth.uid() = user_id`).
--   El aislamiento entre cuentas se mantiene; las tareas borradas NO se filtran
--   desde RLS, pero TODAS las lecturas del backend ya aplican
--   `.is('deleted_at', null)` (task.service list/getById), así que la API
--   sigue sin devolverlas. Se fija WITH CHECK explícito en UPDATE para que
--   la fila modificada siga validando propiedad.
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================
BEGIN;

DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
