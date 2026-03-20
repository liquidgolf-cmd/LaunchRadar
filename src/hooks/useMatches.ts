import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { SignalMatch, Digest } from '../types';

// Current week: undigested, scored matches for a single app
export function useCurrentMatches(appId: string) {
  const [matches, setMatches] = useState<SignalMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('signal_matches')
      .select('*')
      .eq('app_id', appId)
      .eq('included_in_digest', false)
      .not('match_score', 'is', null)
      .order('match_score', { ascending: false });

    if (error) setError(error.message);
    else setMatches(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (appId) fetchMatches();
  }, [appId]);

  return { matches, loading, error, refetch: fetchMatches };
}

// Digests list for an app
export function useDigests(appId: string) {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appId) return;
    supabase
      .from('digests')
      .select('*')
      .eq('app_id', appId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setDigests(data ?? []);
        setLoading(false);
      });
  }, [appId]);

  return { digests, loading, error };
}

// Matches that were included in a specific digest
export function useDigestMatches(appId: string, digestCreatedAt: string) {
  const [matches, setMatches] = useState<SignalMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId || !digestCreatedAt) return;

    // Matches marked included_in_digest around the digest creation time
    // We fetch all included matches ordered by score — the digest view is read-only
    supabase
      .from('signal_matches')
      .select('*')
      .eq('app_id', appId)
      .eq('included_in_digest', true)
      .order('match_score', { ascending: false })
      .then(({ data }) => {
        setMatches(data ?? []);
        setLoading(false);
      });
  }, [appId, digestCreatedAt]);

  return { matches, loading };
}
