# Development Execution Rules — Incremental Build Standard

> **Scope:** Generic framework rule for all Python AI platform projects.
> **Principle:** Ship working, tested software at every increment — never half-wired features.
> **Project-specific execution plan:** See `project-specific-guidelines/EXECUTION_WORKFLOW.md` → Stage 6

---

## 1. Core Principles

### Vertical Slices — Not Horizontal Layers
Build **end-to-end thin slices** of functionality, not full layers. One increment delivers a complete, runnable feature — domain model → repository → service → router → test — not "all repositories for all entities".

```
WRONG (horizontal):   All DB models first → all repositories → all services → all tests
CORRECT (vertical):   One entity end-to-end, tested → next entity end-to-end, tested
```

### TDD at Every Increment
Every increment follows RED → GREEN → REFACTOR:
1. Write the test. Run it. It **must fail** (RED).
2. Write minimal implementation to make it pass (GREEN).
3. Refactor — clean up without changing behaviour (IMPROVE).
4. Verify coverage: `pytest --cov=src --cov-fail-under=80`

**Gate:** Do not commit to a shared branch with failing tests. Ever.

### Working Software at Every Checkpoint
Each increment ends with a **visible, verifiable checkpoint**:
- A curl command that returns a meaningful response, OR
- A pytest run that passes, OR
- A Docker health check that succeeds

If you cannot demonstrate the checkpoint, the increment is not done.

### Dependency Order
Always implement increments in dependency order. Later increments can only be started when all their dependencies are complete and their tests are passing.

---

## 2. Increment Anatomy

Every increment follows this exact structure:

```
Increment N — <Name> (<User Stories>)
│
├── Goal: One sentence — what can be demonstrated when done
│
├── Pre-conditions: Which earlier increments must be complete
│
├── Steps (in order):
│   ├── N.1  Domain model + Pydantic schema        → Unit test: validation rules
│   ├── N.2  ORM model                              → (no test — pure schema)
│   ├── N.3  Alembic migration                      → Test: migrate up + down cleanly
│   ├── N.4  Repository                             → Unit test: method contracts (mocked DB)
│   ├── N.5  Service                                → Unit test: business logic (mocked repo)
│   ├── N.6  Celery task (if async)                 → Unit test: task in eager mode
│   ├── N.7  API router                             → Integration test: HTTP → DB stack
│   └── N.8  UI page (if applicable)               → Manual smoke test
│
└── Checkpoint: Exact command/URL to demonstrate working software
```

**Rule:** Write the test for step N before writing the implementation code for step N.

---

## 3. Layer Build Order (Within Each Increment)

| Order | Layer | File Pattern | Test Type |
|---|---|---|---|
| 1 | Domain model | `src/domain/<entity>.py` | Unit — validation, enums, defaults |
| 2 | ORM model | `src/db/models/<entity>_model.py` | None (schema only) |
| 3 | Migration | `alembic/versions/NNN_*.py` | Manual: `alembic upgrade head && alembic downgrade -1` |
| 4 | Repository | `src/repositories/<entity>_repository.py` | Unit — method contracts with AsyncMock |
| 5 | Service | `src/services/<entity>_service.py` | Unit — business logic with mocked repo |
| 6 | Task | `src/tasks/<entity>_tasks.py` | Unit — eager mode, service mock |
| 7 | Router | `src/api/routers/<entity>.py` | Integration — AsyncClient + real test DB |
| 8 | UI | `src/ui/pages/<entity>.py` | Manual smoke test |

---

## 4. Test File Placement

For each production file, the test file mirrors the path:

| Production file | Unit test file |
|---|---|
| `src/domain/lead.py` | `tests/unit/domain/test_lead.py` |
| `src/services/lead_ingestion_service.py` | `tests/unit/services/test_lead_ingestion_service.py` |
| `src/repositories/lead_repository.py` | `tests/unit/repositories/test_lead_repository.py` |
| `src/tasks/ingestion_tasks.py` | `tests/unit/tasks/test_ingestion_tasks.py` |
| `src/api/routers/leads.py` | `tests/unit/api/test_leads_router.py` |

Integration tests cover flows that span layers:

| Flow | Integration test file |
|---|---|
| Lead upload → DB | `tests/integration/test_lead_upload_integration.py` |
| Enrichment → cache → contact stored | `tests/integration/test_enrichment_pipeline_integration.py` |

---

## 5. Increment 0 — Foundation (Generic Template)

Every project starts with Increment 0. The goal: **`docker compose up` starts all services; `GET /health` returns 200; CI is green.**

| Step | Artifact | Test |
|---|---|---|
| 0.1 | `.gitattributes` — LF line endings enforced | — |
| 0.2 | `pyproject.toml` — ruff, mypy, pytest, isort, coverage config | `ruff check src/` passes; `mypy src/` passes |
| 0.3 | `Dockerfile` — production container | `docker build` succeeds |
| 0.4 | `docker-compose.yml` — all services | `docker compose up` all healthy |
| 0.5 | `.env.example` — all required vars documented | — |
| 0.6 | `Makefile` — up, migrate, test-cov, check, dev, ui, worker | — |
| 0.7 | `src/core/config.py` — Pydantic Settings with startup validation | Unit: missing required var → ValidationError |
| 0.8 | `src/core/exceptions.py` — full exception hierarchy | Unit: each exception → correct HTTP status code |
| 0.9 | `src/core/logging.py` — structured JSON logger with trace_id | Unit: log output is valid JSON with required fields |
| 0.10 | `src/db/session.py` + `src/db/base.py` — async SQLAlchemy engine | Integration: `SELECT 1` succeeds |
| 0.11 | `alembic/` — baseline async migration | `alembic upgrade head` runs cleanly |
| 0.12 | `src/api/middleware.py` — trace_id injection | Unit: X-Trace-ID flows into response header |
| 0.13 | `src/api/routers/health.py` — `/health` + `/health/ready` | Unit: /health always 200; /health/ready → 503 when DB down |
| 0.14 | `src/main.py` — FastAPI app factory + router registration | Integration: full stack responds to health check |
| 0.15 | Full `src/` folder scaffold — empty `__init__.py` files | Import succeeds without errors |
| 0.16 | `.github/workflows/ci.yml` — lint + type check + test + coverage | CI green on push |

**Checkpoint:** `GET http://localhost:8000/health` → `{"status": "ok", "service": "<project>", "version": "1.0.0"}`

---

## 6. Increment Gate Checklist

Before marking any increment **Done**:

- [ ] All unit tests for this increment pass: `pytest tests/unit/ -v`
- [ ] All integration tests for this increment pass: `pytest tests/integration/ -m integration`
- [ ] Coverage gate passes: `pytest --cov=src --cov-fail-under=80`
- [ ] Lint passes: `ruff check src/ tests/`
- [ ] Type check passes: `mypy src/`
- [ ] No hardcoded secrets in any new file
- [ ] No real HTTP calls in tests (all mocked with respx)
- [ ] All test emails use `@example.com` domains
- [ ] Checkpoint demonstrated (curl / browser / pytest output)
- [ ] Commit made with conventional commit message: `feat: <increment description>`

---

## 7. Parallel vs Sequential Increments

Some increments can run in parallel once their shared dependencies are met:

```
Increment 0 (Foundation) — MUST complete first; blocks everything
    │
    ├── Increment 1 (Ingestion)
    │       └── Increment 2 (Matching)
    │               └── Increment 3 (Enrichment)
    │                       ├── Increment 4 (Outreach generation)
    │                       └── Increment 8 (Scoring)
    │
    └── Increment 7 (Auth/RBAC) — can start after Increment 0
```

**Rule:** Never start an increment whose pre-conditions are not fully passing (tests green).

---

## 8. Commit Strategy

One commit per sub-step (0.7, 0.8, …) or per increment, whichever produces cleaner history:

```bash
# Preferred: one commit per step
git commit -m "feat(config): add Pydantic Settings with startup validation (US-003)"
git commit -m "test(config): unit tests for Settings loading and validation (US-003)"

# Acceptable: one commit for a complete increment
git commit -m "feat(foundation): Increment 0 — project skeleton, config, health endpoints (US-001–005)"
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

---

## 9. Rollback Rule

If an increment fails its checkpoint after merge:
1. Do NOT patch forward with more commits to hide the failure
2. Revert the failing increment commit: `git revert <hash>`
3. Diagnose root cause in a branch
4. Re-implement with corrected approach
5. Re-run all gates before merging again
