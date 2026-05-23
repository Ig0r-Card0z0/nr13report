/* ============================================================================
 * NR-13 — Núcleo de cálculo e enquadramento
 * ----------------------------------------------------------------------------
 * Fonte única da verdade para classificação de equipamentos sob a NR-13.
 * O frontend espelha esta mesma lógica em src/lib/nr13.ts — manter sincronizado.
 *
 * Referências:
 *  - NR-13, Anexo II (categorização de vasos de pressão)
 *  - NR-13, Anexo IV (periodicidades de inspeção — Tabela 1, com e sem SPIE)
 *  - NR-13, item 13.4 (caldeiras)
 *
 * UNIDADES
 *  - Pressão de cálculo: kPa.
 *  - Volume: m3 para vasos; litros (L) para o critério de caldeira categoria C.
 *  - P x V (enquadramento no escopo da NR-13): kPa.m3. Limite: P x V > 8.
 *  - P x V (classificação do Grupo de Potencial de Risco): MPa.m3. Limites:
 *    100 / 30 / 2,5 / 1 MPa.m3.
 *
 * CONVENÇÃO DE PRESSÃO
 *  - O cálculo de P x V dos vasos usa a PMTA (Pressão Máxima de Trabalho
 *    Admissível), conforme a NR-13. O formulário coleta a PMTA em bar; a
 *    conversão bar -> kPa é feita por barParaKpa() antes do cálculo.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * 1. CONVERSÃO DE UNIDADES DE PRESSÃO
 * --------------------------------------------------------------------------*/

/** Unidades de pressão suportadas pelo conversor. */
export type UnidadePressao = 'kPa' | 'MPa' | 'bar' | 'kgf/cm2' | 'psi';

/**
 * Fatores de conversão para kPa (unidade base interna).
 * 1 [unidade] = FATOR_PARA_KPA[unidade] kPa.
 *
 * Valores precisos:
 *  - 1 MPa      = 1000 kPa            (exato)
 *  - 1 bar      = 100 kPa            (exato)
 *  - 1 kgf/cm2  = 98.0665 kPa        (definição da gravidade padrão)
 *  - 1 psi      = 6.894757293168361 kPa
 */
export const FATOR_PARA_KPA: Record<UnidadePressao, number> = {
  kPa: 1,
  MPa: 1000,
  bar: 100,
  'kgf/cm2': 98.0665,
  psi: 6.894757293168361,
};

/** Converte um valor de qualquer unidade suportada para kPa. */
export function pressaoParaKpa(valor: number, de: UnidadePressao): number {
  return valor * FATOR_PARA_KPA[de];
}

/** Converte um valor de kPa para qualquer unidade suportada. */
export function kpaPara(valorKpa: number, para: UnidadePressao): number {
  return valorKpa / FATOR_PARA_KPA[para];
}

/** Converte diretamente entre duas unidades de pressão. */
export function converterPressao(
  valor: number,
  de: UnidadePressao,
  para: UnidadePressao,
): number {
  return kpaPara(pressaoParaKpa(valor, de), para);
}

/** Atalho — converte bar para kPa (entrada padrão do formulário de PMTA). */
export function barParaKpa(valorBar: number): number {
  return pressaoParaKpa(valorBar, 'bar');
}

/**
 * Tabela de conversão de pressão pronta para exibição.
 * Dado um valor numa unidade, retorna o equivalente em todas as unidades.
 */
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

export const CLASSES_FLUIDO: { value: ClasseFluido; label: string; descricao: string }[] = [
  {
    value: 'A',
    label: 'Classe A',
    descricao:
      'Fluidos inflamaveis; combustiveis com temperatura >= 200 C; toxicos com '
      + 'limite de tolerancia <= 20 ppm; hidrogenio; acetileno.',
  },
  {
    value: 'B',
    label: 'Classe B',
    descricao:
      'Fluidos combustiveis com temperatura < 200 C; toxicos com limite de '
      + 'tolerancia > 20 ppm.',
  },
  {
    value: 'C',
    label: 'Classe C',
    descricao: 'Vapor de agua; gases asfixiantes simples; ar comprimido.',
  },
  {
    value: 'D',
    label: 'Classe D',
    descricao: 'Outro fluido (agua ou liquidos com temperatura < 200 C).',
  },
];

/* ----------------------------------------------------------------------------
 * 3. CATEGORIZACAO DE VASOS DE PRESSAO (NR-13, Anexo II)
 * ----------------------------------------------------------------------------
 * A categoria sai do cruzamento da CLASSE do fluido com o GRUPO de potencial
 * de risco. O grupo depende do produto P x V e tambem da classe.
 *
 * Grupos de potencial de risco (P x V em MPa.m3):
 *   Grupo 1: P.V >= 100
 *   Grupo 2: P.V < 100   (classe A)  /  P.V >= 30  (demais)
 *   Grupo 3: P.V < 30
 *   Grupo 4: P.V < 2,5   (classe A)  /  P.V >= 1   (demais)
 *   Grupo 5: P.V < 1
 *
 * Matriz Classe x Grupo -> Categoria (Anexo II da norma):
 *           G1   G2   G3   G4   G5
 *   A       I    I    II   III  III
 *   B       I    II   III  IV   IV
 *   C       I    II   III  IV   V
 *   D       II   III  IV   V    V
 * --------------------------------------------------------------------------*/

export type CategoriaVaso = 'I' | 'II' | 'III' | 'IV' | 'V';
export type GrupoRisco = 1 | 2 | 3 | 4 | 5;

/** P x V em MPa.m3 a partir da pressao em kPa e volume em m3. */
export function calcularPVmpa(pressaoKpa: number, volumeM3: number): number {
  // P x V [kPa.m3] convertido para MPa.m3 (1 MPa = 1000 kPa)
  return (pressaoKpa * volumeM3) / 1000;
}

/** Determina o grupo de potencial de risco (1 a 5) a partir do P x V (MPa.m3). */
export function determinarGrupoRisco(pvMpa: number, classe: ClasseFluido): GrupoRisco {
  if (pvMpa >= 100) return 1;
  if (pvMpa >= 30) return 2;
  if (pvMpa >= 2.5) return 3;
  if (pvMpa >= 1) return 4;
  return 5;
}

/** Matriz oficial Classe x Grupo -> Categoria (NR-13 Anexo II). */
const MATRIZ_CATEGORIA: Record<ClasseFluido, Record<GrupoRisco, CategoriaVaso>> = {
  A: { 1: 'I', 2: 'I',   3: 'II',  4: 'III', 5: 'III' },
  B: { 1: 'I', 2: 'II',  3: 'III', 4: 'IV',  5: 'IV'  },
  C: { 1: 'I', 2: 'II',  3: 'III', 4: 'IV',  5: 'V'   },
  D: { 1: 'II', 2: 'III', 3: 'IV', 4: 'V',   5: 'V'   },
};

export interface ResultadoCategoriaVaso {
  /** P x V em MPa.m3 (unidade da classificacao do Grupo de Risco). */
  pvMpa: number;
  /** P x V em kPa.m3 (unidade do criterio de enquadramento da NR-13). */
  pvKpa: number;
  grupo: GrupoRisco;
  categoria: CategoriaVaso;
  /** O vaso esta sujeito a NR-13? (P.V > 8 kPa.m3 OU fluido classe A). */
  enquadradoNR13: boolean;
  /** Dispensa exame interno e teste hidrostatico?
   *  (Categoria V, P.V <= 8 kPa.m3, classe C ou D). */
  dispensaInternaHidro: boolean;
  observacao: string;
}

/**
 * Categoriza um vaso de pressao conforme a NR-13, Anexo II.
 *
 * @param pmtaBar  PMTA em bar (unidade do formulario).
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

  // Enquadramento: P.V > 8 kPa.m3 OU fluido classe A (qualquer volume).
  const enquadradoNR13 = pvKpa > 8 || classe === 'A';

  // Dispensa de exame interno e teste hidrostatico: categoria V,
  // P.V <= 8 kPa.m3 e fluido classe C ou D.
  const dispensaInternaHidro =
    categoria === 'V' && pvKpa <= 8 && (classe === 'C' || classe === 'D');

  let observacao = '';
  if (!enquadradoNR13) {
    observacao =
      'P x V <= 8 kPa.m3 e fluido nao classe A — pode estar fora do escopo da NR-13.';
  } else if (dispensaInternaHidro) {
    observacao =
      'Categoria V, P x V <= 8 kPa.m3, classe C/D — dispensado de exame '
      + 'interno e teste hidrostatico (mantem exame externo).';
  }

  return {
    pvMpa,
    pvKpa,
    grupo,
    categoria,
    enquadradoNR13,
    dispensaInternaHidro,
    observacao,
  };
}

/* ----------------------------------------------------------------------------
 * 4. CATEGORIZACAO DE CALDEIRAS (NR-13, item 13.4)
 * ----------------------------------------------------------------------------
 * Categoria A: pressao de operacao >= 1960 kPa.
 * Categoria C: pressao de operacao <= 588 kPa E volume interno <= 100 litros.
 * Categoria B: toda caldeira que nao se enquadra em A nem em C.
 * --------------------------------------------------------------------------*/

export type CategoriaCaldeira = 'A' | 'B' | 'C';

export interface ResultadoCategoriaCaldeira {
  categoria: CategoriaCaldeira;
  observacao: string;
}

/**
 * Categoriza uma caldeira a vapor conforme a NR-13.
 *
 * @param pressaoOperacaoKpa Pressao de operacao em kPa.
 * @param volumeLitros       Volume interno em litros.
 */
export function categorizarCaldeira(
  pressaoOperacaoKpa: number,
  volumeLitros: number,
): ResultadoCategoriaCaldeira {
  if (pressaoOperacaoKpa >= 1960) {
    return {
      categoria: 'A',
      observacao: 'Pressao de operacao >= 1960 kPa (~19,98 kgf/cm2).',
    };
  }
  if (pressaoOperacaoKpa <= 588 && volumeLitros <= 100) {
    return {
      categoria: 'C',
      observacao: 'Pressao <= 588 kPa e volume interno <= 100 litros.',
    };
  }
  return {
    categoria: 'B',
    observacao: 'Nao se enquadra nas categorias A nem C.',
  };
}

/* ----------------------------------------------------------------------------
 * 5. PERIODICIDADE DE INSPECAO (NR-13, Anexo IV — Tabela 1)
 * ----------------------------------------------------------------------------
 * Periodicidade maxima em ANOS para exame externo e exame interno.
 * Ha dois regimes: estabelecimento SEM SPIE e estabelecimento COM SPIE.
 *
 * Observacao: o teste hidrostatico segue, na pratica, periodicidade ligada
 * ao exame interno; este modulo expoe os prazos de externo, interno e
 * hidrostatico mantendo o comportamento ja adotado pelo sistema.
 * --------------------------------------------------------------------------*/

export interface PeriodicidadeCfg {
  ext: number;  // exame externo (anos)
  int: number;  // exame interno (anos)
  hid: number;  // teste hidrostatico (anos)
}

/** Tabela 1.a — estabelecimentos SEM SPIE. */
export const PERIODICIDADE_SEM_SPIE: Record<CategoriaVaso, PeriodicidadeCfg> = {
  I:   { ext: 1, int: 3,  hid: 6  },
  II:  { ext: 2, int: 4,  hid: 8  },
  III: { ext: 3, int: 6,  hid: 12 },
  IV:  { ext: 4, int: 8,  hid: 16 },
  V:   { ext: 5, int: 10, hid: 20 },
};

/** Tabela 1.b — estabelecimentos COM SPIE.
 *  Categoria V exame interno "a criterio": modelado como 0 (sem prazo fixo). */
export const PERIODICIDADE_COM_SPIE: Record<CategoriaVaso, PeriodicidadeCfg> = {
  I:   { ext: 3, int: 6,  hid: 12 },
  II:  { ext: 4, int: 8,  hid: 16 },
  III: { ext: 5, int: 10, hid: 20 },
  IV:  { ext: 6, int: 12, hid: 24 },
  V:   { ext: 7, int: 0,  hid: 0  },
};

export interface PrazosNR13 {
  prox_externo: string | null;
  prox_interno: string | null;
  prox_hidro: string | null;
}

/**
 * Calcula os proximos prazos NR-13 somando a periodicidade da Tabela 1 a
 * partir da data da ultima inspecao.
 *
 * @param categoria  Categoria do vaso (I a V).
 * @param dtUltima   Data da ultima inspecao (YYYY-MM-DD).
 * @param comSpie    true para usar a Tabela 1.b (estabelecimento com SPIE).
 */
export function calcularPrazosNR13(
  categoria: string | null | undefined,
  dtUltima: string | null | undefined,
  comSpie = false,
): PrazosNR13 {
  if (!categoria || !dtUltima) {
    return { prox_externo: null, prox_interno: null, prox_hidro: null };
  }
  const tabela = comSpie ? PERIODICIDADE_COM_SPIE : PERIODICIDADE_SEM_SPIE;
  const cfg = tabela[categoria.toUpperCase() as CategoriaVaso];
  if (!cfg) {
    return { prox_externo: null, prox_interno: null, prox_hidro: null };
  }

  const base = new Date(`${String(dtUltima).slice(0, 10)}T12:00:00Z`);
  if (isNaN(base.getTime())) {
    return { prox_externo: null, prox_interno: null, prox_hidro: null };
  }

  const addYears = (y: number): string | null => {
    if (!y || y <= 0) return null; // 0 = "a criterio", sem prazo fixo
    const d = new Date(base);
    d.setUTCFullYear(d.getUTCFullYear() + y);
    return d.toISOString().slice(0, 10);
  };

  return {
    prox_externo: addYears(cfg.ext),
    prox_interno: addYears(cfg.int),
    prox_hidro:   addYears(cfg.hid),
  };
}
