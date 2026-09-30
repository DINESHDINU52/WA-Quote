import { DocumentEditor } from '@/components/doc-editor/document-editor';

export default function EditPurchaseOrderPage({ params }: { params: { id: string } }) {
  return <DocumentEditor docType="po" existingId={params.id} />;
}
