# WA Quote SaaS ERP

**Billing & Invoicing ERP** — Customizable Quotation & Invoicing SaaS platform.

## Overview

WA Quote streamlines the entire sales documentation lifecycle:
- Quotations & Proforma Invoices with high-fidelity PDF export
- Customer & Product/Service catalog management
- Dynamic internal Product Catalog categorized by customizable groups
- Automated GST calculation (CGST+SGST / IGST)
- Role-based access control (Admin, Accountant, Sales, Viewer)
- Reports & analytics dashboard

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 3.4 |
| UI Components | Radix UI, Lucide React, Motion (Framer) |
| Forms | React Hook Form + Zod validation |
| Database | Google Cloud Firestore |
| Auth | Firebase Authentication (Email + Google OAuth) |
| PDF | pdfmake (client-side generation) |
| Hosting | Firebase Hosting |

## Getting Started

```bash
# Install dependencies
npm install

# Copy env file and fill in Firebase credentials
cp .env.local.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type check |

## Author

**DINESH** — Senior Executive, IT Department  
📞 93848 17813

---

*Proudly presented by CHN TECHNOLOGIES PVT LTD*
