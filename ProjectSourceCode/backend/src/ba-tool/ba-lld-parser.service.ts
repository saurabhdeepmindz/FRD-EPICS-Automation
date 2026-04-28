import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeMermaidInMarkdown } from './mermaid-sanitizer';

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
    // Pre-sanitize Mermaid blocks before parsing so that ```mermaid fences
    // with broken AI syntax (unquoted labels with parens/slashes,
    // capitalised erDiagram type names, …) are corrected before we store
    // them. Deterministic, idempotent — see mermaid-sanitizer.ts.
    // The wrapSkill06Prompt prompt also instructs the AI to emit clean
    // Mermaid; this sanitizer is the safety net for when the AI slips up.
    const cleanedMarkdown = sanitizeMermaidInMarkdown(rawMarkdown);
    const { lldDocument, pseudoBlock } = this.splitDocumentAndFiles(cleanedMarkdown);

    const sections = this.parseLldSections(lldDocument);
    const pseudoFiles = this.parsePseudoFiles(pseudoBlock);

    // Write sections — idempotent per (artifactId, sectionKey). Per-section
    // re-runs (mode 06b) and re-clicks of "Generate LLD" must not duplicate
    // rows. Strategy:
    //   - If no existing row → insert.
    //   - If existing row + isHumanModified=true → SKIP (preserve human edits).
    //   - If existing row + isHumanModified=false → UPDATE in place (re-runs
    //     are intentional; the parser owns AI-generated content).
    for (const s of sections) {
      const existing = await this.prisma.baArtifactSection.findFirst({
        where: { artifactId: lldArtifactDbId, sectionKey: s.sectionKey },
        select: { id: true, isHumanModified: true },
      });
      if (existing) {
        if (existing.isHumanModified) {
          this.logger.warn(
            `LLD parser: skipped overwrite of ${s.sectionKey} — section was edited by a human`,
          );
          continue;
        }
        try {
          await this.prisma.baArtifactSection.update({
            where: { id: existing.id },
            data: { content: s.content, sectionLabel: s.sectionLabel },
          });
        } catch (err) {
          this.logger.warn(
            `LLD parser: failed to update ${s.sectionKey}: ${err instanceof Error ? err.message : 'unknown'}`,
          );
        }
        continue;
      }
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

  // ─── Completeness validator (deterministic, no AI) ────────────────────
  //
  // After SKILL-06-LLD runs (or after a per-section regen), the architect
  // needs to know whether the artifact is "done" or has gaps. Single-shot
  // LLD on a large module (e.g. 9+ features) can truncate later sections
  // or under-emit pseudo-files. This method scans the stored artifact and
  // returns a structured report so the UI can highlight what to fix.
  //
  // No AI cost: just DB reads + heuristics.

  /**
   * Per-section completeness verdict. `present=true` only when the row
   * exists and content length ≥ MIN_SECTION_CHARS (catches truncated /
   * placeholder content like "TODO" or "See Section 9").
   */
  private readonly MIN_SECTION_CHARS = 80;

  /**
   * Heuristic: a "good" LLD has at least 1.5 pseudo-files per feature.
   * MOD-1's reference (6 features → 16 files) is ~2.7×; we set the floor
   * conservatively so small modules aren't flagged as incomplete.
   */
  private readonly PSEUDO_FILES_PER_FEATURE = 1.5;

  async validateCompleteness(lldArtifactDbId: string): Promise<{
    artifactId: string;
    sections: Array<{
      sectionKey: string;
      sectionLabel: string;
      present: boolean;
      contentLen: number;
      thin: boolean;
      isHumanModified: boolean;
    }>;
    sectionsPresent: number;
    sectionsExpected: number;
    pseudoFilesCount: number;
    pseudoFilesExpected: number;
    featuresWithoutPseudoFiles: string[];
    /**
     * Frontend coverage breakdown — populated only when the architect
     * picked a frontend stack (lldConfig.frontendStackId is non-null).
     * `null` when frontend isn't applicable (backend-only modules).
     */
    frontendCoverage: {
      stackName: string | null;
      pagesCount: number;
      pagesExpected: number;
      routeHandlersCount: number;
      routeHandlersExpected: number;
      componentsCount: number;
      componentsExpected: number;
      frontendTestsCount: number;
      frontendTestsExpected: number;
      featuresWithoutPage: string[];
      isComplete: boolean;
    } | null;
    gaps: string[];
    isComplete: boolean;
  }> {
    const artifact = await this.prisma.baArtifact.findUnique({
      where: { id: lldArtifactDbId },
    });
    if (!artifact) {
      throw new Error(`LLD artifact ${lldArtifactDbId} not found`);
    }

    // Per-section presence + thinness check
    const existing = await this.prisma.baArtifactSection.findMany({
      where: { artifactId: lldArtifactDbId },
      select: { sectionKey: true, sectionLabel: true, content: true, isHumanModified: true },
    });
    const byKey = new Map(existing.map((s) => [s.sectionKey, s]));

    const sections = this.CANONICAL_SECTIONS.map(({ key, label }) => {
      const row = byKey.get(key);
      const contentLen = row?.content?.length ?? 0;
      const present = !!row && contentLen >= this.MIN_SECTION_CHARS;
      const thin = !!row && contentLen > 0 && contentLen < this.MIN_SECTION_CHARS;
      return {
        sectionKey: key,
        sectionLabel: label,
        present,
        contentLen,
        thin,
        isHumanModified: row?.isHumanModified ?? false,
      };
    });
    const sectionsPresent = sections.filter((s) => s.present).length;
    const sectionsExpected = sections.length;

    // Pseudo-files coverage check. The schema has `aiContent` (parser-written)
    // and `editedContent` (human-modified). Prefer the edited content where
    // present so feature-ID references the architect added are picked up.
    const pseudoFiles = await this.prisma.baPseudoFile.findMany({
      where: { artifactDbId: lldArtifactDbId },
      select: { path: true, aiContent: true, editedContent: true },
    });
    const pseudoFilesCount = pseudoFiles.length;

    // Look up the module's RTM features so we can flag features with zero
    // pseudo-file references. Pseudo-file content typically cites EPIC /
    // US / ST IDs in JavaDoc comments; we substring-match against the
    // feature ID list.
    const moduleId = artifact.moduleDbId
      ? (await this.prisma.baModule.findUnique({
          where: { id: artifact.moduleDbId },
          select: { moduleId: true, projectId: true },
        }))
      : null;
    let featureIds: string[] = [];
    let featuresWithoutPseudoFiles: string[] = [];
    let pseudoFilesExpected = 0;
    if (moduleId) {
      const rtm = await this.prisma.baRtmRow.findMany({
        where: { projectId: moduleId.projectId ?? '', moduleId: moduleId.moduleId },
        select: { featureId: true },
      });
      featureIds = Array.from(
        new Set(rtm.map((r) => r.featureId).filter((x): x is string => !!x && /^F-\d+-\d+$/.test(x))),
      );
      pseudoFilesExpected = Math.ceil(featureIds.length * this.PSEUDO_FILES_PER_FEATURE);
      const allPseudoText = pseudoFiles
        .map((f) => `${f.path}\n${f.editedContent ?? f.aiContent ?? ''}`)
        .join('\n\n');
      featuresWithoutPseudoFiles = featureIds.filter((fid) => !allPseudoText.includes(fid));
    }

    // Frontend coverage check — only runs when the architect picked a
    // frontend stack. Backend-only modules skip this entirely.
    let frontendCoverage: {
      stackName: string | null;
      pagesCount: number;
      pagesExpected: number;
      routeHandlersCount: number;
      routeHandlersExpected: number;
      componentsCount: number;
      componentsExpected: number;
      frontendTestsCount: number;
      frontendTestsExpected: number;
      featuresWithoutPage: string[];
      isComplete: boolean;
    } | null = null;
    if (moduleId && artifact.moduleDbId) {
      const cfg = await this.prisma.baLldConfig.findUnique({
        where: { moduleDbId: artifact.moduleDbId },
      });
      const frontendStackId = cfg?.frontendStackId ?? null;
      if (frontendStackId) {
        const stackEntry = await this.prisma.baMasterDataEntry.findUnique({
          where: { id: frontendStackId },
          select: { name: true, value: true },
        });
        const stackName = stackEntry?.name ?? stackEntry?.value ?? null;

        // Detect "full backend" stack — when present, Next.js route
        // handlers are largely optional because the frontend calls the
        // backend service directly via fetch / RTK Query / api-client
        // hooks. Without a full backend stack (frontend-only Next.js or
        // Remix), route handlers ARE the primary server-side entry
        // point and the heuristic should require many.
        const FULL_BACKEND_STACKS = new Set([
          'nestjs', 'spring', 'springboot', 'spring-boot',
          'fastapi', 'django', 'rails', 'ruby-on-rails',
          'express', 'koa', 'hapi',
          'asp.net', 'aspnet', 'aspnetcore', 'dotnet',
          'laravel', 'flask', 'echo', 'gin',
        ]);
        let backendStackSlug: string | null = null;
        if (cfg?.backendStackId) {
          const backendEntry = await this.prisma.baMasterDataEntry.findUnique({
            where: { id: cfg.backendStackId },
            select: { value: true, name: true },
          });
          const raw = (backendEntry?.value ?? backendEntry?.name ?? '').toLowerCase();
          backendStackSlug = raw.replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || null;
        }
        const hasFullBackendStack =
          backendStackSlug !== null && FULL_BACKEND_STACKS.has(backendStackSlug);

        // Path-based heuristics. The AI may write paths under any of:
        // `LLD-PseudoCode/frontend/...`, `LLD-PseudoCode/app/...`,
        // `LLD-PseudoCode/components/...`, etc. We classify by leaf file
        // pattern, which is more robust than top-folder matching.
        const pagePathRe = /\/app\/(?!api\/)[^/]+\/(?:[^/]+\/)*page\.(tsx|jsx|ts|js)$/;
        const routeHandlerPathRe = /\/app\/api\/(?:[^/]+\/)+route\.(ts|js)$/;
        // De-facto route-handler-equivalent in Next.js + NestJS / Spring /
        // FastAPI architectures: per-feature API client hooks under
        // `frontend/features/<x>/<x>api.ts` (RTK Query slices, Tanstack
        // Query hooks, SWR hooks, plain fetch wrappers). These centralise
        // the frontend's calls into the backend, exactly the role a route
        // handler would play in a frontend-only stack. We count them.
        const apiClientHookPathRe = /\/frontend\/features\/[^/]+\/[^/]*api\.(ts|js)$/i;
        const componentPathRe = /\.(tsx|jsx)$/;
        const frontendTestPathRe = /\.(test|spec)\.(tsx|jsx|ts|js)$/;

        let pagesCount = 0;
        let routeHandlersCount = 0;
        let componentsCount = 0;
        let frontendTestsCount = 0;
        const allFrontendText: string[] = [];

        for (const f of pseudoFiles) {
          const isPage = pagePathRe.test(f.path);
          const isRoute = routeHandlerPathRe.test(f.path) || apiClientHookPathRe.test(f.path);
          const isComp = componentPathRe.test(f.path);
          const isTest = frontendTestPathRe.test(f.path) && /\.(tsx|jsx)$/.test(f.path);
          if (isPage) pagesCount++;
          if (isRoute) routeHandlersCount++;
          if (isComp && !isTest && !isPage) componentsCount++;
          if (isTest) frontendTestsCount++;
          if (isPage || isRoute || isComp || isTest) {
            allFrontendText.push(`${f.path}\n${f.editedContent ?? f.aiContent ?? ''}`);
          }
        }

        const featCount = featureIds.length;
        const pagesExpected = Math.max(featCount, 1);
        // Route-handler target is stack-aware: full backend = optional
        // (1-3 is fine), frontend-only = primary entry point (~70% of features).
        const routeHandlersExpected = hasFullBackendStack
          ? Math.max(1, Math.ceil(featCount * 0.2))
          : Math.max(Math.ceil(featCount * 0.7), 3);
        // Components target: 1.5× feature count (was 2× — too aggressive
        // for typical Next.js apps where one component covers multiple
        // feature slots e.g. a shared list / detail / form trio).
        const componentsExpected = Math.max(Math.ceil(featCount * 1.5), 6);
        const frontendTestsExpected = Math.max(featCount, 4);

        const frontendBlob = allFrontendText.join('\n\n');
        const featuresWithoutPage = featureIds.filter((fid) => !frontendBlob.includes(fid));

        const fcComplete =
          pagesCount >= pagesExpected &&
          routeHandlersCount >= routeHandlersExpected &&
          componentsCount >= componentsExpected &&
          frontendTestsCount >= frontendTestsExpected &&
          featuresWithoutPage.length === 0;

        frontendCoverage = {
          stackName,
          pagesCount,
          pagesExpected,
          routeHandlersCount,
          routeHandlersExpected,
          componentsCount,
          componentsExpected,
          frontendTestsCount,
          frontendTestsExpected,
          featuresWithoutPage,
          isComplete: fcComplete,
        };
      }
    }

    const gaps: string[] = [];
    for (const s of sections) {
      if (!s.present) {
        gaps.push(`§ ${s.sectionLabel}: ${s.thin ? 'thin (' + s.contentLen + ' chars)' : 'missing'}`);
      }
    }
    if (pseudoFilesCount < pseudoFilesExpected) {
      gaps.push(
        `Pseudo-files: ${pseudoFilesCount}/${pseudoFilesExpected} (under target — expected ≥ ${pseudoFilesExpected} for ${featureIds.length} features)`,
      );
    }
    if (featuresWithoutPseudoFiles.length > 0) {
      gaps.push(
        `Features without pseudo-file coverage: ${featuresWithoutPseudoFiles.join(', ')}`,
      );
    }
    // Frontend-coverage gap reporting (only when frontend stack is selected)
    if (frontendCoverage) {
      const fc = frontendCoverage;
      if (fc.pagesCount < fc.pagesExpected) {
        gaps.push(`Frontend App Router pages: ${fc.pagesCount}/${fc.pagesExpected} (need a \`frontend/app/<feature>/page.tsx\` per feature)`);
      }
      if (fc.routeHandlersCount < fc.routeHandlersExpected) {
        gaps.push(`Frontend route handlers: ${fc.routeHandlersCount}/${fc.routeHandlersExpected} (need \`frontend/app/api/<resource>/route.ts\` files)`);
      }
      if (fc.componentsCount < fc.componentsExpected) {
        gaps.push(`Frontend components: ${fc.componentsCount}/${fc.componentsExpected} (need \`.tsx\` UI components per feature)`);
      }
      if (fc.frontendTestsCount < fc.frontendTestsExpected) {
        gaps.push(`Frontend tests: ${fc.frontendTestsCount}/${fc.frontendTestsExpected} (need \`*.test.tsx\` files for components)`);
      }
      if (fc.featuresWithoutPage.length > 0) {
        gaps.push(`Features without frontend page reference: ${fc.featuresWithoutPage.join(', ')}`);
      }
    }

    return {
      artifactId: lldArtifactDbId,
      sections,
      sectionsPresent,
      sectionsExpected,
      pseudoFilesCount,
      pseudoFilesExpected,
      featuresWithoutPseudoFiles,
      frontendCoverage,
      gaps,
      isComplete: gaps.length === 0,
    };
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

    // Match either ``` or ~~~ (CommonMark allows both). Some AI runs emit
    // tilde fences (especially when the prompt example used `~~~` to escape
    // a nested backtick block). Both delimiters parse identically per the
    // CommonMark spec; only the opening + closing must match. We capture
    // the opening delimiter into a backreference so a `~~~` block doesn't
    // close on the next ```` ``` ```` (or vice versa).
    const fenceRe = /^(```|~~~)([^\n]*)\n([\s\S]*?)\n\1/gm;
    let m: RegExpExecArray | null;
    while ((m = fenceRe.exec(pseudoBlock)) !== null) {
      const infoString = m[2].trim();
      const body = m[3];
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
