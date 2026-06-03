'use client';

/**
 * FrdEditor (Sprint v6 · Track S · S-08b).
 *
 * Inline editor for §6 (FRD), whose body is a flat map of `6.N_*` keys grouping
 * modules → features. Lets a BA edit module-level text and each feature's text
 * fields (name / description / business rule / acceptance criteria / priority)
 * with AI Suggest + Mic + lock + blue-AI/ink, preserving the module/feature
 * structure and FR-IDs on save. Edits are stored as structured fields; the F2
 * normalizer flattens them back to text for export / AI / RTM.
 */

import { useCallback, useState } from 'react';
import { Lock, Unlock, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AISuggestButton } from '@/components/forms/AISuggestButton';
import { MicButton } from '@/components/forms/MicButton';
import { updatePrdSection, suggestPrdField } from '@/lib/pipeline-api';
import {
  toStructured,
  fieldText,
  isAi,
  isLocked,
  type StructuredField,
} from '@/lib/structured-field';

interface FrdEditorProps {
  projectId: string;
  prdId: string;
  body: Record<string, unknown>;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}

/** The feature text fields we expose as structured (AI/edit/lock) editors. */
const FEATURE_TEXT_FIELDS: { key: string; label: string; rows: number }[] = [
  { key: 'featureName', label: 'Feature Name', rows: 1 },
  { key: 'description', label: 'Description', rows: 3 },
  { key: 'businessRule', label: 'Business Rule', rows: 2 },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria', rows: 3 },
];

const MODULE_TEXT_FIELDS: { field: string; label: string; rows: number }[] = [
  { field: 'moduleName', label: 'Module Name', rows: 1 },
  { field: 'moduleDescription', label: 'Module Description', rows: 3 },
  { field: 'moduleBusinessRules', label: 'Module Business Rules', rows: 3 },
];

interface FieldRowProps {
  label: string;
  rows: number;
  value: unknown;
  onChange: (next: StructuredField) => void;
  onSuggest: () => Promise<void>;
  suggesting: boolean;
}

function FieldRow({ label, rows, value, onChange, onSuggest, suggesting }: FieldRowProps) {
  const f = toStructured(value);
  const ai = isAi(f);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          {label}
          {ai && <span className="text-[9px] bg-blue-100 text-blue-600 rounded px-1">AI</span>}
          {isLocked(f) && <Lock className="h-3 w-3 text-amber-500" />}
        </label>
        <div className="flex items-center gap-1.5">
          <AISuggestButton onClick={onSuggest} loading={suggesting} />
          <button
            type="button"
            onClick={() => onChange({ ...f, lockedAt: isLocked(f) ? null : new Date().toISOString() })}
            title={isLocked(f) ? 'Unlock' : 'Lock (protect from regeneration)'}
            className="text-gray-400 hover:text-amber-600 p-1"
          >
            {isLocked(f) ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <textarea
          value={fieldText(f)}
          onChange={(e) => onChange({ ...f, editedContent: e.target.value })}
          rows={rows}
          className={`flex-1 rounded-md border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
            ai ? 'text-blue-700' : 'text-gray-900'
          }`}
        />
        <MicButton
          size="md"
          onTranscribed={(t) => {
            const cur = fieldText(f);
            onChange({ ...f, editedContent: cur ? `${cur} ${t}` : t });
          }}
        />
      </div>
    </div>
  );
}

interface ModuleGroup {
  mk: string; // e.g. "6.1"
  fields: Record<string, unknown>; // field name (moduleId, moduleName, features, …) → value
}

function groupModules(body: Record<string, unknown>): ModuleGroup[] {
  const map: Record<string, Record<string, unknown>> = {};
  const order: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    const m = k.match(/^(6\.\d+)_(.+)$/);
    if (!m) continue;
    const [, mk, field] = m;
    if (!map[mk]) {
      map[mk] = {};
      order.push(mk);
    }
    map[mk][field] = v;
  }
  return order.map((mk) => ({ mk, fields: map[mk] }));
}

export function FrdEditor({ projectId, prdId, body, onSaved, onCancel }: FrdEditorProps) {
  // Working copy of the flat 6.N_* object; edited fields become structured fields.
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...body }));
  const [suggesting, setSuggesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modules = groupModules(draft);

  const setModuleField = useCallback((mk: string, field: string, next: StructuredField) => {
    setDraft((d) => ({ ...d, [`${mk}_${field}`]: next }));
  }, []);

  const setFeatureField = useCallback(
    (mk: string, idx: number, field: string, next: StructuredField | string) => {
      setDraft((d) => {
        const fkey = `${mk}_features`;
        const features = Array.isArray(d[fkey]) ? [...(d[fkey] as unknown[])] : [];
        const feat = { ...(features[idx] as Record<string, unknown>), [field]: next };
        features[idx] = feat;
        return { ...d, [fkey]: features };
      });
    },
    [],
  );

  const suggest = useCallback(
    async (slot: string, fieldLabel: string, apply: (text: string) => void) => {
      setSuggesting((s) => ({ ...s, [slot]: true }));
      setError(null);
      try {
        const suggestion = await suggestPrdField(projectId, prdId, '6', fieldLabel);
        apply(suggestion);
      } catch (err) {
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            (err instanceof Error ? err.message : 'AI suggestion failed'),
        );
      } finally {
        setSuggesting((s) => ({ ...s, [slot]: false }));
      }
    },
    [projectId, prdId],
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePrdSection(projectId, prdId, '6', draft);
      await onSaved();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          (err instanceof Error ? err.message : 'Failed to save FRD'),
      );
      setSaving(false);
    }
  }, [draft, projectId, prdId, onSaved]);

  return (
    <div className="pt-3 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {modules.map(({ mk, fields }) => {
        const moduleId = typeof fields.moduleId === 'string' ? fields.moduleId : mk;
        const features = Array.isArray(fields.features) ? (fields.features as Record<string, unknown>[]) : [];
        return (
          <div key={mk} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-blue-600">{moduleId}</span>
              <span className="text-sm font-semibold text-gray-800">{mk}</span>
            </div>

            {/* Module-level text fields */}
            {MODULE_TEXT_FIELDS.filter((mf) => `${mf.field}` in fields).map((mf) => {
              const slot = `${mk}_${mf.field}`;
              return (
                <FieldRow
                  key={slot}
                  label={mf.label}
                  rows={mf.rows}
                  value={fields[mf.field]}
                  suggesting={!!suggesting[slot]}
                  onChange={(next) => setModuleField(mk, mf.field, next)}
                  onSuggest={() =>
                    suggest(slot, `${moduleId} / ${mf.field}`, (text) =>
                      setModuleField(mk, mf.field, { ...toStructured(fields[mf.field]), aiContent: text, editedContent: undefined }),
                    )
                  }
                />
              );
            })}

            {/* Features */}
            {features.length > 0 && (
              <div className="space-y-3">
                {features.map((feat, idx) => {
                  const featureId = typeof feat.featureId === 'string' ? feat.featureId : `#${idx + 1}`;
                  return (
                    <div key={featureId} className="bg-gray-50 rounded-md p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">{featureId}</span>
                        <input
                          value={typeof feat.priority === 'string' ? feat.priority : ''}
                          onChange={(e) => setFeatureField(mk, idx, 'priority', e.target.value)}
                          placeholder="Priority"
                          className="ml-auto w-20 text-[11px] border rounded px-1.5 py-0.5 text-gray-600"
                        />
                      </div>
                      {FEATURE_TEXT_FIELDS.filter((ff) => ff.key in feat).map((ff) => {
                        const slot = `${mk}_${idx}_${ff.key}`;
                        return (
                          <FieldRow
                            key={slot}
                            label={ff.label}
                            rows={ff.rows}
                            value={feat[ff.key]}
                            suggesting={!!suggesting[slot]}
                            onChange={(next) => setFeatureField(mk, idx, ff.key, next)}
                            onSuggest={() =>
                              suggest(slot, `${featureId} / ${ff.key}`, (text) =>
                                setFeatureField(mk, idx, ff.key, {
                                  ...toStructured(feat[ff.key]),
                                  aiContent: text,
                                  editedContent: undefined,
                                }),
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

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
              <Save className="h-3.5 w-3.5 mr-1" /> Save FRD
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
