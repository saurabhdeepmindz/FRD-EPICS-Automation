# Coding Style Rules

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```python
# WRONG
def update_status(lead: Lead, status: LeadStatus) -> None:
    lead.status = status  # mutates — forbidden

# CORRECT
def update_status(lead: Lead, status: LeadStatus) -> Lead:
    return lead.model_copy(update={"status": status})
```

## File Organization

- Max 800 lines per file
- Max 50 lines per function
- Max 4 levels of nesting — use guard clauses
- Organize by feature/domain, not by type
- High cohesion, low coupling

## Async Rules

- All I/O (DB, HTTP, file) MUST be `async`
- Never `time.sleep()` — use `await asyncio.sleep()`
- CPU-heavy work goes to Celery, not inline async

## Naming

- Modules: `snake_case`
- Classes: `PascalCase`
- Functions/methods: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private: `_snake_case`

## Type Hints

All function signatures MUST be fully typed — no bare `def func(x):`.

## Imports

Order: stdlib → third-party → internal. Use absolute imports only.

## Comments

Write WHY, not WHAT. Never restate the code in a comment.
