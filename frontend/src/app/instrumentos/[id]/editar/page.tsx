'use client';
import InstrumentoForm from '@/components/forms/InstrumentoForm';

export default function EditarInstrumentoPage({ params }: { params: { id: string } }) {
  return <InstrumentoForm instrumentoId={params.id} />;
}
