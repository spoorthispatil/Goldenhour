import { useCallback, useEffect, useRef, useState } from 'react';
import { api, describeApiError } from './api';
import { useRealtime } from './realtime';

interface PolledResource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Fetches a resource, refreshes it immediately when Socket.IO reports a change,
 * and keeps a slow poll as a fallback when the socket is not available.
 * The dispatcher dashboard refreshes automatically.
 */
export function usePolledResource<T>(
  path: string,
  intervalMs = 20000,
): PolledResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await api.get<T>(path);
      if (!mounted.current) return;
      setData(response.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mounted.current) return;
      setError(describeApiError(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => void load(), intervalMs);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [load, intervalMs]);

  useRealtime(() => {
    void load();
  });

  return { data, error, loading, lastUpdated, refresh: () => void load() };
}

/** Live "server reachable" indicator driven by GET /api/health. */
export function useHealth(intervalMs = 15000) {
  return usePolledResource<import('./types').HealthResponse>('/health', intervalMs);
}
