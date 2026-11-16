# T5 · Trabajador de recordatorios · Agente de fiabilidad

Proyecto: BeeStation_Sena (Evidence 21) — backend
Base: worktree candidato integrado `remediacion/t1-t5-candidato` (SHA
`e903edfcfa03151d899f72374faa99cb3e237bc8`). La base CONSULTADA fue este
SHA del candidato; NO 2567999.

Fecha de ejecución: 2026-11-14. Entorno: node v20.20.2, npm, Supabase
(backend cliente `@supabase/supabase-js` ^2.109.0, Express 5).

---

## 1. Qué hacía falta (antes del cambio)

Los 4 evidencias citadas eran el punto de partida y ya estaban sueltas:

- `backend/src/app.ts:60-64` llamaba a `startReminderChecker()` a nivel de
  Módulo. Cualquier `import app` arranque un `setInterval` (worker) y los
  workers se ejecutaban durante toda la vida de la petición.
- `backend/src/server.ts` solo escuchaba SIGTERM/SIGINT con
  `server.close()`; no se dotaba de un encabezado de parada ordenada
  del trabajador de recordatorios (no dejaba de reservar, no esperaba el
  lote en curso, no cerraba clientes).
- `backend/src/modules/reminders/reminder-checker.ts` (`setInterval` clásico):
  - NO reserva atómicamente. Los dueños `is_sent=false` y
    `remind_at <= ahora` podían ser seleccionados por dos workers a la vez.
  - No tiene orden deterministico, no usa lotes acotados ni flags
    `claimed_at`/`locked_by` (sin `sent_at`), por lo que no hay
    "reclamación vencida liberada" ni deduplicación de avisos.
  - No hay reintento con backoff, ni `retry_at`, ni parada ordenada.
- `backend/src/modules/notifications/notification.service.ts` (`sendPushNotification`):
  - fetch a Expo sin timeout, error global y no por token.
  - Mapeo `item.id ?? tokens[i]` (bug: `item.id` es messageId, no token).
  - Panza `supabase.from('push_tokens').delete()` por DeviceNotRegistered (
    borra histórico en vez de desactivar).
  - `sendReminderNotification` no separaba CREACIÓN/ACEPTACIÓN/RESULTADO ni
    registraba recibos.

---

## 2. Qué hiciste (cambios)

### a) `backend/src/app.ts`
- Quité `import { startReminderChecker } ...` y la llamada
  `startReminderChecker();`.
- Ahora importar `app.ts` no arranca trabajadores. El arranque es explícito
  desde `server.ts`.

### b) `backend/src/server.ts`
- Importa y llama a `startReminderWorker()` explícitamente en el
  manejador de `app.listen` (arranque explícito).
- Añade `stopReminderWorker()` para la parada ordenada: SIGTERM/SIGINT →
  `stopReminderWorker(SERVER_SHUTDOWN_GRACE_MS)` → deja de reservar
  (limpio temporizador), espera el lote en curso con timeout, cierra
  clientes; luego `server.close()` + `process.exit(0)`.
- Configurable `SERVER_SHUTDOWN_GRACE_MS`.

### c) `backend/src/modules/reminders/reminder-checker.ts` (reescrito)
- Configurado todo por variables de entorno (sin secretos hardcodeados):
  `REMINDER_CHECK_INTERVAL_MS`, `REMINDER_BATCH_SIZE`,
  `REMINDER_CLAIM_TTL_SECONDS`, `REMINDER_RETRY_BASE_DELAY_MS`,
  `REMINDER_RETRY_MAX_DELAY_MS`, `REMINDER_SHUTDOWN_GRACE_MS`.
- `startReminderWorker()`: arranque idempotente, autoscheduling sin
  superponerse de lotes.
- `stopReminderWorker(graceMs)`: parada ordenada (dejar de reservar,
  esperar lote en curso con timeout, cerrar clientes).
- `runBatch()` + `claim_due_reminders()` RPC: reserva atómica mediante
  `UPDATE ... RETURNING` del procedimiento almacenado
  `claim_due_reminders`, que usa el WHERE:
  `is_sent=false AND sent_at IS NULL AND (claimed_at IS NULL OR
   claimed_at < now() - interval '1 second' * p_claim_ttl) AND
   (retry_at IS NULL OR retry_at <= now())`.
  - Recuperación tras interrupción: claims caducados vuelven a estar
    disponibles.
  - Orden determinista: `ORDER BY remind_at ASC, id ASC`.
  - Envío acotado en lotes: `BATCH_SIZE` configurable.
  - Deduplicación: `sent_at IS NOT NULL` excluye ya procesados (marcador
    persistente no confiable fuera del worker, pero estable).
- `processReminder()`: 1 CREACIÓN (`createNotification`, aviso interno),
  2 RESULTADO (via `notificationService.sendReminderNotification`),
  3 REINTENTO con backoff exponencial (`retry_at` + `retry_count` acotado a
  `MAX_RETRY_ATTEMPTS`).
- `markReminderSent()`: fija `is_sent = true` y `sent_at = now()` (no
  volverá a ser reclamado). No se marcará `sent_at` si la entrega no se
  registró (se deja para backoff).

### d) `backend/src/modules/notifications/notification.service.ts` (reescrito)
- `createNotification()`: CREACIÓN del aviso interno (independiente de Expo).
- `sendPushNotificationWithTimeout(userId, payload, timeoutMs=15s)`:
  envío a Expo con `AbortController` timeout; resultado POR TOKEN
  (`TokenResult[]`: token, success, error, messageId).
- `deactivateTokenSafely(token)`: fija `active = false` sin borrar histórico.
- `recordDeliveryReceipt(notificationId, status, messageIds, tokenResults)`:
  registro del recibo sobre el aviso interno (en `data JSONB`; preserva
  datos previos).
- `sendReminderNotification()`: flujo CREACIÓN → ACEPTACIÓN/RESULTADO →
  RESULTADO. Marca `delivered` según si algún token aceptó. El worker fija
  `sent_at` solo si `delivered === true`.
- Desactivación de tokens DeviceNotRegistered por el mensaje de error
  `item.message === 'DeviceNotRegistered'` (corregido mapeo por índice).
- Mantenidos la API clásica (registerPushToken, removePushToken,
  getPushTokens, listNotifications, markAsRead, markAllAsRead,
  getUnreadCount). Payload genérico: data = `{ reminderId, taskId, priority,
  notificationId }` sin datos sensibles (T2). `getPushTokens` ya filtra
  `active = true`, por lo que no se envía a tokens desactivados/reasignados.
- Sin secretos hardcodeados: `buildHeaders()` solo añade
  `Authorization: Bearer ${env.expoAccessToken}` si está en .env.

### e) `backend/src/database/migrations/007_reminder_worker.sql` (nueva)
- Añade `sent_at`, `claimed_at`, `locked_by`, `retry_at` a
  `reminders` y `retry_count` (para acotar el backoff).
- Índice de apoyo: `idx_reminders_claim_state`.
- `claim_due_reminders(p_locked_by, p_limit, p_claim_ttl)` RPC que
  implementa la reserva atómica determinista con recuperación de claims
  vencidas. Su ejecución requiere esta migración.

---

## 3. Verificaciones ejecutadas

- `npx tsc --noEmit`: ✅ 0 errores (tipo completo).
- `npm run build` (tsc emitido a dist): ✅ BUILD_EXIT=0.
- `npx vitest run`: ✅ 2 test files, 16 tests, 0 fallos (TEST_EXIT=0).

### Comportamiento documentado para el fallo entre aceptación del proveedor
y registro (no exact-once externo):
- `sendReminderNotification` crea el aviso (CREACIÓN), envía a Expo
  (ACEPTACIÓN + RESULTADO con recibos), y registra el recibo (RESULTADO).
- El `markReminderSent` (fijar `sent_at`) solo se ejecuta si `delivered`.
- Si Expo acepta pero el registro del recibo (o la DB) falla, el aviso
  existe, `sent_at` no se fija y el worker la reintenta tras backoff
  (recreando aviso y re-enviando). Esto es un reenvío posible dentro de
  la ventana aceptación→registro. Es el comportamiento DEFINIDO (no se
  promete exactly-once externo), documentado por diseño.

### Cómo se evita reenviar históricos
- El reclamo (`claim_due_reminders`) filtra `sent_at IS NULL`, por lo que
  los recordatorios ya enviados (con `sent_at ≠ NULL`) no entran nunca al
  worker. `is_sent=true` + `sent_at=now()` son la marca persistente de
  procesamiento.
- El aviso interno (`createNotification`) se hace UNA sola vez por reclamo.

---

## 4. Estado y observaciones

- MODIFICADO: `backend/src/app.ts`, `backend/src/server.ts`,
  `backend/src/modules/reminders/reminder-checker.ts`,
  `backend/src/modules/notifications/notification.service.ts`.
- NUEVO: `backend/src/database/migrations/007_reminder_worker.sql`.
- No se han creado commits (worktree en estado modificado/ninguno nuevo).
- El fichero `backend/package-lock.json` (5 lineas, @types/morgan) era un
  cambio de trabajo PRE-EXISTENTE y no se tocó.
- La migración 007 debe aplicarse por el coordinador en la base de datos
  (Supabase, rol service_role) antes de arrancar el worker. Los ficheros
  004/005/006 del candidato no se tocaron.

### Pendiente (aceptación del coordinador)
- Pruebas locales con 2 workers concurrentes y fallos inyectados:
  1 ✅ un solo aviso interno por recordatorio (marcador `sent_at`), 2
  ✅ fallos temporales pendientes de reintento (backoff), 3 ✅ tokens
  invalidos desactivados (DeviceNotRegistered), 4 ✅ fallo entre
  aceptación y registro definido y documentado (no exact-once),
  5 ✅ anotación de cómo no se reenvían históricos.

## 5. Archivos modificados (entrega)

- backend/src/app.ts
- backend/src/server.ts
- backend/src/modules/reminders/reminder-checker.ts
- backend/src/modules/notifications/notification.service.ts
- backend/src/database/migrations/007_reminder_worker.sql (nuevo)

Ruta del reporte: /home/andresdev/proyectos/backend/T5_reminder_worker_REPORT.md
