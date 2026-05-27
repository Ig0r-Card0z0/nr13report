/**
 * resultado-overrides.ts
 * ---------------------------------------------------------------------------
 * Sobrescrita manual dos itens da seção "4 – RESULTADO DA INSPEÇÃO".
 *
 * Por padrão, cada resposta Sim/Não é DERIVADA automaticamente das heurísticas
 * em relatorios.service.ts / relatorios-docx.ts (esse é o "default").
 * Quando o usuário marca um item para alterar nesta sessão, o frontend envia
 * um objeto de overrides; somente as chaves presentes nesse objeto substituem
 * o default. Itens ausentes seguem o comportamento atual.
 *
 * Compartilhado entre a geração de PDF (PDFKit) e de DOCX (docx).
 */

/** Resposta possível de um item do checklist. */
export type ResultadoItem = 'sim' | 'nao';

/** Tipo de inspeção marcado na CONCLUSÃO item 2. */
export type TipoInspecaoMarcado = 'periodica' | 'extraordinaria' | 'inicial';

/**
 * Mapa de overrides. Chave = ID estável do item (ver CHAVES_RESULTADO abaixo).
 * Valor 'sim'/'nao' para itens normais; o item 'conclusao.2' aceita também
 * o tipo de inspeção marcado. Itens da seção 5.1 aceitam string ISO de data.
 */
export interface ResultadoOverrides {
  [chave: string]: ResultadoItem | TipoInspecaoMarcado | string;
}

/**
 * Catálogo de todas as chaves editáveis da seção 4. Usado pelo frontend para
 * montar a tela e pelo backend para validar. A ordem reflete o documento.
 */
export const CHAVES_RESULTADO: ReadonlyArray<{
  chave: string;
  secao: string;
  n: number;
  descricao: string;
}> = [
  // 4.1 EXAME DOS PRONTUÁRIOS
  { chave: 'prontuarios.1', secao: '4.1 EXAME DOS PRONTUÁRIOS', n: 1,
    descricao: 'A presente inspeção foi iniciada dentro do prazo para isso fixado na NR-13?' },
  { chave: 'prontuarios.2', secao: '4.1 EXAME DOS PRONTUÁRIOS', n: 2,
    descricao: 'As recomendações anteriores foram devidamente postas em prática?' },

  // EXAME EXTERNO DO EQUIPAMENTO
  { chave: 'externo.1', secao: 'EXAME EXTERNO DO EQUIPAMENTO', n: 1,
    descricao: 'O vaso de pressão funciona normalmente?' },
  { chave: 'externo.2', secao: 'EXAME EXTERNO DO EQUIPAMENTO', n: 2,
    descricao: 'O vaso de pressão satisfaz a todas as condições de segurança desta Norma NR-13 observáveis neste exame?' },
  { chave: 'externo.3', secao: 'EXAME EXTERNO DO EQUIPAMENTO', n: 3,
    descricao: 'A parte de caracterização do equipamento (placa de identificação) acessível ao exame confere com o que, sobre elas constam dos prontuários?' },
  { chave: 'externo.4', secao: 'EXAME EXTERNO DO EQUIPAMENTO', n: 4,
    descricao: 'Foi observada alguma anomalia capaz de prejudicar a segurança?' },
  { chave: 'externo.5', secao: 'EXAME EXTERNO DO EQUIPAMENTO', n: 5,
    descricao: 'Além do exame normal, foi realizado o exame externo complementar com este parado?' },
  { chave: 'externo.6', secao: 'EXAME EXTERNO DO EQUIPAMENTO', n: 6,
    descricao: 'Foram calibrados os manômetros e válvulas de segurança?' },

  // 4.3 EXAME INTERNO
  { chave: 'interno.1', secao: '4.3 EXAME INTERNO', n: 1,
    descricao: 'O vaso de pressão antes de ser limpo, apresentava alguma anomalia?' },
  { chave: 'interno.2', secao: '4.3 EXAME INTERNO', n: 2,
    descricao: 'Internamente, o vaso de pressão depois de limpo, está em ordem e satisfaz todas as condições de segurança constante da NBR 12177 da ABNT?' },
  { chave: 'interno.3', secao: '4.3 EXAME INTERNO', n: 3,
    descricao: 'A parte da caracterização do vaso acessível a esse exame confere com o que sobre a mesma consta no prontuário?' },
  { chave: 'interno.4', secao: '4.3 EXAME INTERNO', n: 4,
    descricao: 'Foi observada alguma anomalia capaz de prejudicar a segurança?' },

  // ATUALIZAÇÃO DA PMTA
  { chave: 'pmta.1', secao: 'ATUALIZAÇÃO DA PMTA', n: 1,
    descricao: 'A atual PMTA pode ser mantida?' },

  // ENSAIO HIDROSTÁTICO
  { chave: 'hidro.1', secao: 'ENSAIO HIDROSTÁTICO', n: 1,
    descricao: 'Foi realizado ensaio hidrostático?' },
  { chave: 'hidro.2', secao: 'ENSAIO HIDROSTÁTICO', n: 2,
    descricao: 'Foi observada alguma anomalia capaz de prejudicar a segurança?' },

  // OUTROS ENSAIOS
  { chave: 'outros.1', secao: 'OUTROS ENSAIOS', n: 1,
    descricao: 'Foi realizado algum ensaio adicional?' },

  // CONCLUSÃO
  { chave: 'conclusao.1', secao: 'CONCLUSÃO', n: 1,
    descricao: 'O Vaso de Pressão inspecionado pode ser utilizado normalmente?' },
  { chave: 'conclusao.2-sim', secao: 'CONCLUSÃO', n: 2,
    descricao: 'O Vaso de Pressão deverá ser submetido a nova inspeção de segurança, de acordo com a NR-13 do M.T.E. — resposta Sim/Não' },
  { chave: 'conclusao.2', secao: 'CONCLUSÃO', n: 2,
    descricao: 'O Vaso de Pressão deverá ser submetido a nova inspeção de segurança — tipo de inspeção marcado (Periódica / Extraordinária / Inicial)' },

  // 5.1 PRÓXIMAS INSPEÇÕES — recomendação do PH.
  //   - chaves legadas (.recph): data ISO YYYY-MM-DD (compat).
  //   - chaves novas (.recph.anos): inteiro 1–20 (anos a somar à data da inspeção).
  { chave: 'prox.externo.recph', secao: '5.1 PRÓXIMAS INSPEÇÕES', n: 1,
    descricao: 'Data recomendada pelo PH para o próximo Exame Externo (legado — data ISO)' },
  { chave: 'prox.interno.recph', secao: '5.1 PRÓXIMAS INSPEÇÕES', n: 2,
    descricao: 'Data recomendada pelo PH para o próximo Exame Interno (legado — data ISO)' },
  { chave: 'prox.hidro.recph', secao: '5.1 PRÓXIMAS INSPEÇÕES', n: 3,
    descricao: 'Data recomendada pelo PH para o próximo Teste Hidrostático (legado — data ISO)' },
  { chave: 'prox.externo.recph.anos', secao: '5.1 PRÓXIMAS INSPEÇÕES', n: 1,
    descricao: 'Anos até o próximo Exame Externo recomendados pelo PH (1–20)' },
  { chave: 'prox.interno.recph.anos', secao: '5.1 PRÓXIMAS INSPEÇÕES', n: 2,
    descricao: 'Anos até o próximo Exame Interno recomendados pelo PH (1–20)' },
  { chave: 'prox.hidro.recph.anos', secao: '5.1 PRÓXIMAS INSPEÇÕES', n: 3,
    descricao: 'Anos até o próximo Teste Hidrostático recomendados pelo PH (1–20)' },
];

/** Conjunto de chaves que aceitam valor de data ISO (YYYY-MM-DD) — legado. */
const CHAVES_DATA = new Set<string>([
  'prox.externo.recph',
  'prox.interno.recph',
  'prox.hidro.recph',
]);
/** Conjunto de chaves que aceitam valor inteiro de anos (1–20). */
const CHAVES_ANOS = new Set<string>([
  'prox.externo.recph.anos',
  'prox.interno.recph.anos',
  'prox.hidro.recph.anos',
]);
const ISO_DATA_RX = /^\d{4}-\d{2}-\d{2}$/;
const ANOS_MIN = 1;
const ANOS_MAX = 20;

/** Limite máximo da string de observação livre (anti-DoS). */
const OBS_MAX_LEN = 2000;

/**
 * Conjunto de chaves de checklist (seção 4) que aceitam observação livre
 * editada pelo PH. A chave de observação é o prefixo "obs." + chave-base.
 * Ex.: 'obs.externo.6' sobrescreve a coluna "Observações" do item 4.2.6.
 */
const CHAVES_OBS_BASE = new Set<string>([
  'prontuarios.1', 'prontuarios.2',
  'externo.1', 'externo.2', 'externo.3', 'externo.4', 'externo.5', 'externo.6',
  'interno.1', 'interno.2', 'interno.3', 'interno.4',
  'pmta.1',
  'hidro.1', 'hidro.2',
  'outros.1',
  'conclusao.1', 'conclusao.2-sim',
]);

/** Conjunto de chaves válidas, para validação O(1). */
const CHAVES_VALIDAS = new Set(CHAVES_RESULTADO.map((c) => c.chave));

/** Tipos de inspeção válidos para conclusao.2. */
const TIPOS_VALIDOS = new Set<TipoInspecaoMarcado>([
  'periodica', 'extraordinaria', 'inicial',
]);

/**
 * Faz o parse seguro do query param `overrides` (string JSON URL-encoded).
 * Descarta chaves desconhecidas e valores inválidos — nunca lança exceção,
 * para que um payload malformado apenas resulte em "usar os defaults".
 */
export function parseOverrides(raw?: string): ResultadoOverrides {
  if (!raw) return {};
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};

  const out: ResultadoOverrides = {};
  for (const [chave, valor] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof valor !== 'string') continue;
    // Observação livre: chaves prefixadas com "obs." apontam para item de checklist.
    if (chave.startsWith('obs.')) {
      const base = chave.slice(4);
      if (!CHAVES_OBS_BASE.has(base)) continue;
      out[chave] = valor.slice(0, OBS_MAX_LEN);
      continue;
    }
    if (!CHAVES_VALIDAS.has(chave)) continue;
    if (chave === 'conclusao.2') {
      if (TIPOS_VALIDOS.has(valor as TipoInspecaoMarcado)) {
        out[chave] = valor as TipoInspecaoMarcado;
      }
      continue;
    }
    if (CHAVES_DATA.has(chave)) {
      if (ISO_DATA_RX.test(valor)) {
        out[chave] = valor;
      }
      continue;
    }
    if (CHAVES_ANOS.has(chave)) {
      // Aceita apenas inteiro estrito entre ANOS_MIN e ANOS_MAX.
      if (/^\d+$/.test(valor)) {
        const n = Number(valor);
        if (Number.isInteger(n) && n >= ANOS_MIN && n <= ANOS_MAX) {
          out[chave] = String(n);
        }
      }
      continue;
    }
    if (valor === 'sim' || valor === 'nao') {
      out[chave] = valor;
    }
  }
  return out;
}

/**
 * Resolve a observação livre de um item do checklist da seção 4.
 * Se houver override para `obs.<chave>`, vence; senão usa o `padrao` derivado.
 */
export function resolverObs(
  ov: ResultadoOverrides,
  chave: string,
  padrao: string,
): string {
  const v = ov[`obs.${chave}`];
  return typeof v === 'string' ? v : padrao;
}

/**
 * Resolve a data recomendada pelo PH para uma chave da seção 5.1.
 *
 * Ordem de precedência:
 *   1. Override `.anos` (inteiro) — soma à `dataInspecaoISO`.
 *   2. Override de data ISO (legado).
 *   3. Nenhum — retorna `undefined` (caller usa o default hardcoded).
 *
 * @param chaveBase Uma das chaves de 5.1 (sem o sufixo `.anos`).
 * @param dataInspecaoISO Data da inspeção (YYYY-MM-DD), base para somar anos.
 */
export function resolverDataRecPH(
  ov: ResultadoOverrides,
  chaveBase: 'prox.externo.recph' | 'prox.interno.recph' | 'prox.hidro.recph',
  dataInspecaoISO?: string | null,
): string | undefined {
  // 1) Tenta override em anos (preferido).
  const anosRaw = ov[`${chaveBase}.anos`];
  if (typeof anosRaw === 'string' && /^\d+$/.test(anosRaw) && dataInspecaoISO) {
    const n = Number(anosRaw);
    if (Number.isInteger(n) && n >= ANOS_MIN && n <= ANOS_MAX) {
      const base = new Date(`${String(dataInspecaoISO).slice(0, 10)}T12:00:00Z`);
      if (!isNaN(base.getTime())) {
        base.setUTCFullYear(base.getUTCFullYear() + n);
        return base.toISOString().slice(0, 10);
      }
    }
  }
  // 2) Fallback para override em data ISO (legado).
  const v = ov[chaveBase];
  return typeof v === 'string' && ISO_DATA_RX.test(v) ? v : undefined;
}

/**
 * Resolve o valor booleano (Sim = true) de um item.
 * Se houver override para a chave, ele vence; senão usa o `padrao` derivado.
 */
export function resolverSim(
  ov: ResultadoOverrides,
  chave: string,
  padrao: boolean,
): boolean {
  const v = ov[chave];
  if (v === 'sim') return true;
  if (v === 'nao') return false;
  return padrao;
}

/**
 * Resolve o tipo de inspeção marcado na CONCLUSÃO item 2.
 * Default deriva do tipo da inspeção (Interna -> periódica).
 */
export function resolverTipoInspecao(
  ov: ResultadoOverrides,
  padrao: TipoInspecaoMarcado,
): TipoInspecaoMarcado {
  const v = ov['conclusao.2'];
  if (v === 'periodica' || v === 'extraordinaria' || v === 'inicial') return v;
  return padrao;
}

/** Monta a célula "Observações" do item conclusao.2 com a marcação (x). */
export function obsConclusaoTipo(tipo: TipoInspecaoMarcado): string {
  const m = (t: TipoInspecaoMarcado) => (t === tipo ? 'x' : ' ');
  return `(${m('periodica')}) Periódica   (${m('extraordinaria')}) Extraordinária   (${m('inicial')}) Inicial`;
}
