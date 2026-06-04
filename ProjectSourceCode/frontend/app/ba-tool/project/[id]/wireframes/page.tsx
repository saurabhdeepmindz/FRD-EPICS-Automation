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
  uploadWireframes,
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
  const [busy, setBusy] = useState<null | 'lofi' | 'hifi'>(null);
  const [error, setError] = useState<string | null>(null);

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

  const refreshWf = async () => setWf(await getPipelineWireframes(projectId));

  const onGenerate = async (kind: 'lofi' | 'hifi') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'lofi') await generateLoFiWireframes(projectId);
      else await generateHiFiWireframes(projectId);
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
          <Link href={`/ba-tool/project/${projectId}/project-prd`}>
            <Button variant="outline" size="sm">← PRD+FRD</Button>
          </Link>
          <Link href={`/ba-tool/project/${projectId}/hld`}>
            <Button variant="outline" size="sm">HLD →</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Customer-supplied wireframes (reflected from Inputs) */}
            {customer.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800 flex items-start gap-2">
                <Users className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{customer.length}</span> customer-supplied wireframe input(s) on file:{' '}
                  {customer.map((c) => c.fileName ?? c.label).join(', ')}. Upload them below to bring them into this stage.
                </span>
              </div>
            )}

            {/* Step 1 — Mapping */}
            <Section
              step={1}
              title="Screen ↔ Feature Mapping"
              subtitle="Generated from the PRD. Annotations cite PRD §/FR-IDs. Edit rows inline or round-trip via CSV."
            >
              <ScreenMapTable projectId={projectId} map={map} onChanged={setMap} />
            </Section>

            {/* Step 2 — Lo-fi */}
            <Section
              step={2}
              title="Lo-fi Wireframes"
              subtitle="Built deterministically from the mapping (callouts = annotations), or upload 3rd-party files."
              actions={
                <GalleryActions
                  kind="lofi"
                  busy={busy === 'lofi'}
                  hasMap={!!map}
                  onGenerate={() => onGenerate('lofi')}
                  onUpload={(fl) => onUpload(fl, 'lofi')}
                />
              }
            >
              <Gallery screens={wf.lofi} emptyHint="Generate lo-fi from the mapping above, or upload files." />
            </Section>

            {/* Step 3 — Hi-fi */}
            <Section
              step={3}
              title="Hi-fi Wireframes"
              subtitle="Polished branded mockups generated from the lo-fi set, or upload 3rd-party files."
              actions={
                <GalleryActions
                  kind="hifi"
                  busy={busy === 'hifi'}
                  hasMap={wf.lofi.length > 0}
                  generateLabel="Generate from lo-fi"
                  onGenerate={() => onGenerate('hifi')}
                  onUpload={(fl) => onUpload(fl, 'hifi')}
                />
              }
            >
              <Gallery screens={wf.hifi} emptyHint="Generate hi-fi from the lo-fi set, or upload files." />
            </Section>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 shrink-0" />
              Mapping → <code className="text-xs">02b-ScreenMap/</code> · lo-fi → <code className="text-xs">03-Wireframes-LoFi/</code> · hi-fi → <code className="text-xs">04-Wireframes-HiFi/</code>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  step,
  title,
  subtitle,
  actions,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="h-7 w-7 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center justify-center shrink-0">
          {step}
        </span>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
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

function Gallery({ screens, emptyHint }: { screens: PipelineWireframeScreen[]; emptyHint: string }) {
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
      {screens.map((s) => (
        <div key={s.id} className="border rounded-lg overflow-hidden bg-white">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
            <span className="text-sm font-medium text-gray-800 truncate" title={s.title}>
              {s.title}
            </span>
            {s.uploaded && (
              <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                uploaded
              </span>
            )}
          </div>
          <iframe
            title={s.title}
            sandbox=""
            srcDoc={s.htmlContent ?? '<p style="font:13px system-ui;color:#999;padding:12px">No preview</p>'}
            className="w-full h-64 bg-white"
          />
        </div>
      ))}
    </div>
  );
}
