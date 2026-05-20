'use client';
import { useEffect, useState } from 'react';
import { equipamentosApi, clientesApi } from '@/lib/api';
import { Equipamento, Cliente } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Trash2, Archive } from 'lucide-react';
import { vencStatus, diasAte } from '@/lib/utils';

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => Promise.all([equipamentosApi.listar(), clientesApi.listar()])
    .then(([eqs, cls]) => { setEquipamentos(eqs); setClientes(cls); }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const excluir = async (e: React.MouseEvent, id: string, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir "${tag}"?`)) return;
    await equipamentosApi.excluir(id);
    toast.success('Equipamento excluído.');
    load();
  };

  const eqs = filtro ? equipamentos.filter(e => e.cliente_id === filtro) : equipamentos;

  const VencBadge = ({ dt }: { dt?: string }) => {
    const s = vencStatus(dt); const d = diasAte(dt);
    if (s === 'none') return <span className="badge badge-gray">Sem data</span>;
    const cls = { ok:'badge-success', info:'badge-info', warn:'badge-warning', danger:'badge-danger' }[s]!;
    return <span className={`badge ${cls}`}>{d! < 0 ? `Vencida ${Math.abs(d!)}d` : `${d}d`}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Equipamentos</h1>
        <div className="flex gap-3">
          <select className="input w-52 py-1.5 text-sm" value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="">Todos os clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <Link href="/equipamentos/novo" className="btn btn-primary"><Plus size={15} /> Novo</Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : eqs.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Archive className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Nenhum equipamento{filtro ? ' para este cliente' : ''}.
        </div>
      ) : eqs.map(eq => (
        <Link
          href={`/equipamentos/${eq.id}`}
          key={eq.id}
          className="card mb-2 flex items-center gap-3 hover:border-primary-200 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-warning-50 text-warning-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
            {eq.tag.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{eq.tag} — {eq.tipo}</div>
            <div className="text-xs text-gray-500">{eq.cliente_nome} · {eq.fabricante || '—'}</div>
          </div>
          {eq.categoria && <span className="badge badge-info">Cat. {eq.categoria}</span>}
          <VencBadge dt={eq.prox_externo} />
          {!!eq.total_fotos && <span className="badge badge-gray">{eq.total_fotos} fotos</span>}
          <button
            onClick={e => excluir(e, eq.id, eq.tag)}
            className="btn btn-sm btn-danger"
            title="Excluir equipamento"
          >
            <Trash2 size={13} />
          </button>
        </Link>
      ))}
    </div>
  );
}
