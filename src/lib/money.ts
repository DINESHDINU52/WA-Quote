/**
 * Money + tax helpers. All amounts are stored as numbers in rupees with up
 * to 2 decimal places. Rounding is applied at totals only; line-level
 * intermediates carry full precision so display matches sum-of-totals.
 */

export interface LineInput {
  qty: number;
  rate: number;
  /** GST rate as a fraction, e.g. 0.18 for 18%. */
  gstRate: number;
  /** Optional flat discount on the line (rupees). */
  discount?: number;
}

export interface LineComputed {
  amount: number; // qty * rate - discount
  cgst: number;
  sgst: number;
  igst: number;
  total: number; // amount + tax
}

export interface InvoiceTaxInput {
  /** "intra" → CGST + SGST split; "inter" → IGST. */
  mode: 'intra' | 'inter';
  lines: LineInput[];
  /** Round grand total to nearest rupee. */
  roundOff?: boolean;
}

export interface InvoiceTaxOutput {
  lines: LineComputed[];
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeLine(line: LineInput, mode: 'intra' | 'inter'): LineComputed {
  const gross = (line.qty || 0) * (line.rate || 0);
  const amount = round2(gross - (line.discount || 0));
  const tax = round2(amount * (line.gstRate || 0));
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (mode === 'intra') {
    cgst = round2(tax / 2);
    sgst = round2(tax - cgst);
  } else {
    igst = tax;
  }
  const total = round2(amount + cgst + sgst + igst);
  return { amount, cgst, sgst, igst, total };
}

export function computeInvoice(input: InvoiceTaxInput): InvoiceTaxOutput {
  const lines = input.lines.map((l) => computeLine(l, input.mode));
  const taxableAmount = round2(lines.reduce((s, l) => s + l.amount, 0));
  const cgstTotal = round2(lines.reduce((s, l) => s + l.cgst, 0));
  const sgstTotal = round2(lines.reduce((s, l) => s + l.sgst, 0));
  const igstTotal = round2(lines.reduce((s, l) => s + l.igst, 0));
  const rawGrand = taxableAmount + cgstTotal + sgstTotal + igstTotal;
  const grandRounded = input.roundOff ? Math.round(rawGrand) : round2(rawGrand);
  const roundOff = round2(grandRounded - rawGrand);
  return {
    lines,
    taxableAmount,
    cgstTotal,
    sgstTotal,
    igstTotal,
    roundOff,
    grandTotal: grandRounded
  };
}

/**
 * Convert a number to Indian-English words. Handles up to 99 crore.
 * Used for the "Amount in Words" footer line on PDFs.
 */
export function numberToIndianWords(num: number): string {
  if (!Number.isFinite(num)) return '';
  const isNegative = num < 0;
  const n = Math.abs(num);
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const inWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      return tens[t] + (o ? ' ' + ones[o] : '');
    }
    const h = Math.floor(n / 100);
    const r = n % 100;
    return ones[h] + ' Hundred' + (r ? ' and ' + inWords(r) : '');
  };

  const words = (val: number): string => {
    if (val === 0) return '';
    const parts: string[] = [];
    const crore = Math.floor(val / 10000000);
    val %= 10000000;
    const lakh = Math.floor(val / 100000);
    val %= 100000;
    const thousand = Math.floor(val / 1000);
    val %= 1000;
    const remainder = val;

    if (crore) parts.push(inWords(crore) + ' Crore');
    if (lakh) parts.push(inWords(lakh) + ' Lakh');
    if (thousand) parts.push(inWords(thousand) + ' Thousand');
    if (remainder) {
      if (parts.length > 0 && remainder < 100) {
        parts.push('and ' + inWords(remainder));
      } else {
        parts.push(inWords(remainder));
      }
    }
    return parts.join(' ');
  };

  let result = '';
  if (rupees === 0 && paise === 0) {
    result = 'Rupees Zero';
  } else {
    if (rupees > 0) result = 'Rupees ' + words(rupees);
    if (paise > 0) result += (rupees > 0 ? ' and ' : 'Rupees ') + words(paise) + ' Paise';
  }
  result += ' Only';
  return (isNegative ? 'Minus ' : '') + result;
}
