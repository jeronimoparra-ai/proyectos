# AUTONOMY — Modo autónomo acotado

Objetivo: que los agentes **no se detengan a pedir permiso**, sin caer en el bypass ilimitado que
la directiva prohíbe (sección B/H) y que además es inseguro fuera de un sandbox.

Regla: **autonomía total para lo productivo, veto explícito para lo destructivo.**

## Matriz de autonomía por agente

| Agente | Mecanismo de autonomía | Veto disponible | Estado |
|---|---|---|---|
| FCC Claude | `--permission-mode dontAsk` + `--allowedTools "Write Edit Read Bash Grep Glob"` | `--disallowedTools "Bash(rm *) Bash(sudo *) ..."` | ✅ verificado |
| Hermes | `--yolo --checkpoints` | checkpoints permiten `/rollback` | ✅ verificado |
| Antigravity | `--mode accept-edits` | no expone lista negra útil (`--settings` rechaza el esquema de permisos) | ✅ verificado |
| Kiro | `--trust-tools=fs_read,fs_write,shell` | por herramienta, no por comando | ✅ verificado |
| Kilo | `permission.bash: {"*": "allow", "<destructivo>": "deny"}` | `deny` gana sobre `allow` | ✅ verificado |

## Evidencia de las pruebas

```
FCC  dontAsk + disallowedTools
  → escribir ok.txt ................ OK (AUTO_OK, sin prompt)
  → ejecutar rm -f victima.txt ..... BLOQUEADO (archivo sobrevive)

Hermes  --yolo --checkpoints
  → echo HERMES_YOLO > yolo.txt .... OK (sin prompt)

Antigravity  --mode accept-edits
  → escritura de archivo ........... OK
  → ejecución de shell ............. OK
  → --settings permissions.deny .... NO SOPORTADO (clave ignorada)

Kilo  allow + deny
  → grep -n ........................ OK
  → rm -f .......................... BLOQUEADO ("pattern":"rm *","action":"deny")
```

## Lista negra aplicada (FCC y Kilo)

`rm`, `rmdir`, `sudo`, `su`, `chmod`, `chown`, `dd`, `mkfs`, `shutdown`, `reboot`, `kill`,
`pkill`, `killall`, `git push`, `git reset`, `git clean`, `npm publish`, `curl`, `wget`,
`systemctl`.

## Por qué no `--dangerously-skip-permissions`

1. **La directiva lo prohíbe** explícitamente y pide "permisos mínimos necesarios".
2. **Es innecesario**: `dontAsk` consigue cero interrupciones conservando el veto. El bypass
   desactiva también la protección contra `rm -rf`, `sudo` y `git push --force`.
3. **El riesgo es real**: los agentes operan con acceso a red y a tus credenciales de git. Un
   `git push` accidental a `origin/master` no se deshace con un `git reset`.

## Límites que se mantienen siempre

- Cada agente trabaja en un **worktree aislado**; nunca en el árbol del usuario.
- `--add-dir` / rutas fuera del worktree no se conceden.
- No se transmiten secretos ni contenido de `.env`.
- El resultado se valida con `git diff` + gates (typecheck, tests). La autonomía no cambia quién
  aprueba: **OpenCode sigue siendo el único que integra**.
- Antigravity y Hermes no tienen veto por comando: se compensa con worktree aislado y
  `--checkpoints` (Hermes). No se les asignan misiones que requieran borrar o publicar.

## Cómo se activa

`dispatch.sh` ya usa el perfil autónomo por defecto en cada invocación. No hay flag que recordar:

```bash
docs/engineering/orchestration/scripts/dispatch.sh T-XXX fcc mision.md <worktree>
```

Si alguna vez hace falta una misión estrictamente de solo lectura, se usa el preflight/`plan`
(`--permission-mode plan` en FCC, `--mode plan` en Antigravity).
