# CHN Billing — Setup Guide

This is the production scaffold for **CHN TECHNOLOGIES PVT LTD** billing.
Stack: Next.js 14 + Firebase (Auth + Firestore + Storage) + Apps Script
Drive uploader. Premium light-mode UI.

## 1. Install dependencies

```cmd
cd /d "D:\Billing software"
npm install
```

## 2. Environment variables

Copy `.env.local.example` to `.env.local`. Firebase web keys are already
filled in for project `chn-invoives`. After deploying the Apps Script web
app (next step), paste in:

- `APPS_SCRIPT_URL` — the `/exec` deployment URL
- `APPS_SCRIPT_SECRET` — the same value you set in Script Properties

## 3. Apps Script Drive uploader

See `apps-script/README.md`. Quick version:

1. Open https://script.google.com → **New project** → paste `Code.gs` and
   the `appsscript.json` manifest from `apps-script/`.
2. Project Settings → **Script Properties**:
   - `SHARED_SECRET` — long random string (also goes in `.env.local`)
   - `ROOT_FOLDER_ID` — Drive folder where invoices will live
3. Deploy → New deployment → Web app → Execute as: **Me**, Access:
   **Anyone with the link**. Copy the `/exec` URL.

## 4. Firebase setup

If the Firebase CLI is not installed:
```cmd
npm install -g firebase-tools
firebase login
```

Initialise hosting on this folder (one-time):
```cmd
firebase use chn-invoives
```

Deploy rules:
```cmd
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

### First admin user

Firestore Security Rules require an admin to promote others. To bootstrap:

1. Run `npm run dev` and sign in once with your work email.
2. Open Firestore console → `users/{your uid}`.
3. Edit the `role` field from `viewer` to `admin`.
4. Sign out and back in. You can now access settings and user management.

## 5. Run the app locally

```cmd
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/login`.

## 6. Seed your current invoice number

Sign in as admin → Settings → Numbering → Seed current numbers. Enter your
last invoice number per document type. The next document issued will be
that number + 1.

## 7. Bulk-import devices

Settings or Products & Devices → Import Excel. Download the template,
fill in your devices, upload. Errors are flagged row-by-row.

## 8. Build & deploy

```cmd
npm run build
firebase deploy --only hosting
```

(For static-export hosting set `output: 'export'` in `next.config.mjs` or
deploy via Firebase App Hosting / Vercel for SSR.)

## What's wired up so far

- Auth + role guard
- Settings → Company (seeded with CHN defaults)
- Settings → Numbering (seed + autogenerate)
- Customers (CRUD with GSTIN/PAN validation)
- Products & Devices (CRUD + Excel import)
- Apps Script Drive uploader (deployable now)

## Coming next turn

- Quotation / Proforma / Tax Invoice / Credit Note editors
- PDF generation (server-side, deterministic)
- Drive backup hooked into the Issue button
- Reports (GSTR-1 ready CSV, sales register, aging)
