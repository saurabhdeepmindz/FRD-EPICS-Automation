'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Mic,
  FileText,
  ClipboardList,
  Layers,
  LayoutGrid,
  Palette,
  Lock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getBaProject,
  listDiscoveryAudio,
  getLatestDiscoveryWft,
  getLatestDiscoveryBrd,
  getLatestDiscoveryAn,
  getLatestDiscoveryWireframeSet,
  getLatestDiscoveryHifi,
  type BaProject,
  type BaAudioFile,
  type BaWft,
  type BaBrd,
  type BaApproachNote,
  type BaWireframeSet,
  type BaHifiSet,
} from '@/lib/ba-api';

interface StageMeta {
  num: number;
  slug: string;
  title: string;
  subtitle: string;
  icon: typeof Mic;
  href?: string; // undefined = not yet built
  /** Whether this stage has work the user can do today. */
  enabled: boolean;
}

const DISCOVERY_STAGES: StageMeta[] = [
  { num: 1, slug: 'audio', title: 'Audio → Text', subtitle: 'Upload + transcribe + WFT', icon: Mic, href: 'audio', enabled: true },
  { num: 2, slug: 'brd', title: 'WFT → BRD', subtitle: '15-section requirements doc', icon: FileText, href: 'brd', enabled: true },
  { num: 3, slug: 'approach-note', title: 'BRD → Approach Note', subtitle: 'Versioned · append-only', icon: ClipboardList, href: 'approach-note', enabled: true },
  { num: 4, slug: 'wireframes', title: 'AN → Lo-fi Wireframes', subtitle: '13-pattern catalogue', icon: Layers, href: 'wireframes', enabled: true },
  { num: 5, slug: 'hifi', title: 'Lo-fi → Hi-fi Mockups', subtitle: 'Branded · callout-parity validated', icon: LayoutGrid, href: 'hifi', enabled: true },
  { num: 6, slug: 'epic-context', title: 'EPIC Context Handoff', subtitle: 'Module-level integration', icon: Palette, enabled: false },
];

export default function DiscoveryPipelinePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<BaProject | null>(null);
  const [audioFiles, setAudioFiles] = useState<BaAudioFile[]>([]);
  const [wft, setWft] = useState<BaWft | null>(null);
  const [brd, setBrd] = useState<BaBrd | null>(null);
  const [an, setAn] = useState<BaApproachNote | null>(null);
  const [wireframes, setWireframes] = useState<BaWireframeSet | null>(null);
  const [hifi, setHifi] = useState<BaHifiSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, audios, latestWft, latestBrd, latestAn, latestWf, latestHifi] = await Promise.all([
          getBaProject(projectId),
          listDiscoveryAudio(projectId).catch(() => [] as BaAudioFile[]),
          getLatestDiscoveryWft(projectId).catch(() => null),
          getLatestDiscoveryBrd(projectId).catch(() => null),
          getLatestDiscoveryAn(projectId).catch(() => null),
          getLatestDiscoveryWireframeSet(projectId).catch(() => null),
          getLatestDiscoveryHifi(projectId).catch(() => null),
        ]);
        if (cancelled) return;
        setProject(p);
        setAudioFiles(audios);
        setWft(latestWft);
        setBrd(latestBrd);
        setAn(latestAn);
        setWireframes(latestWf);
        setHifi(latestHifi);
      } catch {
        if (!cancelled) setError('Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const stage1Status: 'NONE' | 'AUDIO_ONLY' | 'WFT_DONE' =
    wft ? 'WFT_DONE' : audioFiles.length > 0 ? 'AUDIO_ONLY' : 'NONE';
  const stage2Status: 'NONE' | 'DONE' = brd ? 'DONE' : 'NONE';
  const stage3Status: 'NONE' | 'DONE' = an ? 'DONE' : 'NONE';
  const stage4Status: 'NONE' | 'DONE' = wireframes ? 'DONE' : 'NONE';
  const stage5Status: 'NONE' | 'DONE' = hifi ? 'DONE' : 'NONE';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <div className="text-sm text-destructive">{error}</div>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-xs text-muted-foreground">
        <Link href={`/ba-tool/project/${projectId}`} className="hover:text-foreground">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3 w-3 mx-1" />
        <span className="text-foreground font-medium">Discovery & Solutioning</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Discovery & Solutioning Track</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audio → BRD → Approach Note → Wireframes → Hi-fi · feeds the existing module flow as additional EPIC context.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}`)}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Open BA Modules
        </Button>
      </div>

      {/* Stage 1 status banner */}
      {stage1Status !== 'NONE' && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700">
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <strong className="text-orange-700 dark:text-orange-400">Stage 1 in progress.</strong>{' '}
              {audioFiles.length} audio file{audioFiles.length === 1 ? '' : 's'} uploaded
              {stage1Status === 'WFT_DONE' && ' · WFT generated'}.
            </div>
            <Button size="sm" onClick={() => router.push(`/ba-tool/project/${projectId}/discovery/audio`)}>
              Resume Stage 1
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pipeline stage cards */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Discovery Pipeline · 6 stages
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {DISCOVERY_STAGES.map((stage) => {
            const done =
              (stage.num === 1 && stage1Status === 'WFT_DONE') ||
              (stage.num === 2 && stage2Status === 'DONE') ||
              (stage.num === 3 && stage3Status === 'DONE') ||
              (stage.num === 4 && stage4Status === 'DONE') ||
              (stage.num === 5 && stage5Status === 'DONE');
            const active =
              (stage.num === 1 && stage1Status === 'AUDIO_ONLY') ||
              (stage.num === 2 && stage1Status === 'WFT_DONE' && stage2Status === 'NONE') ||
              (stage.num === 3 && stage2Status === 'DONE' && stage3Status === 'NONE') ||
              (stage.num === 4 && stage3Status === 'DONE' && stage4Status === 'NONE') ||
              (stage.num === 5 && stage4Status === 'DONE' && stage5Status === 'NONE');
            return (
              <StageCard
                key={stage.num}
                stage={stage}
                projectId={projectId}
                done={done}
                active={active}
              />
            );
          })}
        </div>
      </div>

      {/* Phase-2 affordances */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Phase 2 · Coming later
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Generate Budget Estimate',
              'Share with Client',
              'EPIC multi-source picker (BRD + Lo-fi + Hi-fi + FRD + PRD)',
              'BRD versioning',
              'PRD reference-docs panel',
            ].map((label) => (
              <span
                key={label}
                className="text-[11px] px-2 py-1 rounded-md border bg-background text-muted-foreground line-through"
              >
                {label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StageCardProps {
  stage: StageMeta;
  projectId: string;
  done: boolean;
  active: boolean;
}

function StageCard({ stage, projectId, done, active }: StageCardProps) {
  const Icon = stage.icon;
  const clickable = stage.enabled;

  const card = (
    <Card
      className={cn(
        'transition-shadow',
        clickable && 'hover:shadow-md cursor-pointer',
        active && 'border-orange-500',
        done && 'border-green-500',
        !clickable && 'opacity-70',
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'h-8 w-8 rounded-md flex items-center justify-center text-xs font-semibold',
                done
                  ? 'bg-green-500/10 text-green-600'
                  : active
                    ? 'bg-orange-500/10 text-orange-600'
                    : clickable
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-muted/50 text-muted-foreground/60',
              )}
            >
              {stage.num}
            </div>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          {done && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {active && (
            <span className="text-[10px] font-semibold text-orange-600 uppercase">▶ Active</span>
          )}
          {!clickable && <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />}
        </div>
        <div className="mt-2">
          <div className="text-sm font-semibold">{stage.title}</div>
          <div className="text-xs text-muted-foreground">{stage.subtitle}</div>
          {!clickable && (
            <div className="text-[10px] text-muted-foreground/70 mt-1.5 italic">
              Implementation pending · next slice
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (clickable && stage.href) {
    return (
      <Link href={`/ba-tool/project/${projectId}/discovery/${stage.href}`} className="block">
        {card}
      </Link>
    );
  }
  return card;
}
