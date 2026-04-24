'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  getBaProject,
  listDefectsForProject,
  listSprints,
  type BaProject,
  type BaProjectDefect,
  type BaSprint,
  type DefectSeverity,
  type DefectStatus,
} from '@/lib/ba-api';
import { ArrowLeft, Download, Filter, Loader2, Bug, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_TONE: Record<DefectSeverity, string> = {
  P0: 'bg-rose-600 text-white',
  P1: 'bg-amber-500 text-white',
  P2: 'bg-sky-500 text-white',
  P3: 'bg-gray-400 text-white',
};

const STATUS_TONE: Record<DefectStatus, string> = {
  OPEN: 'bg-rose-100 text-rose-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  FIXED: 'bg-emerald-100 text-emerald-700',
  VERIFIED: 'bg-emerald-200 text-emerald-800',
  CLOSED: 'bg-gray-200 text-gray-700',
  WONT_FIX: 'bg-gray-200 text-gray-700',
};

const OPEN_STATUSES: DefectStatus[] = ['OPEN', 'IN_PROGRESS'];

export default function ProjectDefectListPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [defects, setDefects] = useState<BaProjectDefect[]>([]);
  const [sprints, setSprints] = useState<BaSprint[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<'' | DefectStatus | 'OPEN_ALL'>('');
  const [filterSeverity, setFilterSeverity] = useState<'' | DefectSeverity>('');
  const [filterSprint, setFilterSprint] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, list, sp] = await Promise.all([
        getBaProject(projectId),
        listDefectsForProject(projectId),
        listSprints(projectId).catch(() => [] as BaSprint[]),
      ]);
      setProject(proj);
      setDefects(list);
      setSprints(sp);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // B4: Effective sprint FK first, then code string. Keeps filter canonical
  // when a BaSprint exists; falls back to the legacy free-text code for
  // pre-B1 data.
  const effectiveSprintDbId = useCallback((d: BaProjectDefect): string | null => {
    return d.testCase.sprintDbId ?? d.firstSeenRun?.sprintDbId ?? null;
  }, []);
  const effectiveSprintCode = useCallback((d: BaProjectDefect): string | null => {
    return (
      d.testCase.sprint?.sprintCode ??
      d.firstSeenRun?.sprint?.sprintCode ??
      d.testCase.sprintId ??
      d.firstSeenRun?.sprintId ??
      null
    );
  }, []);

  // Orphan codes: appear in data but not represented by any BaSprint row.
  const knownSprintCodes = useMemo(() => new Set(sprints.map((s) => s.sprintCode)), [sprints]);
  const orphanSprintCodes = useMemo(
    () => [
      ...new Set(
        defects
          .filter((d) => !effectiveSprintDbId(d))
          .map((d) => effectiveSprintCode(d))
          .filter((c): c is string => Boolean(c) && !knownSprintCodes.has(c as string)),
      ),
    ].sort(),
    [defects, knownSprintCodes, effectiveSprintDbId, effectiveSprintCode],
  );
  const moduleOptions = useMemo(
    () => [...new Map(defects.map((d) => [d.testCase.artifact.module.moduleId, d.testCase.artifact.module])).values()]
      .sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
    [defects],
  );
  const assigneeOptions = useMemo(
    () => [...new Set(defects.map((d) => d.reportedBy).filter((s): s is string => Boolean(s)))].sort(),
    [defects],
  );

  const filtered = useMemo(() => {
    return defects.filter((d) => {
      if (filterStatus === 'OPEN_ALL') {
        if (!OPEN_STATUSES.includes(d.status)) return false;
      } else if (filterStatus && d.status !== filterStatus) {
        return false;
      }
      if (filterSeverity && d.severity !== filterSeverity) return false;
      if (filterSprint) {
        if (filterSprint.startsWith('legacy:')) {
          const code = filterSprint.slice('legacy:'.length);
          if (effectiveSprintDbId(d)) return false;
          if (effectiveSprintCode(d) !== code) return false;
        } else {
          if (effectiveSprintDbId(d) !== filterSprint) return false;
        }
      }
      if (filterModule && d.testCase.artifact.module.moduleId !== filterModule) return false;
      if (filterAssignee && d.reportedBy !== filterAssignee) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          d.title,
          d.description ?? '',
          d.externalRef ?? '',
          d.testCase.testCaseId,
          d.testCase.title,
          d.testCase.artifact.module.moduleName,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [defects, filterStatus, filterSeverity, filterSprint, filterModule, filterAssignee, search, effectiveSprintDbId, effectiveSprintCode]);

  // Summary pills
  const counts = useMemo(() => {
    const out = { total: filtered.length, open: 0, p0: 0, p1: 0 };
    for (const d of filtered) {
      if (OPEN_STATUSES.includes(d.status)) out.open += 1;
      if (d.severity === 'P0' && OPEN_STATUSES.includes(d.status)) out.p0 += 1;
      if (d.severity === 'P1' && OPEN_STATUSES.includes(d.status)) out.p1 += 1;
    }
    return out;
  }, [filtered]);

  const handleExportCsv = useCallback(() => {
    const headers = [
      'Defect ID', 'External Ref', 'Title', 'Severity', 'Status', 'Sprint', 'Environment',
      'Reported By', 'Reported At', 'Closed At',
      'Test Case ID', 'Test Case Title', 'Module ID', 'Module Name', 'Has Triggering Run',
    ];
    const rows = filtered.map((d) => [
      d.id.slice(0, 8),
      d.externalRef ?? '',
      d.title,
      d.severity,
      d.status,
      effectiveSprintCode(d) ?? '',
      d.environment ?? d.firstSeenRun?.environment ?? '',
      d.reportedBy ?? '',
      d.reportedAt,
      d.closedAt ?? '',
      d.testCase.testCaseId,
      d.testCase.title,
      d.testCase.artifact.module.moduleId,
      d.testCase.artifact.module.moduleName,
      d.firstSeenRunId ? 'Yes' : 'No',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defects-${project?.projectCode ?? 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, project, effectiveSprintCode]);

  const clearFilters = useCallback(() => {
    setFilterStatus('');
    setFilterSeverity('');
    setFilterSprint('');
    setFilterModule('');
    setFilterAssignee('');
    setSearch('');
  }, []);

  const hasAnyFilter = filterStatus || filterSeverity || filterSprint || filterModule || filterAssignee || search;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading defects…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="defect-list">
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/ba-tool/project/${projectId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Project
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-rose-600" />
              <div>
                <h1 className="text-sm font-semibold">Defects</h1>
                <p className="text-xs text-muted-foreground">{project?.name} — {project?.projectCode}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <SummaryPill icon={Bug} label="total" value={counts.total} tone="bg-muted text-foreground" />
            <SummaryPill icon={AlertTriangle} label="open" value={counts.open} tone="bg-rose-100 text-rose-700" />
            {counts.p0 > 0 && <SummaryPill icon={AlertTriangle} label="P0 open" value={counts.p0} tone="bg-rose-600 text-white" />}
            {counts.p1 > 0 && <SummaryPill icon={AlertTriangle} label="P1 open" value={counts.p1} tone="bg-amber-500 text-white" />}
            <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-3 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search title, description, TC, module…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-input rounded px-2 py-1 bg-background w-64"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="text-xs border border-input rounded px-2 py-1 bg-background"
        >
          <option value="">All Statuses</option>
          <option value="OPEN_ALL">Open (Open + In Progress)</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="FIXED">Fixed</option>
          <option value="VERIFIED">Verified</option>
          <option value="CLOSED">Closed</option>
          <option value="WONT_FIX">Won&apos;t Fix</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as '' | DefectSeverity)}
          className="text-xs border border-input rounded px-2 py-1 bg-background"
        >
          <option value="">All Severities</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>
        <select
          value={filterSprint}
          onChange={(e) => setFilterSprint(e.target.value)}
          className="text-xs border border-input rounded px-2 py-1 bg-background"
        >
          <option value="">All Sprints</option>
          {sprints
            .slice()
            .sort((a, b) => {
              const order = { ACTIVE: 0, PLANNING: 1, COMPLETED: 2, CANCELLED: 3 } as const;
              return order[a.status] - order[b.status] || a.sprintCode.localeCompare(b.sprintCode);
            })
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.sprintCode} — {s.name} [{s.status}]
              </option>
            ))}
          {orphanSprintCodes.length > 0 && (
            <optgroup label="— legacy (free-text) —">
              {orphanSprintCodes.map((code) => (
                <option key={`legacy:${code}`} value={`legacy:${code}`}>
                  {code} (legacy)
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="text-xs border border-input rounded px-2 py-1 bg-background"
        >
          <option value="">All Modules</option>
          {moduleOptions.map((m) => <option key={m.moduleId} value={m.moduleId}>{m.moduleId} — {m.moduleName}</option>)}
        </select>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="text-xs border border-input rounded px-2 py-1 bg-background"
        >
          <option value="">All Reporters</option>
          {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {hasAnyFilter && (
          <button onClick={clearFilters} className="text-xs text-primary hover:underline">
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {defects.length} defects
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead className="sticky top-0 bg-muted z-10">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 border-b border-border font-semibold">Defect</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Title</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Sev</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Status</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Test Case</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Module</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Sprint</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Env</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Reported</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Evidence</th>
              <th className="px-3 py-2 border-b border-border font-semibold">Ext Ref</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">
                  {defects.length === 0
                    ? 'No defects raised yet. Open a defect from any test case\'s Execution History panel.'
                    : 'No defects match the current filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((d) => {
                const sprint = effectiveSprintCode(d);
                const env = d.environment ?? d.firstSeenRun?.environment ?? null;
                const reportedAt = new Date(d.reportedAt);
                const dateShort = reportedAt.toLocaleString(undefined, { month: 'short', day: 'numeric' });
                const dateFull = reportedAt.toLocaleString();
                const attachmentCount = d.attachments?.length ?? 0;
                const rcaCount = d.rcas?.length ?? 0;
                return (
                  <tr key={d.id} className="hover:bg-muted/30 border-b border-border/50 align-top">
                    <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                      #{d.id.slice(0, 8)}
                      {!d.firstSeenRunId && (
                        <span className="ml-1 inline-block bg-amber-100 text-amber-700 px-1 rounded text-[9px]" title="Opened without a triggering run">
                          direct
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 max-w-[320px]">
                      <Link
                        href={`/ba-tool/project/${projectId}/module/${d.testCase.artifact.module.id}`}
                        className="text-foreground hover:text-primary hover:underline"
                        title={d.description ?? d.title}
                      >
                        {d.title.length > 70 ? d.title.slice(0, 70) + '…' : d.title}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', SEVERITY_TONE[d.severity])}>
                        {d.severity}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap', STATUS_TONE[d.status])}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] max-w-[220px]">
                      <Link
                        href={`/ba-tool/project/${projectId}/module/${d.testCase.artifact.module.id}`}
                        className="text-primary hover:underline"
                        title={d.testCase.title}
                      >
                        {d.testCase.testCaseId}
                      </Link>
                      <div className="text-[10px] text-muted-foreground truncate">{d.testCase.title}</div>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] max-w-[160px] truncate" title={d.testCase.artifact.module.moduleName}>
                      {d.testCase.artifact.module.moduleId}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">{sprint ?? '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">{env ?? '—'}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" title={dateFull}>
                      <div>{dateShort}</div>
                      {d.reportedBy && <div className="text-[10px] text-muted-foreground">by {d.reportedBy}</div>}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground">
                      {attachmentCount > 0 && <div>{attachmentCount} 📎</div>}
                      {rcaCount > 0 && <div>{rcaCount} RCA</div>}
                      {attachmentCount === 0 && rcaCount === 0 && <span>—</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">
                      {d.externalRef ? (
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded" title={d.externalRef}>
                          {d.externalRef.length > 14 ? d.externalRef.slice(0, 14) + '…' : d.externalRef}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SummaryPillProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: string;
}

function SummaryPill({ icon: Icon, label, value, tone }: SummaryPillProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold', tone)}>
      <Icon className="h-3 w-3" /> {value} {label}
    </span>
  );
}
