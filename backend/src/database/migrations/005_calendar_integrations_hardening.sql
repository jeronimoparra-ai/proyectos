BEGIN;
-- Credentials and OAuth challenges are backend-only, even for their owner.
DROP POLICY IF EXISTS "Users can manage own calendar integrations" ON public.calendar_integrations;
REVOKE ALL ON public.calendar_integrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.calendar_integrations TO service_role;
-- Keep the most recent legacy connection and discard duplicate credentials.
DELETE FROM public.calendar_integrations a USING public.calendar_integrations b
WHERE a.user_id = b.user_id AND a.provider = b.provider
  AND (a.updated_at, a.id) < (b.updated_at, b.id);
ALTER TABLE public.calendar_integrations ADD CONSTRAINT calendar_integrations_owner_provider_key UNIQUE(user_id, provider);
UPDATE public.calendar_integrations SET calendar_id = 'primary' WHERE calendar_id IS NULL;
ALTER TABLE public.calendar_integrations ALTER COLUMN calendar_id SET NOT NULL;

CREATE TABLE public.calendar_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.calendar_oauth_states TO service_role;
CREATE INDEX calendar_oauth_states_owner_idx ON public.calendar_oauth_states(user_id);

ALTER TABLE public.events ADD COLUMN calendar_id text;
ALTER TABLE public.events ADD COLUMN time_zone text;
ALTER TABLE public.events ADD COLUMN recurring_event_id text;
-- Date-only values preserve floating calendar days; end is always exclusive.
ALTER TABLE public.events ADD COLUMN start_day date;
ALTER TABLE public.events ADD COLUMN end_day date;
UPDATE public.events SET calendar_id = 'primary' WHERE source = 'google';
DELETE FROM public.events a USING public.events b
WHERE a.source = 'google' AND b.source = 'google'
  AND a.user_id = b.user_id AND a.calendar_id = b.calendar_id AND a.external_id = b.external_id
  AND (a.updated_at, a.id) < (b.updated_at, b.id);
ALTER TABLE public.events ADD CONSTRAINT events_external_identity_key UNIQUE(user_id, calendar_id, external_id);

-- One transaction per snapshot; lock the connection so disconnect cannot race writes.
CREATE FUNCTION public.import_calendar_events(p_user_id uuid, p_integration_id uuid, p_events jsonb)
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
        recurring_event_id = EXCLUDED.recurring_event_id, time_zone = EXCLUDED.time_zone, start_day = EXCLUDED.start_day, end_day = EXCLUDED.end_day, deleted_at = NULL;
      imported := imported + 1;
    END IF;
  END LOOP;
  UPDATE public.calendar_integrations SET last_synced_at = now() WHERE id = connection.id;
  RETURN jsonb_build_object('imported', imported, 'cancelled', cancelled);
END;
$$;
REVOKE ALL ON FUNCTION public.import_calendar_events(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_calendar_events(uuid, uuid, jsonb) TO service_role;
-- Serialize final OAuth save and disconnect per owner; an exchange already in
-- flight cannot restore credentials after the owner disconnects.
CREATE FUNCTION public.complete_calendar_connection(p_user_id uuid, p_state_hash text, p_redirect_uri text, p_tokens jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 5));
  DELETE FROM public.calendar_oauth_states WHERE user_id = p_user_id AND state_hash = p_state_hash
    AND redirect_uri = p_redirect_uri AND consumed_at IS NOT NULL AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'OAuth flow expired or disconnected; start again'; END IF;
  INSERT INTO public.calendar_integrations(user_id, provider, access_token, refresh_token, token_expires_at, calendar_id, sync_enabled)
  VALUES(p_user_id, 'google', p_tokens->>'access_token', p_tokens->>'refresh_token',
    (p_tokens->>'token_expires_at')::timestamptz, 'primary', true)
  ON CONFLICT (user_id, provider) DO UPDATE SET
    id = uuid_generate_v4(), access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
    token_expires_at = EXCLUDED.token_expires_at, calendar_id = EXCLUDED.calendar_id,
    sync_enabled = true, last_synced_at = NULL;
END;
$$;
CREATE FUNCTION public.disconnect_calendar(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 5));
  DELETE FROM public.calendar_oauth_states WHERE user_id = p_user_id;
  DELETE FROM public.calendar_integrations WHERE user_id = p_user_id AND provider = 'google';
END;
$$;
REVOKE ALL ON FUNCTION public.complete_calendar_connection(uuid, text, text, jsonb), public.disconnect_calendar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_calendar_connection(uuid, text, text, jsonb), public.disconnect_calendar(uuid) TO service_role;
COMMIT;
