# Cursor Rules — Node.js / Express Full-Stack Project

## What's Included

### `.cursor/rules/` — Cursor AI Rules (`.mdc` files)

| File | Scope | Always Applied |
|---|---|---|
| `000-project-overview.mdc` | Global conventions, folder structure, naming | ✅ |
| `001-solid-oop.mdc` | SOLID principles + OOP patterns with examples | ✅ |
| `002-nodejs-express.mdc` | Express bootstrap, routing, controllers, middleware, error handling | ✅ |
| `003-mysql.mdc` | mysql2/promise, parameterised queries, transactions, schema rules | On MySQL files |
| `004-mongodb.mdc` | Mongoose schemas, repository pattern, aggregation, best practices | On Mongo files |
| `005-timescaledb.mdc` | Hypertables, time_bucket, continuous aggregates, compression | On TS files |
| `006-azure-service-bus.mdc` | Producers, consumers, DLQ, sessions, idempotency | On event files |
| `007-azure-apim-appgateway.mdc` | APIM policies, JWT, WAF, health probes, trust proxy | On API/config files |
| `008-testing-logging.mdc` | Jest, supertest, Pino, App Insights | On test files |

### `docs/` — Reference Markdown

| File | Contents |
|---|---|
| `ARCHITECTURE.md` | System diagram, layered arch, design patterns, security & perf checklists, env vars |
| `GIT-CONVENTIONS.md` | Branch strategy, commit format, PR rules, code review checklist |

---

## How to Use

1. **Copy the `.cursor/` folder** into the root of your project.
2. Open Cursor — the rules are auto-detected.
3. Rules tagged **Always Apply** are active on every file.
4. Technology-specific rules activate when Cursor detects relevant file patterns.

## Stack Covered
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Databases**: MySQL 8 · MongoDB 7 · TimescaleDB (PostgreSQL)
- **Messaging**: Azure Service Bus
- **API Layer**: Azure APIM + Application Gateway (WAF)
- **Paradigms**: SOLID · OOP · Repository Pattern · Dependency Injection
