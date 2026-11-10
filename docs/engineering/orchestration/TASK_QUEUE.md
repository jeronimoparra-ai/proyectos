# TASK_QUEUE — Cola de misiones

Estados: `PENDIENTE` · `EN_CURSO` · `ENTREGADA` · `VERIFICADA` · `RECHAZADA`
Regla: una tarea pasa a `VERIFICADA` solo con artefactos comprobados por OpenCode.

## Ronda 1 — Auditoría triple en paralelo (solo lectura)

| ID | Agente | Rol | Alcance | Estado |
|---|---|---|---|---|
| T-001 | FCC Claude | Auditoría técnica backend | `backend/src/**` (TypeScript, auth, Google OAuth, módulo AI) | TIMEOUT 900 s |
| T-002 | Hermes Agent | Auditoría independiente cruzada | `backend/src/**` + `app/src/services` (sin ver el informe de T-001) | TIMEOUT 900 s |
| T-003 | Antigravity | Auditoría UX/UI mobile | `app/src/screens/**`, `app/src/components/**`, `app/src/theme` | VERIFICADA |
| T-001K | Kilo (respaldo de T-001) | Auditoría técnica backend | mismo alcance que T-001 | EN_CURSO |
| T-002K | Kilo (respaldo de T-002) | Auditoría cruzada backend | mismo alcance que T-002 | EN_CURSO |

### Restricciones comunes Ronda 1
- **Solo lectura.** No se modifica ningún archivo del repositorio.
- No se ejecutan instalaciones ni migraciones.
- No se incluyen secretos ni contenido de `.env`.
- Cada hallazgo debe citar `ruta:línea` verificable.
- Prohibido reportar sin evidencia: si no se puede citar el código, se omite.

### Formato de entrega obligatorio
```
HALLAZGO: <título>
SEVERIDAD: critica|alta|media|baja
EVIDENCIA: <ruta:línea + fragmento>
IMPACTO: <qué se rompe y en qué escenario>
PROPUESTA: <cambio mínimo, archivos concretos>
RIESGO_DE_CAMBIO: bajo|medio|alto
```
Máximo 12 hallazgos, ordenados por severidad. Sin relleno.

## Ronda 2 — Pendiente de definir tras consolidar Ronda 1

## Carril de bajo consumo — Kiro CLI

Tareas mecánicas, acotadas y verificables por criterio objetivo. Se despachan a Kiro para no
gastar cuota de los agentes de razonamiento profundo. **Nunca** cierran una tarea por sí solas.

| ID | Tarea tipo | Modelo | Herramientas |
|---|---|---|---|
| K-001 | Inventario de endpoints del backend (método + ruta + archivo:línea) | `qwen3-coder-next` | `fs_read` |
| K-002 | Listado de `TODO`/`FIXME`/`console.log` con ubicación | `qwen3-coder-next` | `fs_read` |
| K-003 | Verificar que un cambio pedido existe realmente en el worktree de un agente | `qwen3-coder-next` | `fs_read` |
| K-004 | Extraer firmas y exports de `app/src/services` | `qwen3-coder-next` | `fs_read` |
| K-005 | Comprobar consistencia de imports/rutas rotas tras un refactor | `claude-haiku-4.5` | `fs_read,shell` |

### Contrato de tarea Kiro
```
TAREA: <una sola frase con criterio de éxito mecánico>
DIRECTORIO: <ruta absoluta>
ENTREGABLE: <lista|conteo|archivo|veredicto binario>
LIMITE: <n líneas máximo de salida>
PROHIBIDO: modificar archivos / instalar / ejecutar migraciones / leer .env
```
Regla de verificación: todo entregable de Kiro se contrasta con `grep`/`git diff` propio de OpenCode
antes de usarse. Si Kiro devuelve un dato que no se puede reproducir, se descarta.
