'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import type { BillingDoc } from '@/lib/doc-types';
import { PageHeader } from '@/components/page-header';
import { formatINR } from '@/lib/utils';
import {
  Search,
  Plus,
  ShoppingBag,
  FileSpreadsheet,
  FileText,
  Eye,
  Filter,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<BillingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(getDb(), 'purchaseOrders'), orderBy('issueDate', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as BillingDoc) })));
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load POs:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const matchNum = o.number?.toLowerCase().includes(q);
      const matchCustomer = o.customer?.name?.toLowerCase().includes(q);
      const matchCompany = o.customer?.companyName?.toLowerCase().includes(q);
      const matchLinkedPi = o.linkedPiNumber?.toLowerCase().includes(q);
      return matchNum || matchCustomer || matchCompany || matchLinkedPi;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => {
    const totalCount = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + (o.taxSummary?.grandTotal || 0), 0);
    const draftCount = orders.filter((o) => o.status === 'draft').length;
    const issuedCount = orders.filter((o) => o.status === 'issued').length;
    return { totalCount, totalAmount, draftCount, issuedCount };
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders (PO)"
        description="Create and manage purchase orders linked directly to Proforma Invoices or issued to vendors."
        actions={
          <Link href="/purchase-orders/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink-900">{stats.totalCount}</div>
            <div className="text-xs font-medium text-ink-500">Total Purchase Orders</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink-900">{formatINR(stats.totalAmount)}</div>
            <div className="text-xs font-medium text-ink-500">Total Order Value</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink-900">{stats.issuedCount} Issued</div>
            <div className="text-xs font-medium text-ink-500">{stats.draftCount} Drafts</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search by PO number, customer name, company, or linked PI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-ink-50/50 pl-10 pr-4 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-ink-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs py-2 w-full sm:w-36"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500 border-b border-ink-100">
            <tr>
              <th className="px-4 py-3 font-medium">PO Number</th>
              <th className="px-4 py-3 font-medium">Customer / Company</th>
              <th className="px-4 py-3 font-medium">Linked PI</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Grand Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-400">
                  Loading Purchase Orders...
                </td>
              </tr>
            )}

            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-ink-300 mb-2" />
                  <p className="text-sm font-semibold text-ink-700">No Purchase Orders created yet</p>
                  <p className="text-xs text-ink-400 mt-1">
                    Submit a Proforma Invoice to generate a PO with the exact same details, or create a PO manually.
                  </p>
                  <div className="mt-4">
                    <Link href="/purchase-orders/new" className="btn-primary inline-flex items-center gap-1.5 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Create Purchase Order
                    </Link>
                  </div>
                </td>
              </tr>
            )}

            {!loading && orders.length > 0 && filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-500 text-xs">
                  No purchase orders found matching &quot;{search}&quot;
                </td>
              </tr>
            )}

            {!loading &&
              filteredOrders.map((po) => (
                <tr key={po.id} className="hover:bg-ink-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-brand-700">
                    <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                      {po.number || 'Draft'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink-900">{po.customer?.name}</div>
                    {po.customer?.companyName && (
                      <div className="text-xs text-ink-500">{po.customer.companyName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {po.linkedPiId || po.linkedPiNumber ? (
                      <Link
                        href={`/proformas/${po.linkedPiId || ''}`}
                        className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-mono font-semibold text-amber-800 hover:underline border border-amber-200"
                      >
                        <FileSpreadsheet className="h-3 w-3 text-amber-600" />
                        {po.linkedPiNumber || 'View PI'}
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-600">
                    {new Date(po.issueDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                        po.status === 'issued'
                          ? 'bg-emerald-100 text-emerald-800'
                          : po.status === 'draft'
                          ? 'bg-ink-100 text-ink-700'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-ink-900">
                    {formatINR(po.taxSummary?.grandTotal || 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> View PO
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
