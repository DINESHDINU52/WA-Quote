'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { type ProductDoc, type ProductInput } from '@/lib/schemas';
import { PageHeader } from '@/components/page-header';
import { formatINR } from '@/lib/utils';
import {
  Search,
  Package,
  Plus,
  Layers,
  FileText,
  Tag,
  Hash,
  Sparkles,
  Trash2
} from 'lucide-react';

export default function CatalogPage() {
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const q = query(collection(getDb(), 'products'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductInput) })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Derive dynamic categories from database
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      const cat = p.category?.trim();
      if (cat) cats.add(cat);
      else cats.add('General');
    });
    return Array.from(cats).sort();
  }, [products]);

  // Filter products by category and search term
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const cat = p.category?.trim() || 'General';
      if (selectedCategory !== 'all' && cat.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      const matchName = p.name?.toLowerCase().includes(q);
      const matchSerial = p.serialNumber?.toLowerCase().includes(q);
      const matchFeatures = p.features?.toLowerCase().includes(q);
      const matchConnectivity = p.connectivity?.toLowerCase().includes(q);
      const matchHsn = p.hsn?.toLowerCase().includes(q);
      const matchCategory = cat.toLowerCase().includes(q);
      return matchName || matchSerial || matchFeatures || matchConnectivity || matchHsn || matchCategory;
    });
  }, [products, search, selectedCategory]);

  // Group filtered products by category for organized view
  const groupedProducts = useMemo(() => {
    const map = new Map<string, ProductDoc[]>();
    filteredProducts.forEach((p) => {
      const cat = p.category?.trim() || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries());
  }, [filteredProducts]);

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
    } catch (e: any) {
      alert(`Failed to delete products: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalog"
        description="Browse and reference your custom product catalog, specifications, and live pricing."
        actions={
          <div className="flex items-center gap-2">
            {products.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="btn-danger inline-flex items-center gap-2"
                title="Wipe all products to start with a fresh catalog"
              >
                <Trash2 className="h-4 w-4" />
                Clear All Products ({products.length})
              </button>
            )}
            <Link href="/products" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Manage Products
            </Link>
          </div>
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink-900">{products.length}</div>
            <div className="text-xs font-medium text-ink-500">Total Catalog Items</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink-900">{categories.length}</div>
            <div className="text-xs font-medium text-ink-500">Active Categories</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink-900">
              {filteredProducts.length}
            </div>
            <div className="text-xs font-medium text-ink-500">Matching Filter</div>
          </div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search products by name, SKU/serial, features, or HSN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-ink-50/50 pl-10 pr-4 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-ink-400 mr-1 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Category:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200/70'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter(
              (p) => (p.category?.trim() || 'General').toLowerCase() === cat.toLowerCase()
            ).length;
            const active = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200/70'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="card p-12 text-center text-ink-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm">Loading product catalog...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <div className="card p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mb-4">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-ink-900">No products in your catalog</h3>
          <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto">
            Get started by adding products or importing them from Excel to build your customizable catalog.
          </p>
          <div className="mt-5">
            <Link href="/products" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add First Product
            </Link>
          </div>
        </div>
      )}

      {/* Filtered empty state */}
      {!loading && products.length > 0 && filteredProducts.length === 0 && (
        <div className="card p-12 text-center text-ink-500">
          <p className="text-sm">No products found matching &quot;{search}&quot;</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('all');
            }}
            className="mt-3 text-xs font-semibold text-brand-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Grouped Product Grid */}
      {!loading &&
        groupedProducts.map(([category, items]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center justify-between border-b border-ink-200/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                <h2 className="text-base font-bold text-ink-900">{category}</h2>
                <span className="text-xs font-medium text-ink-400">({items.length})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <div
                  key={p.id}
                  className="card p-5 flex flex-col justify-between hover:shadow-md hover:border-brand-200 transition-all group"
                >
                  <div>
                    {/* Header: Name & SKU */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-ink-900 group-hover:text-brand-700 transition-colors">
                          {p.name}
                        </h3>
                        {p.serialNumber && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-ink-500 mt-0.5">
                            <Hash className="h-3 w-3 text-ink-400" />
                            <span>{p.serialNumber}</span>
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        {p.category || 'General'}
                      </span>
                    </div>

                    {/* Features / Details */}
                    {(p.features || p.connectivity) && (
                      <div className="mt-3 space-y-1 rounded-lg bg-ink-50/60 p-2.5 text-xs text-ink-600">
                        {p.features && (
                          <div className="line-clamp-2">
                            <span className="font-semibold text-ink-700">Features: </span>
                            {p.features}
                          </div>
                        )}
                        {p.connectivity && (
                          <div>
                            <span className="font-semibold text-ink-700">Connectivity: </span>
                            {p.connectivity}
                          </div>
                        )}
                      </div>
                    )}

                    {/* HSN & GST */}
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-500">
                      {p.hsn && <span>HSN: <strong className="font-mono text-ink-700">{p.hsn}</strong></span>}
                      <span>GST: <strong className="text-ink-700">{Math.round(p.gstRate * 100)}%</strong></span>
                      <span>Unit: <strong className="text-ink-700">{p.unit || 'Nos'}</strong></span>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-medium text-ink-400 uppercase tracking-wider">Rate</div>
                      <div className="text-lg font-bold text-ink-900">{formatINR(p.rate)}</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href="/quotations/new"
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                        title="Create quotation with this product"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Quote
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
