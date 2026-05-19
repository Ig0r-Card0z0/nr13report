export function fmtData(dt?: string) {
  if (!dt) return '—';
  const p = dt.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dt;
}

export function diasAte(dt?: string): number | null {
  if (!dt) return null;
  return Math.round((new Date(dt + 'T12:00:00').getTime() - Date.now()) / 86400000);
}

export function vencStatus(dt?: string): 'ok' | 'info' | 'warn' | 'danger' | 'none' {
  const d = diasAte(dt);
  if (d === null) return 'none';
  if (d < 0) return 'danger';
  if (d <= 30) return 'danger';
  if (d <= 90) return 'warn';
  if (d <= 180) return 'info';
  return 'ok';
}

export function calcCategoria(volume: number, pmta: number, classe: string) {
  const pv = pmta * 0.1 * volume;
  let cat = pv <= 0.1 ? 'I' : pv <= 1 ? 'II' : pv <= 10 ? 'III' : pv <= 100 ? 'IV' : 'V';
  const cs = ['I', 'II', 'III', 'IV', 'V'];
  if (classe === 'A' && cat !== 'V') cat = cs[cs.indexOf(cat) + 1];
  const gr = { I: '1', II: '2', III: '3', IV: '4', V: '5' }[cat] ?? '?';
  return { cat, grupo: `Grupo ${gr}`, pv };
}

export function maskCnpj(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
}

export async function buscarCep(cep: string) {
  const raw = cep.replace(/\D/g, '');
  if (raw.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
  const d = await r.json();
  if (d.erro) return null;
  return { logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf };
}

export function calcReducao(nom?: number, enc?: number) {
  if (!nom || !enc) return null;
  return ((nom - enc) / nom * 100).toFixed(1);
}
