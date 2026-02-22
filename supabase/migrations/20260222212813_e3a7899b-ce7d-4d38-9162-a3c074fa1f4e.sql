
-- Tabela: Banca virtual do usuário
create table if not exists user_bankroll (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null unique,
  balance decimal(10,2) default 10000.00,
  initial_balance decimal(10,2) default 10000.00,
  total_staked decimal(10,2) default 0,
  total_profit decimal(10,2) default 0,
  total_bets integer default 0,
  green_bets integer default 0,
  red_bets integer default 0,
  win_rate decimal(5,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela: Apostas virtuais do usuário
create table if not exists virtual_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  signal_id uuid references mycroft_analyses(id),
  match_id text not null,
  match_name text not null,
  market text not null,
  odd decimal(5,2) not null,
  stake decimal(10,2) not null,
  status text check (status in ('pending', 'green', 'red')) default 'pending',
  profit_loss decimal(10,2) default 0,
  placed_at timestamptz default now(),
  settled_at timestamptz
);

-- RLS Policies
alter table user_bankroll enable row level security;
alter table virtual_bets enable row level security;

create policy "Users view own bankroll"
  on user_bankroll for select
  using (auth.uid() = user_id);

create policy "Users update own bankroll"
  on user_bankroll for update
  using (auth.uid() = user_id);

create policy "Users insert own bankroll"
  on user_bankroll for insert
  with check (auth.uid() = user_id);

create policy "Users view own bets"
  on virtual_bets for select
  using (auth.uid() = user_id);

create policy "Users insert own bets"
  on virtual_bets for insert
  with check (auth.uid() = user_id);

-- Índices
create index virtual_bets_user_idx on virtual_bets(user_id);
create index virtual_bets_status_idx on virtual_bets(status);
create index virtual_bets_placed_idx on virtual_bets(placed_at desc);

-- Função: Auto-criar bankroll no signup
create or replace function handle_new_user_bankroll()
returns trigger as $$
begin
  insert into user_bankroll (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created_bankroll
  after insert on auth.users
  for each row execute function handle_new_user_bankroll();
