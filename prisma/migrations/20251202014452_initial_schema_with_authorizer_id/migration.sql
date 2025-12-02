-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONNECTED', 'RATE_LIMITED', 'ERROR');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('WEEKLY_REPORT', 'DAILY_METRICS', 'ALERT_MONITORING', 'BUDGET_OPTIMIZATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'RUNNING', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('GENERATED', 'SENT', 'FAILED', 'DRAFT');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY_STORYTELLING', 'MONTHLY_SUMMARY', 'PERFORMANCE_ALERT', 'BUDGET_RECOMMENDATION', 'CUSTOM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "status" "ClientStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "subscriptionEndsAt" TIMESTAMP(3),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "branding" JSONB,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxWorkflows" INTEGER NOT NULL DEFAULT 10,
    "maxAdAccounts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_accounts" (
    "id" TEXT NOT NULL,
    "metaAdAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "businessId" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "status" "AdAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "apiCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "apiCallsLimit" INTEGER NOT NULL DEFAULT 200,
    "rateLimitResetAt" TIMESTAMP(3),
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "WorkflowType" NOT NULL DEFAULT 'WEEKLY_REPORT',
    "status" "WorkflowStatus" NOT NULL DEFAULT 'INACTIVE',
    "n8nWorkflowId" TEXT,
    "n8nWebhookUrl" TEXT,
    "schedule" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "config" JSONB NOT NULL DEFAULT '{}',
    "clientId" TEXT NOT NULL,
    "adAccountId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastExecutedAt" TIMESTAMP(3),

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "n8nExecutionId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "logs" JSONB,
    "apiCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "dataProcessed" INTEGER,
    "clientId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "adAccountId" TEXT,
    "executedBy" TEXT,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ReportType" NOT NULL DEFAULT 'WEEKLY_STORYTELLING',
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATED',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "htmlContent" TEXT,
    "summary" JSONB,
    "recipients" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveryStatus" JSONB,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT,
    "adAccountId" TEXT,
    "executionLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_authorizerId_key" ON "users"("authorizerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_clientId_idx" ON "users"("clientId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_authorizerId_idx" ON "users"("authorizerId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "clients_domain_key" ON "clients"("domain");

-- CreateIndex
CREATE INDEX "clients_slug_idx" ON "clients"("slug");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ad_accounts_metaAdAccountId_key" ON "ad_accounts"("metaAdAccountId");

-- CreateIndex
CREATE INDEX "ad_accounts_clientId_idx" ON "ad_accounts"("clientId");

-- CreateIndex
CREATE INDEX "ad_accounts_metaAdAccountId_idx" ON "ad_accounts"("metaAdAccountId");

-- CreateIndex
CREATE INDEX "ad_accounts_status_idx" ON "ad_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_n8nWorkflowId_key" ON "workflows"("n8nWorkflowId");

-- CreateIndex
CREATE INDEX "workflows_clientId_idx" ON "workflows"("clientId");

-- CreateIndex
CREATE INDEX "workflows_adAccountId_idx" ON "workflows"("adAccountId");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflows_type_idx" ON "workflows"("type");

-- CreateIndex
CREATE UNIQUE INDEX "execution_logs_n8nExecutionId_key" ON "execution_logs"("n8nExecutionId");

-- CreateIndex
CREATE INDEX "execution_logs_clientId_idx" ON "execution_logs"("clientId");

-- CreateIndex
CREATE INDEX "execution_logs_workflowId_idx" ON "execution_logs"("workflowId");

-- CreateIndex
CREATE INDEX "execution_logs_status_idx" ON "execution_logs"("status");

-- CreateIndex
CREATE INDEX "execution_logs_startedAt_idx" ON "execution_logs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reports_executionLogId_key" ON "reports"("executionLogId");

-- CreateIndex
CREATE INDEX "reports_clientId_idx" ON "reports"("clientId");

-- CreateIndex
CREATE INDEX "reports_userId_idx" ON "reports"("userId");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_periodStart_periodEnd_idx" ON "reports"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_executedBy_fkey" FOREIGN KEY ("executedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_executionLogId_fkey" FOREIGN KEY ("executionLogId") REFERENCES "execution_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
