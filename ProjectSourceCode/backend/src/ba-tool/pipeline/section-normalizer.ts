/**
 * Section value normalizer (Sprint v6 · Track S · foundation decision F2).
 *
 * Bridges two representations of a PRD/HLD section field value:
 *   - Legacy flat form: a string, optionally prefixed `"[AI] "` (AI-generated) and
 *     `"[NEW] "` (a net-new item added beyond the canonical baseline).
 *   - Structured form: `{ aiContent, editedContent, isNew, lockedAt, lastEditedAt }`
 *     — the shape documented on `BaProjectPrd.sections` but never previously built.
 *
 * The structured form is what powers the inline editor (blue = AI, ink = human edit,
 * lock = protected from regeneration). This module is the SINGLE SEAM every reader
 * goes through, so that:
 *   - flattening legacy data is a no-op (round-trip stable), and
 *   - once the editor starts persisting structured fields, every reader (markdown
 *     export, AI context feeds, RTM) still sees clean flat text — never raw
 *     `{ aiContent: ... }` objects leaking into prompts or exports.
 *
 * Pure functions only — no I/O, no Prisma. Operates at the field-VALUE level; the
 * section-walkers (`flattenValue` / `flattenSections`) recurse so nested structures
 * (e.g. §6 FRD module → features[].description) are handled automatically.
 */

export const AI_PREFIX = '[AI] ';
export const NEW_PREFIX = '[NEW] ';

/** Structured representation of a single section field value. */
export interface StructuredField {
  /** AI-generated text (renders blue until a human edits it). */
  aiContent?: string;
  /** Human-edited text (renders in normal ink; wins over `aiContent`). */
  editedContent?: string;
  /** True when this is a net-new item added beyond the canonical baseline (S-09/S-10). */
  isNew?: boolean;
  /** ISO timestamp — when set, regeneration must NOT overwrite this field. */
  lockedAt?: string | null;
  /** ISO timestamp of the last human edit. */
  lastEditedAt?: string | null;
}

const FIELD_KEYS: ReadonlyArray<keyof StructuredField> = [
  'aiContent',
  'editedContent',
  'isNew',
  'lockedAt',
  'lastEditedAt',
];

/**
 * Narrow an unknown value to a `StructuredField`. Deliberately strict: every key
 * must be a known field key AND at least one content key must be present, so a
 * domain object like an FRD feature `{ featureId, description }` is NOT mistaken
 * for a structured field (it has unknown keys → recursed as a plain object).
 */
export function isStructuredField(v: unknown): v is StructuredField {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v as object);
  if (keys.length === 0) return false;
  if (!keys.every((k) => (FIELD_KEYS as ReadonlyArray<string>).includes(k))) return false;
  return 'aiContent' in (v as object) || 'editedContent' in (v as object);
}

/**
 * Normalize any stored field value into the structured form.
 * - `"[AI] text"`            → `{ aiContent: "text" }`
 * - `"[AI] [NEW] text"`      → `{ aiContent: "text", isNew: true }`
 * - `"text"`                 → `{ editedContent: "text" }`
 * - already-structured       → a clean copy (only known keys)
 * - null/undefined           → `{}`
 */
export function toStructured(raw: unknown): StructuredField {
  if (raw == null) return {};

  // Lenient on purpose: any object carrying a content key is treated as structured
  // (stray keys are dropped). This is broader than `isStructuredField`, which stays
  // strict so `flattenValue` never mistakes a domain object for a field.
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

  // Non-string scalar (number/boolean) — treat as a human-set literal.
  return { editedContent: String(raw) };
}

/**
 * Collapse a structured field back to its flat display/export form.
 * - Human edit wins over AI content (and drops the `[AI] ` prefix).
 * - The `[AI] ` prefix is re-applied only for AI-only (un-edited) content.
 * - The `[NEW] ` marker is preserved (after any `[AI] `) so the "new" chip survives.
 */
export function toFlat(field: StructuredField): string {
  const base = field.editedContent ?? field.aiContent ?? '';
  if (base === '') return '';
  const aiOnly = field.editedContent == null && field.aiContent != null;
  const prefix = `${aiOnly ? AI_PREFIX : ''}${field.isNew ? NEW_PREFIX : ''}`;
  return `${prefix}${base}`;
}

/** True when the value is AI-generated and not yet human-edited (renders blue). */
export function isAi(field: StructuredField): boolean {
  return field.editedContent == null && field.aiContent != null;
}

/** True when the field is locked against regeneration overwrite. */
export function isLocked(field: StructuredField): boolean {
  return field.lockedAt != null;
}

/** Convenience: stored raw value → flat display string (identity on legacy flat data). */
export function displayText(raw: unknown): string {
  return toFlat(toStructured(raw));
}

/**
 * Deep-flatten any section value to its display/export form. Recurses through
 * arrays and plain objects so nested structures (FRD features, etc.) are handled.
 * Strings and structured fields collapse to flat text; everything else is mapped
 * structurally. No-op (round-trip stable) on legacy flat data.
 */
export function flattenValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === 'string') return displayText(v);
  if (isStructuredField(v)) return toFlat(toStructured(v));
  if (Array.isArray(v)) return v.map((el) => flattenValue(el));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = flattenValue(val);
    }
    return out;
  }
  return v; // number / boolean
}

/**
 * Flatten a whole `sections` object (`{ [sectionKey]: sectionBody }`) for export
 * or AI consumption. Each section body is deep-flattened.
 */
export function flattenSections(
  sections: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!sections) return {};
  const out: Record<string, unknown> = {};
  for (const [key, body] of Object.entries(sections)) {
    out[key] = flattenValue(body);
  }
  return out;
}
