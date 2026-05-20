'use client';
import { useEffect, useState } from 'react';
import { profissionaisApi } from '@/lib/api';
import { Profissional } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Trash2, UserCog } from 'lucide-react';

export default function ProfissionaisPage() {
  const [items, setItems] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    profissionaisApi.listar().then(setItems).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const excluir = async (e: React.MouseEvent, id: string, nome: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir "${nome}"? Os clientes vinculados ficarão sem profissional responsável.`)) return;
    await profissionaisApi.excluir(id);
    toast.success('Profissional excluído.');
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Profissionais</h1>
        <Link href="/profissionais/novo" className="btn btn-primary">
          <Plus size={15} /> Novo profissional
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-5">
        Cadastro central dos engenheiros e profissionais habilitados (PH) que assinam relatórios e respondem
        tecnicamente pelos equipamentos. Reutilizável no cadastro de Clientes e na geração de relatórios.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <UserCog className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Nenhum profissional cadastrado.
        </div>
      ) : items.map(p => (
        <Link
          key={p.id}
          href={`/profissionais/${p.id}/editar`}
          className="card mb-2 flex items-center gap-3 hover:border-primary-200 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
            <UserCog size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{p.nome}</div>
            <div className="text-xs text-gray-500 truncate">
              {[p.especialidade, p.crea ? `CREA ${p.crea}` : null, p.email].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {p.telefone && <span className="text-xs text-gray-500 hidden md:block">{p.telefone}</span>}
          <button
            onClick={e => excluir(e, p.id, p.nome)}
            className="btn btn-sm btn-danger"
            title="Excluir profissional"
          >
            <Trash2 size={13} />
          </button>
        </Link>
      ))}
    </div>
  );
}
