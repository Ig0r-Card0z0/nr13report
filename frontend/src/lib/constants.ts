// Periodicidade máxima de inspeção por categoria — NR-13 Anexo IV, Tabela 1 (sem SPIE)
// Em ANOS para Externa (ext), Interna (int) e Teste Hidrostático (hid)
export const PERIODICIDADE_NR13_ANOS: Record<string, { ext: number; int: number; hid: number }> = {
  I:   { ext: 1, int: 3,  hid: 6  },
  II:  { ext: 2, int: 4,  hid: 8  },
  III: { ext: 3, int: 6,  hid: 12 },
  IV:  { ext: 4, int: 8,  hid: 16 },
  V:   { ext: 5, int: 10, hid: 20 },
};

// Versão textual para exibição em tabelas resumo
export const PRAZOS_NR13: Record<string, { ext: string; int: string; hid: string }> = {
  I:   { ext: '1 ano',  int: '3 anos',  hid: '6 anos'  },
  II:  { ext: '2 anos', int: '4 anos',  hid: '8 anos'  },
  III: { ext: '3 anos', int: '6 anos',  hid: '12 anos' },
  IV:  { ext: '4 anos', int: '8 anos',  hid: '16 anos' },
  V:   { ext: '5 anos', int: '10 anos', hid: '20 anos' },
};

/**
 * Calcula próximos prazos NR-13 (externo/interno/hidrostático) somando a
 * periodicidade da Tabela 1 (sem SPIE) à data da última inspeção.
 * Retorna strings ISO (YYYY-MM-DD) ou null se faltar entrada.
 */
export function calcularPrazosNR13(
  categoria: string | null | undefined,
  dtUltimaInsp: string | null | undefined,
): { proxExterno: string | null; proxInterno: string | null; proxHidro: string | null } {
  if (!categoria || !dtUltimaInsp) {
    return { proxExterno: null, proxInterno: null, proxHidro: null };
  }
  const cfg = PERIODICIDADE_NR13_ANOS[String(categoria).toUpperCase()];
  if (!cfg) return { proxExterno: null, proxInterno: null, proxHidro: null };
  const base = new Date(`${String(dtUltimaInsp).slice(0, 10)}T12:00:00Z`);
  if (isNaN(base.getTime())) {
    return { proxExterno: null, proxInterno: null, proxHidro: null };
  }
  const addYears = (y: number) => {
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

// Classes de fluido NR-13
export const CLASSES_FLUIDO = [
  { value: 'A', label: 'Classe A – Inflamável / Tóxico grave' },
  { value: 'B', label: 'Classe B – Inflamável / Tóxico moderado' },
  { value: 'C', label: 'Classe C – Vapor d\'água / Gás asfixiante / Ar' },
];

// Tipos de equipamento
export const TIPOS_EQUIPAMENTO = [
  'Vaso de Pressão',
  'Caldeira',
  'Vaso criogênico',
  'Tanque metálico de armazenamento',
  'Tubulação de interligação',
];

// Tipos de inspeção
export const TIPOS_INSPECAO = ['Externa', 'Interna', 'Interna e Externa'];

// Resultados de inspeção
export const RESULTADOS_INSPECAO = ['Apto', 'Inapto', 'Apto com restrições'];

// Fluidos comuns
export const FLUIDOS_COMUNS = [
  'Ar comprimido',
  'Vapor d\'água',
  'Nitrogênio',
  'CO2',
  'GLP',
  'Óleo combustível',
  'Água quente',
  'Amônia',
  'Outro',
];

// Normas de referência para ME
export const NORMAS_ME = [
  'Petrobras N-1594 | ASME VIII Div.1',
  'ABNT NBR 15248',
  'ASME V',
  'AWS D1.1',
];

// Códigos de projeto comuns
export const CODIGOS_PROJETO = [
  'ASME VIII Div.1 Ed 2017',
  'ASME VIII Div.1 Ed 2021',
  'ASME VIII Div.2',
  'ABNT NBR 13523',
  'EN 13445',
  'PD 5500',
];
