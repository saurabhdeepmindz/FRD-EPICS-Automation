'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  backfillSprints,
  createSprint,
  deleteSprint,
  getBaProject,
  listSprints,
  updateSprint,
  type BaProject,
  type BaSprint,
  type BaSprintStatus,
} from '@/lib/ba-api';
import { ArrowLeft, CalendarClock, Loader2, Plus, RefreshCw, Trash2, Edit3, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<BaSprintStatus, string> = {
  PLANNING: 'bg-sky-100 text-sky-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-gray-200 text-gray-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

export default function ProjectSprintsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [sprints, setSprints] = useState<BaSprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, list] = await Promise.all([getBaProject(projectId), listSprints(projectId)]);
      setProject(proj);
      setSprints(list);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleBackfill = useCallback(async () => {
    setBackfilling(true);
    try {
      const res = await backfillSprints(projectId);
      alert(
        res.created === 0
          ? `No legacy sprint strings needed backfilling (found ${res.found}, all already exist).`
          : `Created ${res.created} sprint(s) from ${res.found} legacy string(s). Edit them to add friendly names and dates.`,
      );
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  }, [projectId, load]);

  const handleDelete = useCallback(async (sprintId: string) => {
    if (!confirm('Delete this sprint? Only possible if no runs/TCs reference it.')) return;
    try {
      await deleteSprint(sprintId);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading sprints…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
              <CalendarClock className="h-4 w-4 text-primary" />
              <div>
                <h1 className="text-sm font-semibold">Sprints</h1>
                <p className="text-xs text-muted-foreground">{project?.name} — {project?.projectCode}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{sprints.length} sprint{sprints.length !== 1 ? 's' : ''}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBackfill}
              disabled={backfilling}
              title="Create sprints for any legacy free-text sprintId values not yet represented as entities"
            >
              {backfilling ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Backfill from legacy
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New sprint
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-3 max-w-5xl">
        {showCreate && (
          <SprintEditCard
            mode="create"
            projectId={projectId}
            onClose={() => setShowCreate(false)}
            onSaved={async () => {
              setShowCreate(false);
              await load();
            }}
          />
        )}

        {sprints.length === 0 && !showCreate ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No sprints yet. Click <strong>New sprint</strong> to create one, or <strong>Backfill from legacy</strong>
            to import any free-text sprintIds already typed in Record Run dialogs.
          </div>
        ) : (
          sprints.map((s) =>
            editingId === s.id ? (
              <SprintEditCard
                key={s.id}
                mode="edit"
                projectId={projectId}
                sprint={s}
                onClose={() => setEditingId(null)}
                onSaved={async () => {
                  setEditingId(null);
                  await load();
                }}
              />
            ) : (
              <SprintCard
                key={s.id}
                sprint={s}
                onEdit={() => setEditingId(s.id)}
                onDelete={() => handleDelete(s.id)}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

function SprintCard({
  sprint,
  onEdit,
  onDelete,
}: {
  sprint: BaSprint;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const totalRefs = (sprint.runCount ?? 0) + (sprint.legacyRunCount ?? 0);
  const canDelete = totalRefs === 0;
  const dateRange =
    sprint.startDate && sprint.endDate
      ? `${new Date(sprint.startDate).toLocaleDateString()} → ${new Date(sprint.endDate).toLocaleDateString()}`
      : sprint.startDate
        ? `from ${new Date(sprint.startDate).toLocaleDateString()}`
        : sprint.endDate
          ? `until ${new Date(sprint.endDate).toLocaleDateString()}`
          : 'No dates set';

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-primary text-sm font-semibold">{sprint.sprintCode}</span>
            <span className="text-sm text-foreground">— {sprint.name}</span>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', STATUS_TONE[sprint.status])}>
              {sprint.status}
            </span>
          </div>
          {sprint.goal && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{sprint.goal}</p>}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-2">
            <span>{dateRange}</span>
            <span>{sprint.runCount ?? 0} run{(sprint.runCount ?? 0) !== 1 ? 's' : ''}</span>
            {(sprint.legacyRunCount ?? 0) > 0 && (
              <span className="text-amber-700" title="Runs using free-text sprintId — not linked via FK yet">
                + {sprint.legacyRunCount} legacy
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-7">
            <Edit3 className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={!canDelete}
            className="h-7 text-rose-600 hover:text-rose-700 disabled:text-muted-foreground"
            title={canDelete ? 'Delete sprint' : `${totalRefs} reference(s) — cannot delete`}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function SprintEditCard({
  mode,
  projectId,
  sprint,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  projectId: string;
  sprint?: BaSprint;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [sprintCode, setSprintCode] = useState(sprint?.sprintCode ?? '');
  const [name, setName] = useState(sprint?.name ?? '');
  const [goal, setGoal] = useState(sprint?.goal ?? '');
  const [startDate, setStartDate] = useState(sprint?.startDate ? sprint.startDate.slice(0, 10) : '');
  const [endDate, setEndDate] = useState(sprint?.endDate ? sprint.endDate.slice(0, 10) : '');
  const [status, setStatus] = useState<BaSprintStatus>(sprint?.status ?? 'PLANNING');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!sprintCode.trim() || !name.trim()) {
      setError('Sprint code and name are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sprintCode: sprintCode.trim(),
        name: name.trim(),
        goal: goal.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        status,
      };
      if (mode === 'create') await createSprint(projectId, payload);
      else await updateSprint(sprint!.id, payload);
      await onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{mode === 'create' ? 'New sprint' : `Edit ${sprint?.sprintCode}`}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" disabled={submitting}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-semibold block mb-1">
              Code <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={sprintCode}
              onChange={(e) => setSprintCode(e.target.value)}
              placeholder="v2.3"
              className="w-full text-xs border border-input rounded px-2 py-1 bg-background font-mono"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold block mb-1">
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Checkout hardening"
              className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Goal (optional)</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="Close out all P0 defects from v2.2, ship checkout v2 behind feature flag…"
            className="w-full text-xs border border-input rounded px-2 py-1 bg-background resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-semibold block mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BaSprintStatus)}
              className="w-full text-xs border border-input rounded px-2 py-1 bg-background"
            >
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {error && <div className="text-xs text-rose-600 bg-rose-50 rounded p-2">{error}</div>}

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={submitting || !sprintCode.trim() || !name.trim()}>
            {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            {mode === 'create' ? 'Create sprint' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
