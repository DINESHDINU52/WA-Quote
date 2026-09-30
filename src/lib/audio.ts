/**
 * Web Audio API tone generator — no external sound files needed.
 * Generates short tones for timer ticks, alarms, and task notifications.
 *
 * All tones respect the user's "Sounds enabled" preference and volume.
 */

type SoundPreset = 'classic' | 'sports' | 'soft';

interface AudioPrefs {
  enabled: boolean;
  volume: number; // 0..1
  alarmPreset: SoundPreset;
}

const STORAGE_KEY = 'chn-audio-prefs';
const DEFAULT_PREFS: AudioPrefs = {
  enabled: true,
  volume: 0.6,
  alarmPreset: 'classic'
};

let _ctx: AudioContext | null = null;
let _prefs: AudioPrefs | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
    return _ctx;
  } catch {
    return null;
  }
}

export function loadAudioPrefs(): AudioPrefs {
  if (_prefs) return _prefs;
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _prefs = { ...DEFAULT_PREFS, ...parsed };
      return _prefs!;
    }
  } catch {}
  _prefs = { ...DEFAULT_PREFS };
  return _prefs;
}

export function saveAudioPrefs(prefs: Partial<AudioPrefs>): AudioPrefs {
  const current = loadAudioPrefs();
  _prefs = { ...current, ...prefs };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_prefs));
    } catch {}
  }
  return _prefs;
}

function playTone(opts: {
  frequency: number;
  duration: number; // seconds
  volume?: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  startOffset?: number;
}): void {
  const prefs = loadAudioPrefs();
  if (!prefs.enabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  // Some browsers suspend the context until a user gesture. Try to resume.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime + (opts.startOffset ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.value = opts.frequency;
  const peak = (opts.volume ?? 0.7) * prefs.volume;
  const attack = opts.attack ?? 0.005;
  const release = opts.release ?? 0.05;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.linearRampToValueAtTime(peak, now + opts.duration - release);
  gain.gain.linearRampToValueAtTime(0, now + opts.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + opts.duration + 0.05);
}

/** Soft tick during the last 2 minutes of a timer (1 per second). */
export function playTick(): void {
  playTone({ frequency: 880, duration: 0.07, volume: 0.25, type: 'sine', release: 0.04 });
}

/** Urgent tick (last 10 seconds). */
export function playUrgentTick(): void {
  playTone({ frequency: 1320, duration: 0.08, volume: 0.45, type: 'square', release: 0.05 });
}

/** 3-tone alarm when timer hits zero. Preset varies. */
export function playAlarm(): void {
  const prefs = loadAudioPrefs();
  const preset = prefs.alarmPreset;
  if (preset === 'sports') {
    // Sports buzzer — square wave, descending
    playTone({ frequency: 1200, duration: 0.18, type: 'square', volume: 0.8, startOffset: 0 });
    playTone({ frequency: 900, duration: 0.18, type: 'square', volume: 0.8, startOffset: 0.22 });
    playTone({ frequency: 600, duration: 0.45, type: 'square', volume: 0.8, startOffset: 0.44 });
  } else if (preset === 'soft') {
    // Pleasant chime — major third
    playTone({ frequency: 880, duration: 0.4, type: 'sine', volume: 0.5, attack: 0.02, release: 0.25, startOffset: 0 });
    playTone({ frequency: 1100, duration: 0.4, type: 'sine', volume: 0.5, attack: 0.02, release: 0.25, startOffset: 0.18 });
    playTone({ frequency: 1320, duration: 0.6, type: 'sine', volume: 0.5, attack: 0.02, release: 0.4, startOffset: 0.36 });
  } else {
    // Classic bell — triangle, repeating
    for (let i = 0; i < 3; i++) {
      playTone({
        frequency: 1200,
        duration: 0.16,
        type: 'triangle',
        volume: 0.7,
        startOffset: i * 0.32
      });
      playTone({
        frequency: 900,
        duration: 0.16,
        type: 'triangle',
        volume: 0.7,
        startOffset: i * 0.32 + 0.16
      });
    }
  }
}

/** Pleasant 2-note chime when a task is checked off. */
export function playTaskDone(): void {
  playTone({ frequency: 880, duration: 0.12, type: 'sine', volume: 0.5, startOffset: 0 });
  playTone({ frequency: 1320, duration: 0.18, type: 'sine', volume: 0.5, startOffset: 0.1 });
}

/** Gentle ping for new task assigned. */
export function playTaskAssigned(): void {
  playTone({ frequency: 1500, duration: 0.1, type: 'sine', volume: 0.4, startOffset: 0 });
  playTone({ frequency: 1100, duration: 0.18, type: 'sine', volume: 0.4, startOffset: 0.08 });
}

/** Resume audio context after a user gesture. Required by browsers. */
export function ensureAudioReady(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}
