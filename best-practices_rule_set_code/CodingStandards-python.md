# Coding Standards — Python

> **Language:** Python 3.11+
> **Generic template — no project-specific content.**
> Project-specific standards should extend this file.

---

## Python Version

All code targets **Python 3.11+**. Use type hints throughout.

---

## Class Boilerplate Template

Every class MUST follow this structure:

```python
"""
Module: src/<layer>/<module_name>.py
Description: Brief description of what this module does
             and the responsibility it owns.
"""

import logging
from typing import Optional
from uuid import UUID

from src.core.exceptions import <DomainException>
from src.domain.<entity> import <Entity>, <EntityStatus>
from src.repositories.<entity>_repository import <Entity>Repository

# Module-level logger — always use __name__ for proper hierarchy
logger = logging.getLogger(__name__)


class <ClassName>:
    """
    One-line summary of the class responsibility.

    Responsibilities:
        - Responsibility 1
        - Responsibility 2
        - Responsibility 3

    Dependencies:
        - <Dependency>: What it provides to this class
    """

    def __init__(self, repository: <Entity>Repository) -> None:
        """
        Initialize <ClassName> with required dependencies.

        Args:
            repository (<Entity>Repository): Repository for data persistence.
        """
        # Injected dependency — never instantiate repository directly in service
        self._repository = repository

    async def <action>_<entity>(self, raw_data: dict) -> <Entity>:
        """
        One-line summary of what this method does.

        Longer description if needed. Explain algorithm, side effects,
        or important behavioral details.

        Args:
            raw_data (dict): Input payload. Expected keys: field1, field2.

        Returns:
            <Entity>: The persisted domain object with assigned ID.

        Raises:
            <ValidationException>: If raw_data fails schema validation.
            <DuplicateException>: If record already exists.

        Example:
            >>> service = <ClassName>(repo)
            >>> result = await service.<action>_<entity>({"field": "value"})
        """
        # Validate raw payload before any processing
        validated = self._validate_payload(raw_data)

        # Check for existing record before inserting
        existing = await self._repository.find_by_<key>(validated.<key>)
        if existing:
            logger.warning(
                "Duplicate <entity> detected, skipping",
                extra={"<key>": validated.<key>, "existing_id": str(existing.id)}
            )
            raise <DuplicateException>(<key>=validated.<key>)

        # Persist and return the new record
        persisted = await self._repository.create(validated)
        logger.info(
            "<Entity> created successfully",
            extra={"id": str(persisted.id)}
        )
        return persisted

    def _validate_payload(self, raw_data: dict) -> <Entity>:
        """
        Validate raw dictionary against the domain model.

        Args:
            raw_data (dict): Unvalidated input data.

        Returns:
            <Entity>: A validated domain object.

        Raises:
            <ValidationException>: If required fields are missing or malformed.
        """
        try:
            return <Entity>.model_validate(raw_data)
        except Exception as exc:
            # Wrap Pydantic errors in domain-specific exception
            raise <ValidationException>(detail=str(exc)) from exc
```

---

## Method Documentation Standard

Every public method MUST have a docstring following this format:

```python
def method_name(self, param1: Type, param2: Type) -> ReturnType:
    """
    One-line summary of what the method does.

    Longer description if needed. Explain the algorithm, side effects,
    or important behavioral details. Keep it factual, not redundant.

    Args:
        param1 (Type): Description of param1 and its expected values.
        param2 (Type): Description of param2 and its expected values.

    Returns:
        ReturnType: Description of the return value and its structure.

    Raises:
        ExceptionType: When and why this exception is raised.

    Example:
        >>> result = obj.method_name(val1, val2)
    """
```

### Rules
- Private methods (`_method`) require a brief single-line docstring minimum.
- Dunder methods (`__init__`, `__str__`) require docstrings for non-trivial logic.
- No docstrings on one-liners that are self-evident (e.g., `return self._id`).

---

## Single-Line Comment Rules

```python
# BAD: Restates the code — adds zero value
count = len(items)  # get the count of items

# GOOD: Explains WHY, not what
count = len(items)  # cap batch to prevent memory overflow downstream

# BAD: Vague comment
# process data
result = transform(data)

# GOOD: Domain-specific context
# Normalize value to business-defined precision before storing
normalized = round(raw_value, 2)
```

---

## Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Module | `snake_case` | `lead_ingestion_service.py` |
| Class | `PascalCase` | `IngestionService` |
| Function / Method | `snake_case` | `ingest_record()` |
| Variable | `snake_case` | `record_count` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_BATCH_SIZE = 500` |
| Private attribute | `_snake_case` | `self._repository` |
| Type alias | `PascalCase` | `EntityList = list[Entity]` |
| Pydantic model | `PascalCase` | `EntityCreateRequest` |

---

## Type Hints

All function signatures MUST be fully typed:

```python
# CORRECT
async def find_by_status(self, status: EntityStatus, limit: int = 100) -> list[Entity]:
    ...

# INCORRECT — missing return type and parameter types
async def find_by_status(self, status, limit=100):
    ...
```

Use `Optional[X]` (or `X | None` in Python 3.10+) for nullable values:

```python
async def find_by_key(self, key: str) -> Optional[Entity]:
    ...
```

---

## Immutability Rules

```python
# WRONG: Mutating input
def update_status(entity: Entity, status: EntityStatus) -> None:
    entity.status = status  # mutates the original object

# CORRECT: Return new object
def update_status(entity: Entity, status: EntityStatus) -> Entity:
    return entity.model_copy(update={"status": status})
```

All domain models use `frozen=False` Pydantic models but MUST be treated as immutable — use `.model_copy(update={})` to produce updated versions.

---

## File Size & Organization

- **Max file size**: 800 lines. Split at logical seams when approaching this.
- **Max function size**: 50 lines. Extract helper functions aggressively.
- **Max nesting depth**: 4 levels. Use early returns and guard clauses.

```python
# BAD: Deep nesting
def process(data):
    if data:
        if data.get("items"):
            for item in data["items"]:
                if item.get("key"):
                    # logic here

# GOOD: Guard clauses
def process(data):
    if not data:
        return
    items = data.get("items", [])
    for item in items:
        if not item.get("key"):
            continue
        # logic here
```

---

## Constants & Configuration

```python
# WRONG: Magic numbers / strings inline
if value > 2.0:
    ...

# CORRECT: Named constants in core/config.py
from src.core.config import settings
if value > settings.PROCESSING_THRESHOLD:
    ...
```

All configurable values live in `src/core/config.py` using `pydantic-settings`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    DATABASE_URL: str
    EXTERNAL_API_KEY: str
    PROCESSING_THRESHOLD: float = 1.0
    MAX_BATCH_SIZE: int = 500

    class Config:
        env_file = ".env"


settings = Settings()
```

---

## Import Order (isort standard)

```python
# 1. Standard library
import logging
from typing import Optional
from uuid import UUID

# 2. Third-party
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

# 3. Internal — absolute paths only
from src.core.exceptions import EntityNotFoundException
from src.domain.entity import Entity
from src.services.entity_service import EntityService
```

---

## Error Handling Pattern

```python
async def get_entity(self, entity_id: UUID) -> Entity:
    """
    Retrieve an entity by its unique identifier.

    Args:
        entity_id (UUID): The unique identifier of the entity.

    Returns:
        Entity: The found domain object.

    Raises:
        EntityNotFoundException: If no entity exists with the given ID.
    """
    entity = await self._repository.find_by_id(entity_id)
    if not entity:
        # Log before raising — include context for debugging
        logger.warning("Entity not found", extra={"entity_id": str(entity_id)})
        raise EntityNotFoundException(entity_id=entity_id)
    return entity
```

---

## Async Rules

- All I/O operations (DB, HTTP, file) MUST be `async`.
- Never use `time.sleep()` — use `await asyncio.sleep()`.
- Never block the event loop with CPU-heavy operations — offload to background task workers.

---

## Tooling

| Tool | Purpose | Config File |
|---|---|---|
| `ruff` | Linting + formatting | `pyproject.toml` |
| `mypy` | Static type checking | `pyproject.toml` |
| `pytest` | Testing | `pyproject.toml` |
| `isort` | Import sorting | `pyproject.toml` |
| `pre-commit` | Enforce on commit | `.pre-commit-config.yaml` |
