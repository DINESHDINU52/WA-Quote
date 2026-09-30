/**
 * Zod schemas — single source of truth for client and server validation.
 */

import { z } from 'zod';

// --- Shared atoms -----------------------------------------------------------

export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const addressSchema = z.object({
  line1: z.string().trim().min(1, 'Address required'),
  line2: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  state: z.string().trim().min(1, 'State required'),
  stateCode: z.string().trim().regex(/^\d{2}$/, '2-digit GST state code'),
  pincode: z.string().trim().regex(/^\d{6}$/, '6-digit pincode'),
  country: z.string().trim().default('India')
});

export type Address = z.infer<typeof addressSchema>;

// --- Customer ---------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Contact person name required'),
  companyName: z.string().trim().optional().default(''),
  gstin: z.string().trim().toUpperCase().regex(gstinRegex, 'Invalid GSTIN').optional().or(z.literal('')),
  pan: z.string().trim().toUpperCase().regex(panRegex, 'Invalid PAN').optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().min(7, 'Phone too short').optional().or(z.literal('')),
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  shippingSameAsBilling: z.boolean().default(true),
  openingBalance: z.number().nonnegative().default(0),
  notes: z.string().optional().default('')
});

export type CustomerInput = z.infer<typeof customerSchema>;

// --- Product / Device -------------------------------------------------------

export const productSchema = z.object({
  serialNumber: z.string().trim().default(''),
  name: z.string().trim().min(1, 'Product name required'),
  features: z.string().trim().default(''),
  connectivity: z.string().trim().default(''),
  hsn: z.string().trim().default(''),
  unit: z.string().trim().default('Nos'),
  rate: z.number().nonnegative(),
  gstRate: z.number().min(0).max(0.5),
  category: z.string().trim().default('General'),
  active: z.boolean().default(true)
});

export type ProductInput = z.infer<typeof productSchema>;

export interface ProductDoc extends ProductInput {
  id: string;
  createdAt?: any;
  createdByName?: string;
  createdByUid?: string;
  updatedAt?: any;
  updatedByName?: string;
  updatedByUid?: string;
  priceUpdatedAt?: any;
  priceUpdatedByName?: string;
  priceUpdatedByUid?: string;
}

// --- Invoice/Quotation/etc. line item --------------------------------------

export const lineItemSchema = z.object({
  productId: z.string().optional().default(''),
  description: z.string().trim().min(1),
  hsn: z.string().optional().default(''),
  qty: z.number().positive(),
  rate: z.number().nonnegative(),
  gstRate: z.number().min(0).max(0.5),
  discount: z.number().nonnegative().default(0),
  serials: z.array(z.string()).default([])
});

export type LineItemInput = z.infer<typeof lineItemSchema>;

// --- Numbering settings -----------------------------------------------------

export const numberingSettingsSchema = z.object({
  prefix: z.object({
    quotation: z.string().default('QT'),
    proforma: z.string().default('PI'),
    po: z.string().default('PO'),
    invoice: z.string().default('INV'),
    creditNote: z.string().default('CN')
  }),
  pattern: z.enum(['per-fy', 'continuous']).default('per-fy'),
  /** Width of the zero-padded sequence number, e.g. 4 → "0001". */
  pad: z.number().int().min(1).max(8).default(4)
});

export type NumberingSettings = z.infer<typeof numberingSettingsSchema>;
