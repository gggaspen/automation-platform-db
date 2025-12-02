# 📊 Tarea 5.1.7: Plan de Monitoreo en Staging (24 horas)

**Fecha de creación:** 2025-12-02
**Estado:** DOCUMENTADO - Listo para ejecución
**Duración:** 24 horas continuas post-deployment
**Migración:** `20251202020032_update_user_schema_final`

---

## 🎯 Objetivo del Monitoreo

Validar que la eliminación de campos deprecated (`passwordHash`, `emailVerified`) en el ambiente de **staging** no causa:
- Errores en autenticación/autorización
- Degradación de performance
- Pérdida de datos
- Inconsistencias en la sincronización con Authorizer
- Fallos en workflows dependientes

---

## 📋 Pre-requisitos para Staging

Antes de ejecutar en staging, verificar:

- [x] Tarea 5.1.6 completada exitosamente en desarrollo
- [x] Backup de staging creado y verificado
- [ ] Plan de rollback revisado y aprobado
- [ ] Ventana de mantenimiento comunicada a stakeholders
- [ ] Acceso a dashboards de monitoreo configurado
- [ ] Alertas configuradas en sistema de monitoreo
- [ ] Equipo de guardia notificado y disponible
- [ ] Runbook de troubleshooting preparado

---

## ⚙️ Configuración de Ambiente Staging

### Variables de Entorno

```bash
# Staging Database
DATABASE_URL="postgresql://user:password@staging-db.railway.app:5432/automation_platform_staging"

# Authorizer Staging
AUTHORIZER_URL="https://authorizer-staging.railway.app"
AUTHORIZER_CLIENT_ID="staging-client-id"
AUTHORIZER_CLIENT_SECRET="staging-secret"

# Monitoring
LOG_LEVEL="debug"  # Mayor verbosidad durante monitoreo
ENABLE_QUERY_LOGGING="true"
ENABLE_PERFORMANCE_METRICS="true"
```

### Railway/Hosting Configuration

```bash
# Asegurar que staging tenga recursos suficientes
# - PostgreSQL: Mínimo 2GB RAM, 2 vCPU
# - API Gateway: Mínimo 1GB RAM, 1 vCPU
# - Redis: Mínimo 512MB RAM

# Verificar configuración de Railway
railway status --environment staging
```

---

## 🕐 Cronograma de Monitoreo (24 horas)

### Hora 0: Ejecución de Migración

**Timestamp:** `YYYY-MM-DD HH:00:00`

```bash
# 1. Crear backup pre-migración
pg_dump -h staging-db.railway.app -U user -d automation_platform_staging \
  > backup_staging_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# 2. Ejecutar migración
cd automation-platform-db
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 3. Verificar migración exitosa
npx prisma migrate status
```

**Checklist Hora 0:**
- [ ] Migración completada sin errores
- [ ] Schema validado (columnas eliminadas)
- [ ] Prisma Client regenerado
- [ ] Aplicaciones reiniciadas
- [ ] Health checks pasando
- [ ] Logs sin errores críticos

### Horas 1-2: Monitoreo Intensivo

**Frecuencia de checks:** Cada 15 minutos

**Métricas a vigilar:**

| Métrica | Valor Esperado | Acción si Fuera de Rango |
|---------|----------------|--------------------------|
| Error rate de autenticación | < 0.1% | Investigar logs, considerar rollback |
| Response time /auth/login | < 500ms (p95) | Optimizar queries, revisar índices |
| Response time /auth/verify | < 200ms (p95) | Verificar cache de Redis |
| Database connections | < 80% del pool | Investigar connection leaks |
| CPU usage (DB) | < 70% | Optimizar queries lentas |
| Memory usage (DB) | < 80% | Verificar memory leaks |
| Cache hit rate (Redis) | > 90% | Revisar estrategia de caché |

**Queries de Validación:**

```sql
-- 1. Verificar que NO hay NULL en authorizerId
SELECT COUNT(*) as users_without_authorizer_id
FROM users
WHERE "authorizerId" IS NULL;
-- Esperado: 0

-- 2. Verificar que columnas deprecated NO existen
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('passwordHash', 'emailVerified');
-- Esperado: 0 rows

-- 3. Verificar performance de queries de autenticación
EXPLAIN ANALYZE
SELECT u.*, c.name as client_name
FROM users u
LEFT JOIN clients c ON u."clientId" = c.id
WHERE u."authorizerId" = 'test-auth-id';
-- Execution time debe ser < 10ms

-- 4. Ver logs de ejecución recientes
SELECT COUNT(*) as total_executions,
       AVG(EXTRACT(EPOCH FROM ("endedAt" - "startedAt"))) as avg_duration_seconds
FROM execution_logs
WHERE "createdAt" > NOW() - INTERVAL '1 hour';
```

### Horas 3-8: Monitoreo Regular

**Frecuencia de checks:** Cada 1 hora

**Checklist Horaria:**
- [ ] Dashboard de métricas revisado
- [ ] Logs de errores revisados (últimas 500 líneas)
- [ ] Queries SQL lentas identificadas
- [ ] Usuarios activos sin problemas de autenticación
- [ ] Workflows ejecutándose correctamente
- [ ] No hay incremento en latencia
- [ ] No hay memory leaks detectados

**Comando de Monitoreo Automatizado:**

```bash
# Script de monitoreo (ejecutar cada hora)
./scripts/staging-health-check.sh

# Contenido del script (crear este archivo):
#!/bin/bash

echo "=== Staging Health Check $(date) ==="

# 1. Health checks de servicios
echo "1. API Gateway Health:"
curl -s https://api-gateway-staging.railway.app/health | jq .

echo "2. Authorizer Health:"
curl -s https://authorizer-staging.railway.app/health | jq .

# 2. Métricas de base de datos
echo "3. Database Metrics:"
docker exec -it staging-postgres psql -U postgres -d automation_platform_staging -c "
SELECT
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM users WHERE \"authorizerId\" IS NULL) as users_without_auth_id,
  (SELECT COUNT(*) FROM execution_logs WHERE \"createdAt\" > NOW() - INTERVAL '1 hour') as executions_last_hour,
  (SELECT COUNT(*) FROM execution_logs WHERE status = 'ERROR' AND \"createdAt\" > NOW() - INTERVAL '1 hour') as errors_last_hour;
"

# 3. Logs de errores recientes
echo "4. Recent Error Logs:"
railway logs --tail 100 --environment staging | grep -i "error\|exception\|fail" | tail -20

echo "=== Health Check Complete ==="
```

### Horas 9-24: Monitoreo Pasivo

**Frecuencia de checks:** Cada 2-4 horas

**Checklist cada 4 horas:**
- [ ] Alertas automáticas revisadas
- [ ] No hay tickets de soporte relacionados con autenticación
- [ ] Métricas de negocio estables (conversiones, usuarios activos)
- [ ] Backup incremental creado
- [ ] Documentación de incidentes actualizada

---

## 🚨 Alertas Críticas a Configurar

### 1. Alertas de Disponibilidad

```yaml
# Railway/Datadog/New Relic configuration

alerts:
  - name: "Staging - High Authentication Error Rate"
    condition: error_rate > 1%
    window: 5 minutes
    action:
      - Email: team@example.com
      - Slack: #staging-alerts
      - SMS: On-call engineer

  - name: "Staging - Database Connection Pool Exhausted"
    condition: db_connections > 90%
    window: 2 minutes
    action:
      - Email: team@example.com
      - Slack: #staging-alerts

  - name: "Staging - Slow Auth Queries"
    condition: p95_latency_auth_queries > 1000ms
    window: 5 minutes
    action:
      - Email: team@example.com
      - Slack: #staging-alerts
```

### 2. Alertas de Integridad de Datos

```sql
-- Ejecutar cada 15 minutos vía cron job

-- Alerta si hay usuarios sin authorizerId
DO $$
DECLARE
  count_without_auth INT;
BEGIN
  SELECT COUNT(*) INTO count_without_auth
  FROM users
  WHERE "authorizerId" IS NULL;

  IF count_without_auth > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % users without authorizerId found!', count_without_auth;
  END IF;
END $$;
```

### 3. Alertas de Performance

```bash
# Configurar en Railway/hosting provider
# Alert if CPU > 80% for 5 minutes
# Alert if Memory > 85% for 5 minutes
# Alert if Disk I/O > 90% for 2 minutes
```

---

## 📊 Dashboards de Monitoreo

### Dashboard 1: Métricas de Autenticación

**Herramienta:** Grafana / Railway Metrics / Datadog

**Panels:**
1. **Authentication Success Rate** (%)
   - Source: API Gateway logs
   - Expected: > 99%

2. **Login Response Time** (ms)
   - Source: API Gateway metrics
   - P50: < 200ms
   - P95: < 500ms
   - P99: < 1000ms

3. **Token Validation Response Time** (ms)
   - Source: API Gateway `/auth/verify` endpoint
   - P50: < 100ms
   - P95: < 200ms

4. **Active Sessions**
   - Source: Redis
   - Trend: Should be stable or growing

### Dashboard 2: Métricas de Base de Datos

**Panels:**
1. **Query Execution Time**
   - Queries relacionadas a users table
   - Expected: < 10ms promedio

2. **Connection Pool Usage**
   - Current connections / Max connections
   - Expected: < 80%

3. **Cache Hit Rate (Redis)**
   - Expected: > 90%

4. **Slow Queries Count**
   - Queries > 100ms
   - Expected: < 5 por minuto

### Dashboard 3: Métricas de Aplicación

**Panels:**
1. **Workflow Execution Success Rate**
   - Source: execution_logs table
   - Expected: > 95%

2. **API Request Rate**
   - Requests per minute
   - Should be stable

3. **Error Rate por Endpoint**
   - Expected: < 0.5% para endpoints críticos

---

## 🔍 Logs a Revisar

### 1. Application Logs

```bash
# Railway logs
railway logs --tail 1000 --environment staging --filter "error|exception|warn"

# Buscar patrones específicos:
# - "passwordHash" (NO debe aparecer)
# - "emailVerified" (NO debe aparecer)
# - "authorizerId" (debe aparecer en contextos de autenticación)
# - "undefined column" (indicaría código usando campos eliminados)
# - "null value in column" (indicaría falta de authorizerId)
```

### 2. Database Logs

```bash
# PostgreSQL logs en Railway
railway logs --service postgres --tail 500 --environment staging

# Buscar:
# - Slow queries (duration > 100ms)
# - Errors relacionados con tabla users
# - Deadlocks o lock timeouts
# - Connection errors
```

### 3. Authorizer Logs

```bash
# Logs de Authorizer
curl -X GET https://authorizer-staging.railway.app/admin/logs \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq '.logs[] | select(.level == "error")'

# Buscar:
# - Failed login attempts
# - Token validation errors
# - Webhook delivery failures
```

---

## ✅ Criterios de Éxito (Go/No-Go para Producción)

### ✅ GO - Proceder a Producción si:

- [ ] **0 errores críticos** durante 24 horas
- [ ] **Error rate < 0.1%** en autenticación
- [ ] **No hay usuarios sin authorizerId**
- [ ] **Performance estable** (no degradación > 10%)
- [ ] **Todos los workflows críticos funcionando**
- [ ] **Cache hit rate > 90%**
- [ ] **No hay memory leaks detectados**
- [ ] **Backups completados exitosamente**
- [ ] **Equipo de QA aprueba** testing manual
- [ ] **No hay tickets de soporte** relacionados

### ❌ NO-GO - Hacer Rollback si:

- [ ] **> 5 errores críticos** en cualquier hora
- [ ] **Error rate > 1%** en autenticación sostenido por > 5 minutos
- [ ] **Usuarios sin authorizerId detectados**
- [ ] **Degradación de performance > 30%**
- [ ] **Workflows críticos fallando** (> 10% error rate)
- [ ] **Memory leak detectado** (crecimiento sostenido > 20% por hora)
- [ ] **Database CPU > 90%** sostenido por > 10 minutos
- [ ] **Cualquier pérdida de datos** detectada

---

## 🔄 Procedimiento de Rollback en Staging

**Si criterios de NO-GO se cumplen:**

```bash
# 1. Notificar al equipo
echo "ROLLBACK INITIATED - Reason: [DESCRIBIR RAZÓN]" | \
  slack-cli send --channel #staging-alerts

# 2. Ejecutar rollback (ver PRODUCTION_ROLLBACK_PLAN.md para detalles)
cd automation-platform-db
./scripts/rollback-migration.sh staging 20251202020032_update_user_schema_final

# 3. Verificar rollback exitoso
npx prisma migrate status

# 4. Reiniciar aplicaciones
railway restart --environment staging

# 5. Validar que sistema volvió a estado previo
./scripts/staging-health-check.sh

# 6. Documentar incidente
# Crear post-mortem en docs/incidents/YYYY-MM-DD-staging-rollback.md
```

---

## 📝 Documentación de Resultados

**Al completar las 24 horas, documentar en `relations-authorizer-automation-platform-db.md`:**

```markdown
- [x] 5.1.7 Ejecutar en staging con monitoreo por 24 horas

#### 📋 Implementación Completada (FECHA)

**Periodo de monitoreo:** YYYY-MM-DD HH:00 - YYYY-MM-DD HH:00 (24 horas)

**Resultados:**
- ✅ 0 errores críticos detectados
- ✅ Error rate de autenticación: 0.02% (dentro de parámetros)
- ✅ Performance estable (latencia p95: XXXms)
- ✅ 100% de usuarios con authorizerId válido
- ✅ Workflows ejecutándose sin errores
- ✅ No memory leaks detectados
- ✅ Criterios de GO cumplidos

**Métricas finales:**
- Total de logins exitosos: XXXXX
- Total de workflows ejecutados: XXX
- Tiempo promedio de respuesta: XXXms
- Cache hit rate: XX%

**Incidentes:** [Ninguno / Lista de incidentes menores]

**Decisión:** ✅ APROBADO para proceder a producción (tarea 5.1.8)
```

---

## 👥 Equipo de Monitoreo

| Rol | Nombre | Contacto | Horario |
|-----|--------|----------|---------|
| **Lead Engineer** | [Nombre] | [Email/Slack] | 24/7 |
| **On-Call Engineer (Horas 0-12)** | [Nombre] | [Email/Phone] | Horas 0-12 |
| **On-Call Engineer (Horas 12-24)** | [Nombre] | [Email/Phone] | Horas 12-24 |
| **Database Specialist** | [Nombre] | [Email/Slack] | On-demand |
| **DevOps Lead** | [Nombre] | [Email/Slack] | Business hours |

---

## 📚 Referencias

- **Procedimiento de Migración Desarrollo:** `./MIGRATION_DEVELOPMENT.md`
- **Plan de Rollback Producción:** `./PRODUCTION_ROLLBACK_PLAN.md`
- **Runbook de Troubleshooting:** `../troubleshooting/AUTH_ISSUES.md`
- **Dashboard de Métricas:** [URL de Grafana/Datadog]
- **Logs de Railway:** https://railway.app/project/[PROJECT_ID]/environment/staging

---

**Documento creado:** 2025-12-02
**Versión:** 1.0
**Autor:** Claude Code AI Assistant
**Próxima revisión:** Post-ejecución en staging
