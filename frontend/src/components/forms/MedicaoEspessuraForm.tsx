'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { meApi, instrumentosApi } from '@/lib/api';
import { MedicaoEspessura, PontoMe, Instrumento } from '@/types';
import toast from 'react-hot-toast';
import { Plus, Trash2, Ruler, Pencil } from 'lucide-react';
import { calcReducao } from '@/lib/utils';
import clsx from 'clsx';

interface Props { equipamentoId: string; inspecaoId?: string; metalBase?: string; compact?: boolean; onSaved?: () => void; }

export function MedicaoEspessuraForm({ equipamentoId, inspecaoId, metalBase, compact = false, onSaved }: Props) {
  const [medicao, setMedicao] = useState<MedicaoEspessura | null>(null);
  const [saving, setSaving] = useState(false);
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [instrumentoId, setInstrumentoId] = useState<string>('');
  const [dados, setDados] = useState({
    dataEnsaio: '', norma: 'Petrobras N-1594 | ASME VIII Div.1', procedimento: '',
    equipamentoMed: '', cabecote: '', acoplante: 'Gel',
    certCalibracao: '', dataCalibracao: '', validadeCalibracao: '',
    metalBase: metalBase || '', condicaoSuperficial: 'Limpa/Escovada',
    temperaturaPeca: '', inspetor: '', conclusao: '',
  });
  const [pontos, setPontos] = useState<Partial<PontoMe>[]>([]);
  const [uploadingCroqui, setUploadingCroqui] = useState(false);

  // Carrega o cadastro central de instrumentos para o select de equipamento de medição
  useEffect(() => {
    instrumentosApi.listar().then(setInstrumentos).catch(() => setInstrumentos([]));
  }, []);

  // Quando carrega medição existente, tenta inferir qual instrumento foi usado
  useEffect(() => {
    if (instrumentos.length === 0) return;
    if (medicao?.instrumento_id) {
      setInstrumentoId(String(medicao.instrumento_id));
      return;
    }
    if (!medicao?.equipamento_med) return;
    const m = instrumentos.find(i => i.nome === medicao.equipamento_med);
    if (m) setInstrumentoId(m.id);
  }, [medicao?.instrumento_id, medicao?.equipamento_med, instrumentos]);

  const selecionarInstrumento = (id: string) => {
    setInstrumentoId(id);
    if (!id) return;
    const i = instrumentos.find(x => x.id === id);
    if (!i) return;
    // Auto-popula campos relacionados (engenheiro pode sobrescrever depois)
    setDados(d => ({
      ...d,
      equipamentoMed: i.nome,
      certCalibracao: i.certificado_numero || d.certCalibracao,
      dataCalibracao: i.data_calibracao || d.dataCalibracao,
      validadeCalibracao: i.validade_calibracao || d.validadeCalibracao,
    }));
  };

  const load = () => meApi.listar(equipamentoId, inspecaoId).then(r => {
    if (r[0]) {
      const m: MedicaoEspessura = r[0];
      setMedicao(m);
      setDados({
        dataEnsaio: m.data_ensaio || '', norma: m.norma || '',
        procedimento: m.procedimento || '', equipamentoMed: m.equipamento_med || '',
        cabecote: m.cabecote || '', acoplante: m.acoplante || '',
        certCalibracao: m.cert_calibracao || '', dataCalibracao: m.data_calibracao || '',
        validadeCalibracao: m.validade_calibracao || '', metalBase: m.metal_base || metalBase || '',
        condicaoSuperficial: m.condicao_superficial || '',
        temperaturaPeca: m.temperatura_peca?.toString() || '', inspetor: m.inspetor || '',
        conclusao: m.conclusao || '',
      });
      setPontos(m.pontos || []);
    }
  });

  useEffect(() => { load(); }, [equipamentoId, inspecaoId]);

  const setD = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDados(d => ({ ...d, [k]: e.target.value }));

  const addPonto = () => setPontos(p => [...p, {
    numero: `P${p.length + 1}`, regiao: '',
    espessura_nominal: undefined, espessura_encontrada: undefined, espessura_minima: undefined,
  }]);

  const removePonto = (i: number) => setPontos(p =>
    p.filter((_, j) => j !== i).map((x, j) => ({ ...x, numero: `P${j + 1}` })));

  const setP = (i: number, k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPontos(p => p.map((x, j) => j === i ? { ...x, [k]: e.target.value ? parseFloat(e.target.value) : undefined } : x));

  const setPStr = (i: number, k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPontos(p => p.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x));

  const salvar = async () => {
    setSaving(true);
    try {
      await meApi.salvar({
        equipamentoId, inspecaoId,
        instrumentoId: instrumentoId || undefined,
        ...dados,
        temperaturaPeca: dados.temperaturaPeca ? parseFloat(dados.temperaturaPeca) : undefined,
        pontos: pontos.map(p => ({
          numero: p.numero || '',
          regiao: p.regiao,
          espessuraNominal: p.espessura_nominal,
          espessuraEncontrada: p.espessura_encontrada,
          espessuraMinima: p.espessura_minima,
        })),
      });
      toast.success('Medição de espessura salva!');
      load();
      onSaved?.();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar.';
      toast.error(String(msg));
    } finally { setSaving(false); }
  };

  const handleCroquiUpload = async (file: File) => {
    if (!medicao) return;
    setUploadingCroqui(true);
    try {
      const updated = await meApi.uploadCroqui(medicao.id, file);
      setMedicao(updated);
      toast.success('Croqui salvo!');
    } catch {
      toast.error('Erro ao salvar o croqui.');
    } finally {
      setUploadingCroqui(false);
    }
  };

  const handleCroquiRemove = async () => {
    if (!medicao) return;
    setUploadingCroqui(true);
    try {
      await meApi.removeCroqui(medicao.id);
      setMedicao(m => m ? { ...m, croqui_filename: undefined } : m);
      toast.success('Croqui removido.');
    } catch {
      toast.error('Erro ao remover o croqui.');
    } finally {
      setUploadingCroqui(false);
    }
  };

  const getStatus = (p: Partial<PontoMe>) => {
    const enc = p.espessura_encontrada, nom = p.espessura_nominal, min = p.espessura_minima;
    if (!enc) return null;
    if (min && enc < min) return 'critico';
    if (nom && enc < nom * 0.9) return 'atencao';
    return 'ok';
  };

  const critCount = pontos.filter(p => getStatus(p) === 'critico').length;
  const encValues = pontos.map(p => p.espessura_encontrada).filter((v): v is number => v !== undefined && v > 0);

  return (
    <div>
      {/* Resumo estatístico */}
      {encValues.length > 0 && !compact && (
        <div className="flex flex-wrap gap-3 mb-5 items-stretch">
          {[
            { label: 'Pontos medidos', val: encValues.length, color: '' },
            { label: 'Menor espessura', val: `${Math.min(...encValues).toFixed(2)} mm`, color: critCount > 0 ? 'text-red-600' : '' },
            { label: 'Maior espessura', val: `${Math.max(...encValues).toFixed(2)} mm`, color: '' },
            { label: 'Pontos críticos', val: critCount, color: critCount > 0 ? 'text-red-600 font-bold' : 'text-green-600' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex-1 min-w-[220px]">
              <div className="text-xs text-gray-500">{label}</div>
              <div className={clsx('text-lg font-bold mt-1', color || 'text-gray-900')}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Equipamento de inspeção utilizado */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Ruler size={14} className="text-primary-600" /> Equipamento de inspeção (instrumento)
        </h3>
        {instrumentos.length === 0 ? (
          <div className="text-xs text-gray-400">
            Nenhum instrumento cadastrado. Vá em{' '}
            <Link href="/instrumentos" className="text-primary-700 hover:underline">
              Instrumentos
            </Link>
            {' '}para fazer o cadastro.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <select
                className="input flex-1"
                value={instrumentoId}
                onChange={e => selecionarInstrumento(e.target.value)}
              >
                <option value="">— Selecione o instrumento utilizado —</option>
                {instrumentos.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                    {i.tipo ? ` · ${i.tipo}` : ''}
                    {i.certificado_numero ? ` · Cert ${i.certificado_numero}` : ''}
                    {i.validade_calibracao ? ` · Validade ${i.validade_calibracao.slice(0, 10).split('-').reverse().join('/')}` : ''}
                  </option>
                ))}
              </select>
              <Link
                href={instrumentoId ? `/instrumentos/${instrumentoId}/editar` : '#'}
                aria-disabled={!instrumentoId}
                tabIndex={instrumentoId ? 0 : -1}
                onClick={e => { if (!instrumentoId) e.preventDefault(); }}
                className={clsx(
                  'btn btn-sm',
                  !instrumentoId && 'opacity-40 pointer-events-none',
                )}
                title="Editar instrumento selecionado"
              >
                <Pencil size={12} /> Editar
              </Link>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Selecionar um instrumento preenche automaticamente os campos de
              certificado e datas de calibração abaixo. Você pode editá-los manualmente se necessário.
            </div>
          </>
        )}
      </div>

      {/* Dados do ensaio */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Dados do ensaio</h3>
        <div className="flex flex-wrap gap-3 items-start">
          {[
            ['Data do ensaio', 'dataEnsaio', 'date'], ['Inspetor END', 'inspetor', 'text'],
            ['Norma de referência', 'norma', 'text'], ['Procedimento / Rev.', 'procedimento', 'text'],
            ['Equipamento de medição', 'equipamentoMed', 'text'], ['Cabeçote', 'cabecote', 'text'],
            ['Acoplante', 'acoplante', 'text'], ['Cert. calibração', 'certCalibracao', 'text'],
            ['Data calibração', 'dataCalibracao', 'date'], ['Validade calibração', 'validadeCalibracao', 'date'],
            ['Metal de base', 'metalBase', 'text'], ['Condição superficial', 'condicaoSuperficial', 'text'],
            ['Temperatura da peça (°C)', 'temperaturaPeca', 'number'],
          ].map(([label, key, type]) => (
            <div key={key} className="flex-1 min-w-[260px]">
              <label className="label">{label}</label>
              <input className="input" type={type} value={(dados as any)[key]} onChange={setD(key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de pontos */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Tabela de pontos de medição</h3>
          <button onClick={addPonto} className="btn btn-primary btn-sm"><Plus size={13} /> Ponto</button>
        </div>

        {pontos.length === 0 ? (
          <div className="text-center py-6 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            Nenhum ponto. Clique em "+ Ponto" para adicionar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['Ponto', 'Região / Descrição', 'E. Nominal (mm)', 'E. Encontrada (mm)', 'E. Mínima (mm)', 'Redução', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-2 border-b border-gray-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pontos.map((p, i) => {
                  const red = calcReducao(p.espessura_nominal, p.espessura_encontrada);
                  const st = getStatus(p);
                  return (
                    <tr key={i} className={clsx('border-b border-gray-100 transition-colors',
                      st === 'critico' ? 'bg-red-50' : st === 'atencao' ? 'bg-yellow-50' : '')}>
                      <td className="px-2 py-1.5 font-bold text-gray-700 w-16">{p.numero}</td>
                      <td className="px-2 py-1.5">
                        <select className="input py-1 text-xs w-36"
                          value={p.regiao || ''} onChange={setPStr(i, 'regiao')}>
                          <option value="">— Selecione —</option>
                          <option value="Casco">Casco</option>
                          <option value="Tampo">Tampo</option>
                          <option value="Costado">Costado</option>
                          <option value="Virola">Virola</option>
                          <option value="Fundo">Fundo</option>
                          <option value="Teto">Teto</option>
                          <option value="Bocal">Bocal</option>
                          <option value="Flange">Flange</option>
                          <option value="Espelho">Espelho</option>
                          <option value="Câmara de Combustão">Câmara de Combustão</option>
                          <option value="Coluna d'Água">Coluna d'Água</option>
                          <option value="Geratriz">Geratriz</option>
                        </select>
                      </td>
                      {[
                        ['espessura_nominal', 'E. nom.'],
                        ['espessura_encontrada', 'E. enc.'],
                        ['espessura_minima', 'E. mín.'],
                      ].map(([k, ph]) => (
                        <td key={k} className="px-2 py-1.5 w-28">
                          <input className="input py-1 text-xs text-center"
                            type="number" step="0.01" placeholder="0.00"
                            value={(p as any)[k] ?? ''} onChange={setP(i, k)} />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center text-xs font-semibold w-20">
                        {red !== null ? `${red}%` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center w-20">
                        {st === 'critico' && <span className="badge badge-danger">Crítico</span>}
                        {st === 'atencao' && <span className="badge badge-warning">Atenção</span>}
                        {st === 'ok'      && <span className="badge badge-success">OK</span>}
                        {st === null      && <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-2 py-1.5 w-10">
                        <button onClick={() => removePonto(i)} className="btn btn-xs btn-danger">
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Croqui */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Croqui do equipamento</h3>

        {!medicao ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Salve a medição primeiro para anexar o croqui.
          </p>
        ) : medicao.croqui_filename ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={`/uploads/${encodeURIComponent(medicao.croqui_filename!)}`}
              alt="Croqui do equipamento"
              className="max-h-96 rounded-lg border border-gray-200 object-contain"
            />
            <button
              onClick={handleCroquiRemove}
              disabled={uploadingCroqui}
              className="btn btn-sm btn-danger"
            >
              {uploadingCroqui ? 'Removendo...' : 'Remover croqui'}
            </button>
          </div>
        ) : (
          <label
            className={clsx(
              'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors',
              uploadingCroqui
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50',
            )}
            onClick={e => { if (uploadingCroqui) e.preventDefault(); }}
          >
            {uploadingCroqui ? (
              <span className="text-xs text-gray-400">Enviando...</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12V4m0 0L8 8m4-4l4 4" />
                </svg>
                <span className="text-sm text-gray-500">Clique para enviar o croqui</span>
                <span className="text-xs text-gray-400">JPG, PNG ou WebP</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploadingCroqui}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                  if (!allowed.includes(file.type)) {
                    toast.error('Formato não suportado. Use JPG, PNG ou PDF.');
                    e.target.value = '';
                    return;
                  }
                  if (file.size > 10 * 1024 * 1024) {
                    toast.error('Arquivo muito grande (máximo 10 MB).');
                    e.target.value = '';
                    return;
                  }
                  handleCroquiUpload(file);
                }
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      {/* Conclusão */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Conclusão do ensaio</h3>
        <textarea className="input" rows={3} value={dados.conclusao} onChange={setD('conclusao')}
          placeholder="Ex: Não foram detectadas reduções significativas de espessura. O equipamento está apto para operação na PMTA indicada." />
      </div>

      <div className="flex justify-end">
        <button onClick={salvar} disabled={saving} className="btn btn-primary">
          {saving ? 'Salvando...' : 'Salvar medição de espessura'}
        </button>
      </div>
    </div>
  );
}
