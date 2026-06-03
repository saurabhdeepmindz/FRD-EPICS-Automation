/**
 * Section authoring status + review progress (Sprint v7 · Track X/W).
 *
 * Pure, content-derived (D2): authoring status is NOT a stored column — it's
 * computed from the section content (flattened through the v6 section-normalizer
 * so legacy flat `[AI]` values and structured fields are handled identically).
 */

import { toFlat, toStructured, isStructuredField } from './section-normalizer';

export type SectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
export type ReviewStatus = 'pending' | 'accepted' | 'edited' | 'skipped';

function nonEmpty(s: unknown): boolean {
  return typeof s === 'string' ? s.trim().length > 0 : s != null && String(s).trim().length > 0;
}

/** Collect every leaf display-string from a section value (deep, normalizer-aware). */
function collectLeaves(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return [v];
  if (isStructuredField(v)) return [toFlat(toStructured(v))];
  if (Array.isArray(v)) return v.flatMap(collectLeaves);
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).flatMap(collectLeaves);
  return [String(v)];
}

function statusOfLeaves(leaves: string[]): SectionStatus {
  const filled = leaves.filter((s) => nonEmpty(s)).length;
  if (leaves.length === 0 || filled === 0) return 'NOT_STARTED';
  if (filled === leaves.length) return 'COMPLETE';
  return 'IN_PROGRESS';
}

/** §6 (FRD): COMPLETE = every module has ≥1 feature with featureName + description. */
function frdStatus(body: unknown): SectionStatus {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'NOT_STARTED';
  const modules: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    const m = k.match(/^(6\.\d+)_(.+)$/);
    if (m) (modules[m[1]] ??= {})[m[2]] = v;
  }
  const modKeys = Object.keys(modules);
  if (!modKeys.length) return statusOfLeaves(collectLeaves(body));

  let complete = 0;
  let anyContent = 0;
  for (const mk of modKeys) {
    const mod = modules[mk];
    const feats = Array.isArray(mod.features) ? (mod.features as Record<string, unknown>[]) : [];
    if (feats.length || nonEmpty(toFlat(toStructured(mod.moduleName)))) anyContent++;
    const good = feats.filter(
      (f) =>
        nonEmpty(toFlat(toStructured(f.featureName))) &&
        nonEmpty(toFlat(toStructured(f.description))),
    );
    if (good.length >= 1) complete++;
  }
  if (anyContent === 0) return 'NOT_STARTED';
  return complete === modKeys.length ? 'COMPLETE' : 'IN_PROGRESS';
}

/** Authoring status for each of the 22 sections, derived from content. */
export function computeSectionStatuses(
  sections: Record<string, unknown> | null | undefined,
): Record<string, SectionStatus> {
  const out: Record<string, SectionStatus> = {};
  const s = sections ?? {};
  for (let n = 1; n <= 22; n++) {
    const key = String(n);
    out[key] = key === '6' ? frdStatus(s[key]) : statusOfLeaves(collectLeaves(s[key]));
  }
  return out;
}

export interface ReviewProgress {
  accepted: number;
  edited: number;
  skipped: number;
  pending: number;
}

/** Roll up the review map (any of the 22 keys not set counts as `pending`). */
export function computeReviewProgress(
  review: Record<string, unknown> | null | undefined,
): ReviewProgress {
  const r = review ?? {};
  const progress: ReviewProgress = { accepted: 0, edited: 0, skipped: 0, pending: 0 };
  for (let n = 1; n <= 22; n++) {
    const v = r[String(n)];
    if (v === 'accepted') progress.accepted++;
    else if (v === 'edited') progress.edited++;
    else if (v === 'skipped') progress.skipped++;
    else progress.pending++;
  }
  return progress;
}

/** Default review map — all 22 sections pending. */
export function emptyReviewMap(): Record<string, ReviewStatus> {
  const out: Record<string, ReviewStatus> = {};
  for (let n = 1; n <= 22; n++) out[String(n)] = 'pending';
  return out;
}
