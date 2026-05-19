'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Crumb { label: string; href?: string; }

interface Props {
  title: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  back?: string;
}

export function PageHeader({ title, breadcrumbs, actions, back }: Props) {
  const router = useRouter();
  return (
    <div className="flex items-start gap-3 mb-6">
      {back && (
        <button onClick={() => router.push(back)} className="btn btn-sm mt-0.5">
          <ArrowLeft size={14} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {b.href ? (
                  <button onClick={() => router.push(b.href!)} className="hover:text-primary-700 transition-colors">
                    {b.label}
                  </button>
                ) : (
                  <span>{b.label}</span>
                )}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-xl font-semibold text-gray-900 truncate">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
