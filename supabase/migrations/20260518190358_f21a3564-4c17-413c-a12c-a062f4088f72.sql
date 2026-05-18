CREATE TABLE IF NOT EXISTS public.seo_news_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'post-match',
  league TEXT,
  league_slug TEXT,
  fixture_id BIGINT,
  home_team TEXT,
  away_team TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  content_html TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  hero_image TEXT,
  storage_path TEXT,
  public_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_news_posts_league ON public.seo_news_posts(league_slug, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_news_posts_published ON public.seo_news_posts(published_at DESC);

ALTER TABLE public.seo_news_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read news posts"
  ON public.seo_news_posts FOR SELECT
  USING (true);
