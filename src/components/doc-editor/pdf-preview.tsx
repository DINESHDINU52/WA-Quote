'use client';

import { useEffect, useRef, useState } from 'react';
import type { BillingDoc } from '@/lib/doc-types';
import { Loader2, AlertCircle } from 'lucide-react';

interface PdfPreviewProps {
  /** The fully-built BillingDoc payload to render. */
  doc: BillingDoc;
  /**
   * Debounce in ms before calling /api/docs/preview. Higher = fewer
   * server hits during fast typing. Default 600.
   */
  debounceMs?: number;
}

export function PdfPreview({ doc, debounceMs = 600 }: PdfPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/docs/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || 'Preview failed');
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
        const objUrl = URL.createObjectURL(blob);
        lastObjectUrl.current = objUrl;
        setUrl(objUrl);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Preview failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [doc, debounceMs]);

  useEffect(() => {
    return () => {
      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current);
    };
  }, []);

  return (
    <div className="card relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 px-4 py-2.5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Live preview
        </div>
        {loading && (
          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Rendering...
          </span>
        )}
      </div>
      <div className="aspect-[1/1.414] w-full bg-ink-100">
        {error ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-700" />
              <div className="text-sm text-red-700">{error}</div>
              <div className="mt-1 text-[11px] text-ink-500">
                Fix the form fields and the preview will refresh.
              </div>
            </div>
          </div>
        ) : url ? (
          <iframe src={url} title="PDF preview" className="h-full w-full" />
        ) : (
          <div className="grid h-full place-items-center text-ink-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
