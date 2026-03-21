
import Anthropic from '@anthropic-ai/sdk';

// Called from the client during app onboarding.
// Sends problem_statement + target_user to Claude, returns 8-12 search keywords.

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { problem_statement: string; target_user: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { problem_statement, target_user } = body;
  if (!problem_statement || !target_user) {
    return Response.json({ error: 'problem_statement and target_user are required' }, { status: 400 });
  }

  const prompt = `You are helping an app developer identify what search keywords would reveal people who need their app.

App description: "${problem_statement}"
Target user: "${target_user}"

Extract 8-12 specific search keywords or short phrases that represent the exact pain signal someone would post in a forum or community BEFORE discovering this app. These should be the words they'd use when describing their frustration, not the solution.

Focus on: complaints, "how do I", "is there a way to", "anyone else struggling with" type language in their specific domain.

Return ONLY a JSON array of strings. No explanation, no markdown, no backticks.
Example: ["cant get my app noticed", "indie developer no users", "how to market app without social media"]`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return Response.json({ error: 'Unexpected response type from Claude' }, { status: 500 });
    }

    let keywords: string[];
    try {
      keywords = JSON.parse(content.text);
      if (!Array.isArray(keywords)) throw new Error('Not an array');
    } catch {
      // Fallback: chunk problem_statement into 3-4 word phrases
      keywords = fallbackKeywords(problem_statement);
    }

    return Response.json({ keywords });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

function fallbackKeywords(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 3);
  const phrases: string[] = [];
  for (let i = 0; i < words.length && phrases.length < 4; i += 3) {
    phrases.push(words.slice(i, i + 3).join(' '));
  }
  return phrases;
}
