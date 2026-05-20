'use client';
import { useEffect, useState } from 'react';
import { equipamentosApi, inspecoesApi } from '@/lib/api';
import { Equipamento, Inspecao } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';
import { fmtData } from '@/lib/utils';
import { PRAZOS_NR13 } from '@/lib/constants';
import { PageHeader } from '@/components/ui/PageHeader';
import { VencBadge } from '@/components/ui/VencBadge';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Loading';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InspecaoForm } from '@/components/forms/InspecaoForm';
import { InspecoesTabela } from '@/components/forms/InspecoesTabela';

export default function DetalheEquipamentoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const eqId = params.id;
  const [eq, setEq] = useState<Equipamento | null>(null);
  const [inspecoes, setInspecoes] = useState<Inspecao[]>([]);

  const loadEq = () =>
    equipamentosApi.buscar(eqId)
      .then(setEq)
      .catch((err: any) => {
        const msg = err?.response?.data?.message || err?.message || 'Erro ao carregar equipamento.';
        toast.error(String(msg));
      });

  const loadInsp = () =>
    inspecoesApi.listar(eqId)
      .then((list: Inspecao[]) => setInspecoes(list))
      .catch((err: any) => {
        const msg = err?.response?.data?.message || err?.message || 'Erro ao carregar inspeções.';
        toast.error(String(msg));
        setInspecoes([]);
      });

  useEffect(() => { loadEq(); loadInsp(); }, [eqId]);

  const excluirEq = async () => {
    await equipamentosApi.excluir(eqId);
    toast.success('Equipamento excluído.');
    router.push(eq?.cliente_id ? `/clientes/${eq.cliente_id}` : '/equipamentos');
  };

  if (!eq) return <PageLoading />;

  const pnr = PRAZOS_NR13[eq.categoria || ''] || { ext: '—', int: '—', hid: '—' };

  return (
    <div>
      <PageHeader
        title={eq.tag + ' — ' + eq.tipo}
        breadcrumbs={[
          { label: 'Clientes', href: '/clientes' },
          { label: eq.cliente_nome || 'Cliente', href: eq.cliente_id ? '/clientes/' + eq.cliente_id : undefined },
          { label: eq.tag },
        ]}
        back={eq.cliente_id ? '/clientes/' + eq.cliente_id : '/equipamentos'}
        actions={
          <>
            <Link href={'/equipamentos/' + eqId + '/editar'} className="btn btn-sm">
              <Pencil size={13} /> Editar
            </Link>
            <ConfirmDialog
              title="Excluir equipamento"
              message={'Excluir "' + eq.tag + '"? Todas as inspecoes, fotos e medicoes serao removidas.'}
              onConfirm={excluirEq}
              trigger={open => (
                <button onClick={open} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
              )}
            />
          </>
        }
      />

      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-4">
          {eq.categoria && <Badge variant="info">Cat. {eq.categoria}</Badge>}
          {eq.grupo_risco && <Badge variant="gray">{eq.grupo_risco}</Badge>}
          {eq.classe_fluido && <Badge variant="gray">Classe {eq.classe_fluido}</Badge>}
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm mb-5">
          {[
            ['Fabricante',    eq.fabricante],
            ['N Serie',       eq.serie],
            ['Ano',           eq.ano],
            ['Volume',        eq.volume           ? eq.volume + ' m3'          : null],
            ['PMTA',          eq.pmta             ? eq.pmta + ' bar'           : null],
            ['P. Operacao',   eq.pressao_operacao ? eq.pressao_operacao + ' kgf/cm2' : null],
            ['Fluido',        eq.fluido],
            ['Temp. Projeto', eq.temperatura_projeto ? eq.temperatura_projeto + ' C' : null],
            ['Metal de base', eq.metal_base],
            ['Posicao',       eq.posicao],
            ['Cod. Projeto',  eq.codigo_projeto],
            ['Local instal.', eq.local_instalacao],
          ].filter(([, v]) => v).map(([l, v]) => (
            <div key={l as string}>
              <div className="text-xs text-gray-400 mb-0.5">{l}</div>
              <div className="font-medium text-gray-900">{v}</div>
            </div>
          ))}
        </div>

        <hr className="border-gray-100 mb-4" />
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prazos de inspecao</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {['Tipo','Prazo max. NR-13','Proxima prevista (PH)','Status'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Exame externo',      pnr.ext, eq.prox_externo],
              ['Exame interno',      pnr.int, eq.prox_interno],
              ['Teste hidrostatico', pnr.hid, eq.prox_hidro],
            ].map(([tipo, nr, dt]) => (
              <tr key={tipo as string} className="border-t border-gray-100">
                <td className="px-3 py-2">{tipo}</td>
                <td className="px-3 py-2 text-gray-500">{nr}</td>
                <td className="px-3 py-2 font-medium">{fmtData(dt as string)}</td>
                <td className="px-3 py-2"><VencBadge dt={dt as string} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {eq.dt_ultima_insp && (
          <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            Ultima inspecao: <span className="font-medium text-gray-600">{fmtData(eq.dt_ultima_insp)}</span>
            {eq.tipo_ultima_insp ? ' — ' + eq.tipo_ultima_insp : ''}
            {eq.art_ultima_insp  ? ' | ART: ' + eq.art_ultima_insp : ''}
          </div>
        )}
      </div>

      <InspecaoForm
        equipamentoId={eqId}
        categoria={eq.categoria}
        prazosAtuais={{ proxExterno: eq.prox_externo, proxInterno: eq.prox_interno, proxHidro: eq.prox_hidro }}
        onSaved={() => { loadInsp(); loadEq(); }}
      />

      <InspecoesTabela
        equipamentoId={eqId}
        equipamento={eq}
        inspecoes={inspecoes}
        onReload={() => { loadInsp(); loadEq(); }}
      />
    </div>
  );
}
