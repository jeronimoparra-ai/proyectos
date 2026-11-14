-- ============================================================
-- T5 (después de 004 T1, 005 T3, 006 T4): trabajador de
-- recordatorios con reserva atómica, deduplicación y reintentos
-- con backoff.
-- ============================================================

-- Columnas de estado para la reserva atómica y la recuperación
-- tras interrupción del trabajador.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ;

-- Contador de intentos de reintento (para acotar el backoff).
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- Índice de apoyo a la reserva atómica determinista.
CREATE INDEX IF NOT EXISTS idx_reminders_claim_state
  ON public.reminders (sent_at, claimed_at, retry_at, remind_at, id);

-- Procedimiento almacenado: reserva atómica de un lote determinista de
-- recordatorios pendientes.
--
-- El UPDATE establece claimed_at/locked_by y libera retry_at, por lo que
-- un claim no hereda un cooldown previo. El WHERE excluye:
--   - ya procesados  (sent_at IS NOT NULL)
--   - claims caducados (claimed_at < now() - p_claim_ttl)
--   - reintentos en cooldown (retry_at > now())
-- El ORDER BY da el orden deterministico (remind_at ASC, id ASC).
--
-- El RETRUNING devuelve el lote como tabla; las subtablas recuperan el
-- título y prioridad del task asociado (tasks en el mismo esquema).
CREATE OR REPLACE FUNCTION public.claim_due_reminders(
  p_locked_by TEXT,
  p_limit INT,
  p_claim_ttl INT
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  remind_at TIMESTAMPTZ,
  type TEXT,
  created_at TIMESTAMPTZ,
  task_id UUID,
  task_title TEXT,
  task_priority TEXT
)
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  UPDATE reminders r
  SET claimed_at = now(), locked_by = p_locked_by, retry_at = NULL
  FROM (
    SELECT id, task_id
    FROM reminders
    WHERE is_sent = false
      AND sent_at IS NULL
      AND (claimed_at IS NULL OR claimed_at < now() - interval '1 second' * p_claim_ttl)
      AND (retry_at IS NULL OR retry_at <= now())
    ORDER BY remind_at ASC, id ASC
    LIMIT p_limit
  ) c
  WHERE r.id = c.id
  RETURNING
    r.id,
    r.user_id,
    r.remind_at,
    r.type,
    r.created_at,
    r.task_id,
    (SELECT t.title FROM tasks t WHERE t.id = c.task_id) AS task_title,
    (SELECT t.priority FROM tasks t WHERE t.id = c.task_id) AS task_priority;
$$;
