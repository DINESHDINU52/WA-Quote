'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { useTheme, type Theme } from '@/lib/theme-context';
import { Hash, Building2, FileText, Users, Shield, Palette, Check, BookOpen, Bell, Activity, Key } from 'lucide-react';

const cards = [
  {
    href: '/settings/api-keys',
    icon: Key,
    title: 'API & CRM Integration',
    desc: 'Generate secure API keys to pull paid, unpaid, and invoice data into your CRM dashboard.'
  },
  {
    href: '/settings/activity',
    icon: Activity,
    title: 'Activity Tracker & Audit',
    desc: 'Real-time audit log of price changes, device additions, edits, and staff actions.'
  },
  {
    href: '/settings/numbering',
    icon: Hash,
    title: 'Numbering',
    desc: 'Seed your current invoice number, set per-FY pattern and prefixes.'
  },
  {
    href: '/settings/company',
    icon: Building2,
    title: 'Company',
    desc: 'Letterhead, GSTIN, bank, signature image and footer line.'
  },
  {
    href: '/settings/templates',
    icon: FileText,
    title: 'Terms & templates',
    desc: 'Default terms and conditions per document type.'
  },
  {
    href: '/settings/users',
    icon: Users,
    title: 'Users & roles',
    desc: 'Invite staff, assign admin / accountant / sales / viewer.'
  },
  {
    href: '/settings/access',
    icon: Shield,
    title: 'Access control',
    desc: 'Whitelist emails that can sign in. Block unauthorized accounts.'
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    title: 'Notifications & sounds',
    desc: 'Configure timer alarms, task reminders, sound presets and quiet hours.'
  },
  {
    href: '/settings/documentation',
    icon: BookOpen,
    title: 'Documentation',
    desc: 'Complete system docs, wireframes, modules guide & support info.'
  }
];

const themesList = [
  { id: 'blue', name: 'Royal Blue', desc: 'Secure default enterprise brand identity', colorClass: 'bg-blue-600' },
  { id: 'emerald', name: 'Emerald Green', desc: 'Vibrant modern emerald green', colorClass: 'bg-emerald-600' },
  { id: 'indigo', name: 'Indigo Purple', desc: 'Premium corporate violet and security intelligence', colorClass: 'bg-indigo-600' },
  { id: 'coral', name: 'Coral Rose', desc: 'Warm sleek technical hardware aesthetics', colorClass: 'bg-rose-500' },
  { id: 'teal', name: 'Teal Mint', desc: 'Clean refreshing teal mint', colorClass: 'bg-teal-600' }
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure organization settings, branding, templates, and permissions."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card flex items-start gap-4 p-5 transition-shadow hover:shadow-soft"
          >
            <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700">
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-ink-900">{c.title}</div>
              <div className="mt-1 text-sm text-ink-500">{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Theme Customization Panel */}
      <div className="mt-8 card p-6 bg-white/95 border border-slate-200/60 shadow-sm animate-in">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">System Color Theme</h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5 leading-normal">
              Select a dynamic brand color palette to style the billing interfaces, buttons, and navigation elements.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {themesList.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id as Theme)}
                className={`flex flex-col justify-between items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${
                  active
                    ? 'border-brand-500 bg-brand-50/10 shadow-md shadow-brand-500/5 ring-1 ring-brand-500'
                    : 'border-slate-200/70 bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                {/* Visual color dot with active check */}
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm ${t.colorClass}`}>
                  {active && <Check className="h-4.5 w-4.5 stroke-[3.5]" />}
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-800">{t.name}</div>
                  <div className="text-[9px] text-slate-400 font-semibold mt-1 leading-relaxed">
                    {t.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
