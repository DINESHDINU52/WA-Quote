import { NextRequest, NextResponse } from 'next/server';
import { renderDocPdf } from '@/lib/pdf/render';
import type { BillingDoc } from '@/lib/doc-types';

export const runtime = 'nodejs'; // pdfmake needs Node, not Edge

/**
 * POST /api/docs/preview
 * Body: { doc: BillingDoc }
 * Returns: application/pdf bytes
 *
 * Used to render the live in-app preview AND to download the PDF without
 * issuing the document. No Firestore writes, no Drive upload.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { doc?: BillingDoc };
    if (!body?.doc) {
      return NextResponse.json({ ok: false, error: 'Missing doc payload' }, { status: 400 });
    }
    const buf = await renderDocPdf(body.doc);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${body.doc.number || 'preview'}.pdf"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (err: any) {
    console.error('[preview] error', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Preview failed' },
      { status: 500 }
    );
  }
}
