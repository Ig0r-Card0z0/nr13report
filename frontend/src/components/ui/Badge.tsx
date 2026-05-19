import clsx from 'clsx';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'gray';

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const map: Record<Variant, string> = {
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger:  'bg-danger-50  text-danger-700',
  info:    'bg-primary-50 text-primary-700',
  gray:    'bg-gray-100   text-gray-600',
};

export function Badge({ variant = 'gray', children, className }: Props) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', map[variant], className)}>
      {children}
    </span>
  );
}
