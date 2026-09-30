import { NextRequest, NextResponse } from 'next/server';
import { sendReminderEmail } from '@/lib/drive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/payment/send-reminder
 * Body: { docNumber, customerName, grandTotal, issueDate, daysOverdue, driveUrl, to? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { docNumber, customerName } = body;

    if (!docNumber || !customerName) {
      return NextResponse.json(
        { ok: false, error: 'Missing docNumber or customerName' },
        { status: 400 }
      );
    }

    const result = await sendReminderEmail(body);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      emailSent: result.emailSent,
      emailTo: result.emailTo
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to send reminder' },
      { status: 500 }
    );
  }
}
