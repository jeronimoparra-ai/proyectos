# Release checks — APK firmado (productivity-app)

Documento informativo. No modifica la app ni el backend. Rama de referencia: `master`.

## 1) Disparar el build firmado en GitHub Actions

`.github/workflows/build-apk.yml` (workflow_dispatch, o push de tag `v*`) ejecuta primero
un gate de validación (`validate`: typecheck y tests backend, lint con regresión guard,
expo-doctor no bloqueante, build backend). Si falla, no se compila el APK.

```bash
gh workflow run build-apk.yml --ref master
```

Secrets requeridos (Settings → Secrets and variables → Actions):

- `RELEASE_KEYSTORE_BASE64` — keystore en base64 (`base64 -w0 release.keystore`)
- `RELEASE_KEYSTORE_PASSWORD` — contraseña del store y de la key

**Sin estos secrets el workflow falla**: no se publica un APK sin firmar en la Release
oficial. También conviene `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y
`EXPO_PUBLIC_API_URL`; si faltan, la app abre en pantalla «Configuración incompleta».
El asset resultante se publica como `productivity-app.apk` en la Release `apk-latest`
(`.../releases/download/apk-latest/productivity-app.apk`), que se reescribe en cada build.

## 2) Instalar en un móvil desde esta máquina

Requisitos: `adb` en PATH, depuración USB activada y equipo autorizado.

```bash
adb devices                                   # dispositivo listado como "device"
wget -O productivity-app.apk \
  https://github.com/jeronimoparra-ai/proyectos/releases/download/apk-latest/productivity-app.apk
adb install -r productivity-app.apk           # -r reinstala conservando datos
```

Si falla por firma distinta (INSTALL_FAILED_UPDATE_INCOMPATIBLE):
`adb uninstall com.jerodev.productivityapp` (borra datos locales).

## 3) Verificación

```bash
apksigner verify -v productivity-app.apk      # debe mostrar "Verifies" (esquema v2/v3)
adb shell pm list packages | grep productividad
```

El `applicationId` real es `com.jerodev.productivityapp` (app.json); el grep en español
puede no coincidir — usar `grep -i productivity` o `grep jerodev`. Comprobar que la app abre y llega al login.

### Trampas ya resueltas en el workflow (no reintroducir)

- `app/android/gradle.properties` lo genera `expo prebuild` **sin salto de línea final**.
  Al inyectar las propiedades `RELEASE_*` hay que empezar con `\n`, o la última propiedad
  (`expo.inlineModules.watchedDirectories=[]`) queda concatenada y el autolinking de Expo
  muere con `Process 'command 'node'' finished with non-zero exit value 1`.
- Gradle no expone las propiedades personalizadas como variables: en `build.gradle` hay
  que usar `findProperty('RELEASE_STORE_FILE')`, no `RELEASE_STORE_FILE`.
- El bloque `signingConfigs.release` debe insertarse **dentro** del `signingConfigs`
  existente (no crear un segundo bloque) y `buildTypes.release` debe apuntar a él.

## 4) Riesgos residuales documentados

- Los integration tests (`tests/integration`, docker-compose + Postgres) solo corren en CI;
  en local requieren `npm run test:integration` manual.
- Google OAuth y la instalación/uso del APK real necesitan dispositivo físico: el CI/emulador no valida redirect URIs, keystore ni permisos reales.
- APK firmado ≠ regresión completa en device: validar manualmente login, calendario (T3) y reminders (T5).
- Sin EXPO_PUBLIC_* el APK se publica igualmente con pantalla de configuración incompleta.
- Lint backend congelado con regresión guard (191 errores + 5 warnings de baseline); no es deuda resuelta.
- expo-doctor no bloqueante (mismatch expo 57.0.32 vs ~57.0.33).
- La keystore vive solo en secrets de CI; perderla impide actualizar la app instalada.

Notas: no commitear el `.apk`, la keystore ni contraseñas al repo. Cambios en workflows o firma requieren su propio proceso.
