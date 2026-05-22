'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle, Edit3, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateDiscoveryWft, type BaWft, type BaWftConcept } from '@/lib/ba-api';

interface WftViewerProps {
  projectId: string;
  wft: BaWft;
  onUpdated: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}

type TabKey = 'raw' | 'cleaned' | 'paraphrased' | 'concepts' | 'actions' | 'questions' | 'meta';

const TABS: { key: TabKey; label: string; section: string }[] = [
  { key: 'raw', label: 'Raw transcript', section: '§1' },
  { key: 'cleaned', label: 'Cleaned', section: '§2' },
  { key: 'paraphrased', label: 'Paraphrased', section: '§3' },
  { key: 'concepts', label: 'Concepts', section: '§4' },
  { key: 'actions', label: 'Action items', section: '§5' },
  { key: 'questions', label: 'Open questions', section: '§6' },
  { key: 'meta', label: 'Metadata', section: '§7' },
];

export function WftViewer({ projectId, wft, onUpdated, onRegenerate, regenerating }: WftViewerProps) {
  const [active, setActive] = useState<TabKey>('paraphrased');
  const [editing, setEditing] = useState(false);
  const [draftCleaned, setDraftCleaned] = useState(wft.cleanedText ?? '');
  const [draftParaphrased, setDraftParaphrased] = useState(wft.paraphrased ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beginEdit = () => {
    setDraftCleaned(wft.cleanedText ?? '');
    setDraftParaphrased(wft.paraphrased ?? '');
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates =
        active === 'cleaned'
          ? { cleanedText: draftCleaned }
          : active === 'paraphrased'
            ? { paraphrased: draftParaphrased }
            : {};
      if (Object.keys(updates).length === 0) {
        setEditing(false);
        return;
      }
      await updateDiscoveryWft(projectId, wft.id, updates);
      onUpdated();
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const concepts = (wft.concepts ?? []) as BaWftConcept[];
  const actions = (wft.actionItems ?? []) as string[];
  const questions = (wft.openQuestions ?? []) as string[];
  const isEditableTab = active === 'cleaned' || active === 'paraphrased';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Well-formed Text Preview
            </span>
            <span className="text-[11px] text-muted-foreground ml-2">
              · 7-section template per skill 01 · status: <strong>{wft.status}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={regenerating || editing}
            >
              {regenerating ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Regenerate from audio
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto mb-3">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (editing) return;
                setActive(tab.key);
              }}
              disabled={editing}
              className={cn(
                'px-3 py-1.5 text-xs whitespace-nowrap border-b-2 transition-colors',
                active === tab.key
                  ? 'border-orange-500 text-orange-600 font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
                editing && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className="text-muted-foreground/70 mr-1">{tab.section}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[200px]">
          {active === 'raw' && (
            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-md border max-h-[420px] overflow-auto">
              {wft.rawTranscript || <span className="italic text-muted-foreground">empty</span>}
            </pre>
          )}

          {active === 'cleaned' && (
            <EditableSection
              value={editing ? draftCleaned : wft.cleanedText ?? ''}
              editing={editing}
              onChange={setDraftCleaned}
              placeholder="No cleaned transcript yet"
            />
          )}

          {active === 'paraphrased' && (
            <EditableSection
              value={editing ? draftParaphrased : wft.paraphrased ?? ''}
              editing={editing}
              onChange={setDraftParaphrased}
              placeholder="No paraphrased meaning yet"
            />
          )}

          {active === 'concepts' && (
            <div className="space-y-2">
              {concepts.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">No concepts surfaced.</div>
              ) : (
                concepts.map((c, i) => (
                  <div key={i} className="p-2 bg-muted/30 rounded-md border">
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.context}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {active === 'actions' && (
            <ul className="space-y-1.5">
              {actions.length === 0 ? (
                <li className="text-sm text-muted-foreground italic">No action items.</li>
              ) : (
                actions.map((item, i) => (
                  <li key={i} className="text-sm flex">
                    <span className="text-orange-500 mr-2">▶</span>
                    <span>{item}</span>
                  </li>
                ))
              )}
            </ul>
          )}

          {active === 'questions' && (
            <div
              className={cn(
                'p-3 rounded-md border',
                questions.length > 0
                  ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700'
                  : 'border-border bg-muted/30',
              )}
            >
              <div className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center">
                {questions.length > 0 && <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />}
                Open questions ({questions.length})
              </div>
              {questions.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">None surfaced.</div>
              ) : (
                <ul className="space-y-1.5">
                  {questions.map((q, i) => (
                    <li key={i} className="text-sm">
                      • {q}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {active === 'meta' && (
            <div className="text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-muted-foreground">id:</span> {wft.id}
              </div>
              <div>
                <span className="text-muted-foreground">status:</span> {wft.status}
              </div>
              <div>
                <span className="text-muted-foreground">created:</span> {wft.createdAt}
              </div>
              <div>
                <span className="text-muted-foreground">updated:</span> {wft.updatedAt}
              </div>
              {wft.meta && (
                <div className="pt-2 border-t mt-2">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(wft.meta, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit toolbar */}
        {isEditableTab && (
          <div className="flex items-center gap-2 mt-3 border-t pt-3">
            {!editing ? (
              <Button type="button" size="sm" variant="outline" onClick={beginEdit}>
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </>
            )}
            {error && <span className="text-xs text-destructive ml-2">{error}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface EditableSectionProps {
  value: string;
  editing: boolean;
  onChange: (next: string) => void;
  placeholder: string;
}

function EditableSection({ value, editing, onChange, placeholder }: EditableSectionProps) {
  if (editing) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        className="w-full text-sm p-3 rounded-md border bg-background font-sans"
      />
    );
  }
  return (
    <div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/20 p-3 rounded-md border min-h-[200px]">
      {value || <span className="italic text-muted-foreground">{placeholder}</span>}
    </div>
  );
}
