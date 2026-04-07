'use client';

import { cn } from '@/lib/utils';
import { SECTIONS } from '@/lib/section-config';

interface StepperProps {
  activeSection: number;
  sectionStatuses: Record<number, 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'>;
  onSelect: (sectionNumber: number) => void;
}

export function Stepper({ activeSection, sectionStatuses, onSelect }: StepperProps) {
  return (
    <div
      data-testid="prd-stepper"
      className="flex items-center gap-1 overflow-x-auto px-4 py-3 border-b border-border bg-card"
    >
      {SECTIONS.map((section) => {
        const status = sectionStatuses[section.number] ?? 'NOT_STARTED';
        const isActive = activeSection === section.number;
        return (
          <button
            key={section.number}
            data-testid={`stepper-step-${section.number}`}
            onClick={() => onSelect(section.number)}
            title={`${section.number}. ${section.name}`}
            className={cn(
              'relative w-8 h-8 rounded-full text-xs font-medium shrink-0 transition-all',
              'flex items-center justify-center',
              status === 'COMPLETE' && !isActive && 'bg-green-500 text-white',
              status === 'IN_PROGRESS' && !isActive && 'bg-amber-500 text-white',
              status === 'NOT_STARTED' && !isActive && 'bg-muted text-muted-foreground',
              isActive && 'bg-primary text-primary-foreground ring-2 ring-primary/30 scale-110',
            )}
          >
            {section.number}
          </button>
        );
      })}
    </div>
  );
}
