# AGENT_REGISTRY — Registro de agentes externos

Actualizado: 2026-11-10 · Verificado empíricamente por OpenCode (Fase 0).

Orquestador único: **OpenCode v2.2.7** (Fedora 44, Linux x86_64).

## Matriz de capacidades

| Agente | Ejecutable | Versión | Rol | Lectura | Shell | Escritura | Headless |
|---|---|---|---|---|---|---|---|
| FCC Claude | `fcc-claude` (+ `fcc-server` en :8082) | 2.1.197 | Implementación / ingeniería | ✔ | ✔ | ✔ | `-p` |
| Hermes Agent | `hermes` | v0.22.5 | Auditoría / validación independiente | ✔ | ✔ | no probado | `chat --query-file` |
| Antigravity | `agy` | 1.5.4 | UX/UI mobile / implementación visual | ✔ | ✔ | ✔ | `-p` |
| Kiro CLI | `kiro-cli` | 2.36.0 | Tareas de **bajo consumo** (mecánicas, acotadas) | ✔ | ✔ | ✔ | `chat --no-interactive` |
| Kilo Code CLI | `kilo` | 7.8.18 | **Respaldo 1** si otro agente agota cuota | ✔ | ✔ | ✔ | `run` |
| Cursor Agent | `cursor-agent` | 2026.10.22 | **Respaldo 2** (último recurso) | ✔ | ✔ | ✔ | `-p` |

## Invocaciones canónicas

```bash
# FCC — implementación aislada (--bare evita hooks ECC con contexto obsoleto)
fcc-claude -p "<prompt>" --bare --permission-mode acceptEdits \
  --allowedTools Write Edit Read Bash --output-format text

# FCC — auditoría de solo lectura
fcc-claude -p "<prompt>" --bare --permission-mode plan \
  --allowedTools Read Bash Grep Glob --output-format text

# Hermes — auditoría (archivo de tarea evita problemas de escape)
hermes chat --query-file <tarea>.md -Q --in <directorio>

# Antigravity — implementación
agy -p "<prompt>" --mode accept-edits --output-format json
# Antigravity — auditoría de solo lectura
agy -p "<prompt>" --mode plan --output-format json

# Kiro — tarea de bajo consumo, solo lectura (fs_read nada más)
kiro-cli chat --no-interactive --model qwen3-coder-next --trust-tools=fs_read "<prompt>"

# Kiro — tarea de bajo consumo con escritura acotada
kiro-cli chat --no-interactive --model claude-haiku-4.5 \
  --trust-tools=fs_read,fs_write,shell "<prompt>"

# Kilo — respaldo (config aislada obligatoria)
XDG_CONFIG_HOME=/tmp/opencode/kilo-cfg kilo run \
  --model kilo/nvidia/nemotron-3-ultra-550b-a55b:free "<prompt>"
```

## Perfil Kiro (bajo consumo)

Herramientas reales confirmadas: `fs_read`, `fs_write`, `shell`.
`--trust-tools` es lista separada por comas; si se pide una herramienta no incluida,
Kiro la **deniega** y el comando falla (`tool permission approval is not supported in
non-interactive mode`). Verificado: sin `shell`, `wc -l` falla; con `shell`, funciona.

### Selección de modelo por coste (multiplicador de crédito real)

| Modelo | Créditos | Uso asignado |
|---|---|---|
| `qwen3-coder-next` | **0.05** | Mecánico: conteos, listados, extracción de firmas, ¿existe X? |
| `minimax-m2.1` | 0.15 | Alternativa mecánica con más contexto (196k) |
| `deepseek-3.2` / `minimax-m2.5` | 0.25 | Extracción con algo de razonamiento |
| `claude-haiku-4.5` | 0.40 | Cuando hace falta criterio pero no auditoría profunda |
| `glm-5` | 0.50 | Reserva |
| `auto` / `claude-sonnet-4.5` | 1.00 / 1.30 | **No usar** para bajo consumo |

### Frontera de responsabilidad
- **Sí**: resúmenes de archivos, inventarios, extracción de endpoints y firmas, búsqueda de
  patrones, verificación de que un cambio existe, conteos, comprobaciones de formato,
  generación de listados, tareas repetitivas con criterio de éxito mecánico.
- **No**: decisiones de arquitectura, seguridad profunda, diseño de UX, implementación
  compleja ni aprobación de trabajo ajeno. Kiro **no emite juicios que cierren una tarea**;
  sus salidas son insumo verificado por OpenCode.
- **No emite veredictos negativos** ("no existe", "ningún caso"). Caso real: K-002 negó que
  `CalendarGrid.tsx` tuviera `borderColor` sin `borderWidth` cuando el archivo no contiene ni un
  solo `borderWidth`. Si hace falta una afirmación negativa, la hace OpenCode con `grep`.
- Prohibido `--trust-all-tools`. Permisos siempre enumerados por tarea.

## Modelos reales

- **FCC**: `open_router/openrouter/free` + fallbacks `zai_api/glm-4.7-flash`, `opencode_go/deepseek-v4.1-flash`, `nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b`, `llm7/anthropic/claude-sonnet-4-6`. `REASONING_POLICY=off`.
- **Hermes**: `upstage/solar-mini4:free` vía Nous Portal. Sin créditos Nous → sin web/browser gestionado. Modelo débil: usar como revisor, no como única fuente de verdad.
- **Antigravity**: `gemini-3.8-flash-{high,medium,low}`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`. Sin agentes personalizados (`agy agents` vacío) → agente por defecto.

## Limitaciones y guardarraíles

1. **FCC declara éxito falso si se le deniegan herramientas.** Verificado: con `--allowedTools "Read,Write,Edit"` (comas) respondió `DONE` sin crear el archivo. La sintaxis correcta usa **espacios**. Consecuencia obligatoria: **nunca aceptar texto como prueba de trabajo**; verificar artefactos en disco y `git diff`.
2. **`--bare` es obligatorio con FCC.** Sin él, los hooks de ECC inyectan `PRIOR-SESSION SUMMARY` de sesiones previas (instrucciones obsoletas) en cada corrida. `CLAUDE_CONFIG_DIR` aislado y `--settings {"hooks":{}}` rompen las herramientas → prohibidos.
3. **Prohibido `--dangerously-skip-permissions`** en `agy` y `--dangerously-skip-permissions`/`--allow-dangerously-skip-permissions` en `fcc-claude`. Permisos mínimos por tarea.
4. **Ningún agente aprueba su propia implementación.** Toda entrega pasa por revisión de OpenCode + auditoría cruzada.
5. **Sin acceso a secretos en prompts.** No se transmiten claves ni valores de `.env` a ningún agente.

> **Autonomía:** los perfiles sin interrupciones y sus listas negras están en `AUTONOMY.md`.
> Ningún agente usa `--dangerously-skip-permissions`; la autonomía se logra con `dontAsk`/`--yolo`
> más vetos explícitos.

## Protocolo de respaldo (Kilo Code CLI)

Kilo entra **solo** cuando un primario no puede completar la misión. No es un cuarto opinador
permanente: sustituye para que la misión no se detenga.

### Disparadores de sustitución
| Disparador | Detección |
|---|---|
| Cuota / límite agotado | `rate limit`, `quota`, `too many requests`, `insufficient credits`, `resource_exhausted`, `429` |
| Autenticación inválida | `not authenticated`, `unauthorized`, `invalid api key`, `401`, `403` |
| Tiempo agotado | `timeout` → exit 124 |
| Salida vacía o proceso caído | archivo de salida de 0 bytes, exit ≠ 0 |

### Mecanismo
`scripts/dispatch.sh <TASK> <AGENTE> <MISION> <WORKDIR> [MODELO]`
1. **Preflight** con prompt mínimo → detecta cuota/auth antes de gastar 15 minutos.
2. Ejecuta la misión con el primario, con `timeout 900`.
3. Si falla por cualquier disparador, genera `mission-fallback.md` con contexto de sustitución
   explícito ("no asumas resultados previos del agente original") y ejecuta Kilo en el mismo worktree.
4. Registra en `dispatch-ledger.jsonl`: tarea, agente, ejecutor real, motivo, segundos y
   **número de cambios detectados en el worktree**.
5. Sale con `0` (primario), `3` (respaldo) o `1` (fallo total). Con `DISPATCH_EXPECT_CHANGES=1`,
   si no hubo artefactos sale con `4` y rechaza la entrega.

### Modelos gratuitos reales de Kilo (sin autenticación)
`kilo-auto/free` (por defecto), `nvidia/nemotron-3-ultra-550b-a55b:free` (el más capaz),
`nvidia/nemotron-3.5-lightning:free`, `openrouter/free`, `cohere/north-mini-code:free`,
`liquid/lfm-3-1.7b:free`, `thinkingmachines/inkling-2-small:free`.

### Guardarraíles de Kilo
- **Config aislada obligatoria**: `XDG_CONFIG_HOME=/tmp/opencode/kilo-cfg`. El config global del
  usuario permite `rm *`, `sudo *`, `chmod *` y `git push *` — nunca debe usarse con un agente.
  La config aislada permite editar y limita bash a lectura + `typecheck` + `test`, con `*: ask`
  (que en modo headless equivale a denegar).
- Kilo **no verifica su propio trabajo**: el `dispatch.sh` solo registra cambios; la validación
  de contenido sigue siendo responsabilidad de OpenCode.
- Riesgo conocido: en headless Kilo auto-aprueba la edición de archivos. Solo se le da un
  worktree aislado, nunca el árbol del usuario.

## Respaldo 2 — Cursor Agent

Autenticado con cuenta de Cursor. Invocación:

```bash
cursor-agent -p --force --output-format text --model auto "<prompt>"
```

- **Modelos**: `auto` (por defecto), `gpt-5.3-codex(-low/high/xhigh)`, `composer-2.5`,
  `claude-opus-5-thinking-high`, `gpt-5.6-sol-high`, entre otros.
- **Solo lectura**: `--mode plan` o `--mode ask`.
- **Límite crítico comprobado**: Cursor **no ofrece veto fiable por comando** en headless.
  Probado de tres formas: `--auto-review` permitió `rm -f`; `permissions.deny` en
  `.cursor/cli.json` del proyecto no se aplicó; `--force` ejecuta sin preguntar. Por eso es
  **último recurso** y solo recibe worktrees aislados, nunca el árbol del usuario.
- No se le pasan credenciales ni rutas fuera del worktree.

### Cadena de respaldo

`primario → Kilo → Cursor`. El despachador registra en el ledger cuál ejecutó realmente
(`fallback_kilo` / `fallback_cursor`) y no relanza el respaldo si el ejecutor dejó artefactos.

## Disponibilidad observada (2026-11-10)

| Agente | Estado | Detalle |
|---|---|---|
| Kiro | ✅ disponible | Barato, solo extracción positiva |
| Cursor | ✅ disponible | Sin veto por comando; solo worktrees aislados |
| FCC Claude | ⚠️ lento | Funciona, pero >10 min incluso en misiones de 3 tareas |
| Antigravity | ⛔ 429 | Cuota individual agotada, reinicia en ~139 h |
| Kilo (free) | ⛔ agotado | `Sign up for free to continue` en `kilo-auto/free` |
| Hermes | ⛔ descartado | Modelo débil (`solar-mini4:free`), timeouts |

Consecuencia práctica: hoy la cadena útil es **Cursor como primario** para implementación y
**Kiro** para extracción. La cadena `primario → Kilo → Cursor` sigue siendo correcta para cuando
se renueven las cuotas.
