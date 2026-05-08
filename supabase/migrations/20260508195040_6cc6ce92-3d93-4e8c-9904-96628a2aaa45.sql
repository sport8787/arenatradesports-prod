create table if not exists public.cashout_telegram_alerts (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null,
  signal_type text not null,
  match_name text,
  market text,
  placar text,
  minuto integer,
  entry_odd numeric,
  current_odd numeric,
  cashout_value numeric,
  motivo text,
  dedupe_key text not null unique,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_cashout_tg_bet on public.cashout_telegram_alerts(bet_id, created_at desc);

alter table public.cashout_telegram_alerts enable row level security;

create policy "service role only - select" on public.cashout_telegram_alerts for select using (false);
create policy "service role only - insert" on public.cashout_telegram_alerts for insert with check (false);