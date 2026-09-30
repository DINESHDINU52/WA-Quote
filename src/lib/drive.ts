/**
 * Drive uploader client. Posts to the Apps Script Web App deployed from
 * apps-script/Code.gs. Server-only — never imported from client components.
 *
 * Folder structure on Drive:
 *   <ROOT_FOLDER_ID> / <Customer Name> / <Doc Type> / filename.pdf
 *
 * Required env:
 *   APPS_SCRIPT_URL      — full /exec deployment URL
 *   GOOGLE_FOLDER_ID     — root Drive folder ID (passed to Apps Script)
 *   APPS_SCRIPT_SECRET   — optional shared secret
 */

import type { DocType } from './numbering';

export interface DriveUploadInput {
  filename: string;
  pdf: Buffer;
  customerName: string;
  docType: DocType;
  overwriteFileId?: string;
  /** For PI auto-email: accounts team email. */
  emailTo?: string;
  /** Document number for the email subject. */
  docNumber?: string;
  /** Formatted grand total for the email body. */
  grandTotal?: string;
  /** Issue date string for the email body. */
  issueDate?: string;
  /** Customer email to show in the email template. */
  customerEmail?: string;
}

export interface DriveUploadResult {
  ok: boolean;
  fileId?: string;
  url?: string;
  downloadUrl?: string;
  folderPath?: string;
  error?: string;
  skipped?: boolean;
  emailSent?: boolean;
  emailTo?: string | null;
}

export async function uploadToDrive(input: DriveUploadInput): Promise<DriveUploadResult> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) {
    return {
      ok: true,
      skipped: true,
      error: 'APPS_SCRIPT_URL not configured; skipping Drive backup.'
    };
  }

  const secret = process.env.APPS_SCRIPT_SECRET || '';

  const body = {
    secret,
    filename: input.filename,
    mimeType: 'application/pdf',
    base64: input.pdf.toString('base64'),
    customerName: input.customerName,
    docType: input.docType,
    folderId: process.env.GOOGLE_FOLDER_ID || '',
    overwriteFileId: input.overwriteFileId,
    // Do NOT auto-email on PI issue. Only send email if caller explicitly passes emailTo.
    // PI_AUTO_EMAIL_TO is reserved for "paid" notifications only.
    emailTo: input.emailTo || '',
    docNumber: input.docNumber || '',
    grandTotal: input.grandTotal || '',
    issueDate: input.issueDate || '',
    customerEmail: input.customerEmail || ''
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'Apps Script returned non-JSON: ' + text.slice(0, 200) };
    }
    if (!parsed.ok) {
      return { ok: false, error: parsed.error || 'Apps Script error' };
    }
    return {
      ok: true,
      fileId: parsed.fileId,
      url: parsed.url,
      downloadUrl: parsed.downloadUrl,
      folderPath: parsed.folderPath,
      emailSent: parsed.emailSent || false,
      emailTo: parsed.emailTo || null
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error calling Apps Script' };
  }
}


// ---------------------------------------------------------------------------
// Payment reference upload
// ---------------------------------------------------------------------------

export interface PaymentRefUploadInput {
  filename: string;
  mimeType: string;
  base64: string;
  customerName: string;
  docNumber: string;
  /** e.g. "Installment 2" — creates a subfolder under Payment Reference/<docNumber>/ */
  installmentLabel?: string;
}

export interface PaymentRefUploadResult {
  ok: boolean;
  fileId?: string;
  url?: string;
  filename?: string;
  error?: string;
}

export async function uploadPaymentReference(
  input: PaymentRefUploadInput
): Promise<PaymentRefUploadResult> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: 'APPS_SCRIPT_URL not configured' };

  const body = {
    action: 'uploadPaymentRef',
    secret: process.env.APPS_SCRIPT_SECRET || '',
    filename: input.filename,
    mimeType: input.mimeType,
    base64: input.base64,
    customerName: input.customerName,
    docNumber: input.docNumber,
    installmentLabel: input.installmentLabel || '',
    folderId: process.env.GOOGLE_FOLDER_ID || ''
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.error || 'Upload failed' };
    return { ok: true, fileId: json.fileId, url: json.url, filename: json.filename };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

// ---------------------------------------------------------------------------
// Send reminder email
// ---------------------------------------------------------------------------

export interface ReminderEmailInput {
  to?: string;
  docNumber: string;
  customerName: string;
  grandTotal?: string;
  issueDate?: string;
  daysOverdue?: number;
  driveUrl?: string;
}

export async function sendReminderEmail(
  input: ReminderEmailInput
): Promise<{ ok: boolean; emailSent?: boolean; emailTo?: string; error?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: 'APPS_SCRIPT_URL not configured' };

  const body = {
    action: 'sendReminder',
    secret: process.env.APPS_SCRIPT_SECRET || '',
    to: input.to || process.env.REMINDER_EMAIL_TO || process.env.PI_AUTO_EMAIL_TO || '',
    docNumber: input.docNumber,
    customerName: input.customerName,
    grandTotal: input.grandTotal || '',
    issueDate: input.issueDate || '',
    daysOverdue: input.daysOverdue || 0,
    driveUrl: input.driveUrl || ''
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return { ok: json.ok, emailSent: json.emailSent, emailTo: json.emailTo, error: json.error };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

// ---------------------------------------------------------------------------
// Send paid notice email
// ---------------------------------------------------------------------------

export interface PaidInstallmentBlock {
  amount: number;
  paidAt: string;       // pre-formatted display string
  notes?: string;
  references: string[]; // Drive view URLs
}

export interface PaidNoticeInput {
  to?: string;
  docNumber: string;
  customerName: string;
  amountPaid: string;
  grandTotal?: string;
  paidAt: string;
  notes?: string;
  /** New installment-based payload (preferred). */
  installments?: PaidInstallmentBlock[];
  installmentCount?: number;
  /** Legacy flat reference URL list — kept for backward compat. */
  referenceUrls: string[];
  driveUrl?: string;
  paidPdfBase64?: string;
  paidPdfFilename?: string;
}

export async function sendPaidNoticeEmail(
  input: PaidNoticeInput
): Promise<{ ok: boolean; emailSent?: boolean; emailTo?: string; error?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: 'APPS_SCRIPT_URL not configured' };

  const body = {
    action: 'sendPaidNotice',
    secret: process.env.APPS_SCRIPT_SECRET || '',
    to: input.to || process.env.PI_AUTO_EMAIL_TO || '',
    docNumber: input.docNumber,
    customerName: input.customerName,
    amountPaid: input.amountPaid,
    grandTotal: input.grandTotal || '',
    paidAt: input.paidAt,
    notes: input.notes || '',
    installments: input.installments || [],
    installmentCount: input.installmentCount || (input.installments?.length ?? 0),
    referenceUrls: input.referenceUrls,
    driveUrl: input.driveUrl || '',
    paidPdfBase64: input.paidPdfBase64 || '',
    paidPdfFilename: input.paidPdfFilename || ''
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return { ok: json.ok, emailSent: json.emailSent, emailTo: json.emailTo, error: json.error };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}


// ---------------------------------------------------------------------------
// Send digest reminder (consolidated unpaid PIs)
// ---------------------------------------------------------------------------

export interface DigestItem {
  docNumber: string;
  customerName: string;
  companyName?: string;
  amount: number;
  issueDate: string;
  daysOld: number;
  driveUrl?: string;
}

export interface DigestEmailInput {
  to?: string;
  items: DigestItem[];
}

export async function sendDigestEmail(
  input: DigestEmailInput
): Promise<{ ok: boolean; emailSent?: boolean; emailTo?: string; count?: number; error?: string }> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return { ok: false, error: 'APPS_SCRIPT_URL not configured' };

  const body = {
    action: 'sendDigest',
    secret: process.env.APPS_SCRIPT_SECRET || '',
    to: input.to || process.env.REMINDER_EMAIL_TO || process.env.PI_AUTO_EMAIL_TO || '',
    items: input.items
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return {
      ok: json.ok,
      emailSent: json.emailSent,
      emailTo: json.emailTo,
      count: json.count,
      error: json.error
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}
