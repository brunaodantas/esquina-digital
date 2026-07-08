-- Rodar manualmente no SQL Editor do Supabase (projeto usado pelo esquina-digital).
-- Tabela de notícias/clipagem por cliente, alimentada pelo cron /api/news-ingest.

create table if not exists client_news (
  id bigserial primary key,
  client_slug text not null,
  category text not null check (category in ('noticias', 'clipagem')),
  headline text not null,
  summary text,
  source text,
  source_url text not null unique,
  published_at timestamptz,
  matched_keyword text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_news_lookup
  on client_news (client_slug, category, published_at desc);
