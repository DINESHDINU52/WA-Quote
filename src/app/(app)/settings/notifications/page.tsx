'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import {
  loadAudioPrefs,
  saveAudioPrefs,
  playTick,
  playUrgentTick,
  playAlarm,
  playTaskDone,
  playTaskAssigned,
  ensureAudioReady
} from '@/lib/audio';
import {
  loadNotifyPrefs,
  saveNotifyPrefs,
  notificationPermission,
  requestNotificationPermission,
  showNotification
} from '@/lib/notifications';
import { Volume2, VolumeX, Bell, BellOff, Play, CheckCircle2, AlertCircle } from 'lucide-react';

type SoundPreset = 'classic' | 'sports' | 'soft';

export default function NotificationsSettingsPage() {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volume, setVolume] = useState(0.6);
  const [preset, setPreset] = useState<SoundPreset>('classic');

  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [snooze, setSnooze] = useState(5);
  const [quietStart, setQuietStart] = useState<number | ''>('');
  const [quietEnd, setQuietEnd] = useState<number | ''>('');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    const a = loadAudioPrefs();
    setAudioEnabled(a.enabled);
    setVolume(a.volume);
    setPreset(a.alarmPreset);
    const n = loadNotifyPrefs();
    setNotifyEnabled(n.enabled);
    setSnooze(n.snoozeMinutes);
    setQuietStart(n.quietHoursStart ?? '');
    setQuietEnd(n.quietHoursEnd ?? '');
    setPermission(notificationPermission());
  }, []);

  function persistAudio(patch: Partial<{ enabled: boolean; volume: number; alarmPreset: SoundPreset }>) {
    saveAudioPrefs(patch);
  }
  function persistNotify(
    patch: Partial<{ enabled: boolean; snoozeMinutes: number; quietHoursStart?: number; quietHoursEnd?: number }>
  ) {
    saveNotifyPrefs(patch);
  }

  async function askPermission() {
    ensureAudioReady();
    const result = await requestNotificationPermission();
    setPermission(result);
  }

  function testNotification() {
    showNotification({
      title: '🔔 Test Notification',
      body: 'This is what reminders will look like.',
      tag: 'test'
    });
    playTaskAssigned();
  }

  return (
    <>
      <PageHeader
        title="Notifications & Sounds"
        description="Configure timer alarms, task reminders, and notification preferences."
      />

      {/* Sounds */}
      <section className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {audioEnabled ? (
            <Volume2 className="h-5 w-5 text-brand-600" />
          ) : (
            <VolumeX className="h-5 w-5 text-ink-400" />
          )}
          <h2 className="text-base font-bold text-ink-900">Sound Settings</h2>
        </div>

        {/* Master toggle */}
        <label className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50/30 px-4 py-3 mb-4 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-ink-900">Sound Effects</div>
            <div className="text-xs text-ink-500 mt-0.5">
              Timer ticks, alarms, and task action sounds
            </div>
          </div>
          <input
            type="checkbox"
            checked={audioEnabled}
            onChange={(e) => {
              setAudioEnabled(e.target.checked);
              persistAudio({ enabled: e.target.checked });
            }}
            className="h-5 w-5 rounded text-brand-600 focus:ring-brand-500"
          />
        </label>

        {/* Volume */}
        <div className="mb-4">
          <label className="label">
            Volume <span className="text-ink-400 font-normal">{Math.round(volume * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              persistAudio({ volume: v });
            }}
            className="w-full"
            disabled={!audioEnabled}
          />
        </div>

        {/* Alarm preset */}
        <div className="mb-4">
          <label className="label">Alarm Sound</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['classic', 'sports', 'soft'] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPreset(p);
                  persistAudio({ alarmPreset: p });
                  ensureAudioReady();
                  playAlarm();
                }}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  preset === p
                    ? 'border-brand-500 bg-brand-50/50 text-brand-700'
                    : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50/50'
                }`}
                disabled={!audioEnabled}
              >
                <span className="font-medium capitalize">{p}</span>
                <Play className="h-3.5 w-3.5 opacity-60" />
              </button>
            ))}
          </div>
        </div>

        {/* Test sounds */}
        <div className="rounded-lg bg-ink-50/40 px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">
            Test Individual Sounds
          </div>
          <div className="flex flex-wrap gap-2">
            <TestBtn label="Tick" onClick={playTick} disabled={!audioEnabled} />
            <TestBtn label="Urgent Tick" onClick={playUrgentTick} disabled={!audioEnabled} />
            <TestBtn label="Alarm" onClick={playAlarm} disabled={!audioEnabled} />
            <TestBtn label="Task Done" onClick={playTaskDone} disabled={!audioEnabled} />
            <TestBtn label="Task Ping" onClick={playTaskAssigned} disabled={!audioEnabled} />
          </div>
        </div>
      </section>

      {/* Push notifications */}
      <section className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {notifyEnabled ? (
            <Bell className="h-5 w-5 text-brand-600" />
          ) : (
            <BellOff className="h-5 w-5 text-ink-400" />
          )}
          <h2 className="text-base font-bold text-ink-900">Desktop Notifications</h2>
        </div>

        {/* Permission status */}
        <div className="mb-4 rounded-lg border border-ink-200 bg-ink-50/30 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Browser Permission:
            </span>
            <PermBadge permission={permission} />
          </div>
          {permission === 'default' && (
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-ink-600">
                Click below to allow this site to show notifications.
              </div>
              <button onClick={askPermission} className="btn-primary text-xs px-3 py-1.5">
                Enable
              </button>
            </div>
          )}
          {permission === 'denied' && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-rose-600 font-semibold">
                Notifications are blocked by your browser.
              </div>
              <div className="rounded-md bg-rose-50/60 border border-rose-100 px-3 py-2 text-[11px] text-rose-700 leading-relaxed">
                <div className="font-bold mb-1">To unblock:</div>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Click the lock icon (🔒) or tune icon next to the URL in your address bar</li>
                  <li>Find <span className="font-semibold">Notifications</span> in the dropdown</li>
                  <li>Change from <span className="font-semibold">Block</span> to <span className="font-semibold">Allow</span></li>
                  <li>Reload this page</li>
                </ol>
              </div>
            </div>
          )}
          {permission === 'granted' && (
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-emerald-700">
                ✓ Notifications enabled. You&apos;ll receive task reminders and timer alerts.
              </div>
              <button onClick={testNotification} className="btn-secondary text-xs px-3 py-1.5">
                Test
              </button>
            </div>
          )}
        </div>

        {/* Master toggle */}
        <label className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50/30 px-4 py-3 mb-4 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-ink-900">App Notifications</div>
            <div className="text-xs text-ink-500 mt-0.5">
              Even when granted by browser, you can mute them here.
            </div>
          </div>
          <input
            type="checkbox"
            checked={notifyEnabled}
            onChange={(e) => {
              setNotifyEnabled(e.target.checked);
              persistNotify({ enabled: e.target.checked });
            }}
            className="h-5 w-5 rounded text-brand-600 focus:ring-brand-500"
          />
        </label>

        {/* Snooze */}
        <div className="mb-4">
          <label className="label">Default Snooze</label>
          <select
            value={snooze}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSnooze(v);
              persistNotify({ snoozeMinutes: v });
            }}
            className="input w-48"
            disabled={!notifyEnabled}
          >
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </div>

        {/* Quiet hours */}
        <div>
          <label className="label">Quiet Hours (no notifications)</label>
          <div className="flex items-center gap-2 text-sm">
            <select
              value={quietStart === '' ? '' : String(quietStart)}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value);
                setQuietStart(v);
                persistNotify({ quietHoursStart: v === '' ? undefined : v });
              }}
              className="input w-32"
              disabled={!notifyEnabled}
            >
              <option value="">Off</option>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <span className="text-ink-500">to</span>
            <select
              value={quietEnd === '' ? '' : String(quietEnd)}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value);
                setQuietEnd(v);
                persistNotify({ quietHoursEnd: v === '' ? undefined : v });
              }}
              className="input w-32"
              disabled={!notifyEnabled}
            >
              <option value="">Off</option>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-ink-400 mt-1">
            Notifications during these hours will be silenced. Sounds still play if "Sound Effects" is on.
          </p>
        </div>
      </section>
    </>
  );
}

function TestBtn({
  label,
  onClick,
  disabled
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => {
        ensureAudioReady();
        onClick();
      }}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md bg-white border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Play className="h-3 w-3" />
      {label}
    </button>
  );
}

function PermBadge({ permission }: { permission: NotificationPermission | 'unsupported' }) {
  if (permission === 'granted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold">
        <CheckCircle2 className="h-3 w-3" />
        Granted
      </span>
    );
  }
  if (permission === 'denied') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[11px] font-semibold">
        <AlertCircle className="h-3 w-3" />
        Denied
      </span>
    );
  }
  if (permission === 'unsupported') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 text-ink-600 px-2 py-0.5 text-[11px] font-semibold">
        Unsupported
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-semibold">
      Not Asked
    </span>
  );
}
