# T-001K · Kilo (respaldo de FCC) · Auditoría técnica del backend

**Estado:** ENTREGADA · **VERIFICADA** (12/12 con evidencia reproducible)
**Ejecutor:** Kilo Code CLI (FCC agotó 900 s) · `nvidia/nemotron-3-ultra-550b-a55b:free`
**Artefacto real:** `AUDITORIA_TECNICA_BACKEND.md` en el worktree `agent/kilo-fallback` (8.7 KB)
**Nota:** el despachador lo marcó fallo por exit ≠ 0 pese a existir el artefacto (INC-004).

## Veredictos

| # | Hallazgo | Sev. | Veredicto | Prueba |
|---|---|---|---|---|
| 1 | OAuth CSRF: `state` = `userId` sin validar | critica | ✔ CONFIRMADO | `state: userId`; callback solo lee `code` |
| 2 | Sin rate limit por usuario en AI y web-search | critica | ✔ CONFIRMADO | `app.ts:28-34` limiter global por IP |
| 3 | `userId?` opcional + `userId!` en controladores | alta | ✔ CONFIRMADO | `auth.middleware.ts:6` + `task.controller.ts:12,25,35` |
| 4 | Parsing JSON de IA silencioso | alta | ✔ CONFIRMADO | `ai.service.ts:95-101` devuelve `{summary, [], []}` sin log |
| 5 | `syncFromGoogle` no atómico | alta | ✔ CONFIRMADO | bucle SELECT+UPDATE/INSERT en `event.service.ts:108-164` |
| 6 | Tags: delete + insert no atómico | media | ✔ CONFIRMADO | `task.service.ts:105-122` |
| 7 | Query params sin validación Zod | media | ✔ CONFIRMADO | `helpers.ts:7-8` `return query as T` |
| 8 | `reminder-checker`: envía y luego marca; sin reintentos | media | ✔ CONFIRMADO | `reminder-checker.ts:26-48`, catch solo loguea |
| 9 | Tokens Google sin cifrar | media | ✔ CONFIRMADO | `google-calendar.service.ts:97,136-137` |
| 10 | `logout` con `auth.admin.signOut` | media | ✔ CONFIRMADO | `auth.service.ts:56-58` |
| 11 | `processWithAI` sin límite de contenido | media | ✔ CONFIRMADO | sin truncado en `academic-task.service.ts:123-168` |
| 12 | API key de Brave en cabecera | baja | ✔ CONFIRMADO | `web-search.service.ts:49-53`; riesgo bajo real |

**Precisión: 12/12.** Kilo rindió mejor en esta misión (más concreta y acotada al backend) que en T-002K.

## Convergencia entre agentes independientes

| Hallazgo | T-001K (Kilo) | T-002K (Kilo) | Antigravity |
|---|---|---|---|
| OAuth CSRF (`state`) | ✔ critica | ✔ critica | — |
| Rate limit por usuario | ✔ critica | ✔ media | — |
| Tokens Google en claro | ✔ media | ✔ alta | — |
| Sync no atómico | ✔ alta | ✔ media | — |
| Spinners sin salida | — | — | ✔ critica |

La coincidencia de **ambos auditores backend** en OAuth CSRF y rate limiting otorga alta confianza:
no es un artefacto del modelo, es un defecto del código.
