'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  listLldsForModule,
  listPseudoFilesByArtifact,
  type BaPseudoFile,
  type BaTestCase,
} from '@/lib/ba-api';
import { ChevronDown, ChevronRight, FileCode, FlaskConical, History } from 'lucide-react';

/**
 * Shared, structured per-test-case display used by:
 *   - the AI FTC Workbench preview card
 *   - the FtcArtifactView inside the module-detail artifact panel
 *
 * Renders a Traceability table (FRD → EPIC → Story → SubTask → Class/File →
 * Test File → LLD) above a QA-template-style test-execution block (Test Data /
 * Pre Condition / E2E Flow / Steps / Expected / Post Validation / SQL / Hint /
 * Developer Hints). Raw aiContent stays in the DB for audit + CSV export;
 * this view doesn't show the verbose `tc id=... linkedFeatureIds:...` header.
 */

export interface PseudoFileRef {
  id: string;
  path: string;
  basename: string;
  isTestFile: boolean;
}

/** Language-agnostic classifier — Python / JS-TS / Java / Go / Kotlin / Scala. */
export function classifyPseudoFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (/(^|\/)(test|tests|__tests__|spec)(\/|$)/.test(lower)) return true;
  const base = lower.split('/').pop() ?? lower;
  return (
    /^test[_-]/.test(base) ||
    /_test\.(py|go)$/.test(base) ||
    /\.(test|spec)\.(js|jsx|ts|tsx)$/.test(base) ||
    /test\.(java|kt|cs|scala)$/.test(base) ||
    /tests\.(java|kt|cs)$/.test(base) ||
    /spec\.(kt|scala)$/.test(base)
  );
}

export function buildFileRef(pf: BaPseudoFile): PseudoFileRef {
  const basename = pf.path.split('/').pop() ?? pf.path;
  return { id: pf.id, path: pf.path, basename, isTestFile: classifyPseudoFile(pf.path) };
}

/**
 * Hook: given a module + a set of test cases, resolve each TC's
 * linkedPseudoFileIds (UUIDs) to human-readable pseudo-file refs. The skill
 * stores linkedLldArtifactId as a human-readable string (e.g.
 * "LLD-MOD-01-langchain-v3"), so we first look up the LLD's DB UUID via
 * listLldsForModule.
 */
export function usePseudoFileResolver(moduleDbId: string, testCases: BaTestCase[]) {
  const [map, setMap] = useState<Map<string, PseudoFileRef>>(new Map());

  const uniqueLldRefs = useMemo(() => {
    const set = new Set<string>();
    for (const tc of testCases) {
      if (tc.linkedLldArtifactId) set.add(tc.linkedLldArtifactId);
    }
    return Array.from(set);
  }, [testCases]);

  useEffect(() => {
    if (uniqueLldRefs.length === 0) {
      setMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      let humanIdToDbId = new Map<string, string>();
      try {
        const llds = await listLldsForModule(moduleDbId);
        humanIdToDbId = new Map(llds.map((l) => [l.artifactId, l.id]));
      } catch {
        // Fall through — treat refs as raw UUIDs.
      }
      const next = new Map<string, PseudoFileRef>();
      for (const ref of uniqueLldRefs) {
        const dbId = humanIdToDbId.get(ref) ?? ref;
        try {
          const files = await listPseudoFilesByArtifact(dbId);
          for (const f of files) next.set(f.id, buildFileRef(f));
        } catch {
          // Non-fatal.
        }
      }
      if (!cancelled) setMap(next);
    })();
    return () => { cancelled = true; };
  }, [uniqueLldRefs, moduleDbId]);

  const resolve = useCallback((ids: string[]): PseudoFileRef[] => {
    return ids.map((id) => map.get(id) ?? {
      id, path: id, basename: id.slice(0, 8) + '…', isTestFile: false,
    });
  }, [map]);

  return { resolve };
}

// ─── The body renderer ──────────────────────────────────────────────────────

export function TestCaseBody({
  tc,
  resolveFiles,
}: {
  tc: BaTestCase;
  resolveFiles: (ids: string[]) => PseudoFileRef[];
}) {
  const allFiles = resolveFiles(tc.linkedPseudoFileIds ?? []);
  const prodFiles = allFiles.filter((f) => !f.isTestFile);
  const testFiles = allFiles.filter((f) => f.isTestFile);
  const subtasks = tc.linkedSubtaskIds ?? [];
  const subtaskRows = subtasks.length > 0 ? subtasks : [null];
  const collapseSubtasks = subtaskRows.length > 6;
  const subtaskCell = collapseSubtasks
    ? [`${subtaskRows.length} SubTasks linked (hover to view)`]
    : subtaskRows;

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* ─── Traceability table ─── */}
      <section>
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Traceability
        </h4>
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-semibold">FRD Feature</th>
                <th className="px-2 py-1.5 font-semibold">EPIC</th>
                <th className="px-2 py-1.5 font-semibold">User Story</th>
                <th className="px-2 py-1.5 font-semibold">SubTask</th>
                <th className="px-2 py-1.5 font-semibold">Class / File</th>
                <th className="px-2 py-1.5 font-semibold">Test File</th>
                <th className="px-2 py-1.5 font-semibold">LLD Version</th>
              </tr>
            </thead>
            <tbody>
              {subtaskCell.map((st, i) => (
                <tr key={st ?? `empty-${i}`} className="border-t border-border/50 align-top">
                  {i === 0 && (
                    <>
                      <td rowSpan={subtaskCell.length} className="px-2 py-1.5 font-mono text-primary align-top">
                        {(tc.linkedFeatureIds ?? []).join(', ') || '—'}
                      </td>
                      <td rowSpan={subtaskCell.length} className="px-2 py-1.5 font-mono align-top">
                        {(tc.linkedEpicIds ?? []).join(', ') || '—'}
                      </td>
                      <td rowSpan={subtaskCell.length} className="px-2 py-1.5 font-mono align-top">
                        {(tc.linkedStoryIds ?? []).join(', ') || '—'}
                      </td>
                    </>
                  )}
                  <td
                    className="px-2 py-1.5 font-mono text-[11px]"
                    title={collapseSubtasks ? subtasks.join('\n') : undefined}
                  >
                    {st ?? '—'}
                  </td>
                  {i === 0 && (
                    <>
                      <td rowSpan={subtaskCell.length} className="px-2 py-1.5 align-top">
                        <FileList files={prodFiles} icon="code" emptyLabel="—" />
                      </td>
                      <td rowSpan={subtaskCell.length} className="px-2 py-1.5 align-top">
                        <FileList files={testFiles} icon="flask" emptyLabel="—" />
                      </td>
                      <td rowSpan={subtaskCell.length} className="px-2 py-1.5 align-top">
                        {tc.linkedLldArtifactId ? (
                          <span className="inline-flex items-center bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-mono text-[10px]">
                            {tc.linkedLldArtifactId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prodFiles.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1 italic">
            Files cover all subtasks above — per-subtask file mapping is not tracked (one list applies to the whole TC).
          </p>
        )}
      </section>

      {/* ─── Tags + supportingDocs strip ─── */}
      {((tc.tags?.length ?? 0) > 0 || (tc.supportingDocs?.length ?? 0) > 0) && (
        <section className="flex items-center gap-3 flex-wrap text-[11px]">
          {(tc.tags?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground font-semibold">Tags:</span>
              {tc.tags!.map((t) => (
                <span key={t} className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">{t}</span>
              ))}
            </div>
          )}
          {(tc.supportingDocs?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground font-semibold">Docs:</span>
              {tc.supportingDocs!.map((d) => (
                <span key={d} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{d}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Test execution sections ─── */}
      {tc.testData && (
        <Section title="Test Data">
          <pre className="bg-muted/40 border border-border/60 rounded px-3 py-2 text-xs font-mono whitespace-pre-wrap">{tc.testData}</pre>
        </Section>
      )}
      {tc.preconditions && (
        <Section title="Pre Condition">
          <MarkdownRenderer content={tc.preconditions} />
        </Section>
      )}
      {tc.e2eFlow && (
        <Section title="E2E Flow">
          <div className="bg-primary/5 border border-primary/20 rounded px-3 py-1.5 text-xs font-mono text-primary">
            {tc.e2eFlow}
          </div>
        </Section>
      )}
      {tc.steps && (
        <Section title="Test Steps">
          <div className="text-sm">
            <MarkdownRenderer content={tc.steps} />
          </div>
        </Section>
      )}
      {tc.expected && (
        <Section title="Expected">
          <MarkdownRenderer content={tc.expected} />
        </Section>
      )}
      {tc.postValidation && (
        <Section title="Post Validation">
          <MarkdownRenderer content={tc.postValidation} />
        </Section>
      )}

      {/* ─── Collapsible deep detail (SQL, hints) ─── */}
      {(tc.sqlSetup || tc.sqlVerify) && (
        <Collapsible title={`SQL (${[tc.sqlSetup ? 'setup' : null, tc.sqlVerify ? 'verify' : null].filter(Boolean).join(' + ')})`}>
          {tc.sqlSetup && (
            <div className="mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Setup</p>
              <pre className="bg-muted/40 border border-border/60 rounded px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto">{tc.sqlSetup}</pre>
            </div>
          )}
          {tc.sqlVerify && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Verify</p>
              <pre className="bg-muted/40 border border-border/60 rounded px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto">{tc.sqlVerify}</pre>
            </div>
          )}
        </Collapsible>
      )}
      {tc.playwrightHint && (
        <Collapsible title="Framework Hint">
          <pre className="bg-muted/40 border border-border/60 rounded px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto">{tc.playwrightHint}</pre>
        </Collapsible>
      )}
      {tc.developerHints && (
        <p className="text-[11px] text-muted-foreground italic border-t border-border/40 pt-2">
          <span className="font-semibold">Developer hints:</span> {tc.developerHints}
        </p>
      )}

      {/* ─── v2 placeholder: Execution history ─── */}
      <div className="border-t border-dashed border-border pt-3 mt-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          <span className="font-semibold">Execution history</span>
          <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[9px] font-bold">V2</span>
          <span className="italic">— test runs, defect capture, AI + tester RCA land in Phase 2a.</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{title}</h5>
      <div>{children}</div>
    </section>
  );
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-md border border-border/60">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-semibold text-muted-foreground hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

function FileList({ files, icon, emptyLabel }: { files: PseudoFileRef[]; icon: 'code' | 'flask'; emptyLabel: string }) {
  if (files.length === 0) return <span className="text-muted-foreground">{emptyLabel}</span>;
  const Icon = icon === 'flask' ? FlaskConical : FileCode;
  return (
    <ul className="space-y-0.5">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-1.5 text-[11px]" title={f.path}>
          <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className={cn('font-mono truncate', f.isTestFile ? 'text-emerald-700' : 'text-primary')}>{f.basename}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── TC accordion header (pills strip) — shared between workbench + artifact view ─

export function TestCaseAccordionHeader({ tc }: { tc: BaTestCase }) {
  return (
    <div className="flex items-center gap-2 min-w-0 flex-wrap">
      <span className="font-mono text-xs font-semibold">{tc.testCaseId}</span>
      <span className="text-xs text-foreground truncate">{tc.title}</span>
      <span className={cn(
        'text-[9px] px-1 py-0.5 rounded font-bold shrink-0',
        tc.testKind === 'negative' ? 'bg-red-100 text-red-700' :
        tc.testKind === 'edge' ? 'bg-amber-100 text-amber-700' :
        'bg-green-100 text-green-700',
      )}>
        {tc.testKind.toUpperCase()}
      </span>
      <span className={cn(
        'text-[9px] px-1 py-0.5 rounded font-bold shrink-0',
        tc.scope === 'white_box' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
      )}>
        {tc.scope === 'white_box' ? 'WHITE' : 'BLACK'}
      </span>
      {tc.category && (
        <span className="text-[9px] bg-muted text-muted-foreground px-1 py-0.5 rounded">{tc.category}</span>
      )}
      {tc.owaspCategory && (
        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-mono">{tc.owaspCategory}</span>
      )}
      {tc.isIntegrationTest && (
        <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded">INT</span>
      )}
      <span className={cn(
        'text-[9px] px-1 py-0.5 rounded font-semibold shrink-0',
        tc.executionStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700' :
        tc.executionStatus === 'FAIL' ? 'bg-rose-100 text-rose-700' :
        tc.executionStatus === 'BLOCKED' ? 'bg-yellow-100 text-yellow-700' :
        tc.executionStatus === 'SKIPPED' ? 'bg-gray-100 text-gray-600' :
        'bg-slate-100 text-slate-500',
      )}>
        {tc.executionStatus === 'NOT_RUN' ? 'NOT RUN' : tc.executionStatus}
      </span>
    </div>
  );
}
