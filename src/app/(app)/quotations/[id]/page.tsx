import { DocumentEditor } from '@/components/doc-editor/document-editor';

export default function EditQuotationPage({ params }: { params: { id: string } }) {
  return <DocumentEditor docType="quotation" existingId={params.id} />;
}
