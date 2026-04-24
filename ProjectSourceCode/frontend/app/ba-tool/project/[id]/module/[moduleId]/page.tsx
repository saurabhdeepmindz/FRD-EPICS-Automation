'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBaModule, getBaProject, SKILL_NAMES, type BaModule, type BaProject, type BaSkillExecution } from '@/lib/ba-api';
import { ArtifactRefProvider, type ArtifactRefContextValue } from '@/components/ba-tool/ArtifactRefContext';
import { ScreenUploader } from '@/components/ba-tool/ScreenUploader';
import { SkillStepper } from '@/components/ba-tool/SkillStepper';
import { ClickThroughBuilder } from '@/components/ba-tool/ClickThroughBuilder';
import { SkillExecutionPanel } from '@/components/ba-tool/SkillExecutionPanel';
import { ArtifactTree, type TreeNodeId } from '@/components/ba-tool/ArtifactTree';
import { ArtifactContentPanel } from '@/components/ba-tool/ArtifactContentPanel';
import { SubTaskList } from '@/components/ba-tool/SubTaskList';
import { SprintSequenceView } from '@/components/ba-tool/SprintSequenceView';
import { useSkillExecution } from '@/hooks/useSkillExecution';
import { ArrowLeft, Loader2, ListChecks, GitBranch, AlertTriangle, Compass } from 'lucide-react';
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
  const [project, setProject] = useState<BaProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeTreeNode, setActiveTreeNode] = useState<TreeNodeId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        getBaModule(moduleDbId),
        // Pull the sibling modules so cross-module references (MOD-03 etc.)
        // in rendered EPIC / User Story content can resolve to real URLs via
        // ArtifactRefProvider below. Fail-soft if the project call 404s.
        getBaProject(projectId).catch(() => null),
      ]);
      setMod(m);
      setProject(p);
    } catch {
      setError('Failed to load module');
    } finally {
      setLoading(false);
    }
  }, [moduleDbId, projectId]);

  // Build a moduleId → { dbId, name } map for the ArtifactRefProvider.
  // Rebuilds whenever the project payload changes.
  const artifactRefs = useMemo<ArtifactRefContextValue>(() => {
    const modulesById: ArtifactRefContextValue['modulesById'] = {};
    for (const m of project?.modules ?? []) {
      modulesById[m.moduleId] = { moduleDbId: m.id, moduleName: m.moduleName };
    }
    return { projectId, modulesById };
  }, [project, projectId]);

  useEffect(() => { load(); }, [load]);

  // Auto-set active step when module status changes
  useEffect(() => {
    if (!mod) return;
    const statusToStep: Record<string, number> = {
      DRAFT: 0,
      SCREENS_UPLOADED: 0,        // stay on upload step — user still adding descriptions
      ANALYSIS_COMPLETE: 2,       // SKILL-00 done → ready for SKILL-01-S
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
    <ArtifactRefProvider value={artifactRefs}>
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
        <div className="flex items-center gap-2">
          {/* LLD button — Architect Workspace; shown once EPICs complete */}
          {(mod.moduleStatus === 'EPICS_COMPLETE'
            || mod.moduleStatus === 'STORIES_COMPLETE'
            || mod.moduleStatus === 'SUBTASKS_COMPLETE'
            || mod.moduleStatus === 'APPROVED') && (
            <Button
              size="sm"
              variant="outline"
              asChild
              title="AI LLD Workbench — architect narrative, tech stack, templates, and LLD generation"
            >
              <Link href={`/ba-tool/project/${projectId}/module/${moduleDbId}/lld`}>
                <Compass className="h-3.5 w-3.5 mr-1" />
                AI LLD Workbench
              </Link>
            </Button>
          )}
          {/* AI FTC Workbench — visible once EPICs are complete (same bar as LLD) */}
          {(mod.moduleStatus === 'EPICS_COMPLETE'
            || mod.moduleStatus === 'STORIES_COMPLETE'
            || mod.moduleStatus === 'SUBTASKS_COMPLETE'
            || mod.moduleStatus === 'APPROVED') && (
            <Button
              size="sm"
              variant="outline"
              asChild
              title="AI FTC Workbench — narrative, testing framework, OWASP coverage, and test-case generation"
            >
              <Link href={`/ba-tool/project/${projectId}/module/${moduleDbId}/ftc`}>
                <Compass className="h-3.5 w-3.5 mr-1" />
                AI FTC Workbench
              </Link>
            </Button>
          )}
          {/* SubTask / Sprint tabs — visible when subtasks exist */}
          {(mod.moduleStatus === 'SUBTASKS_COMPLETE' || mod.moduleStatus === 'APPROVED') && (
            <>
              <Button size="sm" variant={activeStep === 6 ? 'default' : 'outline'} onClick={() => { setActiveStep(6); setActiveTreeNode(null); }}>
                <ListChecks className="h-3.5 w-3.5 mr-1" />
                SubTasks
              </Button>
              <Button size="sm" variant={activeStep === 7 ? 'default' : 'outline'} onClick={() => { setActiveStep(7); setActiveTreeNode(null); }}>
                <GitBranch className="h-3.5 w-3.5 mr-1" />
                Sprint Sequence
              </Button>
            </>
          )}
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
              moduleScreens={mod.screens}
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
              {activeStep >= 1 && activeStep <= 5 && activeSkillName && (() => {
                // EPIC generation (SKILL-02-S / step 3) requires project metadata
                const epicMetaMissing = activeSkillName === 'SKILL-02-S' && !mod.project?.productName?.trim();
                const prereq = activeStep === 1 && mod.moduleStatus === 'DRAFT'
                  ? 'Upload screens and add descriptions first (Step 1).'
                  : epicMetaMissing
                    ? 'Set Product Name in Project Metadata before generating EPICs.'
                    : undefined;
                return (
                  <>
                    {epicMetaMissing && (
                      <div className="max-w-4xl mx-auto mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">Project metadata required</p>
                          <p className="text-xs text-amber-800 mt-0.5">
                            Please fill in <strong>Product Name</strong> (and optionally Client Name, Submitted By) on the project page before generating EPICs.
                          </p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/ba-tool/project/${projectId}`}>Open Project</Link>
                        </Button>
                      </div>
                    )}
                    <SkillExecutionPanel
                      skillName={activeSkillName}
                      moduleDbId={moduleDbId}
                      execution={skillExec}
                      running={skillRunning}
                      error={skillError}
                      canStart={canStartStep(mod.moduleStatus, activeStep) && !epicMetaMissing}
                      prerequisiteMessage={prereq}
                      onStart={startSkill}
                      onApprove={approveSkill}
                      onRetry={startSkill}
                      onModuleReload={load}
                    />
                  </>
                );
              })()}

              {/* ═══ Step 6: SubTask List ═══ */}
              {activeStep === 6 && (
                <div className="max-w-5xl mx-auto">
                  <SubTaskList moduleDbId={mod.id} projectId={projectId} />
                </div>
              )}

              {/* ═══ Step 7: Sprint Sequencing ═══ */}
              {activeStep === 7 && (
                <div className="max-w-6xl mx-auto">
                  <SprintSequenceView moduleDbId={mod.id} projectId={projectId} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
    </ArtifactRefProvider>
  );
}
