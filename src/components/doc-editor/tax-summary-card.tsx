'use client';

import { formatINR } from '@/lib/utils';
import type { TaxSummary } from '@/lib/doc-types';

interface TaxSummaryCardProps {
  summary: TaxSummary;
  taxMode: 'intra' | 'inter';
}

export function TaxSummaryCard({ summary, taxMode }: TaxSummaryCardProps) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
        Tax summary
      </h3>
      <dl className="space-y-1.5 text-sm">
        <Row label="Taxable Amount" value={summary.taxableAmount} />
        {taxMode === 'intra' ? (
          <>
            <Row label="CGST" value={summary.cgstTotal} />
            <Row label="SGST" value={summary.sgstTotal} />
          </>
        ) : (
          <Row label="IGST" value={summary.igstTotal} />
        )}
        {summary.roundOff !== 0 && <Row label="Round Off" value={summary.roundOff} />}
        <div className="my-2 border-t border-ink-100" />
        <div className="flex items-baseline justify-between">
          <dt className="text-sm font-semibold text-brand-700">Total (INR)</dt>
          <dd className="num text-lg font-semibold text-brand-700">
            {formatINR(summary.grandTotal)}
          </dd>
        </div>
        <div className="mt-2 text-[11px] italic text-ink-500">
          {summary.amountInWords}
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-600">{label}</dt>
      <dd className="num text-ink-900">{formatINR(value)}</dd>
    </div>
  );
}
