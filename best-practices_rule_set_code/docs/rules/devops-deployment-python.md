# DevOps & Deployment Rules

## Environments

| Environment | Purpose | `.env` File |
|---|---|---|
| `development` | Local dev — all services via Docker Compose | `.env.development` |
| `test` | CI test runs — isolated DB + Redis | `.env.test` |
| `staging` | Pre-production validation | `.env.staging` (secrets from vault) |
| `production` | Live system | `.env.production` (secrets from vault) |

Never use development config in production. Always validate `APP_ENV` at startup.

---

## Environment Variable Validation at Startup

All required environment variables MUST be validated at startup. The app must **fail fast** with a clear error — never silently run with missing config.

```python
# src/core/config.py
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    """Application configuration. Validated at startup — missing vars cause immediate failure."""

    # Application
    APP_ENV: str
    APP_VERSION: str = "1.0.0"
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str

    # Database — required, no defaults
    DATABASE_URL: str
    REDIS_URL: str

    # AI Providers — required
    OPENAI_API_KEY: str

    # Enrichment — required
    APOLLO_API_KEY: str

    # Outreach — required
    SENDGRID_API_KEY: str
    SENDGRID_FROM_EMAIL: str

    # Optional with defaults
    HUMAN_REVIEW_REQUIRED: bool = True
    MAX_BATCH_SIZE: int = 500
    INVENTORY_MATCH_MIN_CARAT: float = 0.50

    @field_validator("APP_ENV")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        allowed = {"development", "test", "staging", "production"}
        if value not in allowed:
            raise ValueError(f"APP_ENV must be one of {allowed}, got '{value}'")
        return value

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Docker — Multi-Stage Build

```dockerfile
# Dockerfile
# Stage 1: Build — install all dependencies including dev
FROM python:3.11-slim AS builder
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir build pip-tools && \
    pip-compile pyproject.toml -o requirements.txt && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Production — lean image, no dev deps
FROM python:3.11-slim AS production
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Non-root user — never run as root
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY src/ ./src/

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

```
# .dockerignore
__pycache__/
*.pyc
*.pyo
.env
.env.*
!.env.example
.git/
.gitignore
tests/
.pytest_cache/
htmlcov/
*.egg-info/
dist/
```

**Rules:**
- Always multi-stage builds — production images must NOT contain dev deps
- Run as non-root user (`appuser`)
- Never bake `.env` files into images — pass at runtime via `--env-file` or secrets
- One process per container — FastAPI, Celery worker, and Celery beat are separate services
- Health check MUST be defined in Dockerfile

---

## Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: "3.9"

services:
  fastapi:
    build: .
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./src:/app/src   # Hot reload in dev

  streamlit:
    build:
      context: .
      dockerfile: Dockerfile.streamlit
    ports:
      - "8501:8501"
    env_file: .env
    depends_on:
      - fastapi

  celery_worker:
    build: .
    command: celery -A src.tasks.celery_app worker --loglevel=info -Q default,enrichment,outreach
    env_file: .env
    depends_on:
      - redis
      - postgres

  celery_beat:
    build: .
    command: celery -A src.tasks.celery_app beat --loglevel=info
    env_file: .env
    depends_on:
      - redis

  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: jewelry_ai
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: admin
      N8N_BASIC_AUTH_PASSWORD: admin
    volumes:
      - n8n_data:/home/node/.n8n

  mlflow:
    image: ghcr.io/mlflow/mlflow:latest
    ports:
      - "5000:5000"
    command: mlflow server --host 0.0.0.0 --port 5000 --backend-store-uri sqlite:///mlflow.db
    volumes:
      - mlflow_data:/mlflow

volumes:
  postgres_data:
  n8n_data:
  mlflow_data:
```

---

## Makefile Commands

```makefile
# Makefile — common dev commands

.PHONY: up down build test lint format migrate

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

shell:
	docker-compose exec fastapi bash

# Database
migrate:
	docker-compose exec fastapi alembic upgrade head

migrate-rollback:
	docker-compose exec fastapi alembic downgrade -1

migrate-new:
	docker-compose exec fastapi alembic revision --autogenerate -m "$(name)"

# Testing
test:
	docker-compose exec fastapi pytest tests/ -v

test-cov:
	docker-compose exec fastapi pytest tests/ --cov=src --cov-report=html --cov-fail-under=80

# Code quality
lint:
	ruff check src/ tests/

format:
	ruff format src/ tests/

typecheck:
	mypy src/

check: lint typecheck test-cov

# Celery
worker:
	celery -A src.tasks.celery_app worker --loglevel=info

beat:
	celery -A src.tasks.celery_app beat --loglevel=info

# App
dev:
	uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

ui:
	streamlit run src/ui/app.py
```

---

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: jewelry_ai_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7.2-alpine
        options: --health-cmd "redis-cli ping" --health-interval 10s

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"
      - run: pip install -r requirements.txt
      - run: ruff check src/ tests/               # Lint
      - run: mypy src/                              # Type check
      - run: alembic upgrade head                   # Run migrations
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/jewelry_ai_test
      - run: pytest tests/ --cov=src --cov-fail-under=80  # Tests + coverage
        env:
          APP_ENV: test
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/jewelry_ai_test
          REDIS_URL: redis://localhost:6379/1
```

**Pipeline gates — all must pass before merge to `main`:**
1. Ruff lint — zero errors
2. mypy type check — zero errors
3. Tests pass — coverage ≥ 80%
4. Migrations run cleanly

---

## Deployment Checklist

```bash
# Before every deployment:
1. [ ] Run linting: ruff check src/
2. [ ] Run type check: mypy src/
3. [ ] Run tests: pytest --cov=src --cov-fail-under=80
4. [ ] Build Docker image: docker build -t jewelry-ai:latest .
5. [ ] Run DB migrations: alembic upgrade head
6. [ ] Start/restart services: docker-compose up -d
7. [ ] Verify health: curl http://localhost:8000/api/v1/health
8. [ ] Smoke test: upload a small CSV, verify leads appear
```

---

## Health & Monitoring

Every service endpoint must respond at `/api/v1/health`.

Monitor these signals:
- HTTP 5xx error rate — alert if > 1% over 5 minutes
- Response time p95 — alert if > 2 seconds
- Celery queue depth — alert if > 500 pending tasks
- DB connection pool exhaustion — alert if pool at capacity
- Redis memory usage — alert if > 80%

---

## Windows Developer Setup

All development on Windows is supported via **Docker Desktop + Git Bash** (recommended) or **WSL2** (full Linux environment). The project runs entirely inside Docker containers — the host OS does not affect runtime behavior.

### Requirements on Windows

| Tool | Version | Notes |
|---|---|---|
| Docker Desktop | Latest | Enable WSL2 backend in Settings → General |
| Git for Windows | Any | Provides Git Bash — use for all `make` commands |
| Python 3.11+ | 3.11+ | For running scripts outside Docker |
| VS Code | Any | Recommended editor with Docker + Python extensions |

### Shell Recommendation

| Scenario | Recommended Shell |
|---|---|
| `make` commands | **Git Bash** (bundled with Git for Windows) |
| Full Linux tooling | **WSL2** (Ubuntu from Microsoft Store) |
| Docker management | **PowerShell** or Git Bash |
| Python scripts outside Docker | **PowerShell** or CMD |

### Windows-Specific `make` Targets

`make` works natively in **Git Bash**. If you cannot use Git Bash, use the PowerShell equivalents:

| `make` command | PowerShell equivalent |
|---|---|
| `make up` | `docker compose up --build -d` |
| `make down` | `docker compose down` |
| `make migrate` | `docker compose exec fastapi alembic upgrade head` |
| `make test-cov` | `docker compose exec fastapi pytest --cov=src --cov-report=term-missing` |
| `make lint` | `docker compose exec fastapi ruff check src tests` |
| `make typecheck` | `docker compose exec fastapi mypy src` |
| `make dev` | `uvicorn src.main:app --reload --host 0.0.0.0 --port 8000` |
| `make ui` | `streamlit run src/ui/app.py` |
| `make worker` | `celery -A src.tasks.celery_app worker --loglevel=info` |

### Windows Virtual Environment

```powershell
# Create
python -m venv .venv

# Activate (PowerShell)
.\.venv\Scripts\Activate.ps1

# Activate (CMD)
.\.venv\Scripts\activate.bat

# If PowerShell script execution is blocked:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Line Endings

Windows uses CRLF by default. The project enforces LF for all source files. Add `.gitattributes` at the root:

```gitattributes
# .gitattributes
* text=auto eol=lf
*.py text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.toml text eol=lf
*.env* text eol=lf
Makefile text eol=lf
```

This ensures consistent line endings regardless of whether the developer is on Windows, macOS, or Linux.

### Path Separators in Python Code

Always use `pathlib.Path` — never string concatenation with `/` or `\`:

```python
# CORRECT — works on Windows and Linux
from pathlib import Path
data_dir = Path("scripts") / "demo_data" / "demo_leads.csv"

# WRONG — breaks on Windows
data_dir = "scripts/demo_data/demo_leads.csv"
```

### Opening URLs from Scripts

Scripts that open a browser must use the `webbrowser` standard library — not `open` (macOS only):

```python
# CORRECT — cross-platform
import webbrowser
webbrowser.open("http://localhost:8501")

# WRONG — macOS only
# os.system("open http://localhost:8501")
```

In shell scripts or docs, use the correct command per OS:

| OS | Command |
|---|---|
| Windows CMD/PowerShell | `start http://localhost:8501` |
| macOS | `open http://localhost:8501` |
| Linux | `xdg-open http://localhost:8501` |

---

## Do Not

- Hardcode environment-specific values anywhere in source code
- Expose database or Redis ports publicly (bind to `127.0.0.1` only in production)
- Run Python processes as root inside containers
- Bake `.env` files or secrets into Docker images
- Deploy without running migrations first
- Skip health check verification after deployment
- Use `pip install` in production — always use `pip install -r requirements.txt` with pinned versions
- Use `debug=True` in FastAPI in production (`APP_ENV=production` disables it)
- Use backslash path separators in Python code — always use `pathlib.Path`
- Use `open` command in cross-platform scripts — use `webbrowser.open()` or `start`/`xdg-open`
