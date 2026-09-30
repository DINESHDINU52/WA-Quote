'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getDb } from '@/lib/firebase/client';
import { productSchema, type ProductInput, type ProductDoc } from '@/lib/schemas';
import { useAuth } from '@/lib/auth-context';
import { exportProductsToExcel } from '@/lib/excel-import';
import { logAuditActivity } from '@/lib/audit';
import { PageHeader } from '@/components/page-header';
import { cn, formatINR } from '@/lib/utils';
import { Plus, Trash2, Pencil, X, Upload, Download, Search, Filter, Clock, User, CheckCircle2 } from 'lucide-react';
import { ProductImportDialog } from './import-dialog';

export default function ProductsPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductDoc | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [gstFilter, setGstFilter] = useState('all');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(getDb(), 'products'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductInput) })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      // GST Rate filter
      if (gstFilter !== 'all') {
        const targetRate = parseFloat(gstFilter);
        if (Math.abs(p.gstRate - targetRate) > 0.001) return false;
      }
      // Text search
      if (!q) return true;
      const matchSerial = p.serialNumber?.toLowerCase().includes(q);
      const matchName = p.name?.toLowerCase().includes(q);
      const matchFeatures = p.features?.toLowerCase().includes(q);
      const matchConnectivity = p.connectivity?.toLowerCase().includes(q);
      const matchHsn = p.hsn?.toLowerCase().includes(q);
      const matchCategory = p.category?.toLowerCase().includes(q);

      return matchSerial || matchName || matchFeatures || matchConnectivity || matchHsn || matchCategory;
    });
  }, [products, search, gstFilter]);

  // Extract unique GST rates present for dropdown
  const uniqueGstRates = useMemo(() => {
    const set = new Set<number>();
    products.forEach((p) => {
      if (typeof p.gstRate === 'number') set.add(p.gstRate);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [products]);

  // Function to smoothly scroll to and highlight a row
  function focusRow(id: string) {
    setHighlightedId(id);
    // Delay slightly to allow any re-render or modal unmount to complete
    setTimeout(() => {
      const row = document.getElementById(`product-row-${id}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // Clear highlight ring after 3.5 seconds
    setTimeout(() => {
      setHighlightedId(null);
    }, 3500);
  }

  async function remove(p: ProductDoc) {
    if (!confirm(`Delete ${p.name}?`)) return;
    await deleteDoc(doc(getDb(), 'products', p.id));

    // Log deletion activity
    await logAuditActivity({
      action: 'product_delete',
      entityType: 'product',
      entityId: p.id,
      entityName: p.name,
      serialNumber: p.serialNumber,
      oldPrice: p.rate,
      details: `Deleted product "${p.name}" (SKU: ${p.serialNumber || 'N/A'})`,
      userUid: profile?.uid ?? 'system',
      userName: profile?.displayName || profile?.email || 'User',
      userRole: profile?.role
    });
  }

  // Bulk Insert with Upsert (Duplicate detection by Serial Number or Name)
  async function bulkInsert(rows: ProductInput[]) {
    const batch = writeBatch(getDb());
    let addedCount = 0;
    let updatedCount = 0;
    const currentUserName = profile?.displayName || profile?.email || 'User';

    for (const r of rows) {
      const matched = products.find((p) => {
        if (r.serialNumber && p.serialNumber) {
          return p.serialNumber.trim().toLowerCase() === r.serialNumber.trim().toLowerCase();
        }
        return p.name.trim().toLowerCase() === r.name.trim().toLowerCase();
      });

      if (matched) {
        // Upsert existing device
        const ref = doc(getDb(), 'products', matched.id);
        const priceChanged = Math.abs((matched.rate || 0) - r.rate) > 0.01;
        batch.set(
          ref,
          {
            ...r,
            updatedAt: serverTimestamp(),
            updatedByName: currentUserName,
            updatedByUid: profile?.uid ?? 'system',
            ...(priceChanged
              ? {
                  priceUpdatedAt: serverTimestamp(),
                  priceUpdatedByName: currentUserName,
                  priceUpdatedByUid: profile?.uid ?? 'system'
                }
              : {})
          },
          { merge: true }
        );
        updatedCount++;
      } else {
        // Insert new device
        const ref = doc(collection(getDb(), 'products'));
        batch.set(ref, {
          ...r,
          createdAt: serverTimestamp(),
          createdByName: currentUserName,
          createdByUid: profile?.uid ?? 'system',
          updatedAt: serverTimestamp(),
          updatedByName: currentUserName,
          updatedByUid: profile?.uid ?? 'system'
        });
        addedCount++;
      }
    }

    await batch.commit();

    // Log bulk import activity
    await logAuditActivity({
      action: 'bulk_import',
      entityType: 'product',
      entityName: `Imported ${rows.length} products`,
      details: `Processed ${rows.length} products from Excel: ${addedCount} new added, ${updatedCount} updated.`,
      userUid: profile?.uid ?? 'system',
      userName: currentUserName,
      userRole: profile?.role
    });
  }

  function handleExport() {
    exportProductsToExcel(products);
  }

  async function clearAll() {
    if (!products.length) return;
    if (
      !confirm(
        `Permanently delete all ${products.length} products from the database? This will give you a completely fresh, empty product catalog.`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const chunkSize = 400;
      for (let i = 0; i < products.length; i += chunkSize) {
        const batch = writeBatch(getDb());
        const chunk = products.slice(i, i + chunkSize);
        chunk.forEach((p) => {
          batch.delete(doc(getDb(), 'products', p.id));
        });
        await batch.commit();
      }
      await logAuditActivity({
        action: 'bulk_delete',
        entityType: 'product',
        entityName: 'Cleared all products',
        details: `Deleted all ${products.length} products from catalog.`,
        userUid: profile?.uid ?? 'system',
        userName: profile?.displayName || profile?.email || 'User',
        userRole: profile?.role
      });
    } catch (e: any) {
      alert(`Failed to delete products: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  }

  const hasActiveFilters = search.trim() !== '' || gstFilter !== 'all';

  return (
    <>
      <PageHeader
        title="Products & Services"
        description="Product & service catalog with SKU codes, prices, specifications, and full audit tracking."
        actions={
          <>
            {products.length > 0 && (
              <button
                onClick={clearAll}
                className="btn-danger flex items-center gap-1.5"
                title="Permanently remove all products to start with a fresh catalog"
              >
                <Trash2 className="h-4 w-4" />
                Clear All ({products.length})
              </button>
            )}
            <button onClick={handleExport} className="btn-secondary" title="Export all products to Excel">
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <button onClick={() => setImportOpen(true)} className="btn-secondary">
              <Upload className="h-4 w-4" />
              Import Excel
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Add product
            </button>
          </>
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
              placeholder="Search by SKU/Code, product name, features, HSN..."
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

          {/* GST Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-ink-400" />
            <select
              value={gstFilter}
              onChange={(e) => setGstFilter(e.target.value)}
              className="input w-36 text-sm"
              title="Filter by GST Rate"
            >
              <option value="all">All GST Rates</option>
              {uniqueGstRates.map((rate) => (
                <option key={rate} value={rate}>
                  {(rate * 100).toFixed(0)}% GST
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
                setGstFilter('all');
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
                Showing <strong className="text-ink-800">{filteredProducts.length}</strong> of{' '}
                {products.length} products
              </span>
            ) : (
              <span>Total: <strong className="text-ink-800">{products.length}</strong> products</span>
            )}
          </div>
        </div>
      </div>

      <div ref={tableContainerRef} className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU / Code</th>
              <th className="px-4 py-3 font-medium">Product / Item</th>
              <th className="px-4 py-3 font-medium">Features</th>
              <th className="px-4 py-3 font-medium">Connectivity</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">GST</th>
              <th className="px-4 py-3 font-medium">HSN</th>
              <th className="px-4 py-3 font-medium">Last Modified</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-400">
                  Loading products...
                </td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink-400">
                  No products yet. Add one or import from Excel.
                </td>
              </tr>
            )}
            {!loading && products.length > 0 && filteredProducts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-ink-400">
                  No products found matching &quot;{search}&quot;.
                  <button
                    onClick={() => {
                      setSearch('');
                      setGstFilter('all');
                    }}
                    className="block mx-auto mt-2 text-xs text-brand-600 hover:underline"
                  >
                    Clear search filters
                  </button>
                </td>
              </tr>
            )}
            {filteredProducts.map((p, idx) => (
              <tr
                key={p.id}
                id={`product-row-${p.id}`}
                className={cn(
                  'transition-all duration-300',
                  highlightedId === p.id
                    ? 'bg-brand-50/90 ring-2 ring-brand-500 ring-inset shadow-sm'
                    : 'hover:bg-ink-50/60'
                )}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="num text-ink-400 text-xs font-mono min-w-[20px]">{idx + 1}</span>
                    {p.serialNumber ? (
                      <span className="inline-block rounded bg-brand-50 border border-brand-200/60 px-2 py-0.5 text-xs font-mono font-semibold text-brand-800">
                        {p.serialNumber}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                <td className="px-4 py-3 text-ink-700">{p.features || '—'}</td>
                <td className="px-4 py-3 text-ink-700">{p.connectivity || '—'}</td>
                <td className="px-4 py-3 num text-right font-semibold text-ink-900">
                  {formatINR(p.rate)}
                </td>
                <td className="px-4 py-3 num text-right text-ink-700">
                  {(p.gstRate * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3 num text-ink-700">{p.hsn || '—'}</td>
                <td className="px-4 py-3 text-xs text-ink-500">
                  <div className="flex items-center gap-1 font-medium text-ink-800">
                    <User className="h-3 w-3 text-brand-600" />
                    <span>{p.updatedByName || p.createdByName || 'System'}</span>
                  </div>
                  {p.priceUpdatedByName && (
                    <div className="text-[10px] text-brand-700 mt-0.5" title={`Price set by ${p.priceUpdatedByName}`}>
                      Price by: {p.priceUpdatedByName}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                    className="btn-secondary mr-2 px-3 py-1.5 text-xs"
                    title="Edit product"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="btn-danger px-3 py-1.5 text-xs"
                    title="Delete product"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <ProductDialog
          existing={editing}
          existingProducts={products}
          onClose={() => setOpen(false)}
          onSuccess={(savedId) => {
            setOpen(false);
            focusRow(savedId);
          }}
        />
      )}
      {importOpen && (
        <ProductImportDialog
          existingProducts={products}
          onClose={() => setImportOpen(false)}
          onCommit={async (rows) => {
            await bulkInsert(rows);
            setImportOpen(false);
          }}
        />
      )}
    </>
  );
}

function ProductDialog({
  existing,
  existingProducts = [],
  onClose,
  onSuccess
}: {
  existing: ProductDoc | null;
  existingProducts?: ProductDoc[];
  onClose: () => void;
  onSuccess: (savedId: string) => void;
}) {
  const { profile } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues:
      existing ?? {
        serialNumber: '',
        name: '',
        features: '',
        connectivity: '',
        hsn: '',
        unit: 'Nos',
        rate: 0,
        gstRate: 0.18,
        category: 'General',
        active: true
      }
  });

  async function onSubmit(values: ProductInput) {
    let targetId = existing?.id;
    let targetExisting = existing;

    if (!targetId && values.serialNumber) {
      const duplicate = existingProducts.find(
        (p) =>
          p.serialNumber &&
          p.serialNumber.trim().toLowerCase() === values.serialNumber.trim().toLowerCase()
      );
      if (duplicate) {
        if (
          !confirm(
            `A product with SKU/Code "${values.serialNumber}" already exists (${duplicate.name}). Do you want to update it with these details?`
          )
        ) {
          return;
        }
        targetId = duplicate.id;
        targetExisting = duplicate;
      }
    }

    const id = targetId ?? doc(collection(getDb(), 'products')).id;
    const currentUserName = profile?.displayName || profile?.email || 'User';
    const isNew = !targetExisting;
    const priceChanged = targetExisting ? Math.abs((targetExisting.rate || 0) - values.rate) > 0.01 : true;

    await setDoc(
      doc(getDb(), 'products', id),
      {
        ...values,
        updatedAt: serverTimestamp(),
        updatedByName: currentUserName,
        updatedByUid: profile?.uid ?? 'system',
        ...(priceChanged
          ? {
              priceUpdatedAt: serverTimestamp(),
              priceUpdatedByName: currentUserName,
              priceUpdatedByUid: profile?.uid ?? 'system'
            }
          : {}),
        ...(isNew
          ? {
              createdAt: serverTimestamp(),
              createdByName: currentUserName,
              createdByUid: profile?.uid ?? 'system'
            }
          : {})
      },
      { merge: true }
    );

    // Audit logging
    if (isNew) {
      await logAuditActivity({
        action: 'product_create',
        entityType: 'product',
        entityId: id,
        entityName: values.name,
        serialNumber: values.serialNumber,
        newPrice: values.rate,
        details: `Created new product "${values.name}" with price ₹${values.rate.toLocaleString('en-IN')}`,
        userUid: profile?.uid ?? 'system',
        userName: currentUserName,
        userRole: profile?.role
      });
    } else if (priceChanged) {
      await logAuditActivity({
        action: 'price_update',
        entityType: 'product',
        entityId: id,
        entityName: values.name,
        serialNumber: values.serialNumber,
        oldPrice: targetExisting?.rate,
        newPrice: values.rate,
        details: `Price changed from ₹${(targetExisting?.rate ?? 0).toLocaleString('en-IN')} to ₹${values.rate.toLocaleString('en-IN')}`,
        userUid: profile?.uid ?? 'system',
        userName: currentUserName,
        userRole: profile?.role
      });
    } else {
      await logAuditActivity({
        action: 'product_update',
        entityType: 'product',
        entityId: id,
        entityName: values.name,
        serialNumber: values.serialNumber,
        newPrice: values.rate,
        details: `Updated specifications for "${values.name}"`,
        userUid: profile?.uid ?? 'system',
        userName: currentUserName,
        userRole: profile?.role
      });
    }

    onSuccess(id);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 backdrop-blur-xs p-4">
      <div className="card w-full max-w-xl p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink-900">
              {existing ? 'Edit product' : 'Add product'}
            </h2>
            <p className="text-xs text-ink-500">
              {existing ? `Editing ${existing.name}` : 'Add a new product or service item to catalog'}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">SKU / Item Code</label>
            <input
              className="input font-mono"
              placeholder="e.g. SKU-1001"
              {...register('serialNumber')}
            />
            {errors.serialNumber && <p className="mt-1 text-xs text-red-700">{errors.serialNumber.message}</p>}
          </div>
          <div>
            <label className="label">Product Name <span className="text-red-500">*</span></label>
            <input className="input font-medium" placeholder="e.g. Standard Software License" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-700">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Features / Description</label>
            <input className="input" placeholder="e.g. Cloud Hosting / 1 Year" {...register('features')} />
          </div>
          <div>
            <label className="label">Connectivity / Specs</label>
            <input className="input" placeholder="e.g. API / Webhooks" {...register('connectivity')} />
          </div>

          <div>
            <label className="label">Price (₹) <span className="text-red-500">*</span></label>
            <input
              className="input num font-semibold text-brand-700"
              type="number"
              step="0.01"
              {...register('rate', { valueAsNumber: true })}
            />
            {errors.rate && <p className="mt-1 text-xs text-red-700">{errors.rate.message}</p>}
          </div>
          <div>
            <label className="label">GST % (e.g. 18 for 18%)</label>
            <input
              className="input num"
              type="number"
              step="1"
              placeholder="18"
              {...register('gstRate', {
                setValueAs: (v: string) => Number(v) / 100
              })}
            />
            {errors.gstRate && <p className="mt-1 text-xs text-red-700">{errors.gstRate.message}</p>}
          </div>

          <div>
            <label className="label">HSN Code</label>
            <input className="input num" placeholder="e.g. 85176290" {...register('hsn')} />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" placeholder="General" {...register('category')} />
          </div>

          <div className="col-span-2 mt-3 flex items-center justify-between border-t border-ink-100 pt-4">
            <div className="text-xs text-ink-500">
              {existing && (
                <span>Last updated by: <strong>{existing.updatedByName || existing.createdByName || 'System'}</strong></span>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

