'use client';

import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastClose,
  ToastTitle,
  ToastDescription,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/useToast';
import { CheckCircle2, Loader2, AlertTriangle, Info } from 'lucide-react';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map((t) => {
        const icon =
          t.variant === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> :
          t.variant === 'destructive' ? <AlertTriangle className="h-4 w-4 shrink-0" /> :
          t.variant === 'loading' ? <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" /> :
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
        // Loading variants typically shouldn't show the close button — they
        // resolve programmatically when the op completes.
        const showClose = t.variant !== 'loading';
        return (
          <Toast key={t.id} variant={t.variant === 'success' ? 'success' : t.variant === 'loading' ? 'loading' : t.variant}>
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {icon}
              <div className="grid gap-1 flex-1 min-w-0">
                <ToastTitle>{t.title}</ToastTitle>
                {t.description && <ToastDescription>{t.description}</ToastDescription>}
              </div>
            </div>
            {showClose && <ToastClose />}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
