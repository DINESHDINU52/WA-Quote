/**
 * Pre-defined service line items for the "Quick add" dropdown on every
 * document editor (Quotation / Proforma / Tax Invoice / Credit Note).
 *
 * Two options as requested by the user:
 *   1. "Installation (Device & Software)" — single combined line, ₹3000
 *   2. "Software Installation" — software-only, ₹1500
 * Rates are editable inline after the line is added.
 */

import type { LineItemInput } from './schemas';

export interface QuickService {
  id: string;
  label: string;
  description: string;
  hsn: string;
  rate: number;
  gstRate: number;
}

export const QUICK_SERVICES: QuickService[] = [
  {
    id: 'install-device-software',
    label: 'Standard Installation & Setup',
    description: 'Standard Installation & Setup Charges',
    hsn: '998733',
    rate: 1500,
    gstRate: 0.18
  },
  {
    id: 'install-software',
    label: 'Software Setup & Onboarding',
    description: 'Software Setup & Onboarding Charges',
    hsn: '998733',
    rate: 1500,
    gstRate: 0.18
  }
];

export function quickServiceToLineItem(svc: QuickService): LineItemInput {
  return {
    productId: '',
    description: svc.description,
    hsn: svc.hsn,
    qty: 1,
    rate: svc.rate,
    gstRate: svc.gstRate,
    discount: 0,
    serials: []
  };
}
