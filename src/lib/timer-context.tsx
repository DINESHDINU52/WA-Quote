'use client';

/**
 * Global timer state — single source of truth for the floating timer widget.
 * Persists to localStorage so it survives page navigation and refreshes.
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
import { playAlarm, playTick, playUrgentTick, ensureAudioReady } from './audio';
import { showNotification } from './notifications';
import { useToast } from './toast-context';

const STORAGE_KEY = 'chn-timer-state';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

interface TimerState {
  status: TimerStatus;
  /** Total duration in seconds (set when timer starts). */
  durationSec: number;
  /** Remaining seconds when paused; otherwise computed from endsAt. */
  remainingSec: number;
  /** Epoch ms when timer should hit zero (only used while running). */
  endsAt?: number;
  /** Optional task association. */
  label?: string;
  taskId?: string;
}

interface TimerContextValue extends TimerState {
  start: (durationSec: number, opts?: { label?: string; taskId?: string }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setLabel: (label: string) => void;
}

const DEFAULT_STATE: TimerState = {
  status: 'idle',
  durationSec: 0,
  remainingSec: 0
};

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

function loadPersisted(): TimerState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimerState;
    // If we were running, recompute remaining from endsAt
    if (parsed.status === 'running' && parsed.endsAt) {
      const remaining = Math.max(0, Math.round((parsed.endsAt - Date.now()) / 1000));
      if (remaining <= 0) {
        return { ...parsed, status: 'finished', remainingSec: 0 };
      }
      return { ...parsed, remainingSec: remaining };
    }
    return parsed;
  } catch {
    return null;
  }
}

function persist(state: TimerState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(DEFAULT_STATE);
  const tickRef = useRef<number | null>(null);
  const lastSecondRef = useRef<number>(-1);
  const alarmFiredRef = useRef<boolean>(false);
  const toast = useToast();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) setState(persisted);
  }, []);

  // Persist whenever state changes
  useEffect(() => {
    persist(state);
  }, [state]);

  const stopTicker = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTicker = useCallback(() => {
    stopTicker();
    tickRef.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.status !== 'running' || !prev.endsAt) return prev;
        const remaining = Math.max(0, Math.round((prev.endsAt - Date.now()) / 1000));

        // Sound effects on each tick during the last 2 minutes
        if (remaining > 0 && remaining <= 120 && lastSecondRef.current !== remaining) {
          lastSecondRef.current = remaining;
          if (remaining <= 10) {
            playUrgentTick();
          } else {
            playTick();
          }
        }

        if (remaining <= 0) {
          // Fire alarm only once
          if (!alarmFiredRef.current) {
            alarmFiredRef.current = true;
            // Schedule side effects AFTER this render commits — never call setState
            // on another component during this updater function.
            queueMicrotask(() => {
              try {
                playAlarm();
              } catch {}
              showNotification({
                title: '⏰ Timer finished',
                body: prev.label || 'Time is up.',
                tag: 'chn-timer'
              });
              try {
                toast.show({
                  kind: 'timer',
                  title: '⏰ Time up!',
                  description: prev.label || 'Your timer has finished.',
                  duration: 0,
                  sound: false // alarm already played
                });
              } catch {}
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try {
                  (navigator as any).vibrate([200, 100, 200, 100, 400]);
                } catch {}
              }
            });
          }
          return { ...prev, status: 'finished', remainingSec: 0 };
        }
        return { ...prev, remainingSec: remaining };
      });
    }, 1000) as unknown as number;
  }, [stopTicker, toast]);

  // Start/stop the ticker based on status
  useEffect(() => {
    if (state.status === 'running') {
      alarmFiredRef.current = false;
      startTicker();
    } else {
      stopTicker();
    }
    return () => stopTicker();
  }, [state.status, startTicker, stopTicker]);

  const start = useCallback(
    (durationSec: number, opts?: { label?: string; taskId?: string }) => {
      ensureAudioReady();
      lastSecondRef.current = -1;
      alarmFiredRef.current = false;
      const endsAt = Date.now() + durationSec * 1000;
      setState({
        status: 'running',
        durationSec,
        remainingSec: durationSec,
        endsAt,
        label: opts?.label,
        taskId: opts?.taskId
      });
    },
    []
  );

  const pause = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'running') return prev;
      const remaining = prev.endsAt
        ? Math.max(0, Math.round((prev.endsAt - Date.now()) / 1000))
        : prev.remainingSec;
      return { ...prev, status: 'paused', remainingSec: remaining, endsAt: undefined };
    });
  }, []);

  const resume = useCallback(() => {
    ensureAudioReady();
    setState((prev) => {
      if (prev.status !== 'paused' || prev.remainingSec <= 0) return prev;
      return {
        ...prev,
        status: 'running',
        endsAt: Date.now() + prev.remainingSec * 1000
      };
    });
  }, []);

  const stop = useCallback(() => {
    setState(DEFAULT_STATE);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, []);

  const setLabel = useCallback((label: string) => {
    setState((prev) => ({ ...prev, label }));
  }, []);

  const value = useMemo<TimerContextValue>(
    () => ({ ...state, start, pause, resume, stop, setLabel }),
    [state, start, pause, resume, stop, setLabel]
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside TimerProvider');
  return ctx;
}

export function formatTime(secondsTotal: number): string {
  const sec = Math.max(0, Math.floor(secondsTotal));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
