# CHN Billing — Master Spec

Single source of truth for the CHN TECHNOLOGIES billing ERP. This file
freezes the decisions extracted from the reference workbook
`Quotation,Proforma Invoice,Invoice Door Access pi.xlsx` and the user's
production brief.

## Company of record

- **Legal name:** CHN TECHNOLOGIES PVT LTD
- **GSTIN:** 33AAJCC3705A1ZC  ·  **PAN:** AAJCC3705A  ·  **State:** Tamil Nadu (33)
- **Address:** No, 28 Fourth Main Road, CIT Nagar, Chennai 600035, India
- **Email:** info@chnindia.com  ·  **Phone:** +91 98844 50030
- **Bank:** AXIS BANK · Current · A/c 921020014696411 · IFSC UTIB0003702
- **Account name:** CHN TECHNOLOGIES PRIVATE LIMITED
- **Footer line:** "For any enquiry, reach out via email at info@chnindia.com, call on +91 98844 50030"
- **Default GST rate:** 18%

## Document types

| Doc | Prefix (default) | Numbering | Has bank block | Has Due date | Notes |
|---|---|---|---|---|---|
| Quotation | `CHN/QT/{FY}/{seq}` | per-FY | no | no, has Valid Till | Has "Quotation From / Quotation For" headers |
| Proforma Invoice | `CHN/PI/{FY}/{seq}` | per-FY | yes | yes | Pre-payment |
| Tax Invoice | `CHN/INV/{FY}/{seq}` | per-FY | yes | yes | GST invoice |
| Credit Note | `CHN/CN/{FY}/{seq}` | per-FY | yes | yes | Linked to source invoice |

Settings → Numbering allows switching to continuous (no FY) and editing
prefixes. Seed once with your current legacy number; subsequent issues
auto-increment in a Firestore transaction.

## Tax engine

- Intra-state (customer.stateCode == 33): split tax 50/50 into CGST + SGST
- Inter-state (customer.stateCode != 33): single IGST line
- Round-off applied at grand total only (toggleable in settings)
- Amount-in-words rendered using Indian numbering system

## Line item shape

```
{
  productId, description, hsn,
  qty, rate, gstRate,
  amount = qty*rate - discount,
  cgst, sgst, igst, total,
  discount?, serials[]
}
```

Items may be composite (sub-children) and may have multiple S/N rows.

## Data model (Firestore)

```
settings/
  company         { ...CHN defaults }
  numbering       { prefix, pattern, pad }
  templates       { perDocType: { terms } }

users/{uid}                 { role: admin|accountant|sales|viewer }
counters/{key}              { value, updatedAt, updatedBy }
customers/{id}              { name, gstin, pan, billing, shipping, ... }
products/{id}               { name, hsn, gstRate, rate, unit, isService, ... }
quotations/{id}             { number, fy, dates, billedBy, billedTo, lineItems[], taxSummary, status, pdf }
proformas/{id}              { ... + bank block snapshot }
invoices/{id}               { ... + paymentStatus }
creditNotes/{id}            { ... + originalInvoiceId }
payments/{id}               { invoiceId, amount, mode, ref, date }
audit/{id}                  { who, when, what, before, after }
```

Snapshots: `billedBy` and `billedTo` are written into the doc at issue
time so later edits to company/customer don't rewrite history.

## Roles

| Role | Quote | Proforma | Invoice | Credit | Customers | Products | Settings | Users |
|---|---|---|---|---|---|---|---|---|
| admin | full | full | full | full | full | full | full | full |
| accountant | full | full | full | full | full | full | read | none |
| sales | full | draft | view | none | RW | read | none | none |
| viewer | read | read | read | read | read | read | none | none |

Enforced in Firestore rules and in privileged Cloud Functions (issue,
void, credit-note creation, settings change).

## PDF + Drive flow

1. User clicks **Issue** on a draft.
2. Server-side function (later: Cloud Function) renders PDF deterministically.
3. Number allocated via `counters/{docType}_{fy}` transaction.
4. PDF base64 + metadata POSTed to the Apps Script web app (`/exec`)
   with `secret`, `filename`, `fyYear`, `docType`, optional `overwriteFileId`.
5. Apps Script files into `<ROOT>/FY{yy}{yy}/{Type}/<filename>.pdf` and
   returns the Drive file ID and shareable URL.
6. Doc record updated with `{ pdf: { driveFileId, url, version, generatedAt } }`.
7. Audit entry written.

Re-issuing on edit overwrites the same Drive file (trash + recreate to
avoid Drive's cache of old preview thumbnails). `pdf.version` increments.

## UI direction

- Pure white surfaces, hairline 1px ink-200 borders, soft shadow on cards
- Brand: deep teal (`brand-600` = #1f8378). Confirm or swap.
- Fonts: Inter (UI) + Source Serif 4 (invoice headings + page titles)
- Tabular numerals everywhere amounts appear
- Print parity with PDF: same template engine renders both screen preview and the issued PDF

## Out of scope for v1

- e-Invoicing (IRN/QR via NIC) — adapter slot reserved
- Razorpay / PhonePe payment links — webhook adapter reserved
- WhatsApp delivery of PDFs — Cloud Tasks queue reserved
- Tally / Zoho export — JSON adapter reserved

These are scaffolded as future modules but not implemented in v1.

## Reports (v1)

- GSTR-1 ready CSV (B2B, B2C-Large, B2C-Small, HSN summary, CDNR)
- Sales register
- Outstanding aging (0-30, 31-60, 61-90, 90+)
- Customer-wise sales
- Product-wise sales
- Tax summary per period

## Repository layout

```
.agents/                   # Agent skills (cavecrew, caveman) — not shipped
apps-script/               # Drive uploader Code.gs + manifest
src/
  app/
    (app)/                 # auth-guarded shell
      dashboard/
      customers/
      products/
      quotations/
      proformas/
      invoices/
      credit-notes/
      settings/
        numbering/
        company/
        templates/
        users/
    login/
    layout.tsx
    page.tsx               # redirect → /dashboard
    providers.tsx
    globals.css
  components/
    app-shell.tsx
    auth-guard.tsx
    page-header.tsx
  lib/
    firebase/client.ts
    auth-context.tsx
    company.ts              # seeded defaults
    schemas.ts              # Zod, shared client+server
    money.ts                # tax + INR-in-words
    numbering.ts            # atomic allocation
    excel-import.ts         # device bulk import
    utils.ts
firebase.json
firestore.rules
firestore.indexes.json
storage.rules
.env.local.example
SETUP.md
MASTER_SPEC.md              # this file
```
