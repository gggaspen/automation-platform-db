# 📋 Tarea 5.1.6: Procedimiento de Migración en Desarrollo

**Fecha de creación:** 2025-12-02
**Estado:** DOCUMENTADO - Listo para ejecución
**Migración:** `20251202020032_update_user_schema_final`
**Objetivo:** Eliminar campos deprecated `passwordHash` y `emailVerified` del modelo `User`

---

## 🎯 Objetivo de la Migración

Completar la limpieza del schema eliminando los campos deprecated del modelo `User`:
- `passwordHash` (VARCHAR) - Ahora manejado por Authorizer
- `emailVerified` (BOOLEAN) - Ahora manejado por Authorizer via `email_verified_at`

La migración también:
- Establece `authorizerId` como NOT NULL
- Cambia el default de `status` a 'ACTIVE'

---

## ✅ Pre-requisitos

Antes de ejecutar la migración, verificar:

- [x] Tareas 5.1.1 a 5.1.5 completadas (verificación de código, deprecation logs)
- [x] Backup de base de datos creado (Fase 0 completada)
- [x] No existen referencias a `passwordHash` o `emailVerified` en el código
- [x] Middleware de deprecation removido
- [x] Seed actualizado para no usar campos deprecated
- [ ] Docker Compose corriendo (PostgreSQL + Redis)
- [ ] Conexión a base de datos verificada
- [ ] Prisma CLI instalado (`npm install`)

---

## 🚀 Procedimiento de Ejecución

### Paso 1: Preparar Ambiente de Desarrollo

```bash
# 1. Navegar al directorio del submodule
cd /home/gggaspen/DOCUMENTOS_LINUX/___COBA/automation-platform-db

# 2. Verificar que estamos en el repo correcto
git remote -v
# Debe mostrar: https://github.com/gggaspen/automation-platform-db.git

# 3. Levantar servicios Docker (PostgreSQL, Redis, pgAdmin)
docker compose up -d

# 4. Verificar que los servicios estén corriendo
docker ps --filter "name=automation-platform"
# Debe mostrar:
# - automation-platform-postgres (puerto 5433:5432)
# - automation-platform-redis (puerto 6379:6379)
# - automation-platform-pgadmin (puerto 5050:80)

# 5. Esperar a que PostgreSQL esté listo (health check)
docker logs automation-platform-postgres | grep "database system is ready to accept connections"
```

### Paso 2: Verificar Estado Actual de Migraciones

```bash
# 1. Instalar dependencias si es necesario
npm install

# 2. Verificar estado de migraciones de Prisma
npx prisma migrate status

# Salida esperada:
# Database schema is up to date!
#
# The following migrations are applied:
#   20251202014452_initial_schema_with_authorizer_id
#   20251202020032_update_user_schema_final  <-- Esta migración

# Si la migración NO está aplicada, verás:
# Your database is 1 migration(s) behind.
```

### Paso 3: Backup Pre-Migración

**⚠️ CRÍTICO:** Siempre hacer backup antes de ejecutar migraciones

```bash
# Backup completo de la base de datos
BACKUP_FILE="backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"

docker exec automation-platform-postgres pg_dump \
  -U postgres \
  -d automation_platform_dev \
  --clean \
  --if-exists \
  > "./backups/${BACKUP_FILE}"

# Verificar que el backup se creó correctamente
ls -lh "./backups/${BACKUP_FILE}"

# Comprimir backup para ahorrar espacio
gzip "./backups/${BACKUP_FILE}"
```

### Paso 4: Ejecutar Migración

```bash
# Ejecutar migraciones pendientes
npx prisma migrate deploy

# Salida esperada si la migración ya está aplicada:
# All migrations have been applied.

# Salida esperada si la migración NO está aplicada:
# The following migrations have been applied:
#   20251202020032_update_user_schema_final
#
# All migrations have been successfully applied.
```

**Si la migración falla:**

```bash
# Ver logs detallados del error
npx prisma migrate status --verbose

# Restaurar desde backup
docker exec -i automation-platform-postgres psql \
  -U postgres \
  -d automation_platform_dev \
  < "./backups/${BACKUP_FILE}"

# Reportar error en GitHub Issues o documento de integración
```

### Paso 5: Validar Migración Exitosa

#### 5.1 Verificar Schema en Base de Datos

```bash
# Conectar a PostgreSQL via psql
docker exec -it automation-platform-postgres psql \
  -U postgres \
  -d automation_platform_dev

# Ejecutar queries de validación:
```

```sql
-- 1. Verificar estructura de tabla users
\d users;

-- Salida esperada:
--   Column        |  Type   | Nullable | Default
-- ----------------+---------+----------+----------
--  id            | text    | not null |
--  authorizerId  | text    | not null | <-- NOT NULL ✅
--  email         | text    | not null |
--  firstName     | text    | null     |
--  lastName      | text    | null     |
--  role          | "UserRole" | not null | 'USER'
--  status        | "UserStatus" | not null | 'ACTIVE' <-- Default cambiado ✅
--  clientId      | text    | null     |
--  createdAt     | timestamp(3) | not null | CURRENT_TIMESTAMP
--  updatedAt     | timestamp(3) | not null |
--  lastLoginAt   | timestamp(3) | null     |
--
-- ❌ NO DEBE APARECER: passwordHash, emailVerified

-- 2. Verificar índices
\di users*;

-- Salida esperada:
--  users_pkey                  | users (id)
--  users_authorizerId_key      | users (authorizerId) UNIQUE
--  users_email_key             | users (email) UNIQUE

-- 3. Verificar que no existen columnas deprecated
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('passwordHash', 'emailVerified');

-- Salida esperada: (0 rows) ✅

-- 4. Salir de psql
\q
```

#### 5.2 Verificar Datos de Usuarios

```bash
# Conectar nuevamente a PostgreSQL
docker exec -it automation-platform-postgres psql \
  -U postgres \
  -d automation_platform_dev
```

```sql
-- Ver todos los usuarios (debe haber al menos 1 del seed)
SELECT id, email, "authorizerId", role, status, "createdAt"
FROM users
ORDER BY "createdAt" DESC;

-- Salida esperada:
--  id  | email             | authorizerId          | role  | status | createdAt
-- -----+-------------------+-----------------------+-------+--------+----------
--  ... | admin@demo.com    | auth-user-demo-001    | ADMIN | ACTIVE | 2025-12-02...

-- Verificar que authorizerId NO es NULL para ningún usuario
SELECT COUNT(*) as total_users,
       COUNT("authorizerId") as users_with_authorizer_id,
       COUNT(*) - COUNT("authorizerId") as users_without_authorizer_id
FROM users;

-- Salida esperada:
--  total_users | users_with_authorizer_id | users_without_authorizer_id
-- -------------+--------------------------+-----------------------------
--      1       |            1             |              0              ✅

-- Salir de psql
\q
```

#### 5.3 Validar con Prisma Studio

```bash
# Abrir Prisma Studio (GUI)
npx prisma studio

# Se abrirá en http://localhost:5555
#
# Verificar:
# 1. Tabla "users" existe
# 2. Columnas "passwordHash" y "emailVerified" NO existen
# 3. Columna "authorizerId" tiene valores (no NULL)
# 4. Campo "status" tiene default 'ACTIVE'
```

#### 5.4 Validar con Tests Unitarios

```bash
# Ejecutar tests del proyecto
npm test

# Salida esperada:
# PASS src/tests/user.test.ts
# PASS src/tests/client.test.ts
# ...
# Tests: X passed, X total

# Si hay tests fallando relacionados con passwordHash/emailVerified:
# ❌ REPORTAR INMEDIATAMENTE - código aún usa campos deprecated
```

### Paso 6: Generar Prisma Client

```bash
# Regenerar Prisma Client con nuevo schema
npx prisma generate

# Salida esperada:
# ✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

### Paso 7: Validar en Aplicación

```bash
# Ejecutar seed para verificar que funciona con nuevo schema
npm run db:seed

# Salida esperada:
# ✅ Seed completed successfully
# Created 1 client
# Created 1 user (admin@demo.com)
# Created 2 ad accounts
# Created 3 workflows

# Verificar logs para errores relacionados con campos deprecated
# No debe haber referencias a passwordHash o emailVerified
```

---

## 📊 Checklist de Validación Post-Migración

Marcar cada ítem después de validar:

### Schema

- [ ] Tabla `users` existe
- [ ] Columna `passwordHash` NO existe
- [ ] Columna `emailVerified` NO existe
- [ ] Columna `authorizerId` existe y es NOT NULL
- [ ] Default de `status` es 'ACTIVE'
- [ ] Todos los índices existen correctamente

### Datos

- [ ] Todos los usuarios existentes tienen `authorizerId` no NULL
- [ ] No hay usuarios huérfanos (sin `authorizerId`)
- [ ] Relaciones con `clients` intactas
- [ ] Relaciones con `workflows` intactas
- [ ] Datos del seed se crearon correctamente

### Aplicación

- [ ] Prisma Client regenerado exitosamente
- [ ] Tests unitarios pasan (npm test)
- [ ] Seed funciona sin errores (npm run db:seed)
- [ ] No hay logs de errores relacionados con campos deprecated
- [ ] Prisma Studio muestra schema correcto

### Backup & Rollback

- [ ] Backup pre-migración creado y comprimido
- [ ] Procedimiento de rollback documentado y probado (ver PRODUCTION_ROLLBACK_PLAN.md)
- [ ] Backup almacenado en ubicación segura

---

## 🔄 Procedimiento de Rollback (Si es necesario)

**⚠️ Solo usar si la migración falla o causa problemas críticos**

```bash
# 1. Detener aplicaciones que usan la base de datos
docker compose down

# 2. Restaurar desde backup
BACKUP_FILE="backup_pre_migration_YYYYMMDD_HHMMSS.sql.gz"

gunzip -c "./backups/${BACKUP_FILE}" | \
docker exec -i automation-platform-postgres psql \
  -U postgres \
  -d automation_platform_dev

# 3. Verificar restauración
docker exec -it automation-platform-postgres psql \
  -U postgres \
  -d automation_platform_dev \
  -c "\d users;"

# Debe mostrar columnas passwordHash y emailVerified

# 4. Actualizar estado de migraciones en Prisma
npx prisma migrate resolve --rolled-back 20251202020032_update_user_schema_final

# 5. Levantar servicios nuevamente
docker compose up -d

# 6. REPORTAR PROBLEMA en GitHub Issues con logs completos
```

---

## 📝 Documentar Resultados

Después de ejecutar la migración, documentar en el archivo principal `relations-authorizer-automation-platform-db.md`:

```markdown
- [x] 5.1.6 Ejecutar migración en desarrollo y validar

#### 📋 Implementación Completada (FECHA)

**Migración ejecutada:** `20251202020032_update_user_schema_final`

**Resultados:**
- ✅ Migración aplicada exitosamente
- ✅ Columnas `passwordHash` y `emailVerified` eliminadas
- ✅ Campo `authorizerId` ahora NOT NULL
- ✅ Default de `status` cambiado a 'ACTIVE'
- ✅ Tests unitarios pasan
- ✅ Seed funciona correctamente
- ✅ Backup creado: `backup_pre_migration_FECHA.sql.gz`

**Próximos pasos:** Ejecutar en staging (tarea 5.1.7)
```

---

## 📞 Contactos en Caso de Problemas

- **GitHub Issues:** https://github.com/gggaspen/automation-platform-db/issues
- **Documentación:** `/home/gggaspen/DOCUMENTOS_LINUX/___COBA/relations-authorizer-automation-platform-db.md`
- **Rollback Plan:** `./docs/deployment/PRODUCTION_ROLLBACK_PLAN.md`

---

## 📚 Referencias

- Migración SQL: `./prisma/migrations/20251202020032_update_user_schema_final/migration.sql`
- Schema Prisma: `./prisma/schema.prisma`
- Seed: `./prisma/seeds/dev-seed.ts`
- Docker Compose: `./docker-compose.yml`

---

**Documento creado:** 2025-12-02
**Versión:** 1.0
**Autor:** Claude Code AI Assistant
