
import { createClient } from '@supabase/supabase-js';

// TODO: Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to env vars when available.
// Until then, the scanner will return early with 0 matches.

const SEVEN_DAYS_AGO = () => Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

interface RedditPost {
  data: {
    url: string;
    title: string;
    selftext: string;
    created_utc: number;
    score: number;
    permalink: string;
  };
}

interface RedditSearchResponse {
  data: {
    children: RedditPost[];
  };
}

// Fetch a Reddit app-only OAuth token (client credentials flow).
// Valid for 1 hour — in serverless, we just fetch a fresh one per invocation.
async function getRedditToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Reddit OAuth credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.REDDIT_USER_AGENT ?? 'LaunchRadar/1.0',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Reddit OAuth failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function searchReddit(keyword: string, token: string): Promise<RedditPost[]> {
  const userAgent = process.env.REDDIT_USER_AGENT ?? 'LaunchRadar/1.0';
  const url = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=25&t=week`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent,
    },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as RedditSearchResponse;
  return data.data.children;
}

export async function scanReddit(appId: string): Promise<number> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase env vars not configured');
  }

  // Check Reddit credentials before doing any work
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    // TODO: Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to Vercel env vars
    return 0;
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

  const token = await getRedditToken();
  const sevenDaysAgo = SEVEN_DAYS_AGO();

  // Collect all posts across keywords, deduplicate by URL
  const seen = new Set<string>();
  const posts: { url: string; title: string; snippet: string }[] = [];

  for (const keyword of keywords) {
    const results = await searchReddit(keyword, token);

    for (const { data: post } of results) {
      if (seen.has(post.url)) continue;
      if (post.created_utc < sevenDaysAgo) continue;
      if (post.score < 1) continue;

      seen.add(post.url);
      posts.push({
        url: `https://www.reddit.com${post.permalink}`,
        title: post.title,
        snippet: post.selftext.slice(0, 500),
      });
    }
  }

  if (posts.length === 0) return 0;

  // Check which URLs already exist for this app
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
      source: 'reddit',
      post_url: p.url,
      post_title: p.title,
      post_snippet: p.snippet || null,
      // match_score left null — scoring happens in score-matches
    }))
  );

  if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

  return newPosts.length;
}

// Vercel handler — internal use only (not called by clients)
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
    const count = await scanReddit(body.app_id);
    return Response.json({ inserted: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
