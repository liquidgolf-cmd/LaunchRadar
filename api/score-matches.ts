import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Scores unscored signal_matches for an app using Claude.
// Batches in groups of 5. Deletes matches below score threshold (< 40).

const SCORE_THRESHOLD = 40;
const BATCH_SIZE = 5;

interface MatchRow {
  id: string;
  post_title: string | null;
  post_snippet: string | null;
  source: string;
}

interface ScoreResult {
  score: number;
  response_angle: string | null;
}

async function scoreBatch(
  client: Anthropic,
  app: { problem_statement: string; target_user: string },
  batch: MatchRow[]
): Promise<ScoreResult[]> {
  const prompt = `App problem: "${app.problem_statement}"
Target user: "${app.target_user}"

Rate each of the following forum posts on how well it represents a potential user
actively describing the exact problem this app solves. Someone reading this post
would benefit from knowing this app exists.

Score 0-100 where:
- 0-30: Not relevant, different problem space
- 31-60: Tangentially related but probably not the right person
- 61-80: Relevant, this person likely has the problem
- 81-100: High signal — this person is clearly describing the exact problem

For any post scoring above 60, write a 1-sentence response angle:
a natural, helpful reply that mentions the app without being a pitch.
The response should feel like advice from someone who's been there, not marketing copy.

Posts to score:
${batch
  .map(
    (p, i) => `
[${i + 1}] Title: ${p.post_title ?? '(no title)'}
Snippet: ${p.post_snippet ?? '(no snippet)'}
Source: ${p.source}
`
  )
  .join('\n')}

Return ONLY a JSON array with one object per post in order:
[{"score": 75, "response_angle": "..."}, {"score": 20, "response_angle": null}, ...]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected Claude response type');

  const results = JSON.parse(content.text) as ScoreResult[];
  if (!Array.isArray(results) || results.length !== batch.length) {
    throw new Error('Claude returned unexpected result count');
  }

  return results;
}

export async function scoreMatches(appId: string): Promise<number> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !serviceKey) throw new Error('Supabase env vars not configured');
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: app, error: appError } = await supabase
    .from('apps')
    .select('id, problem_statement, target_user')
    .eq('id', appId)
    .single();

  if (appError || !app) throw new Error(`App not found: ${appId}`);

  const { data: matches, error: matchError } = await supabase
    .from('signal_matches')
    .select('id, post_title, post_snippet, source')
    .eq('app_id', appId)
    .is('match_score', null);

  if (matchError) throw new Error(`Fetch matches failed: ${matchError.message}`);
  if (!matches || matches.length === 0) return 0;

  const client = new Anthropic({ apiKey: anthropicKey });
  let scored = 0;
  const toDelete: string[] = [];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE) as MatchRow[];

    let results: ScoreResult[];
    try {
      results = await scoreBatch(client, app, batch);
    } catch {
      // Skip this batch on parse/API error rather than failing the whole job
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const match = batch[j];
      const result = results[j];

      if (result.score < SCORE_THRESHOLD) {
        toDelete.push(match.id);
      } else {
        await supabase
          .from('signal_matches')
          .update({
            match_score: result.score,
            response_angle: result.response_angle ?? null,
          })
          .eq('id', match.id);
        scored++;
      }
    }
  }

  // Bulk delete low-score noise
  if (toDelete.length > 0) {
    await supabase.from('signal_matches').delete().in('id', toDelete);
  }

  return scored;
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
    const count = await scoreMatches(body.app_id);
    return Response.json({ scored: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
