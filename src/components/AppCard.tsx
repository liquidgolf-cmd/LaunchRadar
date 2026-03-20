import { Link } from 'react-router-dom';
import { ExternalLink, ArrowRight, Tag } from 'lucide-react';
import type { App } from '../types';

interface AppCardProps {
  app: App;
  matchCount?: number;
}

export default function AppCard({ app, matchCount }: AppCardProps) {
  const lastUpdated = new Date(app.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white border border-[#e2e8f0] rounded p-5 hover:border-[#cbd5e1] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-[#0f172a] text-base leading-tight truncate">{app.name}</h3>
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#f97316] mt-0.5 transition-colors"
            >
              <ExternalLink size={11} />
              {app.url.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
        <span
          className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded ${
            app.active
              ? 'bg-green-50 text-green-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {app.active ? 'Active' : 'Paused'}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[#64748b] mb-4">
        <span className="flex items-center gap-1">
          <Tag size={11} />
          {app.keywords.length} keywords
        </span>
        {matchCount !== undefined && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
            {matchCount} new match{matchCount !== 1 ? 'es' : ''} this week
          </span>
        )}
        <span>Updated {lastUpdated}</span>
      </div>

      {/* Action */}
      <Link
        to={`/apps/${app.id}`}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#f97316] hover:text-orange-600 transition-colors"
      >
        View matches
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
