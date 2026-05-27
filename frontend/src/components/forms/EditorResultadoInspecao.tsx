'use client';
/**
 * EditorResultadoInspecao.tsx
 * ---------------------------------------------------------------------------
 * Editor da seção "4 – RESULTADO DA INSPEÇÃO" + "5.1 – PRÓXIMAS INSPEÇÕES".
 *
 * Organizado em sub-abas independentes para granularidade fina:
 *  - 4.1 Prontuários
 *  - 4.2 Exame Externo
 *  - 4.3 Exame Interno
 *  - 4 Outros (PMTA / Hidro / Outros / Conclusão)
 *  - 5.1 Próximas Inspeções (datas recomendadas pelo PH)
 *
 * Cada item Sim/Não tem checkbox "Alterar nesta sessão":
 *  - DESMARCADO  -> mantém comportamento padrão do relatório.
 *  - MARCADO     -> libera os botões Sim/Não; valor entra no objeto overrides.
 *
 * Em 5.1, cada linha tem um date picker independente. Quando preenchido,
 * sobrescreve a coluna "Recom. PH" da tabela 5.1 (default = período fixo NR-13).
 *
 * Itens não marcados NÃO entram em overrides — o backend usa o default.
 * Alterações valem apenas para esta sessão de geração (não persistem em banco).
 */

import { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';

// ── Tipos ───────────────────────────────────────────────────────────────────
export type ResultadoItem = 'sim' | 'nao';
export type TipoInspecaoMarcado = 'periodica' | 'extraordinaria' | 'inicial';
// Valores podem ser: 'sim'/'nao' (checklist), tipo de inspeção (conclusao.2)
// ou string ISO YYYY-MM-DD (datas 5.1).
export type Overrides = Record<string, ResultadoItem | TipoInspecaoMarcado | string>;

interface ItemDef {
  chave: string;
  n: number;
  descricao: string;
}
interface SubAba {
  id: string;
  rotulo: string;
  itens: ItemDef[];
}

// ── Sub-abas (espelha resultado-overrides.ts do backend) ────────────────────
const SUB_ABAS: SubAba[] = [
  {
    id: '4.1',
    rotulo: '4.1 Prontuários',
    itens: [
      { chave: 'prontuarios.1', n: 1, descricao: 'A presente inspeção foi iniciada dentro do prazo para isso fixado na NR-13?' },
      { chave: 'prontuarios.2', n: 2, descricao: 'As recomendações anteriores foram devidamente postas em prática?' },
    ],
  },
  {
    id: '4.2',
    rotulo: '4.2 Exame Externo',
    itens: [
      { chave: 'externo.1', n: 1, descricao: 'O vaso de pressão funciona normalmente?' },
      { chave: 'externo.2', n: 2, descricao: 'O vaso de pressão satisfaz a todas as condições de segurança desta Norma NR-13 observáveis neste exame?' },
      { chave: 'externo.3', n: 3, descricao: 'A parte de caracterização do equipamento (placa de identificação) acessível ao exame confere com o que consta dos prontuários?' },
      { chave: 'externo.4', n: 4, descricao: 'Foi observada alguma anomalia capaz de prejudicar a segurança?' },
      { chave: 'externo.5', n: 5, descricao: 'Além do exame normal, foi realizado o exame externo complementar com este parado?' },
      { chave: 'externo.6', n: 6, descricao: 'Foram calibrados os manômetros e válvulas de segurança?' },
    ],
  },
  {
    id: '4.3',
    rotulo: '4.3 Exame Interno',
    itens: [
      { chave: 'interno.1', n: 1, descricao: 'O vaso de pressão antes de ser limpo, apresentava alguma anomalia?' },
      { chave: 'interno.2', n: 2, descricao: 'Internamente, o vaso de pressão depois de limpo, está em ordem e satisfaz todas as condições de segurança constante da NBR 12177 da ABNT?' },
      { chave: 'interno.3', n: 3, descricao: 'A parte da caracterização do vaso acessível a esse exame confere com o que consta no prontuário?' },
      { chave: 'interno.4', n: 4, descricao: 'Foi observada alguma anomalia capaz de prejudicar a segurança?' },
    ],
  },
  {
    id: '4-outros',
    rotulo: '4 Outros (PMTA/Hidro/Conclusão)',
    itens: [
      { chave: 'pmta.1', n: 1, descricao: 'PMTA — A atual PMTA pode ser mantida?' },
      { chave: 'hidro.1', n: 2, descricao: 'Ensaio Hidrostático — Foi realizado ensaio hidrostático?' },
      { chave: 'hidro.2', n: 3, descricao: 'Ensaio Hidrostático — Foi observada alguma anomalia capaz de prejudicar a segurança?' },
      { chave: 'outros.1', n: 4, descricao: 'Outros Ensaios — Foi realizado algum ensaio adicional?' },
      { chave: 'conclusao.1', n: 5, descricao: 'Conclusão — O Vaso de Pressão inspecionado pode ser utilizado normalmente?' },
      { chave: 'conclusao.2-sim', n: 6, descricao: 'Conclusão — O Vaso de Pressão deverá ser submetido a nova inspeção de segurança, de acordo com a NR-13 do M.T.E.' },
    ],
  },
];

// Datas editáveis em 5.1 — sobrescrevem coluna "Recom. PH".
const DATAS_51: ItemDef[] = [
  { chave: 'prox.externo.recph', n: 1, descricao: 'Próximo Exame Externo — data recomendada pelo PH' },
  { chave: 'prox.interno.recph', n: 2, descricao: 'Próximo Exame Interno — data recomendada pelo PH' },
  { chave: 'prox.hidro.recph',   n: 3, descricao: 'Próximo Teste Hidrostático — data recomendada pelo PH' },
];

// Item 'conclusao.2' (tipo de inspeção) é editado por seletor próprio.
const TIPOS_INSPECAO: { valor: TipoInspecaoMarcado; rotulo: string }[] = [
  { valor: 'periodica', rotulo: 'Periódica' },
  { valor: 'extraordinaria', rotulo: 'Extraordinária' },
  { valor: 'inicial', rotulo: 'Inicial' },
];

// ── Props ───────────────────────────────────────────────────────────────────
interface Props {
  onChange: (ov: Overrides) => void;
}

// ── Componente ──────────────────────────────────────────────────────────────
export function EditorResultadoInspecao({ onChange }: Props) {
  const [editados, setEditados] = useState<Overrides>({});
  const [abaAtiva, setAbaAtiva] = useState<string>('4.1');

  const totalEditaveis = useMemo(
    () => SUB_ABAS.reduce((s, sa) => s + sa.itens.length, 0) + 1 + DATAS_51.length, // +1 = tipo conclusão
    [],
  );
  const qtdEditados = Object.keys(editados).length;

  const emit = (next: Overrides) => {
    setEditados(next);
    onChange(next);
  };

  const toggleEditar = (chave: string, valorPadrao: ResultadoItem | TipoInspecaoMarcado) => {
    const next = { ...editados };
    if (chave in next) delete next[chave];
    else next[chave] = valorPadrao;
    emit(next);
  };

  const setValor = (chave: string, valor: ResultadoItem | TipoInspecaoMarcado) => {
    if (!(chave in editados)) return;
    emit({ ...editados, [chave]: valor });
  };

  // Data 5.1: presença em `editados` indica override ativo.
  const setData = (chave: string, isoDate: string) => {
    const next = { ...editados };
    if (!isoDate) delete next[chave];
    else next[chave] = isoDate;
    emit(next);
  };

  // Observação livre por item (chave = "obs.<base>"). Ausência = usa default backend.
  const setObs = (chaveBase: string, texto: string) => {
    const obsKey = `obs.${chaveBase}`;
    const next = { ...editados };
    if (!texto) delete next[obsKey];
    else next[obsKey] = texto;
    emit(next);
  };

  const limparTudo = () => emit({});

  // Conta itens alterados por aba (para badge).
  const contagemPorAba = useMemo(() => {
    const c: Record<string, number> = {};
    for (const sa of SUB_ABAS) {
      c[sa.id] = sa.itens.reduce((acc, it) => acc + (it.chave in editados ? 1 : 0), 0);
      if (sa.id === '4-outros' && 'conclusao.2' in editados) c[sa.id] += 1;
    }
    c['5.1'] = DATAS_51.reduce((acc, it) => acc + (it.chave in editados ? 1 : 0), 0);
    return c;
  }, [editados]);

  const tabs = [
    ...SUB_ABAS.map(sa => ({ id: sa.id, label: sa.rotulo, badge: contagemPorAba[sa.id] || 0 })),
    { id: '5.1', label: '5.1 Próximas Inspeções', badge: contagemPorAba['5.1'] || 0 },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-700">
          Resultado da Inspeção — ajustes desta sessão
        </h3>
        {qtdEditados > 0 && (
          <button
            type="button"
            onClick={limparTudo}
            className="text-xs text-primary-700 hover:underline"
          >
            Limpar alterações
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Marque <strong>&quot;Alterar nesta sessão&quot;</strong> apenas nos itens que
        precisa modificar. Os itens não marcados seguem o preenchimento padrão do
        relatório. {qtdEditados > 0
          ? `${qtdEditados} de ${totalEditaveis} itens alterados.`
          : 'Nenhum item alterado — o relatório usará os valores padrão.'}
      </p>

      <Tabs
        ariaLabel="Subseções do Resultado da Inspeção"
        idPrefix="rinsp"
        tabs={tabs}
        active={abaAtiva}
        onChange={setAbaAtiva}
      />

      {/* Painéis */}
      {SUB_ABAS.map(sa => (
        <div key={sa.id} hidden={abaAtiva !== sa.id}>
          {abaAtiva === sa.id && (
            <ListaItensChecklist
              itens={sa.itens}
              editados={editados}
              onToggle={toggleEditar}
              onSet={setValor}
              onSetObs={setObs}
            />
          )}
        </div>
      ))}

      <div hidden={abaAtiva !== '5.1'}>
        {abaAtiva === '5.1' && (
          <ListaDatas51
            editados={editados}
            onSetData={setData}
          />
        )}
      </div>
    </div>
  );
}

// ── Lista de itens Sim/Não (4.1, 4.2, 4.3, 4-outros) ────────────────────────
function ListaItensChecklist({
  itens, editados, onToggle, onSet, onSetObs,
}: {
  itens: ItemDef[];
  editados: Overrides;
  onToggle: (chave: string, valorPadrao: ResultadoItem | TipoInspecaoMarcado) => void;
  onSet: (chave: string, valor: ResultadoItem | TipoInspecaoMarcado) => void;
  onSetObs: (chaveBase: string, texto: string) => void;
}) {
  return (
    <div className="space-y-2">
      {itens.map(item => {
        const liberado = item.chave in editados;
        const valor = editados[item.chave] as ResultadoItem | undefined;
        return (
          <div
            key={item.chave}
            className={`rounded-lg border p-3 transition-colors ${
              liberado
                ? 'border-primary-300 bg-primary-50/40'
                : 'border-gray-100 bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 flex-shrink-0">
                {item.n}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{item.descricao}</p>

                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={liberado}
                      onChange={() => onToggle(item.chave, 'sim')}
                      className="rounded border-gray-300 text-primary-700 focus:ring-primary-500"
                    />
                    Alterar nesta sessão
                  </label>

                  <div className="flex gap-1.5">
                    {(['sim', 'nao'] as ResultadoItem[]).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        disabled={!liberado}
                        onClick={() => onSet(item.chave, opt)}
                        className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                          !liberado
                            ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                            : valor === opt
                            ? opt === 'sim'
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-red-500 bg-red-500 text-white'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {opt === 'sim' ? 'Sim' : 'Não'}
                      </button>
                    ))}
                  </div>

                  {!liberado && (
                    <span className="text-xs text-gray-400 italic">
                      usando valor padrão
                    </span>
                  )}
                </div>

                {/* Observação livre — sobrescreve coluna "Observações" no relatório */}
                <div className="mt-2">
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={(editados[`obs.${item.chave}`] as string | undefined) || ''}
                    onChange={e => onSetObs(item.chave, e.target.value)}
                    placeholder="Deixe em branco para usar a observação padrão do relatório."
                    rows={2}
                    maxLength={2000}
                    className="w-full text-xs rounded border border-gray-200 p-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
                  />
                </div>

                {/* Seletor de tipo de inspeção (apenas em conclusao.2-sim) */}
                {item.chave === 'conclusao.2-sim' && (
                  <SeletorTipoInspecao
                    valor={editados['conclusao.2'] as TipoInspecaoMarcado | undefined}
                    liberado={'conclusao.2' in editados}
                    onToggle={() => onToggle('conclusao.2', 'periodica')}
                    onSet={t => onSet('conclusao.2', t)}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lista de datas 5.1 (date pickers) ───────────────────────────────────────
function ListaDatas51({
  editados, onSetData,
}: {
  editados: Overrides;
  onSetData: (chave: string, isoDate: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 mb-2">
        Preencha a data recomendada pelo PH para sobrescrever a coluna
        <strong> &quot;Recom. PH&quot;</strong> da tabela 5.1. Deixe em branco
        para manter o período padrão da NR-13 (1 ano / 5 anos / 10 anos).
        Demais colunas (NR-13 e Data máx.) permanecem calculadas automaticamente
        pela categoria do equipamento.
      </div>
      {DATAS_51.map(item => {
        const valor = (editados[item.chave] as string | undefined) || '';
        const liberado = !!valor;
        return (
          <div
            key={item.chave}
            className={`rounded-lg border p-3 transition-colors ${
              liberado
                ? 'border-primary-300 bg-primary-50/40'
                : 'border-gray-100 bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 flex-shrink-0">
                {item.n}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{item.descricao}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <input
                    type="date"
                    value={valor}
                    onChange={e => onSetData(item.chave, e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-primary-500 focus:border-primary-500"
                  />
                  {liberado ? (
                    <button
                      type="button"
                      onClick={() => onSetData(item.chave, '')}
                      className="text-xs text-primary-700 hover:underline"
                    >
                      Usar default
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      usando período padrão NR-13
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-bloco: tipo de inspeção marcado na conclusão ────────────────────────
function SeletorTipoInspecao({
  valor, liberado, onToggle, onSet,
}: {
  valor?: TipoInspecaoMarcado;
  liberado: boolean;
  onToggle: () => void;
  onSet: (t: TipoInspecaoMarcado) => void;
}) {
  return (
    <div className="mt-2 pt-2 border-t border-gray-200/70">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={liberado}
            onChange={onToggle}
            className="rounded border-gray-300 text-primary-700 focus:ring-primary-500"
          />
          Alterar tipo de inspeção
        </label>
        <div className="flex gap-1.5">
          {TIPOS_INSPECAO.map(({ valor: v, rotulo }) => (
            <button
              key={v}
              type="button"
              disabled={!liberado}
              onClick={() => onSet(v)}
              className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                !liberado
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : valor === v
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {!liberado && (
          <span className="text-xs text-gray-400 italic">padrão: Periódica</span>
        )}
      </div>
    </div>
  );
}
