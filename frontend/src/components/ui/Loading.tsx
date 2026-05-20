import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-gray-200 border-t-primary-700 w-5 h-5', className)} />
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
      <Spinner />
      <span className="text-sm">Carregando...</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, message, action }: {
  icon: React.ElementType;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card text-center py-12 text-gray-400">
      <Icon className="w-10 h-10 mx-auto mb-3 text-gray-200" />
      <p className="text-sm mb-4">{message}</p>
      {action}
    </div>
  );
}
