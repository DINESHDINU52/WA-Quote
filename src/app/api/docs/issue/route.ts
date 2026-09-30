import { NextRequest, NextResponse } from 'next/server';
import { renderDocPdf } from '@/lib/pdf/render';
import { uploadToDrive } from '@/lib/drive';
import { DOC_CONFIG, type BillingDoc } from '@/lib/doc-types';

export const runtime = 'nodejs';

/**
 * POST /api/docs/issue
 * Body: { doc: BillingDoc, overwriteFileId?: string }
 *
 * The client is expected to:
 *   1. Allocate the document number client-side via the numbering counter
 *      transaction (so Firestore rules + auth stay in charge).
 *   2. Snapshot company + customer into the doc.
 *   3. Compute taxSummary.
 *   4. POST the fully-formed doc here. We render PDF, upload to Drive,
 *      and return { pdf } block to merge back onto the Firestore doc.
 *
 * This server route never touches Firestore — keeps auth surface minimal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { doc?: BillingDoc; overwriteFileId?: string };
    const doc = body?.doc;
    if (!doc) {
      return NextResponse.json({ ok: false, error: 'Missing doc payload' }, { status: 400 });
    }
    if (!doc.number || doc.number === 'DRAFT') {
      return NextResponse.json(
        { ok: false, error: 'Doc must already have an allocated number before issuing' },
        { status: 400 }
      );
    }

    const pdf = await renderDocPdf(doc);
    const safeNumber = doc.number.replace(/[\\/]/g, '-');
    const sanitize = (s: string) =>
      s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
    const company = doc.customer.companyName ? sanitize(doc.customer.companyName) : '';
    const contact = sanitize(doc.customer.name || 'Customer');
    // Format: <Number>-<Company>-<Contact>.pdf  (or just <Number>-<Contact> if no company)
    const safeCustomer = company ? `${company}-${contact}` : contact;
    const filename = `${safeNumber}-${safeCustomer}.pdf`;

    const drive = await uploadToDrive({
      filename,
      pdf,
      customerName: doc.customer.name || 'Unknown Customer',
      docType: doc.docType,
      overwriteFileId: body.overwriteFileId,
      docNumber: doc.number,
      grandTotal: `₹${doc.taxSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      issueDate: doc.issueDate ? new Date(doc.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      customerEmail: doc.customer.email || ''
    });

    // Log drive result for debugging
    console.log('[issue] Drive result:', JSON.stringify(drive));

    return NextResponse.json({
      ok: true,
      docType: doc.docType,
      docTypeLabel: DOC_CONFIG[doc.docType].label,
      filename,
      pdfBase64: pdf.toString('base64'),
      drive
    });
  } catch (err: any) {
    console.error('[issue] error', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Issue failed' },
      { status: 500 }
    );
  }
}
