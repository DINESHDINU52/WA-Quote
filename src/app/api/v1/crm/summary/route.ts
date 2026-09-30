import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { getDb } from '@/lib/firebase/client';
import { collection, getDocs } from 'firebase/firestore';
import type { BillingDoc } from '@/lib/doc-types';
import { getPaymentSummary } from '@/lib/payment-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/crm/summary
 *
 * Header:
 *   Authorization: Bearer <API_KEY>   or   x-api-key: <API_KEY>
 *
 * Query params (optional):
 *   companyId: string (filter by issuing company)
 *
 * Returns high-level metrics for CRM dashboards:
 *   - Overall revenue, total paid, total unpaid balance
 *   - Paid, Unpaid, Partial counts and amounts
 *   - Proformas, Invoices, Quotations, and PO breakdowns
 *   - Recent activity list
 */
export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req);
  if (!authResult.valid) {
    return NextResponse.json(
      { ok: false, error: authResult.error || 'Unauthorized' },
      { status: authResult.status || 401 }
    );
  }

  try {
    const db = getDb();
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');

    // Fetch collections in parallel
    const [proformasSnap, invoicesSnap, quotationsSnap, poSnap] = await Promise.all([
      getDocs(collection(db, 'proformas')),
      getDocs(collection(db, 'invoices')),
      getDocs(collection(db, 'quotations')),
      getDocs(collection(db, 'purchaseOrders'))
    ]);

    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    // Proforma metrics
    let piTotalCount = 0;
    let piPaidCount = 0;
    let piPaidAmount = 0;
    let piUnpaidCount = 0;
    let piUnpaidAmount = 0;
    let piPartialCount = 0;
    let piPartialBalance = 0;

    const allDocs: Array<BillingDoc & { id: string }> = [];

    proformasSnap.forEach((doc) => {
      const data = { ...(doc.data() as BillingDoc), id: doc.id };
      if (companyId && data.companyId !== companyId) return;
      piTotalCount++;
      allDocs.push(data);

      const grandTotal = data.taxSummary?.grandTotal || 0;
      if (data.status === 'issued') {
        totalBilled += grandTotal;
        const summary = getPaymentSummary(data);
        totalPaid += summary.totalPaid;
        totalOutstanding += summary.balance;

        if (summary.isPaid) {
          piPaidCount++;
          piPaidAmount += summary.totalPaid;
        } else if (summary.status === 'partial') {
          piPartialCount++;
          piPartialBalance += summary.balance;
        } else {
          piUnpaidCount++;
          piUnpaidAmount += summary.balance;
        }
      }
    });

    // Invoice metrics
    let invTotalCount = 0;
    let invTotalAmount = 0;
    invoicesSnap.forEach((doc) => {
      const data = { ...(doc.data() as BillingDoc), id: doc.id };
      if (companyId && data.companyId !== companyId) return;
      invTotalCount++;
      allDocs.push(data);
      if (data.status === 'issued') {
        invTotalAmount += data.taxSummary?.grandTotal || 0;
      }
    });

    // Quotation metrics
    let qtTotalCount = 0;
    let qtTotalAmount = 0;
    quotationsSnap.forEach((doc) => {
      const data = { ...(doc.data() as BillingDoc), id: doc.id };
      if (companyId && data.companyId !== companyId) return;
      qtTotalCount++;
      allDocs.push(data);
      if (data.status === 'issued') {
        qtTotalAmount += data.taxSummary?.grandTotal || 0;
      }
    });

    // Purchase Order metrics
    let poTotalCount = 0;
    let poTotalAmount = 0;
    poSnap.forEach((doc) => {
      const data = { ...(doc.data() as BillingDoc), id: doc.id };
      if (companyId && data.companyId !== companyId) return;
      poTotalCount++;
      allDocs.push(data);
      if (data.status === 'issued') {
        poTotalAmount += data.taxSummary?.grandTotal || 0;
      }
    });

    // Sort recent activity by update/issue time
    allDocs.sort((a, b) => {
      const tA = (a.updatedAt as number) || (a.issueDate as number) || 0;
      const tB = (b.updatedAt as number) || (b.issueDate as number) || 0;
      return tB - tA;
    });

    const recentActivity = allDocs.slice(0, 10).map((d) => {
      const paySummary = d.docType === 'proforma' ? getPaymentSummary(d) : null;
      return {
        id: d.id,
        number: d.number || 'DRAFT',
        docType: d.docType,
        status: d.status,
        paymentStatus: paySummary?.status || d.paymentStatus || 'unpaid',
        customerName: d.customer?.name || '—',
        companyName: d.customer?.companyName || '',
        grandTotal: d.taxSummary?.grandTotal || 0,
        totalPaid: paySummary?.totalPaid || 0,
        balance: paySummary?.balance ?? (d.taxSummary?.grandTotal || 0),
        issueDate: d.issueDate,
        issueDateFormatted: d.issueDate ? new Date(d.issueDate).toLocaleDateString('en-IN') : '',
        pdfUrl: d.pdf?.downloadUrl || d.pdf?.url || null
      };
    });

    const collectionRatePercent =
      totalBilled > 0 ? Number(((totalPaid / totalBilled) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      apiKeyName: authResult.keyDoc?.name,
      metrics: {
        financials: {
          currency: 'INR',
          totalBilled: Math.round(totalBilled),
          totalPaid: Math.round(totalPaid),
          totalOutstanding: Math.round(totalOutstanding),
          collectionRatePercent
        },
        proformas: {
          total: piTotalCount,
          paid: {
            count: piPaidCount,
            amount: Math.round(piPaidAmount)
          },
          unpaid: {
            count: piUnpaidCount,
            amount: Math.round(piUnpaidAmount)
          },
          partial: {
            count: piPartialCount,
            balanceRemaining: Math.round(piPartialBalance)
          }
        },
        invoices: {
          totalCount: invTotalCount,
          totalAmount: Math.round(invTotalAmount)
        },
        quotations: {
          totalCount: qtTotalCount,
          totalAmount: Math.round(qtTotalAmount)
        },
        purchaseOrders: {
          totalCount: poTotalCount,
          totalAmount: Math.round(poTotalAmount)
        }
      },
      recentActivity
    });
  } catch (err: any) {
    console.error('[crm-summary] Error generating summary:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to generate CRM summary' },
      { status: 500 }
    );
  }
}
