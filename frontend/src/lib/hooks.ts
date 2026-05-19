'use client';
import { useState, useEffect, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(fetchFn: () => Promise<T>, deps: any[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFn()
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message || 'Erro ao carregar.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [...deps, tick]);

  return { data, loading, error, refetch };
}

export function useApiMutation<T, A = any>(
  mutationFn: (args: A) => Promise<T>
): { mutate: (args: A) => Promise<T>; loading: boolean; error: string | null } {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (args: A): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutationFn(args);
      return result;
    } catch (e: any) {
      setError(e.message || 'Erro na operação.');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
