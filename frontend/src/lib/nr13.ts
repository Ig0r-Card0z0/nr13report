/* ============================================================================
 * NR-13 — Núcleo de cálculo e enquadramento (frontend)
 * ----------------------------------------------------------------------------
 * Espelha src/common/nr13.ts do backend. Manter as duas versões sincronizadas.
 *
 * Referências:
 *  - NR-13, Anexo II  (categorização de vasos de pressão)
 *  - NR-13, Anexo IV  (periodicidades — Tabela 1, com e sem SPIE)
 *  - NR-13, item 13.4 (caldeiras)
 *
 * UNIDADES
 *  - Pressão: base interna em kPa (o formulário coleta PMTA em bar).
 *  - Volume: m³ (vasos) / litros (caldeira cat. C).
 *  - P × V (enquadramento no escopo da NR-13): kPa·m³. Limite: P × V > 8.
 *  - P × V (classificação do Grupo de Potencial de Risco): MPa·m³
 *    (1 MPa = 1000 kPa). Limites: 100 / 30 / 2,5 / 1 MPa·m³.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * 1. CONVERSÃO DE UNIDADES DE PRESSÃO
 * --------------------------------------------------------------------------*/

export type UnidadePressao = 'kPa' | 'MPa' | 'bar' | 'kgf/cm2' | 'psi';

/**
 * Fatores de conversão para kPa (base interna). 1 [unidade] = fator kPa.
 *  1 MPa = 1000 kPa | 1 bar = 100 kPa | 1 kgf/cm2 = 98,0665 kPa
 *  1 psi = 6,894757293168361 kPa
 */
export const FATOR_PARA_KPA: Record<UnidadePressao, number> = {
  kPa: 1,
  MPa: 1000,
  bar: 100,
  'kgf/cm2': 98.0665,
  psi: 6.894757293168361,
};

/** Rótulos amigáveis para exibição das unidades. */
export const ROTULO_UNIDADE: Record<UnidadePressao, string> = {
  kPa: 'kPa',
  MPa: 'MPa',
  bar: 'bar',
  'kgf/cm2': 'kgf/cm²',
  psi: 'psi',
};

export function pressaoParaKpa(valor: number, de: UnidadePressao): number {
  return valor * FATOR_PARA_KPA[de];
}

export function kpaPara(valorKpa: number, para: UnidadePressao): number {
  return valorKpa / FATOR_PARA_KPA[para];
}

export function converterPressao(
  valor: number,
  de: UnidadePressao,
  para: UnidadePressao,
): number {
  return kpaPara(pressaoParaKpa(valor, de), para);
}

/** Converte bar para kPa (entrada padrão do formulário de PMTA). */
export function barParaKpa(valorBar: number): number {
  return pressaoParaKpa(valorBar, 'bar');

}

/** Equivalência de um valor em todas as unidades suportadas. */
export function tabelaConversaoPressao(
  valor: number,
  de: UnidadePressao,
): Record<UnidadePressao, number> {
  const kpa = pressaoParaKpa(valor, de);
  return {
    kPa: kpa,
    MPa: kpaPara(kpa, 'MPa'),
    bar: kpaPara(kpa, 'bar'),
    'kgf/cm2': kpaPara(kpa, 'kgf/cm2'),
    psi: kpaPara(kpa, 'psi'),
  };
}

/* ----------------------------------------------------------------------------
 * 2. CLASSES DE FLUIDO (NR-13, Anexo II)
 * --------------------------------------------------------------------------*/

export type ClasseFluido = 'A' | 'B' | 'C' | 'D';

export const CLASSES_FLUIDO_NR13: {
  value: ClasseFluido; label: string; descricao: string;
}[] = [
  {
    value: 'A',
    label: 'Classe A',
    descricao:
      'Inflamáveis; combustíveis com temperatura ≥ 200 °C; tóxicos com limite '
      + 'de tolerância ≤ 20 ppm; hidrogênio; acetileno.',
  },
  {
    value: 'B',
    label: 'Classe B',
    descricao:
      'Combustíveis com temperatura < 200 °C; tóxicos com limite de '
      + 'tolerância > 20 ppm.',
  },
  {
    value: 'C',
    label: 'Classe C',
    descricao: 'Vapor de água; gases asfixiantes simples; ar comprimido.',
  },
  {
    value: 'D',
    label: 'Classe D',
    descricao: 'Outro fluido (água ou líquidos a temperatura < 200 °C).',
  },
];

/* ----------------------------------------------------------------------------
 * 2.1 FLUIDOS DE TRABALHO COMUNS — classe NR-13 padrão
 * ----------------------------------------------------------------------------
 * Mapa fluido → classe padrão do Anexo II. Usado pelo formulário do
 * equipamento para preencher automaticamente a classe quando o usuário escolhe
 * o fluido. Para "Outro" e "Óleo" a classe depende do produto específico /
 * temperatura — nesses casos a classe não é forçada (deixa o usuário decidir).
 *
 * Convenções:
 *  - Gases asfixiantes simples (N₂, CO₂, He, Ar) e ar comprimido / vapor → C.
 *  - Hidrocarbonetos inflamáveis (GLP, GN, propano, butano) → A.
 *  - Hidrogênio e acetileno → A (citação direta da norma).
 *  - Água e líquidos < 200 °C → D.
 *  - Óleo combustível e óleo térmico podem ser A (≥ 200 °C) ou B (< 200 °C);
 *    o default proposto é B (caso mais comum em compressores/lubrificantes).
 * --------------------------------------------------------------------------*/

export interface FluidoNR13 {
  nome: string;
  classePadrao: ClasseFluido | null; // null = exige escolha manual
  observacao?: string;
}

export const FLUIDOS_NR13: FluidoNR13[] = [
  { nome: 'Ar Comprimido',  classePadrao: 'C' },
  { nome: 'Vapor d\'água',  classePadrao: 'C' },
  { nome: 'Nitrogênio',     classePadrao: 'C', observacao: 'Gás asfixiante simples.' },
  { nome: 'CO2',            classePadrao: 'C', observacao: 'Gás asfixiante simples.' },
  { nome: 'GLP',            classePadrao: 'A', observacao: 'Hidrocarboneto inflamável.' },
  { nome: 'Hidrogênio',     classePadrao: 'A', observacao: 'Citado nominalmente pela NR-13 — classe A.' },
  { nome: 'Acetileno',      classePadrao: 'A', observacao: 'Citado nominalmente pela NR-13 — classe A.' },
  {
    nome: 'Amônia (NH₃)',
    classePadrao: 'A',
    observacao: 'Tóxico com limite de tolerância ≤ 20 ppm (NR-15) — classe A.',
  },
  {
    nome: 'Óleo',
    classePadrao: 'B',
    observacao: 'Combustível; default classe B (< 200 °C). Use classe A se a temperatura ≥ 200 °C.',
  },
  { nome: 'Água',           classePadrao: 'D' },
  {
    nome: 'Outro',
    classePadrao: null,
    observacao: 'Classe depende do fluido — selecione manualmente conforme o Anexo II.',
  },
];

/** Atalho — mapa direto nome → classe padrão (null = exige escolha manual). */
export const CLASSE_PADRAO_POR_FLUIDO: Record<string, ClasseFluido | null> =
  FLUIDOS_NR13.reduce((acc, f) => {
    acc[f.nome] = f.classePadrao;
    return acc;
  }, {} as Record<string, ClasseFluido | null>);

/* ----------------------------------------------------------------------------
 * 3. CATEGORIZAÇÃO DE VASOS DE PRESSÃO (NR-13, Anexo II)
 * --------------------------------------------------------------------------*/

export type CategoriaVaso = 'I' | 'II' | 'III' | 'IV' | 'V';
export type GrupoRisco = 1 | 2 | 3 | 4 | 5;

/** P x V em MPa.m3 a partir da pressão em kPa e volume em m3. */
export function calcularPVmpa(pressaoKpa: number, volumeM3: number): number {
  return (pressaoKpa * volumeM3) / 1000;
}

/** Grupo de potencial de risco (1 a 5) a partir do P × V (MPa·m³) e da classe. */
export function determinarGrupoRisco(pvMpa: number, classe: ClasseFluido): GrupoRisco {
  if (pvMpa >= 100) return 1;
  if (pvMpa >= 30) return 2;
  if (pvMpa >= 2.5) return 3;
  if (pvMpa >= 1) return 4;
  return 5;
}

/** Matriz oficial Classe x Grupo -> Categoria (NR-13 Anexo II). */
const MATRIZ_CATEGORIA: Record<ClasseFluido, Record<GrupoRisco, CategoriaVaso>> = {
  A: { 1: 'I',  2: 'I',   3: 'II',  4: 'III', 5: 'III' },
  B: { 1: 'I',  2: 'II',  3: 'III', 4: 'IV',  5: 'IV'  },
  C: { 1: 'I',  2: 'II',  3: 'III', 4: 'IV',  5: 'V'   },
  D: { 1: 'II', 2: 'III', 3: 'IV',  4: 'V',   5: 'V'   },
};

export interface ResultadoCategoriaVaso {
  pvMpa: number;
  pvKpa: number;
  grupo: GrupoRisco;
  categoria: CategoriaVaso;
  enquadradoNR13: boolean;
  dispensaInternaHidro: boolean;
  observacao: string;
}

/**
 * Categoriza um vaso de pressão conforme a NR-13, Anexo II.
 * @param pmtaBar  PMTA em bar (unidade do formulário).
 * @param volumeM3 Volume interno em m3.
 * @param classe   Classe do fluido (A, B, C ou D).
 */
export function categorizarVaso(
  pmtaBar: number,
  volumeM3: number,
  classe: ClasseFluido,
): ResultadoCategoriaVaso {
  const pressaoKpa = barParaKpa(pmtaBar);
  const pvMpa = calcularPVmpa(pressaoKpa, volumeM3);
  const pvKpa = pressaoKpa * volumeM3;
  const grupo = determinarGrupoRisco(pvMpa, classe);
  const categoria = MATRIZ_CATEGORIA[classe][grupo];

  const enquadradoNR13 = pvKpa > 8 || classe === 'A';
  const dispensaInternaHidro =
    categoria === 'V' && pvKpa <= 8 && (classe === 'C' || classe === 'D');

  let observacao = '';
  if (!enquadradoNR13) {
    observacao =
      'P × V ≤ 8 kPa·m³ e fluido não classe A — pode estar fora do escopo da NR-13.';
  } else if (dispensaInternaHidro) {
    observacao =
      'Categoria V, P × V ≤ 8 kPa·m³, classe C/D — dispensado de exame interno '
      + 'e teste hidrostático (mantém exame externo).';
  }

  return { pvMpa, pvKpa, grupo, categoria, enquadradoNR13, dispensaInternaHidro, observacao };
}

/* ----------------------------------------------------------------------------
 * 4. CATEGORIZAÇÃO DE CALDEIRAS (NR-13, item 13.4)
 * --------------------------------------------------------------------------*/

export type CategoriaCaldeira = 'A' | 'B' | 'C';

export interface ResultadoCategoriaCaldeira {
  categoria: CategoriaCaldeira;
  observacao: string;
}

/**
 * Categoriza uma caldeira a vapor conforme a NR-13.
 * @param pressaoOperacaoKpa Pressão de operação em kPa.
 * @param volumeLitros       Volume interno em litros.
 */
export function categorizarCaldeira(
  pressaoOperacaoKpa: number,
  volumeLitros: number,
): ResultadoCategoriaCaldeira {
  if (pressaoOperacaoKpa >= 1960) {
    return { categoria: 'A', observacao: 'Pressão de operação ≥ 1960 kPa (~19,98 kgf/cm²).' };
  }
  if (pressaoOperacaoKpa <= 588 && volumeLitros <= 100) {
    return { categoria: 'C', observacao: 'Pressão ≤ 588 kPa e volume interno ≤ 100 litros.' };
  }
  return { categoria: 'B', observacao: 'Não se enquadra nas categorias A nem C.' };
}

/* ----------------------------------------------------------------------------
 * 5. PERIODICIDADE DE INSPEÇÃO (NR-13, Anexo IV — Tabela 1)
 * --------------------------------------------------------------------------*/

export interface PeriodicidadeCfg { ext: number; int: number; hid: number; }

/** Tabela 1.a — estabelecimentos SEM SPIE. */
export const PERIODICIDADE_SEM_SPIE: Record<CategoriaVaso, PeriodicidadeCfg> = {
  I:   { ext: 1, int: 3,  hid: 6  },
  II:  { ext: 2, int: 4,  hid: 8  },
  III: { ext: 3, int: 6,  hid: 12 },
  IV:  { ext: 4, int: 8,  hid: 16 },
  V:   { ext: 5, int: 10, hid: 20 },
};

/** Tabela 1.b — estabelecimentos COM SPIE (cat. V interno "a critério" = 0). */
export const PERIODICIDADE_COM_SPIE: Record<CategoriaVaso, PeriodicidadeCfg> = {
  I:   { ext: 3, int: 6,  hid: 12 },
  II:  { ext: 4, int: 8,  hid: 16 },
  III: { ext: 5, int: 10, hid: 20 },
  IV:  { ext: 6, int: 12, hid: 24 },
  V:   { ext: 7, int: 0,  hid: 0  },
};

/** Versão textual para tabelas-resumo na interface. */
export const PRAZOS_NR13_TEXTO: Record<CategoriaVaso, { ext: string; int: string; hid: string }> = {
  I:   { ext: '1 ano',  int: '3 anos',  hid: '6 anos'  },
  II:  { ext: '2 anos', int: '4 anos',  hid: '8 anos'  },
  III: { ext: '3 anos', int: '6 anos',  hid: '12 anos' },
  IV:  { ext: '4 anos', int: '8 anos',  hid: '16 anos' },
  V:   { ext: '5 anos', int: '10 anos', hid: '20 anos' },
};

/**
 * Calcula os próximos prazos NR-13 somando a periodicidade da Tabela 1 à
 * data da última inspeção. Retorna strings ISO (YYYY-MM-DD) ou null.
 */
export function calcularPrazosNR13(
  categoria: string | null | undefined,
  dtUltimaInsp: string | null | undefined,
  comSpie = false,
): { proxExterno: string | null; proxInterno: string | null; proxHidro: string | null } {
  if (!categoria || !dtUltimaInsp) {
    return { proxExterno: null, proxInterno: null, proxHidro: null };
  }
  const tabela = comSpie ? PERIODICIDADE_COM_SPIE : PERIODICIDADE_SEM_SPIE;
  const cfg = tabela[String(categoria).toUpperCase() as CategoriaVaso];
  if (!cfg) {
    return { proxExterno: null, proxInterno: null, proxHidro: null };
  }
  const base = new Date(`${String(dtUltimaInsp).slice(0, 10)}T12:00:00Z`);
  if (isNaN(base.getTime())) {
    return { proxExterno: null, proxInterno: null, proxHidro: null };
  }
  const addYears = (y: number): string | null => {
    if (!y || y <= 0) return null;
    const d = new Date(base);
    d.setUTCFullYear(d.getUTCFullYear() + y);
    return d.toISOString().slice(0, 10);
  };
  return {
    proxExterno: addYears(cfg.ext),
    proxInterno: addYears(cfg.int),
    proxHidro:   addYears(cfg.hid),
  };
}
