'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Edit3, Save, X, RefreshCw, AlertTriangle, CheckCircle2, Eye, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  updateDiscoveryBrd,
  BRD_SECTION_TITLES,
  type BaBrd,
  type BaFrTableRow,
} from '@/lib/ba-api';
import { MarkdownRenderer } from '@/components/ba-tool/MarkdownRenderer';

interface BrdEditorProps {
  projectId: string;
  brd: BaBrd;
  onUpdated: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}

const SECTION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];

export function BrdEditor({ projectId, brd, onUpdated, onRegenerate, regenerating }: BrdEditorProps) {
  const [activeKey, setActiveKey] = useState<string>('1');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = brd.sections ?? {};
  const frTable = (brd.frTable ?? []) as BaFrTableRow[];
  const openItems = (brd.openItems ?? []) as string[];

  const sectionStatus = useMemo(() => {
    const status: Record<string, 'filled' | 'empty'> = {};
    for (const key of SECTION_KEYS) {
      const body = sections[key];
      status[key] = body && body.trim().length > 30 ? 'filled' : 'empty';
    }
    return status;
  }, [sections]);

  const filledCount = Object.values(sectionStatus).filter((s) => s === 'filled').length;
  const untestableFrs = frTable.filter((r) => !r.testable);

  const beginEdit = () => {
    setDraft(sections[activeKey] ?? '');
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
      await updateDiscoveryBrd(projectId, brd.id, {
        sections: { [activeKey]: draft },
      });
      onUpdated();
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Business Requirements Document
            </span>
            <span className="text-[11px] text-muted-foreground ml-2">
              · 15-section template per skill 02 · status: <strong>{brd.status}</strong> · {filledCount}/15 sections populated
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <BrdExportToolbar projectId={projectId} brdId={brd.id} />
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
              Regenerate from WFT
            </Button>
          </div>
        </div>

        {/* Two-column: section nav + active section */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
          {/* Section navigator */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Sections
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              {SECTION_KEYS.map((key) => {
                const filled = sectionStatus[key] === 'filled';
                const isActive = activeKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (editing) return;
                      setActiveKey(key);
                    }}
                    disabled={editing}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                      isActive
                        ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-500 font-semibold'
                        : 'border border-transparent hover:bg-muted',
                      editing && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="text-muted-foreground">§{key}</span>
                      <span className="truncate">{BRD_SECTION_TITLES[key]}</span>
                    </span>
                    {filled ? (
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                    ) : (
                      <span className="h-3 w-3 flex-shrink-0 rounded-full border border-muted-foreground/40" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active section editor */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">
                <span className="text-muted-foreground">§{activeKey}</span> {BRD_SECTION_TITLES[activeKey]}
              </div>
              {!editing ? (
                <Button type="button" size="sm" variant="outline" onClick={beginEdit}>
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
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
                </div>
              )}
            </div>

            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={20}
                className="w-full text-sm p-3 rounded-md border bg-background font-mono"
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-muted/20 rounded-md border min-h-[200px]">
                {sections[activeKey] ? (
                  <MarkdownRenderer content={sections[activeKey]} />
                ) : (
                  <span className="italic text-muted-foreground text-sm">
                    Empty — click Edit to add content for §{activeKey} {BRD_SECTION_TITLES[activeKey]}.
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="mt-2 text-xs text-destructive">{error}</div>
            )}

            {/* Quality criteria sub-panel for §6 */}
            {activeKey === '6' && (
              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Functional Requirements ({frTable.length}) · quality check
                </div>
                {frTable.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">
                    No structured FR table parsed from this BRD yet.
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        'p-2 rounded-md border text-xs mb-2',
                        untestableFrs.length === 0
                          ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
                          : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
                      )}
                    >
                      {untestableFrs.length === 0 ? (
                        <span className="text-green-700 dark:text-green-400">
                          ✓ All FRs marked testable ({frTable.length}/{frTable.length})
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 inline-flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {untestableFrs.length} FR(s) flagged not testable — review:{' '}
                          {untestableFrs.map((r) => r.id).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left p-2 border">ID</th>
                            <th className="text-left p-2 border">Requirement</th>
                            <th className="text-center p-2 border w-16">Testable</th>
                          </tr>
                        </thead>
                        <tbody>
                          {frTable.map((row) => (
                            <tr key={row.id} className="border-b">
                              <td className="p-2 border font-mono">{row.id}</td>
                              <td className="p-2 border">{row.requirement}</td>
                              <td className="p-2 border text-center">
                                {row.testable ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 inline text-green-500" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 inline text-amber-600" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Quality sub-panel for §15 — open items list */}
            {activeKey === '15' && openItems.length > 0 && (
              <div className="mt-3 p-2 rounded-md border bg-amber-50 dark:bg-amber-950/30 border-amber-300">
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-amber-700 dark:text-amber-400">
                  Open items ({openItems.length})
                </div>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  {openItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Phase-2 placeholder */}
        <div className="mt-4 p-2 rounded-md border bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>📚 Version history (append-only) — Phase 2 per BRD §1.1</span>
          <span className="text-[10px] px-1.5 py-0.5 border rounded bg-background">Phase 2</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface BrdExportToolbarProps {
  projectId: string;
  brdId: string;
}

/**
 * Preview opens the rendered HTML in a new tab; PDF / DOCX trigger native
 * browser downloads via direct anchor links — same pattern as ArtifactContentPanel
 * uses for EPIC / User Story exports (avoids buffering large files in JS heap).
 */
function BrdExportToolbar({ projectId, brdId }: BrdExportToolbarProps) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const previewHref = `${apiBase}/api/ba/projects/${projectId}/discovery/brd/${brdId}/preview`;

  const download = (format: 'pdf' | 'docx') => {
    try {
      const a = document.createElement('a');
      a.href = `${apiBase}/api/ba/projects/${projectId}/discovery/brd/${brdId}/export/${format}`;
      a.download = `BRD.${format}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${format} download] failed:`, err);
      alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button type="button" size="sm" variant="outline" asChild>
        <a href={previewHref} target="_blank" rel="noopener noreferrer">
          <Eye className="h-3 w-3 mr-1" />
          Preview
        </a>
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => download('pdf')}>
        <Download className="h-3 w-3 mr-1" />
        PDF
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => download('docx')}>
        <Download className="h-3 w-3 mr-1" />
        DOCX
      </Button>
    </div>
  );
}
