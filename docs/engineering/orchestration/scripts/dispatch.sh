#!/usr/bin/env bash
# dispatch.sh — Despachador de misiones a agentes externos con respaldo automático.
#
# Uso:
#   dispatch.sh <TASK_ID> <AGENTE> <ARCHIVO_MISION> <DIRECTORIO_TRABAJO> [MODELO]
#
# Agentes primarios: fcc | hermes | agy | kiro | kilo
# Respaldo: kilo (solo se usa si el primario falla por cuota, auth, timeout o salida vacía)
#
# Códigos de salida:
#   0 = misión completada por el agente primario
#   3 = misión completada por el agente de respaldo (Kilo)
#   1 = misión fallida (ni primario ni respaldo)
#
# Notas de seguridad:
#   - Nunca se usa --dangerously-skip-permissions ni --trust-all-tools.
#   - Kilo se ejecuta siempre con configuración aislada (XDG_CONFIG_HOME propio),
#     que permite editar pero deniega comandos destructivos.
#   - La salida textual NUNCA se considera prueba: se registra el git status del
#     worktree antes y después para que OpenCode verifique artefactos reales.

set -uo pipefail

ROOT="/home/andresdev/orca/workspaces/proyectos/abalone"
LOG_ROOT="/tmp/opencode/dispatch"
KILO_XDG="/tmp/opencode/kilo-cfg"
LEDGER="${LEDGER:-/home/andresdev/orca/workspaces/proyectos/abalone-wt/integration/docs/engineering/orchestration/dispatch-ledger.jsonl}"
TIMEOUT_MISION="${TIMEOUT_MISION:-900}"
TIMEOUT_PREFLIGHT="${TIMEOUT_PREFLIGHT:-120}"

# Frases que indican cuota, autenticación o límite agotado.
# Se evalúan solo sobre el FINAL de la salida: un informe de auditoría puede citar
# 401/429 como hallazgos y no debe confundirse con un fallo del agente.
PATRON_FALLO='rate.?limit|too many requests|quota exceeded|insufficient (credit|balance|funds|quota)|usage limit reached|resource_exhausted|payment required|credit balance|out of (tokens|credits)|not authenticated|invalid api key|login required|auto-rejected permission'

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

[[ $# -lt 4 ]] && usage

TASK="$1"
AGENT="$2"
MISSION_FILE="$3"
WORKDIR="$4"
MODEL="${5:-}"

[[ -f "$MISSION_FILE" ]] || { echo "ERROR: no existe la misión $MISSION_FILE" >&2; exit 1; }
[[ -d "$WORKDIR" ]]    || { echo "ERROR: no existe el directorio $WORKDIR" >&2; exit 1; }

CASE_DIR="$LOG_ROOT/$TASK"
mkdir -p "$CASE_DIR"
START=$(date +%s)

# ---------------------------------------------------------------- utilidades

detecta_fallo() {
  local archivo="$1"
  [[ -s "$archivo" ]] || return 1                       # salida vacía = fallo
  # Solo el tramo final: los informes largos citan códigos HTTP legítimamente.
  tail -n 12 "$archivo" | grep -qiE "$PATRON_FALLO" && return 0
  return 1
}

snapshot() {
  {
    git -C "$WORKDIR" status --porcelain 2>/dev/null | sort
    # `status --porcelain` NO cambia cuando el agente edita un archivo que ya estaba
    # modificado (caso típico al retomar trabajo interrumpido). El hash del diff sí.
    git -C "$WORKDIR" diff 2>/dev/null | sha1sum
  }
}

# ---------------------------------------------------------------- ejecución

preflight() {
  local agente="$1" salida="$2"
  (
    cd "$WORKDIR" || exit 1
    case "$agente" in
      fcc)
        fcc-claude -p "Responde solo: OK" --bare --permission-mode plan \
          --allowedTools Read --output-format text ;;
      hermes)
        printf 'Responde solo: OK\n' > "$CASE_DIR/preflight.md"
        hermes chat --query-file "$CASE_DIR/preflight.md" -Q \
          --in "$WORKDIR" ;;
      agy)
        agy -p "Responde solo: OK" --mode plan --output-format json ;;
      kiro)
        kiro-cli chat --no-interactive --model qwen3-coder-next --trust-tools= \
          "Responde solo: OK" ;;
      kilo)
        XDG_CONFIG_HOME="$KILO_XDG" kilo run "Responde solo: OK" ;;
      cursor)
        cursor-agent -p --mode plan "Responde solo: OK" ;;
      *)
        echo "Agente desconocido: $agente"; exit 1 ;;
    esac
  ) >"$salida" 2>&1
}

# Recibe el archivo de misión como $2 para que el respaldo use su propio contexto.
mision() {
  local agente="$1" mfile="$2" salida="$3"
  local prompt
  prompt="$(cat "$mfile")"
  (
    # El cd es obligatorio: sin él los agentes escriben en el directorio del orquestador.
    cd "$WORKDIR" || exit 1
    case "$agente" in
      fcc)
        timeout "$TIMEOUT_MISION" fcc-claude -p "$prompt" --bare \
          --permission-mode dontAsk \
          --allowedTools "Write Edit Read Bash Grep Glob" \
          --disallowedTools "Bash(rm *) Bash(rmdir *) Bash(sudo *) Bash(su *) Bash(chmod *) Bash(chown *) Bash(dd *) Bash(mkfs*) Bash(shutdown*) Bash(reboot*) Bash(kill *) Bash(pkill *) Bash(killall *) Bash(git push*) Bash(git reset *) Bash(git clean *) Bash(npm publish*) Bash(curl *) Bash(wget *) Bash(systemctl *)" \
          --output-format text ;;
      hermes)
        timeout "$TIMEOUT_MISION" hermes chat --query-file "$mfile" -Q \
          --in "$WORKDIR" --no-restore-cwd --yolo --checkpoints ;;
      agy)
        local args=(--mode accept-edits --output-format json)
        [[ -n "$MODEL" ]] && args+=(--model "$MODEL")
        timeout "$TIMEOUT_MISION" agy -p "$prompt" "${args[@]}" ;;
      kiro)
        local m="${MODEL:-qwen3-coder-next}"
        timeout "$TIMEOUT_MISION" kiro-cli chat --no-interactive --model "$m" \
          --trust-tools=fs_read,fs_write,shell "$prompt" ;;
      kilo)
        local m="${MODEL:-kilo/kilo-auto/free}"
        XDG_CONFIG_HOME="$KILO_XDG" timeout "$TIMEOUT_MISION" kilo run \
          --model "$m" "$prompt" ;;
      cursor)
        # Cursor no ofrece veto fiable por comando en headless: solo se le da un worktree aislado.
        local m="${MODEL:-auto}"
        timeout "$TIMEOUT_MISION" cursor-agent -p --force --output-format text \
          --model "$m" "$prompt" ;;
      *)
        echo "Agente desconocido: $agente"; exit 1 ;;
    esac
  ) >"$salida" 2>&1
}

# ---------------------------------------------------------------- flujo

snapshot > "$CASE_DIR/git-before.txt"
echo "[dispatch] $TASK · primario=$AGENT · dir=$WORKDIR" | tee "$CASE_DIR/meta.log"

PRIMARIO="primary"
MOTIVO=""

if [[ "${DISPATCH_FORCE_FALLBACK:-0}" == "1" ]]; then
  MOTIVO="${DISPATCH_REASON:-fallback forzado por DISPATCH_FORCE_FALLBACK}"
else
  preflight "$AGENT" "$CASE_DIR/preflight.log"
  if detecta_fallo "$CASE_DIR/preflight.log"; then
    MOTIVO="preflight falló (cuota/auth/indisponible)"
  fi
fi

if [[ -z "$MOTIVO" ]]; then
  mision "$AGENT" "$MISSION_FILE" "$CASE_DIR/run.log"
  RC=$?
  if [[ $RC -eq 124 ]]; then
    MOTIVO="timeout de ${TIMEOUT_MISION}s"
  elif [[ $RC -ne 0 ]]; then
    MOTIVO="exit code $RC"
  elif detecta_fallo "$CASE_DIR/run.log"; then
    MOTIVO="cuota/auth agotada en la respuesta"
  fi
fi

if [[ -n "$MOTIVO" ]]; then
  PRIMARIO="fallback"
  echo "[dispatch] primario $AGENT no disponible: $MOTIVO" | tee -a "$CASE_DIR/meta.log"

  # Contexto de sustitución para que el respaldo no repita trabajo ya hecho.
  {
    echo "CONTEXTO DE SUSTITUCION"
    echo "Agente original: $AGENT. Motivo: $MOTIVO."
    echo "Actúas como respaldo. Ejecuta la misión completa en el directorio de trabajo."
    echo "No asumas resultados previos del agente original."
    echo
    cat "$MISSION_FILE"
  } > "$CASE_DIR/mission-fallback.md"

  # Cadena de respaldo: Kilo primero, Cursor como último recurso.
  ESTADO=""
  for FB in kilo cursor; do
    FB_LOG="$CASE_DIR/run-fallback-$FB.log"
    mision "$FB" "$CASE_DIR/mission-fallback.md" "$FB_LOG"
    RC=$?
    snapshot > "$CASE_DIR/git-after.txt"
    CAMBIOS_FB=$(diff "$CASE_DIR/git-before.txt" "$CASE_DIR/git-after.txt" | grep -c '^[<>]' || true)
    # El ejecutor puede salir con código != 0 y aun así dejar artefactos válidos.
    # Manda el artefacto, no el código de salida.
    if [[ $RC -ne 0 ]] && [[ "${CAMBIOS_FB:-0}" -gt 0 ]]; then
      echo "[dispatch] AVISO: $FB con exit $RC pero con artefactos en el worktree" | tee -a "$CASE_DIR/meta.log"
      RC=0
    fi
    if [[ $RC -eq 0 ]] && ! detecta_fallo "$FB_LOG"; then
      cp "$FB_LOG" "$CASE_DIR/resultado.log"
      ESTADO="fallback_$FB"
      CODE=3
      MOTIVO="$MOTIVO; ejecutado por $FB"
      break
    fi
    echo "[dispatch] respaldo $FB no completó la misión" | tee -a "$CASE_DIR/meta.log"
  done

  if [[ -z "$ESTADO" ]]; then
    echo "[dispatch] FALLO TOTAL: ni el primario ni los respaldos completaron la misión" | tee -a "$CASE_DIR/meta.log"
    FIN=$(( $(date +%s) - START ))
    printf '{"task":"%s","agent":"%s","executor":"none","reason":"%s","seconds":%s}\n' \
      "$TASK" "$AGENT" "$MOTIVO" "$FIN" >> "$LEDGER"
    exit 1
  fi
else
  cp "$CASE_DIR/run.log" "$CASE_DIR/resultado.log"
  ESTADO="primary"
  CODE=0
fi

snapshot > "$CASE_DIR/git-after.txt"
FIN=$(( $(date +%s) - START ))
CAMBIOS=$(diff "$CASE_DIR/git-before.txt" "$CASE_DIR/git-after.txt" | grep -c '^[<>]' || true)

# Regla dura: si la misión debía producir artefactos y no hubo cambios, se rechaza.
if [[ "${DISPATCH_EXPECT_CHANGES:-0}" == "1" && "${CAMBIOS:-0}" -eq 0 ]]; then
  echo "[dispatch] RECHAZADO: se esperaban artefactos y el worktree quedó idéntico" | tee -a "$CASE_DIR/meta.log"
  printf '{"task":"%s","agent":"%s","executor":"%s","reason":"sin_artefactos","seconds":%s,"changed_lines":0}\n' \
    "$TASK" "$AGENT" "$ESTADO" "$FIN" >> "$LEDGER"
  exit 4
fi

printf '{"task":"%s","agent":"%s","executor":"%s","reason":"%s","seconds":%s,"changed_lines":%s}\n' \
  "$TASK" "$AGENT" "$ESTADO" "$MOTIVO" "$FIN" "${CAMBIOS:-0}" >> "$LEDGER"

echo "[dispatch] estado=$ESTADO · segundos=$FIN · cambios_detectados=$CAMBIOS"
echo "[dispatch] log: $CASE_DIR/resultado.log"
echo "[dispatch] AVISO: la salida textual no es prueba. Verifica los artefactos con git diff."
exit $CODE
