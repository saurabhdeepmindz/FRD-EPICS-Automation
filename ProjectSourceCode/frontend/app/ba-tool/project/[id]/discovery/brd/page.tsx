'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  getLatestDiscoveryWft,
  getLatestDiscoveryBrd,
  generateDiscoveryBrd,
  regenerateDiscoveryBrd,
  updateDiscoveryBrd,
  type BaProject,
  type BaWft,
  type BaBrd,
  type BaBrdAudience,
} from '@/lib/ba-api';
import { BrdEditor } from '@/components/ba-tool/discovery/BrdEditor';

export default function DiscoveryBrdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [wft, setWft] = useState<BaWft | null>(null);
  const [brd, setBrd] = useState<BaBrd | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [productName, setProductName] = useState('');
  const [audience, setAudience] = useState<BaBrdAudience>('internal-tool');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  /** Auto-save indicator for the productName + audience metadata fields. */
  const [savingMeta, setSavingMeta] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const reload = useCallback(async () => {
    try {
      const [latestWft, latestBrd] = await Promise.all([
        getLatestDiscoveryWft(projectId),
        getLatestDiscoveryBrd(projectId),
      ]);
      setWft(latestWft);
      setBrd(latestBrd);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh data';
      setPageError(msg);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, latestWft, latestBrd] = await Promise.all([
          getBaProject(projectId),
          getLatestDiscoveryWft(projectId),
          getLatestDiscoveryBrd(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setWft(latestWft);
        setBrd(latestBrd);
        // Hydrate the metadata inputs: prefer values already persisted on the
        // BRD (so users see their own prior edits), then fall back to project.
        const hydratedProductName =
          (latestBrd?.meta?.productName as string | null | undefined) ?? p.productName ?? '';
        if (hydratedProductName) setProductName(hydratedProductName);
        const hydratedAudience = latestBrd?.meta?.audience as string | undefined;
        if (hydratedAudience === 'internal-tool' || hydratedAudience === 'end-client-product') {
          setAudience(hydratedAudience);
        }
      } catch {
        if (!cancelled) setPageError('Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Debounced auto-save of productName + audience to BRD.meta. Skip when no
  // BRD exists yet (those values will be sent at generate time instead) or
  // while a generation is in flight.
  useEffect(() => {
    if (!brd || generating) return;
    const currentMetaProduct = (brd.meta?.productName as string | null | undefined) ?? '';
    const currentMetaAudience = (brd.meta?.audience as string | null | undefined) ?? '';
    const trimmed = productName.trim();
    if (trimmed === currentMetaProduct && audience === currentMetaAudience) {
      return; // nothing changed — skip
    }
    setSavingMeta('saving');
    const handle = setTimeout(async () => {
      try {
        const updated = await updateDiscoveryBrd(projectId, brd.id, {
          productName: trimmed,
          audience,
        });
        setBrd(updated);
        setSavingMeta('saved');
        setTimeout(() => setSavingMeta('idle'), 1500);
      } catch {
        setSavingMeta('error');
      }
    }, 600);
    return () => clearTimeout(handle);
    // brd.id is stable; brd object reference changes after update so we depend on id only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName, audience, brd?.id]);

  const canGenerate = wft != null && !generating;

  const handleGenerate = useCallback(async () => {
    if (!wft) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await generateDiscoveryBrd(
        projectId,
        wft.id,
        productName.trim() || undefined,
        audience,
      );
      setBrd(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'BRD generation failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, wft, productName, audience]);

  const handleRegenerate = useCallback(async () => {
    if (!brd) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await regenerateDiscoveryBrd(
        projectId,
        brd.id,
        productName.trim() || undefined,
        audience,
      );
      setBrd(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, brd, productName, audience]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <div className="text-sm text-destructive">{pageError}</div>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center text-xs text-muted-foreground">
        <Link href={`/ba-tool/project/${projectId}`} className="hover:text-foreground">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3 w-3 mx-1" />
        <Link href={`/ba-tool/project/${projectId}/discovery`} className="hover:text-foreground">
          Discovery
        </Link>
        <ChevronRight className="h-3 w-3 mx-1" />
        <span className="text-foreground font-medium">Stage 2: WFT → BRD</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Stage 2 — WFT → Business Requirements Document</h1>
          <p className="text-sm text-muted-foreground">
            Generate a 15-section BRD from the project's Well-formed Text. Every Functional Requirement is testable
            and atomic; the structured FR table doubles as a quality-check view.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery`)}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to pipeline
        </Button>
      </div>

      {/* WFT input chip */}
      {!wft ? (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                No Well-formed Text yet
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Stage 2 needs a Stage 1 WFT as input. Upload audio and generate WFT first.
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/audio`)}
            >
              Go to Stage 1
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Source · Stage 1 WFT:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{wft.id.slice(0, 8)}…</code>
              <span className="text-xs text-muted-foreground">
                · {(wft.actionItems?.length ?? 0)} actions · {(wft.openQuestions?.length ?? 0)} open questions
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/audio`)}
            >
              ↗ Open WFT
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generation controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {brd ? 'Regenerate BRD' : 'Generate BRD'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Phase 1: regeneration overwrites the existing BRD. Phase 2 will add append-only versioning.
              </div>
            </div>
            <Button onClick={brd ? handleRegenerate : handleGenerate} disabled={!canGenerate}>
              {generating ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-2" />
              )}
              {brd ? 'Regenerate BRD' : 'Generate BRD'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground flex items-center gap-2">
                Product name (optional — improves §1 framing)
                {brd && savingMeta === 'saving' && (
                  <span className="text-[10px] italic text-muted-foreground/70">saving…</span>
                )}
                {brd && savingMeta === 'saved' && (
                  <span className="text-[10px] italic text-green-600">saved · cascades to AN</span>
                )}
                {brd && savingMeta === 'error' && (
                  <span className="text-[10px] italic text-destructive">save failed</span>
                )}
              </span>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Tax Compass"
                className="w-full px-2 py-1 border rounded-md text-sm bg-background"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Audience</span>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as BaBrdAudience)}
                className="w-full px-2 py-1 border rounded-md text-sm bg-background"
              >
                <option value="internal-tool">internal-tool</option>
                <option value="end-client-product">end-client-product</option>
              </select>
            </label>
          </div>

          {genError && (
            <div className="mt-3 text-xs text-destructive flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              {genError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BRD editor */}
      {brd ? (
        <BrdEditor
          projectId={projectId}
          brd={brd}
          onUpdated={reload}
          onRegenerate={handleRegenerate}
          regenerating={generating}
        />
      ) : wft ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-sm text-muted-foreground italic">
              No BRD generated yet. Click <strong className="text-foreground">Generate BRD</strong> to produce the
              15-section document from your Stage 1 WFT.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Continue CTA */}
      {brd && (
        <div className="flex items-center justify-end pt-4 border-t">
          <Button onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/approach-note`)}>
            Continue to Approach Note ▶
          </Button>
        </div>
      )}
    </div>
  );
}
