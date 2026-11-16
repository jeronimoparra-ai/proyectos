-- ============================================================
-- 009_grant_table_privileges.sql
-- Fix de producción: el backend y la app recibían 403
-- (42501 "permission denied for table ...") en casi todas las tablas.
--
-- Causa raíz:
--   Las migraciones 001–003 crearon las tablas, pero nunca concedieron
--   privilegios a `authenticated` / `service_role`. En Supabase esos roles
--   existen de antes, así que `ALTER DEFAULT PRIVILEGES` del proyecto no los
--   cubrió: solo respondían `reminders` (004) y las `calendar_*` (005), que sí
--   hacen GRANT explícito.
--   RLS decide QUÉ FILAS ve cada usuario; los GRANT deciden si la tabla es
--   accesible. Faltaban los GRANT, no las políticas.
--
-- Alcance:
--   - `authenticated` y `service_role`: CRUD en las tablas de datos.
--   - `anon`: solo USAGE del esquema (el alta/login pasan por GoTrue, no por
--     PostgREST); no se le da acceso a tablas.
--   - `calendar_integrations` y `calendar_oauth_states` siguen siendo solo
--     `service_role` (la 005 les hace REVOKE deliberado a anon/authenticated).
--
-- Las 18 tablas tienen RLS habilitado, así que conceder CRUD no expone filas
-- ajenas. Idempotente: se puede reaplicar sin efectos secundarios.
-- ============================================================
BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Tablas de datos del usuario (RLS filtra las filas).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.tasks,
  public.subtasks,
  public.categories,
  public.tags,
  public.task_tags,
  public.events,
  public.reminders,
  public.notifications,
  public.push_tokens,
  public.ai_interactions,
  public.academic_tasks,
  public.topics,
  public.reviews,
  public.study_sessions,
  public.study_materials,
  public.user_preferences
TO authenticated, service_role;

-- Secuencias (por si alguna tabla usa serial/identity en el futuro).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- La 005 restringe estas dos a service_role; se reafirma por si acaso.
REVOKE ALL ON public.calendar_integrations, public.calendar_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.calendar_integrations, public.calendar_oauth_states TO service_role;

-- Tablas y secuencias que se creen en el futuro heredan los mismos privilegios
-- (sin esto, cada migración nueva repetiría el bug).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

COMMIT;
