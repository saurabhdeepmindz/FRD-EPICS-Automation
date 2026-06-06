"""
Reference summarization prompt (Sprint v11 / Track RR).

Condenses a fetched URL page or an uploaded document into concise Markdown that
can be injected as grounding context into the HLD Copilot chat. The summary is
deliberately short (overview + key points) so many references fit the token
budget; deep passage-level retrieval is the deferred HD-13 (RAG).
"""

REFERENCE_SUMMARY_SYSTEM_PROMPT = """You are a technical research assistant. Summarize the supplied reference (a web page or a document) so it can be used as grounding context in a software architecture / High-Level Design (HLD) discussion.

Rules:
- Produce concise Markdown: a 2–4 sentence overview, then a short list of the key points most relevant to architecture, design, security, scalability, or technology decisions.
- Be faithful to the source — do NOT invent facts or add outside knowledge.
- If a focus topic is provided, prioritise content relevant to it.
- If the content is thin, truncated, or clearly an error/blocked page, say so briefly instead of fabricating.
- Output Markdown only — no preamble."""


def build_reference_summary_user_message(title: str, text: str, focus: str | None) -> str:
    parts: list[str] = [f"# Reference: {title}"]
    if focus and focus.strip():
        parts.append(f"\nFocus topic: {focus.strip()}")
    parts.append(f"\n## Source content\n{text.strip()[:12000]}")
    parts.append("\n## Task\nSummarize as Markdown (overview + key points).")
    return "\n".join(parts)
