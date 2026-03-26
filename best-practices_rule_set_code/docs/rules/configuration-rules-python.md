# Configuration Rules

## Configuration Hierarchy

All configuration follows this priority order (highest wins):

```
1. Environment variables (runtime)      ← Highest priority
2. .env file (local dev only)
3. Default values in Settings class     ← Lowest priority
```

Never have configuration values scattered across files. The single source is `src/core/config.py`.

---

## Settings Schema (Pydantic-Settings)

Every configuration parameter MUST be defined in `Settings` with:
1. A type annotation
2. A docstring (inline comment)
3. A default value OR explicit `...` (required, no default)
4. Valid range or allowed values documented

```python
# src/core/config.py

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    """
    Jewelry AI application configuration.

    All values loaded from environment variables.
    Required values with no default will cause startup failure if missing.
    This is intentional: fail fast rather than run with broken config.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Application ────────────────────────────────────────────────────────────
    APP_ENV: Literal["development", "test", "staging", "production"]
    APP_VERSION: str = "1.0.0"
    APP_NAME: str = "Jewelry AI"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    SECRET_KEY: str  # Required — used for JWT signing

    # ── Database ───────────────────────────────────────────────────────────────
    DATABASE_URL: str               # postgresql+asyncpg://user:pass@host:5432/db
    DB_POOL_SIZE: int = 10          # Base connection pool size
    DB_MAX_OVERFLOW: int = 20       # Additional connections under load
    DB_POOL_TIMEOUT: int = 30       # Seconds to wait for pool connection
    REDIS_URL: str                  # redis://host:6379/db

    # ── AI Providers ───────────────────────────────────────────────────────────
    OPENAI_API_KEY: str             # Required — primary LLM provider
    OPENAI_DEFAULT_MODEL: str = "gpt-4o"
    OPENAI_FALLBACK_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: str = ""     # Optional — used as LLM fallback
    ANTHROPIC_DEFAULT_MODEL: str = "claude-sonnet-4-6"

    # ── Enrichment APIs ────────────────────────────────────────────────────────
    APOLLO_API_KEY: str             # Required for contact enrichment
    APOLLO_RATE_LIMIT_PER_MINUTE: int = 30   # Apollo.io free tier limit
    HUNTER_API_KEY: str             # Required for email verification
    HUNTER_RATE_LIMIT_PER_MINUTE: int = 20
    PROXYCURL_API_KEY: str = ""     # Optional — LinkedIn enrichment

    # ── Outreach ───────────────────────────────────────────────────────────────
    SENDGRID_API_KEY: str           # Required
    SENDGRID_FROM_EMAIL: str        # e.g. sales@shivamjewels.com
    SENDGRID_FROM_NAME: str = "Shivam Jewels"
    TWILIO_ACCOUNT_SID: str = ""    # Phase 2 — WhatsApp
    TWILIO_AUTH_TOKEN: str = ""     # Phase 2 — WhatsApp
    TWILIO_WHATSAPP_FROM: str = ""  # Phase 2 — WhatsApp number

    # ── Workflow Automation ────────────────────────────────────────────────────
    N8N_WEBHOOK_BASE_URL: str = "http://localhost:5678"
    N8N_WEBHOOK_SECRET: str = ""    # Shared secret for webhook auth
    N8N_OUTREACH_SEQUENCE_WEBHOOK: str = "/webhook/outreach-sequence"

    # ── Feature Flags ─────────────────────────────────────────────────────────
    HUMAN_REVIEW_REQUIRED: bool = True    # Require review before sending outreach
    AUTO_ENRICH_ON_INGEST: bool = True    # Auto-trigger enrichment after lead upload
    AUTO_SCORE_ON_ENRICH: bool = True     # Auto-trigger ML scoring after enrichment
    ENABLE_WHATSAPP_OUTREACH: bool = False  # Phase 2 feature
    ENABLE_LIVE_SCRAPING: bool = False      # Phase 3 feature

    # ── Business Rules ─────────────────────────────────────────────────────────
    INVENTORY_MATCH_MIN_CARAT: float = 0.50   # Minimum carat for eligible match
    INVENTORY_MATCH_MAX_CARAT: float = 10.00  # Maximum carat for eligible match
    MAX_BATCH_SIZE: int = 500                  # Max leads per upload
    MAX_ENRICHMENT_BATCH: int = 100            # Max leads per enrichment job
    OUTREACH_SEQUENCE_STEPS: int = 3           # Number of follow-up steps
    OUTREACH_STEP_DELAY_DAYS: int = 5          # Days between sequence steps

    # ── Token Budgets (LLM cost control) ──────────────────────────────────────
    LLM_OUTREACH_MAX_TOKENS: int = 800         # Max tokens for email generation
    LLM_CLASSIFICATION_MAX_TOKENS: int = 100   # Max tokens for classify tasks
    LLM_ENRICHMENT_REASONING_MAX_TOKENS: int = 400

    # ── MLflow ────────────────────────────────────────────────────────────────
    MLFLOW_TRACKING_URI: str = "http://localhost:5000"
    MLFLOW_EXPERIMENT_NAME: str = "jewelry-ai-lead-scoring"
    ML_SCORING_AUC_THRESHOLD: float = 0.75    # Min AUC before deploying model

    # ── Error Monitoring ──────────────────────────────────────────────────────
    SENTRY_DSN: str = ""           # Empty = Sentry disabled
    ENABLE_SENTRY: bool = False

    # ── Celery ────────────────────────────────────────────────────────────────
    CELERY_TASK_SOFT_TIME_LIMIT: int = 60      # Seconds before SoftTimeLimitExceeded
    CELERY_TASK_TIME_LIMIT: int = 120          # Hard kill after this many seconds

    # ─── Validators ───────────────────────────────────────────────────────────

    @field_validator("INVENTORY_MATCH_MIN_CARAT")
    @classmethod
    def min_carat_positive(cls, v: float) -> float:
        """Carat weight must be positive."""
        if v <= 0:
            raise ValueError("INVENTORY_MATCH_MIN_CARAT must be > 0")
        return v

    @model_validator(mode="after")
    def carat_range_valid(self) -> "Settings":
        """Min carat must be less than max carat."""
        if self.INVENTORY_MATCH_MIN_CARAT >= self.INVENTORY_MATCH_MAX_CARAT:
            raise ValueError("INVENTORY_MATCH_MIN_CARAT must be < INVENTORY_MATCH_MAX_CARAT")
        return self

    @model_validator(mode="after")
    def production_requires_sentry(self) -> "Settings":
        """Warn (not fail) if production runs without error monitoring."""
        if self.APP_ENV == "production" and not self.SENTRY_DSN:
            import warnings
            warnings.warn("Running in production without SENTRY_DSN configured", stacklevel=2)
        return self


# Singleton — import this everywhere
settings = Settings()
```

---

## Feature Flags Rules

Feature flags control unreleased or phased functionality:

| Flag | Default | Phase Active |
|---|---|---|
| `HUMAN_REVIEW_REQUIRED` | `true` | Always |
| `AUTO_ENRICH_ON_INGEST` | `true` | Phase 2+ |
| `AUTO_SCORE_ON_ENRICH` | `true` | Phase 5+ |
| `ENABLE_WHATSAPP_OUTREACH` | `false` | Phase 2 |
| `ENABLE_LIVE_SCRAPING` | `false` | Phase 3 |

**Rules:**
- Feature flags are read from `settings` — never hardcoded `if env == "production"` checks
- Disabled features return a clear 501 response, not a silent no-op
- Remove flags for permanently enabled features — don't accumulate dead flags

```python
# CORRECT: check feature flag via settings
if not settings.ENABLE_WHATSAPP_OUTREACH:
    raise HTTPException(
        status_code=501,
        detail={"error": "WhatsApp outreach is not enabled in this environment."}
    )

# WRONG: hardcoded environment check
if os.environ.get("ENV") != "production":
    raise HTTPException(...)
```

---

## Environment File Structure

```bash
# .env.example — committed to git, NO real values
# Copy to .env and fill in for local development

# Application
APP_ENV=development
APP_VERSION=1.0.0
LOG_LEVEL=INFO
SECRET_KEY=change-me-to-a-random-64-char-string

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/jewelry_ai
REDIS_URL=redis://localhost:6379/0

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...    # Optional

# Enrichment (get free keys from apollo.io, hunter.io)
APOLLO_API_KEY=
HUNTER_API_KEY=

# Outreach
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=demo@shivamjewels.com
SENDGRID_FROM_NAME=Shivam Jewels

# Workflow
N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=change-me-webhook-secret

# Feature Flags (POC defaults)
HUMAN_REVIEW_REQUIRED=true
AUTO_ENRICH_ON_INGEST=false    # Manual trigger in POC
ENABLE_LIVE_SCRAPING=false
ENABLE_WHATSAPP_OUTREACH=false

# Business Rules
INVENTORY_MATCH_MIN_CARAT=0.50
MAX_BATCH_SIZE=500

# LLM Budgets
LLM_OUTREACH_MAX_TOKENS=800

# MLflow
MLFLOW_TRACKING_URI=http://localhost:5000

# Error monitoring (leave empty for local dev)
SENTRY_DSN=
```

---

## Configuration Access Rules

```python
# CORRECT: always via settings singleton
from src.core.config import settings

api_key = settings.APOLLO_API_KEY
min_carat = settings.INVENTORY_MATCH_MIN_CARAT

# WRONG: direct os.environ access in service/agent code
import os
api_key = os.environ.get("APOLLO_API_KEY")  # Never — bypasses validation

# WRONG: hardcoded values
MIN_CARAT = 0.5  # Never — must be configurable
```

---

## Configuration Documentation Requirements

Every setting MUST have:
1. **Inline comment** in `config.py` explaining what it controls
2. **Entry in `.env.example`** with a placeholder or safe default
3. **Reference in `docs/DB_SCHEMA.md` or relevant rules file** if it affects data behavior

For settings affecting business logic (carat thresholds, sequence delays), document the default and reasoning in `ideas.md` or `PRD.md`.

---

## Environment-Specific Overrides

| Setting | development | test | staging | production |
|---|---|---|---|---|
| `LOG_LEVEL` | DEBUG | WARNING | INFO | INFO |
| `HUMAN_REVIEW_REQUIRED` | false | false | true | true |
| `AUTO_ENRICH_ON_INGEST` | false | false | true | true |
| `DB_POOL_SIZE` | 5 | 2 | 10 | 20 |
| `ENABLE_SENTRY` | false | false | true | true |

---

## Do Not

- Access `process.env` / `os.environ` directly in service, agent, or router code
- Hardcode model names, API endpoints, timeouts, or thresholds — all go in `Settings`
- Commit `.env` files (only `.env.example`)
- Add a new feature without a corresponding feature flag
- Use `settings.dict()` to pass config to agents — pass only the specific values needed
- Add settings without documenting them in `.env.example`
