'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBaModule, SKILL_NAMES, type BaModule, type BaSkillExecution } from '@/lib/ba-api';
import { ScreenUploader } from '@/components/ba-tool/ScreenUploader';
import { SkillStepper } from '@/components/ba-tool/SkillStepper';
import { ClickThroughBuilder } from '@/components/ba-tool/ClickThroughBuilder';
import { SkillExecutionPanel } from '@/components/ba-tool/SkillExecutionPanel';
import { ArtifactTree, type TreeNodeId } from '@/components/ba-tool/ArtifactTree';
import { ArtifactContentPanel } from '@/components/ba-tool/ArtifactContentPanel';
import { useSkillExecution } from '@/hooks/useSkillExecution';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

const STEP_TO_SKILL: Record<number, string> = {
  1: 'SKILL-00',
  2: 'SKILL-01-S',
  3: 'SKILL-02-S',
  4: 'SKILL-04',
  5: 'SKILL-05',
};

function canStartStep(moduleStatus: string, step: number): boolean {
  const statusToReadyStep: Record<string, number> = {
    SCREENS_UPLOADED: 1,
    ANALYSIS_COMPLETE: 2,
    FRD_COMPLETE: 3,
    EPICS_COMPLETE: 4,
    STORIES_COMPLETE: 5,
  };
  return statusToReadyStep[moduleStatus] === step;
}

export default function BaModuleWorkspacePage() {
  const params = useParams<{ id: string; moduleId: string }>();
  const projectId = params.id;
  const moduleDbId = params.moduleId;

  const [mod, setMod] = useState<BaModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeTreeNode, setActiveTreeNode] = useState<TreeNodeId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBaModule(moduleDbId);
      setMod(data);
    } catch {
      setError('Failed to load module');
    } finally {
      setLoading(false);
    }
  }, [moduleDbId]);

  useEffect(() => { load(); }, [load]);

  // Auto-set active step when module status changes
  useEffect(() => {
    if (!mod) return;
    const statusToStep: Record<string, number> = {
      DRAFT: 0,
      SCREENS_UPLOADED: 1,
      ANALYSIS_COMPLETE: 2,
      FRD_COMPLETE: 3,
      EPICS_COMPLETE: 4,
      STORIES_COMPLETE: 5,
      SUBTASKS_COMPLETE: 5,
      APPROVED: 5,
    };
    setActiveStep(statusToStep[mod.moduleStatus] ?? 0);
  }, [mod?.moduleStatus]);

  // Skill execution
  const activeSkillName = STEP_TO_SKILL[activeStep] ?? null;
  const latestExecution = useMemo<BaSkillExecution | null>(() => {
    if (!mod || !activeSkillName) return null;
    const execs = mod.skillExecutions.filter((e) => e.skillName === activeSkillName);
    return execs.length > 0 ? execs[0] : null;
  }, [mod, activeSkillName]);

  const {
    execution: skillExec,
    running: skillRunning,
    error: skillError,
    start: startSkill,
    approve: approveSkill,
    reset: resetSkill,
  } = useSkillExecution(moduleDbId, activeSkillName ?? '', latestExecution);

  useEffect(() => { resetSkill(); }, [activeStep]);

  // Check if screens have data for SKILL-00
  const hasScreensWithDescriptions = useMemo(() => {
    if (!mod) return false;
    return mod.screens.length > 0 && mod.screens.some(
      (s) => s.textDescription?.trim() || s.transcriptReviewed || s.aiFormattedTranscript,
    );
  }, [mod]);

  // Check if any artifacts exist (to show tree view)
  const hasArtifacts = useMemo(() => {
    if (!mod) return false;
    return mod.artifacts.length > 0 && mod.artifacts.some((a) => a.sections.length > 0);
  }, [mod]);

  // Completed executions for tree
  const completedExecutions = useMemo(() => {
    if (!mod) return [];
    return mod.skillExecutions.filter(
      (e) => e.status === 'AWAITING_REVIEW' || e.status === 'APPROVED' || e.status === 'COMPLETED',
    );
  }, [mod]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading module...</span>
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error ?? 'Module not found'}</p>
        <Button asChild variant="outline"><Link href={`/ba-tool/project/${projectId}`}>Back</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" data-testid="ba-module-workspace">
      {/* Module header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/ba-tool/project/${projectId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {mod.moduleId}
            </span>
            <h1 className="text-sm font-semibold text-foreground">{mod.moduleName}</h1>
            <span className="text-xs text-muted-foreground font-mono">({mod.packageName})</span>
          </div>
        </div>
      </header>

      {/* Skill Stepper */}
      <SkillStepper
        moduleStatus={mod.moduleStatus}
        activeStep={activeStep}
        onStepClick={(step) => { setActiveStep(step); setActiveTreeNode(null); }}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ Left: Artifact Tree (visible when any artifacts exist) ═══ */}
        {hasArtifacts && (
          <aside className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto">
            <div className="p-3 border-b border-border">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Artifact Tree
              </h2>
            </div>
            <ArtifactTree
              executions={completedExecutions}
              artifacts={mod.artifacts}
              activeNode={activeTreeNode}
              onNodeSelect={setActiveTreeNode}
            />
          </aside>
        )}

        {/* ═══ Right: Content area ═══ */}
        <main className="flex-1 overflow-y-auto">
          {/* If a tree node is selected, show its content */}
          {activeTreeNode && hasArtifacts ? (
            <ArtifactContentPanel
              activeNode={activeTreeNode}
              executions={completedExecutions}
              artifacts={mod.artifacts}
              onSectionUpdated={load}
            />
          ) : (
            <div className="p-6">
              {/* ═══ Step 0: Screen Upload & Descriptions ═══ */}
              {activeStep === 0 && (
                <div className="max-w-5xl mx-auto">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-foreground mb-1">
                      Step 1 — Upload & Describe Screens
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Upload Figma screen images for this module. Add text or audio descriptions per screen.
                      Define navigation click-through flows between screens.
                    </p>
                  </div>
                  <ScreenUploader
                    moduleDbId={mod.id}
                    screens={mod.screens}
                    onScreensChanged={load}
                  />

                  {mod.screens.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-border">
                      <ClickThroughBuilder
                        moduleDbId={mod.id}
                        flows={mod.flows}
                        screens={mod.screens}
                        onFlowsChanged={load}
                      />
                    </div>
                  )}

                  {mod.screens.length > 0 && (mod.moduleStatus === 'DRAFT' || mod.moduleStatus === 'SCREENS_UPLOADED') && (
                    <div className="mt-8 pt-6 border-t border-border text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {hasScreensWithDescriptions
                          ? `${mod.screens.length} screen${mod.screens.length > 1 ? 's' : ''} ready. Click to proceed to Screen Analysis.`
                          : 'Add at least one text or audio description before proceeding.'}
                      </p>
                      <Button
                        size="lg"
                        onClick={() => setActiveStep(1)}
                        disabled={!hasScreensWithDescriptions}
                      >
                        Ready to Analyse →
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Steps 1-5: Skill Execution ═══ */}
              {activeStep >= 1 && activeStep <= 5 && activeSkillName && (
                <SkillExecutionPanel
                  skillName={activeSkillName}
                  moduleDbId={moduleDbId}
                  execution={skillExec}
                  running={skillRunning}
                  error={skillError}
                  canStart={canStartStep(mod.moduleStatus, activeStep)}
                  prerequisiteMessage={
                    activeStep === 1 && mod.moduleStatus === 'DRAFT'
                      ? 'Upload screens and add descriptions first (Step 1).'
                      : undefined
                  }
                  onStart={startSkill}
                  onApprove={approveSkill}
                  onRetry={startSkill}
                  onModuleReload={load}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
