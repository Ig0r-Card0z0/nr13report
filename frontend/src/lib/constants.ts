/* ----------------------------------------------------------------------------
 * Constantes da aplicação NR-13.
 * A lógica de cálculo/categorização NR-13 vive em src/lib/nr13.ts (fonte única).
 * Este arquivo re-exporta o que a interface consome e mantém as listas de UI.
 * --------------------------------------------------------------------------*/
import {
  PERIODICIDADE_SEM_SPIE,
  PRAZOS_NR13_TEXTO,
  calcularPrazosNR13 as _calcularPrazosNR13,
  CategoriaVaso,
} from './nr13';

// ── Periodicidade NR-13 (compatibilidade) ─────────────
// Mantido para código existente. A fonte é src/lib/nr13.ts.
export const PERIODICIDADE_NR13_ANOS = PERIODICIDADE_SEM_SPIE;

// Versão textual para exibição em tabelas resumo
export const PRAZOS_NR13: Record<string, { ext: string; int: string; hid: string }> =
  PRAZOS_NR13_TEXTO;

/**
 * Calcula próximos prazos NR-13 (externo/interno/hidrostático).
 * Reexportado de src/lib/nr13.ts — assinatura preservada para compatibilidade.
 */
export function calcularPrazosNR13(
  categoria: string | null | undefined,
  dtUltimaInsp: string | null | undefined,
  comSpie = false,
) {
  return _calcularPrazosNR13(categoria, dtUltimaInsp, comSpie);
}

// Classes de fluido NR-13 (4 classes — A, B, C, D)
export const CLASSES_FLUIDO = [
  { value: 'A', label: 'Classe A – Inflamável / Combustível ≥ 200 °C / Tóxico grave' },
  { value: 'B', label: 'Classe B – Combustível < 200 °C / Tóxico moderado' },
  { value: 'C', label: 'Classe C – Vapor d\'água / Ar comprimido / Gás asfixiante' },
  { value: 'D', label: 'Classe D – Outro fluido (água / líquidos < 200 °C)' },
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

export type { CategoriaVaso };
