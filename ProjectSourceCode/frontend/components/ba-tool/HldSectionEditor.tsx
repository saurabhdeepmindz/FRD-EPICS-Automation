'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Save, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MicButton } from '@/components/forms/MicButton';
import { updateHldSection, suggestHldField } from '@/lib/pipeline-api';

/**
 * HE-02 — guided editor for a single HLD section. String fields are textareas;
 * nested objects/arrays are edited as JSON (validated on save). Saving calls the
 * existing PATCH section route → a new HLD version. Mirrors the PRD edit flow.
 */
interface FieldDraft {
  key: string;
  raw: string;
  structured: boolean; // value was an object/array → edited as JSON
}

function stripAi(s: string): string {
  return s.startsWith('[AI] ') ? s.slice(5) : s;
}

function toDrafts(body: Record<string, unknown> | undefined): FieldDraft[] {
  if (!body) return [];
  return Object.entries(body).map(([key, value]) => {
    if (typeof value === 'string') return { key, raw: stripAi(value), structured: false };
    if (value == null) return { key, raw: '', structured: false };
    if (typeof value === 'number' || typeof value === 'boolean') return { key, raw: String(value), structured: false };
    return { key, raw: JSON.stringify(value, null, 2), structured: true };
  });
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

export function HldSectionEditor({
  projectId,
  hldId,
  sectionKey,
  sectionName,
  body,
  onSaved,
  onCancel,
}: {
  projectId: string;
  hldId: string;
  sectionKey: string;
  sectionName: string;
  body: Record<string, unknown> | undefined;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const initial = useMemo(() => toDrafts(body), [body]);
  const [fields, setFields] = useState<FieldDraft[]>(initial);
  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);

  const setRaw = (idx: number, raw: string) =>
    setFields((f) => f.map((d, i) => (i === idx ? { ...d, raw } : d)));

  const appendRaw = (idx: number, text: string) =>
    setFields((f) => f.map((d, i) => (i === idx ? { ...d, raw: d.raw ? `${d.raw} ${text}` : text } : d)));

  const removeField = (idx: number) => setFields((f) => f.filter((_, i) => i !== idx));

  /** Per-field AI Suggest — grounded in the section + PRD/FRD/stack. */
  const suggest = async (idx: number) => {
    const f = fields[idx];
    if (!f) return;
    setSuggesting(f.key);
    setError(null);
    try {
      const { suggestion } = await suggestHldField(projectId, hldId, {
        sectionKey,
        fieldName: humanize(f.key),
        currentValue: f.raw,
      });
      if (suggestion?.trim()) setRaw(idx, suggestion.trim());
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'AI Suggest failed'),
      );
    } finally {
      setSuggesting(null);
    }
  };

  const addField = () => {
    const key = newKey.trim();
    if (!key || fields.some((f) => f.key === key)) return;
    setFields((f) => [...f, { key, raw: '', structured: false }]);
    setNewKey('');
  };

  const onSave = async () => {
    setError(null);
    // Build the section content; validate structured (JSON) fields first.
    const content: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.structured) {
        try {
          content[f.key] = JSON.parse(f.raw);
        } catch {
          setError(`"${humanize(f.key)}" is not valid JSON.`);
          return;
        }
      } else {
        content[f.key] = f.raw;
      }
    }
    setSaving(true);
    try {
      await updateHldSection(projectId, hldId, sectionKey, content);
      await onSaved();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Save failed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-gray-900">Edit · {sectionName}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-4 bg-white border rounded-lg p-4">
        {fields.length === 0 && <p className="text-sm text-gray-400">No fields yet — add one below.</p>}
        {fields.map((f, idx) => (
          <div key={f.key}>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {humanize(f.key)}
              </label>
              {f.structured && (
                <span className="text-[9px] uppercase bg-gray-100 text-gray-500 rounded px-1 py-0.5">JSON</span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => suggest(idx)}
                  disabled={suggesting === f.key}
                  className="text-[11px] font-medium inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 text-amber-700 px-2 py-0.5 hover:bg-amber-100 disabled:opacity-50"
                  title="AI Suggest — grounded in your PRD/FRD & stack"
                >
                  {suggesting === f.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI Suggest
                </button>
                <MicButton size="sm" onTranscribed={(t) => appendRaw(idx, t)} />
                <button
                  type="button"
                  onClick={() => removeField(idx)}
                  className="text-gray-300 hover:text-red-500"
                  title="Remove field"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <textarea
              value={f.raw}
              onChange={(e) => setRaw(idx, e.target.value)}
              rows={f.structured ? 6 : 3}
              className={`w-full text-sm border rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${f.structured ? 'font-mono text-xs' : ''}`}
            />
          </div>
        ))}

        <div className="flex items-center gap-2 pt-2 border-t">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="new field name (e.g. dataIsolation)"
            className="flex-1 text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addField())}
          />
          <Button variant="outline" size="sm" onClick={addField} disabled={!newKey.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Add field
          </Button>
        </div>
      </div>
    </div>
  );
}
