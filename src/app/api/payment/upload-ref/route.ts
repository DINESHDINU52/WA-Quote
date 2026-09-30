import { NextRequest, NextResponse } from 'next/server';
import { uploadPaymentReference } from '@/lib/drive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/payment/upload-ref
 * Body: { filename, mimeType, base64, customerName, docNumber }
 * Uploads a payment reference image to <Customer>/Payment Reference folder.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, mimeType, base64, customerName, docNumber } = body;

    if (!filename || !base64 || !customerName || !docNumber) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Size check (base64 is ~4/3 of binary)
    const approxSize = (base64.length * 3) / 4;
    if (approxSize > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: 'File exceeds 5 MB limit' },
        { status: 400 }
      );
    }

    if (!mimeType?.startsWith('image/')) {
      return NextResponse.json(
        { ok: false, error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    const result = await uploadPaymentReference({
      filename,
      mimeType,
      base64,
      customerName,
      docNumber
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      fileId: result.fileId,
      url: result.url,
      filename: result.filename,
      size: approxSize
    });
  } catch (err: any) {
    console.error('[upload-ref] error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
