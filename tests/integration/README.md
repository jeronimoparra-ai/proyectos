# Harness Común de Tests de Integración

Este directorio contiene la estructura reutilizable para tests de integración que usarán los equipos T1-T5.

## Estructura

```
tests/integration/
├── fixtures/           # Datos de prueba reutilizables
├── docker-compose.yml  # Infraestructura de prueba (PostgreSQL, Redis, Supabase local)
├── setup.ts           # Configuración global de tests
├── teardown.ts        # Limpieza global
├── helpers/           # Utilidades compartidas
│   ├── api-client.ts  # Cliente API tipado para tests
│   ├── db.ts          # Helpers de base de datos
│   └── auth.ts        # Helpers de autenticación
└── scenarios/         # Escenarios base (no implementar casos específicos T1-T5)
    ├── migration-clean.test.ts
    ├── migration-update.test.ts
    ├── account-isolation.test.ts
    ├── api-db-integration.test.ts
    ├── oauth-failure.test.ts
    ├── academic-review-failure.test.ts
    ├── session-change.test.ts
    └── push-failure.test.ts
```

## Uso

Los equipos T1-T5 deben:
1. Extender `setup.ts` y `teardown.ts` para su configuración específica
2. Usar `fixtures/` para datos de prueba consistentes
3. Ejecutar tests contra `docker-compose.yml` para aislamiento
4. NO implementar los casos específicos en `scenarios/` - esos son plantillas base

## Infraestructura Requerida

- PostgreSQL (Supabase local o pgvector)
- Redis (para rate limiting, cache)
- Node.js 20+
- npm 10+

## Ejecución

```bash
# Levantar infraestructura
docker-compose -f tests/integration/docker-compose.yml up -d

# Ejecutar tests de integración
cd backend && npm run test:integration  # por definir
cd app && npm run test:integration      # por definir

# Bajar infraestructura
docker-compose -f tests/integration/docker-compose.yml down
```