import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';
import { TimerProvider } from '@/lib/timer-context';
import { ToastProvider } from '@/lib/toast-context';
import { FloatingTimer } from '@/components/floating-timer';
import { FloatingStickyNotes } from '@/components/floating-sticky-notes';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ToastProvider>
        <TimerProvider>
          <AppShell>{children}</AppShell>
          <FloatingTimer />
          <FloatingStickyNotes />
        </TimerProvider>
      </ToastProvider>
    </AuthGuard>
  );
}
