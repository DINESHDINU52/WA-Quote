/**
 * Helpers shared between the client editor pages and the API routes.
 * Pure functions — no Firebase imports here so they can run anywhere.
 */

import { computeInvoice, numberToIndianWords } from './money';
import type {
  BillingDoc,
  DocLineItem,
  CompanySnapshot,
  ShippingSnapshot,
  CustomerSnapshot,
  TaxSummary
} from './doc-types';
import type { LineItemInput } from './schemas';
import type { CompanySettings } from './company';
import type { DocType } from './numbering';

export function snapshotCompany(c: CompanySettings): CompanySnapshot {
  const stCode = c.stateCode || c.address?.stateCode || (c.gstin && /^\d{2}/.test(c.gstin.trim()) ? c.gstin.trim().slice(0, 2) : '33');
  const stName = c.state || c.address?.state || 'Tamil Nadu';
  return {
    legalName: c.legalName,
    shortName: c.shortName,
    gstin: c.gstin,
    pan: c.pan,
    stateCode: stCode,
    state: stName,
    country: c.country || c.address?.country || 'India',
    email: c.email,
    phone: c.phone,
    address: {
      ...c.address,
      stateCode: c.address?.stateCode || stCode,
      state: c.address?.state || stName
    },
    bank: c.bank,
    footer: c.footer,
    logoUrl: c.logoUrl,
    logoBase64: c.logoBase64,
    driveFileId: c.driveFileId,
    quotationTerms: c.quotationTerms,
    invoiceTerms: c.invoiceTerms,
    poTerms: c.poTerms
  };
}

export function snapshotCustomer(input: {
  customerId?: string;
  name: string;
  companyName?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  billingAddress: CustomerSnapshot['address'];
}): CustomerSnapshot {
  return {
    customerId: input.customerId,
    name: input.name,
    companyName: input.companyName || undefined,
    gstin: input.gstin,
    pan: input.pan,
    email: input.email,
    phone: input.phone,
    address: input.billingAddress
  };
}

/**
 * Robust helper to determine whether an invoice/quotation/PO is
 * Intra-state (CGST + SGST) or Inter-state (IGST).
 * Checks stateCode, address.stateCode, GSTIN 2-digit prefix, and state names.
 */
export function determineTaxMode(
  company?: Partial<CompanySettings | CompanySnapshot> | null,
  customer?: Partial<CustomerSnapshot> | { address?: { stateCode?: string; state?: string }; billingAddress?: { stateCode?: string; state?: string }; gstin?: string } | null
): 'intra' | 'inter' {
  // 1. Resolve Company State Code
  let compCode = (company?.stateCode || company?.address?.stateCode || '').trim();
  if (!compCode && company?.gstin && /^\d{2}/.test(company.gstin.trim())) {
    compCode = company.gstin.trim().slice(0, 2);
  }
  if (!compCode) {
    const compState = (company?.state || company?.address?.state || '').trim().toLowerCase();
    if (compState.includes('tamil nadu') || compState.includes('tamilnadu')) {
      compCode = '33';
    } else {
      compCode = '33'; // Default to Tamil Nadu (33)
    }
  }

  // 2. Resolve Customer State Code
  const custAddr = (customer as any)?.billingAddress || (customer as any)?.address;
  let custCode = (custAddr?.stateCode || '').trim();
  if (!custCode && customer?.gstin && /^\d{2}/.test(customer.gstin.trim())) {
    custCode = customer.gstin.trim().slice(0, 2);
  }
  if (!custCode) {
    const custState = (custAddr?.state || '').trim().toLowerCase();
    if (custState.includes('tamil nadu') || custState.includes('tamilnadu')) {
      custCode = '33';
    }
  }

  // Same 2-digit state code -> Intra-state (CGST + SGST)
  if (compCode && custCode && compCode === custCode) {
    return 'intra';
  }

  // Also check if both indicate Tamil Nadu
  const compStateName = (company?.state || company?.address?.state || '').trim().toLowerCase();
  const custStateName = (custAddr?.state || '').trim().toLowerCase();
  if (
    (compStateName.includes('tamil nadu') || compStateName.includes('tamilnadu') || compCode === '33') &&
    (custStateName.includes('tamil nadu') || custStateName.includes('tamilnadu') || custCode === '33')
  ) {
    return 'intra';
  }

  return 'inter';
}

export function computeDocTotals(
  rawLines: LineItemInput[],
  taxMode: 'intra' | 'inter',
  roundOff: boolean
): { lineItems: DocLineItem[]; taxSummary: TaxSummary } {
  const out = computeInvoice({
    mode: taxMode,
    lines: rawLines.map((l) => ({
      qty: l.qty,
      rate: l.rate,
      gstRate: l.gstRate,
      discount: l.discount
    })),
    roundOff
  });

  const lineItems: DocLineItem[] = rawLines.map((l, idx) => ({
    ...l,
    amount: out.lines[idx].amount,
    cgst: out.lines[idx].cgst,
    sgst: out.lines[idx].sgst,
    igst: out.lines[idx].igst,
    total: out.lines[idx].total
  }));

  const taxSummary: TaxSummary = {
    taxableAmount: out.taxableAmount,
    cgstTotal: out.cgstTotal,
    sgstTotal: out.sgstTotal,
    igstTotal: out.igstTotal,
    roundOff: out.roundOff,
    grandTotal: out.grandTotal,
    amountInWords: numberToIndianWords(out.grandTotal)
  };
  return { lineItems, taxSummary };
}

export function buildDoc(args: {
  docType: DocType;
  number: string;
  fy: string;
  status: BillingDoc['status'];
  issueDate: number;
  dueDate?: number;
  validTill?: number;
  company: CompanySettings;
  companyId?: string;
  customer: Parameters<typeof snapshotCustomer>[0];
  rawLines: LineItemInput[];
  termsAndConditions: string;
  notes?: string;
  roundOff?: boolean;
  preparedBy?: string;
  shipping?: ShippingSnapshot;
  linkedPiId?: string;
  linkedPiNumber?: string;
  linkedPoId?: string;
  linkedPoNumber?: string;
  sourcePiId?: string;
  sourcePoId?: string;
}): BillingDoc {
  const customerSnap = snapshotCustomer(args.customer);
  const companySnap = snapshotCompany(args.company);
  const taxMode: 'intra' | 'inter' = determineTaxMode(companySnap, customerSnap);
  const { lineItems, taxSummary } = computeDocTotals(
    args.rawLines,
    taxMode,
    args.roundOff ?? true
  );

  return {
    number: args.number,
    fy: args.fy,
    docType: args.docType,
    status: args.status,
    issueDate: args.issueDate,
    dueDate: args.dueDate,
    validTill: args.validTill,
    taxMode,
    companyId: args.companyId,
    company: companySnap,
    customer: customerSnap,
    lineItems,
    taxSummary,
    termsAndConditions: args.termsAndConditions,
    notes: args.notes,
    preparedBy: args.preparedBy,
    shipping: args.shipping,
    linkedPiId: args.linkedPiId,
    linkedPiNumber: args.linkedPiNumber,
    linkedPoId: args.linkedPoId,
    linkedPoNumber: args.linkedPoNumber,
    sourcePiId: args.sourcePiId,
    sourcePoId: args.sourcePoId
  };
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
