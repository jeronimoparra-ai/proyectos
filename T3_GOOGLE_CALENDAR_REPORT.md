# T3 · Google Calendar Integration - Evidence 21 (Remediación)

**Dispatch:** ctx_05e4435a7451
**Base commit:** 2567999cab4ef5b63d869780d45f3014ee0a7b8f
**Branch:** jeronimoparra-ai/remediacion-t3-google-calendar

## What was done

Implemented Google Calendar integration for the productivity app (Express+TS backend + Supabase + React Native app).

### Backend (Express+TS)
- **Migration 005** (`backend/src/database/migrations/005_calendar_integrations_hardening.sql`):
  - Credentials moved to `calendar_integrations` table (no longer stored in `user_preferences`).
  - RLS: `calendar_integrations` and `calendar_oauth_states` are now `service_role`-only
    (GRANT on the tables + functions; anon/authenticated PUBLIC revoked).
  - OAuth state table `calendar_oauth_states` with single-use challenge handling.
  - `UNIQUE(user_id, provider)` constraint on calendar_integrations; events get
    `calendar_id`, `time_zone`, `recurring_event_id`, `start_day`, `end_day` columns.
  - `events_external_identity_key` (UNIQUE(user_id, calendar_id, external_id)).
  - PL/pgSQL RPCs: `import_calendar_events` (upsert ON CONFLICT, cancellation handling),
    `complete_calendar_connection`, `disconnect_calendar`.
- **Service** (`google-calendar.service.ts`):
  - `getAuthUrl` → random opaque `state` (43-char base64url), 5-min expiry, hashed on DB.
  - `handleOAuthCallback` → validates code/state/redirect, exact redirect match,
    single-use atomic challenge consumption, refresh token rotation, action error `GOOGLE_RECONNECT_REQUIRED`.
  - `syncEvents` → paginated import (singleEvents + showDeleted), timezone preservation,
    all-day (floating) events, exclusive end handling, idempotency via upsert.
  - `disconnect` → removes integration but preserves imported events.
  - `isConnected` check.
- **Controller** (`google-calendar.controller.ts`): endpoints `/auth-url`, `/callback`,
  `/sync`, `/disconnect`, `/status` with auth middleware.
- **EventService** (`event.service.ts`): `syncFromGoogle` deprecated → now delegates to
  `GoogleCalendarService.syncEvents`.

### App (Expo React Native)
- **Backend config**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  added to `env.ts` and `.env.example`.
- **Calendar display**: `event-days.ts` + `CalendarGrid.tsx`, `WeekView.tsx`,
  `CalendarScreen.tsx`, `EventDetailScreen.tsx` updated to use `eventOccursOnDay`
  (exclusive end, floating all-day handling).
- **Google section**: `GoogleCalendarSection.tsx` (created, untracked) + mounted in
  `SettingsScreen.tsx` (connect/status/sync/disconnect, callback handling with state check).

## Tests executed (backend)
- `npx tsc --noEmit` → exit 0
- `npx vitest run` → **4 test files, 32 tests, all passed**

Covers: minimum scope / opaque state / exact redirect; single-use & expired state
rejection; refresh-token rotation & reconnect; disconnect-during-exchange atomicity;
invalid/expired/consumed state rejection; double-sync without duplicates; cancellation
(expired events + parent series cancellation); exclusive end days & timezone; owner/calendar
identity; DB grants for anon/authenticated/service_role; paginated sync endpoints;
disconnect preserves local events.

## Commands and results

1. `cd backend && npx tsc --noEmit` → exit 0
2. `cd backend && npx vitest run` → `Test Files 4 passed (4), Tests 32 passed (32)`
3. `cd app && npx tsc --noEmit` → exit 0

## Verification of acceptance criteria

- ✅ Connection → `GET /api/google/auth-url` returns OAuth URL with minimum scope,
  random 43-char state, exact redirect.
- ✅ State → callback rejects invalid/expired/consumed state (400 `GOOGLE_INVALID_STATE`).
- ✅ Paginated import → `/api/google/sync` (paginated, idempotent upsert).
- ✅ Disconnection → `/api/google/disconnect` preserves imported events.
- ✅ Double sync does not duplicate events (UNIQUE + upsert in DB).
- ✅ Cancellations covered (deleted events removed, recurring parent cancellation).
- ✅ Last day exclusive (end_day + eventOccursOnDay).
- ⚠️ Real Google OAuth not exercised — only mocked Google APIs (`googleapis` mock).
  **Label: PENDIENTE** for the real Google connection.

## Files modified
- app/src/components/calendar/CalendarGrid.tsx
- app/src/components/calendar/WeekView.tsx
- app/src/screens/CalendarScreen.tsx
- app/src/screens/EventDetailScreen.tsx
- app/src/screens/SettingsScreen.tsx
- backend/.env.example
- backend/package-lock.json
- backend/package.json
- backend/src/config/env.ts
- backend/src/modules/events/event.service.ts
- backend/src/modules/google/google-calendar.controller.ts
- backend/src/modules/google/google-calendar.service.ts
- app/src/components/calendar/GoogleCalendarSection.tsx (new)
- app/src/components/calendar/event-days.ts (new)
- backend/src/database/migrations/005_calendar_integrations_hardening.sql (new)
- backend/src/modules/google/google-calendar.service.test.ts (new)
- backend/tests/support/calendar-db.ts (new)

## Report
This file + summary sent via `worker_done`.
