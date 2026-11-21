# P4 — Backend, PostgreSQL y seguridad

Worktree P4, base solicitada `9782221`. Sin commits, push, PR, deploy ni acceso a Supabase de producción. Datos exclusivamente sintéticos; PostgreSQL 16 Alpine desechable con Podman, ligado a loopback en puerto 55434. No se modificó `app/` ni documentación de otros frentes.

## Hallazgos confirmados y cambios

| Área | Evidencia inicial | Resultado |
|---|---|---|
| Reminder claims (007) | Faltaban `remind_at <= now()` y `FOR UPDATE SKIP LOCKED`; un UPDATE único no impedía que dos snapshots seleccionaran la misma fila | Claim de vencidos, task vigente y menos de 20 intentos; lotes disjuntos con bloqueo real; TTL/cooldown conservados; JOIN al task en lugar de dos subconsultas escalares |
| Worker | Resultado `delivered:false` sin excepción no programaba backoff; el retry no liberaba el claim; writes sin comprobar propietario del claim | Backoff también ante rechazo del proveedor, libera claim, límite efectivo de 20, renovación antes de I/O y fencing por `locked_by` al finalizar/reintentar; timer y contador de lotes corregidos |
| Avisos | Cada retry creaba otro aviso; el ticket Expo se guardaba como `delivered`; tokens completos quedaban en JSON visible al usuario; envío de reminder evitaba la función de privacidad | PK del aviso = UUID del reminder para deduplicar sin índice adicional; reutiliza aceptación ya persistida; estado `accepted`, payload genérico con `recipientUserId`, resultados persistidos sin token; timeout cubre lectura del body y se limpia en finally |
| Académico (006) | Check idempotente anterior al lock; RPC SECURITY DEFINER ejecutable por PUBLIC y uid nulo tratado como servicio; referencias SQL ambiguas con columnas OUT | Lock antes del check, identidad requerida salvo rol explícito service_role, revocación anon/PUBLIC, search_path con pg_temp al final, aliases SQL, timestamp al insertar tras serialización; no reviews de tareas borradas |
| Historial SM-2 | 006 inicializaba total_reviews a cero sin recuperar reviews históricos; reinicialización podía borrar contador | Backfill no decreciente desde COUNT(reviews), streak separado; initialize solo aplica a tareas sin programación ni historial |
| Push tokens | SELECT + UPSERT permitían TOCTOU y el SELECT RLS no podía ver al propietario anterior; mocks asumían reasignación posible | RPC SECURITY DEFINER autenticada, un INSERT ON CONFLICT condicional sobre UNIQUE(token), rechazo de solicitudes antiguas en la escritura, sin devolver la cuenta ajena; logout/unbind sigue scoped por usuario+token |
| Google | State de un solo uso, expiración, paginación, detección de página repetida y serialización disconnect ya existían en 005/servicio | Se conservan. Se corrige ON CONFLICT del importador para no sobrescribir un evento local con identidad externa coincidente, y se cuenta solo lo realmente importado |
| Estadísticas | Descarga de filas limitada por PostgREST + segundo COUNT exacto: estadísticas parciales y dos snapshots | Una RPC aggregate invoker con RLS devuelve los mismos totalTasks/dueToday/totalReviews, sin descargar tareas ni depender del límite de filas |
| Paginación | Orden no único en listas de tareas/eventos/académico | Añadido id como desempate; se conservan campos, offset/page/limit y total público |
| Harness SQL | Concedía ALL después de las migraciones, ocultando errores de permisos | Retirada la concesión posterior; las pruebas ejercitan los ACL reales de las migraciones |

Las listas con `count:exact` conservan ese count porque el contrato devuelve `total`. Las proyecciones anchas existentes también son parte de respuestas públicas; no se eliminan campos sin evidencia de que sea compatible. Los embeds PostgREST existentes no son un bucle HTTP N+1. La mejora concreta elimina las dos subconsultas por reminder y las dos consultas de estadísticas.

## Migración

Nueva `backend/src/database/migrations/013_backend_atomicity.sql`: 001–010 presentes en el worktree; 011/012 reservadas por los paquetes externos mencionados en la tarea. No se reutilizan esos números. Conserva firmas de RPC existentes; añade `register_push_token_atomic`, `renew_reminder_claim`, `get_review_stats`, un índice parcial y backfill no decreciente. No hay DROP/TRUNCATE/DELETE de datos ni DDL destructivo en esta migración.

La migración debe estar disponible antes del backend que llama las nuevas RPC. Su aplicación en producción queda fuera de esta tarea. El CREATE INDEX normal dentro de la transacción toma bloqueo de escritura durante su construcción: revisar ventana de aplicación según volumen real. No se ejecutó en producción.

## Índice respaldado por EXPLAIN

[Planes completos y buffers](p4-query-plans.md), generados por `TEST_DB_PORT=55434 node scripts/p4-query-plans.mjs` desde backend.

Dataset: 20.000 tasks, 200.000 reminders con 50% enviados y muchos vencimientos empatados, 20.000 academic_tasks de un tenant pesado. Se ejecutó EXPLAIN (ANALYZE, BUFFERS) antes de crear el índice candidato y después, sobre el mismo dataset en una transacción que hace rollback.

- Único índice nuevo: `idx_reminders_pending_due ON reminders(remind_at,id) WHERE NOT is_sent AND sent_at IS NULL AND retry_count < 20`.
- Selección claim antes: **43,473 ms**, **60.351 buffers shared hit**, 20.001 búsquedas al task antes del LIMIT por el sort de empates.
- Después: **0,426 ms**, **125 shared hit + 3 read**, 25 búsquedas al task. La mejora local no constituye un SLA de producción.
- Página tasks con índices existentes: **0,598 ms**; no se añade índice.
- Estadísticas antes: descarga de 1.000 filas **0,318 ms** + count **3,340 ms**, 324 buffers, resultado incompleto si hay más filas. Después: agregado completo **3,063 ms**, 308 buffers, una fila/una llamada. El principal beneficio es corrección y menor transferencia, sin índice nuevo.

El script solo acepta host loopback y DB `productivity_test`; su DROP INDEX temporal es exclusivamente para reproducir la comparación en esa DB desechable y se revierte con rollback, nunca forma parte de una migración de producto.

## Verificación

Baseline ejecutado antes de editar: `npm run typecheck` exit 0; `npm test`: **9 archivos, 70 tests passed**; `npm run lint`: exit 1, **15 errores + 5 warnings**.

**Resultado final: typecheck exit 0; 75/75 unitarias y 39/39 integración; lint exit 1 con 14 errores + 5 warnings (baseline 15 + 5, sin incremento); git diff --check exit 0.**

Comandos finales y salidas reales se conservan debajo y en [p4-verification.txt](p4-verification.txt). La suite SQL incluye migración limpia de 11 archivos, incremental 001 con datos históricos → 013, concurrencia con dos conexiones reales, RLS/ACL, recuperación de claims vencidos, SKIP LOCKED, reasignación y logout tardío, estadísticas de 1.501 tareas y preservación de evento local. La prueba concurrente de reviews observa `pg_stat_activity.wait_event_type = Lock` antes de liberar el primer commit.

Se añadió un gate P4 al job existente de fixtures SQL en `.github/workflows/ci.yml`, usando su servicio PostgreSQL y credenciales sintéticas. No se amplió el baseline de lint.

## Límites y pendientes fuera del alcance autorizado

- Un ticket Expo es aceptación, no entrega final al dispositivo. Se conserva el booleano legacy `delivered` para compatibilidad interna, documentado como aceptación, y el estado persistido ahora es `accepted`. No se implementa un poller de receipts finales.
- Sigue existiendo la ventana inevitable de crash entre aceptación externa y persistencia local; no se promete exactly-once del proveedor. Los avisos internos nuevos sí se deduplican por PK y una aceptación persistida evita reenvío. Avisos legacy con UUID aleatorio no se fusionan ni se borran.
- `clientTimestamp` sigue siendo opcional por compatibilidad; sin timestamp, el último registro autenticado que posee el token puede reasignarlo. No es una prueba criptográfica de sesión. La limpieza al logout sigue usando el endpoint de desvinculación del dispositivo; no se desactivan otros dispositivos del usuario.
- Se conservaron las protecciones OAuth existentes. El pase de cancelaciones de Google todavía recorre páginas fuera de la ventana temporal para no perder cancelaciones; pasar a syncTokens requeriría cambiar el protocolo. No se ejecutó OAuth ni push real ni PostgREST remoto. La suite SQL preexistente incluye un placeholder informativo de OAuth en dispositivo; no se cuenta como prueba de un intercambio externo real.
- Lint mantiene deuda preexistente y su comando sigue devolviendo exit 1; lo verificado es que no aumentó, no que sea cero.
- Solo quedan revisión/integración por el coordinador y eventual aplicación autorizada de la migración. No se hicieron commits ni push.

## Archivos modificados

- `.github/workflows/ci.yml`
- `backend/reports/P4-REPORT.md`
- `backend/reports/p4-query-plans.md`
- `backend/scripts/p4-query-plans.mjs`
- `backend/src/__tests__/academic-task-atomic.test.ts`
- `backend/src/__tests__/mobile-push-session.test.ts`
- `backend/src/__tests__/notification.test.ts`
- `backend/src/__tests__/reminder-worker.test.ts`
- `backend/src/database/migrations/013_backend_atomicity.sql`
- `backend/src/modules/academic/academic-task.service.ts`
- `backend/src/modules/events/event.service.ts`
- `backend/src/modules/notifications/notification.service.ts`
- `backend/src/modules/reminders/reminder-checker.ts`
- `backend/src/modules/reviews/review.service.ts`
- `backend/src/modules/tasks/task.service.ts`
- `tests/integration/helpers/bootstrap.ts`
- `tests/integration/scenarios/api-db-integration.test.ts`
- `tests/integration/scenarios/backend-atomicity.test.ts`
- `tests/integration/scenarios/migration-clean.test.ts`
- `tests/integration/scenarios/migration-update.test.ts`
- `backend/reports/p4-verification.txt`
