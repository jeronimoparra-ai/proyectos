-- ============================================================
-- ACADEMIC TASKS: Add total_reviews column (separate from SM-2 streak)
-- ============================================================
ALTER TABLE academic_tasks
ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN academic_tasks.total_reviews IS 'Total historical review count (never resets), distinct from review_count which tracks SM-2 consecutive repetitions';

-- ============================================================
-- REVIEWS: Add idempotency_key for duplicate detection
-- ============================================================
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_idempotency_key
ON reviews(idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN reviews.idempotency_key IS 'Client-generated key for idempotent review submission. Duplicate submissions with same key return existing review without double-counting.';

-- ============================================================
-- RPC: Atomic academic task creation with materials and topics
-- ============================================================
CREATE OR REPLACE FUNCTION create_academic_task_atomic(
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
SET search_path = public
AS $$
DECLARE
    v_task_id UUID;
    v_material JSONB;
    v_topic JSONB;
BEGIN
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
CREATE OR REPLACE FUNCTION record_review_atomic(
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
    interval INTEGER,
    repetitions INTEGER,
    next_review_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    is_duplicate BOOLEAN,
    sm2_repetitions INTEGER,
    total_reviews INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Lock the academic task row to prevent concurrent modifications
    SELECT at.review_count, at.total_reviews
    INTO v_last_review
    FROM academic_tasks at
    WHERE at.id = p_academic_task_id
    AND at.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Academic task not found'
        USING ERRCODE = 'P0001';
    END IF;

    -- Get the last review for SM-2 calculation (only for streak, not total)
    SELECT ease_factor, interval, repetitions
    INTO v_ease_factor, v_interval, v_repetitions
    FROM reviews
    WHERE academic_task_id = p_academic_task_id
    ORDER BY created_at DESC
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
    INSERT INTO reviews (
        academic_task_id,
        user_id,
        quality,
        difficulty,
        time_spent_seconds,
        ease_factor,
        interval,
        repetitions,
        next_review_at,
        idempotency_key
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
        p_idempotency_key
    ) RETURNING id, created_at INTO v_existing_review;

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