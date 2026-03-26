# Error Handling & Observability Rules

## Exception Hierarchy

Use typed custom exceptions from `src/core/exceptions.py`. Never raise raw `Exception` from business logic.

```python
# src/core/exceptions.py

class JewelryAIException(Exception):
    """Base exception for all Jewelry AI application errors."""
    http_status: int = 500
    error_code: str = "INTERNAL_ERROR"
    user_message: str = "An unexpected error occurred. Please try again."


# Domain exceptions (4xx)
class LeadNotFoundException(JewelryAIException):
    http_status = 404
    error_code = "LEAD_NOT_FOUND"
    user_message = "Lead not found."

class DuplicateLeadException(JewelryAIException):
    http_status = 409
    error_code = "DUPLICATE_LEAD"
    user_message = "This lead already exists in the system."

class LeadValidationException(JewelryAIException):
    http_status = 422
    error_code = "LEAD_VALIDATION_ERROR"
    user_message = "Lead data failed validation."

class InventoryMatchException(JewelryAIException):
    http_status = 422
    error_code = "INVENTORY_MATCH_ERROR"
    user_message = "Inventory matching could not be completed."

# Integration exceptions (502/503)
class ApolloAPIException(JewelryAIException):
    http_status = 502
    error_code = "APOLLO_API_ERROR"
    user_message = "Contact enrichment service is temporarily unavailable."

class LLMProviderException(JewelryAIException):
    http_status = 503
    error_code = "LLM_PROVIDER_ERROR"
    user_message = "AI generation service is temporarily unavailable."

# Infrastructure exceptions (500)
class DatabaseException(JewelryAIException):
    http_status = 500
    error_code = "DATABASE_ERROR"
    user_message = "A database error occurred. Please try again."
```

The global FastAPI exception handler in `src/api/main.py` catches all `JewelryAIException` and formats the standard error envelope. Uncaught exceptions are caught by a fallback handler that logs and returns a 500.

---

## Exception Handling in Services

```python
# CORRECT: Throw typed exception with context
async def get_lead(self, lead_id: UUID) -> Lead:
    lead = await self._repository.find_by_id(lead_id)
    if not lead:
        # Log before raising — context always included
        logger.warning("Lead not found", extra={"lead_id": str(lead_id), "trace_id": ctx.trace_id})
        raise LeadNotFoundException(lead_id=lead_id)
    return lead

# CORRECT: Catch integration error, log, re-raise wrapped
async def enrich_via_apollo(self, lead: Lead) -> Contact:
    try:
        return await self._apollo_client.enrich_person(lead.contact_email)
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Apollo enrichment failed",
            extra={"lead_id": str(lead.id), "status": exc.response.status_code}
        )
        # Wrap external error in domain exception — never expose raw HTTP errors
        raise ApolloAPIException() from exc

# WRONG: Silent catch — forbidden
async def do_something(self):
    try:
        await self._repo.create(payload)
    except Exception:
        pass  # Never do this — hides bugs, makes debugging impossible
```

---

## Structured Logging

Every log entry MUST be structured JSON with these fields:

```python
import logging

logger = logging.getLogger(__name__)

# CORRECT: structured key-value pairs
logger.info(
    "Lead ingested successfully",
    extra={
        "lead_id": str(lead.id),
        "source": lead.source,
        "trace_id": ctx.trace_id,
        "duration_ms": elapsed
    }
)

# WRONG: string interpolation — unqueryable in log aggregation
logger.info(f"Lead {lead.id} ingested from {lead.source}")
```

### Log Levels

| Level | When to Use |
|---|---|
| `logger.error()` | Unexpected failures, caught exceptions, failed external calls |
| `logger.warning()` | Recoverable issues, API rate limit hits, retry attempts, deprecated usage |
| `logger.info()` | Normal business events: lead ingested, email sent, job completed |
| `logger.debug()` | Detailed flow during development — DISABLE in production via `LOG_LEVEL=INFO` |

---

## What to Log / What NOT to Log

### Always Log
- Start and completion of significant business operations (lead pipeline stages)
- All external API failures with error type and status code
- Authentication events (login, logout, failed attempts) — use UUID, not email
- Rate limit violations with IP address
- Celery task start, completion, failure, retry

### Never Log
- Passwords, JWT tokens, API keys (even partial values)
- Full request bodies on `/auth/*` endpoints
- PII directly — log UUIDs as references instead of email/phone
- Raw database error messages — wrap in safe messages
- Full stack traces at `info` level — use `error` with `exc_info=True`

```python
# WRONG: logging sensitive data
logger.info(f"Login: email={email}, password={password}")

# CORRECT: safe identifier only
logger.info("User authenticated", extra={"user_id": user.id, "action": "login"})
logger.warning("Failed login attempt", extra={"action": "login", "ip": request.client.host})
```

---

## Request Correlation (Trace ID)

Every request MUST have a `trace_id` injected by middleware and propagated to all log entries.

```python
# src/api/middleware/logging_middleware.py
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class LoggingMiddleware(BaseHTTPMiddleware):
    """Injects trace_id on every request and logs request/response metadata."""

    async def dispatch(self, request: Request, call_next):
        # Accept from upstream or generate new
        trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
        request.state.trace_id = trace_id

        # Always echo back for client-side correlation
        response = await call_next(request)
        response.headers["x-trace-id"] = trace_id
        return response
```

Propagate trace_id to all outbound HTTP calls:
```python
headers["x-trace-id"] = request.state.trace_id
```

---

## Health Check Endpoint

Every service MUST expose `/api/v1/health` as a public endpoint:

```python
@router.get("/health", include_in_schema=False)
async def health_check(db: AsyncSession = Depends(get_async_session)) -> dict:
    """
    Health check endpoint for load balancers and uptime monitoring.
    Verifies database and cache connectivity.

    Returns:
        dict: Health status with component statuses and timestamp.
    """
    db_status = "connected"
    redis_status = "connected"

    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return {
        "success": True,
        "data": {
            "status": "ok" if db_status == "connected" else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "version": settings.APP_VERSION,
            "db": db_status,
            "redis": redis_status,
        }
    }
```

Used by Docker health checks, load balancers, and deployment verification scripts.

---

## Database Error Translation

Translate PostgreSQL-level errors into typed application exceptions inside repositories. Never let raw DB errors reach the API layer.

```python
from asyncpg import UniqueViolationError

async def create(self, entity: Lead) -> Lead:
    try:
        ...
    except UniqueViolationError as exc:
        # Translate DB constraint violation into domain exception
        raise DuplicateLeadException() from exc
    except Exception as exc:
        logger.error("Database insert failed", extra={"table": "leads", "error": str(exc)})
        raise DatabaseException() from exc
```

---

## Error Monitoring (Production)

For production, integrate OpenTelemetry or Sentry for centralized error capture:

```python
# src/core/monitoring.py
import sentry_sdk

def configure_monitoring(dsn: str, environment: str) -> None:
    """Configure Sentry for error tracking and performance monitoring."""
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        traces_sample_rate=0.1,       # 10% of requests for performance
        profiles_sample_rate=0.1,
    )
```

Manual capture with context:
```python
import sentry_sdk

sentry_sdk.capture_exception(exc, extras={
    "lead_id": str(lead.id),
    "action": "enrichment.apollo",
    "trace_id": trace_id
})
```

---

## Do Not

- Swallow exceptions silently (empty `except` blocks)
- Return raw database errors or stack traces to API consumers
- Log passwords, tokens, API keys, or PII (use UUIDs as references)
- Use exception message text for control flow — use exception types instead
- Create custom exception classes that don't inherit from `JewelryAIException`
- Log at `error` level for expected user-triggered conditions (use `warning` instead)
- Re-raise a different exception type without chaining with `from exc` (loses traceback)
