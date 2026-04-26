create table if not exists public.sinais_handicap_prelive (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  fixture_id  text not null,
  home_team   text not null,
  away_team   text not null,
  league_id   int,
  league_name text,
  match_date  timestamptz,
  favorito    text,
  underdog    text,
  fav_odd     numeric,
  und_odd     numeric,
  linha       text not null,
  ha_type     text,
  score_ha    numeric,
  status_ha   text check (status_ha in ('SINAL_FORTE','SINAL_BOM','CUIDADO','DESCARTADO')),
  odd_ha      numeric,
  liquidacao  text,
  indicadores jsonb,
  ai_analysis text,
  resultado_ha     text check (resultado_ha in ('GREEN','REEMBOLSO','MEIO_GREEN','MEIO_RED','RED','VOID')),
  gols_fav         int,
  gols_und         int,
  diferenca_gols   int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(fixture_id, linha)
);

create index if not exists idx_ha_date    on public.sinais_handicap_prelive(match_date);
create index if not exists idx_ha_status  on public.sinais_handicap_prelive(status_ha);
create index if not exists idx_ha_user    on public.sinais_handicap_prelive(user_id);

alter table public.sinais_handicap_prelive enable row level security;

create policy "Authenticated read HA signals"
  on public.sinais_handicap_prelive for select
  to authenticated
  using (true);

create policy "Service role manages HA signals"
  on public.sinais_handicap_prelive for all
  to service_role
  using (true) with check (true);

create trigger trg_ha_updated_at
  before update on public.sinais_handicap_prelive
  for each row execute function public.update_updated_at_column();