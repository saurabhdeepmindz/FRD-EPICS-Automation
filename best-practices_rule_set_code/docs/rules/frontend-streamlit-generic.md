# Frontend Rules — Streamlit

## Architecture Principles

### Thin UI — No Business Logic

The Streamlit UI is a presentation layer ONLY. It:
- Calls the FastAPI backend via HTTP
- Renders data returned from the API
- Manages UI state (form inputs, filters, selections)

It NEVER:
- Connects to the database directly
- Calls LangChain agents or LLMs
- Contains business logic or validation beyond field-level UI hints
- Imports from `src/services/`, `src/repositories/`, or `src/agents/`

```python
# CORRECT: UI calls API
leads = api_client.get_leads(page=1, limit=20, status="eligible")

# WRONG: UI bypasses API and hits DB
from src.repositories.lead_repository import LeadRepository
leads = lead_repo.find_all()  # Never — architecture violation
```

---

## Folder Structure

```
src/ui/
├── app.py                    # Streamlit entry point — only navigation
├── api_client.py             # Single HTTP client for all FastAPI calls
├── pages/
│   ├── 1_dashboard.py        # Pipeline overview + funnel chart
│   ├── 2_leads.py            # Lead table, filters, upload
│   ├── 3_inventory.py        # Inventory list + match rules config
│   ├── 4_outreach.py         # Draft review + send queue
│   └── 5_analytics.py        # Performance metrics
├── components/
│   ├── lead_table.py         # Reusable lead table with status badges
│   ├── status_badge.py       # Color-coded status pill component
│   ├── outreach_card.py      # Outreach message review card
│   ├── funnel_chart.py       # Pipeline funnel visualization
│   └── error_banner.py       # Standardized error display
└── utils/
    ├── formatters.py         # Currency, date, carat formatting
    ├── auth.py               # JWT token handling in session state
    └── constants.py          # UI constants (colors, labels, limits)
```

---

## API Client Pattern

All FastAPI calls go through a single `APIClient` class in `src/ui/api_client.py`. Never use `requests` or `httpx` directly in page files.

```python
# src/ui/api_client.py

import httpx
import streamlit as st
from typing import Any
import logging

logger = logging.getLogger(__name__)


class APIClient:
    """
    Centralized HTTP client for all Jewelry AI FastAPI calls.

    Reads base URL from Streamlit secrets or environment.
    Injects JWT token from session state on every request.
    Raises APIError on non-2xx responses.
    """

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    def _headers(self) -> dict:
        """Build auth headers from session state token."""
        token = st.session_state.get("access_token")
        return {"Authorization": f"Bearer {token}"} if token else {}

    def get_leads(
        self,
        page: int = 1,
        limit: int = 20,
        status: str | None = None,
        match_status: str | None = None,
        search: str | None = None,
    ) -> dict:
        """
        Fetch paginated lead list with optional filters.

        Args:
            page (int): Page number (1-indexed).
            limit (int): Records per page (max 100).
            status (str | None): Filter by LeadStatus enum value.
            match_status (str | None): Filter by MatchStatus enum value.
            search (str | None): Full-text search term.

        Returns:
            dict: API response with 'data' list and 'meta' pagination info.
        """
        params = {"page": page, "limit": limit}
        if status:
            params["status"] = status
        if match_status:
            params["match_status"] = match_status
        if search:
            params["search"] = search
        return self._get("/api/v1/leads", params=params)

    def _get(self, path: str, params: dict | None = None) -> dict:
        """Execute GET request and return parsed JSON."""
        with httpx.Client(base_url=self._base_url, timeout=30.0) as client:
            response = client.get(path, params=params, headers=self._headers())
        return self._handle_response(response)

    def _post(self, path: str, json: dict | None = None, files=None) -> dict:
        """Execute POST request and return parsed JSON."""
        with httpx.Client(base_url=self._base_url, timeout=60.0) as client:
            response = client.post(path, json=json, files=files, headers=self._headers())
        return self._handle_response(response)

    def _handle_response(self, response: httpx.Response) -> dict:
        """Parse response and raise on error status codes."""
        if response.status_code >= 400:
            error_body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            raise APIError(
                status_code=response.status_code,
                message=error_body.get("error", "An unexpected error occurred"),
                code=error_body.get("code", "UNKNOWN"),
            )
        return response.json()


class APIError(Exception):
    """Raised when the FastAPI backend returns a non-2xx response."""

    def __init__(self, status_code: int, message: str, code: str) -> None:
        self.status_code = status_code
        self.message = message
        self.code = code
        super().__init__(message)
```

---

## Session State Management

Use `st.session_state` for all cross-page state. Never use module-level global variables.

```python
# CORRECT: session state for persistence across reruns
def initialize_session_state() -> None:
    """Initialize all required session state keys with defaults."""
    defaults = {
        "access_token": None,
        "current_user": None,
        "lead_filters": {"status": None, "match_status": None, "search": ""},
        "selected_lead_id": None,
        "outreach_page": 1,
    }
    for key, default in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = default

# Always call at top of every page
initialize_session_state()

# WRONG: module-level global
current_user = None  # Lost on rerun — do not use
```

---

## Caching Rules

```python
# Cache static/slow data — not user-specific data
@st.cache_data(ttl=300)   # 5-minute cache for analytics
def load_funnel_data(date_from: str, date_to: str) -> dict:
    """Load pipeline funnel metrics. Cached for 5 minutes."""
    return api_client.get_funnel(date_from=date_from, date_to=date_to)

@st.cache_resource         # Cache API client singleton (no TTL)
def get_api_client() -> APIClient:
    """Return singleton API client instance."""
    return APIClient(base_url=st.secrets.get("API_BASE_URL", "http://localhost:8000"))

# NEVER cache: lead tables (real-time data), auth tokens, user-specific data
```

---

## Page Layout Rules

Every page MUST follow this structure:

```python
# src/ui/pages/2_leads.py

import streamlit as st
from src.ui.api_client import get_api_client, APIError
from src.ui.components.error_banner import show_error
from src.ui.utils.auth import require_auth

# 1. Auth gate — all pages except login require this
require_auth()

# 2. Page config
st.set_page_config(page_title="Leads — Jewelry AI", layout="wide")
st.title("Lead Pipeline")

# 3. Action bar (filters, buttons)
with st.container():
    col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
    with col1:
        search = st.text_input("Search companies...", placeholder="e.g. Diamond LLC")
    with col2:
        status_filter = st.selectbox("Status", ["All", "ingested", "matched", "enriched", "contacted"])
    with col3:
        match_filter = st.selectbox("Match", ["All", "eligible", "not_eligible", "pending"])
    with col4:
        st.write("")  # spacer
        upload_btn = st.button("Upload Leads", type="primary")

# 4. Data fetch with error handling
try:
    client = get_api_client()
    result = client.get_leads(
        page=st.session_state.get("leads_page", 1),
        status=None if status_filter == "All" else status_filter,
        search=search or None,
    )
    leads = result["data"]
    meta = result["meta"]
except APIError as exc:
    show_error(f"Failed to load leads: {exc.message}")
    st.stop()

# 5. Render data
# ... table, cards, etc.
```

---

## Error Handling in UI

```python
# src/ui/components/error_banner.py

import streamlit as st

def show_error(message: str, detail: str | None = None) -> None:
    """Display a standardized error banner."""
    st.error(f"**Error:** {message}" + (f"\n\n_{detail}_" if detail else ""))

def show_warning(message: str) -> None:
    """Display a standardized warning banner."""
    st.warning(message)

def show_success(message: str) -> None:
    """Display a standardized success banner."""
    st.success(message)
```

Always wrap API calls in `try/except APIError` and display with `show_error()`. Never let raw exceptions surface to the user.

---

## Loading States

Show spinners for slow operations. Never leave users staring at a blank screen.

```python
with st.spinner("Enriching lead contacts..."):
    result = client.trigger_enrichment(lead_id=selected_id)

with st.spinner("Generating AI outreach draft..."):
    draft = client.generate_outreach(lead_id=selected_id)
```

For background jobs, poll the job status endpoint:
```python
import time

job_id = client.trigger_bulk_enrichment(lead_ids)["data"]["job_id"]
status_placeholder = st.empty()

while True:
    job = client.get_job_status(job_id)["data"]
    status_placeholder.info(f"Processing... status: {job['status']}")
    if job["status"] in ("completed", "failed"):
        break
    time.sleep(2)
```

---

## Data Display Rules

- Use `st.dataframe()` (not `st.table()`) for lead/inventory tables — supports sorting, filtering
- Status badges rendered as colored markdown: `🟢 eligible`, `🔴 not_eligible`, `🟡 pending`
- Currency always formatted: `$8,500.00` — use `utils/formatters.py`
- Carat weights: always 2 decimal places — `1.02 ct`
- Dates: `Mar 17, 2026 at 2:30 PM` — human readable, not ISO

---

## Streamlit Secrets

Never hardcode URLs or credentials in page files. Use `st.secrets` (`.streamlit/secrets.toml`):

```toml
# .streamlit/secrets.toml (gitignored)
API_BASE_URL = "http://localhost:8000"
```

```python
# Usage
base_url = st.secrets.get("API_BASE_URL", "http://localhost:8000")
```

`.streamlit/secrets.toml` is gitignored. Commit `.streamlit/secrets.toml.example` with placeholders.

---

## Performance Rules

- Never make API calls on every Streamlit rerun — use `st.cache_data` for slow queries
- Use `st.fragment` (Streamlit 1.33+) to isolate reruns to specific components
- Paginate all data tables — never load more than 100 rows at once into the UI
- Use `st.data_editor` for inline editable tables (match rules config, lead status)

---

## Do Not

- Connect to DB, Redis, or Celery directly from UI code
- Import from `src/services/`, `src/repositories/`, `src/agents/`
- Use `st.experimental_*` APIs — use stable equivalents
- Store sensitive data (JWT tokens, API keys) in cookies — use `st.session_state` only
- Make raw HTTP calls in page files — always use `APIClient`
- Render user-supplied text with `st.markdown()` without sanitizing — XSS risk
- Leave blocking API calls without a spinner
