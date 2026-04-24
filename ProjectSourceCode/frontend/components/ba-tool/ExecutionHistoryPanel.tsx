'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SprintPicker } from './SprintPicker';
import {
  analyzeDefectWithAi,
  createDefectForTc,
  createTestRun,
  deleteTestRun,
  getDefect,
  listDefectsForTc,
  listTestRunsForTc,
  saveTesterRca,
  updateDefect,
  uploadDefectAttachments,
  deleteDefectAttachment,
  type BaDefect,
  type BaRcaRow,
  type BaTestRun,
  type CreateTestRunPayload,
  type DefectSeverity,
  type DefectStatus,
} from '@/lib/ba-api';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Clock,
  Download,
  Loader2,
  Paperclip,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { MicButton } from '@/components/forms/MicButton';

/**
 * Phase 2a UI. Replaces the previous "Execution history (V2)" placeholder in
 * TestCaseBody. One panel per test case covering:
 *   - run history (soft-deletable)
 *   - record-a-run modal (PASS / FAIL / BLOCKED / SKIPPED + optional defect)
 *   - per-defect card with attachments + AI-vs-tester RCA dual track
 */

interface Props {
  testCaseId: string;
  testCaseRef: string;   // human TC id like "TC-001" — for dialog titles
}

const STATUS_CHOICES: Array<{ value: BaTestRun['status']; label: string; color: string; icon: typeof CheckCircle2 }> = [
  { value: 'PASS',    label: 'Pass',    color: 'bg-emerald-100 text-emerald-700',  icon: CheckCircle2 },
  { value: 'FAIL',    label: 'Fail',    color: 'bg-rose-100 text-rose-700',        icon: XCircle },
  { value: 'BLOCKED', label: 'Blocked', color: 'bg-yellow-100 text-yellow-700',    icon: AlertTriangle },
  { value: 'SKIPPED', label: 'Skipped', color: 'bg-gray-100 text-gray-600',        icon: CircleSlash },
];

export function ExecutionHistoryPanel({ testCaseId, testCaseRef }: Props) {
  const [runs, setRuns] = useState<BaTestRun[]>([]);
  const [defects, setDefects] = useState<BaDefect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [showDefectDialog, setShowDefectDialog] = useState(false);
  const [openDefectId, setOpenDefectId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        listTestRunsForTc(testCaseId),
        listDefectsForTc(testCaseId),
      ]);
      setRuns(r);
      setDefects(d);
    } catch {
      // leave existing state
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRunRecorded = useCallback(async (_: { defectId: string | null }) => {
    setShowRunDialog(false);
    await refresh();
  }, [refresh]);

  const handleDeleteRun = useCallback(async (runId: string) => {
    if (!confirm('Soft-delete this run? It can be un-deleted from the database if needed.')) return;
    try {
      await deleteTestRun(runId);
      await refresh();
    } catch {
      alert('Delete failed.');
    }
  }, [refresh]);

  return (
    <section className="rounded-lg border border-border bg-muted/10">
      <header className="flex items-center justify-between gap-2 p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Execution history</h4>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground">
                {runs.length} run{runs.length !== 1 ? 's' : ''}
              </span>
              {defects.length > 0 && (
                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-medium">
                  {defects.length} defect{defects.length !== 1 ? 's' : ''}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDefectDialog(true)}
            className="h-7"
            title="Log a bug discovered outside a formal run (spec review, prod report, ad-hoc exploration)"
          >
            <Bug className="h-3 w-3 mr-1" />
            Open defect
          </Button>
          <Button size="sm" onClick={() => setShowRunDialog(true)} className="h-7">
            <Play className="h-3 w-3 mr-1" />
            Record run
          </Button>
        </div>
      </header>

      {showRunDialog && (
        <RecordRunDialog
          testCaseId={testCaseId}
          testCaseRef={testCaseRef}
          onClose={() => setShowRunDialog(false)}
          onSaved={handleRunRecorded}
        />
      )}

      {showDefectDialog && (
        <OpenDefectDialog
          testCaseId={testCaseId}
          testCaseRef={testCaseRef}
          onClose={() => setShowDefectDialog(false)}
          onSaved={async () => {
            setShowDefectDialog(false);
            await refresh();
          }}
        />
      )}

      {!loading && runs.length === 0 && (
        <div className="p-4 text-xs text-muted-foreground italic">
          No runs recorded yet. Click <strong>Record run</strong> to mark this test as Pass / Fail / Blocked / Skipped.
        </div>
      )}

      {runs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-semibold">#</th>
                <th className="px-2 py-1.5 font-semibold">Date</th>
                <th className="px-2 py-1.5 font-semibold">Status</th>
                <th className="px-2 py-1.5 font-semibold">Executor</th>
                <th className="px-2 py-1.5 font-semibold">Env</th>
                <th className="px-2 py-1.5 font-semibold">Sprint</th>
                <th className="px-2 py-1.5 font-semibold text-right">Dur</th>
                <th className="px-2 py-1.5 font-semibold">Defects</th>
                <th className="px-2 py-1.5 font-semibold">Notes</th>
                <th className="px-2 py-1.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, idx) => (
                <RunRow
                  key={run.id}
                  run={run}
                  runNumber={runs.length - idx}
                  onDelete={() => handleDeleteRun(run.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {defects.length > 0 && (
        <div className="border-t border-border p-3 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Defects raised on this test case
          </p>
          {defects.map((d) => (
            <DefectCard
              key={d.id}
              defectSummary={d}
              expanded={openDefectId === d.id}
              onToggle={() => setOpenDefectId(openDefectId === d.id ? null : d.id)}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RunRow({
  run,
  runNumber,
  onDelete,
}: {
  run: BaTestRun;
  runNumber: number;
  onDelete: () => void;
}) {
  const choice = STATUS_CHOICES.find((c) => c.value === run.status)!;
  const Icon = choice.icon;
  const executedAt = new Date(run.executedAt);
  // Short date format (Apr 23 21:15) — full ISO on hover.
  const dateShort = executedAt.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const dateFull = executedAt.toLocaleString();
  const notesPreview = (run.notes ?? '').trim();
  const notesShort = notesPreview.length > 80 ? notesPreview.slice(0, 80) + '…' : notesPreview;

  return (
    <tr className="border-t border-border/50 hover:bg-muted/10 align-top">
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">#{runNumber}</td>
      <td className="px-2 py-1.5 whitespace-nowrap" title={dateFull}>{dateShort}</td>
      <td className="px-2 py-1.5">
        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold', choice.color)}>
          <Icon className="h-3 w-3" /> {choice.label.toUpperCase()}
        </span>
      </td>
      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{run.executor ?? '—'}</td>
      <td className="px-2 py-1.5 font-mono text-[11px]">{run.environment ?? '—'}</td>
      <td className="px-2 py-1.5 font-mono text-[11px]">{run.sprintId ?? '—'}</td>
      <td className="px-2 py-1.5 text-right text-muted-foreground whitespace-nowrap">
        {typeof run.durationSec === 'number' ? `${run.durationSec}s` : '—'}
      </td>
      <td className="px-2 py-1.5">
        {run.defects && run.defects.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            <Bug className="h-3 w-3 text-rose-600 shrink-0" />
            {run.defects.map((d) => (
              <span
                key={d.id}
                title={`${d.title}${d.externalRef ? '\n' + d.externalRef : ''}`}
                className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono text-[10px]"
              >
                {d.severity}·{d.status.replace('_', ' ')}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 max-w-[280px]" title={notesPreview}>
        {notesShort ? (
          <span className="text-foreground">{notesShort}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-right">
        <button onClick={onDelete} className="text-muted-foreground hover:text-red-600" title="Soft-delete run">
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ─── Record Run Dialog ──────────────────────────────────────────────────────

function RecordRunDialog({
  testCaseId,
  testCaseRef,
  onClose,
  onSaved,
}: {
  testCaseId: string;
  testCaseRef: string;
  onClose: () => void;
  onSaved: (res: { defectId: string | null }) => void;
}) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? '';
  const [status, setStatus] = useState<BaTestRun['status']>('PASS');
  const [notes, setNotes] = useState('');
  const [executor, setExecutor] = useState('');
  const [durationSec, setDurationSec] = useState<string>('');
  const [environment, setEnvironment] = useState('staging');
  const [sprintDbId, setSprintDbId] = useState('');
  const [openDefect, setOpenDefect] = useState(false);
  const [defectTitle, setDefectTitle] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [defectSeverity, setDefectSeverity] = useState<DefectSeverity>('P2');
  const [defectExternalRef, setDefectExternalRef] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-enable defect form when status flips to FAIL
  useEffect(() => {
    if (status === 'FAIL' && !openDefect) setOpenDefect(true);
    if (status !== 'FAIL' && openDefect && !defectTitle.trim()) setOpenDefect(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleSubmit = useCallback(async () => {
    if (openDefect && !defectTitle.trim()) {
      alert('Defect title is required when opening a defect.');
      return;
    }
    setSaving(true);
    try {
      const dur = durationSec.trim() ? parseInt(durationSec, 10) : null;
      const payload: CreateTestRunPayload = {
        status,
        notes: notes || null,
        executor: executor || null,
        durationSec: dur && !isNaN(dur) ? dur : null,
        environment: environment || null,
        sprintDbId: sprintDbId || null,
        defect: openDefect ? {
          title: defectTitle.trim(),
          description: defectDescription || null,
          severity: defectSeverity,
          externalRef: defectExternalRef || null,
          reportedBy: executor || null,
        } : null,
      };
      const res = await createTestRun(testCaseId, payload);
      onSaved({ defectId: res.defectId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      alert(`Record run failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [testCaseId, status, notes, executor, durationSec, environment, sprintDbId, openDefect, defectTitle, defectDescription, defectSeverity, defectExternalRef, onSaved]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Record execution — {testCaseRef}</h3>
            <p className="text-[11px] text-muted-foreground">Capture PASS / FAIL / BLOCKED / SKIPPED + optional defect.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-4 w-4" />
          </button>
        </header>

        <div className="p-4 space-y-4 text-sm">
          {/* Status radio */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">Status</label>
            <div className="grid grid-cols-4 gap-2">
              {STATUS_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => setStatus(choice.value)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition',
                    status === choice.value
                      ? `${choice.color} border-current`
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/30',
                  )}
                >
                  <choice.icon className="h-3.5 w-3.5" />
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Executor</label>
              <input
                value={executor}
                onChange={(e) => setExecutor(e.target.value)}
                placeholder="your name / email"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Duration (s)</label>
              <input
                type="number"
                min={0}
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                placeholder="optional"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Environment</label>
              <input
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                placeholder="staging / prod / uat"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              {projectId ? (
                <SprintPicker
                  projectId={projectId}
                  value={sprintDbId}
                  onChange={setSprintDbId}
                  label="Sprint"
                />
              ) : (
                <div className="text-[10px] text-muted-foreground italic">Sprint picker unavailable (no project context)</div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the next tester should know — observed behaviour, screenshots saved elsewhere, etc."
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>

          {/* Defect sub-form */}
          <div className="border-t border-border pt-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={openDefect}
                onChange={(e) => setOpenDefect(e.target.checked)}
              />
              <span className="font-semibold">Open a defect from this run</span>
              {status === 'FAIL' && <span className="text-[10px] text-rose-600">(recommended for FAIL)</span>}
            </label>
            {openDefect && (
              <div className="mt-2 space-y-2 pl-5">
                <div>
                  <label className="text-xs font-medium mb-1 block">Title *</label>
                  <input
                    value={defectTitle}
                    onChange={(e) => setDefectTitle(e.target.value)}
                    placeholder="Short summary — gets synced to JIRA / Linear title"
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Description</label>
                  <textarea
                    value={defectDescription}
                    onChange={(e) => setDefectDescription(e.target.value)}
                    rows={2}
                    placeholder="What went wrong — we'll send this to AI RCA if you ask for one."
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Severity</label>
                    <select
                      value={defectSeverity}
                      onChange={(e) => setDefectSeverity(e.target.value as DefectSeverity)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="P0">P0 — Critical / blocker</option>
                      <option value="P1">P1 — Major</option>
                      <option value="P2">P2 — Moderate</option>
                      <option value="P3">P3 — Minor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">External tracker URL</label>
                    <input
                      value={defectExternalRef}
                      onChange={(e) => setDefectExternalRef(e.target.value)}
                      placeholder="https://jira.company/browse/…"
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
            Save run
          </Button>
        </footer>
      </div>
    </div>
  );
}

// ─── Defect Card ───────────────────────────────────────────────────────────

function DefectCard({
  defectSummary,
  expanded,
  onToggle,
  onChanged,
}: {
  defectSummary: BaDefect;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<BaDefect | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await getDefect(defectSummary.id);
        if (!cancelled) setDetail(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [expanded, defectSummary.id]);

  const severityColor = {
    P0: 'bg-rose-100 text-rose-800 border-rose-300',
    P1: 'bg-orange-100 text-orange-800 border-orange-300',
    P2: 'bg-amber-100 text-amber-800 border-amber-300',
    P3: 'bg-slate-100 text-slate-600 border-slate-300',
  }[defectSummary.severity] ?? 'bg-slate-100 text-slate-600 border-slate-300';

  const statusColor = {
    OPEN:        'bg-rose-100 text-rose-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    FIXED:       'bg-emerald-100 text-emerald-700',
    VERIFIED:    'bg-green-100 text-green-700',
    CLOSED:      'bg-slate-100 text-slate-600',
    WONT_FIX:    'bg-gray-100 text-gray-500',
  }[defectSummary.status] ?? 'bg-slate-100 text-slate-600';

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Bug className="h-3.5 w-3.5 text-rose-600 shrink-0" />
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-bold', severityColor)}>
            {defectSummary.severity}
          </span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', statusColor)}>
            {defectSummary.status.replace('_', ' ')}
          </span>
          <span className="text-xs font-semibold truncate">{defectSummary.title}</span>
          {defectSummary.externalRef && (
            <a
              href={defectSummary.externalRef}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-primary hover:underline"
            >
              tracker ↗
            </a>
          )}
        </div>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/5">
          {loading && <p className="text-xs text-muted-foreground">Loading defect…</p>}
          {detail && !loading && (
            <DefectExpanded defect={detail} onChanged={() => { onChanged(); /* refetch detail too */ getDefect(defectSummary.id).then(setDetail).catch(() => {}); }} />
          )}
        </div>
      )}
    </div>
  );
}

function DefectExpanded({ defect, onChanged }: { defect: BaDefect; onChanged: () => void }) {
  const [draftStatus, setDraftStatus] = useState<DefectStatus>(defect.status);
  const [draftSeverity, setDraftSeverity] = useState<DefectSeverity>(defect.severity);
  const [draftDescription, setDraftDescription] = useState(defect.description ?? '');
  const [draftRepro, setDraftRepro] = useState(defect.reproductionSteps ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftStatus(defect.status);
    setDraftSeverity(defect.severity);
    setDraftDescription(defect.description ?? '');
    setDraftRepro(defect.reproductionSteps ?? '');
  }, [defect.id, defect.status, defect.severity, defect.description, defect.reproductionSteps]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateDefect(defect.id, {
        status: draftStatus,
        severity: draftSeverity,
        description: draftDescription || null,
        reproductionSteps: draftRepro || null,
      });
      onChanged();
    } catch {
      alert('Save failed.');
    } finally {
      setSaving(false);
    }
  }, [defect.id, draftStatus, draftSeverity, draftDescription, draftRepro, onChanged]);

  return (
    <div className="space-y-3">
      {/* Status + severity quick-edit row */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="block">
          <span className="text-muted-foreground font-semibold">Status</span>
          <select
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value as DefectStatus)}
            className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {(['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED', 'WONT_FIX'] as const).map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground font-semibold">Severity</span>
          <select
            value={draftSeverity}
            onChange={(e) => setDraftSeverity(e.target.value as DefectSeverity)}
            className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {(['P0', 'P1', 'P2', 'P3'] as const).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs">
        <span className="text-muted-foreground font-semibold">Description</span>
        <textarea
          value={draftDescription}
          onChange={(e) => setDraftDescription(e.target.value)}
          rows={2}
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1"
        />
      </label>

      <label className="block text-xs">
        <span className="text-muted-foreground font-semibold">Reproduction steps</span>
        <textarea
          value={draftRepro}
          onChange={(e) => setDraftRepro(e.target.value)}
          rows={2}
          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1"
        />
      </label>

      <div className="flex items-center justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
          Save changes
        </Button>
      </div>

      <DefectAttachments defect={defect} onChanged={onChanged} />
      <RcaDualTrackPanel defect={defect} onChanged={onChanged} />
    </div>
  );
}

// ─── Defect attachments sub-component ──────────────────────────────────────

function DefectAttachments({ defect, onChanged }: { defect: BaDefect; onChanged: () => void }) {
  const [uploading, setUploading] = useState(false);
  const totalBytes = (defect.attachments ?? []).reduce((s, a) => s + a.sizeBytes, 0);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await uploadDefectAttachments(defect.id, Array.from(files));
      onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'upload failed';
      alert(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteDefectAttachment(defect.id, id);
      onChanged();
    } catch {
      alert('Delete failed.');
    }
  };

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Paperclip className="h-3 w-3" />
          Evidence ({(defect.attachments ?? []).length})
          {totalBytes > 0 && (
            <span className="text-[10px] text-muted-foreground font-normal">
              · {(totalBytes / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
        <label className="text-[11px] text-primary cursor-pointer hover:underline">
          {uploading ? 'Uploading…' : '+ Add files'}
          <input
            type="file"
            multiple
            accept=".md,.txt,.pdf,.docx,.png,.jpg,.jpeg,.log,.har"
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
        </label>
      </div>
      {(defect.attachments ?? []).length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">No evidence yet. Attach screenshots / logs / HAR files.</p>
      ) : (
        <ul className="space-y-0.5">
          {(defect.attachments ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-[11px] border border-border/60 rounded px-2 py-1 bg-card">
              <div className="flex items-center gap-2 min-w-0">
                <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-mono truncate">{a.fileName}</span>
                <span className="text-[9px] text-muted-foreground">{(a.sizeBytes / 1024).toFixed(1)} KB</span>
                {a.extractionNote && <span title={a.extractionNote} className="text-amber-600"><AlertTriangle className="h-3 w-3" /></span>}
              </div>
              <button onClick={() => onDelete(a.id)} className="text-muted-foreground hover:text-red-600" title="Delete">
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── RCA dual-track sub-component ──────────────────────────────────────────

function RcaDualTrackPanel({ defect, onChanged }: { defect: BaDefect; onChanged: () => void }) {
  const rcas = defect.rcas ?? [];
  const latestAi = [...rcas].reverse().find((r) => r.source === 'AI') ?? null;
  const latestTester = [...rcas].reverse().find((r) => r.source === 'TESTER') ?? null;

  const [analyzing, setAnalyzing] = useState(false);
  const [testerRoot, setTesterRoot] = useState(latestTester?.rootCause ?? '');
  const [testerFix, setTesterFix] = useState(latestTester?.proposedFix ?? '');
  const [testerFactors, setTesterFactors] = useState((latestTester?.contributingFactors ?? []).join('\n'));
  const [savingTester, setSavingTester] = useState(false);

  useEffect(() => {
    setTesterRoot(latestTester?.rootCause ?? '');
    setTesterFix(latestTester?.proposedFix ?? '');
    setTesterFactors((latestTester?.contributingFactors ?? []).join('\n'));
  }, [latestTester?.id]);

  const runAi = async () => {
    setAnalyzing(true);
    try {
      await analyzeDefectWithAi(defect.id);
      onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      alert(`AI RCA failed: ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveTester = async () => {
    if (!testerRoot.trim()) {
      alert('Tester root-cause is required.');
      return;
    }
    setSavingTester(true);
    try {
      await saveTesterRca(defect.id, {
        rootCause: testerRoot,
        contributingFactors: testerFactors.split('\n').map((s) => s.trim()).filter(Boolean),
        proposedFix: testerFix || null,
      });
      onChanged();
    } catch {
      alert('Save tester RCA failed.');
    } finally {
      setSavingTester(false);
    }
  };

  const adoptAi = () => {
    if (!latestAi) return;
    setTesterRoot(latestAi.rootCause);
    setTesterFix(latestAi.proposedFix ?? '');
    setTesterFactors(latestAi.contributingFactors.join('\n'));
  };

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-semibold flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Root Cause Analysis
        </h5>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{rcas.length} revision{rcas.length !== 1 ? 's' : ''}</span>
          <Button size="sm" variant="outline" onClick={runAi} disabled={analyzing} className="h-7">
            {analyzing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            {latestAi ? 'Re-analyze with AI' : 'Analyze with AI'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* AI RCA */}
        <div className="rounded-md border border-blue-200 bg-blue-50/40 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI
            </span>
            {latestAi && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {typeof latestAi.confidence === 'number' && (
                  <span title="AI confidence">conf {(latestAi.confidence * 100).toFixed(0)}%</span>
                )}
                {latestAi.createdBy && <span>{latestAi.createdBy}</span>}
                {latestAi && (
                  <Button size="sm" variant="ghost" onClick={adoptAi} className="h-6 px-2 text-[10px]">
                    Adopt →
                  </Button>
                )}
              </div>
            )}
          </div>
          {latestAi ? (
            <div className="text-xs space-y-1.5">
              <p><span className="font-semibold">Root cause:</span> {latestAi.rootCause}</p>
              {latestAi.proposedFix && <p><span className="font-semibold">Proposed fix:</span> {latestAi.proposedFix}</p>}
              {latestAi.contributingFactors.length > 0 && (
                <ul className="list-disc pl-4 text-muted-foreground">
                  {latestAi.contributingFactors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">No AI RCA yet. Click "Analyze with AI".</p>
          )}
        </div>

        {/* Tester RCA */}
        <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <UserIcon className="h-3 w-3 text-emerald-700" />
            <span className="text-[11px] font-semibold text-emerald-700">Tester</span>
          </div>
          <div className="space-y-2">
            <label className="block text-xs">
              <span className="text-muted-foreground font-semibold">Root cause</span>
              <div className="flex items-start gap-1 mt-0.5">
                <textarea
                  value={testerRoot}
                  onChange={(e) => setTesterRoot(e.target.value)}
                  rows={2}
                  placeholder="Your diagnosis (can differ from AI)…"
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1"
                />
                <MicButton onTranscribed={(t) => setTesterRoot((p) => p ? `${p} ${t}` : t)} />
              </div>
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground font-semibold">Contributing factors (one per line)</span>
              <textarea
                value={testerFactors}
                onChange={(e) => setTesterFactors(e.target.value)}
                rows={2}
                className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground font-semibold">Proposed fix</span>
              <textarea
                value={testerFix}
                onChange={(e) => setTesterFix(e.target.value)}
                rows={2}
                className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1"
              />
            </label>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveTester} disabled={savingTester} className="h-7">
                {savingTester ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Save tester RCA
              </Button>
            </div>
          </div>
        </div>
      </div>

      {rcas.length > 2 && (
        <details className="mt-2">
          <summary className="text-[10px] text-muted-foreground cursor-pointer">Show RCA history ({rcas.length} entries)</summary>
          <ul className="mt-1 space-y-1 text-[11px]">
            {rcas.slice().reverse().map((r) => (
              <li key={r.id} className="border-l-2 border-border pl-2">
                <span className={cn('font-semibold', r.source === 'AI' ? 'text-blue-700' : 'text-emerald-700')}>
                  {r.source}
                </span>{' '}
                <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                <div className="text-foreground">{r.rootCause}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── Open Defect Dialog (standalone, no run required) ──────────────────────

interface OpenDefectDialogProps {
  testCaseId: string;
  testCaseRef: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function OpenDefectDialog({ testCaseId, testCaseRef, onClose, onSaved }: OpenDefectDialogProps) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<DefectSeverity>('P2');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [environment, setEnvironment] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createDefectForTc(testCaseId, {
        title: title.trim(),
        severity,
        description: description.trim() || null,
        reproductionSteps: reproductionSteps.trim() || null,
        externalRef: externalRef.trim() || null,
        environment: environment.trim() || null,
        reportedBy: reportedBy.trim() || null,
      });
      await onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-lg border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-semibold">Open defect against {testCaseRef}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
            Logs a bug without a triggering run. Use this for issues found during spec review,
            prod reports, or ad-hoc exploration. For bugs discovered during a formal run,
            use <strong>Record run</strong> with status = FAIL instead.
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">
              Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Login button disabled when email contains '+' character"
              className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold block mb-1">Severity</label>
              <div className="flex gap-1">
                {(['P0', 'P1', 'P2', 'P3'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={cn(
                      'flex-1 px-2 py-1 rounded text-xs font-bold border',
                      severity === s
                        ? s === 'P0' ? 'bg-rose-600 text-white border-rose-600' :
                          s === 'P1' ? 'bg-amber-500 text-white border-amber-500' :
                          s === 'P2' ? 'bg-sky-500 text-white border-sky-500' :
                          'bg-gray-400 text-white border-gray-400'
                        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">External ref (optional)</label>
              <input
                type="text"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                placeholder="JIRA-1234"
                className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold block mb-1">Environment (optional)</label>
              <input
                type="text"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                placeholder="dev / stage / prod"
                className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Reported by (optional)</label>
              <input
                type="text"
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                placeholder="Your name"
                className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's broken, expected vs actual behaviour…"
              className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Reproduction steps (optional)</label>
            <textarea
              value={reproductionSteps}
              onChange={(e) => setReproductionSteps(e.target.value)}
              rows={3}
              placeholder="1. Navigate to /login&#10;2. Enter email: user+qa@foo.com&#10;3. Observe button stays disabled"
              className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background resize-none font-mono"
            />
          </div>

          {error && <div className="text-xs text-rose-600 bg-rose-50 rounded p-2">{error}</div>}
        </div>
        <div className="p-4 border-t border-border flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bug className="h-3 w-3 mr-1" />}
            Open defect
          </Button>
        </div>
      </div>
    </div>
  );
}
