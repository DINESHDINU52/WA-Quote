/**
 * Excel import for products / devices.
 *
 * Accepts .xlsx or .csv. Reads the first sheet, expects a header row, and
 * maps columns to the `productSchema` shape. Header matching is
 * case-insensitive and tolerates common synonyms.
 *
 * Required columns:  name, rate, gstRate
 * Optional columns:  description, hsn, unit, isService, category, serialTracked
 *
 * gstRate accepts either a fraction (0.18) or a percentage (18 or "18%").
 */

import * as XLSX from 'xlsx';
import { productSchema, type ProductInput, type ProductDoc } from './schemas';

export interface ImportRow {
  rowNumber: number;
  data?: ProductInput;
  raw: Record<string, unknown>;
  errors?: string[];
}

const HEADER_ALIASES: Record<keyof ProductInput, string[]> = {
  serialNumber: ['serial', 'serial number', 'serial no', 'sno', 'sl no', 'sr no', 'sku', 'code', 'product code', 'serial_number'],
  name: ['name', 'item', 'item name', 'device', 'device name', 'device model', 'product', 'product name', 'model'],
  features: ['features', 'feature', 'description', 'desc', 'details'],
  connectivity: ['connectivity', 'connection', 'interface', 'conn'],
  hsn: ['hsn', 'sac', 'hsn/sac', 'hsn code', 'sac code'],
  unit: ['unit', 'uom'],
  rate: ['rate', 'price', 'unit price', 'mrp'],
  gstRate: ['gst', 'gst rate', 'gst%', 'tax', 'tax rate'],
  category: ['category', 'type', 'group'],
  active: ['active', 'enabled']
};

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parseGstRate(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  const s = String(v).trim().replace('%', '');
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return n > 1 ? n / 100 : n;
}

function parseBool(v: unknown): boolean | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return ['1', 'yes', 'y', 'true', 't'].includes(s);
}

export interface ParseResult {
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
  detectedHeaders: string[];
}

export async function parseProductExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });

  const detectedHeaders = json[0] ? Object.keys(json[0]) : [];

  // Build a header → ProductInput key map for the columns actually present.
  const headerToField: Record<string, keyof ProductInput> = {};
  for (const h of detectedHeaders) {
    const norm = normaliseHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [keyof ProductInput, string[]][]) {
      if (aliases.includes(norm)) {
        headerToField[h] = field;
        break;
      }
    }
  }

  const rows: ImportRow[] = json.map((row, idx) => {
    const draft: Partial<ProductInput> = {};
    for (const [header, field] of Object.entries(headerToField)) {
      const v = row[header];
      switch (field) {
        case 'rate':
          draft.rate = v === '' ? 0 : Number(v);
          break;
        case 'gstRate':
          draft.gstRate = parseGstRate(v);
          break;
        case 'active':
          (draft as any)[field] = parseBool(v);
          break;
        default:
          (draft as any)[field] = v == null ? '' : String(v).trim();
      }
    }

    // Apply schema defaults for missing optional fields.
    const result = productSchema.safeParse(draft);
    if (result.success) {
      return { rowNumber: idx + 2, data: result.data, raw: row };
    }
    return {
      rowNumber: idx + 2,
      raw: row,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    };
  });

  const validCount = rows.filter((r) => r.data).length;
  const errorCount = rows.length - validCount;
  return { rows, validCount, errorCount, detectedHeaders };
}

/** Build a tiny template workbook the user can download to fill in. */
export function buildTemplateWorkbook(): Blob {
  const headers = [
    'SKU / Code', 'Product Name', 'Features / Description', 'Connectivity / Specs', 'HSN', 'Unit', 'Price', 'GST%', 'Category'
  ];
  const sample = [
    [
      'SKU-CLOUD-01',
      'WA Quote Enterprise License',
      'Unlimited Users / Cloud Sync',
      'REST API + Webhooks',
      '998313',
      'Nos',
      12000,
      18,
      'Software'
    ],
    [
      'SKU-SRV-01',
      'Implementation & Setup Service',
      'Configuration, Onboarding & Training',
      'Remote / On-site',
      '998315',
      'Nos',
      5000,
      18,
      'Service'
    ]
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

/** Export full product catalog with audit info to Excel */
export function exportProductsToExcel(products: ProductDoc[]): void {
  const headers = [
    'SKU / Code',
    'Product Name',
    'Features / Description',
    'Connectivity / Specs',
    'HSN Code',
    'Unit',
    'Price (₹)',
    'GST Rate (%)',
    'Category',
    'Status',
    'Created By',
    'Created Date',
    'Last Updated By',
    'Last Updated Date',
    'Last Price Updated By'
  ];

  const formatDate = (val: any) => {
    if (!val) return '';
    const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN');
  };

  const data = products.map((p, idx) => [
    p.serialNumber || idx + 1,
    p.name || '',
    p.features || '',
    p.connectivity || '',
    p.hsn || '',
    p.unit || 'Nos',
    p.rate || 0,
    ((p.gstRate || 0) * 100).toFixed(0) + '%',
    p.category || 'General',
    p.active !== false ? 'Active' : 'Inactive',
    p.createdByName || '',
    formatDate(p.createdAt),
    p.updatedByName || '',
    formatDate(p.updatedAt),
    p.priceUpdatedByName || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Set friendly column widths
  ws['!cols'] = [
    { wch: 18 }, // SKU / Code
    { wch: 28 }, // Product Name
    { wch: 24 }, // Features
    { wch: 18 }, // Connectivity
    { wch: 12 }, // HSN Code
    { wch: 8 },  // Unit
    { wch: 12 }, // Price
    { wch: 12 }, // GST Rate
    { wch: 14 }, // Category
    { wch: 10 }, // Status
    { wch: 18 }, // Created By
    { wch: 20 }, // Created Date
    { wch: 18 }, // Last Updated By
    { wch: 20 }, // Last Updated Date
    { wch: 20 }  // Last Price Updated By
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, `Products-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

