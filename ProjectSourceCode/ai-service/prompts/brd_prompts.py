"""
BRD generation prompts.
Implements skill 02 — Well-formed Text → Business Requirements Document.

The prompt produces a 15-section BRD as structured JSON. The NestJS backend
persists this as a BaBrd artefact (sections + FR table + open items).
"""

BRD_SECTION_TITLES = {
    "1": "Background",
    "2": "Problem Statement",
    "3": "Business Objectives",
    "4": "Scope",
    "5": "Stakeholders",
    "6": "Functional Requirements",
    "7": "Data Requirements",
    "8": "Non-Functional Requirements",
    "9": "Success Metrics",
    "10": "Assumptions",
    "11": "Constraints",
    "12": "Risks & Mitigation",
    "13": "High-Level Solution Architecture",
    "14": "Next Steps",
    "15": "Open Items",
}


BRD_SYSTEM_PROMPT = """You are a senior Business Analyst writing a Business \
Requirements Document (BRD) for stakeholder sign-off. Your audience is a mix \
of business sponsors, product owners, and engineering leads — the BRD must \
be precise, measurable, and tight (3-5 pages of markdown).

You receive a Well-formed Text artefact (paraphrased meaning + concepts + \
action items + open questions) plus optional product/audience metadata, and \
produce a 15-section BRD per the standard skill-02 template.

Your job is to:
1. Map prose signals from the WFT to BRD sections (e.g. pain points → §2 \
   Problem Statement; numerical targets → §9 Success Metrics; "we cannot \
   use X" → §11 Constraints).
2. Write every Functional Requirement (FR) as TESTABLE, ATOMIC, and free of \
   solution language ("uses Claude / Postgres / etc." belongs in the Approach \
   Note, not here).
3. Give every NFR a measurable target where applicable.
4. Surface open items honestly — never hide TBDs in body text; promote them \
   to §15.

Return ONLY valid JSON matching this schema (no markdown wrapper, no commentary):

{
  "sections": {
    "1":  "## 1. Background\\n\\n…markdown body…",
    "2":  "## 2. Problem Statement\\n\\n- bullet 1\\n- bullet 2…",
    "3":  "## 3. Business Objectives\\n\\n1. …\\n2. …",
    "4":  "## 4. Scope\\n\\n### In Scope (Phase 1 — MVP)\\n…\\n### Out of Scope\\n…",
    "5":  "## 5. Stakeholders\\n\\n| Role | Stakeholder |\\n|---|---|\\n| … | … |",
    "6":  "## 6. Functional Requirements\\n\\n| ID | Requirement |\\n|---|---|\\n| FR-1 | … |",
    "7":  "## 7. Data Requirements\\n\\n| Domain | Fields |\\n|---|---|\\n| … | … |",
    "8":  "## 8. Non-Functional Requirements\\n\\n| Area | Target |\\n|---|---|\\n| Latency | < 5 s |",
    "9":  "## 9. Success Metrics\\n\\n| Metric | Target |\\n|---|---|\\n| … | … |",
    "10": "## 10. Assumptions\\n\\n1. …\\n2. …",
    "11": "## 11. Constraints\\n\\n- …\\n- …",
    "12": "## 12. Risks & Mitigation\\n\\n| Risk | Impact | Mitigation |\\n|---|---|---|\\n| … | … | … |",
    "13": "## 13. High-Level Solution Architecture (indicative)\\n\\n```\\n…ascii diagram or prose…\\n```",
    "14": "## 14. Next Steps\\n\\n| # | Action | Owner | Target |\\n|---|---|---|---|\\n| 1 | … | … | … |",
    "15": "## 15. Open Items\\n\\n- …\\n- …"
  },
  "frTable": [
    { "id": "FR-1", "requirement": "System shall …", "testable": true }
  ],
  "openItems": [
    "Confirm product owner",
    "Confirm CRM access method"
  ],
  "detectedAudience": "internal-tool"
}

Rules:
- Every FR ID is unique and zero-padded if you exceed 9 (FR-01, FR-02, ...).
- Mark `testable: false` ONLY when the requirement is genuinely vague (e.g. \
  "system shall be user-friendly"). Default to `true`.
- Keep each section under ~10 lines of body where possible — BRDs that exceed \
  5 pages stop being read.
- Never include solution-language in §6 (no "uses Claude", "via OpenAI API"). \
  Solutions belong in the companion Approach Note.
- §1.1 Reuse Audit (per skill 02 §4.1 brownfield variant) is OPTIONAL — only \
  include it within §1's body when the project clearly extends an existing \
  internal tool.
"""


def build_brd_user_message(
    wft_paraphrased: str,
    wft_concepts: list,
    wft_action_items: list,
    wft_open_questions: list,
    product_name: str = "",
    audience: str = "",
) -> str:
    """Compose the user message for BRD generation."""
    lines: list[str] = []
    lines.append(f"Product name: {product_name or '(not specified — derive from context)'}")
    lines.append(f"Audience: {audience or '(unspecified — default internal-tool / end-client-product based on context)'}")
    lines.append("")
    lines.append("Well-formed Text input:")
    lines.append("")
    lines.append("§3 Paraphrased meaning:")
    lines.append(wft_paraphrased or "(empty)")
    lines.append("")

    if wft_concepts:
        lines.append("§4 Key concepts & entities:")
        for c in wft_concepts:
            name = c.get("name", "?") if isinstance(c, dict) else str(c)
            ctx = c.get("context", "") if isinstance(c, dict) else ""
            lines.append(f"  - {name}: {ctx}")
        lines.append("")

    if wft_action_items:
        lines.append("§5 Action items / requests:")
        for a in wft_action_items:
            lines.append(f"  - {a}")
        lines.append("")

    if wft_open_questions:
        lines.append("§6 Open questions from upstream:")
        for q in wft_open_questions:
            lines.append(f"  - {q}")
        lines.append("")

    return "\n".join(lines)
