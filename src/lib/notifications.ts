/**
 * Browser notification helper. Uses the Notifications API for desktop/mobile push.
 * Works alongside the existing PWA service worker for background alerts.
 */

const STORAGE_KEY = 'chn-notify-prefs';

interface NotifyPrefs {
  enabled: boolean;
  quietHoursStart?: number; // 0-23
  quietHoursEnd?: number;
  snoozeMinutes: number;
}

const DEFAULT: NotifyPrefs = {
  enabled: true,
  snoozeMinutes: 5
};

let _prefs: NotifyPrefs | null = null;

export function loadNotifyPrefs(): NotifyPrefs {
  if (_prefs) return _prefs;
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      _prefs = { ...DEFAULT, ...JSON.parse(raw) };
      return _prefs!;
    }
  } catch {}
  _prefs = { ...DEFAULT };
  return _prefs;
}

export function saveNotifyPrefs(prefs: Partial<NotifyPrefs>): NotifyPrefs {
  const current = loadNotifyPrefs();
  _prefs = { ...current, ...prefs };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_prefs));
    } catch {}
  }
  return _prefs;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function isInQuietHours(): boolean {
  const prefs = loadNotifyPrefs();
  if (prefs.quietHoursStart == null || prefs.quietHoursEnd == null) return false;
  const hour = new Date().getHours();
  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  // Wraps midnight (e.g., 22→7)
  return hour >= start || hour < end;
}

export interface NotifyOptions {
  title: string;
  body?: string;
  tag?: string;
  icon?: string;
  silent?: boolean;
  /** When user clicks notification — runs in app context. */
  onClick?: () => void;
  /** Renotify even if a notification with same tag exists. */
  renotify?: boolean;
}

export function showNotification(opts: NotifyOptions): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  const prefs = loadNotifyPrefs();
  if (!prefs.enabled) return false;
  if (Notification.permission !== 'granted') return false;
  if (isInQuietHours()) return false;

  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      icon: opts.icon || '/CHN QUOTEDESK.png',
      silent: opts.silent
      // renotify is unreliable across browsers — relying on tag override instead
    } as NotificationOptions);
    if (opts.onClick) {
      n.onclick = (ev) => {
        ev.preventDefault();
        window.focus();
        opts.onClick!();
        n.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}
