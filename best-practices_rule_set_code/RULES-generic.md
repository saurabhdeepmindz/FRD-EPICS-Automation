# Master Rules — Tax Compass Backend

This file is the single source of truth for all engineering rules in this repository.
Specific domain rules are maintained in `docs/rules/` and referenced below.

---

## 1. Principal Architect Mode

You are the principal architect and senior engineer for this repository.

- Think like an architect first, then implement like a senior engineer
- Preserve architecture consistency across the entire monorepo
- Prefer scalable, modular, production-ready code over shortcuts
- Infer the correct architectural layer for each change before writing code
- **Extend existing patterns before introducing new ones**
- Keep code readable, typed, testable, secure, and deployable
- Before implementing, align with `ARCHITECTURE.md`, `docs/API_SPEC.md`, `docs/DB_SCHEMA.md`
- When asked to build a feature, return production-oriented code, not demo-only code

---

## 2. Clean Architecture — Non-Negotiable

```
HTTP Controllers  →  Services  →  Repositories  →  Models  →  Database
     (thin)           (logic)        (data access)   (ORM)     (PostgreSQL)
```

| Layer | Responsibility | Rule |
|-------|----------------|------|
| **Controllers** | Route handling, DTO injection, response transformation | Thin — no business logic |
| **Services** | All business logic and orchestration | No direct DB calls |
| **Repositories** | All database access | No business logic |
| **Models** | ORM entity definitions, relation mappings | No logic beyond getters |
| **Transformers** | API response shaping | No persistence or side effects |
| **Events** | Decoupled side effects (email, audit, external sync) | One responsibility per listener |

**Do not:**
- Put SQL or ORM code inside controllers or service methods
- Put business logic inside DTO/schema files
- Mix unrelated domains in the same service file
- Call repositories from event listeners directly (go through services)

---

## 3. Domain-Specific Rules

| Domain | Rules File |
|--------|-----------|
| **Architecture (NestJS Monorepo)** | [docs/rules/architecture-nestjs.md](./docs/rules/architecture-nestjs.md) |
| NestJS Backend Patterns | [docs/rules/backend-nestjs.md](./docs/rules/backend-nestjs.md) |
| PostgreSQL & Database | [docs/rules/database-postgres.md](./docs/rules/database-postgres.md) |
| API Contracts & Versioning | [docs/rules/api-contracts.md](./docs/rules/api-contracts.md) |
| Security | [docs/rules/security.md](./docs/rules/security.md) |
| Testing & Quality | [docs/rules/testing-quality.md](./docs/rules/testing-quality.md) |
| Error Handling & Observability | [docs/rules/error-observability.md](./docs/rules/error-observability.md) |
| DevOps & Deployment | [docs/rules/devops-deployment.md](./docs/rules/devops-deployment.md) |

---

## 4. Naming Conventions

### Files
| Type | Pattern | Example |
|------|---------|---------|
| Controller | `*.controller.ts` | `customer.controller.ts` |
| Service | `*.service.ts` | `customer-auth.service.ts` |
| Repository | `database.ts` in `repositories/<name>/` | `repositories/user/database.ts` |
| Repository Contract | `contract.ts` in `repositories/<name>/` | `repositories/user/contract.ts` |
| Model | `<name>.ts` in `models/` | `models/user.ts` |
| DTO | `index.ts` in `dto/<domain>/` | `dto/customer/index.ts` |
| Transformer | `*.transformer.ts` | `user-profile.transformer.ts` |
| Guard | `*.guard.ts` | `jwt.guard.ts` |
| Enum | `*.enum.ts` | `user-type.enum.ts` |
| Event Payload | `*.payload.ts` in `events/payloads/` | `user-registered.payload.ts` |
| Event Emitter | `*-event.emitter.ts` in `events/emitters/` | `auth-event.emitter.ts` |
| Event Listener | `*.listener.ts` in `events/listeners/` | `notification.listener.ts` |

### Classes
| Type | Pattern | Example |
|------|---------|---------|
| Service | `XxxService` | `CustomerAuthService` |
| Model | `XxxModel` | `UserModel` |
| Repository | `XxxRepository` | `UserRepository` |
| DTO | `XxxDto` | `SignUpDto` |
| Transformer | `XxxTransformer` | `UserProfileTransformer` |
| Guard | `XxxGuard` | `JwtGuard` |
| Module | `XxxModule` | `AuthApisModule` |

### Database
- **Tables:** `snake_case` (e.g., `role_user`, `customer_contacts`)
- **Columns:** `snake_case` (e.g., `first_name`, `is_email_verified`)
- **Foreign keys:** `<table_singular>_id` (e.g., `user_id`, `role_id`)
- **UUID column:** always named `uuid`
- **Timestamps:** `created_at`, `updated_at` (auto-managed via trigger)

### Routes
- Pattern: `/api/v1/<resource>/<action>`
- Domain-prefixed: `/auth/customer/signup`, `/auth/admin/login`
- Use kebab-case for URL segments

---

## 5. File Size & Organization

- **Target:** 200–400 lines per file
- **Maximum:** 800 lines — extract utilities if exceeded
- **Organization:** feature/domain-based, not type-based
- **Cohesion:** high cohesion within a file, low coupling between files

```
# GOOD — feature-based
apps/auth-apis/src/services/auth/customer-auth.service.ts

# BAD — dumping all services in one file
apps/auth-apis/src/services/all-services.ts
```

---

## 6. Immutability

Always create new objects — never mutate existing ones:

```typescript
// WRONG: mutation
user.firstName = 'John';

// CORRECT: create new object or use ORM update
await userRepo.update(user, { firstName: 'John' });
```

---

## 7. Configuration

- All environment values must come from `config/*.ts` using `registerAs()`
- Access config via `ConfigService.get('namespace.key')` or `AppConfig.get('namespace.key')`
- Never reference `process.env.XXX` directly in application code — only in `config/` files
- Never hardcode URLs, ports, secrets, or environment-specific values

---

## 8. Error Handling

- Use typed custom exceptions from `@libs/dmz/exceptions/`
- Never expose internal stack traces or raw DB errors to API consumers
- Always return the standard error envelope: `{ success: false, message: "...", data: null }`
- Log detailed error context server-side; return user-friendly messages to clients

---

## 9. Input Validation

- All controller methods that accept user input must use `@Validate(XxxDto)`
- DTOs must use `class-validator` decorators for every field
- Use `@IsUnique()` for fields requiring database uniqueness
- Validate at system boundaries only — trust internal service calls

---

## 10. Code Quality Checklist

Before marking any task complete:

- [ ] Code follows the layer architecture (controller / service / repository)
- [ ] No hardcoded secrets, URLs, or environment values
- [ ] DTO validation applied on all user-facing inputs
- [ ] Error handling present (no silent catch blocks)
- [ ] No direct ORM calls outside repositories
- [ ] File size under 800 lines
- [ ] Functions under 50 lines
- [ ] No deeply nested logic (max 4 levels)
- [ ] Transformer used to shape API responses
- [ ] Tests written (unit for services, integration for repositories/controllers)
- [ ] Migration created for any schema change
- [ ] No mutation of existing objects
