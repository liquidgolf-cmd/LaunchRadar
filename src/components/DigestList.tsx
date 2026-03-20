import type { Digest } from '../types';

interface DigestListProps {
  digests: Digest[];
}

export default function DigestList({ digests }: DigestListProps) {
  if (digests.length === 0) {
    return (
      <p className="text-[#64748b] text-sm py-6">
        No digests sent yet. Your first digest will go out Monday morning.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {digests.map((digest) => {
        const date = new Date(digest.created_at).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        return (
          <div
            key={digest.id}
            className="flex items-center justify-between py-3 border-b border-[#e2e8f0] last:border-0"
          >
            <div>
              <p className="text-sm font-semibold text-[#0f172a]">{date}</p>
              <p className="text-xs text-[#64748b] mt-0.5">
                {digest.match_count} match{digest.match_count !== 1 ? 'es' : ''}
                {digest.email_delivered && (
                  <span className="ml-2 text-green-600">· Email sent</span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
