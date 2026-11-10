# T-003 · Antigravity · Auditoría UX/UI mobile

**Estado:** ENTREGADA · **VERIFICADA** por OpenCode (12/12 con evidencia reproducible)
**Ejecución:** `agy -p <misión> --mode plan --output-format json` · 390.5 s · 1 turno · exit 0
**Worktree:** `abalone-wt/antigravity-mobile-ux` (rama `agent/antigravity-mobile-ux`) · solo lectura
**Salida cruda:** `/tmp/opencode/reports/T-003-agy.json`

## Resultado del contraste

| # | Hallazgo | Severidad | Veredicto de OpenCode |
|---|---|---|---|
| 1 | Spinner perpetuo al terminar el último repaso | critica | ✔ VERIFICADO |
| 2 | Spinner perpetuo ante error de carga en 3 pantallas de detalle | critica | ✔ VERIFICADO |
| 3 | Pérdida de datos al retroceder en los 3 formularios | alta | ✔ VERIFICADO |
| 4 | Error de red se muestra como "sin tareas" | alta | ✔ VERIFICADO |
| 5 | Home sin indicador de carga ni refresco | alta | ✔ VERIFICADO |
| 6 | Teclado tapa controles en Login/Recuperar | alta | ✔ VERIFICADO |
| 7 | Checkbox 22×22 sin `hitSlop` ni rol accesible | media | ✔ VERIFICADO |
| 8 | `ErrorBoundary` con colores fijos y textos en español | media | ✔ VERIFICADO |
| 9 | Día actual sin borde visible en calendario | media | ✔ VERIFICADO |
| 10 | Flechas de navegación sin etiqueta accesible | media | ✔ VERIFICADO |
| 11 | Contraste 2.15:1 en insignia "medium" | baja | ✔ VERIFICADO (cálculo propio) |
| 12 | Botón eliminar material ~24×24 sin etiqueta | baja | ✔ VERIFICADO |

**Ningún hallazgo rechazado en esta ronda.** El agente no inventó rutas: todas las citas
`ruta:línea` existen y el código coincide con lo descrito.

## Evidencia propia (no la del agente)

### 1. Spinner perpetuo en ReviewDetail — confirmado por tres piezas
- `ReviewDetailScreen.tsx:41` → `const currentTask = dueReviews.find((t) => t.id === taskId);`
- `ReviewDetailScreen.tsx:72` → `if (isLoading || !currentTask) return <ActivityIndicator/>`
- `useReviewStore.ts:41-43` → `loadDueReviews` hace `set({ dueReviews })` con la respuesta del servidor.
- `RootNavigator.tsx:68` → `option={{ headerShown: false }}` para `ReviewDetail`.

Al calificar el último repaso: `dueReviews` vuelve vacío → `currentTask` indefinido → spinner sin
salida. `navigation.replace` solo ocurre si existe `nextTask` (`:60-63`), que es `undefined`.
No hay cabecera con retroceso fuera del condicional. **Crítica real.**

### 2. Error de carga = spinner perpetuo en tres detalles
`TaskDetailScreen.tsx:66`, `EventDetailScreen.tsx:51`, `AcademicTaskDetailScreen.tsx:81`
repiten el patrón `isLoading || !entidad`. Los stores usan `catch { set({ error, isLoading: false }) }`
(`useTaskStore.ts:50-51`), por lo que ante un fallo de red `isLoading` pasa a `false` y la entidad
sigue `null` → el guard nunca deja de cumplirse.

### 3. Pérdida de datos en formularios
`beforeRemove` **no aparece en ningún archivo** de `app/src` (`grep -rn beforeRemove .` → 0 resultados).
Los tres formularios hacen `navigation.goBack()` directo: `TaskFormScreen.tsx:112`,
`EventFormScreen.tsx:135`, `AcademicTaskFormScreen.tsx:76`.

### 4. Error de red enmascarado como lista vacía
`TasksScreen.tsx:34` desestructura `{ tasks, isLoading, filters, setFilters, loadTasks, completeTask }`
— **sin `error`**, aunque `useTaskStore.ts:17` lo declara y `:51` lo escribe. `ListEmptyComponent`
muestra "No tasks found" sin distinguir fallo de ausencia de datos.

### 5. Home sin estados de carga
`grep -n "isLoading\|RefreshControl" HomeScreen.tsx` → **0 coincidencias**. Todas las secciones están
condicionadas a que existan datos, así que una carga inicial o un fallo dejan la pantalla casi vacía.

### 6. Teclado
`LoginScreen.tsx` usa `KeyboardAvoidingView` (`:55`) con `styles.content { flex: 1, justifyContent: 'center' }`
y **ningún `ScrollView`** en el archivo. En pantalla compacta o con texto escalado, el teclado deja
"Forgot Password?" y "Sign In" fuera de alcance.

### 9. Borde del día actual — bug real de React Native
`CalendarGrid.tsx:107` aplica `{ borderColor: colors.primary }` y `styles.dayCell` (`:167-173`) no
define `borderWidth`. En RN, `borderColor` sin `borderWidth` dibuja trazo de grosor 0 → invisible.
Este es el hallazgo más preciso técnicamente de todo el informe.

### 11. Contraste — verificado con cálculo, no con la afirmación del agente
`#F59E0B` sobre `theme/colors.ts` `background: '#F8F9FA'` → luminancia relativa ≈ 0.437 →
ratio ≈ **2.15:1**, muy por debajo del 4.5:1 de WCAG AA para texto normal. Confirmado.

## Plan de corrección derivado (para la ronda de implementación)

**Bloque A — navegación y estados (crítico, mismo patrón en 4 pantallas)**
`ReviewDetailScreen`, `TaskDetailScreen`, `EventDetailScreen`, `AcademicTaskDetailScreen`:
extraer la cabecera con retroceso fuera del guard y añadir estado de error con reintento.

**Bloque B — pérdida de datos (3 formularios)**
Interceptor `beforeRemove` compartido en `TaskFormScreen`, `EventFormScreen`, `AcademicTaskFormScreen`.

**Bloque C — error vs vacío (2 pantallas)**
`TasksScreen` y `AcademicScreen`: consumir `error` del store y ofrecer reintento.

**Bloque D — accesibilidad táctil (4 puntos)**
`TaskCard` checkbox, flechas de `CalendarScreen`, botón eliminar de `AcademicTaskFormScreen`,
y `borderWidth` en `CalendarGrid`.

**Bloque E — coherencia visual (2 puntos)**
`ErrorBoundary` con tokens del tema e idioma consistente; contraste de insignias de prioridad.

## Observación de OpenCode

El informe de Antigravity es el de mayor calidad de la ronda: cita líneas correctas, distingue
síntoma de causa y no propone rediseños innecesarios. Sirve como referencia de formato para
futuras misiones de UX.
