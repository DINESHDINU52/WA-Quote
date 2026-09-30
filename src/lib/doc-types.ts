/**
 * Document types shared by Quotation / Proforma / Invoice / Credit Note.
 * The four document modules differ only in:
 *   - Numbering prefix
 *   - Whether bank block is shown
 *   - Header label ("Quotation" vs "Tax Invoice" etc.)
 *   - Some legal text on the PDF
 *
 * They share line items, tax computation, and Drive backup logic.
 */

import type { CompanySettings } from './company';
import type { LineItemInput } from './schemas';
import type { DocType } from './numbering';

export type DocStatus = 'draft' | 'issued' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface PaymentReference {
  fileId: string;
  url: string;
  filename: string;
  size: number;
  uploadedAt: number;
}

export interface PaymentInstallment {
  id: string;                          // unique id like "inst-1716123456789"
  amount: number;                      // ₹ paid in this installment
  paidAt: number;                      // timestamp
  paidBy?: string;                     // user who recorded it
  notes?: string;                      // UTR / Cheque / mode
  references: PaymentReference[];      // up to 3 images for THIS installment
}

export interface PaymentDetails {
  installments: PaymentInstallment[];  // chronological list of all payments
  totalPaid: number;                   // sum of all installments
  balance: number;                     // grandTotal - totalPaid (>= 0)
  closedAt?: number;                   // when the PI was fully paid
  /** Legacy fields — kept only for backward compatibility with old single-payment docs. */
  amount?: number;
  paidAt?: number;
  paidBy?: string;
  notes?: string;
  references?: PaymentReference[];
}

/** Snapshot of a customer copied onto a doc at issue time. */
export interface CustomerSnapshot {
  customerId?: string;
  name: string;
  companyName?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city?: string;
    state: string;
    stateCode: string;
    pincode: string;
    country: string;
  };
}

/** Shipping address snapshot for Proforma Invoices. */
export interface ShippingSnapshot {
  sameAsBilling: boolean;
  contactPerson?: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city?: string;
    state: string;
    pincode: string;
    country: string;
  };
}

/** Snapshot of company-of-record copied onto a doc at issue time. */
export type CompanySnapshot = Pick<
  CompanySettings,
  | 'legalName'
  | 'shortName'
  | 'gstin'
  | 'pan'
  | 'stateCode'
  | 'state'
  | 'country'
  | 'email'
  | 'phone'
  | 'address'
  | 'bank'
  | 'footer'
  | 'logoUrl'
  | 'logoBase64'
  | 'driveFileId'
  | 'quotationTerms'
  | 'invoiceTerms'
  | 'poTerms'
>;

/** Line item exactly as stored in Firestore. */
export interface DocLineItem extends LineItemInput {
  /** Line totals computed at save time (cached for fast reads). */
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface TaxSummary {
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
}

export interface DocPdfMeta {
  driveFileId?: string;
  url?: string;
  downloadUrl?: string;
  generatedAt?: number;
  version?: number;
  fileName?: string;
}

export interface BillingDoc {
  /** Firestore doc id. */
  id?: string;
  /** Allocated number, set at issue time. Empty for drafts. */
  number: string;
  fy: string;
  docType: DocType;
  status: DocStatus;

  /** Issue / due / valid-till as epoch ms (Firestore-friendly, JSON-friendly). */
  issueDate: number;
  dueDate?: number;
  validTill?: number;

  /** GST mode resolved from company.stateCode vs customer.stateCode. */
  taxMode: 'intra' | 'inter';

  companyId?: string;
  company: CompanySnapshot;
  customer: CustomerSnapshot;
  shipping?: ShippingSnapshot;
  lineItems: DocLineItem[];
  taxSummary: TaxSummary;

  termsAndConditions: string;
  notes?: string;

  /** Cross-document links. */
  sourceQuotationId?: string;
  sourceProformaId?: string;
  sourcePiId?: string;
  originalInvoiceId?: string;
  sourcePoId?: string;
  linkedPoId?: string;
  linkedPoNumber?: string;
  linkedPiId?: string;
  linkedPiNumber?: string;

  pdf?: DocPdfMeta;

  /** Payment tracking (Proforma Invoice only) */
  paymentStatus?: PaymentStatus;
  payment?: PaymentDetails;
  /** Last reminder sent timestamp */
  lastReminderAt?: number;
  /** When true, this PI is excluded from the daily reminder digest. */
  skipReminder?: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
  issuedAt?: unknown;
  issuedBy?: string;
  preparedBy?: string;
  createdBy?: string;
}

/** Document type configuration — labels, prefix flags. */
export const DOC_CONFIG: Record<
  DocType,
  {
    label: string;
    pluralLabel: string;
    showBank: boolean;
    showDueDate: boolean;
    showValidTill: boolean;
    headerWord: string;
    collection: string;
  }
> = {
  quotation: {
    label: 'Quotation',
    pluralLabel: 'Quotations',
    showBank: true,
    showDueDate: false,
    showValidTill: true,
    headerWord: 'Quotation',
    collection: 'quotations'
  },
  proforma: {
    label: 'Proforma Invoice',
    pluralLabel: 'Proforma Invoices',
    showBank: true,
    showDueDate: true,
    showValidTill: false,
    headerWord: 'Proforma Invoice',
    collection: 'proformas'
  },
  po: {
    label: 'Purchase Order',
    pluralLabel: 'Purchase Orders',
    showBank: true,
    showDueDate: true,
    showValidTill: false,
    headerWord: 'Purchase Order',
    collection: 'purchaseOrders'
  },
  invoice: {
    label: 'Tax Invoice',
    pluralLabel: 'Tax Invoices',
    showBank: true,
    showDueDate: true,
    showValidTill: false,
    headerWord: 'Tax Invoice',
    collection: 'invoices'
  },
  creditNote: {
    label: 'Credit Note',
    pluralLabel: 'Credit Notes',
    showBank: true,
    showDueDate: true,
    showValidTill: false,
    headerWord: 'Credit Note',
    collection: 'creditNotes'
  }
};

/** Default T&C for quotation. */
export const DEFAULT_QUOTATION_TERMS = [
  'Delivery and onboarding will commence upon confirmation of the purchase order.',
  'Warranty: Products carry standard 1-year manufacturer/vendor warranty covering technical defects (excludes physical or liquid damage).',
  'Payment terms: 50% advance along with purchase order, balance upon delivery or deployment.',
  'Installation and software configuration will be scheduled based on mutual readiness.',
  'Prices are subject to applicable GST taxes as specified.'
]
  .map((t, i) => `${i + 1}. ${t}`)
  .join('\n');

export const DEFAULT_INVOICE_TERMS = [
  'Goods once sold will not be taken back.',
  'Subject to Chennai jurisdiction only.',
  'Payment due as per terms; interest @ 18% p.a. on overdue amounts.'
]
  .map((t, i) => `${i + 1}. ${t}`)
  .join('\n');
