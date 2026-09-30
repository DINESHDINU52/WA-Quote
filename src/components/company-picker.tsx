'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, getDoc, doc, query, orderBy } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { COMPANY_DEFAULTS, type CompanyDoc, type CompanySettings } from '@/lib/company';
import type { CompanySnapshot } from '@/lib/doc-types';
import { Building2, Plus } from 'lucide-react';
import Link from 'next/link';

interface CompanyPickerProps {
  selectedCompany?: CompanySnapshot;
  selectedCompanyId?: string;
  onSelectCompany: (company: CompanySnapshot, companyId?: string) => void;
}

export function CompanyPicker({
  selectedCompany,
  selectedCompanyId,
  onSelectCompany
}: CompanyPickerProps) {
  const [companies, setCompanies] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>(selectedCompanyId || '');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        let list: CompanyDoc[] = [];
        try {
          const snap = await getDocs(query(collection(getDb(), 'companies'), orderBy('legalName')));
          list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CompanySettings) }));
        } catch (colErr) {
          console.warn('Could not read companies collection, attempting fallback:', colErr);
        }

        // Fallback if collection was empty or permission denied
        if (list.length === 0) {
          try {
            const fallbackSnap = await getDoc(doc(getDb(), 'settings', 'companies'));
            if (fallbackSnap.exists() && Array.isArray(fallbackSnap.data()?.list)) {
              list = fallbackSnap.data()?.list;
            } else {
              const legacySnap = await getDoc(doc(getDb(), 'settings', 'company'));
              if (legacySnap.exists()) {
                list = [{ id: 'default', ...COMPANY_DEFAULTS, ...(legacySnap.data() as any), isDefault: true }];
              }
            }
          } catch (fbErr) {
            console.warn('Fallback company read failed:', fbErr);
          }
        }

        if (!isMounted) return;
        setCompanies(list);

        // Determine which company should be selected
        let chosen: CompanyDoc | undefined;
        if (selectedCompanyId) {
          chosen = list.find((c) => c.id === selectedCompanyId);
        }
        if (!chosen && selectedCompany?.legalName) {
          chosen = list.find(
            (c) =>
              c.legalName?.trim().toLowerCase() === selectedCompany.legalName?.trim().toLowerCase() ||
              (selectedCompany.shortName && c.shortName?.trim().toLowerCase() === selectedCompany.shortName?.trim().toLowerCase())
          );
        }
        if (!chosen && list.length > 0) {
          chosen = list.find((c) => c.isDefault) || list[0];
        }

        if (chosen) {
          setActiveId(chosen.id);
          // If parent did not have companyId or fields synced yet, notify parent
          if (!selectedCompanyId || selectedCompanyId !== chosen.id) {
            const sc = chosen.stateCode || chosen.address?.stateCode || (chosen.gstin && /^\d{2}/.test(chosen.gstin.trim()) ? chosen.gstin.trim().slice(0, 2) : '33');
            const sn = chosen.state || chosen.address?.state || 'Tamil Nadu';
            onSelectCompany(
              {
                legalName: chosen.legalName,
                shortName: chosen.shortName,
                gstin: chosen.gstin,
                pan: chosen.pan,
                stateCode: sc,
                state: sn,
                country: chosen.country || chosen.address?.country || 'India',
                email: chosen.email,
                phone: chosen.phone,
                address: chosen.address ? { ...chosen.address, stateCode: chosen.address.stateCode || sc, state: chosen.address.state || sn } : chosen.address,
                bank: chosen.bank,
                footer: chosen.footer,
                logoUrl: chosen.logoUrl || '',
                logoBase64: chosen.logoBase64 || '',
                driveFileId: chosen.driveFileId || '',
                quotationTerms: chosen.quotationTerms || '',
                invoiceTerms: chosen.invoiceTerms || '',
                poTerms: chosen.poTerms || ''
              },
              chosen.id
            );
          }
        }
      } catch (e) {
        console.error('Failed to load companies:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync activeId when selectedCompanyId or selectedCompany prop updates
  useEffect(() => {
    if (selectedCompanyId) {
      setActiveId(selectedCompanyId);
    } else if (selectedCompany?.legalName && companies.length > 0) {
      const match = companies.find(
        (c) =>
          c.legalName?.trim().toLowerCase() === selectedCompany.legalName?.trim().toLowerCase() ||
          (selectedCompany.shortName && c.shortName?.trim().toLowerCase() === selectedCompany.shortName?.trim().toLowerCase())
      );
      if (match) setActiveId(match.id);
    }
  }, [selectedCompanyId, selectedCompany, companies]);

  if (loading) return <div className="text-xs text-ink-400">Loading companies...</div>;

  const currentSelection =
    companies.find((c) => c.id === activeId) ||
    companies.find((c) => c.legalName?.trim().toLowerCase() === selectedCompany?.legalName?.trim().toLowerCase()) ||
    companies[0];

  // Specific logo of the currently chosen company ONLY (no cross-company fallback)
  const currentLogo = currentSelection?.logoBase64 || currentSelection?.logoUrl || selectedCompany?.logoBase64 || selectedCompany?.logoUrl;

  function handleCompanyChange(newId: string) {
    setActiveId(newId);
    const chosen = companies.find((c) => c.id === newId);
    if (chosen) {
      const sc = chosen.stateCode || chosen.address?.stateCode || (chosen.gstin && /^\d{2}/.test(chosen.gstin.trim()) ? chosen.gstin.trim().slice(0, 2) : '33');
      const sn = chosen.state || chosen.address?.state || 'Tamil Nadu';
      onSelectCompany(
        {
          legalName: chosen.legalName,
          shortName: chosen.shortName,
          gstin: chosen.gstin,
          pan: chosen.pan,
          stateCode: sc,
          state: sn,
          country: chosen.country || chosen.address?.country || 'India',
          email: chosen.email,
          phone: chosen.phone,
          address: chosen.address ? { ...chosen.address, stateCode: chosen.address.stateCode || sc, state: chosen.address.state || sn } : chosen.address,
          bank: chosen.bank,
          footer: chosen.footer,
          logoUrl: chosen.logoUrl || '',
          logoBase64: chosen.logoBase64 || '',
          driveFileId: chosen.driveFileId || '',
          quotationTerms: chosen.quotationTerms || '',
          invoiceTerms: chosen.invoiceTerms || '',
          poTerms: chosen.poTerms || ''
        },
        chosen.id
      );
    }
  }

  return (
    <div className="rounded-xl border border-brand-200/80 bg-gradient-to-r from-brand-50/40 via-white to-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className="text-xs font-bold text-ink-800 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-brand-600" />
          Company of Record (Issuer)
        </label>
        <Link href="/settings/company" className="text-[11px] font-semibold text-brand-600 hover:underline flex items-center gap-1">
          <Plus className="h-3 w-3" /> Manage Companies ({companies.length})
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {/* Company Logo Thumbnail — strictly shows the active company's logo */}
        {currentLogo ? (
          <div className="h-10 w-16 shrink-0 rounded-lg border border-ink-200 bg-white p-1 flex items-center justify-center overflow-hidden shadow-2xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={currentSelection?.id || 'logo'}
              src={currentLogo}
              alt={`${currentSelection?.shortName || currentSelection?.legalName || 'Company'} Logo`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-lg border border-brand-200 bg-brand-50 text-brand-600 grid place-items-center">
            <Building2 className="h-5 w-5" />
          </div>
        )}

        <div className="relative flex-1">
          <select
            value={currentSelection?.id || ''}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className="w-full rounded-lg border border-brand-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer shadow-xs"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.legalName} {c.shortName ? `(${c.shortName})` : ''} {c.isDefault ? '★ Default' : ''} {c.gstin ? `— GSTIN: ${c.gstin}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentSelection && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-600 font-medium">
          {currentSelection.gstin && <span>GSTIN: <strong className="font-mono text-ink-800">{currentSelection.gstin}</strong></span>}
          {currentSelection.pan && <span>PAN: <strong className="font-mono text-ink-800">{currentSelection.pan}</strong></span>}
          {currentSelection.email && <span>Email: <strong className="text-ink-800">{currentSelection.email}</strong></span>}
          {currentSelection.bank?.bankName && <span>Bank: <strong className="text-ink-800">{currentSelection.bank.bankName}</strong></span>}
          {currentLogo ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              ✓ Custom logo active
            </span>
          ) : (
            <span className="text-ink-400 font-normal">
              (No logo uploaded)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
