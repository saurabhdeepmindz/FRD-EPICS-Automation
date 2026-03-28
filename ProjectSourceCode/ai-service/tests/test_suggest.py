"""
Unit tests for the AI suggest endpoint.
OpenAI is mocked — no real API calls.
Run: python -m pytest tests/test_suggest.py -v
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from main import app
from config import Settings
from prompts.section_prompts import get_section_prompt, SECTION_PROMPTS, DEFAULT_PROMPT


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        OPENAI_API_KEY="sk-test-key",
        OPENAI_MODEL="gpt-4.5-preview",
        CORS_ORIGINS="http://localhost:4000",
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ─── Health endpoint ──────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_ok(self, client: TestClient, test_settings: Settings) -> None:
        from main import get_settings
        app.dependency_overrides[get_settings] = lambda: test_settings
        try:
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "model" in data
        finally:
            app.dependency_overrides.clear()


# ─── Section prompt helpers ───────────────────────────────────────────────────

class TestSectionPrompts:
    def test_all_22_sections_have_prompts(self) -> None:
        for i in range(1, 23):
            prompt = get_section_prompt(i)
            assert isinstance(prompt, str)
            assert len(prompt) > 20, f"Section {i} prompt is too short"

    def test_unknown_section_returns_default(self) -> None:
        assert get_section_prompt(99) == DEFAULT_PROMPT
        assert get_section_prompt(0) == DEFAULT_PROMPT

    def test_section_prompts_dict_has_22_entries(self) -> None:
        assert len(SECTION_PROMPTS) == 22

    def test_each_section_prompt_is_non_empty_string(self) -> None:
        for section_num, prompt in SECTION_PROMPTS.items():
            assert isinstance(prompt, str), f"Section {section_num} prompt is not a string"
            assert len(prompt.strip()) > 0, f"Section {section_num} prompt is empty"


# ─── Suggest endpoint — input validation ──────────────────────────────────────

class TestSuggestValidation:
    def test_section_below_1_rejected(self, client: TestClient) -> None:
        response = client.post("/suggest", json={"section": 0, "field": "overview"})
        assert response.status_code == 422

    def test_section_above_22_rejected(self, client: TestClient) -> None:
        response = client.post("/suggest", json={"section": 23, "field": "overview"})
        assert response.status_code == 422

    def test_empty_field_rejected(self, client: TestClient) -> None:
        response = client.post("/suggest", json={"section": 1, "field": ""})
        assert response.status_code == 422

    def test_missing_section_rejected(self, client: TestClient) -> None:
        response = client.post("/suggest", json={"field": "overview"})
        assert response.status_code == 422


# ─── Suggest endpoint — mocked OpenAI ────────────────────────────────────────

class TestSuggestWithMock:
    def test_suggest_returns_suggestion(self, client: TestClient, test_settings: Settings) -> None:
        mock_choice = MagicMock()
        mock_choice.message.content = "A marketplace connecting travelers with storage hosts."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        from main import get_settings, get_openai_client
        app.dependency_overrides[get_settings] = lambda: test_settings
        app.dependency_overrides[get_openai_client] = lambda: mock_client

        try:
            response = client.post(
                "/suggest",
                json={"section": 1, "field": "product_vision", "context": "Luggage storage app"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["suggestion"] == "A marketplace connecting travelers with storage hosts."
            assert data["section"] == 1
            assert data["field"] == "product_vision"
        finally:
            app.dependency_overrides.clear()

    def test_suggest_with_no_context(self, client: TestClient, test_settings: Settings) -> None:
        mock_choice = MagicMock()
        mock_choice.message.content = "Generic suggestion."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        from main import get_settings, get_openai_client
        app.dependency_overrides[get_settings] = lambda: test_settings
        app.dependency_overrides[get_openai_client] = lambda: mock_client

        try:
            response = client.post("/suggest", json={"section": 5, "field": "actors"})
            assert response.status_code == 200
            assert response.json()["suggestion"] == "Generic suggestion."
        finally:
            app.dependency_overrides.clear()
