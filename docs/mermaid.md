📊 Base de Datos Conectada

Base de datos: automation_platform_dev
Motor: PostgreSQL 16.10 (Alpine 14.2.0)
Usuario: postgres
Tablas activas: 6 (users, clients, ad_accounts, workflows, execution_logs, reports)

---

🗄️ Diagrama del Sistema de Base de Datos Multi-Tenant

erDiagram
%% ========================================
%% MULTI-TENANT CORE
%% ========================================

      Client {
          string id PK "cuid()"
          string name
          string slug UK "URL-friendly"
          string domain UK "Custom domain"
          enum tier "FREE|BASIC|PRO|ENTERPRISE"
          enum status "ACTIVE|TRIAL|SUSPENDED|CANCELLED"
          datetime trialEndsAt
          datetime subscriptionEndsAt
          json settings "Client config"
          json branding "Logo, colors"
          int maxUsers "Default 5"
          int maxWorkflows "Default 10"
          int maxAdAccounts "Default 3"
          datetime createdAt
          datetime updatedAt
      }

      %% ========================================
      %% AUTHENTICATION
      %% ========================================

      User {
          string id PK "cuid()"
          string authorizerId UK "FK to Authorizer (SSO)"
          string email UK
          string firstName
          string lastName
          enum role "SUPER_ADMIN|ADMIN|USER|VIEWER"
          enum status "ACTIVE|INACTIVE|SUSPENDED|PENDING_VERIFICATION"
          string clientId FK "Multi-tenant isolation"
          datetime createdAt
          datetime updatedAt
          datetime lastLoginAt
      }

      %% ========================================
      %% META MARKETING API
      %% ========================================

      AdAccount {
          string id PK "cuid()"
          string metaAdAccountId UK "act_123456789"
          string accessToken "Encrypted token"
          datetime tokenExpiresAt
          string businessId
          string name
          string currency "Default USD"
          string timezone "Default America/Mexico_City"
          enum status "ACTIVE|INACTIVE|DISCONNECTED|RATE_LIMITED|ERROR"
          int apiCallsUsed "Default 0"
          int apiCallsLimit "Default 200"
          datetime rateLimitResetAt
          string clientId FK "Multi-tenant"
          datetime createdAt
          datetime updatedAt
          datetime lastSyncAt
      }

      %% ========================================
      %% WORKFLOWS (n8n)
      %% ========================================

      Workflow {
          string id PK "cuid()"
          string name
          string description
          enum type "WEEKLY_REPORT|DAILY_METRICS|ALERT_MONITORING|BUDGET_OPTIMIZATION|CUSTOM"
          enum status "ACTIVE|INACTIVE|PAUSED|ERROR"
          string n8nWorkflowId UK "n8n instance ID"
          string n8nWebhookUrl "Webhook trigger"
          string schedule "Cron expression"
          string timezone "Default America/Mexico_City"
          json config "Workflow config"
          string clientId FK "Multi-tenant"
          string adAccountId FK "Optional"
          string createdBy FK "User ID"
          datetime createdAt
          datetime updatedAt
          datetime lastExecutedAt
      }

      %% ========================================
      %% EXECUTION TRACKING
      %% ========================================

      ExecutionLog {
          string id PK "cuid()"
          enum status "SUCCESS|FAILED|RUNNING|CANCELLED|TIMEOUT"
          datetime startedAt
          datetime completedAt
          int duration "Milliseconds"
          string n8nExecutionId UK "n8n execution ID"
          json input "Input params"
          json output "Result data"
          json error "Error details"
          json logs "Execution logs"
          int apiCallsUsed "Default 0"
          int dataProcessed "Records count"
          string clientId FK "Multi-tenant"
          string workflowId FK
          string adAccountId FK "Optional"
          string executedBy FK "User ID optional"
      }

      %% ========================================
      %% REPORTS
      %% ========================================

      Report {
          string id PK "cuid()"
          string title
          enum type "WEEKLY_STORYTELLING|MONTHLY_SUMMARY|PERFORMANCE_ALERT|BUDGET_RECOMMENDATION|CUSTOM"
          enum status "GENERATED|SENT|FAILED|DRAFT"
          datetime periodStart
          datetime periodEnd
          text content "Markdown content"
          text htmlContent "HTML version"
          json summary "Executive summary"
          json recipients "Email addresses"
          datetime sentAt
          json deliveryStatus "Delivery tracking"
          string clientId FK "Multi-tenant"
          string userId FK
          string workflowId FK "Optional"
          string adAccountId FK "Optional"
          string executionLogId FK "Unique, Optional"
          datetime createdAt
          datetime updatedAt
      }

      %% ========================================
      %% RELATIONSHIPS
      %% ========================================

      %% Client is the root tenant
      Client ||--o{ User : "has many"
      Client ||--o{ AdAccount : "has many"
      Client ||--o{ Workflow : "has many"
      Client ||--o{ ExecutionLog : "has many"
      Client ||--o{ Report : "has many"

      %% User relationships
      User ||--o{ Workflow : "creates"
      User ||--o{ ExecutionLog : "executes"
      User ||--o{ Report : "owns"

      %% AdAccount relationships
      AdAccount ||--o{ Workflow : "linked to"
      AdAccount ||--o{ ExecutionLog : "processes"
      AdAccount ||--o{ Report : "generates from"

      %% Workflow execution flow
      Workflow ||--o{ ExecutionLog : "executes"
      Workflow ||--o{ Report : "generates"

      %% Execution to Report (1:1)
      ExecutionLog ||--o| Report : "produces"

---

🔄 Flujo de Datos del Sistema

flowchart TB
%% Styling
classDef tenant fill:#4A90E2,color:#fff,stroke:#2E5C8A
classDef auth fill:#7B68EE,color:#fff,stroke:#5A4BB8
classDef api fill:#FF6B6B,color:#fff,stroke:#CC5555
classDef workflow fill:#4ECDC4,color:#fff,stroke:#3BA39C
classDef execution fill:#FFD93D,color:#000,stroke:#CCB030
classDef report fill:#6BCF7F,color:#fff,stroke:#55A566

      %% Entry Point
      START([Cliente Final]) --> CLIENT

      %% Tenant Layer
      subgraph TENANT["🏢 MULTI-TENANT LAYER"]
          CLIENT[(Client<br/>Tier: PRO<br/>Status: ACTIVE)]
          CLIENT --> USERS[(Users<br/>Roles & Permissions)]
          CLIENT --> ADACCTS[(Ad Accounts<br/>Meta API Credentials)]
      end

      %% Workflow Configuration
      subgraph CONFIG["⚙️ WORKFLOW CONFIGURATION"]
          USERS --> WF_CREATE[Create Workflow]
          ADACCTS --> WF_CREATE
          WF_CREATE --> WORKFLOW[(Workflow<br/>Type: WEEKLY_REPORT<br/>Schedule: Mon 8AM)]
      end

      %% Execution Flow
      subgraph EXEC["🔄 EXECUTION FLOW"]
          WORKFLOW -->|Trigger| N8N[n8n Automation<br/>Webhook/Schedule]
          N8N --> EXE_LOG[(Execution Log<br/>Status: RUNNING)]

          EXE_LOG --> META_API[Meta Marketing API<br/>Campaigns/AdSets/Ads]
          META_API -->|Raw Data| PROCESS[JavaScript Calculators<br/>Metrics + Insights]
          PROCESS -->|Enriched JSON| AI[AI Generation<br/>GPT-4o/Claude 3.5]
          AI -->|Markdown| TEMPLATE[HTML Template<br/>Email Formatting]

          TEMPLATE --> EXE_LOG_SUCCESS[(Execution Log<br/>Status: SUCCESS<br/>Duration: 15s)]
      end

      %% Report Generation
      subgraph REPORTS["📊 REPORT GENERATION"]
          EXE_LOG_SUCCESS --> REPORT[(Report<br/>Type: WEEKLY_STORYTELLING<br/>Status: GENERATED)]
          REPORT --> DELIVERY{Delivery Channel}
          DELIVERY -->|Email| EMAIL[📧 Gmail/Outlook]
          DELIVERY -->|Telegram| TELEGRAM[📱 Telegram Bot]
          DELIVERY -->|Slack| SLACK[💬 Slack Webhook]
      end

      %% Final Recipient
      EMAIL --> END([Cliente Final Recibe Reporte])
      TELEGRAM --> END
      SLACK --> END

      %% Monitoring & Analytics
      subgraph MONITOR["📈 MONITORING"]
          EXE_LOG_SUCCESS --> ANALYTICS[Analytics Dashboard<br/>Success Rate<br/>Performance Metrics]
          REPORT --> ANALYTICS
          ANALYTICS --> CLIENT
      end

      %% Apply styles
      class CLIENT,ADACCTS tenant
      class USERS auth
      class META_API api
      class WORKFLOW,N8N workflow
      class EXE_LOG,EXE_LOG_SUCCESS,PROCESS execution
      class REPORT,EMAIL,TELEGRAM,SLACK report

---

📊 Características Clave del Sistema

🔐 Authentication & Multi-Tenant Architecture

- **Authentication**: Delegada a Authorizer (SSO)
  - No almacenamos passwords ni tokens de autenticación
  - Campo `authorizerId` vincula usuarios con Authorizer
  - Email verification manejada por Authorizer
- **Multi-Tenant**: Row-level tenancy con clientId en todas las tablas
- Aislamiento completo entre clientes
- Límites por tier (users, workflows, ad accounts)

🔄 Workflow Automation

- Integración n8n con webhooks y schedules
- 5 tipos de workflows predefinidos
- Configuración flexible vía JSON

📈 Execution Tracking

- Auditoría completa (input, output, errors, logs)
- Métricas de performance (duration, API calls)
- Estados granulares (SUCCESS, FAILED, RUNNING, etc.)

📧 Report Generation

- Markdown + HTML dual format
- Multi-channel delivery (email, Telegram, Slack)
- Delivery tracking con status

🔗 Meta API Integration

- Token management con expiración
- Rate limiting automático (200 calls/window)
- Multi-account support por cliente
