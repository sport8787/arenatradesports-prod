
create table if not exists public.analises_manuais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  home_team text not null,
  away_team text not null,
  league_name text,
  match_date timestamptz,

  odd_h numeric, odd_d numeric, odd_a numeric,

  cdg1h numeric, cdg1a numeric,
  cv1h  numeric, cv1a  numeric,
  cdg2h numeric, cdg2a numeric,
  cv2h  numeric, cv2a  numeric,

  gm_h numeric, gm_a numeric,
  gm_cv_h numeric, gm_cv_a numeric,
  gs_h numeric, gs_a numeric,
  gs_cv_h numeric, gs_cv_a numeric,

  o05ht_h numeric, o05ht_a numeric,
  o15ht_h numeric, o15ht_a numeric,
  o052t_h numeric, o052t_a numeric,
  o152t_h numeric, o152t_a numeric,
  o05ft_h numeric, o05ft_a numeric,
  o15ft_h numeric, o15ft_a numeric,
  o25ft_h numeric, o25ft_a numeric,
  o35ft_h numeric, o35ft_a numeric,

  btts_h    numeric, btts_a    numeric,
  btts_ht_h numeric, btts_ht_a numeric,

  r_marc1_h numeric, r_marc1_a numeric,
  r_sof1_h  numeric, r_sof1_a  numeric,

  esc_ht_avg_h numeric, esc_ht_avg_a numeric,
  esc_ft_avg_h numeric, esc_ft_avg_a numeric,

  score_over05ht  numeric,
  score_over15ht  numeric,
  score_over25ft  numeric,
  score_over35ft  numeric,
  score_under25ft numeric,
  score_bttsft    numeric,
  score_lay_goleada numeric,
  score_lay_2x2   numeric,
  score_lay_1x3   numeric,

  melhor_sinal text,
  melhor_score numeric,

  sinais_aprovados   int default 0,
  sinais_atencao     int default 0,
  sinais_descartados int default 0,

  fonte text default 'sherlock',
  observacao text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_analises_user  on public.analises_manuais(user_id);
create index if not exists idx_analises_date  on public.analises_manuais(created_at desc);
create index if not exists idx_analises_sinal on public.analises_manuais(melhor_sinal);
create index if not exists idx_analises_score on public.analises_manuais(melhor_score desc);

alter table public.analises_manuais enable row level security;

drop policy if exists "Usuário lê próprias análises" on public.analises_manuais;
create policy "Usuário lê próprias análises"
  on public.analises_manuais for select
  using (auth.uid() = user_id);

drop policy if exists "Usuário cria próprias análises" on public.analises_manuais;
create policy "Usuário cria próprias análises"
  on public.analises_manuais for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuário atualiza próprias análises" on public.analises_manuais;
create policy "Usuário atualiza próprias análises"
  on public.analises_manuais for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuário deleta próprias análises" on public.analises_manuais;
create policy "Usuário deleta próprias análises"
  on public.analises_manuais for delete
  using (auth.uid() = user_id);

drop trigger if exists trg_analises_manuais_updated_at on public.analises_manuais;
create trigger trg_analises_manuais_updated_at
  before update on public.analises_manuais
  for each row execute function public.update_updated_at_column();

create or replace view public.v_historico_analises
with (security_invoker = true) as
select
  user_id,
  melhor_sinal,
  count(*)                                       as total_analises,
  round(avg(melhor_score), 1)                    as score_medio,
  count(*) filter (where sinais_aprovados > 0)   as com_aprovado,
  round(avg(sinais_aprovados), 1)                as media_aprovados,
  max(created_at)                                as ultima_analise
from public.analises_manuais
group by user_id, melhor_sinal
order by total_analises desc;
