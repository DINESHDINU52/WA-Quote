'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, hasRole, type Role } from '@/lib/auth-context';

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: Role[];
}

export function AuthGuard({ children, roles }: AuthGuardProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [user, loading, pathname, router]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  if (roles && !hasRole(profile, roles)) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Access denied</h2>
          <p className="mt-2 text-sm text-ink-500">
            Your role ({profile?.role ?? 'unknown'}) cannot view this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50">
      <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
        <div className="relative">
          <img
            src="/CHN QUOTEDESK.png"
            alt="WA Quote"
            className="h-32 w-auto object-contain animate-pulse"
          />
        </div>
        <div className="text-center">
          <div className="mt-1 text-sm text-ink-500">Loading...</div>
        </div>
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0ms]" />
          <div className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:150ms]" />
          <div className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
