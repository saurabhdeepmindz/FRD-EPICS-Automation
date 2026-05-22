'use client';

import { useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Edit3,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  GitCommit,
  Plus,
  Eye,
  Download,
  Upload,
  Trash2,
  Image as ImageIcon,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  updateDiscoveryAnVersion,
  extractAnBrandTokens,
  AN_SECTION_TITLES,
  type BaApproachNote,
  type BaApproachNoteVersion,
  type BaAnDecision,
  type BaAnOpenQuestion,
  type BaAnBrandTokens,
  type BaAnPrdReadiness,
  type BaAnActor,
  type BaAnIntegration,
  type BaAnCustomerJourney,
  type BaAnFunctionalLandscapeRow,
  type BaAnComplianceRow,
  type BaAnReceivable,
  type BaAnEnvironment,
} from '@/lib/ba-api';
import { MarkdownRenderer } from '@/components/ba-tool/MarkdownRenderer';

interface ApproachNoteEditorProps {
  projectId: string;
  approachNote: BaApproachNote;
  /** Called after a successful section edit save (to refresh the parent). */
  onUpdated: () => void;
  /** Called when the user clicks "+ New Version" — opens a modal-like flow on the page. */
  onCreateNewVersion: () => void;
  creatingNewVersion: boolean;
}

const SECTION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const EMPTY_PRD_READINESS: BaAnPrdReadiness = {
  actors: [],
  integrations: [],
  customerJourneys: [],
  functionalLandscape: [],
  uiUxRequirements: {
    interactionPatterns: '',
    accessibility: '',
    responsive: '',
    emptyErrorStates: '',
    microcopyTone: '',
    internationalization: '',
  },
  complianceRequirements: [],
  testingRequirements: {
    unit: { coverageTarget: '', tools: '', owner: '' },
    integration: { coverageTarget: '', tools: '', owner: '' },
    e2e: { coverageTarget: '', tools: '', owner: '' },
    evalHarness: { coverageTarget: '', tools: '', owner: '' },
    accessibility: { coverageTarget: '', tools: '', owner: '' },
    performance: { coverageTarget: '', tools: '', owner: '' },
    security: { coverageTarget: '', tools: '', owner: '' },
  },
  keyDeliverables: [],
  receivables: [],
  environmentList: [],
  miscellaneous: '',
};

const DEFAULT_BRAND_TOKENS: BaAnBrandTokens = {
  primary: '#0B1B2E',
  surface: '#FFFFFF',
  cta: '#F97316',
  logo: null,
  productName: '—',
};

export function ApproachNoteEditor({
  projectId,
  approachNote,
  onUpdated,
  onCreateNewVersion,
  creatingNewVersion,
}: ApproachNoteEditorProps) {
  const [activeVersionId, setActiveVersionId] = useState<string>(
    approachNote.currentVersion?.id ?? approachNote.versions[approachNote.versions.length - 1]?.id ?? '',
  );
  const activeVersion: BaApproachNoteVersion | null = useMemo(
    () => approachNote.versions.find((v) => v.id === activeVersionId) ?? approachNote.currentVersion ?? null,
    [activeVersionId, approachNote.versions, approachNote.currentVersion],
  );
  const isReadOnly = activeVersion ? activeVersion.id !== approachNote.currentVersionId : true;

  const [activeKey, setActiveKey] = useState<string>('1');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionStatus = useMemo(() => {
    const status: Record<string, 'filled' | 'empty'> = {};
    const sections = activeVersion?.sections ?? {};
    for (const key of SECTION_KEYS) {
      const body = sections[key];
      status[key] = body && body.trim().length > 30 ? 'filled' : 'empty';
    }
    return status;
  }, [activeVersion?.sections]);

  const filledCount = Object.values(sectionStatus).filter((s) => s === 'filled').length;

  const beginEdit = () => {
    if (!activeVersion) return;
    setDraft(activeVersion.sections[activeKey] ?? '');
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    if (!activeVersion) return;
    setSaving(true);
    setError(null);
    try {
      await updateDiscoveryAnVersion(projectId, activeVersion.id, {
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

  if (!activeVersion) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground italic">
          No version selected.
        </CardContent>
      </Card>
    );
  }

  const decisions = (activeVersion.decisionsLocked ?? []) as BaAnDecision[];
  const openQs = (activeVersion.openQuestions ?? []) as BaAnOpenQuestion[];
  const brand = (activeVersion.brandTokens ?? DEFAULT_BRAND_TOKENS) as BaAnBrandTokens;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Version timeline + export toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3 pb-3 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Version timeline (append-only)
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {approachNote.versions.map((v) => {
                const isCurrent = v.id === approachNote.currentVersionId;
                const isViewing = v.id === activeVersionId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      if (editing) return;
                      setActiveVersionId(v.id);
                      setActiveKey('1');
                    }}
                    disabled={editing}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-md border transition-colors',
                      isViewing
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 font-semibold'
                        : 'border-dashed hover:bg-muted',
                      editing && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    v{v.versionNumber}
                    {isCurrent && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(current)</span>
                    )}
                  </button>
                );
              })}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCreateNewVersion}
                disabled={creatingNewVersion || editing}
              >
                {creatingNewVersion ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                New version
              </Button>
            </div>
          </div>
          <AnExportToolbar projectId={projectId} versionId={activeVersion.id} versionNumber={activeVersion.versionNumber} />
        </div>

        {/* Header for active version */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="text-sm flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className="font-semibold">v{activeVersion.versionNumber}</span>
            <span className="text-muted-foreground">· status {activeVersion.status}</span>
            <span className="text-muted-foreground">· {filledCount}/12 sections populated</span>
            <FormatChip version={activeVersion} />
            {isReadOnly && (
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                · read-only (older version)
              </span>
            )}
          </div>
        </div>

        {/* Changes since v(N-1) — only on v2+ */}
        {activeVersion.changesSince && (
          <div className="mb-3 p-3 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/30">
            <div className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400 mb-1">
              <GitCommit className="h-3 w-3 mr-1" />
              Changes since v{activeVersion.versionNumber - 1}
            </div>
            <div className="text-xs whitespace-pre-wrap">{activeVersion.changesSince}</div>
          </div>
        )}

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
                      <span className="truncate">{AN_SECTION_TITLES[key]}</span>
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
                <span className="text-muted-foreground">§{activeKey}</span> {AN_SECTION_TITLES[activeKey]}
              </div>
              {!editing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={beginEdit}
                  disabled={isReadOnly}
                  title={isReadOnly ? 'Read-only — switch to current version to edit' : undefined}
                >
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
                {activeVersion.sections[activeKey] ? (
                  <MarkdownRenderer content={activeVersion.sections[activeKey]} />
                ) : (
                  <span className="italic text-muted-foreground text-sm">
                    Empty — click Edit to add content.
                  </span>
                )}
              </div>
            )}

            {error && <div className="mt-2 text-xs text-destructive">{error}</div>}

            {/* §3 brand tokens inline editor */}
            {activeKey === '3' && (
              <BrandTokensInlineEditor
                projectId={projectId}
                versionId={activeVersion.id}
                tokens={brand}
                readOnly={isReadOnly}
                onUpdated={onUpdated}
              />
            )}

            {/* §8 decisions + open questions inline editors */}
            {activeKey === '8' && (
              <div className="mt-3 space-y-2">
                <DecisionsInlineEditor
                  projectId={projectId}
                  versionId={activeVersion.id}
                  decisions={decisions}
                  openQs={openQs}
                  readOnly={isReadOnly}
                  onUpdated={onUpdated}
                />
                <OpenQuestionsInlineEditor
                  projectId={projectId}
                  versionId={activeVersion.id}
                  openQs={openQs}
                  decisions={decisions}
                  readOnly={isReadOnly}
                  onUpdated={onUpdated}
                />
              </div>
            )}

            {/* §12 PRD-Readiness Bridge — structured editor (lifts directly into a downstream PRD) */}
            {activeKey === '12' && (
              <div className="mt-3">
                <PrdReadinessInlineEditor
                  projectId={projectId}
                  versionId={activeVersion.id}
                  prdReadiness={activeVersion.prdReadiness ?? EMPTY_PRD_READINESS}
                  readOnly={isReadOnly}
                  onUpdated={onUpdated}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Format chip ─────────────────────────────────────────────────────────────
// Surfaces whether a given version was generated by the new 12-section prompt
// (with §12 PRD-Readiness Bridge) or by the old 11-section prompt. Read-only
// signal — does not auto-upgrade; users get a new format only by creating a
// new version on a freshly-loaded ai-service prompt.

interface FormatChipProps {
  version: BaApproachNoteVersion;
}

function FormatChip({ version }: FormatChipProps) {
  const has12Section = !!(version.sections && version.sections['12']);
  const prd = version.prdReadiness;
  const prdItemCount = prd
    ? prd.actors.length +
      prd.integrations.length +
      prd.customerJourneys.length +
      prd.functionalLandscape.length +
      prd.complianceRequirements.length +
      prd.keyDeliverables.length +
      prd.receivables.length +
      prd.environmentList.length
    : 0;

  if (has12Section || prd) {
    return (
      <span
        className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded border border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
        title="Generated with the 12-section prompt — §12 PRD-Readiness Bridge is populated and lifts directly into a downstream PRD"
      >
        12-section · §12 ✓ {prdItemCount > 0 && `(${prdItemCount} items)`}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded border border-amber-500/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      title="Generated by an older prompt — §12 PRD-Readiness Bridge is missing. Create a new version (after restarting the ai-service) to upgrade this AN to the 12-section format."
    >
      11-section · pre-§12
    </span>
  );
}

// ─── Export toolbar (Preview / PDF / DOCX with internal/client edition toggle) ─

interface AnExportToolbarProps {
  projectId: string;
  versionId: string;
  versionNumber: number;
}

function AnExportToolbar({ projectId, versionId, versionNumber }: AnExportToolbarProps) {
  const [edition, setEdition] = useState<'internal' | 'client'>('internal');
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const baseUrl = `${apiBase}/api/ba/projects/${projectId}/discovery/approach-note/versions/${versionId}`;
  const previewHref = `${baseUrl}/preview?edition=${edition}`;

  const download = (format: 'pdf' | 'docx' | 'md') => {
    try {
      const a = document.createElement('a');
      a.href = `${baseUrl}/export/${format}?edition=${edition}`;
      a.download = `Approach-Note${edition === 'client' ? '-client' : ''}-v${versionNumber}.${format}`;
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
      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 mr-1">
        <button
          type="button"
          onClick={() => setEdition('internal')}
          className={cn(
            'text-[11px] px-2 py-1 rounded transition-colors',
            edition === 'internal' ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground',
          )}
          title="Internal edition includes Changes-since-v(N-1) panel"
        >
          Internal
        </button>
        <button
          type="button"
          onClick={() => setEdition('client')}
          className={cn(
            'text-[11px] px-2 py-1 rounded transition-colors',
            edition === 'client' ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground',
          )}
          title="Client edition strips the Changes-since-v(N-1) panel"
        >
          Client
        </button>
      </div>
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
      <Button type="button" size="sm" variant="outline" onClick={() => download('md')}>
        <Download className="h-3 w-3 mr-1" />
        MD
      </Button>
    </div>
  );
}

// ─── Brand tokens inline editor (with reference-page upload) ─────────────────

interface BrandTokensInlineEditorProps {
  projectId: string;
  versionId: string;
  tokens: BaAnBrandTokens;
  readOnly: boolean;
  onUpdated: () => void;
}

function BrandTokensInlineEditor({
  projectId,
  versionId,
  tokens,
  readOnly,
  onUpdated,
}: BrandTokensInlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BaAnBrandTokens>(tokens);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const beginEdit = () => {
    setDraft(tokens);
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDiscoveryAnVersion(projectId, versionId, {
        brandTokens: {
          primary: draft.primary,
          surface: draft.surface,
          cta: draft.cta,
          productName: draft.productName,
        },
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

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setError(`Expected an image, got ${file.type || 'unknown'}`);
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const result = await extractAnBrandTokens(projectId, versionId, file);
      // Merge into local draft + persist already done server-side
      setDraft((prev) => ({
        ...prev,
        primary: result.extracted.primary,
        surface: result.extracted.surface,
        cta: result.extracted.cta,
        productName: result.extracted.productName,
      }));
      // Refresh parent so the AN reflects the persisted tokens
      onUpdated();
      setEditing(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      setError(msg);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-md border bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Brand tokens · cascades to lo-fi + hi-fi
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && !readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleReferenceUpload}
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
              >
                {extracting ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <ImageIcon className="h-3 w-3 mr-1" />
                )}
                Extract from reference
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={beginEdit}>
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button type="button" size="sm" onClick={save} disabled={saving}>
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
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <ColorRow
            label="Primary"
            value={draft.primary}
            onChange={(v) => setDraft({ ...draft, primary: v })}
          />
          <ColorRow
            label="Surface"
            value={draft.surface}
            onChange={(v) => setDraft({ ...draft, surface: v })}
          />
          <ColorRow
            label="CTA"
            value={draft.cta}
            onChange={(v) => setDraft({ ...draft, cta: v })}
          />
          <div className="flex items-center gap-2 text-xs">
            <label className="text-muted-foreground w-20">Product</label>
            <input
              type="text"
              value={draft.productName}
              onChange={(e) => setDraft({ ...draft, productName: e.target.value })}
              className="flex-1 px-2 py-1 border rounded-md bg-background"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded border" style={{ background: tokens.primary }} />
            <span className="font-mono">{tokens.primary}</span> primary
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded border" style={{ background: tokens.surface }} />
            <span className="font-mono">{tokens.surface}</span> surface
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded border" style={{ background: tokens.cta }} />
            <span className="font-mono">{tokens.cta}</span> CTA
          </div>
          <div className="text-muted-foreground">
            · product: <span className="font-mono">{tokens.productName}</span>
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <label className="text-muted-foreground w-20">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-12 border rounded cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 border rounded-md bg-background font-mono"
        spellCheck={false}
      />
    </div>
  );
}

// ─── Decisions inline editor ─────────────────────────────────────────────────

interface DecisionsInlineEditorProps {
  projectId: string;
  versionId: string;
  decisions: BaAnDecision[];
  /** Open questions are passed so we can append "resolved" rows back from there. */
  openQs: BaAnOpenQuestion[];
  readOnly: boolean;
  onUpdated: () => void;
}

function DecisionsInlineEditor({
  projectId,
  versionId,
  decisions,
  readOnly,
  onUpdated,
}: DecisionsInlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BaAnDecision[]>(decisions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beginEdit = () => {
    setDraft(decisions);
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDiscoveryAnVersion(projectId, versionId, { decisionsLocked: draft });
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
    <div className="p-3 rounded-md border bg-green-50 dark:bg-green-950/30 border-green-300">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 flex items-center">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Decisions Locked ({editing ? draft.length : decisions.length})
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && !readOnly && (
            <Button type="button" size="sm" variant="outline" onClick={beginEdit}>
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {editing && (
            <>
              <Button type="button" size="sm" onClick={save} disabled={saving}>
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
        </div>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          {draft.map((d, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <input
                type="text"
                value={d.question}
                onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...next[i], question: e.target.value };
                  setDraft(next);
                }}
                placeholder="Question"
                className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
              />
              <input
                type="text"
                value={d.decision}
                onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...next[i], decision: e.target.value };
                  setDraft(next);
                }}
                placeholder="Decision"
                className="flex-[2] px-2 py-1 text-xs border rounded-md bg-background"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDraft([...draft, { question: '', decision: '' }])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add decision
          </Button>
        </div>
      ) : decisions.length === 0 ? (
        <div className="text-xs italic text-muted-foreground">No decisions captured yet.</div>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {decisions.map((d, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="p-1.5 text-muted-foreground w-[40%] align-top">{d.question}</td>
                <td className="p-1.5">{d.decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}

// ─── Open questions inline editor (with mark-resolved → decisions) ──────────

interface OpenQuestionsInlineEditorProps {
  projectId: string;
  versionId: string;
  openQs: BaAnOpenQuestion[];
  decisions: BaAnDecision[];
  readOnly: boolean;
  onUpdated: () => void;
}

function OpenQuestionsInlineEditor({
  projectId,
  versionId,
  openQs,
  decisions,
  readOnly,
  onUpdated,
}: OpenQuestionsInlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BaAnOpenQuestion[]>(openQs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingIdx, setResolvingIdx] = useState<number | null>(null);

  const beginEdit = () => {
    setDraft(openQs);
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Re-number sequentially in case of additions/deletions
      const renumbered = draft.map((q, i) => ({ ...q, number: i + 1 }));
      await updateDiscoveryAnVersion(projectId, versionId, { openQuestions: renumbered });
      onUpdated();
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const markResolved = async (idx: number) => {
    const q = openQs[idx];
    if (!q) return;
    setResolvingIdx(idx);
    setError(null);
    try {
      const newDecisions = [...decisions, { question: q.question, decision: q.default || '(resolved — fill in decision)' }];
      const remainingQs = openQs.filter((_, i) => i !== idx).map((qq, i) => ({ ...qq, number: i + 1 }));
      await updateDiscoveryAnVersion(projectId, versionId, {
        decisionsLocked: newDecisions,
        openQuestions: remainingQs,
      });
      onUpdated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Resolve failed';
      setError(msg);
    } finally {
      setResolvingIdx(null);
    }
  };

  return (
    <div className="p-3 rounded-md border bg-amber-50 dark:bg-amber-950/30 border-amber-300">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Open questions ({editing ? draft.length : openQs.length})
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && !readOnly && (
            <Button type="button" size="sm" variant="outline" onClick={beginEdit}>
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {editing && (
            <>
              <Button type="button" size="sm" onClick={save} disabled={saving}>
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
        </div>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          {draft.map((q, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[11px] text-muted-foreground pt-1.5 w-5 text-right shrink-0">
                {i + 1}.
              </span>
              <input
                type="text"
                value={q.question}
                onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...next[i], question: e.target.value };
                  setDraft(next);
                }}
                placeholder="Question"
                className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
              />
              <input
                type="text"
                value={q.default}
                onChange={(e) => {
                  const next = [...draft];
                  next[i] = { ...next[i], default: e.target.value };
                  setDraft(next);
                }}
                placeholder="Default value (optional)"
                className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
                className="text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setDraft([...draft, { number: draft.length + 1, question: '', default: '' }])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Add open question
          </Button>
        </div>
      ) : openQs.length === 0 ? (
        <div className="text-xs italic text-muted-foreground">All open questions resolved.</div>
      ) : (
        <ol className="text-xs space-y-1.5 list-decimal list-inside">
          {openQs.map((q, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <strong>{q.question}</strong>
                {q.default && (
                  <span className="text-muted-foreground"> — default: <em>{q.default}</em></span>
                )}
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => markResolved(i)}
                  disabled={resolvingIdx === i}
                  className="shrink-0 text-green-700 hover:text-green-800 dark:text-green-500"
                  title="Mark resolved — moves to Decisions Locked using the default value"
                >
                  {resolvingIdx === i ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ChevronUp className="h-3 w-3" />
                  )}
                  <span className="ml-1 text-[10px]">Resolve</span>
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}

// ─── §12 PRD-Readiness Bridge inline editor ──────────────────────────────────
// Structured editor for the §12 sub-sections. Each tab targets one PRD
// template section so a downstream PRD generator can lift the data without
// manual re-keying. Persists via PATCH /approach-note/versions/:versionId
// with `{ prdReadiness: <partial> }` — backend shallow-merges with the
// existing JSON.

type PrdTab =
  | 'actors'
  | 'integrations'
  | 'journeys'
  | 'landscape'
  | 'uiux'
  | 'compliance'
  | 'testing'
  | 'deliverables'
  | 'receivables'
  | 'environments'
  | 'misc';

interface PrdReadinessInlineEditorProps {
  projectId: string;
  versionId: string;
  prdReadiness: BaAnPrdReadiness;
  readOnly: boolean;
  onUpdated: () => void;
}

function PrdReadinessInlineEditor({
  projectId,
  versionId,
  prdReadiness,
  readOnly,
  onUpdated,
}: PrdReadinessInlineEditorProps) {
  const [tab, setTab] = useState<PrdTab>('actors');
  const [draft, setDraft] = useState<BaAnPrdReadiness>(prdReadiness);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft if the upstream prdReadiness changes (e.g. after parent reload).
  useMemo(() => setDraft(prdReadiness), [prdReadiness]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(prdReadiness), [draft, prdReadiness]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDiscoveryAnVersion(projectId, versionId, { prdReadiness: draft });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: PrdTab; label: string; count: number }[] = [
    { id: 'actors', label: '12.1 Actors', count: draft.actors.length },
    { id: 'integrations', label: '12.2 Integrations', count: draft.integrations.length },
    { id: 'journeys', label: '12.3 Journeys', count: draft.customerJourneys.length },
    { id: 'landscape', label: '12.4 Landscape', count: draft.functionalLandscape.length },
    { id: 'uiux', label: '12.5 UI/UX', count: 0 },
    { id: 'compliance', label: '12.6 Compliance', count: draft.complianceRequirements.length },
    { id: 'testing', label: '12.7 Testing', count: 0 },
    { id: 'deliverables', label: '12.8 Deliverables', count: draft.keyDeliverables.length },
    { id: 'receivables', label: '12.9 Receivables', count: draft.receivables.length },
    { id: 'environments', label: '12.10 Envs', count: draft.environmentList.length },
    { id: 'misc', label: '12.11 Misc', count: 0 },
  ];

  return (
    <div className="rounded-md border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          PRD-Readiness Bridge · structured for downstream PRD bootstrap
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(prdReadiness)} disabled={!dirty || saving}>
            <X className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!dirty || saving || readOnly}>
            {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save §12
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'text-[11px] px-2 py-1 rounded-md border',
              tab === t.id
                ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-500 font-semibold'
                : 'border-transparent hover:bg-muted',
            )}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'actors' && (
        <ActorsTab
          rows={draft.actors}
          onChange={(actors) => setDraft({ ...draft, actors })}
          readOnly={readOnly}
        />
      )}
      {tab === 'integrations' && (
        <IntegrationsTab
          rows={draft.integrations}
          onChange={(integrations) => setDraft({ ...draft, integrations })}
          readOnly={readOnly}
        />
      )}
      {tab === 'journeys' && (
        <JourneysTab
          rows={draft.customerJourneys}
          onChange={(customerJourneys) => setDraft({ ...draft, customerJourneys })}
          readOnly={readOnly}
        />
      )}
      {tab === 'landscape' && (
        <LandscapeTab
          rows={draft.functionalLandscape}
          onChange={(functionalLandscape) => setDraft({ ...draft, functionalLandscape })}
          readOnly={readOnly}
        />
      )}
      {tab === 'uiux' && (
        <UiUxTab
          value={draft.uiUxRequirements}
          onChange={(uiUxRequirements) => setDraft({ ...draft, uiUxRequirements })}
          readOnly={readOnly}
        />
      )}
      {tab === 'compliance' && (
        <ComplianceTab
          rows={draft.complianceRequirements}
          onChange={(complianceRequirements) => setDraft({ ...draft, complianceRequirements })}
          readOnly={readOnly}
        />
      )}
      {tab === 'testing' && (
        <TestingTab
          value={draft.testingRequirements}
          onChange={(testingRequirements) => setDraft({ ...draft, testingRequirements })}
          readOnly={readOnly}
        />
      )}
      {tab === 'deliverables' && (
        <SimpleListTab
          label="Key deliverable"
          items={draft.keyDeliverables}
          onChange={(keyDeliverables) => setDraft({ ...draft, keyDeliverables })}
          readOnly={readOnly}
        />
      )}
      {tab === 'receivables' && (
        <ReceivablesTab
          rows={draft.receivables}
          onChange={(receivables) => setDraft({ ...draft, receivables })}
          readOnly={readOnly}
        />
      )}
      {tab === 'environments' && (
        <EnvironmentsTab
          rows={draft.environmentList}
          onChange={(environmentList) => setDraft({ ...draft, environmentList })}
          readOnly={readOnly}
        />
      )}
      {tab === 'misc' && (
        <MiscTab
          value={draft.miscellaneous}
          onChange={(miscellaneous) => setDraft({ ...draft, miscellaneous })}
          readOnly={readOnly}
        />
      )}

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}

// ─── PRD-Readiness sub-tabs ──────────────────────────────────────────────────

interface RowEditorProps<T> {
  rows: T[];
  onChange: (rows: T[]) => void;
  readOnly: boolean;
}

function ActorsTab({ rows, onChange, readOnly }: RowEditorProps<BaAnActor>) {
  const update = (i: number, patch: Partial<BaAnActor>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...rows, { role: '', type: 'internal', description: '', permissions: '' }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs italic text-muted-foreground">No actors yet. Add the user types and personas.</div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_120px_1.5fr_1fr_36px] gap-2 items-start">
          <input
            type="text"
            placeholder="Role (e.g. Customer)"
            value={r.role}
            onChange={(e) => update(i, { role: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <select
            value={r.type}
            onChange={(e) => update(i, { type: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          >
            <option value="internal">internal</option>
            <option value="external">external</option>
            <option value="system">system</option>
          </select>
          <input
            type="text"
            placeholder="Description"
            value={r.description}
            onChange={(e) => update(i, { description: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Permissions"
            value={r.permissions}
            onChange={(e) => update(i, { permissions: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={readOnly}>
        <Plus className="h-3 w-3 mr-1" />
        Add actor
      </Button>
    </div>
  );
}

function IntegrationsTab({ rows, onChange, readOnly }: RowEditorProps<BaAnIntegration>) {
  const update = (i: number, patch: Partial<BaAnIntegration>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...rows, { name: '', type: 'API', purpose: '', criticality: 'must-have', phase: 'Phase 1' }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs italic text-muted-foreground">No integrations yet. List third-party APIs / SDKs / SSO / payments.</div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_120px_1.5fr_120px_100px_36px] gap-2 items-start">
          <input
            type="text"
            placeholder="Name (e.g. Razorpay)"
            value={r.name}
            onChange={(e) => update(i, { name: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Type"
            value={r.type}
            onChange={(e) => update(i, { type: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Purpose"
            value={r.purpose}
            onChange={(e) => update(i, { purpose: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <select
            value={r.criticality}
            onChange={(e) => update(i, { criticality: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          >
            <option value="must-have">must-have</option>
            <option value="nice-to-have">nice-to-have</option>
          </select>
          <select
            value={r.phase}
            onChange={(e) => update(i, { phase: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          >
            <option value="Phase 1">Phase 1</option>
            <option value="Phase 2">Phase 2</option>
          </select>
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={readOnly}>
        <Plus className="h-3 w-3 mr-1" />
        Add integration
      </Button>
    </div>
  );
}

function JourneysTab({ rows, onChange, readOnly }: RowEditorProps<BaAnCustomerJourney>) {
  const update = (i: number, patch: Partial<BaAnCustomerJourney>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([
      ...rows,
      { name: '', primaryActor: '', trigger: '', steps: [], successOutcome: '', failureModes: [] },
    ]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <div className="text-xs italic text-muted-foreground">
          No customer journeys yet. Add the major user flows (onboarding, purchase, etc.).
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="rounded-md border bg-background p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              placeholder="Journey name (e.g. First-time customer onboarding)"
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              disabled={readOnly}
              className="flex-1 text-xs font-semibold px-2 py-1 border rounded-md bg-background"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Primary actor"
              value={r.primaryActor}
              onChange={(e) => update(i, { primaryActor: e.target.value })}
              disabled={readOnly}
              className="text-xs px-2 py-1 border rounded-md bg-background"
            />
            <input
              type="text"
              placeholder="Trigger"
              value={r.trigger}
              onChange={(e) => update(i, { trigger: e.target.value })}
              disabled={readOnly}
              className="text-xs px-2 py-1 border rounded-md bg-background"
            />
          </div>
          <textarea
            placeholder="Steps (one per line)"
            value={r.steps.join('\n')}
            onChange={(e) =>
              update(i, { steps: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
            }
            disabled={readOnly}
            rows={3}
            className="w-full text-xs px-2 py-1 border rounded-md bg-background font-mono"
          />
          <input
            type="text"
            placeholder="Success outcome"
            value={r.successOutcome}
            onChange={(e) => update(i, { successOutcome: e.target.value })}
            disabled={readOnly}
            className="w-full text-xs px-2 py-1 border rounded-md bg-background"
          />
          <textarea
            placeholder="Failure modes (one per line)"
            value={r.failureModes.join('\n')}
            onChange={(e) =>
              update(i, { failureModes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
            }
            disabled={readOnly}
            rows={2}
            className="w-full text-xs px-2 py-1 border rounded-md bg-background"
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={readOnly}>
        <Plus className="h-3 w-3 mr-1" />
        Add journey
      </Button>
    </div>
  );
}

function LandscapeTab({ rows, onChange, readOnly }: RowEditorProps<BaAnFunctionalLandscapeRow>) {
  const update = (i: number, patch: Partial<BaAnFunctionalLandscapeRow>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...rows, { module: '', purpose: '', frRefs: [] }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs italic text-muted-foreground">No modules yet. Group features into product modules.</div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1.5fr_36px] gap-2 items-start">
          <input
            type="text"
            placeholder="Module"
            value={r.module}
            onChange={(e) => update(i, { module: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Purpose"
            value={r.purpose}
            onChange={(e) => update(i, { purpose: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="FR refs (comma-separated, e.g. FR-1, FR-2)"
            value={r.frRefs.join(', ')}
            onChange={(e) =>
              update(i, { frRefs: e.target.value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) })
            }
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background font-mono"
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={readOnly}>
        <Plus className="h-3 w-3 mr-1" />
        Add module
      </Button>
    </div>
  );
}

interface UiUxTabProps {
  value: BaAnPrdReadiness['uiUxRequirements'];
  onChange: (next: BaAnPrdReadiness['uiUxRequirements']) => void;
  readOnly: boolean;
}

function UiUxTab({ value, onChange, readOnly }: UiUxTabProps) {
  const fields: { key: keyof BaAnPrdReadiness['uiUxRequirements']; label: string; placeholder: string }[] = [
    { key: 'interactionPatterns', label: 'Interaction patterns', placeholder: 'Mobile-first, voice-assisted' },
    { key: 'accessibility', label: 'Accessibility', placeholder: 'WCAG 2.1 AA on top 10 screens' },
    { key: 'responsive', label: 'Responsive', placeholder: 'Mobile / tablet / desktop breakpoints' },
    { key: 'emptyErrorStates', label: 'Empty / error states', placeholder: 'Polite recovery prompts' },
    { key: 'microcopyTone', label: 'Microcopy tone', placeholder: 'Friendly + concise' },
    { key: 'internationalization', label: 'Internationalization', placeholder: 'en-IN + hi-IN locales; ₹' },
  ];
  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <label key={f.key} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2 items-center text-xs">
          <span className="text-muted-foreground">{f.label}</span>
          <input
            type="text"
            placeholder={f.placeholder}
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
        </label>
      ))}
    </div>
  );
}

function ComplianceTab({ rows, onChange, readOnly }: RowEditorProps<BaAnComplianceRow>) {
  const update = (i: number, patch: Partial<BaAnComplianceRow>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...rows, { standard: '', applicability: 'in-scope', phase1Controls: '' }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs italic text-muted-foreground">
          No compliance entries yet. List GDPR / DPDP / HIPAA / SOC2 / PCI-DSS / ISO 27001 etc. as applicable.
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_140px_2fr_36px] gap-2 items-start">
          <input
            type="text"
            placeholder="Standard"
            value={r.standard}
            onChange={(e) => update(i, { standard: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <select
            value={r.applicability}
            onChange={(e) => update(i, { applicability: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          >
            <option value="in-scope">in-scope</option>
            <option value="partial">partial</option>
            <option value="out-of-scope">out-of-scope</option>
          </select>
          <input
            type="text"
            placeholder="Phase 1 controls"
            value={r.phase1Controls}
            onChange={(e) => update(i, { phase1Controls: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={readOnly}>
        <Plus className="h-3 w-3 mr-1" />
        Add compliance entry
      </Button>
    </div>
  );
}

interface TestingTabProps {
  value: BaAnPrdReadiness['testingRequirements'];
  onChange: (next: BaAnPrdReadiness['testingRequirements']) => void;
  readOnly: boolean;
}

function TestingTab({ value, onChange, readOnly }: TestingTabProps) {
  const types: { key: keyof BaAnPrdReadiness['testingRequirements']; label: string }[] = [
    { key: 'unit', label: 'Unit' },
    { key: 'integration', label: 'Integration' },
    { key: 'e2e', label: 'E2E' },
    { key: 'evalHarness', label: 'Eval harness (LLM)' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'performance', label: 'Performance' },
    { key: 'security', label: 'Security' },
  ];
  return (
    <div className="space-y-2">
      {types.map((t) => {
        const row = value[t.key];
        return (
          <div key={t.key} className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_1fr] gap-2 items-center">
            <span className="text-xs font-semibold text-muted-foreground">{t.label}</span>
            <input
              type="text"
              placeholder="Coverage target"
              value={row.coverageTarget}
              onChange={(e) =>
                onChange({ ...value, [t.key]: { ...row, coverageTarget: e.target.value } })
              }
              disabled={readOnly}
              className="text-xs px-2 py-1 border rounded-md bg-background"
            />
            <input
              type="text"
              placeholder="Tools"
              value={row.tools}
              onChange={(e) => onChange({ ...value, [t.key]: { ...row, tools: e.target.value } })}
              disabled={readOnly}
              className="text-xs px-2 py-1 border rounded-md bg-background"
            />
            <input
              type="text"
              placeholder="Owner"
              value={row.owner}
              onChange={(e) => onChange({ ...value, [t.key]: { ...row, owner: e.target.value } })}
              disabled={readOnly}
              className="text-xs px-2 py-1 border rounded-md bg-background"
            />
          </div>
        );
      })}
    </div>
  );
}

interface SimpleListTabProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
}

function SimpleListTab({ label, items, onChange, readOnly }: SimpleListTabProps) {
  return (
    <div className="space-y-2">
      <textarea
        placeholder={`One ${label} per line (e.g. AN v(final), Source repo, Eval report …)`}
        value={items.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        disabled={readOnly}
        rows={6}
        className="w-full text-xs px-2 py-1 border rounded-md bg-background font-mono"
      />
      <div className="text-[10px] text-muted-foreground">{items.length} item(s).</div>
    </div>
  );
}

function ReceivablesTab({ rows, onChange, readOnly }: RowEditorProps<BaAnReceivable>) {
  const update = (i: number, patch: Partial<BaAnReceivable>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () => onChange([...rows, { item: '', ownerClient: '', neededByWeek: null, blocking: false }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs italic text-muted-foreground">
          No receivables yet. List things the client must provide (data, access, sign-offs).
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_100px_80px_36px] gap-2 items-center">
          <input
            type="text"
            placeholder="Item (e.g. Brand assets)"
            value={r.item}
            onChange={(e) => update(i, { item: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Client owner"
            value={r.ownerClient}
            onChange={(e) => update(i, { ownerClient: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="number"
            min={1}
            placeholder="Week #"
            value={r.neededByWeek ?? ''}
            onChange={(e) =>
              update(i, { neededByWeek: e.target.value === '' ? null : Number(e.target.value) })
            }
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={r.blocking}
              onChange={(e) => update(i, { blocking: e.target.checked })}
              disabled={readOnly}
            />
            Blocking
          </label>
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={readOnly}>
        <Plus className="h-3 w-3 mr-1" />
        Add receivable
      </Button>
    </div>
  );
}

function EnvironmentsTab({ rows, onChange, readOnly }: RowEditorProps<BaAnEnvironment>) {
  const update = (i: number, patch: Partial<BaAnEnvironment>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([...rows, { environment: '', purpose: '', phase1Hosting: '', phase2Hosting: '' }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs italic text-muted-foreground">
          No environments yet. List dev / staging / prod / DR.
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[120px_1.5fr_1fr_1fr_36px] gap-2 items-start">
          <input
            type="text"
            placeholder="Env (dev/staging/prod/dr)"
            value={r.environment}
            onChange={(e) => update(i, { environment: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Purpose"
            value={r.purpose}
            onChange={(e) => update(i, { purpose: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Phase 1 hosting"
            value={r.phase1Hosting}
            onChange={(e) => update(i, { phase1Hosting: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <input
            type="text"
            placeholder="Phase 2 hosting"
            value={r.phase2Hosting}
            onChange={(e) => update(i, { phase2Hosting: e.target.value })}
            disabled={readOnly}
            className="text-xs px-2 py-1 border rounded-md bg-background"
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} disabled={readOnly}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add} disabled={readOnly}>
        <Plus className="h-3 w-3 mr-1" />
        Add environment
      </Button>
    </div>
  );
}

interface MiscTabProps {
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
}

function MiscTab({ value, onChange, readOnly }: MiscTabProps) {
  return (
    <div className="space-y-2">
      <textarea
        placeholder="Catch-all for product-specific items (referral programs, in-app help, FAQ generation, custom analytics, etc.)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        rows={6}
        className="w-full text-xs px-2 py-1 border rounded-md bg-background"
      />
    </div>
  );
}
