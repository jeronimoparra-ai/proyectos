# INTEGRATION_LOG — Integración y verificación

Regla: ningún cambio entra a `agent/integration` sin revisión de diff, gate ejecutado y evidencia.

## Topología de aislamiento

| Rama | Worktree | Uso |
|---|---|---|
| `jeronimoparra-ai/abalone` | repo principal | árbol del usuario — **no se toca** |
| `agent/integration` | `abalone-wt/integration` | destino de cambios aprobados |
| `agent/fcc-implementation` | `abalone-wt/fcc-implementation` | FCC Claude |
| `agent/antigravity-mobile-ux` | `abalone-wt/antigravity-mobile-ux` | Antigravity |
| — (solo lectura) | repo compartido | Hermes |

Commit base común: `45840e5`.

## Gates de aprobación

| Gate | Comando | Criterio |
|---|---|---|
| G1 typecheck backend | `npm run typecheck` | sin errores |
| G2 tests backend | `npm run test` | sin regresiones vs 16/16 |
| G3 typecheck app | `npx tsc --noEmit` | sin errores |
| G4 diff revisado | `git diff 45840e5...<rama>` | solo archivos autorizados |
| G5 auditoría cruzada | informe de agente distinto al autor | sin objeciones críticas abiertas |

`npm run lint` **no** es gate hasta sanear los 119 errores preexistentes.

## Registro de integraciones

_(sin integraciones todavía — Ronda 1 es solo auditoría de lectura)_
