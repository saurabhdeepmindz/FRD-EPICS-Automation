'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { type BaModuleStatus } from '@/lib/ba-api';
import { CheckCircle2, Circle, Lock, Compass } from 'lucide-react';

interface SkillStepperProps {
  moduleStatus: BaModuleStatus;
  activeStep: number;
  onStepClick: (step: number) => void;
  /** Used to build navigation links for the post-EPIC LLD / FTC steps. */
  projectId: string;
  moduleDbId: string;
  /** True when at least one LLD artifact exists for this module. */
  lldComplete: boolean;
  /** True when at least one FTC artifact exists for this module. */
  ftcComplete: boolean;
}

// Steps 0–5 are the linear skill chain that drives moduleStatus.
// Steps 6 (LLD) and 7 (FTC) are independent post-EPIC workbenches —
// they don't change moduleStatus and they navigate to dedicated pages
// rather than swapping the in-page step content.
const STEPS = [
  { label: 'Screen Upload', kind: 'inline' as const },
  { label: 'Screen Analysis', kind: 'inline' as const },
  { label: 'FRD Generation', kind: 'inline' as const },
  { label: 'EPIC Generation', kind: 'inline' as const },
  { label: 'User Stories', kind: 'inline' as const },
  { label: 'SubTasks', kind: 'inline' as const },
  { label: 'Low-Level Design', kind: 'link' as const, href: 'lld' },
  { label: 'Test Cases', kind: 'link' as const, href: 'ftc' },
] as const;

/** Maps module status to highest completed step index for the linear chain (0-5). */
function getLinearCompletedStep(status: BaModuleStatus): number {
  switch (status) {
    case 'DRAFT': return -1;
    case 'SCREENS_UPLOADED': return 0;
    case 'ANALYSIS_COMPLETE': return 1;
    case 'FRD_COMPLETE': return 2;
    case 'EPICS_COMPLETE': return 3;
    case 'STORIES_COMPLETE': return 4;
    case 'SUBTASKS_COMPLETE': return 5;
    case 'APPROVED': return 5;
    default: return -1;
  }
}

export function SkillStepper({
  moduleStatus,
  activeStep,
  onStepClick,
  projectId,
  moduleDbId,
  lldComplete,
  ftcComplete,
}: SkillStepperProps) {
  const linearCompleted = getLinearCompletedStep(moduleStatus);
  // Both LLD and FTC unlock once EPIC generation is complete (the same
  // gate the workbench buttons in the module header use).
  const postEpicReady = linearCompleted >= 3; // EPICS_COMPLETE or later

  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-muted/30 border-b border-border overflow-x-auto" data-testid="skill-stepper">
      {STEPS.map((step, idx) => {
        // Different completion / readiness logic for the two halves:
        // - Linear chain (0-5): driven by moduleStatus
        // - Post-EPIC steps (6 LLD, 7 FTC): independent — completion comes
        //   from "does an LLD/FTC artifact exist for this module", and
        //   readiness is gated only on EPICS_COMPLETE.
        const isLinear = step.kind === 'inline';
        const isLld = idx === 6;
        const isFtc = idx === 7;

        const isCompleted = isLinear
          ? idx <= linearCompleted
          : isLld
            ? lldComplete
            : isFtc
              ? ftcComplete
              : false;
        const isReady = isLinear
          ? idx === linearCompleted + 1
          : postEpicReady && !isCompleted;
        const isActive = idx === activeStep;
        const isLocked = isLinear
          ? idx > linearCompleted + 1
          : !postEpicReady;

        const buttonClasses = cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
          isActive && 'bg-primary text-primary-foreground shadow-sm',
          isCompleted && !isActive && 'bg-green-100 text-green-700 hover:bg-green-200',
          isReady && !isActive && 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
          isLocked && 'bg-muted text-muted-foreground/50 cursor-not-allowed',
          !isActive && !isCompleted && !isReady && !isLocked && 'bg-card text-muted-foreground',
        );

        const icon = isCompleted && !isActive ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : isLocked ? (
          <Lock className="h-3 w-3" />
        ) : !isLinear ? (
          <Compass className="h-3.5 w-3.5" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        );

        return (
          <div key={idx} className="flex items-center">
            {step.kind === 'link' ? (
              isLocked ? (
                <button disabled className={buttonClasses} data-testid={`step-${idx}`}>
                  {icon}
                  <span>{step.label}</span>
                </button>
              ) : (
                <Link
                  href={`/ba-tool/project/${projectId}/module/${moduleDbId}/${step.href}`}
                  className={buttonClasses}
                  data-testid={`step-${idx}`}
                  title={
                    isLld
                      ? 'AI LLD Workbench — architect narrative, tech stack, templates, and LLD generation'
                      : 'AI FTC Workbench — narrative, testing framework, OWASP coverage, and test-case generation'
                  }
                >
                  {icon}
                  <span>{step.label}</span>
                </Link>
              )
            ) : (
              <button
                onClick={() => !isLocked && onStepClick(idx)}
                disabled={isLocked}
                className={buttonClasses}
                data-testid={`step-${idx}`}
              >
                {icon}
                <span>{step.label}</span>
              </button>
            )}
            {idx < STEPS.length - 1 && (
              <div className={cn(
                'w-6 h-px mx-0.5',
                // Linear connectors stay green up to linearCompleted; the
                // connector between SubTasks(5) and LLD(6) goes green when
                // EPICs are done (post-EPIC steps unlocked); LLD→FTC stays
                // a neutral border because they're independent.
                idx <= linearCompleted ? 'bg-green-400'
                  : idx === 5 && postEpicReady ? 'bg-green-400'
                  : 'bg-border',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
