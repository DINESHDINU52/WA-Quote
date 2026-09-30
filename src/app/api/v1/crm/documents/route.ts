import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { getDb } from '@/lib/firebase/client';
import { collection, getDocs } from 'firebase/firestore';
import type { BillingDoc } from '@/lib/doc-types';
import { getPaymentSummary } from '@/lib/payment-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/crm/documents
 *
 * Header:
 *   Authorization: Bearer <API_KEY>   or   x-api-key: <API_KEY>
 *
 * Query params:
 *   - docType: 'proforma' | 'invoice' | 'quotation' | 'po' | 'all' (default: 'all')
 *   - paymentStatus: 'paid' | 'unpaid' | 'partial' | 'all'
 *   - status: 'issued' | 'draft' | 'cancelled' | 'all' (default: 'all')
 *   - search: query matching doc number, customer name, company, email or phone
 *   - from: epoch ms or YYYY-MM-DD (start of issueDate)
 *   - to: epoch ms or YYYY-MM-DD (end of issueDate)
 *   - companyId: string (filter by issuing entity)
 *   - limit: number (default: 50, max: 200)
 *   - page: number (default: 1)
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
    const url = new URL(req.url);
    const docTypeParam = (url.searchParams.get('docType') || 'all').toLowerCase();
    const paymentStatusParam = (url.searchParams.get('paymentStatus') || 'all').toLowerCase();
    const statusParam = (url.searchParams.get('status') || 'all').toLowerCase();
    const searchParam = (url.searchParams.get('search') || '').trim().toLowerCase();
    const companyIdParam = url.searchParams.get('companyId');
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

    // Parse date filters
    let fromMs = 0;
    let toMs = Infinity;
    if (fromParam) {
      fromMs = /^\d+$/.test(fromParam) ? parseInt(fromParam, 10) : new Date(fromParam).getTime() || 0;
    }
    if (toParam) {
      toMs = /^\d+$/.test(toParam) ? parseInt(toParam, 10) : new Date(toParam).setHours(23, 59, 59, 999) || Infinity;
    }

    const db = getDb();

    // Determine which collections to read
    const collectionsToQuery: Array<{ name: string; type: string }> = [];
    if (docTypeParam === 'all' || docTypeParam === 'proforma') {
      collectionsToQuery.push({ name: 'proformas', type: 'proforma' });
    }
    if (docTypeParam === 'all' || docTypeParam === 'invoice') {
      collectionsToQuery.push({ name: 'invoices', type: 'invoice' });
    }
    if (docTypeParam === 'all' || docTypeParam === 'quotation') {
      collectionsToQuery.push({ name: 'quotations', type: 'quotation' });
    }
    if (docTypeParam === 'all' || docTypeParam === 'po') {
      collectionsToQuery.push({ name: 'purchaseOrders', type: 'po' });
    }

    const snaps = await Promise.all(
      collectionsToQuery.map((c) => getDocs(collection(db, c.name)))
    );

    let allDocs: Array<BillingDoc & { id: string }> = [];

    snaps.forEach((snap, idx) => {
      const type = collectionsToQuery[idx].type;
      snap.forEach((docSnap) => {
        const doc = { ...(docSnap.data() as BillingDoc), id: docSnap.id, docType: docSnap.data().docType || (type as any) };
        allDocs.push(doc);
      });
    });

    // Filter documents
    let filtered = allDocs.filter((doc) => {
      // Company filter
      if (companyIdParam && doc.companyId !== companyIdParam) return false;

      // Status filter
      if (statusParam !== 'all' && doc.status !== statusParam) return false;

      // Issue date filter
      const issueDate = doc.issueDate || 0;
      if (issueDate < fromMs || issueDate > toMs) return false;

      // Payment status filter (primarily for proformas and invoices)
      const paySummary = doc.docType === 'proforma' ? getPaymentSummary(doc) : null;
      const effectivePaymentStatus = paySummary?.status || doc.paymentStatus || 'unpaid';

      if (paymentStatusParam !== 'all') {
        if (paymentStatusParam === 'paid' && effectivePaymentStatus !== 'paid') return false;
        if (paymentStatusParam === 'unpaid' && effectivePaymentStatus !== 'unpaid') return false;
        if (paymentStatusParam === 'partial' && effectivePaymentStatus !== 'partial') return false;
      }

      // Text search
      if (searchParam) {
        const num = (doc.number || '').toLowerCase();
        const cName = (doc.customer?.name || '').toLowerCase();
        const cComp = (doc.customer?.companyName || '').toLowerCase();
        const cEmail = (doc.customer?.email || '').toLowerCase();
        const cPhone = (doc.customer?.phone || '').toLowerCase();

        const matches =
          num.includes(searchParam) ||
          cName.includes(searchParam) ||
          cComp.includes(searchParam) ||
          cEmail.includes(searchParam) ||
          cPhone.includes(searchParam);

        if (!matches) return false;
      }

      return true;
    });

    // Sort by issueDate descending (newest first)
    filtered.sort((a, b) => (b.issueDate || 0) - (a.issueDate || 0));

    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    // Sum totals of the filtered set
    let totalGrandAmount = 0;
    let totalPaidAmount = 0;
    let totalBalanceAmount = 0;

    filtered.forEach((d) => {
      const gTotal = d.taxSummary?.grandTotal || 0;
      totalGrandAmount += gTotal;
      if (d.docType === 'proforma') {
        const s = getPaymentSummary(d);
        totalPaidAmount += s.totalPaid;
        totalBalanceAmount += s.balance;
      } else {
        totalBalanceAmount += gTotal;
      }
    });

    // Format output
    const documents = paginated.map((doc) => {
      const paySummary = doc.docType === 'proforma' ? getPaymentSummary(doc) : null;
      const paymentStatus = paySummary?.status || doc.paymentStatus || 'unpaid';

      return {
        id: doc.id,
        number: doc.number || 'DRAFT',
        docType: doc.docType,
        status: doc.status,
        paymentStatus,
        issueDate: doc.issueDate,
        issueDateFormatted: doc.issueDate ? new Date(doc.issueDate).toLocaleDateString('en-IN') : '',
        dueDate: doc.dueDate || null,
        dueDateFormatted: doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('en-IN') : null,
        validTill: doc.validTill || null,
        customer: {
          id: doc.customer?.customerId,
          name: doc.customer?.name || '—',
          companyName: doc.customer?.companyName || '',
          email: doc.customer?.email || '',
          phone: doc.customer?.phone || '',
          gstin: doc.customer?.gstin || '',
          state: doc.customer?.address?.state || '',
          city: doc.customer?.address?.city || ''
        },
        company: {
          id: doc.companyId,
          legalName: doc.company?.legalName || '',
          shortName: doc.company?.shortName || '',
          gstin: doc.company?.gstin || ''
        },
        financials: {
          currency: 'INR',
          taxableAmount: doc.taxSummary?.taxableAmount || 0,
          cgstTotal: doc.taxSummary?.cgstTotal || 0,
          sgstTotal: doc.taxSummary?.sgstTotal || 0,
          igstTotal: doc.taxSummary?.igstTotal || 0,
          grandTotal: doc.taxSummary?.grandTotal || 0,
          totalPaid: paySummary?.totalPaid || 0,
          balance: paySummary?.balance ?? (doc.taxSummary?.grandTotal || 0)
        },
        payment: paySummary
          ? {
              status: paySummary.status,
              isPaid: paySummary.isPaid,
              isPartial: paySummary.status === 'partial',
              totalPaid: paySummary.totalPaid,
              balance: paySummary.balance,
              closedAt: (doc.payment?.closedAt as number) || null,
              installmentsCount: paySummary.installmentCount,
              installments: paySummary.installments.map((ins) => ({
                id: ins.id,
                amount: ins.amount,
                paidAt: ins.paidAt,
                paidAtFormatted: new Date(ins.paidAt).toLocaleDateString('en-IN'),
                notes: ins.notes || '',
                paidBy: ins.paidBy || '',
                referenceFilesCount: ins.references?.length || 0
              }))
            }
          : null,
        lineItemsCount: doc.lineItems?.length || 0,
        lineItemsSummary: (doc.lineItems || []).map((item) => ({
          description: item.description,
          hsn: item.hsn,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          total: item.total
        })),
        pdfUrl: doc.pdf?.downloadUrl || doc.pdf?.url || null,
        createdAt: doc.createdAt || null,
        updatedAt: doc.updatedAt || null
      };
    });

    return NextResponse.json({
      ok: true,
      total,
      page,
      limit,
      totalPages,
      filters: {
        docType: docTypeParam,
        paymentStatus: paymentStatusParam,
        status: statusParam,
        search: searchParam || null,
        from: fromParam || null,
        to: toParam || null
      },
      summary: {
        totalBilled: Math.round(totalGrandAmount),
        totalPaid: Math.round(totalPaidAmount),
        totalOutstanding: Math.round(totalBalanceAmount)
      },
      documents
    });
  } catch (err: any) {
    console.error('[crm-documents] Error fetching documents:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to fetch documents for CRM' },
      { status: 500 }
    );
  }
}
