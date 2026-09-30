'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { PageHeader } from '@/components/page-header';
import { formatINR } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Wrench, Monitor } from 'lucide-react';

interface InstallationCharges {
  software: { description: string; hsn: string; rate: number; gstRate: number };
  device: { description: string; hsn: string; rate: number; gstRate: number };
}

const DEFAULTS: InstallationCharges = {
  software: {
    description: 'Software Installation Charges',
    hsn: '998315',
    rate: 750,
    gstRate: 0.18
  },
  device: {
    description: 'Device Installation Charges',
    hsn: '998717',
    rate: 750,
    gstRate: 0.18
  }
};

export default function InstallationPage() {
  const [data, setData] = useState<InstallationCharges>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'settings', 'installation'));
        if (snap.exists()) {
          const d = snap.data();
          setData({
            software: { ...DEFAULTS.software, ...d.software },
            device: { ...DEFAULTS.device, ...d.device }
          });
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function save() {
    setSaved(null);
    setError(null);
    try {
      await setDoc(
        doc(getDb(), 'settings', 'installation'),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaved('Installation charges saved.');
      setTimeout(() => setSaved(null), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
  }

  if (!loaded) return <div className="text-ink-400">Loading...</div>;

  return (
    <>
      <PageHeader
        title="Installation Charges"
        description="Fixed service charges added to quotations and proformas. Edit rates here — they'll be used when adding installation lines to documents."
      />

      <div className="grid grid-cols-1 gap-6 max-w-2xl md:grid-cols-2">
        {/* Software Installation */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">Software Installation</h3>
              <p className="text-[11px] text-ink-500">Software setup and onboarding</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={data.software.description}
                onChange={(e) =>
                  setData({ ...data, software: { ...data.software, description: e.target.value } })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">HSN/SAC</label>
                <input
                  className="input num"
                  value={data.software.hsn}
                  onChange={(e) =>
                    setData({ ...data, software: { ...data.software, hsn: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className="label">GST %</label>
                <input
                  className="input num"
                  type="number"
                  value={Math.round(data.software.gstRate * 100)}
                  onChange={(e) =>
                    setData({
                      ...data,
                      software: { ...data.software, gstRate: Number(e.target.value) / 100 }
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className="label">Rate (₹) per unit / service</label>
              <input
                className="input num text-lg font-bold"
                type="number"
                step="1"
                value={data.software.rate}
                onChange={(e) =>
                  setData({ ...data, software: { ...data.software, rate: Number(e.target.value) } })
                }
              />
            </div>
            <div className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
              Total per unit: <span className="font-bold num">{formatINR(data.software.rate + data.software.rate * data.software.gstRate)}</span> (₹{data.software.rate} + {Math.round(data.software.gstRate * 100)}% GST)
            </div>
          </div>
        </div>

        {/* Hardware / On-Site Installation */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">Hardware / On-Site Installation</h3>
              <p className="text-[11px] text-ink-500">Physical mounting, wiring & setup</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={data.device.description}
                onChange={(e) =>
                  setData({ ...data, device: { ...data.device, description: e.target.value } })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">HSN/SAC</label>
                <input
                  className="input num"
                  value={data.device.hsn}
                  onChange={(e) =>
                    setData({ ...data, device: { ...data.device, hsn: e.target.value } })
                  }
                />
              </div>
              <div>
                <label className="label">GST %</label>
                <input
                  className="input num"
                  type="number"
                  value={Math.round(data.device.gstRate * 100)}
                  onChange={(e) =>
                    setData({
                      ...data,
                      device: { ...data.device, gstRate: Number(e.target.value) / 100 }
                    })
                  }
                />
              </div>
            </div>
            <div>
              <label className="label">Rate (₹) per unit / service</label>
              <input
                className="input num text-lg font-bold"
                type="number"
                step="1"
                value={data.device.rate}
                onChange={(e) =>
                  setData({ ...data, device: { ...data.device, rate: Number(e.target.value) } })
                }
              />
            </div>
            <div className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
              Total per unit: <span className="font-bold num">{formatINR(data.device.rate + data.device.rate * data.device.gstRate)}</span> (₹{data.device.rate} + {Math.round(data.device.gstRate * 100)}% GST)
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} className="btn-primary">
          Save installation charges
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

      <div className="mt-4 text-xs text-ink-400 max-w-2xl">
        These charges are added as line items when you click "Add Software Installation" or "Add Device Installation" in the quotation/proforma editor.
      </div>
    </>
  );
}
