'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, ExternalLink, X, ShoppingBag } from 'lucide-react';
import { formatINR } from '@/lib/utils';

interface IssueSuccessModalProps {
  open: boolean;
  onClose: () => void;
  docType: 'quotation' | 'proforma' | 'po';
  docNumber: string;
  customerName: string;
  grandTotal: number;
  driveUrl?: string | null;
  emailSent?: boolean;
  emailTo?: string | null;
  pdfDownloadUrl?: string;
  docId?: string;
}

export function IssueSuccessModal({
  open,
  onClose,
  docType,
  docNumber,
  customerName,
  grandTotal,
  driveUrl,
  emailSent,
  emailTo,
  pdfDownloadUrl,
  docId
}: IssueSuccessModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      // Small delay for entrance animation
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const label =
    docType === 'quotation'
      ? 'Quotation'
      : docType === 'po'
      ? 'Purchase Order'
      : 'Proforma Invoice';

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink-900/40 backdrop-blur-sm p-4">
      <div
        className={`card w-full max-w-md overflow-hidden transition-all duration-300 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Success header */}
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-8 text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
            <CheckCircle2 className="h-9 w-9 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">{label} Issued</h2>
          <p className="mt-1 text-sm text-white/80">Successfully generated and backed up</p>
        </div>

        {/* Details */}
        <div className="px-6 py-5">
          <div className="space-y-3">
            <DetailRow icon={FileText} label="Document" value={docNumber} />
            <DetailRow icon={FileText} label="Customer" value={customerName} />
            <DetailRow
              icon={FileText}
              label="Amount"
              value={formatINR(grandTotal)}
              highlight
            />
          </div>

          {/* Status badges */}
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge
              icon={CheckCircle2}
              text="PDF Generated"
              variant="success"
            />
            {driveUrl && (
              <StatusBadge
                icon={ExternalLink}
                text="Saved to Drive"
                variant="success"
              />
            )}
            {!driveUrl && (
              <StatusBadge
                icon={ExternalLink}
                text="Drive backup skipped"
                variant="warning"
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-ink-100 bg-ink-50 px-6 py-4 space-y-3">
          {docType === 'proforma' && docId && (
            <Link
              href={`/purchase-orders/new?sourcePiId=${docId}`}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 shadow-sm transition-all text-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              Generate Purchase Order (PO)
            </Link>
          )}
          <div className="flex items-center gap-3">
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 justify-center"
              >
                <ExternalLink className="h-4 w-4" />
                View on Drive
              </a>
            )}
            <button onClick={onClose} className="btn-primary flex-1 justify-center">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function DetailRow({
  icon: Icon,
  label,
  value,
  highlight
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div
        className={`text-sm font-semibold num ${
          highlight ? 'text-brand-700 text-base' : 'text-ink-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  icon: Icon,
  text,
  variant
}: {
  icon: typeof CheckCircle2;
  text: string;
  variant: 'success' | 'warning' | 'neutral';
}) {
  const colors = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    neutral: 'bg-ink-50 text-ink-500 border-ink-200'
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${colors[variant]}`}
    >
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}
