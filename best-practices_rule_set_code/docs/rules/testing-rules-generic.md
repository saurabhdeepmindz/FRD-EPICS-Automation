# Testing Rules — Generic Python Framework

> **Scope:** Framework-level testing rules for all Python projects.
> **Language:** Python 3.11+
> **Stack:** pytest, pytest-asyncio, pytest-cov, factory_boy, httpx, respx
> **Project-specific extensions:** Override in `project-specific-guidelines/rules/testing-rules.md`

---

## 1. Testing Philosophy

- **Write tests first** — TDD is mandatory: RED → GREEN → REFACTOR
- **Minimum 80% coverage** — enforced via CI gate (`pytest --cov-fail-under=80`)
- **Three test types required:** unit, integration, E2E
- **Fix implementation, never weaken assertions** — if a test catches a real bug, fix the code
- **Each test is independent** — no shared mutable state between tests
- **Mock at the boundary** — mock external HTTP, never mock your own business logic
- **Tests are first-class code** — same naming, type hints, and quality standards as production code

---

## 2. TDD Workflow (Mandatory)

```
Step 1 — Write the test (RED)
  - Write the test BEFORE writing implementation code
  - Run: pytest tests/path/test_file.py::test_function — it MUST fail
  - Confirm the failure is for the right reason (not an import error)

Step 2 — Write minimal implementation (GREEN)
  - Write the minimum code to make the test pass
  - Run: pytest — all tests should pass

Step 3 — Refactor (IMPROVE)
  - Clean up code while keeping all tests green
  - No behaviour changes during refactor
  - Verify coverage: pytest --cov=src --cov-report=term-missing
```

**Gate:** Never commit RED tests to a shared branch.

---

## 3. Test Types

### 3.1 Unit Tests

**Location:** `tests/unit/`
**Purpose:** Test a single function or class in complete isolation
**Rules:**
- All external dependencies (DB, Redis, HTTP, filesystem) are mocked
- Use `unittest.mock.patch` or `pytest-mock`'s `mocker` fixture
- One test file per production module: `src/services/foo.py` → `tests/unit/services/test_foo.py`
- Scope: pure logic, transformations, validation, error paths

```python
# Good: isolating the service from its repository dependency
async def test_lead_ingestion_deduplicates_by_company_name(mocker):
    mock_repo = mocker.AsyncMock()
    mock_repo.find_by_company.return_value = existing_lead_factory()
    service = LeadIngestionService(lead_repository=mock_repo)

    result = await service.ingest(duplicate_lead_dto)

    assert result.status == IngestStatus.DUPLICATE
    mock_repo.create.assert_not_called()
```

### 3.2 Integration Tests

**Location:** `tests/integration/`
**Purpose:** Test multiple layers together using a real test database and real Redis
**Rules:**
- Use a dedicated test database (separate from dev DB)
- Roll back all changes after each test via transaction rollback or fixtures
- Use `pytest-asyncio` for async test functions
- Test real HTTP endpoints via FastAPI's `AsyncClient` (not unit-mocked routes)
- Integration tests may be slower — mark them: `@pytest.mark.integration`

```python
# Good: testing the full HTTP → service → DB stack
@pytest.mark.integration
async def test_upload_csv_creates_leads(async_client: AsyncClient, db_session):
    with open("tests/fixtures/sample_leads.csv", "rb") as f:
        response = await async_client.post(
            "/api/v1/leads/upload",
            files={"file": ("leads.csv", f, "text/csv")},
            headers=auth_headers("manager"),
        )
    assert response.status_code == 202
    leads = await db_session.execute(select(LeadORM))
    assert leads.scalars().all().__len__() > 0
```

### 3.3 E2E Tests

**Location:** `tests/e2e/`
**Purpose:** Test complete business workflows from HTTP request to final state
**Rules:**
- Only cover critical happy paths and critical failure paths
- Use a real stack (Docker Compose test environment)
- Tag: `@pytest.mark.e2e` — excluded from normal CI, run in dedicated E2E stage

---

## 4. Test File Naming and Structure

### Naming Conventions

| Pattern | Example |
|---|---|
| Unit test file | `test_<module_name>.py` |
| Integration test file | `test_<router_or_service>_integration.py` |
| E2E test file | `test_<flow_name>_e2e.py` |
| Test function | `test_<action>_<expected_result>` |
| Parametrized test | `test_<action>[<case_name>]` |

```python
# Good naming
def test_create_lead_returns_201_when_valid_payload(): ...
def test_create_lead_returns_422_when_company_name_missing(): ...
def test_enrichment_cache_hit_skips_api_call(): ...

# Bad naming
def test_lead(): ...
def test_1(): ...
def test_api_works(): ...
```

### Test File Structure

```python
"""
Unit tests for src/services/lead_ingestion_service.py
"""
import pytest
from unittest.mock import AsyncMock, patch
from src.services.lead_ingestion_service import LeadIngestionService
from tests.factories.lead_factory import LeadDTOFactory


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_lead_repository() -> AsyncMock:
    repo = AsyncMock()
    repo.find_by_company.return_value = None  # no existing lead by default
    return repo


@pytest.fixture
def ingestion_service(mock_lead_repository) -> LeadIngestionService:
    return LeadIngestionService(lead_repository=mock_lead_repository)


# ── Happy path ────────────────────────────────────────────────────────────────

class TestLeadIngestionService:

    async def test_ingest_new_lead_returns_created_status(
        self, ingestion_service, mock_lead_repository
    ):
        dto = LeadDTOFactory.build()
        result = await ingestion_service.ingest(dto)
        assert result.status == IngestStatus.CREATED
        mock_lead_repository.create.assert_awaited_once()

    # ── Error paths ───────────────────────────────────────────────────────────

    async def test_ingest_duplicate_returns_duplicate_status(
        self, ingestion_service, mock_lead_repository
    ):
        existing = LeadDTOFactory.build()
        mock_lead_repository.find_by_company.return_value = existing
        result = await ingestion_service.ingest(existing)
        assert result.status == IngestStatus.DUPLICATE
```

---

## 5. Fixtures and conftest.py

### conftest.py Hierarchy

```
tests/
├── conftest.py              ← Shared fixtures for ALL tests (db_session, async_client, settings)
├── unit/
│   └── conftest.py          ← Unit-specific fixtures (mocker shortcuts, mock factories)
├── integration/
│   └── conftest.py          ← Integration-specific (real DB, real Redis, test transaction)
└── e2e/
    └── conftest.py          ← E2E-specific (full stack client, test data seeding)
```

### Core Fixtures (Root conftest.py)

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from src.main import app
from src.db.session import get_db
from src.core.config import get_settings

@pytest.fixture(scope="session")
def settings():
    return get_settings()

@pytest_asyncio.fixture(scope="function")
async def db_session(settings) -> AsyncGenerator[AsyncSession, None]:
    """Yields a test DB session that rolls back after each test."""
    engine = create_async_engine(settings.TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture(scope="function")
async def async_client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test client with real DB injected."""
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
```

### Fixture Scopes

| Scope | Use When |
|---|---|
| `function` (default) | Most fixtures — full isolation per test |
| `class` | Shared setup within a test class |
| `module` | Expensive read-only setup shared across a file |
| `session` | One-time setup: settings, DB schema creation |

---

## 6. Factory Pattern (factory_boy)

### When to Use Factories

- Always use factories to build test objects — never hard-code raw dicts in test bodies
- Factories define realistic defaults; tests override only what they care about

### Factory Structure

```python
# tests/factories/lead_factory.py
import factory
from factory import LazyFunction
from uuid import uuid4
from src.domain.lead import LeadCreateDTO
from src.db.models.lead_model import LeadORM, LeadStatus

class LeadDTOFactory(factory.Factory):
    class Meta:
        model = LeadCreateDTO

    company_name = factory.Sequence(lambda n: f"Acme Jewelers {n}")
    contact_email = factory.LazyAttribute(
        lambda obj: f"{obj.company_name.lower().replace(' ', '.')}@example.com"
    )
    country = "US"
    annual_revenue_usd = factory.Faker("random_int", min=100_000, max=5_000_000)


class LeadORMFactory(factory.alchemy.SQLAlchemyModelFactory):
    class Meta:
        model = LeadORM
        sqlalchemy_session_persistence = "commit"

    id = LazyFunction(uuid4)
    company_name = factory.Sequence(lambda n: f"Test Company {n}")
    status = LeadStatus.NEW
```

### Factory Rules

- All email domains must use `.example.com` — never real domains
- Factories must NOT generate real secrets, real API keys, or PII-like data
- Use `factory.Sequence` for fields requiring uniqueness (company names, emails)
- Use `factory.Faker` for realistic but fake data
- One factory file per domain entity

---

## 7. Mocking External HTTP (respx)

### Pattern for httpx clients

```python
import respx
import httpx

@respx.mock
async def test_apollo_enrichment_returns_contact_data():
    respx.post("https://api.apollo.io/v1/people/match").mock(
        return_value=httpx.Response(200, json={
            "person": {
                "email": "buyer@example.com",
                "title": "Head of Procurement",
            }
        })
    )
    client = ApolloClient(api_key="test-key")
    result = await client.enrich(company="Acme Jewelers", domain="example.com")
    assert result.email == "buyer@example.com"

@respx.mock
async def test_apollo_enrichment_raises_on_rate_limit():
    respx.post("https://api.apollo.io/v1/people/match").mock(
        return_value=httpx.Response(429, json={"error": "rate limit exceeded"})
    )
    with pytest.raises(EnrichmentRateLimitError):
        await ApolloClient(api_key="test-key").enrich(...)
```

### Mocking Rules

- Always mock at the HTTP transport layer with `respx` — not by patching the service class
- Test both success responses and error responses (4xx, 5xx, timeout)
- Use `httpx.TimeoutException` to test timeout handling
- Never let tests make real HTTP calls — use `respx.mock` as decorator or context manager

---

## 8. Async Testing

```python
# pyproject.toml — required configuration
[tool.pytest.ini_options]
asyncio_mode = "auto"          # all async test functions run automatically
testpaths = ["tests"]

# Mark async tests explicitly when asyncio_mode is not "auto"
@pytest.mark.asyncio
async def test_something_async():
    result = await some_async_function()
    assert result is not None
```

### Async Rules

- All service and repository methods are async — tests must be async too
- Use `pytest-asyncio` — do not use `asyncio.run()` inside tests
- Use `AsyncMock` for mocking coroutines (not `MagicMock`)
- Always `await` coroutine mocks: `mock_repo.create.assert_awaited_once_with(...)`

---

## 9. Parametrize

Use `@pytest.mark.parametrize` for testing the same logic with multiple inputs:

```python
@pytest.mark.parametrize("status,expected_eligible", [
    (LeadStatus.NEW, False),
    (LeadStatus.ENRICHED, True),
    (LeadStatus.NOT_ELIGIBLE, False),
])
async def test_lead_eligibility_by_status(status, expected_eligible, ingestion_service):
    lead = LeadDTOFactory.build(status=status)
    assert ingestion_service.is_eligible(lead) == expected_eligible
```

Rules:
- Prefer parametrize over copy-pasting test functions
- Name each case clearly using `ids=` parameter for long inputs
- Do not parametrize with more than ~10 cases — split into focused tests if needed

---

## 10. Coverage Configuration

```toml
# pyproject.toml
[tool.coverage.run]
source = ["src"]
omit = [
    "src/main.py",              # App bootstrap — tested via integration
    "src/db/migrations/*",      # Alembic migrations
    "src/core/config.py",       # Config — tested implicitly
    "*/__init__.py",
]
branch = true                   # Enable branch coverage

[tool.coverage.report]
fail_under = 80
show_missing = true
skip_covered = false
exclude_lines = [
    "pragma: no cover",
    "if TYPE_CHECKING:",
    "raise NotImplementedError",
    "@overload",
]
```

**Coverage rules:**
- 80% line + branch coverage is the minimum — not the target; aim for 90%+
- Coverage is measured on the `src/` package only — not on test files
- Do not `# pragma: no cover` your way to 80% — only use it for unreachable branches
- Domain models and Pydantic schemas count toward coverage via integration tests

---

## 11. Test Organisation Checklist

Before marking any feature complete:

- [ ] Unit tests written BEFORE implementation (TDD RED phase recorded)
- [ ] All unit tests pass (`pytest tests/unit/`)
- [ ] Integration tests cover all API endpoints for the feature
- [ ] `pytest --cov=src --cov-fail-under=80` passes
- [ ] No test uses a hardcoded real email, real API key, or real external URL
- [ ] No test makes a real HTTP call (all external calls mocked)
- [ ] Factories used for all domain object construction
- [ ] `ruff check tests/` passes — zero lint errors on test code
- [ ] `mypy tests/` passes — no type errors in test code
- [ ] Tests run in < 60 seconds for unit suite; < 5 minutes for integration suite

---

## 12. pytest Configuration

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
markers = [
    "unit: unit tests (fast, all mocked)",
    "integration: integration tests (requires DB and Redis)",
    "e2e: end-to-end tests (full stack, slow)",
]
filterwarnings = [
    "error",
    "ignore::DeprecationWarning",
    "ignore::PendingDeprecationWarning",
]
```

### Running Tests

```bash
# All tests
pytest

# Unit tests only (fast)
pytest tests/unit/ -v

# Integration tests only
pytest tests/integration/ -v -m integration

# With coverage
pytest --cov=src --cov-report=term-missing --cov-fail-under=80

# Single test function
pytest tests/unit/services/test_lead_ingestion.py::TestLeadIngestionService::test_ingest_new_lead_returns_created_status -v

# Watch mode (pytest-watch)
ptw tests/unit/ -- -v
```
