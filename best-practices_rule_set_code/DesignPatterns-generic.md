# Design Patterns — Python / FastAPI Platform

> **Generic template — no project-specific content.**
> Project-specific pattern usage should extend or reference this file.

---

## Overview

The following design patterns are applied throughout Python-based AI and API platforms to ensure modularity, testability, and maintainability. Each pattern is described with its rationale, applicability, and a concrete code example using generic placeholder names.

---

## 1. Repository Pattern

**Where Used**: All data access (`src/repositories/`)

**Rationale**: Decouples business logic from database implementation. Repositories can be swapped (PostgreSQL → MongoDB) or mocked in tests without touching service code.

```python
# src/repositories/base_repository.py

from abc import ABC, abstractmethod
from typing import Generic, Optional, TypeVar
from uuid import UUID

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    """
    Abstract base repository defining the standard data access interface.

    All concrete repositories must implement these methods,
    ensuring consistent CRUD operations across all entities.
    """

    @abstractmethod
    async def find_by_id(self, entity_id: UUID) -> Optional[T]:
        """Retrieve a single entity by its primary key."""
        ...

    @abstractmethod
    async def find_all(self, limit: int = 100, offset: int = 0) -> list[T]:
        """Retrieve a paginated list of entities."""
        ...

    @abstractmethod
    async def create(self, entity: T) -> T:
        """Persist a new entity and return it with assigned ID."""
        ...

    @abstractmethod
    async def update(self, entity: T) -> T:
        """Persist changes to an existing entity."""
        ...

    @abstractmethod
    async def delete(self, entity_id: UUID) -> bool:
        """Soft-delete an entity by ID. Returns True if deleted."""
        ...
```

---

## 2. Strategy Pattern

**Where Used**: Algorithm selection, provider swapping, channel selection

**Rationale**: Different algorithms and external providers can be swapped at runtime via configuration without changing the calling code.

```python
# src/services/<context>_service.py

from abc import ABC, abstractmethod


class ProcessingStrategy(ABC):
    """Abstract strategy for a processing operation."""

    @abstractmethod
    async def process(self, identifier: str, context: str) -> dict:
        """
        Execute the processing strategy.

        Args:
            identifier (str): Identifier of the entity to process.
            context (str): Additional context for processing.

        Returns:
            dict: Result of the processing operation.
        """
        ...


class ProviderAStrategy(ProcessingStrategy):
    """Processing via Provider A API."""

    async def process(self, identifier: str, context: str) -> dict:
        # Provider A-specific implementation
        ...


class ProviderBStrategy(ProcessingStrategy):
    """Processing via Provider B API."""

    async def process(self, identifier: str, context: str) -> dict:
        # Provider B-specific implementation
        ...


class ProcessingContext:
    """
    Context class that delegates to a configured strategy.
    Allows runtime switching between processing providers.
    """

    def __init__(self, strategy: ProcessingStrategy) -> None:
        # Strategy is injected — context is provider-agnostic
        self._strategy = strategy

    async def execute(self, identifier: str, context: str) -> dict:
        return await self._strategy.process(identifier, context)
```

---

## 3. Factory Pattern

**Where Used**: Object creation (`src/factories/`), adapter instantiation

**Rationale**: Centralizes object creation logic. Adding a new type requires only a new class and a factory registry entry, not changes across the codebase.

```python
# src/factories/<type>_factory.py

from src.adapters.base_adapter import BaseAdapter
from src.adapters.type_a_adapter import TypeAAdapter
from src.adapters.type_b_adapter import TypeBAdapter
from src.adapters.type_c_adapter import TypeCAdapter


class AdapterFactory:
    """
    Factory for instantiating adapters by type identifier.

    Centralizes adapter creation so new types can be added
    without modifying calling code.
    """

    _registry: dict[str, type[BaseAdapter]] = {
        "type_a": TypeAAdapter,
        "type_b": TypeBAdapter,
        "type_c": TypeCAdapter,
    }

    @classmethod
    def create(cls, adapter_type: str) -> BaseAdapter:
        """
        Instantiate an adapter for the given type.

        Args:
            adapter_type (str): Identifier for the adapter type.

        Returns:
            BaseAdapter: Concrete adapter instance.

        Raises:
            ValueError: If adapter_type is not registered.
        """
        adapter_class = cls._registry.get(adapter_type)
        if not adapter_class:
            raise ValueError(f"Unknown adapter type: {adapter_type}")
        return adapter_class()
```

---

## 4. Observer Pattern (Event-Driven)

**Where Used**: Post-action triggers, decoupled side effects

**Rationale**: Decouples the core pipeline from downstream processes. New consumers (e.g., notifications, logging) can be added without modifying the source service.

```python
# src/core/events.py

from dataclasses import dataclass
from typing import Callable, Awaitable
from uuid import UUID


@dataclass
class EntityCreatedEvent:
    """Event emitted when a new entity is successfully created."""
    entity_id: UUID
    source: str


class EventBus:
    """
    Simple in-process async event bus for domain events.

    Subscribers register handlers per event type.
    The bus is injected via dependency injection.
    """

    def __init__(self) -> None:
        # Map of event type to list of async handlers
        self._handlers: dict[type, list[Callable]] = {}

    def subscribe(self, event_type: type, handler: Callable[..., Awaitable]) -> None:
        """Register an async handler for a given event type."""
        self._handlers.setdefault(event_type, []).append(handler)

    async def publish(self, event: object) -> None:
        """Dispatch an event to all registered handlers."""
        for handler in self._handlers.get(type(event), []):
            await handler(event)
```

---

## 5. Dependency Injection (FastAPI Native)

**Where Used**: All API routers (`src/api/routers/`)

**Rationale**: Makes services testable by allowing mock injection in tests. Aligns with FastAPI's built-in DI system.

```python
# src/api/dependencies.py

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_async_session
from src.repositories.entity_repository import EntityRepository
from src.services.entity_service import EntityService


async def get_entity_repository(
    session: AsyncSession = Depends(get_async_session)
) -> EntityRepository:
    """Provide an EntityRepository bound to the current DB session."""
    return EntityRepository(session)


async def get_entity_service(
    repo: EntityRepository = Depends(get_entity_repository)
) -> EntityService:
    """Provide an EntityService with injected repository."""
    return EntityService(repo)
```

---

## 6. Chain of Responsibility (LangChain Pipeline)

**Where Used**: AI processing pipelines (`src/agents/`)

**Rationale**: Each processing step is an independent, reusable chain link. Steps can be reordered or replaced without coupling.

```python
# src/agents/<pipeline_name>_agent.py

from langchain_core.runnables import RunnableLambda, RunnableSequence

# Each step is an isolated, testable unit
validate_step = RunnableLambda(validate_input_data)
enrich_step = RunnableLambda(enrich_via_external_api)
score_step = RunnableLambda(compute_score)
generate_step = RunnableLambda(generate_output)

# Compose into a pipeline — order is explicit and maintainable
processing_pipeline: RunnableSequence = (
    validate_step | enrich_step | score_step | generate_step
)
```

---

## 7. State Machine (LangGraph Workflows)

**Where Used**: Multi-step automation workflows (`src/agents/workflows/`)

**Rationale**: Complex workflows with branching conditions are modeled as explicit state machines. State transitions are auditable and resumable.

```python
# src/agents/workflows/<workflow_name>.py

from langgraph.graph import StateGraph, END
from typing import TypedDict


class WorkflowState(TypedDict):
    """Typed state object passed between all workflow nodes."""
    entity_id: str
    is_eligible: bool
    step_a_complete: bool
    step_b_complete: bool
    error: str | None


# Define the state graph
workflow = StateGraph(WorkflowState)

# Nodes represent discrete processing steps
workflow.add_node("check_eligibility", check_eligibility_node)
workflow.add_node("process_step_a", process_step_a_node)
workflow.add_node("process_step_b", process_step_b_node)
workflow.add_node("finalize", finalize_node)
workflow.add_node("mark_ineligible", mark_ineligible_node)

# Edges define the flow with conditional branching
workflow.set_entry_point("check_eligibility")
workflow.add_conditional_edges(
    "check_eligibility",
    lambda state: "process_step_a" if state["is_eligible"] else "mark_ineligible"
)
workflow.add_edge("process_step_a", "process_step_b")
workflow.add_edge("process_step_b", "finalize")
workflow.add_edge("finalize", END)
workflow.add_edge("mark_ineligible", END)

compiled_workflow = workflow.compile()
```

---

## 8. Adapter Pattern

**Where Used**: Third-party API integrations (`src/integrations/`)

**Rationale**: Wraps external APIs behind a consistent internal interface. Changing from one external provider to another only requires replacing the adapter, not modifying any service code.

```python
# src/integrations/<provider>_client.py

import httpx
from src.domain.<entity> import <Entity>
from src.core.config import settings
from src.core.exceptions import ExternalAPIException


class <Provider>Client:
    """
    Adapter wrapping the <Provider> external API.

    Translates <Provider>'s API response schema into the internal
    domain model used across the platform.
    """

    BASE_URL = "https://api.<provider>.com/v1"

    async def fetch(self, identifier: str) -> <Entity>:
        """
        Fetch data from the external API.

        Args:
            identifier (str): The identifier to look up.

        Returns:
            <Entity>: Internal domain object populated with API data.

        Raises:
            ExternalAPIException: If the API call fails or returns non-2xx.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/endpoint",
                params={"id": identifier},
                headers={"Authorization": f"Bearer {settings.EXTERNAL_API_KEY}"}
            )
        if response.status_code != 200:
            raise ExternalAPIException(
                status=response.status_code,
                detail=response.text
            )

        # Map external response to internal domain model
        data = response.json()
        return <Entity>(
            field_a=data.get("field_a"),
            field_b=data.get("field_b"),
        )
```

---

## Pattern Summary

| Pattern | Location | Problem Solved |
|---|---|---|
| Repository | `src/repositories/` | Decouples data access from business logic |
| Strategy | `src/services/` | Swappable algorithms and providers |
| Factory | `src/factories/`, `src/adapters/` | Centralized object creation |
| Observer | `src/core/events.py` | Decoupled event-driven side effects |
| Dependency Injection | `src/api/dependencies.py` | Testable, configurable service wiring |
| Chain of Responsibility | `src/agents/` | Composable LangChain processing pipelines |
| State Machine | `src/agents/workflows/` | Auditable multi-step automation workflows |
| Adapter | `src/integrations/` | Stable internal API over unstable external APIs |
