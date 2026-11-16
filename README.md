<div align="center">

<img src="app/assets/logo.svg" width="120" height="120" alt="Productivity App Logo">

# Productivity App

### Tu asistente inteligente de productividad académica

[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020?style=flat-square&logo=expo)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com)

---

**Gestiona tareas, calendario, estudia con repetición espaciada y potencia tu aprendizaje con IA.**

</div>

---

## Descargar la App

### Descarga directa

El APK se construye automáticamente en GitHub Actions (rama `master`) y se publica como asset de la Release `apk-latest`. El asset se reescribe cada vez que se dispara `Build APK`, por lo que el enlace es estable:

| Plataforma | Enlace de descarga |
|------------|-------------------|
| **Android** | **[Descargar APK](https://github.com/jeronimoparra-ai/proyectos/releases/download/apk-latest/productivity-app.apk)** |

**Instalación en el teléfono:**

1. Abre el enlace desde el teléfono y descarga el archivo.
2. Si Android lo pide, permite instalar desde "orígenes desconocidos" para tu navegador.
3. Instala y abre la app.

> ⚠️ **Si al abrirla ves "Configuración incompleta"**, es que el build se hizo sin las
> variables de Supabase. Es intencionado: la app avisa en vez de cerrarse sola.
> Define los secrets `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y
> `EXPO_PUBLIC_API_URL` en **Settings → Secrets and variables → Actions** y relanza
> el workflow. El APK nuevo ya se conectará al backend.

### Compilar el APK tú mismo

```bash
# Opción A — GitHub Actions (recomendado, sin instalar nada)
#   Actions → Build APK → Run workflow

# Opción B — local, requiere Android SDK y JDK 17
cd app
npm ci --legacy-peer-deps
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK en android/app/build/outputs/apk/release/app-release.apk

# Opción C — EAS (el enlace que genera caduca, no sirve para distribuir)
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```

---

## Características principales

| Feature | Descripción |
|---------|-------------|
| **Tareas** | CRUD completo con prioridades, fechas, recordatorios y subtareas |
| **Calendario** | Vista mensual y semanal con eventos |
| **Estudio** | Repetición espaciada SM-2 para optimizar tu aprendizaje |
| **IA** | Resúmenes, preguntas de repaso y recomendaciones personalizadas |
| **Búsqueda** | Research de topics con Brave Search |
| **Notificaciones** | Push notifications para recordatorios en tiempo real |
| **Temas** | Modo claro, oscuro y automático |

---

## Capturas de pantalla

<div align="center">

| Login | Tareas | Calendario | Estudio |
|:-----:|:------:|:----------:|:-------:|
| ![Login](https://via.placeholder.com/200x400/1a1a2e/ffffff?text=Login) | ![Tasks](https://via.placeholder.com/200x400/16213e/ffffff?text=Tareas) | ![Calendar](https://via.placeholder.com/200x400/0f3460/ffffff?text=Calendario) | ![Study](https://via.placeholder.com/200x400/533483/ffffff?text=Estudio) |

</div>

---

## Stack tecnológico

```
Frontend          Backend           Services
─────────         ────────          ────────
React Native      Node.js           Supabase (DB + Auth)
Expo SDK 57       Express 5         OpenRouter (IA)
Zustand           TypeScript        Brave Search
React Navigation  Zod Validation    Google Calendar
```

---

## Arquitectura

```
productivity-app/
├── app/                    # React Native (Expo)
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── screens/        # Pantallas de la app
│   │   ├── services/       # API clients
│   │   ├── store/          # Zustand stores
│   │   ├── hooks/          # Custom hooks
│   │   └── navigation/     # Navegación
│   └── app.json
│
├── backend/                # Node.js API
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       # Autenticación
│   │   │   ├── tasks/      # Gestión de tareas
│   │   │   ├── events/     # Calendario
│   │   │   ├── academic/   # Tareas académicas
│   │   │   ├── ai/         # Integración IA
│   │   │   ├── reviews/    # Spaced repetition
│   │   │   ├── reminders/  # Recordatorios
│   │   │   └── notifications/ # Push notifications
│   │   ├── middleware/      # Auth, validation, errors
│   │   └── utils/          # Helpers, SM-2 algorithm
│   └── src/database/migrations/
│
└── .github/workflows/      # CI/CD
```

---

## Quick Start para desarrolladores

### Prerrequisitos

- Node.js >= 18
- npm o yarn
- Expo CLI (`npm install -g expo-cli`)
- Cuenta de Supabase (gratis)
- Cuenta de Expo (gratis)

### 1. Clonar y configurar

```bash
git clone <url-del-repositorio>
cd proyectos

# Backend
cd backend && npm install
cp .env.example .env

# App
cd ../app && npm install
cp .env.example .env
```

### 2. Configurar variables de entorno

**Backend (`backend/.env`):**

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
OPENROUTER_API_KEY=tu-api-key
BRAVE_SEARCH_API_KEY=tu-api-key
EXPO_ACCESS_TOKEN=tu-token-expo  # Opcional pero recomendado
```

**App (`app/.env`):**

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3000
```

> Estos valores son plantillas. La app los detecta como no configurados y muestra
> la pantalla "Configuración incompleta" en lugar de arrancar con datos falsos.
>
> Para el **APK descargable** no se usa `app/.env`: las mismas variables se definen
> como secrets del repositorio (`Settings → Secrets and variables → Actions`) y el
> workflow las inyecta al compilar.

### 3. Configurar base de datos

Ejecuta el SQL de `backend/src/database/migrations/` en tu Supabase Dashboard > SQL Editor.

### 4. Ejecutar

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - App
cd app && npx expo start
```

---

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/tasks` | Listar tareas |
| POST | `/api/tasks` | Crear tarea |
| GET | `/api/events` | Listar eventos |
| POST | `/api/events` | Crear evento |
| POST | `/api/reviews` | Registrar review SM-2 |
| GET | `/api/reviews/due` | Obtener reviews pendientes |
| POST | `/api/ai/summarize` | Resumir contenido con IA |
| POST | `/api/ai/questions` | Generar preguntas de estudio |
| POST | `/api/ai/explain` | Explicar un concepto |
| POST | `/api/notifications/push-token` | Registrar push token |
| DELETE | `/api/notifications/push-token` | Revocar push token |

---

## Estado Actual del Proyecto

**Última actualización:** 16/11/2026

### ✅ Qué está funcionando

| Componente | Estado |
|---|---|
| **API (backend)** | Desplegada en Render: <https://productivity-api-l40i.onrender.com/health> |
| **Base de datos** | Supabase real, migraciones 001→009 aplicadas (18 tablas con RLS) |
| **APK Android** | Firmado (esquema v2) y publicado en la Release `apk-latest` |
| **IA** | OpenRouter con `google/gemini-2.5-flash` (modelo configurable con `OPENROUTER_MODEL`) |
| **Tests** | Backend (unitarios) e integración (RLS, OAuth, sesión, push, migraciones) en CI |
| **CI** | 6 jobs + gate de auditoría de dependencias de producción |

### 🐞 Bugs de producción corregidos (16/11/2026)

1. **APK que no abría / enlace 404.** El build usaba valores de ejemplo y el enlace de EAS
   caducaba. Ahora `EXPO_PUBLIC_*` se inyectan desde secrets, el enlace es estable
   (`releases/download/apk-latest/productivity-app.apk`) y el APK va firmado.
2. **Firma del APK.** `signingConfigs.release` se inyecta con `findProperty('RELEASE_*')`
   (Gradle no expone propiedades personalizadas como variables) y las propiedades se añaden
   con salto de línea inicial, porque `expo prebuild` no cierra `gradle.properties` (eso
   rompía el autolinking de Expo).
3. **Alta de usuarios en 500.** `handle_new_user()` era `SECURITY DEFINER` sin `search_path`;
   `supabase_auth_admin` tiene `search_path=auth`, así que el `INSERT` buscaba
   `auth.user_preferences`. Corregido en la migración 008.
4. **403 en casi todas las tablas.** Las migraciones 001–003 no concedían privilegios a
   `authenticated`/`service_role`. Corregido en la migración 009 (RLS sigue filtrando filas).
5. **IA caída.** El modelo `google/gemini-2.0-flash-001` ya no existe en OpenRouter.
6. **Rate limit inoperante** detrás del proxy de Render (faltaba `trust proxy`) y evadible por
   IPv6; además los 5xx filtraban internals. Todo endurecido.

### ⏳ Pendiente

- **Google Calendar**: faltan `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` y registrar el
  redirect real en Google Cloud. Sin ellas la app avisa, no rompe.
- **Verificación en dispositivo**: instalar el APK y probar login, tareas, recordatorios y push.

### 🔐 Variables de entorno necesarias (nombres únicamente)

Para que quien rote el proyecto sepa qué debe configurar de nuevo al clonar el repo:

**Backend (`backend/.env`):**
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- OPENROUTER_API_KEY
- BRAVE_SEARCH_API_KEY
- EXPO_ACCESS_TOKEN (opcional pero recomendado)
- PORT, NODE_ENV, CORS_ORIGIN, FRONTEND_URL

**App (`app/.env`):**
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_API_URL

**GitHub Actions (para el APK):** los tres `EXPO_PUBLIC_*` anteriores como secrets del
repositorio. Sin ellos el APK se compila igual y muestra la pantalla de configuración.

---

## Testing

```bash
# Backend - Todos los tests
cd backend && npm test

# Backend - Watch mode
cd backend && npm run test:watch

# Typecheck
cd backend && npm run typecheck
cd app && npm run typecheck
```

---

## Contribuir

1. Fork el proyecto
2. Crea una branch (`git checkout -b feature/nueva-feature`)
3. Haz commit (`git commit -m 'Add nueva feature'`)
4. Push a la branch (`git push origin feature/nueva-feature`)
5. Abre un Pull Request

---

## Licencia

ISC

---

<div align="center">

**Desarrollado con ❤️ por [JeroDev](https://github.com/jerodev)**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerodev)

</div>
