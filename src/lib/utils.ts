import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as INR with Indian comma grouping. */
export function formatINR(value: number, opts: { showSymbol?: boolean } = {}) {
  const { showSymbol = true } = opts;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
  return showSymbol ? `₹${formatted}` : formatted;
}

/** Convert a Date to a financial-year code: Apr 2025 → "2526". */
export function fyFromDate(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11
  const startYear = month >= 3 ? year : year - 1; // FY starts April
  const endYear = startYear + 1;
  return `${String(startYear).slice(2)}${String(endYear).slice(2)}`;
}

/** Format a Date as `Aug 11, 2025` to match the reference invoices. */
export function formatInvoiceDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(d);
}
