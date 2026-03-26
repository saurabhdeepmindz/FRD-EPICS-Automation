# Performance & Caching Rules

## Async I/O (Non-Negotiable)

All I/O operations MUST be async. Blocking calls on the FastAPI event loop will stall ALL concurrent requests.

```python
# CORRECT: async DB, async HTTP
async def get_lead(self, lead_id: UUID) -> Lead:
    return await self._repository.find_by_id(lead_id)

async def call_apollo(self, email: str) -> Contact:
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
    ...

# WRONG: blocking calls on event loop
def get_lead(self, lead_id: UUID) -> Lead:
    return self._repository.find_by_id(lead_id)  # sync DB call — blocks event loop

import requests  # NEVER use requests in FastAPI — always httpx async
response = requests.get(url)
```

---

## Redis Caching

### What to Cache

| Data | TTL | Key Pattern |
|---|---|---|
| Enrichment results (Apollo/Hunter) | 7 days | `enrich:{email_hash}` |
| Inventory match rules config | 1 hour | `match_rules:default` |
| Lead scores (ML model output) | 24 hours | `score:{lead_id}` |
| LinkedIn profile enrichment | 30 days | `linkedin:{domain}` |
| Analytics funnel data | 15 minutes | `analytics:funnel:{date_range_hash}` |

### What NOT to Cache

- JWT tokens — validate every request
- Real-time lead status — always read from DB
- Outreach message drafts — these change
- Any data requiring immediate consistency

### Cache-Aside Pattern

```python
# src/services/enrichment_service.py

async def get_enrichment_with_cache(self, email: str) -> Contact | None:
    """
    Retrieve enrichment result from cache, falling back to Apollo API.

    Cache key is based on hashed email to avoid PII in Redis keys.
    TTL: 7 days — Apollo data is unlikely to change frequently.
    """
    # Hash email before using as cache key — avoid storing PII in Redis
    cache_key = f"enrich:{hashlib.sha256(email.encode()).hexdigest()}"

    cached = await self._cache.get(cache_key)
    if cached:
        logger.debug("Cache hit for enrichment", extra={"cache_key": cache_key})
        return Contact.model_validate(json.loads(cached))

    # Cache miss — call Apollo
    contact = await self._apollo_client.enrich_person(email)

    # Store result — only cache successful enrichments
    if contact:
        await self._cache.set(cache_key, contact.model_dump_json(), ttl=604800)  # 7 days

    return contact
```

### Cache Invalidation

```python
# Invalidate when underlying data changes
async def update_match_rules(self, rules: MatchRules) -> MatchRules:
    updated = await self._repository.update(rules)
    # Invalidate cached rules immediately
    await self._cache.delete("match_rules:default")
    return updated
```

---

## Database Query Optimization

### Avoiding N+1 Queries

```python
# WRONG: N+1 — one query per lead
leads = await lead_repo.find_all()
for lead in leads:
    contact = await contact_repo.find_by_lead_id(lead.id)  # N queries

# CORRECT: JOIN in single query
leads_with_contacts = await lead_repo.find_all_with_contacts()

# SQLAlchemy eager loading
stmt = (
    select(LeadModel)
    .options(selectinload(LeadModel.contacts))  # Single additional query, not N
    .where(LeadModel.is_deleted == False)
    .limit(limit)
    .offset(offset)
)
```

### Pagination Is Mandatory

All list endpoints MUST paginate. Never return unbounded result sets:

```python
# CORRECT: always apply LIMIT + OFFSET
async def find_all(self, page: int = 1, limit: int = 20) -> tuple[list[Lead], int]:
    offset = (page - 1) * limit
    # Cap limit to prevent abuse
    limit = min(limit, 100)

    stmt = (
        select(LeadModel)
        .where(LeadModel.is_deleted == False)
        .order_by(LeadModel.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    ...

# WRONG: no limit — will OOM on large datasets
async def find_all(self) -> list[Lead]:
    stmt = select(LeadModel)
    ...
```

### Index Usage — Verify Before Deploying

For any query filtering on a column, verify the index exists in `DB_SCHEMA.md`:

```python
# Before adding a new WHERE filter, check that the column is indexed
# Run EXPLAIN ANALYZE in psql to verify index usage:
# EXPLAIN ANALYZE SELECT * FROM leads WHERE match_status = 'eligible';
```

### Batch Processing for Bulk Operations

Never process thousands of records in a single query:

```python
# CORRECT: process in batches of 100
async def bulk_enrich_leads(self, lead_ids: list[UUID]) -> None:
    batch_size = 100
    for i in range(0, len(lead_ids), batch_size):
        batch = lead_ids[i:i + batch_size]
        # Enqueue Celery task per batch — not per lead
        enrich_batch_task.delay([str(lid) for lid in batch])

# WRONG: single massive query + loop
leads = await lead_repo.find_all()  # Loads all 10k leads into memory
for lead in leads:
    await enrich_single(lead)
```

---

## Rate Limiting

### API Rate Limits (slowapi)

```python
# src/api/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# src/api/routers/enrichment.py
@router.post("/{lead_id}")
@limiter.limit("30/minute")   # 30 enrichment triggers per minute per IP
async def trigger_enrichment(...):
    ...

@router.post("/upload")
@limiter.limit("10/minute")   # File uploads rate-limited more strictly
async def upload_leads(...):
    ...
```

### External API Rate Limiting (Redis token bucket)

```python
# src/core/rate_limiter.py

async def check_api_rate_limit(self, provider: str, limit: int, window_seconds: int) -> bool:
    """
    Redis-based sliding window rate limiter for external API calls.
    Prevents exceeding Apollo.io / Hunter.io monthly credit limits.

    Args:
        provider: API provider name (e.g., 'apollo', 'hunter')
        limit: Max calls allowed in window
        window_seconds: Window size in seconds

    Returns:
        bool: True if call is allowed, False if limit exceeded.
    """
    key = f"rate_limit:{provider}:{int(time.time() // window_seconds)}"
    count = await self._redis.incr(key)
    if count == 1:
        await self._redis.expire(key, window_seconds)
    return count <= limit
```

---

## Connection Pooling

PostgreSQL and Redis connection pool sizes MUST be configured explicitly:

```python
# src/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,           # Base connections
    max_overflow=20,        # Additional connections under load
    pool_timeout=30,        # Timeout waiting for connection from pool
    pool_recycle=3600,      # Recycle connections every hour
    pool_pre_ping=True,     # Verify connection health before use
    echo=settings.APP_ENV == "development",
)
```

---

## Background Job Performance

- Use `acks_late=True` on Celery tasks to prevent data loss if worker dies
- Set `task_soft_time_limit` to abort tasks that run too long (enrichment: 30s, outreach: 60s)
- Use `chord` or `group` for parallelizing independent batch operations

```python
from celery import group

# CORRECT: parallel enrichment of a batch
job = group([
    enrich_lead_task.s(str(lead_id))
    for lead_id in lead_ids
])
result = job.apply_async()
```

---

## pgvector Semantic Deduplication

For large-scale semantic search on lead embeddings, use approximate nearest-neighbor index:

```sql
-- Create IVFFlat index for fast approximate search
CREATE INDEX idx_leads_embedding ON leads
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Tune lists based on dataset size:
-- < 1M rows: lists = sqrt(num_rows)
-- > 1M rows: lists = num_rows / 1000
```

Similarity threshold for deduplication: cosine distance < 0.10 = likely duplicate.

---

## Do Not

- Use `asyncio.sleep()` inside Celery tasks — tasks are synchronous
- Load full table data into memory for processing — always paginate or chunk
- Cache sensitive data (PII, tokens) in Redis without expiry
- Use Python's `requests` library anywhere in async FastAPI code — always `httpx`
- Skip `pool_pre_ping=True` on DB engine — will cause "connection closed" errors
- Set pagination `limit` > 100 on any endpoint — document the cap clearly
- Run ML scoring synchronously in request-response cycle — always Celery
