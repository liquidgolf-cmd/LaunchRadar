import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { App } from '../types';

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('apps')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setApps(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchApps();
  }, []);

  return { apps, loading, error, refetch: fetchApps };
}

export function useApp(id: string) {
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApp = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('apps')
      .select('*')
      .eq('id', id)
      .single();

    if (error) setError(error.message);
    else setApp(data);
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchApp();
  }, [id]);

  return { app, loading, error, refetch: fetchApp };
}
