# 🗄️ Automation Platform DB

Multi-tenant PostgreSQL database with Prisma ORM for automation platform. Handles users, clients, workflows, and execution logs.

## 🎯 Purpose

This repository contains the database schema, migrations, and seeds for the Meta Marketing API automation platform. It provides a robust multi-tenant architecture for managing:

- **Users & Authentication** - User accounts, roles, permissions
- **Clients (Tenants)** - Multi-tenant client isolation
- **Workflows** - n8n workflow metadata and configuration
- **Execution Logs** - Workflow execution history and results
- **Meta API Integrations** - Ad accounts, credentials, rate limiting

## 🏗️ Stack

- **Database**: PostgreSQL 16+
- **ORM**: Prisma 5.x
- **Language**: TypeScript
- **Cache**: Redis (for rate limiting, sessions)

## 📁 Structure

```
automation-platform-db/
├── prisma/
│   ├── schema.prisma          # Multi-tenant schema definition
│   ├── migrations/            # Database migrations (auto-generated)
│   └── seeds/                 # Seed data for development
├── src/
│   ├── client.ts              # Prisma client singleton
│   ├── utils/                 # Query helpers and utilities
│   └── types/                 # TypeScript type exports
├── tests/
│   └── integration/           # Integration tests for schema
├── docker-compose.yml         # Local PostgreSQL setup
├── .env.example              # Environment variables template
└── package.json
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ and npm
- Docker & Docker Compose (for local PostgreSQL)
- Git

### 2. Setup Database

```bash
# Start PostgreSQL container
docker-compose up -d

# Wait for PostgreSQL to be ready
docker-compose logs -f postgres
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# Default: postgresql://postgres:postgres@localhost:5432/automation_platform_dev
```

### 5. Run Migrations

```bash
# Apply all migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### 6. Seed Database (Optional)

```bash
# Load seed data for development
npm run seed
```

## 📊 Database Schema Overview

### Multi-Tenant Architecture

The database uses **row-level multi-tenancy** with a `clientId` field on all tenant-specific tables:

```
Users (references Authorizer for auth)
  ↓
Clients (tenant isolation)
  ↓
├── AdAccounts (Meta API credentials)
├── Workflows (n8n workflows)
├── ExecutionLogs (workflow runs)
└── Reports (generated reports)
```

### Authentication Integration

Authentication is **delegated to Authorizer** (external SSO service):

- **Users table** stores business logic only (roles, client relationship)
- **authorizerId** field links to Authorizer's user database
- No passwords, email verification, or MFA stored here
- All auth operations (login, signup, token validation) handled by Authorizer

### Key Tables

- **User** - Business user data, roles, permissions (auth via Authorizer `authorizerId`)
- **Client** - Tenant data, subscription tier, settings
- **AdAccount** - Meta ad account credentials per client
- **Workflow** - n8n workflow metadata
- **ExecutionLog** - Workflow execution history
- **Report** - Generated weekly reports

## 🛠️ Available Scripts

```bash
# Development
npm run prisma:studio     # Open Prisma Studio GUI
npm run prisma:migrate    # Create new migration
npm run prisma:generate   # Regenerate Prisma Client

# Database
npm run db:push          # Push schema without migration (dev only)
npm run db:reset         # Reset database and re-seed
npm run db:seed          # Run seed files

# Testing
npm test                 # Run integration tests
npm run test:watch       # Run tests in watch mode
```

## 🔐 Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/automation_platform_dev"

# Redis (optional, for caching)
REDIS_URL="redis://localhost:6379"

# Meta API (for rate limiting calculations)
META_API_RATE_LIMIT=200
```

## 🔄 Migration Workflow

### Creating Migrations

```bash
# 1. Modify prisma/schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_user_roles

# 3. Prisma will:
#    - Generate SQL migration file
#    - Apply migration to database
#    - Regenerate Prisma Client
```

### Applying Migrations (Production)

```bash
# Apply pending migrations
npx prisma migrate deploy

# Never use `migrate dev` in production!
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific schema
npm test -- client.test.ts

# Integration tests use a separate test database
# Set TEST_DATABASE_URL in .env.test
```

## 🐳 Docker Support

### Local Development

```bash
# Start PostgreSQL + pgAdmin
docker-compose up -d

# Access pgAdmin: http://localhost:5050
# Email: admin@admin.com
# Password: admin
```

### Production Deployment

Use managed PostgreSQL (Railway, Supabase, AWS RDS) for production. Docker is for local development only.

## 📚 Prisma Studio

Visual database browser:

```bash
npx prisma studio
# Opens http://localhost:5555
```

## 🔗 Related Repositories

- [meta-calculator-library](https://github.com/gggaspen/meta-calculator-library) - Metrics calculators
- [n8n](https://github.com/gggaspen/n8n) - Workflow automation
- [static-report-server](https://github.com/gggaspen/static-report-server) - Report delivery

## 📖 Documentation

- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Multi-tenant Architecture Guide](./docs/MULTI_TENANT.md) (coming soon)

## 🤝 Contributing

This is part of a larger automation platform. For major schema changes:

1. Discuss in main project issues first
2. Create migration with descriptive name
3. Test against production data snapshot
4. Document breaking changes in PR

## 📄 License

ISC

## 🔧 Troubleshooting

### Connection Issues

```bash
# Test database connection
npx prisma db execute --stdin <<< "SELECT 1"

# Check PostgreSQL logs
docker-compose logs postgres
```

### Migration Conflicts

```bash
# Reset local database (DESTRUCTIVE!)
npx prisma migrate reset

# Re-apply all migrations
npx prisma migrate deploy
```

### Type Generation Issues

```bash
# Clear Prisma cache
rm -rf node_modules/.prisma

# Regenerate client
npx prisma generate
```

---

**Status**: 🚧 In Development
**Version**: 1.0.0
**Last Updated**: 2025-12-02 - Schema finalized with Authorizer integration
