/**
 * Server-side PDF renderer.
 *
 * pdfmake 0.2.x ships its fonts as a virtual filesystem of base64 TTFs in
 * `pdfmake/build/vfs_fonts.js` — the standalone `examples/fonts/*.ttf`
 * files were removed. We decode the four Roboto fonts to Buffers once and
 * hand them to pdfmake as in-memory font definitions, so no filesystem
 * lookup is needed at request time.
 */

import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { buildDocPdfDefinition } from './template';
import { getLogoDataUrl, getSignatureDataUrl, getPaymentQrDataUrl } from './assets';
import type { BillingDoc } from '../doc-types';

// `pdfmake/build/vfs_fonts.js` exports an object whose keys are filenames
// like "Roboto-Regular.ttf" and values are base64-encoded TTF bytes.
// (The shape changed across pdfmake versions; we tolerate either the
// `pdfMake.vfs` wrapper or a flat module.)

let _printer: PdfPrinter | null = null;

function loadFonts() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vfs = require('pdfmake/build/vfs_fonts.js') as
    | Record<string, string>
    | { pdfMake?: { vfs?: Record<string, string> } };
  const wrapped = (vfs as { pdfMake?: { vfs?: Record<string, string> } }).pdfMake?.vfs;
  const files: Record<string, string> = wrapped ?? (vfs as Record<string, string>);

  function buf(name: string): Buffer {
    const b64 = files[name];
    if (!b64) throw new Error(`Missing bundled font: ${name}`);
    return Buffer.from(b64, 'base64');
  }

  return {
    Roboto: {
      normal: buf('Roboto-Regular.ttf'),
      bold: buf('Roboto-Medium.ttf'),
      italics: buf('Roboto-Italic.ttf'),
      bolditalics: buf('Roboto-MediumItalic.ttf')
    }
  };
}

function getPrinter() {
  if (!_printer) _printer = new PdfPrinter(loadFonts() as any);
  return _printer;
}

export async function renderDocPdf(doc: BillingDoc): Promise<Buffer> {
  // Only use default CHN logo fallback if the company is actually CHN Technologies
  const isChn =
    !doc.company?.legalName ||
    doc.company.legalName.toLowerCase().includes('chn') ||
    Boolean(doc.company.shortName?.toLowerCase().includes('chn'));

  let logoToUse: string | null = null;
  if (doc.company?.logoBase64 && doc.company.logoBase64.startsWith('data:image/')) {
    logoToUse = doc.company.logoBase64;
  } else if (isChn) {
    logoToUse = getLogoDataUrl();
  }

  const definition: TDocumentDefinitions = buildDocPdfDefinition(doc, {
    logoDataUrl: logoToUse,
    signatureDataUrl: isChn ? getSignatureDataUrl() : null,
    paymentQrDataUrl: isChn ? getPaymentQrDataUrl() : null
  });
  const printer = getPrinter();
  const pdfDoc = printer.createPdfKitDocument(definition);
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on('data', (c) => chunks.push(c as Buffer));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
