'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { DEFAULT_QUOTATION_TERMS } from '@/lib/doc-types';
import { PageHeader } from '@/components/page-header';
import { CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

interface TemplatesData {
  quotationTerms: string;
}

const DEFAULTS: TemplatesData = {
  quotationTerms: DEFAULT_QUOTATION_TERMS
};

export default function TemplatesSettingsPage() {
  const [data, setData] = useState<TemplatesData>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'settings', 'templates'));
        if (snap.exists()) {
          const d = snap.data();
          setData({
            quotationTerms: d.quotationTerms ?? DEFAULTS.quotationTerms
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
        doc(getDb(), 'settings', 'templates'),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaved('Templates saved.');
      setTimeout(() => setSaved(null), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
  }

  if (!loaded) return <div className="text-ink-400">Loading templates...</div>;

  return (
    <>
      <PageHeader
        title="Terms & Templates"
        description="Default terms and conditions printed on quotations. Edit here and they'll apply to all new documents."
      />

      <section className="card p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink-900">Quotation Terms & Conditions</h2>
            <p className="mt-1 text-xs text-ink-500">
              These terms are pre-filled on every new quotation. You can still edit them per-document in the editor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setData({ ...data, quotationTerms: DEFAULTS.quotationTerms })}
            className="btn-secondary text-xs"
            title="Reset to factory default"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset default
          </button>
        </div>

        <textarea
          value={data.quotationTerms}
          onChange={(e) => setData({ ...data, quotationTerms: e.target.value })}
          rows={Math.max(10, data.quotationTerms.split('\n').length + 2)}
          className="input font-mono text-xs leading-relaxed"
          placeholder="Enter your terms and conditions..."
        />

        <div className="mt-2 text-[11px] text-ink-400">
          Tip: Use numbered lines (1. 2. 3.) for clarity. Supports plain text only.
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} className="btn-primary">
            Save templates
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

      {/* Preview */}
      <section className="card p-6 max-w-3xl mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-500 mb-3">Preview (as printed on PDF)</h3>
        <div className="rounded-md border border-ink-100 bg-ink-50 p-4">
          <div className="text-[8.5px] font-bold uppercase tracking-wide text-ink-500 mb-2">TERMS & CONDITIONS</div>
          <div className="text-xs text-ink-700 leading-relaxed whitespace-pre-wrap font-mono">
            {data.quotationTerms || '(empty)'}
          </div>
        </div>
      </section>
    </>
  );
}
