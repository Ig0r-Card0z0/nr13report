'use client';
import { useEffect, useMemo, useState } from 'react';
import { equipamentosApi, clientesApi } from '@/lib/api';
import { Equipamento, Cliente } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Trash2, Archive, Search, X } from 'lucide-react';
import { vencStatus, diasAte } from '@/lib/utils';

type FiltroVenc = '' | 'vencida' | 'danger' | 'warn' | 'ok' | 'none';

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroVenc, setFiltroVenc] = useState<FiltroVenc>('');
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

  // Categorias presentes nos equipamentos cadastrados (ordenadas).
  const categorias = useMemo(
    () => Array.from(new Set(equipamentos.map(e => e.categoria).filter(Boolean) as string[])).sort(),
    [equipamentos],
  );

  // Aplicação combinada dos filtros: busca textual + cliente + categoria + vencimento.
  const eqs = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return equipamentos.filter(e => {
      if (filtroCliente && e.cliente_id !== filtroCliente) return false;
      if (filtroCategoria && e.categoria !== filtroCategoria) return false;

      if (filtroVenc) {
        const s = vencStatus(e.prox_externo);
        const d = diasAte(e.prox_externo);
        if (filtroVenc === 'vencida' && !(d !== null && d < 0)) return false;
        if (filtroVenc === 'danger' && !(s === 'danger' && d !== null && d >= 0)) return false;
        if (filtroVenc === 'warn' && s !== 'warn') return false;
        if (filtroVenc === 'ok' && !(s === 'ok' || s === 'info')) return false;
        if (filtroVenc === 'none' && s !== 'none') return false;
      }

      if (termo) {
        const alvo = [
          e.tag, e.tipo, e.fabricante, e.serie, e.cliente_nome, e.local_instalacao,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [equipamentos, busca, filtroCliente, filtroCategoria, filtroVenc]);

  const temFiltro = busca || filtroCliente || filtroCategoria || filtroVenc;
  const limpar = () => { setBusca(''); setFiltroCliente(''); setFiltroCategoria(''); setFiltroVenc(''); };

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
        <Link href="/equipamentos/novo" className="btn btn-primary"><Plus size={15} /> Novo</Link>
      </div>

      {/* ── Barra de busca e filtros ──────────────────────────────────────── */}
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por TAG, tipo, fabricante, série..."
            className="input w-full pl-9 py-1.5 text-sm"
          />
        </div>

        <select className="input w-48 py-1.5 text-sm" value={filtroCliente}
          onChange={e => setFiltroCliente(e.target.value)}>
          <option value="">Todos os clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        <select className="input w-40 py-1.5 text-sm" value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>Categoria {c}</option>)}
        </select>

        <select className="input w-44 py-1.5 text-sm" value={filtroVenc}
          onChange={e => setFiltroVenc(e.target.value as FiltroVenc)}>
          <option value="">Qualquer vencimento</option>
          <option value="vencida">Vencidas</option>
          <option value="danger">Vence em até 30d</option>
          <option value="warn">Vence em 31–90d</option>
          <option value="ok">Em dia (90d+)</option>
          <option value="none">Sem data</option>
        </select>

        {temFiltro && (
          <button onClick={limpar} className="btn btn-sm btn-secondary" title="Limpar filtros">
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {!loading && (
        <div className="text-xs text-gray-500 mb-3">
          {eqs.length} de {equipamentos.length} equipamento{equipamentos.length !== 1 ? 's' : ''}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : eqs.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Archive className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          {temFiltro ? 'Nenhum equipamento corresponde aos filtros.' : 'Nenhum equipamento.'}
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