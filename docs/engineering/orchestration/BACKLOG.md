# BACKLOG — Ronda 1 consolidada (2026-11-10)

Fuentes verificadas: T-001K (Kilo backend, 12/12), T-002K (Kilo cruzada, 8/12 sin reservas),
T-003 (Antigravity UX, 12/12). Total verificado: **32 hallazgos**; 1 rechazado, 3 plausibles.

## P0 — Crítico

| ID | Hallazgo | Origen | Archivos | Asignado |
|---|---|---|---|---|
| B-01 | OAuth CSRF: `state` predecible y no validado | T-001K/T-002K | `google-calendar.service.ts`, `google-calendar.controller.ts` | FCC |
| B-02 | Spinner perpetuo al agotar repasos (app atrapada) | T-003 | `ReviewDetailScreen.tsx` | Antigravity |
| B-03 | Spinner perpetuo ante error de carga en 3 detalles | T-003 | `TaskDetail`, `EventDetail`, `AcademicTaskDetail` | Antigravity |
| B-04 | Sin cuota por usuario en `/api/ai` y `/api/search` | T-001K/T-002K | `ai.routes.ts`, `web-search.routes.ts`, `app.ts` | FCC |

## P1 — Alto

| ID | Hallazgo | Origen | Archivos | Asignado |
|---|---|---|---|---|
| B-05 | Pérdida de datos al retroceder en 3 formularios | T-003 | `*FormScreen.tsx` | Antigravity |
| B-06 | Error de red se muestra como "sin tareas" | T-003 | `TasksScreen`, `AcademicScreen` | Antigravity |
| B-07 | Home sin carga, esqueleto ni refresco | T-003 | `HomeScreen.tsx` | Antigravity |
| B-08 | Teclado tapa controles en Login/Recuperar | T-003 | `LoginScreen`, `ForgotPasswordScreen` | Antigravity |
| B-09 | `PATCH /api/auth/profile` no funciona (sin `userId`) | T-001K/T-002K | `auth.controller.ts`, `auth.service.ts`, `auth.routes.ts` | FCC |
| B-10 | Tokens Google en texto plano | T-001K/T-002K | `google-calendar.service.ts` | FCC (fase 2) |
| B-11 | Contenido sin truncar hacia OpenRouter (coste) | T-001K/T-002K | `ai.service.ts`, `academic-task.service.ts`, schemas | FCC |
| B-12 | Parsing JSON de IA silencioso | T-001K | `ai.service.ts` | FCC |
| B-13 | `userId?` + `userId!` en 10+ controladores | T-001K | `auth.middleware.ts`, controladores | FCC |
| B-14 | `syncFromGoogle` no atómico | T-001K/T-002K | `event.service.ts` | FCC (fase 2) |

## P2 — Medio

| ID | Hallazgo | Origen | Asignado |
|---|---|---|---|
| B-15 | Tags delete+insert con carrera | T-001K/T-002K | FCC (fase 2) |
| B-16 | Query params sin validación Zod | T-001K | FCC (fase 2) |
| B-17 | Recordatorios sin reintento/idempotencia | T-001K/T-002K | FCC (fase 2) |
| B-18 | `logout` con admin client | T-001K | FCC (fase 2) |
| B-19 | Checkbox 22×22 sin `hitSlop` ni rol | T-003 | Antigravity |
| B-20 | Día actual invisible (`borderColor` sin `borderWidth`) | T-003 | Antigravity |
| B-21 | Flechas de calendario sin etiqueta accesible | T-003 | Antigravity |
| B-22 | Botón eliminar material ~24×24 sin etiqueta | T-003 | Antigravity |

## P3 — Bajo

| ID | Hallazgo | Origen | Asignado |
|---|---|---|---|
| B-23 | `ErrorBoundary` con colores fijos y español | T-003 | Antigravity |
| B-24 | Contraste 2.15:1 en insignia "medium" | T-003 | Antigravity |
| B-25 | API key Brave en cabecera | T-001K | descartado (riesgo real bajo) |
| B-26 | "Inyección" de operadores Brave | T-002K | rechazado (dudoso) |

## Nota de alcanzabilidad (verificada en código)

| Hallazgo | ¿Alcanzable desde la app? | Evidencia |
|---|---|---|
| B-01 OAuth CSRF | **No hoy** | `grep -rn "google" app/src` no muestra ninguna llamada a `google/auth-url`; no existe pantalla de conexión |
| B-09 `PATCH /api/auth/profile` | **No hoy** | `SettingsScreen` no llama a `updateProfile`; el endpoint no tiene consumidor |
| B-02/B-03 spinners | **Sí** | `RootNavigator` navega a esos detalles; el fallo ocurre en uso normal |
| B-04 cuota IA | **Sí** | `/api/ai/*` se consume desde las pantallas académicas |
| B-11/B-12 IA | **Sí** | `generateSummary`, `processWithAI` se invocan desde la app |

Consecuencia: B-01 y B-09 bajan de P0/P1 a **deuda latente** (se arreglan porque son baratos),
y la prioridad real de la ronda 2 son los bloqueos de UX y los límites de coste.

## Ronda 2 — alcance autorizado

- **FCC** (`agent/fcc-implementation`): B-04 cuota por usuario, B-11 truncado, B-12 parseo explícito.
- **Antigravity** (`agent/antigravity-mobile-ux`): B-02, B-03 (x3), B-06, B-07, B-20.
- **Kiro**: verificación mecánica de `borderColor` sin `borderWidth`.
- **Fase 2** (tras integrar): B-01, B-09, B-10, B-14, B-15, B-16, B-17, B-18, B-23, B-24.

