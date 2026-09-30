'use client';

import { useEffect, useRef, useState } from 'react';
import { useTimer, formatTime, type TimerStatus } from '@/lib/timer-context';
import { Pause, Play, Square, Pin, PinOff, Timer as TimerIcon, X, Plus } from 'lucide-react';

const POSITION_KEY = 'chn-timer-position';
const PIN_KEY = 'chn-timer-pinned';

interface Position {
  x: number;
  y: number;
}

function loadPosition(): Position {
  if (typeof window === 'undefined') return { x: 24, y: 24 };
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Default: bottom-right
  return { x: 24, y: 24 };
}

function savePosition(p: Position) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(p));
  } catch {}
}

const PRESETS = [
  { label: '5 min', sec: 5 * 60 },
  { label: '15 min', sec: 15 * 60 },
  { label: '25 min', sec: 25 * 60 },
  { label: '60 min', sec: 60 * 60 }
];

export function FloatingTimer() {
  const t = useTimer();
  const [position, setPosition] = useState<Position>({ x: 24, y: 24 });
  const [pinned, setPinned] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [showPicker, setShowPicker] = useState(false);
  const [customMin, setCustomMin] = useState<string>('10');
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Hydrate position + pinned from localStorage
  useEffect(() => {
    setPosition(loadPosition());
    if (typeof window !== 'undefined') {
      try {
        setPinned(localStorage.getItem(PIN_KEY) === '1');
      } catch {}
    }
  }, []);

  // Persist position
  useEffect(() => {
    savePosition(position);
  }, [position]);

  // Keep widget on-screen on resize
  useEffect(() => {
    const handler = () => {
      setPosition((p) => clampPosition(p, widgetRef.current));
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  function startDrag(e: React.PointerEvent) {
    if (pinned) return;
    if (!widgetRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: position.x,
      baseY: position.y
    };
  }
  function onDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition((p) =>
      clampPosition(
        {
          x: dragRef.current!.baseX - dx,
          y: dragRef.current!.baseY - dy
        },
        widgetRef.current
      )
    );
  }
  function endDrag(e: React.PointerEvent) {
    if (dragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
    dragRef.current = null;
  }

  function togglePin() {
    setPinned((p) => {
      const next = !p;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(PIN_KEY, next ? '1' : '0');
        } catch {}
      }
      return next;
    });
  }

  // Don't render at all if idle and not in picker mode
  const isIdle = t.status === 'idle';

  if (isIdle && !showPicker) {
    // Premium launcher pill in the corner
    return (
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="fixed z-[60] group flex items-center gap-2 rounded-full px-4 py-2.5 shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          right: position.x,
          bottom: position.y,
          background: 'linear-gradient(135deg, #f43f5e 0%, #f97316 50%, #f59e0b 100%)',
          boxShadow:
            '0 12px 30px -6px rgba(244,63,94,0.5), 0 4px 10px -2px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
        }}
        title="Open timer"
      >
        <TimerIcon className="h-4 w-4 text-white drop-shadow" />
        <span className="text-xs font-extrabold tracking-[0.18em] uppercase text-white drop-shadow">
          Timer
        </span>
      </button>
    );
  }

  if (isIdle && showPicker) {
    return (
      <div
        ref={widgetRef}
        className="fixed z-[60] w-[300px] rounded-2xl text-white border border-white/15 overflow-hidden"
        style={{
          right: position.x,
          bottom: position.y,
          background:
            'linear-gradient(155deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.96) 60%, rgba(15,23,42,0.97) 100%)',
          backdropFilter: 'blur(16px)',
          boxShadow:
            '0 24px 60px -16px rgba(0,0,0,0.55), 0 8px 20px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
        }}
      >
        <div className="h-[3px] bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400" />
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.07]">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/70">
            <TimerIcon className="h-3 w-3" />
            Set Timer
          </div>
          <button onClick={() => setShowPicker(false)} className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.sec}
                onClick={() => {
                  t.start(p.sec);
                  setShowPicker(false);
                }}
                className="px-3 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-sm font-bold transition-all border border-white/10 hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-500/10"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="240"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition-all"
              placeholder="Custom (min)"
            />
            <button
              onClick={() => {
                const m = Math.max(1, Math.min(240, Number(customMin) || 10));
                t.start(m * 60);
                setShowPicker(false);
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-extrabold uppercase tracking-wider hover:scale-[1.02] transition-transform"
              style={{
                background: 'linear-gradient(135deg, #f43f5e 0%, #f97316 100%)',
                boxShadow: '0 8px 20px -4px rgba(244,63,94,0.4)'
              }}
            >
              <Plus className="inline h-4 w-4 mr-0.5 -mt-0.5" /> Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active timer (running / paused / finished)
  const total = t.durationSec || 1;
  const pct = Math.min(100, Math.max(0, (t.remainingSec / total) * 100));
  const isLowTime = t.status === 'running' && t.remainingSec <= 120;
  const isFinished = t.status === 'finished';

  const gradient = isFinished
    ? 'from-rose-700 via-rose-600 to-orange-500'
    : isLowTime
    ? 'from-rose-600 via-orange-500 to-amber-400'
    : t.status === 'paused'
    ? 'from-slate-700 via-slate-600 to-slate-500'
    : 'from-emerald-600 via-emerald-500 to-cyan-400';

  const ringColor = isFinished ? '#fb7185' : isLowTime ? '#f97316' : t.status === 'paused' ? '#94a3b8' : '#10b981';

  return (
    <div
      ref={widgetRef}
      className={`fixed z-[60] select-none rounded-2xl text-white shadow-2xl border border-white/15 overflow-hidden ${
        collapsed ? 'w-44' : 'w-[300px]'
      } ${pinned ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${
        isLowTime || isFinished ? 'animate-pulse-slow' : ''
      }`}
      style={{
        right: position.x,
        bottom: position.y,
        background:
          'linear-gradient(155deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.96) 60%, rgba(15,23,42,0.97) 100%)',
        backdropFilter: 'blur(16px)',
        boxShadow:
          '0 24px 60px -16px rgba(0,0,0,0.55), 0 8px 20px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
      }}
      onPointerDown={startDrag}
      onPointerMove={onDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Sports-style gradient bar at top */}
      <div className={`h-[3px] bg-gradient-to-r ${gradient}`} />

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.07]">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white/70">
          <TimerIcon className="h-3 w-3" />
          {isFinished ? 'Time Up' : t.status === 'paused' ? 'Paused' : 'Live'}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePin();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title={pinned ? 'Unpin (allow drag)' : 'Pin (lock position)'}
          >
            {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors text-[10px] font-bold"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '◀' : '▶'}
          </button>
        </div>
      </div>

      {/* Body */}
      {collapsed ? (
        <div className="px-4 py-3">
          {t.label && (
            <div className="text-[10px] font-medium text-white/60 mb-1 truncate uppercase tracking-wider">
              {t.label}
            </div>
          )}
          <div className="text-2xl font-extrabold font-mono tracking-tight tabular-nums text-center">
            {formatTime(t.remainingSec)}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-5 pb-5">
          {t.label && (
            <div className="text-[10px] font-medium text-white/60 mb-3 truncate text-center uppercase tracking-[0.18em]">
              {t.label}
            </div>
          )}

          {/* Centered SVG circle with digits inside */}
          <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
            {/* Soft outer glow */}
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-40"
              style={{
                background:
                  isFinished || isLowTime
                    ? 'radial-gradient(circle, rgba(244,63,94,0.5), transparent 70%)'
                    : t.status === 'paused'
                    ? 'radial-gradient(circle, rgba(148,163,184,0.3), transparent 70%)'
                    : 'radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%)'
              }}
            />

            {/* Inner subtle disc */}
            <div
              className="absolute rounded-full"
              style={{
                inset: 12,
                background:
                  'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06), rgba(15,23,42,0.4) 70%)',
                boxShadow:
                  'inset 0 2px 8px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.04)'
              }}
            />

            {/* SVG ring — must be exact same size as parent */}
            <svg
              className="absolute inset-0 -rotate-90 pointer-events-none"
              width="200"
              height="200"
              viewBox="0 0 200 200"
            >
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  {isFinished ? (
                    <>
                      <stop offset="0%" stopColor="#fb7185" />
                      <stop offset="100%" stopColor="#f97316" />
                    </>
                  ) : isLowTime ? (
                    <>
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="60%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#fb7185" />
                    </>
                  ) : t.status === 'paused' ? (
                    <>
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#64748b" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </>
                  )}
                </linearGradient>
              </defs>
              {/* Track */}
              <circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="6"
              />
              {/* Progress */}
              <circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 86}
                strokeDashoffset={2 * Math.PI * 86 * (1 - pct / 100)}
                style={{
                  transition: 'stroke-dashoffset 1s linear',
                  filter: 'drop-shadow(0 0 6px ' + ringColor + '88)'
                }}
              />
            </svg>

            {/* Digits — absolute centered */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div
                className="font-mono tabular-nums leading-none font-extrabold tracking-[0.02em]"
                style={{
                  fontSize: '42px',
                  color: '#fff',
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)'
                }}
              >
                {formatTime(t.remainingSec)}
              </div>
              <div className="mt-1.5 text-[9px] font-bold tracking-[0.22em] uppercase text-white/50">
                {Math.round(pct)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-2 border-t border-white/[0.07] bg-black/20">
        {t.status === 'running' && (
          <>
            <ControlBtn onClick={t.pause} icon={<Pause className="h-4 w-4" />} label="Pause" />
            <ControlBtn onClick={t.stop} icon={<Square className="h-4 w-4" />} label="Stop" danger />
          </>
        )}
        {t.status === 'paused' && (
          <>
            <ControlBtn onClick={t.resume} icon={<Play className="h-4 w-4" />} label="Resume" emerald />
            <ControlBtn onClick={t.stop} icon={<Square className="h-4 w-4" />} label="Stop" danger />
          </>
        )}
        {t.status === 'finished' && (
          <button
            onClick={t.stop}
            className="col-span-2 py-3 text-sm font-extrabold uppercase tracking-widest bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-700 hover:to-orange-600 transition-all"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

function ControlBtn({
  onClick,
  icon,
  label,
  danger,
  emerald
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  emerald?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`relative py-3 flex items-center justify-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] transition-all first:border-r border-white/[0.07] ${
        danger
          ? 'text-rose-300 hover:bg-rose-500/15 hover:text-rose-200'
          : emerald
          ? 'text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200'
          : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function clampPosition(p: Position, el: HTMLElement | null): Position {
  if (typeof window === 'undefined') return p;
  const w = el?.offsetWidth ?? 288;
  const h = el?.offsetHeight ?? 220;
  const maxX = Math.max(0, window.innerWidth - w - 8);
  const maxY = Math.max(0, window.innerHeight - h - 8);
  return {
    x: Math.min(maxX, Math.max(8, p.x)),
    y: Math.min(maxY, Math.max(8, p.y))
  };
}
