# LaunchRadar — Claude Code Master Prompt

## Who You Are Working With

You are building an app for **Mike Hill**, founder of Loam Strategy. Mike has 20+ years in marketing, design, and business strategy. He builds fast, ships functional MVPs, and has strong opinions about design quality. He is the first user of this product.

**How to communicate with Mike:**
- Direct and confident. Skip filler.
- Give context on key technical decisions — why, not just what.
- Flag scope creep immediately.
- Ask before assuming on anything ambiguous.

---

## What You Are Building

**LaunchRadar** — a weekly signal intelligence tool for indie app developers.

**The core problem:** Indie developers ship good apps that nobody finds. Not because the apps are bad — because the developers don't know where the people with their problem are having conversations right now.

**The core solution:** Developer registers an app + describes the problem it solves. LaunchRadar monitors Reddit, Hacker News, and Indie Hackers for conversations where real people are describing that exact problem. Every Monday, it delivers a digest: "Here are 5–10 live conversations where your app is the answer. Here's how to show up in each."

**This is not:**
- A directory submission tool
- A social media scheduler
- A content generator
- A one-time launch amplifier

**This is:** Ongoing, automated, problem-signal intelligence delivered as a weekly digest.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Language | TypeScript | Mike's default |
| Framework | React + Vite | Mike's default |
| Styling | Tailwind CSS | Mike's default — no custom CSS |
| Routing | react-router-dom | Mike's default |
| Backend | Supabase (Postgres) | Relational data model — apps, digests, matches need SQL joins |
| Auth | Supabase Auth | Email + password only for MVP |
| Hosting | Vercel | Mike's default |
| Serverless | Vercel `/api` functions | API proxies, cron job |
| AI | Claude API (claude-sonnet-4-20250514) | Keyword extraction + match scoring + response angles |
| Email | Resend | Transactional digest delivery |
| Cron | Vercel Cron | Weekly scan trigger |

**Never expose API keys to the client.** All external API calls proxy through `/api` serverless functions.

---

## Database Schema

Build this schema in Supabase exactly as specified. Do not add tables or columns not listed here.

```sql
-- Users are managed by Supabase Auth (auth.users)
-- No custom users table needed for MVP

-- Apps a developer has registered
create table apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  url text,
  problem_statement text not null,
  target_user text not null,
  keywords text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row-level security: users can only see their own apps
alter table apps enable row level security;
create policy "Users can manage their own apps"
  on apps for all
  using (auth.uid() = user_id);

-- Raw matched conversations from signal sources
create table signal_matches (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references apps not null,
  source text not null check (source in ('reddit', 'hn', 'indiehackers')),
  post_url text not null,
  post_title text,
  post_snippet text,
  match_score int check (match_score between 0 and 100),
  response_angle text,
  matched_at timestamptz not null default now(),
  included_in_digest boolean not null default false,
  acted_on boolean not null default false
);

-- RLS: matches accessible through app ownership
alter table signal_matches enable row level security;
create policy "Users can see matches for their apps"
  on signal_matches for all
  using (
    app_id in (
      select id from apps where user_id = auth.uid()
    )
  );

-- Weekly digest records
create table digests (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references apps not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  match_count int not null default 0,
  email_delivered boolean not null default false
);

-- RLS: digests accessible through app ownership
alter table digests enable row level security;
create policy "Users can see their own digests"
  on digests for all
  using (
    app_id in (
      select id from apps where user_id = auth.uid()
    )
  );
```

---

## Project Structure

```
launchradar/
├── src/
│   ├── components/
│   │   ├── AppCard.tsx
│   │   ├── MatchCard.tsx
│   │   ├── DigestList.tsx
│   │   ├── KeywordEditor.tsx
│   │   └── Layout.tsx
│   ├── pages/
│   │   ├── Landing.tsx          # Public landing page
│   │   ├── Login.tsx            # Auth page
│   │   ├── Dashboard.tsx        # Main digest view (all apps summary)
│   │   ├── Apps.tsx             # App list + add new
│   │   ├── AppDetail.tsx        # Single app matches + digest history
│   │   └── Onboarding.tsx       # New app intake form
│   ├── contexts/
│   │   └── UserContext.tsx
│   ├── hooks/
│   │   ├── useApps.ts
│   │   └── useMatches.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── constants.ts
│   └── types/
│       └── index.ts
├── api/
│   ├── anthropic.ts             # Claude API proxy
│   ├── extract-keywords.ts      # Extract keywords from app description
│   ├── scan.ts                  # Manual scan trigger (for testing)
│   ├── scan-reddit.ts           # Reddit signal scanner
│   ├── scan-hn.ts               # Hacker News signal scanner
│   ├── scan-ih.ts               # Indie Hackers signal scanner
│   ├── score-matches.ts         # Claude match scoring + response angles
│   └── digest.ts                # Generate digest + send email (cron target)
├── public/
├── index.html
├── vercel.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## TypeScript Types

Define these in `src/types/index.ts`:

```typescript
export interface App {
  id: string;
  user_id: string;
  name: string;
  url?: string;
  problem_statement: string;
  target_user: string;
  keywords: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SignalMatch {
  id: string;
  app_id: string;
  source: 'reddit' | 'hn' | 'indiehackers';
  post_url: string;
  post_title?: string;
  post_snippet?: string;
  match_score?: number;
  response_angle?: string;
  matched_at: string;
  included_in_digest: boolean;
  acted_on: boolean;
}

export interface Digest {
  id: string;
  app_id: string;
  created_at: string;
  sent_at?: string;
  match_count: number;
  email_delivered: boolean;
}
```

---

## API Functions — Detailed Specifications

### `/api/extract-keywords.ts`

Called when a new app is saved. Sends problem_statement + target_user to Claude and returns 8–12 keywords.

**Input:** `{ problem_statement: string, target_user: string }`

**Claude prompt:**
```
You are helping an app developer identify what search keywords would reveal people who need their app.

App description: "${problem_statement}"
Target user: "${target_user}"

Extract 8-12 specific search keywords or short phrases that represent the exact pain signal someone would post in a forum or community BEFORE discovering this app. These should be the words they'd use when describing their frustration, not the solution.

Focus on: complaints, "how do I", "is there a way to", "anyone else struggling with" type language in their specific domain.

Return ONLY a JSON array of strings. No explanation, no markdown, no backticks.
Example: ["cant get my app noticed", "indie developer no users", "how to market app without social media"]
```

**Error handling:** If Claude returns invalid JSON, fall back to splitting the problem_statement into 3-4 word chunks as a safety net.

---

### `/api/scan-reddit.ts`

Scans Reddit for conversations matching an app's keywords.

**Input:** `{ app_id: string }` (service-key authenticated — not callable by clients)

**Logic:**
1. Fetch app + keywords from Supabase using service key
2. For each keyword, call Reddit API:
   ```
   GET https://www.reddit.com/search.json?q={encodeURIComponent(keyword)}&sort=new&limit=25&t=week
   ```
   Include header: `User-Agent: LaunchRadar/1.0 (by /u/YOUR_USERNAME)`
3. Deduplicate results by `post.data.url`
4. Filter: `created_utc` within last 7 days, `score >= 1`
5. For each unique post, check if URL already exists in `signal_matches` for this app
6. Insert new matches with `match_score = null` (scoring happens separately)
7. Return count of new matches inserted

**Reddit API auth:** Use app-only OAuth (client credentials flow). No user login required.
```
POST https://www.reddit.com/api/v1/access_token
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
Body: grant_type=client_credentials
```
Cache the token — it's valid for 1 hour.

---

### `/api/scan-hn.ts`

Scans Hacker News Ask HN posts using Algolia API (no auth required).

**Input:** `{ app_id: string }`

**Logic:**
1. Fetch app + keywords from Supabase
2. For each keyword:
   ```
   GET https://hn.algolia.com/api/v1/search?query={keyword}&tags=ask_hn&hitsPerPage=20
   ```
3. Filter: `created_at_i` within last 7 days
4. Map `objectID` to URL: `https://news.ycombinator.com/item?id={objectID}`
5. Deduplicate by URL, check existing matches
6. Insert new unscored matches

---

### `/api/scan-ih.ts`

Scans Indie Hackers via their public RSS feed.

**Input:** `{ app_id: string }`

**Logic:**
1. Fetch app + keywords from Supabase
2. Fetch RSS: `https://www.indiehackers.com/feed`
3. Parse XML — each `<item>` has `<title>`, `<description>`, `<link>`, `<pubDate>`
4. Filter items from last 7 days
5. For each item, check if any keyword appears in title or description (case-insensitive)
6. Insert matches for keyword hits, deduplicate by URL

Use a simple XML parser — `fast-xml-parser` is fine.

---

### `/api/score-matches.ts`

Runs Claude scoring on unscored matches for an app.

**Input:** `{ app_id: string }`

**Logic:**
1. Fetch app + all `signal_matches` where `match_score IS NULL` for this app
2. Batch into groups of 5
3. For each batch, send to Claude:

```
App problem: "${problem_statement}"
Target user: "${target_user}"

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
${posts.map((p, i) => `
[${i + 1}] Title: ${p.post_title}
Snippet: ${p.post_snippet}
Source: ${p.source}
`).join('\n')}

Return ONLY a JSON array with one object per post in order:
[{"score": 75, "response_angle": "..."}, {"score": 20, "response_angle": null}, ...]
```

4. Update each match record with score + response_angle
5. Delete matches where `match_score < 40` (noise cleanup)

---

### `/api/digest.ts`

The cron target. Runs weekly to scan, score, and email.

**Logic (in order):**
1. Fetch all active apps from Supabase (service key)
2. For each app:
   a. Run Reddit scan
   b. Run HN scan
   c. Run IH scan
   d. Run match scoring
   e. Pull matches where `match_score >= 65` AND `included_in_digest = false`, ordered by score desc, limit 10
   f. If 0 matches, skip digest
   g. Create digest record
   h. Mark matches as `included_in_digest = true`
   i. Look up user email from `auth.users` using service key
   j. Send email via Resend
3. Return summary: `{ apps_processed: N, digests_sent: N }`

**Email template format** (HTML email via Resend):

Subject: `Your LaunchRadar digest — {N} conversations found for {App Name}`

Body structure:
```
[LaunchRadar header]

Here are this week's best conversations where {App Name} could help someone.

For each match:
  [SOURCE BADGE] reddit / hn / indiehackers
  [POST TITLE — linked]
  [POST SNIPPET — 2-3 sentences]
  [MATCH SCORE] Strong match / Good match / Potential match
  [RESPONSE ANGLE] "Suggested angle: ..."
  [SEPARATOR]

---
View your full dashboard: https://launchradar.app/apps/{app_id}
Manage your apps: https://launchradar.app/apps
Unsubscribe: https://launchradar.app/unsubscribe
```

---

### `vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ],
  "crons": [
    {
      "path": "/api/digest",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

---

## UI — Design Specifications

**Design philosophy:** Bold, professional, high-contrast. Dark sidebar, light content area. No purple/pink gradients. No generic AI aesthetics. Sharp corners (4px max radius). One accent color.

**Color palette:**
```
Sidebar background: #0f172a (deep navy)
Sidebar text: #e2e8f0
Content background: #f8fafc (near white)
Card background: #ffffff
Primary text: #0f172a
Secondary text: #64748b
Accent: #f97316 (orange — signals, radar, attention)
Border: #e2e8f0
Danger: #ef4444
```

**Typography:**
- Headlines: Inter or DM Sans, weight 700–900
- Body: Inter, weight 400–500
- Import via Google Fonts

---

## Pages — Detailed Specs

### Landing.tsx (public, unauthenticated)

**Purpose:** Explain what LaunchRadar does and get the developer to sign up.

**Sections:**
1. **Hero** — full-width dark background (#0f172a)
   - Headline: "Stop guessing where to show up."
   - Subheadline: "LaunchRadar monitors Reddit, Hacker News, and Indie Hackers for the conversations where your app is the answer — and delivers them to you every week."
   - CTA button (accent orange): "Get early access"
   - No image — clean text-only hero

2. **How it works** — 3-step horizontal layout
   - Step 1: "Describe your app" — you tell us what problem your app solves
   - Step 2: "We watch the internet" — LaunchRadar scans for people describing that problem
   - Step 3: "You show up with confidence" — weekly digest with exactly where to go and what to say

3. **Simple CTA section** — dark background, single sign up button

No pricing, no feature grids, no testimonials for MVP.

---

### Login.tsx

- Email + password only
- Toggle between sign in / sign up
- Supabase Auth
- On success: redirect to `/dashboard`

---

### Dashboard.tsx (authenticated)

**Purpose:** At-a-glance view of this week's activity across all apps.

**Layout:** Dark sidebar (nav) + light content area

**Sidebar nav items:**
- Dashboard (home icon)
- My Apps
- Settings (just links to Supabase profile for MVP)

**Content:**

If user has no apps: empty state with "Add your first app →" button

If user has apps:
- Page title: "This week's signals"
- For each app: a compact card showing app name, match count this week, last digest date, and a "View matches →" link
- Below: a flat list of the top 5 highest-scoring matches across all apps this week (quick wins the user can act on today)

---

### Apps.tsx

**Purpose:** Manage all registered apps.

**Content:**
- Page title: "Your apps"
- "+ Add app" button (accent orange, top right)
- Grid of AppCard components
- Each AppCard shows: name, URL (if set), keyword count, last scan date, active/inactive toggle

---

### Onboarding.tsx (new app intake)

**Purpose:** Collect the app description and extract keywords.

**This is the most important form in the product. Make it feel considered, not generic.**

**Steps (single page, no wizard):**

```
App name *
[text input]

App URL (optional)
[text input]

What problem does your app solve? *
Describe it from your user's perspective — what frustration were they living with before your app?
[textarea — 4 rows]

Who is this person? *
Describe the specific type of person who has this problem.
[textarea — 3 rows]

[Extract keywords →] button (accent orange)
```

After "Extract keywords" is clicked:
- Call `/api/extract-keywords`
- Show loading state: "Analyzing your description..."
- Display returned keywords as editable pill/tag chips
- User can remove chips or add their own
- "Save app" button appears below keywords

On save: redirect to `/apps/{id}`

---

### AppDetail.tsx

**Purpose:** The main working view for a single app. This is where value is delivered.

**Layout:**

Top section:
- App name (large, bold)
- URL (if set, linked)
- Edit / Delete actions (subtle, not prominent)
- "Scan now" button (for manual testing — only visible, not promoted)

Tab bar:
- **This week** (default)
- **Past digests**
- **Settings** (keywords editor)

**"This week" tab:**

If no matches: "No matches yet. Your first scan runs Monday morning." with a manual trigger button for testing.

If matches:
- Sorted by match_score descending
- Each MatchCard shows:
  - Source badge (REDDIT / HN / IH — colored pill)
  - Post title (linked, opens in new tab)
  - 2-3 sentence snippet
  - Match score (Strong 80+ / Good 65-79)
  - Response angle (in a visually distinct callout box — this is the money)
  - "Mark as used" toggle (updates `acted_on = true`)

**"Past digests" tab:**

Simple list: date, match count, "View" link that shows the matches from that digest.

**"Settings" tab:**

Keyword editor — shows current keywords as editable chips. Save button updates the app record.

---

## Environment Variables

Set all of these in Vercel dashboard before deploying:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=        # Server-side only — never expose to client

# Anthropic
ANTHROPIC_API_KEY=

# Reddit OAuth
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=LaunchRadar/1.0

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=digest@launchradar.app

# Public (VITE_ prefix — safe for client)
VITE_SUPABASE_URL=           # Same as SUPABASE_URL
VITE_SUPABASE_ANON_KEY=      # Same as SUPABASE_ANON_KEY
VITE_APP_URL=https://launchradar.app
```

---

## Build Order

Follow this order exactly. Do not touch the UI until the scanner returns real data.

**Phase 1: Foundation**
1. Project scaffold (Vite + React + TypeScript + Tailwind)
2. Supabase schema (run the SQL above)
3. `src/lib/supabase.ts` client setup
4. `src/types/index.ts`
5. `src/contexts/UserContext.tsx`
6. `vercel.json`
7. Deploy to Vercel — confirm it loads

**Phase 2: Data pipeline**
8. `/api/anthropic.ts` — Claude proxy
9. `/api/extract-keywords.ts` — test with a real app description
10. `/api/scan-reddit.ts` — test with a real keyword, confirm inserts to Supabase
11. `/api/scan-hn.ts` — same
12. `/api/scan-ih.ts` — same
13. `/api/score-matches.ts` — test with seeded matches, confirm scoring
14. `/api/digest.ts` — test end-to-end with `?test=true` param that skips email

**Phase 3: UI**
15. `Layout.tsx` (sidebar + content area shell)
16. `Login.tsx`
17. `Onboarding.tsx` + keyword extraction flow
18. `Apps.tsx` + `AppCard.tsx`
19. `AppDetail.tsx` + `MatchCard.tsx`
20. `Dashboard.tsx`
21. `Landing.tsx`

**Phase 4: Polish + ship**
22. Email template
23. Cron job test (manual trigger)
24. Mobile responsive pass
25. Empty states for all pages
26. Error handling and loading states throughout
27. Register Lucid as the first app and run a real scan

---

## Code Quality Rules

- TypeScript everywhere — no `any` types
- Every `try/catch` must handle the error — never empty
- No console.logs in production-bound code
- Components stay small and single-purpose
- Brief inline comments on non-obvious logic
- No features not listed in this document
- No libraries outside the specified stack without checking with Mike first

---

## Scope Watchdog

If you find yourself building any of the following, stop and flag it:

- Real-time match notifications (v2)
- Multi-user team accounts (v2)
- Paid plan / billing (v2)
- Social media channel scanning beyond Reddit/HN/IH (v2)
- Auto-posting or response drafting (explicitly out of scope)
- Analytics dashboard or match trend charts (v2)
- AI-generated demo or landing page for user's app (different product)

The MVP is one thing: register app → scan for matches → deliver weekly digest. Everything else is noise until that loop is proven.

---

## Start Here

Begin with Phase 1. Run this first:

```bash
npm create vite@latest launchradar -- --template react-ts
cd launchradar
npm install react-router-dom @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Then scaffold the project structure, set up Supabase, and deploy to Vercel before writing a single component. Confirm it loads at the Vercel URL before proceeding to Phase 2.
