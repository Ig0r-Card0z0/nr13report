// NR-13 Anexo IV — Tabela 1 (sem SPIE) — periodicidade máxima em ANOS
// para inspeções de segurança periódicas de Vasos de Pressão.
//
// Categoria | Exame Externo | Exame Interno | Teste Hidrostático
//     I     |      1        |       3       |        6
//     II    |      2        |       4       |        8
//     III   |      3        |       6       |       12
//     IV    |      4        |       8       |       16
//     V     |      5        |      10       |       20
//
// Quando a empresa adota Programa de Inspeção (SPIE) os prazos podem ser estendidos;
// hoje o sistema aplica somente Tabela 1 (sem SPIE).
const PERIODICIDADE_NR13: Record<string, { ext: number; int: number; hid: number }> = {
  I:   { ext: 1, int: 3,  hid: 6  },
  II:  { ext: 2, int: 4,  hid: 8  },
  III: { ext: 3, int: 6,  hid: 12 },
  IV:  { ext: 4, int: 8,  hid: 16 },
  V:   { ext: 5, int: 10, hid: 20 },
};

export interface PrazosNR13 {
  prox_externo: string | null;
  prox_interno: string | null;
  prox_hidro: string | null;
}

export function calcularPrazosNR13(
  categoria: string | null | undefined,
  dtUltimaInsp: string | null | undefined,
): PrazosNR13 {
  if (!categoria || !dtUltimaInsp) {
    return { prox_externo: null, prox_interno: null, prox_hidro: null };
  }
  const cfg = PERIODICIDADE_NR13[categoria.toUpperCase()];
  if (!cfg) return { prox_externo: null, prox_interno: null, prox_hidro: null };

  const base = new Date(`${String(dtUltimaInsp).slice(0, 10)}T12:00:00Z`);
  if (isNaN(base.getTime())) {
    return { prox_externo: null, prox_interno: null, prox_hidro: null };
  }

  const addYears = (y: number): string => {
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
