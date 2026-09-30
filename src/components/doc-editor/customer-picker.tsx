'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ChevronDown, Search, X } from 'lucide-react';
import { getDb } from '@/lib/firebase/client';
import type { CustomerInput } from '@/lib/schemas';
import { cn } from '@/lib/utils';

export interface PickedCustomer extends CustomerInput {
  id: string;
}

interface CustomerPickerProps {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
}

export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const [list, setList] = useState<PickedCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(getDb(), 'customers'), orderBy('name'));
    return onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomerInput) })))
    );
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = list.filter((c) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.billingAddress?.city || '').toLowerCase().includes(q)
    );
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full text-left rounded-md border border-ink-200 bg-white px-3 py-2.5 text-sm transition-colors hover:border-brand-300',
          open && 'border-brand-500 ring-2 ring-brand-100'
        )}
      >
        {value ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-ink-900">{value.companyName || value.name}</div>
              <div className="text-xs text-ink-500 num">
                {value.companyName ? `${value.name} · ` : ''}{value.gstin || 'No GSTIN'} · {value.billingAddress.state} ({value.billingAddress.stateCode})
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-ink-400 flex-shrink-0" />
          </div>
        ) : (
          <div className="flex items-center justify-between text-ink-400">
            <span>Select customer...</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-full min-w-[360px] rounded-lg border border-ink-200 bg-white shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
            <Search className="h-4 w-4 text-ink-400 flex-shrink-0" />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by name, GSTIN, phone, city..."
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

          {/* Customer list */}
          <div className="max-h-[280px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-ink-400">
                No customers match. Add one in <span className="font-medium">Customers</span> page.
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setFilter('');
                }}
                className="flex w-full items-center gap-3 border-b border-ink-50 px-4 py-3 text-left transition-colors hover:bg-brand-50 active:bg-brand-100 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-ink-900 truncate">{c.companyName || c.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-500">
                    {c.companyName && <span>{c.name}</span>}
                    <span className="num">{c.gstin || 'No GSTIN'}</span>
                    <span>{c.billingAddress.state} ({c.billingAddress.stateCode})</span>
                    {c.phone && <span className="num">{c.phone}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''} · Click to select
          </div>
        </div>
      )}
    </div>
  );
}
