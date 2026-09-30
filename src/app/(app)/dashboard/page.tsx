'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth-context';
import { formatINR, formatInvoiceDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import {
  FileText,
  FileSpreadsheet,
  Users,
  Package,
  Plus,
  Settings,
  Sparkles,
  Layers,
  ArrowUpRight,
  HelpCircle,
  Activity
} from 'lucide-react';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [customerCount, setCustomerCount] = useState<number | string>('—');
  const [deviceCount, setDeviceCount] = useState<number | string>('—');
  
  const [quotationTotal, setQuotationTotal] = useState<number>(0);
  const [issuedQuotationCount, setIssuedQuotationCount] = useState<number>(0);
  const [quotationLoading, setQuotationLoading] = useState<boolean>(true);
  
  const [proformaTotal, setProformaTotal] = useState<number>(0);
  const [issuedProformaCount, setIssuedProformaCount] = useState<number>(0);
  const [proformaLoading, setProformaLoading] = useState<boolean>(true);
  const [monthlyPiSales, setMonthlyPiSales] = useState<number>(0);
  const [monthlyPiCount, setMonthlyPiCount] = useState<number>(0);

  // States for live Recent Activity Board
  const [quotesList, setQuotesList] = useState<any[]>([]);
  const [proformasList, setProformasList] = useState<any[]>([]);

  // Today's formatted date
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  useEffect(() => {
    // 1. Live Customers Count
    const unsubCustomers = onSnapshot(collection(getDb(), 'customers'), (snap) => {
      setCustomerCount(snap.size);
    });

    // 2. Live Products/Devices Count
    const unsubProducts = onSnapshot(collection(getDb(), 'products'), (snap) => {
      setDeviceCount(snap.size);
    });

    // 3. Live Quotations aggregations and data
    const unsubQuotations = onSnapshot(collection(getDb(), 'quotations'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'quotation' }));
      setQuotesList(docs);

      const issued = docs.filter((d: any) => d.status === 'issued');
      setIssuedQuotationCount(issued.length);
      const total = issued.reduce((acc: number, curr: any) => acc + (curr.taxSummary?.grandTotal || 0), 0);
      setQuotationTotal(total);
      setQuotationLoading(false);
    });

    // 4. Live Proformas aggregations and data
    const unsubProformas = onSnapshot(collection(getDb(), 'proformas'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'proforma' }));
      setProformasList(docs);

      const issued = docs.filter((d: any) => d.status === 'issued');
      setIssuedProformaCount(issued.length);
      const total = issued.reduce((acc: number, curr: any) => acc + (curr.taxSummary?.grandTotal || 0), 0);
      setProformaTotal(total);

      // Monthly sales: PIs issued in the current calendar month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      const thisMonthPIs = issued.filter((d: any) => {
        const issueDate = d.issueDate || 0;
        return issueDate >= monthStart && issueDate <= monthEnd;
      });
      setMonthlyPiCount(thisMonthPIs.length);
      setMonthlyPiSales(thisMonthPIs.reduce((acc: number, curr: any) => acc + (curr.taxSummary?.grandTotal || 0), 0));

      setProformaLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubQuotations();
      unsubProformas();
    };
  }, []);

  // Merge, sort chronologically, and take the top 5 documents
  const recentDocuments = useMemo(() => {
    const combined = [...quotesList, ...proformasList];
    return combined
      .sort((a, b) => {
        const dateA = a.issueDate ? new Date(a.issueDate).getTime() : 0;
        const dateB = b.issueDate ? new Date(b.issueDate).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        
        // Secondary fallback sorting by Firestore createdAt
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [quotesList, proformasList]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of CHN TECHNOLOGIES billing activity"
      />

      {/* Premium Gradient Welcome Hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-700 p-6 md:p-8 text-white shadow-lg shadow-brand-500/10">
        {/* Floating abstract decorative backgrounds */}
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/5 blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 right-20 h-60 w-60 rounded-full bg-brand-400/10 blur-2xl pointer-events-none" />
        
        {/* Abstract Overlapping Geometric Wireframe Art representing 3D blueprints */}
        <div className="absolute right-12 bottom-0 top-0 w-80 hidden lg:block opacity-[0.14] pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="40" y="40" width="120" height="120" rx="20" transform="rotate(15 100 100)" stroke="white" strokeWidth="8" />
            <rect x="60" y="60" width="80" height="80" rx="15" transform="rotate(-10 100 100)" stroke="white" strokeWidth="4" strokeDasharray="8 4" />
            <circle cx="100" cy="100" r="30" stroke="white" strokeWidth="6" />
            <line x1="0" y1="100" x2="200" y2="100" stroke="white" strokeWidth="2" strokeDasharray="5 5" />
            <line x1="100" y1="0" x2="100" y2="200" stroke="white" strokeWidth="2" strokeDasharray="5 5" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/10 mb-4">
              <Sparkles className="h-3 w-3 text-brand-200" />
              <span>WA Quote System Live</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome back, {profile?.displayName || 'Authorized User'}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-brand-100 font-medium leading-relaxed">
              Create professional quotations, convert them to proforma invoices, and manage your product & service catalog — all with automated GST calculations, PDF generation, and Google Drive backup.
            </p>
          </div>
          <div className="self-start md:self-center bg-white/10 backdrop-blur-md border border-white/10 px-4 py-3 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-brand-200 tracking-wider">Date Today</div>
            <div className="text-sm font-bold mt-0.5">{todayFormatted}</div>
          </div>
        </div>
      </div>

      {/* Real-time Statistics Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {/* 0. Monthly PI Sales (current month) */}
        <div className="card p-5 relative overflow-hidden transition-all duration-300 hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-500/5 group border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30">
          <div className="absolute bottom-0 left-0 right-0 h-10 w-full overflow-hidden pointer-events-none opacity-[0.3] group-hover:opacity-[0.4] transition-opacity duration-300">
            <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkline-monthly" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M 0 30 Q 15 10 35 25 T 65 8 T 100 5 L 100 40 L 0 40 Z" fill="url(#sparkline-monthly)" />
              <path d="M 0 30 Q 15 10 35 25 T 65 8 T 100 5" fill="none" stroke="#10b981" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">This Month Sales</span>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="font-mono text-2xl font-extrabold text-emerald-800 leading-tight">
              {proformaLoading ? '—' : formatINR(monthlyPiSales)}
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-emerald-600/70">
              {proformaLoading ? 'Loading...' : `${monthlyPiCount} PI${monthlyPiCount !== 1 ? 's' : ''} issued in ${new Date().toLocaleString('en-US', { month: 'long' })}`}
            </p>
          </div>
        </div>

        {/* 1. Issued Quotations */}
        <div className="card p-5 relative overflow-hidden transition-all duration-300 hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-500/5 group">
          {/* Sparkline Visual Graph in the background */}
          <div className="absolute bottom-0 left-0 right-0 h-10 w-full overflow-hidden pointer-events-none opacity-[0.25] group-hover:opacity-[0.35] transition-opacity duration-300">
            <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkline-quote" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M 0 35 Q 20 20 40 28 T 80 10 T 100 5 L 100 40 L 0 40 Z" fill="url(#sparkline-quote)" />
              <path d="M 0 35 Q 20 20 40 28 T 80 10 T 100 5" fill="none" stroke="#2563eb" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Issued Quotations</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="font-mono text-2xl font-extrabold text-ink-900 leading-tight">
              {quotationLoading ? '—' : formatINR(quotationTotal)}
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-ink-400">
              {quotationLoading ? 'Loading...' : `${issuedQuotationCount} Quotations issued`}
            </p>
          </div>
        </div>

        {/* 2. Issued Proformas */}
        <div className="card p-5 relative overflow-hidden transition-all duration-300 hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-500/5 group">
          {/* Sparkline Visual Graph in the background */}
          <div className="absolute bottom-0 left-0 right-0 h-10 w-full overflow-hidden pointer-events-none opacity-[0.25] group-hover:opacity-[0.35] transition-opacity duration-300">
            <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkline-proforma" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M 0 32 Q 25 15 50 30 T 75 8 T 100 12 L 100 40 L 0 40 Z" fill="url(#sparkline-proforma)" />
              <path d="M 0 32 Q 25 15 50 30 T 75 8 T 100 12" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Issued Proformas</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="font-mono text-2xl font-extrabold text-ink-900 leading-tight">
              {proformaLoading ? '—' : formatINR(proformaTotal)}
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-ink-400">
              {proformaLoading ? 'Loading...' : `${issuedProformaCount} Proformas issued`}
            </p>
          </div>
        </div>

        {/* 3. Registered Customers */}
        <div className="card p-5 relative overflow-hidden transition-all duration-300 hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Active Customers</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-ink-900 leading-tight">
              {customerCount}
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-ink-400">
              Billed-to clients catalog
            </p>
          </div>
        </div>

        {/* 4. Active Catalog Devices */}
        <div className="card p-5 relative overflow-hidden transition-all duration-300 hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-brand-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Device Models</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-ink-900 leading-tight">
              {deviceCount}
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-ink-400">
              Unique device configurations
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Graphic Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        {/* Left 2 Columns: Live Billing Activity Board */}
        <div className="card p-6 lg:col-span-3 relative overflow-hidden bg-white/95 border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-brand-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-ink-800">Live Billing Activity</h3>
                </div>
                <p className="text-[11px] text-ink-400 font-medium">Real-time log of recent transactions and drafts from database</p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700 border border-brand-100">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
                <span>Live Feed</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 pr-3 font-semibold">Doc Type</th>
                    <th className="py-2.5 px-3 font-semibold">Doc Number</th>
                    <th className="py-2.5 px-3 font-semibold">Issue Date</th>
                    <th className="py-2.5 px-3 font-semibold">Customer</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recentDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No billing transactions found. Click "Create Quotation" or "Create Proforma" to start.
                      </td>
                    </tr>
                  ) : (
                    recentDocuments.map((doc) => {
                      const isQuote = doc.docType === 'quotation';
                      const linkUrl = isQuote ? `/quotations/${doc.id}` : `/proformas/${doc.id}`;
                      
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/40 transition-colors group">
                          <td className="py-3 pr-3">
                            <DocTypeBadge type={doc.docType} />
                          </td>
                          <td className="py-3 px-3">
                            <Link
                              href={linkUrl}
                              className="font-bold text-brand-700 hover:underline hover:text-brand-900 transition-colors"
                            >
                              {doc.number || 'DRAFT'}
                            </Link>
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono">
                            {doc.issueDate ? formatInvoiceDate(new Date(doc.issueDate)) : '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-800 font-semibold truncate max-w-[150px]">
                            {doc.customer?.name || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={doc.status} />
                          </td>
                          <td className="py-3 pl-3 text-right font-mono font-bold text-slate-900">
                            {formatINR(doc.taxSummary?.grandTotal ?? 0)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
              <span>Showing up to 5 latest document updates</span>
              <div className="flex gap-4">
                <Link href="/quotations" className="hover:text-brand-600 transition-colors">View all Quotes →</Link>
                <Link href="/proformas" className="hover:text-brand-600 transition-colors">View all Proformas →</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Operations */}
      <div className="mt-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-ink-500 mb-4 flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-brand-600" />
          <span>Quick Actions Panel</span>
        </h3>
        
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Quick Action 1: New Quotation */}
          <Link
            href="/quotations/new"
            className="group card-interactive p-5 bg-white border border-ink-200/60 rounded-xl transition-all duration-300 hover:scale-[1.01] hover:border-brand-300 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300">
                <FileText className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-brand-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-ink-900 group-hover:text-brand-700 transition-colors">Create Quotation</h4>
            <p className="mt-1 text-xs text-ink-500 leading-normal">
              Draft price proposal sheets with state-based automated GST splits.
            </p>
          </Link>

          {/* Quick Action 2: New Proforma */}
          <Link
            href="/proformas/new"
            className="group card-interactive p-5 bg-white border border-ink-200/60 rounded-xl transition-all duration-300 hover:scale-[1.01] hover:border-brand-300 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-brand-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-ink-900 group-hover:text-brand-700 transition-colors">Create Proforma</h4>
            <p className="mt-1 text-xs text-ink-500 leading-normal">
              Issue pre-payment invoicing slips for door access contracts.
            </p>
          </Link>

          {/* Quick Action 3: Products Catalog */}
          <Link
            href="/products"
            className="group card-interactive p-5 bg-white border border-ink-200/60 rounded-xl transition-all duration-300 hover:scale-[1.01] hover:border-brand-300 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300">
                <Package className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-brand-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-ink-900 group-hover:text-brand-700 transition-colors">Add Device</h4>
            <p className="mt-1 text-xs text-ink-500 leading-normal">
              Import inventories in bulk from spreadsheet grids or add manually.
            </p>
          </Link>

          {/* Quick Action 4: Settings config */}
          <Link
            href="/settings"
            className="group card-interactive p-5 bg-white border border-ink-200/60 rounded-xl transition-all duration-300 hover:scale-[1.01] hover:border-brand-300 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300">
                <Settings className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-brand-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-ink-900 group-hover:text-brand-700 transition-colors">Configure System</h4>
            <p className="mt-1 text-xs text-ink-500 leading-normal">
              Fine-tune sequential billing prefixes, bank accounts, and footers.
            </p>
          </Link>
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    issued: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
    cancelled: 'bg-rose-50 text-rose-700 border border-rose-200/50'
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

function DocTypeBadge({ type }: { type: 'quotation' | 'proforma' }) {
  const isQuote = type === 'quotation';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${isQuote ? 'bg-blue-50 text-blue-700 border border-blue-200/50' : 'bg-purple-50 text-purple-700 border border-purple-200/50'}`}>
      {isQuote ? 'Quote' : 'Proforma'}
    </span>
  );
}
