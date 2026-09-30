'use client';

import { useEffect, useRef, useState } from 'react';
import { Wrench } from 'lucide-react';
import { QUICK_SERVICES, quickServiceToLineItem, type QuickService } from '@/lib/quick-services';
import type { LineItemInput } from '@/lib/schemas';
import { formatINR } from '@/lib/utils';

interface QuickServicePickerProps {
  onPick: (item: LineItemInput, svc: QuickService) => void;
}

export function QuickServicePicker({ onPick }: QuickServicePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary"
        title="Add installation service"
      >
        <Wrench className="h-4 w-4" />
        Quick service
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[320px] max-w-[90vw] rounded-lg border border-ink-200 bg-white shadow-lg">
          <div className="border-b border-ink-100 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-500">
            Add service line
          </div>
          <div className="py-1">
            {QUICK_SERVICES.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => {
                  onPick(quickServiceToLineItem(svc), svc);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-brand-50 active:bg-brand-100 cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-sm text-ink-900">{svc.label}</div>
                  <div className="mt-0.5 text-xs text-ink-500 num">
                    SAC {svc.hsn} · {(svc.gstRate * 100).toFixed(0)}% GST
                  </div>
                </div>
                <div className="num text-sm font-semibold text-ink-700 flex-shrink-0">
                  {formatINR(svc.rate)}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">
            Rates editable after adding. Click to add.
          </div>
        </div>
      )}
    </div>
  );
}
