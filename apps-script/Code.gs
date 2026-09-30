/**
 * CHN TECHNOLOGIES — Drive Upload + Email Web App (v4)
 * ----------------------------------------------------------------------------
 * Routes (action field in POST body):
 *   • action="upload"          — upload PDF to customer folder + email accounts
 *   • action="uploadPaymentRef" — upload payment reference image to Payment Reference subfolder
 *   • action="sendReminder"     — send PI reminder email to a recipient
 *   • action="sendPaidNotice"   — send paid confirmation with refs to accounts
 *
 * Backwards-compatible: requests without "action" default to "upload".
 *
 * Deploy: Extensions → Apps Script → Deploy → New deployment → Web app
 *   • Execute as: Me
 *   • Who has access: Anyone with the link
 */

function getConfig_(key, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value || fallback || '';
}

var DOC_TYPE_FOLDERS = {
  quotation: 'Quotations',
  proforma: 'Proforma Invoices',
  invoice: 'Tax Invoices',
  creditNote: 'Credit Notes'
};

function doPost(e) {
  var startedAt = new Date();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_(400, { ok: false, error: 'Empty request body' });
    }
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse_(400, { ok: false, error: 'Invalid JSON' });
    }

    var expectedSecret = getConfig_('SHARED_SECRET');
    if (expectedSecret && payload.secret !== expectedSecret) {
      return jsonResponse_(401, { ok: false, error: 'Unauthorized' });
    }

    var action = payload.action || 'upload';

    if (action === 'uploadPaymentRef') {
      return handleUploadPaymentRef_(payload, startedAt);
    }
    if (action === 'sendReminder') {
      return handleSendReminder_(payload);
    }
    if (action === 'sendDigest') {
      return handleSendDigest_(payload);
    }
    if (action === 'sendPaidNotice') {
      return handleSendPaidNotice_(payload);
    }
    // default: upload PDF
    return handleUploadPdf_(payload, startedAt);
  } catch (err) {
    console.error('doPost error', err && err.stack ? err.stack : err);
    return jsonResponse_(500, { ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) {
    return jsonResponse_(200, { ok: true, service: 'chn-drive-upload', version: '4.0.0', timestamp: new Date().toISOString() });
  }
  return jsonResponse_(200, { ok: true, message: 'CHN TECHNOLOGIES Drive Upload + Email Web App. Use POST.' });
}

// ---------------------------------------------------------------------------
// Action: upload PDF (existing behavior)
// ---------------------------------------------------------------------------
function handleUploadPdf_(payload, startedAt) {
  var required = ['filename', 'base64', 'customerName', 'docType'];
  for (var i = 0; i < required.length; i++) {
    if (!payload[required[i]]) {
      return jsonResponse_(400, { ok: false, error: 'Missing required field: ' + required[i] });
    }
  }
  if (!DOC_TYPE_FOLDERS[payload.docType]) {
    return jsonResponse_(400, { ok: false, error: 'Unknown docType: ' + payload.docType });
  }
  var rootFolderId = payload.folderId || getConfig_('ROOT_FOLDER_ID');
  if (!rootFolderId) {
    return jsonResponse_(500, { ok: false, error: 'No folder ID' });
  }

  var mimeType = payload.mimeType || 'application/pdf';
  var bytes = Utilities.base64Decode(payload.base64);
  var blob = Utilities.newBlob(bytes, mimeType, payload.filename);

  var rootFolder = DriveApp.getFolderById(rootFolderId);
  var customerFolder = ensureFolder_(rootFolder, sanitizeFolderName_(payload.customerName));
  var docFolder = ensureFolder_(customerFolder, DOC_TYPE_FOLDERS[payload.docType]);

  var file;
  if (payload.overwriteFileId) {
    try {
      file = DriveApp.getFileById(payload.overwriteFileId);
      file.setTrashed(true);
    } catch (notFound) {}
  }
  file = docFolder.createFile(blob);
  file.setName(payload.filename);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  var driveUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

  // Auto-email on PI upload — ONLY if emailTo is explicitly passed in the request.
  // We no longer fall back to PI_AUTO_EMAIL_TO here, because that env var is reserved
  // for "Payment Received" notifications only (sent via the sendPaidNotice action).
  var emailSent = false;
  var emailTo = payload.emailTo || '';
  if (payload.docType === 'proforma' && emailTo) {
    try {
      sendPiEmail_(emailTo, payload, blob, driveUrl);
      emailSent = true;
    } catch (emailErr) {
      console.error('Email failed:', emailErr);
    }
  }

  return jsonResponse_(200, {
    ok: true,
    fileId: fileId,
    filename: payload.filename,
    url: driveUrl,
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
    folderPath: payload.customerName + '/' + DOC_TYPE_FOLDERS[payload.docType],
    emailSent: emailSent,
    emailTo: emailSent ? emailTo : null,
    elapsedMs: new Date().getTime() - startedAt.getTime()
  });
}

// ---------------------------------------------------------------------------
// Action: upload payment reference image
// Body: { action, secret, customerName, docNumber, filename, mimeType, base64, folderId }
// ---------------------------------------------------------------------------
function handleUploadPaymentRef_(payload, startedAt) {
  var required = ['filename', 'base64', 'customerName', 'docNumber'];
  for (var i = 0; i < required.length; i++) {
    if (!payload[required[i]]) {
      return jsonResponse_(400, { ok: false, error: 'Missing field: ' + required[i] });
    }
  }
  var rootFolderId = payload.folderId || getConfig_('ROOT_FOLDER_ID');
  if (!rootFolderId) return jsonResponse_(500, { ok: false, error: 'No folder ID' });

  var bytes = Utilities.base64Decode(payload.base64);
  var blob = Utilities.newBlob(bytes, payload.mimeType || 'image/jpeg', payload.filename);

  var rootFolder = DriveApp.getFolderById(rootFolderId);
  var customerFolder = ensureFolder_(rootFolder, sanitizeFolderName_(payload.customerName));
  var refFolder = ensureFolder_(customerFolder, 'Payment Reference');

  // Optional installment subfolder, e.g. "CHN-PI-25-26-0042 / Installment 2"
  var docFolder = refFolder;
  if (payload.docNumber) {
    docFolder = ensureFolder_(refFolder, sanitizeFolderName_(payload.docNumber));
  }
  var targetFolder = docFolder;
  if (payload.installmentLabel) {
    targetFolder = ensureFolder_(docFolder, sanitizeFolderName_(payload.installmentLabel));
  }

  var file = targetFolder.createFile(blob);
  file.setName(payload.filename);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  return jsonResponse_(200, {
    ok: true,
    fileId: fileId,
    filename: payload.filename,
    url: 'https://drive.google.com/file/d/' + fileId + '/view',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
    elapsedMs: new Date().getTime() - startedAt.getTime()
  });
}

// ---------------------------------------------------------------------------
// Action: send PI reminder email
// Body: { action, to, docNumber, customerName, grandTotal, issueDate, daysOverdue, driveUrl }
// ---------------------------------------------------------------------------
function handleSendReminder_(payload) {
  var to = payload.to || getConfig_('REMINDER_EMAIL_TO') || getConfig_('PI_AUTO_EMAIL_TO');
  if (!to) return jsonResponse_(400, { ok: false, error: 'No recipient email' });

  var subject = 'Reminder: Pending Payment for ' + (payload.docNumber || 'Proforma Invoice');
  var html = buildReminderHtml_(payload);

  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: html,
    name: 'CHN Billing — Reminder'
  });

  return jsonResponse_(200, { ok: true, emailSent: true, emailTo: to });
}

// ---------------------------------------------------------------------------
// Action: send paid notice with payment refs
// Body: { action, to, docNumber, customerName, amountPaid, paidAt, referenceUrls[], driveUrl }
// ---------------------------------------------------------------------------
function handleSendPaidNotice_(payload) {
  var to = payload.to || getConfig_('PI_AUTO_EMAIL_TO');
  if (!to) return jsonResponse_(400, { ok: false, error: 'No recipient email' });

  var subject = 'Payment Received — ' + (payload.docNumber || 'Proforma Invoice');
  var html = buildPaidNoticeHtml_(payload);

  // Attach PDF if provided
  var attachments = [];
  if (payload.paidPdfBase64 && payload.paidPdfFilename) {
    var pdfBytes = Utilities.base64Decode(payload.paidPdfBase64);
    attachments.push(Utilities.newBlob(pdfBytes, 'application/pdf', payload.paidPdfFilename));
  }

  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: html,
    attachments: attachments,
    name: 'CHN Billing — Payment Received'
  });

  return jsonResponse_(200, { ok: true, emailSent: true, emailTo: to });
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------
function sendPiEmail_(to, payload, pdfBlob, driveUrl) {
  var customerName = payload.customerName || 'Customer';
  var customerEmail = payload.customerEmail || '';
  var docNumber = payload.docNumber || payload.filename.replace('.pdf', '');
  var grandTotal = payload.grandTotal || '';
  var issueDate = payload.issueDate || new Date().toLocaleDateString('en-IN');

  var subject = 'Proforma Invoice ' + docNumber + ' — ' + customerName;
  var emailAttachment = Utilities.newBlob(pdfBlob.getBytes(), 'application/pdf', payload.filename);
  var html = buildPiIssuedHtml_({ customerName: customerName, customerEmail: customerEmail, docNumber: docNumber, grandTotal: grandTotal, issueDate: issueDate, driveUrl: driveUrl });

  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, attachments: [emailAttachment], name: 'CHN Billing' });
}

function buildPiIssuedHtml_(p) {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;background:#f4f5f6;font-family:Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">',
    '<tr><td style="background:#1f8378;padding:20px 32px;color:#fff;font-weight:bold;font-size:18px;">CHN TECHNOLOGIES PVT LTD</td></tr>',
    '<tr><td style="padding:32px;">',
    '<p style="margin:0 0 16px;color:#334048;">Dear Accounts Team,</p>',
    '<p style="margin:0 0 24px;color:#334048;">A new Proforma Invoice has been issued. Please find the details below and the PDF attached.</p>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eff2f4;border-radius:6px;margin-bottom:24px;">',
    '<tr style="background:#f8fafb;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Document</td><td style="padding:12px 16px;font-weight:bold;">' + p.docNumber + '</td></tr>',
    '<tr><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Customer</td><td style="padding:12px 16px;">' + p.customerName + '</td></tr>',
    p.customerEmail ? '<tr style="background:#f8fafb;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Customer Email</td><td style="padding:12px 16px;">' + p.customerEmail + '</td></tr>' : '',
    '<tr><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Issue Date</td><td style="padding:12px 16px;">' + p.issueDate + '</td></tr>',
    p.grandTotal ? '<tr style="background:#f8fafb;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Total</td><td style="padding:12px 16px;font-size:16px;color:#1c6962;font-weight:bold;">' + p.grandTotal + '</td></tr>' : '',
    '</table>',
    '<a href="' + p.driveUrl + '" style="display:inline-block;background:#1f8378;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View on Google Drive</a>',
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');
}

function buildReminderHtml_(p) {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;background:#f4f5f6;font-family:Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">',
    '<tr><td style="background:#d97706;padding:20px 32px;color:#fff;font-weight:bold;font-size:18px;">⏰ Payment Reminder</td></tr>',
    '<tr><td style="padding:32px;">',
    '<p style="margin:0 0 16px;color:#334048;">Hello,</p>',
    '<p style="margin:0 0 24px;color:#334048;">This is a friendly reminder that the following Proforma Invoice is pending payment.</p>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eff2f4;border-radius:6px;margin-bottom:24px;">',
    '<tr style="background:#fff7ed;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">PI Number</td><td style="padding:12px 16px;font-weight:bold;">' + (p.docNumber || '—') + '</td></tr>',
    '<tr><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Customer</td><td style="padding:12px 16px;">' + (p.customerName || '—') + '</td></tr>',
    '<tr style="background:#fff7ed;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Issued</td><td style="padding:12px 16px;">' + (p.issueDate || '—') + '</td></tr>',
    p.daysOverdue ? '<tr><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Days Pending</td><td style="padding:12px 16px;color:#d97706;font-weight:bold;">' + p.daysOverdue + ' days</td></tr>' : '',
    p.grandTotal ? '<tr style="background:#fff7ed;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Amount</td><td style="padding:12px 16px;font-size:16px;color:#d97706;font-weight:bold;">' + p.grandTotal + '</td></tr>' : '',
    '</table>',
    p.driveUrl ? '<a href="' + p.driveUrl + '" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View Invoice</a>' : '',
    '<p style="margin:24px 0 0;color:#5e6e76;font-size:12px;">Please mark as paid in WA Quote once payment is received.</p>',
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');
}

function buildPaidNoticeHtml_(p) {
  // Build per-installment blocks if installments[] is provided
  var installmentsHtml = '';
  if (p.installments && p.installments.length > 0) {
    installmentsHtml = '<div style="margin-top:8px;margin-bottom:16px;"><div style="font-weight:bold;color:#5e6e76;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;padding:8px 0;">PAYMENT INSTALLMENTS</div>';
    for (var i = 0; i < p.installments.length; i++) {
      var ins = p.installments[i];
      var refLinks = '';
      if (ins.references && ins.references.length > 0) {
        for (var r = 0; r < ins.references.length; r++) {
          refLinks += '<a href="' + ins.references[r] + '" style="display:inline-block;margin-right:8px;color:#1f8378;font-size:12px;text-decoration:none;">📎 Ref ' + (r + 1) + '</a>';
        }
      }
      installmentsHtml += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid #d1fae5;border-radius:6px;background:#f0fdf4;">' +
        '<tr><td style="padding:12px 16px;">' +
        '<div style="font-size:13px;color:#065f46;font-weight:bold;margin-bottom:4px;">Installment ' + (i + 1) + ' — ₹' + Number(ins.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) + '</div>' +
        '<div style="font-size:11px;color:#5e6e76;margin-bottom:6px;">' +
          'Date: ' + (ins.paidAt || '—') +
          (ins.notes ? '<br>Notes: ' + ins.notes : '') +
        '</div>' +
        (refLinks ? '<div>' + refLinks + '</div>' : '') +
        '</td></tr></table>';
    }
    installmentsHtml += '</div>';
  } else if (p.referenceUrls && p.referenceUrls.length > 0) {
    // Backwards-compat: flat refs (legacy single-payment)
    installmentsHtml = '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">';
    installmentsHtml += '<tr><td style="font-weight:bold;color:#5e6e76;font-size:12px;padding:8px 0;">PAYMENT REFERENCES:</td></tr>';
    for (var k = 0; k < p.referenceUrls.length; k++) {
      installmentsHtml += '<tr><td style="padding:4px 0;"><a href="' + p.referenceUrls[k] + '" style="color:#1f8378;font-size:13px;">📎 Reference ' + (k + 1) + '</a></td></tr>';
    }
    installmentsHtml += '</table>';
  }

  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;background:#f4f5f6;font-family:Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">',
    '<table width="650" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:100%;">',
    '<tr><td style="background:#059669;padding:20px 32px;color:#fff;font-weight:bold;font-size:18px;">✓ Payment Received — Fully Paid</td></tr>',
    '<tr><td style="padding:32px;">',
    '<p style="margin:0 0 16px;color:#334048;">Dear Accounts Team,</p>',
    '<p style="margin:0 0 24px;color:#334048;">Full payment has been received and recorded for the following Proforma Invoice. All payment installments and references are listed below.</p>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eff2f4;border-radius:6px;margin-bottom:16px;">',
    '<tr style="background:#ecfdf5;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">PI Number</td><td style="padding:12px 16px;font-weight:bold;">' + (p.docNumber || '—') + '</td></tr>',
    '<tr><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Customer</td><td style="padding:12px 16px;">' + (p.customerName || '—') + '</td></tr>',
    '<tr style="background:#ecfdf5;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Grand Total</td><td style="padding:12px 16px;font-weight:bold;">' + (p.grandTotal || p.amountPaid || '—') + '</td></tr>',
    '<tr><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Total Paid</td><td style="padding:12px 16px;font-size:16px;color:#059669;font-weight:bold;">' + (p.amountPaid || '—') + '</td></tr>',
    '<tr style="background:#ecfdf5;"><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Closed On</td><td style="padding:12px 16px;">' + (p.paidAt || new Date().toLocaleDateString('en-IN')) + '</td></tr>',
    p.installmentCount ? '<tr><td style="padding:12px 16px;font-size:12px;color:#5e6e76;font-weight:bold;">Installments</td><td style="padding:12px 16px;">' + p.installmentCount + ' payment' + (p.installmentCount > 1 ? 's' : '') + '</td></tr>' : '',
    '</table>',
    installmentsHtml,
    p.driveUrl ? '<a href="' + p.driveUrl + '" style="display:inline-block;margin-top:8px;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">View Paid Invoice on Drive</a>' : '',
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------
function ensureFolder_(parent, name) {
  var iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

function sanitizeFolderName_(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown Customer';
}

function jsonResponse_(status, body) {
  body.status = status;
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function setupScriptProperties() {
  PropertiesService.getScriptProperties().setProperties({
    SHARED_SECRET: '',
    ROOT_FOLDER_ID: '1wo-K9RYgEYwKH81TsER8AjQex155SU1u',
    PI_AUTO_EMAIL_TO: '',
    REMINDER_EMAIL_TO: ''
  });
  console.log('Properties saved.');
}


// ---------------------------------------------------------------------------
// Action: send digest reminder (consolidated single email for ALL unpaid PIs)
// Body: { action, to, items: [{ docNumber, customerName, companyName, amount, issueDate, daysOld, driveUrl }] }
// ---------------------------------------------------------------------------
function handleSendDigest_(payload) {
  var to = payload.to || getConfig_('REMINDER_EMAIL_TO') || getConfig_('PI_AUTO_EMAIL_TO');
  if (!to) return jsonResponse_(400, { ok: false, error: 'No recipient email' });

  var items = payload.items || [];
  if (items.length === 0) {
    return jsonResponse_(200, { ok: true, emailSent: false, message: 'No unpaid items to report' });
  }

  var totalAmount = 0;
  for (var i = 0; i < items.length; i++) {
    totalAmount += Number(items[i].amount || 0);
  }
  var totalAmountStr = '₹' + totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var subject = '⏰ Pending Payments Digest — ' + items.length + ' unpaid PI(s) · ' + totalAmountStr;
  var html = buildDigestHtml_(items, totalAmountStr);

  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: html,
    name: 'CHN Billing — Daily Digest'
  });

  return jsonResponse_(200, { ok: true, emailSent: true, emailTo: to, count: items.length });
}

function buildDigestHtml_(items, totalAmountStr) {
  var rows = '';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var bg = i % 2 === 0 ? '#ffffff' : '#fff7ed';
    var nameDisplay = it.companyName || it.customerName || '—';
    var contactLine = it.companyName && it.customerName ? '<div style="font-size:11px;color:#5e6e76;margin-top:2px;">' + it.customerName + '</div>' : '';
    var driveLink = it.driveUrl ? '<a href="' + it.driveUrl + '" style="color:#1f8378;font-size:11px;text-decoration:none;">View PDF →</a>' : '';
    rows += '<tr style="background:' + bg + ';">' +
      '<td style="padding:10px 12px;font-size:13px;color:#131a1f;border-bottom:1px solid #eff2f4;font-weight:bold;">' + (it.docNumber || '—') + '</td>' +
      '<td style="padding:10px 12px;font-size:13px;color:#131a1f;border-bottom:1px solid #eff2f4;">' + nameDisplay + contactLine + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:#5e6e76;border-bottom:1px solid #eff2f4;">' + (it.issueDate || '—') + '</td>' +
      '<td style="padding:10px 12px;font-size:13px;color:' + (it.daysOld >= 7 ? '#dc2626' : '#d97706') + ';border-bottom:1px solid #eff2f4;font-weight:bold;text-align:center;">' + (it.daysOld || 0) + ' days</td>' +
      '<td style="padding:10px 12px;font-size:13px;color:#131a1f;border-bottom:1px solid #eff2f4;text-align:right;font-weight:bold;">' + (it.amount ? '₹' + Number(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—') + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #eff2f4;">' + driveLink + '</td>' +
      '</tr>';
  }

  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;background:#f4f5f6;font-family:Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">',
    '<table width="800" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:100%;">',
    '<tr><td style="background:#d97706;padding:24px 32px;color:#fff;">',
    '<div style="font-size:20px;font-weight:bold;">⏰ Pending Payments Digest</div>',
    '<div style="font-size:13px;opacity:0.9;margin-top:4px;">' + new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) + '</div>',
    '</td></tr>',
    '<tr><td style="padding:24px 32px;">',
    '<p style="margin:0 0 16px;color:#334048;font-size:14px;">Dear Accounts Team,</p>',
    '<p style="margin:0 0 20px;color:#334048;font-size:14px;line-height:1.6;">',
    'Below is the summary of all pending Proforma Invoices that require follow-up. ',
    'Please review and reach out to the respective customers.',
    '</p>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;">',
    '<tr><td style="padding:14px 18px;">',
    '<div style="display:inline-block;margin-right:32px;"><span style="font-size:11px;color:#9a3412;font-weight:bold;text-transform:uppercase;">Total Unpaid</span><div style="font-size:22px;color:#9a3412;font-weight:bold;margin-top:2px;">' + items.length + '</div></div>',
    '<div style="display:inline-block;"><span style="font-size:11px;color:#9a3412;font-weight:bold;text-transform:uppercase;">Total Amount Pending</span><div style="font-size:22px;color:#9a3412;font-weight:bold;margin-top:2px;">' + totalAmountStr + '</div></div>',
    '</td></tr></table>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eff2f4;border-radius:6px;overflow:hidden;border-collapse:collapse;">',
    '<thead><tr style="background:#f8fafb;">',
    '<th style="padding:10px 12px;font-size:11px;color:#5e6e76;text-transform:uppercase;text-align:left;border-bottom:2px solid #eff2f4;">PI Number</th>',
    '<th style="padding:10px 12px;font-size:11px;color:#5e6e76;text-transform:uppercase;text-align:left;border-bottom:2px solid #eff2f4;">Customer</th>',
    '<th style="padding:10px 12px;font-size:11px;color:#5e6e76;text-transform:uppercase;text-align:left;border-bottom:2px solid #eff2f4;">Issued On</th>',
    '<th style="padding:10px 12px;font-size:11px;color:#5e6e76;text-transform:uppercase;text-align:center;border-bottom:2px solid #eff2f4;">Pending</th>',
    '<th style="padding:10px 12px;font-size:11px;color:#5e6e76;text-transform:uppercase;text-align:right;border-bottom:2px solid #eff2f4;">Amount</th>',
    '<th style="padding:10px 12px;font-size:11px;color:#5e6e76;text-transform:uppercase;border-bottom:2px solid #eff2f4;"></th>',
    '</tr></thead><tbody>' + rows + '</tbody></table>',
    '<p style="margin:24px 0 0;color:#5e6e76;font-size:11px;line-height:1.5;">',
    'This is an automated daily digest from WA Quote. ',
    'PIs marked with "Skip Reminder" are excluded from this report.',
    '</p>',
    '</td></tr></table></td></tr></table></body></html>'
  ].join('');
}
