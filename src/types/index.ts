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
