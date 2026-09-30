import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { sendDigestEmail, type DigestItem } from '@/lib/drive';
import type { BillingDoc } from '@/lib/doc-types';
import { getPaymentSummary } from '@/lib/payment-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/payment/send-digest
 * Body: { idToken?: string }
 *
 * Reads all issued+unpaid PIs from Firestore, excludes those with skipReminder=true,
 * and sends ONE consolidated digest email to REMINDER_EMAIL_TO.
 *
 * Can be called manually from the UI, or via a cron trigger (Vercel/Apps Script).
 */
export async function POST(req: NextRequest) {
  try {
    // Initialize admin app
    getAdminAuth();
    const db = getFirestore(getApps()[0]);

    // Fetch all proformas with status=issued
    const snap = await db
      .collection('proformas')
      .where('status', '==', 'issued')
      .get();

    const now = Date.now();
    const items: DigestItem[] = [];

    snap.forEach((doc) => {
      const data = doc.data() as BillingDoc;
      const summary = getPaymentSummary(data);
      // Skip fully paid PIs
      if (summary.isPaid) return;
      // Skip flagged PIs
      if (data.skipReminder === true) return;

      const daysOld = data.issueDate
        ? Math.max(0, Math.floor((now - data.issueDate) / 86400000))
        : 0;

      items.push({
        docNumber: data.number || 'DRAFT',
        customerName: data.customer?.name || 'Unknown',
        companyName: data.customer?.companyName || '',
        // Show OUTSTANDING balance (so partial payments reduce the urgency amount)
        amount: summary.balance,
        issueDate: data.issueDate
          ? new Date(data.issueDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
          : '',
        daysOld,
        driveUrl: data.pdf?.url || ''
      });
    });

    // Sort by days old descending (oldest first — most urgent)
    items.sort((a, b) => b.daysOld - a.daysOld);

    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        emailSent: false,
        message: 'No unpaid Proforma Invoices to report.',
        count: 0
      });
    }

    const result = await sendDigestEmail({ items });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      emailSent: result.emailSent,
      emailTo: result.emailTo,
      count: items.length,
      totalAmount: items.reduce((sum, it) => sum + it.amount, 0)
    });
  } catch (err: any) {
    console.error('[send-digest] error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to send digest' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment/send-digest
 * For cron triggers (Vercel/external) — calls the same logic.
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
