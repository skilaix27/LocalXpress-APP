import { useState, useCallback } from 'react';
import { superadminApi, SuperAdminMetrics } from '@/lib/api';

export function useSuperAdminMetrics() {
  const [data, setData] = useState<SuperAdminMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await superadminApi.getMetrics();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando métricas');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh: fetchMetrics };
}
