# P1: búsqueda y paginación de tareas

## Ejecutar

Desde `app/`, después de `npm ci --ignore-scripts --no-audit --no-fund`:

```sh
npx tsc --noEmit
node --test src/__tests__/tasks.test.cjs
```

No existe script `npm test` ni suite móvil en package.json. Esta suite mínima usa
Node test, el compilador TypeScript instalado y Zustand real. Compila el store
en memoria y sustituye únicamente el servicio HTTP, el store de identidad y los
relojes. No requiere modificar package.json ni instalar dependencias nuevas.
No monta React Native: queda pendiente la comprobación visual en dispositivo.

## Cambios

- `app/src/store/useTaskStore.ts`: debounce de 300 ms, invalidación inmediata al
  escribir, generaciones de listado/detalle y época de sesión, limpieza automática
  al cambiar usuario, filtros equivalentes sin recarga, páginas secuenciales de
  20 resultados, deduplicación por ID, fin por total o página vacía y reintento de
  la página fallida. Conserva filas durante el refresco y aplica completado
  optimista con bloqueo de taps duplicados, rollback y reconciliación del filtro.
- `app/src/screens/TasksScreen.tsx`: selectores específicos de Zustand, búsqueda
  conectada al debounce, onEndReached, pull-to-refresh y pie de carga/error.
- `app/src/__tests__/tasks.test.cjs`: diez regresiones con respuestas controladas.
- `app/src/__tests__/README.md`: instrucciones y resultado de verificación.

El contrato existente del servicio ya proporciona total, page y limit; no fue
necesario modificarlo. Las peticiones obsoletas se invalidan por generación,
no se aborta el transporte. La paginación sigue el contrato de offsets del servidor;
no promete un snapshot consistente ante inserciones concurrentes del backend.

## Verificación real (2026-11-20)

`npm ci --ignore-scripts --no-audit --no-fund`: exit 0, `added 517 packages in 17s`.

`npx tsc --noEmit`: exit 0, sin salida.

`node --test src/__tests__/tasks.test.cjs`: exit 0; resumen TAP final:

```text
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 563.599754
```

Cobertura: debounce y filtros redundantes; éxitos/errores fuera de orden;
paginación concurrente y filas duplicadas; refresco sin vaciar filas; fin por página
vacía; cambio de cuenta con listado/detalle/mutación/timer pendientes; completado
optimista y rollback; reintento de página; independencia de carga del detalle;
invalidación antes de vencer el debounce; completado tardío de otra cuenta.

Métrica: cinco cambios de texto separados por 40 ms producen una petición al
vencer 300 ms desde el último cambio (antes: una por cada carácter según el flujo
original, cinco peticiones; después: una medida en el test, reducción del 80%).

Sin commits ni push. Consultada la documentación exigida por app/AGENTS.md:
https://docs.expo.dev/versions/v57.0.0/.
