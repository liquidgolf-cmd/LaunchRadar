import { createClient } from '@supabase/supabase-js';

// Scans Hacker News Ask HN posts via Algolia API (no auth required).

const SEVEN_DAYS_AGO = () => Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

interface HNHit {
  objectID: string;
  title: string;
  story_text: string | null;
  created_at_i: number;
}

interface AlgoliaResponse {
  hits: HNHit[];
}

async function searchHN(keyword: string): Promise<HNHit[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=ask_hn&hitsPerPage=20`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as AlgoliaResponse;
  return data.hits;
}

export async function scanHN(appId: string): Promise<number> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase env vars not configured');
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: app, error } = await supabase
    .from('apps')
    .select('id, keywords')
    .eq('id', appId)
    .single();

  if (error || !app) throw new Error(`App not found: ${appId}`);

  const keywords: string[] = app.keywords;
  if (keywords.length === 0) return 0;

  const sevenDaysAgo = SEVEN_DAYS_AGO();
  const seen = new Set<string>();
  const posts: { url: string; title: string; snippet: string }[] = [];

  for (const keyword of keywords) {
    const hits = await searchHN(keyword);

    for (const hit of hits) {
      if (hit.created_at_i < sevenDaysAgo) continue;

      const url = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      if (seen.has(url)) continue;
      seen.add(url);

      posts.push({
        url,
        title: hit.title,
        snippet: (hit.story_text ?? '').slice(0, 500),
      });
    }
  }

  if (posts.length === 0) return 0;

  const { data: existing } = await supabase
    .from('signal_matches')
    .select('post_url')
    .eq('app_id', appId)
    .in('post_url', posts.map((p) => p.url));

  const existingUrls = new Set((existing ?? []).map((r: { post_url: string }) => r.post_url));
  const newPosts = posts.filter((p) => !existingUrls.has(p.url));

  if (newPosts.length === 0) return 0;

  const { error: insertError } = await supabase.from('signal_matches').insert(
    newPosts.map((p) => ({
      app_id: appId,
      source: 'hn',
      post_url: p.url,
      post_title: p.title,
      post_snippet: p.snippet || null,
    }))
  );

  if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

  return newPosts.length;
}

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

  try {
    const count = await scanHN(body.app_id);
    return Response.json({ inserted: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
