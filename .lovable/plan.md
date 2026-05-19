## Objetivo

Hoje "Meu Plano" guarda **1 plano por mercado** (PK = user_id+market). Você quer poder criar **vários planos nomeados** (ex.: "Back Favorito Casa", "Over 1.5 HT", "BTTS conservador"), listá-los e editá-los. Também ajustar para que critérios menos conservadores permitam aprovar o "back ao favorito".

## Mudanças

### 1. Banco (migration)
- Nova tabela `user_trader_plans_v2`:
  - `id uuid PK`, `user_id`, `name text`, `market text`, `plan jsonb`, `visibility`, `enabled bool`, `created_at`, `updated_at`
  - RLS: owner CRUD, admin read-all, public read quando `visibility='public'`
  - Índices: `(user_id)`, `(user_id, market)`
- `user_trader_plan_signals`: adicionar coluna `plan_id uuid` (nullable) para rastrear qual plano gerou o sinal
- Mantém a tabela antiga viva (não quebra admin) — opcional migrar dados existentes via `INSERT ... SELECT`

### 2. `src/lib/userTraderPlan.ts`
- Trocar `PlansByMarket` (record por mercado) por `UserPlan[]` (array de planos com `id` e `name`)
- `loadUserPlans()` agora retorna lista; carrega do Supabase se logado, fallback localStorage
- `saveUserPlan(plan)` faz upsert único; `deleteUserPlan(id)` remove
- `evaluatePlan` continua igual (já recebe 1 plano)

### 3. `src/components/arena-trader/MeusSinaisPanel.tsx`
- Itera **todos os planos enabled** para cada match (em vez de 1 por mercado)
- Mostra qual plano gerou o sinal (badge com o nome)

### 4. `src/pages/ArenaTraderSportsMeuPlano.tsx` (rework)
Duas abas no topo:
- **"Meus planos"** (default): card-grid dos planos salvos com nome, mercado, status (enabled), resumo de critérios, botões Editar / Duplicar / Excluir / Ativar-Desativar
- **"Criar novo / Editor"**: formulário atual + campo **Nome do plano** no topo; botão "Salvar" cria ou atualiza
- Ao clicar Editar em um card, abre na aba Editor com os dados pré-preenchidos
- Botão "Novo plano" reseta o editor com defaults do mercado escolhido

### 5. Calibração para "Back ao Favorito"
- Adicionar template **"Back Favorito"** nos defaults com critérios mais permissivos:
  - odd 1.40–2.20, minuto 15–75, xG diff ≥ 0 (apenas paridade), posse ≥ 50%, SoT time ≥ 1
  - Sem veto de "time vencendo" (favorito muitas vezes já vence)
- Botão "Usar template" no editor para popular rápido

### 6. Admin (`AdminUserTraderPlans.tsx`)
- Atualizar query para ler da nova tabela e listar por nome do plano

## Não muda
- Liquidação (trigger mirror em `virtual_bets` continua)
- Evaluator e lógica do soft-check de stats ausentes
- Mycroft global

Confirma para eu aplicar?
