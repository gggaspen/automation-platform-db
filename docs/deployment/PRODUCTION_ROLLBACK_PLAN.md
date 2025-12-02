# 🔄 Tarea 5.1.8: Plan de Rollback para Producción

**Fecha de creación:** 2025-12-02
**Estado:** DOCUMENTADO - Aprobado para ejecución
**Severidad:** CRÍTICA - Operación en ambiente de producción
**Migración:** `20251202020032_update_user_schema_final`
**RTO (Recovery Time Objective):** < 15 minutos
**RPO (Recovery Point Objective):** < 1 minuto

---

## 🎯 Objetivo del Plan de Rollback

Proveer un procedimiento detallado, probado y confiable para **revertir la migración** `20251202020032_update_user_schema_final` en producción si se detectan problemas críticos que afecten:
- Disponibilidad del sistema (uptime < 99.9%)
- Integridad de datos (pérdida o corrupción de datos)
- Performance inaceptable (degradación > 50%)
- Funcionalidad crítica de autenticación

---

## 🚨 Triggers de Rollback (Cuándo Ejecutar)

### Triggers Automáticos (Rollback Inmediato)

Ejecutar rollback **INMEDIATAMENTE** si cualquiera de estos eventos ocurre:

| Trigger | Descripción | Acción |
|---------|-------------|--------|
| **Sistema Inaccesible** | Uptime < 95% por > 5 minutos | Rollback automático |
| **Error Rate Crítico** | > 10% de requests fallando por > 3 minutos | Rollback automático |
| **Pérdida de Datos** | Cualquier dato de usuario perdido o corrupto | Rollback inmediato + incident response |
| **Database Crash** | PostgreSQL no responde por > 2 minutos | Rollback + escalate to SRE |
| **Null authorizerId** | Cualquier usuario sin authorizerId detectado | Rollback inmediato |

### Triggers Manuales (Decisión del Equipo)

Considerar rollback si:

| Trigger | Descripción | Proceso de Decisión |
|---------|-------------|---------------------|
| **Degradación de Performance** | Latencia p95 > 1s sostenida por > 15 minutos | Lead Engineer aprueba rollback |
| **Error Rate Moderado** | 1-5% de requests fallando por > 10 minutos | Lead Engineer + DevOps Lead deciden |
| **Workflows Críticos Fallando** | > 20% de workflows fallando | Lead Engineer aprueba rollback |
| **Memory Leak Detectado** | Memory usage incrementando > 10% por minuto | DevOps Lead aprueba rollback |
| **Tickets de Soporte Masivos** | > 10 tickets en < 30 minutos por auth issues | Product Owner + Lead Engineer deciden |

---

## ⚙️ Pre-requisitos para Rollback

Antes de ejecutar rollback en producción:

### Checklist Técnico

- [x] Backup de producción creado y verificado (< 1 hora antes de migración)
- [x] Backup stored en múltiples ubicaciones (local + cloud)
- [x] Plan de rollback revisado y aprobado por equipo técnico
- [x] Scripts de rollback testeados en staging
- [x] Acceso de emergencia a producción configurado
- [x] Ventana de mantenimiento comunicada (si aplica)

### Checklist de Comunicación

- [ ] Stakeholders notificados de problema crítico
- [ ] Status page actualizado (https://status.example.com)
- [ ] Equipo de soporte notificado
- [ ] Customers críticos contactados directamente (enterprise clients)

### Checklist de Equipo

- [ ] Lead Engineer disponible
- [ ] DevOps Lead disponible
- [ ] Database Specialist disponible
- [ ] Product Owner informado
- [ ] Legal/Compliance informado (si hay pérdida de datos)

---

## 🔄 Procedimiento de Rollback - Paso a Paso

### FASE 1: Preparación (Tiempo estimado: 2 minutos)

#### Paso 1.1: Declarar Incidente

```bash
# 1. Notificar al equipo via Slack
slack-cli send --channel #production-incidents \
  --message "🚨 PRODUCTION ROLLBACK INITIATED - Migration 20251202020032_update_user_schema_final - Reason: [DESCRIBIR]"

# 2. Actualizar status page
curl -X POST https://api.statuspage.io/v1/pages/[PAGE_ID]/incidents \
  -H "Authorization: OAuth [TOKEN]" \
  -d '{
    "incident": {
      "name": "Database Maintenance - Authentication System",
      "status": "investigating",
      "impact": "major",
      "body": "We are investigating issues with authentication. Rollback in progress."
    }
  }'

# 3. Activar modo de mantenimiento (opcional, si uptime < 50%)
railway service:maintenance:enable --environment production
```

#### Paso 1.2: Verificar Backups

```bash
# Verificar que backup existe y es reciente
BACKUP_FILE="backup_prod_pre_migration_$(date +%Y%m%d)*.sql.gz"
ls -lh ./backups/${BACKUP_FILE}

# Verificar integridad del backup
gunzip -t ./backups/${BACKUP_FILE}
# Si falla: ABORT ROLLBACK - Backup corrupto

# Verificar tamaño del backup (debe ser > 100MB para producción)
SIZE=$(stat -f%z "./backups/${BACKUP_FILE}")
if [ $SIZE -lt 104857600 ]; then
  echo "ERROR: Backup too small - may be incomplete"
  exit 1
fi
```

#### Paso 1.3: Capturar Estado Actual

```bash
# Capturar snapshot del estado actual para análisis post-mortem
mkdir -p ./rollback-logs/$(date +%Y%m%d_%H%M%S)
ROLLBACK_DIR="./rollback-logs/$(date +%Y%m%d_%H%M%S)"

# 1. Database schema actual
pg_dump -h prod-db.railway.app -U user -d automation_platform_prod \
  --schema-only > "${ROLLBACK_DIR}/schema_before_rollback.sql"

# 2. Sample de datos actuales (últimos 100 usuarios)
psql -h prod-db.railway.app -U user -d automation_platform_prod \
  -c "SELECT * FROM users ORDER BY \"createdAt\" DESC LIMIT 100;" \
  > "${ROLLBACK_DIR}/users_sample_before_rollback.txt"

# 3. Logs de aplicación (últimas 1000 líneas)
railway logs --tail 1000 --environment production \
  > "${ROLLBACK_DIR}/app_logs_before_rollback.txt"

# 4. Métricas de performance actual
curl -s https://api-gateway-prod.railway.app/metrics \
  > "${ROLLBACK_DIR}/metrics_before_rollback.json"
```

### FASE 2: Ejecución de Rollback (Tiempo estimado: 5-8 minutos)

#### Paso 2.1: Poner Aplicación en Modo Maintenance

```bash
# 1. Escalar a 0 réplicas todas las aplicaciones que usan la DB
railway scale --replicas 0 --service api-gateway --environment production
railway scale --replicas 0 --service reports-client --environment production
railway scale --replicas 0 --service static-report-server --environment production

# Esperar 30 segundos para drenar conexiones activas
sleep 30

# 2. Verificar que no hay conexiones activas a la DB
psql -h prod-db.railway.app -U user -d automation_platform_prod -c "
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'automation_platform_prod'
  AND state = 'active'
  AND pid != pg_backend_pid();
"
# Si active_connections > 0: Esperar otros 30s, luego forzar terminación
```

#### Paso 2.2: Terminar Conexiones Forzadamente (Si es necesario)

```bash
# Solo si aún hay conexiones activas después de 60s
psql -h prod-db.railway.app -U user -d automation_platform_prod -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'automation_platform_prod'
  AND pid != pg_backend_pid()
  AND state = 'active';
"
```

#### Paso 2.3: Restaurar Backup

```bash
# 1. Descomprimir backup
BACKUP_FILE="backup_prod_pre_migration_[TIMESTAMP].sql.gz"
gunzip -c "./backups/${BACKUP_FILE}" > ./temp_restore.sql

# 2. Restaurar base de datos
echo "Starting database restore at $(date)"
psql -h prod-db.railway.app -U user -d automation_platform_prod \
  < ./temp_restore.sql \
  2>&1 | tee "${ROLLBACK_DIR}/restore_output.log"

# 3. Verificar que restauración completó sin errores críticos
if grep -i "ERROR" "${ROLLBACK_DIR}/restore_output.log" | grep -v "already exists"; then
  echo "❌ RESTORE FAILED - Check logs in ${ROLLBACK_DIR}/restore_output.log"
  # ESCALATE TO DATABASE SPECIALIST
  exit 1
fi

echo "✅ Database restore completed at $(date)"

# 4. Limpiar archivo temporal
rm ./temp_restore.sql
```

#### Paso 2.4: Revertr Estado de Migraciones en Prisma

```bash
# Marcar migración como rolled-back en Prisma
cd automation-platform-db

npx prisma migrate resolve \
  --rolled-back \
  20251202020032_update_user_schema_final

# Verificar estado de migraciones
npx prisma migrate status

# Salida esperada:
# Database schema is up to date!
# The following migrations are applied:
#   20251202014452_initial_schema_with_authorizer_id
# The following migrations were rolled back:
#   20251202020032_update_user_schema_final
```

### FASE 3: Validación Post-Rollback (Tiempo estimado: 3-5 minutos)

#### Paso 3.1: Verificar Schema Restaurado

```bash
psql -h prod-db.railway.app -U user -d automation_platform_prod
```

```sql
-- 1. Verificar que columnas deprecated EXISTEN nuevamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('passwordHash', 'emailVerified', 'authorizerId')
ORDER BY column_name;

-- Salida esperada:
--  column_name   | data_type | is_nullable
-- ---------------+-----------+-------------
--  authorizerId  | text      | YES          <-- Volvió a nullable ✅
--  emailVerified | boolean   | YES          <-- RESTAURADO ✅
--  passwordHash  | text      | YES          <-- RESTAURADO ✅

-- 2. Verificar conteo de usuarios
SELECT COUNT(*) as total_users FROM users;
-- Debe coincidir con conteo pre-migración

-- 3. Verificar relaciones intactas
SELECT COUNT(*) as users_with_clients
FROM users
WHERE "clientId" IS NOT NULL;

-- Debe coincidir con valores pre-migración

-- 4. Salir
\q
```

#### Paso 3.2: Regenerar Prisma Client

```bash
# Regenerar con schema anterior (que incluye campos deprecated)
cd automation-platform-db
npx prisma generate

# Verificar que generó correctamente
ls -la node_modules/@prisma/client/
```

#### Paso 3.3: Verificar Aplicación en Staging Primero

```bash
# Antes de levantar producción, verificar en staging que funciona con schema anterior
railway deploy --environment staging

# Esperar deployment
sleep 60

# Health check de staging
curl -s https://api-gateway-staging.railway.app/health | jq .
# Debe retornar: {"status": "ok", "database": "connected"}

# Test de autenticación en staging
curl -X POST https://api-gateway-staging.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}' | jq .
# Debe retornar access_token
```

### FASE 4: Restaurar Producción (Tiempo estimado: 2-3 minutos)

#### Paso 4.1: Desplegar Aplicaciones

```bash
# 1. Deploy de API Gateway
railway up --environment production --service api-gateway

# 2. Escalar de vuelta a configuración normal
railway scale --replicas 2 --service api-gateway --environment production

# 3. Esperar que pods estén healthy
sleep 45

# 4. Desplegar otros servicios
railway up --environment production --service reports-client
railway up --environment production --service static-report-server

# 5. Escalar
railway scale --replicas 2 --service reports-client --environment production
railway scale --replicas 1 --service static-report-server --environment production
```

#### Paso 4.2: Health Checks

```bash
# Health check de API Gateway
for i in {1..10}; do
  STATUS=$(curl -s https://api-gateway-prod.railway.app/health | jq -r '.status')
  echo "Attempt $i: $STATUS"
  if [ "$STATUS" == "ok" ]; then
    echo "✅ API Gateway is healthy"
    break
  fi
  sleep 5
done

# Health check de Database
psql -h prod-db.railway.app -U user -d automation_platform_prod -c "SELECT 1;"
# Debe retornar: 1 row

# Health check de Authorizer integration
curl -X GET https://api-gateway-prod.railway.app/auth/verify \
  -H "Authorization: Bearer [TEST_TOKEN]"
# Debe retornar valid response o 401 (no 500)
```

#### Paso 4.3: Smoke Tests Críticos

```bash
# Test 1: Login funciona
TEST_LOGIN=$(curl -X POST https://api-gateway-prod.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}' \
  -w "\n%{http_code}" -s)

HTTP_CODE=$(echo "$TEST_LOGIN" | tail -1)
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Login test failed with HTTP $HTTP_CODE"
  # ESCALATE
else
  echo "✅ Login test passed"
fi

# Test 2: Protected endpoint funciona
ACCESS_TOKEN=$(echo "$TEST_LOGIN" | head -1 | jq -r '.access_token')
curl -X GET https://api-gateway-prod.railway.app/protected/endpoint \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -w "\n%{http_code}" -s

# Test 3: Database query funciona
psql -h prod-db.railway.app -U user -d automation_platform_prod -c "
SELECT COUNT(*) FROM users LIMIT 1;
"
```

### FASE 5: Comunicación y Cierre (Tiempo estimado: 2 minutos)

#### Paso 5.1: Actualizar Status Page

```bash
# Resolver incidente en status page
curl -X PATCH https://api.statuspage.io/v1/pages/[PAGE_ID]/incidents/[INCIDENT_ID] \
  -H "Authorization: OAuth [TOKEN]" \
  -d '{
    "incident": {
      "status": "resolved",
      "body": "Rollback completed successfully. All systems operational. We apologize for the inconvenience."
    }
  }'
```

#### Paso 5.2: Notificar al Equipo

```bash
# Slack notification
slack-cli send --channel #production-incidents \
  --message "✅ ROLLBACK COMPLETED SUCCESSFULLY
Migration: 20251202020032_update_user_schema_final
Duration: [XX] minutes
Current Status: All systems operational
Next Steps: Post-mortem scheduled for [DATE/TIME]"

# Email a stakeholders
send-email \
  --to "stakeholders@example.com" \
  --subject "Production Rollback Completed - Systems Operational" \
  --body "See post-mortem: [LINK]"
```

---

## ✅ Checklist de Validación Post-Rollback

Marcar cada ítem antes de considerar rollback completo:

### Schema & Data

- [ ] Columnas `passwordHash` y `emailVerified` existen
- [ ] Columna `authorizerId` es nullable nuevamente
- [ ] Conteo de usuarios coincide con pre-migración
- [ ] Relaciones con `clients` intactas
- [ ] Relaciones con `workflows` intactas
- [ ] Sample de datos verificado (últimos 100 usuarios)

### Aplicación

- [ ] API Gateway respondiendo a health checks
- [ ] Login endpoint funcional (200 OK)
- [ ] Token validation funcional
- [ ] Protected endpoints accesibles con JWT válido
- [ ] Prisma Client regenerado correctamente
- [ ] No hay errores en logs de aplicación

### Infrastructure

- [ ] Database CPU < 50%
- [ ] Database Memory < 70%
- [ ] API Gateway pods healthy (2/2 running)
- [ ] No hay conexiones colgadas a database
- [ ] Redis funcionando correctamente

### Comunicación

- [ ] Status page actualizado a "Resolved"
- [ ] Equipo notificado via Slack
- [ ] Stakeholders notificados via email
- [ ] Tickets de soporte respondidos
- [ ] Post-mortem agendado

---

## 📊 Métricas de Éxito del Rollback

| Métrica | Target | Actual | Status |
|---------|--------|--------|--------|
| **RTO (Recovery Time)** | < 15 min | ___ min | ✅/❌ |
| **RPO (Data Loss)** | < 1 min | ___ min | ✅/❌ |
| **Uptime durante rollback** | > 0% (maintenance mode OK) | ___% | ✅/❌ |
| **Data integrity** | 100% | ___% | ✅/❌ |
| **Services restored** | 100% | ___% | ✅/❌ |
| **Errors post-rollback** | 0 | ___ | ✅/❌ |

---

## 🔍 Post-Mortem Requirements

**Deadline:** Dentro de 48 horas post-rollback

### Información a Recopilar

- [ ] **Timeline detallado:**
  - Hora de inicio de migración original
  - Hora de detección de problema
  - Hora de inicio de rollback
  - Hora de finalización de rollback
  - Hora de restauración completa

- [ ] **Root Cause Analysis:**
  - ¿Por qué falló la migración en producción si pasó staging?
  - ¿Qué diferencias existen entre staging y producción?
  - ¿Qué tests adicionales son necesarios?

- [ ] **Impact Assessment:**
  - Usuarios afectados (count)
  - Requests fallidos (count)
  - Revenue loss (USD)
  - Customer complaints (count)

- [ ] **Lessons Learned:**
  - ¿Qué salió bien?
  - ¿Qué salió mal?
  - ¿Qué se puede mejorar?

- [ ] **Action Items:**
  - Mejoras al plan de rollback
  - Tests adicionales requeridos
  - Monitoreo adicional necesario
  - Cambios de proceso

### Template de Post-Mortem

Crear archivo: `docs/incidents/YYYY-MM-DD-migration-rollback-postmortem.md`

```markdown
# Post-Mortem: Migration Rollback - 20251202020032_update_user_schema_final

**Date:** YYYY-MM-DD
**Severity:** [P0/P1/P2]
**Duration:** XX minutes
**Impact:** [Descripción del impacto]

## Summary
[Resumen ejecutivo en 2-3 oraciones]

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Migration started |
| HH:MM | Issue detected |
| HH:MM | Rollback initiated |
| HH:MM | Rollback completed |
| HH:MM | Systems restored |

## Root Cause
[Análisis detallado]

## Impact
- Users affected: XXX
- Failed requests: XXX
- Revenue loss: $XXX
- Customer complaints: XXX

## What Went Well
- [Lista]

## What Went Wrong
- [Lista]

## Action Items
- [ ] [Acción 1] - Owner: [Nombre] - Due: [Fecha]
- [ ] [Acción 2] - Owner: [Nombre] - Due: [Fecha]

## Prevention
[Cómo prevenir en el futuro]
```

---

## 🧪 Testing del Plan de Rollback

**⚠️ CRÍTICO:** Este plan DEBE ser testeado en staging antes de ejecutar en producción

### Test 1: Dry Run en Staging

```bash
# 1. Ejecutar migración en staging
cd automation-platform-db
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 2. Ejecutar rollback usando este plan
./scripts/rollback-migration.sh staging 20251202020032_update_user_schema_final

# 3. Validar que todo funciona post-rollback
./scripts/staging-health-check.sh

# 4. Documentar tiempo tomado y problemas encontrados
```

### Test 2: Validar Backups

```bash
# 1. Crear backup de staging
pg_dump -h staging-db.railway.app -U user -d automation_platform_staging \
  > backup_test.sql

# 2. Crear una DB temporal
createdb automation_platform_test

# 3. Restaurar backup en DB temporal
psql -d automation_platform_test < backup_test.sql

# 4. Validar que restauración funcionó
psql -d automation_platform_test -c "\dt"

# 5. Eliminar DB temporal
dropdb automation_platform_test
```

### Test 3: Simulacro de Incident Response

**Participantes:** Lead Engineer, DevOps Lead, Database Specialist

**Escenario:** "Migración en producción causó error rate de 15%. Ejecutar rollback."

**Checklist:**
- [ ] Equipo notificado en < 2 minutos
- [ ] Status page actualizado en < 3 minutos
- [ ] Rollback iniciado en < 5 minutos
- [ ] Rollback completado en < 15 minutos
- [ ] Validación post-rollback en < 20 minutos
- [ ] Comunicación de cierre en < 25 minutos

---

## 📞 Escalation Path

Si el rollback falla o encuentra problemas críticos:

| Nivel | Rol | Contacto | Cuando Escalar |
|-------|-----|----------|----------------|
| **L1** | On-Call Engineer | [Phone/Slack] | Problema técnico durante rollback |
| **L2** | Lead Engineer | [Phone/Slack] | Rollback no completa en 20 min |
| **L3** | DevOps Lead | [Phone/Slack] | Database corruption detectada |
| **L4** | CTO | [Phone/Slack] | Data loss confirmado |
| **L5** | CEO + Legal | [Phone/Slack] | Breach de seguridad o compliance |

---

## 📚 Referencias

- **Procedimiento de Migración Desarrollo:** `./MIGRATION_DEVELOPMENT.md`
- **Plan de Monitoreo Staging:** `./STAGING_MONITORING_PLAN.md`
- **Railway CLI Docs:** https://docs.railway.app/develop/cli
- **PostgreSQL Backup Docs:** https://www.postgresql.org/docs/current/backup.html
- **Prisma Migrate Docs:** https://www.prisma.io/docs/concepts/components/prisma-migrate

---

**Documento creado:** 2025-12-02
**Versión:** 1.0
**Autor:** Claude Code AI Assistant
**Aprobado por:** [Lead Engineer] - [Fecha]
**Última revisión:** [Fecha]
**Próxima revisión:** Post-ejecución o cada 6 meses
