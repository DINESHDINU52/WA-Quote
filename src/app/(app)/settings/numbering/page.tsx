'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { numberingSettingsSchema, type NumberingSettings } from '@/lib/schemas';
import { seedCounter, type DocType } from '@/lib/numbering';
import { fyFromDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const DEFAULTS: NumberingSettings = {
  prefix: {
    quotation: 'CHN/QT',
    proforma: 'CHN/PI',
    po: 'CHN/PO',
    invoice: 'CHN/INV',
    creditNote: 'CHN/CN'
  },
  pattern: 'per-fy',
  pad: 4
};

const DOC_TYPES: { key: DocType; label: string; legacyHint: string }[] = [
  { key: 'quotation', label: 'Quotation', legacyHint: 'Last quotation # e.g. 12548' },
  { key: 'proforma', label: 'Proforma Invoice', legacyHint: 'Last proforma # e.g. 12' },
  { key: 'po', label: 'Purchase Order', legacyHint: 'Last PO # e.g. 5' }
];

export default function NumberingSettingsPage() {
  const [settings, setSettings] = useState<NumberingSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-doc-type seed inputs (only applied when user clicks "Seed")
  const [seedFy, setSeedFy] = useState(fyFromDate(new Date()));
  const [seeds, setSeeds] = useState<Record<DocType, string>>({
    quotation: '',
    proforma: '',
    po: '',
    invoice: '',
    creditNote: ''
  });
  const [seedStatus, setSeedStatus] = useState<Record<DocType, string>>({
    quotation: '',
    proforma: '',
    po: '',
    invoice: '',
    creditNote: ''
  });

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'settings', 'numbering'));
        if (snap.exists()) {
          const parsed = numberingSettingsSchema.safeParse(snap.data());
          if (parsed.success) setSettings(parsed.data);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load settings');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function saveSettings() {
    setSaved(null);
    setError(null);
    const parsed = numberingSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      setError(parsed.error.errors.map((e) => e.message).join('; '));
      return;
    }
    try {
      await setDoc(
        doc(getDb(), 'settings', 'numbering'),
        { ...parsed.data, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaved('Saved.');
      setTimeout(() => setSaved(null), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
  }

  async function applySeed(t: DocType) {
    const raw = seeds[t].trim();
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setSeedStatus((s) => ({ ...s, [t]: 'Invalid number' }));
      return;
    }
    try {
      await seedCounter(t, seedFy, Math.floor(n), settings.pattern);
      setSeedStatus((s) => ({
        ...s,
        [t]: `Seeded. Next ${t} will be ${preview(t, seedFy, n + 1)}`
      }));
    } catch (e: any) {
      setSeedStatus((s) => ({ ...s, [t]: e?.message ?? 'Failed' }));
    }
  }

  function preview(t: DocType, fy: string, seq: number) {
    const seqStr = String(seq).padStart(settings.pad, '0');
    return settings.pattern === 'per-fy'
      ? `${settings.prefix[t]}/${fy}/${seqStr}`
      : `${settings.prefix[t]}/${seqStr}`;
  }

  if (!loaded) {
    return <div className="text-ink-400">Loading numbering settings...</div>;
  }

  return (
    <>
      <PageHeader
        title="Numbering"
        description="Set how new documents are numbered. Seed your current numbers once, then every issue auto-increments atomically."
      />

      <section className="card p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-900">Pattern & prefixes</h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Pattern</label>
            <select
              className="input"
              value={settings.pattern}
              onChange={(e) => setSettings({ ...settings, pattern: e.target.value as any })}
            >
              <option value="per-fy">Per Financial Year — e.g. CHN/INV/2526/0001</option>
              <option value="continuous">Continuous — e.g. CHN/INV/0001</option>
            </select>
          </div>
          <div>
            <label className="label">Sequence padding</label>
            <input
              type="number"
              className="input num"
              min={1}
              max={8}
              value={settings.pad}
              onChange={(e) => setSettings({ ...settings, pad: Number(e.target.value) })}
            />
          </div>
          {DOC_TYPES.map((t) => (
            <div key={t.key}>
              <label className="label">{t.label} prefix</label>
              <input
                className="input"
                value={settings.prefix[t.key]}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    prefix: { ...settings.prefix, [t.key]: e.target.value }
                  })
                }
              />
              <p className="mt-1 text-[11px] text-ink-400">
                Preview: <span className="num">{preview(t.key, fyFromDate(new Date()), 1)}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={saveSettings} className="btn-primary">
            Save numbering settings
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {saved}
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </span>
          )}
        </div>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-serif text-lg font-semibold text-ink-900">
          Seed current numbers
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Enter the latest number you used outside CHN Billing for each document type. The next
          document issued from CHN Billing will be that number + 1. Seeding is per Financial Year.
        </p>

        <div className="mt-4 max-w-xs">
          <label className="label">Financial Year</label>
          <input
            className="input num"
            value={seedFy}
            onChange={(e) => setSeedFy(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="2526"
          />
          <p className="mt-1 text-[11px] text-ink-400">
            FY format: last 2 digits of start year + last 2 of end year (Apr–Mar). Today: {fyFromDate(new Date())}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {DOC_TYPES.map((t) => (
            <div key={t.key} className="rounded-md border border-ink-200 p-4">
              <div className="text-sm font-medium text-ink-900">{t.label}</div>
              <p className="text-[11px] text-ink-500">{t.legacyHint}</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min={0}
                  className="input num"
                  placeholder="0"
                  value={seeds[t.key]}
                  onChange={(e) => setSeeds((s) => ({ ...s, [t.key]: e.target.value }))}
                />
                <button onClick={() => applySeed(t.key)} className="btn-secondary whitespace-nowrap">
                  Seed
                </button>
              </div>
              {seedStatus[t.key] && (
                <p className="mt-2 text-[11px] text-emerald-700">{seedStatus[t.key]}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
