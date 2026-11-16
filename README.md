<div align="center">

<img src="app/assets/logo.svg" width="120" height="120" alt="Productivity App Logo">

# Productivity App

**Tu asistente de productividad académica: tareas, calendario, estudio con repetición espaciada e IA.**

[![Descargar APK](https://img.shields.io/badge/Descargar-APK%20para%20Android-2EA44F?style=for-the-badge&logo=android&logoColor=white)](https://github.com/jeronimoparra-ai/proyectos/releases/download/apk-latest/productivity-app.apk)

[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020?style=flat-square&logo=expo)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com)

</div>

---

## Descargar la app

**[⬇️ Descargar APK para Android](https://github.com/jeronimoparra-ai/proyectos/releases/download/apk-latest/productivity-app.apk)**

El enlace es permanente: siempre apunta a la última versión publicada. El archivo se genera y se firma automáticamente en GitHub Actions.

**Instalación:** abre el enlace desde el móvil, descarga el APK, permite "orígenes desconocidos" cuando Android lo pida e instala.

<details>
<summary>Compilar el APK por tu cuenta</summary>

```bash
# GitHub Actions: Actions → Build APK → Run workflow

# Local (requiere Android SDK y JDK 17)
cd app
npm ci --legacy-peer-deps
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# Resultado: android/app/build/outputs/apk/release/app-release.apk
```

</details>

---

## Características

| | |
|---|---|
| ✅ **Tareas** | Prioridades, fechas, subtareas y recordatorios |
| 🗓️ **Calendario** | Vista mensual y semanal de eventos |
| 🧠 **Estudio** | Repetición espaciada SM-2 y tarjetas de repaso |
| ✨ **IA** | Resúmenes, preguntas y explicaciones generadas a partir de tus apuntes |
| 🔍 **Búsqueda** | Investigación de temas con Brave Search |
| 🔔 **Notificaciones** | Recordatorios push en tiempo real |
| 🌗 **Temas** | Claro, oscuro y automático |

---

## Stack

```
Frontend          Backend           Servicios
────────          ───────           ─────────
React Native      Node.js           Supabase (DB + Auth)
Expo SDK 57       Express 5         OpenRouter (IA)
Zustand           TypeScript        Brave Search
React Navigation  Zod               Google Calendar
```

---

## Estructura

```
productivity-app/
├── app/                    # App móvil (Expo)
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── screens/        # Pantallas
│   │   ├── services/       # Clientes de API
│   │   ├── store/          # Stores de Zustand
│   │   ├── hooks/          # Hooks
│   │   └── navigation/     # Navegación
│   └── app.json
├── backend/                # API (Node + Express)
│   ├── src/modules/        # auth, tasks, events, academic, ai,
│   │                       # reviews, reminders, notifications…
│   └── src/database/migrations/
├── tests/integration/      # Pruebas de integración (RLS, OAuth, push…)
└── .github/workflows/      # CI y publicación del APK
```

---

## Desarrollo local

### Requisitos

- Node.js 20+
- npm
- Cuenta de Supabase y claves de OpenRouter (para la IA)

### Configuración

```bash
git clone https://github.com/jeronimoparra-ai/proyectos.git
cd proyectos

cd backend && npm install && cp .env.example .env
cd ../app && npm install && cp .env.example .env
```

**`backend/.env`**

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
SUPABASE_ANON_KEY=tu-anon-key
OPENROUTER_API_KEY=tu-api-key
BRAVE_SEARCH_API_KEY=tu-api-key       # opcional
GOOGLE_CLIENT_ID=tu-client-id         # opcional, para Calendar
GOOGLE_CLIENT_SECRET=tu-secret
```

**`app/.env`**

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Aplica las migraciones de `backend/src/database/migrations/` en el SQL Editor de Supabase, en orden.

### Ejecutar

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd app && npx expo start
```

Para el APK publicado, las variables `EXPO_PUBLIC_*` se configuran como **secrets del repositorio** y se inyectan durante la compilación; no se usan archivos `.env`.

---

## API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| GET / POST | `/api/tasks` | Listar / crear tareas |
| GET / POST | `/api/events` | Listar / crear eventos |
| POST | `/api/reviews` | Registrar una revisión SM-2 |
| GET | `/api/reviews/due` | Revisiones pendientes |
| POST | `/api/ai/summarize` | Resumir contenido |
| POST | `/api/ai/questions` | Generar preguntas de estudio |
| POST | `/api/ai/explain` | Explicar un concepto |
| POST / DELETE | `/api/notifications/push-token` | Registrar / revocar push token |

---

## Pruebas

```bash
cd backend && npm test
cd backend && npm run typecheck
cd app && npm run typecheck
```

La CI ejecuta además pruebas de integración con PostgreSQL, migraciones limpias e incrementales, y un gate de auditoría de dependencias.

---

## Contribuir

1. Haz un fork del repositorio.
2. Crea una rama: `git checkout -b feature/nueva-feature`.
3. Commitea y haz push.
4. Abre un Pull Request.

---

## Licencia

ISC

---

<div align="center">

**Desarrollado con ❤️ por [JeroDev](https://github.com/jerodev)**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jerodev)

</div>
