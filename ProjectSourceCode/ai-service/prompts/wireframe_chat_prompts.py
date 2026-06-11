"""
v12 · Track WC — Wireframe Copilot prompts.

Conversational AI over wireframe screens (mirrors hld_chat_prompts.py):
  - chat:           grounded UX/UI discussion of one/all screens
  - extract:        a chat turn -> an atomic, screen-routed change list (JSON)
  - edit:           a single screen's HTML + an NL change -> edited HTML (JSON)
  - parse-feedback: a bulk review document -> general/design-system/per-screen/unmatched (JSON)

All grounded in the project's Design System tokens; edits preserve numbered callouts.
"""

import json

_MAX_HTML = 14000
_MAX_REF_HTML = 9000


def _tokens_summary(design_tokens: dict | None) -> str:
    """Compact, human-readable summary of the active Design System tokens."""
    t = design_tokens or {}
    brand = t.get("brand", {}) if isinstance(t, dict) else {}
    typ = t.get("typography", {}) if isinstance(t, dict) else {}
    shape = t.get("shape", {}) if isinstance(t, dict) else {}
    return json.dumps(
        {
            "brand": brand,
            "typography": typ,
            "shape": shape,
            "semantic": t.get("semantic", {}) if isinstance(t, dict) else {},
        },
        ensure_ascii=False,
    )


def _screen_list(screens: list[dict]) -> str:
    """One line per screen: slug · title · module — for routing/scoping."""
    lines = []
    for s in screens or []:
        slug = s.get("slug", "")
        title = s.get("title", "")
        module = s.get("module") or "—"
        lines.append(f"- {slug} · {title} · module={module}")
    return "\n".join(lines) if lines else "(no screens)"


# ─────────────────────────────────────────────────────────────────────────────
# 1) CHAT
# ─────────────────────────────────────────────────────────────────────────────

WIREFRAME_CHAT_SYSTEM_PROMPT = """You are a senior UX/UI architect reviewing wireframes with a Business Analyst.

You discuss layout, hierarchy, accessibility, interaction patterns, responsiveness, and \
alignment with the project's Design System (fonts, colors, spacing, radius). Keep answers \
concrete and on-brand: when you suggest a change, ground it in the active Design Tokens and, \
if reference screens are provided, keep patterns consistent with them.

Be concise and practical. When the user describes changes they want, briefly confirm them and \
note which screen(s) each applies to — a separate step will turn them into a tracked change list. \
Do NOT invent screens that are not in the provided list. Respond in Markdown."""


def build_wireframe_chat_user_message(
    *,
    scope_label: str,
    screens: list[dict],
    design_tokens: dict | None,
    reference_screens: list[dict] | None,
    prd_context: str,
    user_message: str,
) -> str:
    parts: list[str] = []
    parts.append(f"## Scope\n{scope_label}")
    parts.append(f"## Screens in scope\n{_screen_list(screens)}")
    parts.append(f"## Active Design System tokens\n{_tokens_summary(design_tokens)}")

    for s in (screens or [])[:6]:
        html = (s.get("html") or "")[:_MAX_HTML]
        if html:
            parts.append(f"### Screen `{s.get('slug','')}` current HTML (truncated)\n{html}")

    for r in (reference_screens or [])[:2]:
        rhtml = (r.get("html") or "")[:_MAX_REF_HTML]
        if rhtml:
            parts.append(f"### Reference screen `{r.get('slug','')}` (style exemplar)\n{rhtml}")

    if (prd_context or "").strip():
        parts.append(f"## Product context (PRD/BRD excerpt)\n{prd_context.strip()[:5000]}")

    parts.append(f"## Question / feedback\n{user_message.strip()}")
    return "\n\n".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# 2) EXTRACT CHANGES (chat turn -> change list)
# ─────────────────────────────────────────────────────────────────────────────

WIREFRAME_EXTRACT_SYSTEM_PROMPT = """You convert a wireframe-feedback conversation turn into a \
structured list of ATOMIC change items.

Rules:
- Split into the smallest independently-applicable changes.
- Each item targets one or more screen slugs from the provided list (or scope=ALL when it applies \
to every screen). Never invent slugs not in the list.
- Classify each item:
    kind: "SCREEN" | "ALL" | "DESIGN_SYSTEM" | "QUESTION"
      - DESIGN_SYSTEM = brand color / typography / spacing applied project-wide.
      - QUESTION/discussion = not actionable; mark actionable=false.
    phase: "NOW" | "LATER"  ("later phase"/"future" wording => LATER)
    priority: "LOW" | "MEDIUM" | "HIGH"
- Preserve any callout reference like "(3)" in calloutRef.
- Only actionable items should drive edits; still return questions with actionable=false.

Return ONLY JSON, no prose:
{ "items": [ { "description": str, "targetScreens": [str], "scopeAll": bool, "kind": str,
  "phase": str, "priority": str, "calloutRef": str|null, "actionable": bool, "rationale": str } ] }"""


def build_wireframe_extract_user_message(
    *,
    scope_label: str,
    screens: list[dict],
    user_message: str,
    assistant_reply: str,
) -> str:
    parts = [
        f"## Scope\n{scope_label}",
        f"## Available screens (route to these slugs)\n{_screen_list(screens)}",
        f"## User feedback\n{user_message.strip()}",
    ]
    if (assistant_reply or "").strip():
        parts.append(f"## Assistant's reading (context)\n{assistant_reply.strip()[:4000]}")
    parts.append("Return the JSON change list now.")
    return "\n\n".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# 3) EDIT SCREEN (NL change -> edited HTML)
# ─────────────────────────────────────────────────────────────────────────────

WIREFRAME_EDIT_SYSTEM_PROMPT = """You are a UI engineer making a SURGICAL, on-brand edit to one \
wireframe screen's HTML.

CRITICAL rules:
- Apply ONLY the requested change; keep everything else intact.
- Use the provided Design System tokens (fonts, colors, radius, spacing). If reference screens are \
given, match their component/layout patterns.
- DO NOT renumber or drop existing numbered callouts. A new annotation may use a letter suffix on an \
existing number (e.g. "3a"). The set of base callout numbers must be unchanged.

Return ONLY the COMPLETE edited HTML document — starting with <!doctype html> or <html>. \
No JSON, no markdown fences, no commentary before or after."""


def build_wireframe_edit_user_message(
    *,
    html_content: str,
    change_request: str,
    design_tokens: dict | None,
    reference_screens: list[dict] | None,
    callouts: list[dict] | None,
    fidelity: str,
) -> str:
    parts = [
        f"## Fidelity\n{fidelity}",
        f"## Active Design System tokens\n{_tokens_summary(design_tokens)}",
        f"## Existing numbered callouts (preserve these base numbers)\n{json.dumps(callouts or [], ensure_ascii=False)}",
        f"## Change to apply\n{change_request.strip()}",
        f"## Current screen HTML\n{(html_content or '')[:_MAX_HTML]}",
    ]
    for r in (reference_screens or [])[:2]:
        rhtml = (r.get("html") or "")[:_MAX_REF_HTML]
        if rhtml:
            parts.append(f"## Reference screen `{r.get('slug','')}` (match these patterns)\n{rhtml}")
    parts.append("Return the JSON with the edited HTML now.")
    return "\n\n".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# 4) PARSE FEEDBACK DOCUMENT (bulk doc -> routed staging)
# ─────────────────────────────────────────────────────────────────────────────

WIREFRAME_PARSE_FEEDBACK_SYSTEM_PROMPT = """You parse a customer/internal wireframe review document \
into a screen-routed, reviewable change set.

Segment the text into:
- general[]:      project-wide observations that are NOT about brand styling (e.g. "make responsive").
- designSystem[]: project-wide BRAND/visual-system changes (color, typography, spacing).
- screens[]:      blocks tied to a specific screen. Match each to a slug from the provided list using \
its module + "Screen NN — Name". Carry the callout ref like "(3)" and a phase ("NOW"/"LATER" — \
"later phase"/"future" => LATER).
- unmatched[]:    feedback for screens NOT in the provided list (keep the raw block + a guessed name).

Each change item: { "description": str, "calloutRef": str|null, "phase": "NOW"|"LATER", "priority": "LOW"|"MEDIUM"|"HIGH" }.

Return ONLY JSON:
{ "general": [item], "designSystem": [item],
  "screens": [ { "moduleRef": str, "screenRef": str, "slug": str|null, "items": [item] } ],
  "unmatched": [ { "screenRef": str, "items": [item] } ] }"""


def build_wireframe_parse_feedback_user_message(
    *,
    raw_text: str,
    screens: list[dict],
) -> str:
    return "\n\n".join(
        [
            f"## Screens that exist (route to these slugs)\n{_screen_list(screens)}",
            f"## Feedback document\n{(raw_text or '').strip()[:50000]}",
            "Return the routed JSON now.",
        ]
    )
