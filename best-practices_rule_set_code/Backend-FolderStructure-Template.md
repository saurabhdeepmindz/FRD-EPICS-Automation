# Backend Folder Structure Template

> **Purpose:** This document is the **authoritative folder & file structure** that any AI/code generator MUST follow when scaffolding or extending backend code for any module in this project. It is derived from the project's standard backend framework (NestJS-style) and is module-agnostic — every functional module reuses the same shape.
>
> **How to use:**
> 1. Replace the literal token `prototype` with the actual module name (e.g., `research-apis`, `user-management`, `billing`).
> 2. Replace the literal token `prototype` in filenames with the module's slug (e.g., `research.controller.ts`, `research.service.ts`).
> 3. Create only the files relevant to the module being generated, but **do not deviate** from the directory layout — every module folder follows this exact shape.
> 4. Cross-cutting concerns (Redis, S3, locations, mail, RBAC) live under `lib/`, never inside a module.

---

## 1. Top-Level Layout

```
<backend-root>/
├── apps/                        # All functional/business modules live here
│   └── <module-name>/           # One folder per module (e.g., research-apis)
│       └── src/                 # Source folder for the module
│           ├── module.ts        # NestJS module declaration for this module
│           ├── main.ts          # Wires the module to the router/port (e.g., 3000/4000)
│           ├── interface/       # Public contracts exposed to FE / 3rd parties
│           ├── controller/      # HTTP/route controllers
│           ├── service/         # Core business logic
│           ├── dto/             # Data Transfer Objects (create/update/etc.)
│           ├── enum/            # Enums for this module
│           ├── utils/           # Module-scoped utilities
│           ├── transformer/     # DB → API response shape transformers
│           ├── guards/          # Module-scoped role/permission guards
│           └── constants/       # Module-scoped constants
├── config/                      # Environment-driven app configuration
│   ├── app.ts
│   └── auth.ts                  # ...and other domain-specific config files
├── database/                    # Schema migrations + DB-level utilities
│   ├── migration/
│   │   └── create.<table>.js    # One file PER table
│   └── utilities/
│       ├── index.js
│       └── location.sql         # Standard master data SQL
└── lib/                         # Cross-module reusable code
    ├── common/                  # Generic helpers shared across modules
    ├── database/                # Shared DB helpers
    ├── dmz/                     # External integrations: Redis, S3, AWS, etc.
    ├── location/                # Country / state / city utilities
    ├── mailman/                 # Email/notification utilities
    └── rolesandpermission/      # Roles, privileges, RBAC tables/utilities
```

---

## 2. Module Skeleton (apps/&lt;module-name&gt;/src/)

Every module folder under `apps/` MUST follow this exact skeleton. The placeholder `prototype` represents the module name.

| Path | Type | Purpose |
|------|------|---------|
| `apps/` | folder | Top-level container for **all** backend functional modules. |
| `apps/<module>/` | folder | One functional module (the word `prototype` in the source table is a placeholder for the module name, e.g., `research-apis`). |
| `apps/<module>/src/` | folder | Source root of the module. |
| `apps/<module>/src/module.ts` | file | NestJS `@Module(...)` declaration that wires controllers, services, providers for this module. |
| `apps/<module>/src/main.ts` | file | Bootstraps the module and connects it to the router on a specific port (e.g., 3000, 4000). |

### 2.1 `interface/`
Exposes the module's public contracts to the frontend and 3rd-party integrations.

| Path | Purpose |
|------|---------|
| `interface/` | Folder of TypeScript interfaces that define the module's outward shape. |
| `interface/<name>.interface.ts` | One interface file per contract (e.g., `researchresponse.interface.ts`). |

### 2.2 `controller/`
HTTP entry points (routes/handlers).

| Path | Purpose |
|------|---------|
| `controller/` | Folder for the module's controllers. |
| `controller/<module>.controller.ts` | The controller file (e.g., `research.controller.ts`). Handles routing, request validation hand-off, and delegates to the service. |

### 2.3 `service/`
Business logic.

| Path | Purpose |
|------|---------|
| `service/` | Folder for the module's services. |
| `service/<module>.service.ts` | Core business-logic class (e.g., `research.service.ts`). All real work happens here; controllers should be thin. |

### 2.4 `dto/`
Data Transfer Objects used for request/response payload shaping and validation.

| Path | Purpose |
|------|---------|
| `dto/` | Folder of DTOs. |
| `dto/create.dto.ts` | DTO for **create** operations. |
| `dto/update.dto.ts` | DTO for **update** operations. |
| `dto/<other>.dto.ts` | Additional DTOs as needed (search, filter, response wrappers, etc.). |

### 2.5 `enum/`
Enumerations scoped to this module.

| Path | Purpose |
|------|---------|
| `enum/` | Folder for enums. |
| `enum/<name>.enum.ts` | One enum per file (e.g., `research-status.enum.ts`). |

### 2.6 `utils/`
Helper functions specific to this module.

| Path | Purpose |
|------|---------|
| `utils/` | Folder of module-scoped utilities. |
| `utils/<module>.util.ts` | Utility file containing helpers used only inside this module (e.g., `research.util.ts`). |

### 2.7 `transformer/`
Maps raw DB rows / internal models into the shape the FE or 3rd parties expect.

| Path | Purpose |
|------|---------|
| `transformer/` | Folder for transformers. |
| `transformer/transformer.ts` | Transformer functions/classes. |

### 2.8 `guards/`
NestJS guards that enforce role/permission checks for this module.

| Path | Purpose |
|------|---------|
| `guards/` | Folder for guards. |
| `guards/role.guard.ts` | Guard that validates the user's role/privileges for module routes. |

### 2.9 `constants/`
Constants scoped to this module.

| Path | Purpose |
|------|---------|
| `constants/` | Folder for constant definitions. |
| `constants/<module>.constants.ts` | Constants file (e.g., `research.constants.ts`). |

---

## 3. `config/`
Application-wide configuration files. Each file reads a logical group of variables from `.env` and exports a typed config object.

| Path | Purpose |
|------|---------|
| `config/app.ts` | Loads global app-level env vars (port, env name, base URLs, feature flags, etc.). |
| `config/auth.ts` | Loads authentication-related env vars (JWT secret, token TTL, OAuth IDs, etc.). |
| `config/<domain>.ts` | Add additional config files per concern (db, cache, mail, storage, …). |

> **Rule:** No source file outside `config/` should read `process.env` directly — always import from a config module.

---

## 4. `database/`
Owns the database schema lifecycle and shared SQL/JS utilities.

### 4.1 `database/migration/`
Schema migrations. **One file per table.**

| Path | Purpose |
|------|---------|
| `database/migration/` | Folder of migration scripts that create/alter tables. |
| `database/migration/create.<table>.js` | Creates exactly one table. If you have N tables, you have N files. Never bundle multiple tables into one migration. |

### 4.2 `database/utilities/`
DB-level helpers (functions, seeds, master data SQL).

| Path | Purpose |
|------|---------|
| `database/utilities/` | Folder of database utility files. |
| `database/utilities/index.js` | Central entry that exposes the available DB functions/utilities. |
| `database/utilities/location.sql` | Standard master-data SQL (e.g., country/state/city seeds). |

---

## 5. `lib/` — Cross-Module Reusable Code
Anything that is shared across **two or more** modules must live in `lib/`. Modules import from `lib/`, never from each other.

| Sub-folder | Purpose |
|------------|---------|
| `lib/common/` | Generic helpers / utilities reused everywhere (logging wrappers, date utils, generic types, etc.). |
| `lib/database/` | DB helpers reused across modules (query builders, repository base classes, connection helpers). |
| `lib/dmz/` | Integrations with external systems — Redis (caching), S3 (storage), AWS clients, etc. |
| `lib/location/` | Country / state / city utilities used globally. |
| `lib/mailman/` | Email-sending and notification helpers. |
| `lib/rolesandpermission/` | Roles, permissions, and privilege definitions and enforcement helpers. |

---

## 6. Naming Conventions (MUST FOLLOW)

| Element | Convention | Example |
|---------|------------|---------|
| Module folder under `apps/` | kebab-case, business-domain name | `research-apis`, `user-management` |
| Module slug used in filenames | kebab- or dot-segmented short name | `research`, `user`, `billing` |
| Controller file | `<slug>.controller.ts` | `research.controller.ts` |
| Service file | `<slug>.service.ts` | `research.service.ts` |
| DTO files | `<purpose>.dto.ts` | `create.dto.ts`, `update.dto.ts` |
| Enum files | `<name>.enum.ts` | `research-status.enum.ts` |
| Interface files | `<name>.interface.ts` | `researchresponse.interface.ts` |
| Guard files | `<name>.guard.ts` | `role.guard.ts` |
| Constants file | `<slug>.constants.ts` | `research.constants.ts` |
| Util file | `<slug>.util.ts` | `research.util.ts` |
| Migration file | `create.<table>.js` | `create.user.js` |

---

## 7. Code Generation Rules for AI

When generating backend code for any new or existing module, the AI MUST:

1. **Place files exactly per Section 2** — no flat file dumps, no merging folders.
2. **One responsibility per file:** controllers do not contain business logic; services do not contain DB schema; DTOs do not contain logic.
3. **Use placeholder substitution:** wherever the source/template uses `prototype`, substitute the actual module slug.
4. **One migration = one table** under `database/migration/`.
5. **No direct `process.env` access** outside `config/`.
6. **Cross-module reuse goes into `lib/`** — never into another module.
7. **Always create `module.ts` and `main.ts`** for a new module so it can be wired into the router.
8. **Guards, transformers, utils, constants, enums** — create the folder only if at least one file is generated for it; otherwise omit the folder to avoid empty noise.
9. **Filenames use lowercase + dots** (`research.controller.ts`), folders use lowercase (`controller/`, `dto/`).
10. **Public contracts go in `interface/`** so FE/3rd-party consumers can depend on stable types.

---

## 8. Quick Reference (canonical tree for one module)

```
apps/research-apis/
└── src/
    ├── module.ts
    ├── main.ts
    ├── interface/
    │   └── researchresponse.interface.ts
    ├── controller/
    │   └── research.controller.ts
    ├── service/
    │   └── research.service.ts
    ├── dto/
    │   ├── create.dto.ts
    │   └── update.dto.ts
    ├── enum/
    │   └── research-status.enum.ts
    ├── utils/
    │   └── research.util.ts
    ├── transformer/
    │   └── transformer.ts
    ├── guards/
    │   └── role.guard.ts
    └── constants/
        └── research.constants.ts
```

This is the canonical shape. Every new module replicates it.
