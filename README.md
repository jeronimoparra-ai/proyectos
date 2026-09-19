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

### Opción 1: Descarga directa (Recomendado)

Haz clic en el botón para descargar la última versión:

| Plataforma | Enlace de descarga |
|------------|-------------------|
| **Android** | **[Descargar APK](https://expo.dev/artifacts/eas/nA_nJQwpmnMsGq00ipdoFiQtlLQ1keitvIkcCXYk9FA.apk)** |

> **Instrucciones:**
> 1. Haz clic en "Descargar APK"
> 
> **Fecha de build:** 15/9/2026, 12:12 p. m. (build más reciente)
> 2. Abre el archivo descargado
> 3. Si es necesario, permite instalación de fuentes desconocidas
> 4. Instala y abre la app

> ⚠️ **Nota:** Si al abrir la app muestra un mensaje de "Configuración necesaria", las variables de entorno de Supabase no están configuradas. La app ahora muestra un mensaje explicando qué falta y ofrece un botón "Reintentar". Para funcionalidad completa, reconstruye la app con tu cuenta de Supabase configurada.

### Opción 2: Build yourself

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Build APK
eas build --profile preview --platform android
```

### Opción 2: Build yourself

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Build APK
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
| POST | `/api/ai/process` | Procesar con IA |
| POST | `/api/notifications/push-token` | Registrar push token |

---

## Estado Actual del Proyecto

**Última actualización:** 19/9/2026

### ✅ Qué está funcionando

- Backend compila y pasa tests (16/16 vitest tests passing)
- Tipos correctos en app y backend (`npm run typecheck` pasa en ambos)
- ESLint configurado (aunque hay 119 errores por resolver en el código existente)
- Módulo StudySessions creado en el backend
- Timeouts agregados en llamadas de red
- Backend desplegado en Render (plan free, actualmente en reposo)

### ⚠️ Problema activo sin resolver

- La app compilada (APK vía EAS) se abre un instante y se cierra sola en el dispositivo real
- Causa aún no confirmada

### 🔍 Qué se descartó como causa

- Variables de entorno en Render: configuradas y verificadas
- Variables de entorno en EAS (preview): verificación no posible (EAS no configurado en este directorio); últimos intentos de configuración realizados pero build no se completó exitosamente
- Backend desplegado y accesible: responde con 503 (free tier en reposo), accesible en https://productivity-app-backend.onrender.com

### 📋 Próximo paso recomendado para retomar

- Conectar el dispositivo por USB y revisar el log real con `adb logcat` (aún no hecho)
- O revisar si ya existe un Error Boundary de React capturando el error de inicialización

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
