'use client';

import { cn } from '@/lib/utils';
import { SKILL_LABELS, type BaModuleStatus } from '@/lib/ba-api';
import { CheckCircle2, Circle, Loader2, AlertCircle, Lock } from 'lucide-react';

interface SkillStepperProps {
  moduleStatus: BaModuleStatus;
  activeStep: number;
  onStepClick: (step: number) => void;
}

const STEPS = [
  { label: 'Screen Upload', skill: null },
  { label: 'Screen Analysis', skill: 'SKILL-00' },
  { label: 'FRD Generation', skill: 'SKILL-01-S' },
  { label: 'EPIC Generation', skill: 'SKILL-02-S' },
  { label: 'User Stories', skill: 'SKILL-04' },
  { label: 'SubTasks', skill: 'SKILL-05' },
] as const;

/** Maps module status to highest completed step index */
function getCompletedStep(status: BaModuleStatus): number {
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

export function SkillStepper({ moduleStatus, activeStep, onStepClick }: SkillStepperProps) {
  const completedStep = getCompletedStep(moduleStatus);

  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-muted/30 border-b border-border overflow-x-auto" data-testid="skill-stepper">
      {STEPS.map((step, idx) => {
        const isCompleted = idx <= completedStep;
        const isReady = idx === completedStep + 1;
        const isActive = idx === activeStep;
        const isLocked = idx > completedStep + 1;

        return (
          <div key={idx} className="flex items-center">
            <button
              onClick={() => !isLocked && onStepClick(idx)}
              disabled={isLocked}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                isActive && 'bg-primary text-primary-foreground shadow-sm',
                isCompleted && !isActive && 'bg-green-100 text-green-700 hover:bg-green-200',
                isReady && !isActive && 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
                isLocked && 'bg-muted text-muted-foreground/50 cursor-not-allowed',
                !isActive && !isCompleted && !isReady && !isLocked && 'bg-card text-muted-foreground',
              )}
              data-testid={`step-${idx}`}
            >
              {isCompleted && !isActive ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : isLocked ? (
                <Lock className="h-3 w-3" />
              ) : isActive ? (
                <Circle className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              <span>{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                'w-6 h-px mx-0.5',
                idx <= completedStep ? 'bg-green-400' : 'bg-border',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
