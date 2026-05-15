/**
 * SUBTASK canonical restructurer.
 *
 * Why this file exists: SUBTASK is stored as MANY `BaArtifactSection`
 * rows — typically one per subtask (ST-USNNN-TEAM-NN, ~5-7 KB body
 * each), interleaved with "SubTask Decomposition for US-NNN" header
 * rows the LLM emits as story-group separators. The header rows are
 * short context labels, not deliverable content. The export used to
 * render every row verbatim, polluting the TOC with the separator
 * rows and producing non-deterministic ordering across LLM runs.
 *
 * Strategy: walk source sections, identify subtasks by their
 * ST-USNNN-TEAM-NN identifier (label or body), group by parent user
 * story (US-NNN), sort deterministically (by story then by team then
 * by subtask index), drop separator-marker rows, and emit one
 * canonical `BaSectionLite` per subtask.
 *
 * Story-group context (carried in the dropped header rows) is
 * preserved as an optional preamble — a synthetic "User Story US-NNN
 * — <name>" caption section before that story's subtasks. If the
 * header row was missing in the source, the caption is synthesized
 * from the subtasks' linked user story ID alone.
 *
 * Defense-in-depth with the (forthcoming) SKILL-05 post-emission
 * validator (DEFERRED-IMPROVEMENTS §0). Together they ensure both
 * generation-time AND render-time canonical structure for SubTasks.
 *
 * Mirrors the pattern in `frd-restructure.ts`, `ftc-restructure.ts`,
 * `epic-restructure.ts`, and `user-story-restructure.ts`.
 */

import type { BaArtifactDoc, BaSectionLite } from './artifact-html';

const SUBTASK_ID_RE = /\bST-(US\d{3,})-([A-Z]{2,4})-(\d{2,})\b/;
const STORY_HEADER_RE = /^SubTask\s+Decomposition\s+for\s+(US-\d{3,})/i;
const MIN_SUBTASK_BODY_CHARS = 200;

interface ParsedSubtask {
  subtaskId: string;          // ST-USNNN-TEAM-NN
  storyId: string;            // US-NNN
  team: string;               // FE / BE / QA / DEV-OPS / DOC / etc.
  sequenceNumber: number;     // 1, 2, 3, ...
  content: string;            // full subtask body
  source: BaSectionLite;      // original row (for timestamps)
  derivedName: string | null; // best-effort label
}

interface StoryHeader {
  storyId: string;
  label: string;              // the original "SubTask Decomposition for US-NNN — ..." text
  content: string;            // story context body
  source: BaSectionLite;
}

function makeSyntheticSection(
  id: string,
  sectionKey: string,
  sectionLabel: string,
  content: string,
  source: BaSectionLite | undefined,
  displayOrder: number,
): BaSectionLite {
  const now = new Date();
  return {
    id,
    sectionKey,
    sectionLabel,
    content,
    editedContent: null,
    isHumanModified: source?.isHumanModified ?? false,
    aiGenerated: source?.aiGenerated ?? true,
    displayOrder,
    createdAt: source?.createdAt ?? now,
    updatedAt: source?.updatedAt ?? now,
  };
}

/**
 * Try to recover ST-USNNN-TEAM-NN from a section's label or first lines
 * of body. Returns null when the row isn't a subtask (story-group
 * header, summary section, etc.) — caller routes those separately.
 */
function tryParseSubtask(section: BaSectionLite): ParsedSubtask | null {
  const content = (section.isHumanModified && section.editedContent ? section.editedContent : section.content) ?? '';
  if (content.length < MIN_SUBTASK_BODY_CHARS) return null;
  let m = SUBTASK_ID_RE.exec(section.sectionLabel);
  if (!m) {
    const firstLines = content.split(/\r?\n/).slice(0, 8).join(' ');
    m = SUBTASK_ID_RE.exec(firstLines);
  }
  if (!m) return null;
  const subtaskId = `ST-${m[1]}-${m[2]}-${m[3]}`;
  const derivedName = deriveSubtaskName(section.sectionLabel, content);
  return {
    subtaskId,
    storyId: m[1].startsWith('US-') ? m[1] : `US-${m[1].replace(/^US/, '')}`,
    team: m[2].toUpperCase(),
    sequenceNumber: parseInt(m[3], 10),
    content,
    source: section,
    derivedName,
  };
}

/**
 * Try to recover a story-group header row ("SubTask Decomposition for
 * US-NNN — context"). Header rows are short (~800-1100 chars) and
 * carry story context the reader benefits from seeing above each
 * story's subtasks.
 */
function tryParseStoryHeader(section: BaSectionLite): StoryHeader | null {
  const m = STORY_HEADER_RE.exec(section.sectionLabel);
  if (!m) return null;
  const content = (section.isHumanModified && section.editedContent ? section.editedContent : section.content) ?? '';
  return {
    storyId: m[1],
    label: section.sectionLabel,
    content,
    source: section,
  };
}

/**
 * Derive a short subtask display name from the original label. The
 * convention "ST-USNNN-TEAM-NN — <Name>" puts the name after the em-
 * dash; we strip the ST-... prefix to leave a clean label suffix.
 */
function deriveSubtaskName(label: string, content: string): string | null {
  const fromLabel = /ST-US\d{3,}-[A-Z]{2,4}-\d{2,}\s*[—\-:]\s*(.+)$/.exec(label);
  if (fromLabel) return fromLabel[1].trim().slice(0, 120);
  // Fallback: first non-heading line of body.
  const firstLine = content
    .split(/\r?\n/)
    .find((l) => l.trim() && !l.startsWith('#'));
  return firstLine ? firstLine.trim().slice(0, 120) : null;
}

/**
 * Numeric sort that puts ST-US052-FE-01 before ST-US052-FE-02 before
 * ST-US052-QA-01 before ST-US053-BE-01 (by story, then team alpha,
 * then sequence number).
 */
function compareSubtasks(a: ParsedSubtask, b: ParsedSubtask): number {
  const storyA = parseInt(a.storyId.replace(/\D/g, ''), 10);
  const storyB = parseInt(b.storyId.replace(/\D/g, ''), 10);
  if (storyA !== storyB) return storyA - storyB;
  if (a.team !== b.team) return a.team.localeCompare(b.team);
  return a.sequenceNumber - b.sequenceNumber;
}

/**
 * Restructure a SUBTASK doc into the canonical shape. Returns the
 * input unchanged when `artifactType !== 'SUBTASK'`.
 *
 * Output structure:
 *   - Optional preamble: "Coverage / SubTask Index" summary if present.
 *   - For each story (sorted by US-NNN numerically):
 *       * Optional caption section "Story US-NNN — <story name>"
 *         (only when the source emitted a recognisable header row).
 *       * One section per subtask, ordered FE → BE → QA → others by
 *         team alpha, then by sequence number within team.
 *   - Labels normalised to "ST-USNNN-TEAM-NN — <name>" for stable TOC.
 *
 * Degraded-input handling: if zero subtasks are recovered (LLM emitted
 * a completely different structure), the original sections are
 * returned so the export still shows whatever content exists.
 */
export function restructureSubtaskDoc(doc: BaArtifactDoc): BaArtifactDoc {
  if (doc.artifactType !== 'SUBTASK') return doc;

  const source = [...doc.sections].sort((a, b) => a.displayOrder - b.displayOrder);
  if (source.length === 0) return doc;

  const subtasks: ParsedSubtask[] = [];
  const storyHeaders = new Map<string, StoryHeader>();
  let coverageSection: BaSectionLite | null = null;

  // Coverage section detection — anchor to label start AND reject any
  // row that carries a ST-USNNN-TEAM-NN identifier (subtask names like
  // "Integration and Error Handling Test Coverage" would otherwise match
  // and the subtask would be lost from the canonical ordering).
  const isCoverageLabel = (label: string): boolean =>
    /^(coverage\s+summary|overview|index|coverage\b)/i.test(label.trim()) &&
    !SUBTASK_ID_RE.test(label);

  for (const s of source) {
    if (!coverageSection && isCoverageLabel(s.sectionLabel) && (s.content ?? '').trim().length > 200) {
      coverageSection = s;
      continue;
    }
    const header = tryParseStoryHeader(s);
    if (header) {
      // Keep the first / most substantive header per story.
      const existing = storyHeaders.get(header.storyId);
      if (!existing || header.content.length > existing.content.length) {
        storyHeaders.set(header.storyId, header);
      }
      continue;
    }
    const st = tryParseSubtask(s);
    if (st) subtasks.push(st);
  }

  if (subtasks.length === 0) return doc;

  // Stable order: by story numerically, then team alpha, then seq.
  subtasks.sort(compareSubtasks);

  const newest = source.reduce<BaSectionLite | undefined>((best, s) => {
    const t = new Date(s.updatedAt ?? 0).getTime();
    if (!best) return s;
    return t > new Date(best.updatedAt ?? 0).getTime() ? s : best;
  }, undefined);

  const newSections: BaSectionLite[] = [];
  let order = 0;

  if (coverageSection) {
    newSections.push(makeSyntheticSection(
      `subtask-coverage-${doc.artifactId}`,
      'coverage_summary',
      coverageSection.sectionLabel,
      (coverageSection.isHumanModified && coverageSection.editedContent ? coverageSection.editedContent : coverageSection.content) ?? '',
      newest,
      order++,
    ));
  }

  // Emit subtasks grouped by story, optionally preceded by the story
  // caption when a header row existed.
  let currentStory: string | null = null;
  for (const st of subtasks) {
    if (st.storyId !== currentStory) {
      currentStory = st.storyId;
      const header = storyHeaders.get(st.storyId);
      if (header) {
        newSections.push(makeSyntheticSection(
          `subtask-story-${st.storyId.toLowerCase()}-${doc.artifactId}`,
          `story_caption_${st.storyId.toLowerCase().replace(/-/g, '_')}`,
          header.label,
          header.content,
          header.source,
          order++,
        ));
      }
    }
    const label = st.derivedName
      ? `${st.subtaskId} — ${st.derivedName}`
      : st.subtaskId;
    newSections.push(makeSyntheticSection(
      `subtask-canonical-${st.subtaskId.toLowerCase()}-${doc.artifactId}`,
      `subtask_${st.subtaskId.toLowerCase().replace(/-/g, '_')}`,
      label,
      st.content,
      st.source,
      order++,
    ));
  }

  return {
    ...doc,
    sections: newSections,
  };
}
