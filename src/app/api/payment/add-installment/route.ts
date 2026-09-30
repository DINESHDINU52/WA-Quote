import { NextRequest, NextResponse } from 'next/server';
import { renderDocPdf } from '@/lib/pdf/render';
import { uploadToDrive, sendPaidNoticeEmail, type PaidInstallmentBlock } from '@/lib/drive';
import type { BillingDoc, PaymentInstallment } from '@/lib/doc-types';
import {
  computePaymentStatus,
  sumInstallments,
  normalizePayment,
  PAYMENT_TOLERANCE
} from '@/lib/payment-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/payment/add-installment
 *
 * Body:
 *   {
 *     doc: BillingDoc,                        // current doc snapshot (with previous installments[])
 *     newInstallment: PaymentInstallment      // the new payment being added
 *   }
 *
 * Behavior:
 *   - Computes new totalPaid + balance + status
 *   - If FULLY paid → re-render PDF with PAID watermark + payment history,
 *     upload to Drive, send "Payment Received" email with all installments + refs.
 *   - If still PARTIAL → no email, no PDF re-render, returns updated payment summary
 *     so the caller can persist to Firestore.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const doc = body?.doc as BillingDoc;
    const newInstallment = body?.newInstallment as PaymentInstallment;

    if (!doc || !newInstallment) {
      return NextResponse.json(
        { ok: false, error: 'Missing doc or newInstallment' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(newInstallment.amount) || newInstallment.amount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid installment amount' },
        { status: 400 }
      );
    }

    const grandTotal = doc.taxSummary?.grandTotal ?? 0;
    // Use normalizePayment so legacy single-payment docs are auto-migrated
    // (their `amount` becomes a single installment, preventing data loss).
    const normalized = normalizePayment(doc);
    const previousInstallments: PaymentInstallment[] = normalized?.installments ?? [];
    const previousPaid = sumInstallments(previousInstallments);

    // Block over-payment
    if (previousPaid + newInstallment.amount > grandTotal + PAYMENT_TOLERANCE) {
      const balance = Math.max(0, grandTotal - previousPaid);
      return NextResponse.json(
        {
          ok: false,
          error: `Over-payment not allowed. Outstanding balance is ₹${balance.toFixed(2)}.`,
          balance
        },
        { status: 400 }
      );
    }

    const updatedInstallments = [...previousInstallments, newInstallment];
    const totalPaid = sumInstallments(updatedInstallments);
    const balance = Math.max(0, grandTotal - totalPaid);
    const status = computePaymentStatus(grandTotal, totalPaid);

    const paymentDetails = {
      installments: updatedInstallments,
      totalPaid,
      balance,
      closedAt: status === 'paid' ? Date.now() : undefined
    };

    // If still partial — return early. Caller persists to Firestore. No email/PDF.
    if (status !== 'paid') {
      return NextResponse.json({
        ok: true,
        status,
        payment: paymentDetails,
        emailSent: false
      });
    }

    // Fully paid — re-render PDF + upload + send email
    const fullyPaidDoc: BillingDoc = {
      ...doc,
      paymentStatus: 'paid',
      payment: paymentDetails
    };

    const pdf = await renderDocPdf(fullyPaidDoc);
    const safeNumber = doc.number.replace(/[\\/]/g, '-');
    const sanitize = (s: string) =>
      s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
    const company = doc.customer.companyName ? sanitize(doc.customer.companyName) : '';
    const contact = sanitize(doc.customer.name || 'Customer');
    const safeCustomer = company ? `${company}-${contact}` : contact;
    const filename = `${safeNumber}-${safeCustomer}-PAID.pdf`;

    const drive = await uploadToDrive({
      filename,
      pdf,
      customerName: doc.customer.name || 'Unknown Customer',
      docType: doc.docType,
      overwriteFileId: doc.pdf?.driveFileId,
      docNumber: doc.number,
      grandTotal: `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      issueDate: doc.issueDate
        ? new Date(doc.issueDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
        : '',
      customerEmail: doc.customer.email || '',
      // No auto-email here — we send the paid notice separately below
      emailTo: ''
    });

    // Build the per-installment email blocks (with reference URLs)
    const installmentBlocks: PaidInstallmentBlock[] = updatedInstallments.map((ins) => ({
      amount: ins.amount,
      paidAt: new Date(ins.paidAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      notes: ins.notes,
      references: (ins.references || []).map((r) => r.url)
    }));

    // Flat list of ALL refs for legacy email rendering paths
    const allRefUrls = updatedInstallments.flatMap((ins) =>
      (ins.references || []).map((r) => r.url)
    );

    const emailResult = await sendPaidNoticeEmail({
      docNumber: doc.number,
      customerName: doc.customer.name,
      grandTotal: `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      amountPaid: `₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      paidAt: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      installments: installmentBlocks,
      installmentCount: installmentBlocks.length,
      referenceUrls: allRefUrls,
      driveUrl: drive.url,
      paidPdfBase64: pdf.toString('base64'),
      paidPdfFilename: filename
    });

    return NextResponse.json({
      ok: true,
      status,
      payment: paymentDetails,
      filename,
      pdfBase64: pdf.toString('base64'),
      drive,
      emailSent: emailResult.emailSent,
      emailTo: emailResult.emailTo
    });
  } catch (err: any) {
    console.error('[add-installment] error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to add installment' },
      { status: 500 }
    );
  }
}
