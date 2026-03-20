import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApps } from '../hooks/useApps';
import AppCard from '../components/AppCard';

export default function Apps() {
  const { apps, loading, error } = useApps();

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-[#0f172a]">Your apps</h1>
        <Link
          to="/apps/new"
          className="flex items-center gap-2 bg-[#f97316] hover:bg-orange-600
                     text-white font-semibold px-4 py-2 rounded text-sm transition-colors"
        >
          <Plus size={15} />
          Add app
        </Link>
      </div>

      {/* States */}
      {loading && (
        <div className="text-[#64748b] text-sm">Loading…</div>
      )}

      {error && (
        <div className="text-[#ef4444] text-sm">{error}</div>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#64748b] text-sm mb-4">No apps yet.</p>
          <Link
            to="/apps/new"
            className="inline-flex items-center gap-2 bg-[#f97316] hover:bg-orange-600
                       text-white font-semibold px-5 py-2.5 rounded text-sm transition-colors"
          >
            <Plus size={15} />
            Add your first app →
          </Link>
        </div>
      )}

      {!loading && apps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
