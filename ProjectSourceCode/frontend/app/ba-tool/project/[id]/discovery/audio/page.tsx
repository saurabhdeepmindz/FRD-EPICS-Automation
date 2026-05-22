'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getBaProject,
  listDiscoveryAudio,
  getLatestDiscoveryWft,
  generateDiscoveryWft,
  regenerateDiscoveryWft,
  type BaProject,
  type BaAudioFile,
  type BaWft,
} from '@/lib/ba-api';
import { AudioUploader } from '@/components/ba-tool/discovery/AudioUploader';
import { WftViewer } from '@/components/ba-tool/discovery/WftViewer';

const DEFAULT_DOMAIN_CONTEXT = '';
const DEFAULT_LANGUAGE_HINT = 'auto';

export default function DiscoveryAudioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [audioFiles, setAudioFiles] = useState<BaAudioFile[]>([]);
  const [wft, setWft] = useState<BaWft | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [domainContext, setDomainContext] = useState(DEFAULT_DOMAIN_CONTEXT);
  const [languageHint, setLanguageHint] = useState(DEFAULT_LANGUAGE_HINT);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [audios, latestWft] = await Promise.all([
        listDiscoveryAudio(projectId),
        getLatestDiscoveryWft(projectId),
      ]);
      setAudioFiles(audios);
      setWft(latestWft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load Discovery data';
      setPageError(msg);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, audios, latestWft] = await Promise.all([
          getBaProject(projectId),
          listDiscoveryAudio(projectId),
          getLatestDiscoveryWft(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setAudioFiles(audios);
        setWft(latestWft);
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

  const transcribedAudios = audioFiles.filter((a) => a.status === 'TRANSCRIBED');
  const canGenerate = transcribedAudios.length > 0 && !generating;

  const handleGenerate = useCallback(async () => {
    if (transcribedAudios.length === 0) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await generateDiscoveryWft(
        projectId,
        transcribedAudios.map((a) => a.id),
        domainContext.trim() || undefined,
        languageHint || undefined,
      );
      setWft(next);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WFT generation failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, transcribedAudios, domainContext, languageHint, reload]);

  const handleRegenerate = useCallback(async () => {
    if (!wft) return;
    setGenerating(true);
    setGenError(null);
    try {
      const next = await regenerateDiscoveryWft(
        projectId,
        wft.id,
        domainContext.trim() || undefined,
        languageHint || undefined,
      );
      setWft(next);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [projectId, wft, domainContext, languageHint, reload]);

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
        <span className="text-foreground font-medium">Stage 1: Audio → Well-formed Text</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Stage 1 — Audio → Well-formed Text</h1>
          <p className="text-sm text-muted-foreground">
            Upload audio recordings (voice notes, meeting clips, dictated requirements). Each file is transcribed
            via the existing STT pipeline; once you have one or more transcribed files, generate a structured
            7-section WFT.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery`)}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to pipeline
        </Button>
      </div>

      {/* Audio uploader */}
      <AudioUploader projectId={projectId} audioFiles={audioFiles} onChanged={reload} />

      {/* WFT generation controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Generate Well-formed Text
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Uses {transcribedAudios.length} transcribed file{transcribedAudios.length === 1 ? '' : 's'}.
                Domain context improves AI cleanup.
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              {generating ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-2" />
              )}
              {wft ? 'Generate new WFT' : 'Generate WFT'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Domain context (optional)</span>
              <input
                type="text"
                value={domainContext}
                onChange={(e) => setDomainContext(e.target.value)}
                placeholder="e.g. AI / CRM / sales automation"
                className="w-full px-2 py-1 border rounded-md text-sm bg-background"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Language hint</span>
              <select
                value={languageHint}
                onChange={(e) => setLanguageHint(e.target.value)}
                className="w-full px-2 py-1 border rounded-md text-sm bg-background"
              >
                <option value="auto">auto-detect</option>
                <option value="en">en</option>
                <option value="hi">hi</option>
                <option value="en+hi">en+hi (Hinglish)</option>
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

      {/* WFT preview */}
      {wft ? (
        <WftViewer
          projectId={projectId}
          wft={wft}
          onUpdated={reload}
          onRegenerate={handleRegenerate}
          regenerating={generating}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-sm text-muted-foreground italic">
              No Well-formed Text generated yet. Upload at least one audio file, wait for transcription, then click
              <strong className="text-foreground"> Generate WFT</strong>.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Continue CTA */}
      {wft && (
        <div className="flex items-center justify-end pt-4 border-t">
          <Button onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/brd`)}>
            Continue to BRD ▶
          </Button>
        </div>
      )}
    </div>
  );
}
