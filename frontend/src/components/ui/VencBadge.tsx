import { diasAte, vencStatus } from '@/lib/utils';
import { Badge } from './Badge';

export function VencBadge({ dt }: { dt?: string }) {
  const s = vencStatus(dt);
  const d = diasAte(dt);
  if (s === 'none') return <Badge variant="gray">Sem data</Badge>;
  const variant = { ok: 'success', info: 'info', warn: 'warning', danger: 'danger' }[s] as any;
  const label = d! < 0 ? `Vencida ${Math.abs(d!)}d` : `${d}d`;
  return <Badge variant={variant}>{label}</Badge>;
}
