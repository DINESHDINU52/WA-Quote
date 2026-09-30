'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth-context';
import {
  COMPANY_DEFAULTS,
  type CompanySettings
} from '@/lib/company';
import {
  numberingSettingsSchema,
  type LineItemInput,
  type NumberingSettings
} from '@/lib/schemas';
import {
  DOC_CONFIG,
  DEFAULT_QUOTATION_TERMS,
  DEFAULT_INVOICE_TERMS,
  type BillingDoc
} from '@/lib/doc-types';
import { allocateNumber, type DocType } from '@/lib/numbering';
import { addDays, buildDoc } from '@/lib/doc-helpers';
import { cn, formatINR, formatInvoiceDate, fyFromDate } from '@/lib/utils';
import { CustomerPicker, type PickedCustomer } from './customer-picker';
import { CompanyPicker } from '@/components/company-picker';
import { LineItemsGrid } from './line-items-grid';
import { TaxSummaryCard } from './tax-summary-card';
import { PdfPreview } from './pdf-preview';
import { IssueSuccessModal } from '@/components/issue-success-modal';
import { Save, Send, FileText, ArrowLeft, Loader2, AlertCircle, CheckCircle2, MapPin, Link2 } from 'lucide-react';
import Link from 'next/link';

/** Recursively remove keys with `undefined` values — Firestore rejects them. */
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = stripUndefined(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

interface DocumentEditorProps {
  docType: DocType;
  /** Existing Firestore doc id when editing; null/undefined = new draft. */
  existingId?: string;
}

const DEFAULT_NUMBERING: NumberingSettings = {
  prefix: { quotation: 'CHN/QT', proforma: 'CHN/PI', invoice: 'CHN/INV', creditNote: 'CHN/CN', po: 'CHN/PO' },
  pattern: 'per-fy',
  pad: 4
};

function defaultTerms(t: DocType) {
  return t === 'quotation' ? DEFAULT_QUOTATION_TERMS : DEFAULT_INVOICE_TERMS;
}

function normalizeCompanySettings(raw?: any): CompanySettings {
  if (!raw) return COMPANY_DEFAULTS;
  const sc =
    raw.stateCode ||
    raw.address?.stateCode ||
    (raw.gstin && /^\d{2}/.test(raw.gstin.trim()) ? raw.gstin.trim().slice(0, 2) : '33');
  const sn = raw.state || raw.address?.state || 'Tamil Nadu';
  const cn = raw.country || raw.address?.country || 'India';
  return {
    ...COMPANY_DEFAULTS,
    ...raw,
    stateCode: sc,
    state: sn,
    country: cn,
    address: {
      ...COMPANY_DEFAULTS.address,
      ...(raw.address || {}),
      stateCode: raw.address?.stateCode || sc,
      state: raw.address?.state || sn,
      country: raw.address?.country || cn
    }
  };
}

function normalizeCustomerAddress(addr: any, gstin?: string) {
  let sc = (addr?.stateCode || '').trim();
  if (!sc && gstin && /^\d{2}/.test(gstin.trim())) {
    sc = gstin.trim().slice(0, 2);
  }
  let sn = (addr?.state || '').trim();
  if (!sc && (sn.toLowerCase().includes('tamil nadu') || sn.toLowerCase().includes('tamilnadu'))) {
    sc = '33';
  }
  if (!sc) sc = '33';
  if (!sn) sn = 'Tamil Nadu';
  return {
    line1: addr?.line1 || '',
    line2: addr?.line2 || '',
    city: addr?.city || '',
    state: sn,
    stateCode: sc,
    pincode: addr?.pincode || '',
    country: addr?.country || 'India'
  };
}

export function DocumentEditor(props: DocumentEditorProps) {
  return (
    <Suspense fallback={<div className="p-6 text-ink-500">Loading editor...</div>}>
      <DocumentEditorInner {...props} />
    </Suspense>
  );
}

function DocumentEditorInner({ docType, existingId }: DocumentEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourcePiId = searchParams?.get('sourcePiId');
  const sourceQuoteId = searchParams?.get('sourceQuoteId');

  const { profile } = useAuth();
  const cfg = DOC_CONFIG[docType];

  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(COMPANY_DEFAULTS);
  const [numberingSettings, setNumberingSettings] =
    useState<NumberingSettings>(DEFAULT_NUMBERING);
  const [loadedSettings, setLoadedSettings] = useState(false);

  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [lines, setLines] = useState<LineItemInput[]>([]);
  const today = useMemo(() => new Date(), []);
  const [issueDate, setIssueDate] = useState<Date>(today);
  const [validityDays, setValidityDays] = useState(7);
  const [dueDays, setDueDays] = useState(7);
  const [terms, setTerms] = useState(defaultTerms(docType));
  const [notes, setNotes] = useState('');
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState<BillingDoc['status']>('draft');
  const [savedId, setSavedId] = useState<string | null>(existingId ?? null);

  // Cross-linking state
  const [linkedPiId, setLinkedPiId] = useState<string | undefined>(undefined);
  const [linkedPiNumber, setLinkedPiNumber] = useState<string | undefined>(undefined);
  const [linkedPoId, setLinkedPoId] = useState<string | undefined>(undefined);
  const [linkedPoNumber, setLinkedPoNumber] = useState<string | undefined>(undefined);

  // Shipping address (PI or PO)
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [shipContactPerson, setShipContactPerson] = useState('');
  const [shipPhone, setShipPhone] = useState('');
  const [shipLine1, setShipLine1] = useState('');
  const [shipLine2, setShipLine2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('Tamil Nadu');
  const [shipPincode, setShipPincode] = useState('');

  const [savingDraft, setSavingDraft] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [issueModal, setIssueModal] = useState<{
    docNumber: string;
    customerName: string;
    grandTotal: number;
    driveUrl?: string | null;
    emailSent?: boolean;
    emailTo?: string | null;
  } | null>(null);

  // Load settings (company + numbering + templates) once.
  useEffect(() => {
    (async () => {
      try {
        const [cSnap, nSnap, tSnap] = await Promise.all([
          getDoc(doc(getDb(), 'settings', 'company')),
          getDoc(doc(getDb(), 'settings', 'numbering')),
          getDoc(doc(getDb(), 'settings', 'templates'))
        ]);
        if (cSnap.exists()) {
          setCompanySettings(normalizeCompanySettings(cSnap.data()));
        }
        if (nSnap.exists()) {
          const parsed = numberingSettingsSchema.safeParse(nSnap.data());
          if (parsed.success) setNumberingSettings(parsed.data);
        }
        // Load saved quotation terms template
        if (tSnap.exists() && tSnap.data().quotationTerms && docType === 'quotation') {
          setTerms(tSnap.data().quotationTerms);
        }
      } finally {
        setLoadedSettings(true);
      }
    })();
  }, [docType]);

  // Handle source document pre-filling (PI -> PO or Quote -> PI/PO)
  useEffect(() => {
    if (existingId) return;

    if (sourcePiId) {
      (async () => {
        try {
          const snap = await getDoc(doc(getDb(), 'proformas', sourcePiId));
          if (snap.exists()) {
            const data = snap.data() as BillingDoc;
            setLinkedPiId(snap.id);
            setLinkedPiNumber(data.number || '');
            if (data.companyId) setCompanyId(data.companyId);
            if (data.company) setCompanySettings(normalizeCompanySettings(data.company));
            setCustomer({
              id: data.customer.customerId || 'snapshot',
              name: data.customer.name,
              companyName: data.customer.companyName || '',
              gstin: data.customer.gstin || '',
              pan: data.customer.pan || '',
              email: data.customer.email || '',
              phone: data.customer.phone || '',
              billingAddress: normalizeCustomerAddress(data.customer.address, data.customer.gstin),
              shippingSameAsBilling: data.shipping?.sameAsBilling ?? true,
              openingBalance: 0,
              notes: ''
            });
            if (data.lineItems) setLines(data.lineItems);
            if (data.termsAndConditions) setTerms(data.termsAndConditions);
            if (data.notes) setNotes(data.notes);
            if (data.shipping) {
              setShippingSameAsBilling(data.shipping.sameAsBilling);
              if (data.shipping.contactPerson) setShipContactPerson(data.shipping.contactPerson);
              if (data.shipping.phone) setShipPhone(data.shipping.phone);
              if (data.shipping.address) {
                setShipLine1(data.shipping.address.line1 || '');
                setShipLine2(data.shipping.address.line2 || '');
                setShipCity(data.shipping.address.city || '');
                setShipState(data.shipping.address.state || 'Tamil Nadu');
                setShipPincode(data.shipping.address.pincode || '');
              }
            }
            setToast({
              kind: 'ok',
              msg: `Pre-filled details from Proforma Invoice ${data.number || 'Draft'}`
            });
          }
        } catch (e: any) {
          console.error('Failed to pre-fill from PI:', e);
        }
      })();
    } else if (sourceQuoteId) {
      (async () => {
        try {
          const snap = await getDoc(doc(getDb(), 'quotations', sourceQuoteId));
          if (snap.exists()) {
            const data = snap.data() as BillingDoc;
            if (data.companyId) setCompanyId(data.companyId);
            if (data.company) setCompanySettings(normalizeCompanySettings(data.company));
            setCustomer({
              id: data.customer.customerId || 'snapshot',
              name: data.customer.name,
              companyName: data.customer.companyName || '',
              gstin: data.customer.gstin || '',
              pan: data.customer.pan || '',
              email: data.customer.email || '',
              phone: data.customer.phone || '',
              billingAddress: normalizeCustomerAddress(data.customer.address, data.customer.gstin),
              shippingSameAsBilling: true,
              openingBalance: 0,
              notes: ''
            });
            if (data.lineItems) setLines(data.lineItems);
            if (data.notes) setNotes(data.notes);
            setToast({
              kind: 'ok',
              msg: `Pre-filled details from Quotation ${data.number || 'Draft'}`
            });
          }
        } catch (e: any) {
          console.error('Failed to pre-fill from Quotation:', e);
        }
      })();
    }
  }, [existingId, sourcePiId, sourceQuoteId]);

  // Load existing doc when editing.
  useEffect(() => {
    if (!existingId) return;
    (async () => {
      const ref = doc(getDb(), cfg.collection, existingId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setToast({ kind: 'err', msg: 'Document not found.' });
        return;
      }
      const data = snap.data() as BillingDoc;
      const isDraft = data.status === 'draft';
      // Drafts should have an empty number state so allocateNumber runs when issued
      setNumber(isDraft || data.number === 'DRAFT' ? '' : (data.number || ''));
      setStatus(data.status);
      setIssueDate(new Date(data.issueDate));
      if (data.validTill) setValidityDays(Math.max(1, Math.round((data.validTill - data.issueDate) / 86400000)));
      if (data.dueDate) setDueDays(Math.max(1, Math.round((data.dueDate - data.issueDate) / 86400000)));
      setTerms(data.termsAndConditions || defaultTerms(docType));
      setNotes(data.notes || '');
      setLines(data.lineItems);
      if (data.companyId) setCompanyId(data.companyId);
      if (data.company) setCompanySettings(normalizeCompanySettings(data.company));
      if (data.linkedPiId) setLinkedPiId(data.linkedPiId);
      if (data.linkedPiNumber) setLinkedPiNumber(data.linkedPiNumber);
      if (data.linkedPoId) setLinkedPoId(data.linkedPoId);
      if (data.linkedPoNumber) setLinkedPoNumber(data.linkedPoNumber);
      setCustomer({
        id: data.customer.customerId || 'snapshot',
        name: data.customer.name,
        companyName: data.customer.companyName || '',
        gstin: data.customer.gstin || '',
        pan: data.customer.pan || '',
        email: data.customer.email || '',
        phone: data.customer.phone || '',
        billingAddress: normalizeCustomerAddress(data.customer.address, data.customer.gstin),
        shippingAddress: undefined,
        shippingSameAsBilling: true,
        openingBalance: 0,
        notes: ''
      });
      if (data.shipping) {
        setShippingSameAsBilling(data.shipping.sameAsBilling);
        if (data.shipping.contactPerson) setShipContactPerson(data.shipping.contactPerson);
        if (data.shipping.phone) setShipPhone(data.shipping.phone);
        if (data.shipping.address) {
          setShipLine1(data.shipping.address.line1 || '');
          setShipLine2(data.shipping.address.line2 || '');
          setShipCity(data.shipping.address.city || '');
          setShipState(data.shipping.address.state || 'Tamil Nadu');
          setShipPincode(data.shipping.address.pincode || '');
        }
      }
      setSavedId(snap.id);
    })();
  }, [existingId, cfg.collection, docType]);

  // Live BillingDoc payload for preview + save.
  const previewDoc: BillingDoc | null = useMemo(() => {
    if (!customer || !loadedSettings) return null;
    return buildDoc({
      docType,
      number: status === 'draft' ? '' : (number === 'DRAFT' ? '' : number),
      fy: fyFromDate(issueDate),
      status,
      issueDate: issueDate.getTime(),
      dueDate: cfg.showDueDate ? addDays(issueDate, dueDays).getTime() : undefined,
      validTill: cfg.showValidTill ? addDays(issueDate, validityDays).getTime() : undefined,
      company: companySettings,
      companyId: companyId,
      customer: {
        customerId: customer.id,
        name: customer.name,
        companyName: customer.companyName || '',
        gstin: customer.gstin || '',
        pan: customer.pan || '',
        email: customer.email || '',
        phone: customer.phone || '',
        billingAddress: customer.billingAddress
      },
      rawLines: lines,
      termsAndConditions: terms,
      notes,
      roundOff: true,
      preparedBy: profile?.displayName || profile?.email || '',
      linkedPiId,
      linkedPiNumber,
      linkedPoId,
      linkedPoNumber,
      sourcePiId: linkedPiId,
      sourcePoId: linkedPoId,
      shipping: docType === 'proforma' || docType === 'po' ? {
        sameAsBilling: shippingSameAsBilling,
        ...(!shippingSameAsBilling ? {
          contactPerson: shipContactPerson,
          phone: shipPhone,
          address: {
            line1: shipLine1,
            line2: shipLine2,
            city: shipCity,
            state: shipState,
            pincode: shipPincode,
            country: 'India'
          }
        } : {})
      } : undefined
    });
  }, [
    customer,
    loadedSettings,
    docType,
    number,
    status,
    issueDate,
    cfg.showDueDate,
    cfg.showValidTill,
    dueDays,
    validityDays,
    companySettings,
    companyId,
    lines,
    terms,
    notes,
    profile,
    linkedPiId,
    linkedPiNumber,
    linkedPoId,
    linkedPoNumber,
    shippingSameAsBilling,
    shipContactPerson,
    shipPhone,
    shipLine1,
    shipLine2,
    shipCity,
    shipState,
    shipPincode
  ]);

  // Helper to sync cross-links on target docs
  async function syncCrossLinks(docId: string, currentNumber: string) {
    if (docType === 'po' && linkedPiId) {
      try {
        await updateDoc(doc(getDb(), 'proformas', linkedPiId), {
          linkedPoId: docId,
          linkedPoNumber: currentNumber,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error('Failed to sync PO link to PI:', e);
      }
    } else if (docType === 'proforma' && linkedPoId) {
      try {
        await updateDoc(doc(getDb(), 'purchaseOrders', linkedPoId), {
          linkedPiId: docId,
          linkedPiNumber: currentNumber,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error('Failed to sync PI link to PO:', e);
      }
    }
  }

  async function saveDraft() {
    if (!previewDoc) return;
    setSavingDraft(true);
    setToast(null);
    try {
      const id = savedId ?? doc(collection(getDb(), cfg.collection)).id;
      await setDoc(
        doc(getDb(), cfg.collection, id),
        stripUndefined({
          ...previewDoc,
          number: '',
          status: 'draft',
          updatedAt: serverTimestamp(),
          ...(savedId
            ? {}
            : {
                createdAt: serverTimestamp(),
                createdBy: profile?.uid ?? 'system'
              })
        }),
        { merge: true }
      );
      await syncCrossLinks(id, 'DRAFT');
      setSavedId(id);
      setToast({ kind: 'ok', msg: 'Draft saved.' });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.message ?? 'Save failed' });
    } finally {
      setSavingDraft(false);
    }
  }

  async function issueDocument() {
    if (!previewDoc) return;
    if (lines.length === 0) {
      setToast({ kind: 'err', msg: 'Add at least one line item before issuing.' });
      return;
    }
    setIssuing(true);
    setToast(null);
    try {
      // 1. Allocate number (only if not already allocated, or if currently a draft).
      let allocatedNumber = number;
      let fy = previewDoc.fy;
      if (!allocatedNumber || allocatedNumber === 'DRAFT' || status === 'draft') {
        const allocation = await allocateNumber({
          docType,
          date: issueDate,
          settings: numberingSettings,
          issuedBy: profile?.uid ?? 'system'
        });
        allocatedNumber = allocation.number;
        fy = allocation.fy;
        setNumber(allocation.number);
      }

      // 2. Build the issue-time payload with the real number.
      const issuedDoc: BillingDoc = {
        ...previewDoc,
        number: allocatedNumber,
        fy,
        status: 'issued',
        preparedBy: profile?.displayName || profile?.email || 'System'
      };

      // 3. Render PDF + Drive upload via API.
      const res = await fetch('/api/docs/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc: issuedDoc })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || 'Issue failed');
      }

      // 4. Persist the issued doc in Firestore.
      const id = savedId ?? doc(collection(getDb(), cfg.collection)).id;
      await setDoc(
        doc(getDb(), cfg.collection, id),
        stripUndefined({
          ...issuedDoc,
          number: allocatedNumber,
          status: 'issued',
          updatedAt: serverTimestamp(),
          issuedAt: serverTimestamp(),
          issuedBy: profile?.uid ?? 'system',
          preparedBy: profile?.displayName || profile?.email || 'System',
          ...(savedId
            ? {}
            : {
                createdAt: serverTimestamp(),
                createdBy: profile?.uid ?? 'system'
              }),
          pdf: {
            driveFileId: json.drive?.fileId || null,
            url: json.drive?.url || null,
            downloadUrl: json.drive?.downloadUrl || null,
            generatedAt: Date.now(),
            version: 1,
            fileName: json.filename
          }
        }),
        { merge: true }
      );

      await syncCrossLinks(id, allocatedNumber);

      setSavedId(id);
      setStatus('issued');
      setIssueModal({
        docNumber: allocatedNumber,
        customerName: previewDoc.customer.name,
        grandTotal: previewDoc.taxSummary.grandTotal,
        driveUrl: json.drive?.url || null,
        emailSent: json.drive?.emailSent || false,
        emailTo: json.drive?.emailTo || null
      });

      // Auto-download the PDF for the user.
      const blob = b64ToBlob(json.pdfBase64, 'application/pdf');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = json.filename;
      a.click();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.message ?? 'Issue failed' });
    } finally {
      setIssuing(false);
    }
  }

  if (!loadedSettings) {
    return <div className="text-ink-400">Loading settings...</div>;
  }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/${cfg.collection}`} className="mt-1 text-ink-400 hover:text-ink-700">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-ink-900">
              {savedId ? `Edit ${cfg.label}` : `New ${cfg.label}`}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {status === 'draft'
                ? 'Draft — number will be allocated on issue.'
                : `${number || 'No number'} · ${status}`}
            </p>

            {(linkedPiNumber || linkedPoNumber) && (
              <div className="mt-2 flex items-center gap-2">
                {linkedPiNumber && (
                  <Link
                    href={`/proformas/${linkedPiId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Linked PI: {linkedPiNumber}
                  </Link>
                )}
                {linkedPoNumber && (
                  <Link
                    href={`/purchase-orders/${linkedPoId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Linked PO: {linkedPoNumber}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveDraft}
            disabled={savingDraft || !customer}
            className="btn-secondary"
          >
            {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button
            onClick={issueDocument}
            disabled={issuing || !customer || lines.length === 0}
            className="btn-primary"
          >
            {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Issue & Backup
          </button>
        </div>
      </header>

      {toast && (
        <div
          className={
            toast.kind === 'ok'
              ? 'mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
              : 'mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
          }
        >
          {toast.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="space-y-6">
        {/* Top row: header form + live tax summary side by side */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <section className="card p-5 space-y-4">
            <CompanyPicker
              selectedCompanyId={companyId}
              selectedCompany={companySettings}
              onSelectCompany={(comp, compId) => {
                const norm = normalizeCompanySettings(comp);
                setCompanySettings(norm);
                if (compId) setCompanyId(compId);

                // Auto-switch Terms & Conditions to the chosen company's custom terms
                if (docType === 'quotation' && comp.quotationTerms?.trim()) {
                  setTerms(comp.quotationTerms);
                } else if (docType === 'po' && comp.poTerms?.trim()) {
                  setTerms(comp.poTerms);
                } else if ((docType === 'invoice' || docType === 'proforma') && comp.invoiceTerms?.trim()) {
                  setTerms(comp.invoiceTerms);
                }
              }}
            />

            <div>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-500">
                Customer & Dates
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Customer</label>
                  <CustomerPicker value={customer} onChange={setCustomer} />
                </div>
                <div>
                  <label className="label">Issue date</label>
                  <input
                    type="date"
                    className="input"
                    value={issueDate.toISOString().slice(0, 10)}
                    onChange={(e) => setIssueDate(new Date(e.target.value))}
                  />
                </div>
                {cfg.showValidTill && (
                  <div>
                    <label className="label">Valid for (days)</label>
                    <input
                      type="number"
                      min={1}
                      className="input num"
                      value={validityDays}
                      onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                )}
                {cfg.showDueDate && (
                  <div>
                    <label className="label">Due in (days)</label>
                    <input
                      type="number"
                      min={1}
                      className="input num"
                      value={dueDays}
                      onChange={(e) => setDueDays(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside>
            {previewDoc ? (
              <TaxSummaryCard summary={previewDoc.taxSummary} taxMode={previewDoc.taxMode} />
            ) : (
              <div className="card grid h-full place-items-center py-10 text-center text-sm text-ink-400">
                <FileText className="mb-2 h-6 w-6" />
                Select a customer
              </div>
            )}
          </aside>
        </div>

        {/* Shipping Address — PI or PO */}
        {(docType === 'proforma' || docType === 'po') && (
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-ink-500 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                Shipping Address
              </h2>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shippingSameAsBilling}
                  onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-ink-700">Same as billing address</span>
              </label>
            </div>
            {!shippingSameAsBilling && (
              <div className="grid grid-cols-2 gap-4 animate-in">
                <div>
                  <label className="label">Contact Person</label>
                  <input
                    className="input"
                    value={shipContactPerson}
                    onChange={(e) => setShipContactPerson(e.target.value)}
                    placeholder="Receiver name"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    className="input num"
                    value={shipPhone}
                    onChange={(e) => setShipPhone(e.target.value)}
                    placeholder="+91 98xxx xxxxx"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Address Line 1</label>
                  <input
                    className="input"
                    value={shipLine1}
                    onChange={(e) => setShipLine1(e.target.value)}
                    placeholder="Street / Building / Door No."
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Address Line 2</label>
                  <input
                    className="input"
                    value={shipLine2}
                    onChange={(e) => setShipLine2(e.target.value)}
                    placeholder="Area / Landmark (optional)"
                  />
                </div>
                <div>
                  <label className="label">City</label>
                  <input
                    className="input"
                    value={shipCity}
                    onChange={(e) => setShipCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">State</label>
                  <input
                    className="input"
                    value={shipState}
                    onChange={(e) => setShipState(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input
                    className="input num"
                    value={shipPincode}
                    onChange={(e) => setShipPincode(e.target.value)}
                  />
                </div>
              </div>
            )}
            {shippingSameAsBilling && customer && (
              <p className="text-sm text-ink-500 italic">
                Shipping to: {customer.billingAddress.line1}, {customer.billingAddress.city}, {customer.billingAddress.state} {customer.billingAddress.pincode}
              </p>
            )}
          </section>
        )}

        {/* Line items — full width */}
        <LineItemsGrid
          lines={lines}
          onChange={setLines}
          taxMode={previewDoc?.taxMode ?? 'intra'}
        />

        {/* T&C and Notes side by side (hidden for Proforma) */}
        {docType !== 'proforma' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
              Terms & conditions
            </h2>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={Math.max(6, terms.split('\n').length + 1)}
              className="input font-mono text-xs leading-relaxed"
            />
            <button
              type="button"
              onClick={() => {
                if (docType === 'quotation' && companySettings.quotationTerms?.trim()) {
                  setTerms(companySettings.quotationTerms);
                } else if (docType === 'po' && companySettings.poTerms?.trim()) {
                  setTerms(companySettings.poTerms);
                } else if (companySettings.invoiceTerms?.trim()) {
                  setTerms(companySettings.invoiceTerms);
                } else {
                  setTerms(defaultTerms(docType));
                }
              }}
              className="mt-2 text-[11px] text-brand-700 hover:underline"
            >
              Reset to company default for {cfg.label}
            </button>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
              Internal notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="input"
              placeholder="Optional. Printed under terms section on the PDF."
            />
          </section>
        </div>
        )}

        {/* Live preview — full width */}
        {previewDoc && <PdfPreview doc={previewDoc} />}
      </div>

      {/* Issue success modal */}
      <IssueSuccessModal
        open={!!issueModal}
        onClose={() => setIssueModal(null)}
        docType={docType === 'proforma' ? 'proforma' : docType === 'po' ? 'po' as any : 'quotation'}
        docNumber={issueModal?.docNumber || ''}
        customerName={issueModal?.customerName || ''}
        grandTotal={issueModal?.grandTotal || 0}
        driveUrl={issueModal?.driveUrl}
        emailSent={issueModal?.emailSent}
        emailTo={issueModal?.emailTo}
        docId={savedId ?? undefined}
      />
    </div>
  );
}

function b64ToBlob(b64: string, type: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}
