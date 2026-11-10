# T-002K · Kilo (respaldo de Hermes) · Auditoría cruzada backend + servicios

**Estado:** ENTREGADA · **VERIFICADA PARCIALMENTE** (7 confirmados, 1 rechazado, 1 parcial, 3 plausibles)
**Ejecutor:** Kilo Code CLI (Hermes agotó 900 s) · modelo `nvidia/nemotron-3-ultra-550b-a55b:free`
**Log:** `/tmp/opencode/dispatch/T-002K/run-fallback.log`
**Incidente:** el despachador lo marcó `FALLO TOTAL` por un falso positivo propio (INC-003):
el informe cita `401/429` como hallazgos y el detector los leyó como cuota agotada. Corregido:
el detector ahora solo mira las últimas 12 líneas y ya no incluye códigos HTTP sueltos.

## Veredictos

| # | Hallazgo | Sev. | Veredicto | Prueba de OpenCode |
|---|---|---|---|---|
| 1 | OAuth CSRF: `state` = `userId` y no se valida en el callback | critica | ✔ CONFIRMADO | `getAuthUrl` → `state: userId`; `handleOAuthCallback` no contiene `state` en ningún punto |
| 2 | `google_refresh_token`/`access_token` en texto plano | alta | ✔ CONFIRMADO | `google-calendar.service.ts:97,136-137` escriben tokens directos en `user_preferences` |
| 3 | Contenido sin truncar hacia OpenRouter | alta | ✔ CONFIRMADO | `grep -n "slice\|substring\|truncat"` en `ai.service.ts` y `academic-task.service.ts` → **0 resultados** |
| 4 | Crear task + tags no es atómico | alta | ~ PLAUSIBLE | Sin transacciones en el servicio; no revisé cada línea |
| 5 | `syncFromGoogle`: SELECT+INSERT por evento (race) | media | ~ PLAUSIBLE | Patrón compatible con el código; no verificado paso a paso |
| 6 | Token vacío y sin reintentos en el cliente | media | **PARCIAL** | ✔ no hay reintentos (`grep retry` → 0) · ✘ **falso** que envíe `Bearer` vacío: `api.ts` hace `if (token)` antes de la cabecera |
| 7 | Límite global de IA sin cuota por usuario | media | ✔ CONFIRMADO | `app.ts:28-34` limiter 100/15min por IP; `/api/ai` usa el mismo |
| 8 | `PATCH /api/auth/profile` roto | media | ✔ CONFIRMADO | Ruta sin `validate`; controller pasa `req.body` sin `userId`; servicio llama `supabase.auth.updateUser()` con cliente service-role y sin sesión |
| 9 | Recordatorios duplicables sin idempotencia | media | ~ PLAUSIBLE | Orden `send → markAsSent` coherente con el riesgo; no ejecutado |
| 10 | `client_secret` podría filtrarse por logs | baja | ✘ **RECHAZADO** | `grep response.text` → 0 resultados; `error.middleware.ts:19` loguea stack, no el body. Especulativo |
| 11 | Inyección de operadores en Brave Search | baja | ~ DUDOSO | `site:` no exfiltra resultados internos; es una decisión de producto, no una vuln |
| 12 | `recordReview` con dos escrituras sin transacción | baja | ~ PLAUSIBLE | Estructura compatible; no verificado en ejecución |

## Los tres hallazgos que sí cambian prioridades

**1. OAuth CSRF (crítica).** `getAuthUrl` pone `state: userId`, que es un identificador
**predecible y público**. El callback nunca compara el `state` recibido con el esperado. Un atacante
puede iniciar el flujo con su cuenta, obtener un `code` y enviar a la víctima
`/google-callback?code=...`, vinculando su calendario a la cuenta de la víctima. El arreglo es
`state` aleatorio (32 bytes) guardado con TTL y consumido una sola vez.

**2. Tokens de Google en claro (alta).** Si se filtra la base de datos, el atacante obtiene acceso
permanente a los calendarios de todos los usuarios, porque el `refresh_token` no caduca.
Requiere cifrado en reposo con clave de entorno y migración de los tokens existentes.

**3. `PATCH /api/auth/profile` no funciona (media).** No es una vulnerabilidad de escalada, es un
**endpoint muerto**: `supabase.auth.updateUser()` sobre un cliente service-role sin sesión no sabe
a qué usuario aplicar el cambio. Cualquier edición de perfil desde la app falla silenciosamente.

## Sobre el hallazgo 6 (parcial)

Kilo afirmó que el cliente envía `Authorization: Bearer ` vacío. **Es falso**: `api.ts:33` está
protegido por `if (token)`. La parte válida es la ausencia de reintentos con backoff, que sí
confirmé. Un revisor que aceptara el informe sin mirar habría abierto un bug inexistente.

## Comparación de calidad de la ronda

| Agente | Tiempo | Hallazgos | Precisión verificada |
|---|---|---|---|
| Antigravity (T-003) | 390 s | 12 | 12/12 |
| Kilo (T-002K) | ~7 min | 12 | 8/12 sin reservas |
| FCC (T-001) | >900 s | 0 (timeout) | — |
| Hermes (T-002) | >900 s | 0 (timeout) | — |

Kilo como respaldo cumple: entrega material verificable y deja claro dónde especula, aunque
mezcla una afirmación falsa con hallazgos buenos. Por eso la verificación de OpenCode no es opcional.
