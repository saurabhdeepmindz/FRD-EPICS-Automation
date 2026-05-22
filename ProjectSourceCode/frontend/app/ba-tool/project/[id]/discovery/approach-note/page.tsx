'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, Sparkles, AlertCircle, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  getLatestDiscoveryBrd,
  getLatestDiscoveryAn,
  generateDiscoveryAn,
  createDiscoveryAnVersion,
  type BaProject,
  type BaBrd,
  type BaApproachNote,
  type BaAnAudience,
} from '@/lib/ba-api';
import { ApproachNoteEditor } from '@/components/ba-tool/discovery/ApproachNoteEditor';

export default function DiscoveryApproachNotePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [brd, setBrd] = useState<BaBrd | null>(null);
  const [approachNote, setApproachNote] = useState<BaApproachNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [productName, setProductName] = useState('');
  const [audience, setAudience] = useState<BaAnAudience>('internal-tool');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // "+ New version" modal state
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [changesSinceDraft, setChangesSinceDraft] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [latestBrd, latestAn] = await Promise.all([
        getLatestDiscoveryBrd(projectId),
        getLatestDiscoveryAn(projectId),
      ]);
      setBrd(latestBrd);
      setApproachNote(latestAn);
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
        const [p, latestBrd, latestAn] = await Promise.all([
          getBaProject(projectId),
          getLatestDiscoveryBrd(projectId),
          getLatestDiscoveryAn(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setBrd(latestBrd);
        setApproachNote(latestAn);
        // Carry over productName + audience from Stage 2 BRD if the user filled them
        // there (skill 03 pipeline integration). Fallback to project.productName.
        const carriedProductName =
          latestBrd?.meta?.productName ?? p.productName ?? '';
        if (carriedProductName) setProductName(carriedProductName);
        const carriedAudience = latestBrd?.meta?.audience;
        if (carriedAudience === 'internal-tool' || carriedAudience === 'end-client-product') {
          setAudience(carriedAudience);
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

  const canGenerate = brd != null && approachNote == null && !generating;
  const generateDisabledReason = !brd
    ? 'Generate the Stage 2 BRD first.'
    : approachNote
      ? 'An Approach Note already exists — use "+ New version" on the editor below.'
      : generating
        ? 'Generation in progress…'
        : null;

  const handleGenerate = useCallback(async () => {
    if (!brd) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await generateDiscoveryAn(projectId, brd.id, productName.trim() || undefined, audience);
      setApproachNote(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AN generation failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, brd, productName, audience]);

  const handleCreateNewVersion = useCallback(async () => {
    if (!approachNote) return;
    if (!changesSinceDraft.trim()) {
      setGenError('Please describe what changed for this version.');
      return;
    }
    setCreatingVersion(true);
    setGenError(null);
    try {
      const next = await createDiscoveryAnVersion(
        projectId,
        approachNote.id,
        changesSinceDraft.trim(),
        productName.trim() || undefined,
        audience,
      );
      setApproachNote(next);
      setShowNewVersionModal(false);
      setChangesSinceDraft('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Version creation failed';
      setGenError(msg);
    } finally {
      setCreatingVersion(false);
    }
  }, [projectId, approachNote, changesSinceDraft, productName, audience]);

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
        <span className="text-foreground font-medium">Stage 3: Approach Note</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Stage 3 — BRD → Approach Note (versioned)</h1>
          <p className="text-sm text-muted-foreground">
            12-section technical solution design with append-only versioning, including the §12 PRD-Readiness
            Bridge that lifts directly into a downstream PRD. Every regeneration creates a new version with a
            "Changes since v(N-1)" log; prior versions are preserved.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery`)}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to pipeline
        </Button>
      </div>

      {/* BRD input chip */}
      {!brd ? (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">No BRD yet</div>
              <div className="text-xs text-muted-foreground mt-1">
                Stage 3 needs a Stage 2 BRD as input. Generate the BRD first.
              </div>
            </div>
            <Button size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/brd`)}>
              Go to Stage 2
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Source · Stage 2 BRD:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{brd.id.slice(0, 8)}…</code>
              <span className="text-xs text-muted-foreground">· {brd.frTable?.length ?? 0} FRs</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/brd`)}>
              ↗ Open BRD
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate (v1) controls — only when no AN yet */}
      {!approachNote && brd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Generate Approach Note v1
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Subsequent edits create new versions (append-only) — original v1 is always preserved.
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  title={generateDisabledReason ?? 'Generate the 12-section Approach Note from the Stage 2 BRD'}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Approach Note v1
                </Button>
                {generateDisabledReason && (
                  <span className="text-[11px] text-muted-foreground italic">
                    {generateDisabledReason}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <label className="text-xs space-y-1">
                <span className="text-muted-foreground">Product name (optional)</span>
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
                  onChange={(e) => setAudience(e.target.value as BaAnAudience)}
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
      )}

      {/* AN editor */}
      {approachNote ? (
        <ApproachNoteEditor
          projectId={projectId}
          approachNote={approachNote}
          onUpdated={reload}
          onCreateNewVersion={() => setShowNewVersionModal(true)}
          creatingNewVersion={creatingVersion}
        />
      ) : brd ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-sm text-muted-foreground italic">
              No Approach Note yet. Click <strong className="text-foreground">Generate Approach Note v1</strong>{' '}
              to produce the 12-section document from your Stage 2 BRD.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* "+ New version" modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Create new Approach Note version</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewVersionModal(false);
                    setChangesSinceDraft('');
                    setGenError(null);
                  }}
                  disabled={creatingVersion}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Per skill 03 §8, every new version must include a "Changes since v(N-1)" log. The AI uses this
                hint to update relevant sections (decisions, open questions, etc.) accordingly.
              </p>
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Changes since v{approachNote?.versions.length ?? 0}:</span>
                <textarea
                  value={changesSinceDraft}
                  onChange={(e) => setChangesSinceDraft(e.target.value)}
                  placeholder="e.g.&#10;- Stakeholder confirmed multi-tenancy required in P1&#10;- Closed open question on STT provider — Whisper local&#10;- Added §11.7 real-data ETL theme"
                  rows={6}
                  className="w-full text-sm p-2 border rounded-md bg-background font-mono"
                  disabled={creatingVersion}
                />
              </label>
              {genError && (
                <div className="text-xs text-destructive flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {genError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowNewVersionModal(false);
                    setChangesSinceDraft('');
                    setGenError(null);
                  }}
                  disabled={creatingVersion}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateNewVersion} disabled={creatingVersion || !changesSinceDraft.trim()}>
                  {creatingVersion ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Create v{(approachNote?.versions.length ?? 0) + 1}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Continue CTA */}
      {approachNote && (
        <div className="flex items-center justify-end pt-4 border-t">
          <Button onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/wireframes`)}>
            Continue to Lo-fi Wireframes ▶
          </Button>
        </div>
      )}
    </div>
  );
}
