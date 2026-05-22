"""
Wireframe set generation prompts.
Implements skill 04 — Approach Note → Lo-fi Wireframes.

The prompt produces a complete lo-fi wireframe set as structured JSON: one
overview screen (00) plus N detail screens, each with markdown body, HTML
rendering, numbered callouts, and components inventory. The NestJS backend
persists this as BaWireframeSet + BaWireframeScreen rows.
"""

WIREFRAME_SYSTEM_PROMPT = """You are a senior product / UX architect translating \
an Approach Note into a complete set of lo-fi wireframes. Lo-fi here means: \
**structure and information flow over visual polish**. Your output is the spec \
a hi-fi mockup designer (Stage 5) consumes — every UI element must be \
traceable back to a Functional Requirement or section in the Approach Note.

You receive the project's Approach Note (FRs in §3, branding in §3.10, frontend \
folder structure in §3.12.5, screen inventory in §10) and produce 7-14 screens \
using the **13-pattern catalogue** (skill 04 §4):

  §4.1  Landing / entry
  §4.2  Conversational / chat surface
  §4.3  Read-only browse / list
  §4.4  Read-only detail / drill-down
  §4.5  Search / filter / catalogue browser
  §4.6  One-time setup wizard
  §4.7  Admin / dashboard home
  §4.8  CRUD form (create / edit)
  §4.9  Audio-assisted form
  §4.10 Modal / quick-add overlay
  §4.11 Configuration / settings
  §4.12 Observability dashboard
  §4.13 Analytics / business-impact dashboard

For each screen produce:

1. **Markdown body** (`mdContent`) per skill 04 §5.2 — ASCII-art layout sketch,
   numbered annotations table, components inventory, states-to-consider list,
   feature traceability footer.
2. **HTML rendering** (`htmlContent`) per skill 04 §5.3 — visual sketch with
   dashed-border placeholder boxes, orange numbered callout badges,
   browser-style chrome. The HTML must reference the brand tokens passed in
   the request (use them as inline `style` attributes since this HTML is
   shipped standalone in a sandboxed iframe).
3. **Structured callouts** array — every numbered annotation is also exposed
   in a parseable `callouts` array.
4. **Components inventory** — references real file paths from the AN's
   frontend folder structure (§3.12.5).

Rules:

- Every FR / numbered section in the AN has at least one `mappedTo` reference
  in some screen's callouts. No orphan FRs.
- Every screen has at least one callout. No orphan screens.
- Phase-2 features must remain **visibly disabled** in the wireframes (not
  hidden) — show them as greyed buttons with a "Phase 2" label.
- Use the brand tokens supplied in the request for the HTML rendering's
  background / surface / CTA colors.
- HTML must be self-contained (no external CSS) — inline a small `<style>`
  block per screen.

Return ONLY valid JSON matching this schema (no commentary):

{
  "screens": [
    {
      "sequenceNum": 1,
      "slug": "landing",
      "title": "Landing",
      "pattern": "§4.1 Landing",
      "callouts": [
        { "n": 1, "description": "Primary CTA button — links to chat", "mappedTo": "FR-2" },
        { "n": 2, "description": "Tagline — sets product name and audience", "mappedTo": "§3.10 Branding" }
      ],
      "components": [
        { "file": "app/page.tsx", "purpose": "This route" },
        { "file": "components/layout/Header.tsx", "purpose": "Branded header (logo only on Landing)" }
      ],
      "mdContent": "# Wireframe 01 — Landing\\n\\n...full markdown per skill 04 §5.2...",
      "htmlContent": "<!DOCTYPE html><html>...full self-contained HTML per skill 04 §5.3...</html>",
      "frRefs": ["FR-2"]
    }
  ],
  "coverageNotes": "Brief plain-text note about coverage — e.g. 'All 7 FRs covered, no orphan screens.'"
}

Order screens linearly from 1: landing → primary surface → drill-downs →
admin → CRUD forms → modals. Use the AN §10 screen inventory if it specifies
particular screens; otherwise infer from the FRs.
"""


def build_wireframe_user_message(
    an_sections: dict,
    fr_table: list,
    brand_tokens: dict,
    selected_patterns: list[str] | None,
    product_name: str = "",
) -> str:
    """Compose the user message for wireframe generation."""
    lines: list[str] = []
    lines.append(f"Product name: {product_name or '(derive from AN §1 / §3.10)'}")
    lines.append("")
    lines.append("Brand tokens (use in HTML rendering):")
    lines.append(f"  primary:  {brand_tokens.get('primary', '#0B1B2E')}")
    lines.append(f"  surface:  {brand_tokens.get('surface', '#FFFFFF')}")
    lines.append(f"  cta:      {brand_tokens.get('cta', '#F97316')}")
    lines.append(f"  productName: {brand_tokens.get('productName', '—')}")
    lines.append("")

    if selected_patterns:
        lines.append("Patterns the user has explicitly selected (use only these):")
        for p in selected_patterns:
            lines.append(f"  - {p}")
        lines.append("")
    else:
        lines.append("Pattern selection: AUTO — pick from the 13-pattern catalogue based on AN content.")
        lines.append("")

    if fr_table:
        lines.append("BRD FRs (must each appear as `mappedTo` on at least one callout):")
        for r in fr_table:
            if not isinstance(r, dict):
                continue
            lines.append(f"  {r.get('id', '?')}: {r.get('requirement', '')}")
        lines.append("")

    lines.append("AN content — section-by-section:")
    lines.append("")
    for key in [str(i) for i in range(1, 12)]:
        body = an_sections.get(key, "")
        if not body or not str(body).strip():
            continue
        lines.append(f"--- AN §{key} ---")
        lines.append(str(body).strip())
        lines.append("")

    return "\n".join(lines)
