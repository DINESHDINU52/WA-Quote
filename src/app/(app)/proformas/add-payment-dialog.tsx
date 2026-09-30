'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth-context';
import type { BillingDoc, PaymentInstallment, PaymentReference } from '@/lib/doc-types';
import { getPaymentSummary, newInstallmentId } from '@/lib/payment-helpers';
import { formatINR } from '@/lib/utils';
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  IndianRupee
} from 'lucide-react';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3;

interface DocRow extends BillingDoc {
  id: string;
}

interface Props {
  doc: DocRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

interface PendingFile {
  file: File;
  preview: string;
  uploaded?: PaymentReference;
  uploading?: boolean;
  error?: string;
}

export function AddPaymentDialog({ doc: row, onClose, onSuccess }: Props) {
  const { profile } = useAuth();

  const summary = useMemo(() => getPaymentSummary(row), [row]);
  const grandTotal = row.taxSummary?.grandTotal ?? 0;
  const previousInstallmentCount = summary.installments.length;
  const nextInstallmentNumber = previousInstallmentCount + 1;
  const installmentLabel = `Installment ${nextInstallmentNumber}`;

  const [amount, setAmount] = useState<string>(String(summary.balance.toFixed(2)));
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = Number(amount) || 0;
  const exceedsBalance = numAmount > summary.balance + 1; // ₹1 tolerance
  const willCloseBalance = numAmount >= summary.balance - 1 && numAmount > 0;

  function handleFilesAdded(fileList: FileList | File[] | null) {
    if (!fileList) return;
    const arr = Array.from(fileList);
    const newOnes: PendingFile[] = [];
    let firstError: string | null = null;
    for (let i = 0; i < arr.length && files.length + newOnes.length < MAX_FILES; i++) {
      const f = arr[i];
      if (!f.type.startsWith('image/')) {
        firstError = `${f.name || 'file'}: not an image`;
        continue;
      }
      if (f.size > MAX_SIZE) {
        firstError = `${f.name || 'file'}: exceeds 5 MB`;
        continue;
      }
      newOnes.push({ file: f, preview: URL.createObjectURL(f) });
    }
    if (newOnes.length > 0) {
      setFiles((prev) => [...prev, ...newOnes]);
      setError(null);
    } else if (firstError) {
      setError(firstError);
    }
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---------- Paste & drag-drop handlers ---------------------------------
  // Listen for paste events globally while dialog is open
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (files.length >= MAX_FILES) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            // Pasted images often have generic names — give them a timestamp
            const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            const renamed = new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type });
            imgs.push(renamed);
          }
        }
      }
      if (imgs.length > 0) {
        e.preventDefault();
        handleFilesAdded(imgs);
      }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [files.length]);

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > 0) {
      handleFilesAdded(dropped);
    }
  }

  async function uploadOne(pending: PendingFile, idx: number): Promise<PaymentReference | null> {
    const base64 = await fileToBase64(pending.file);
    setFiles((prev) => prev.map((p, i) => (i === idx ? { ...p, uploading: true } : p)));
    try {
      const ext = pending.file.name.split('.').pop() || 'jpg';
      const filename = `${row.number.replace(/[\\/]/g, '-')}-inst${nextInstallmentNumber}-ref${idx + 1}-${Date.now()}.${ext}`;
      const res = await fetch('/api/payment/upload-ref', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          mimeType: pending.file.type,
          base64,
          customerName: row.customer.name,
          docNumber: row.number,
          installmentLabel
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Upload failed');
      const ref: PaymentReference = {
        fileId: json.fileId,
        url: json.url,
        filename: json.filename,
        size: pending.file.size,
        uploadedAt: Date.now()
      };
      setFiles((prev) => prev.map((p, i) => (i === idx ? { ...p, uploaded: ref, uploading: false } : p)));
      return ref;
    } catch (e: any) {
      setFiles((prev) => prev.map((p, i) => (i === idx ? { ...p, uploading: false, error: e?.message } : p)));
      return null;
    }
  }

  async function handleSubmit() {
    if (numAmount <= 0) {
      setError('Enter a valid amount greater than ₹0.');
      return;
    }
    if (exceedsBalance) {
      setError(`Amount exceeds outstanding balance of ${formatINR(summary.balance)}.`);
      return;
    }
    if (files.length === 0) {
      const ok = confirm('No payment reference image attached. Continue without proof?');
      if (!ok) return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload all pending images
      const refs: PaymentReference[] = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].uploaded) {
          refs.push(files[i].uploaded!);
          continue;
        }
        const ref = await uploadOne(files[i], i);
        if (ref) refs.push(ref);
      }

      // 2. Build the new installment object
      const newInstallment: PaymentInstallment = {
        id: newInstallmentId(),
        amount: numAmount,
        paidAt: new Date(paidAt).getTime(),
        paidBy: profile?.displayName || profile?.email || 'System',
        notes: notes.trim(),
        references: refs
      };

      // 3. Call API — handles closing logic + paid email when balance hits zero
      const updatedDoc: BillingDoc = {
        ...row,
        // Ensure preparedBy fallback so PAID PDF has the name
        preparedBy: row.preparedBy || profile?.displayName || profile?.email || 'System'
      };

      const apiRes = await fetch('/api/payment/add-installment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc: updatedDoc, newInstallment })
      });
      const apiJson = await apiRes.json();
      if (!apiJson.ok) throw new Error(apiJson.error || 'Failed to record payment');

      // 4. Persist to Firestore
      const firestoreUpdate: any = {
        paymentStatus: apiJson.status,
        payment: apiJson.payment,
        preparedBy: updatedDoc.preparedBy,
        updatedAt: serverTimestamp()
      };
      if (apiJson.status === 'paid' && apiJson.drive) {
        firestoreUpdate.pdf = {
          ...row.pdf,
          driveFileId: apiJson.drive.fileId || row.pdf?.driveFileId,
          url: apiJson.drive.url || row.pdf?.url,
          downloadUrl: apiJson.drive.downloadUrl || row.pdf?.downloadUrl,
          generatedAt: Date.now(),
          fileName: apiJson.filename
        };
      }
      await setDoc(doc(getDb(), 'proformas', row.id), firestoreUpdate, { merge: true });

      const totalPaid = apiJson.payment?.totalPaid ?? 0;
      const balance = apiJson.payment?.balance ?? 0;
      if (apiJson.status === 'paid') {
        onSuccess(
          `Marked as Paid in Full (${formatINR(totalPaid)}). ${
            apiJson.emailSent ? `Email sent to ${apiJson.emailTo}` : ''
          }`
        );
      } else {
        onSuccess(
          `Installment recorded: ${formatINR(numAmount)}. Balance: ${formatINR(balance)}.`
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-sm p-4"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="card w-full max-w-lg max-h-[92vh] overflow-y-auto relative">
        {/* Global drop overlay across whole modal */}
        {isDragging && files.length < MAX_FILES && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-brand-50/95 backdrop-blur-sm rounded-lg pointer-events-none border-4 border-dashed border-brand-400">
            <div className="text-center">
              <Upload className="h-12 w-12 mx-auto text-brand-600 mb-3 animate-bounce" />
              <div className="text-lg font-bold text-brand-700">Drop image{files.length === 0 ? 's' : ''} here</div>
              <div className="text-sm text-brand-600 mt-1">
                {MAX_FILES - files.length} more slot{MAX_FILES - files.length !== 1 ? 's' : ''} available
              </div>
            </div>
          </div>
        )}
        <div className="sticky top-0 bg-white border-b border-ink-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink-900">
              {previousInstallmentCount > 0 ? `Add Payment · ${installmentLabel}` : 'Record Payment'}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {row.number} · {row.customer.companyName || row.customer.name}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Balance summary */}
        <div className="px-6 py-4 bg-ink-50/60 border-b border-ink-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Total</div>
              <div className="text-sm font-bold text-ink-900 mt-1">{formatINR(grandTotal)}</div>
            </div>
            <div className="border-l border-r border-ink-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Paid So Far</div>
              <div className="text-sm font-bold text-emerald-700 mt-1">{formatINR(summary.totalPaid)}</div>
              {previousInstallmentCount > 0 && (
                <div className="text-[10px] text-ink-400 mt-0.5">
                  {previousInstallmentCount} installment{previousInstallmentCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Balance Due</div>
              <div className="text-sm font-bold text-amber-700 mt-1">{formatINR(summary.balance)}</div>
            </div>
          </div>
        </div>

        {/* Previous installments */}
        {summary.installments.length > 0 && (
          <div className="px-6 py-3 border-b border-ink-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">Previous Payments</div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {summary.installments.map((ins, i) => (
                <div key={ins.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-ink-400 font-mono">#{i + 1}</span>
                    <span className="text-ink-700">
                      {new Date(ins.paidAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    {ins.notes && <span className="text-ink-400 truncate">· {ins.notes}</span>}
                    {ins.references.length > 0 && (
                      <span className="text-[10px] text-brand-600 font-medium">
                        {ins.references.length} ref
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-ink-900 num">{formatINR(ins.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input num pl-9"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {exceedsBalance && (
                <p className="text-[11px] text-red-600 mt-1">
                  Exceeds balance of {formatINR(summary.balance)}
                </p>
              )}
              {willCloseBalance && !exceedsBalance && (
                <p className="text-[11px] text-emerald-700 mt-1 font-semibold">
                  ✓ This will close the balance
                </p>
              )}
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <input
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="UTR / Cheque No / Mode (e.g. UPI: AXIS123456789)"
            />
          </div>

          <div>
            <label className="label">Payment Proof (max 3 images, 5 MB each)</label>
            <div>
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-lg border border-ink-200 overflow-hidden bg-ink-50 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                    {f.uploading && (
                      <div className="absolute inset-0 bg-black/40 grid place-items-center">
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      </div>
                    )}
                    {f.uploaded && (
                      <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold rounded px-1 py-0.5">
                      #{i + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute bottom-1 right-1 bg-red-500 hover:bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-ink-300 hover:border-brand-400 hover:bg-brand-50/50 grid place-items-center cursor-pointer transition-colors">
                    <div className="text-center px-2">
                      <Upload className="h-5 w-5 mx-auto text-ink-400" />
                      <span className="text-[10px] text-ink-500 mt-1 block font-medium">
                        Click, Paste<br />or Drop
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      multiple={files.length === 0}
                      onChange={(e) => handleFilesAdded(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </div>
            <p className="text-[11px] text-ink-400 mt-1.5 flex items-center gap-3 flex-wrap">
              <span>
                {files.length} / {MAX_FILES} added
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded bg-ink-100 border border-ink-200 px-1.5 py-0.5 text-[10px] font-mono text-ink-700">Ctrl</kbd>
                <span>+</span>
                <kbd className="rounded bg-ink-100 border border-ink-200 px-1.5 py-0.5 text-[10px] font-mono text-ink-700">V</kbd>
                <span className="text-ink-500">to paste from clipboard</span>
              </span>
              <span className="text-ink-500">· Drag &amp; drop images anywhere</span>
              <span>
                · Saved to <code className="bg-ink-100 px-1 rounded">{installmentLabel}</code>
              </span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {willCloseBalance && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                This payment will close the balance. PI will be marked PAID, the PDF will be regenerated
                with watermark, and a confirmation email will be sent to accounts with all installments &amp;
                references.
              </span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-ink-50/80 backdrop-blur border-t border-ink-100 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || numAmount <= 0 || exceedsBalance}
            className="btn-primary"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {willCloseBalance ? 'Mark Paid in Full' : 'Record Installment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
