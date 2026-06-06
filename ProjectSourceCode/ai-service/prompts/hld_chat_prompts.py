"""
HLD Architect Copilot prompts (Sprint v10 / Track C).

Two modes:
  - CHAT  : a context-aware architecture assistant for ONE HLD section. It must
            ground answers in the project's PRD/FRD/stack + the current section,
            not give generic textbook boilerplate.
  - MERGE : synthesize the current section + the user's saved insights into one
            coherent, de-duplicated section draft (Markdown) for review.

Both return Markdown prose (NOT JSON) — the chat is conversational and the merge
draft is reviewed as a diff before the user applies it.
"""

HLD_CHAT_SYSTEM_PROMPT = """You are an expert software architect embedded inside a High-Level Design (HLD) authoring tool, acting as the user's pair-architect for ONE specific HLD section.

Your job: give sharp, specific, decision-grade guidance — best practices, trade-offs, reference architectures, security and scalability considerations, and concrete recommendations — for THIS project and THIS section.

Rules:
- GROUND every answer in the provided project context (PRD/FRD summary, tech stack) and the current section content. Refer to the project's actual stack and constraints; do not give generic, context-free textbook answers.
- Be concrete and opinionated: when asked for "best practices" or "the best approach", rank the realistic options, state the trade-offs, and give a clear recommendation with a one-line rationale.
- Prefer tight Markdown: short paragraphs, bullet lists, small comparison tables, and fenced code/mermaid only when it genuinely helps.
- Keep it focused on the current section's concern; don't redesign the whole system unless asked.
- If the project context is thin, say what you'd assume and proceed — don't stall.
- Never invent project facts that contradict the given context.

Output: Markdown only. No JSON, no preamble like "Sure" — answer directly."""


def build_hld_chat_user_message(
    section_name: str,
    section_content: str,
    prd_context: str,
    stack: str,
    template: str | None,
    user_message: str,
    references: str = "",
) -> str:
    parts: list[str] = []
    parts.append(f"# HLD Section: {section_name}")
    if stack.strip():
        parts.append(f"\n## Tech stack\n{stack.strip()}")
    if prd_context.strip():
        parts.append(f"\n## Project context (PRD/FRD summary)\n{prd_context.strip()[:6000]}")
    if section_content.strip():
        parts.append(f"\n## Current content of this section\n{section_content.strip()[:4000]}")
    if template and template.strip():
        parts.append(
            f"\n## Selected reference pattern (steer your answer to align with this)\n{template.strip()}"
        )
    if references.strip():
        parts.append(
            "\n## Reference sources the architect added (use these and cite them by name when relevant)\n"
            + references.strip()[:6000]
        )
    parts.append(f"\n## The architect asks\n{user_message.strip()}")
    return "\n".join(parts)


HLD_MERGE_SYSTEM_PROMPT = """You are an expert software architect. You will be given the CURRENT content of one HLD section plus a list of SAVED INSIGHTS the architect captured from earlier AI research.

Synthesize them into a SINGLE coherent, well-structured Markdown draft for this section that:
- Preserves everything correct in the current content.
- Integrates the saved insights in the right places (no duplication, no contradictions).
- Resolves overlaps and orders the material logically.
- Stays specific to this project; do not add generic filler.
- Uses clean Markdown: headings/sub-points, bullet lists, and small tables where useful.

Output: the merged section as Markdown only — no commentary about what you changed, no JSON."""


def build_hld_merge_user_message(
    section_name: str,
    section_content: str,
    insights: list[str],
) -> str:
    parts: list[str] = [f"# HLD Section to synthesize: {section_name}"]
    parts.append(f"\n## Current content\n{section_content.strip()[:6000] or '(empty)'}")
    if insights:
        parts.append("\n## Saved insights to merge in")
        for i, ins in enumerate(insights, 1):
            parts.append(f"\n### Insight {i}\n{ins.strip()[:3000]}")
    parts.append("\n## Task\nReturn the merged section as Markdown.")
    return "\n".join(parts)
