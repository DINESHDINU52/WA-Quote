import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-key-auth';
import { getDb } from '@/lib/firebase/client';
import { collection, doc as firestoreDoc, getDoc, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';
import type { BillingDoc } from '@/lib/doc-types';
import { getPaymentSummary } from '@/lib/payment-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/crm/documents/[id]
 *
 * Header:
 *   Authorization: Bearer <API_KEY>   or   x-api-key: <API_KEY>
 *
 * Returns full details of a specific document (by Firestore doc id or document number).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(req);
  if (!authResult.valid) {
    return NextResponse.json(
      { ok: false, error: authResult.error || 'Unauthorized' },
      { status: authResult.status || 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing document id' }, { status: 400 });
  }

  try {
    const db = getDb();
    const collections = ['proformas', 'invoices', 'quotations', 'purchaseOrders'];

    let foundDoc: (BillingDoc & { id: string }) | null = null;

    // 1. Try direct doc ID lookup across collections
    for (const col of collections) {
      const snap = await getDoc(firestoreDoc(db, col, id));
      if (snap.exists()) {
        foundDoc = { ...(snap.data() as BillingDoc), id: snap.id };
        break;
      }
    }

    // 2. If not found by doc id, try matching document number (e.g. PI-2026-0001)
    if (!foundDoc) {
      for (const col of collections) {
        const q = query(collection(db, col), where('number', '==', id), firestoreLimit(1));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const docSnap = querySnap.docs[0];
          foundDoc = { ...(docSnap.data() as BillingDoc), id: docSnap.id };
          break;
        }
      }
    }

    if (!foundDoc) {
      return NextResponse.json(
        { ok: false, error: `Document not found with ID or number: ${id}` },
        { status: 404 }
      );
    }

    const paySummary = foundDoc.docType === 'proforma' ? getPaymentSummary(foundDoc) : null;
    const paymentStatus = paySummary?.status || foundDoc.paymentStatus || 'unpaid';

    return NextResponse.json({
      ok: true,
      document: {
        id: foundDoc.id,
        number: foundDoc.number || 'DRAFT',
        docType: foundDoc.docType,
        status: foundDoc.status,
        paymentStatus,
        issueDate: foundDoc.issueDate,
        issueDateFormatted: foundDoc.issueDate ? new Date(foundDoc.issueDate).toLocaleDateString('en-IN') : '',
        dueDate: foundDoc.dueDate || null,
        dueDateFormatted: foundDoc.dueDate ? new Date(foundDoc.dueDate).toLocaleDateString('en-IN') : null,
        validTill: foundDoc.validTill || null,
        taxMode: foundDoc.taxMode,
        customer: foundDoc.customer,
        company: foundDoc.company,
        shipping: foundDoc.shipping || null,
        lineItems: foundDoc.lineItems || [],
        taxSummary: foundDoc.taxSummary,
        termsAndConditions: foundDoc.termsAndConditions || '',
        notes: foundDoc.notes || '',
        payment: paySummary
          ? {
              status: paySummary.status,
              isPaid: paySummary.isPaid,
              isPartial: paySummary.status === 'partial',
              totalPaid: paySummary.totalPaid,
              balance: paySummary.balance,
              closedAt: (foundDoc.payment?.closedAt as number) || null,
              installmentsCount: paySummary.installmentCount,
              installments: paySummary.installments
            }
          : null,
        pdf: foundDoc.pdf || null,
        createdAt: foundDoc.createdAt || null,
        updatedAt: foundDoc.updatedAt || null,
        issuedAt: foundDoc.issuedAt || null,
        issuedBy: foundDoc.issuedBy || null
      }
    });
  } catch (err: any) {
    console.error('[crm-document-detail] Error fetching doc:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to fetch document' },
      { status: 500 }
    );
  }
}
