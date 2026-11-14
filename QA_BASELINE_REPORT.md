# Informe Baseline QA T6a - Preparación y Baseline

**Fecha:** 2026-11-14
**Commit base:** 2567999cab4ef5b63d869780d45f3014ee0a7b8f
**Rama:** jeronimoparra-ai/remediacion-t6a-qa

---

## 1. Entorno y Versiones

| Herramienta | Versión | Notas |
|-------------|---------|-------|
| Node.js | v20.20.2 | Coincide con `engines` en package.json y CI |
| npm | 10.8.2 | Compatible con lockfiles |
| Expo CLI | No instalado globalmente | Se usa `npx expo` / `npx expo-doctor` |
| Java/JDK | OpenJDK 25.0.4.1 | Disponible (requerido para Android build) |
| Android SDK | **NO DISPONIBLE** | `adb`, `emulator`, `sdkmanager` no en PATH |
| Docker | Disponible | Para harness de integración |

**Conclusión:** Entorno listo para backend y app (typecheck, tests, lint, build, expo-doctor). **Compilación Android local NO disponible** - documentado como pendiente.

---

## 2. Instalación Reproducible

### Backend
```bash
cd backend && npm ci
```
- **Tiempo:** ~4s
- **Resultado:** ✅ Éxito (279 paquetes, 19 vulnerabilidades reportadas - 13 moderate, 5 high, 1 critical)
- **Lockfile:** `package-lock.json` sincronizado

### App (Expo/React Native)
```bash
cd app && npm ci          # FALLA: EUSAGE - lockfile desincronizado (ws@7.5.13 vs 8.23.0)
cd app && npm ci --legacy-peer-deps  # ✅ Éxito
```
- **Tiempo:** ~8s
- **Resultado:** ✅ Éxito con `--legacy-peer-deps` (521 paquetes, 7 vulnerabilidades)
- **Nota:** El lockfile de `app` requiere `--legacy-peer-deps` debido a resolución de peers de `ws` (dos versiones). Esto está documentado en `.github/workflows/ci.yml` línea 57.

---

## 3. Baseline de Validaciones

### Backend

| Comando | Resultado | Tiempo | Detalles |
|---------|-----------|--------|----------|
| `npm run typecheck` (`tsc --noEmit`) | ✅ **PASS** | <1s | Sin errores de tipos |
| `npm test` (`vitest run`) | ✅ **PASS** | 226ms | 3 test files, 21 tests passing |
| `npm run lint` (`eslint src`) | ❌ **FAIL** | ~2s | **125 problemas** (123 errors, 2 warnings) - Ver deuda de lint abajo |
| `npm run build` (`tsc`) | ✅ **PASS** | <1s | Compila a `dist/` sin errores |

### App

| Comando | Resultado | Tiempo | Detalles |
|---------|-----------|--------|----------|
| `npm run typecheck` (`tsc --noEmit`) | ✅ **PASS** | <1s | Sin errores de tipos |
| `npx expo-doctor` | ⚠️ **WARN** | ~5s | **1 check failed**: `expo` version mismatch (expected ~57.0.33, found 57.0.32) |

---

## 4. Deuda de Lint Existente (Backend)

**123 errors, 2 warnings** - No bloqueante para baseline, pero **control de regresión crítico**.

### Categorías principales:
| Regla | Cuenta | Archivos afectados |
|-------|--------|-------------------|
| `@typescript-eslint/no-unsafe-assignment` | ~40 | academic-task.service, auth.service, tasks.service, etc. |
| `@typescript-eslint/no-unsafe-member-access` | ~20 | academic-task.service, tasks.service, reviews.service |
| `@typescript-eslint/no-unsafe-return` | ~15 | Múltiples services |
| `@typescript-eslint/no-unsafe-argument` | ~10 | academic-task.service, ai.service |
| `@typescript-eslint/no-unnecessary-type-assertion` | 2 | academic-task.controller, task.controller |
| `@typescript-eslint/restrict-template-expressions` | 3 | ai.service |
| `no-console` (warnings) | 2 | server.ts |

### Archivos con más errores:
1. `backend/src/modules/academic/academic-task.service.ts` - ~25 errores
2. `backend/src/modules/tasks/task.service.ts` - ~15 errores
3. `backend/src/modules/auth/auth.service.ts` - ~12 errores
4. `backend/src/modules/reviews/review.service.ts` - ~10 errores

**Control de regresión:** El workflow CI actual **NO ejecuta lint** en backend. Se recomienda añadir paso de lint en CI con `continue-on-error: true` para detectar regresiones sin bloquear por deuda existente.

---

## 5. Workflows CI/CD Revisados y Ajustados

### `.github/workflows/ci.yml` (Actual)
- ✅ Triggers correctos: `push` y `pull_request` a `master`/`main`
- ✅ Backend: `npm ci` → `typecheck` → `tests`
- ✅ App: `npm ci --legacy-peer-deps` → `expo-doctor` → `typecheck`
- ⚠️ **Falta:** Lint en backend (deuda conocida)
- ⚠️ **Falta:** Build en backend (verificar que `tsc` compila)
- ⚠️ **Falta:** Tests de integración / migración / aislamiento

### `.github/workflows/build-apk.yml` (Actual)
- ✅ Triggers: `workflow_dispatch` + `push` tags `v*`
- ✅ Java 17 (Temurin), Gradle cache
- ✅ `expo-doctor` antes de compilar
- ✅ Publica APK como Release asset
- ⚠️ **Endurecimiento necesario:** Publicación futura debe depender de build validado con configuración esperada

### Ajustes Recomendados (Documentados - Sin Commits)

#### A. CI: Añadir lint y build a backend
```yaml
# En job backend, después de tests:
- name: Lint (no bloqueante por deuda)
  run: npm run lint
  continue-on-error: true

- name: Build
  run: npm run build
```

#### B. CI: Añadir job de migración limpia
```yaml
migration-clean:
  name: Migration Clean
  runs-on: ubuntu-24.04
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_DB: productivity_test
        POSTGRES_USER: test_user
        POSTGRES_PASSWORD: test_password
      ports: [5432:5432]
      options: --health-cmd="pg_isready" --health-interval=5s --health-timeout=5s --health-retries=10
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
        cache-dependency-path: backend/package-lock.json
    - run: npm ci
      working-directory: backend
    - name: Run migrations
      run: |
        # Aplicar 001, 002, 003 en orden
        psql -h localhost -U test_user -d productivity_test -f src/database/migrations/001_initial_schema.sql
        psql -h localhost -U test_user -d productivity_test -f src/database/migrations/002_push_tokens.sql
        psql -h localhost -U test_user -d productivity_test -f src/database/migrations/003_study_sessions.sql
      env:
        PGPASSWORD: test_password
    - name: Verify schema
      run: |
        psql -h localhost -U test_user -d productivity_test -c "\dt"
      env:
        PGPASSWORD: test_password
```

#### C. CI: Añadir job de aislamiento entre cuentas
```yaml
account-isolation:
  name: Account Isolation
  runs-on: ubuntu-24.04
  services:
    postgres: [...]
    redis: [...]
  steps:
    - uses: actions/checkout@v4
    - name: Run integration tests
      run: |
        docker-compose -f tests/integration/docker-compose.yml up -d
        # Esperar healthchecks
        cd backend && npm run test:integration  # Por implementar en T1-T5
      working-directory: .
```

#### D. Build APK: Endurecer para que publicación futura dependa de validación
```yaml
# En job apk, añadir validaciones previas obligatorias:
- name: Verify typecheck passed
  run: npx tsc --noEmit

- name: Verify expo-doctor clean
  run: npx expo-doctor

- name: Verify no unresolved lint errors (new only)
  run: |
    # Comparar con baseline conocido - solo fallar en NUEVOS errores
    npx eslint src --format json > lint-current.json
    # Lógica de comparación con baseline (implementar en T6b)

# Publicación SOLO si todo lo anterior pasa:
- name: Publish to Release
  if: success()  # Ya implícito, pero hacer explícito
  uses: softprops/action-gh-release@v2
  ...
```

---

## 6. Disponibilidad Android

| Herramienta | Disponible | Versión/Ubicación |
|-------------|------------|-------------------|
| `java` | ✅ | OpenJDK 25.0.4.1 (`/usr/bin/java`) |
| `adb` | ❌ | No en PATH |
| `emulator` | ❌ | No en PATH |
| `sdkmanager` | ❌ | No en PATH |
| `ANDROID_HOME` | ❌ | No configurado |

**Estado:** **Compilación Android local NO DISPONIBLE**
- El workflow `build-apk.yml` usa GitHub Actions (ubuntu-24.04 con `actions/setup-java` y Gradle) - **este SÍ funciona en CI**
- Para compilación local se requiere: Android SDK, `ANDROID_HOME`, `adb`, `emulator` en PATH
- **Pendiente documentado:** Instalar Android Studio / SDK command line tools si se necesita build local

---

## 7. Harness Común de Tests de Integración

Creado en `/tests/integration/` - **Listo para T6b** (equipos T1-T5).

### Estructura creada:
```
tests/integration/
├── README.md                    # Documentación de uso
├── docker-compose.yml           # PostgreSQL 16 + Redis 7 (healthchecks)
├── fixtures/
│   └── init-schema.sql          # Schema completo compatible con migraciones 001-003
├── helpers/
│   ├── api-client.ts            # Cliente API tipado (auth, tasks, events, academic, reviews, AI, push)
│   ├── db.ts                    # Pool PG, transacciones con rollback, truncate, seed helpers
│   └── auth.ts                  # createAuthenticatedTestUser, verifyAccountIsolation, multi-user
├── scenarios/                   # PLANTILLAS BASE (NO IMPLEMENTAR - para extender por T1-T5)
│   ├── migration-clean.test.ts
│   ├── migration-update.test.ts
│   ├── account-isolation.test.ts
│   ├── api-db-integration.test.ts
│   ├── oauth-failure.test.ts
│   ├── academic-review-failure.test.ts
│   ├── session-change.test.ts
│   └── push-failure.test.ts
├── setup.ts                     # globalSetup para vitest
└── teardown.ts                  # globalTeardown para vitest
```

### Infraestructura docker-compose:
- **PostgreSQL 16-alpine** - Puerto 5432, DB `productivity_test`, user `test_user`
- **Redis 7-alpine** - Puerto 6379
- Healthchecks configurados
- Volúmenes persistentes
- Schema auto-inicializado via `fixtures/init-schema.sql`

### Uso para T1-T5:
```bash
# 1. Levantar infraestructura
docker-compose -f tests/integration/docker-compose.yml up -d

# 2. Ejecutar tests (cuando T1-T5 implementen test:integration)
cd backend && npm run test:integration
cd app && npm run test:integration

# 3. Bajar infraestructura
docker-compose -f tests/integration/docker-compose.yml down
```

---

## 8. Resumen de Comandos Ejecutados y Tiempos

| Paso | Comando | Directorio | Tiempo | Estado |
|------|---------|------------|--------|--------|
| 1 | `node -v && npm -v` | root | <1s | ✅ |
| 2 | `npm ci` | backend | 4s | ✅ |
| 3 | `npm ci --legacy-peer-deps` | app | 8s | ✅ |
| 4 | `npm run typecheck` | backend | <1s | ✅ |
| 5 | `npm test` | backend | 226ms | ✅ (21/21) |
| 6 | `npm run lint` | backend | ~2s | ❌ 125 problemas |
| 7 | `npm run build` | backend | <1s | ✅ |
| 8 | `npm run typecheck` | app | <1s | ✅ |
| 9 | `npx expo-doctor` | app | ~5s | ⚠️ 1 warn (expo version) |
| 10 | `java -version` | root | <1s | ✅ |
| 11 | `which adb/emulator/sdkmanager` | root | <1s | ❌ No disponibles |
| 12 | Crear harness integración | tests/integration | ~30s | ✅ |

---

## 9. Próximos Pasos para T6b (Validación Integrada)

1. **Implementar `test:integration` scripts** en `backend/package.json` y `app/package.json` usando vitest con `globalSetup`/`globalTeardown`
2. **Extender plantillas** en `tests/integration/scenarios/` por cada equipo T1-T5
3. **Añadir jobs de CI** para migración limpia, actualización, aislamiento, API/DB
4. **Endurecer `build-apk.yml`** con validaciones previas obligatorias
5. **Baseline de lint:** Capturar snapshot actual de 123 errors para detectar solo regresiones
6. **Documentar instalación Android local** si algún equipo lo necesita

---

## 10. Archivos Modificados/Creados (Solo QA/Harness/Docs)

### Creados (Nuevos - Solo para QA):
- `tests/integration/README.md`
- `tests/integration/docker-compose.yml`
- `tests/integration/fixtures/init-schema.sql`
- `tests/integration/helpers/api-client.ts`
- `tests/integration/helpers/db.ts`
- `tests/integration/helpers/auth.ts`
- `tests/integration/scenarios/migration-clean.test.ts`
- `tests/integration/scenarios/migration-update.test.ts`
- `tests/integration/scenarios/account-isolation.test.ts`
- `tests/integration/scenarios/api-db-integration.test.ts`
- `tests/integration/scenarios/oauth-failure.test.ts`
- `tests/integration/scenarios/academic-review-failure.test.ts`
- `tests/integration/scenarios/session-change.test.ts`
- `tests/integration/scenarios/push-failure.test.ts`
- `tests/integration/setup.ts`
- `tests/integration/teardown.ts`
- `QA_BASELINE_REPORT.md` (este informe)

### Sin cambios en código de app/backend:
- ❌ No se modificaron `package.json`, `tsconfig.json`, código fuente
- ❌ No se tocaron credenciales, secrets, `.env`
- ❌ No se hicieron commits

---

**Firma:** QA Baseline T6a completado. Entorno preparado, baseline medido, harness listo para T6b.