'use client';
import { useEffect, useState } from 'react';
import { inspecoesApi, relatoriosApi } from '@/lib/api';
import { AnexoSeguranca, Equipamento, Inspecao } from '@/types';
import { fmtData } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tabs } from '@/components/ui/Tabs';
import { FotoRelatorio } from './FotoRelatorio';
import { MedicaoEspessuraForm } from './MedicaoEspessuraForm';
import { InspecaoForm } from './InspecaoForm';
import {
  ChevronDown, ChevronRight, Trash2, FileText, Image as ImageIcon,
  Activity, Download, AlertTriangle, Check, Eye, X, Paperclip, Upload, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Props {
  equipamentoId: string;
  equipamento: Equipamento;
  inspecoes: Inspecao[];
  onReload: () => void;
}

type StatusKey = 'completa' | 'incompleta' | 'vencida';

function statusComplementos(ins: Inspecao, hoje = new Date()): { key: StatusKey; label: string; variant: 'success' | 'warning' | 'danger' } {
  const completa = (ins.total_fotos ?? 0) > 0
                && (ins.total_pontos_me ?? 0) > 0
                && ins.tem_art === 1;
  if (completa) return { key: 'completa', label: 'Completa', variant: 'success' };
  if (ins.prazo_complementos) {
    const prazo = new Date(ins.prazo_complementos.slice(0, 10) + 'T23:59:59');
    if (prazo.getTime() < hoje.getTime()) return { key: 'vencida', label: 'Vencida', variant: 'danger' };
  }
  return { key: 'incompleta', label: 'Incompleta', variant: 'warning' };
}

export function InspecoesTabela({ equipamentoId, equipamento, inspecoes, onReload }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const excluir = async (id: string) => {
    try {
      await inspecoesApi.excluir(id);
      toast.success('Inspeção removida.');
      if (expandedId === id) setExpandedId(null);
      onReload();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao excluir.';
      toast.error(String(msg));
    }
  };

  if (inspecoes.length === 0) {
    return (
      <div className="card text-center py-8 text-gray-400 text-sm">
        Nenhuma inspeção registrada. Use o formulário acima para cadastrar a primeira.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Histórico ({inspecoes.length})</h3>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="w-8"></th>
              {['Data', 'Tipo', 'Resultado', 'Complementos', 'PH / ART', ''].map(h => (
                <th
                  key={h}
                  className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inspecoes.map(ins => {
              const st = statusComplementos(ins);
              const expanded = expandedId === ins.id;
              const resCor = ins.resultado === 'Apto' ? 'success'
                          : ins.resultado === 'Inapto' ? 'danger'
                          : 'warning';
              return (
                <RowGroup
                  key={ins.id}
                  ins={ins}
                  status={st}
                  resultadoVariant={resCor}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : ins.id)}
                  onExcluir={() => excluir(ins.id)}
                  equipamentoId={equipamentoId}
                  equipamento={equipamento}
                  onReload={onReload}
                />
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}

interface RowProps {
  ins: Inspecao;
  status: { key: StatusKey; label: string; variant: 'success' | 'warning' | 'danger' };
  resultadoVariant: 'success' | 'warning' | 'danger';
  expanded: boolean;
  onToggle: () => void;
  onExcluir: () => void;
  equipamentoId: string;
  equipamento: Equipamento;
  onReload: () => void;
}

function RowGroup({
  ins, status, resultadoVariant, expanded, onToggle, onExcluir,
  equipamentoId, equipamento, onReload,
}: RowProps) {
  const metalBase = equipamento.metal_base;
  const podeBaixarPDF = status.key === 'completa';
  const pdfHref = relatoriosApi.urlPDFInspecaoDownload(equipamentoId, ins.id);
  const [docTab, setDocTab] = useState<'fotos' | 'ultrassom' | 'pdf' | 'seguranca'>('fotos');
  const [anexosSeg, setAnexosSeg] = useState<AnexoSeguranca[]>([]);
  const [loadingSeg, setLoadingSeg] = useState(false);
  const [uploadingSeg, setUploadingSeg] = useState(false);
  const [editando, setEditando] = useState(false);
  const faltam: string[] = [];
  if ((ins.total_fotos ?? 0) === 0)      faltam.push('fotos');
  if ((ins.total_pontos_me ?? 0) === 0)  faltam.push('medição de espessura');
  if (ins.tem_art !== 1)                 faltam.push('ART');


  const loadAnexosSeg = async () => {
    setLoadingSeg(true);
    try {
      const list = await inspecoesApi.listarAnexosSeguranca(ins.id);
      setAnexosSeg(Array.isArray(list) ? list : []);
    } catch {
      setAnexosSeg([]);
    } finally {
      setLoadingSeg(false);
    }
  };

  useEffect(() => {
    if (!expanded) return;
    if (docTab !== 'seguranca') return;
    loadAnexosSeg();
  }, [expanded, docTab]);
  return (
    <>
      <tr
        className={clsx(
          'border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors',
          expanded && 'bg-primary-50/40',
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-2 text-center">
          {expanded ? <ChevronDown size={14} className="text-gray-500 inline" /> : <ChevronRight size={14} className="text-gray-400 inline" />}
        </td>
        <td className="px-3 py-2 font-medium text-gray-700">{fmtData(ins.data)}</td>
        <td className="px-3 py-2 text-gray-600">{ins.tipo}</td>
        <td className="px-3 py-2">
          <Badge variant={resultadoVariant}>{ins.resultado}</Badge>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>
              {status.key === 'completa' && <Check size={11} className="mr-1" />}
              {status.key === 'vencida' && <AlertTriangle size={11} className="mr-1" />}
              {status.label}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span title="Fotos" className="flex items-center gap-0.5">
                <ImageIcon size={11} />{ins.total_fotos ?? 0}
              </span>
              <span title="Pontos de medição" className="flex items-center gap-0.5">
                <Activity size={11} />{ins.total_pontos_me ?? 0}
              </span>
              <span
                title={ins.tem_art ? 'ART anexada' : 'ART não anexada'}
                className={clsx('flex items-center gap-0.5', ins.tem_art ? 'text-success-700' : '')}
              >
                <FileText size={11} />{ins.tem_art ? 'OK' : '—'}
              </span>
            </div>
          </div>
          {ins.prazo_complementos && status.key !== 'completa' && (
            <div className="text-xs text-gray-400 mt-1">
              Prazo: {fmtData(ins.prazo_complementos)}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-gray-500">
          <div>{ins.ph_nome || '—'}</div>
          <div className="text-gray-400">ART: {ins.art || '—'}</div>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => {
                if (!podeBaixarPDF) {
                  toast.error('Complete fotos, medição e ART antes de gerar o relatório.');
                  return;
                }
                setDocTab('pdf');
                if (!expanded) onToggle();
              }}
              className={clsx(
                'btn btn-xs',
                podeBaixarPDF ? 'btn-primary' : 'opacity-40 cursor-not-allowed',
              )}
              title={podeBaixarPDF ? 'Abrir relatório' : 'Relatório disponível quando todos os complementos estiverem prontos'}
            >
              <Eye size={11} />
            </button>
            <button
              onClick={() => setEditando(true)}
              className="btn btn-xs"
              title="Editar dados da inspeção"
            >
              <Pencil size={11} />
            </button>
            <ConfirmDialog
              title="Excluir inspeção"
              message="Esta ação não pode ser desfeita. Fotos e medições associadas perderão o vínculo com esta inspeção."
              onConfirm={onExcluir}
              trigger={open => (
                <button onClick={open} className="btn btn-xs btn-danger">
                  <Trash2 size={11} />
                </button>
              )}
            />
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/50">
          <td colSpan={7} className="px-4 py-4">
            {/* Cabeçalho da expansão */}
            <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-gray-500">
                Detalhes da inspeção de <span className="font-semibold text-gray-700">{fmtData(ins.data)}</span>
                {ins.art_filename && (
                  <a
                    href={`/uploads/${encodeURIComponent(ins.art_filename)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 inline-flex items-center gap-1 text-primary-700 hover:underline"
                  >
                    <FileText size={11} /> Ver ART em PDF
                  </a>
                )}
              </div>
              {ins.instrumentos && ins.instrumentos.length > 0 && (
                <div className="text-xs text-gray-500">
                  Instrumentos: {ins.instrumentos.map(i => i.nome).join(', ')}
                </div>
              )}
            </div>

            {ins.observacoes && (
              <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                <div className="font-semibold text-gray-500 uppercase tracking-wide text-[10px] mb-1">Observações</div>
                {ins.observacoes}
              </div>
            )}

            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <Tabs
                ariaLabel="Documentos da inspeção"
                idPrefix={`insp-${ins.id}`}
                controlsPrefix={`insp-${ins.id}`}
                tabs={[
                  { id: 'fotos', label: 'Relatório fotográfico', icon: ImageIcon, badge: ins.total_fotos ?? 0 },
                  { id: 'ultrassom', label: 'Ultrassom', icon: Activity, badge: ins.total_pontos_me ?? 0 },
                  { id: 'seguranca', label: 'Dispositivos', icon: Paperclip, badge: anexosSeg.length },
                  { id: 'pdf', label: 'Gerar Relatório', icon: FileText },
                ]}
                active={docTab}
                onChange={id => setDocTab(id as any)}
              />

              <div
                id={`insp-${ins.id}-panel-fotos`}
                role="tabpanel"
                aria-labelledby={`insp-${ins.id}-tab-fotos`}
                hidden={docTab !== 'fotos'}
              >
                {docTab === 'fotos' && (
                  <FotoRelatorio equipamentoId={equipamentoId} inspecaoId={ins.id} compact />
                )}
              </div>

              <div
                id={`insp-${ins.id}-panel-ultrassom`}
                role="tabpanel"
                aria-labelledby={`insp-${ins.id}-tab-ultrassom`}
                hidden={docTab !== 'ultrassom'}
              >
                {docTab === 'ultrassom' && (
                  <MedicaoEspessuraForm
                    equipamentoId={equipamentoId}
                    inspecaoId={ins.id}
                    metalBase={metalBase}
                    compact
                    onSaved={onReload}
                  />
                )}
              </div>

              <div
                id={`insp-${ins.id}-panel-pdf`}
                role="tabpanel"
                aria-labelledby={`insp-${ins.id}-tab-pdf`}
                hidden={docTab !== 'pdf'}
              >
                {docTab === 'pdf' && (
                  <>
                    {podeBaixarPDF ? (
                      <div>
                        <div className="flex items-center gap-3 flex-wrap mb-3">
                          <a
                            href={pdfHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-primary"
                          >
                            <Download size={12} /> Gerar e baixar PDF
                          </a>
                          <span className="text-xs text-gray-400">
                            O PDF reúne capa, dados do equipamento, fotos, ultrassom, ART e calibrações.
                          </span>
                        </div>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                          <iframe
                            src={relatoriosApi.urlPDFInspecao(equipamentoId, ins.id)}
                            className="w-full h-[70vh]"
                            title="Pré-visualização do relatório PDF"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 bg-warning-50 border border-warning-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-warning-700 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-warning-700 mb-1">
                            Relatório indisponível
                          </div>
                          <div>
                            Para liberar o PDF, complete: <span className="font-medium">{faltam.join(', ')}</span>.
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div
                id={`insp-${ins.id}-panel-seguranca`}
                role="tabpanel"
                aria-labelledby={`insp-${ins.id}-tab-seguranca`}
                hidden={docTab !== 'seguranca'}
              >
                {docTab === 'seguranca' && (
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="text-xs text-gray-500">
                        Envie anexos (PDF/JPG/PNG) referentes a válvulas, manômetros e demais dispositivos de segurança.
                      </div>
                      <label className={clsx('btn btn-sm', uploadingSeg && 'opacity-60 pointer-events-none')}>
                        <Upload size={12} /> Enviar anexos
                        <input
                          type="file"
                          multiple
                          accept="application/pdf,image/jpeg,image/png"
                          className="hidden"
                          onChange={async e => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = '';
                            if (files.length === 0) return;
                            const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
                            for (const f of files) {
                              if (!allowed.includes(f.type)) { toast.error('Formato não suportado. Use PDF, JPG ou PNG.'); return; }
                              if (f.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 10 MB por arquivo).'); return; }
                            }
                            setUploadingSeg(true);
                            try {
                              await inspecoesApi.uploadAnexosSeguranca(ins.id, files);
                              toast.success('Anexos enviados!');
                              await loadAnexosSeg();
                            } catch (err: any) {
                              toast.error(err?.response?.data?.message || 'Erro ao enviar anexos.');
                            } finally {
                              setUploadingSeg(false);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {loadingSeg ? (
                      <div className="text-xs text-gray-400">Carregando anexos...</div>
                    ) : anexosSeg.length === 0 ? (
                      <div className="text-xs text-gray-400">Nenhum anexo enviado.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {anexosSeg.map(a => {
                          const isImg = (a.mimetype || '').startsWith('image/');
                          const url = `/uploads/${encodeURIComponent(a.filename)}`;
                          return (
                            <div key={a.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                              {isImg ? (
                                <img src={url} alt={a.nome_original || 'Anexo'} className="w-12 h-12 rounded object-cover bg-white border border-gray-200" />
                              ) : (
                                <FileText size={18} className="text-gray-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-700 hover:underline truncate block">
                                  {a.nome_original || a.filename}
                                </a>
                                <div className="text-xs text-gray-400">
                                  {a.mimetype || '—'}
                                  {typeof a.tamanho === 'number' ? ` · ${(a.tamanho / 1024).toFixed(0)} KB` : ''}
                                </div>
                              </div>
                              <ConfirmDialog
                                title="Remover anexo"
                                message="Deseja remover este anexo? Esta ação não pode ser desfeita."
                                onConfirm={async () => {
                                  try {
                                    await inspecoesApi.excluirAnexoSeguranca(a.id);
                                    toast.success('Anexo removido.');
                                    await loadAnexosSeg();
                                  } catch (err: any) {
                                    toast.error(err?.response?.data?.message || 'Erro ao remover anexo.');
                                  }
                                }}
                                trigger={open => (
                                  <button onClick={open} className="btn btn-xs btn-danger" type="button">
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </td>
        </tr>
      )}

      {editando && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 relative">
                <div className="flex items-center justify-between px-5 pt-5">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Editar inspeção de {fmtData(ins.data)}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditando(false)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>
                <InspecaoForm
                  equipamentoId={equipamentoId}
                  categoria={equipamento.categoria}
                  inspecao={ins}
                  onCancel={() => setEditando(false)}
                  onSaved={() => { setEditando(false); onReload(); }}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
