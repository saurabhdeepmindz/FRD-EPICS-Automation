# Architecture Rules — NestJS Monorepo (SaaS Backend)

Standard guidelines for building a **NestJS monorepo SaaS backend** with microservice apps,
shared libs, PostgreSQL, Redis, and AWS. Apply these rules to any new project of this pattern.

---

## 1. Monorepo Structure

Every project following this pattern uses the same top-level layout:

```
<project-root>/
│
├── apps/                        # Independently runnable microservice entry points
├── libs/                        # Shared libraries, imported as @libs/<name>
├── config/                      # NestJS ConfigModule namespaced loaders
├── database/                    # Knex migrations and schema utilities
├── resources/                   # Static assets and API spec, DB schema docs
├── CLAUDE.md                    # Claude AI configuration entry point
└── [root config files]          # package.json, tsconfig.json, nest-cli.json, knexfile.js
```

### Dependency Direction — Non-Negotiable

```
apps/  →  libs/  →  external packages
```

- `apps/` may import from `libs/` — always
- `libs/` must **never** import from `apps/` — never
- `libs/` may import from other `libs/` — only when explicitly needed, no cycles
- Circular dependencies between libs are forbidden

---

## 2. Apps — Microservice Design

Each entry in `apps/` is an independently deployable NestJS application with its own:
- `main.ts` — bootstraps via `RestServer.create()`
- `module.ts` — root module: imports, providers
- `tsconfig.app.json` — app-specific TypeScript config

### Standard App Catalogue

For a SaaS backend of this type, the standard set of apps is:

| App | Responsibility |
|-----|---------------|
| `auth-apis` | Authentication, user management, OAuth, session management |
| `<domain>-apis` | Core business domain API (one or more per domain) |
| `control-panel` | Admin/management dashboard API |
| `file-services` | File upload, validation, S3 storage, signed URL generation |
| `media-services-job` | Background job processor for async media/file tasks |
| `notification` | Transactional email delivery service |

### App Internal Structure

Every app follows this directory layout:

```
apps/<app-name>/src/
├── main.ts                  # Bootstrap: RestServer.create(AppModule, options)
├── module.ts                # Root NestJS module
├── controllers/             # HTTP request handlers — one file per domain area
├── services/                # Business logic — subdirectories for large apps
│   └── <subdomain>/
├── dto/                     # Input validation schemas — one dir per domain
│   └── <domain>/
│       └── index.ts
├── transformers/            # Response shaping — one                 
├── enums/                   # App-scoped TypeScript enums
├── interfaces/              # App-scoped TypeScript interfaces
└── constants/               # App-scoped string/number constants
```

**Rules:**
- Controllers stay thin — no business logic
- Services own all business logic — no direct DB calls
---

## 3. Libs — Shared Library Design

Each entry in `libs/` is a NestJS library with its own `module.ts` and exported providers.
Libraries are registered in `tsconfig.json` path aliases and `nest-cli.json`.

### Standard Lib Catalogue

| Lib | Alias | Responsibility |
|-----|-------|---------------|
| `dmz` | `@libs/dmz` | Core framework: RestServer, validators, cache, exceptions, base controller |
| `database` | `@libs/database` | ORM abstractions: BaseModel, DatabaseRepository<T>, QueryBuilder |
| `common` | `@libs/common` | Shared interfaces, enums, utilities used across all libs and apps |
| `users` | `@libs/users` | User models, repositories, UsersLibService |
| `roles-and-permissions` | `@libs/roles-and-permissions` | RBAC guards, decorators, role/permission models |
| `<domain>` | `@libs/<domain>` | One lib per major business domain (companies, settings, etc.) or schema can be added   |
| `mailman` | `@libs/mailman` | Email sending abstraction (wraps Nodemailer/SES) |
| `file-lib-service` | `@libs/file-lib-service` | File handling utilities |
| `location` | `@libs/location` | Geographic reference data (countries, states, cities) |

### Lib Internal Structure

```
libs/<lib-name>/src/
├── module.ts                # NestJS module: provides and exports services/repos
├── models/                  # ORM entity models (extend BaseModel)
│   └── <entity>.ts
├── repositories/            # Data access layer
│   └── <entity>/
│       ├── contract.ts      # IXxxRepository interface
│       └── database.ts      # XxxRepository extends DatabaseRepository<XxxModel>
├── services/
│   └── index.ts             # XxxLibService — exposes all repos via DI
├── constant.ts              # Injection token constants
└── index.ts                 # Public API: re-exports module and service
```

### The `dmz` Lib — Core Framework

`dmz` is registered `@Global()` and imported once in each app's root module. It provides:

| Export | Purpose |
|--------|---------|
| `RestServer` | App bootstrap with CORS, body parser, Swagger, Sentry, rate limiting |
| `RestController` | Base controller: `transform()`, `collection()`, `paginate()` |
| `Transformer` | Abstract response shaper with include/relation support |
| `@Validate(Dto)` | Applies validation pipe to a controller method |
| `@Dto()` | Parameter decorator injecting validated DTO |
| `CacheService` | Redis abstraction: get, set, delete, TTL |
| `AppConfig` | Static `ConfigService` accessor |
| `GenericException` | Base for all custom exceptions |
| `ExceptionFilter` | Global filter normalizing all errors to standard envelope |

### The `database` Lib — ORM Layer

Stack: `PostgreSQL → Knex → Objection.js → BaseModel → XxxModel → DatabaseRepository<T>`

Standard repository API available on every `DatabaseRepository<T>`:

```typescript
repo.all(query?)                      // Fetch all records
repo.firstWhere(conditions, opts?)    // First matching record or undefined
repo.getWhere(conditions, opts?)      // All matching records
repo.create(payload)                  // Insert and return new record
repo.update(model, payload)           // Update record in-place, return updated
repo.delete(model)                    // Hard or soft delete
repo.createOrUpdate(conditions, payload)
repo.firstOrNew(conditions, defaults)
repo.transaction(async (trx) => {})   // Atomic multi-step operations
repo.chunk(size, callback)            // Process records in batches
repo.bulkInsert(records)              // Batch insert
repo.attach(model, relatedIds)        // Add to a has-many relation
repo.sync(model, relatedIds)          // Replace all related IDs
```

---

## 4. Layer Architecture

The **strict layer hierarchy** must be observed in every app and lib:

```
┌──────────────────────────────────────────────────────────┐
│  HTTP Controllers          — Route handling only          │
├──────────────────────────────────────────────────────────┤
│  Services (Business Logic) — Orchestration, rules        │
├──────────────────────────────────────────────────────────┤
│  Repositories (Data Access)— All DB queries              │
├──────────────────────────────────────────────────────────┤
│  Models (ORM Entities)     — Schema, relations           │
├──────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)     — Source of truth             │
└──────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Controllers** — allowed:
- `@Validate(Dto)` + `@Dto()` to receive validated input
- Calling one or more service methods
- `this.transform()` / `this.collection()` / `this.paginate()`
- `res.success(data)` to return the response

**Controllers** — forbidden:
- Any business logic or conditionals on domain data
- Direct repository or model calls
- Data transformation outside of `Transformer` classes

**Services** — allowed:
- All business logic
- Calling repository methods
- Calling other services (via constructor injection)
- Emitting events via emitter classes
- Throwing typed custom exceptions

**Services** — forbidden:
- Direct ORM/Knex calls (must go through repositories)
- Calling side-effect logic directly (use event emitters)
- HTTP concern handling

**Repositories** — allowed:
- All database query logic via `DatabaseRepository<T>` API
- Custom query methods for the entity
- Transactions

**Repositories** — forbidden:
- Business logic of any kind
- Calling services or other repositories (except within a transaction)

---

## 5. Request Lifecycle

Every HTTP request follows this exact path:

```
1. Request arrives at Express
        │
2. RequestGuard (global)         — Format validation, global pre-checks
        │
3. ThrottlerGuard                — Rate limit check
        │
4. JwtGuard (if @HasScopes)      — JWT decode, expiry, session freshness, user status
        │
5. ScopeGuard (if @HasScopes)    — Permission scope check
        │
6. ValidationPipe (@Validate)    — DTO validation, custom validators (IsUnique, etc.)
        │
7. Controller method             — @Dto() injection, service call
        │
8. Service                       — Business logic, repository orchestration
        │
9. Repository                    — Objection.js query against PostgreSQL
        │
10. Transformer (optional)       — Response shaping, field selection, relation flattening
        │
11. res.success(data)            — Standard success envelope
        │
12. HTTP Response
    { success: true, data: {...}, message: "..." }
```

**Error path — any layer:**
```
Exception (typed: NotFoundException, ForbiddenException, etc.)
        │
ExceptionFilter (global)
        │
{ success: false, message: "...", data: null, statusCode: N }
```

---

## 6. Event-Driven Side Effects

Side effects (email, audit logging, external sync) must be decoupled from the core
service flow using the **Emitter → Listener** pattern.

```
Service
  └─ calls EventEmitter.domainEvent(payload)   ← fire and forget
          │
          ├─ ListenerA.handle()   → sends email
          ├─ ListenerB.handle()   → writes audit log
          └─ ListenerC.handle()   → syncs to external system
```

**Rules:**
- One listener class = one responsibility
- Services never call listener logic directly
- Event payloads are strongly typed classes (`XxxPayload`)
- Listener failures must not propagate back to the originating service

```
apps/<app>/src/events/
├── emitters/
│   └── <domain>-event.emitter.ts     # Injectable, wraps EventEmitter2.emit()
├── listeners/
│   ├── notification.listener.ts      # @OnEvent('x.y') → sends email
│   ├── audit-log.listener.ts         # @OnEvent('x.y') → writes audit record
│   └── <external-sync>.listener.ts   # @OnEvent('x.y') → calls external API
└── payloads/
    └── <event-name>.payload.ts       # Typed data class for each event
```

---

## 7. Configuration System

All configuration is loaded at startup via NestJS `ConfigModule.forRoot()` with named namespaces.

### Standard Config Namespaces

| Namespace | File | Contents |
|-----------|------|---------|
| `app` | `config/app.ts` | Port, NODE_ENV, app name, CORS origins |
| `auth` | `config/auth.ts` | JWT secret/lifetime, refresh secret, OAuth credentials |
| `database` | `config/database.ts` | PostgreSQL host, port, name, user, password, pool |
| `cache` | `config/cache.ts` | Redis host, port, TTL defaults |
| `storage` | `config/storage.ts` | AWS S3 bucket, region, access credentials |
| `notifications` | `config/notifications.ts` | SMTP/SES host, credentials, sender address |
| `settings` | `config/settings.ts` | App feature flags and domain settings |
| `localization` | `config/localization.ts` | Default language, supported locales |

### Config Loader Pattern

```typescript
// config/auth.ts
export default registerAs('auth', () => {
  // Fail fast on startup if required vars are missing
  const required = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
  }
  return {
    secret: process.env.JWT_SECRET,
    lifetime: process.env.JWT_LIFETIME ?? '1h',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshLifetime: process.env.REFRESH_TOKEN_LIFETIME ?? '7d',
  };
});
```

**Rules:**
- `process.env.*` accessed only inside `config/*.ts` loaders — never in app code
- App code reads config via `ConfigService.get('namespace.key')` or `AppConfig.get()`
- `config/index.ts` exports all loaders as a single array passed to `ConfigModule.forRoot()`
- Validate required variables at startup — fail loudly, not silently later

---

## 8. Database Architecture

### ORM Stack
```
PostgreSQL
    └─ Knex 3.x         (query builder + migrations + snake_case mapping)
        └─ Objection.js  (ORM: relations, eager loading, lifecycle hooks)
            └─ BaseModel (project base: $load, $forceLoad, CustomQueryBuilder)
                └─ XxxModel (entity: tableName, columns, relationMappings)
                    └─ DatabaseRepository<XxxModel> (CRUD + transactions)
```

### Schema Conventions

Every table must include:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigIncrements` | Internal primary key — never expose to clients |
| `uuid` | `uuid` | Client-facing identifier — always expose this |
| `created_at` | `timestamp` | Set on insert via `timestamps()` migration helper |
| `updated_at` | `timestamp` | Auto-updated via PostgreSQL trigger |

Additional conventions:
- Column names: `snake_case` in DB, `camelCase` in code (Knex mapper handles translation)
- Boolean columns: prefix with `is_` (e.g., `is_email_verified`, `is_active`)
- Status/type columns: `smallint` with values documented as code constants
- Foreign keys: `<table_singular>_id` (e.g., `user_id`, `role_id`); always indexed
- Soft-delete: `deleted_at timestamp nullable` — only when product explicitly needs it
- Flexible metadata: `jsonb` — for data that varies by entity type or is not queryable

### Migration Naming
```
database/migrations/YYYYMMDDHHmmss_<verb>_<subject>.js

Examples:
  20240101000000_create_users.js
  20240102000000_create_roles.js
  20240201000000_add_profile_picture_to_users.js
  20240301000000_alter_users_add_mfa_fields.js
```

### Migration Template
```javascript
const { timestamps, onUpdateTrigger, ON_UPDATE_TIMESTAMP_FUNCTION } = require('../utils');

exports.up = async function (knex) {
  await knex.raw(ON_UPDATE_TIMESTAMP_FUNCTION);  // idempotent

  await knex.schema.createTable('<table>', (table) => {
    table.bigIncrements('id').primary();
    table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()'));
    // domain columns
    timestamps(knex, table);
  });

  await knex.raw(onUpdateTrigger('<table>'));
};

exports.down = async function (knex) {
  await knex.schema.dropTable('<table>');
};
```

---

## 9. Security Architecture

### Authentication Model

- **Access token:** JWT, short-lived (e.g., 1 hour), signed with `JWT_SECRET`
- **Refresh token:** JWT, longer-lived (e.g., 7 days), signed with `REFRESH_TOKEN_SECRET`
- **Transport:** `httpOnly` cookie (primary) + `Authorization: Bearer` header (secondary)
- **Session invalidation:** Store `lastLoginAt` on user; reject tokens issued before it

```
Client Request
    │
JwtGuard
    ├─ Decode token (header or cookie)
    ├─ Validate signature + expiry
    ├─ Check token.iat > user.lastLoginAt   ← prevents reuse after logout/password change
    ├─ Check user.status === ACTIVE
    └─ Attach user to req.user
```

### Authorization Model (RBAC)

```
Permissions  →  Roles  →  Users
(scope name)    (group)    (assigned via role_user)

Example scope: 'customer/updateProfile'
```

- Use `@HasScopes('domain/action')` for protected endpoints
- Use `@IsPublic()` for endpoints that require no authentication
- `ScopeGuard` reads `req.user.roles[].permissions[]` and checks for the required scope

### Standard Security Lib Structure

```
libs/roles-and-permissions/src/
├── guards/
│   ├── jwt.guard.ts           # Validates access token
│   ├── scope.guard.ts         # Enforces @HasScopes requirement
│   ├── refresh-jwt.guard.ts   # Validates refresh token
│   ├── google.guard.ts        # Passport Google OAuth
│   └── public.guard.ts        # Bypass guard for @IsPublic
├── decorators/
│   ├── has-scopes.ts          # @HasScopes('x/y') → applies JWT + Scope guards
│   └── is-public.ts           # @IsPublic() → skips auth entirely
├── models/
│   ├── roles.ts
│   ├── permissions.ts
│   └── permission-role.ts
└── constant.ts
```

---

## 10. Response Envelope Standard

All API responses use one consistent envelope — no exceptions:

```typescript
// Success
{ success: true, message?: string, data: T }

// Paginated
{ success: true, data: T[], meta: { total, page, limit, lastPage } }

// Error
{ success: false, message: string, data: null, errors?: FieldError[] }
```

Controller always calls `res.success(data)` or throws a typed exception.
`ExceptionFilter` converts exceptions to the error envelope.
Raw model objects are never returned — always pass through a `Transformer`.

---

## 11. Module Registration Pattern

```typescript
@Module({
  imports: [
    // 1. Config — always first, isGlobal: true
    ConfigModule.forRoot({ load: configs, isGlobal: true }),
    // 2. Core lib — always included
    DmzModule,
    // 3. Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    // 4. Events
    EventEmitterModule.forRoot(),
    // 5. Domain libs (only what this app uses)
    UsersLibModule,
    RolesAndPermissionsLibModule,
  ],
  controllers: [XxxController],
  providers: [
    XxxService,
    XxxEventEmitter,
    XxxNotificationListener,
    XxxAuditLogListener,
  ],
})
export class XxxApisModule {}
```

**Rules:**
- Import `DmzModule` in every app root module
- Import only the libs the app actually uses (no speculative imports)
- Register event listeners as providers in the app module
- Never import app modules into lib modules

---

## 12. Recommended Technology Stack

| Category | Technology | Rationale |
|----------|-----------|-----------|
| Framework | NestJS 11+ | Structured DI, decorators, modular, TypeScript-native |
| Language | TypeScript 5.3+ | Type safety across the entire stack |
| Runtime | Node.js 20 LTS | LTS support, performance, native ESM |
| Database | PostgreSQL 14+ | ACID, JSONB, UUID, triggers, full-text search |
| ORM | Objection.js 3.x | Knex foundation, strong relations, no magic |
| Query Builder | Knex 3.x | Migrations, snake_case mapping, multi-DB |
| Cache | Redis 7 via IORedis | Session cache, rate limit state, job queues |
| HTTP Server | Express 5 (via NestJS) | Mature, extensible, broad middleware ecosystem |
| Auth | JWT + Passport.js | Stateless, well-understood, NestJS integration |
| Email | Nodemailer + MJML | SMTP/SES abstraction, responsive templates |
| File Storage | AWS S3 | Scalable, durable, pre-signed URL support |
| Validation | class-validator + class-transformer | Decorator-based, DTO-aligned |
| API Docs | @nestjs/swagger | Auto-generated from decorators, OpenAPI 3 |
| Error Tracking | Sentry | Exception capture, performance tracing |
| Process Manager | PM2 | Multi-app management, cluster mode, log aggregation |
| Testing | Jest + ts-jest | First-class TypeScript, snapshot, coverage |
| Linting | ESLint + Prettier | Consistent style, enforced via Husky pre-commit |
| Git Hooks | Husky + lint-staged | Auto-format on commit, prevent bad commits |

---

## 13. Project Bootstrap Checklist

When starting a new project of this type:

- [ ] Scaffold NestJS monorepo: `nest new <project> --strict`
- [ ] Configure `nest-cli.json` for monorepo mode
- [ ] Add path aliases to `tsconfig.json` for `@libs/*`
- [ ] Create `libs/dmz` — core framework (RestServer, RestController, Transformer, exceptions, cache)
- [ ] Create `libs/database` — BaseModel, DatabaseRepository<T>
- [ ] Create `libs/common` — shared interfaces and enums
- [ ] Create `libs/users` — UserModel, UserRepository, UsersLibService
- [ ] Create `libs/roles-and-permissions` — guards, decorators, models
- [ ] Create `libs/mailman` — email abstraction
- [ ] Set up `config/` with all namespaced loaders
- [ ] Set up `database/migrations/` with utility helpers (timestamps, triggers)
- [ ] Create first app (`apps/auth-apis`) with controllers, services, DTOs, transformers
- [ ] Configure PM2 ecosystem files for dev/qa/prod
- [ ] Set up `.env.example` with all required variable keys
- [ ] Configure Jest with `moduleNameMapper` for `@libs/*` aliases
- [ ] Set up Husky + lint-staged for pre-commit formatting
- [ ] Add Swagger to development bootstrap
- [ ] Add Sentry to `RestServer`

---

## 14. Do Not

- Import from `apps/` inside any `libs/` file
- Create circular dependencies between libs
- Call ORM/Knex directly in controllers or services
- Return raw Objection.js model objects from API endpoints (use Transformers)
- Put business logic in DTOs, transformers, or models
- Reference `process.env.*` outside `config/*.ts` files
- Add new libs for single-use code — generalize only when used by 2+ apps
- Mix domain concerns in a single service (e.g., auth + billing in one service)
- Create an app without a health endpoint at `/api/v<n>/health`
- Make schema changes without a corresponding migration file
