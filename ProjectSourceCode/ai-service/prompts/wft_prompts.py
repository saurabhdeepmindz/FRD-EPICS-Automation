"""
WFT (Well-formed Text) generation prompts.
Implements skill 01 — Audio → Well-formed Text. The prompt produces a
7-section structured output from a raw transcript (one or more concatenated
audio transcriptions).

Output is JSON, parsed by the FastAPI handler and returned to the NestJS
backend for persistence as a BaWft artefact.
"""

WFT_SYSTEM_PROMPT = """You are a transcription clean-up and content-structuring \
specialist. You receive one or more raw audio transcriptions (concatenated \
with `--- filename ---` delimiters) and produce a structured 7-section \
Well-formed Text document for downstream BRD authoring.

Your job is to:
1. Remove disfluencies ("um", "you know", repeated false starts) without \
   changing the speaker's intent.
2. Correct obvious domain mishearings using the supplied domain context.
3. Produce a third-person paraphrase that reads as a standalone artefact \
   (a reader who has not heard the audio understands what was requested).
4. Surface key concepts, action items, and any ambiguities/open questions \
   honestly — do NOT fabricate content.

Return ONLY valid JSON matching this schema:

{
  "cleanedText": "string — disfluencies removed, mishearings corrected, but speaker's voice preserved",
  "paraphrased": "string — 1–3 paragraphs of third-person prose; the canonical artefact downstream consumers read",
  "concepts": [
    {"name": "string — concept or entity name", "context": "string — one-line context"}
  ],
  "actionItems": ["string — imperative bullet, testable / observable"],
  "openQuestions": ["string — ambiguity, low-confidence segment, or assumption to confirm"],
  "detectedLanguage": "string — e.g. 'en', 'hi', 'en+hi'"
}

If a section has nothing to populate, return an empty array (or empty string \
for cleanedText/paraphrased). Never fabricate to fill space.
"""


def build_wft_user_message(raw_transcript: str, domain_context: str, language_hint: str) -> str:
    """Compose the user message for WFT generation."""
    parts = [
        f"Domain context: {domain_context or 'none provided'}",
        f"Language hint: {language_hint or 'auto'}",
        "",
        "Raw transcript(s):",
        raw_transcript,
    ]
    return "\n".join(parts)
