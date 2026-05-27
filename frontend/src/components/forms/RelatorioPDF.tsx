'use client';
import { useMemo, useState } from 'react';
import { Equipamento, Inspecao, Foto, MedicaoEspessura } from '@/types';
import { relatoriosApi } from '@/lib/api';
import { fmtData } from '@/lib/utils';
import { Download, FileText, CheckCircle, Eye, X, FileType, SlidersHorizontal } from 'lucide-react';
import { EditorResultadoInspecao, Overrides } from './EditorResultadoInspecao';
import { Tabs } from '@/components/ui/Tabs';

interface Props {
  equipamento: Equipamento;
  inspecoes: Inspecao[];
  fotos: Foto[];
  medicao: MedicaoEspessura | null;
  inspecaoId?: string | null;
}

export function RelatorioPDF({ equipamento: eq, inspecoes, fotos, medicao, inspecaoId }: Props) {
  const inspecao = inspecaoId ? inspecoes.find(i => i.id === inspecaoId) : inspecoes[0];
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aba, setAba] = useState<'gerar' | 'resultado'>('gerar');
  // Overrides da seção 4/5.1 — vazio = relatório usa todos os valores padrão.
  const [overrides, setOverrides] = useState<Overrides>({});
  const qtdOverrides = Object.keys(overrides).length;

  // As URLs só carregam overrides quando há uma inspeção selecionada;
  // sem inspecaoId o backend não roda a seção 4 com dados específicos.
  const pdfUrl = inspecaoId
    ? relatoriosApi.urlPDFInspecao(eq.id, inspecaoId, overrides)
    : relatoriosApi.urlPDF(eq.id);
  const pdfUrlDownload = inspecaoId
    ? relatoriosApi.urlPDFInspecaoDownload(eq.id, inspecaoId, overrides)
    : relatoriosApi.urlPDFDownload(eq.id);
  const docxUrlDownload = inspecaoId
    ? relatoriosApi.urlDOCXInspecaoDownload(eq.id, inspecaoId, overrides)
    : relatoriosApi.urlDOCXDownload(eq.id);

  const itens = useMemo(() => ([
    { label: 'Identificação do equipamento', ok: !!eq.tag },
    { label: 'Parâmetros operacionais', ok: !!(eq.volume && eq.pmta) },
    { label: 'Categoria NR-13 calculada', ok: !!eq.categoria },
    { label: 'Dados da empresa usuária', ok: !!eq.cliente_nome },
    { label: 'Prazos de inspeção NR-13', ok: !!(eq.prox_externo || eq.prox_interno) },
    { label: 'Inspeção selecionada', ok: !!inspecao },
    { label: 'Profissional Habilitado (PH)', ok: !!(inspecao?.ph_nome) },
    { label: 'ART anexa (PDF)', ok: !!(inspecao?.art_filename) },
    { label: 'Foto de capa selecionada', ok: !!eq.foto_capa_id },
    { label: 'Tabela de medição de espessura', ok: !!(medicao?.pontos?.length) },
    { label: 'Relatório fotográfico', ok: fotos.length > 0 },
  ]), [eq, fotos.length, inspecao, medicao?.pontos?.length]);

  const prontos = itens.filter(i => i.ok).length;
  const pct = Math.round((prontos / itens.length) * 100);

  return (
    <div>
      {/* Abas superiores: Gerar Relatório / Resultado da Inspeção */}
      <Tabs
        ariaLabel="Seções do gerador de relatório"
        idPrefix="relpdf"
        tabs={[
          { id: 'gerar', label: 'Gerar Relatório', icon: FileText },
          { id: 'resultado', label: 'Resultado da Inspeção', icon: SlidersHorizontal, badge: qtdOverrides },
        ]}
        active={aba}
        onChange={id => setAba(id as 'gerar' | 'resultado')}
      />

      {/* Painel: Resultado da Inspeção (montado sempre p/ preservar estado) */}
      <div hidden={aba !== 'resultado'}>
        {inspecaoId ? (
          <EditorResultadoInspecao onChange={setOverrides} />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 mb-5">
            Selecione uma inspeção específica para ajustar os itens do Resultado
            da Inspeção. Sem inspeção selecionada, o relatório usa apenas os
            valores padrão.
          </div>
        )}
      </div>

      {/* Painel: Gerar Relatório (conteúdo original) */}
      <div hidden={aba !== 'gerar'}>
      {/* Checklist de completude */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Completude do relatório</h3>
          <span className="text-lg font-bold text-primary-700">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
          <div className="bg-primary-700 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {itens.map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <CheckCircle className={ok ? 'text-green-500 w-4 h-4 flex-shrink-0' : 'text-gray-200 w-4 h-4 flex-shrink-0'} />
              <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        {[
          { label: 'Inspeções', val: inspecoes.length },
          { label: 'Fotos', val: fotos.length },
          { label: 'Pontos ME', val: medicao?.pontos?.length || 0 },
        ].map(({ label, val }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900">{val}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {qtdOverrides > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-primary-800">
          <SlidersHorizontal size={13} className="text-primary-700" />
          <span>
            <strong>{qtdOverrides}</strong> {qtdOverrides === 1 ? 'item ajustado' : 'itens ajustados'} na aba <strong>Resultado da Inspeção</strong> serão aplicados ao relatório.
          </span>
          <button
            type="button"
            onClick={() => setAba('resultado')}
            className="ml-auto text-primary-700 hover:underline font-medium"
          >
            Revisar
          </button>
        </div>
      )}

      {/* Botão principal */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <FileText className="w-14 h-14 mx-auto mb-4 text-primary-700" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Gerar R.I.S.E. — Relatório de Inspeção de Segurança
        </h3>
        <p className="text-sm text-gray-500 mb-2">
          {eq.tag} — {eq.tipo} | {eq.cliente_nome}
        </p>
        {inspecao && (
          <p className="text-xs text-gray-400 mb-6">
            Inspeção: {fmtData(inspecao.data)} | {inspecao.resultado}
            {inspecao.ph_nome ? ` | PH: ${inspecao.ph_nome}` : ''}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="btn px-10 py-3 text-base inline-flex items-center gap-3 justify-center"
          >
            <Eye size={20} />
            Visualizar prévia completa
          </button>
          <a
            href={pdfUrlDownload}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary px-10 py-3 text-base inline-flex items-center gap-3 justify-center"
          >
            <Download size={20} />
            Gerar e baixar PDF
          </a>
          <a
            href={docxUrlDownload}
            target="_blank"
            rel="noopener noreferrer"
            className="btn px-10 py-3 text-base inline-flex items-center gap-3 justify-center"
          >
            <Download size={20} />
            Gerar e baixar Word
          </a>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Use a prévia para validar o documento antes de gerar e baixar.
        </p>
      </div>

      {/* O que está incluído */}
      <div className="mt-5 bg-white border border-gray-200 rounded-xl p-5">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seções do relatório</div>
        <div className="grid grid-cols-2 gap-1.5 text-sm text-gray-600">
          {[
            '1 — Capa com foto selecionada',
            '2 — Identificação do equipamento',
            '3 — Parâmetros operacionais',
            '4 — Empresa usuária',
            '5 — Prazos de inspeção NR-13',
            '6 — Histórico de inspeções',
            '7 — Documentação (ART + certificados de calibração)',
            '8 — Medição de espessura por ultrassom',
            '9 — Relatório fotográfico',
            '10 — PDFs anexos (ART e calibrações)',
            '11 — Conclusão e assinatura do PH',
          ].map(s => <div key={s} className="flex items-center gap-2"><CheckCircle size={13} className="text-green-400 flex-shrink-0" />{s}</div>)}
        </div>
      </div>
      </div>
      {/* Fim painel "Gerar Relatório" */}

      {previewOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">Prévia do PDF</div>
                <div className="text-xs text-gray-500 truncate">{eq.tag} — {eq.cliente_nome}</div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfUrlDownload}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-primary"
                >
                  <Download size={14} /> Baixar
                </a>
                <button type="button" onClick={() => setPreviewOpen(false)} className="btn btn-sm">
                  <X size={14} /> Fechar
                </button>
              </div>
            </div>
            <div className="bg-gray-100">
              <iframe
                title="Prévia do relatório em PDF"
                src={pdfUrl}
                className="w-full h-[75vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}