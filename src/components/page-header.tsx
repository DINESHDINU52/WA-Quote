import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-ink-100/50">
      <div className="flex items-start gap-3">
        <div className="w-1 h-9 rounded-full bg-gradient-to-b from-brand-500 to-brand-600 self-center hidden sm:block" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500 leading-normal">{description}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
          {actions}
        </div>
      )}
    </header>
  );
}
