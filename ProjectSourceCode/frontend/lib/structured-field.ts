/**
 * Frontend mirror of the backend `section-normalizer` (Sprint v6 · Track S · F2).
 * Kept tiny and in lock-step with
 * `backend/src/ba-tool/pipeline/section-normalizer.ts` so the inline editor can
 * render AI text (blue) vs human-edited text (ink) and round-trip with the server.
 */

export const AI_PREFIX = '[AI] ';
export const NEW_PREFIX = '[NEW] ';

export interface StructuredField {
  aiContent?: string;
  editedContent?: string;
  isNew?: boolean;
  lockedAt?: string | null;
  lastEditedAt?: string | null;
}

const FIELD_KEYS = ['aiContent', 'editedContent', 'isNew', 'lockedAt', 'lastEditedAt'];

export function isStructuredField(v: unknown): v is StructuredField {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v as object);
  if (keys.length === 0) return false;
  if (!keys.every((k) => FIELD_KEYS.includes(k))) return false;
  return 'aiContent' in (v as object) || 'editedContent' in (v as object);
}

/** A field value the inline editor can edit (a string or a structured field). */
export function isEditableField(v: unknown): boolean {
  return typeof v === 'string' || isStructuredField(v);
}

export function toStructured(raw: unknown): StructuredField {
  if (raw == null) return {};
  if (
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    ('aiContent' in (raw as object) || 'editedContent' in (raw as object))
  ) {
    const r = raw as StructuredField;
    const out: StructuredField = {};
    if (r.aiContent != null) out.aiContent = r.aiContent;
    if (r.editedContent != null) out.editedContent = r.editedContent;
    if (r.isNew) out.isNew = true;
    if (r.lockedAt != null) out.lockedAt = r.lockedAt;
    if (r.lastEditedAt != null) out.lastEditedAt = r.lastEditedAt;
    return out;
  }
  if (typeof raw === 'string') {
    let text = raw;
    let ai = false;
    let isNew = false;
    if (text.startsWith(AI_PREFIX)) {
      ai = true;
      text = text.slice(AI_PREFIX.length);
    }
    if (text.startsWith(NEW_PREFIX)) {
      isNew = true;
      text = text.slice(NEW_PREFIX.length);
    }
    return ai
      ? { aiContent: text, ...(isNew ? { isNew: true } : {}) }
      : { editedContent: text, ...(isNew ? { isNew: true } : {}) };
  }
  return { editedContent: String(raw) };
}

/** The raw text to show in an editor (no prefixes); edited wins over AI. */
export function fieldText(f: StructuredField): string {
  return f.editedContent ?? f.aiContent ?? '';
}

/** True when AI-generated and not yet human-edited (renders blue). */
export function isAi(f: StructuredField): boolean {
  return f.editedContent == null && f.aiContent != null;
}

export function isLocked(f: StructuredField): boolean {
  return f.lockedAt != null;
}

export function isNewItem(f: StructuredField): boolean {
  return !!f.isNew;
}
