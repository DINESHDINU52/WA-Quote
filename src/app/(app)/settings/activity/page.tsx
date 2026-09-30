'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { formatINR } from '@/lib/utils';
import type { AuditEntry, AuditAction } from '@/lib/audit';
import {
  Activity,
  ArrowLeft,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  User,
  Clock,
  Package,
  PlusCircle,
  Pencil,
  Trash2,
  UploadCloud,
  ShieldCheck,
  X
} from 'lucide-react';

interface AuditRow extends AuditEntry {
  id: string;
}

export default function ActivityTrackerPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'md';

  useEffect(() => {
    // Listen to audit collection ordered by timestamp descending, limit to 200
    const q = query(collection(getDb(), 'audit'), orderBy('timestamp', 'desc'), limit(200));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditRow, 'id'>)
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[audit] Failed to fetch audit logs:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (!q) return true;
      const matchName = log.entityName?.toLowerCase().includes(q);
      const matchSerial = log.serialNumber?.toLowerCase().includes(q);
      const matchUser = log.userName?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      return matchName || matchSerial || matchUser || matchDetails;
    });
  }, [logs, search, actionFilter]);

  // Statistics
  const stats = useMemo(() => {
    const priceChanges = logs.filter((l) => l.action === 'price_update').length;
    const additions = logs.filter((l) => l.action === 'product_create').length;
    const bulkImports = logs.filter((l) => l.action === 'bulk_import').length;
    const deletions = logs.filter((l) => l.action === 'product_delete').length;
    return {
      total: logs.length,
      priceChanges,
      additions,
      bulkImports,
      deletions
    };
  }, [logs]);

  function formatTime(val: any): string {
    if (!val) return 'Just now';
    const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function getActionBadge(action: AuditAction) {
    switch (action) {
      case 'price_update':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <TrendingUp className="h-3.5 w-3.5" /> Price Updated
          </span>
        );
      case 'product_create':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            <PlusCircle className="h-3.5 w-3.5" /> Device Added
          </span>
        );
      case 'product_update':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
            <Pencil className="h-3.5 w-3.5" /> Specs Modified
          </span>
        );
      case 'bulk_import':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
            <UploadCloud className="h-3.5 w-3.5" /> Bulk Import
          </span>
        );
      case 'product_delete':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200">
            <Trash2 className="h-3.5 w-3.5" /> Device Deleted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            Activity
          </span>
        );
    }
  }

  const hasActiveFilters = search.trim() !== '' || actionFilter !== 'all';

  return (
    <>
      <div className="mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
      </div>

      <PageHeader
        title="Activity Tracker & Audit Log"
        description="Comprehensive audit trail tracking price changes, device additions, edits, and bulk imports with user accountability."
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <div className="card p-4 flex items-center gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-ink-900 num">{stats.total}</div>
            <div className="text-xs text-ink-500 font-medium">Total Events</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-ink-900 num">{stats.priceChanges}</div>
            <div className="text-xs text-ink-500 font-medium">Price Updates</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-ink-900 num">{stats.additions + stats.bulkImports}</div>
            <div className="text-xs text-ink-500 font-medium">Additions / Imports</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-700">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-ink-900 num">{stats.deletions}</div>
            <div className="text-xs text-ink-500 font-medium">Deletions</div>
          </div>
        </div>
      </div>

      {/* Search and Action Filter Bar */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by device model, serial number, user name..."
              className="w-full rounded-md border border-ink-200 pl-9 pr-9 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-ink-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="input w-44 text-sm"
              title="Filter by Action"
            >
              <option value="all">All Actions</option>
              <option value="price_update">Price Updates</option>
              <option value="product_create">Device Added</option>
              <option value="product_update">Specs Modified</option>
              <option value="bulk_import">Bulk Imports</option>
              <option value="product_delete">Deletions</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActionFilter('all');
              }}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1"
            >
              Clear filters
            </button>
          )}

          <div className="text-xs text-ink-500 ml-auto whitespace-nowrap">
            {hasActiveFilters ? (
              <span>
                Showing <strong className="text-ink-800">{filteredLogs.length}</strong> of{' '}
                {logs.length} events
              </span>
            ) : (
              <span>Total: <strong className="text-ink-800">{logs.length}</strong> events recorded</span>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">User & Role</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Device & Serial</th>
              <th className="px-4 py-3 font-medium">Price Transition / Change</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  Loading activity log...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                  <Activity className="h-8 w-8 mx-auto text-ink-300 mb-2" />
                  No activity events recorded yet. Price updates and changes to devices will appear here automatically.
                </td>
              </tr>
            )}
            {!loading && logs.length > 0 && filteredLogs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                  No events found matching your search.
                  <button
                    onClick={() => {
                      setSearch('');
                      setActionFilter('all');
                    }}
                    className="block mx-auto mt-2 text-xs text-brand-600 hover:underline"
                  >
                    Clear search filters
                  </button>
                </td>
              </tr>
            )}
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-ink-50/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {(log.userName || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-ink-900 text-xs">{log.userName || 'Unknown'}</div>
                      <div className="text-[10px] text-ink-500 uppercase tracking-wider capitalize">
                        {log.userRole || 'Staff'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">{log.entityName}</div>
                  {log.serialNumber ? (
                    <div className="inline-block mt-0.5 rounded bg-ink-100 px-1.5 py-0.2 text-[10px] font-mono text-ink-700">
                      SN: {log.serialNumber}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 num">
                  {log.action === 'price_update' && log.oldPrice !== undefined && log.newPrice !== undefined ? (
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <span className="text-ink-400 line-through">{formatINR(log.oldPrice)}</span>
                      <span className="text-ink-300 font-normal">→</span>
                      <span className={log.newPrice > log.oldPrice ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {formatINR(log.newPrice)}
                      </span>
                    </div>
                  ) : log.newPrice !== undefined ? (
                    <span className="font-semibold text-ink-800 text-xs">{formatINR(log.newPrice)}</span>
                  ) : (
                    <span className="text-xs text-ink-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-600 max-w-xs truncate">
                  {log.details || '—'}
                </td>
                <td className="px-4 py-3 num text-right text-xs text-ink-500 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3 text-ink-400" />
                    <span>{formatTime(log.timestamp)}</span>
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
