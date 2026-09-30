import { DocumentEditor } from '@/components/doc-editor/document-editor';

export default function EditProformaPage({ params }: { params: { id: string } }) {
  return <DocumentEditor docType="proforma" existingId={params.id} />;
}
