'use client';

/**
 * In-app toast notification system. Shows premium animated toasts in the
 * top-right corner with auto-dismiss, action buttons, and sound integration.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Bell,
  X,
  Clock,
  Timer as TimerIcon
} from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'warn' | 'task' | 'timer';

export interface ToastAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface ToastInput {
  id?: string;
  kind?: ToastKind;
  title: string;
  description?: string;
  /** ms before auto-dismiss. 0 or false = no auto-dismiss. Default 4500. */
  duration?: number;
  actions?: ToastAction[];
  /** Optional icon override. */
  icon?: ReactNode;
  /** When true, plays the matching sound. */
  sound?: boolean;
}

export interface Toast extends ToastInput {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput): string => {
      const id =
        input.id ?? `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const toast: Toast = {
        ...input,
        id,
        kind: input.kind ?? 'info',
        createdAt: Date.now()
      };

      setToasts((list) => {
        // Replace any existing toast with the same id
        const filtered = list.filter((t) => t.id !== id);
        return [...filtered, toast].slice(-5); // keep max 5 visible
      });

      // Play sound if requested
      if (input.sound !== false) {
        // Lazy import audio to avoid SSR issues
        import('./audio').then((a) => {
          if (toast.kind === 'success') a.playTaskDone();
          else if (toast.kind === 'task') a.playTaskAssigned();
          else if (toast.kind === 'timer') a.playAlarm();
          else if (toast.kind === 'error') a.playUrgentTick();
          else a.playTick();
        }).catch(() => {});
      }

      // Auto-dismiss
      const duration = input.duration ?? 4500;
      if (duration > 0) {
        const t = window.setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, t);
      }

      return id;
    },
    [dismiss]
  );

  const dismissAll = useCallback(() => {
    setToasts([]);
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ show, dismiss, dismissAll }),
    [show, dismiss, dismissAll]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback when provider is missing (avoids crashes during SSR)
    return {
      show: () => '',
      dismiss: () => {},
      dismissAll: () => {}
    };
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Toast Viewport — the visual stack
// ---------------------------------------------------------------------------

function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed z-[100] top-4 right-4 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const KIND_STYLES: Record<
  ToastKind,
  { bar: string; iconBg: string; icon: ReactNode; ring: string }
> = {
  success: {
    bar: 'from-emerald-500 to-teal-400',
    iconBg: 'bg-emerald-50 text-emerald-600',
    icon: <CheckCircle2 className="h-5 w-5" />,
    ring: 'ring-emerald-200/50'
  },
  error: {
    bar: 'from-rose-600 to-pink-500',
    iconBg: 'bg-rose-50 text-rose-600',
    icon: <AlertCircle className="h-5 w-5" />,
    ring: 'ring-rose-200/50'
  },
  info: {
    bar: 'from-brand-500 to-cyan-400',
    iconBg: 'bg-brand-50 text-brand-600',
    icon: <Info className="h-5 w-5" />,
    ring: 'ring-brand-200/50'
  },
  warn: {
    bar: 'from-amber-500 to-orange-400',
    iconBg: 'bg-amber-50 text-amber-600',
    icon: <AlertCircle className="h-5 w-5" />,
    ring: 'ring-amber-200/50'
  },
  task: {
    bar: 'from-indigo-500 to-purple-500',
    iconBg: 'bg-indigo-50 text-indigo-600',
    icon: <Bell className="h-5 w-5" />,
    ring: 'ring-indigo-200/50'
  },
  timer: {
    bar: 'from-rose-500 via-orange-500 to-amber-400',
    iconBg: 'bg-amber-50 text-rose-600',
    icon: <TimerIcon className="h-5 w-5" />,
    ring: 'ring-amber-200/50'
  }
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);
  const styles = KIND_STYLES[toast.kind || 'info'];

  function handleDismiss() {
    setExiting(true);
    window.setTimeout(onDismiss, 180);
  }

  function timeAgo() {
    const sec = Math.floor((Date.now() - toast.createdAt) / 1000);
    if (sec < 5) return 'Just now';
    return `${sec}s ago`;
  }

  return (
    <div
      role="status"
      className={`pointer-events-auto w-[380px] max-w-[92vw] rounded-xl bg-white shadow-2xl shadow-ink-900/10 ring-1 ${styles.ring} overflow-hidden border border-ink-100 ${
        exiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
      style={{
        boxShadow:
          '0 20px 40px -12px rgba(15,23,42,0.18), 0 8px 20px -6px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.04)'
      }}
    >
      {/* Top accent bar */}
      <div className={`h-1 bg-gradient-to-r ${styles.bar}`} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 grid h-10 w-10 place-items-center rounded-lg ${styles.iconBg}`}>
            {toast.icon ?? styles.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-bold text-ink-900 leading-tight">{toast.title}</div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 -mr-1 -mt-0.5 text-ink-400 hover:text-ink-700 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {toast.description && (
              <div className="mt-1 text-xs text-ink-600 leading-relaxed">
                {toast.description}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-medium text-ink-400">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo()}
            </div>

            {/* Actions */}
            {toast.actions && toast.actions.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                {toast.actions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      action.onClick();
                      handleDismiss();
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      action.primary
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar (auto-dismiss countdown) */}
      {toast.duration !== 0 && (
        <div
          className={`h-0.5 bg-gradient-to-r ${styles.bar} origin-right`}
          style={{
            animation: `toast-progress ${toast.duration ?? 4500}ms linear forwards`
          }}
        />
      )}
    </div>
  );
}
