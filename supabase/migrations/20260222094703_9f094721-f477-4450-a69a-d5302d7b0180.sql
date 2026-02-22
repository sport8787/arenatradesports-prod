
-- Tabela 1: Jogos ao vivo (alimentada pelo n8n)
create table if not exists live_matches (
  id uuid primary key default gen_random_uuid(),
  match_id text unique not null,
  championship text not null,
  home_team text not null,
  away_team text not null,
  home_logo text,
  away_logo text,
  score_home integer default 0,
  score_away integer default 0,
  minute integer,
  period text,
  status text default 'scheduled',
  stats jsonb,
  mycroft_status text default 'analyzing',
  mycroft_analysis_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela 2: Análises do Mycroft
create table if not exists mycroft_analyses (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  verdict text not null,
  market text not null,
  odd decimal(5,2),
  confidence integer,
  thesis text not null,
  fundamentation jsonb,
  risk_management jsonb,
  alerts text[],
  created_at timestamptz default now()
);

-- Add FK from live_matches to mycroft_analyses
ALTER TABLE live_matches 
  ADD CONSTRAINT live_matches_mycroft_analysis_id_fkey 
  FOREIGN KEY (mycroft_analysis_id) REFERENCES mycroft_analyses(id);

-- Tabela 3: Sinais enviados
create table if not exists signals_sent (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references mycroft_analyses(id),
  match_id text,
  user_id uuid,
  sent_telegram boolean default false,
  sent_whatsapp boolean default false,
  created_at timestamptz default now()
);

-- Tabela 4: Ações do user (tracking)
create table if not exists user_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  signal_id uuid references signals_sent(id),
  analysis_id uuid references mycroft_analyses(id),
  action text not null,
  stake_amount decimal(10,2),
  result text default 'pending',
  profit_loss decimal(10,2),
  created_at timestamptz default now()
);

-- RLS
alter table live_matches enable row level security;
alter table mycroft_analyses enable row level security;
alter table signals_sent enable row level security;
alter table user_actions enable row level security;

create policy "Anyone can view live matches" on live_matches for select using (true);
create policy "Anyone can view analyses" on mycroft_analyses for select using (true);
create policy "Users view own signals" on signals_sent for select using (auth.uid() = user_id);
create policy "Users view own actions" on user_actions for select using (auth.uid() = user_id);
create policy "Users insert own actions" on user_actions for insert with check (auth.uid() = user_id);
create policy "Users update own actions" on user_actions for update using (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE live_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE mycroft_analyses;

-- Índices
create index live_matches_status_idx on live_matches(status);
create index live_matches_updated_idx on live_matches(updated_at desc);
create index user_actions_user_idx on user_actions(user_id);
create index user_actions_created_idx on user_actions(created_at desc);
