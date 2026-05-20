'use client';
import ProfissionalForm from '@/components/forms/ProfissionalForm';

export default function EditarProfissionalPage({ params }: { params: { id: string } }) {
  return <ProfissionalForm profissionalId={params.id} />;
}
