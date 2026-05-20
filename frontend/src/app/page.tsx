'use client';
import { useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/api';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, Users, Archive, ClipboardList, Camera, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

interface Stats { clientes:number; equipamentos:number; inspecoes:number; fotos:number; vencendo90:number; vencidos:number; }
interface Vencimento { id:string; tag:string; tipo:string; prox_externo:string; cliente_nome:string; dias_restantes:number; }
interface Recente { id:string; tag:string; tipo:string; categoria:string; cliente_nome:string; }

export default function Dashboard() {
  const [stats, setStats]     = useState<Stats|null>(null);
  const [venc, setVenc]       = useState<Vencimento[]>([]);
  const [rec, setRec]         = useState<Recente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dashboardApi.stats(), dashboardApi.vencimentos(90), dashboardApi.recentes()])
      .then(([s,v,r]) => { setStats(s); setVenc(v); setRec(r); })
      .finally(() => setLoading(false));
  }, []);

  const DiasBadge = ({ d }: { d: number }) => {
    if (d < 0)   return <span className="badge badge-danger">Vencida {Math.abs(d)}d</span>;
    if (d <= 30) return <span className="badge badge-danger">{d}d</span>;
    if (d <= 90) return <span className="badge badge-warning">{d}d</span>;
    return <span className="badge badge-success">{d}d</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
      <div className="animate-spin rounded-full border-2 border-gray-200 border-t-primary-700 w-6 h-6" />
      <span className="text-sm">Carregando painel...</span>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Painel</h1>
          <p className="text-xs text-gray-400 mt-0.5">NR-13 — Portaria SEPRT n 915/2019</p>
        </div>
        {stats && stats.vencidos > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={14} />
            <strong>{stats.vencidos}</strong> inspecao(oes) vencida(s)!
          </div>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Clientes',     val:stats.clientes,    Icon:Users,         c:'text-primary-700', bg:'bg-primary-50' },
            { label:'Equipamentos', val:stats.equipamentos, Icon:Archive,       c:'text-warning-700', bg:'bg-warning-50' },
            { label:'Inspecoes',    val:stats.inspecoes,    Icon:ClipboardList, c:'text-success-700', bg:'bg-success-50' },
            { label:'Fotos',        val:stats.fotos,        Icon:Camera,        c:'text-gray-600',    bg:'bg-gray-100'   },
          ].map(({ label,val,Icon,c,bg }) => (
            <div key={label} className="card flex items-center gap-4">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
                <Icon className={clsx('w-5 h-5', c)} />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
                <div className="text-2xl font-bold text-gray-900 leading-none mt-1">{val}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats && stats.vencendo90 > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm text-warning-700">
          <TrendingUp size={16} className="flex-shrink-0" />
          <span><strong>{stats.vencendo90}</strong> equipamento(s) vencendo nos proximos 90 dias.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-warning-700" />
            <h2 className="text-sm font-semibold text-gray-700">Vencimentos proximos</h2>
          </div>
          {venc.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-300" />
              <div className="text-sm">Nenhum vencendo em 90 dias.</div>
            </div>
          ) : venc.map(eq => (
            <Link href={'/equipamentos/'+eq.id} key={eq.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 mb-1 transition-all group">
              <div className="w-8 h-8 rounded-full bg-warning-50 text-warning-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {eq.tag.slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{eq.tag}</div>
                <div className="text-xs text-gray-500 truncate">{eq.cliente_nome}</div>
              </div>
              <DiasBadge d={eq.dias_restantes} />
            </Link>
          ))}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-4 h-4 text-primary-700" />
            <h2 className="text-sm font-semibold text-gray-700">Ultimos equipamentos</h2>
          </div>
          {rec.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">Nenhum equipamento cadastrado.</div>
          ) : rec.map(eq => (
            <Link href={'/equipamentos/'+eq.id} key={eq.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 mb-1 transition-all group">
              <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                {eq.tag.slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{eq.tag} - {eq.tipo}</div>
                <div className="text-xs text-gray-500 truncate">{eq.cliente_nome}</div>
              </div>
              {eq.categoria && <span className="badge badge-info flex-shrink-0">Cat. {eq.categoria}</span>}
            </Link>
          ))}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Link href="/equipamentos" className="text-xs text-primary-700 hover:underline">
              Ver todos os equipamentos
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Novo cliente',     href:'/clientes/novo',     color:'bg-primary-50 text-primary-700 border-primary-100' },
          { label:'Novo equipamento', href:'/equipamentos/novo', color:'bg-warning-50 text-warning-700 border-warning-100' },
          { label:'Ver clientes',     href:'/clientes',          color:'bg-gray-50 text-gray-600 border-gray-100' },
          { label:'Ver equipamentos', href:'/equipamentos',      color:'bg-gray-50 text-gray-600 border-gray-100' },
        ].map(({ label,href,color }) => (
          <Link key={href} href={href}
            className={clsx('border rounded-xl p-3 text-sm font-medium text-center hover:opacity-80 transition-opacity', color)}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
