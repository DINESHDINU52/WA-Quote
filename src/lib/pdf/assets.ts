/**
 * Server-side asset loader for the PDF renderer. Reads the CHN logo from
 * `public/chn-logo.png` once and caches it as a base64 data URL so pdfmake
 * can embed it directly in the document header.
 */

import fs from 'node:fs';
import path from 'node:path';

let _logoDataUrl: string | null | undefined;
let _signatureDataUrl: string | null | undefined;
let _paymentQrDataUrl: string | null | undefined;

export function getLogoDataUrl(): string | null {
  if (_logoDataUrl !== undefined) return _logoDataUrl;
  try {
    const file = path.join(process.cwd(), 'public', 'chn-logo.png');
    const bytes = fs.readFileSync(file);
    _logoDataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch (err) {
    console.warn('[pdf] logo not found, rendering without it:', (err as Error).message);
    _logoDataUrl = null;
  }
  return _logoDataUrl;
}

export function getSignatureDataUrl(): string | null {
  if (_signatureDataUrl !== undefined) return _signatureDataUrl;
  try {
    const file = path.join(process.cwd(), 'public', 'Signature.png');
    const bytes = fs.readFileSync(file);
    _signatureDataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch (err) {
    console.warn('[pdf] signature not found, rendering without it:', (err as Error).message);
    _signatureDataUrl = null;
  }
  return _signatureDataUrl;
}

export function getPaymentQrDataUrl(): string | null {
  if (_paymentQrDataUrl !== undefined) return _paymentQrDataUrl;
  try {
    const file = path.join(process.cwd(), 'public', 'CHN QR NEW.png');
    const bytes = fs.readFileSync(file);
    _paymentQrDataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch (err) {
    console.warn('[pdf] payment QR not found, rendering without it:', (err as Error).message);
    _paymentQrDataUrl = null;
  }
  return _paymentQrDataUrl;
}
