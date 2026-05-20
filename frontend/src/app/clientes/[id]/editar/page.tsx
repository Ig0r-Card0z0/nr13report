'use client';
import ClienteForm from '@/components/forms/ClienteForm';
export default function EditarClientePage({ params }: { params: { id: string } }) {
  return <ClienteForm clienteId={params.id} />;
}
