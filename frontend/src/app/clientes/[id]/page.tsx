'use client';
import { useEffect, useState } from 'react';
import { clientesApi, equipamentosApi } from '@/lib/api';
import { Cliente, Equipamento } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { fmtData, vencStatus, diasAte } from '@/lib/utils';
import clsx from 'clsx';

export default function DetalheClientePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);

  useEffect(() => {
    clientesApi.buscar(params.id).then(setCliente);
    equipamentosApi.listar(params.id).then(setEquipamentos);
  }, [params.id]);

  const excluir = async () => {
    if (!confirm(`Excluir "${cliente?.nome}"? Todos os equipamentos serão removidos.`)) return;
    await clientesApi.excluir(params.id);
    toast.success('Cliente excluído.');
    router.push('/clientes');
  };

  const VencBadge = ({ dt }: { dt?: string }) => {
    const s = vencStatus(dt);
    const d = diasAte(dt);
    if (s === 'none') return <span className="badge badge-gray">Sem data</span>;
    const cls = { ok: 'badge-success', info: 'badge-info', warn: 'badge-warning', danger: 'badge-danger' }[s]!;
    return <span className={`badge ${cls}`}>{d! < 0 ? `Vencida ${Math.abs(d!)}d` : `${d}d`}</span>;
  };

  if (!cliente) return <div className="text-center py-12 text-gray-400">Carregando...</div>;

  const end = [cliente.logradouro, cliente.numero, cliente.bairro, cliente.cidade, cliente.uf].filter(Boolean).join(', ');

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/clientes')} className="btn btn-sm"><ArrowLeft size={14} /></button>
        <div className="flex-1">
          <div className="text-xs text-gray-400">Clientes /</div>
          <h1 className="text-lg font-semibold text-gray-900">{cliente.nome}</h1>
        </div>
        <Link href={`/clientes/${params.id}/editar`} className="btn btn-sm"><Pencil size={13} /> Editar</Link>
        <button onClick={excluir} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
      </div>

      <div className="card mb-5">
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            ['CNPJ', cliente.cnpj],
            ['Telefone', cliente.tel],
            ['E-mail', cliente.email],
            ['Endereço', end],
            ['Responsável', cliente.responsavel ? `${cliente.responsavel}${cliente.cargo ? ' · ' + cliente.cargo : ''}` : null],
          ].filter(([, v]) => v).map(([l, v]) => (
            <div key={l as string} className={l === 'Endereço' ? 'col-span-3' : ''}>
              <div className="text-xs text-gray-400 mb-0.5">{l}</div>
              <div className="font-medium text-gray-900">{v || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Equipamentos ({equipamentos.length})</h2>
        <Link href={`/equipamentos/novo?clienteId=${params.id}`} className="btn btn-primary btn-sm">
          <Plus size={14} /> Novo equipamento
        </Link>
      </div>

      {equipamentos.length === 0 ? (
        <div className="card text-center py-8 text-gray-400 text-sm">Nenhum equipamento cadastrado.</div>
      ) : equipamentos.map(eq => (
        <Link href={`/equipamentos/${eq.id}`} key={eq.id}
          className="card mb-2 flex items-center gap-3 hover:border-primary-200 transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-warning-50 text-warning-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
            {eq.tag.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">{eq.tag} — {eq.tipo}</div>
            <div className="text-xs text-gray-500">{eq.fabricante}{eq.serie ? ` · ${eq.serie}` : ''}</div>
          </div>
          {eq.categoria && <span className="badge badge-info">Cat. {eq.categoria}</span>}
          <VencBadge dt={eq.prox_externo} />
          {eq.total_fotos ? <span className="badge badge-gray">{eq.total_fotos} fotos</span> : null}
        </Link>
      ))}
    </div>
  );
}
