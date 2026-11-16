# Informe T2 · Sesión, Privacidad y Push Notifications

**Tarea:** OBJETIVO T2 · Sesión, privacidad y push · Agente móvil/API  
**Task ID:** `task_8bc9090067fe` · **Dispatch ID:** `ctx_242a81bc558d`  
**Base commit:** `2567999cab4ef5b63d869780d45f3014ee0a7b8f`  
**Estado:** COMPLETADA · Pruebas y Typechecks Verificados (100% OK)

---

## 1. Resumen Ejecutivo

Se implementó la remediación integral del ciclo de vida de sesiones, push notifications y privacidad en el monorepo (`app/` Expo + Zustand y `backend/` Express + TS):
1. **Desvinculación idempotente y reasignación atómica de push tokens:** El cliente desvincula su push token en el servidor antes de invalidar la sesión mientras hay red; si está offline, persiste la operación en una cola local protegida (`SecureStore`) para reintentar al reconectar. El servidor realiza la reasignación atómica mediante `upsert` con `onConflict: 'token'` (resolviendo el conflicto contra la clave global única `token` en `push_tokens`, en lugar de `user_id,token` que causaba violaciones de unicidad 500). Se protege contra respuestas tardías de sesiones anteriores verificando marcas temporales para no reactivar tokens ya reasignados.
2. **Aislamiento total entre usuarios en el dispositivo:** Al cerrar sesión se cancelan de inmediato todas las peticiones de red en curso (`apiClient.abortAll()`) y se reinician exhaustivamente todos los stores de Zustand (`useTaskStore`, `useEventStore`, `useAcademicTaskStore`, `useReviewStore`, `useAuthStore`) con `clearAllUserStores()`, impidiendo que el usuario B vea datos o estado del usuario A.
3. **Protección de privacidad en notificaciones y contrato con T5:** Se sanitizan los payloads de push eliminando datos sensibles y adjuntando `recipientUserId`. Si el destinatario no está garantizado, se utiliza contenido genérico sin título sensible. En el cliente, `Notifications.setNotificationHandler` suprime la notificación si el destinatario no coincide con el usuario activo. Se define el contrato de bajas de tokens con T5 (`DeviceNotRegistered` → desactivación inmediata).

---

## 2. Alcance e Implementación Técnica

### 2.1. Desvinculación Idempotente y Reasignación Atómica (Alcance 1)
- **Problema previo:** `002_push_tokens.sql` define `token TEXT NOT NULL UNIQUE`. El servicio intentaba un upsert con `{ onConflict: 'user_id,token' }`. Al iniciar sesión el usuario B en un dispositivo previamente usado por el usuario A, Postgres lanzaba un error 500 por violación de la restricción `push_tokens_token_key`. Además, el cierre de sesión en `SettingsScreen.tsx` invalidaba la sesión de Supabase sin desvincular el token.
- **Servidor (`notification.service.ts` & `notification.controller.ts`):**
  - Se modificó el `upsert` en `registerPushToken` para usar `{ onConflict: 'token' }`, logrando la reasignación atómica entre cuentas de forma segura.
  - Se implementó guardia contra **respuestas tardías de la sesión anterior**: si el token ya pertenece a otro usuario y la petición entrante incluye `clientTimestamp` anterior al `updated_at` del registro actual, la petición se descarta y no sobrescribe al nuevo dueño.
  - Se implementó `removePushToken` (`DELETE` con filtro estricto `.eq('user_id', userId).eq('token', token)`) y `deactivatePushToken` (`active = false`), permitiendo desvinculación idempotente compatible por body o query parameter (`?token=...`).
- **Cliente (`notification.ts` & `usePushNotifications.ts`):**
  - Método `unbindCurrentDevice()`: antes de invalidar la sesión, invoca `removePushToken`. Si falla por desconexión o timeout, almacena la baja en una cola local en `SecureStore`.
  - Método `flushPendingOperations()`: al reconectar o iniciar sesión, vacía la cola pendiente.
  - En `registerForPushNotifications`, se incluye `clientTimestamp` y se verifica si el usuario sigue activo al completar la obtención del token de Expo para no asociar tokens huérfanos.

### 2.2. Limpieza de Stores y Cancelación de Peticiones (Alcance 2)
- **Problema previo:** Al cerrar sesión únicamente se llamaba `useAuthStore.signOut()`. Los datos de tareas, eventos, revisiones espaciadas y tareas académicas del usuario A permanecían en memoria en los stores de Zustand, siendo visibles si el usuario B iniciaba sesión.
- **Solución implementada:**
  - Se añadió la acción `reset()` a `useTaskStore`, `useEventStore`, `useAcademicTaskStore` y `useReviewStore`, restaurando listas vacías, selecciones nulas, contadores en cero y filtros por defecto.
  - Se creó la función centralizada `clearAllUserStores()` en `app/src/store/index.ts`.
  - Se dotó a `apiClient` (`app/src/services/api.ts`) de seguimiento de `AbortController` activos y del método `apiClient.abortAll()`. Al salir, se abortan instantáneamente todas las peticiones en vuelo del usuario A, evitando que respuestas asíncronas tardías pueblen los stores de la nueva sesión.
  - En `useAuthListener.ts`, ante cualquier evento de cierre o pérdida de sesión (`SIGNED_OUT` o `session === null`), se invoca automáticamente `apiClient.abortAll()` y `clearAllUserStores()`.

### 2.3. Protección de Contenido y Privacidad (Alcance 3)
- **Problema previo:** Las notificaciones push enviadas podían contener títulos y datos específicos de tareas y cuentas, exponiendo información confidencial si el dispositivo había cambiado de usuario o estaba bloqueado.
- **Solución implementada:**
  - En el backend (`sendPushNotification` y `sendReminderNotification`):
    - Sanitización del payload `data`: se eliminan campos sensibles (`password`, `email`, `token`, `accessToken`) y se inyecta siempre `recipientUserId: userId`.
    - Modo `guaranteedRecipient: false`: si no se puede garantizar que el destinatario sea el dueño actual del dispositivo, se envía sin título (`title: ''`) y con cuerpo genérico (`"Tienes una nueva notificación"` o `"Tienes un recordatorio pendiente"`).
  - En el cliente (`usePushNotifications.ts`):
    - `Notifications.setNotificationHandler` inspecciona `notification.request.content.data?.recipientUserId`. Si el usuario en el dispositivo no está autenticado o su `id` difiere de `recipientUserId`, se silencian y bloquean la alerta, el sonido, el badge y el banner (`shouldShowAlert: false`), garantizando privacidad absoluta ante avisos residuales en tránsito.
    - Se añade la misma validación en el listener de interacción (`addNotificationResponseReceivedListener`).

---

## 3. Contrato de Notificaciones con T5 (Alcance 4)

### 3.1. Especificación del Contrato Propuesto

```typescript
// Payload unificado hacia el servicio de push / Expo
interface PushNotificationEnvelope {
  to: string; // Expo push token
  title?: string; // Título visible; vacío si !guaranteedRecipient
  body: string; // Mensaje visible; genérico si !guaranteedRecipient
  data: {
    notificationId: string;
    recipientUserId: string; // Verificación obligatoria en cliente
    type: 'reminder' | 'task' | 'general';
    [key: string]: unknown; // Sin datos confidenciales de cuenta
  };
  sound: 'default';
  badge?: number;
  channelId: 'default';
}
```

### 3.2. Gestión de Bajas e Invalidez de Tokens
- **Respuesta de Tickets de Expo:**
  - Cuando Expo responde con `status: 'error'` y detalle `DeviceNotRegistered` o `InvalidCredentials`: el token ha sido revocado o la app desinstalada.
  - **Acción:** El backend actualiza inmediatamente el token a `active = false` (o lo elimina) en la tabla `push_tokens`, cesando cualquier intento posterior de envío.
- **Reintentos:**
  - Errores transitorios (`MessageRateExceeded` o fallos 5xx de red de Expo): reintento con backoff exponencial máximo 3 intentos.
  - Errores definitivos (`DeviceNotRegistered`, `MessageTooBig`): sin reintento; baja inmediata del token.

### 3.3. Garantía frente a Notificaciones ya aceptadas por el Proveedor
- **Principio:** Una vez que una notificación ha sido entregada a APNs (Apple) o FCM (Google), no es posible revocarla remotamente a nivel de red desde el cliente.
- **Mecanismos de Corrección y Garantía:**
  1. **Contenido mínimo/genérico en tránsito:** Las notificaciones no llevan información sensible de cuenta en su contenido push.
  2. **Gatekeeper en cliente (`setNotificationHandler`):** Cuando la notificación llega al hardware del teléfono, el runtime de la app evalúa `recipientUserId`. Si el usuario actual ya cerró sesión o inició sesión con otra cuenta, el manejador retorna `shouldShowAlert: false` y suprime su presentación en pantalla.
  3. **Idempotencia y recibos en backend:** El backend mantiene el estado en base de datos (`notifications` leídas o resueltas) para que la pantalla de notificaciones autenticada solo muestre lo que corresponde a la sesión válida.

---

## 4. Matriz de Pruebas y Verificación

### 4.1. Pruebas Unitarias Ejecutadas (`vitest`)

Se implementaron dos suites de pruebas unitarias específicas en el backend:
- `backend/src/__tests__/notification.test.ts` (12 pruebas):
  - Upsert atómico con `onConflict: 'token'` para reasignación entre cuentas.
  - Rechazo de peticiones tardías de sesiones previas con `clientTimestamp` obsoleto.
  - Manejo de dos registros concurrentes sin violaciones de unicidad.
  - Desvinculación idempotente por `user_id` y `token`.
  - Desactivación de tokens (`active = false`).
  - Sanitización de payload, eliminación de credenciales y adición de `recipientUserId`.
  - Fallback a contenido genérico sin título cuando el destinatario no está garantizado.
  - Desactivación automática al recibir error `DeviceNotRegistered` de Expo.
  - Soporte en controlador para token en body y query params, con validación 400 si falta.
- `backend/src/__tests__/mobile-push-session.test.ts` (3 pruebas de integración):
  - **Mismo dispositivo:** Usuario A sale y Usuario B entra; el token se reasigna sin conflicto; avisos nuevos de A no van a B; otro dispositivo de A (ej. tablet) sigue funcionando intacto.
  - **Cierre offline:** Usuario A cierra sesión offline; Usuario B entra y reclama el token; cuando la cola offline de A se sincroniza posteriormente, no afecta ni desvincula el token de B.
  - **Respuesta tardía:** Petición lenta de la sesión A que llega tras el registro de B es ignorada, preservando la titularidad de B.

**Resultado total de la suite de pruebas del backend:**
- `Test Files: 5 passed (5)`
- `Tests: 36 passed (36)`
- `Duration: 511ms`

### 4.2. Comprobación de Tipos (`typecheck`)
- `app`: `tsc --noEmit` completado exitosamente sin errores (`exit code 0`).
- `backend`: `tsc --noEmit` completado exitosamente sin errores (`exit code 0`).

---

## 5. Archivos Modificados

```
app/src/hooks/useAuthListener.ts
app/src/hooks/usePushNotifications.ts
app/src/screens/SettingsScreen.tsx
app/src/services/api.ts
app/src/services/notification.ts
app/src/store/index.ts
app/src/store/useAcademicTaskStore.ts
app/src/store/useEventStore.ts
app/src/store/useReviewStore.ts
app/src/store/useTaskStore.ts
backend/src/__tests__/mobile-push-session.test.ts
backend/src/__tests__/notification.test.ts
backend/src/modules/notifications/notification.controller.ts
backend/src/modules/notifications/notification.schema.ts
backend/src/modules/notifications/notification.service.ts
docs/engineering/orchestration/AGENT_REPORTS/T2-SESION-PRIVACIDAD-PUSH.md
```
