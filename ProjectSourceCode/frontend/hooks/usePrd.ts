'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPrd, updateSection as updateSectionApi } from '@/lib/api';
import type { Prd, PrdSection } from '@/lib/api';

interface UsePrdReturn {
  prd: Prd | null;
  loading: boolean;
  error: string | null;
  sectionStatuses: Record<number, PrdSection['status']>;
  getSection: (sectionNumber: number) => PrdSection | undefined;
  saveSection: (
    sectionNumber: number,
    content: Record<string, unknown>,
    aiSuggested?: boolean,
  ) => Promise<void>;
  reload: () => Promise<void>;
}

export function usePrd(prdId: string): UsePrdReturn {
  const [prd, setPrd] = useState<Prd | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPrd(prdId);
      setPrd(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load PRD';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [prdId]);

  useEffect(() => {
    load();
  }, [load]);

  const sectionStatuses: Record<number, PrdSection['status']> = {};
  if (prd) {
    for (const s of prd.sections) {
      sectionStatuses[s.sectionNumber] = s.status;
    }
  }

  const getSection = useCallback(
    (sectionNumber: number) => prd?.sections.find((s) => s.sectionNumber === sectionNumber),
    [prd],
  );

  const saveSection = useCallback(
    async (sectionNumber: number, content: Record<string, unknown>, aiSuggested?: boolean) => {
      const updated = await updateSectionApi(prdId, sectionNumber, content, aiSuggested);
      setPrd((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.sectionNumber === sectionNumber ? updated : s,
          ),
        };
      });
    },
    [prdId],
  );

  return { prd, loading, error, sectionStatuses, getSection, saveSection, reload: load };
}
