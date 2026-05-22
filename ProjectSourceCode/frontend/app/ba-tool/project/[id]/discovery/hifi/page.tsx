'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, Sparkles, AlertCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  getLatestDiscoveryWireframeSet,
  getLatestDiscoveryHifi,
  generateDiscoveryHifi,
  regenerateDiscoveryHifi,
  type BaProject,
  type BaWireframeSet,
  type BaHifiSet,
} from '@/lib/ba-api';
import { HifiSetViewer } from '@/components/ba-tool/discovery/HifiSetViewer';

export default function DiscoveryHifiPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [lofi, setLofi] = useState<BaWireframeSet | null>(null);
  const [set, setSet] = useState<BaHifiSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [productName, setProductName] = useState('');
  const [syntheticHint, setSyntheticHint] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, latestLofi, latestHifi] = await Promise.all([
          getBaProject(projectId),
          getLatestDiscoveryWireframeSet(projectId),
          getLatestDiscoveryHifi(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setLofi(latestLofi);
        setSet(latestHifi);
        if (p.productName) setProductName(p.productName);
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

  const handleGenerate = useCallback(async () => {
    if (!lofi) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await generateDiscoveryHifi(projectId, {
        wireframeSetId: lofi.id,
        productName: productName.trim() || undefined,
        syntheticDataHint: syntheticHint.trim() || undefined,
      });
      setSet(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hi-fi generation failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, lofi, productName, syntheticHint]);

  const handleRegenerate = useCallback(async () => {
    if (!set) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await regenerateDiscoveryHifi(projectId, set.id);
      setSet(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, set]);

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
        <span className="text-foreground font-medium">Stage 5: Hi-fi Mockups</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Stage 5 — Lo-fi → Hi-fi Mockups</h1>
          <p className="text-sm text-muted-foreground">
            Polish lo-fi wireframes into branded HTML mockups. Callout numbers preserve 1:1 parity (skill 05 §7).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery`)}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to pipeline
        </Button>
      </div>

      {/* Lo-fi input chip */}
      {!lofi ? (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                No lo-fi wireframe set yet
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Stage 5 needs a Stage 4 lo-fi set as input. Generate the wireframes first.
              </div>
            </div>
            <Button size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/wireframes`)}>
              Go to Stage 4
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Source · Stage 4 lo-fi:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {(lofi.screens ?? []).length} screens
              </code>
              {lofi.coverageStatus && (
                <span className="text-xs text-muted-foreground">
                  · coverage {lofi.coverageStatus.validated ? '✓' : '⚠'}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/wireframes`)}
            >
              ↗ Open lo-fi
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate controls — only when no set yet */}
      {!set && lofi && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Generate hi-fi mockups
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Brand tokens are inherited from the lo-fi set. Optionally pass a synthetic-data hint to keep
                example content on-domain.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Product name (optional)</span>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-2 py-1 border rounded-md text-sm bg-background"
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Synthetic data hint (optional)</span>
                <input
                  type="text"
                  value={syntheticHint}
                  onChange={(e) => setSyntheticHint(e.target.value)}
                  placeholder="e.g. Indian jewellery shop names + ₹ amounts"
                  className="w-full px-2 py-1 border rounded-md text-sm bg-background"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button onClick={handleGenerate} disabled={!lofi || generating}>
                {generating ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-2" />
                )}
                Generate hi-fi mockups
              </Button>
            </div>

            {genError && (
              <div className="text-xs text-destructive flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {genError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hi-fi set viewer */}
      {set && (
        <>
          {genError && (
            <Card className="border-destructive">
              <CardContent className="p-3 text-xs text-destructive flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {genError}
              </CardContent>
            </Card>
          )}
          <HifiSetViewer
            projectId={projectId}
            set={set}
            onRegenerate={handleRegenerate}
            regenerating={generating}
          />
        </>
      )}

      {/* Continue CTA */}
      {set && (
        <div className="flex items-center justify-end pt-4 border-t">
          <Button variant="outline" disabled>
            Continue to EPIC Context Handoff ▶ <span className="ml-2 text-[10px] opacity-70">(next slice)</span>
          </Button>
        </div>
      )}
    </div>
  );
}
