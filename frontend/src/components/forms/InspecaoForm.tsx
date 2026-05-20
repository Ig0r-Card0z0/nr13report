'use client';
import { useEffect, useState } from 'react';
import { inspecoesApi, profissionaisApi } from '@/lib/api';
import { DispositivoSeguranca, Profissional } from '@/types';
import { calcularPrazosNR13, PRAZOS_NR13 } from '@/lib/constants';
import { fmtData } from '@/lib/utils';
import { VencBadge } from '@/components/ui/VencBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { FileText, Trash2, Upload, RefreshCw, AlertTriangle, Plus, X } from 'lucide-react';

interface Props {
  equipamentoId: string;
  categoria?: string;
  prazosAtuais?: { proxExterno?: string; proxInterno?: string; proxHidro?: string };
  onSaved: () => void;
}

const TIPOS = ['Externa', 'Interna', 'Interna e Externa'];
const RESULTADOS = ['Apto', 'Inapto', 'Apto com restrições'];
const ESPECIALIDADES = [
  'Engenharia Mecânica',
  'Engenharia de Inspeção',
  'Engenharia Metalúrgica',
  'Engenharia de Segurança do Trabalho',
  'Inspetor de Equipamentos',
  'Outra',
];

export function InspecaoForm({ equipamentoId, categoria, prazosAtuais, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [artFile, setArtFile] = useState<File | null>(null);
  const [overrides, setOverrides] = useState({ ext: false, int: false, hid: false });
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [profissionalId, setProfissionalId] = useState<string>('');
  const [modalAberto, setModalAberto] = useState(false);
  const [disp, setDisp] = useState<Array<Partial<DispositivoSeguranca> & { file?: File | null }>>([]);
  const [novoProf, setNovoProf] = useState({
    nome: '', crea: '', especialidade: 'Engenharia Mecânica',
  });
  const [salvandoProf, setSalvandoProf] = useState(false);
  const [form, setForm] = useState({
    data: '', tipo: 'Externa', resultado: 'Apto',
    phNome: '', phCrea: '', art: '',
    proxExterno: prazosAtuais?.proxExterno || '',
    proxInterno: prazosAtuais?.proxInterno || '',
    proxHidro:   prazosAtuais?.proxHidro   || '',
    prazoComplementos: '',
    observacoes: '',
  });

  useEffect(() => {
    profissionaisApi.listar().then(setProfissionais).catch(() => setProfissionais([]));
  }, []);

  const selecionarProfissional = (id: string) => {
    setProfissionalId(id);
    const p = profissionais.find(x => x.id === id);
    setForm(f => ({
      ...f,
      phNome: p?.nome || '',
      phCrea: p?.crea || '',
    }));
  };

  const salvarNovoProfissional = async () => {
    if (!novoProf.nome.trim()) { toast.error('Informe o nome do profissional.'); return; }
    setSalvandoProf(true);
    try {
      const criado = await profissionaisApi.criar(novoProf);
      const lista = await profissionaisApi.listar();
      setProfissionais(lista);
      setProfissionalId(criado.id);
      setForm(f => ({ ...f, phNome: criado.nome || '', phCrea: criado.crea || '' }));
      setModalAberto(false);
      setNovoProf({ nome: '', crea: '', especialidade: 'Engenharia Mecânica' });
      toast.success('Profissional cadastrado!');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao cadastrar profissional.';
      toast.error(String(msg));
    } finally { setSalvandoProf(false); }
  };

  // Auto-cálculo dos prazos NR-13 sempre que data ou categoria mudam.
  // Não sobrescreve um campo que o engenheiro já editou manualmente.
  useEffect(() => {
    if (!form.data || !categoria) return;
    const calc = calcularPrazosNR13(categoria, form.data);
    setForm(f => ({
      ...f,
      proxExterno: overrides.ext ? f.proxExterno : (calc.proxExterno || ''),
      proxInterno: overrides.int ? f.proxInterno : (calc.proxInterno || ''),
      proxHidro:   overrides.hid ? f.proxHidro   : (calc.proxHidro   || ''),
    }));
  }, [form.data, categoria, overrides.ext, overrides.int, overrides.hid]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Marca um prazo como override manual ao usuário tocar nele
  const setPrazo = (k: 'proxExterno' | 'proxInterno' | 'proxHidro', flag: 'ext' | 'int' | 'hid') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOverrides(o => ({ ...o, [flag]: true }));
      setForm(f => ({ ...f, [k]: e.target.value }));
    };

  const recalcular = () => {
    if (!form.data) { toast.error('Informe a data da inspeção atual.'); return; }
    if (!categoria) { toast.error('O equipamento não tem categoria definida.'); return; }
    const calc = calcularPrazosNR13(categoria, form.data);
    setForm(f => ({
      ...f,
      proxExterno: calc.proxExterno || f.proxExterno,
      proxInterno: calc.proxInterno || f.proxInterno,
      proxHidro:   calc.proxHidro   || f.proxHidro,
    }));
    setOverrides({ ext: false, int: false, hid: false });
    toast.success('Prazos recalculados pela NR-13.');
  };

  const onArtChange = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('A ART deve ser um arquivo PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 10 MB).');
      return;
    }
    setArtFile(file);
  };

  const reset = () => {
    setForm({
      data: '', tipo: 'Externa', resultado: 'Apto', phNome: '', phCrea: '', art: '',
      proxExterno: prazosAtuais?.proxExterno || '',
      proxInterno: prazosAtuais?.proxInterno || '',
      proxHidro:   prazosAtuais?.proxHidro   || '',
      prazoComplementos: '',
      observacoes: '',
    });
    setOverrides({ ext: false, int: false, hid: false });
    setArtFile(null);
    setProfissionalId('');
    setDisp([]);
  };

  // Validações de UI (server também valida)
  const validarLocal = (): string | null => {
    if (!form.data) return 'Informe a data da inspeção.';
    const dt = form.data.slice(0, 10);
    const checks: { rotulo: string; v: string }[] = [
      { rotulo: 'externa',        v: form.proxExterno },
      { rotulo: 'interna',        v: form.proxInterno },
      { rotulo: 'hidrostática',   v: form.proxHidro },
    ];
    for (const c of checks) {
      if (c.v && c.v.slice(0, 10) < dt) {
        return `A próxima inspeção (${c.rotulo}) não pode ser anterior à data da inspeção atual.`;
      }
    }
    // Aviso sobre exceder NR-13 (apenas warn — backend já segura)
    if (categoria && PRAZOS_NR13[categoria]) {
      const max = PRAZOS_NR13[categoria];
      const base = new Date(dt + 'T12:00:00Z');
      const limites: { rotulo: string; v: string; anos: string }[] = [
        { rotulo: 'externa',      v: form.proxExterno, anos: max.ext },
        { rotulo: 'interna',      v: form.proxInterno, anos: max.int },
        { rotulo: 'hidrostática', v: form.proxHidro,   anos: max.hid },
      ];
      for (const lim of limites) {
        if (!lim.v) continue;
        const dlim = new Date(lim.v + 'T12:00:00Z');
        const anos = (dlim.getTime() - base.getTime()) / (365.25 * 24 * 3600 * 1000);
        const maxAnos = parseInt(lim.anos);
        if (anos > maxAnos + 0.5) {
          return `O prazo da próxima inspeção ${lim.rotulo} ultrapassa o máximo da NR-13 (${lim.anos}) para a categoria ${categoria}.`;
        }
      }
    }
    return null;
  };

  const salvar = async () => {
    const erro = validarLocal();
    if (erro) { toast.error(erro); return; }
    setSaving(true);
    try {
      const criada = await inspecoesApi.criar({
        equipamentoId,
        data: form.data,
        tipo: form.tipo,
        resultado: form.resultado,
        phNome: form.phNome || undefined,
        phCrea: form.phCrea || undefined,
        art: form.art || undefined,
        proxExterno: form.proxExterno || undefined,
        proxInterno: form.proxInterno || undefined,
        proxHidro:   form.proxHidro   || undefined,
        prazoComplementos: form.prazoComplementos || undefined,
        observacoes: form.observacoes || undefined,
      });

      if (artFile) {
        try { await inspecoesApi.uploadArt(criada.id, artFile); }
        catch { toast.error('Inspeção registrada, mas houve erro ao anexar a ART.'); }
      }

      const dispValidos = disp
        .map(d => ({
          tipo: d.tipo,
          descricao: d.descricao,
          fabricante: d.fabricante,
          modelo: d.modelo,
          serie: d.serie,
          certificadoNumero: d.certificado_numero,
          dataCalibracao: d.data_calibracao,
          validadeCalibracao: d.validade_calibracao,
          observacoes: d.observacoes,
          file: d.file || null,
        }))
        .filter(d => [d.tipo, d.descricao, d.fabricante, d.modelo, d.serie, d.certificadoNumero, d.dataCalibracao, d.validadeCalibracao, d.observacoes]
          .some(v => typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null));

      if (dispValidos.length > 0) {
        try {
          const created: DispositivoSeguranca[] = await inspecoesApi.setDispositivosSeguranca(
            criada.id,
            dispValidos.map(({ file, ...rest }) => rest),
          );
          for (let i = 0; i < dispValidos.length; i++) {
            const file = dispValidos[i].file;
            const id = created?.[i]?.id;
            if (!file || !id) continue;
            try { await inspecoesApi.uploadCertificadoDispositivoSeguranca(id, file); }
            catch { toast.error('Inspeção registrada, mas houve erro ao anexar o arquivo de um documento.'); }
          }
        } catch (err: any) {
          toast.error(err?.response?.data?.message || 'Inspeção registrada, mas houve erro ao salvar a documentação complementar.');
        }
      }

      toast.success('Inspeção registrada!');
      reset();
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar inspeção.';
      toast.error(String(msg));
    } finally { setSaving(false); }
  };

  const max = categoria ? PRAZOS_NR13[categoria] : null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Registrar nova inspeção</h3>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Data da inspeção *</label>
          <input className="input" type="date" value={form.data} onChange={set('data')} />
          {form.data && (
            <div className="text-xs text-gray-400 mt-1">{fmtData(form.data)}</div>
          )}
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={set('tipo')}>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Resultado</label>
          <select className="input" value={form.resultado} onChange={set('resultado')}>
            {RESULTADOS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Profissional responsável (PH)</label>
          <div className="flex gap-2">
            <select
              className="input flex-1"
              value={profissionalId}
              onChange={e => selecionarProfissional(e.target.value)}
            >
              <option value="">— Selecione um profissional —</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome}{p.crea ? ` — CREA ${p.crea}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="btn"
              title="Cadastrar novo profissional"
            >
              <Plus size={14} /> Novo
            </button>
          </div>
          {profissionalId && (form.phNome || form.phCrea) && (
            <div className="text-xs text-gray-400 mt-1">
              {form.phNome}{form.phCrea ? ` · CREA ${form.phCrea}` : ''}
            </div>
          )}
        </div>
        <div>
          <label className="label">Nº da ART</label>
          <input className="input" value={form.art} onChange={set('art')} placeholder="AM00000000000" />
        </div>
      </div>

      <hr className="my-4 border-gray-200" />

      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ART (PDF anexo)</div>
      {artFile ? (
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 mb-4">
          <FileText className="text-primary-600" size={18} />
          <div className="flex-1 text-sm font-medium text-gray-700 truncate">{artFile.name}</div>
          <button
            type="button"
            onClick={() => setArtFile(null)}
            className="btn btn-sm btn-danger"
          >
            <Trash2 size={12} /> Remover
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300
          rounded-lg p-4 mb-4 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
          <Upload className="text-gray-300" size={20} />
          <span className="text-sm text-gray-500">Clique para anexar a ART em PDF</span>
          <span className="text-xs text-gray-400">Apenas PDF — máx 10 MB</span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => { onArtChange(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documentação complementar</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Todo documento cadastrado aqui será anexado ao relatório final. O tipo pode ser qualquer descrição — sugestões na lista.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setDisp(list => [...list, { tipo: '', file: null }])}
        >
          <Plus size={12} /> Adicionar documento
        </button>
      </div>
      {disp.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {disp.map((d, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap gap-3 items-start">
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Tipo de documento</label>
                  <input
                    className="input"
                    list={`doc-tipos-${idx}`}
                    value={String(d.tipo || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, tipo: e.target.value } : x))}
                    placeholder="Ex.: Válvula de segurança, Manômetro, Laudo NDT, Plano de manutenção…"
                  />
                  <datalist id={`doc-tipos-${idx}`}>
                    {[
                      'Válvula de segurança',
                      'Manômetro',
                      'Disco de ruptura',
                      'Pressostato',
                      'Laudo NDT',
                      'Plano de manutenção',
                      'Procedimento operacional',
                      'Outro',
                    ].map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div className="flex-1 min-w-[260px]">
                  <label className="label">Descrição</label>
                  <input
                    className="input"
                    value={String(d.descricao || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x))}
                    placeholder="Ex.: Tag VS-01 / MAN-01"
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Fabricante</label>
                  <input
                    className="input"
                    value={String(d.fabricante || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, fabricante: e.target.value } : x))}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Modelo</label>
                  <input
                    className="input"
                    value={String(d.modelo || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, modelo: e.target.value } : x))}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Nº de série</label>
                  <input
                    className="input"
                    value={String(d.serie || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, serie: e.target.value } : x))}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Nº do certificado</label>
                  <input
                    className="input"
                    value={String(d.certificado_numero || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, certificado_numero: e.target.value } : x))}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Data calibração</label>
                  <input
                    className="input"
                    type="date"
                    value={String(d.data_calibracao || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, data_calibracao: e.target.value } : x))}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <label className="label">Validade calibração</label>
                  <input
                    className="input"
                    type="date"
                    value={String(d.validade_calibracao || '')}
                    onChange={e => setDisp(list => list.map((x, i) => i === idx ? { ...x, validade_calibracao: e.target.value } : x))}
                  />
                </div>
                <div className="flex-1 min-w-[280px]">
                  <label className="label">Arquivo do documento (PDF)</label>
                  <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                    <Upload size={14} className="text-gray-300" />
                    <span className="text-sm text-gray-600 truncate flex-1">
                      {d.file?.name || 'Selecionar PDF (anexa ao relatório final)'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0] || null;
                        if (file && file.type !== 'application/pdf') {
                          toast.error('O relatório de calibração deve ser um PDF.');
                          e.target.value = '';
                          return;
                        }
                        if (file && file.size > 10 * 1024 * 1024) {
                          toast.error('Arquivo muito grande (máx 10 MB).');
                          e.target.value = '';
                          return;
                        }
                        setDisp(list => list.map((x, i) => i === idx ? { ...x, file } : x));
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setDisp(list => list.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={12} /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Próximas inspeções previstas</div>
          {categoria ? (
            <div className="text-xs text-gray-400 mt-0.5">
              Categoria <span className="font-semibold text-gray-700">{categoria}</span> — NR-13 (Tabela 1 sem SPIE):
              externa em até {max?.ext}, interna em até {max?.int}, hidrostático em até {max?.hid}.
            </div>
          ) : (
            <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={11} />
              Equipamento sem categoria definida — os prazos não serão pré-calculados.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={recalcular}
          className="btn btn-sm"
          title="Aplica a Tabela 1 da NR-13 (sem SPIE) à data desta inspeção"
        >
          <RefreshCw size={12} /> Recalcular pela NR-13
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { key: 'proxExterno', flag: 'ext' as const, label: 'Próx. exame externo' },
          { key: 'proxInterno', flag: 'int' as const, label: 'Próx. exame interno' },
          { key: 'proxHidro',   flag: 'hid' as const, label: 'Próx. teste hidrostático' },
        ].map(({ key, flag, label }) => {
          const v = (form as any)[key] as string;
          const isOverride = overrides[flag];
          return (
            <div key={key}>
              <div className="flex items-center justify-between">
                <label className="label">{label}</label>
                <VencBadge dt={v} />
              </div>
              <input
                className="input"
                type="date"
                value={v}
                onChange={setPrazo(key as any, flag)}
              />
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                {v ? fmtData(v) : '—'}
                {isOverride && (
                  <span className="ml-auto text-amber-600 font-medium">ajustado manualmente</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <hr className="my-4 border-gray-200" />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="label">Prazo p/ finalizar complementos</label>
          <input
            className="input"
            type="date"
            value={form.prazoComplementos}
            onChange={set('prazoComplementos')}
          />
          <div className="text-xs text-gray-400 mt-1">
            {form.prazoComplementos ? fmtData(form.prazoComplementos) : 'Opcional · operacional, não é prazo NR-13'}
          </div>
        </div>
        <div className="col-span-2 text-xs text-gray-500 pt-6">
          Define até quando fotos, medição de espessura e ART devem ser anexadas a esta inspeção.
          A linha desta inspeção mostrará <span className="font-semibold text-amber-700">Incompleta</span> até
          os 3 itens estarem prontos, e <span className="font-semibold text-red-700">Vencida</span> se o prazo passar.
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Observações / Recomendações do PH</label>
        <textarea className="input" rows={3} value={form.observacoes} onChange={set('observacoes')}
          placeholder="Descreva as recomendações, condições observadas, anomalias encontradas..." />
      </div>

      <div className="flex justify-end">
        <ConfirmDialog
          title="Confirmar registro"
          message={
            `Registrar a inspeção e salvar os prazos? ` +
            `Externo: ${form.proxExterno ? fmtData(form.proxExterno) : '—'} • ` +
            `Interno: ${form.proxInterno ? fmtData(form.proxInterno) : '—'} • ` +
            `Hidrostático: ${form.proxHidro ? fmtData(form.proxHidro) : '—'}`
          }
          variant="warning"
          onConfirm={salvar}
          trigger={open => (
            <button onClick={open} disabled={saving} className="btn btn-primary">
              {saving ? 'Salvando...' : 'Registrar inspeção'}
            </button>
          )}
        />
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Novo profissional</h3>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Nome completo *</label>
                <input
                  className="input"
                  value={novoProf.nome}
                  onChange={e => setNovoProf(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex.: Igor Cardozo e Oliveira Santos"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">CREA</label>
                <input
                  className="input"
                  value={novoProf.crea}
                  onChange={e => setNovoProf(p => ({ ...p, crea: e.target.value }))}
                  placeholder="041725365-6"
                />
              </div>
              <div>
                <label className="label">Especialidade</label>
                <select
                  className="input"
                  value={novoProf.especialidade}
                  onChange={e => setNovoProf(p => ({ ...p, especialidade: e.target.value }))}
                >
                  {ESPECIALIDADES.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="btn"
                disabled={salvandoProf}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarNovoProfissional}
                disabled={salvandoProf}
                className="btn btn-primary"
              >
                {salvandoProf ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
