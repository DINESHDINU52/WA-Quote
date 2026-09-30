'use client';

/**
 * Shared filter bar for Quotations / Proforma Invoices listing pages.
 *
 * Supports:
 *   - Free-text search (number, customer name, company name, GSTIN)
 *   - Status filter (draft / issued / cancelled)
 *   - Optional payment status filter (for proformas)
 *   - Date range filter (issue date)
 *   - Clear all + result count
 */

import { Search, X, Calendar, Filter } from 'lucide-react';

export type StatusFilter = 'all' | 'draft' | 'issued' | 'cancelled';
export type PaymentFilter = 'all' | 'unpaid' | 'partial' | 'paid';

export interface DocFilters {
  search: string;
  status: StatusFilter;
  payment?: PaymentFilter;
  fromDate?: string; // yyyy-mm-dd
  toDate?: string;
}

export const EMPTY_FILTERS: DocFilters = {
  search: '',
  status: 'all',
  payment: 'all',
  fromDate: '',
  toDate: ''
};

interface Props {
  filters: DocFilters;
  onChange: (next: DocFilters) => void;
  showPaymentFilter?: boolean;
  totalCount: number;
  filteredCount: number;
}

export function DocFilterBar({
  filters,
  onChange,
  showPaymentFilter,
  totalCount,
  filteredCount
}: Props) {
  function update<K extends keyof DocFilters>(key: K, value: DocFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function clearAll() {
    onChange({ ...EMPTY_FILTERS, payment: showPaymentFilter ? 'all' : undefined });
  }

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    (showPaymentFilter && filters.payment && filters.payment !== 'all') ||
    !!filters.fromDate ||
    !!filters.toDate;

  return (
    <div className="card p-4 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            placeholder="Search by number, customer, company, or GSTIN..."
            className="w-full rounded-md border border-ink-200 pl-9 pr-9 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => update('search', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-ink-400" />
          <select
            value={filters.status}
            onChange={(e) => update('status', e.target.value as StatusFilter)}
            className="input w-32 text-sm"
            title="Status"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Payment filter (PI only) */}
        {showPaymentFilter && (
          <select
            value={filters.payment || 'all'}
            onChange={(e) => update('payment', e.target.value as PaymentFilter)}
            className="input w-36 text-sm"
            title="Payment status"
          >
            <option value="all">All Payments</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        )}

        {/* Date range */}
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-ink-400" />
          <input
            type="date"
            value={filters.fromDate || ''}
            onChange={(e) => update('fromDate', e.target.value)}
            className="input w-36 text-sm"
            title="From date"
          />
          <span className="text-ink-400 text-xs">→</span>
          <input
            type="date"
            value={filters.toDate || ''}
            onChange={(e) => update('toDate', e.target.value)}
            className="input w-36 text-sm"
            title="To date"
            min={filters.fromDate || undefined}
          />
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Result count */}
      {hasActiveFilters && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 font-semibold">
            {filteredCount} of {totalCount}
          </span>
          <span className="text-ink-500">
            result{filteredCount !== 1 ? 's' : ''} matching filters
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter helpers (used by listing pages)
// ---------------------------------------------------------------------------

export function matchesSearch(
  haystack: {
    number?: string;
    customer?: { name?: string; companyName?: string; gstin?: string };
  },
  search: string
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if ((haystack.number || '').toLowerCase().includes(q)) return true;
  if ((haystack.customer?.name || '').toLowerCase().includes(q)) return true;
  if ((haystack.customer?.companyName || '').toLowerCase().includes(q)) return true;
  if ((haystack.customer?.gstin || '').toLowerCase().includes(q)) return true;
  return false;
}

export function matchesDateRange(
  issueDateMs: number | undefined,
  fromDate: string | undefined,
  toDate: string | undefined
): boolean {
  if (!fromDate && !toDate) return true;
  if (!issueDateMs) return false;
  if (fromDate) {
    const fromMs = new Date(fromDate + 'T00:00:00').getTime();
    if (issueDateMs < fromMs) return false;
  }
  if (toDate) {
    const toMs = new Date(toDate + 'T23:59:59.999').getTime();
    if (issueDateMs > toMs) return false;
  }
  return true;
}
