'use client';
import { useEffect, useState } from 'react';
import { clientesApi } from '@/lib/api';
import { Cliente } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Trash2, Users } from 'lucide-react';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => clientesApi.listar().then(setClientes).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const excluir = async (e: React.MouseEvent, id: string, nome: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir "${nome}"? Todos os equipamentos vinculados serão removidos.`)) return;
    await clientesApi.excluir(id);
    toast.success('Cliente excluído.');
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
        <Link href="/clientes/novo" className="btn btn-primary">
          <Plus size={15} /> Novo cliente
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : clientes.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Nenhum cliente cadastrado.
        </div>
      ) : clientes.map(c => (
        <Link
          href={`/clientes/${c.id}`}
          key={c.id}
          className="card mb-3 flex items-center gap-4 hover:border-primary-200 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
            {c.nome.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900">{c.nome}</div>
            <div className="text-xs text-gray-500">
              {[c.cnpj, c.cidade && `${c.cidade}/${c.uf}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <span className="badge badge-gray">{c.total_equipamentos || 0} equip.</span>
          <button
            onClick={e => excluir(e, c.id, c.nome)}
            className="btn btn-sm btn-danger"
            title="Excluir cliente"
          >
            <Trash2 size={13} />
          </button>
        </Link>
      ))}
    </div>
  );
}
