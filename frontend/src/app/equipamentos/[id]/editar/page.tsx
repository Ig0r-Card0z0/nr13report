'use client';
import EquipamentoForm from '@/components/forms/EquipamentoForm';
export default function EditarEquipamentoPage({ params }: { params: { id: string } }) {
  return <EquipamentoForm equipamentoId={params.id} />;
}
