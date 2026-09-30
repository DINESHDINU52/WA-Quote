'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { PageHeader } from '@/components/page-header';
import { formatINR, formatInvoiceDate } from '@/lib/utils';
import { getPaymentSummary } from '@/lib/payment-helpers';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';

export default function ReportsPage() {
  const [proformas, setProformas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb(), 'proformas'), (snap) => {
      setProformas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const monthlyData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const issued = proformas.filter(
      (d: any) => d.status === 'issued' && d.issueDate >= monthStart && d.issueDate <= monthEnd
    );

    const paid = issued.filter((d: any) => getPaymentSummary(d).isPaid);
    const unpaid = issued.filter((d: any) => !getPaymentSummary(d).isPaid);

    const totalSales = issued.reduce(
      (acc: number, d: any) => acc + (d.taxSummary?.grandTotal || 0),
      0
    );
    // Total collected = sum of all installments across ALL issued PIs (including partial)
    const totalCollected = issued.reduce(
      (acc: number, d: any) => acc + getPaymentSummary(d).totalPaid,
      0
    );
    const totalPending = issued.reduce(
      (acc: number, d: any) => acc + getPaymentSummary(d).balance,
      0
    );

    const totalTaxable = issued.reduce(
      (acc: number, d: any) => acc + (d.taxSummary?.taxableAmount || 0),
      0
    );
    const totalCgst = issued.reduce((acc: number, d: any) => acc + (d.taxSummary?.cgstTotal || 0), 0);
    const totalSgst = issued.reduce((acc: number, d: any) => acc + (d.taxSummary?.sgstTotal || 0), 0);
    const totalIgst = issued.reduce((acc: number, d: any) => acc + (d.taxSummary?.igstTotal || 0), 0);

    const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0;

    // Group by customer
    const byCustomer: Record<string, { name: string; total: number; paid: number; count: number }> = {};
    issued.forEach((d: any) => {
      const name = d.customer?.companyName || d.customer?.name || 'Unknown';
      if (!byCustomer[name]) byCustomer[name] = { name, total: 0, paid: 0, count: 0 };
      byCustomer[name].total += d.taxSummary?.grandTotal || 0;
      byCustomer[name].paid += getPaymentSummary(d).totalPaid;
      byCustomer[name].count += 1;
    });
    const customerList = Object.values(byCustomer).sort((a, b) => b.total - a.total);

    return {
      issued,
      paid,
      unpaid,
      totalSales,
      totalCollected,
      totalPending,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      collectionRate,
      customerList
    };
  }, [proformas, selectedMonth]);

  const monthLabel = new Date(
    Number(selectedMonth.split('-')[0]),
    Number(selectedMonth.split('-')[1]) - 1
  ).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      opts.push({ value: val, label: lbl });
    }
    return opts;
  }, []);

  function exportCSV() {
    const rows = [
      [
        'PI Number',
        'Date',
        'Customer',
        'Company',
        'Taxable',
        'CGST',
        'SGST',
        'IGST',
        'Total',
        'Payment Status',
        'Total Paid',
        'Balance',
        'Installments',
        'Last Paid'
      ]
    ];
    monthlyData.issued.forEach((d: any) => {
      const sum = getPaymentSummary(d);
      const lastPaidAt = sum.installments.length > 0
        ? sum.installments[sum.installments.length - 1].paidAt
        : null;
      rows.push([
        d.number || 'DRAFT',
        d.issueDate ? new Date(d.issueDate).toLocaleDateString('en-IN') : '',
        d.customer?.name || '',
        d.customer?.companyName || '',
        (d.taxSummary?.taxableAmount || 0).toFixed(2),
        (d.taxSummary?.cgstTotal || 0).toFixed(2),
        (d.taxSummary?.sgstTotal || 0).toFixed(2),
        (d.taxSummary?.igstTotal || 0).toFixed(2),
        (d.taxSummary?.grandTotal || 0).toFixed(2),
        sum.isPaid ? 'Paid' : sum.totalPaid > 0 ? 'Partial' : 'Unpaid',
        sum.totalPaid.toFixed(2),
        sum.balance.toFixed(2),
        String(sum.installmentCount),
        lastPaidAt ? new Date(lastPaidAt).toLocaleDateString('en-IN') : ''
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CHN-Sales-Report-${selectedMonth}.csv`;
    a.click();
  }

  if (loading) return <div className="text-ink-400">Loading reports...</div>;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Monthly sales, GST and payment collection summary."
        actions={
          <button
            onClick={exportCSV}
            className="btn-secondary"
            disabled={monthlyData.issued.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      {/* Month selector */}
      <div className="mb-6 flex items-center gap-3">
        <Calendar className="h-4 w-4 text-ink-500" />
        <select
          className="input w-56"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Collection Summary */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Sales"
          value={formatINR(monthlyData.totalSales)}
          subtext={`${monthlyData.issued.length} PI${monthlyData.issued.length !== 1 ? 's' : ''} issued`}
          icon={TrendingUp}
          accent="brand"
        />
        <SummaryCard
          label="Collected"
          value={formatINR(monthlyData.totalCollected)}
          subtext={`${monthlyData.paid.length} paid · ${monthlyData.collectionRate.toFixed(1)}% rate`}
          icon={CheckCircle2}
          accent="emerald"
        />
        <SummaryCard
          label="Pending"
          value={formatINR(monthlyData.totalPending)}
          subtext={`${monthlyData.unpaid.length} unpaid PI${monthlyData.unpaid.length !== 1 ? 's' : ''}`}
          icon={Clock}
          accent="amber"
        />
      </div>

      {/* Collection Progress Bar */}
      {monthlyData.totalSales > 0 && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Collection Progress
            </span>
            <span className="text-sm font-bold text-ink-900 num">
              {monthlyData.collectionRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
              style={{ width: `${monthlyData.collectionRate}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
            <span>Collected: {formatINR(monthlyData.totalCollected)}</span>
            <span>Target: {formatINR(monthlyData.totalSales)}</span>
          </div>
        </div>
      )}

      {/* GST breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-8">
        <SummaryCard
          label="Taxable Amount"
          value={formatINR(monthlyData.totalTaxable)}
          icon={BarChart3}
          accent="indigo"
        />
        <SummaryCard label="CGST" value={formatINR(monthlyData.totalCgst)} icon={BarChart3} accent="blue" />
        <SummaryCard label="SGST" value={formatINR(monthlyData.totalSgst)} icon={BarChart3} accent="purple" />
        <SummaryCard label="IGST" value={formatINR(monthlyData.totalIgst)} icon={BarChart3} accent="amber" />
      </div>

      {/* PI list for the month */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="border-b border-ink-100 bg-ink-50 px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Issued Proformas — {monthLabel} ({monthlyData.issued.length})
            </h3>
            {monthlyData.unpaid.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                {monthlyData.unpaid.length} pending
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
                <tr className="border-b border-ink-100">
                  <th className="px-4 py-2.5 font-medium">Number</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {monthlyData.issued.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-400">
                      No proformas issued in {monthLabel}.
                    </td>
                  </tr>
                )}
                {monthlyData.issued
                  .sort((a: any, b: any) => (b.issueDate || 0) - (a.issueDate || 0))
                  .map((d: any) => {
                    const sum = getPaymentSummary(d);
                    return (
                      <tr key={d.id} className="hover:bg-ink-50/60">
                        <td className="px-4 py-2.5 font-medium text-brand-700 num">{d.number || 'DRAFT'}</td>
                        <td className="px-4 py-2.5 text-ink-600 num">
                          {d.issueDate ? formatInvoiceDate(new Date(d.issueDate)) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-ink-900">
                          <div className="font-medium">{d.customer?.companyName || d.customer?.name || '—'}</div>
                          {d.customer?.companyName && (
                            <div className="text-[11px] text-ink-500">{d.customer?.name}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {sum.isPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                              <CheckCircle2 className="h-3 w-3" />
                              Paid
                            </span>
                          ) : sum.totalPaid > 0 ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">
                                <Clock className="h-3 w-3" />
                                Partial · {sum.installmentCount}
                              </span>
                              <div className="text-[10px] text-ink-500 mt-0.5 num">
                                {formatINR(sum.totalPaid)} of {formatINR(d.taxSummary?.grandTotal || 0)}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
                              <Clock className="h-3 w-3" />
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-ink-900 num">
                          {formatINR(d.taxSummary?.grandTotal || 0)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer breakdown */}
        <div className="card overflow-hidden">
          <div className="border-b border-ink-100 bg-ink-50 px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Sales by Customer
            </h3>
          </div>
          <div className="divide-y divide-ink-100 max-h-[500px] overflow-y-auto">
            {monthlyData.customerList.length === 0 && (
              <div className="px-4 py-8 text-center text-ink-400 text-sm">No data</div>
            )}
            {monthlyData.customerList.map((c) => {
              const collectedPct = c.total > 0 ? (c.paid / c.total) * 100 : 0;
              return (
                <div key={c.name} className="px-4 py-3 hover:bg-ink-50/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{c.name}</div>
                      <div className="text-xs text-ink-500">
                        {c.count} PI{c.count !== 1 ? 's' : ''} · {formatINR(c.paid)} paid
                      </div>
                    </div>
                    <div className="num text-sm font-semibold text-ink-900 ml-2 flex-shrink-0">
                      {formatINR(c.total)}
                    </div>
                  </div>
                  {c.total > 0 && (
                    <div className="h-1 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${collectedPct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  icon: Icon,
  accent
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: typeof TrendingUp;
  accent: string;
}) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    purple: 'bg-purple-50 text-purple-700'
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
        <div className={`p-1.5 rounded-md ${colors[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 num text-lg font-extrabold text-ink-900">{value}</div>
      {subtext && <div className="text-[11px] text-ink-500 mt-0.5">{subtext}</div>}
    </div>
  );
}
