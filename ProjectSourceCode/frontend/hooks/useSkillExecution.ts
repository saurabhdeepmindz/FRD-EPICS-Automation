'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  executeSkill,
  getExecution,
  approveExecution,
  type BaSkillExecution,
} from '@/lib/ba-api';

interface UseSkillExecutionReturn {
  execution: BaSkillExecution | null;
  running: boolean;
  error: string | null;
  start: () => Promise<void>;
  approve: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook to manage a single skill execution lifecycle:
 * start → poll → awaiting_review → approve
 */
export function useSkillExecution(
  moduleDbId: string,
  skillName: string,
  existingExecution?: BaSkillExecution | null,
): UseSkillExecutionReturn {
  const [execution, setExecution] = useState<BaSkillExecution | null>(existingExecution ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync with external execution prop
  useEffect(() => {
    if (existingExecution) setExecution(existingExecution);
  }, [existingExecution]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((execId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const exec = await getExecution(moduleDbId, execId);
        setExecution(exec);
        if (exec.status === 'AWAITING_REVIEW' || exec.status === 'APPROVED' || exec.status === 'FAILED' || exec.status === 'COMPLETED') {
          stopPolling();
          setRunning(false);
          if (exec.status === 'FAILED') {
            setError(exec.errorMessage ?? 'Skill execution failed');
          }
        }
      } catch {
        // Silently continue polling
      }
    }, 3000); // Poll every 3 seconds
  }, [moduleDbId, stopPolling]);

  const start = useCallback(async () => {
    setError(null);
    setRunning(true);
    try {
      const result = await executeSkill(moduleDbId, skillName);
      setExecution({
        id: result.executionId,
        skillName: result.skill,
        status: 'RUNNING',
        humanDocument: null,
        handoffPacket: null,
        errorMessage: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        createdAt: new Date().toISOString(),
      });
      startPolling(result.executionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start skill execution';
      setError(msg);
      setRunning(false);
    }
  }, [moduleDbId, skillName, startPolling]);

  const approve = useCallback(async () => {
    if (!execution) return;
    try {
      const approved = await approveExecution(execution.id);
      setExecution(approved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve execution');
    }
  }, [execution]);

  const reset = useCallback(() => {
    stopPolling();
    setExecution(null);
    setRunning(false);
    setError(null);
  }, [stopPolling]);

  return { execution, running, error, start, approve, reset };
}
