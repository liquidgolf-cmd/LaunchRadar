import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import KeywordEditor from '../components/KeywordEditor';

export default function Onboarding() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsReady, setKeywordsReady] = useState(false);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!problemStatement.trim() || !targetUser.trim()) return;
    setExtracting(true);
    setExtractError(null);

    try {
      const res = await fetch('/api/extract-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_statement: problemStatement,
          target_user: targetUser,
        }),
      });

      // Guard against non-JSON responses (e.g. Vercel 504 timeout returns HTML)
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const msg = res.status === 504
          ? 'Request timed out. This usually resolves on the next attempt as the function warms up.'
          : `Server error (${res.status}). Check that your API keys are set in Vercel.`;
        throw new Error(msg);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed');
      setKeywords(data.keywords);
      setKeywordsReady(true);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!user || !name.trim() || !problemStatement.trim() || !targetUser.trim()) return;
    setSaving(true);
    setSaveError(null);

    const { data, error } = await supabase
      .from('apps')
      .insert({
        user_id: user.id,
        name: name.trim(),
        url: url.trim() || null,
        problem_statement: problemStatement.trim(),
        target_user: targetUser.trim(),
        keywords,
      })
      .select('id')
      .single();

    if (error || !data) {
      setSaveError(error?.message ?? 'Save failed');
      setSaving(false);
      return;
    }

    navigate(`/apps/${data.id}`);
  };

  const canExtract = problemStatement.trim().length > 20 && targetUser.trim().length > 10;

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#0f172a]">Add your app</h1>
        <p className="mt-1 text-[#64748b] text-sm">
          Tell us what problem your app solves. We'll find the conversations where it matters.
        </p>
      </div>

      <div className="space-y-6">
        {/* App name */}
        <div>
          <label className="block text-sm font-semibold text-[#0f172a] mb-1">
            App name <span className="text-[#ef4444]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lucid"
            className="w-full border border-[#e2e8f0] rounded px-3 py-2.5 text-sm text-[#0f172a]
                       focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent"
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-sm font-semibold text-[#0f172a] mb-1">
            App URL <span className="text-[#64748b] font-normal">(optional)</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourapp.com"
            className="w-full border border-[#e2e8f0] rounded px-3 py-2.5 text-sm text-[#0f172a]
                       focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent"
          />
        </div>

        {/* Problem statement */}
        <div>
          <label className="block text-sm font-semibold text-[#0f172a] mb-1">
            What problem does your app solve? <span className="text-[#ef4444]">*</span>
          </label>
          <p className="text-xs text-[#64748b] mb-2">
            Describe it from your user's perspective — what frustration were they living with before
            your app?
          </p>
          <textarea
            rows={4}
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            placeholder="e.g. Developers spend hours switching between apps to manage their tasks, losing context every time they context-switch…"
            className="w-full border border-[#e2e8f0] rounded px-3 py-2.5 text-sm text-[#0f172a]
                       focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent
                       resize-none"
          />
        </div>

        {/* Target user */}
        <div>
          <label className="block text-sm font-semibold text-[#0f172a] mb-1">
            Who is this person? <span className="text-[#ef4444]">*</span>
          </label>
          <p className="text-xs text-[#64748b] mb-2">
            Describe the specific type of person who has this problem.
          </p>
          <textarea
            rows={3}
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
            placeholder="e.g. Indie developers who work solo or in small teams and want to ship faster without a PM…"
            className="w-full border border-[#e2e8f0] rounded px-3 py-2.5 text-sm text-[#0f172a]
                       focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:border-transparent
                       resize-none"
          />
        </div>

        {/* Extract button */}
        {!keywordsReady && (
          <div>
            {extractError && (
              <p className="mb-3 text-sm text-[#ef4444]">{extractError}</p>
            )}
            <button
              onClick={handleExtract}
              disabled={!canExtract || extracting}
              className="flex items-center gap-2 bg-[#f97316] hover:bg-orange-600
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-semibold px-5 py-2.5 rounded text-sm transition-colors"
            >
              {extracting ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30
                                   border-t-white rounded-full" />
                  Analyzing your description…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Extract keywords →
                </>
              )}
            </button>
          </div>
        )}

        {/* Keywords editor */}
        {keywordsReady && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-[#0f172a]">
                Signal keywords
              </label>
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="text-xs text-[#64748b] hover:text-[#f97316] transition-colors"
              >
                Re-extract
              </button>
            </div>
            <p className="text-xs text-[#64748b] mb-3">
              These are the phrases LaunchRadar will search for. Add or remove as needed.
            </p>
            <KeywordEditor keywords={keywords} onChange={setKeywords} />

            {saveError && (
              <p className="mt-3 text-sm text-[#ef4444]">{saveError}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || keywords.length === 0}
              className="mt-5 flex items-center gap-2 bg-[#0f172a] hover:bg-slate-800
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-semibold px-5 py-2.5 rounded text-sm transition-colors"
            >
              {saving ? 'Saving…' : (
                <>
                  Save app
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
