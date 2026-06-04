"""
Hi-fi mockup generation prompts.
Implements skill 05 — Lo-fi Wireframes → Hi-fi Mockups.

Polishes lo-fi wireframes into branded high-fidelity HTML mockups. The
defining invariant: callout numbers MUST equal the lo-fi parent 1:1
(skill 05 §7). Hi-fi-only annotations use letter suffixes (e.g. "3a") —
never renumber. The NestJS backend persists this as BaHifiSet +
BaHifiScreen rows and runs a deterministic parity validator.
"""

HIFI_SYSTEM_PROMPT = """You are a senior UI designer translating lo-fi \
wireframes into polished, branded high-fidelity HTML mockups. Hi-fi here \
means: **production-quality visuals, realistic content, real-feel \
interactions** — but **still annotated** so a reviewer can verify nothing \
was lost in translation from the Approach Note.

You receive a complete lo-fi wireframe set (from Stage 4) plus brand tokens \
and synthetic seed data. For each lo-fi screen, produce one hi-fi screen \
with polished HTML, realistic content, and the SAME callout numbers.

**CRITICAL RULE — callout-number parity (skill 05 §7):**

- Hi-fi callout numbers MUST equal the lo-fi parent's 1:1.
- If the lo-fi screen has callouts [1, 2, 3, 4, 5], the hi-fi must have \
  callouts [1, 2, 3, 4, 5] mapping to the same UI elements.
- If you must add a hi-fi-only annotation (e.g. for a keyboard shortcut), \
  use a letter suffix: "3a". NEVER renumber existing callouts.
- The deterministic parity validator on the server side will reject any \
  hi-fi set whose callouts don't match the lo-fi parent.

**Visual upgrades from lo-fi to hi-fi:**

- Dashed-border placeholder boxes → solid cards with subtle shadows
- `[BUTTON]` ASCII → real buttons with hover/focus states using brand CTA
- ASCII model badges → coloured pills (Haiku=teal, Sonnet=indigo, Opus=violet)
- ASCII tables → HTML tables with banded rows, sticky headers
- ASCII bars → real `<svg>` sparklines / progress meters
- Realistic content using the supplied synthetic seed data (no `[PLACEHOLDER]`, \
  no `Lorem Ipsum`)
- Numbered callouts rendered as floating orange badges (24px circles, \
  positioned absolutely next to each annotated element)

**Things that DON'T change from lo-fi to hi-fi:**

- Layout structure (left sidebar / main / right panel — same skeleton)
- Order of elements
- **Numbered callouts and their mapping to FRs — IDENTICAL to lo-fi**
- Phase-2 disabled affordances (still disabled, just polished)
- Information density per screen (don't add new sections)

**Brand tokens** (use these as inline `style` attributes; HTML must be \
self-contained for sandboxed-iframe rendering):

- `--brand-primary` for headers and dark surfaces
- `--brand-surface` for content cards
- `--brand-cta` for primary buttons and callout badges

Return ONLY valid JSON matching this schema (no commentary):

{
  "screens": [
    {
      "sequenceNum": 1,
      "slug": "landing",
      "title": "Landing",
      "callouts": [
        { "n": 1, "description": "Primary CTA — links to chat", "mappedTo": "FR-2" },
        { "n": 2, "description": "Tagline — sets product name and audience", "mappedTo": "§3.10 Branding" }
      ],
      "htmlContent": "<!DOCTYPE html><html>...self-contained polished HTML...</html>"
    }
  ],
  "syntheticDataNotes": "Brief note on the synthetic data conventions used (e.g. 'Mr Sharma is the recurring example customer across all screens')."
}

Order the hi-fi screens to match the lo-fi sequenceNum 1:1.
"""


def build_hifi_user_message(
    lofi_screens: list,
    brand_tokens: dict,
    synthetic_seed: dict | None,
    product_name: str = "",
) -> str:
    """Compose the user message for hi-fi generation."""
    lines: list[str] = []
    lines.append(f"Product name: {product_name or '(use brand tokens.productName)'}")
    lines.append("")
    lines.append("Brand tokens (use in HTML rendering):")
    lines.append(f"  primary:  {brand_tokens.get('primary', '#0B1B2E')}")
    lines.append(f"  surface:  {brand_tokens.get('surface', '#FFFFFF')}")
    lines.append(f"  cta:      {brand_tokens.get('cta', '#F97316')}")
    lines.append(f"  productName: {brand_tokens.get('productName', '—')}")
    lines.append("")

    if synthetic_seed:
        lines.append("Synthetic seed data (use consistently across all screens):")
        for k, v in synthetic_seed.items():
            lines.append(f"  {k}: {v}")
        lines.append("")
    else:
        lines.append("Synthetic seed data: AUTO — invent coherent placeholder data appropriate for the product.")
        lines.append("")

    lines.append(f"Lo-fi wireframe set ({len(lofi_screens)} screens):")
    lines.append("")
    for s in lofi_screens:
        if not isinstance(s, dict):
            continue
        seq = s.get("sequenceNum", "?")
        title = s.get("title", "Untitled")
        slug = s.get("slug", "")
        pattern = s.get("pattern", "—")
        callouts = s.get("callouts") or []
        lines.append(f"--- Screen {seq}: {title} ({slug}) — pattern: {pattern} ---")
        lines.append(f"Callouts ({len(callouts)}) — REPRODUCE EXACTLY:")
        for c in callouts:
            if not isinstance(c, dict):
                continue
            lines.append(f"  ({c.get('n', '?')}) {c.get('description', '')} → mappedTo: {c.get('mappedTo', '')}")
        if s.get("mdContent"):
            lines.append("Lo-fi markdown source (reference for layout):")
            lines.append(str(s["mdContent"]).strip()[:2000])
        lines.append("")

    return "\n".join(lines)


# ── Lo-fi (grey-box) generation prompt — Sprint v9 · Track GG (GG-03) ──────────
# Used by /hifi-generate when fidelity == "lofi": produce LOW-fidelity, grey-box
# structural wireframes (NOT branded). Same JSON schema as hi-fi so the caller is
# uniform. Callouts MUST be preserved 1:1 from the input.
LOFI_SYSTEM_PROMPT = """You are a UX designer producing LOW-FIDELITY, grey-box \
wireframes (NOT polished hi-fi). Translate each input screen into a structural \
HTML skeleton that communicates layout and hierarchy only.

STRICT RULES:
- GREY-BOX ONLY: use whites/greys and dashed/solid light-grey borders. Do NOT use \
brand colors, photos, gradients, or real imagery. Placeholders are grey blocks, \
short grey bars for text, and outlined buttons. One subtle accent is acceptable \
ONLY for the single primary action.
- Convey the screen's real STRUCTURE for its purpose (e.g. an auth screen = centered \
card with fields + primary button; a list/search = search bar + filter chips + \
repeated row cards; a dashboard = KPI tiles + chart placeholders; a detail = header \
+ main/aside columns; a checkout = form + order-summary column; a form = stepper + \
labelled field rows + submit).
- Self-contained HTML document with an inline <style>. No external assets/fonts/JS.
- Keep it lightweight (well under ~6KB per screen).
- Preserve the input callouts EXACTLY 1:1 (same numbers/markers); render them as a \
small numbered notes list at the bottom.

Return ONLY a single JSON object:
{"screens":[{"sequenceNum":<int>,"slug":"<slug>","title":"<title>",\
"htmlContent":"<full grey-box html>","callouts":[{"n":<n>,"description":"<text>","mappedTo":"<ref>"}]}]}"""
