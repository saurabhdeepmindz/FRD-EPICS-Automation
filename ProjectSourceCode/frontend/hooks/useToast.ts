'use client';

import { useCallback, useState } from 'react';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback(
    (data: Omit<ToastData, 'id'>) => {
      const id = String(++toastId);
      setToasts((prev) => [...prev, { ...data, id }]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismiss };
}
