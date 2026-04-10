'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  createBaFlow,
  updateBaFlow,
  deleteBaFlow,
  type BaFlow,
  type BaScreen,
} from '@/lib/ba-api';
import { Plus, Trash2, Loader2, ArrowDown, Route, Save } from 'lucide-react';

interface ClickThroughBuilderProps {
  moduleDbId: string;
  flows: BaFlow[];
  screens: BaScreen[];
  onFlowsChanged: () => void;
}

interface FlowStep {
  screenId: string;
  triggerLabel: string;
  outcome?: string;
}

export function ClickThroughBuilder({ moduleDbId, flows, screens, onFlowsChanged }: ClickThroughBuilderProps) {
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  return (
    <div className="space-y-4" data-testid="click-through-builder">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Navigation Flows</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define how screens connect. Select screens in sequence and describe what triggers each navigation.
          </p>
        </div>
      </div>

      {/* Existing flows */}
      {flows.map((flow) => (
        <FlowCard
          key={flow.id}
          flow={flow}
          screens={screens}
          isEditing={editingFlowId === flow.id}
          onEdit={() => setEditingFlowId(flow.id)}
          onCancel={() => setEditingFlowId(null)}
          onSaved={() => { setEditingFlowId(null); onFlowsChanged(); }}
          onDeleted={onFlowsChanged}
        />
      ))}

      {/* New flow creator */}
      <NewFlowCard
        moduleDbId={moduleDbId}
        screens={screens}
        onCreated={onFlowsChanged}
      />
    </div>
  );
}

// ─── Existing Flow Card ──────────────────────────────────────────────────────

function FlowCard({
  flow, screens, isEditing, onEdit, onCancel, onSaved, onDeleted,
}: {
  flow: BaFlow;
  screens: BaScreen[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [flowName, setFlowName] = useState(flow.flowName);
  const [steps, setSteps] = useState<FlowStep[]>(flow.steps);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateBaFlow(flow.id, { flowName, steps });
      onSaved();
    } catch {
      alert('Failed to update flow');
    } finally {
      setSaving(false);
    }
  }, [flow.id, flowName, steps, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this flow?')) return;
    setDeleting(true);
    try {
      await deleteBaFlow(flow.id);
      onDeleted();
    } catch {
      alert('Failed to delete flow');
    } finally {
      setDeleting(false);
    }
  }, [flow.id, onDeleted]);

  if (!isEditing) {
    // Read-only view
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{flow.flowName}</span>
            <span className="text-xs text-muted-foreground">({flow.steps.length} steps)</span>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          {flow.steps.map((step, idx) => {
            const scr = screens.find((s) => s.screenId === step.screenId);
            return (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                <span className="font-medium">{step.screenId}</span>
                <span className="text-muted-foreground">({scr?.screenTitle ?? 'Unknown'})</span>
                {step.triggerLabel && idx < flow.steps.length - 1 && (
                  <span className="text-primary ml-auto">→ {step.triggerLabel}</span>
                )}
                {step.outcome && idx === flow.steps.length - 1 && (
                  <span className="text-green-600 ml-auto">✓ {step.outcome}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Edit view
  return (
    <div className="rounded-lg border border-primary/40 bg-card p-4 space-y-3">
      <input
        type="text"
        value={flowName}
        onChange={(e) => setFlowName(e.target.value)}
        className="w-full text-sm font-semibold bg-transparent border-b border-primary/40 focus:border-primary focus:outline-none pb-1"
        placeholder="Flow name..."
      />
      <StepEditor steps={steps} screens={screens} onChange={setSteps} />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !flowName.trim() || steps.length < 2}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── New Flow Card ───────────────────────────────────────────────────────────

function NewFlowCard({
  moduleDbId, screens, onCreated,
}: {
  moduleDbId: string;
  screens: BaScreen[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [steps, setSteps] = useState<FlowStep[]>([
    { screenId: '', triggerLabel: '' },
    { screenId: '', triggerLabel: '', outcome: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!flowName.trim() || steps.length < 2) return;
    const validSteps = steps.filter((s) => s.screenId);
    if (validSteps.length < 2) return;
    setSaving(true);
    try {
      await createBaFlow(moduleDbId, { flowName, steps: validSteps });
      setFlowName('');
      setSteps([{ screenId: '', triggerLabel: '' }, { screenId: '', triggerLabel: '', outcome: '' }]);
      setOpen(false);
      onCreated();
    } catch {
      alert('Failed to create flow');
    } finally {
      setSaving(false);
    }
  }, [moduleDbId, flowName, steps, onCreated]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4 inline mr-1" />
        Add Navigation Flow
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-4 space-y-3">
      <input
        type="text"
        value={flowName}
        onChange={(e) => setFlowName(e.target.value)}
        className="w-full text-sm font-semibold bg-transparent border-b border-primary/40 focus:border-primary focus:outline-none pb-1"
        placeholder="Flow name (e.g., Admin assigns a task)..."
        autoFocus
      />
      <StepEditor steps={steps} screens={screens} onChange={setSteps} />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleCreate} disabled={saving || !flowName.trim() || steps.filter((s) => s.screenId).length < 2}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          Create Flow
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Step Editor (shared by create and edit) ─────────────────────────────────

function StepEditor({
  steps, screens, onChange,
}: {
  steps: FlowStep[];
  screens: BaScreen[];
  onChange: (steps: FlowStep[]) => void;
}) {
  const updateStep = (idx: number, field: keyof FlowStep, value: string) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const addStep = () => {
    onChange([...steps, { screenId: '', triggerLabel: '', outcome: '' }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 2) return;
    onChange(steps.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">Step {idx + 1}</span>
              <select
                value={step.screenId}
                onChange={(e) => updateStep(idx, 'screenId', e.target.value)}
                className="flex-1 text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="">Select screen...</option>
                {screens.map((s) => (
                  <option key={s.screenId} value={s.screenId}>
                    {s.screenId} — {s.screenTitle}
                  </option>
                ))}
              </select>
              {steps.length > 2 && (
                <button onClick={() => removeStep(idx)} className="text-muted-foreground hover:text-destructive" title="Remove step">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            {!isLast && (
              <div className="flex items-center gap-2 ml-12">
                <ArrowDown className="h-3 w-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={step.triggerLabel}
                  onChange={(e) => updateStep(idx, 'triggerLabel', e.target.value)}
                  placeholder="What triggers navigation to next screen?"
                  className="flex-1 text-xs border border-input rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            )}
            {isLast && (
              <div className="flex items-center gap-2 ml-12">
                <span className="text-xs text-muted-foreground shrink-0">Outcome:</span>
                <input
                  type="text"
                  value={step.outcome ?? ''}
                  onChange={(e) => updateStep(idx, 'outcome', e.target.value)}
                  placeholder="What is the result of completing this flow?"
                  className="flex-1 text-xs border border-input rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            )}
          </div>
        );
      })}
      <button onClick={addStep} className="text-xs text-primary hover:underline ml-12">
        + Add step
      </button>
    </div>
  );
}
