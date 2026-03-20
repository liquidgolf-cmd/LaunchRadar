import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApps } from '../hooks/useApps';
import AppCard from '../components/AppCard';
import MatchCard from '../components/MatchCard';
import type { SignalMatch } from '../types';

export default function Dashboard() {
  const { apps, loading: appsLoading } = useApps();

  // Top 5 matches across all apps this week
  const [topMatches, setTopMatches] = useState<SignalMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  // Match counts per app this week
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (apps.length === 0) {
      setMatchesLoading(false);
      return;
    }

    const appIds = apps.map((a) => a.id);

    // Fetch top 5 matches across all apps (undigested, scored)
    supabase
      .from('signal_matches')
      .select('*')
      .in('app_id', appIds)
      .eq('included_in_digest', false)
      .not('match_score', 'is', null)
      .order('match_score', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setTopMatches(data ?? []);
        setMatchesLoading(false);
      });

    // Fetch match counts per app
    supabase
      .from('signal_matches')
      .select('app_id')
      .in('app_id', appIds)
      .eq('included_in_digest', false)
      .not('match_score', 'is', null)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        for (const row of data ?? []) {
          counts[row.app_id] = (counts[row.app_id] ?? 0) + 1;
        }
        setMatchCounts(counts);
      });
  }, [apps]);

  if (appsLoading) {
    return <div className="px-8 py-8 text-[#64748b] text-sm">Loading…</div>;
  }

  // Empty state — no apps yet
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
        <h1 className="text-2xl font-black text-[#0f172a] mb-2">
          Welcome to LaunchRadar
        </h1>
        <p className="text-[#64748b] text-sm max-w-sm mb-6">
          Add your first app and we'll start finding conversations where it's the answer.
        </p>
        <Link
          to="/apps/new"
          className="flex items-center gap-2 bg-[#f97316] hover:bg-orange-600
                     text-white font-semibold px-5 py-2.5 rounded text-sm transition-colors"
        >
          <Plus size={15} />
          Add your first app →
        </Link>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-[#0f172a]">This week's signals</h1>
        <Link
          to="/apps/new"
          className="flex items-center gap-1.5 text-sm font-semibold text-[#64748b]
                     hover:text-[#0f172a] transition-colors"
        >
          <Plus size={14} />
          Add app
        </Link>
      </div>

      {/* Per-app summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} matchCount={matchCounts[app.id] ?? 0} />
        ))}
      </div>

      {/* Top matches — quick wins */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0f172a]">Top matches this week</h2>
          <span className="text-xs text-[#64748b]">Highest scoring across all apps</span>
        </div>

        {matchesLoading && (
          <p className="text-[#64748b] text-sm">Loading matches…</p>
        )}

        {!matchesLoading && topMatches.length === 0 && (
          <div className="bg-white border border-[#e2e8f0] rounded p-6 text-center">
            <p className="text-[#64748b] text-sm">
              No matches yet. Scans run every Monday morning.
            </p>
            <p className="text-xs text-[#64748b] mt-1">
              Or go to an app and click "Scan now" to test it.
            </p>
          </div>
        )}

        {!matchesLoading && topMatches.length > 0 && (
          <div className="space-y-4">
            {topMatches.map((match) => (
              <div key={match.id}>
                {/* App name label above each card */}
                <p className="text-xs font-semibold text-[#64748b] mb-1.5 flex items-center gap-1.5">
                  {apps.find((a) => a.id === match.app_id)?.name ?? 'Unknown app'}
                  <Link
                    to={`/apps/${match.app_id}`}
                    className="text-[#f97316] hover:underline flex items-center gap-0.5"
                  >
                    View all <ArrowRight size={10} />
                  </Link>
                </p>
                <MatchCard match={match} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
