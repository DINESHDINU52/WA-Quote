import { PageHeader } from '@/components/page-header';

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        title="Tax Invoices"
        description="Issued GST invoices with auto-numbering, PDF and Drive backup."
      />
      <div className="card grid place-items-center py-16 text-center">
        <div className="text-ink-500 text-sm">Module coming next.</div>
      </div>
    </>
  );
}
