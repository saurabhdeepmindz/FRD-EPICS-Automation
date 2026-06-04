'use client';

import { Fragment, useRef, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  generateScreenMap,
  updateScreenMapRow,
  exportScreenMapCsv,
  importScreenMapCsv,
  type ScreenMap,
  type ScreenMapRow,
  type ScreenAnnotation,
} from '@/lib/pipeline-api';

interface ScreenMapTableProps {
  projectId: string;
  map: ScreenMap | null;
  onChanged: (map: ScreenMap) => void;
}

/** Architect-editable fields (PRD-derived columns stay read-only but visible). */
interface RowDraft {
  screenName: string;
  businessRulesArchitect: string;
  screenDescription: string;
  annotations: ScreenAnnotation[];
}

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err instanceof Error ? err.message : 'Request failed')
  );
}

export function ScreenMapTable({ projectId, map, onChanged }: ScreenMapTableProps) {
  const [busy, setBusy] = useState<null | 'generate' | 'export' | 'import'>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [savingRow, setSavingRow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const coverage = map?.coverage;
  const covered = coverage ? coverage.orphanFrs.length === 0 : false;

  const run = async (kind: 'generate' | 'export' | 'import', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const onGenerate = () =>
    run('generate', async () => {
      onChanged(await generateScreenMap(projectId));
    });

  const onExport = () =>
    run('export', async () => {
      const csv = await exportScreenMapCsv(projectId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screen-map-v${map?.version ?? 1}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const onImportFile = (file: File) =>
    run('import', async () => {
      const text = await file.text();
      onChanged(await importScreenMapCsv(projectId, text));
    });

  const beginEdit = (row: ScreenMapRow) => {
    setExpanded(row.id);
    setDraft({
      screenName: row.screenName,
      businessRulesArchitect: row.businessRulesArchitect,
      screenDescription: row.screenDescription,
      annotations: row.annotations.map((a) => ({ ...a })),
    });
  };

  const saveRow = async (rowId: string) => {
    if (!draft) return;
    setSavingRow(true);
    setError(null);
    try {
      await updateScreenMapRow(projectId, rowId, draft);
      onChanged({
        ...(map as ScreenMap),
        rows: (map as ScreenMap).rows.map((r) => (r.id === rowId ? { ...r, ...draft } : r)),
      });
      setExpanded(null);
      setDraft(null);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSavingRow(false);
    }
  };

  const updateAnnotation = (i: number, patch: Partial<ScreenAnnotation>) =>
    setDraft((d) => (d ? { ...d, annotations: d.annotations.map((a, j) => (j === i ? { ...a, ...patch } : a)) } : d));

  const addAnnotation = () =>
    setDraft((d) =>
      d
        ? {
            ...d,
            annotations: [
              ...d.annotations,
              { marker: d.annotations.filter((a) => a.marker !== 'P').length + 1, title: '', description: '', prdRef: '' },
            ],
          }
        : d,
    );

  const removeAnnotation = (i: number) =>
    setDraft((d) => (d ? { ...d, annotations: d.annotations.filter((_, j) => j !== i) } : d));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onGenerate} disabled={busy !== null}>
          {busy === 'generate' ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {map ? 'Regenerating…' : 'Generating…'}</>
          ) : map ? (
            <><RefreshCw className="h-4 w-4 mr-1" /> Regenerate from PRD</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-1" /> Generate from PRD</>
          )}
        </Button>
        {map && (
          <>
            <Button size="sm" variant="outline" onClick={onExport} disabled={busy !== null}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {busy === 'import' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Import CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = '';
              }}
            />
          </>
        )}
        {map && (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              covered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
            title="Every PRD FR-ID should map to at least one screen"
          >
            {covered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {covered
              ? `Full coverage · ${map.rows.length} screens`
              : `${coverage?.orphanFrs.length ?? 0} unmapped FR(s) · ${map.rows.length} screens`}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {coverage && coverage.orphanFrs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
          <span className="font-medium">Unmapped PRD FR-IDs:</span> {coverage.orphanFrs.join(', ')}
        </div>
      )}

      {!map ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <Sparkles className="h-6 w-6 text-blue-500" />
            </div>
            <p className="font-medium text-gray-800">No screen map yet</p>
            <p className="text-sm text-gray-500">
              Step 1 — generate a screen↔feature mapping from your PRD. Annotations cite PRD §/FR-IDs.
            </p>
            <p className="text-xs text-gray-400">Requires a confirmed PRD + FRD (Stage 2).</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-3 py-2 w-8"></th>
                <th className="text-left font-medium px-3 py-2">Screen</th>
                <th className="text-left font-medium px-3 py-2">PRD §</th>
                <th className="text-left font-medium px-3 py-2">FR Ref(s)</th>
                <th className="text-left font-medium px-3 py-2">Feature</th>
                <th className="text-left font-medium px-3 py-2 text-center">Annotations</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {map.rows.map((row) => {
                const open = expanded === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer align-top"
                      onClick={() => (open ? (setExpanded(null), setDraft(null)) : beginEdit(row))}
                    >
                      <td className="px-3 py-2 text-gray-400">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{row.screenName}</div>
                        <div className="text-xs text-gray-400 font-mono">{row.screenId}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{row.prdSections.join(', ')}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.featureRefs.map((fr) => (
                            <span key={fr} className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                              {fr}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-xs">{row.featureDescription}</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">{row.annotations.length}</td>
                    </tr>
                    {open && draft && (
                      <tr className="bg-gray-50/60">
                        <td></td>
                        <td colSpan={5} className="px-3 py-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Screen Name">
                              <input
                                className="w-full border rounded px-2 py-1.5 text-sm"
                                value={draft.screenName}
                                onChange={(e) => setDraft({ ...draft, screenName: e.target.value })}
                              />
                            </Field>
                            <ReadOnly label="Business Rules (from PRD)" value={row.businessRulesPrd} />
                            <Field label="Business Rules (Architect)">
                              <textarea
                                className="w-full border rounded px-2 py-1.5 text-sm min-h-[64px]"
                                value={draft.businessRulesArchitect}
                                onChange={(e) => setDraft({ ...draft, businessRulesArchitect: e.target.value })}
                              />
                            </Field>
                            <Field label="Screen Description (EPIC)">
                              <textarea
                                className="w-full border rounded px-2 py-1.5 text-sm min-h-[64px]"
                                value={draft.screenDescription}
                                onChange={(e) => setDraft({ ...draft, screenDescription: e.target.value })}
                              />
                            </Field>
                          </div>

                          {/* Annotations editor */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                Wireframe Annotations
                              </span>
                              <Button size="sm" variant="ghost" onClick={addAnnotation}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {draft.annotations.map((a, i) => (
                                <div key={i} className="flex gap-2 items-start bg-white border rounded p-2">
                                  <input
                                    className="w-10 border rounded px-1 py-1 text-xs text-center font-mono shrink-0"
                                    value={String(a.marker)}
                                    title='Marker — number, or "P" for the persona row'
                                    onChange={(e) => updateAnnotation(i, { marker: /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value })}
                                  />
                                  <div className="flex-1 space-y-1.5">
                                    <input
                                      className="w-full border rounded px-2 py-1 text-xs"
                                      placeholder="Title"
                                      value={a.title}
                                      onChange={(e) => updateAnnotation(i, { title: e.target.value })}
                                    />
                                    <textarea
                                      className="w-full border rounded px-2 py-1 text-xs min-h-[40px]"
                                      placeholder="Description"
                                      value={a.description}
                                      onChange={(e) => updateAnnotation(i, { description: e.target.value })}
                                    />
                                    <input
                                      className="w-full border rounded px-2 py-1 text-xs font-mono text-indigo-700"
                                      placeholder="PRD ref — e.g. §6 FR-AUTH-001"
                                      value={a.prdRef}
                                      onChange={(e) => updateAnnotation(i, { prdRef: e.target.value })}
                                    />
                                  </div>
                                  <Button size="sm" variant="ghost" onClick={() => removeAnnotation(i)} title="Remove">
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  </Button>
                                </div>
                              ))}
                              {draft.annotations.length === 0 && (
                                <p className="text-xs text-gray-400 italic">No annotations — add at least one citing a PRD §/FR.</p>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => (setExpanded(null), setDraft(null))} disabled={savingRow}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={() => saveRow(row.id)} disabled={savingRow}>
                              {savingRow ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                              Save row
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="block">
      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</span>
      <div className="mt-1 text-sm text-gray-600 bg-gray-100 border rounded px-2 py-1.5 min-h-[64px] whitespace-pre-wrap">
        {value || <span className="text-gray-400 italic">—</span>}
      </div>
    </div>
  );
}
