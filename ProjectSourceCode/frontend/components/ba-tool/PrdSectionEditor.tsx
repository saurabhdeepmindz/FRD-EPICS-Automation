'use client';

/**
 * PrdSectionEditor (Sprint v6 · Track S · S-08).
 *
 * Inline editor for one PRD section. Each editable (string) field renders with an
 * AI Suggest button and a Mic button; AI-generated text shows blue, human edits in
 * normal ink, and a per-field Lock protects it from regeneration. Non-string fields
 * (e.g. the §6 FRD `features` arrays) are shown read-only in this phase.
 *
 * On save the section is persisted as structured fields (`{aiContent, editedContent,
 * lockedAt}`) via `updatePrdSection`; the backend stamps `lastEditedAt` on edits and
 * flattens everything back to text for export/AI through the F2 normalizer seam.
 */

import { useCallback, useState } from 'react';
import { Lock, Unlock, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AISuggestButton } from '@/components/forms/AISuggestButton';
import { MicButton } from '@/components/forms/MicButton';
import { updatePrdSection, suggestPrdField } from '@/lib/pipeline-api';
import { SECTION_FIELDS } from '@/lib/section-fields';
import {
  toStructured,
  fieldText,
  isAi,
  isLocked,
  isEditableField,
  type StructuredField,
} from '@/lib/structured-field';

interface PrdSectionEditorProps {
  projectId: string;
  prdId: string;
  sectionKey: string;
  body: Record<string, unknown>;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}

interface EditableEntry {
  key: string;
  editable: true;
  field: StructuredField;
}
interface ReadonlyEntry {
  key: string;
  editable: false;
  raw: unknown;
}
type Entry = EditableEntry | ReadonlyEntry;

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function PrdSectionEditor({
  projectId,
  prdId,
  sectionKey,
  body,
  onSaved,
  onCancel,
}: PrdSectionEditorProps) {
  const sectionNum = Number(sectionKey);
  const fieldDefs = SECTION_FIELDS[sectionNum] ?? [];
  const labelFor = (key: string) => fieldDefs.find((f) => f.key === key)?.label ?? humanize(key);
  const rowsFor = (key: string) => fieldDefs.find((f) => f.key === key)?.rows ?? 3;

  const [entries, setEntries] = useState<Entry[]>(() =>
    Object.entries(body).map(([key, raw]) =>
      isEditableField(raw)
        ? { key, editable: true, field: toStructured(raw) }
        : { key, editable: false, raw },
    ),
  );
  const [suggesting, setSuggesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchField = useCallback((key: string, next: StructuredField) => {
    setEntries((prev) =>
      prev.map((e) => (e.key === key && e.editable ? { ...e, field: next } : e)),
    );
  }, []);

  const onType = useCallback(
    (key: string, value: string) => {
      const e = entries.find((x) => x.key === key);
      if (e?.editable) patchField(key, { ...e.field, editedContent: value });
    },
    [entries, patchField],
  );

  const onMic = useCallback(
    (key: string, text: string) => {
      const e = entries.find((x) => x.key === key);
      if (e?.editable) {
        const current = fieldText(e.field);
        patchField(key, { ...e.field, editedContent: current ? `${current} ${text}` : text });
      }
    },
    [entries, patchField],
  );

  const onToggleLock = useCallback(
    (key: string) => {
      const e = entries.find((x) => x.key === key);
      if (e?.editable) {
        patchField(key, { ...e.field, lockedAt: isLocked(e.field) ? null : new Date().toISOString() });
      }
    },
    [entries, patchField],
  );

  const onSuggest = useCallback(
    async (key: string) => {
      setSuggesting((s) => ({ ...s, [key]: true }));
      setError(null);
      try {
        const suggestion = await suggestPrdField(projectId, prdId, sectionKey, key);
        const e = entries.find((x) => x.key === key);
        if (e?.editable) {
          // AI-suggested text is provenance-AI → store as aiContent (renders blue).
          patchField(key, { ...e.field, aiContent: suggestion, editedContent: undefined });
        }
      } catch (err) {
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (err instanceof Error ? err.message : 'AI suggestion failed'),
        );
      } finally {
        setSuggesting((s) => ({ ...s, [key]: false }));
      }
    },
    [projectId, prdId, sectionKey, entries, patchField],
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const content: Record<string, unknown> = {};
      for (const e of entries) {
        content[e.key] = e.editable ? e.field : e.raw;
      }
      await updatePrdSection(projectId, prdId, sectionKey, content);
      await onSaved();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Failed to save section'),
      );
      setSaving(false);
    }
  }, [entries, projectId, prdId, sectionKey, onSaved]);

  return (
    <div className="pt-3 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {entries.map((e) =>
        e.editable ? (
          <div key={e.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                {labelFor(e.key)}
                {isAi(e.field) && (
                  <span className="text-[9px] uppercase bg-blue-100 text-blue-600 rounded px-1 py-0.5">AI</span>
                )}
                {isLocked(e.field) && <Lock className="h-3 w-3 text-amber-500" />}
              </label>
              <div className="flex items-center gap-1.5">
                <AISuggestButton onClick={() => onSuggest(e.key)} loading={!!suggesting[e.key]} />
                <button
                  type="button"
                  onClick={() => onToggleLock(e.key)}
                  title={isLocked(e.field) ? 'Unlock (allow regeneration)' : 'Lock (protect from regeneration)'}
                  className="text-gray-400 hover:text-amber-600 p-1"
                >
                  {isLocked(e.field) ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <textarea
                value={fieldText(e.field)}
                onChange={(ev) => onType(e.key, ev.target.value)}
                rows={rowsFor(e.key)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
                  isAi(e.field) ? 'text-blue-700' : 'text-gray-900'
                }`}
              />
              <MicButton size="md" onTranscribed={(text) => onMic(e.key, text)} />
            </div>
          </div>
        ) : (
          <div key={e.key}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {labelFor(e.key)} <span className="normal-case text-gray-400">(read-only)</span>
            </p>
            <pre className="text-xs bg-gray-50 border rounded p-2 overflow-x-auto max-h-48">
              {JSON.stringify(e.raw, null, 2)}
            </pre>
          </div>
        ),
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1" /> Save section
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
