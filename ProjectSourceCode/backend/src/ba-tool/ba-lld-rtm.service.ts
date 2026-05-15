/**
 * BaLldRtmService — produces the "Module-SubTask-LLD-RTM" deliverable
 * bundle from an LLD artifact:
 *
 *   - rtm.csv         flat one-row-per-(subtask × file) table
 *   - rtm.html        self-contained Swagger-like clickable explorer
 *   - rtm-tree.txt    ASCII project-directory tree with story+subtask
 *                     annotations
 *   - schema.sql      consolidated DB schema synthesised from all
 *                     database/migrations/*.sql pseudo-files
 *   - impl-status.csv developer-facing implementation-tracking template
 *                     (workstream 3, Option A — CSV companion)
 *
 * Mirrors the CLI generator at scripts/_generate-lld-rtm.ts. The CLI now
 * delegates to this service so /api/ba HTTP endpoints can serve the same
 * artifacts without duplicating logic.
 *
 * Status auto-derivation (v1):
 *   - Done       BaPseudoFile exists; attributed via content-header
 *                traceability (Strategy 1 / 2) or basename match
 *                (Strategy 3)
 *   - ToDo       BaSubTask declared sourceFileName but no matching
 *                pseudo-file was emitted
 *   - N/A        folder column doesn't apply to subtask team (shown
 *                in the explorer view only)
 *   - WIP/Failed reserved for the impl-status CSV companion
 */
import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import * as AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service';
import { BaSkillOrchestratorService } from './ba-skill-orchestrator.service';

// ─── Fixed folder taxonomy (the column set) ─────────────────────────────

export interface FolderSpec {
  key: string;
  label: string;
  pathPrefixes: string[];
  teams: string[]; // which teams this folder applies to (for N/A inference)
}

export const FOLDER_TAXONOMY: FolderSpec[] = [
  { key: 'frontend/app', label: 'Frontend / app', pathPrefixes: ['LLD-PseudoCode/frontend/app/', 'frontend/app/', 'app/'], teams: ['FE'] },
  { key: 'frontend/components', label: 'Frontend / components', pathPrefixes: ['LLD-PseudoCode/frontend/components/', 'frontend/components/', 'components/'], teams: ['FE'] },
  { key: 'frontend/hooks', label: 'Frontend / hooks', pathPrefixes: ['LLD-PseudoCode/frontend/hooks/', 'frontend/hooks/', 'hooks/'], teams: ['FE'] },
  { key: 'frontend/features', label: 'Frontend / features', pathPrefixes: ['LLD-PseudoCode/frontend/features/', 'frontend/features/'], teams: ['FE'] },
  { key: 'backend/controller', label: 'Backend / controller', pathPrefixes: ['LLD-PseudoCode/backend/controller/', 'backend/controller/', 'backend/controllers/'], teams: ['BE'] },
  { key: 'backend/service', label: 'Backend / service', pathPrefixes: ['LLD-PseudoCode/backend/service/', 'backend/service/', 'backend/services/'], teams: ['BE'] },
  { key: 'backend/repository', label: 'Backend / repository', pathPrefixes: ['LLD-PseudoCode/backend/repository/', 'backend/repository/', 'backend/repositories/'], teams: ['BE'] },
  { key: 'backend/dto', label: 'Backend / DTO', pathPrefixes: ['LLD-PseudoCode/backend/dto/', 'backend/dto/'], teams: ['BE'] },
  { key: 'backend/entities', label: 'Backend / entities', pathPrefixes: ['LLD-PseudoCode/backend/entities/', 'backend/entities/', 'backend/models/'], teams: ['BE'] },
  { key: 'backend/integration', label: 'Backend / integration', pathPrefixes: ['LLD-PseudoCode/backend/integration/', 'backend/integration/'], teams: ['BE', 'IN'] },
  { key: 'backend/middleware', label: 'Backend / middleware', pathPrefixes: ['LLD-PseudoCode/backend/middleware/', 'backend/middleware/'], teams: ['BE'] },
  { key: 'backend/exceptions', label: 'Backend / exceptions', pathPrefixes: ['LLD-PseudoCode/backend/exceptions/', 'backend/exceptions/'], teams: ['BE'] },
  { key: 'database/schema', label: 'Database / schema (consolidated)', pathPrefixes: ['LLD-PseudoCode/database/schema/', 'database/schema/'], teams: ['BE'] },
  { key: 'database/migrations', label: 'Database / migrations', pathPrefixes: ['LLD-PseudoCode/database/migrations/', 'database/migrations/'], teams: ['BE'] },
  { key: 'tests/frontend', label: 'Tests / frontend', pathPrefixes: ['LLD-PseudoCode/frontend/tests/', 'LLD-PseudoCode/tests/frontend/', 'tests/frontend/'], teams: ['QA', 'FE'] },
  { key: 'tests/backend', label: 'Tests / backend', pathPrefixes: ['LLD-PseudoCode/backend/tests/', 'LLD-PseudoCode/tests/backend/', 'tests/backend/'], teams: ['QA', 'BE'] },
  { key: 'tests/e2e', label: 'Tests / e2e', pathPrefixes: ['LLD-PseudoCode/tests/e2e/', 'tests/e2e/', 'e2e/'], teams: ['QA'] },
  { key: 'infra', label: 'Infra (CI / config)', pathPrefixes: ['LLD-PseudoCode/infra/', 'infra/', '.github/', 'ci/'], teams: ['BE', 'FE', 'QA', 'IN'] },
];

export function folderFor(p: string): FolderSpec | null {
  for (const f of FOLDER_TAXONOMY) {
    for (const pref of f.pathPrefixes) {
      if (p.startsWith(pref)) return f;
    }
  }
  return null;
}

function guessFolderFromPath(p: string): string | null {
  const lower = p.toLowerCase();
  if (lower.includes('controller')) return 'backend/controller';
  if (lower.includes('service')) return 'backend/service';
  if (lower.includes('repository') || lower.includes('repositories')) return 'backend/repository';
  if (lower.includes('dto')) return 'backend/dto';
  if (lower.includes('entit') || lower.includes('models/')) return 'backend/entities';
  if (lower.includes('integration')) return 'backend/integration';
  if (lower.includes('middleware')) return 'backend/middleware';
  if (lower.includes('exception')) return 'backend/exceptions';
  if (lower.includes('migration') || lower.endsWith('.sql')) return 'database/migrations';
  if (lower.includes('schema/')) return 'database/schema';
  if (lower.includes('hooks/')) return 'frontend/hooks';
  if (lower.includes('features/')) return 'frontend/features';
  if (lower.includes('components/')) return 'frontend/components';
  if (lower.includes('/app/')) return 'frontend/app';
  if (lower.includes('test') || lower.endsWith('.test.tsx') || lower.endsWith('.spec.ts')) {
    return lower.includes('e2e') ? 'tests/e2e' : (lower.includes('frontend') ? 'tests/frontend' : 'tests/backend');
  }
  return null;
}

function inferLanguageFromExtension(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
  if (lower.endsWith('.json')) return 'json';
  return 'unknown';
}

// ─── Row model ──────────────────────────────────────────────────────────

export interface RtmRow {
  featureId: string;
  storyId: string;
  subtaskId: string;
  subtaskName: string;
  team: string;
  folder: string;
  filePath: string;
  fileType: string;
  generated: 'YES' | 'YES_SYNTHESIZED' | 'NO';
  status: 'Done' | 'ToDo' | 'WIP' | 'Failed' | 'N/A';
  notes: string;
  pseudoFileId?: string;
  fullContent?: string;
}

export interface RtmBuildOptions {
  featureFilter?: string;
}

export interface RtmBuildResult {
  module: { id: string; moduleId: string; moduleName: string };
  lld: { id: string; artifactId: string };
  rows: RtmRow[];
  consolidatedSchema: string;
  stats: { total: number; done: number; todo: number; wip: number; failed: number };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function escapeCsv(s: string): string {
  if (s == null) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(s: string): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Service ────────────────────────────────────────────────────────────

@Injectable()
export class BaLldRtmService {
  private readonly logger = new Logger(BaLldRtmService.name);

  constructor(
    private readonly prisma: PrismaService,
    // forwardRef avoids the circular import problem if the orchestrator
    // ever needs to inject this service. Today it's one-way only but the
    // guard is cheap insurance.
    @Inject(forwardRef(() => BaSkillOrchestratorService))
    private readonly orchestrator: BaSkillOrchestratorService,
  ) {}

  /**
   * Build the RTM data model for an LLD artifact. Does no rendering on its
   * own — emit*() methods turn the result into CSV / HTML / tree / etc.
   *
   * Throws NotFoundException when the artifactId is missing or not an LLD.
   */
  async buildRtm(lldArtifactId: string, options: RtmBuildOptions = {}): Promise<RtmBuildResult> {
    const lld = await this.prisma.baArtifact.findUnique({
      where: { id: lldArtifactId },
      include: { pseudoFiles: { orderBy: { path: 'asc' } }, module: true },
    });
    if (!lld) throw new NotFoundException(`Artifact ${lldArtifactId} not found`);
    if (lld.artifactType !== 'LLD') {
      throw new NotFoundException(`Artifact ${lld.artifactId} is ${lld.artifactType}, not LLD; RTM is LLD-only`);
    }
    const mod = lld.module;

    const subtasks = await this.prisma.baSubTask.findMany({
      where: { moduleDbId: mod.id },
      orderBy: [{ userStoryId: 'asc' }, { team: 'asc' }, { subtaskId: 'asc' }],
    });

    const filesByBasename = new Map<string, typeof lld.pseudoFiles[number][]>();
    for (const pf of lld.pseudoFiles) {
      const basename = pf.path.split('/').pop()!.toLowerCase();
      if (!filesByBasename.has(basename)) filesByBasename.set(basename, []);
      filesByBasename.get(basename)!.push(pf);
    }

    // Attribution strategies (most reliable first):
    //   1. ST: ST-USNNN-TEAM-NN token in the pseudo-file's content header
    //   2. F-XX-YY token in content + folder/team disambiguation
    //   3. Basename match against BaSubTask.sourceFileName
    //   4. Unattributed → surfaces as "(cross-cutting)"
    const subtaskById = new Map<string, typeof subtasks[number]>();
    for (const st of subtasks) subtaskById.set(st.subtaskId.toUpperCase(), st);

    const fileToSubtask = new Map<string, typeof subtasks[number] | null>();
    for (const pf of lld.pseudoFiles) {
      const content = (pf.isHumanModified && pf.editedContent ? pf.editedContent : pf.aiContent) ?? '';
      const head = content.slice(0, 2000);
      let owner: typeof subtasks[number] | null = null;

      // Strategy 1: explicit ST-USNNN-TEAM-NN token
      const stMatch = /\bST[-:\s]*US\d{3,}[-_][A-Z]{2,4}[-_]\d{2,}\b/i.exec(head)
                   ?? /@subTask\s+(ST-US\d{3,}-[A-Z]{2,4}-\d{2,})/i.exec(head);
      if (stMatch) {
        const raw = (stMatch[1] ?? stMatch[0]).toUpperCase().replace(/_/g, '-').replace(/^ST[-:\s]+/, 'ST-');
        const stKey = raw.startsWith('ST-') ? raw : `ST-${raw}`;
        const found = subtaskById.get(stKey);
        if (found) owner = found;
      }

      // Strategy 2: feature ref + folder/team disambiguation
      if (!owner) {
        const fMatch = /\bF-\d+-\d+\b/.exec(head);
        if (fMatch) {
          const featureId = fMatch[0].toUpperCase();
          const folder = folderFor(pf.path);
          const candidates = subtasks.filter((st) => st.featureId === featureId);
          const teamMatched = folder
            ? candidates.find((st) => folder.teams.includes(st.team ?? ''))
            : null;
          owner = teamMatched ?? candidates[0] ?? null;
        }
      }

      // Strategy 3: basename match against sourceFileName
      if (!owner) {
        const pfBasename = pf.path.split('/').pop()!.toLowerCase();
        for (const st of subtasks) {
          if (!st.sourceFileName) continue;
          const stBasename = st.sourceFileName.split('/').pop()!.toLowerCase();
          if (stBasename === pfBasename) { owner = st; break; }
        }
      }

      fileToSubtask.set(pf.id, owner);
    }

    const rows: RtmRow[] = [];

    // (a) Done rows — one per pseudo-file with attribution
    for (const pf of lld.pseudoFiles) {
      const owner = fileToSubtask.get(pf.id) ?? null;
      if (options.featureFilter && (!owner || owner.featureId !== options.featureFilter)) continue;
      const folder = folderFor(pf.path);
      const content = (pf.isHumanModified && pf.editedContent) ? pf.editedContent : pf.aiContent;
      rows.push({
        featureId: owner?.featureId ?? '(cross-cutting)',
        storyId: owner?.userStoryId ?? '—',
        subtaskId: owner?.subtaskId ?? '(unattributed)',
        subtaskName: owner?.subtaskName ?? '—',
        team: owner?.team ?? '—',
        folder: folder?.key ?? 'unmapped',
        filePath: pf.path.replace(/^LLD-PseudoCode\//, ''),
        fileType: pf.language,
        generated: 'YES',
        status: 'Done',
        notes: '',
        pseudoFileId: pf.id,
        fullContent: content.slice(0, 4000),
      });
    }

    // (b) ToDo rows — declared but not emitted
    const subtasksInScope = options.featureFilter
      ? subtasks.filter((st) => st.featureId === options.featureFilter)
      : subtasks;
    for (const st of subtasksInScope) {
      if (!st.sourceFileName) continue;
      const stBasename = st.sourceFileName.split('/').pop()!.toLowerCase();
      if (filesByBasename.has(stBasename)) continue;
      const folder = guessFolderFromPath(st.sourceFileName) ?? 'unmapped';
      rows.push({
        featureId: st.featureId ?? '(unspecified)',
        storyId: st.userStoryId ?? '—',
        subtaskId: st.subtaskId,
        subtaskName: st.subtaskName,
        team: st.team ?? '—',
        folder,
        filePath: st.sourceFileName,
        fileType: inferLanguageFromExtension(st.sourceFileName),
        generated: 'NO',
        status: 'ToDo',
        notes: `Declared by ${st.subtaskId} but no pseudo-file emitted (no basename or content-header match)`,
      });
    }

    // (c) Synthesized consolidated schema entry
    const schemaText = this.synthesizeConsolidatedSchema(lld.pseudoFiles);
    if (schemaText.length > 0) {
      const beSubtask = subtasks.find((s) => s.team === 'BE');
      rows.push({
        featureId: options.featureFilter ?? '(module-wide)',
        storyId: '—',
        subtaskId: beSubtask?.subtaskId ?? '(module-wide)',
        subtaskName: 'Consolidated database schema (synthesized from migrations)',
        team: 'BE',
        folder: 'database/schema',
        filePath: `${mod.moduleId.toLowerCase()}-schema.sql`,
        fileType: 'sql',
        generated: 'YES_SYNTHESIZED',
        status: 'Done',
        notes: `Concatenated from ${(lld.pseudoFiles.filter((f) => folderFor(f.path)?.key === 'database/migrations')).length} migration files`,
        fullContent: schemaText.slice(0, 4000),
      });
    }

    rows.sort((a, b) => {
      if (a.featureId !== b.featureId) return a.featureId.localeCompare(b.featureId);
      if (a.storyId !== b.storyId) return a.storyId.localeCompare(b.storyId, undefined, { numeric: true });
      if (a.subtaskId !== b.subtaskId) return a.subtaskId.localeCompare(b.subtaskId, undefined, { numeric: true });
      return a.folder.localeCompare(b.folder);
    });

    const stats = {
      total: rows.length,
      done: rows.filter((r) => r.status === 'Done').length,
      todo: rows.filter((r) => r.status === 'ToDo').length,
      wip: rows.filter((r) => r.status === 'WIP').length,
      failed: rows.filter((r) => r.status === 'Failed').length,
    };

    return {
      module: { id: mod.id, moduleId: mod.moduleId, moduleName: mod.moduleName },
      lld: { id: lld.id, artifactId: lld.artifactId },
      rows,
      consolidatedSchema: schemaText,
      stats,
    };
  }

  synthesizeConsolidatedSchema(
    pseudoFiles: Array<{ path: string; aiContent: string; editedContent: string | null; isHumanModified: boolean }>,
  ): string {
    const migrationFiles = pseudoFiles
      .filter((f) => folderFor(f.path)?.key === 'database/migrations' && f.path.toLowerCase().endsWith('.sql'))
      .sort((a, b) => a.path.localeCompare(b.path));
    if (migrationFiles.length === 0) return '';
    const parts: string[] = [
      '-- ════════════════════════════════════════════════════════════════',
      '-- Consolidated module schema (synthesized at RTM-generation time)',
      `-- Source: ${migrationFiles.length} migration file(s) from LLD-PseudoCode/database/migrations/`,
      `-- Generated: ${new Date().toISOString()}`,
      '-- ════════════════════════════════════════════════════════════════',
      '',
    ];
    for (const f of migrationFiles) {
      parts.push('');
      parts.push(`-- ─── ${f.path} ───`);
      parts.push(f.isHumanModified && f.editedContent ? f.editedContent : f.aiContent);
    }
    return parts.join('\n');
  }

  // ─── Emitters ─────────────────────────────────────────────────────────

  emitCsv(rows: RtmRow[]): string {
    const header = ['Feature', 'UserStory', 'SubTask', 'SubTaskName', 'Team', 'Folder', 'FilePath', 'FileType', 'Generated', 'Status', 'Notes'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        escapeCsv(r.featureId),
        escapeCsv(r.storyId),
        escapeCsv(r.subtaskId),
        escapeCsv(r.subtaskName),
        escapeCsv(r.team),
        escapeCsv(r.folder),
        escapeCsv(r.filePath),
        escapeCsv(r.fileType),
        escapeCsv(r.generated),
        escapeCsv(r.status),
        escapeCsv(r.notes),
      ].join(','));
    }
    return lines.join('\n');
  }

  /**
   * Developer-facing implementation-tracking CSV (Workstream 3, Option A).
   * Starter template the dev team downloads, fills in (`impl_status` →
   * Done / WIP / Failed as they progress against the LLD pseudo-code).
   *
   * Schema is intentionally minimal so the team can maintain it in git
   * alongside the codebase. RTM HTML can later overlay this CSV's status
   * over the auto-derived design-state status, but v1 leaves the
   * implementation-state purely manual.
   */
  emitImplStatusCsv(rows: RtmRow[]): string {
    const header = [
      'Feature', 'UserStory', 'SubTask', 'Folder', 'FilePath',
      'design_status', 'impl_status', 'note', 'updated_by', 'updated_at',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      // Skip the synthesized-schema row from the impl-status template —
      // the dev team doesn't implement that file, it's auto-built.
      if (r.generated === 'YES_SYNTHESIZED') continue;
      const initialImpl = r.status === 'ToDo' ? 'ToDo' : 'ToDo'; // dev impl starts ToDo regardless of design state
      lines.push([
        escapeCsv(r.featureId),
        escapeCsv(r.storyId),
        escapeCsv(r.subtaskId),
        escapeCsv(r.folder),
        escapeCsv(r.filePath),
        escapeCsv(r.status),
        escapeCsv(initialImpl),
        '',
        '',
        '',
      ].join(','));
    }
    return lines.join('\n');
  }

  emitTree(rows: RtmRow[], moduleId: string): string {
    const byFolder = new Map<string, RtmRow[]>();
    for (const r of rows) {
      if (!byFolder.has(r.folder)) byFolder.set(r.folder, []);
      byFolder.get(r.folder)!.push(r);
    }
    const lines: string[] = [];
    lines.push(`LLD-PseudoCode/  (${moduleId})`);
    lines.push('│');
    const orderedFolders = FOLDER_TAXONOMY.filter((f) => byFolder.has(f.key));
    const lastFolder = orderedFolders[orderedFolders.length - 1];
    for (const f of orderedFolders) {
      const list = byFolder.get(f.key)!;
      const isLast = f === lastFolder;
      const branch = isLast ? '└──' : '├──';
      lines.push(`${branch} ${f.label}/  (${list.length})`);
      const indent = isLast ? '    ' : '│   ';
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const lastFile = i === list.length - 1;
        const fileBranch = lastFile ? '└──' : '├──';
        const annot = `  [${r.storyId} · ${r.subtaskId}]${r.status === 'ToDo' ? '  ❌ ToDo' : r.status === 'WIP' ? '  🟡 WIP' : ''}`;
        lines.push(`${indent}${fileBranch} ${r.filePath.split('/').pop()}${annot}`);
      }
      if (!isLast) lines.push('│');
    }
    return lines.join('\n');
  }

  /**
   * Render the RTM HTML viewer. `embed` carries the LLD artifact id +
   * backend base URL that the embedded JS bakes into its `__generateMissing`
   * fetch call. Without these the downloaded HTML can't reach the auto-fix
   * endpoint (no URL context, since file:// has no useful location.origin).
   *
   * When `embed` is omitted (callers that don't have a request context),
   * the HTML still renders but the Generate buttons stay disabled with
   * "Open via BA-Tool to enable" — preserving the v1 behaviour.
   */
  emitHtml(
    moduleInfo: { moduleId: string; moduleName: string },
    rows: RtmRow[],
    tree: string,
    stats: RtmBuildResult['stats'],
    embed?: { lldArtifactId?: string | null; apiBase?: string | null },
  ): string {
    const donePct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    const rowsJson = JSON.stringify(rows.map((r) => ({
      feature: r.featureId, story: r.storyId, subtask: r.subtaskId, subtaskName: r.subtaskName,
      team: r.team, folder: r.folder, file: r.filePath, fileType: r.fileType,
      generated: r.generated, status: r.status, notes: r.notes,
      content: r.fullContent ?? '',
      pseudoFileId: r.pseudoFileId ?? null,
    })));

    return this.htmlTemplate(moduleInfo, rowsJson, stats, donePct, tree, {
      lldArtifactId: embed?.lldArtifactId ?? null,
      apiBase: embed?.apiBase ?? null,
    });
  }

  /**
   * Build the final ZIP bundle a customer or dev team downloads.
   * Members: rtm.csv, rtm.html, rtm-tree.txt, schema.sql, impl-status.csv.
   *
   * The HTML is fully self-contained so a stakeholder can double-click
   * to open in any browser — no server, no build step.
   */
  async buildBundleZip(
    lldArtifactId: string,
    options: RtmBuildOptions = {},
    embed?: { apiBase?: string | null },
  ): Promise<{ zip: Buffer; stem: string; moduleId: string; result: RtmBuildResult }> {
    const result = await this.buildRtm(lldArtifactId, options);
    const stem = options.featureFilter
      ? `LLD-${result.module.moduleId}-${options.featureFilter}-rtm`
      : `LLD-${result.module.moduleId}-rtm`;

    const csv = this.emitCsv(result.rows);
    const tree = this.emitTree(result.rows, result.module.moduleId);
    const html = this.emitHtml(
      { moduleId: result.module.moduleId, moduleName: result.module.moduleName },
      result.rows, tree, result.stats,
      // Embed the LLD id so the Generate-file button works from a
      // downloaded copy. apiBase comes from the request that called this
      // method; falls back to the env default when invoked via CLI.
      { lldArtifactId, apiBase: embed?.apiBase ?? null },
    );
    const implCsv = this.emitImplStatusCsv(result.rows);

    const zip = new AdmZip();
    zip.addFile(`${stem}.csv`, Buffer.from(csv, 'utf8'));
    zip.addFile(`${stem}.html`, Buffer.from(html, 'utf8'));
    zip.addFile(`${stem}-tree.txt`, Buffer.from(tree, 'utf8'));
    zip.addFile(`${stem}-impl-status.csv`, Buffer.from(implCsv, 'utf8'));
    if (result.consolidatedSchema) {
      zip.addFile(`LLD-${result.module.moduleId}-schema.sql`, Buffer.from(result.consolidatedSchema, 'utf8'));
    }
    return { zip: zip.toBuffer(), stem, moduleId: result.module.moduleId, result };
  }

  // ─── Workstream 4: auto-fix for a missing pseudo-file ────────────────

  /**
   * Generate a missing pseudo-file for an RTM ToDo row. Called from the
   * POST /api/ba/artifacts/:id/rtm/generate-missing-file endpoint AND
   * from the per-row "Generate file" button in the RTM HTML viewer.
   *
   * v1 implementation: resolves the subtask's featureId and delegates to
   * the existing idempotent `executeSkill06ForFeature` orchestrator. That
   * generates the whole feature's pseudo-file set but skips any already-
   * emitted files, so the net effect is the missing file gets created
   * (alongside any other gaps in that feature). Over-generates relative
   * to a true per-file fast-path, but the orchestrator's idempotency
   * keeps re-runs safe and gives us the framework today.
   *
   * Returns a structured response the UI can render: which feature was
   * targeted, how many files were added, whether the specific requested
   * file is now present.
   */
  async generateMissingFile(input: {
    lldArtifactId: string;
    subtaskId: string;
    filePath: string;
  }): Promise<{
    requested: { subtaskId: string; filePath: string };
    delegated: { featureId: string; pseudoFilesAdded: number; skipped: boolean; reason?: string };
    matched: boolean;
    matchedPath?: string;
    note: string;
  }> {
    const subtaskId = (input.subtaskId ?? '').trim();
    const filePath = (input.filePath ?? '').trim();
    if (!subtaskId || !filePath) {
      throw new BadRequestException('Both subtaskId and filePath are required');
    }
    if (!/^ST-US\d{3,}-[A-Z]{2,4}-\d{2,}$/i.test(subtaskId)) {
      throw new BadRequestException(`subtaskId must match ST-USNNN-TEAM-NN (got "${subtaskId}")`);
    }

    const lld = await this.prisma.baArtifact.findUnique({
      where: { id: input.lldArtifactId },
      select: { id: true, artifactType: true, artifactId: true, moduleDbId: true },
    });
    if (!lld) throw new NotFoundException(`Artifact ${input.lldArtifactId} not found`);
    if (lld.artifactType !== 'LLD') {
      throw new BadRequestException(`Artifact ${lld.artifactId} is ${lld.artifactType}, not LLD; auto-fix is LLD-only`);
    }

    const st = await this.prisma.baSubTask.findFirst({
      where: { moduleDbId: lld.moduleDbId, subtaskId: subtaskId.toUpperCase() },
      select: { subtaskId: true, featureId: true, subtaskName: true },
    });
    if (!st) {
      throw new BadRequestException(
        `SubTask ${subtaskId} not found in module. Did the subtaskId come from a stale RTM?`,
      );
    }
    if (!st.featureId) {
      throw new BadRequestException(
        `SubTask ${subtaskId} has no featureId; cannot delegate to executeSkill06ForFeature. ` +
        `Populate the SubTask's feature reference first.`,
      );
    }

    this.logger.log(
      `RTM auto-fix: subtask=${subtaskId} feature=${st.featureId} requested-file=${filePath} ` +
      `→ delegating to executeSkill06ForFeature`,
    );
    const result = await this.orchestrator.executeSkill06ForFeature(lld.moduleDbId, st.featureId);

    // Best-effort match: did the AI emit a file whose basename matches
    // what the ToDo row was waiting on?
    const targetBasename = filePath.split('/').pop()!.toLowerCase();
    const updatedFiles = await this.prisma.baPseudoFile.findMany({
      where: { artifactDbId: input.lldArtifactId },
      select: { path: true },
    });
    const matchedFile = updatedFiles.find((f) => f.path.split('/').pop()!.toLowerCase() === targetBasename);

    return {
      requested: { subtaskId, filePath },
      delegated: {
        featureId: st.featureId,
        pseudoFilesAdded: result.pseudoFilesAdded,
        skipped: result.skipped,
        reason: result.reason,
      },
      matched: !!matchedFile,
      matchedPath: matchedFile?.path,
      note: matchedFile
        ? `File generated at ${matchedFile.path} (per-feature run added ${result.pseudoFilesAdded} pseudo-file(s) in total).`
        : result.skipped
          ? `Per-feature run was skipped: ${result.reason ?? 'unknown reason'}. The missing file was not generated.`
          : `Per-feature run added ${result.pseudoFilesAdded} pseudo-file(s) but none matched basename "${targetBasename}". The AI may have emitted under a different filename — inspect the new pseudo-files in the next RTM refresh.`,
    };
  }

  // ─── HTML template (extracted to its own method for readability) ──────

  private htmlTemplate(
    moduleInfo: { moduleId: string; moduleName: string },
    rowsJson: string,
    stats: RtmBuildResult['stats'],
    donePct: number,
    tree: string,
    embed: { lldArtifactId: string | null; apiBase: string | null },
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(moduleInfo.moduleId)} — SubTask LLD RTM</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Calibri, sans-serif; color: #0F172A; margin: 0; padding: 0; background: #F8FAFC; }
  header { background: #fff; border-bottom: 1px solid #E2E8F0; padding: 16px 24px; }
  header h1 { font-size: 18pt; margin: 0 0 4px; color: #0F172A; }
  header .sub { color: #64748B; font-size: 11pt; }
  .stats { display: flex; gap: 16px; margin-top: 12px; }
  .stats .card { background: #F1F5F9; border-radius: 6px; padding: 8px 14px; font-size: 10pt; }
  .stats .card .num { font-size: 16pt; font-weight: 700; color: #0F172A; margin-right: 6px; }
  .stats .card.done .num { color: #166534; }
  .stats .card.todo .num { color: #B91C1C; }
  .stats .card.wip .num { color: #B45309; }
  .filterbar { background: #fff; border-bottom: 1px solid #E2E8F0; padding: 12px 24px; display: flex; gap: 12px; align-items: center; font-size: 10pt; }
  .filterbar label { color: #64748B; margin-right: 6px; }
  .filterbar select, .filterbar input { font: inherit; padding: 4px 8px; border: 1px solid #CBD5E1; border-radius: 4px; }
  .filterbar input[type="search"] { min-width: 240px; }
  main { display: flex; height: calc(100vh - 220px); }
  aside { width: 42%; overflow-y: auto; background: #fff; border-right: 1px solid #E2E8F0; padding: 12px 0; }
  section.detail { width: 58%; overflow-y: auto; padding: 16px 24px; }
  aside .feature { margin: 6px 12px; }
  aside .feature > .head { font-weight: 600; color: #0F172A; padding: 6px 8px; cursor: pointer; background: #F1F5F9; border-radius: 4px; user-select: none; }
  aside .feature > .head::before { content: '▶ '; transition: transform .15s; display: inline-block; }
  aside .feature.open > .head::before { transform: rotate(90deg); }
  aside .story { margin: 4px 0 4px 16px; }
  aside .story > .head { color: #1E293B; padding: 4px 8px; font-size: 10pt; cursor: pointer; user-select: none; }
  aside .story > .head::before { content: '▶ '; }
  aside .story.open > .head::before { content: '▼ '; }
  aside .subtask { margin: 3px 0 3px 30px; padding: 4px 8px; font-size: 9.5pt; color: #475569; cursor: pointer; border-radius: 3px; }
  aside .subtask:hover { background: #F1F5F9; }
  aside .subtask.selected { background: #DBEAFE; color: #1E40AF; }
  aside .files-inline { margin: 2px 0 2px 46px; font-size: 8.5pt; color: #94A3B8; }
  aside .badge { display: inline-block; font-size: 7.5pt; padding: 1px 5px; border-radius: 8px; margin-left: 4px; vertical-align: middle; }
  aside .badge.done { background: #DCFCE7; color: #166534; }
  aside .badge.todo { background: #FEE2E2; color: #B91C1C; }
  aside .badge.wip  { background: #FEF3C7; color: #B45309; }
  aside .badge.synth { background: #DDD6FE; color: #5B21B6; }
  section.detail h2 { font-size: 13pt; margin: 0 0 4px; color: #0F172A; }
  section.detail .meta { color: #64748B; font-size: 10pt; margin-bottom: 12px; }
  section.detail .meta span { margin-right: 14px; }
  section.detail .traceability { background: #FAFBFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 9.5pt; }
  section.detail pre.code { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 12px; border-radius: 6px; overflow-x: auto; font-size: 9pt; font-family: 'SFMono-Regular',Consolas,monospace; max-height: 480px; }
  section.detail .empty { color: #94A3B8; font-style: italic; padding: 40px 0; text-align: center; }
  section.detail .gen-btn { background: #F97316; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-size: 9.5pt; cursor: pointer; margin-left: 8px; }
  section.detail .gen-btn:hover { background: #EA580C; }
  section.detail .gen-btn:disabled { background: #94A3B8; cursor: wait; }
  .table-view { display: none; padding: 16px 24px; overflow-x: auto; }
  .table-view.active { display: block; }
  .table-view table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .table-view th, .table-view td { border: 1px solid #E2E8F0; padding: 5px 8px; text-align: left; vertical-align: top; }
  .table-view th { background: #F1F5F9; font-weight: 600; color: #1E293B; position: sticky; top: 0; }
  .table-view tr:hover td { background: #FAFBFC; }
  .tabs { display: flex; gap: 4px; background: #fff; border-bottom: 1px solid #E2E8F0; padding: 0 24px; }
  .tabs button { background: none; border: none; padding: 10px 16px; font: inherit; font-size: 10pt; color: #64748B; cursor: pointer; border-bottom: 2px solid transparent; }
  .tabs button.active { color: #0F172A; border-bottom-color: #F97316; font-weight: 600; }
  .tree-view { display: none; padding: 16px 24px; }
  .tree-view.active { display: block; }
  .tree-view pre { background: #fff; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; font-family: 'SFMono-Regular',Consolas,monospace; font-size: 9pt; white-space: pre; overflow-x: auto; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(moduleInfo.moduleId)} — SubTask LLD RTM Checklist</h1>
  <div class="sub">${escapeHtml(moduleInfo.moduleName)} · Generated ${new Date().toISOString().slice(0, 10)}</div>
  <div class="stats">
    <div class="card"><span class="num">${stats.total}</span>Total rows</div>
    <div class="card done"><span class="num">${stats.done}</span>Done (${donePct}%)</div>
    <div class="card todo"><span class="num">${stats.todo}</span>ToDo</div>
    <div class="card wip"><span class="num">${stats.wip}</span>WIP</div>
  </div>
</header>
<div class="tabs">
  <button class="tab-btn active" data-view="explorer">Explorer</button>
  <button class="tab-btn" data-view="table">Flat table</button>
  <button class="tab-btn" data-view="tree">Project tree</button>
</div>
<div class="filterbar">
  <label>Team:</label>
  <select id="filter-team">
    <option value="">all</option><option>FE</option><option>BE</option><option>QA</option><option>IN</option>
  </select>
  <label>Status:</label>
  <select id="filter-status">
    <option value="">all</option><option>Done</option><option>ToDo</option><option>WIP</option><option>Failed</option>
  </select>
  <label>Search:</label>
  <input type="search" id="filter-search" placeholder="file / subtask / story"/>
</div>
<div id="view-explorer">
<main>
  <aside id="tree-root"></aside>
  <section class="detail" id="detail-pane">
    <div class="empty">Click a SubTask or file in the left tree to view details.</div>
  </section>
</main>
</div>
<div class="table-view" id="view-table">
  <table>
    <thead>
      <tr>
        <th>Feature</th><th>Story</th><th>SubTask</th><th>Team</th>
        <th>Folder</th><th>File</th><th>Type</th><th>Generated</th><th>Status</th><th>Notes</th>
      </tr>
    </thead>
    <tbody id="table-body"></tbody>
  </table>
</div>
<div class="tree-view" id="view-tree">
  <pre>${escapeHtml(tree)}</pre>
</div>
<script>
const ROWS = ${rowsJson};
const $ = (id) => document.getElementById(id);

function statusBadge(r) {
  if (r.status === 'Done' && r.generated === 'YES_SYNTHESIZED') return '<span class="badge synth">synth</span>';
  if (r.status === 'Done') return '<span class="badge done">Done</span>';
  if (r.status === 'ToDo') return '<span class="badge todo">ToDo</span>';
  if (r.status === 'WIP')  return '<span class="badge wip">WIP</span>';
  if (r.status === 'Failed') return '<span class="badge todo">Failed</span>';
  return '';
}

function rowMatches(r, f) {
  if (f.team && r.team !== f.team) return false;
  if (f.status && r.status !== f.status) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![r.feature, r.story, r.subtask, r.subtaskName, r.file].some((s) => s && s.toLowerCase().includes(q))) return false;
  }
  return true;
}

function rebuildTree() {
  const filter = { team: $('filter-team').value, status: $('filter-status').value, q: $('filter-search').value };
  const visible = ROWS.filter((r) => rowMatches(r, filter));
  const byFeature = new Map();
  for (const r of visible) {
    if (!byFeature.has(r.feature)) byFeature.set(r.feature, new Map());
    const bs = byFeature.get(r.feature);
    if (!bs.has(r.story)) bs.set(r.story, new Map());
    const bst = bs.get(r.story);
    if (!bst.has(r.subtask)) bst.set(r.subtask, []);
    bst.get(r.subtask).push(r);
  }
  const root = $('tree-root');
  root.innerHTML = '';
  for (const [feat, stories] of byFeature) {
    const fEl = document.createElement('div');
    fEl.className = 'feature open';
    const head = document.createElement('div');
    head.className = 'head';
    let featTotal = 0; for (const m of stories.values()) for (const arr of m.values()) featTotal += arr.length;
    head.textContent = feat + '  (' + featTotal + ' files)';
    head.onclick = () => fEl.classList.toggle('open');
    fEl.appendChild(head);
    for (const [story, sts] of stories) {
      const sEl = document.createElement('div');
      sEl.className = 'story open';
      const sHead = document.createElement('div');
      sHead.className = 'head';
      let stCount = 0; for (const arr of sts.values()) stCount += arr.length;
      sHead.textContent = story + '  (' + stCount + ' files)';
      sHead.onclick = () => sEl.classList.toggle('open');
      sEl.appendChild(sHead);
      for (const [stId, files] of sts) {
        const stEl = document.createElement('div');
        stEl.className = 'subtask';
        const stName = files[0].subtaskName || '';
        stEl.innerHTML = '<b>' + stId + '</b> <span style="color:#94A3B8">' + (stName ? '— ' + stName.slice(0,40) + (stName.length>40?'…':'') : '') + '</span> (' + files.length + ')';
        stEl.onclick = () => {
          document.querySelectorAll('aside .subtask').forEach(e => e.classList.remove('selected'));
          stEl.classList.add('selected');
          showSubtaskDetail(stId, files);
        };
        sEl.appendChild(stEl);
        const filesDiv = document.createElement('div');
        filesDiv.className = 'files-inline';
        filesDiv.innerHTML = files.map(f => '<div>• ' + (f.folder || 'unmapped') + '/ <b>' + (f.file.split('/').pop()) + '</b> ' + statusBadge(f) + '</div>').join('');
        sEl.appendChild(filesDiv);
      }
      fEl.appendChild(sEl);
    }
    root.appendChild(fEl);
  }
}

function showSubtaskDetail(stId, files) {
  const r = files[0];
  let html = '<h2>' + stId + '</h2>';
  html += '<div class="meta"><span><b>Team:</b> ' + r.team + '</span><span><b>Feature:</b> ' + r.feature + '</span><span><b>Story:</b> ' + r.story + '</span></div>';
  html += '<div class="traceability"><b>SubTask:</b> ' + (r.subtaskName || '—') + '</div>';
  html += '<h3 style="font-size:11pt;margin-top:14px;">Files (' + files.length + ')</h3>';
  for (const f of files) {
    html += '<div style="margin:10px 0;padding:10px;border:1px solid #E2E8F0;border-radius:6px;background:#fff;">';
    html += '<div style="margin-bottom:6px;"><b style="font-family:Consolas,monospace;">' + f.file + '</b> ' + statusBadge(f);
    // Per-ToDo "Generate" button (workstream 4). Calls the backend
    // endpoint to fire a focused SKILL-06 pass for just this file. Only
    // shown when status === ToDo AND the artifact has an id (the HTML
    // could have been served standalone or via the HTTP endpoint).
    if (f.status === 'ToDo') {
      html += ' <button class="gen-btn" onclick="window.__generateMissing(this, ' + JSON.stringify(stId) + ', ' + JSON.stringify(f.file) + ')">Generate file</button>';
    }
    html += '</div>';
    html += '<div style="font-size:9pt;color:#64748B;">Folder: <b>' + f.folder + '</b> · Type: ' + f.fileType + ' · Generated: ' + f.generated + '</div>';
    if (f.notes) html += '<div style="font-size:9pt;color:#B45309;margin-top:4px;">⚠ ' + f.notes + '</div>';
    if (f.content) {
      html += '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:9pt;color:#64748B;">View content (first 4 KB)</summary>';
      html += '<pre class="code">' + f.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre></details>';
    }
    html += '</div>';
  }
  $('detail-pane').innerHTML = html;
}

// Workstream 4 hook: invoked when the user clicks "Generate file" on a
// ToDo row. lldArtifactId and apiBase are baked into the HTML at
// generation time (see BaLldRtmService.emitHtml's embed arg) so the
// downloaded file can call the backend without depending on URL query
// params or location.origin (which is useless on file:// pages).
//
// When the HTML was generated WITHOUT an embed context (e.g. an older
// CLI run, or someone called emitHtml() with no args), the constants
// are null and the Generate button disables itself with a clear hint.
//
// CORS for the POST works because main.ts allows Origin: null (file://
// pages send that) + the configured frontend origins.
window.__LLD_ARTIFACT_ID = ${embed.lldArtifactId ? JSON.stringify(embed.lldArtifactId) : 'null'};
window.__LLD_API_BASE = ${embed.apiBase ? JSON.stringify(embed.apiBase) : 'null'};
window.__generateMissing = async function(btn, subtaskId, filePath) {
  // Fallback to ?lldId= and ?apiBase= URL params if the HTML was
  // generated without an embed context (older bundles). That keeps the
  // previous behaviour working alongside the new baked-in approach.
  const lldId = window.__LLD_ARTIFACT_ID || (new URLSearchParams(location.search)).get('lldId');
  const apiBase = window.__LLD_API_BASE || (new URLSearchParams(location.search)).get('apiBase') || '';
  if (!lldId) {
    btn.disabled = true;
    btn.textContent = 'Open via BA-Tool to enable';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const res = await fetch(apiBase + '/api/ba/artifacts/' + encodeURIComponent(lldId) + '/rtm/generate-missing-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtaskId, filePath }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    btn.textContent = 'Done — reload to see';
    btn.style.background = '#16A34A';
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Retry (' + (e.message || 'error') + ')';
    btn.style.background = '#B91C1C';
  }
};

function rebuildTable() {
  const filter = { team: $('filter-team').value, status: $('filter-status').value, q: $('filter-search').value };
  const visible = ROWS.filter((r) => rowMatches(r, filter));
  const tbody = $('table-body');
  tbody.innerHTML = visible.map(r => {
    return '<tr>' + ['feature','story','subtask','team','folder','file','fileType','generated','status','notes'].map(k => {
      const v = (r[k] != null) ? String(r[k]) : '';
      const cls = k === 'status' ? ' style="color:' + (r.status==='Done'?'#166534':r.status==='ToDo'?'#B91C1C':r.status==='WIP'?'#B45309':'#475569') + ';font-weight:600;"' : '';
      return '<td' + cls + '>' + v.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</td>';
    }).join('') + '</tr>';
  }).join('');
}

function applyFilters() {
  rebuildTree();
  rebuildTable();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    ['view-explorer', 'view-table', 'view-tree'].forEach(id => {
      const el = $(id);
      if (id === 'view-' + view) {
        el.style.display = '';
        el.classList.add('active');
      } else {
        el.style.display = 'none';
        el.classList.remove('active');
      }
    });
  };
});
['filter-team','filter-status','filter-search'].forEach(id => $(id).addEventListener('input', applyFilters));
applyFilters();
</script>
</body>
</html>`;
  }
}
