'use client';

import type { BillingDoc } from '@/lib/doc-types';
import { getPaymentSummary } from '@/lib/payment-helpers';
import { X, ExternalLink, Image as ImageIcon, IndianRupee } from 'lucide-react';
import { formatINR } from '@/lib/utils';

interface DocRow extends BillingDoc {
  id: string;
}

interface Props {
  doc: DocRow;
  onClose: () => void;
}

export function ViewRefsDialog({ doc: row, onClose }: Props) {
  const summary = getPaymentSummary(row);
  const installments = summary.installments;
  const grandTotal = row.taxSummary?.grandTotal ?? 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink-900">Payment History</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {row.number} · {row.customer.companyName || row.customer.name}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary header */}
        <div className="px-6 py-4 bg-ink-50/60 border-b border-ink-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Grand Total</div>
              <div className="text-base font-bold text-ink-900 mt-1">{formatINR(grandTotal)}</div>
            </div>
            <div className="border-l border-r border-ink-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                {summary.isPaid ? 'Total Paid' : 'Paid So Far'}
              </div>
              <div className="text-base font-bold text-emerald-700 mt-1">
                {formatINR(summary.totalPaid)}
              </div>
              <div className="text-[10px] text-ink-400 mt-0.5">
                {summary.installmentCount} installment{summary.installmentCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Balance</div>
              <div className="text-base font-bold text-amber-700 mt-1">{formatINR(summary.balance)}</div>
              {summary.isPaid && (
                <div className="text-[10px] text-emerald-700 font-bold mt-0.5">✓ FULLY PAID</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {installments.length === 0 ? (
            <div className="text-center py-12 text-ink-400">
              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
              No payments recorded yet.
            </div>
          ) : (
            <div className="space-y-5">
              {installments.map((ins, instIdx) => (
                <div
                  key={ins.id}
                  className="rounded-lg border border-ink-200 overflow-hidden"
                >
                  {/* Installment header */}
                  <div className="flex items-center justify-between bg-emerald-50/60 px-4 py-2.5 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-600 text-white text-xs font-bold">
                        {instIdx + 1}
                      </span>
                      <span className="text-sm font-semibold text-ink-900">
                        Installment {instIdx + 1}
                      </span>
                      <span className="text-xs text-ink-500">
                        ·{' '}
                        {new Date(ins.paidAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-700 font-bold">
                      <IndianRupee className="h-3.5 w-3.5" />
                      <span className="num">
                        {ins.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {ins.notes && (
                    <div className="px-4 py-2 text-xs text-ink-600 bg-ink-50/30 border-b border-ink-100">
                      <span className="font-bold text-ink-500 uppercase tracking-wider text-[10px] mr-2">
                        Notes
                      </span>
                      {ins.notes}
                    </div>
                  )}

                  {/* References grid */}
                  <div className="p-4">
                    {ins.references.length === 0 ? (
                      <p className="text-xs text-ink-400 italic">No proof images for this installment.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {ins.references.map((ref, i) => (
                          <a
                            key={ref.fileId}
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block rounded-lg border border-ink-200 overflow-hidden hover:border-brand-400 hover:shadow-md transition-all"
                          >
                            <div className="aspect-square bg-gradient-to-br from-ink-50 to-ink-100 relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://drive.google.com/thumbnail?id=${ref.fileId}&sz=w400`}
                                alt={`Inst ${instIdx + 1} ref ${i + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  // Hide broken image and show the placeholder underneath
                                  img.style.display = 'none';
                                  const placeholder = img.nextElementSibling as HTMLElement | null;
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                              />
                              {/* Placeholder shown when thumbnail fails to load */}
                              <div
                                className="absolute inset-0 hidden flex-col items-center justify-center text-ink-400 bg-gradient-to-br from-brand-50/40 to-ink-100/40"
                                aria-hidden="true"
                              >
                                <ImageIcon className="h-10 w-10 mb-2 opacity-60" />
                                <div className="text-[10px] font-bold uppercase tracking-wider">
                                  Click to view
                                </div>
                                <div className="text-[10px] text-ink-400 mt-0.5 px-3 text-center truncate max-w-full">
                                  {ref.filename}
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity grid place-items-end p-2">
                                <span className="text-white text-xs flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" /> Open
                                </span>
                              </div>
                            </div>
                            <div className="p-2 text-xs">
                              <div className="font-medium text-ink-700 truncate">
                                Reference {i + 1}
                              </div>
                              <div className="text-[10px] text-ink-400">
                                {(ref.size / 1024).toFixed(0)} KB
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
