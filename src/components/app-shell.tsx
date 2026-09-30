'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  FileSpreadsheet,
  Wrench,
  BarChart3,
  Settings,
  LogOut,
  BookOpen,
  CheckSquare,
  ShoppingBag
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/catalog', label: 'Product Catalog', icon: BookOpen },
  { href: '/installation', label: 'Service Charges', icon: Wrench },
  { href: '/quotations', label: 'Quotations', icon: FileText },
  { href: '/proformas', label: 'Proforma Invoices', icon: FileSpreadsheet },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingBag },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOutUser } = useAuth();

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-ink-50">
      <aside className="flex flex-col border-r border-ink-200/60 bg-white/95 backdrop-blur-md">
        <div className="flex flex-col items-center px-4 py-5 border-b border-ink-100/50">
          <Link href="/dashboard" className="flex flex-col items-center group transition-transform duration-300 hover:scale-[1.02]">
            <div className="relative px-3 py-2 rounded-xl transition-colors duration-200 group-hover:bg-brand-50/50">
              <img
                src="/WA Quote  - 1.png"
                alt="WA Quote"
                className="h-10 w-auto object-contain drop-shadow-sm"
              />
            </div>
            <div className="mt-1 text-[10px] font-bold text-brand-600 tracking-wider uppercase">
              Business Suite
            </div>
          </Link>
        </div>
        <nav className="flex-1 space-y-1.5 px-3.5 py-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200 group relative',
                  active
                    ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white font-medium shadow-md shadow-brand-500/10'
                    : 'text-ink-600 hover:bg-brand-50/50 hover:text-brand-700 hover:translate-x-1'
                )}
              >
                <Icon className={cn("h-4.5 w-4.5 transition-transform duration-200", !active && "group-hover:scale-110")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-100/60 p-4 bg-ink-50/40 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm ring-2 ring-brand-100">
              {(profile?.displayName || profile?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-bold text-ink-800">{profile?.displayName || profile?.email}</div>
              <div className="text-[10px] text-brand-600 font-semibold uppercase tracking-wider capitalize">{profile?.role ?? 'viewer'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="btn-secondary w-full py-2 flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="overflow-x-hidden">
        <div className="mx-auto max-w-[1480px] px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
