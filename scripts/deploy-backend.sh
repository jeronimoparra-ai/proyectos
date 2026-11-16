#!/usr/bin/env bash
# Crea el servicio Docker del backend en Render a partir de render.yaml.
# Requiere RENDER_API_KEY (Render → Account Settings → API Keys) y el ownerId.
# Uso: RENDER_API_KEY=... RENDER_OWNER_ID=... ./scripts/deploy-backend.sh
set -euo pipefail

: "${RENDER_API_KEY:?Falta RENDER_API_KEY}"
: "${RENDER_OWNER_ID:?Falta RENDER_OWNER_ID (usr-... o tea-...)}"

REPO_URL="https://github.com/jeronimoparra-ai/proyectos"
SERVICE_NAME="${SERVICE_NAME:-productivity-api}"

echo "→ Creando servicio $SERVICE_NAME en Render (Docker, rootDir=backend)…"

payload=$(cat <<JSON
{
  "type": "web_service",
  "name": "${SERVICE_NAME}",
  "ownerId": "${RENDER_OWNER_ID}",
  "repo": "${REPO_URL}",
  "branch": "master",
  "autoDeploy": "yes",
  "rootDir": "backend",
  "env": "docker",
  "serviceDetails": {
    "envSpecificDetails": {
      "dockerfilePath": "./Dockerfile",
      "dockerContext": "."
    },
    "healthCheckPath": "/health",
    "plan": "free",
    "region": "oregon"
  },
  "envVars": [
    { "key": "NODE_ENV", "value": "production" },
    { "key": "SUPABASE_URL", "value": "https://jfmydwshyvpplsxkrwns.supabase.co" },
    { "key": "SUPABASE_SERVICE_ROLE_KEY", "sync": false },
    { "key": "OPENROUTER_API_KEY", "sync": false },
    { "key": "GOOGLE_CLIENT_ID", "sync": false },
    { "key": "GOOGLE_CLIENT_SECRET", "sync": false },
    { "key": "BRAVE_SEARCH_API_KEY", "sync": false },
    { "key": "EXPO_ACCESS_TOKEN", "sync": false },
    { "key": "CORS_ORIGIN", "value": "http://localhost:8081" },
    { "key": "FRONTEND_URL", "value": "http://localhost:8081" }
  ]
}
JSON
)

response=$(curl -sS -X POST "https://api.render.com/v1/services" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "${payload}")

echo "$response"

echo
echo "→ Revisa el panel de Render para completar las variables 'sync: false'."
echo "→ Cuando el /health responda, publica la URL en el APK:"
echo "   gh secret set EXPO_PUBLIC_API_URL --repo jeronimoparra-ai/proyectos --body 'https://<servicio>.onrender.com/api'"
