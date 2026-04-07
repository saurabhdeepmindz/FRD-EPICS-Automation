'use client';

import { useCallback, useState } from 'react';
import { suggestField } from '@/lib/api';

interface UseAISuggestReturn {
  suggesting: boolean;
  error: string | null;
  suggest: (section: number, field: string, context?: string) => Promise<string>;
}

export function useAISuggest(): UseAISuggestReturn {
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggest = useCallback(async (section: number, field: string, context?: string) => {
    setSuggesting(true);
    setError(null);
    try {
      const res = await suggestField({ section, field, context });
      return res.suggestion;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI suggestion failed';
      setError(message);
      throw new Error(message);
    } finally {
      setSuggesting(false);
    }
  }, []);

  return { suggesting, error, suggest };
}
