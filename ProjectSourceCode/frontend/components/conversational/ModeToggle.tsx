'use client';

import { cn } from '@/lib/utils';

interface ModeToggleProps {
  mode: 'all_in_one' | 'interactive';
  onModeChange: (mode: 'all_in_one' | 'interactive') => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/50" data-testid="mode-toggle">
      <button
        type="button"
        data-testid="mode-all-in-one"
        onClick={() => onModeChange('all_in_one')}
        className={cn(
          'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
          mode === 'all_in_one'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        All-in-one
      </button>
      <button
        type="button"
        data-testid="mode-interactive"
        onClick={() => onModeChange('interactive')}
        className={cn(
          'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
          mode === 'interactive'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Interactive
      </button>
    </div>
  );
}
