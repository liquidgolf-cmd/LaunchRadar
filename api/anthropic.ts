import Anthropic from '@anthropic-ai/sdk';

// General-purpose Claude proxy for client-side requests.
// Only used for calls that originate from the browser (e.g. keyword extraction preview).
// Server-to-server calls (scoring, digest) use the SDK directly.

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { prompt: string; system?: string; max_tokens?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: body.max_tokens ?? 1024,
      ...(body.system && { system: body.system }),
      messages: [{ role: 'user', content: body.prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return Response.json({ error: 'Unexpected response type from Claude' }, { status: 500 });
    }

    return Response.json({ content: content.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
