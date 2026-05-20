'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Archive, Ruler, FileText, UserCog } from 'lucide-react';
import clsx from 'clsx';
import { instrumentosApi } from '@/lib/api';
import { Instrumento } from '@/types';
import { diasAte } from '@/lib/utils';

const nav = [
  { label: 'Painel', href: '/', icon: LayoutDashboard },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Equipamentos', href: '/equipamentos', icon: Archive },
  { label: 'Profissionais', href: '/profissionais', icon: UserCog },
];

export function Sidebar() {
  const path = usePathname();
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);

  useEffect(() => {
    let cancelled = false;
    instrumentosApi.listar()
      .then(list => { if (!cancelled) setInstrumentos(list); })
      .catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
  }, [path]);

  const proximas = instrumentos
    .filter(i => i.validade_calibracao)
    .map(i => ({ i, d: diasAte(i.validade_calibracao) }))
    .filter(x => x.d !== null && x.d <= 90)
    .sort((a, b) => (a.d as number) - (b.d as number))
    .slice(0, 5);

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-screen">
      <div className="p-5 border-b border-gray-200">
        <div className="text-base font-bold text-primary-700">NR-13</div>
        <div className="text-xs text-gray-500 mt-0.5">Gestão de Inspeções</div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Sistema</div>
        {nav.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors',
              path === href
                ? 'bg-primary-50 text-primary-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}>
            <Icon size={15} />
            {label}
          </Link>
        ))}

        {/* Item Instrumentos com seleção rápida e aviso de calibrações */}
        <div className="mt-1 mb-1">
          <Link
            href="/instrumentos"
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              path === '/instrumentos' || path.startsWith('/instrumentos/')
                ? 'bg-primary-50 text-primary-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Ruler size={15} />
            Instrumentos
          </Link>

          {/* Seleção rápida: salta direto para edição do instrumento */}
          {instrumentos.length > 0 && (
            <select
              className="mt-2 w-full text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white
                text-gray-600 focus:outline-none focus:border-primary-400"
              defaultValue=""
              onChange={e => { if (e.target.value) window.location.href = `/instrumentos/${e.target.value}/editar`; }}
            >
              <option value="">Selecionar instrumento…</option>
              {instrumentos.map(i => (
                <option key={i.id} value={i.id}>{i.nome}</option>
              ))}
            </select>
          )}

          {/* Aviso de calibrações vencendo */}
          {proximas.length > 0 && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <FileText size={10} /> Calibrações
              </div>
              {proximas.map(({ i, d }) => (
                <Link
                  key={i.id}
                  href={`/instrumentos/${i.id}/editar`}
                  className="block text-[11px] text-gray-700 hover:text-primary-700 truncate"
                >
                  <span className={clsx(
                    'font-semibold mr-1',
                    (d as number) < 0 ? 'text-red-600' :
                    (d as number) <= 30 ? 'text-amber-600' : 'text-gray-500',
                  )}>
                    {(d as number) < 0 ? `Venc. ${Math.abs(d as number)}d` : `${d}d`}
                  </span>
                  {i.nome}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-400 px-2">Portaria SEPRT nº 915/2019</div>
      </div>
    </aside>
  );
}
