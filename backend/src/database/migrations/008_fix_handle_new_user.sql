-- ============================================================
-- 008_fix_handle_new_user.sql
-- Fix de producción: el alta de usuarios (GoTrue → auth.users)
-- fallaba con HTTP 500 "Database error creating new user".
--
-- Causa raíz:
--   handle_new_user() se declaró SECURITY DEFINER SIN `SET search_path`.
--   En Supabase, GoTrue se conecta como el rol `supabase_auth_admin`, al que
--   el propio Supabase le fija `ALTER ROLE supabase_auth_admin SET search_path = "auth"`
--   (supabase/postgres, init-scripts/00000000000001-auth-schema.sql).
--   Por tanto el INSERT interno resolvía `user_preferences` contra el esquema
--   `auth`, no contra `public`, y abortaba con:
--       ERROR 42P01: relation "user_preferences" does not exist
--   GoTrue traduce cualquier error de base de datos al 500 genérico
--   "unexpected_failure / Database error creating new user".
--
-- Solución (defensa en profundidad):
--   1. `SET search_path = ''` en la función: el cuerpo ya no depende del
--      search_path del rol llamador (ni de `"auth"`, ni de `""`, ni de
--      `"$user", public`) y no puede ser secuestrado por un esquema temporal.
--   2. Nombres completamente cualificados (`public.user_preferences`).
--   3. `ON CONFLICT DO NOTHING`: el trigger es idempotente ante reintentos de
--      GoTrue o filas de preferencias preexistentes.
--   4. Backfill de usuarios creados mientras el trigger estaba roto.
--
-- Idempotente: se puede reaplicar sin efectos secundarios.
-- ============================================================
BEGIN;

-- 1) Función del trigger, ahora con search_path fijo y tabla cualificada.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Crea las preferencias por defecto del usuario recién registrado.
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) Re-crea el trigger apuntando explícitamente a public.handle_new_user().
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Backfill: usuarios que quedaron sin fila de preferencias.
INSERT INTO public.user_preferences (user_id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_preferences p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- ============================================================
-- Validación manual tras aplicar (debe devolver 0 filas y permitir el alta):
--   SELECT count(*) FROM auth.users u
--   LEFT JOIN public.user_preferences p ON p.user_id = u.id
--   WHERE p.user_id IS NULL;                    -- esperado: 0
--
--   -- Simula el search_path real de GoTrue:
--   SET ROLE supabase_auth_admin;
--   INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'smoke@test.local');
--   RESET ROLE;
--   SELECT count(*) FROM public.user_preferences
--    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'smoke@test.local');  -- esperado: 1
-- ============================================================
