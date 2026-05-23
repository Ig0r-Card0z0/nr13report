import { categorizarVaso } from '../src/common/nr13';

describe('NR-13 — Enquadramento por P × V (kPa·m³)', () => {
  it('enquadra quando P×V > 8 kPa·m³ (ex.: 10 bar × 10 m³ = 10 000 kPa·m³)', () => {
    const r = categorizarVaso(10, 10, 'C');
    expect(r.pvKpa).toBeCloseTo(10_000, 6);
    expect(r.enquadradoNR13).toBe(true);
  });

  it('não enquadra quando P×V ≤ 8 kPa·m³ e fluido não é classe A (ex.: 0,05 bar × 1 m³ = 5 kPa·m³)', () => {
    const r = categorizarVaso(0.05, 1, 'C');
    expect(r.pvKpa).toBeCloseTo(5, 6);
    expect(r.enquadradoNR13).toBe(false);
  });

  it('enquadra para classe A mesmo com P×V ≤ 8 kPa·m³ (regra do Anexo II)', () => {
    const r = categorizarVaso(0.05, 1, 'A');
    expect(r.pvKpa).toBeCloseTo(5, 6);
    expect(r.enquadradoNR13).toBe(true);
  });

  it('calcula dispensa de exame interno/hidro quando Cat. V, P×V ≤ 8 kPa·m³ e classe C/D', () => {
    const r = categorizarVaso(0.05, 1, 'C');
    expect(r.pvKpa).toBeCloseTo(5, 6);
    expect(r.categoria).toBe('V');
    expect(r.dispensaInternaHidro).toBe(true);
  });
});
