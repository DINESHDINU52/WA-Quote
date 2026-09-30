'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Plus, Search, X } from 'lucide-react';
import { getDb } from '@/lib/firebase/client';
import type { ProductInput } from '@/lib/schemas';
import { formatINR } from '@/lib/utils';

export interface PickedProduct extends ProductInput {
  id: string;
}

interface ProductPickerProps {
  onPick: (p: PickedProduct) => void;
}

export function ProductPicker({ onPick }: ProductPickerProps) {
  const [list, setList] = useState<PickedProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(getDb(), 'products'), orderBy('name'));
    return onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductInput) })))
    );
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = list.filter((p) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.serialNumber || '').toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.features || '').toLowerCase().includes(q) ||
      (p.connectivity || '').toLowerCase().includes(q) ||
      (p.hsn || '').includes(q)
    );
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-primary"
      >
        <Plus className="h-4 w-4" />
        Add product
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[480px] max-w-[90vw] rounded-lg border border-ink-200 bg-white shadow-lg">
          {/* Search header */}
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
            <Search className="h-4 w-4 text-ink-400 flex-shrink-0" />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by serial number, model, features..."
              className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                className="text-ink-400 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Device list */}
          <div className="max-h-[320px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-ink-400">
                No devices match. Add one in <span className="font-medium">Devices</span> page.
              </div>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                  setFilter('');
                }}
                className="flex w-full items-center gap-4 border-b border-ink-50 px-4 py-3 text-left transition-colors hover:bg-brand-50 active:bg-brand-100 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-ink-900 truncate">{p.name}</span>
                    {p.serialNumber ? (
                      <span className="rounded bg-brand-50 border border-brand-200/60 px-1.5 py-0.2 text-[10px] font-mono font-medium text-brand-700 flex-shrink-0">
                        {p.serialNumber}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                    {p.features && <span>{p.features}</span>}
                    {p.connectivity && (
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-ink-700">
                        {p.connectivity}
                      </span>
                    )}
                    {p.hsn && <span className="num">HSN {p.hsn}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="num text-sm font-semibold text-ink-900">
                    {formatINR(p.rate)}
                  </div>
                  <div className="num text-xs text-ink-500">
                    {(p.gstRate * 100).toFixed(0)}% GST
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">
            {filtered.length} device{filtered.length !== 1 ? 's' : ''} · Click to add to invoice
          </div>
        </div>
      )}
    </div>
  );
}
