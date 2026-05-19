'use client';
import { useMemo } from 'react';
import clsx from 'clsx';

interface Tab { id: string; label: string; icon?: React.ElementType; badge?: number; }

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  idPrefix?: string;
  controlsPrefix?: string;
}

export function Tabs({ tabs, active, onChange, ariaLabel, idPrefix = 'tabs', controlsPrefix }: Props) {
  const ids = useMemo(() => tabs.map(t => t.id), [tabs]);
  return (
    <div
      className="flex border-b border-gray-200 mb-5 overflow-x-auto"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={e => {
        const idx = ids.indexOf(active);
        if (idx < 0) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onChange(ids[(idx + 1) % ids.length]);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onChange(ids[(idx - 1 + ids.length) % ids.length]);
        } else if (e.key === 'Home') {
          e.preventDefault();
          onChange(ids[0]);
        } else if (e.key === 'End') {
          e.preventDefault();
          onChange(ids[ids.length - 1]);
        }
      }}
    >
      {tabs.map(({ id, label, icon: Icon, badge }) => (
        <button
          key={id}
          type="button"
          id={`${idPrefix}-tab-${id}`}
          role="tab"
          aria-selected={active === id}
          aria-controls={controlsPrefix ? `${controlsPrefix}-panel-${id}` : undefined}
          tabIndex={active === id ? 0 : -1}
          onClick={() => onChange(id)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap',
            active === id
              ? 'border-primary-700 text-primary-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}>
          {Icon && <Icon size={14} />}
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="ml-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none">
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
