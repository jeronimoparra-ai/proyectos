-- P4 corrective migration. 011/012 reserved by external work; no production execution.
-- Existing contracts retained; row locks precede idempotency checks.
BEGIN;
-- Measured with 200k synthetic reminders: 43.473ms / 60351 buffers ->
-- 0.426ms / 128 buffers. See backend/reports/p4-query-plans.md.
-- Supports the deterministic pending queue order; cooldown/lease remain filters.
CREATE INDEX IF NOT EXISTS idx_reminders_pending_due
  ON public.reminders(remind_at, id)
  WHERE NOT is_sent AND sent_at IS NULL AND retry_count < 20;

-- 006 introduced the historical counter with zero defaults; retain any larger
-- historical count (including deleted review records), never replace it by streak.
UPDATE public.academic_tasks t
SET total_reviews = greatest(t.total_reviews, history.total)
FROM (SELECT academic_task_id, count(*)::integer AS total FROM public.reviews GROUP BY academic_task_id) history
WHERE t.id = history.academic_task_id AND t.total_reviews < history.total;

CREATE OR REPLACE FUNCTION public.create_academic_task_atomic(
    p_user_id UUID,
    p_title VARCHAR,
    p_subject VARCHAR DEFAULT NULL,
    p_content TEXT DEFAULT NULL,
    p_materials JSONB DEFAULT '[]'::JSONB,
    p_topics JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
    task_id UUID,
    title VARCHAR,
    subject VARCHAR,
    content TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_task_id UUID;
    v_material JSONB;
    v_topic JSONB;
BEGIN
    -- Authenticated callers may only act within their own identity.
    -- Only an explicit service_role session may bypass identity matching.
    IF p_user_id IS NULL OR (p_user_id IS DISTINCT FROM auth.uid() AND current_setting('role', true) IS DISTINCT FROM 'service_role') THEN
        RAISE EXCEPTION 'User scope mismatch' USING ERRCODE = '42501';
    END IF;
    -- Insert the academic task
    INSERT INTO academic_tasks (user_id, title, subject, content)
    VALUES (p_user_id, p_title, p_subject, p_content)
    RETURNING id INTO v_task_id;

    -- Insert study materials if provided
    IF p_materials IS NOT NULL AND jsonb_array_length(p_materials) > 0 THEN
        FOR v_material IN SELECT * FROM jsonb_array_elements(p_materials)
        LOOP
            INSERT INTO study_materials (academic_task_id, type, content, file_name)
            VALUES (
                v_task_id,
                (v_material->>'type')::VARCHAR,
                v_material->>'content',
                CASE WHEN v_material ? 'file_name' THEN v_material->>'file_name' ELSE NULL END
            );
        END LOOP;
    END IF;

    -- Insert topics if provided
    IF p_topics IS NOT NULL AND jsonb_array_length(p_topics) > 0 THEN
        FOR v_topic IN SELECT * FROM jsonb_array_elements(p_topics)
        LOOP
            INSERT INTO topics (academic_task_id, name, description)
            VALUES (
                v_task_id,
                v_topic->>'name',
                CASE WHEN v_topic ? 'description' THEN v_topic->>'description' ELSE NULL END
            );
        END LOOP;
    END IF;

    -- Return the created task
    RETURN QUERY
    SELECT at.id, at.title, at.subject, at.content, at.created_at
    FROM academic_tasks at
    WHERE at.id = v_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_academic_task_atomic(UUID, VARCHAR, VARCHAR, TEXT, JSONB, JSONB) TO authenticated;

-- ============================================================
-- RPC: Atomic review recording with locking and idempotency
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_review_atomic(
    p_user_id UUID,
    p_academic_task_id UUID,
    p_quality INTEGER,
    p_difficulty REAL DEFAULT NULL,
    p_time_spent_seconds INTEGER DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS TABLE (
    review_id UUID,
    quality INTEGER,
    difficulty REAL,
    time_spent_seconds INTEGER,
    ease_factor REAL,
    "interval" INTEGER,
    repetitions INTEGER,
    next_review_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    is_duplicate BOOLEAN,
    sm2_repetitions INTEGER,
    total_reviews INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_review RECORD;
    v_last_review RECORD;
    v_ease_factor REAL := 2.5;
    v_interval INTEGER := 0;
    v_repetitions INTEGER := 0;  -- SM-2 consecutive repetitions (streak)
    v_new_ease_factor REAL;
    v_new_interval INTEGER;
    v_new_repetitions INTEGER;
    v_next_review_at TIMESTAMPTZ;
    v_total_reviews INTEGER;
BEGIN
    -- Authenticated callers may only act within their own identity.
    -- Only an explicit service_role session may bypass identity matching.
    IF p_user_id IS NULL OR (p_user_id IS DISTINCT FROM auth.uid() AND current_setting('role', true) IS DISTINCT FROM 'service_role') THEN
        RAISE EXCEPTION 'User scope mismatch' USING ERRCODE = '42501';
    END IF;
    -- Lock the academic task row to prevent concurrent modifications
    SELECT at.review_count, at.total_reviews
    INTO v_last_review
    FROM academic_tasks at
    WHERE at.id = p_academic_task_id
    AND at.user_id = p_user_id
    AND at.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic task not found'
        USING ERRCODE = 'P0001';
    END IF;


    IF p_quality IS NULL OR p_quality NOT BETWEEN 0 AND 5 THEN
      RAISE EXCEPTION 'Invalid quality' USING ERRCODE = '22023';
    END IF;

    -- Check for duplicate submission via idempotency key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT r.*, at.review_count as sm2_repetitions, at.total_reviews
        INTO v_existing_review
        FROM reviews r
        JOIN academic_tasks at ON at.id = r.academic_task_id
        WHERE r.idempotency_key = p_idempotency_key
        AND r.academic_task_id = p_academic_task_id
        AND r.user_id = p_user_id
        LIMIT 1;

        IF FOUND THEN
            -- Return existing review without creating duplicate
            RETURN QUERY
            SELECT
                v_existing_review.id as review_id,
                v_existing_review.quality,
                v_existing_review.difficulty,
                v_existing_review.time_spent_seconds,
                v_existing_review.ease_factor,
                v_existing_review.interval,
                v_existing_review.repetitions,
                v_existing_review.next_review_at,
                v_existing_review.created_at,
                TRUE as is_duplicate,
                v_existing_review.sm2_repetitions,
                v_existing_review.total_reviews;
            RETURN;
        END IF;
    END IF;

    -- Get the last review for SM-2 calculation (only for streak, not total)
    SELECT r.ease_factor, r.interval, r.repetitions
    INTO v_ease_factor, v_interval, v_repetitions
    FROM reviews r
    WHERE r.academic_task_id = p_academic_task_id
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 1;

    -- If no previous reviews, use defaults
    IF NOT FOUND THEN
        v_ease_factor := 2.5;
        v_interval := 0;
        v_repetitions := 0;
    END IF;

    -- SM-2 Algorithm calculation
    IF p_quality >= 3 THEN
        -- Correct recall
        IF v_repetitions = 0 THEN
            v_new_interval := 1;
        ELSIF v_repetitions = 1 THEN
            v_new_interval := 6;
        ELSE
            v_new_interval := ROUND(v_interval * v_ease_factor);
        END IF;
        v_new_repetitions := v_repetitions + 1;
    ELSE
        -- Incorrect recall: reset streak
        v_new_interval := 1;
        v_new_repetitions := 0;
    END IF;

    -- Update ease factor
    v_new_ease_factor := v_ease_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
    IF v_new_ease_factor < 1.3 THEN
        v_new_ease_factor := 1.3;
    END IF;
    v_new_ease_factor := ROUND(v_new_ease_factor * 100) / 100;

    -- Calculate next review date
    v_next_review_at := NOW() + (v_new_interval || ' days')::INTERVAL;

    -- Increment total_reviews (historical count, never resets)
    v_total_reviews := v_last_review.total_reviews + 1;

    -- Insert the new review
    INSERT INTO reviews AS inserted (
        academic_task_id,
        user_id,
        quality,
        difficulty,
        time_spent_seconds,
        ease_factor,
        interval,
        repetitions,
        next_review_at,
        idempotency_key, created_at
    ) VALUES (
        p_academic_task_id,
        p_user_id,
        p_quality,
        p_difficulty,
        p_time_spent_seconds,
        v_new_ease_factor,
        v_new_interval,
        v_new_repetitions,
        v_next_review_at,
        p_idempotency_key, clock_timestamp()
    ) RETURNING inserted.id, inserted.created_at INTO v_existing_review;

    -- Update academic_tasks with new SM-2 state and incremented total_reviews
    UPDATE academic_tasks
    SET
        next_review_at = v_next_review_at,
        review_count = v_new_repetitions,  -- SM-2 streak (resets on quality < 3)
        total_reviews = v_total_reviews    -- Historical total (never resets)
    WHERE id = p_academic_task_id;

    -- Return result
    RETURN QUERY
    SELECT
        v_existing_review.id as review_id,
        p_quality as quality,
        p_difficulty as difficulty,
        p_time_spent_seconds as time_spent_seconds,
        v_new_ease_factor as ease_factor,
        v_new_interval as interval,
        v_new_repetitions as repetitions,
        v_next_review_at as next_review_at,
        v_existing_review.created_at,
        FALSE as is_duplicate,
        v_new_repetitions as sm2_repetitions,
        v_total_reviews as total_reviews;
END;
$$;

GRANT EXECUTE ON FUNCTION record_review_atomic(UUID, UUID, INTEGER, REAL, INTEGER, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_locked_by text, p_limit int, p_claim_ttl int)
RETURNS TABLE(id uuid, user_id uuid, remind_at timestamptz, type text,
  created_at timestamptz, task_id uuid, task_title text, task_priority text)
LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
  WITH candidates AS MATERIALIZED (
    SELECT r.id FROM public.reminders r
    JOIN public.tasks t ON t.id = r.task_id AND t.user_id = r.user_id
    WHERE NOT r.is_sent AND r.sent_at IS NULL AND r.remind_at <= now()
      AND t.deleted_at IS NULL AND r.retry_count < 20
      AND (r.claimed_at IS NULL OR r.claimed_at < now() - make_interval(secs => greatest(p_claim_ttl, 1)))
      AND (r.retry_at IS NULL OR r.retry_at <= now())
      AND nullif(p_locked_by, '') IS NOT NULL
    ORDER BY r.remind_at, r.id
    LIMIT greatest(0, least(coalesce(p_limit, 25), 100))
    FOR UPDATE OF r SKIP LOCKED
  ), claimed AS (
    UPDATE public.reminders r SET claimed_at = clock_timestamp(), locked_by = p_locked_by, retry_at = NULL
    FROM candidates c WHERE r.id = c.id RETURNING r.*
  )
  SELECT r.id, r.user_id, r.remind_at, r.type::text, r.created_at, r.task_id,
    t.title::text, t.priority::text
  FROM claimed r JOIN public.tasks t ON t.id = r.task_id AND t.user_id = r.user_id
  ORDER BY r.remind_at, r.id;
$$;
REVOKE ALL ON FUNCTION public.claim_due_reminders(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_reminders(text, int, int) TO service_role;

-- Fence a reclaimed lease before calling an external provider.
CREATE FUNCTION public.renew_reminder_claim(p_id uuid, p_locked_by text)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
  WITH renewed AS (
    UPDATE public.reminders SET claimed_at = clock_timestamp()
    WHERE id = p_id AND locked_by = p_locked_by AND NOT is_sent AND sent_at IS NULL
    RETURNING id
  ) SELECT EXISTS(SELECT 1 FROM renewed);
$$;
REVOKE ALL ON FUNCTION public.renew_reminder_claim(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_reminder_claim(uuid, text) TO service_role;

-- Registration and reassignment serialize on the existing UNIQUE(token) key.
-- Never expose another owner's row to a stale caller.
CREATE FUNCTION public.register_push_token_atomic(p_user_id uuid, p_token text, p_platform text, p_client_timestamp timestamptz DEFAULT NULL)
RETURNS SETOF public.push_tokens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR caller IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF nullif(p_token, '') IS NULL OR length(p_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid token' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  INSERT INTO public.push_tokens AS existing(user_id, token, platform, active, updated_at)
    VALUES(caller, p_token, p_platform, true, clock_timestamp())
  ON CONFLICT (token) DO UPDATE SET user_id = caller, platform = EXCLUDED.platform,
    active = true, updated_at = clock_timestamp()
  WHERE p_client_timestamp IS NULL OR p_client_timestamp >= existing.updated_at
  RETURNING existing.*;
END;
$$;
REVOKE ALL ON FUNCTION public.register_push_token_atomic(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token_atomic(uuid, text, text, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.create_academic_task_atomic(uuid, varchar, varchar, text, jsonb, jsonb),
  public.record_review_atomic(uuid, uuid, integer, real, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_academic_task_atomic(uuid, varchar, varchar, text, jsonb, jsonb),
  public.record_review_atomic(uuid, uuid, integer, real, integer, uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.import_calendar_events(p_user_id uuid, p_integration_id uuid, p_events jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE connection public.calendar_integrations; item jsonb; affected integer;
  imported integer := 0; cancelled integer := 0;
BEGIN
  SELECT * INTO connection FROM public.calendar_integrations
    WHERE id = p_integration_id AND user_id = p_user_id AND provider = 'google'
    AND sync_enabled = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calendar disconnected; reconnect before syncing'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    IF item->>'status' = 'cancelled' THEN
      UPDATE public.events SET deleted_at = now() WHERE user_id = p_user_id
        AND calendar_id = connection.calendar_id AND (external_id = item->>'external_id' OR recurring_event_id = item->>'external_id') AND source = 'google';
      GET DIAGNOSTICS affected = ROW_COUNT;
      cancelled := cancelled + affected;
    ELSE
      INSERT INTO public.events(user_id, calendar_id, external_id, source, title, description,
        start_date, end_date, all_day, location, time_zone, start_day, end_day, recurring_event_id, deleted_at)
      VALUES(p_user_id, connection.calendar_id, item->>'external_id', 'google', item->>'title', item->>'description',
        (item->>'start_date')::timestamptz, (item->>'end_date')::timestamptz, (item->>'all_day')::boolean,
        item->>'location', item->>'time_zone', (item->>'start_day')::date, (item->>'end_day')::date, item->>'recurring_event_id', NULL)
      ON CONFLICT (user_id, calendar_id, external_id) DO UPDATE SET
        title = EXCLUDED.title, description = EXCLUDED.description, start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date, all_day = EXCLUDED.all_day, location = EXCLUDED.location,
        recurring_event_id = EXCLUDED.recurring_event_id, time_zone = EXCLUDED.time_zone, start_day = EXCLUDED.start_day, end_day = EXCLUDED.end_day, deleted_at = NULL
        WHERE events.source = 'google';
      GET DIAGNOSTICS affected = ROW_COUNT;
      imported := imported + affected;
    END IF;
  END LOOP;
  UPDATE public.calendar_integrations SET last_synced_at = now() WHERE id = connection.id;
  RETURN jsonb_build_object('imported', imported, 'cancelled', cancelled);
END;
$$;

-- One aggregate replaces the truncated row download plus separate exact count.
CREATE FUNCTION public.get_review_stats(p_user_id uuid)
RETURNS TABLE(total_tasks bigint, due_today bigint, total_reviews bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT count(*), count(*) FILTER (WHERE at.next_review_at <= now()),
    coalesce(sum(at.total_reviews), 0)::bigint
  FROM public.academic_tasks at
  WHERE at.user_id = p_user_id AND at.user_id = auth.uid() AND at.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_review_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_review_stats(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
