# Architecture — Tax Compass Backend

## Overview

Tax Compass Backend is a **NestJS monorepo** following clean architecture principles. It is organized as a set of independent microservice **apps** backed by shared **libs** that provide reusable modules for database access, authentication, caching, file storage, and email.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Requests                           │
└──────────────────────────┬───────────────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────────┐
         ▼                 ▼                       ▼
   ┌───────────┐   ┌──────────────┐   ┌───────────────────┐
   │ auth-apis │   │  chat-apis   │   │ file-services     │
   └─────┬─────┘   └──────┬───────┘   └─────────┬─────────┘
         │                │                      │
         └────────────────┼──────────────────────┘
                          │
              ┌───────────▼──────────┐
              │     Shared Libs      │
              │  dmz / database /    │
              │  users / roles /     │
              │  mailman / settings  │
              └───────────┬──────────┘
                          │
              ┌───────────▼──────────┐
              │      PostgreSQL      │
              │      Redis Cache     │
              │      AWS S3          │
              └──────────────────────┘
```

---

## Monorepo Layout

```
tax-compass-backend/
│
├── apps/                        # Independently runnable microservices
│   ├── auth-apis/               # Authentication, user management, OAuth
│   ├── chat-apis/               # AI-powered tax conversations
│   ├── control-panel/           # Admin dashboard API
│   ├── file-services/           # File upload and storage management
│   ├── media-services-job/      # Background media processing jobs
│   └── notification/            # Email notification delivery
│
├── libs/                        # Shared libraries (imported as @libs/xxx)
│   ├── dmz/                     # Core framework: REST server, validators, cache, exceptions
│   ├── database/                # ORM abstractions: BaseModel, DatabaseRepository<T>
│   ├── common/                  # Shared interfaces, enums, utilities
│   ├── users/                   # User models, repositories, UsersLibService
│   ├── roles-and-permissions/   # RBAC: guards, decorators, role/permission models
│   ├── companies/               # Company/team-member models and repositories
│   ├── settings/                # Application settings models
│   ├── mailman/                 # Email sending abstraction (Nodemailer wrapper)
│   ├── file-lib-service/        # File handling utilities
│   ├── location/                # Geographic data (countries, states, cities)
│   └── tax-campass/             # Tax domain models (conversations, messages, etc.)
│
├── config/                      # NestJS ConfigModule namespaced loaders
│   ├── app.ts                   # App metadata (port, env, name)
│   ├── auth.ts                  # JWT, OAuth, Firebase credentials
│   ├── database.ts              # PostgreSQL connection options
│   ├── cache.ts                 # Redis connection options
│   ├── storage.ts               # AWS S3 configuration
│   ├── notifications.ts         # Email service (SMTP/SES) config
│   ├── settings.ts              # Application-level settings
│   ├── localization.ts          # i18n configuration
│   └── index.ts                 # Exports all configs as array
│
├── database/
│   ├── migrations/              # Knex migration files (YYYYMMDDHHmmss_name.js)
│   └── utils/                   # Migration helpers (timestamps, triggers)
│
└── resources/
    └── lang/                    # Localization strings (en.json, etc.)
```

---

## Microservice Applications

### auth-apis
Handles all authentication and user management operations.

**Responsibilities:**
- Customer and admin signup/login/logout
- JWT access and refresh token issuance
- Email verification, password reset, MFA
- Google OAuth integration
- User profile management
- Outseta third-party sync via webhooks

**Key Modules:** `@libs/users`, `@libs/roles-and-permissions`, `@libs/mailman`

**Event Architecture:**
```
CustomerAuthService
    └─ emits via AuthEventEmitter:
           ├─ UserRegisteredEvent    → NotificationListener (sends verification email)
           │                        → AuditLogListener     (logs action)
           │                        → OutsetaSyncListener  (syncs with Outseta)
           ├─ EmailVerifiedEvent     → NotificationListener (sends welcome email)
           ├─ PasswordChangedEvent   → NotificationListener (sends change alert)
           └─ ...
```

### chat-apis
AI-powered tax conversation and advisory service.

**Responsibilities:**
- Manage user conversation sessions
- AI research queries
- Tax analysis and advice generation
- Copilot/AI platform integration

### control-panel
Admin management dashboard API.

**Responsibilities:**
- Admin-level user and system management
- Reporting and analytics endpoints
- Configuration management

### file-services
File upload, processing, and storage management.

**Responsibilities:**
- Multipart file upload handling
- File validation and metadata extraction
- AWS S3 integration for storage
- File serving and signed URL generation

### media-services-job
Background job processor for media operations.

**Responsibilities:**
- Async processing queue for media/file tasks
- Image processing (resize, compress via sharp)
- Long-running job coordination

### notification
Email delivery microservice.

**Responsibilities:**
- Transactional email sending via SMTP/AWS SES
- MJML template rendering
- Email queue management

---

## Shared Libraries

### `@libs/dmz` — Core Framework
The foundational layer for all apps. Marked `@Global()`.

| Export | Purpose |
|--------|---------|
| `RestServer` | Bootstraps Express with CORS, body parser (50 MB), Swagger, Sentry |
| `RestController` | Base controller with `transform()`, `collection()`, `paginate()` |
| `Transformer` | Abstract base for response shaping with include/relation support |
| `@Validate(Dto)` | Controller decorator applying validation pipe |
| `@Dto()` | Parameter decorator to inject validated DTO |
| `CacheService` | Redis cache abstraction with TTL, get, set, delete |
| `AppConfig` | Static accessor for `ConfigService` values |
| `GenericException` | Base custom exception |
| `ExceptionFilter` | Global filter normalizing all exceptions to standard format |

### `@libs/database` — ORM Layer

| Export | Purpose |
|--------|---------|
| `BaseModel` | Objection.js model base with `$load()`, `$forceLoad()` |
| `DatabaseRepository<T>` | Generic CRUD repository |
| `IRepository` | Repository interface contract |
| `CustomQueryBuilder` | Extended Knex query builder |

**Repository API:**
```typescript
repo.all(query?)                    // Get all records
repo.firstWhere(conditions)         // First matching record
repo.getWhere(conditions)           // All matching records
repo.create(payload)                // Insert and return
repo.update(model, payload)         // Update and return
repo.delete(model)                  // Soft or hard delete
repo.createOrUpdate(conditions, payload)
repo.transaction(async (trx) => {}) // Atomic operations
repo.chunk(size, callback)          // Process in batches
repo.bulkInsert(records)            // Batch insert
repo.attach(model, ids)             // Add relation IDs
repo.sync(model, ids)               // Replace all relation IDs
```

### `@libs/users` — User Domain

Provides `UsersLibService` which exposes all user-related repositories:
- `userRepo` — UserRepository
- `roleUserRepo` — RoleUserRepository
- `blockedUsersRepo` — BlockedUserRepository
- `customerContactsRepo` — CustomerContactsRepository

### `@libs/roles-and-permissions` — RBAC

| Export | Purpose |
|--------|---------|
| `JwtGuard` | Validates JWT, checks session freshness and user status |
| `ScopeGuard` | Enforces `@HasScopes()` permission requirements |
| `@HasScopes('scope/name')` | Applies both guards + requires scope |
| `@IsPublic()` | Marks endpoint as publicly accessible |
| `RefreshJwtGuard` | Validates refresh token for token renewal |
| `GoogleGuard` | Passport Google OAuth guard |

---

## Request Lifecycle

```
1. HTTP Request arrives
       │
2. RequestGuard (global)          — Validates request format
       │
3. JwtGuard (if @HasScopes used)  — Validates JWT, loads user
       │
4. ScopeGuard                     — Checks user has required permission
       │
5. ValidationPipe (@Validate)     — Validates DTO, runs custom validators
       │
6. Controller Method              — Extracts @Dto(), calls service
       │
7. Service                        — Business logic, orchestrates repos
       │
8. Repository                     — Database query via Objection.js/Knex
       │
9. Transformer (optional)         — Shapes response data
       │
10. res.success(data)             — Returns standard success envelope
       │
11. HTTP Response
    { success: true, data: {...}, message: "..." }
```

**Error Path:**
```
Exception thrown anywhere
       │
ExceptionFilter (global)
       │
{ success: false, message: "User-friendly message", data: null, errors: [...] }
```

---

## Data Flow: User Registration Example

```
POST /auth/customer/signup
  │
  ├─ @Validate(SignUpDto)
  │    └─ IsUnique email    → hits DB, rejects duplicates
  │    └─ IsUnique mobile   → hits DB, rejects duplicates
  │
  ├─ CustomerAuthService.register(inputs)
  │    ├─ userRepo.create({ ...payload })
  │    ├─ roleUserRepo.create({ userId, roleId })
  │    ├─ TokenService.generate(user)
  │    └─ AuthEventEmitter.userRegistered(user)
  │              │
  │              ├─ NotificationListener  → sends verification email
  │              ├─ AuditLogListener      → creates audit log entry
  │              └─ OutsetaSyncListener   → POSTs to Outseta API
  │
  └─ UserProfileTransformer.transform(user)
       └─ returns shaped user object
```

---

## Configuration System

All configuration is loaded via NestJS `ConfigModule.forRoot()` using named namespaces:

```typescript
// config/auth.ts
export default registerAs('auth', () => ({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.REFRESH_TOKEN_SECRET,
  googleAuth: { clientId: process.env.GOOGLE_CLIENT_ID, ... },
}));

// Usage anywhere:
const secret = this.configService.get<string>('auth.secret');
// OR via dmz utility:
const users = AppConfig.get('settings.users');
```

**Config Namespaces:**
| Namespace | File | Contents |
|-----------|------|---------|
| `app` | config/app.ts | Port, environment, app name |
| `auth` | config/auth.ts | JWT secrets, OAuth credentials |
| `database` | config/database.ts | PostgreSQL host/credentials |
| `cache` | config/cache.ts | Redis host/port |
| `storage` | config/storage.ts | AWS S3 bucket, credentials |
| `notifications` | config/notifications.ts | SMTP/SES credentials |
| `settings` | config/settings.ts | App feature settings |
| `localization` | config/localization.ts | Language defaults |

---

## Database Architecture

### ORM Stack
```
PostgreSQL
    └─ Knex (query builder + migrations)
        └─ Objection.js (ORM models + relations)
            └─ BaseModel (project base model)
                └─ XxxModel (entity models)
                    └─ DatabaseRepository<XxxModel> (repository)
```

### Migration Convention
```javascript
// database/migrations/20240101000000_create_users.js
exports.up = async function(knex) {
  await knex.raw(ON_UPDATE_TIMESTAMP_FUNCTION);
  await knex.schema.createTable('users', (table) => {
    table.bigIncrements('id').primary();
    table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()'));
    // ... columns
    timestamps(knex, table);    // created_at, updated_at
  });
  await knex.raw(onUpdateTrigger('users'));  // auto-update updated_at
};

exports.down = async function(knex) {
  await knex.schema.dropTable('users');
};
```

### Schema Conventions
- Every table has: `id` (bigint), `uuid` (uuid), `created_at`, `updated_at`
- Soft-delete: `deleted_at` column (only when product requirement exists)
- Tenant isolation: `company_id` or `user_id` foreign key where applicable
- Enums stored as: `smallint` with documented values in code constants
- Flexible metadata: `jsonb` columns (`preferences`, `meta`) for non-queryable data

### Core Tables
| Table | Module | Description |
|-------|--------|-------------|
| `users` | users | All users (customers, admins) |
| `roles` | roles-and-permissions | Role definitions |
| `permissions` | roles-and-permissions | Permission definitions |
| `role_user` | roles-and-permissions | User-to-role join |
| `permission_role` | roles-and-permissions | Permission-to-role join |
| `companies` | companies | Organization entities |
| `team_members` | companies | Company-to-user join |
| `settings` | settings | App-level settings |
| `conversations` | tax-campass | AI chat sessions |
| `messages` | tax-campass | Individual chat messages |
| `attachments` | tax-campass | File attachments |
| `folders` | tax-campass | User content folders |

---

## Security Architecture

### Authentication Flow
```
Client sends: Authorization: Bearer <accessToken>
                    OR
             Cookie: accessToken=<token>
                    │
             JwtGuard decodes token
                    │
             Validates: expiry, issued-after-last-login, user status
                    │
             Attaches user to request: req.user
```

### Authorization (RBAC)
```typescript
@HasScopes('customer/updateProfile')   // Requires this scope
@Post('/profile/update')
async update(@Dto() dto: UpdateProfileDto) { ... }

// Internally: JwtGuard + ScopeGuard run in sequence
// ScopeGuard checks: user.roles[].permissions[].name includes 'customer/updateProfile'
```

### Token Management
- **Access token:** Short-lived (configurable via `JWT_LIFETIME`)
- **Refresh token:** Longer-lived (configurable via `REFRESH_TOKEN_LIFETIME`)
- **Session invalidation:** Tokens issued before `lastLoginAt` are rejected
- **Storage:** Cookies (`httpOnly`, `sameSite`) + Authorization header support

---

## External Integrations

| Service | Purpose | Library |
|---------|---------|---------|
| AWS S3 | File storage | `@aws-sdk/client-s3` |
| AWS SES | Transactional email | `@aws-sdk/client-ses` |
| AWS SNS | Push notifications | `@aws-sdk/client-sns` |
| AWS Lambda | Serverless function invocation | `@aws-sdk/client-lambda` |
| Google Drive | Document storage/access | `@googleapis/drive` |
| Google OAuth | Social login | `passport-google-oauth20` |
| Outseta | Subscription management | Custom HTTP client |
| Sentry | Error tracking | `@sentry/node` |
| Redis | Session cache, rate limiting | `ioredis`, `cache-manager` |

---

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | NestJS | 11.x |
| Language | TypeScript | 5.3+ |
| Runtime | Node.js | 20.19.5 |
| Database | PostgreSQL | 12+ |
| ORM | Objection.js | 3.1.5 |
| Query Builder | Knex | 3.1.0 |
| Cache | Redis (IORedis) | 5.x |
| HTTP Server | Express | 5.x |
| Auth | JWT + Passport | latest |
| Email | Nodemailer + MJML | 7.x |
| Validation | class-validator | 0.14.2 |
| API Docs | Swagger (@nestjs/swagger) | 11.x |
| Error Tracking | Sentry | 10.x |
| Process Manager | PM2 | latest |
| Testing | Jest + ts-jest | 30.x |
| Linting | ESLint + Prettier | latest |
| Git Hooks | Husky + lint-staged | 8.x |
