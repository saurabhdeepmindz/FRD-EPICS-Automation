'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  getLatestDiscoveryAn,
  getLatestDiscoveryWireframeSet,
  generateDiscoveryWireframes,
  regenerateDiscoveryWireframes,
  WIREFRAME_PATTERNS,
  type BaProject,
  type BaApproachNote,
  type BaWireframeSet,
} from '@/lib/ba-api';
import { WireframeSetEditor } from '@/components/ba-tool/discovery/WireframeSetEditor';

export default function DiscoveryWireframesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [an, setAn] = useState<BaApproachNote | null>(null);
  const [set, setSet] = useState<BaWireframeSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [productName, setProductName] = useState('');
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]); // empty = AI auto-pick
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const latest = await getLatestDiscoveryWireframeSet(projectId);
      setSet(latest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh';
      setPageError(msg);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, latestAn, latestSet] = await Promise.all([
          getBaProject(projectId),
          getLatestDiscoveryAn(projectId),
          getLatestDiscoveryWireframeSet(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setAn(latestAn);
        setSet(latestSet);
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

  const togglePattern = (id: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleGenerate = useCallback(async () => {
    if (!an?.currentVersionId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await generateDiscoveryWireframes(
        projectId,
        an.currentVersionId,
        selectedPatterns.length > 0 ? selectedPatterns : undefined,
        productName.trim() || undefined,
      );
      setSet(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wireframe generation failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, an?.currentVersionId, selectedPatterns, productName]);

  const handleRegenerate = useCallback(async () => {
    if (!set) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await regenerateDiscoveryWireframes(projectId, set.id);
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
        <span className="text-foreground font-medium">Stage 4: Lo-fi Wireframes</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Stage 4 — Approach Note → Lo-fi Wireframes</h1>
          <p className="text-sm text-muted-foreground">
            Pattern-driven screen generation per skill 04. Every UI element is traceable back to a Functional
            Requirement; the coverage matrix proves it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery`)}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to pipeline
        </Button>
      </div>

      {/* AN input chip */}
      {!an?.currentVersion ? (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                No Approach Note yet
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Stage 4 needs a Stage 3 Approach Note as input. Generate the AN first.
              </div>
            </div>
            <Button size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/approach-note`)}>
              Go to Stage 3
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Source · Stage 3 AN:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                v{an.currentVersion.versionNumber}
              </code>
              <span className="text-xs text-muted-foreground">
                · {Object.keys(an.currentVersion.sections ?? {}).length} sections
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/approach-note`)}
            >
              ↗ Open AN
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate controls — only when no set yet */}
      {!set && an?.currentVersionId && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Generate wireframe set
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Pick patterns explicitly, or leave all unchecked to let AI auto-select from the 13-pattern catalogue.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {WIREFRAME_PATTERNS.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPatterns.includes(p.id)}
                    onChange={() => togglePattern(p.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
                    <br />
                    <span>{p.label}</span>
                  </span>
                </label>
              ))}
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
            </div>

            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground mr-auto">
                {selectedPatterns.length === 0
                  ? 'AI will auto-pick screens'
                  : `${selectedPatterns.length} pattern${selectedPatterns.length === 1 ? '' : 's'} selected`}
              </span>
              <Button onClick={handleGenerate} disabled={!an?.currentVersionId || generating}>
                {generating ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-2" />
                )}
                Generate wireframes
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

      {/* Wireframe set editor */}
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
          <WireframeSetEditor
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
          <Button onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/hifi`)}>
            Continue to Hi-fi Mockups ▶
          </Button>
        </div>
      )}
    </div>
  );
}
