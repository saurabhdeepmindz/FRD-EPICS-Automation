'use client';

import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AISuggestButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function AISuggestButton({ onClick, loading, disabled }: AISuggestButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || loading}
      data-testid="ai-suggest-btn"
      className="gap-1.5 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      AI Suggest
    </Button>
  );
}
