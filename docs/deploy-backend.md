# Despliegue del backend (API de Productivity App)

El motor de IA vive en el **backend** (`backend/src/modules/ai/ai.service.ts` → OpenRouter,
modelo `google/gemini-2.0-flash-001`), no en la app. Por eso la app solo puede usar IA,
Google Calendar, búsqueda web y recordatorios push cuando la API está desplegada y el APK
se compila con `EXPO_PUBLIC_API_URL` apuntando a ella.

## Variables de entorno requeridas

| Variable | Obligatoria | Descripción |
|---|---|---|
| `SUPABASE_URL` | sí | `https://jfmydwshyvpplsxkrwns.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Clave service_role del proyecto Supabase (secreta) |
| `OPENROUTER_API_KEY` | sí (IA) | `sk-or-v1-...` de openrouter.ai |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | sí (Calendar) | OAuth de Google Cloud |
| `GOOGLE_REDIRECT_URI` | sí (Calendar) | Redirect exacto registrado en Google Cloud |
| `BRAVE_SEARCH_API_KEY` | no | Búsqueda web |
| `EXPO_ACCESS_TOKEN` | no | Envío fiable de push |
| `CORS_ORIGIN` / `FRONTEND_URL` | no | Origen del panel web |
| `PORT` | no | Lo inyecta la plataforma |

**Nunca** se escriben en el repo: van en el panel del proveedor (o en `backend/.env` local,
que está en `.gitignore`).

## Opción A — Render (recomendada, plan free)

1. Render → **New → Blueprint** → repo `jeronimoparra-ai/proyectos`.
   Render lee `render.yaml` (raíz del repo) y crea el servicio Docker `productivity-api`.
2. Rellenar las variables marcadas `sync: false` (`SUPABASE_SERVICE_ROLE_KEY`,
   `OPENROUTER_API_KEY`, credenciales de Google, `BRAVE_SEARCH_API_KEY`).
3. Esperar el primer deploy y comprobar:
   ```bash
   curl -s https://<servicio>.onrender.com/health
   # {"status":"ok","timestamp":"..."}
   ```
4. Con la API key de Render (`Account Settings → API Keys`) el despliegue se puede
   automatizar:
   ```bash
   RENDER_API_KEY=... ./scripts/deploy-backend.sh
   ```

## Opción B — Railway / Fly.io

```bash
railway init && railway up        # Dockerfile en backend/
fly launch --dockerfile backend/Dockerfile && fly deploy
```

## Conectar el APK con la API

El cliente añade las rutas (`/ai/summarize`, `/tasks`, ...) directamente al valor, y el
backend las sirve bajo `/api`, así que **la URL debe incluir `/api`**:

```bash
gh secret set EXPO_PUBLIC_API_URL --repo jeronimoparra-ai/proyectos \
  --body "https://<servicio>.onrender.com/api"
gh workflow run build-apk.yml --repo jeronimoparra-ai/proyectos --ref master
```

Sin esa variable la app arranca igual (login y datos van por Supabase) pero muestra el
aviso de `EXPO_PUBLIC_API_URL` y las pantallas que dependen de la API fallan con
"Sin conexión".

## Google Calendar

`GOOGLE_REDIRECT_URI` debe coincidir **exactamente** con el registrado en Google Cloud
Console (incluida la barra final). Al desplegar, añadir el redirect real del servicio
(p. ej. `https://<servicio>.onrender.com/api/google/callback`) en *Authorized redirect URIs*.
