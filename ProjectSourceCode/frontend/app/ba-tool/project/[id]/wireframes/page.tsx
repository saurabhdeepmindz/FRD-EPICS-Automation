'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  LayoutTemplate,
  Loader2,
  Sparkles,
  RefreshCw,
  Upload,
  FolderOpen,
  Image as ImageIcon,
  Users,
  Palette,
  LayoutGrid,
  Download,
  Wand2,
  ExternalLink,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScreenMapTable } from '@/components/ba-tool/ScreenMapTable';
import {
  getScreenMap,
  getPipelineWireframes,
  getCustomerWireframes,
  generateLoFiWireframes,
  generateHiFiWireframes,
  regenerateLoFiWithAI,
  setLoFiVariant,
  uploadWireframes,
  getWireframeNavigator,
  wireframeZipUrl,
  type ScreenMap,
  type PipelineWireframes,
  type PipelineWireframeScreen,
  type CustomerWireframeRef,
} from '@/lib/pipeline-api';

const UPLOAD_ACCEPT = '.html,.htm,.png,.jpg,.jpeg,.svg,.pdf';

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err instanceof Error ? err.message : 'Request failed')
  );
}

export default function WireframesPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [map, setMap] = useState<ScreenMap | null>(null);
  const [wf, setWf] = useState<PipelineWireframes>({ lofi: [], hifi: [] });
  const [customer, setCustomer] = useState<CustomerWireframeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'lofi' | 'hifi' | 'ai-lofi'>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalScreen, setModalScreen] = useState<PipelineWireframeScreen | null>(null);
  const [activeStage, setActiveStage] = useState<'mapping' | 'lofi' | 'hifi'>('mapping');
  const initedStage = useRef(false);

  const toggleSelected = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, w, c] = await Promise.all([
        getScreenMap(projectId),
        getPipelineWireframes(projectId),
        getCustomerWireframes(projectId),
      ]);
      setMap(m);
      setWf(w);
      setCustomer(c);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Land on the furthest stage that has content (returning users see their work).
  useEffect(() => {
    if (loading || initedStage.current) return;
    initedStage.current = true;
    setActiveStage(wf.hifi.length ? 'hifi' : wf.lofi.length ? 'lofi' : 'mapping');
  }, [loading, wf]);

  const refreshWf = async () => setWf(await getPipelineWireframes(projectId));

  const onGenerate = async (kind: 'lofi' | 'hifi') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'lofi') {
        await generateLoFiWireframes(projectId);
      } else {
        // Hi-fi for the selected lo-fi screens, or the whole set if none picked.
        const slugs = selected.size ? [...selected] : undefined;
        await generateHiFiWireframes(projectId, { slugs });
      }
      await refreshWf();
      setActiveStage(kind); // jump to the stage we just produced
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const onSetVariant = async (slug: string, variant: 'deterministic' | 'ai') => {
    // optimistic update, then persist
    setWf((prev) => ({
      ...prev,
      lofi: prev.lofi.map((s) => (s.slug === slug ? { ...s, activeVariant: variant } : s)),
    }));
    setModalScreen((m) => (m && m.slug === slug ? { ...m, activeVariant: variant } : m));
    try {
      await setLoFiVariant(projectId, slug, variant);
    } catch (err) {
      setError(errMsg(err));
      await refreshWf();
    }
  };

  const onRegenAiLoFi = async () => {
    setBusy('ai-lofi');
    setError(null);
    try {
      const slugs = selected.size ? [...selected] : undefined;
      const res = await regenerateLoFiWithAI(projectId, slugs);
      if (res.failed.length) setError(`AI lo-fi updated ${res.updated}; failed: ${res.failed.join(', ')}`);
      await refreshWf();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (files: FileList | null, kind: 'lofi' | 'hifi') => {
    if (!files?.length) return;
    setError(null);
    try {
      const res = await uploadWireframes(projectId, Array.from(files), kind);
      if (res.rejected.length) setError(`Skipped: ${res.rejected.join('; ')}`);
      await refreshWf();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const openNavigator = async (kind: 'lofi' | 'hifi') => {
    setError(null);
    try {
      const html = await getWireframeNavigator(projectId, kind);
      const w = window.open('', '_blank');
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Link href={`/ba-tool/project/${projectId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Project
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5 text-gray-700" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Wireframes</h1>
            <p className="text-sm text-gray-500">PRD-sourced · screen↔feature mapping → lo-fi → hi-fi</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/ba-tool/project/${projectId}/design-system`}>
            <Button variant="outline" size="sm"><Palette className="h-4 w-4 mr-1" /> Design System</Button>
          </Link>
          {(wf.lofi.length > 0 || wf.hifi.length > 0) && (
            <>
              <Button variant="outline" size="sm" onClick={() => openNavigator(wf.hifi.length > 0 ? 'hifi' : 'lofi')}>
                <LayoutGrid className="h-4 w-4 mr-1" /> Open navigator
              </Button>
              <a href={wireframeZipUrl(projectId, wf.hifi.length > 0 ? 'hifi' : 'lofi')}>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Zip</Button>
              </a>
            </>
          )}
          <Link href={`/ba-tool/project/${projectId}/hld`}>
            <Button variant="outline" size="sm">HLD →</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
            {/* Left stepper rail */}
            <StageRail
              active={activeStage}
              onSelect={setActiveStage}
              mapDone={!!map}
              mapCount={map?.rows.length ?? 0}
              orphan={map?.coverage?.orphanFrs?.length ?? 0}
              lofiCount={wf.lofi.length}
              lofiAi={wf.lofi.filter((s) => s.aiHtmlContent).length}
              hifiCount={wf.hifi.length}
              selectedCount={selected.size}
            />

            {/* Active stage panel */}
            <div className="space-y-4 min-w-0">
              {activeStage === 'mapping' && (
                <Panel
                  title="Screen ↔ Feature Mapping"
                  subtitle="Generated from the PRD. Annotations cite PRD §/FR-IDs. Edit rows inline or round-trip via CSV."
                >
                  <ScreenMapTable projectId={projectId} map={map} onChanged={setMap} />
                </Panel>
              )}

              {activeStage === 'lofi' && (
                !map ? (
                  <LockedNote title="Lo-fi Wireframes" hint="Generate the Screen ↔ Feature Mapping first." onGo={() => setActiveStage('mapping')} goLabel="Go to Mapping" />
                ) : (
                  <Panel
                    title="Lo-fi Wireframes"
                    subtitle="Type-aware grey-box skeletons from the mapping (default, free). Tick screens to AI-upgrade or carry into hi-fi. Click a card to open / compare."
                    actions={
                      <div className="flex items-center gap-2 shrink-0">
                        {wf.lofi.length > 0 && (
                          <Button size="sm" variant="outline" onClick={onRegenAiLoFi} disabled={busy !== null}
                            title="Regenerate selected lo-fi screens with AI (Claude grey-box); all generated screens if none selected">
                            {busy === 'ai-lofi' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                            AI lo-fi{selected.size ? ` (${selected.size})` : ''}
                          </Button>
                        )}
                        <GalleryActions kind="lofi" busy={busy === 'lofi'} hasMap={!!map} onGenerate={() => onGenerate('lofi')} onUpload={(fl) => onUpload(fl, 'lofi')} />
                      </div>
                    }
                  >
                    {customer.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800 flex items-start gap-2 mb-4">
                        <Users className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          <span className="font-medium">{customer.length}</span> customer-supplied wireframe input(s) on file:{' '}
                          {customer.map((c) => c.fileName ?? c.label).join(', ')}. Use Upload to bring them into this stage.
                        </span>
                      </div>
                    )}
                    <Gallery
                      screens={wf.lofi}
                      emptyHint="Generate lo-fi from the mapping, or upload files."
                      selectable
                      selected={selected}
                      onToggle={toggleSelected}
                      onOpen={setModalScreen}
                      onSetVariant={onSetVariant}
                    />
                  </Panel>
                )
              )}

              {activeStage === 'hifi' && (
                wf.lofi.length === 0 ? (
                  <LockedNote title="Hi-fi Wireframes" hint="Generate Lo-fi wireframes first." onGo={() => setActiveStage('lofi')} goLabel="Go to Lo-fi" />
                ) : (
                  <Panel
                    title="Hi-fi Wireframes"
                    subtitle={selected.size
                      ? `Will generate hi-fi for the ${selected.size} selected lo-fi screen(s).`
                      : 'Polished branded mockups (Claude). Tick lo-fi screens to limit hi-fi to those; otherwise the whole set.'}
                    actions={
                      <GalleryActions
                        kind="hifi"
                        busy={busy === 'hifi'}
                        hasMap={wf.lofi.length > 0}
                        generateLabel={selected.size ? `Generate hi-fi (${selected.size})` : 'Generate from lo-fi'}
                        onGenerate={() => onGenerate('hifi')}
                        onUpload={(fl) => onUpload(fl, 'hifi')}
                      />
                    }
                  >
                    <Gallery screens={wf.hifi} emptyHint="Generate hi-fi from the lo-fi set, or upload files." onOpen={setModalScreen} />
                  </Panel>
                )
              )}

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 shrink-0" />
                Mapping → <code className="text-xs">02b-ScreenMap/</code> · lo-fi → <code className="text-xs">03-Wireframes-LoFi/</code> · hi-fi → <code className="text-xs">04-Wireframes-HiFi/</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click-to-open modal (GG-01) */}
      {modalScreen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setModalScreen(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-2.5 border-b">
              <span className="font-medium text-gray-900 truncate">{modalScreen.title}</span>
              <span className="text-xs text-gray-400 font-mono">{modalScreen.slug}</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const w = window.open('', '_blank');
                    if (w) { w.document.open(); w.document.write(modalScreen.htmlContent ?? ''); w.document.close(); }
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> New tab
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setModalScreen(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            {modalScreen.aiHtmlContent ? (
              // Side-by-side compare (HH-02): deterministic vs AI, with "Set active".
              <div className="flex-1 grid grid-cols-2 gap-px bg-gray-200 overflow-hidden rounded-b-lg">
                {(['deterministic', 'ai'] as const).map((v) => {
                  const isActive = (modalScreen.activeVariant === 'ai' ? 'ai' : 'deterministic') === v;
                  const html = v === 'ai' ? modalScreen.aiHtmlContent : modalScreen.htmlContent;
                  return (
                    <div key={v} className="flex flex-col bg-white min-h-0">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-gray-50">
                        <span className="text-xs font-semibold text-gray-700">{v === 'ai' ? 'AI' : 'Deterministic'}</span>
                        {isActive ? (
                          <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">active</span>
                        ) : (
                          <button
                            className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded bg-gray-900 text-white"
                            onClick={() => onSetVariant(modalScreen.slug, v)}
                          >
                            Set active
                          </button>
                        )}
                      </div>
                      <iframe
                        title={`${modalScreen.title} (${v})`}
                        sandbox=""
                        srcDoc={html ?? '<p style="font:13px system-ui;color:#999;padding:16px">No preview</p>'}
                        className="flex-1 w-full bg-white"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <iframe
                title={modalScreen.title}
                sandbox=""
                srcDoc={modalScreen.htmlContent ?? '<p style="font:13px system-ui;color:#999;padding:16px">No preview</p>'}
                className="flex-1 w-full rounded-b-lg bg-white"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface StageRailProps {
  active: 'mapping' | 'lofi' | 'hifi';
  onSelect: (s: 'mapping' | 'lofi' | 'hifi') => void;
  mapDone: boolean;
  mapCount: number;
  orphan: number;
  lofiCount: number;
  lofiAi: number;
  hifiCount: number;
  selectedCount: number;
}

function StageRail(p: StageRailProps) {
  const lofiLocked = !p.mapDone;
  const hifiLocked = p.lofiCount === 0;
  const stages = [
    {
      key: 'mapping' as const, n: 1, title: 'Screen ↔ Feature Mapping', locked: false,
      done: p.mapDone,
      status: p.mapDone ? `${p.mapCount} screens · ${p.orphan} unmapped` : 'Not generated',
    },
    {
      key: 'lofi' as const, n: 2, title: 'Lo-fi Wireframes', locked: lofiLocked,
      done: p.lofiCount > 0,
      status: lofiLocked ? 'Needs mapping' : p.lofiCount > 0 ? `${p.lofiCount} screens${p.lofiAi ? ` · ${p.lofiAi} AI` : ''}` : 'Not generated',
    },
    {
      key: 'hifi' as const, n: 3, title: 'Hi-fi Wireframes', locked: hifiLocked,
      done: p.hifiCount > 0,
      status: hifiLocked ? 'Needs lo-fi' : p.hifiCount > 0 ? `${p.hifiCount} of ${p.lofiCount}` : 'Not generated',
    },
  ];
  return (
    <aside className="lg:sticky lg:top-6 space-y-1.5">
      {stages.map((s) => {
        const isActive = p.active === s.key;
        return (
          <button
            key={s.key}
            onClick={() => p.onSelect(s.key)}
            className={`w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
              isActive ? 'border-gray-900 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white hover:border-gray-200'
            } ${s.locked ? 'opacity-60' : ''}`}
          >
            <span className={`mt-0.5 h-6 w-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center ${
              s.done ? 'bg-emerald-500 text-white' : isActive ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {s.locked ? '🔒' : s.done ? '✓' : s.n}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>{s.title}</span>
              <span className="block text-xs text-gray-400">{s.status}</span>
            </span>
          </button>
        );
      })}
      {p.selectedCount > 0 && (
        <div className="mt-2 rounded-lg bg-gray-900 text-white text-xs px-3 py-2">
          <b>{p.selectedCount}</b> screen{p.selectedCount === 1 ? '' : 's'} selected → AI lo-fi / hi-fi
        </div>
      )}
    </aside>
  );
}

function Panel({ title, subtitle, actions, children }: { title: string; subtitle: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function LockedNote({ title, hint, onGo, goLabel }: { title: string; hint: string; onGo: () => void; goLabel: string }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <div className="text-3xl">🔒</div>
          <p className="text-sm text-gray-600">{hint}</p>
          <Button size="sm" variant="outline" onClick={onGo}>{goLabel}</Button>
        </CardContent>
      </Card>
    </section>
  );
}

function GalleryActions({
  kind,
  busy,
  hasMap,
  generateLabel = 'Generate',
  onGenerate,
  onUpload,
}: {
  kind: 'lofi' | 'hifi';
  busy: boolean;
  hasMap: boolean;
  generateLabel?: string;
  onGenerate: () => void;
  onUpload: (files: FileList | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button size="sm" onClick={onGenerate} disabled={busy || !hasMap} title={hasMap ? '' : 'Complete the previous step first'}>
        {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
        {generateLabel}
      </Button>
      <Button size="sm" variant="outline" onClick={() => ref.current?.click()}>
        <Upload className="h-4 w-4 mr-1" /> Upload
      </Button>
      <input
        ref={ref}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          onUpload(e.target.files);
          e.target.value = '';
        }}
        data-kind={kind}
      />
    </div>
  );
}

function Gallery({
  screens,
  emptyHint,
  selectable,
  selected,
  onToggle,
  onOpen,
  onSetVariant,
}: {
  screens: PipelineWireframeScreen[];
  emptyHint: string;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (slug: string) => void;
  onOpen?: (screen: PipelineWireframeScreen) => void;
  onSetVariant?: (slug: string, variant: 'deterministic' | 'ai') => void;
}) {
  if (!screens.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
          <ImageIcon className="h-6 w-6 text-gray-300" />
          {emptyHint}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {screens.map((s) => {
        const isSel = !!selected?.has(s.slug);
        const hasAi = !!s.aiHtmlContent;
        const active = s.activeVariant === 'ai' && hasAi ? 'ai' : 'deterministic';
        const shownHtml = active === 'ai' ? s.aiHtmlContent : s.htmlContent;
        return (
          <div key={s.id} className={`border rounded-lg overflow-hidden bg-white transition ${isSel ? 'ring-2 ring-gray-900 border-gray-900' : ''}`}>
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
              {selectable && (
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-gray-900"
                  checked={isSel}
                  onChange={() => onToggle?.(s.slug)}
                  title="Select for AI lo-fi / hi-fi"
                />
              )}
              <span className="text-sm font-medium text-gray-800 truncate flex-1" title={s.title}>
                {s.title}
              </span>
              {s.uploaded && (
                <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">uploaded</span>
              )}
            </div>
            {/* Variant toggle (only when an AI variant exists). Sets the active variant. */}
            {hasAi && onSetVariant && (
              <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-white">
                <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Variant</span>
                {(['deterministic', 'ai'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onSetVariant(s.slug, v)}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded ${active === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title={`Use the ${v} variant (drives navigator/export)`}
                  >
                    {v === 'ai' ? 'AI' : 'Deterministic'}{active === v ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            )}
            {/* Preview is click-to-open; an overlay captures the click (iframe is inert). */}
            <button
              type="button"
              className="relative block w-full h-64 bg-white group"
              onClick={() => onOpen?.(s)}
              title="Open screen"
            >
              <iframe
                title={s.title}
                sandbox=""
                srcDoc={shownHtml ?? '<p style="font:13px system-ui;color:#999;padding:12px">No preview</p>'}
                className="w-full h-full bg-white pointer-events-none"
              />
              <span className="absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
                {active === 'ai' ? 'AI' : 'Deterministic'}
              </span>
              <span className="absolute inset-0 group-hover:bg-gray-900/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <span className="text-xs font-medium bg-gray-900 text-white px-2 py-1 rounded">Open{hasAi ? ' / compare' : ''}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
