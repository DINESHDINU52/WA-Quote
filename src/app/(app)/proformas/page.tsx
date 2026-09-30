'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { PageHeader } from '@/components/page-header';
import { formatINR, formatInvoiceDate } from '@/lib/utils';
import type { BillingDoc } from '@/lib/doc-types';
import { getPaymentSummary } from '@/lib/payment-helpers';
import {
  Plus,
  ExternalLink,
  CheckCircle2,
  Bell,
  BellOff,
  Image as ImageIcon,
  Loader2,
  Mail,
  IndianRupee,
  ShoppingBag
} from 'lucide-react';
import { AddPaymentDialog } from './add-payment-dialog';
import { ViewRefsDialog } from './view-refs-dialog';
import {
  DocFilterBar,
  EMPTY_FILTERS,
  matchesSearch,
  matchesDateRange,
  type DocFilters
} from '@/components/doc-filter-bar';

interface ListRow extends BillingDoc {
  id: string;
}

export default function ProformasPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentDoc, setPaymentDoc] = useState<ListRow | null>(null);
  const [viewRefsDoc, setViewRefsDoc] = useState<ListRow | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [filters, setFilters] = useState<DocFilters>(EMPTY_FILTERS);

  useEffect(() => {
    const q = query(collection(getDb(), 'proformas'), orderBy('issueDate', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as BillingDoc) })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const issued = rows.filter((r) => r.status === 'issued');
  const fullyPaid = issued.filter((r) => getPaymentSummary(r).isPaid);
  const partial = issued.filter((r) => {
    const s = getPaymentSummary(r);
    return s.totalPaid > 0 && !s.isPaid;
  });
  const unpaid = issued.filter((r) => getPaymentSummary(r).totalPaid === 0);
  const willBeNotified = issued.filter((r) => !getPaymentSummary(r).isPaid && !r.skipReminder);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Search
      if (!matchesSearch(r, filters.search)) return false;
      // Status
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      // Date range
      if (!matchesDateRange(r.issueDate, filters.fromDate, filters.toDate)) return false;
      // Payment status filter (only meaningful when issued)
      if (filters.payment && filters.payment !== 'all') {
        if (r.status !== 'issued') return false;
        const s = getPaymentSummary(r);
        if (filters.payment === 'paid' && !s.isPaid) return false;
        if (filters.payment === 'partial' && (s.isPaid || s.totalPaid === 0)) return false;
        if (filters.payment === 'unpaid' && s.totalPaid > 0) return false;
      }
      return true;
    });
  }, [rows, filters]);

  async function toggleSkipReminder(r: ListRow) {
    try {
      await updateDoc(doc(getDb(), 'proformas', r.id), {
        skipReminder: !r.skipReminder,
        updatedAt: serverTimestamp()
      });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.message || 'Failed to update' });
    }
  }

  async function sendDigestNow() {
    setSendingDigest(true);
    setToast(null);
    try {
      const res = await fetch('/api/payment/send-digest', { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to send digest');
      if (json.count === 0) {
        setToast({ kind: 'ok', msg: 'No unpaid PIs to report.' });
      } else {
        setToast({
          kind: 'ok',
          msg: `Digest sent to ${json.emailTo} — ${json.count} unpaid PI${json.count !== 1 ? 's' : ''}, total ${formatINR(json.totalAmount || 0)}`
        });
      }
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.message || 'Failed' });
    } finally {
      setSendingDigest(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Proforma Invoices"
        description="Track payments, record installments, and send digest reminders for outstanding balances."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={sendDigestNow}
              disabled={sendingDigest || willBeNotified.length === 0}
              className="btn-secondary"
              title={
                willBeNotified.length === 0
                  ? 'No unpaid PIs to report'
                  : `Send digest of ${willBeNotified.length} pending PI(s)`
              }
            >
              {sendingDigest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send Digest ({willBeNotified.length})
            </button>
            <Link href="/proformas/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              New PI
            </Link>
          </div>
        }
      />

      {toast && (
        <div
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            toast.kind === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Filter & search */}
      {rows.length > 0 && (
        <DocFilterBar
          filters={filters}
          onChange={setFilters}
          showPaymentFilter
          totalCount={rows.length}
          filteredCount={filteredRows.length}
        />
      )}

      {/* Quick stats */}
      {rows.length > 0 && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatChip label="Issued" value={issued.length} color="brand" />
          <StatChip label="Paid" value={fullyPaid.length} color="emerald" />
          <StatChip label="Partial" value={partial.length} color="indigo" />
          <StatChip label="Unpaid" value={unpaid.length} color="amber" />
          <StatChip label="In Digest" value={willBeNotified.length} color="rose" />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment Progress</th>
                <th className="px-4 py-3 font-medium text-center">Notify</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-400">
                    No proforma invoices yet.
                  </td>
                </tr>
              )}
              {!loading && rows.length > 0 && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-400">
                    No proforma invoices match your filters. Try clearing them.
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => {
                const isIssued = r.status === 'issued';
                const summary = getPaymentSummary(r);
                const isPaid = summary.isPaid;
                const skip = r.skipReminder === true;
                const grandTotal = r.taxSummary?.grandTotal ?? 0;
                const pct = grandTotal > 0 ? (summary.totalPaid / grandTotal) * 100 : 0;
                const hasInstallments = summary.installmentCount > 0;
                return (
                  <tr key={r.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/proformas/${r.id}`}
                        className="font-medium text-brand-700 hover:underline num"
                      >
                        {r.number || 'DRAFT'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {r.issueDate ? formatInvoiceDate(new Date(r.issueDate)) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">
                        {r.customer?.companyName || r.customer?.name}
                      </div>
                      {r.customer?.companyName && (
                        <div className="text-[11px] text-ink-500">{r.customer.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      {isIssued ? (
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <PaymentBadge summary={summary} />
                            <span className="num text-ink-700 font-semibold">
                              {formatINR(summary.totalPaid)} / {formatINR(grandTotal)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                isPaid ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500' : 'bg-ink-200'
                              }`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          {!isPaid && summary.balance > 0 && (
                            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                              Balance: {formatINR(summary.balance)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isIssued && !isPaid ? (
                        <button
                          type="button"
                          onClick={() => toggleSkipReminder(r)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            skip
                              ? 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={skip ? 'Click to include in digest' : 'Click to skip from digest'}
                        >
                          {skip ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                          {skip ? 'Skipped' : 'Notify'}
                        </button>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {r.pdf?.url && (
                          <a
                            href={r.pdf.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary px-2 py-1.5 text-xs"
                            title="View PDF on Drive"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {isIssued && !isPaid && (
                          <button
                            onClick={() => setPaymentDoc(r)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1.5 text-xs font-medium transition-colors"
                            title={hasInstallments ? 'Add another payment' : 'Record payment'}
                          >
                            <IndianRupee className="h-3 w-3" />
                            {hasInstallments ? 'Add Payment' : 'Mark Paid'}
                          </button>
                        )}
                        {hasInstallments && (
                          <button
                            onClick={() => setViewRefsDoc(r)}
                            className="inline-flex items-center gap-1 rounded-md bg-brand-50 hover:bg-brand-100 text-brand-700 px-2 py-1.5 text-xs font-medium transition-colors"
                            title="View payment history"
                          >
                            <ImageIcon className="h-3 w-3" />
                            {summary.installmentCount}
                          </button>
                        )}
                        {r.linkedPoNumber && r.linkedPoId ? (
                          <Link
                            href={`/purchase-orders/${r.linkedPoId}`}
                            className="inline-flex items-center gap-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-1.5 text-xs font-semibold transition-colors"
                            title="View linked Purchase Order"
                          >
                            <ShoppingBag className="h-3 w-3" />
                            {r.linkedPoNumber}
                          </Link>
                        ) : (
                          <Link
                            href={`/purchase-orders/new?sourcePiId=${r.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-1.5 text-xs font-semibold transition-colors"
                            title="Generate Purchase Order with same details"
                          >
                            <ShoppingBag className="h-3 w-3" />
                            + PO
                          </Link>
                        )}
                        <Link
                          href={`/proformas/${r.id}`}
                          className="btn-secondary px-2.5 py-1.5 text-xs"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {paymentDoc && (
        <AddPaymentDialog
          doc={paymentDoc}
          onClose={() => setPaymentDoc(null)}
          onSuccess={(msg) => {
            setPaymentDoc(null);
            setToast({ kind: 'ok', msg });
          }}
        />
      )}

      {viewRefsDoc && (
        <ViewRefsDialog doc={viewRefsDoc} onClose={() => setViewRefsDoc(null)} />
      )}
    </>
  );
}

function StatChip({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: 'brand' | 'emerald' | 'amber' | 'indigo' | 'rose';
}) {
  const map = {
    brand: 'border-brand-200 bg-brand-50/50 text-brand-700',
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/50 text-amber-700',
    indigo: 'border-indigo-200 bg-indigo-50/50 text-indigo-700',
    rose: 'border-rose-200 bg-rose-50/50 text-rose-700'
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${map[color]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: BillingDoc['status'] }) {
  const map: Record<BillingDoc['status'], string> = {
    draft: 'bg-ink-100 text-ink-700',
    issued: 'bg-brand-50 text-brand-700',
    cancelled: 'bg-red-50 text-red-700'
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function PaymentBadge({
  summary
}: {
  summary: { isPaid: boolean; totalPaid: number; installmentCount: number };
}) {
  if (summary.isPaid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
        <CheckCircle2 className="h-3 w-3" />
        Paid
      </span>
    );
  }
  if (summary.totalPaid > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        Partial · {summary.installmentCount}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Unpaid
    </span>
  );
}
