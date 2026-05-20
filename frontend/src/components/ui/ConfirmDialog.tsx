'use client';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  trigger: (open: () => void) => React.ReactNode;
  variant?: 'danger' | 'warning';
}

export function ConfirmDialog({ title, message, onConfirm, trigger, variant = 'danger' }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); setOpen(false); } finally { setLoading(false); }
  };

  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className={variant === 'danger' ? 'text-red-500 w-5 h-5' : 'text-yellow-500 w-5 h-5'} />
              <h3 className="font-semibold text-gray-900">{title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">{message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOpen(false)} className="btn" disabled={loading}>Cancelar</button>
              <button onClick={handleConfirm} disabled={loading}
                className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-warning'}>
                {loading ? 'Aguarde...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
