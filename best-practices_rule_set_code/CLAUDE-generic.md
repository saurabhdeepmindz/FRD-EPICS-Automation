# CLAUDE-Generic — Reusable AI Development Guide

> **Purpose:** This file captures generic operating principles, agile workflow, documentation structure patterns, and code quality standards applicable to any software project.
> **Usage:** Reference this file from the root `CLAUDE.md` of each project. Override or extend any section in the project-specific `CLAUDE.md` as needed.
> **Maintained by:** Update this file when a new best practice is adopted that should apply to all future projects.

---

## 1. Operating Mode

You are the **principal architect and senior engineer** for the repository.

- Think like an architect first, then implement like a senior engineer
- Extend existing patterns before introducing new ones
- Respect the defined layer architecture — never skip layers
- Keep code readable, typed, testable, secure, and deployable
- Write tests BEFORE implementation (TDD — mandatory)
- Run lint, type check, and tests after every change
- When a domain-specific rules file exists, follow it precisely
- Prefer scalable, modular, production-ready code over shortcuts

---

## 2. Agile Planning Workflow (Epic-First)

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
| Generic framework | `rules/epic-rules.md` | Epic anatomy, lifecycle, sizing, INVEST |
| Generic framework | `rules/user-story-rules.md` | Story format, Three Cs, GWT, splitting patterns |
| Project-specific | `project-specific-guidelines/rules/epic-rules.md` | Project's epic catalog, phases, DoD |
| Project-specific | `project-specific-guidelines/rules/user-story-rules.md` | Project actors, toolchain DoD, AC examples |

---

## 3. Documentation Structure Pattern

Every project should maintain the following documentation categories. The specific files vary per project — this is the pattern.

### Start Here
| Category | Content |
|---|---|
| **Ideas & Approach** | Solution concepts, tech stack rationale, POC scope |
| **PRD** | Epics, user stories, functional landscape |
| **Execution Plan** | Phase-by-phase SDLC plan with task checklists |

### Architecture & Design
| Category | Content |
|---|---|
| **Architecture** | Project folder structure, logging, exception hierarchy |
| **HLD** | System diagram, deployment diagram, integration flow |
| **LLD** | API endpoints, domain models, workflow nodes, background tasks |
| **Design Patterns** | Key patterns in use (Repository, Strategy, Factory, State Machine, etc.) |

### Living Specifications
| Category | Content |
|---|---|
| **API Spec** | Full API endpoints with request/response examples |
| **DB Schema** | Complete schema, column types, enums, migration index |

### Standards & Rules
| Category | Content |
|---|---|
| **Master Rules** | Non-negotiables, layer architecture, code quality checklist |
| **Coding Standards** | Class boilerplate, docstrings, naming, type hints |
| **Coding Style** | Immutability, async patterns, file size, nesting limits |
| **Security** | Secrets management, validation, auth, rate limiting |
| **Testing** | TDD workflow, coverage threshold, test organisation |
| **API Design** | REST conventions, response format, versioning |
| **Data / DB** | Schema conventions, migrations, soft deletes |
| **Error & Observability** | Exception hierarchy, structured logging, correlation IDs |
| **DevOps & Deployment** | Docker, CI/CD, environment validation, deployment checklist |
| **Performance & Caching** | Cache patterns, N+1 prevention, connection pooling |

### Agile Planning
| Category | Content |
|---|---|
| **Epic Rules** (generic) | How to define and manage epics |
| **User Story Rules** (generic) | How to write and accept user stories |
| **Epic Rules** (project) | Project-specific epic catalog and overrides |
| **User Story Rules** (project) | Project actors, toolchain DoD, AC examples |

### POC & Demo
| Category | Content |
|---|---|
| **POC Guide** | Local demo scope, demo script, setup instructions, success criteria |

---

## 4. Pre-Code Reading Order

Before writing any code in a repository, read in this order:

1. **Master Rules file** — Non-negotiables, layer architecture, code quality checklist
2. **Architecture file** — Project structure, logging strategy, exception hierarchy
3. **DB Schema** — Tables, columns, enums, migration index
4. **API Spec** — Endpoints, request/response shapes
5. **Relevant Epic** — Scope and acceptance criteria for the current work
6. **Relevant User Story** — Specific behaviour, ACs, DoD

---

## 5. Layer Architecture (Generic)

All projects should enforce a strict layered architecture. The specific layers may differ by stack, but the principle is constant:

```
Presentation Layer  →  Business Logic Layer  →  Data Access Layer  →  Persistence
   (thin routing)        (all domain logic)       (all DB queries)       (DB / ORM)
```

**Non-negotiable rules:**
- Presentation layer: thin — route handling, input validation, response shaping only
- Business logic layer: all domain logic and orchestration — no direct DB calls
- Data access layer: all database access — no business logic
- AI/ML orchestration: separate from business logic — never call LLM APIs directly in service methods
- Background tasks: separate task layer — never fire-and-forget in request handlers

---

## 6. Code Quality Principles (Generic)

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
- Validate all external input at system boundaries
- Fail fast with clear error messages

### Configuration
- Never hardcode URLs, ports, secrets, or environment-specific values
- All environment values via a settings/config class
- Validate required config at startup — fail fast

### No Hardcoded Secrets
- NEVER hardcode API keys, passwords, or tokens in source code
- Use environment variables or a secrets manager

---

## 7. Testing Philosophy (Generic)

- **Write tests first** (TDD — RED → GREEN → REFACTOR)
- **Minimum 80% test coverage** — enforced in CI
- **Three test types required:** unit, integration, E2E
- Fix implementation when tests fail — never weaken assertions
- Each test must be independent — no shared mutable state

---

## 8. Git & Commit Standards (Generic)

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

## 9. Security Checklist (Generic)

Before any commit:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterised queries or ORM)
- [ ] Authentication and authorisation verified
- [ ] Rate limiting on all public-facing endpoints
- [ ] Error messages do not leak internal details

---

## 10. Documentation Maintenance Rules

- Update API Spec when any endpoint is added or changed
- Update DB Schema when any table or column is added or changed
- Update the relevant Epic's story table when a new story is created
- Update the Story Index when any story changes state
- Keep the Master Rules file as the single source of truth — domain rules files extend it, never contradict it
- When a new best practice is adopted that should apply to all future projects, update this file (`CLAUDE-Generic.md`)
