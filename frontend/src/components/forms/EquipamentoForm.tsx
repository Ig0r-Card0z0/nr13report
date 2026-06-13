'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clientesApi, equipamentosApi } from '@/lib/api';
import { calcCategoria } from '@/lib/utils';
import {
  FLUIDOS_NR13, CLASSE_PADRAO_POR_FLUIDO,
  isCaldeira, categorizarCaldeiraForm, periodicidadeCaldeiraMeses,
  TIPOS_CALDEIRA, COMBUSTIVEIS_CALDEIRA, CategoriaCaldeira,
} from '@/lib/nr13';
import { Cliente } from '@/types';
import toast from 'react-hot-toast';

interface Props { equipamentoId?: string; }

export default function EquipamentoForm({ equipamentoId }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saving, setSaving] = useState(false);
  const [catInfo, setCatInfo] = useState<{
    cat: string; grupo: string; pv: number; pvMpa: number; pvKpa: number;
    enquadrado: boolean; dispensaInternaHidro: boolean; observacao: string;
  } | null>(null);
  const [caldInfo, setCaldInfo] = useState<{
    categoria: CategoriaCaldeira; observacao: string; prazoMeses: number;
  } | null>(null);

  const [form, setForm] = useState({
    clienteId: sp.get('clienteId') || '',
    tag: '', tipo: 'Vaso de Pressão', fabricante: '', serie: '', ano: '',
    posicao: 'Vertical', codigoProjeto: '', localInstalacao: '',
    fluido: 'Ar Comprimido', classeFluido: 'C', temperaturaProj: '',
    volume: '', pressaoOperacao: '', pmta: '', pressaoHidro: '', metalBase: '',
    categoria: '', grupoRisco: '',
    // Campos específicos de caldeira (NR-13 item 13.4)
    pressaoProjeto: '',
    tipoCaldeira: 'Flamotubular', combustivel: 'GLP',
    capacidadeTermica: '', areaAquecimento: '',
    comSpie: false, valvulasTestadas12m: false,
  });

  const ehCaldeira = isCaldeira(form.tipo);

  useEffect(() => { clientesApi.listar().then(setClientes); }, []);

  // Ao trocar o tipo para Caldeira, sugere o fluido "Vapor d'água" (classe C)
  // caso ainda esteja no padrão de vaso (Ar Comprimido).
  useEffect(() => {
    if (ehCaldeira) {
      setForm(f => f.fluido === 'Ar Comprimido'
        ? { ...f, fluido: "Vapor d'água", classeFluido: 'C' }
        : f);
    }
  }, [ehCaldeira]);
  useEffect(() => {
    if (equipamentoId) equipamentosApi.buscar(equipamentoId).then(e => setForm({
      clienteId: e.cliente_id, tag: e.tag, tipo: e.tipo, fabricante: e.fabricante || '',
      serie: e.serie || '', ano: e.ano || '', posicao: e.posicao || 'Vertical',
      codigoProjeto: e.codigo_projeto || '', localInstalacao: e.local_instalacao || '',
      fluido: e.fluido || 'Ar Comprimido', classeFluido: e.classe_fluido || 'C',
      temperaturaProj: e.temperatura_projeto?.toString() || '',
      volume: e.volume?.toString() || '', pressaoOperacao: e.pressao_operacao?.toString() || '',
      pmta: e.pmta?.toString() || '', pressaoHidro: e.pressao_hidro?.toString() || '',
      metalBase: e.metal_base || '', categoria: e.categoria || '', grupoRisco: e.grupo_risco || '',
      pressaoProjeto: e.pressao_projeto?.toString() || '',
      tipoCaldeira: e.tipo_caldeira || 'Flamotubular',
      combustivel: e.combustivel || 'GLP',
      capacidadeTermica: e.capacidade_termica?.toString() || '',
      areaAquecimento: e.area_aquecimento?.toString() || '',
      comSpie: !!e.com_spie, valvulasTestadas12m: !!e.valvulas_testadas_12m,
    }));
  }, [equipamentoId]);

  useEffect(() => {
    if (ehCaldeira) {
      // Caldeira: categoria A/B/C pela pressão de operação (e volume p/ cat. C)
      const po = parseFloat(form.pressaoOperacao);
      const v = parseFloat(form.volume);
      if (po) {
        const r = categorizarCaldeiraForm(po, isNaN(v) ? undefined : v);
        const prazoMeses = periodicidadeCaldeiraMeses(r.categoria, {
          comSpie: form.comSpie, valvulasTestadas12m: form.valvulasTestadas12m,
        });
        setCaldInfo({ categoria: r.categoria, observacao: r.observacao, prazoMeses });
        setCatInfo(null);
        setForm(f => ({ ...f, categoria: r.categoria, grupoRisco: '' }));
      }
      return;
    }
    setCaldInfo(null);
    const v = parseFloat(form.volume), pmta = parseFloat(form.pmta);
    if (v && pmta) {
      const r = calcCategoria(v, pmta, form.classeFluido);
      setCatInfo(r);
      setForm(f => ({ ...f, categoria: r.cat, grupoRisco: r.grupo }));
    }
  }, [ehCaldeira, form.volume, form.pmta, form.classeFluido,
      form.pressaoOperacao, form.comSpie, form.valvulasTestadas12m]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setBool = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.checked }));

  // Ao escolher o fluido, aplica automaticamente a classe NR-13 padrão
  // (Anexo II). Para fluidos com classe ambígua (ex.: "Outro") mantém a
  // classe atual e deixa o usuário decidir manualmente.
  const onFluidoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fluido = e.target.value;
    const classePadrao = CLASSE_PADRAO_POR_FLUIDO[fluido];
    setForm(f => ({
      ...f,
      fluido,
      ...(classePadrao ? { classeFluido: classePadrao } : {}),
    }));
  };

  const submit = async () => {
    if (!form.clienteId) { toast.error('Selecione o cliente.'); return; }
    if (!form.tag.trim()) { toast.error('Informe o TAG.'); return; }
    setSaving(true);
    const payload = { ...form,
      volume: parseFloat(form.volume) || undefined,
      pmta: parseFloat(form.pmta) || undefined,
      pressaoOperacao: parseFloat(form.pressaoOperacao) || undefined,
      pressaoHidro: parseFloat(form.pressaoHidro) || undefined,
      temperaturaProj: parseFloat(form.temperaturaProj) || undefined,
      pressaoProjeto: parseFloat(form.pressaoProjeto) || undefined,
      capacidadeTermica: parseFloat(form.capacidadeTermica) || undefined,
      areaAquecimento: parseFloat(form.areaAquecimento) || undefined,
      // Campos de caldeira só são enviados quando o tipo é Caldeira
      ...(ehCaldeira ? {} : {
        tipoCaldeira: undefined, combustivel: undefined,
        capacidadeTermica: undefined, areaAquecimento: undefined,
        comSpie: undefined, valvulasTestadas12m: undefined,
      }),
    };
    try {
      if (equipamentoId) await equipamentosApi.atualizar(equipamentoId, payload);
      else await equipamentosApi.criar(payload);
      toast.success('Equipamento salvo!');
      router.push(form.clienteId ? `/clientes/${form.clienteId}` : '/equipamentos');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao salvar.';
      toast.error(String(msg));
    } finally { setSaving(false); }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-5">
        {equipamentoId ? 'Editar equipamento' : 'Novo equipamento'}
      </h2>

      <div className="mb-4">
        <label className="label">Cliente *</label>
        <select className="input" value={form.clienteId} onChange={set('clienteId')}>
          <option value="">— Selecione o cliente —</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <hr className="my-4 border-gray-100" />
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Identificação</div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">TAG *</label>
          <input className="input" value={form.tag} onChange={set('tag')} placeholder="VP-001 TA" />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={set('tipo')}>
            {['Vaso de Pressão','Caldeira','Vaso criogênico','Tanque metálico'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ano de fabricação</label>
          <input className="input" value={form.ano} onChange={set('ano')} placeholder="2012" />
        </div>
        <div>
          <label className="label">Fabricante</label>
          <input className="input" value={form.fabricante} onChange={set('fabricante')} placeholder="SHISHI CITY HONGQUI" />
        </div>
        <div>
          <label className="label">N° de série</label>
          <input className="input" value={form.serie} onChange={set('serie')} placeholder="HQ1206485" />
        </div>
        <div>
          <label className="label">Posição</label>
          <select className="input" value={form.posicao} onChange={set('posicao')}>
            {['Vertical','Horizontal'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Código de projeto</label>
          <input className="input" value={form.codigoProjeto} onChange={set('codigoProjeto')} placeholder="ASME VIII Div.1 Ed 2017" />
        </div>
        <div className="col-span-2">
          <label className="label">Local de instalação</label>
          <input className="input" value={form.localInstalacao} onChange={set('localInstalacao')} placeholder="Acess. plasma" />
        </div>
      </div>

      {ehCaldeira && (
        <>
          <hr className="my-4 border-gray-100" />
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Dados da caldeira <span className="normal-case font-normal text-gray-400">(NR-13 item 13.4)</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Tipo de caldeira</label>
              <select className="input" value={form.tipoCaldeira} onChange={set('tipoCaldeira')}>
                {TIPOS_CALDEIRA.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Combustível</label>
              <select className="input" value={form.combustivel} onChange={set('combustivel')}>
                {COMBUSTIVEIS_CALDEIRA.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Capacidade térmica (kcal/h)</label>
              <input className="input" type="number" step="1" value={form.capacidadeTermica}
                onChange={set('capacidadeTermica')} placeholder="512000" />
            </div>
            <div>
              <label className="label">Área de aquecimento (m²)</label>
              <input className="input" type="number" step="0.01" value={form.areaAquecimento}
                onChange={set('areaAquecimento')} placeholder="18.86" />
            </div>
            <div>
              <label className="label">Pressão de projeto (kgf/cm²)</label>
              <input className="input" type="number" step="0.01" value={form.pressaoProjeto}
                onChange={set('pressaoProjeto')} placeholder="10.55" />
            </div>
            <div className="col-span-2 flex items-end gap-6 pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                  checked={form.comSpie} onChange={setBool('comSpie')} />
                Estabelecimento com SPIE <span className="text-gray-400 text-xs">(Anexo II)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                  checked={form.valvulasTestadas12m} onChange={setBool('valvulasTestadas12m')} />
                Válvulas de segurança testadas aos 12 meses <span className="text-gray-400 text-xs">(cat. A)</span>
              </label>
            </div>
          </div>
        </>
      )}

      <hr className="my-4 border-gray-100" />
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Parâmetros operacionais</div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Fluido de trabalho</label>
          <select className="input" value={form.fluido} onChange={onFluidoChange}>
            {FLUIDOS_NR13.map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
          </select>
          {(() => {
            const meta = FLUIDOS_NR13.find(f => f.nome === form.fluido);
            return meta?.observacao ? (
              <div className="mt-1 text-[11px] text-gray-500">{meta.observacao}</div>
            ) : null;
          })()}
        </div>
        <div>
          <label className="label">Classe do fluido</label>
          <select className="input" value={form.classeFluido} onChange={set('classeFluido')}>
            <option value="A">Classe A – Inflamável / Combustível ≥ 200 °C / Tóxico ≤ 20 ppm / H₂ / acetileno</option>
            <option value="B">Classe B – Combustível &lt; 200 °C / Tóxico &gt; 20 ppm</option>
            <option value="C">Classe C – Vapor d'água / Ar comprimido / Asfixiante simples</option>
            <option value="D">Classe D – Outros fluidos (água / líquidos &lt; 200 °C)</option>
          </select>
        </div>
        <div>
          <label className="label">Temperatura projeto (°C)</label>
          <input className="input" type="number" value={form.temperaturaProj} onChange={set('temperaturaProj')} placeholder="150" />
        </div>
        <div>
          <label className="label">Volume (m³)</label>
          <input className="input" type="number" step="0.01" value={form.volume} onChange={set('volume')} placeholder="2.00" />
        </div>
        <div>
          <label className="label">Pressão operação (kgf/cm²)</label>
          <input className="input" type="number" step="0.01" value={form.pressaoOperacao} onChange={set('pressaoOperacao')} placeholder="8.56" />
        </div>
        <div>
          <label className="label">PMTA (bar)</label>
          <input className="input" type="number" step="0.1" value={form.pmta} onChange={set('pmta')} placeholder="8.0" />
        </div>
        <div>
          <label className="label">Pressão teste hidrostático (bar)</label>
          <input className="input" type="number" step="0.1" value={form.pressaoHidro} onChange={set('pressaoHidro')} placeholder="10.5" />
        </div>
        <div>
          <label className="label">Metal de base</label>
          <input className="input" value={form.metalBase} onChange={set('metalBase')} placeholder="ASME SA-36" />
        </div>
      </div>

      {caldInfo && (
        <div className="mt-3 space-y-2">
          <div className="p-3 bg-primary-50 rounded-lg grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">Categoria da caldeira</div>
              <div className="font-bold text-primary-700">Cat. {caldInfo.categoria}</div>
              <div className="text-[10px] text-gray-400">{caldInfo.observacao}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Inspeção periódica (int. + ext.)</div>
              <div className="font-bold text-gray-900">a cada {caldInfo.prazoMeses} meses</div>
              <div className="text-[10px] text-gray-400">
                NR-13 {form.comSpie ? '13.4.4.5 (com SPIE)' : '13.4.4.4'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Teste hidrostático</div>
              <div className="font-bold text-gray-900">A critério do PLH</div>
              <div className="text-[10px] text-gray-400">Obrigatório na fabricação / insp. inicial</div>
            </div>
          </div>
        </div>
      )}

      {catInfo && (
        <div className="mt-3 space-y-2">
          <div className="p-3 bg-primary-50 rounded-lg grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">P × V (MPa·m³)</div>
              <div className="font-bold text-gray-900">{catInfo.pv.toFixed(2)}</div>
              <div className="text-[10px] text-gray-400">{catInfo.pvKpa.toFixed(0)} kPa·m³</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Categoria</div>
              <div className="font-bold text-primary-700">Cat. {catInfo.cat}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Grupo de Risco</div>
              <div className="font-bold text-gray-900">{catInfo.grupo}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Classe do fluido</div>
              <div className="font-bold text-gray-900">{form.classeFluido}</div>
            </div>
          </div>
          {!catInfo.enquadrado && (
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              <span className="font-semibold">Fora do escopo:</span> {catInfo.observacao}
            </div>
          )}
          {catInfo.dispensaInternaHidro && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <span className="font-semibold">Dispensa:</span> {catInfo.observacao}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        Dica: os dados da última inspeção realizada e os prazos das próximas inspeções
        (externo, interno, hidrostático) são registrados na aba <span className="font-semibold">Inspeções</span>
        do equipamento. O sistema atualiza automaticamente a categoria + NR-13 a partir de lá.
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <button onClick={() => router.back()} className="btn">Cancelar</button>
        <button onClick={submit} disabled={saving} className="btn btn-primary">
          {saving ? 'Salvando...' : 'Salvar equipamento'}
        </button>
      </div>
    </div>
  );
}
