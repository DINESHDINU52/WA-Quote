'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { customerSchema, type CustomerInput } from '@/lib/schemas';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/page-header';
import { INDIAN_STATES, findStateByCode } from '@/lib/indian-states';
import { Plus, Trash2, Pencil, X, Search, Filter } from 'lucide-react';

interface CustomerDoc extends CustomerInput {
  id: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomerDoc | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(getDb(), 'customers'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomerInput) })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      // State filter
      if (stateFilter !== 'all' && c.billingAddress?.state !== stateFilter) {
        return false;
      }
      // Text search
      if (!q) return true;
      const matchName = c.name?.toLowerCase().includes(q);
      const matchCompany = c.companyName?.toLowerCase().includes(q);
      const matchGstin = c.gstin?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchEmail = c.email?.toLowerCase().includes(q);
      const matchCity = c.billingAddress?.city?.toLowerCase().includes(q);
      const matchState = c.billingAddress?.state?.toLowerCase().includes(q);
      const matchPincode = c.billingAddress?.pincode?.toLowerCase().includes(q);

      return (
        matchName ||
        matchCompany ||
        matchGstin ||
        matchPhone ||
        matchEmail ||
        matchCity ||
        matchState ||
        matchPincode
      );
    });
  }, [customers, search, stateFilter]);

  // Extract unique states present in customer list for quick dropdown
  const uniqueStates = useMemo(() => {
    const s = new Set<string>();
    customers.forEach((c) => {
      if (c.billingAddress?.state) s.add(c.billingAddress.state);
    });
    return Array.from(s).sort();
  }, [customers]);

  function startNew() {
    setEditing(null);
    setOpen(true);
  }
  function startEdit(c: CustomerDoc) {
    setEditing(c);
    setOpen(true);
  }
  async function remove(c: CustomerDoc) {
    if (!confirm(`Delete ${c.name}? This does not affect past invoices.`)) return;
    await deleteDoc(doc(getDb(), 'customers', c.id));
  }

  const hasActiveFilters = search.trim() !== '' || stateFilter !== 'all';

  return (
    <>
      <PageHeader
        title="Customers"
        description="Master list of billed-to parties. GSTIN, PAN and address are snapshot onto each invoice at issue time."
        actions={
          <button onClick={startNew} className="btn-primary">
            <Plus className="h-4 w-4" />
            New customer
          </button>
        }
      />

      {/* Search & Filter Bar */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, GSTIN, phone, email, city..."
              className="w-full rounded-md border border-ink-200 pl-9 pr-9 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* State Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-ink-400" />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="input w-40 text-sm"
              title="Filter by State"
            >
              <option value="all">All States</option>
              {uniqueStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStateFilter('all');
              }}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1"
            >
              Clear filters
            </button>
          )}

          {/* Counter */}
          <div className="text-xs text-ink-500 ml-auto whitespace-nowrap">
            {hasActiveFilters ? (
              <span>
                Showing <strong className="text-ink-800">{filteredCustomers.length}</strong> of{' '}
                {customers.length} customers
              </span>
            ) : (
              <span>Total: <strong className="text-ink-800">{customers.length}</strong> customers</span>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">GSTIN</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  No customers yet. Add your first one.
                </td>
              </tr>
            )}
            {!loading && customers.length > 0 && filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-400">
                  No customers found matching &quot;{search}&quot;.
                  <button
                    onClick={() => {
                      setSearch('');
                      setStateFilter('all');
                    }}
                    className="block mx-auto mt-2 text-xs text-brand-600 hover:underline"
                  >
                    Clear search filters
                  </button>
                </td>
              </tr>
            )}
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="hover:bg-ink-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">{c.companyName || c.name}</div>
                  {c.companyName && <div className="text-xs text-ink-500">{c.name}</div>}
                </td>
                <td className="px-4 py-3 num text-ink-700">{c.gstin || '—'}</td>
                <td className="px-4 py-3 text-ink-700">
                  {c.billingAddress?.state} ({c.billingAddress?.stateCode})
                </td>
                <td className="px-4 py-3 num text-ink-700">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-ink-700">{c.email || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(c)} className="btn-secondary mr-2 px-3 py-1.5 text-xs">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button onClick={() => remove(c)} className="btn-danger px-3 py-1.5 text-xs">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <CustomerDialog
          existing={editing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface CustomerDialogProps {
  existing: CustomerDoc | null;
  onClose: () => void;
}

function CustomerDialog({ existing, onClose }: CustomerDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: existing ?? {
      name: '',
      gstin: '',
      pan: '',
      email: '',
      phone: '',
      shippingSameAsBilling: true,
      openingBalance: 0,
      notes: '',
      billingAddress: {
        line1: '',
        line2: '',
        city: '',
        state: 'Tamil Nadu',
        stateCode: '33',
        pincode: '',
        country: 'India'
      }
    }
  });

  const stateCode = watch('billingAddress.stateCode');

  async function onSubmit(values: CustomerInput) {
    const id = existing?.id ?? doc(collection(getDb(), 'customers')).id;
    await setDoc(
      doc(getDb(), 'customers', id),
      {
        ...values,
        updatedAt: serverTimestamp(),
        ...(existing ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 p-4">
      <div className="card w-full max-w-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-ink-900">
            {existing ? 'Edit customer' : 'New customer'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Company Name</label>
            <input className="input" {...register('companyName')} placeholder="e.g. ABC Enterprises Pvt Ltd" />
          </div>
          <div className="col-span-2">
            <label className="label">Contact Person Name</label>
            <input className="input" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input className="input num uppercase" {...register('gstin')} placeholder="33ABCDE1234F1Z5" />
            {errors.gstin && <p className="mt-1 text-xs text-red-700">{errors.gstin.message}</p>}
          </div>
          <div>
            <label className="label">PAN</label>
            <input className="input num uppercase" {...register('pan')} placeholder="ABCDE1234F" />
            {errors.pan && <p className="mt-1 text-xs text-red-700">{errors.pan.message}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" {...register('email')} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input num" {...register('phone')} />
          </div>
          <div className="col-span-2">
            <label className="label">Address line 1</label>
            <input className="input" {...register('billingAddress.line1')} />
          </div>
          <div className="col-span-2">
            <label className="label">Address line 2</label>
            <input className="input" {...register('billingAddress.line2')} />
          </div>
          <div>
            <label className="label">City</label>
            <input className="input" {...register('billingAddress.city')} />
          </div>
          <div>
            <label className="label">Pincode</label>
            <input className="input num" {...register('billingAddress.pincode')} />
          </div>
          <div>
            <label className="label">State</label>
            <select
              className="input"
              value={stateCode}
              onChange={(e) => {
                const code = e.target.value;
                const st = findStateByCode(code);
                setValue('billingAddress.stateCode', code, { shouldValidate: true });
                if (st) setValue('billingAddress.state', st.name, { shouldValidate: true });
              }}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-400">
              Same as company (33) → CGST + SGST. Different → IGST. Karnataka (29) is inter-state.
            </p>
            <input type="hidden" {...register('billingAddress.state')} />
          </div>
          <div>
            <label className="label">State code (GST)</label>
            <input className="input num" readOnly {...register('billingAddress.stateCode')} />
          </div>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
