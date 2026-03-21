
import { scanReddit } from './scan-reddit';
import { scanHN } from './scan-hn';
import { scanIH } from './scan-ih';
import { scoreMatches } from './score-matches';

// Manual scan trigger for testing a single app.
// POST /api/scan  { app_id: string }
// Runs all three scanners + scoring, returns counts.

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: { app_id: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.app_id) {
    return Response.json({ error: 'app_id is required' }, { status: 400 });
  }

  const { app_id } = body;

  try {
    const [reddit, hn, ih] = await Promise.all([
      scanReddit(app_id),
      scanHN(app_id),
      scanIH(app_id),
    ]);

    const scored = await scoreMatches(app_id);

    return Response.json({
      inserted: { reddit, hn, indiehackers: ih, total: reddit + hn + ih },
      scored,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
