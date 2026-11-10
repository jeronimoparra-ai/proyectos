# DISPATCH_LOG — Registro de despachos a agentes externos

Cada entrada debe permitir reconstruir **qué se ordenó, con qué comando, con qué resultado**.
Regla: una respuesta textual no cierra una tarea; se cierra con artefactos verificados.

## Línea base del repositorio (antes de cualquier cambio de agente)

- Commit base: `45840e5` · rama de trabajo: `jeronimoparra-ai/abalone`
- `backend`: `npm install` → 279 paquetes
- `app`: `npm install --legacy-peer-deps` → 515 paquetes

| Gate | Comando | Resultado base |
|---|---|---|
| typecheck backend | `npm run typecheck` | ✔ sin salida (limpio) |
| tests backend | `npm run test` | ✔ 2 archivos, 16 tests, 195 ms |
| lint backend | `npm run lint` | ✖ 121 problemas (119 errores, 2 warnings) |
| typecheck app | `npx tsc --noEmit` | ✔ sin salida (limpio) |

Conclusión de línea base: los gates utilizables hoy son **typecheck + test**. El lint no es un gate
válido todavía (arrastra 119 errores preexistentes de `@typescript-eslint/no-unsafe-return`);
usarlo como criterio de aprobación ahora produciría falsos negativos.

---

## D-001 · T-001 · FCC Claude · 2026-11-10

- **Modo:** solo lectura · `--bare --permission-mode plan --allowedTools Read Bash Grep Glob`
- **Directorio:** `abalone-wt/fcc-implementation` (rama `agent/fcc-implementation`)
- **Instrucción:** `/tmp/opencode/missions/T-001-fcc-backend-audit.md` + contexto de baseline
- **Salida:** `/tmp/opencode/reports/T-001-fcc.txt`
- **Comando:**
```bash
fcc-claude -p "$(cat T-001-fcc-backend-audit.md) ..." --bare \
  --permission-mode plan --allowedTools Read Bash Grep Glob --output-format text
```
- **Estado:** EN_CURSO

## D-002 · T-002 · Hermes Agent · 2026-11-10

- **Modo:** solo lectura · `chat --query-file -Q --in <repo>`
- **Directorio:** repositorio compartido `.../proyectos/abalone` (Hermes no escribe)
- **Instrucción:** `/tmp/opencode/missions/T-002-hermes-cross-audit.md`
- **Salida:** `/tmp/opencode/reports/T-002-hermes.txt`
- **Aislamiento:** informe de FCC no compartido → auditoría sin sesgo de anclaje
- **Estado:** EN_CURSO

## D-003 · T-003 · Antigravity · 2026-11-10

- **Modo:** solo lectura · `--mode plan --output-format json`
- **Directorio:** `abalone-wt/antigravity-mobile-ux` (rama `agent/antigravity-mobile-ux`)
- **Instrucción:** `/tmp/opencode/missions/T-003-agy-ux-audit.md`
- **Salida:** `/tmp/opencode/reports/T-003-agy.json`
- **Estado:** EN_CURSO

## Cierre de D-001 y D-002 · 2026-11-10

| Despacho | Agente | Resultado | Evidencia |
|---|---|---|---|
| D-001 | FCC Claude | **TIMEOUT** (900 s) | `EXIT=124`, `T-001-fcc.txt` = 0 líneas |
| D-002 | Hermes Agent | **TIMEOUT** (900 s) | `EXIT=124`, `T-002-hermes.txt` = 2 líneas (solo `session_id`) |

Ninguno entregó auditoría. **No se registran como completados ni se inventan resultados.**
Se activa el protocolo de respaldo con Kilo.

## D-005 · T-001-KILO · Kilo Code CLI (respaldo) · 2026-11-10

- **Motivo de sustitución:** FCC agotó 900 s sin producir salida
- **Modelo:** `kilo/nvidia/nemotron-3-ultra-550b-a55b:free` (gratuito, sin auth)
- **Worktree:** `abalone-wt/kilo-fallback` (rama `agent/kilo-fallback`)
- **Mecanismo:** `scripts/dispatch.sh` con `DISPATCH_FORCE_FALLBACK=1`
- **Estado:** EN_CURSO

## D-006 · T-002-KILO · Kilo Code CLI (respaldo) · 2026-11-10

- **Motivo de sustitución:** Hermes agotó 900 s sin producir salida
- **Modelo:** `kilo/nvidia/nemotron-3-ultra-550b-a55b:free`
- **Worktree:** `abalone-wt/kilo-fallback`
- **Estado:** EN_CURSO

## Incidente INC-001 · bug propio del despachador (detectado y corregido)

**Síntoma:** el primer test de respaldo reportó `estado=fallback` y exit 0, pero el archivo no
apareció en el worktree. El archivo se había escrito en el directorio actual del orquestador —
el repo del usuario (`respaldo.txt` en la raíz).

**Causa:** `dispatch.sh` no hacía `cd` al worktree antes de invocar al agente, y el respaldo leía
`$MISSION_FILE` en lugar de su propio `mission-fallback.md`.

**Corrección:** cada invocación se ejecuta en un subshell con `cd "$WORKDIR"`; `mision()` recibe
el archivo de misión como parámetro; se añadió `DISPATCH_EXPECT_CHANGES=1` → exit 4 si el worktree
queda idéntico.

**Lección transversal:** el mismo patrón (texto de éxito sin artefacto) ya se había visto en FCC.
Por eso el despachador mide **cambios reales en git**, no lo que el agente dice. El artefacto
extraño se eliminó del repo del usuario y se verificó que el árbol quedara limpio.

## D-004 · K-001 · Kiro CLI · 2026-11-10 (carril de bajo consumo)

- **Modelo:** `qwen3-coder-next` (0.05× crédito) · `--trust-tools=fs_read`
- **Directorio:** repo compartido (solo lectura)
- **Tarea:** inventario de endpoints HTTP del backend (`METODO RUTA -> archivo:linea`)
- **Salida:** `/tmp/opencode/reports/K-001-endpoints.txt` · 62 líneas · exit 0
- **Verificación de OpenCode:** `grep -c` de `router.(get|post|patch|put|delete)` en `*.routes.ts`
  → 61; Kiro reportó 62 = 61 + `GET /health` en `app.ts`. **Coincidencia exacta.**
- **Hallazgo colateral del contraste:** los 10 módulos de rutas registran
  `router.use(authMiddleware)` en la cabecera del router. Cualquier informe que afirme
  "endpoint sin autenticación" debe explicar por qué el middleware de router no aplica.
- **Estado:** ENTREGADA · **VERIFICADA**

---

## Contraste de calidad conocido

| Fuente | Dato | Verificado por OpenCode |
|---|---|---|
| Kiro K-001 | 62 endpoints | ✔ `grep` 61 + `/health` |
| — | 10 routers con `router.use(authMiddleware)` | ✔ `grep` en los 10 módulos |

---

## Incidente INC-002 · config de Kilo rechazaba comandos en headless

**Síntoma:** el primer intento de respaldo (T-001-KILO / T-002-KILO) terminó con
`run ended with an auto-rejected permission`. Ambos agentes habían leído decenas de archivos
y murieron al pedir `grep`/`find`.

**Causa:** la config aislada combinaba una lista blanca de comandos con `"*": "ask"`.
En headless, `ask` **no pregunta: rechaza**, y la regla comodín tenía precedencia sobre las
entradas específicas.

**Corrección verificada empíricamente:**
- `"*": "allow"` como base + **denies explícitos** para lo destructivo.
- Comprobado: `grep -n` se ejecuta; `rm -f` es rechazado y el archivo sobrevive. Kilo lo reporta
  como `"pattern":"rm *","action":"deny"`.
- Denegados: `rm`, `rmdir`, `sudo`, `su`, `chmod`, `chown`, `dd`, `mkfs`, `shutdown`, `reboot`,
  `kill*`, `git push`, `git reset`, `git clean`, `git checkout`, `npm publish`, `curl`, `wget`,
  `systemctl`. `webfetch` en `deny`.

**Lección:** un agente que falla a mitad de misión por permisos no debe confundirse con un agente
sin cuota. El despachador ahora distingue `auto-rejected permission` (configuración) de los
patrones de cuota.

## Ajuste de política tras la ronda 1

| Observación | Decisión |
|---|---|
| FCC y Hermes superaron 900 s en una auditoría de todo el backend | Las auditorías amplias van a **Antigravity** (390 s comprobados) o **Kilo**; FCC/Hermes reciben misiones **estrechas** (1-3 archivos o un módulo) |
| El preflight detecta disponibilidad, no lentitud | `TIMEOUT_MISION` es configurable; las misiones amplias usan 1500 s |
| Un fallo por permisos parecía un fallo de cuota | Detección separada de `auto-rejected permission` |

## Modo autónomo acotado (aplicado 2026-11-10)

Ver `AUTONOMY.md`. Resumen: `dontAsk` + lista negra en FCC, `--yolo --checkpoints` en Hermes,
`accept-edits` en Antigravity, `--trust-tools` en Kiro, `allow` + `deny` en Kilo.
**No se usa `--dangerously-skip-permissions` en ningún agente.** Evidencia de pruebas incluida allí.

## Incidente INC-003 · falso positivo del detector de cuota

**Síntoma:** T-002K entregó 12 hallazgos y el despachador lo marcó `FALLO TOTAL`.

**Causa:** el detector grepeaba todo el informe buscando `401`, `403`, `429`, `quota`. El informe
citaba esos códigos como hallazgos legítimos.

**Corrección:** se eliminan los códigos HTTP sueltos del patrón y el escaneo se limita a las
últimas 12 líneas del log con frases inequívocas (`rate limit`, `quota exceeded`, `not authenticated`,
`auto-rejected permission`).

**Lección:** una heurística de fallo debe evaluar el **final** del proceso, no el contenido del
trabajo. Rechazar un buen informe cuesta una re-ejecución completa.

## Incidente INC-004 · Kilo con exit ≠ 0 y artefactos válidos

**Síntoma:** T-001K produjo `AUDITORIA_TECNICA_BACKEND.md` (8.7 KB, 12 hallazgos) en el worktree,
pero el script lo marcó como fallo por código de salida distinto de cero.

**Corrección:** si el ejecutor devuelve exit ≠ 0 **pero el worktree contiene cambios nuevos**,
se acepta la entrega como `AVISO` y no se relanza el respaldo. Manda el artefacto, no el código.
Queda registrado en `meta.log` para revisión.

## Incidente INC-005 · Hermes escapaba del worktree

**Síntoma:** con `--in <worktree>`, Hermes escribió el entregable en `/home/andresdev/autonomia.txt`.

**Causa:** Hermes restaura el directorio de la sesión anterior al arrancar.

**Corrección:** `--no-restore-cwd` en toda invocación. Verificado: el archivo aparece en el worktree,
nada en `$HOME`, y el despachador detecta 1 cambio real.

**Lección de contención:** `--in` no basta; hay que impedir la restauración de sesión. Es la
diferencia entre "el agente trabaja en su carpeta" y "el agente cree que está en su carpeta".

