# Productivity App

Aplicación móvil de productividad académica con gestión de tareas, calendario, repetición espaciada (SM-2) y una capa de IA desacoplada para resúmenes, preguntas de repaso y recomendaciones de estudio.

## Stack técnico

- **Frontend:** React Native / Expo SDK 57
- **Backend:** Node.js / Express 5 + TypeScript
- **Base de datos:** Supabase (PostgreSQL + Row Level Security)
- **IA:** OpenRouter (capa desacoplada, modelo Gemini Flash)
- **Búsqueda web:** Brave Search API
- **Calendario:** Google Calendar API (OAuth2)
- **Estado:** Zustand
- **Navegación:** React Navigation 7

## Descargar APK

| Build | Estado | Link |
|-------|--------|------|
| Preview v1.0.0 (1) | `FINISHED` | [Descargar APK](https://expo.dev/artifacts/eas/sUtc46ValeSq_GhpK65zQRW3Qu_LHgkfR9bbDGbEsno.apk) |

> **Nota:** Este es un build de prueba (perfil `preview`). No está optimizado para producción ni publicado en Google Play. El link expira el 29/09/2026.

Para ver el historial completo de builds: [EAS Builds](https://expo.dev/accounts/jerodev/projects/productivity-app/builds)

## Ejecutar en desarrollo

### Prerrequisitos

- Node.js >= 18
- npm o yarn
- Expo CLI (`npm install -g expo-cli`)
- Cuenta de Expo (gratis en [expo.dev](https://expo.dev))
- Supabase project (gratis en [supabase.com](https://supabase.com))

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd proyectos
```

### 2. Instalar dependencias

```bash
# Backend
cd backend
npm install

# App
cd ../app
npm install
```

### 3. Variables de entorno

Crea un archivo `.env` en la raíz del proyecto basado en `.env.example`:

```bash
cp .env.example .env
```

Y otro en `backend/`:

```bash
cp backend/.env.example backend/.env
```

**Variables necesarias:**

| Variable | Descripción | Dónde obtenerla |
|----------|-------------|-----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase | Supabase Dashboard > Settings > API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase | Supabase Dashboard > Settings > API |
| `EXPO_PUBLIC_API_URL` | URL del backend (default: `http://localhost:3000`) | Local |
| `SUPABASE_URL` | URL de Supabase (backend) | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend) | Supabase Dashboard > Settings > API |
| `OPENROUTER_API_KEY` | API key de OpenRouter | [openrouter.ai](https://openrouter.ai) |
| `BRAVE_SEARCH_API_KEY` | API key de Brave Search | [brave.com/search/api](https://brave.com/search/api) |

### 4. Ejecutar

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — App
cd app
npx expo start
```

### 5. Migraciones de base de datos

Ejecuta el SQL de `backend/src/database/migrations/001_initial_schema.sql` en tu proyecto Supabase (Dashboard > SQL Editor).

## Estado del proyecto

### Fase 1 — Setup, Auth, DB ✅
- Autenticación completa (registro, login, logout, recuperación de contraseña)
- Schema de base de datos con 15 tablas y RLS
- Configuración de proyecto y variables de entorno

### Fase 2 — Tareas y Calendario ✅
- CRUD de tareas con filtros, búsqueda y paginación
- Subtareas, categorías, etiquetas
- Calendario con vista mensual y semanal
- CRUD de eventos con fuente local/Google
- Sistema de recordatorios

### Fase 3 — Módulo Académico + IA ✅
- Tareas académicas con materiales de estudio
- Procesamiento con IA (resumen, ideas clave, conceptos, preguntas)
- Integración con OpenRouter (Gemini Flash)
- Búsqueda web y research de topics (Brave Search)

### Fase 4 — Repetición Espaciada ✅
- Algoritmo SM-2 implementado
- Interfaz de review con escala de calidad 0-5
- Historial de reviews por tarea
- Feedback semanal con recomendaciones de IA
- Estadísticas de progreso

### Fase 5 — Settings y UI ⚠️
- Pantalla de Settings con selección de tema (light/dark/system)
- Edición de perfil
- SafeArea manejado dinámicamente en todas las pantallas
- Íconos en tabs de navegación
- Date pickers nativos en formularios de tareas y eventos

### Fase 6 — Testing y CI/CD ⚠️
- Vitest configurado con tests unitarios (helpers, SM-2)
- GitHub Actions CI (typecheck + tests en backend y app)
- Rate limiting en endpoints (100 req/15min general, 20 req/15min auth)
- Request logging con morgan

### Pendiente
- Notificaciones push (tabla creada, lógica no implementada)
- Integración completa con Google Calendar (OAuth2 configurado)
- Tests de integración y E2E
- Publicación en Google Play Store
