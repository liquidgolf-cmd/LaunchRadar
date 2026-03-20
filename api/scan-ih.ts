import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';

// Scans Indie Hackers via public RSS feed. No auth required.

const SEVEN_DAYS_AGO_MS = () => Date.now() - 7 * 24 * 60 * 60 * 1000;

interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

interface ParsedFeed {
  rss: {
    channel: {
      item: RSSItem | RSSItem[];
    };
  };
}

async function fetchIHFeed(): Promise<RSSItem[]> {
  const res = await fetch('https://www.indiehackers.com/feed', {
    headers: { 'User-Agent': 'LaunchRadar/1.0' },
  });
  if (!res.ok) throw new Error(`IH feed fetch failed: ${res.status}`);

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as ParsedFeed;

  const items = parsed.rss.channel.item;
  // fast-xml-parser returns a single object if there's only one item
  return Array.isArray(items) ? items : [items];
}

export async function scanIH(appId: string): Promise<number> {
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

  const items = await fetchIHFeed();
  const sevenDaysAgoMs = SEVEN_DAYS_AGO_MS();

  // Filter to last 7 days and keyword matches
  const seen = new Set<string>();
  const posts: { url: string; title: string; snippet: string }[] = [];

  for (const item of items) {
    const pubDate = new Date(item.pubDate).getTime();
    if (pubDate < sevenDaysAgoMs) continue;

    const titleLower = (item.title ?? '').toLowerCase();
    const descLower = (item.description ?? '').toLowerCase();
    const matched = keywords.some(
      (kw) => titleLower.includes(kw.toLowerCase()) || descLower.includes(kw.toLowerCase())
    );

    if (!matched) continue;
    if (seen.has(item.link)) continue;
    seen.add(item.link);

    // Strip HTML tags from description for the snippet
    const snippet = (item.description ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    posts.push({ url: item.link, title: item.title, snippet });
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
      source: 'indiehackers',
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
    const count = await scanIH(body.app_id);
    return Response.json({ inserted: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
