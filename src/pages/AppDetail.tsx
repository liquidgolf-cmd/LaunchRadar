import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../hooks/useApps';
import { useCurrentMatches, useDigests } from '../hooks/useMatches';
import MatchCard from '../components/MatchCard';
import DigestList from '../components/DigestList';
import KeywordEditor from '../components/KeywordEditor';

type Tab = 'this-week' | 'past-digests' | 'settings';

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const { app, loading: appLoading, refetch: refetchApp } = useApp(id ?? '');
  const { matches, loading: matchesLoading, refetch: refetchMatches } = useCurrentMatches(id ?? '');
  const { digests, loading: digestsLoading } = useDigests(id ?? '');

  const [tab, setTab] = useState<Tab>('this-week');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Settings tab state
  const [keywords, setKeywords] = useState<string[] | null>(null);
  const [savingKeywords, setSavingKeywords] = useState(false);

  const handleScan = async () => {
    if (!id) return;
    setScanning(true);
    setScanResult(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scan failed');
      setScanResult(
        `Found ${data.inserted.total} new signals, scored ${data.scored}.`
      );
      refetchMatches();
    } catch (err) {
      setScanResult(err instanceof Error ? err.message : 'Scan failed');
    }

    setScanning(false);
  };

  const handleSaveKeywords = async () => {
    if (!id || !keywords) return;
    setSavingKeywords(true);

    await supabase
      .from('apps')
      .update({ keywords, updated_at: new Date().toISOString() })
      .eq('id', id);

    setSavingKeywords(false);
    refetchApp();
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    // Initialise keyword editor with current app keywords when settings tab opens
    if (t === 'settings' && app && keywords === null) {
      setKeywords(app.keywords);
    }
  };

  if (appLoading) {
    return (
      <div className="px-8 py-8 text-[#64748b] text-sm">Loading…</div>
    );
  }

  if (!app) {
    return (
      <div className="px-8 py-8">
        <p className="text-[#ef4444] text-sm">App not found.</p>
        <Link to="/apps" className="text-sm text-[#f97316] hover:underline mt-2 inline-block">
          ← Back to apps
        </Link>
      </div>
    );
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
      tab === t
        ? 'border-[#f97316] text-[#0f172a]'
        : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
    }`;

  return (
    <div className="px-8 py-8 max-w-3xl">
      {/* Back link */}
      <Link
        to="/apps"
        className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#0f172a] mb-5 transition-colors"
      >
        <ArrowLeft size={13} />
        All apps
      </Link>

      {/* App header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0f172a]">{app.name}</h1>
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-[#64748b] hover:text-[#f97316] mt-0.5 transition-colors"
            >
              <ExternalLink size={13} />
              {app.url.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {/* Scan now — for testing, not promoted */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#0f172a]
                       border border-[#e2e8f0] px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
          {scanResult && (
            <p className="text-xs text-[#64748b]">{scanResult}</p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#e2e8f0] mb-6">
        <button className={tabClass('this-week')} onClick={() => handleTabChange('this-week')}>
          This week
        </button>
        <button className={tabClass('past-digests')} onClick={() => handleTabChange('past-digests')}>
          Past digests
        </button>
        <button className={tabClass('settings')} onClick={() => handleTabChange('settings')}>
          Settings
        </button>
      </div>

      {/* This week */}
      {tab === 'this-week' && (
        <div>
          {matchesLoading && <p className="text-[#64748b] text-sm">Loading matches…</p>}

          {!matchesLoading && matches.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#0f172a] font-semibold mb-1">No matches yet.</p>
              <p className="text-[#64748b] text-sm mb-4">
                Your first scan runs Monday morning. Or trigger one manually.
              </p>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-2 mx-auto text-sm font-semibold text-[#f97316]
                           hover:text-orange-600 transition-colors"
              >
                <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
                {scanning ? 'Scanning…' : 'Run scan now'}
              </button>
            </div>
          )}

          {!matchesLoading && matches.length > 0 && (
            <div className="space-y-4">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} onActedOn={refetchMatches} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Past digests */}
      {tab === 'past-digests' && (
        <div>
          {digestsLoading ? (
            <p className="text-[#64748b] text-sm">Loading…</p>
          ) : (
            <DigestList digests={digests} />
          )}
        </div>
      )}

      {/* Settings — keyword editor */}
      {tab === 'settings' && (
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#0f172a] mb-1">Signal keywords</h2>
            <p className="text-xs text-[#64748b]">
              Edit the phrases LaunchRadar searches for. Add or remove as needed.
            </p>
          </div>

          <KeywordEditor
            keywords={keywords ?? app.keywords}
            onChange={setKeywords}
          />

          <button
            onClick={handleSaveKeywords}
            disabled={savingKeywords || keywords === null}
            className="mt-4 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-40
                       text-white font-semibold px-4 py-2 rounded text-sm transition-colors"
          >
            {savingKeywords ? 'Saving…' : 'Save keywords'}
          </button>
        </div>
      )}
    </div>
  );
}
