
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { scanReddit } from './scan-reddit';
import { scanHN } from './scan-hn';
import { scanIH } from './scan-ih';
import { scoreMatches } from './score-matches';

// Cron target — runs every Monday at 8am UTC.
// Also callable manually with ?test=true to skip email delivery.

const DIGEST_SCORE_THRESHOLD = 65;
const DIGEST_MAX_MATCHES = 10;

interface AppRow {
  id: string;
  name: string;
  user_id: string;
}

interface MatchRow {
  id: string;
  source: 'reddit' | 'hn' | 'indiehackers';
  post_url: string;
  post_title: string | null;
  post_snippet: string | null;
  match_score: number;
  response_angle: string | null;
}

function sourceLabel(source: string): string {
  if (source === 'reddit') return 'Reddit';
  if (source === 'hn') return 'Hacker News';
  if (source === 'indiehackers') return 'Indie Hackers';
  return source;
}

function scoreBadge(score: number): string {
  if (score >= 80) return 'Strong match';
  if (score >= 65) return 'Good match';
  return 'Potential match';
}

function buildEmailHtml(appName: string, appId: string, matches: MatchRow[]): string {
  const appUrl = process.env.VITE_APP_URL ?? 'https://launchradar.app';

  const matchRows = matches
    .map(
      (m) => `
    <tr>
      <td style="padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px;">
          <span style="background: #0f172a; color: #f97316; font-size: 11px; font-weight: 700;
                       letter-spacing: 1px; padding: 3px 8px; border-radius: 3px; text-transform: uppercase;">
            ${sourceLabel(m.source)}
          </span>
        </p>
        <p style="margin: 0 0 8px;">
          <a href="${m.post_url}" style="color: #0f172a; font-size: 16px; font-weight: 700;
                                          text-decoration: none;">
            ${m.post_title ?? 'Untitled post'}
          </a>
        </p>
        ${
          m.post_snippet
            ? `<p style="margin: 0 0 12px; color: #64748b; font-size: 14px; line-height: 1.6;">
            ${m.post_snippet}
          </p>`
            : ''
        }
        <p style="margin: 0 0 12px; color: #64748b; font-size: 13px;">
          <strong style="color: #0f172a;">${scoreBadge(m.match_score)}</strong>
          &nbsp;·&nbsp; Score: ${m.match_score}/100
        </p>
        ${
          m.response_angle
            ? `<div style="background: #fff7ed; border-left: 3px solid #f97316; padding: 12px 16px; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; color: #7c2d12; font-size: 14px; font-style: italic;">
              "${m.response_angle}"
            </p>
          </div>`
            : ''
        }
      </td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, 'Inter', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: #0f172a; padding: 24px 32px; border-radius: 4px 4px 0 0;">
              <p style="margin: 0; color: #f97316; font-size: 12px; font-weight: 700;
                         letter-spacing: 2px; text-transform: uppercase;">LaunchRadar</p>
              <h1 style="margin: 8px 0 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                ${matches.length} conversation${matches.length !== 1 ? 's' : ''} found for ${appName}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background: #ffffff; padding: 32px; border-radius: 0 0 4px 4px;">
              <p style="margin: 0 0 24px; color: #64748b; font-size: 15px;">
                Here are this week's best conversations where <strong style="color: #0f172a;">${appName}</strong>
                could help someone.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${matchRows}
              </table>

              <!-- Footer links -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
                      <a href="${appUrl}/apps/${appId}" style="color: #f97316; text-decoration: none;">
                        View your full dashboard →
                      </a>
                    </p>
                    <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
                      <a href="${appUrl}/apps" style="color: #64748b; text-decoration: none;">
                        Manage your apps
                      </a>
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                      <a href="${appUrl}/unsubscribe" style="color: #64748b; text-decoration: none;">
                        Unsubscribe
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const testMode = url.searchParams.get('test') === 'true';

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'digest@launchradar.app';

  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Supabase env vars not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch all active apps
  const { data: apps, error: appsError } = await supabase
    .from('apps')
    .select('id, name, user_id')
    .eq('active', true);

  if (appsError) {
    return Response.json({ error: appsError.message }, { status: 500 });
  }

  let appsProcessed = 0;
  let digestsSent = 0;

  for (const app of (apps ?? []) as AppRow[]) {
    try {
      // Run all scanners
      await scanReddit(app.id);
      await scanHN(app.id);
      await scanIH(app.id);

      // Score unscored matches
      await scoreMatches(app.id);

      // Pull top matches for digest
      const { data: matches, error: matchError } = await supabase
        .from('signal_matches')
        .select('id, source, post_url, post_title, post_snippet, match_score, response_angle')
        .eq('app_id', app.id)
        .eq('included_in_digest', false)
        .gte('match_score', DIGEST_SCORE_THRESHOLD)
        .order('match_score', { ascending: false })
        .limit(DIGEST_MAX_MATCHES);

      if (matchError) throw new Error(matchError.message);
      if (!matches || matches.length === 0) {
        appsProcessed++;
        continue;
      }

      // Create digest record
      const { data: digest, error: digestError } = await supabase
        .from('digests')
        .insert({ app_id: app.id, match_count: matches.length })
        .select('id')
        .single();

      if (digestError || !digest) throw new Error(digestError?.message ?? 'Digest insert failed');

      // Mark matches as included
      const matchIds = matches.map((m: { id: string }) => m.id);
      await supabase
        .from('signal_matches')
        .update({ included_in_digest: true })
        .in('id', matchIds);

      if (!testMode && resendKey) {
        // Fetch user email via service key auth.users lookup
        const { data: userData } = await supabase.auth.admin.getUserById(app.user_id);
        const email = userData?.user?.email;

        if (email) {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: `Your LaunchRadar digest — ${matches.length} conversations found for ${app.name}`,
            html: buildEmailHtml(app.name, app.id, matches as MatchRow[]),
          });

          await supabase
            .from('digests')
            .update({ sent_at: new Date().toISOString(), email_delivered: true })
            .eq('id', digest.id);

          digestsSent++;
        }
      } else if (testMode) {
        // In test mode, mark as sent without emailing
        await supabase
          .from('digests')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', digest.id);
        digestsSent++;
      }

      appsProcessed++;
    } catch (err) {
      // Log per-app errors but continue processing other apps
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Digest error for app ${app.id}: ${message}`);
      appsProcessed++;
    }
  }

  return Response.json({
    apps_processed: appsProcessed,
    digests_sent: digestsSent,
    test_mode: testMode,
  });
}
