'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { PageHeader } from '@/components/page-header';
import { formatINR, formatInvoiceDate } from '@/lib/utils';
import type { BillingDoc } from '@/lib/doc-types';
import { Plus, ExternalLink, ArrowRightCircle } from 'lucide-react';
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

/** Strip undefined values before writing to Firestore. */
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = stripUndefined(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default function QuotationsPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DocFilters>({ ...EMPTY_FILTERS, payment: undefined });
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(getDb(), 'quotations'), orderBy('issueDate', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as BillingDoc) })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!matchesSearch(r, filters.search)) return false;
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      if (!matchesDateRange(r.issueDate, filters.fromDate, filters.toDate)) return false;
      return true;
    });
  }, [rows, filters]);

  async function convertToPI(row: ListRow) {
    if (!confirm(`Convert "${row.number || 'DRAFT'}" to Proforma Invoice?`)) return;
    // Create a new proforma doc from the quotation data
    const piId = doc(collection(getDb(), 'proformas')).id;
    const piDoc: Record<string, any> = stripUndefined({
      ...row,
      id: undefined,
      docType: 'proforma',
      status: 'draft',
      number: '',
      sourceQuotationId: row.id,
      pdf: undefined,
      issuedAt: undefined,
      issuedBy: undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    delete piDoc.id;
    await setDoc(doc(getDb(), 'proformas', piId), piDoc);
    router.push(`/proformas/${piId}`);
  }

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Pre-sale price proposals. Issue to lock the number, then convert to Proforma Invoice."
        actions={
          <Link href="/quotations/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New quotation
          </Link>
        }
      />

      <DocFilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={rows.length}
        filteredCount={filteredRows.length}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                  No quotations yet. Create your first one.
                </td>
              </tr>
            )}
            {!loading && rows.length > 0 && filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                  No quotations match your filters. Try clearing them.
                </td>
              </tr>
            )}
            {filteredRows.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/quotations/${r.id}`}
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
                <td className="px-4 py-3 num text-right text-ink-900">
                  {formatINR(r.taxSummary?.grandTotal ?? 0)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.pdf?.url && (
                      <a
                        href={r.pdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                        title="View on Drive"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {r.status === 'issued' && (
                      <button
                        onClick={() => convertToPI(r)}
                        className="btn-primary px-2.5 py-1.5 text-xs"
                        title="Convert to Proforma Invoice"
                      >
                        <ArrowRightCircle className="h-3 w-3" />
                        To PI
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
