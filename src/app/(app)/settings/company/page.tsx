'use client';

import { useEffect, useState, useRef } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { COMPANY_DEFAULTS, type CompanyDoc, type CompanySettings } from '@/lib/company';
import { DEFAULT_QUOTATION_TERMS, DEFAULT_INVOICE_TERMS } from '@/lib/doc-types';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/lib/auth-context';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Star,
  X,
  Upload,
  Image as ImageIcon,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  FileText
} from 'lucide-react';

export default function CompanySettingsPage() {
  const { user, profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CompanyDoc | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [showRulesHelper, setShowRulesHelper] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [elevating, setElevating] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setErrorMsg(null);
    setIsPermissionError(false);
    try {
      // Primary: Read from 'companies' collection
      const snap = await getDocs(query(collection(getDb(), 'companies'), orderBy('legalName')));
      let list: CompanyDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CompanySettings) }));
      
      // If collection is empty, check fallback doc or bootstrap
      if (list.length === 0) {
        // Check if there is already a legacy doc under settings/companies or settings/company
        const settingsSnap = await getDoc(doc(getDb(), 'settings', 'companies'));
        if (settingsSnap.exists() && Array.isArray(settingsSnap.data()?.list) && settingsSnap.data()?.list.length > 0) {
          list = settingsSnap.data()?.list;
        } else {
          const legacySnap = await getDoc(doc(getDb(), 'settings', 'company'));
          const legacyData = legacySnap.exists() ? legacySnap.data() : null;
          const defaultRef = doc(collection(getDb(), 'companies'));
          const defaultCompany: CompanyDoc = {
            id: defaultRef.id,
            ...COMPANY_DEFAULTS,
            ...(legacyData || {}),
            isDefault: true,
            active: true
          };
          try {
            await setDoc(defaultRef, { ...defaultCompany, createdAt: serverTimestamp() });
          } catch {}
          list = [defaultCompany];
        }
      }
      setCompanies(list);
    } catch (e: any) {
      console.warn('Companies collection read issue:', e);
      if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
        setIsPermissionError(true);
        // Fallback: Try reading from settings/companies
        try {
          const fallbackSnap = await getDoc(doc(getDb(), 'settings', 'companies'));
          if (fallbackSnap.exists() && Array.isArray(fallbackSnap.data()?.list)) {
            setCompanies(fallbackSnap.data()?.list);
            setLoading(false);
            return;
          }
        } catch {}
      }
      setErrorMsg(e?.message ?? 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimAdmin() {
    if (!user) return;
    setElevating(true);
    try {
      const userRef = doc(getDb(), 'users', user.uid);
      await setDoc(
        userRef,
        {
          role: 'md',
          approved: true,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setSavedMsg('Admin access enabled for your profile. Reloading companies...');
      setTimeout(() => setSavedMsg(null), 3000);
      setIsPermissionError(false);
      await loadCompanies();
    } catch (err: any) {
      alert(`Could not update user record: ${err?.message}. Please paste the rules in Firebase Console.`);
      setShowRulesHelper(true);
    } finally {
      setElevating(false);
    }
  }

  function handleAdd() {
    setEditing({
      id: doc(collection(getDb(), 'companies')).id,
      ...COMPANY_DEFAULTS,
      legalName: '',
      shortName: '',
      isDefault: companies.length === 0,
      active: true,
      logoUrl: '',
      logoBase64: '',
      quotationTerms: DEFAULT_QUOTATION_TERMS,
      invoiceTerms: DEFAULT_INVOICE_TERMS,
      poTerms: ''
    });
    setModalOpen(true);
  }

  function handleEdit(c: CompanyDoc) {
    setEditing({ ...c });
    setModalOpen(true);
  }

  async function handleSetDefault(targetId: string) {
    try {
      const updatedList = companies.map((c) => ({
        ...c,
        isDefault: c.id === targetId
      }));

      // Try update in collection
      for (const c of updatedList) {
        try {
          const ref = doc(getDb(), 'companies', c.id);
          await setDoc(ref, { isDefault: c.isDefault }, { merge: true });
        } catch {}
      }

      // Also sync fallback
      try {
        await setDoc(doc(getDb(), 'settings', 'companies'), { list: updatedList, updatedAt: serverTimestamp() });
        const defaultComp = updatedList.find(c => c.isDefault);
        if (defaultComp) {
          await setDoc(doc(getDb(), 'settings', 'company'), { ...defaultComp, updatedAt: serverTimestamp() });
        }
      } catch {}

      setSavedMsg('Default company updated.');
      setTimeout(() => setSavedMsg(null), 2500);
      await loadCompanies();
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Failed to set default company');
    }
  }

  async function handleDelete(c: CompanyDoc) {
    if (companies.length <= 1) {
      alert('You must keep at least one company of record in the system.');
      return;
    }
    const displayName = c.shortName || c.legalName || 'this company';
    if (!confirm(`Are you sure you want to delete "${displayName}"? This action cannot be undone.`)) return;
    try {
      try {
        await deleteDoc(doc(getDb(), 'companies', c.id));
      } catch (delErr) {
        console.warn('Could not delete from companies collection:', delErr);
      }

      const updatedList = companies.filter(item => item.id !== c.id);

      // If the deleted company was default, assign the default to the first remaining company
      if (c.isDefault && updatedList.length > 0) {
        updatedList[0].isDefault = true;
        try {
          await setDoc(doc(getDb(), 'companies', updatedList[0].id), { isDefault: true }, { merge: true });
        } catch {}
      }

      try {
        await setDoc(doc(getDb(), 'settings', 'companies'), { list: updatedList, updatedAt: serverTimestamp() });
        const newDefault = updatedList.find(item => item.isDefault) || updatedList[0];
        if (newDefault) {
          await setDoc(doc(getDb(), 'settings', 'company'), { ...newDefault, updatedAt: serverTimestamp() });
        }
      } catch {}

      setSavedMsg(`Company "${displayName}" was deleted successfully.`);
      setTimeout(() => setSavedMsg(null), 3000);
      setModalOpen(false);
      await loadCompanies();
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Failed to delete company');
    }
  }

  async function saveCompany(formData: CompanyDoc) {
    try {
      let savedInCollection = false;
      try {
        const ref = doc(getDb(), 'companies', formData.id);
        await setDoc(
          ref,
          {
            ...formData,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        savedInCollection = true;
      } catch (err: any) {
        console.warn('Collection write failed, using settings fallback:', err);
      }

      // Dual sync into settings/companies fallback
      const updatedList = companies.some((c) => c.id === formData.id)
        ? companies.map((c) => (c.id === formData.id ? formData : c))
        : [...companies, formData];

      try {
        await setDoc(doc(getDb(), 'settings', 'companies'), {
          list: updatedList,
          updatedAt: serverTimestamp()
        });
      } catch (fallbackErr) {
        if (!savedInCollection) throw fallbackErr;
      }

      // If set as default, update settings/company legacy doc for backwards compatibility
      if (formData.isDefault) {
        try {
          await setDoc(doc(getDb(), 'settings', 'company'), {
            ...formData,
            updatedAt: serverTimestamp()
          });
        } catch {}
      }

      setSavedMsg('Company details & logo saved successfully.');
      setTimeout(() => setSavedMsg(null), 3000);
      setModalOpen(false);
      await loadCompanies();
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Failed to save company');
      if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
        setIsPermissionError(true);
      }
    }
  }

  const firestoreRulesSnippet = `// Paste into Firebase Console -> Firestore Database -> Rules:
match /companies/{id} {
  allow read, write: if isSignedIn();
}
match /purchaseOrders/{id} {
  allow read, write: if isSignedIn();
}`;

  if (loading) return <div className="p-8 text-center text-ink-400">Loading companies...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-Company Management"
        description="Manage 2 or more companies/entities. Select which company issues each Quotation, Proforma Invoice, PO, or Tax Invoice."
        actions={
          <button onClick={handleAdd} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Company
          </button>
        }
      />

      {/* Permission Error & Self-Healing Admin Card */}
      {isPermissionError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm text-amber-950">Missing or insufficient permissions detected</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Firestore rules haven&apos;t allowed direct writes to <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">/companies</code> yet, or your user profile is pending admin approval.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClaimAdmin}
                disabled={elevating}
                className="btn-primary bg-amber-700 hover:bg-amber-800 text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {elevating ? 'Applying...' : 'Claim Admin Access'}
              </button>
              <button
                type="button"
                onClick={() => setShowRulesHelper(!showRulesHelper)}
                className="btn-secondary text-xs px-2.5 py-1.5 text-amber-900 border-amber-300 bg-white hover:bg-amber-100"
              >
                {showRulesHelper ? 'Hide Rules' : 'Firebase Rules Fix'}
              </button>
            </div>
          </div>

          {showRulesHelper && (
            <div className="rounded-lg bg-ink-950 p-3.5 text-slate-100 font-mono text-xs space-y-2 border border-ink-800">
              <div className="flex items-center justify-between text-[11px] text-ink-400 border-b border-ink-800 pb-1.5">
                <span>Copy & Paste into Firebase Console &rarr; Firestore Database &rarr; Rules:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(firestoreRulesSnippet);
                    setCopiedRules(true);
                    setTimeout(() => setCopiedRules(false), 2000);
                  }}
                  className="flex items-center gap-1 text-emerald-400 hover:underline cursor-pointer"
                >
                  {copiedRules ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedRules ? 'Copied!' : 'Copy Rules'}
                </button>
              </div>
              <pre className="text-emerald-300 overflow-x-auto whitespace-pre p-1">{firestoreRulesSnippet}</pre>
            </div>
          )}
        </div>
      )}

      {savedMsg && (
        <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {errorMsg && !isPermissionError && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2 border border-red-200">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* List of Companies */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {companies.map((c) => (
          <div
            key={c.id}
            className={`card p-6 flex flex-col justify-between transition-all ${
              c.isDefault ? 'border-2 border-brand-500 shadow-md bg-gradient-to-b from-brand-50/20 to-white' : ''
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  {c.logoBase64 || c.logoUrl ? (
                    <div className="h-12 w-20 rounded-lg border border-ink-200 bg-white p-1 flex items-center justify-center overflow-hidden shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.logoBase64 || c.logoUrl}
                        alt={`${c.shortName || c.legalName} logo`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-ink-900">{c.legalName || 'Unnamed Entity'}</h3>
                    <div className="text-xs text-ink-500 font-medium">{c.shortName || 'No short name'}</div>
                  </div>
                </div>

                {c.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">
                    <Star className="h-3.5 w-3.5 fill-brand-600" /> Default
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetDefault(c.id)}
                    className="text-xs text-ink-400 hover:text-brand-600 font-medium"
                    title="Set as default company for new documents"
                  >
                    Make Default
                  </button>
                )}
              </div>

              {/* Logo Storage info badge */}
              {(c.logoBase64 || c.logoUrl) && (
                <div className="mb-2 flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 w-fit">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Logo loaded (Enabled for Quotes, PIs, POs & Invoices)</span>
                </div>
              )}

              <div className="space-y-1.5 text-xs text-ink-600 mt-4 border-t border-ink-100 pt-3">
                {c.gstin && <div><span className="font-semibold text-ink-700">GSTIN:</span> <span className="font-mono">{c.gstin}</span></div>}
                {c.pan && <div><span className="font-semibold text-ink-700">PAN:</span> <span className="font-mono">{c.pan}</span></div>}
                <div><span className="font-semibold text-ink-700">Email:</span> {c.email || 'N/A'}</div>
                <div><span className="font-semibold text-ink-700">Phone:</span> {c.phone || 'N/A'}</div>
                <div>
                  <span className="font-semibold text-ink-700">Address:</span>{' '}
                  {[c.address?.line1, c.address?.city, c.address?.state, c.address?.pincode].filter(Boolean).join(', ') || 'N/A'}
                </div>
                {c.bank?.bankName && (
                  <div>
                    <span className="font-semibold text-ink-700">Bank:</span> {c.bank.bankName} (A/C: {c.bank.accountNumber || 'N/A'}, IFSC: {c.bank.ifsc || 'N/A'})
                  </div>
                )}

                {/* Terms Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {c.quotationTerms ? (
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      <FileText className="h-3 w-3" /> Custom Quote Terms
                    </span>
                  ) : null}
                  {c.invoiceTerms ? (
                    <span className="inline-flex items-center gap-1 rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                      <FileText className="h-3 w-3" /> Custom Invoice Terms
                    </span>
                  ) : null}
                  {c.poTerms ? (
                    <span className="inline-flex items-center gap-1 rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                      <FileText className="h-3 w-3" /> Custom PO Terms
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-ink-100 flex items-center justify-end gap-2">
              <button onClick={() => handleEdit(c)} className="btn-secondary text-xs flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit Details & Logo
              </button>
              <button
                type="button"
                onClick={() => handleDelete(c)}
                disabled={companies.length <= 1}
                className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
                  companies.length <= 1
                    ? 'opacity-40 cursor-not-allowed bg-ink-100 text-ink-400'
                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 cursor-pointer'
                }`}
                title={companies.length <= 1 ? 'You must keep at least 1 company of record' : `Delete ${c.shortName || c.legalName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Add Company Modal */}
      {modalOpen && editing && (
        <CompanyModal
          company={editing}
          totalCompanies={companies.length}
          onClose={() => setModalOpen(false)}
          onSave={saveCompany}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function CompanyModal({
  company,
  totalCompanies,
  onClose,
  onSave,
  onDelete
}: {
  company: CompanyDoc;
  totalCompanies: number;
  onClose: () => void;
  onSave: (data: CompanyDoc) => Promise<void>;
  onDelete: (data: CompanyDoc) => Promise<void>;
}) {
  const [data, setData] = useState<CompanyDoc>({ ...company });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof CompanyDoc>(key: K, val: CompanyDoc[K]) {
    setData((prev) => ({ ...prev, [key]: val }));
  }

  // Handle Logo Upload (converts to base64 & calls API to upload to Google Drive folder)
  async function handleLogoUpload(file: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPG, or WebP image.');
      return;
    }
    setUploadError(null);
    setUploadingLogo(true);
    setDriveSuccessMsg(null);

    try {
      // 1. Read file as base64 data URL and downscale to max 600px width/height for fast PDF generation
      const base64 = await readFileAsOptimizedBase64(file, 600, 250);
      update('logoBase64', base64);

      // 2. Upload to Google Drive using /api/companies/upload-logo
      try {
        const res = await fetch('/api/companies/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: data.id,
            companyName: data.shortName || data.legalName || 'company',
            fileName: file.name,
            fileType: file.type,
            base64Data: base64
          })
        });
        const json = await res.json();
        if (json.success) {
          if (json.driveFileId) update('driveFileId', json.driveFileId);
          if (json.logoUrl) update('logoUrl', json.logoUrl);
          setDriveSuccessMsg(
            json.message || 'Logo stored & backed up to Google Drive folder successfully!'
          );
        } else {
          // If Drive upload wasn't available, we still have the optimized base64 for PDF and UI
          setDriveSuccessMsg('Logo saved locally for PDF and Web. (Drive sync skipped)');
        }
      } catch (driveErr) {
        console.warn('Drive upload error:', driveErr);
        setDriveSuccessMsg('Logo saved locally for PDF generation.');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to process logo file');
    } finally {
      setUploadingLogo(false);
    }
  }

  function handleRemoveLogo() {
    update('logoBase64', '');
    update('logoUrl', '');
    update('driveFileId', '');
    setDriveSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSave(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl p-6 shadow-2xl my-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-ink-900">
            {company.legalName ? `Edit ${company.shortName || company.legalName}` : 'Add New Company'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo Section */}
          <div className="rounded-xl border border-brand-200/80 bg-brand-50/30 p-4">
            <label className="label text-xs font-bold text-ink-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <ImageIcon className="h-4 w-4 text-brand-600" />
              Company Logo (PNG / JPG / WebP)
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-20 w-36 rounded-lg border-2 border-dashed border-brand-300 bg-white p-2 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {data.logoBase64 || data.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.logoBase64 || data.logoUrl}
                    alt="Company logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-ink-400">
                    <ImageIcon className="h-6 w-6 mx-auto mb-1 text-ink-300" />
                    <span className="text-[10px] block">No logo uploaded</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 text-left">
                <p className="text-xs text-ink-600">
                  Upload a clean transparent PNG or JPG logo. This will be automatically embedded in your <strong>Quotations, Proforma Invoices, POs & Tax Invoices</strong> and backed up to your Google Drive folder.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleLogoUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingLogo ? 'Processing & Uploading...' : (data.logoBase64 || data.logoUrl) ? 'Change Logo' : 'Upload PNG Logo'}
                  </button>

                  {(data.logoBase64 || data.logoUrl) && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="btn-danger text-xs px-2.5 py-1.5"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                {driveSuccessMsg && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{driveSuccessMsg}</span>
                  </p>
                )}

                {uploadError && (
                  <p className="text-xs text-red-600">{uploadError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Legal Name <span className="text-red-500">*</span></label>
              <input
                className="input"
                required
                value={data.legalName}
                onChange={(e) => update('legalName', e.target.value)}
                placeholder="e.g. Acme Technologies Private Limited"
              />
            </div>
            <div>
              <label className="label">Short Name / Display Name</label>
              <input
                className="input"
                value={data.shortName}
                onChange={(e) => update('shortName', e.target.value)}
                placeholder="e.g. Acme Tech"
              />
            </div>
            <div>
              <label className="label">Default GST Rate %</label>
              <input
                className="input num"
                type="number"
                step="1"
                value={Math.round((data.defaultGstRate || 0.18) * 100)}
                onChange={(e) => update('defaultGstRate', Number(e.target.value) / 100)}
              />
            </div>

            <div>
              <label className="label">GSTIN</label>
              <input
                className="input num uppercase"
                value={data.gstin}
                onChange={(e) => update('gstin', e.target.value.toUpperCase())}
                placeholder="33AAJCC3705A1ZC"
              />
            </div>
            <div>
              <label className="label">PAN</label>
              <input
                className="input num uppercase"
                value={data.pan}
                onChange={(e) => update('pan', e.target.value.toUpperCase())}
                placeholder="AAJCC3705A"
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={data.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="billing@acmetech.com"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input num"
                value={data.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {/* Address */}
          <div className="border-t border-ink-100 pt-3">
            <h4 className="text-xs font-bold text-ink-800 uppercase tracking-wider mb-2">Registered Address</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input
                  className="input"
                  placeholder="Address Line 1"
                  value={data.address?.line1 || ''}
                  onChange={(e) => update('address', { ...data.address, line1: e.target.value })}
                />
              </div>
              <div>
                <input
                  className="input"
                  placeholder="City"
                  value={data.address?.city || ''}
                  onChange={(e) => update('address', { ...data.address, city: e.target.value })}
                />
              </div>
              <div>
                <input
                  className="input num"
                  placeholder="Pincode"
                  value={data.address?.pincode || ''}
                  onChange={(e) => update('address', { ...data.address, pincode: e.target.value })}
                />
              </div>
              <div>
                <input
                  className="input"
                  placeholder="State (e.g. Tamil Nadu)"
                  value={data.address?.state || ''}
                  onChange={(e) => update('address', { ...data.address, state: e.target.value })}
                />
              </div>
              <div>
                <input
                  className="input num"
                  placeholder="State Code (e.g. 33)"
                  value={data.address?.stateCode || ''}
                  onChange={(e) => update('address', { ...data.address, stateCode: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Bank */}
          <div className="border-t border-ink-100 pt-3">
            <h4 className="text-xs font-bold text-ink-800 uppercase tracking-wider mb-2">Bank Details for Documents</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <input
                  className="input"
                  placeholder="Account Name"
                  value={data.bank?.accountName || ''}
                  onChange={(e) => update('bank', { ...data.bank, accountName: e.target.value })}
                />
              </div>
              <div>
                <input
                  className="input"
                  placeholder="Bank Name (e.g. HDFC Bank)"
                  value={data.bank?.bankName || ''}
                  onChange={(e) => update('bank', { ...data.bank, bankName: e.target.value })}
                />
              </div>
              <div>
                <input
                  className="input num"
                  placeholder="Account Number"
                  value={data.bank?.accountNumber || ''}
                  onChange={(e) => update('bank', { ...data.bank, accountNumber: e.target.value })}
                />
              </div>
              <div>
                <input
                  className="input num uppercase"
                  placeholder="IFSC Code"
                  value={data.bank?.ifsc || ''}
                  onChange={(e) => update('bank', { ...data.bank, ifsc: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <input
                  className="input"
                  placeholder="Account Type (Current / Savings)"
                  value={data.bank?.accountType || 'Current'}
                  onChange={(e) => update('bank', { ...data.bank, accountType: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Company-Specific Terms & Conditions */}
          <div className="border-t border-ink-100 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-brand-600" />
                Company Terms & Conditions (Auto-loaded on Documents)
              </h4>
            </div>
            <p className="text-xs text-ink-500">
              Set unique Terms & Conditions for this company. When this company is chosen on any Quotation, PO, or Invoice, these terms will automatically pre-fill.
            </p>

            {/* Quotation Terms */}
            <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-800">
                  Quotation Terms & Conditions
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update('quotationTerms', DEFAULT_QUOTATION_TERMS)}
                    className="text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    Fill Standard Default
                  </button>
                  {data.quotationTerms && (
                    <button
                      type="button"
                      onClick={() => update('quotationTerms', '')}
                      className="text-[11px] font-medium text-ink-400 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={4}
                className="input font-mono text-xs leading-relaxed"
                value={data.quotationTerms || ''}
                onChange={(e) => update('quotationTerms', e.target.value)}
                placeholder="1. Delivery within 7 working days...\n2. 50% advance payment..."
              />
            </div>

            {/* Invoice & Proforma Terms */}
            <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-800">
                  Proforma & Tax Invoice Terms & Conditions
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update('invoiceTerms', DEFAULT_INVOICE_TERMS)}
                    className="text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    Fill Standard Default
                  </button>
                  {data.invoiceTerms && (
                    <button
                      type="button"
                      onClick={() => update('invoiceTerms', '')}
                      className="text-[11px] font-medium text-ink-400 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={3}
                className="input font-mono text-xs leading-relaxed"
                value={data.invoiceTerms || ''}
                onChange={(e) => update('invoiceTerms', e.target.value)}
                placeholder="1. Goods once sold will not be taken back...\n2. Subject to local jurisdiction..."
              />
            </div>

            {/* Purchase Order (PO) Terms */}
            <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-800">
                  Purchase Order (PO) Terms & Conditions
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        'poTerms',
                        '1. Goods must strictly match specifications and quality standards agreed.\n2. Delivery must be completed within the promised timeline.\n3. Tax Invoice, warranty certificates, and challan must accompany shipment.\n4. Payment will be released strictly following inspection and verification of received materials.'
                      )
                    }
                    className="text-[11px] font-medium text-brand-600 hover:underline"
                  >
                    Fill Standard Default
                  </button>
                  {data.poTerms && (
                    <button
                      type="button"
                      onClick={() => update('poTerms', '')}
                      className="text-[11px] font-medium text-ink-400 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={3}
                className="input font-mono text-xs leading-relaxed"
                value={data.poTerms || ''}
                onChange={(e) => update('poTerms', e.target.value)}
                placeholder="1. Materials subject to quality inspection upon delivery...\n2. Payment terms as agreed..."
              />
            </div>
          </div>

          <div>
            <label className="label">Footer Line</label>
            <input
              className="input"
              value={data.footer || ''}
              onChange={(e) => update('footer', e.target.value)}
              placeholder="For any enquiries, please reach out via email or phone."
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={!!data.isDefault}
              onChange={(e) => update('isDefault', e.target.checked)}
              className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isDefault" className="text-xs font-medium text-ink-700 cursor-pointer">
              Set as Default Company (pre-selected on new documents)
            </label>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-4">
            {totalCompanies > 1 && company.legalName ? (
              <button
                type="button"
                onClick={async () => {
                  await onDelete(data);
                }}
                disabled={submitting}
                className="btn-danger text-xs px-3 py-2 flex items-center gap-1.5 text-white bg-red-600 hover:bg-red-700 shadow-2xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Company</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Saving...' : 'Save Company'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Client-side helper to read and optimize logo image for PDF embedding (<150KB)
async function readFileAsOptimizedBase64(file: File, maxWidth = 500, maxHeight = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image data'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw preserving transparency
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // If original was PNG, keep PNG format to preserve transparency
        const format = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(format, 0.92);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

