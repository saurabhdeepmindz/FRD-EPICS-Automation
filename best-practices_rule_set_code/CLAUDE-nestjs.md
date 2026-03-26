# <Project Name> Backend — Claude Configuration

> **How to use this file:**
> Copy this file to the root of your new project as `CLAUDE.md`.
> Fill in every `<placeholder>` with your project's actual values.
> Delete all `>` instruction blocks once populated.

---

## Project Identity

**Name:** `<project-name>-backend`
**Type:** NestJS TypeScript Monorepo (Microservices)
**Stack:** NestJS 11+, TypeScript 5.3+, PostgreSQL, Objection.js/Knex, Redis, Node 20 LTS
**Purpose:** `<One sentence describing what this backend platform does and who it serves>`

> Example: "Backend API platform for [domain], providing user management,
> [core feature 1], [core feature 2], file services, and notifications."

---

## How to Use This Repo

Before writing any code, read in this order:

1. **[RULES.md](./claude-best-practices/RULES.md)** — Master engineering rules for this project
2. **[ARCHITECTURE.md](./claude-best-practices/ARCHITECTURE.md)** — System design, layers, and module map
3. **[docs/functional-landscape/FUNCTIONAL_LANDSCAPE.md]** — Full module inventory and layer structure
4. **[docs/actors/ACTORS.md]** — Actor definitions and RBAC model
5. **[docs/DB_SCHEMA.md](./claude-best-practices/docs/DB_SCHEMA.md)** — Database schema and migration conventions
6. **[docs/API_SPEC.md](./claude-best-practices/docs/API_SPEC.md)** — API design contracts and response formats
7. **Relevant Epic** in `docs/epics/` — Scope and acceptance criteria for the current work
8. **Relevant User Story** in `docs/stories/` — Specific behaviour, ACs, DoD

---

## Agile Planning Workflow (Epic-First)

> **Sequence:** Epics → User Stories → Code
> Never write code without a parent user story. Never write a user story without a parent epic.

### Reading Order Before Any Sprint

1. Read the project PRD — understand the feature landscape
2. Read or create the relevant Epic document — confirm scope and acceptance criteria
3. Create or refine the User Story — confirm INVEST compliance, 3+ ACs, story points
4. Only then begin implementation

### Agile Rules Files

| Layer | Document | Purpose |
|---|---|---|
| Generic framework | `docs/rules/functional-landscape-rules.md` | Layer structure, module identification, landscape template |
| Generic framework | `docs/rules/actor-roles-rules.md` | Actor types, RBAC design, role/permission model |
| Generic framework | `docs/rules/epic-rules.md` | Epic anatomy, lifecycle, sizing, INVEST |
| Generic framework | `docs/rules/user-story-rules.md` | Story format, Three Cs, GWT, splitting patterns |
| Generic framework | `docs/rules/testing-rules.md` | TDD workflow, pytest patterns, factory_boy, mocking, coverage |
| Project-specific | `<project-docs>/rules/epic-rules.md` | Project's epic catalog, phases, DoD |
| Project-specific | `<project-docs>/rules/user-story-rules.md` | Project actors, toolchain DoD, AC examples |
| Project-specific | `<project-docs>/rules/testing-rules.md` | Project test stack, domain-specific test patterns, CI gate |

---

## Documentation Structure Pattern

Every project should maintain the following documentation categories. The specific files vary per project — this is the pattern.

### Start Here
| Category | Content |
|---|---|
| **Functional Landscape** | Layer map of all system capabilities — modules, actors, scope boundaries |
| **Actor & Roles** | Actor definitions, RBAC model, actor–module matrix |
| **Ideas & Approach** | Solution concepts, tech stack rationale, POC scope |
| **PRD** | Epics, user stories, prioritised feature scope |
| **Execution Plan** | Phase-by-phase SDLC plan with task checklists |

### Architecture & Design
| Category | Content | Generic Template |
|---|---|---|
| **Architecture** | Project folder structure, logging, exception hierarchy | — |
| **HLD** | System diagram, deployment diagram, integration flow | [HLD.md](./HLD.md) |
| **LLD** | API endpoints, domain models, workflow nodes, background tasks | [LLD.md](./LLD.md) |
| **Design Patterns** | Key patterns in use (Repository, Strategy, Factory, State Machine, etc.) | [DesignPatterns.md](./DesignPatterns.md) |

### Living Specifications
| Category | Content |
|---|---|
| **API Spec** | Full API endpoints with request/response examples |
| **DB Schema** | Complete schema, column types, enums, migration index |

### Standards & Rules
| Category | Content | Generic Template |
|---|---|---|
| **Master Rules** | Non-negotiables, layer architecture, code quality checklist | — |
| **Coding Standards** | Class boilerplate, docstrings, naming, type hints | [CodingStandards-python.md](./CodingStandards-python.md) |
| **Coding Style** | Immutability, async patterns, file size, nesting limits | — |
| **Security** | Secrets management, validation, auth, rate limiting |
| **Testing** | TDD workflow, coverage threshold, test organisation | [testing-rules.md](./docs/rules/testing-rules.md) |
| **Development Execution** | Incremental build standard, vertical slices, increment anatomy, gates | [development-execution.md](./docs/rules/development-execution.md) |
| **API Design** | REST conventions, response format, versioning |
| **Data / DB** | Schema conventions, migrations, soft deletes |
| **Error & Observability** | Exception hierarchy, structured logging, correlation IDs |
| **DevOps & Deployment** | Docker, CI/CD, environment validation, deployment checklist |
| **Performance & Caching** | Cache patterns, N+1 prevention, connection pooling |
| **UI Wireframes** | HTML wireframe format, file naming (WF-NNN), screen anatomy, component library, API annotation pattern, DoD checklist | [ui-wireframe-rules.md](./docs/rules/ui-wireframe-rules.md) |

### Agile Planning
| Category | Content |
|---|---|
| **Epic Rules** (generic) | How to define and manage epics — `docs/rules/epic-rules.md` |
| **User Story Rules** (generic) | How to write and accept user stories — `docs/rules/user-story-rules.md` |
| **Epic Rules** (project) | Project-specific epic catalog and overrides |
| **User Story Rules** (project) | Project actors, toolchain DoD, AC examples |

### POC & Demo
| Category | Content |
|---|---|
| **POC Guide** | Local demo scope, demo script, setup instructions, success criteria |

---

## Project Structure at a Glance

> Update the tree below to match your actual apps and libs once scaffolded.

```
<project-name>-backend/
├── apps/                        # Microservice entry points
│   ├── auth-apis/               # Authentication, user management, OAuth
│   ├── <domain>-apis/           # Core business domain API
│   ├── control-panel/           # Admin dashboard API
│   ├── file-services/           # File upload and storage
│   ├── media-services-job/      # Background job processor
│   └── notification/            # Transactional email delivery
│
├── libs/                        # Shared libraries (imported as @libs/<name>)
│   ├── dmz/                     # Core framework: REST server, validators, exceptions, cache
│   ├── database/                # ORM abstractions: BaseModel, DatabaseRepository<T>
│   ├── common/                  # Shared interfaces, enums, utilities
│   ├── users/                   # User models, repositories, UsersLibService
│   ├── roles-and-permissions/   # RBAC guards, decorators, role/permission models
│   ├── <domain>/                # Domain-specific models and repositories
│   ├── mailman/                 # Email sending abstraction
│   ├── file-lib-service/        # File handling utilities
│   └── settings/                # Application settings
│
├── config/                      # NestJS ConfigModule namespaced loaders
│   ├── app.ts                   # Port, NODE_ENV, app name
│   ├── auth.ts                  # JWT secrets, OAuth credentials
│   ├── database.ts              # PostgreSQL connection
│   ├── cache.ts                 # Redis connection
│   ├── storage.ts               # AWS S3 configuration
│   ├── notifications.ts         # Email service configuration
│   └── index.ts                 # Exports all configs
│
├── database/
│   ├── migrations/              # Knex migration files
│   └── utils/                   # Migration helpers (timestamps, triggers)
│
├── resources/
│   └── lang/                    # Localization strings
│
├── claude-best-practices/       # Architecture, rules, API spec, DB schema docs
│   ├── RULES.md                 # Master engineering rules
│   ├── ARCHITECTURE.md          # System architecture reference
│   ├── CLAUDE-GENERIC.md        # This template (keep for future projects)
│   └── docs/
│       ├── API_SPEC.md          # API endpoint documentation
│       ├── DB_SCHEMA.md         # Database schema documentation
│       └── rules/               # Domain-specific rule files
│           ├── epic-rules.md    # Generic epic rules (Atlassian framework)
│           └── user-story-rules.md  # Generic user story rules (Atlassian framework)
│
└── CLAUDE.md                    # Active Claude configuration (this file, after filling in)
```

---

## Microservice Apps

> List each app, its port, and its primary responsibility.
> Remove rows that don't apply; add domain-specific apps as needed.

| App | Port | Responsibility |
|-----|------|---------------|
| `auth-apis` | 3001 | Authentication, user management, OAuth, sessions |
| `<domain>-apis` | 3002 | `<Core business domain description>` |
| `control-panel` | 3003 | Admin and management dashboard API |
| `file-services` | 3004 | File upload, validation, S3 storage |
| `media-services-job` | 3005 | Background media/file processing jobs |
| `notification` | — | Transactional email delivery (internal service) |

---

## Shared Libraries

> List each lib, its `@libs/<name>` alias, and its purpose.
> Remove rows that don't apply; add domain libs as needed.

| Library | Alias | Purpose |
|---------|-------|---------|
| `dmz` | `@libs/dmz` | Core framework (RestServer, validators, cache, exceptions) |
| `database` | `@libs/database` | ORM layer (BaseModel, DatabaseRepository<T>) |
| `common` | `@libs/common` | Shared interfaces, enums, utility functions |
| `users` | `@libs/users` | User models, repositories, UsersLibService |
| `roles-and-permissions` | `@libs/roles-and-permissions` | RBAC guards and decorators |
| `<domain>` | `@libs/<domain>` | `<Domain description>` |
| `mailman` | `@libs/mailman` | Email abstraction (Nodemailer/SES) |
| `file-lib-service` | `@libs/file-lib-service` | File handling utilities |
| `settings` | `@libs/settings` | Application settings store |

---

## Core Principles (Quick Reference)

- **Think architect first, implement second** — always infer the correct layer before writing code
- **Thin controllers, rich services, isolated repositories** — strict clean architecture
- **Repository pattern everywhere** — no direct ORM calls outside repository classes
- **DTO validation at boundaries** — use `@Validate(Dto)` on all controller methods that accept input
- **Event-driven side effects** — emit events; use listeners for email, audit logging, and external sync
- **Transformer layer** — shape all API responses via Transformer classes; never return raw ORM models
- **No hardcoded secrets** — all configuration through `config/*.ts` and `.env`
- **Immutability** — always create new objects; never mutate existing ones
- **Epic-first** — no story without an epic; no code without a story

---

## Layer Architecture

All projects enforce a strict layered architecture. Never skip layers.

```
Presentation Layer  →  Business Logic Layer  →  Data Access Layer  →  Persistence
  (Controllers)          (Services)              (Repositories)      (DB / ORM)
```

**NestJS-specific mapping:**

| Layer | Component | Rule |
|---|---|---|
| Presentation | Controllers + DTOs | Thin — routing, validation, response shaping only |
| Business Logic | Services | All domain logic — no direct DB/ORM calls |
| Data Access | Repositories | All database queries — no business logic |
| Transformers | Transformer classes | Shape API responses — never return raw models |
| Events | Event listeners | Decoupled side effects (email, audit, sync) |

---

## Operating Mode

You are the principal architect and senior engineer for this repository.

- Extend existing patterns before introducing new ones
- Respect file organisation conventions: `controllers / services / repositories / models / dto / transformers`
- Keep files focused: 200–400 lines typical, 800 lines maximum
- Write tests BEFORE implementation (TDD — mandatory)
- Run tests after every change; maintain ≥ 80% coverage
- Check `claude-best-practices/RULES.md` before generating any new module, service, or migration
- When a domain-specific rule file exists (e.g., `docs/rules/backend-nestjs.md`), follow it precisely
- When a domain-specific rules file exists, follow it precisely
- Prefer scalable, modular, production-ready code over shortcuts

---

## Code Quality Principles

These apply regardless of language, framework, or project:

### Immutability
Always create new objects — never mutate existing ones.

### File Size
- Target: 200–400 lines per file
- Maximum: 800 lines — extract utilities if exceeded
- Organise by feature/domain, not by type

### Function Size
- Maximum: 50 lines per function
- No deep nesting: maximum 4 levels

### Error Handling
- Handle errors explicitly at every level
- Never silently swallow errors
- Never expose internal stack traces to API consumers
- Log detailed context server-side; return user-friendly messages to clients

### Input Validation
- Validate all external input at system boundaries using DTOs
- Fail fast with clear error messages

### Configuration
- Never hardcode URLs, ports, secrets, or environment-specific values
- All environment values via `config/*.ts` loaded through `ConfigModule`
- Validate required config at startup — fail fast

---

## Testing Philosophy

- **Write tests first** (TDD — RED → GREEN → REFACTOR)
- **Minimum 80% test coverage** — enforced in CI
- **Three test types required:** unit, integration, E2E
- Fix implementation when tests fail — never weaken assertions
- Each test must be independent — no shared mutable state
- Mock external services in unit tests; use real DB in integration tests

---

## Git & Commit Standards

### Commit Message Format
```
<type>: <short description>

<optional body — why, not what>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Branch Strategy
- Feature branches from main/master
- PRs required for all changes — no direct pushes to main
- PR title ≤70 characters
- PR body includes: Summary, Test Plan, any breaking changes

---

## Security Checklist

Before any commit:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated via DTOs
- [ ] SQL injection prevention (parameterised queries via Knex/ORM)
- [ ] Authentication and authorisation guards applied
- [ ] Rate limiting on all public-facing endpoints
- [ ] Error messages do not leak internal details or stack traces
- [ ] CSRF protection enabled where applicable

---

## Environment Variables

> List the required `.env` variables for this project.
> Copy to `.env.example` with empty values before committing.

```bash
# Application
NODE_ENV=development
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=<your_project_name>
DB_USER=postgres
DB_PASSWORD=

# Authentication
JWT_SECRET=
JWT_LIFETIME=1h
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_LIFETIME=7d

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage (AWS S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=<your-aws-region>
S3_BUCKET=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Error Tracking
SENTRY_DSN=

# OAuth (if used)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# Add project-specific variables below
```

---

## Quick Commands

> Update app names and ports to match your project.

```bash
# Start a single app in watch mode
npm run app -- <app-name>

# Start all apps with PM2 (development)
npm run start:all:dev

# Start all apps with PM2 (QA)
npm run start:all:qa

# Start all apps with PM2 (production)
npm run start:all:prod

# Run database migrations
npx knex migrate:latest --knexfile knexfile.js

# Roll back last migration batch
npx knex migrate:rollback --knexfile knexfile.js

# Run all tests
npm run test

# Run tests with coverage report
npm run test:cov

# Lint and format
npm run lint && npm run format

# Build for production
npm run build
```

---

## Domain-Specific Context

> Fill in this section to give Claude the business context it needs to make
> good architectural decisions for your specific domain.

### Business Domain
`<Describe the core business problem this platform solves in 2-3 sentences>`

### User Roles
> List the user types and their primary capabilities.

| Role | Description | Key Permissions |
|------|-------------|----------------|
| `admin` | System administrator | Full platform access |
| `<role>` | `<Description>` | `<Key actions this role can perform>` |

### Core Domain Entities
> List the primary business entities and their relationships.

| Entity | Description | Key Relations |
|--------|-------------|--------------|
| `User` | Platform user | Has roles, belongs to company (optional) |
| `<Entity>` | `<Description>` | `<Relations>` |

### Key Business Rules
> List the non-obvious domain rules Claude must know to generate correct code.

- `<Rule 1>` — e.g., "Users must verify their email before accessing paid features"
- `<Rule 2>` — e.g., "A company can have at most one owner"
- `<Rule 3>` — e.g., "Archived records are hidden from listings but retained for audit"

### External Integrations
> List third-party services this project integrates with.

| Service | Purpose | Library / Method |
|---------|---------|-----------------|
| AWS S3 | File storage | `@aws-sdk/client-s3` |
| AWS SES | Transactional email | `@aws-sdk/client-ses` |
| Google OAuth | Social login | `passport-google-oauth20` |
| Sentry | Error tracking | `@sentry/node` |
| `<Service>` | `<Purpose>` | `<Library>` |

---

## Project-Specific Conventions

> Add any conventions or decisions that are unique to this project and
> would not be obvious from the generic rules files.

- `<Convention 1>` — e.g., "All monetary values are stored in cents as integers"
- `<Convention 2>` — e.g., "Soft-delete is used on <Entity> because of audit requirements"
- `<Convention 3>` — e.g., "The <domain>-apis app handles both X and Y to avoid an extra service"

---

## Documentation Maintenance Rules

- Update API Spec when any endpoint is added or changed
- Update DB Schema when any table or column is added or changed
- Update the relevant Epic's story table when a new story is created
- Update the Story Index when any story changes state
- Keep the Master Rules file as the single source of truth — domain rules files extend it, never contradict it
- When a new best practice is adopted that should apply to all future projects, update this file (`CLAUDE-GENERIC.md`) and `ai-development-guidelines/CLAUDE-Generic.md`
