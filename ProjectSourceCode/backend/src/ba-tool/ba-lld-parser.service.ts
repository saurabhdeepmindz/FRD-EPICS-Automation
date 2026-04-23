import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ParsedLldSection {
  sectionNumber: number;
  sectionKey: string;
  sectionLabel: string;
  content: string;
}

interface ParsedPseudoFile {
  path: string;
  language: string;
  content: string;
}

/**
 * Parses the SKILL-06-LLD output into structured records:
 *   - 15 `BaArtifactSection` rows (one per LLD document section)
 *   - N  `BaPseudoFile` rows (one per language-tagged fenced code block
 *        under `## Pseudo-Code Files`)
 *
 * This is deliberately tolerant — the AI output may drift from the contract
 * slightly. We surface warnings in logs rather than hard-failing.
 */
@Injectable()
export class BaLldParserService {
  private readonly logger = new Logger(BaLldParserService.name);

  /**
   * The 15 canonical LLD sections. The parser tries an exact match first,
   * then falls back to case-insensitive / fuzzy-prefix match so minor
   * heading drift from the AI doesn't cause data loss.
   */
  /**
   * Canonical LLD sections, in document order. Any `##` heading that parses to
   * one of these keys is stored under that key; duplicates are merged (append).
   * Any `##` heading that does NOT match a canonical key is **folded** into
   * the preceding canonical section (promoted to `###` inside its content).
   */
  private readonly CANONICAL_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'summary', label: 'Summary' },
    { key: 'technology_stack', label: 'Technology Stack' },
    { key: 'architecture_overview', label: 'Architecture Overview' },
    { key: 'module_dependency_graph', label: 'Module Dependency Graph' },
    { key: 'class_diagram', label: 'Class Diagram' },
    { key: 'sequence_diagrams', label: 'Sequence Diagrams' },
    { key: 'non_functional_requirements', label: 'Non-Functional Requirements' },
    { key: 'api_contract_manifest', label: 'API Contract Manifest' },
    { key: 'data_model_definitions', label: 'Data Model Definitions' },
    { key: 'schema_diagram', label: 'Schema Diagram' },
    { key: 'integration_points', label: 'Integration Points' },
    { key: 'cross_cutting_concerns', label: 'Cross-Cutting Concerns' },
    { key: 'env_var_secret_catalog', label: 'Env Var / Secret Catalog' },
    { key: 'test_scaffold_hints', label: 'Test Scaffold Hints' },
    { key: 'build_ci_hooks', label: 'Build / CI Hooks' },
    { key: 'project_structure', label: 'Project Structure' },
    { key: 'traceability_summary', label: 'Traceability Summary' },
    { key: 'open_questions_tbd', label: 'Open Questions / TBD-Future References' },
    { key: 'applied_defaults', label: 'Applied Best-Practice Defaults' },
  ];

  /**
   * Patterns that indicate an `##` heading is NOT a real new section but a
   * back-reference like "See Section 9: Env Var / Secret Catalog". These are
   * dropped entirely during parse (content, if any, appends to current section).
   */
  private readonly SEE_SECTION_REGEX = /^(see|refer(?:\s+to)?|cf\.)\s+section\s+\d+/i;

  constructor(private readonly prisma: PrismaService) {}

  async parseAndStore(rawMarkdown: string, lldArtifactDbId: string): Promise<{
    sectionsCreated: number;
    pseudoFilesCreated: number;
  }> {
    const { lldDocument, pseudoBlock } = this.splitDocumentAndFiles(rawMarkdown);

    const sections = this.parseLldSections(lldDocument);
    const pseudoFiles = this.parsePseudoFiles(pseudoBlock);

    // Write sections
    for (const s of sections) {
      try {
        await this.prisma.baArtifactSection.create({
          data: {
            artifactId: lldArtifactDbId,
            sectionKey: s.sectionKey,
            sectionLabel: s.sectionLabel,
            content: s.content,
            aiGenerated: true,
            isHumanModified: false,
          },
        });
      } catch (err) {
        this.logger.warn(
          `LLD parser: failed to insert section ${s.sectionKey}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    // Write pseudo files
    for (const f of pseudoFiles) {
      try {
        await this.prisma.baPseudoFile.create({
          data: {
            artifactDbId: lldArtifactDbId,
            path: f.path,
            language: f.language,
            aiContent: f.content,
            isHumanModified: false,
          },
        });
      } catch (err) {
        // Duplicate path -> unique constraint. Log and continue.
        this.logger.warn(
          `LLD parser: failed to insert pseudo file ${f.path}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    this.logger.log(
      `LLD parser: created ${sections.length} sections + ${pseudoFiles.length} pseudo files for artifact ${lldArtifactDbId}`,
    );
    return { sectionsCreated: sections.length, pseudoFilesCreated: pseudoFiles.length };
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  /**
   * Split the raw response into the LLD document (before `## Pseudo-Code Files`)
   * and the trailing pseudo-file fenced blocks.
   */
  private splitDocumentAndFiles(raw: string): { lldDocument: string; pseudoBlock: string } {
    // Match the first "## [N.] Pseudo-Code Files" heading. Tolerates:
    //  - optional numeric prefix (e.g. "## 20. Pseudo-Code Files")
    //  - hyphen or space between "Pseudo" and "Code" (e.g. "Pseudo Code Files")
    //  - arbitrary trailing whitespace on the line
    const markerMatch = raw.match(/^##\s+(?:\d+[.)]\s+)?Pseudo[\s-]?Code\s+Files\s*$/im);
    if (!markerMatch || markerMatch.index === undefined) {
      return { lldDocument: raw, pseudoBlock: '' };
    }
    const idx = markerMatch.index;
    const end = idx + markerMatch[0].length;
    return {
      lldDocument: raw.substring(0, idx).trimEnd(),
      pseudoBlock: raw.substring(end).trimStart(),
    };
  }

  /**
   * Parse the LLD document into 15 sections. We scan H2 headings (`## `) and
   * map them to canonical keys by:
   *   1. Exact label match (case-insensitive)
   *   2. Prefix match after stripping leading "N. " numbering
   *   3. Keyword fallback (takes a best-guess from any CANONICAL entry whose
   *      label shares ≥50% of the heading's significant words)
   *
   * Any heading that doesn't match a canonical slot is stored under its own
   * slug so nothing is silently dropped.
   */
  private parseLldSections(document: string): ParsedLldSection[] {
    const lines = document.split(/\r?\n/);
    // Index by canonical-key so duplicates merge; preserve insertion order.
    const byKey = new Map<string, ParsedLldSection>();
    const orderedKeys: string[] = [];

    let currentHeading: string | null = null;
    let currentBuffer: string[] = [];

    const flush = (): void => {
      if (currentHeading === null) return;

      const cleanedHeading = currentHeading.replace(/^\s*\d+\.\s*/, '').trim();

      // Drop back-reference stubs like "See Section 9: Env Var / Secret Catalog".
      // Their body, if any, appends to the current section (the one that was
      // active before this stub). Since we're flushing, "current" is already
      // gone — so we just drop the content.
      if (this.SEE_SECTION_REGEX.test(cleanedHeading)) {
        return;
      }

      const match = this.matchCanonical(cleanedHeading);
      const content = currentBuffer.join('\n').trim();

      if (match.canonical) {
        // Canonical heading — create or merge.
        const existing = byKey.get(match.key);
        if (existing) {
          // Duplicate canonical heading — append content so nothing is lost.
          existing.content = [existing.content, content].filter(Boolean).join('\n\n');
        } else {
          byKey.set(match.key, {
            sectionNumber: orderedKeys.length + 1,
            sectionKey: match.key,
            sectionLabel: match.label,
            content,
          });
          orderedKeys.push(match.key);
        }
        return;
      }

      // NON-canonical H2 (e.g. "Endpoint: Get Current SLA Breach Alerts",
      // "Entity: SlaBreachAlert"). Fold into the most recently seen canonical
      // section by demoting the heading to H3 and appending with its body.
      const lastKey = orderedKeys[orderedKeys.length - 1];
      if (lastKey) {
        const host = byKey.get(lastKey)!;
        const demoted = `### ${currentHeading}\n\n${content}`.trim();
        host.content = [host.content, demoted].filter(Boolean).join('\n\n');
      } else {
        // No canonical section yet — stash under its own slug so nothing is lost.
        const slug = cleanedHeading.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const key = `custom_${slug.substring(0, 60)}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            sectionNumber: orderedKeys.length + 1,
            sectionKey: key,
            sectionLabel: currentHeading,
            content,
          });
          orderedKeys.push(key);
        } else {
          byKey.get(key)!.content += `\n\n${content}`;
        }
      }
    };

    for (const line of lines) {
      const h2 = line.match(/^##\s+(.+?)\s*$/);
      if (h2) {
        flush();
        currentHeading = h2[1];
        currentBuffer = [];
        continue;
      }
      // Skip any H1 (e.g. wrapper title the AI might add)
      if (/^#\s+/.test(line) && currentHeading === null) continue;
      if (currentHeading !== null) currentBuffer.push(line);
    }
    flush();

    // Return in insertion order with re-indexed sectionNumber
    return orderedKeys.map((k, idx) => {
      const s = byKey.get(k)!;
      return { ...s, sectionNumber: idx + 1 };
    });
  }

  /**
   * Try to match a heading string to one of the canonical LLD sections.
   * Returns `canonical=true` when matched via exact / prefix / keyword strategies;
   * `canonical=false` means the caller should treat the heading as a non-canonical
   * sub-topic (to fold into the preceding section).
   */
  private matchCanonical(heading: string): { key: string; label: string; canonical: boolean } {
    const h = heading.toLowerCase().trim();
    // Exact label match
    for (const c of this.CANONICAL_SECTIONS) {
      if (c.label.toLowerCase() === h) return { ...c, canonical: true };
    }
    // Prefix match — "API Contract Manifest (v2)" → api_contract_manifest
    for (const c of this.CANONICAL_SECTIONS) {
      if (h.startsWith(c.label.toLowerCase())) return { ...c, canonical: true };
    }
    // Keyword fallback — require a high overlap to avoid folding legitimate
    // sub-topics into arbitrary canonical sections.
    const normalise = (s: string): string[] => s
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const headingWords = new Set(normalise(h));
    let best: { key: string; label: string } | null = null;
    let bestScore = 0;
    for (const c of this.CANONICAL_SECTIONS) {
      const words = normalise(c.label);
      if (words.length === 0) continue;
      const overlap = words.filter((w) => headingWords.has(w)).length;
      const score = overlap / words.length;
      // Raise threshold from 0.5 → 0.7 so "Endpoint: Get…" doesn't accidentally
      // match "Open Questions / TBD-Future References" via shared word "points".
      if (score > bestScore && score >= 0.7) {
        bestScore = score;
        best = c;
      }
    }
    if (best) return { ...best, canonical: true };

    // No canonical match — caller decides what to do (fold vs. stash).
    const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return { key: `custom_${slug.substring(0, 60)}`, label: heading, canonical: false };
  }

  /**
   * Parse fenced code blocks with `path=...` metadata.
   *
   * Expected shape:
   *     ```java path=backend/controllers/InvoiceController.java
   *     ...body...
   *     ```
   *
   * We accept tolerant variations: `path="..."`, `path='...'`, or the path on
   * its own preceded by whitespace. Blocks without a `path=` are skipped
   * (they aren't pseudo-files — might be example snippets).
   */
  private parsePseudoFiles(pseudoBlock: string): ParsedPseudoFile[] {
    const files: ParsedPseudoFile[] = [];
    if (!pseudoBlock) return files;

    // Match ``` followed by info string up to a newline, then body, then ```
    const fenceRe = /^```([^\n]*)\n([\s\S]*?)\n```/gm;
    let m: RegExpExecArray | null;
    while ((m = fenceRe.exec(pseudoBlock)) !== null) {
      const infoString = m[1].trim();
      const body = m[2];
      const parsed = this.parseInfoString(infoString);
      if (!parsed || !parsed.path) continue; // not a pseudo-file block
      // Prefix with LLD-PseudoCode/ per the skill contract
      const normalisedPath = `LLD-PseudoCode/${parsed.path.replace(/^LLD-PseudoCode\//, '').replace(/^\/+/, '')}`;
      files.push({
        path: normalisedPath,
        language: parsed.language || 'text',
        content: body,
      });
    }
    return files;
  }

  private parseInfoString(info: string): { language: string; path: string | null } | null {
    if (!info) return null;
    // First token = language tag (possibly followed by attrs)
    const tokens = info.split(/\s+/).filter(Boolean);
    const language = tokens[0] && !tokens[0].startsWith('path=') ? tokens[0] : '';
    // Look for path=... (quoted or unquoted)
    const joined = info;
    const pathMatch = joined.match(/path\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"']+))/);
    const p = pathMatch ? (pathMatch[1] ?? pathMatch[2] ?? pathMatch[3]) : null;
    if (!p) return null;
    return { language, path: p };
  }
}
