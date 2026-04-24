'use client';

import { useEffect, useState } from 'react';

export type ToastVariant = 'default' | 'success' | 'destructive' | 'loading';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** 0 disables auto-dismiss (use for 'loading'). Defaults: success 3s, destructive 6s, default 4s. */
  durationMs?: number;
}

type Listener = (toasts: ToastData[]) => void;

/**
 * Module-level singleton so any component can fire a toast and the single
 * mounted <Toaster /> will receive it. The earlier per-component useState
 * implementation meant callers' toasts were trapped in their own component's
 * render tree and never reached the Toaster. Fixed here as part of UX5.
 */
let state: ToastData[] = [];
const listeners = new Set<Listener>();
let nextId = 0;

function emit() {
  for (const l of listeners) l(state);
}

function defaultDuration(v?: ToastVariant): number {
  if (v === 'loading') return 0;
  if (v === 'destructive') return 6000;
  if (v === 'success') return 3000;
  return 4000;
}

/**
 * Fire a toast. Returns `{ id, update, dismiss }` so long-running operations
 * can show a "Exporting…" loading toast and then `.update({ title: 'Done',
 * variant: 'success' })` when finished.
 */
export function pushToast(data: Omit<ToastData, 'id'>): {
  id: string;
  update: (patch: Partial<Omit<ToastData, 'id'>>) => void;
  dismiss: () => void;
} {
  const id = `t${++nextId}`;
  const toast: ToastData = { id, ...data };
  state = [...state, toast];
  emit();

  const ms = data.durationMs ?? defaultDuration(data.variant);
  if (ms > 0) {
    setTimeout(() => dismissToast(id), ms);
  }

  return {
    id,
    update: (patch) => {
      state = state.map((t) => (t.id === id ? { ...t, ...patch } : t));
      emit();
      // Re-arm auto-dismiss if the variant changed to a non-loading one and the
      // caller didn't explicitly set durationMs=0.
      if (patch.variant && patch.variant !== 'loading') {
        const newMs = patch.durationMs ?? defaultDuration(patch.variant);
        if (newMs > 0) setTimeout(() => dismissToast(id), newMs);
      }
    },
    dismiss: () => dismissToast(id),
  };
}

export function dismissToast(id: string): void {
  state = state.filter((t) => t.id !== id);
  emit();
}

/** Hook used by the mounted <Toaster /> to subscribe to the singleton. */
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>(state);

  useEffect(() => {
    const listener: Listener = (next) => setToasts(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    toasts,
    /**
     * Convenience for callers that just want fire-and-forget. Prefer `pushToast`
     * directly (non-React contexts + update/dismiss control).
     */
    toast: (data: Omit<ToastData, 'id'>) => pushToast(data),
    dismiss: dismissToast,
  };
}
