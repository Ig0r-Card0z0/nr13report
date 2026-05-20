'use client';
import { useEffect, useState } from 'react';
import { instrumentosApi } from '@/lib/api';
import { Instrumento } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Ruler, FileText } from 'lucide-react';
import { fmtData, diasAte } from '@/lib/utils';

export default function InstrumentosPage() {
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    instrumentosApi.listar().then(setInstrumentos).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const excluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?`)) return;
    await instrumentosApi.excluir(id);
    toast.success('Instrumento excluído.');
    load();
  };

  const ValidadeBadge = ({ dt }: { dt?: string }) => {
    if (!dt) return <span className="badge badge-gray">Sem validade</span>;
    const d = diasAte(dt);
    if (d === null) return <span className="badge badge-gray">—</span>;
    if (d < 0) return <span className="badge badge-danger">Vencida {Math.abs(d)}d</span>;
    if (d <= 30) return <span className="badge badge-danger">{d}d</span>;
    if (d <= 90) return <span className="badge badge-warning">{d}d</span>;
    return <span className="badge badge-success">{d}d</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Instrumentos de medição</h1>
        <Link href="/instrumentos/novo" className="btn btn-primary">
          <Plus size={15} /> Novo instrumento
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-5">
        Cadastro central dos instrumentos utilizados nas inspeções (ultrassons, manômetros, termômetros etc.) com o
        respectivo certificado de calibração em PDF. Cada instrumento pode ser vinculado a múltiplas inspeções — o PDF
        do certificado entra automaticamente na seção de Documentação do relatório final.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : instrumentos.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Ruler className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          Nenhum instrumento cadastrado.
        </div>
      ) : instrumentos.map(i => (
        <div key={i.id} className="card mb-2 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
            <Ruler size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{i.nome}</div>
            <div className="text-xs text-gray-500">
              {[i.tipo, i.fabricante, i.modelo, i.serie ? `S/N ${i.serie}` : null].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {i.certificado_filename && (
            <a
              href={`/uploads/${encodeURIComponent(i.certificado_filename)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              title="Visualizar certificado PDF"
              onClick={e => e.stopPropagation()}
            >
              <FileText size={13} /> PDF
            </a>
          )}
          <div className="text-xs text-gray-500 text-right min-w-[6rem]">
            <div>Validade</div>
            <div className="font-medium text-gray-700">{fmtData(i.validade_calibracao)}</div>
          </div>
          <ValidadeBadge dt={i.validade_calibracao} />
          <div className="flex gap-2">
            <Link href={`/instrumentos/${i.id}/editar`} className="btn btn-sm"><Pencil size={13} /></Link>
            <button onClick={() => excluir(i.id, i.nome)} className="btn btn-sm btn-danger">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
