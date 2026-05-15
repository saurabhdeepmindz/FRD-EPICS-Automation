/**
 * LLD RTM Checklist generator — Module SubTask LLD RTM
 *
 * Generates three artifacts for a module's LLD pseudo-files section:
 *   - <MOD>-rtm.csv         Flat tabular RTM (one row per subtask × file)
 *   - <MOD>-rtm.html        Swagger-like clickable explorer (self-contained)
 *   - <MOD>-tree.txt        Project directory tree with story/subtask annotations
 *
 * Status auto-derivation (v1):
 *   - Done    → BaPseudoFile exists for this subtask × folder
 *   - ToDo ❌ → BaSubTask.sourceFileName declared but no matching pseudo-file
 *   - N/A     → folder column doesn't apply to this subtask's team
 *   - WIP/Failed → reserved for future manual override
 *
 * The consolidated database/schema/<module>-schema.sql is synthesized at
 * generation time by concatenating all database/migrations/*.sql
 * pseudo-files (Option b from the design discussion).
 *
 * Usage:
 *   npx ts-node scripts/_generate-lld-rtm.ts MOD-04 [F-04-01]
 *
 * Outputs to backups/db-backup/rtm-templates/.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ─── Fixed folder taxonomy (the column set) ─────────────────────────────

interface FolderSpec {
  key: string;
  label: string;
  pathPrefixes: string[];
  teams: string[]; // which teams this folder applies to (for N/A inference)
}

const FOLDER_TAXONOMY: FolderSpec[] = [
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

function folderFor(p: string): FolderSpec | null {
  for (const f of FOLDER_TAXONOMY) {
    for (const pref of f.pathPrefixes) {
      if (p.startsWith(pref)) return f;
    }
  }
  return null;
}

// ─── Row model ──────────────────────────────────────────────────────────

interface RtmRow {
  featureId: string;
  storyId: string;
  subtaskId: string;
  subtaskName: string;
  team: string;
  folder: string;          // FolderSpec.key, or "unmapped"
  filePath: string;        // basename or relative path
  fileType: string;        // language
  generated: 'YES' | 'YES_SYNTHESIZED' | 'NO';
  status: 'Done' | 'ToDo' | 'WIP' | 'Failed' | 'N/A';
  notes: string;
  // Internal — for HTML view
  pseudoFileId?: string;
  fullContent?: string;    // first 4000 chars for preview
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

function statusBadge(status: RtmRow['status'], generated: RtmRow['generated']): string {
  if (status === 'Done') return generated === 'YES_SYNTHESIZED' ? '✅ Done (synth)' : '✅ Done';
  if (status === 'ToDo') return '❌ ToDo';
  if (status === 'WIP') return '🟡 WIP';
  if (status === 'Failed') return '🔴 Failed';
  return '— N/A';
}

// ─── Main RTM build ─────────────────────────────────────────────────────

async function buildRtm(prisma: PrismaClient, moduleId: string, featureFilter?: string): Promise<{
  module: { id: string; moduleId: string; moduleName: string };
  lld: { id: string; artifactId: string };
  rows: RtmRow[];
  consolidatedSchema: string;
}> {
  const mod = await prisma.baModule.findFirst({ where: { moduleId } });
  if (!mod) throw new Error(`${moduleId} not found`);

  const lld = await prisma.baArtifact.findFirst({
    where: { moduleDbId: mod.id, artifactType: 'LLD' as never },
    orderBy: { createdAt: 'desc' },
    include: { pseudoFiles: { orderBy: { path: 'asc' } } },
  });
  if (!lld) throw new Error(`No LLD artifact for ${moduleId}`);

  // ALL subtasks for the module (no feature filter at query time). Feature
  // filter is applied at row-emission time so cross-feature attribution
  // works correctly: a pseudo-file might basename-match a subtask in
  // F-04-02 even when we're filtering to F-04-01; we don't want to mis-
  // attribute it to F-04-01 just because that's the only feature in scope.
  const subtasks = await prisma.baSubTask.findMany({
    where: { moduleDbId: mod.id },
    orderBy: [{ userStoryId: 'asc' }, { team: 'asc' }, { subtaskId: 'asc' }],
  });

  // Build pseudo-file index by basename for fuzzy attribution.
  const filesByBasename = new Map<string, typeof lld.pseudoFiles[number][]>();
  for (const pf of lld.pseudoFiles) {
    const basename = pf.path.split('/').pop()!.toLowerCase();
    if (!filesByBasename.has(basename)) filesByBasename.set(basename, []);
    filesByBasename.get(basename)!.push(pf);
  }

  // Attribute each pseudo-file to its owning subtask. Strategy in order
  // of reliability:
  //   1. Parse traceability header comments inside the file content for
  //      explicit `ST: ST-USNNN-TEAM-NN` / `@subTask ST-...` tokens. SKILL-06
  //      emits these in every generated file's header — this is the
  //      authoritative signal.
  //   2. Fall back to feature ref `F-XX-YY` in the content — attribute
  //      to the first subtask of that feature whose team matches the
  //      file's folder bucket.
  //   3. Basename match against BaSubTask.sourceFileName (case-insensitive).
  //   4. Otherwise unattributed — surfaces under "(cross-cutting)".
  const subtaskById = new Map<string, typeof subtasks[number]>();
  for (const st of subtasks) subtaskById.set(st.subtaskId.toUpperCase(), st);

  const fileToSubtask = new Map<string, typeof subtasks[number] | null>();
  for (const pf of lld.pseudoFiles) {
    const content = (pf.isHumanModified && pf.editedContent ? pf.editedContent : pf.aiContent) ?? '';
    const head = content.slice(0, 2000); // traceability headers always near top
    let owner: typeof subtasks[number] | null = null;

    // Strategy 1: explicit ST-USNNN-TEAM-NN token in the header
    const stMatch = /\bST[-:\s]*US\d{3,}[-_][A-Z]{2,4}[-_]\d{2,}\b/i.exec(head)
                 ?? /@subTask\s+(ST-US\d{3,}-[A-Z]{2,4}-\d{2,})/i.exec(head);
    if (stMatch) {
      // Normalise to ST-USNNN-TEAM-NN form (the regex tolerates _ separators
      // some templates use).
      const raw = (stMatch[1] ?? stMatch[0]).toUpperCase().replace(/_/g, '-').replace(/^ST[-:\s]+/, 'ST-');
      const stKey = raw.replace(/^ST[-]?/, 'ST-');
      const fixed = stKey.startsWith('ST-') ? stKey : `ST-${stKey}`;
      const found = subtaskById.get(fixed);
      if (found) owner = found;
    }

    // Strategy 2: feature ref + folder team disambiguation
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
    const owner = fileToSubtask.get(pf.id);
    if (featureFilter && (!owner || owner.featureId !== featureFilter)) continue;
    const folder = folderFor(pf.path);
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
      fullContent: ((pf.isHumanModified && pf.editedContent) ? pf.editedContent : pf.aiContent).slice(0, 4000),
    });
  }

  // (b) ToDo rows — subtask declared a sourceFileName but no pseudo-file
  //     matches (by basename, case-insensitive). Feature-filter aware.
  const subtasksInScope = featureFilter
    ? subtasks.filter((st) => st.featureId === featureFilter)
    : subtasks;
  for (const st of subtasksInScope) {
    if (!st.sourceFileName) continue;
    const stBasename = st.sourceFileName.split('/').pop()!.toLowerCase();
    if (filesByBasename.has(stBasename)) continue; // already covered by a Done row
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
      notes: `Declared by ${st.subtaskId} but no pseudo-file emitted (no basename match)`,
    });
  }

  // (c) Synthesized consolidated schema entry
  const schemaText = synthesizeConsolidatedSchema(lld.pseudoFiles);
  const schemaPresent = schemaText.length > 0;
  if (schemaPresent) {
    // Find a representative BE subtask for the schema row (any one of feature)
    const beSubtask = subtasks.find((s) => s.team === 'BE');
    rows.push({
      featureId: featureFilter ?? '(module-wide)',
      storyId: '—',
      subtaskId: beSubtask?.subtaskId ?? '(module-wide)',
      subtaskName: 'Consolidated database schema (synthesized from migrations)',
      team: 'BE',
      folder: 'database/schema',
      filePath: `${moduleId.toLowerCase()}-schema.sql`,
      fileType: 'sql',
      generated: 'YES_SYNTHESIZED',
      status: 'Done',
      notes: `Concatenated from ${(lld.pseudoFiles.filter((f) => folderFor(f.path)?.key === 'database/migrations')).length} migration files`,
      fullContent: schemaText.slice(0, 4000),
    });
  }

  // Sort: feature → story → subtask → folder
  rows.sort((a, b) => {
    if (a.featureId !== b.featureId) return a.featureId.localeCompare(b.featureId);
    if (a.storyId !== b.storyId) return a.storyId.localeCompare(b.storyId, undefined, { numeric: true });
    if (a.subtaskId !== b.subtaskId) return a.subtaskId.localeCompare(b.subtaskId, undefined, { numeric: true });
    return a.folder.localeCompare(b.folder);
  });

  return {
    module: { id: mod.id, moduleId: mod.moduleId, moduleName: mod.moduleName },
    lld: { id: lld.id, artifactId: lld.artifactId },
    rows,
    consolidatedSchema: schemaText,
  };
}

function synthesizeConsolidatedSchema(
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

function guessFolderFromPath(p: string): string | null {
  // Heuristic for ToDo rows where the path doesn't follow the LLD-PseudoCode
  // convention — match by directory keyword.
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

// ─── Output: CSV ────────────────────────────────────────────────────────

function emitCsv(rows: RtmRow[]): string {
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

// ─── Output: project tree ───────────────────────────────────────────────

function emitTree(rows: RtmRow[], moduleId: string): string {
  // Build a path-to-rows map keyed by folder slot.
  const byFolder = new Map<string, RtmRow[]>();
  for (const r of rows) {
    if (!byFolder.has(r.folder)) byFolder.set(r.folder, []);
    byFolder.get(r.folder)!.push(r);
  }
  // Order folders per FOLDER_TAXONOMY for stability.
  const lines: string[] = [];
  lines.push(`LLD-PseudoCode/  (${moduleId})`);
  lines.push('│');
  const lastFolder = FOLDER_TAXONOMY.filter((f) => byFolder.has(f.key)).pop();
  for (const f of FOLDER_TAXONOMY) {
    const list = byFolder.get(f.key);
    if (!list || list.length === 0) continue;
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
    lines.push(isLast ? '' : '│');
  }
  return lines.join('\n');
}

// ─── Output: HTML (Swagger-like) ────────────────────────────────────────

function emitHtml(
  moduleInfo: { moduleId: string; moduleName: string },
  rows: RtmRow[],
  consolidatedSchema: string,
  tree: string,
): string {
  // Pre-bucket for tree rendering in JS.
  const stats = {
    total: rows.length,
    done: rows.filter((r) => r.status === 'Done').length,
    todo: rows.filter((r) => r.status === 'ToDo').length,
    wip: rows.filter((r) => r.status === 'WIP').length,
    failed: rows.filter((r) => r.status === 'Failed').length,
  };
  const donePct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  // Embed rows as JSON so JS can filter/render.
  const rowsJson = JSON.stringify(rows.map((r) => ({
    feature: r.featureId, story: r.storyId, subtask: r.subtaskId, subtaskName: r.subtaskName,
    team: r.team, folder: r.folder, file: r.filePath, fileType: r.fileType,
    generated: r.generated, status: r.status, notes: r.notes,
    content: r.fullContent ?? '',
  })));

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
  main { display: flex; height: calc(100vh - 200px); }
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
  section.detail .traceability b { color: #5B21B6; font-family: 'SFMono-Regular',Consolas,monospace; }
  section.detail pre.code { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 12px; border-radius: 6px; overflow-x: auto; font-size: 9pt; font-family: 'SFMono-Regular',Consolas,monospace; max-height: 480px; }
  section.detail .empty { color: #94A3B8; font-style: italic; padding: 40px 0; text-align: center; }
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
    html += '<div style="margin-bottom:6px;"><b style="font-family:Consolas,monospace;">' + f.file + '</b> ' + statusBadge(f) + '</div>';
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

// ─── Entry point ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const moduleId = process.argv[2];
  const featureFilter = process.argv[3];
  if (!moduleId) {
    console.error('Usage: ts-node _generate-lld-rtm.ts <MOD-NN> [F-NN-NN]');
    process.exit(2);
  }
  const prisma = new PrismaClient();
  const built = await buildRtm(prisma, moduleId, featureFilter);

  const outDir = path.resolve(__dirname, '..', '..', '..', 'backups', 'db-backup', 'rtm-templates');
  fs.mkdirSync(outDir, { recursive: true });
  const stem = featureFilter ? `${moduleId}-${featureFilter}` : moduleId;

  const csvPath = path.join(outDir, `${stem}-rtm.csv`);
  const htmlPath = path.join(outDir, `${stem}-rtm.html`);
  const treePath = path.join(outDir, `${stem}-tree.txt`);
  const schemaPath = path.join(outDir, `${stem}-schema.sql`);

  const csv = emitCsv(built.rows);
  const tree = emitTree(built.rows, built.module.moduleId);
  const html = emitHtml({ moduleId: built.module.moduleId, moduleName: built.module.moduleName }, built.rows, built.consolidatedSchema, tree);

  fs.writeFileSync(csvPath, csv);
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(treePath, tree);
  if (built.consolidatedSchema) fs.writeFileSync(schemaPath, built.consolidatedSchema);

  const stats = {
    total: built.rows.length,
    done: built.rows.filter((r) => r.status === 'Done').length,
    todo: built.rows.filter((r) => r.status === 'ToDo').length,
  };
  console.log(`\n══ RTM template generated for ${built.module.moduleId} ${featureFilter ?? '(all features)'} ══`);
  console.log(`  Rows: ${stats.total} total · Done: ${stats.done} · ToDo: ${stats.todo}`);
  console.log(`  CSV:    ${csvPath}`);
  console.log(`  HTML:   ${htmlPath}`);
  console.log(`  Tree:   ${treePath}`);
  if (built.consolidatedSchema) console.log(`  Schema: ${schemaPath} (${(built.consolidatedSchema.length / 1024).toFixed(1)} KB)`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
