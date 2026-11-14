# T1 · Seguridad de Postgres y clientes Supabase

Base: `2567999cab4ef5b63d869780d45f3014ee0a7b8f`. Sin commits, sin cambios en migraciones 001–003 ni otros módulos. Las credenciales del harness son exclusivamente sintéticas y locales.

## Resultado

- `004_reminder_ownership.sql`: transacción con bloqueo de escrituras durante preflight y creación de FK compuesta `(task_id,user_id) → tasks(id,user_id)`. Reemplaza la FK simple para mantener inequívoco el embedding `tasks(...)` de PostgREST. FK validada, no `NOT VALID`; rechaza inconsistencias incluso bajo `service_role`, y cambios del propietario de tareas referenciadas.
- Si existen inconsistencias, 004 aborta íntegramente mostrando su cantidad. No borra, mueve, cambia propietarios ni oculta datos. `t1-postgres-remediation.sql` aporta diagnóstico de filas y plantilla comentada para reasignar únicamente una tarea explícitamente revisada del mismo propietario. La prueba incremental conserva el registro y todos sus campos salvo el task_id reparado.
- RLS de reminders exige identidad y tarea propia visible tanto para lectura como para escritura. Revoca permisos de PUBLIC/anon en tasks/reminders y limita authenticated a SELECT/INSERT/UPDATE/DELETE; service_role conserva CRUD de reminders, sin TRUNCATE/TRIGGER. RLS sigue habilitado. La FK es la protección frente al bypass RLS de service_role.
- `supabase.ts`: fachada compatible con imports existentes, cliente aislado por petición mediante AsyncLocalStorage; fuera del contexto verificado crea cliente público efímero, jamás un fallback service_role. Auth no comparte sesión con otros usuarios ni con sistema. Middleware valida token con Auth antes de abrir contexto, sin `enterWith` global.
- Checker usa cliente interno separado, comprueba `task.user_id === reminder.user_id`, y marca entrega con id + user_id + task_id. El envío interno de notificaciones fuerza el destinatario esperado en lecturas/modificaciones y valida user_id de inserciones; permite únicamente notifications/push_tokens. Una petición no puede elevarse a este contexto interno. Los privilegios no bastan por sí solos para aprobar envío.
- Logout es una excepción Auth privilegiada acotada: revalida token y compara usuario con el contexto de la petición antes de admin.signOut. Profile usa el endpoint Auth `/user` con el JWT verificado del contexto; evita sesiones SDK compartidas y refresh tokens ficticios.

## Archivos compartidos / autorización

El coordinador autorizó expresamente ampliar a `reminder-checker.ts` para separación de clientes y alcance. `auth.middleware.ts` establece el contexto por petición. `auth.service.ts` es **archivo compartido para revisión T7**: únicamente import de helpers, logout verificado y updateProfile con JWT; ambas excepciones fueron autorizadas por respuestas a `orchestration ask`. No se modificó reminder.service.ts ni notification.service.ts.

## Validación local reproducible

Docker estaba instalado pero su daemon no estaba disponible; sudo exigía contraseña. Se utilizó Postgres real desechable mediante `embedded-postgres@18.6.0-beta.19`, PostgREST 12.2.3, Node 22.23.5 y pg 8.23.1. El harness inicia/apaga el cluster y PostgREST; utiliza puertos locales 55432–55435, que deben estar libres. No apunta a Supabase remoto ni usa claves reales.

Desde la raíz del worktree (Linux x64):

```sh
npm ci --prefix backend --ignore-scripts --no-audit --no-fund
mkdir -p /tmp/t1-postgres-tools
npm install --prefix /tmp/t1-postgres-tools embedded-postgres@18.6.0-beta.19 pg@8.23.1 node@22.23.5 --no-audit --no-fund
curl -fsSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz -o /tmp/t1-postgres-tools/postgrest.tar.xz
tar -xJf /tmp/t1-postgres-tools/postgrest.tar.xz -C /tmp/t1-postgres-tools
/tmp/t1-postgres-tools/node_modules/.bin/node docs/t1-local-validation.cjs
npm run typecheck --prefix backend
npm test --prefix backend
git diff --check
```

Resultados observados:

| Caso | Resultado |
| --- | --- |
| Instalación 001–004 desde cero | PASS |
| 001–003 con recordatorio histórico A→tarea B | 004 aborta P0001; FK original y fila conservadas |
| Reparación sintética revisada, después 004 | PASS; fila conservada, FK validada |
| Cuenta A ve tareas propias; recordatorio A→B | Rechazado por RLS 42501 |
| service_role inserta/actualiza relación cruzada o cambia propietario de tarea con recordatorio | Rechazado por FK 23503 |
| anon consulta recordatorios | Permiso denegado 42501 |
| API Express real + PostgREST: A y B crean/editan/borran recordatorios propios | PASS |
| API crea/edita recordatorio ajeno; borrar ajeno | 404; borrado sin efecto en fila ajena |
| 20 consultas API concurrentes alternando A/B, con resultados no vacíos | Solo filas propias |
| Embedding `tasks(...)` tras cambio de FK | PASS, sin ambigüedad ni datos de otra cuenta |
| Login en cliente efímero seguido por consulta sin contexto | Sin acceso privilegiado ni sesión heredada |
| Profile con JWT; logout propio; logout de B desde contexto A | Profile/propio pasan; ajeno rechazado antes de admin call |
| Scope interno A intentando insertar notificación B / leer notificaciones A desde B | Rechazo / ninguna fila ajena |
| Intento de elevar contexto de petición a checker/sistema | Rechazado |
| Checker con join inconsistente inyectado solo en transporte de prueba | No publica ni marca; guarda de identidad comprobada |
| Checker con relación real válida | Publica para propietario esperado y marca entrega |
| TypeScript | PASS |
| Suite existente | 3 archivos, 21 pruebas PASS |
| Diff whitespace | PASS |

`npm run lint` global no está verde: configuración excluye tests del proyecto TS y hay numerosos errores previos fuera de alcance. Supabase y middleware pasan ESLint dirigido; auth.service conserva cuatro advertencias de tipo unsafe convertidas en errores por la configuración y checker conserva el error previo de callback async en setInterval. No se amplió alcance para corregirlos. El SDK instalado falla en Node 20 sin WebSocket nativo: la integración se ejecutó en Node 22; no se cambió package.json.

## Despliegue y límites de evidencia

**Pendiente en Supabase real**: ejecutar informe de preflight y auditoría de permisos/políticas, revisar grants heredados/por columna y funciones SECURITY DEFINER o vistas existentes fuera del esquema versionado, y repetir pruebas con dos usuarios Auth reales. El harness usa roles PostgreSQL reales (incluido service_role BYPASSRLS), grants inicialmente amplios para comprobar su reducción, `auth.users`/`auth.uid()` mínimos y JWT sintéticos que PostgREST sí verifica. Los endpoints Auth están simulados localmente: esto no demuestra permisos efectivos, sesiones, revocación o configuraciones Auth de un despliegue remoto. No se enviaron push externos: el checker se probó sin tokens Expo registrados.

Configurar `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY` para acceso de usuario; conservar `SUPABASE_SERVICE_ROLE_KEY` solo en servidor. La ausencia de clave pública falla explícitamente; no sustituirla con service_role. Usar Node >=22 con el SDK instalado.

Orden de despliegue: detener API/checkers antiguos, respaldo y preflight, revisar/reparar filas si procede, aplicar 004 con rol propietario, configurar clave pública y desplegar backend, recargar/verificar caché PostgREST y reabrir tráfico tras pruebas. Si 004 aborta, **no reabrir procesos antiguos**: el esquema previo sigue permitiendo relaciones inválidas. La transacción necesita un bloqueo de escritura; planificar ventana acorde al tamaño de tablas. La propiedad de una tarea con recordatorios no puede cambiar sin resolver explícitamente esos recordatorios. Los demás servicios HTTP ahora se someten a sus políticas RLS ya existentes: integración T7 debe cubrir esos flujos, especialmente soft-delete/returning; no se ampliaron políticas de módulos ajenos.

El checker mantiene la semántica previa de entrega (sin outbox/claim transaccional); concurrencia de varios checkers o fallos después de enviar pueden duplicar notificaciones. La separación de identidad de esta tarea no convierte el envío externo en exactamente una vez.

Referencias consultadas: [Supabase, service_role y Authorization](https://supabase.com/kb/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z), [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html).
