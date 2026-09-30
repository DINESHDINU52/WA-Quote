/**
 * Premium light-mode invoice PDF template — landscape A4.
 * Single source of truth for all four document types
 * (Quotation / Proforma / Tax Invoice / Credit Note).
 *
 * Layout philosophy:
 *   - Landscape so 9-column tax invoices stay one-page
 *   - Logo + company block on the left, doc title + meta on the right
 *   - Two parties side by side in tinted cards
 *   - Single-page-by-default: tight padding, compact totals
 *   - Footer: computer-generated disclaimer + authorised signatory
 */

import type {
  TDocumentDefinitions,
  Content,
  TableCell,
  StyleDictionary
} from 'pdfmake/interfaces';
import type { BillingDoc } from '../doc-types';
import { DOC_CONFIG } from '../doc-types';
import { formatINR, formatInvoiceDate } from '../utils';
import { getPaymentSummary } from '../payment-helpers';

const BRAND = {
  ink900: '#131a1f',
  ink700: '#334048',
  ink500: '#5e6e76',
  ink300: '#bcc6cc',
  ink100: '#eff2f4',
  ink50: '#f8fafb',
  brand700: '#991b1b', // Deep crimson red for title & grand total
  brand600: '#dc2626', // Rich red for header dividing rule
  brand100: '#fee2e2', // Light red accent/border
  brand50: '#fef2f2'   // Soft luxury RED TINT background
};

// Portrait A4 in points: 595 wide × 842 tall.
// With 24pt margins on either side, the content width is 547pt.
const CONTENT_WIDTH = 547;

function fmt(n: number) {
  return formatINR(n, { showSymbol: false });
}

function fmtDate(ms?: number) {
  if (!ms) return '';
  return formatInvoiceDate(new Date(ms));
}

interface BuildOptions {
  /** Optional base64 data URL for the company logo. */
  logoDataUrl?: string | null;
  /** Optional base64 data URL for the authorised signatory image. */
  signatureDataUrl?: string | null;
  /** Optional base64 data URL for the payment QR code (shown on PI only). */
  paymentQrDataUrl?: string | null;
}

export function buildDocPdfDefinition(
  doc: BillingDoc,
  options: BuildOptions = {}
): TDocumentDefinitions {
  const cfg = DOC_CONFIG[doc.docType];
  const isIntra = doc.taxMode === 'intra';

  // ---------- Header bar ---------------------------------------------------
  const headerLeft: Content[] = [];
  if (options.logoDataUrl) {
    headerLeft.push({
      image: options.logoDataUrl,
      width: 90,
      margin: [0, 0, 0, 4]
    });
  }
  headerLeft.push(
    { text: doc.company.legalName, style: 'companyName' },
    {
      text: [
        doc.company.address.line1,
        doc.company.address.line2 ? `, ${doc.company.address.line2}` : '',
        `\n${doc.company.address.city}, ${doc.company.address.state} ${doc.company.address.pincode}, ${doc.company.address.country}`
      ].join(''),
      style: 'companyAddr',
      margin: [0, 2, 0, 0]
    },
    {
      text: [
        { text: 'GSTIN: ', style: 'metaLabel' },
        { text: doc.company.gstin, style: 'companyMeta' },
        { text: '   PAN: ', style: 'metaLabel' },
        { text: doc.company.pan, style: 'companyMeta' }
      ],
      margin: [0, 4, 0, 0]
    },
    {
      text: [
        { text: 'Email: ', style: 'metaLabel' },
        { text: doc.company.email, style: 'companyMeta' },
        { text: '   Phone: ', style: 'metaLabel' },
        { text: doc.company.phone, style: 'companyMeta' }
      ],
      margin: [0, 2, 0, 0]
    }
  );

  const headerRight: Content[] = [
    {
      text: [
        { text: `${cfg.headerWord.toUpperCase()} : `, style: 'metaLabel' },
        { text: doc.number || 'DRAFT', style: 'docNumber' }
      ],
      alignment: 'right',
      margin: [0, 0, 0, 2]
    }
  ];

  // Build the meta-rows table on the right (key | value pairs).
  const metaRows: TableCell[][] = [
    [
      { text: 'Issue Date', style: 'metaLabel', alignment: 'right' },
      { text: fmtDate(doc.issueDate), style: 'metaValue', alignment: 'right' }
    ]
  ];
  if (cfg.showDueDate && doc.dueDate) {
    metaRows.push([
      { text: 'Due Date', style: 'metaLabel', alignment: 'right' },
      { text: fmtDate(doc.dueDate), style: 'metaValue', alignment: 'right' }
    ]);
  }
  if (cfg.showValidTill && doc.validTill) {
    metaRows.push([
      { text: 'Valid Till', style: 'metaLabel', alignment: 'right' },
      { text: fmtDate(doc.validTill), style: 'metaValue', alignment: 'right' }
    ]);
  }
  metaRows.push([
    { text: 'Place of Supply', style: 'metaLabel', alignment: 'right' },
    {
      text: `${doc.customer.address.state} (${doc.customer.address.stateCode})`,
      style: 'metaValue',
      alignment: 'right'
    }
  ]);
  metaRows.push([
    { text: 'Tax Mode', style: 'metaLabel', alignment: 'right' },
    {
      text: isIntra ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)',
      style: 'metaValue',
      alignment: 'right'
    }
  ]);
  if (doc.preparedBy) {
    metaRows.push([
      { text: 'Prepared By', style: 'metaLabel', alignment: 'right' },
      { text: doc.preparedBy, style: 'metaValue', alignment: 'right' }
    ]);
  }

  headerRight.push({
    table: { widths: ['*', 'auto'], body: metaRows },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 1.5,
      paddingBottom: () => 1.5,
      paddingLeft: () => 6,
      paddingRight: () => 0
    },
    margin: [0, 6, 0, 0]
  });

  const headerBlock: Content = {
    columns: [
      { width: '*', stack: headerLeft },
      { width: 210, stack: headerRight }
    ],
    columnGap: 16
  };

  const headerRule: Content = {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: CONTENT_WIDTH,
        y2: 0,
        lineWidth: 1.5,
        lineColor: BRAND.brand600
      }
    ],
    margin: [0, 10, 0, 12]
  };

  // ---------- Billed-to / billed-by / shipped-to panels ------------------
  const showShipping = doc.docType === 'proforma' && doc.shipping && !doc.shipping.sameAsBilling && doc.shipping.address;

  const billedByCell = {
    stack: [
      { text: doc.docType === 'po' ? 'ISSUED BY' : 'BILLED BY', style: 'panelLabel' },
      { text: doc.company.legalName, style: 'panelName', margin: [0, 2, 0, 2] },
      {
        text: [
          doc.company.address.line1,
          doc.company.address.line2 ? `, ${doc.company.address.line2}` : '',
          `\n${doc.company.address.city}, ${doc.company.address.state} ${doc.company.address.pincode}`
        ].join(''),
        style: 'panelAddr'
      },
      {
        text: `GSTIN: ${doc.company.gstin}`,
        style: 'panelMeta',
        margin: [0, 3, 0, 0]
      },
      {
        text: `Phone: ${doc.company.phone}`,
        style: 'panelMeta',
        margin: [0, 2, 0, 0]
      }
    ],
    fillColor: BRAND.ink50,
    margin: [12, 8, 12, 8],
    border: [false, false, false, false]
  };

  const billedToCell = {
    stack: [
      {
        text: doc.docType === 'quotation' ? 'QUOTATION FOR' : doc.docType === 'po' ? 'VENDOR / SUPPLIER' : 'BILLED TO',
        style: 'panelLabel',
        color: BRAND.brand700
      },
      ...(doc.customer.companyName
        ? [{ text: doc.customer.companyName, style: 'panelName', margin: [0, 2, 0, 0] } as Content]
        : []),
      {
        text: doc.customer.companyName
          ? `Contact: ${doc.customer.name}`
          : doc.customer.name,
        style: doc.customer.companyName ? 'panelContact' : 'panelName',
        margin: [0, 2, 0, 2]
      },
      {
        text: [
          doc.customer.address.line1,
          doc.customer.address.line2 ? `\n${doc.customer.address.line2}` : '',
          `\n${doc.customer.address.city || ''}${doc.customer.address.city && doc.customer.address.state ? ', ' : ''}${doc.customer.address.state || ''} ${doc.customer.address.pincode || ''}`
        ].join(''),
        style: 'panelAddr'
      },
      ...(doc.customer.gstin
        ? [{ text: `GSTIN: ${doc.customer.gstin}`, style: 'panelMeta', margin: [0, 3, 0, 0] } as Content]
        : []),
      ...(doc.customer.pan
        ? [{ text: `PAN: ${doc.customer.pan}`, style: 'panelMeta', margin: [0, 2, 0, 0] } as Content]
        : []),
      ...(doc.customer.email
        ? [{ text: `Email: ${doc.customer.email}`, style: 'panelMeta', margin: [0, 2, 0, 0] } as Content]
        : []),
      ...(doc.customer.phone
        ? [{ text: `Phone: ${doc.customer.phone}`, style: 'panelMeta', margin: [0, 2, 0, 0] } as Content]
        : [])
    ],
    fillColor: BRAND.brand50,
    margin: [12, 8, 12, 8],
    border: [false, false, false, false]
  };

  const shippedToCell = showShipping ? {
    stack: [
      { text: 'SHIPPED TO', style: 'panelLabel' },
      ...(doc.customer.companyName
        ? [{ text: doc.customer.companyName, style: 'panelName', margin: [0, 2, 0, 0] } as Content]
        : []),
      ...(doc.shipping!.contactPerson
        ? [{ text: `Contact: ${doc.shipping!.contactPerson}`, style: 'panelContact', margin: [0, 2, 0, 1] } as Content]
        : []),
      {
        text: [
          doc.shipping!.address!.line1,
          doc.shipping!.address!.line2 ? `, ${doc.shipping!.address!.line2}` : '',
          `\n${doc.shipping!.address!.city || ''}${
            doc.shipping!.address!.state ? `, ${doc.shipping!.address!.state} ${doc.shipping!.address!.pincode}` : ''
          }`
        ].join(''),
        style: 'panelAddr'
      },
      ...(doc.shipping!.phone
        ? [{ text: `Phone: ${doc.shipping!.phone}`, style: 'panelMeta', margin: [0, 2, 0, 0] } as Content]
        : [])
    ],
    fillColor: BRAND.ink50,
    margin: [12, 8, 12, 8],
    border: [false, false, false, false]
  } : null;

  const partiesBlock: Content = {
    table: {
      widths: showShipping ? ['*', '*', '*'] : ['*', '*'],
      body: [
        showShipping
          ? [billedByCell as TableCell, billedToCell as TableCell, shippedToCell as TableCell]
          : [billedByCell as TableCell, billedToCell as TableCell]
      ]
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0
    },
    margin: [0, 0, 0, 12]
  };

  const shippingBlock: Content = { text: '' };

  const tableTitleBlock: Content = {
    columns: [
      {
        text: [
          { text: cfg.headerWord.toUpperCase(), style: 'docTitle' },
          doc.number ? { text: `   ${doc.number}`, style: 'docNumber', color: BRAND.ink700, fontSize: 10 } : { text: '' }
        ],
        alignment: 'left',
        width: '*'
      }
    ],
    margin: [0, 0, 0, 6]
  };

  // ---------- Line-items table -------------------------------------------
  // Portrait gives us 539pt of content width to spread across:
  //   #  | Item / S/N        | HSN | Qty | Rate | Amt | CGST/SGST | Total
  //   18 |        *          | 46  | 28  | 50   | 60  | 38 + 38   | 60     (intra)
  //   18 |        *          | 46  | 28  | 50   | 60  | 56        | 60     (inter)
  const tableHeader: TableCell[] = [
    { text: '#', style: 'th', alignment: 'center' },
    { text: 'Item / Description', style: 'th' },
    { text: 'HSN', style: 'th', alignment: 'center' },
    { text: 'Qty', style: 'th', alignment: 'right' },
    { text: 'Rate', style: 'th', alignment: 'right' },
    { text: 'Amount', style: 'th', alignment: 'right' },
    { text: 'Tax %', style: 'th', alignment: 'center' },
    ...(isIntra
      ? [
          { text: 'CGST', style: 'th', alignment: 'right' } as TableCell,
          { text: 'SGST', style: 'th', alignment: 'right' } as TableCell
        ]
      : [{ text: 'IGST', style: 'th', alignment: 'right' } as TableCell]),
    { text: 'Total', style: 'th', alignment: 'right' }
  ];

  const itemRows: TableCell[][] = doc.lineItems.map((line, idx) => {
    const descParts = (line.description || '—').split('\n');
    const firstLine = descParts[0] || '—';
    const otherLines = descParts.slice(1).filter(Boolean);

    const descCell: TableCell = {
      stack: [
        { text: firstLine, style: 'tdItem' },
        ...otherLines.map(
          (t) =>
            ({
              text: t,
              style: 'tdDesc'
            } as Content)
        ),
        ...line.serials.map(
          (s) =>
            ({
              text: `S/N : ${s}`,
              style: 'tdSerial'
            } as Content)
        )
      ]
    };
    const taxPercent = (line.gstRate ?? 0.18) * 100;
    return [
      { text: String(idx + 1), style: 'td', alignment: 'center', noWrap: true },
      descCell,
      { text: line.hsn || '—', style: 'td', alignment: 'center', noWrap: true },
      { text: String(line.qty), style: 'tdNum', alignment: 'right', noWrap: true },
      { text: fmt(line.rate), style: 'tdNum', alignment: 'right', noWrap: true },
      { text: fmt(line.amount), style: 'tdNum', alignment: 'right', noWrap: true },
      { text: `${taxPercent}%`, style: 'td', alignment: 'center', noWrap: true },
      ...(isIntra
        ? [
            { text: fmt(line.cgst), style: 'tdNum', alignment: 'right', noWrap: true } as TableCell,
            { text: fmt(line.sgst), style: 'tdNum', alignment: 'right', noWrap: true } as TableCell
          ]
        : [{ text: fmt(line.igst), style: 'tdNum', alignment: 'right', noWrap: true } as TableCell]),
      { text: fmt(line.total), style: 'tdNum', alignment: 'right', noWrap: true }
    ];
  });

  const intraWidths = [14, '*' as const, 34, 18, 48, 52, 24, 48, 48, 56];
  const interWidths = [14, '*' as const, 34, 18, 50, 56, 26, 56, 58];

  const itemsTable: Content = {
    table: {
      headerRows: 1,
      widths: isIntra ? intraWidths : interWidths,
      body: [tableHeader, ...itemRows]
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : i === 1 ? 1 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => BRAND.ink100,
      paddingTop: (i: number) => (i === 0 ? 5.5 : 4.5),
      paddingBottom: (i: number) => (i === 0 ? 5.5 : 4.5),
      paddingLeft: () => 4,
      paddingRight: () => 4,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? BRAND.brand50 : null)
    },
    margin: [0, 0, 0, 14]
  };

  // ---------- Totals + bank block ----------------------------------------
  const summary = doc.taxSummary;

  const totalsRows: TableCell[][] = [
    [
      { text: 'Taxable Amount', style: 'sumLabel' },
      { text: fmt(summary.taxableAmount), style: 'sumValue', alignment: 'right' }
    ],
    ...(isIntra
      ? [
          [
            { text: 'CGST', style: 'sumLabel' },
            { text: fmt(summary.cgstTotal), style: 'sumValue', alignment: 'right' }
          ] as TableCell[],
          [
            { text: 'SGST', style: 'sumLabel' },
            { text: fmt(summary.sgstTotal), style: 'sumValue', alignment: 'right' }
          ] as TableCell[]
        ]
      : [
          [
            { text: 'IGST', style: 'sumLabel' },
            { text: fmt(summary.igstTotal), style: 'sumValue', alignment: 'right' }
          ] as TableCell[]
        ]),
    ...(summary.roundOff !== 0
      ? [
          [
            { text: 'Round Off', style: 'sumLabel' },
            { text: fmt(summary.roundOff), style: 'sumValue', alignment: 'right' }
          ] as TableCell[]
        ]
      : []),
    [
      { text: 'Total (INR)', style: 'sumGrandLabel' },
      { text: fmt(summary.grandTotal), style: 'sumGrandValue', alignment: 'right' }
    ]
  ];

  const bankPanel: Content = doc.company.bank?.bankName
    ? {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: 'BANK DETAILS', style: 'panelLabel', margin: [0, 0, 0, 4] },
                  {
                    table: {
                      widths: ['auto', '*'],
                      body: [
                        [
                          { text: 'Bank', style: 'bankLabel' },
                          { text: doc.company.bank.bankName, style: 'bankValue' }
                        ],
                        [
                          { text: 'A/c No', style: 'bankLabel' },
                          { text: doc.company.bank.accountNumber, style: 'bankValue' }
                        ],
                        [
                          { text: 'IFSC', style: 'bankLabel' },
                          { text: doc.company.bank.ifsc, style: 'bankValue' }
                        ],
                        ...(doc.company.bank.accountName
                          ? [
                              [
                                { text: 'Beneficiary', style: 'bankLabel' },
                                { text: doc.company.bank.accountName, style: 'bankValue' }
                              ] as TableCell[]
                            ]
                          : []),
                        ...(doc.company.bank.accountType
                          ? [
                              [
                                { text: 'Type', style: 'bankLabel' },
                                { text: doc.company.bank.accountType, style: 'bankValue' }
                              ] as TableCell[]
                            ]
                          : [])
                      ]
                    },
                    layout: {
                      hLineWidth: () => 0,
                      vLineWidth: () => 0,
                      paddingTop: () => 2,
                      paddingBottom: () => 2,
                      paddingLeft: () => 0,
                      paddingRight: () => 4
                    }
                  }
                ]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => BRAND.ink100,
          vLineColor: () => BRAND.ink100,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          fillColor: () => BRAND.ink50
        },
        margin: [0, 10, 0, 0]
      }
    : { text: '' };

  const amountInWordsBlock: Content = {
    stack: [
      { text: 'AMOUNT IN WORDS', style: 'panelLabel', alignment: 'right', margin: [0, 8, 0, 2] },
      { text: summary.amountInWords, style: 'awValue', alignment: 'right' }
    ],
    margin: [0, 0, 0, 4]
  };

  const paymentNoticeBlock: Content =
    doc.docType === 'proforma' && options.paymentQrDataUrl
      ? {
          text: '* For UPI / QR Code payment, please refer to Page 2.',
          style: 'panelMeta',
          bold: true,
          margin: [0, 6, 0, 0]
        }
      : { text: '' };

  const notesBlock: Content =
    doc.notes
      ? {
          stack: [
            { text: 'NOTES', style: 'panelLabel', margin: [0, 6, 0, 3] },
            { text: doc.notes, style: 'terms' }
          ],
          margin: [0, 4, 0, 0]
        }
      : { text: '' };

  const totalsBlock: Content = {
    columns: [
      {
        width: '*',
        stack: [
          ...(doc.notes ? [notesBlock] : []),
          paymentNoticeBlock
        ]
      },
      {
        width: 240,
        stack: [
          {
            table: { widths: ['*', 'auto'], body: totalsRows },
            layout: {
              hLineWidth: (i: number, node: any) =>
                i === 0 || i === node.table.body.length ? 0 : 0.5,
              vLineWidth: () => 0,
              hLineColor: () => BRAND.ink100,
              paddingTop: () => 5,
              paddingBottom: () => 5,
              paddingLeft: () => 6,
              paddingRight: () => 6,
              fillColor: (rowIndex: number, node: any) =>
                rowIndex === node.table.body.length - 1 ? BRAND.brand50 : null
            }
          },
          amountInWordsBlock,
          bankPanel
        ]
      }
    ],
    columnGap: 20,
    margin: [0, 6, 0, 0]
  };

  // ---------- QR Code Page 2 (Proforma Invoice only) ---------------------
  const qrPage: Content =
    doc.docType === 'proforma' && options.paymentQrDataUrl
      ? {
          stack: [
            { text: '', pageBreak: 'before' },
            { text: 'PAYMENT — SCAN TO PAY', style: 'docTitle', alignment: 'center', margin: [0, 40, 0, 10] },
            {
              text: `${cfg.headerWord} No: ${doc.number || 'DRAFT'}`,
              style: 'docNumber',
              alignment: 'center',
              margin: [0, 0, 0, 4]
            },
            {
              text: `Amount: ₹ ${formatINR(summary.grandTotal, { showSymbol: false })}`,
              fontSize: 14,
              bold: true,
              color: BRAND.ink900,
              alignment: 'center',
              margin: [0, 0, 0, 20]
            },
            {
              image: options.paymentQrDataUrl,
              width: 280,
              alignment: 'center'
            },
            {
              text: 'Scan this QR code to pay via UPI / Google Pay / PhonePe / Paytm',
              style: 'disclaimer',
              alignment: 'center',
              margin: [0, 12, 0, 20]
            },
            {
              table: {
                widths: ['auto', '*'],
                body: [
                  [{ text: 'Account Name', style: 'bankLabel' }, { text: doc.company.bank.accountName, style: 'bankValue' }],
                  [{ text: 'Bank', style: 'bankLabel' }, { text: doc.company.bank.bankName, style: 'bankValue' }],
                  [{ text: 'A/c Number', style: 'bankLabel' }, { text: doc.company.bank.accountNumber, style: 'bankValue' }],
                  [{ text: 'IFSC', style: 'bankLabel' }, { text: doc.company.bank.ifsc, style: 'bankValue' }],
                  [{ text: 'Type', style: 'bankLabel' }, { text: doc.company.bank.accountType, style: 'bankValue' }]
                ]
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingTop: () => 3,
                paddingBottom: () => 3,
                paddingLeft: () => 0,
                paddingRight: () => 10
              },
              margin: [120, 0, 120, 0]
            },
            {
              text: `${doc.company.legalName}`,
              style: 'companyName',
              alignment: 'center',
              margin: [0, 20, 0, 4]
            },
            {
              text: `Phone: ${doc.company.phone}  |  Email: ${doc.company.email}`,
              style: 'companyAddr',
              alignment: 'center'
            }
          ]
        }
      : { text: '' };

  // ---------- Terms & Conditions (occupies lowest place of A4 sheet) ------
  const termsBlock: Content =
    doc.termsAndConditions
      ? {
          stack: [
            {
              canvas: [
                {
                  type: 'line',
                  x1: 0,
                  y1: 0,
                  x2: CONTENT_WIDTH,
                  y2: 0,
                  lineWidth: 0.5,
                  lineColor: BRAND.ink100
                }
              ],
              margin: [0, 0, 0, 8]
            },
            { text: 'TERMS & CONDITIONS', style: 'panelLabel', margin: [0, 0, 0, 4] },
            { text: doc.termsAndConditions, style: 'terms' }
          ],
          margin: [0, 18, 0, 0]
        }
      : { text: '' };

  // ---------- Disclaimer (no signature) ------------------------------------
  const signatureBlock: Content = {
    text:
      'This is a computer-generated document. No physical signature is required. ' +
      'Errors and omissions excepted.',
    style: 'disclaimer',
    margin: [0, 10, 0, 0]
  };

  // ---------- Document definition ----------------------------------------
  const styles: StyleDictionary = {
    companyName: { fontSize: 13, bold: true, color: BRAND.ink900 },
    companyAddr: { fontSize: 8.5, color: BRAND.ink500, lineHeight: 1.3 },
    companyMeta: { fontSize: 8.5, color: BRAND.ink900 },
    docTitle: {
      fontSize: 12,
      bold: true,
      color: BRAND.brand700,
      characterSpacing: 0.6
    },
    docNumber: { fontSize: 10, color: BRAND.ink900, bold: true },
    metaLabel: { fontSize: 8, color: BRAND.ink500 },
    metaValue: { fontSize: 9, color: BRAND.ink900, bold: true },
    panelLabel: {
      fontSize: 8,
      bold: true,
      color: BRAND.ink500,
      characterSpacing: 0.6
    },
    panelName: { fontSize: 11, bold: true, color: BRAND.ink900 },
    panelContact: { fontSize: 9.5, color: BRAND.ink700, bold: true },
    panelAddr: { fontSize: 9, color: BRAND.ink500, lineHeight: 1.3 },
    panelMeta: { fontSize: 9, color: BRAND.ink700 },
    th: { fontSize: 7.5, bold: true, color: BRAND.ink700, characterSpacing: 0.2 },
    td: { fontSize: 8, color: BRAND.ink700 },
    tdNum: { fontSize: 8, color: BRAND.ink900 },
    tdItem: { fontSize: 8.5, color: BRAND.ink900, bold: true, lineHeight: 1.15 },
    tdDesc: { fontSize: 7.5, color: BRAND.ink500, lineHeight: 1.15, margin: [0, 1, 0, 0] },
    tdSerial: { fontSize: 7.5, color: BRAND.ink500, italics: true, margin: [0, 1, 0, 0] },
    sumLabel: { fontSize: 9, color: BRAND.ink700 },
    sumValue: { fontSize: 9, color: BRAND.ink900 },
    sumGrandLabel: { fontSize: 11, bold: true, color: BRAND.brand700 },
    sumGrandValue: { fontSize: 12, bold: true, color: BRAND.brand700 },
    bankLabel: { fontSize: 9, color: BRAND.ink500 },
    bankValue: { fontSize: 9, color: BRAND.ink900, bold: true },
    awLabel: { fontSize: 9, color: BRAND.ink500 },
    awValue: { fontSize: 9, color: BRAND.ink900, italics: true, bold: true },
    terms: { fontSize: 8.5, color: BRAND.ink700, lineHeight: 1.35 },
    disclaimer: { fontSize: 8, color: BRAND.ink500, italics: true, lineHeight: 1.35 },
    sigLabel: { fontSize: 9, color: BRAND.ink900, bold: true },
    sigSub: { fontSize: 8, color: BRAND.ink500, margin: [0, 1, 0, 0] },
    footer: { fontSize: 8, color: BRAND.ink500 },
    paidBanner: {
      fontSize: 11,
      bold: true,
      color: '#059669',
      fillColor: '#ecfdf5'
    }
  };

  const isPaid = doc.docType === 'proforma' && doc.paymentStatus === 'paid';

  // ---------- Paid summary block (when fully paid) -----------------------
  const paidSummary = isPaid ? getPaymentSummary(doc) : null;
  const paidBlock: Content[] = [];
  if (isPaid && paidSummary && paidSummary.installments.length > 0) {
    paidBlock.push({
      text: `✓ PAID IN FULL — ₹${paidSummary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}${paidSummary.installmentCount > 1 ? ` across ${paidSummary.installmentCount} installments` : ''}`,
      style: 'paidBanner',
      alignment: 'center',
      margin: [0, 0, 0, 6]
    } as Content);

    // Installment history table
    const histHeader: TableCell[] = [
      { text: '#', style: 'th', alignment: 'center' },
      { text: 'Date', style: 'th' },
      { text: 'Reference / Notes', style: 'th' },
      { text: 'Amount', style: 'th', alignment: 'right' }
    ];
    const histRows: TableCell[][] = paidSummary.installments.map((ins, idx) => [
      { text: String(idx + 1), style: 'td', alignment: 'center' },
      {
        text: new Date(ins.paidAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        style: 'td'
      },
      { text: ins.notes || '—', style: 'td' },
      {
        text: `₹${ins.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        style: 'tdNum',
        alignment: 'right'
      }
    ]);
    histRows.push([
      { text: '', style: 'td' },
      { text: '', style: 'td' },
      { text: 'TOTAL PAID', style: 'sumGrandLabel', alignment: 'right' },
      {
        text: `₹${paidSummary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        style: 'sumGrandValue',
        alignment: 'right'
      }
    ]);

    paidBlock.push({
      table: {
        headerRows: 1,
        widths: [18, 70, '*' as const, 80],
        body: [histHeader, ...histRows]
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 0 : i === 1 ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => '#d1fae5',
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 6,
        paddingRight: () => 6,
        fillColor: (rowIndex: number, node: any) =>
          rowIndex === 0 ? '#ecfdf5' : rowIndex === node.table.body.length - 1 ? '#ecfdf5' : null
      },
      margin: [0, 0, 0, 10]
    } as Content);
  }

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [24, 20, 24, 36],
    defaultStyle: { font: 'Roboto', color: BRAND.ink900 },
    styles,
    watermark: isPaid
      ? { text: 'PAID', color: '#059669', opacity: 0.15, bold: true, fontSize: 120, angle: -30 }
      : undefined,
    content: [
      ...paidBlock,
      headerBlock,
      headerRule,
      partiesBlock,
      shippingBlock,
      tableTitleBlock,
      itemsTable,
      totalsBlock,
      termsBlock,
      signatureBlock,
      qrPage
    ],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: doc.company.footer,
          style: 'footer',
          alignment: 'left',
          width: '*'
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          style: 'footer',
          alignment: 'right',
          width: 80
        }
      ],
      margin: [28, 0, 28, 12]
    })
  };
}
