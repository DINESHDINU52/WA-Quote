/**
 * Payment helpers — pure functions for working with installment-based payments.
 * Handles backward compatibility with old single-payment documents.
 */

import type { BillingDoc, PaymentDetails, PaymentInstallment, PaymentStatus } from './doc-types';

/** ₹1 tolerance for considering a PI "fully paid" (handles rounding/paise). */
export const PAYMENT_TOLERANCE = 1;

/**
 * Normalize a doc's payment data — converts old single-payment shape to
 * installments array. Safe to call on undefined / new docs / already-migrated docs.
 */
export function normalizePayment(doc: BillingDoc): PaymentDetails | null {
  const p = doc.payment;
  if (!p) return null;

  // Already in new shape
  if (Array.isArray(p.installments)) {
    return {
      installments: p.installments,
      totalPaid: p.totalPaid ?? sumInstallments(p.installments),
      balance: p.balance ?? Math.max(0, (doc.taxSummary?.grandTotal ?? 0) - sumInstallments(p.installments)),
      closedAt: p.closedAt
    };
  }

  // Migrate legacy shape: { amount, paidAt, paidBy, notes, references } → single installment
  if (typeof p.amount === 'number' && p.amount > 0) {
    const installment: PaymentInstallment = {
      id: 'inst-legacy-' + (p.paidAt ?? Date.now()),
      amount: p.amount,
      paidAt: p.paidAt ?? Date.now(),
      paidBy: p.paidBy,
      notes: p.notes,
      references: p.references ?? []
    };
    const totalPaid = installment.amount;
    const balance = Math.max(0, (doc.taxSummary?.grandTotal ?? 0) - totalPaid);
    return {
      installments: [installment],
      totalPaid,
      balance,
      closedAt: balance <= PAYMENT_TOLERANCE ? installment.paidAt : undefined
    };
  }

  return null;
}

export function sumInstallments(installments: PaymentInstallment[]): number {
  return installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

/**
 * Compute the payment status from current totals.
 *  - unpaid  : nothing paid yet
 *  - partial : some paid but balance > tolerance
 *  - paid    : balance ≤ tolerance
 */
export function computePaymentStatus(grandTotal: number, totalPaid: number): PaymentStatus {
  if (totalPaid <= 0) return 'unpaid';
  if (grandTotal - totalPaid <= PAYMENT_TOLERANCE) return 'paid';
  return 'partial';
}

/** Helper for UI/reports: get a clean summary even for legacy or unset docs. */
export function getPaymentSummary(doc: BillingDoc): {
  status: PaymentStatus;
  totalPaid: number;
  balance: number;
  installmentCount: number;
  installments: PaymentInstallment[];
  isPaid: boolean;
} {
  const grandTotal = doc.taxSummary?.grandTotal ?? 0;
  const normalized = normalizePayment(doc);
  if (!normalized) {
    return {
      status: doc.paymentStatus === 'paid' ? 'paid' : 'unpaid',
      totalPaid: 0,
      balance: grandTotal,
      installmentCount: 0,
      installments: [],
      isPaid: doc.paymentStatus === 'paid'
    };
  }
  const status = computePaymentStatus(grandTotal, normalized.totalPaid);
  return {
    status,
    totalPaid: normalized.totalPaid,
    balance: normalized.balance,
    installmentCount: normalized.installments.length,
    installments: normalized.installments,
    isPaid: status === 'paid'
  };
}

/** Generate a stable installment ID. */
export function newInstallmentId(): string {
  return 'inst-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}
