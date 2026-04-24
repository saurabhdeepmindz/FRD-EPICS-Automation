'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBaProject, getProjectRtm, type BaProject, type BaRtmRow } from '@/lib/ba-api';
import { ArrowLeft, Loader2, Download, Filter, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

export default function RtmViewerPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [rows, setRows] = useState<BaRtmRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterModule, setFilterModule] = useState('');
  const [filterEpic, setFilterEpic] = useState('');
  const [filterStoryType, setFilterStoryType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTbd, setFilterTbd] = useState<'' | 'yes' | 'no'>('');
  const [filterLayer, setFilterLayer] = useState('');
  const [filterTests, setFilterTests] = useState<'' | 'covered' | 'uncovered'>('');
  const [filterExec, setFilterExec] = useState<'' | 'PASS' | 'FAIL' | 'BLOCKED' | 'MIXED' | 'NOT_RUN'>('');
  const [filterOwasp, setFilterOwasp] = useState('');
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, rtm] = await Promise.all([getBaProject(projectId), getProjectRtm(projectId)]);
      setProject(proj);
      setRows(rtm);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Unique values for filter dropdowns
  const modules = useMemo(() => [...new Set(rows.map((r) => r.moduleId))].sort(), [rows]);
  const epics = useMemo(() => [...new Set(rows.filter((r) => r.epicId).map((r) => r.epicId!))].sort(), [rows]);
  const storyTypes = useMemo(() => [...new Set(rows.filter((r) => r.storyType).map((r) => r.storyType!))].sort(), [rows]);
  const layers = useMemo(() => [...new Set(rows.filter((r) => r.layer).map((r) => r.layer!))].sort(), [rows]);
  const owaspCategories = useMemo(
    () => [...new Set(rows.flatMap((r) => [...(r.owaspWebCategories ?? []), ...(r.owaspLlmCategories ?? [])]))].sort(),
    [rows],
  );

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterModule && r.moduleId !== filterModule) return false;
      if (filterEpic && r.epicId !== filterEpic) return false;
      if (filterStoryType && r.storyType !== filterStoryType) return false;
      if (filterStatus && r.featureStatus !== filterStatus) return false;
      if (filterTbd === 'yes' && !r.tbdFutureRef) return false;
      if (filterTbd === 'no' && r.tbdFutureRef) return false;
      if (filterLayer && r.layer !== filterLayer) return false;
      const tcCount = (r.ftcTestCaseRefs ?? []).length;
      if (filterTests === 'covered' && tcCount === 0) return false;
      if (filterTests === 'uncovered' && tcCount > 0) return false;
      if (filterExec && (r.execVerdict ?? 'NOT_RUN') !== filterExec) return false;
      if (filterOwasp) {
        const all = [...(r.owaspWebCategories ?? []), ...(r.owaspLlmCategories ?? [])];
        if (!all.includes(filterOwasp)) return false;
      }
      return true;
    });
  }, [rows, filterModule, filterEpic, filterStoryType, filterStatus, filterTbd, filterLayer, filterTests, filterExec, filterOwasp]);

  // CSV export
  const handleExportCsv = useCallback(() => {
    const headers = [
      'Module ID', 'Module Name', 'Package', 'Feature ID', 'Feature Name', 'Status', 'Priority',
      'Screen Ref', 'EPIC ID', 'EPIC Name', 'Story ID', 'Story Name', 'Story Type', 'Story Status',
      'Primary Class', 'Source File', 'SubTask ID', 'Team', 'Method', 'Test Cases',
      'Integration Status', 'TBD-Future Ref', 'Resolved',
      'Layer', 'LLD Source Files',
      'Test Cases', 'Exec Verdict', 'Pass', 'Fail', 'Blocked', 'Skipped', 'Not Run',
      'OWASP Web', 'OWASP LLM',
    ];
    const csvRows = filteredRows.map((r) => {
      const c = r.execCounts ?? { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0 };
      return [
        r.moduleId, r.moduleName, r.packageName, r.featureId, r.featureName, r.featureStatus, r.priority,
        r.screenRef, r.epicId ?? '', r.epicName ?? '', r.storyId ?? '', r.storyName ?? '', r.storyType ?? '', r.storyStatus ?? '',
        r.primaryClass ?? '', r.sourceFile ?? '', r.subtaskId ?? '', r.subtaskTeam ?? '', r.methodName ?? '',
        (r.testCaseIds ?? []).join('; '), r.integrationStatus ?? '', r.tbdFutureRef ?? '', r.tbdResolved ? 'Yes' : 'No',
        r.layer ?? '', (r.pseudoFilePaths ?? []).join('; '),
        (r.ftcTestCaseRefs ?? []).join('; '),
        r.execVerdict ?? 'NOT_RUN', c.PASS, c.FAIL, c.BLOCKED, c.SKIPPED, c.NOT_RUN,
        (r.owaspWebCategories ?? []).join('; '), (r.owaspLlmCategories ?? []).join('; '),
      ].map((v) => `"${v}"`).join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RTM-${project?.projectCode ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, project]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading RTM...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="rtm-viewer">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/ba-tool/project/${projectId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Project
              </Link>
            </Button>
            <div>
              <h1 className="text-sm font-semibold">Requirements Traceability Matrix</h1>
              <p className="text-xs text-muted-foreground">{project?.name} — {project?.projectCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filteredRows.length} of {rows.length} rows</span>
            <Button
              size="sm"
              variant="outline"
              disabled={backfilling}
              onClick={async () => {
                setBackfilling(true);
                try {
                  const { data } = await api.post(`/ba/projects/${projectId}/rtm/backfill`);
                  await load();
                  alert(`RTM populated: ${data?.seeded ?? 0} new rows, linked ${data?.epics ?? 0} EPICs / ${data?.stories ?? 0} Story artifacts / ${data?.subtasks ?? 0} SubTasks / ${data?.llds ?? 0} LLDs / ${data?.ftcs ?? 0} FTCs.`);
                } catch {
                  alert('Backfill failed. Ensure the backend is running and the project has generated artifacts.');
                } finally {
                  setBackfilling(false);
                }
              }}
              title="Populate RTM rows from existing FRD/EPIC/User Story/SubTask artifacts"
            >
              {backfilling ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Populate from Artifacts
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-3 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">All Modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterEpic} onChange={(e) => setFilterEpic(e.target.value)} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">All EPICs</option>
          {epics.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterStoryType} onChange={(e) => setFilterStoryType(e.target.value)} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">All Types</option>
          {storyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">All Statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CONFIRMED-PARTIAL">Confirmed-Partial</option>
          <option value="DRAFT">Draft</option>
        </select>
        <select value={filterTbd} onChange={(e) => setFilterTbd(e.target.value as '' | 'yes' | 'no')} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">TBD-Future: All</option>
          <option value="yes">Has TBD-Future</option>
          <option value="no">No TBD-Future</option>
        </select>
        <select value={filterLayer} onChange={(e) => setFilterLayer(e.target.value)} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">All Layers</option>
          {layers.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterTests} onChange={(e) => setFilterTests(e.target.value as '' | 'covered' | 'uncovered')} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">Tests: All</option>
          <option value="covered">Has test cases</option>
          <option value="uncovered">No test cases</option>
        </select>
        <select
          value={filterExec}
          onChange={(e) => setFilterExec(e.target.value as '' | 'PASS' | 'FAIL' | 'BLOCKED' | 'MIXED' | 'NOT_RUN')}
          className="text-xs border border-input rounded px-2 py-1 bg-background"
        >
          <option value="">Exec: All</option>
          <option value="PASS">Pass</option>
          <option value="FAIL">Fail</option>
          <option value="BLOCKED">Blocked</option>
          <option value="MIXED">Mixed</option>
          <option value="NOT_RUN">Not run</option>
        </select>
        <select value={filterOwasp} onChange={(e) => setFilterOwasp(e.target.value)} className="text-xs border border-input rounded px-2 py-1 bg-background">
          <option value="">All OWASP</option>
          {owaspCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterModule || filterEpic || filterStoryType || filterStatus || filterTbd || filterLayer || filterTests || filterExec || filterOwasp) && (
          <button
            onClick={() => { setFilterModule(''); setFilterEpic(''); setFilterStoryType(''); setFilterStatus(''); setFilterTbd(''); setFilterLayer(''); setFilterTests(''); setFilterExec(''); setFilterOwasp(''); }}
            className="text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1400px]">
          <thead className="sticky top-0 bg-muted z-10">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 border-b border-border font-semibold">Module</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Feature ID</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Feature Name</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Status</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Priority</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Screen</th>
              <th className="px-3 py-2 border-b border-border font-semibold">EPIC</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Story ID</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Type</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Class</th>
              <th className="px-3 py-2 border-b border-border font-semibold">SubTask</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Team</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Layer</th>
              <th className="px-3 py-2 border-b border-border font-semibold">LLD Source Files</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Test Cases</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Exec</th>
              <th className="px-3 py-2 border-b border-border font-semibold">OWASP</th>
              <th className="px-3 py-2 border-b border-border font-semibold">TBD-Future</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={18} className="px-3 py-12 text-center text-muted-foreground">
                  {rows.length === 0 ? 'No RTM data yet. Complete skill executions to populate.' : 'No rows match the current filters.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 border-b border-border/50">
                  <td className="px-3 py-1.5 font-mono">{row.moduleId}</td>
                  <td className="px-3 py-1.5 font-mono text-primary">{row.featureId}</td>
                  <td className="px-3 py-1.5 max-w-[150px] truncate">{row.featureName}</td>
                  <td className="px-3 py-1.5">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-medium',
                      row.featureStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                      row.featureStatus.includes('PARTIAL') ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600',
                    )}>{row.featureStatus}</span>
                  </td>
                  <td className="px-3 py-1.5">{row.priority}</td>
                  <td className="px-3 py-1.5 font-mono">{row.screenRef}</td>
                  <td className="px-3 py-1.5 font-mono">{row.epicId ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono">{row.storyId ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    {row.storyType && (
                      <span className={cn(
                        'px-1 py-0.5 rounded text-[8px] font-bold',
                        row.storyType === 'Frontend' ? 'bg-blue-100 text-blue-700' :
                        row.storyType === 'Backend' ? 'bg-purple-100 text-purple-700' :
                        row.storyType === 'Integration' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600',
                      )}>{row.storyType}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[10px]">{row.primaryClass ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono">{row.subtaskId ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    {row.subtaskTeam && (
                      <span className={cn(
                        'px-1 py-0.5 rounded text-[8px] font-bold',
                        row.subtaskTeam === 'FE' ? 'bg-blue-100 text-blue-700' :
                        row.subtaskTeam === 'BE' ? 'bg-purple-100 text-purple-700' :
                        row.subtaskTeam === 'QA' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700',
                      )}>{row.subtaskTeam}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {row.layer ? (
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-medium',
                        row.layer === 'Frontend' ? 'bg-blue-100 text-blue-700' :
                        row.layer === 'Backend' ? 'bg-purple-100 text-purple-700' :
                        row.layer === 'Database' ? 'bg-emerald-100 text-emerald-700' :
                        row.layer === 'Integration' ? 'bg-orange-100 text-orange-700' :
                        row.layer === 'Testing' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600',
                      )}>{row.layer}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-1.5 max-w-[260px]">
                    {row.pseudoFilePaths && row.pseudoFilePaths.length > 0 ? (
                      <div className="flex flex-col gap-0.5" title={row.pseudoFilePaths.join('\n')}>
                        {row.pseudoFilePaths.slice(0, 3).map((p, i) => (
                          <code key={i} className="text-[10px] font-mono text-muted-foreground truncate">{p.split('/').pop()}</code>
                        ))}
                        {row.pseudoFilePaths.length > 3 && (
                          <span className="text-[9px] text-muted-foreground/70">+{row.pseudoFilePaths.length - 3} more</span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-1.5 max-w-[200px]">
                    {row.ftcTestCaseRefs && row.ftcTestCaseRefs.length > 0 ? (
                      <div className="flex items-center gap-1" title={row.ftcTestCaseRefs.join('\n')}>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                          {row.ftcTestCaseRefs.length}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground truncate">
                          {row.ftcTestCaseRefs.slice(0, 2).join(', ')}
                          {row.ftcTestCaseRefs.length > 2 ? '…' : ''}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-600">— uncovered</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {(() => {
                      const v = row.execVerdict ?? 'NOT_RUN';
                      const counts = row.execCounts ?? { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0 };
                      const total = (row.ftcTestCaseRefs ?? []).length;
                      if (total === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
                      const cls =
                        v === 'PASS' ? 'bg-green-100 text-green-700' :
                        v === 'FAIL' ? 'bg-rose-100 text-rose-700' :
                        v === 'BLOCKED' ? 'bg-amber-100 text-amber-700' :
                        v === 'MIXED' ? 'bg-sky-100 text-sky-700' :
                        'bg-gray-100 text-gray-600';
                      const tooltip =
                        `PASS ${counts.PASS} · FAIL ${counts.FAIL} · BLOCKED ${counts.BLOCKED} · ` +
                        `SKIPPED ${counts.SKIPPED} · NOT_RUN ${counts.NOT_RUN} (of ${total})`;
                      return (
                        <span className={cn('inline-block px-1.5 py-0.5 rounded text-[9px] font-bold', cls)} title={tooltip}>
                          {v === 'NOT_RUN' ? '—' : v}
                          {v !== 'NOT_RUN' && ` ${counts.PASS}/${total}`}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-1.5">
                    {((row.owaspWebCategories?.length ?? 0) + (row.owaspLlmCategories?.length ?? 0)) > 0 ? (
                      <div className="flex flex-wrap gap-0.5">
                        {row.owaspWebCategories?.map((c) => (
                          <span key={c} className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-mono">{c}</span>
                        ))}
                        {row.owaspLlmCategories?.map((c) => (
                          <span key={c} className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-mono">{c}</span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    {row.tbdFutureRef ? (
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-medium',
                        row.tbdResolved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                      )}>
                        {row.tbdFutureRef} {row.tbdResolved ? '✓' : ''}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
