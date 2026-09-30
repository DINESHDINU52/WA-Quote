'use client';

import { PageHeader } from '@/components/page-header';
import {
  BookOpen,
  Monitor,
  Users,
  FileText,
  ShoppingCart,
  Settings,
  Shield,
  Workflow,
  Smartphone,
  Database,
  Zap,
  HelpCircle,
  Phone,
  Mail,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  LayoutDashboard,
  Package,
  Receipt,
  BarChart3,
  Wrench,
  Palette,
  Bell,
  CreditCard,
  Truck,
  ImageIcon,
  Download,
  IndianRupee,
} from 'lucide-react';

const APP_VERSION = '2.0.0';
const RELEASE_DATE = 'May 2026';

export default function DocumentationPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Documentation"
        description="Complete system documentation, wireframes, and user guide for WA Quote"
      />

      {/* Author & Credits Banner */}
      <div className="mb-8 rounded-2xl overflow-hidden border border-brand-200/60 bg-gradient-to-br from-brand-50 via-white to-brand-50/30 shadow-sm">
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white font-black text-lg shadow-md shadow-brand-500/20">
              D
            </div>
            <div>
              <div className="text-xs font-bold text-brand-600 uppercase tracking-wider">Author & Developer</div>
              <div className="text-lg font-extrabold text-ink-900 mt-0.5">DINESH</div>
              <div className="text-sm text-ink-600 font-medium">Senior Executive — IT Department</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Phone className="h-3.5 w-3.5" />
              <span className="font-semibold">93848 17813</span>
            </div>
            <div className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mt-1">
              Proudly Presented By
            </div>
            <div className="text-sm font-extrabold text-ink-900">CHN TECHNOLOGIES PVT LTD</div>
          </div>
        </div>
        <div className="px-6 py-3 bg-brand-600/5 border-t border-brand-100/60 flex items-center justify-between">
          <span className="text-[11px] font-bold text-ink-500">Version {APP_VERSION} • Released {RELEASE_DATE}</span>
          <span className="text-[11px] font-bold text-brand-600">WA Quote — Billing & Invoicing ERP</span>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-brand-600" />
          Table of Contents
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: '1. System Overview', anchor: '#overview' },
            { label: '2. Architecture & Tech Stack', anchor: '#architecture' },
            { label: '3. Application Wireframes', anchor: '#wireframes' },
            { label: '4. Module Documentation', anchor: '#modules' },
            { label: '5. Payment Tracking & Reminders', anchor: '#payments' },
            { label: '6. Shipping Address (PI)', anchor: '#shipping' },
            { label: '7. Product Catalog', anchor: '#catalog' },
            { label: '8. PWA & Offline Support', anchor: '#pwa' },
            { label: '9. User Roles & Permissions', anchor: '#roles' },
            { label: '10. Workflow & Processes', anchor: '#workflow' },
            { label: '11. Security & Access Control', anchor: '#security' },
            { label: '12. Support & Contact', anchor: '#support' },
          ].map((item) => (
            <a
              key={item.anchor}
              href={item.anchor}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5 text-brand-500" />
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* 1. System Overview */}
      <section id="overview" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-3 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-brand-600" />
          1. System Overview
        </h2>
        <p className="text-sm text-ink-600 leading-relaxed mb-4">
          WA Quote is a comprehensive Billing & Invoicing SaaS ERP system designed for
          streamlining the entire sales documentation lifecycle — from generating quotations
          and proforma invoices to managing customers, products & services, service charges,
          and financial reports.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Platform', value: 'Web App + PWA (Next.js 14)' },
            { label: 'Database', value: 'Google Cloud Firestore' },
            { label: 'Authentication', value: 'Firebase Auth (Email + Google)' },
            { label: 'PDF Generation', value: 'pdfmake (Server-side)' },
            { label: 'Drive Backup', value: 'Google Apps Script + Drive API' },
            { label: 'Email Engine', value: 'Apps Script MailApp (Gmail)' },
            { label: 'Hosting', value: 'Vercel + Firebase Hosting' },
            { label: 'UI Framework', value: 'Tailwind CSS + Radix UI' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-ink-50/50 border border-ink-100/60 px-3 py-2.5">
              <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">{item.label}</div>
              <div className="text-xs font-semibold text-ink-800 mt-0.5">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Architecture & Tech Stack */}
      <section id="architecture" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-3 flex items-center gap-2">
          <Database className="h-5 w-5 text-brand-600" />
          2. Architecture & Tech Stack
        </h2>
        <div className="space-y-4">
          <div className="rounded-xl border border-ink-100/60 bg-ink-50/30 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Frontend</h3>
            <ul className="space-y-1.5 text-xs text-ink-600">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Next.js 14 (App Router) with React 18 — Server & Client Components</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Tailwind CSS 3.4 for utility-first responsive styling</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Radix UI primitives (Dialog, Select, Dropdown, Toast)</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Lucide React icons for consistent iconography</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> React Hook Form + Zod for type-safe form validation</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Motion (Framer Motion) for smooth UI animations</li>
            </ul>
          </div>
          <div className="rounded-xl border border-ink-100/60 bg-ink-50/30 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Backend & Infrastructure</h3>
            <ul className="space-y-1.5 text-xs text-ink-600">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Firebase Authentication — Email/Password + Google OAuth</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Cloud Firestore — NoSQL real-time database with security rules</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Firebase Hosting — CDN-backed static + SSR deployment</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Google Apps Script — Automated Google Sheets integration</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> pdfmake — Client-side PDF generation for quotations & invoices</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Application Wireframes */}
      <section id="wireframes" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-3 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-brand-600" />
          3. Application Wireframes & Screen Flow
        </h2>
        <p className="text-sm text-ink-500 mb-5">
          Visual layout structure of each major screen in the application.
        </p>

        {/* Login Screen Wireframe */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-ink-800 mb-3">3.1 Login Screen</h3>
          <div className="rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 p-6">
            <div className="max-w-xs mx-auto space-y-3">
              <div className="h-4 w-20 bg-ink-200 rounded mx-auto" />
              <div className="h-16 w-16 bg-brand-100 rounded-xl mx-auto border border-brand-200" />
              <div className="h-3 w-32 bg-ink-200 rounded mx-auto" />
              <div className="h-2 w-24 bg-ink-100 rounded mx-auto" />
              <div className="mt-4 space-y-2">
                <div className="h-9 w-full bg-white rounded-lg border border-ink-200 flex items-center px-3">
                  <div className="h-3 w-3 bg-ink-200 rounded mr-2" /><div className="h-2 w-24 bg-ink-100 rounded" />
                </div>
                <div className="h-9 w-full bg-white rounded-lg border border-ink-200 flex items-center px-3">
                  <div className="h-3 w-3 bg-ink-200 rounded mr-2" /><div className="h-2 w-16 bg-ink-100 rounded" />
                </div>
                <div className="h-9 w-full bg-brand-500 rounded-lg" />
              </div>
              <div className="h-px w-full bg-ink-200 my-2" />
              <div className="h-9 w-full bg-white rounded-lg border border-ink-200" />
              <div className="flex justify-between mt-3">
                <div className="h-2 w-20 bg-ink-100 rounded" />
                <div className="h-2 w-16 bg-ink-100 rounded" />
              </div>
            </div>
            <p className="text-center text-[10px] text-ink-400 font-semibold mt-4 uppercase tracking-wider">
              Login — Email/Password + Google OAuth + Author Credit
            </p>
          </div>
        </div>

        {/* Dashboard Wireframe */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-ink-800 mb-3">3.2 Dashboard</h3>
          <div className="rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 p-6">
            <div className="flex gap-4">
              {/* Sidebar */}
              <div className="w-40 space-y-2 flex-shrink-0">
                <div className="h-10 w-full bg-brand-100 rounded-lg border border-brand-200" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`h-6 w-full rounded ${i === 0 ? 'bg-brand-500' : 'bg-ink-100'}`} />
                ))}
              </div>
              {/* Main content */}
              <div className="flex-1 space-y-3">
                <div className="h-6 w-40 bg-ink-200 rounded" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-16 bg-white rounded-lg border border-ink-200" />
                  <div className="h-16 bg-white rounded-lg border border-ink-200" />
                  <div className="h-16 bg-white rounded-lg border border-ink-200" />
                </div>
                <div className="h-32 bg-white rounded-lg border border-ink-200" />
              </div>
            </div>
            <p className="text-center text-[10px] text-ink-400 font-semibold mt-4 uppercase tracking-wider">
              Dashboard — Stats Cards + Recent Activity + Sidebar Navigation
            </p>
          </div>
        </div>

        {/* Quotation/Proforma Wireframe */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-ink-800 mb-3">3.3 Quotation / Proforma Invoice Form</h3>
          <div className="rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 p-6">
            <div className="flex gap-4">
              <div className="w-40 space-y-2 flex-shrink-0">
                <div className="h-10 w-full bg-brand-100 rounded-lg border border-brand-200" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`h-6 w-full rounded ${i === 3 ? 'bg-brand-500' : 'bg-ink-100'}`} />
                ))}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-5 w-36 bg-ink-200 rounded" />
                  <div className="h-7 w-20 bg-brand-500 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-8 bg-white rounded border border-ink-200" />
                  <div className="h-8 bg-white rounded border border-ink-200" />
                </div>
                <div className="h-px bg-ink-200" />
                <div className="space-y-2">
                  <div className="h-7 bg-ink-100 rounded flex items-center px-2 gap-2">
                    <div className="h-3 w-8 bg-ink-200 rounded" />
                    <div className="h-3 flex-1 bg-ink-200 rounded" />
                    <div className="h-3 w-12 bg-ink-200 rounded" />
                    <div className="h-3 w-10 bg-ink-200 rounded" />
                  </div>
                  <div className="h-7 bg-white rounded border border-ink-200" />
                  <div className="h-7 bg-white rounded border border-ink-200" />
                </div>
                <div className="flex justify-end">
                  <div className="w-32 space-y-1">
                    <div className="h-3 w-full bg-ink-100 rounded" />
                    <div className="h-3 w-full bg-ink-100 rounded" />
                    <div className="h-4 w-full bg-brand-100 rounded" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-ink-400 font-semibold mt-4 uppercase tracking-wider">
              Document Form — Customer Select + Line Items + Tax Calculation + PDF Export
            </p>
          </div>
        </div>

        {/* Catalog Wireframe */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-ink-800 mb-3">3.4 Product Catalog</h3>
          <div className="rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 p-6">
            <div className="flex gap-4">
              <div className="w-40 space-y-2 flex-shrink-0">
                <div className="h-10 w-full bg-brand-100 rounded-lg border border-brand-200" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`h-6 w-full rounded ${i === 2 ? 'bg-brand-500' : 'bg-ink-100'}`} />
                ))}
              </div>
              <div className="flex-1 space-y-3">
                <div className="h-5 w-32 bg-ink-200 rounded" />
                <div className="h-8 bg-white rounded-lg border border-ink-200" />
                <div className="space-y-2">
                  <div className="h-8 bg-ink-100 rounded-lg flex items-center px-3 justify-between">
                    <div className="h-3 w-28 bg-ink-200 rounded" />
                    <div className="h-3 w-12 bg-brand-200 rounded" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 pl-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-20 bg-white rounded-lg border border-ink-200 flex flex-col items-center justify-center gap-1">
                        <div className="h-8 w-8 bg-ink-100 rounded" />
                        <div className="h-2 w-12 bg-ink-200 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-ink-400 font-semibold mt-4 uppercase tracking-wider">
              Catalog — Category Tabs + Product Cards + Live Pricing & Quotes
            </p>
          </div>
        </div>

        {/* Settings Wireframe */}
        <div>
          <h3 className="text-sm font-bold text-ink-800 mb-3">3.5 Settings Panel</h3>
          <div className="rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 p-6">
            <div className="flex gap-4">
              <div className="w-40 space-y-2 flex-shrink-0">
                <div className="h-10 w-full bg-brand-100 rounded-lg border border-brand-200" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`h-6 w-full rounded ${i === 7 ? 'bg-brand-500' : 'bg-ink-100'}`} />
                ))}
              </div>
              <div className="flex-1 space-y-3">
                <div className="h-5 w-24 bg-ink-200 rounded" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 bg-white rounded-lg border border-ink-200 flex items-center gap-2 px-3">
                      <div className="h-8 w-8 bg-brand-50 rounded-md flex-shrink-0" />
                      <div className="space-y-1">
                        <div className="h-3 w-16 bg-ink-200 rounded" />
                        <div className="h-2 w-24 bg-ink-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-ink-400 font-semibold mt-4 uppercase tracking-wider">
              Settings — Card Grid (Numbering, Company, Templates, Users, Access, Docs)
            </p>
          </div>
        </div>
      </section>

      {/* 4. Module Documentation */}
      <section id="modules" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-brand-600" />
          4. Module Documentation
        </h2>
        <div className="space-y-4">
          {[
            {
              icon: LayoutDashboard,
              title: 'Dashboard',
              path: '/dashboard',
              desc: 'Overview of business metrics — total quotations, proformas, revenue summaries, and recent activity feed. Provides quick-glance KPIs for the sales team.',
            },
            {
              icon: Users,
              title: 'Customers',
              path: '/customers',
              desc: 'Full customer database with company name, GSTIN, billing/shipping addresses, contact person, phone, and email. Supports add, edit, delete operations with real-time Firestore sync.',
            },
            {
              icon: Package,
              title: 'Products & Services',
              path: '/products',
              desc: 'Product & service master — SKU/code, category, HSN/SAC code, features, specifications, and selling prices. Supports bulk import and export via Excel/CSV.',
            },
            {
              icon: BookOpen,
              title: 'Product Catalog',
              path: '/catalog',
              desc: 'Interactive internal product catalog organized by category with live Firestore sync, search, specifications, and instant quotation actions.',
            },
            {
              icon: Wrench,
              title: 'Installation Charges',
              path: '/installation',
              desc: 'Configurable installation service charges that can be added as line items in quotations. Includes labor, cabling, and commissioning rates.',
            },
            {
              icon: FileText,
              title: 'Quotations',
              path: '/quotations',
              desc: 'Create, view, edit, and export quotations as PDF. Supports customer selection, line items with quantity/price, GST calculation (CGST+SGST or IGST), terms & conditions, and auto-numbering.',
            },
            {
              icon: Receipt,
              title: 'Proforma Invoices',
              path: '/proformas',
              desc: 'Generate proforma invoices from scratch or convert from existing quotations. Same feature set as quotations with separate numbering sequence and PI-specific terms.',
            },
            {
              icon: BarChart3,
              title: 'Reports',
              path: '/reports',
              desc: 'Business intelligence reports — monthly revenue, quotation conversion rates, top customers, product-wise sales analysis, and exportable data tables.',
            },
            {
              icon: Settings,
              title: 'Settings',
              path: '/settings',
              desc: 'System configuration hub — document numbering, company profile, terms templates, user management, access control whitelist, theme customization, and this documentation.',
            },
          ].map((mod) => (
            <div key={mod.path} className="flex items-start gap-3 rounded-lg border border-ink-100/60 bg-ink-50/20 p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                <mod.icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-900">{mod.title}</span>
                  <code className="text-[10px] font-mono bg-ink-100 text-ink-500 px-1.5 py-0.5 rounded">{mod.path}</code>
                </div>
                <p className="text-xs text-ink-600 mt-1 leading-relaxed">{mod.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Payment Tracking & Reminders */}
      <section id="payments" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-brand-600" />
          5. Payment Tracking, Installments & Reminders
        </h2>
        <p className="text-sm text-ink-600 leading-relaxed mb-5">
          Proforma Invoices support <span className="font-bold">multiple part-payments (installments)</span>.
          A PI moves through three states based on how much has been collected versus the grand total:
        </p>

        {/* Status flow */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-center">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">Unpaid</div>
            <div className="text-[11px] text-amber-700/80 mt-1">No payment received yet</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-center">
            <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Partial</div>
            <div className="text-[11px] text-indigo-700/80 mt-1">Some installments received, balance &gt; ₹1</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-center">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Paid</div>
            <div className="text-[11px] text-emerald-700/80 mt-1">Total collected ≥ Grand Total (₹1 tolerance)</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-bold text-ink-900">Add Payment Workflow</span>
            </div>
            <ul className="space-y-1.5 text-xs text-ink-600">
              <li>• Click <span className="font-bold text-emerald-700">Mark Paid</span> (first time) or <span className="font-bold text-emerald-700">Add Payment</span> (subsequent)</li>
              <li>• Dialog auto-fills with the outstanding balance</li>
              <li>• Enter amount, date, notes (UTR / Cheque / mode)</li>
              <li>• Upload up to <span className="font-bold">3 reference images</span> (5 MB each, image-only)</li>
              <li>• Each installment&apos;s images go to a <span className="font-bold">separate sub-folder</span> on Drive</li>
              <li>• <span className="font-bold text-red-600">Over-payment is blocked</span> at the API level</li>
              <li>• Past installments are <span className="font-bold">append-only</span> (immutable audit trail)</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-ink-900">Reminder Digest</span>
            </div>
            <ul className="space-y-1.5 text-xs text-ink-600">
              <li>• <span className="font-bold text-amber-700">Send Digest</span> button at the top of PI listing</li>
              <li>• Sends ONE email with ALL outstanding PIs in a single table</li>
              <li>• Each row shows <span className="font-bold">balance remaining</span> (not full PI total)</li>
              <li>• Recipient: <code className="bg-ink-100 px-1 rounded">REMINDER_EMAIL_TO</code></li>
              <li>• Each PI has a <span className="font-bold">Notify / Skipped</span> toggle</li>
              <li>• Skipped PIs are excluded from the digest until re-enabled</li>
              <li>• Fully paid PIs are auto-excluded</li>
            </ul>
          </div>
        </div>

        {/* Installment closing flow */}
        <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white p-4 mb-5">
          <h3 className="text-sm font-bold text-ink-800 mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            What happens when balance hits ₹0
          </h3>
          <ol className="space-y-1.5 text-xs text-ink-600 list-decimal list-inside">
            <li>Last installment&apos;s images upload to Drive</li>
            <li>Doc updates: <code className="bg-ink-100 px-1 rounded">paymentStatus = &apos;paid&apos;</code> with timestamp</li>
            <li>PDF is <span className="font-bold">regenerated</span> with PAID watermark + installment history table</li>
            <li>New PAID PDF replaces the original on Drive</li>
            <li>Single email sent to <code className="bg-ink-100 px-1 rounded">PI_AUTO_EMAIL_TO</code> with:
              <ul className="ml-5 mt-1 space-y-0.5 list-disc list-inside text-ink-500">
                <li>Per-installment blocks (date, notes, amount, reference image links)</li>
                <li>Grand Total + Total Paid + Closed On</li>
                <li>PAID PDF attached</li>
              </ul>
            </li>
            <li>No emails sent on partial payments — only the final closing payment triggers the email</li>
          </ol>
        </div>

        <div className="rounded-lg border border-ink-100 bg-ink-50/30 p-4">
          <h3 className="text-sm font-bold text-ink-800 mb-2">Email Templates Sent</h3>
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-ink-400">
              <tr><th className="pb-2 font-bold">Trigger</th><th className="pb-2 font-bold">Template</th><th className="pb-2 font-bold">Recipient</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              <tr><td className="py-2 font-medium">PI issued</td><td className="py-2 text-ink-600">No email — just uploads to Drive</td><td className="py-2 text-ink-400">—</td></tr>
              <tr><td className="py-2 font-medium">Add partial payment</td><td className="py-2 text-ink-600">No email — silent record</td><td className="py-2 text-ink-400">—</td></tr>
              <tr><td className="py-2 font-medium">Closing payment (balance → 0)</td><td className="py-2 text-ink-600">Payment received + all installments + PAID PDF</td><td className="py-2"><code className="text-[10px] bg-ink-100 px-1 rounded">PI_AUTO_EMAIL_TO</code></td></tr>
              <tr><td className="py-2 font-medium">Send Digest click</td><td className="py-2 text-ink-600">Consolidated outstanding PIs table</td><td className="py-2"><code className="text-[10px] bg-ink-100 px-1 rounded">REMINDER_EMAIL_TO</code></td></tr>
            </tbody>
          </table>
        </div>

        {/* Drive folder structure */}
        <div className="mt-4 rounded-lg border border-ink-100 bg-ink-50/30 p-4">
          <h3 className="text-sm font-bold text-ink-800 mb-2">Drive Folder Structure</h3>
          <pre className="text-[11px] font-mono text-ink-700 bg-white p-3 rounded border border-ink-100 overflow-x-auto">{`<Customer Name>/
  ├── Proforma Invoices/
  │   └── CHN-PI-25-26-0042-Customer.pdf      (PAID version after close)
  └── Payment Reference/
      └── CHN-PI-25-26-0042/
          ├── Installment 1/
          │   ├── ref-1.jpg
          │   └── ref-2.jpg
          ├── Installment 2/
          │   └── ref-1.jpg
          └── Installment 3/
              ├── ref-1.jpg
              └── ref-2.jpg`}</pre>
        </div>
      </section>

      {/* 6. Shipping Address */}
      <section id="shipping" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-brand-600" />
          6. Shipping Address (Proforma Invoices Only)
        </h2>
        <p className="text-sm text-ink-600 leading-relaxed mb-4">
          Proforma Invoices support a separate shipping address when goods are delivered to a different
          location than the billing address.
        </p>

        <div className="space-y-3">
          <div className="rounded-lg border border-ink-100 bg-ink-50/30 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">UI Behavior</h3>
            <ul className="space-y-1 text-xs text-ink-600">
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> Checkbox: <span className="font-semibold">"Same as billing address"</span> (checked by default)</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> When unchecked, shows form fields: contact person, phone, address, city, state, pincode</li>
              <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" /> When checked, displays an italic preview line of the billing address</li>
            </ul>
          </div>

          <div className="rounded-lg border border-ink-100 bg-ink-50/30 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">PDF Output</h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              When shipping differs from billing, the PDF shows <span className="font-bold">3 columns side by side</span>:
              BILLED BY · BILLED TO · SHIPPED TO. Otherwise the standard 2-column layout is used.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Product Catalog */}
      <section id="catalog" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-brand-600" />
          7. Internal Product Catalog
        </h2>
        <p className="text-sm text-ink-600 leading-relaxed mb-4">
          Interactive sales catalog powered dynamically by your Firestore products collection. Organized into
          category tabs with instant search, price lookups, HSN codes, and one-click quotation creation.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { name: 'Hardware', desc: 'Equipment & Units' },
            { name: 'Software', desc: 'Licenses & Modules' },
            { name: 'Services', desc: 'Setup & AMC' },
            { name: 'Subscriptions', desc: 'Cloud & SaaS Plans' },
          ].map((c) => (
            <div key={c.name} className="rounded-md border border-ink-100 bg-ink-50/30 px-3 py-2 text-center">
              <div className="text-[10px] font-semibold text-ink-500">{c.name}</div>
              <div className="text-xs font-bold text-brand-600 mt-0.5">{c.desc}</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-ink-500">
          Fully customizable by adding or importing your own catalog items in the Products section.
        </p>
      </section>

      {/* 8. PWA & Offline */}
      <section id="pwa" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-brand-600" />
          8. PWA & Offline Support
        </h2>
        <p className="text-sm text-ink-600 leading-relaxed mb-4">
          WA Quote is a Progressive Web App. Users can install it as a native-like app on desktop or mobile,
          and core pages remain accessible even with intermittent connectivity.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-ink-100 bg-ink-50/30 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Install on Desktop</h3>
            <ol className="space-y-1.5 text-xs text-ink-600 list-decimal list-inside">
              <li>Open the app in Chrome / Edge</li>
              <li>Click the install icon (⊕) in the address bar</li>
              <li>Click <span className="font-semibold">Install</span></li>
              <li>App opens in standalone window with CHN logo</li>
            </ol>
          </div>
          <div className="rounded-lg border border-ink-100 bg-ink-50/30 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Install on Mobile</h3>
            <ol className="space-y-1.5 text-xs text-ink-600 list-decimal list-inside">
              <li>Open in mobile browser (Chrome / Safari)</li>
              <li>Menu → <span className="font-semibold">Add to Home Screen</span></li>
              <li>Confirm to install</li>
              <li>Launch from home screen — runs full screen</li>
            </ol>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/30 p-4">
          <h3 className="text-sm font-bold text-ink-800 mb-2">Service Worker Behavior</h3>
          <ul className="space-y-1 text-xs text-ink-600">
            <li>• <span className="font-semibold">Network-first strategy</span> — always tries fresh data first</li>
            <li>• Caches successful responses for offline fallback</li>
            <li>• API and auth routes (<code className="bg-ink-100 px-1 rounded">/api/*</code>) bypass cache (always live)</li>
            <li>• Cache version bumps automatically clear old entries</li>
          </ul>
        </div>
      </section>

      {/* 9. User Roles & Permissions */}
      <section id="roles" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-600" />
          9. User Roles & Permissions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-200">
                <th className="text-left py-2 px-3 font-bold text-ink-700 uppercase tracking-wider">Role</th>
                <th className="text-center py-2 px-3 font-bold text-ink-700 uppercase tracking-wider">View</th>
                <th className="text-center py-2 px-3 font-bold text-ink-700 uppercase tracking-wider">Create</th>
                <th className="text-center py-2 px-3 font-bold text-ink-700 uppercase tracking-wider">Edit</th>
                <th className="text-center py-2 px-3 font-bold text-ink-700 uppercase tracking-wider">Delete</th>
                <th className="text-center py-2 px-3 font-bold text-ink-700 uppercase tracking-wider">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {[
                { role: '👑 Managing Director', view: true, create: true, edit: true, del: true, settings: true },
                { role: 'Admin', view: true, create: true, edit: true, del: true, settings: true },
                { role: 'Accountant', view: true, create: true, edit: true, del: false, settings: false },
                { role: 'Sales', view: true, create: true, edit: true, del: false, settings: false },
                { role: 'Viewer', view: true, create: false, edit: false, del: false, settings: false },
              ].map((r) => (
                <tr key={r.role} className="hover:bg-ink-50/50">
                  <td className="py-2.5 px-3 font-bold text-ink-800">{r.role}</td>
                  <td className="py-2.5 px-3 text-center">{r.view ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : '—'}</td>
                  <td className="py-2.5 px-3 text-center">{r.create ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : '—'}</td>
                  <td className="py-2.5 px-3 text-center">{r.edit ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : '—'}</td>
                  <td className="py-2.5 px-3 text-center">{r.del ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : '—'}</td>
                  <td className="py-2.5 px-3 text-center">{r.settings ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Workflow & Processes */}
      <section id="workflow" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <Workflow className="h-5 w-5 text-brand-600" />
          10. Workflow & Processes
        </h2>
        <div className="space-y-4">
          <div className="rounded-lg border border-ink-100/60 bg-ink-50/20 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Quotation Lifecycle</h3>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {['Customer Inquiry', 'Create Quotation', 'Add Line Items', 'Apply GST', 'Generate PDF', 'Send to Customer', 'Convert to PI'].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-brand-50 text-brand-700 font-semibold border border-brand-100/60">{step}</span>
                  {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-ink-300" />}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-ink-100/60 bg-ink-50/20 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">PI Payment Lifecycle (with Installments)</h3>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {['Issue PI', 'Send Digest', 'Add Payment 1', 'Add Payment 2', 'Add Final Payment', 'Auto-close + PAID PDF + Email'].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md font-semibold border ${
                    i >= arr.length - 1
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60'
                      : i >= 2
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/60'
                        : 'bg-amber-50 text-amber-700 border-amber-100/60'
                  }`}>{step}</span>
                  {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-ink-300" />}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-ink-500 mt-2">
              Each &quot;Add Payment&quot; step uploads its own reference images. The closing payment auto-triggers
              the PAID PDF + email with all installment details. Partial payments are silent — no email until the balance closes.
            </p>
          </div>
          <div className="rounded-lg border border-ink-100/60 bg-ink-50/20 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Document Numbering</h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Auto-incremented per financial year. Format: <code className="bg-ink-100 px-1 rounded">PREFIX/FY/SEQUENCE</code>.
              Example: <code className="bg-ink-100 px-1 rounded">QTN/25-26/0042</code>. Configurable in Settings → Numbering.
            </p>
          </div>
          <div className="rounded-lg border border-ink-100/60 bg-ink-50/20 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">GST Calculation Logic</h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Intra-state (same state): CGST 9% + SGST 9% = 18% total.
              Inter-state (different state): IGST 18%.
              State detection is automatic based on customer billing address vs company state (Tamil Nadu).
            </p>
          </div>
          <div className="rounded-lg border border-ink-100/60 bg-ink-50/20 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">PDF Generation</h3>
            <p className="text-xs text-ink-600 leading-relaxed">
              Client-side PDF using pdfmake library. Includes company letterhead, customer details, itemized table with HSN codes,
              tax breakup, amount in words, bank details, terms & conditions, digital signature, and payment QR code.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Security & Access Control */}
      <section id="security" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand-600" />
          11. Security & Access Control
        </h2>
        <div className="space-y-3">
          {[
            { title: 'Email Whitelist', desc: 'Only pre-approved email addresses can sign in. Unauthorized attempts are blocked with an access denied screen.' },
            { title: 'Firebase Security Rules', desc: 'Firestore rules enforce read/write permissions based on authenticated user role. No anonymous access allowed.' },
            { title: 'Role-Based Access', desc: 'Four-tier role system (Admin, Accountant, Sales, Viewer) controls what each user can see and do.' },
            { title: 'Session Management', desc: 'Firebase Auth handles session tokens with automatic refresh. Sign-out clears all local state.' },
            { title: 'HTTPS Only', desc: 'All traffic is encrypted via Firebase Hosting SSL. No HTTP fallback.' },
            { title: 'No Server-Side Secrets Exposed', desc: 'Firebase Admin SDK used only in server context. Client-side uses restricted API keys with domain restrictions.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-bold text-ink-800">{item.title}:</span>{' '}
                <span className="text-xs text-ink-600">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Support & Contact */}
      <section id="support" className="mb-8 card p-6">
        <h2 className="text-base font-extrabold text-ink-900 mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-brand-600" />
          12. Support & Contact
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-ink-100/60 bg-ink-50/20 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Developer & IT Support</h3>
            <div className="space-y-2 text-xs text-ink-600">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-brand-500" />
                <span className="font-semibold text-ink-800">DINESH — Senior Executive IT</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-brand-500" />
                <span>93848 17813</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-brand-500" />
                <span>itsupport@chnindia.com</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-ink-100/60 bg-ink-50/20 p-4">
            <h3 className="text-sm font-bold text-ink-800 mb-2">Platform</h3>
            <div className="space-y-2 text-xs text-ink-600">
              <div className="font-bold text-ink-800">WA Quote SaaS ERP</div>
              <div>Customizable Billing & Quotation Suite</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-6 border-t border-ink-100/60">
        <p className="text-[11px] text-ink-400 font-semibold">
          WA Quote v{APP_VERSION} • Documentation authored by DINESH, Senior Executive IT
        </p>
        <p className="text-[10px] text-ink-300 mt-1">
          © 2026 CHN Technologies Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
