import { useState, useMemo } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle2, RefreshCw, PlusCircle } from 'lucide-react';
import { parseProductExcel, buildTemplateWorkbook, type ParseResult } from '@/lib/excel-import';
import type { ProductInput, ProductDoc } from '@/lib/schemas';

interface ProductImportDialogProps {
  existingProducts?: ProductDoc[];
  onClose: () => void;
  onCommit: (rows: ProductInput[]) => Promise<void>;
}

export function ProductImportDialog({ existingProducts = [], onClose, onCommit }: ProductImportDialogProps) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      const res = await parseProductExcel(f);
      setParseResult(res);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to read file');
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = buildTemplateWorkbook();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Products-Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Check matching against existing products
  const rowsWithMatchStatus = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.map((r) => {
      if (!r.data) return { ...r, isUpdate: false, matchedProduct: undefined };
      const matched = existingProducts.find((p) => {
        if (r.data?.serialNumber && p.serialNumber) {
          return p.serialNumber.trim().toLowerCase() === r.data.serialNumber.trim().toLowerCase();
        }
        return p.name.trim().toLowerCase() === r.data?.name.trim().toLowerCase();
      });
      return {
        ...r,
        isUpdate: !!matched,
        matchedProduct: matched
      };
    });
  }, [parseResult, existingProducts]);

  const updateCount = useMemo(
    () => rowsWithMatchStatus.filter((r) => r.data && r.isUpdate).length,
    [rowsWithMatchStatus]
  );
  const newCount = useMemo(
    () => rowsWithMatchStatus.filter((r) => r.data && !r.isUpdate).length,
    [rowsWithMatchStatus]
  );

  async function commit() {
    if (!parseResult) return;
    const valid = parseResult.rows.filter((r) => r.data).map((r) => r.data!);
    if (valid.length === 0) return;
    setBusy(true);
    try {
      await onCommit(valid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-xs p-4">
      <div className="card w-full max-w-4xl p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink-900">Import products from Excel</h2>
            <p className="text-xs text-ink-500">
              Matches existing products by <strong className="text-ink-700">SKU / Code</strong> or <strong className="text-ink-700">Product Name</strong> to update prices and specs in place.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <label className="btn-primary cursor-pointer">
            <Upload className="h-4 w-4" />
            Choose Excel file
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFile}
            />
          </label>
          <button onClick={downloadTemplate} className="btn-secondary">
            <Download className="h-4 w-4" />
            Download template (.xlsx)
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {parseResult && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {parseResult.validCount} Valid
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                <PlusCircle className="h-3.5 w-3.5" />
                {newCount} New
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                <RefreshCw className="h-3.5 w-3.5" />
                {updateCount} Updates (Upsert)
              </span>
              {parseResult.errorCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {parseResult.errorCount} Errors
                </span>
              )}
            </div>

            <div className="max-h-80 overflow-auto rounded-md border border-ink-200">
              <table className="w-full text-xs">
                <thead className="bg-ink-50 text-left uppercase tracking-wide text-ink-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">SKU / Code</th>
                    <th className="px-3 py-2 font-medium">Product / Item</th>
                    <th className="px-3 py-2 font-medium num text-right">Price</th>
                    <th className="px-3 py-2 font-medium num text-right">GST</th>
                    <th className="px-3 py-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rowsWithMatchStatus.map((r) => (
                    <tr key={r.rowNumber} className={r.errors ? 'bg-red-50/40' : r.isUpdate ? 'bg-amber-50/20' : ''}>
                      <td className="px-3 py-2 num text-ink-500">{r.rowNumber}</td>
                      <td className="px-3 py-2">
                        {r.errors ? (
                          <span className="text-red-700 font-medium">Error</span>
                        ) : r.isUpdate ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            <RefreshCw className="h-3 w-3" /> Update
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            <PlusCircle className="h-3 w-3" /> New
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 num text-ink-600">
                        {r.data?.serialNumber || String(r.raw['Serial No'] ?? r.raw['serial'] ?? '—')}
                      </td>
                      <td className="px-3 py-2 font-medium text-ink-900">
                        {r.data?.name ?? String(r.raw.name ?? r.raw.Name ?? r.raw['Device Model'] ?? '')}
                      </td>
                      <td className="px-3 py-2 num text-right font-medium text-ink-900">
                        {r.data?.rate ? `₹${r.data.rate.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-3 py-2 num text-right text-ink-700">
                        {r.data ? `${(r.data.gstRate * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-red-700">
                        {r.errors ? r.errors.join('; ') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-ink-500">
                {updateCount > 0 ? `Will update ${updateCount} existing device prices & details.` : ''}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button
                  onClick={commit}
                  disabled={busy || parseResult.validCount === 0}
                  className="btn-primary"
                >
                  {busy ? 'Processing...' : `Confirm Import (${parseResult.validCount} devices)`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

