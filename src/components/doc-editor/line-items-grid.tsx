'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Trash2, GripVertical, Plus, X, Monitor, Wrench } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { getDb } from '@/lib/firebase/client';
import { ProductPicker, type PickedProduct } from './product-picker';
import type { LineItemInput } from '@/lib/schemas';

interface InstallationConfig {
  description: string;
  hsn: string;
  rate: number;
  gstRate: number;
}

const DEFAULT_SOFTWARE: InstallationConfig = {
  description: 'Software Installation Charges',
  hsn: '998315',
  rate: 750,
  gstRate: 0.18
};

const DEFAULT_DEVICE: InstallationConfig = {
  description: 'Device Installation Charges',
  hsn: '998717',
  rate: 750,
  gstRate: 0.18
};

interface LineItemsGridProps {
  lines: LineItemInput[];
  onChange: (lines: LineItemInput[]) => void;
  taxMode: 'intra' | 'inter';
}

export function LineItemsGrid({ lines, onChange, taxMode }: LineItemsGridProps) {
  const [installConfig, setInstallConfig] = useState<{
    software: InstallationConfig;
    device: InstallationConfig;
  }>({ software: DEFAULT_SOFTWARE, device: DEFAULT_DEVICE });

  // Load installation charges from Firestore settings
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'settings', 'installation'));
        if (snap.exists()) {
          const d = snap.data();
          setInstallConfig({
            software: { ...DEFAULT_SOFTWARE, ...d.software },
            device: { ...DEFAULT_DEVICE, ...d.device }
          });
        }
      } catch {}
    })();
  }, []);

  function update(idx: number, patch: Partial<LineItemInput>) {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function remove(idx: number) {
    onChange(lines.filter((_, i) => i !== idx));
  }
  function appendProduct(p: PickedProduct) {
    const desc = [p.name, p.features, p.connectivity].filter(Boolean).join('\n');
    onChange([
      ...lines,
      {
        productId: p.id,
        description: desc,
        hsn: p.hsn,
        qty: 1,
        rate: p.rate,
        gstRate: p.gstRate,
        discount: 0,
        serials: []
      }
    ]);
  }
  function appendBlank() {
    onChange([
      ...lines,
      {
        productId: '',
        description: '',
        hsn: '',
        qty: 1,
        rate: 0,
        gstRate: 0.18,
        discount: 0,
        serials: []
      }
    ]);
  }
  function addInstallation(type: 'software' | 'device') {
    const cfg = installConfig[type];
    onChange([
      ...lines,
      {
        productId: '',
        description: cfg.description,
        hsn: cfg.hsn,
        qty: 1,
        rate: cfg.rate,
        gstRate: cfg.gstRate,
        discount: 0,
        serials: []
      }
    ]);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50 px-4 py-2.5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Line items · {taxMode === 'intra' ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)'}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={appendBlank} className="btn-secondary px-3 py-1.5 text-xs">
            <Plus className="h-3 w-3" />
            Blank row
          </button>
          <button
            onClick={() => addInstallation('software')}
            className="btn-secondary px-3 py-1.5 text-xs"
            title="Add Software Installation Charges"
          >
            <Monitor className="h-3 w-3" />
            Software Install
          </button>
          <button
            onClick={() => addInstallation('device')}
            className="btn-secondary px-3 py-1.5 text-xs"
            title="Add Device Installation Charges"
          >
            <Wrench className="h-3 w-3" />
            Device Install
          </button>
          <ProductPicker onPick={appendProduct} />
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
          <tr className="border-b border-ink-100">
            <th className="w-8 px-3 py-2" />
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">HSN/SAC</th>
            <th className="px-3 py-2 font-medium text-right">Qty</th>
            <th className="px-3 py-2 font-medium text-right">Rate</th>
            <th className="px-3 py-2 font-medium text-right">GST%</th>
            <th className="px-3 py-2 font-medium text-right">Discount</th>
            <th className="px-3 py-2 font-medium text-right">Total</th>
            <th className="w-8 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {lines.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-ink-400">
                Add a product or a blank row to start.
              </td>
            </tr>
          )}
          {lines.map((l, idx) => {
            const gross = (l.qty || 0) * (l.rate || 0);
            const amount = Math.max(0, gross - (l.discount || 0));
            const tax = amount * (l.gstRate || 0);
            const total = amount + tax;
            return (
              <tr key={idx} className="align-top">
                <td className="px-2 py-3 text-ink-300">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="px-3 py-3">
                  <textarea
                    value={l.description}
                    onChange={(e) => update(idx, { description: e.target.value })}
                    placeholder="Item description"
                    rows={Math.max(1, (l.description || '').split('\n').length)}
                    className="w-full resize-none border-0 bg-transparent p-0 text-sm text-ink-900 outline-none"
                  />
                  {l.serials.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {l.serials.map((s, sidx) => (
                        <div
                          key={sidx}
                          className="flex items-center gap-2 rounded bg-ink-50 px-2 py-1 text-xs text-ink-700"
                        >
                          <span className="text-ink-500">S/N</span>
                          <input
                            value={s}
                            onChange={(e) =>
                              update(idx, {
                                serials: l.serials.map((sv, j) =>
                                  j === sidx ? e.target.value : sv
                                )
                              })
                            }
                            className="flex-1 bg-transparent text-xs outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              update(idx, {
                                serials: l.serials.filter((_, j) => j !== sidx)
                              })
                            }
                            className="text-ink-400 hover:text-ink-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => update(idx, { serials: [...l.serials, ''] })}
                    className="mt-1 text-[11px] text-brand-700 hover:underline"
                  >
                    + Add serial number
                  </button>
                </td>
                <td className="px-3 py-3">
                  <input
                    value={l.hsn}
                    onChange={(e) => update(idx, { hsn: e.target.value })}
                    className="w-24 border-0 bg-transparent p-0 text-sm num text-ink-900 outline-none"
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.qty}
                    onChange={(e) => update(idx, { qty: Number(e.target.value) })}
                    className="w-16 border-0 bg-transparent p-0 text-right text-sm num text-ink-900 outline-none"
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.rate}
                    onChange={(e) => update(idx, { rate: Number(e.target.value) })}
                    className="w-24 border-0 bg-transparent p-0 text-right text-sm num text-ink-900 outline-none"
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={Math.round(l.gstRate * 100)}
                    onChange={(e) =>
                      update(idx, { gstRate: Number(e.target.value) / 100 })
                    }
                    className="w-12 border-0 bg-transparent p-0 text-right text-sm num text-ink-900 outline-none"
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.discount || 0}
                    onChange={(e) => update(idx, { discount: Number(e.target.value) })}
                    className="w-20 border-0 bg-transparent p-0 text-right text-sm num text-ink-900 outline-none"
                  />
                </td>
                <td className="px-3 py-3 text-right num text-sm font-medium text-ink-900">
                  {formatINR(total)}
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => remove(idx)}
                    type="button"
                    className="text-ink-400 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
