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

### I-001 · Ronda 2 — UX mobile (`agent/antigravity-mobile-ux` → `agent/integration`)

- **Commits:** `09bd684` (fix) → merge `052db3b`
- **Autores reales:** Antigravity (3 de 5 tareas, cortado por 429) + Cursor (2 restantes)
- **G1 typecheck backend:** no aplica (sin cambios de backend)
- **G2 tests backend:** no aplica
- **G3 typecheck app:** ✔ limpio
- **G4 diff:** 7 archivos, todos en `app/src`
- **G5:** revisión de OpenCode contra el alcance de la misión, línea por línea

Defectos cerrados: B-02, B-03 (×3 pantallas), B-06, B-07, B-20.

### I-002 · Ronda 2 — backend (`agent/fcc-implementation` → `agent/integration`)

- **Commits:** `0e2edab` (fix) → merge `539a3dc`
- **Autor real:** FCC Claude; **correcciones de OpenCode antes de integrar**
- **G1 typecheck backend:** ✔ limpio
- **G2 tests backend:** ✔ 21/21 (16 previos + 5 nuevos del limiter)
- **G3 typecheck app:** ✔ limpio (sin cambios de app)
- **G4 diff:** 8 archivos, todos en `backend/src`
- **G5:** revisión de OpenCode

Correcciones aplicadas sobre la entrega de FCC:

1. **Duplicación eliminada.** FCC copió `authMiddleware` completo (con su import de `supabase`)
   dentro de `rate-limit.middleware.ts`. Se dejó solo el limiter y se importa `AuthenticatedRequest`
   del middleware real.
2. **`as any` eliminado.** La clave pasó a `userKey(req)`, tipada con `AuthenticatedRequest`.
3. **`max(15000)` en la entrada era una regresión.** El schema habría devuelto `400` a contenido
   de más de 15 000 caracteres que hoy funciona. Se subió el tope de payload a 200 000 y el
   truncado real a 15 000 quedó donde corresponde: en el servicio, antes de llamar al modelo.
4. **Tests añadidos** para el limiter y su `keyGenerator` (5 casos).

Defectos cerrados: B-04, B-11, B-12.

### Estado tras la ronda 2

`G1` ✔ · `G2` ✔ 21/21 · `G3` ✔ · `G4` ✔ 15 archivos, todos en `app/src` o `backend/src`.
Sin conflictos entre ambas ramas: tocaron árboles disjuntos.
