import { useState } from 'react';
import { ExternalLink, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SignalMatch } from '../types';

const SOURCE_LABELS: Record<SignalMatch['source'], string> = {
  reddit: 'Reddit',
  hn: 'Hacker News',
  indiehackers: 'Indie Hackers',
};

const SOURCE_COLORS: Record<SignalMatch['source'], string> = {
  reddit: 'bg-orange-100 text-orange-700',
  hn: 'bg-amber-100 text-amber-700',
  indiehackers: 'bg-blue-100 text-blue-700',
};

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Strong match', color: 'text-green-700' };
  if (score >= 65) return { label: 'Good match', color: 'text-[#f97316]' };
  return { label: 'Potential match', color: 'text-[#64748b]' };
}

interface MatchCardProps {
  match: SignalMatch;
  onActedOn?: () => void;
}

export default function MatchCard({ match, onActedOn }: MatchCardProps) {
  const [actedOn, setActedOn] = useState(match.acted_on);
  const [toggling, setToggling] = useState(false);

  const score = match.match_score ?? 0;
  const { label, color } = scoreLabel(score);

  const handleToggleActedOn = async () => {
    if (toggling) return;
    setToggling(true);
    const newValue = !actedOn;
    setActedOn(newValue);

    await supabase
      .from('signal_matches')
      .update({ acted_on: newValue })
      .eq('id', match.id);

    setToggling(false);
    if (newValue && onActedOn) onActedOn();
  };

  return (
    <div className={`bg-white border border-[#e2e8f0] rounded p-5 transition-opacity ${actedOn ? 'opacity-60' : ''}`}>
      {/* Source + score row */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide
                      ${SOURCE_COLORS[match.source]}`}
        >
          {SOURCE_LABELS[match.source]}
        </span>
        <span className={`text-xs font-semibold ${color}`}>
          {label} · {score}/100
        </span>
      </div>

      {/* Title */}
      <a
        href={match.post_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-1.5 group mb-2"
      >
        <h3 className="text-[#0f172a] font-bold text-sm leading-snug group-hover:text-[#f97316] transition-colors">
          {match.post_title ?? 'Untitled post'}
        </h3>
        <ExternalLink size={12} className="shrink-0 mt-0.5 text-[#64748b] group-hover:text-[#f97316] transition-colors" />
      </a>

      {/* Snippet */}
      {match.post_snippet && (
        <p className="text-[#64748b] text-xs leading-relaxed mb-3 line-clamp-3">
          {match.post_snippet}
        </p>
      )}

      {/* Response angle — the money */}
      {match.response_angle && (
        <div className="bg-orange-50 border-l-2 border-[#f97316] px-3 py-2.5 rounded-r mb-3">
          <p className="text-xs font-semibold text-[#0f172a] mb-0.5">Suggested angle</p>
          <p className="text-xs text-orange-900 leading-relaxed italic">
            "{match.response_angle}"
          </p>
        </div>
      )}

      {/* Mark as used */}
      <button
        onClick={handleToggleActedOn}
        disabled={toggling}
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
          actedOn
            ? 'text-green-600 hover:text-[#64748b]'
            : 'text-[#64748b] hover:text-[#0f172a]'
        }`}
      >
        <Check size={13} className={actedOn ? 'text-green-600' : 'text-[#94a3b8]'} />
        {actedOn ? 'Marked as used' : 'Mark as used'}
      </button>
    </div>
  );
}
