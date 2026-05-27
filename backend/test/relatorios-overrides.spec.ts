import {
  parseOverrides,
  resolverSim,
  resolverTipoInspecao,
  resolverDataRecPH,
  CHAVES_RESULTADO,
} from '../src/modules/relatorios/resultado-overrides';

describe('relatorios :: parseOverrides', () => {
  it('retorna {} para entrada vazia/null/inválida', () => {
    expect(parseOverrides()).toEqual({});
    expect(parseOverrides('')).toEqual({});
    expect(parseOverrides('lixo nao-json')).toEqual({});
    expect(parseOverrides('null')).toEqual({});
    expect(parseOverrides('[1,2,3]')).toEqual({});
  });

  it('aceita valores sim/nao em chaves válidas', () => {
    const raw = JSON.stringify({ 'prontuarios.1': 'sim', 'externo.4': 'nao' });
    expect(parseOverrides(raw)).toEqual({ 'prontuarios.1': 'sim', 'externo.4': 'nao' });
  });

  it('descarta chaves desconhecidas e valores inválidos sem lançar', () => {
    const raw = JSON.stringify({
      'prontuarios.1': 'sim',
      'chave.que.nao.existe': 'sim',
      'externo.1': 'talvez',
      'externo.2': 42,
    });
    expect(parseOverrides(raw)).toEqual({ 'prontuarios.1': 'sim' });
  });

  it('aceita tipo de inspeção válido em conclusao.2', () => {
    const raw = JSON.stringify({ 'conclusao.2': 'extraordinaria' });
    expect(parseOverrides(raw)).toEqual({ 'conclusao.2': 'extraordinaria' });
  });

  it('rejeita tipo de inspeção inválido em conclusao.2', () => {
    const raw = JSON.stringify({ 'conclusao.2': 'inventado' });
    expect(parseOverrides(raw)).toEqual({});
  });

  it('aceita datas ISO YYYY-MM-DD nas chaves 5.1', () => {
    const raw = JSON.stringify({
      'prox.externo.recph': '2027-03-15',
      'prox.interno.recph': '2030-01-01',
      'prox.hidro.recph':   '2045-12-31',
    });
    expect(parseOverrides(raw)).toEqual({
      'prox.externo.recph': '2027-03-15',
      'prox.interno.recph': '2030-01-01',
      'prox.hidro.recph':   '2045-12-31',
    });
  });

  it('rejeita datas malformadas nas chaves 5.1', () => {
    const raw = JSON.stringify({
      'prox.externo.recph': '15/03/2027',
      'prox.interno.recph': 'amanhã',
      'prox.hidro.recph':   '',
    });
    expect(parseOverrides(raw)).toEqual({});
  });
});

describe('relatorios :: resolverSim', () => {
  it('retorna padrão quando chave ausente', () => {
    expect(resolverSim({}, 'prontuarios.1', true)).toBe(true);
    expect(resolverSim({}, 'prontuarios.1', false)).toBe(false);
  });

  it('override "sim" → true / "nao" → false (ignora padrão)', () => {
    expect(resolverSim({ 'prontuarios.1': 'sim' }, 'prontuarios.1', false)).toBe(true);
    expect(resolverSim({ 'prontuarios.1': 'nao' }, 'prontuarios.1', true)).toBe(false);
  });
});

describe('relatorios :: resolverTipoInspecao', () => {
  it('retorna padrão sem override', () => {
    expect(resolverTipoInspecao({}, 'periodica')).toBe('periodica');
  });

  it('override válido vence o padrão', () => {
    expect(resolverTipoInspecao({ 'conclusao.2': 'inicial' }, 'periodica')).toBe('inicial');
  });
});

describe('relatorios :: resolverDataRecPH (5.1)', () => {
  it('retorna undefined sem override', () => {
    expect(resolverDataRecPH({}, 'prox.externo.recph')).toBeUndefined();
  });

  it('retorna ISO date quando override válido', () => {
    expect(resolverDataRecPH({ 'prox.externo.recph': '2027-03-15' }, 'prox.externo.recph'))
      .toBe('2027-03-15');
  });

  it('ignora valor inválido (defesa em profundidade — parseOverrides já filtra)', () => {
    expect(resolverDataRecPH({ 'prox.externo.recph': 'lixo' as any }, 'prox.externo.recph'))
      .toBeUndefined();
  });
});

describe('relatorios :: catálogo CHAVES_RESULTADO', () => {
  it('inclui novas chaves da seção 5.1', () => {
    const chaves = CHAVES_RESULTADO.map(c => c.chave);
    expect(chaves).toContain('prox.externo.recph');
    expect(chaves).toContain('prox.interno.recph');
    expect(chaves).toContain('prox.hidro.recph');
  });

  it('chaves são únicas', () => {
    const chaves = CHAVES_RESULTADO.map(c => c.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
