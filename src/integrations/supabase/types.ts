export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ah_odds_snapshot: {
        Row: {
          away_odd: number | null
          captured_at: string
          fixture_id: string
          home_odd: number | null
          id: string
        }
        Insert: {
          away_odd?: number | null
          captured_at?: string
          fixture_id: string
          home_odd?: number | null
          id?: string
        }
        Update: {
          away_odd?: number | null
          captured_at?: string
          fixture_id?: string
          home_odd?: number | null
          id?: string
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          function_name: string
          hit_count: number
          id: string
          response_json: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          function_name: string
          hit_count?: number
          id?: string
          response_json: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          function_name?: string
          hit_count?: number
          id?: string
          response_json?: Json
        }
        Relationships: []
      }
      analises_comparativas: {
        Row: {
          away_team: string | null
          created_at: string
          data_jogo: string | null
          explicacao_novo: Json | null
          fixture_id: string | null
          home_team: string | null
          id: string
          league: string | null
          logs_novo: Json | null
          match_id: string | null
          mercado: string | null
          modo: Database["public"]["Enums"]["mycroft_modo"]
          odd_atual: number | null
          odd_novo: number | null
          resultado_real: string | null
          score_atual: number | null
          score_novo: number | null
          settled_at: string | null
          source_function: string
          stake_atual: number | null
          stake_novo: number | null
          stats_snapshot: Json | null
          updated_at: string
          verdicto_atual: string | null
          verdicto_novo: string | null
        }
        Insert: {
          away_team?: string | null
          created_at?: string
          data_jogo?: string | null
          explicacao_novo?: Json | null
          fixture_id?: string | null
          home_team?: string | null
          id?: string
          league?: string | null
          logs_novo?: Json | null
          match_id?: string | null
          mercado?: string | null
          modo: Database["public"]["Enums"]["mycroft_modo"]
          odd_atual?: number | null
          odd_novo?: number | null
          resultado_real?: string | null
          score_atual?: number | null
          score_novo?: number | null
          settled_at?: string | null
          source_function: string
          stake_atual?: number | null
          stake_novo?: number | null
          stats_snapshot?: Json | null
          updated_at?: string
          verdicto_atual?: string | null
          verdicto_novo?: string | null
        }
        Update: {
          away_team?: string | null
          created_at?: string
          data_jogo?: string | null
          explicacao_novo?: Json | null
          fixture_id?: string | null
          home_team?: string | null
          id?: string
          league?: string | null
          logs_novo?: Json | null
          match_id?: string | null
          mercado?: string | null
          modo?: Database["public"]["Enums"]["mycroft_modo"]
          odd_atual?: number | null
          odd_novo?: number | null
          resultado_real?: string | null
          score_atual?: number | null
          score_novo?: number | null
          settled_at?: string | null
          source_function?: string
          stake_atual?: number | null
          stake_novo?: number | null
          stats_snapshot?: Json | null
          updated_at?: string
          verdicto_atual?: string | null
          verdicto_novo?: string | null
        }
        Relationships: []
      }
      analises_manuais: {
        Row: {
          away_team: string
          btts_a: number | null
          btts_h: number | null
          btts_ht_a: number | null
          btts_ht_h: number | null
          cdg1a: number | null
          cdg1h: number | null
          cdg2a: number | null
          cdg2h: number | null
          created_at: string
          cv1a: number | null
          cv1h: number | null
          cv2a: number | null
          cv2h: number | null
          esc_ft_avg_a: number | null
          esc_ft_avg_h: number | null
          esc_ht_avg_a: number | null
          esc_ht_avg_h: number | null
          fonte: string | null
          gm_a: number | null
          gm_cv_a: number | null
          gm_cv_h: number | null
          gm_h: number | null
          gs_a: number | null
          gs_cv_a: number | null
          gs_cv_h: number | null
          gs_h: number | null
          home_team: string
          id: string
          league_name: string | null
          match_date: string | null
          melhor_score: number | null
          melhor_sinal: string | null
          o052t_a: number | null
          o052t_h: number | null
          o05ft_a: number | null
          o05ft_h: number | null
          o05ht_a: number | null
          o05ht_h: number | null
          o152t_a: number | null
          o152t_h: number | null
          o15ft_a: number | null
          o15ft_h: number | null
          o15ht_a: number | null
          o15ht_h: number | null
          o25ft_a: number | null
          o25ft_h: number | null
          o35ft_a: number | null
          o35ft_h: number | null
          observacao: string | null
          odd_a: number | null
          odd_d: number | null
          odd_h: number | null
          r_marc1_a: number | null
          r_marc1_h: number | null
          r_sof1_a: number | null
          r_sof1_h: number | null
          score_bttsft: number | null
          score_handicap_asiatico: number | null
          score_lay_1x3: number | null
          score_lay_2x2: number | null
          score_lay_goleada: number | null
          score_over05ht: number | null
          score_over15ht: number | null
          score_over25ft: number | null
          score_over35ft: number | null
          score_under25ft: number | null
          sinais_aprovados: number | null
          sinais_atencao: number | null
          sinais_descartados: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          away_team: string
          btts_a?: number | null
          btts_h?: number | null
          btts_ht_a?: number | null
          btts_ht_h?: number | null
          cdg1a?: number | null
          cdg1h?: number | null
          cdg2a?: number | null
          cdg2h?: number | null
          created_at?: string
          cv1a?: number | null
          cv1h?: number | null
          cv2a?: number | null
          cv2h?: number | null
          esc_ft_avg_a?: number | null
          esc_ft_avg_h?: number | null
          esc_ht_avg_a?: number | null
          esc_ht_avg_h?: number | null
          fonte?: string | null
          gm_a?: number | null
          gm_cv_a?: number | null
          gm_cv_h?: number | null
          gm_h?: number | null
          gs_a?: number | null
          gs_cv_a?: number | null
          gs_cv_h?: number | null
          gs_h?: number | null
          home_team: string
          id?: string
          league_name?: string | null
          match_date?: string | null
          melhor_score?: number | null
          melhor_sinal?: string | null
          o052t_a?: number | null
          o052t_h?: number | null
          o05ft_a?: number | null
          o05ft_h?: number | null
          o05ht_a?: number | null
          o05ht_h?: number | null
          o152t_a?: number | null
          o152t_h?: number | null
          o15ft_a?: number | null
          o15ft_h?: number | null
          o15ht_a?: number | null
          o15ht_h?: number | null
          o25ft_a?: number | null
          o25ft_h?: number | null
          o35ft_a?: number | null
          o35ft_h?: number | null
          observacao?: string | null
          odd_a?: number | null
          odd_d?: number | null
          odd_h?: number | null
          r_marc1_a?: number | null
          r_marc1_h?: number | null
          r_sof1_a?: number | null
          r_sof1_h?: number | null
          score_bttsft?: number | null
          score_handicap_asiatico?: number | null
          score_lay_1x3?: number | null
          score_lay_2x2?: number | null
          score_lay_goleada?: number | null
          score_over05ht?: number | null
          score_over15ht?: number | null
          score_over25ft?: number | null
          score_over35ft?: number | null
          score_under25ft?: number | null
          sinais_aprovados?: number | null
          sinais_atencao?: number | null
          sinais_descartados?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          away_team?: string
          btts_a?: number | null
          btts_h?: number | null
          btts_ht_a?: number | null
          btts_ht_h?: number | null
          cdg1a?: number | null
          cdg1h?: number | null
          cdg2a?: number | null
          cdg2h?: number | null
          created_at?: string
          cv1a?: number | null
          cv1h?: number | null
          cv2a?: number | null
          cv2h?: number | null
          esc_ft_avg_a?: number | null
          esc_ft_avg_h?: number | null
          esc_ht_avg_a?: number | null
          esc_ht_avg_h?: number | null
          fonte?: string | null
          gm_a?: number | null
          gm_cv_a?: number | null
          gm_cv_h?: number | null
          gm_h?: number | null
          gs_a?: number | null
          gs_cv_a?: number | null
          gs_cv_h?: number | null
          gs_h?: number | null
          home_team?: string
          id?: string
          league_name?: string | null
          match_date?: string | null
          melhor_score?: number | null
          melhor_sinal?: string | null
          o052t_a?: number | null
          o052t_h?: number | null
          o05ft_a?: number | null
          o05ft_h?: number | null
          o05ht_a?: number | null
          o05ht_h?: number | null
          o152t_a?: number | null
          o152t_h?: number | null
          o15ft_a?: number | null
          o15ft_h?: number | null
          o15ht_a?: number | null
          o15ht_h?: number | null
          o25ft_a?: number | null
          o25ft_h?: number | null
          o35ft_a?: number | null
          o35ft_h?: number | null
          observacao?: string | null
          odd_a?: number | null
          odd_d?: number | null
          odd_h?: number | null
          r_marc1_a?: number | null
          r_marc1_h?: number | null
          r_sof1_a?: number | null
          r_sof1_h?: number | null
          score_bttsft?: number | null
          score_handicap_asiatico?: number | null
          score_lay_1x3?: number | null
          score_lay_2x2?: number | null
          score_lay_goleada?: number | null
          score_over05ht?: number | null
          score_over15ht?: number | null
          score_over25ft?: number | null
          score_over35ft?: number | null
          score_under25ft?: number | null
          sinais_aprovados?: number | null
          sinais_atencao?: number | null
          sinais_descartados?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      approval_snapshot_violations: {
        Row: {
          analysis_id: string
          attempted_value: string | null
          created_at: string
          field_name: string
          id: string
          match_id: string | null
          old_value: string | null
          reason: string
          source: string | null
        }
        Insert: {
          analysis_id: string
          attempted_value?: string | null
          created_at?: string
          field_name: string
          id?: string
          match_id?: string | null
          old_value?: string | null
          reason?: string
          source?: string | null
        }
        Update: {
          analysis_id?: string
          attempted_value?: string | null
          created_at?: string
          field_name?: string
          id?: string
          match_id?: string | null
          old_value?: string | null
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      arena_calibration_state: {
        Row: {
          arena: string
          base_min_confidence: number
          delta: number
          effective_min_confidence: number
          greens: number
          hit_rate: number
          last_settled_at: string | null
          reds: number
          roi: number
          sample_size: number
          updated_at: string
        }
        Insert: {
          arena: string
          base_min_confidence?: number
          delta?: number
          effective_min_confidence?: number
          greens?: number
          hit_rate?: number
          last_settled_at?: string | null
          reds?: number
          roi?: number
          sample_size?: number
          updated_at?: string
        }
        Update: {
          arena?: string
          base_min_confidence?: number
          delta?: number
          effective_min_confidence?: number
          greens?: number
          hit_rate?: number
          last_settled_at?: string | null
          reds?: number
          roi?: number
          sample_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      arena_matches: {
        Row: {
          away_team: string
          cards_away: number | null
          cards_home: number | null
          corners_away: number | null
          corners_home: number | null
          created_at: string
          dangerous_attacks_away: number | null
          dangerous_attacks_home: number | null
          home_team: string
          id: string
          league: string
          match_date: string
          match_id: string
          possession_away: number | null
          possession_home: number | null
          result: string | null
          score_away: number | null
          score_home: number | null
          season: string | null
          shots_away: number | null
          shots_home: number | null
          shots_on_target_away: number | null
          shots_on_target_home: number | null
          source: string | null
          stats: Json | null
          updated_at: string
          xg_away: number | null
          xg_home: number | null
        }
        Insert: {
          away_team: string
          cards_away?: number | null
          cards_home?: number | null
          corners_away?: number | null
          corners_home?: number | null
          created_at?: string
          dangerous_attacks_away?: number | null
          dangerous_attacks_home?: number | null
          home_team: string
          id?: string
          league: string
          match_date: string
          match_id: string
          possession_away?: number | null
          possession_home?: number | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          season?: string | null
          shots_away?: number | null
          shots_home?: number | null
          shots_on_target_away?: number | null
          shots_on_target_home?: number | null
          source?: string | null
          stats?: Json | null
          updated_at?: string
          xg_away?: number | null
          xg_home?: number | null
        }
        Update: {
          away_team?: string
          cards_away?: number | null
          cards_home?: number | null
          corners_away?: number | null
          corners_home?: number | null
          created_at?: string
          dangerous_attacks_away?: number | null
          dangerous_attacks_home?: number | null
          home_team?: string
          id?: string
          league?: string
          match_date?: string
          match_id?: string
          possession_away?: number | null
          possession_home?: number | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          season?: string | null
          shots_away?: number | null
          shots_home?: number | null
          shots_on_target_away?: number | null
          shots_on_target_home?: number | null
          source?: string | null
          stats?: Json | null
          updated_at?: string
          xg_away?: number | null
          xg_home?: number | null
        }
        Relationships: []
      }
      arena_odds: {
        Row: {
          bookmaker: string
          created_at: string
          id: string
          market: string
          match_id: string
          movement_pct: number | null
          odd_close: number | null
          odd_current: number | null
          odd_open: number | null
          timestamp_close: string | null
          timestamp_current: string | null
          timestamp_open: string | null
        }
        Insert: {
          bookmaker: string
          created_at?: string
          id?: string
          market: string
          match_id: string
          movement_pct?: number | null
          odd_close?: number | null
          odd_current?: number | null
          odd_open?: number | null
          timestamp_close?: string | null
          timestamp_current?: string | null
          timestamp_open?: string | null
        }
        Update: {
          bookmaker?: string
          created_at?: string
          id?: string
          market?: string
          match_id?: string
          movement_pct?: number | null
          odd_close?: number | null
          odd_current?: number | null
          odd_open?: number | null
          timestamp_close?: string | null
          timestamp_current?: string | null
          timestamp_open?: string | null
        }
        Relationships: []
      }
      arena_patterns: {
        Row: {
          avg_odd: number | null
          conditions: Json | null
          confidence: number
          created_at: string
          id: string
          is_profitable: boolean
          last_calculated_at: string | null
          league: string
          losses: number
          market: string
          pattern_type: string | null
          roi: number
          sample_size: number
          updated_at: string
          win_rate: number
          wins: number
        }
        Insert: {
          avg_odd?: number | null
          conditions?: Json | null
          confidence?: number
          created_at?: string
          id?: string
          is_profitable?: boolean
          last_calculated_at?: string | null
          league: string
          losses?: number
          market: string
          pattern_type?: string | null
          roi?: number
          sample_size?: number
          updated_at?: string
          win_rate?: number
          wins?: number
        }
        Update: {
          avg_odd?: number | null
          conditions?: Json | null
          confidence?: number
          created_at?: string
          id?: string
          is_profitable?: boolean
          last_calculated_at?: string | null
          league?: string
          losses?: number
          market?: string
          pattern_type?: string | null
          roi?: number
          sample_size?: number
          updated_at?: string
          win_rate?: number
          wins?: number
        }
        Relationships: []
      }
      arena_trader_entries: {
        Row: {
          created_at: string | null
          fixture_id: string
          fixture_label: string
          id: string
          market: string
          minute_entered: number
          notes: string | null
          odd: number
          odd_source: string
          plano: string
          pnl: number | null
          result: string | null
          stake_pct: number
          stake_value: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fixture_id: string
          fixture_label: string
          id?: string
          market: string
          minute_entered: number
          notes?: string | null
          odd: number
          odd_source?: string
          plano: string
          pnl?: number | null
          result?: string | null
          stake_pct: number
          stake_value: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          fixture_id?: string
          fixture_label?: string
          id?: string
          market?: string
          minute_entered?: number
          notes?: string | null
          odd?: number
          odd_source?: string
          plano?: string
          pnl?: number | null
          result?: string | null
          stake_pct?: number
          stake_value?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      arena_trader_rankings: {
        Row: {
          atc_balance: number
          best_trade_profit: number
          created_at: string
          id: string
          losing_trades: number
          total_profit_loss: number
          total_sessions: number
          total_trades: number
          updated_at: string
          user_id: string
          username: string
          winning_trades: number
          worst_trade_loss: number
        }
        Insert: {
          atc_balance?: number
          best_trade_profit?: number
          created_at?: string
          id?: string
          losing_trades?: number
          total_profit_loss?: number
          total_sessions?: number
          total_trades?: number
          updated_at?: string
          user_id: string
          username?: string
          winning_trades?: number
          worst_trade_loss?: number
        }
        Update: {
          atc_balance?: number
          best_trade_profit?: number
          created_at?: string
          id?: string
          losing_trades?: number
          total_profit_loss?: number
          total_sessions?: number
          total_trades?: number
          updated_at?: string
          user_id?: string
          username?: string
          winning_trades?: number
          worst_trade_loss?: number
        }
        Relationships: []
      }
      arena_trader_rounds: {
        Row: {
          bankroll_after: number
          bankroll_before: number
          chosen_option: string
          created_at: string
          day: number
          id: string
          is_correct: boolean
          jury_convinced_count: number
          jury_votes: Json | null
          mycroft_analysis: Json | null
          scenario_id: string
          session_id: string
          tilt_detected: boolean
          time_to_choose: number | null
          transcription: string | null
        }
        Insert: {
          bankroll_after: number
          bankroll_before: number
          chosen_option: string
          created_at?: string
          day: number
          id?: string
          is_correct?: boolean
          jury_convinced_count?: number
          jury_votes?: Json | null
          mycroft_analysis?: Json | null
          scenario_id: string
          session_id: string
          tilt_detected?: boolean
          time_to_choose?: number | null
          transcription?: string | null
        }
        Update: {
          bankroll_after?: number
          bankroll_before?: number
          chosen_option?: string
          created_at?: string
          day?: number
          id?: string
          is_correct?: boolean
          jury_convinced_count?: number
          jury_votes?: Json | null
          mycroft_analysis?: Json | null
          scenario_id?: string
          session_id?: string
          tilt_detected?: boolean
          time_to_choose?: number | null
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_trader_rounds_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "arena_trader_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_trader_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "arena_trader_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_trader_scenarios: {
        Row: {
          bankroll_multiplier_loss: number
          bankroll_multiplier_win: number
          category: string
          common_mistake: string | null
          correct_option: string
          created_at: string
          description: string
          difficulty: string
          explanation: string
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          title: string
        }
        Insert: {
          bankroll_multiplier_loss?: number
          bankroll_multiplier_win?: number
          category?: string
          common_mistake?: string | null
          correct_option: string
          created_at?: string
          description: string
          difficulty?: string
          explanation: string
          id?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          title: string
        }
        Update: {
          bankroll_multiplier_loss?: number
          bankroll_multiplier_win?: number
          category?: string
          common_mistake?: string | null
          correct_option?: string
          created_at?: string
          description?: string
          difficulty?: string
          explanation?: string
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          title?: string
        }
        Relationships: []
      }
      arena_trader_seasons: {
        Row: {
          all_in_moments: number
          best_win_streak: number
          correct_answers: number
          current_bankroll: number
          current_day: number
          ended_at: string | null
          id: string
          ignored_warnings: number
          initial_bankroll: number
          jury_convinced: number
          loss_streak: number
          offers_accepted: number
          offers_received: number
          season_number: number
          started_at: string
          status: string
          tilt_warnings: number
          total_rounds: number
          user_id: string
          win_streak: number
        }
        Insert: {
          all_in_moments?: number
          best_win_streak?: number
          correct_answers?: number
          current_bankroll?: number
          current_day?: number
          ended_at?: string | null
          id?: string
          ignored_warnings?: number
          initial_bankroll?: number
          jury_convinced?: number
          loss_streak?: number
          offers_accepted?: number
          offers_received?: number
          season_number?: number
          started_at?: string
          status?: string
          tilt_warnings?: number
          total_rounds?: number
          user_id: string
          win_streak?: number
        }
        Update: {
          all_in_moments?: number
          best_win_streak?: number
          correct_answers?: number
          current_bankroll?: number
          current_day?: number
          ended_at?: string | null
          id?: string
          ignored_warnings?: number
          initial_bankroll?: number
          jury_convinced?: number
          loss_streak?: number
          offers_accepted?: number
          offers_received?: number
          season_number?: number
          started_at?: string
          status?: string
          tilt_warnings?: number
          total_rounds?: number
          user_id?: string
          win_streak?: number
        }
        Relationships: []
      }
      audios_horus_punter: {
        Row: {
          ativo: boolean
          audio_url: string
          chave: string
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          audio_url: string
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          audio_url?: string
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      bc_monthly_caps: {
        Row: {
          cap_at_period: number
          id: string
          plan_at_period: string | null
          total_credited: number
          updated_at: string
          user_id: string
          year_month: string
        }
        Insert: {
          cap_at_period?: number
          id?: string
          plan_at_period?: string | null
          total_credited?: number
          updated_at?: string
          user_id: string
          year_month: string
        }
        Update: {
          cap_at_period?: number
          id?: string
          plan_at_period?: string | null
          total_credited?: number
          updated_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: []
      }
      bc_rewards_log: {
        Row: {
          base_bc: number
          bet_id: string
          bonus_bc: number
          created_at: string
          expires_at: string | null
          id: string
          motivo: string | null
          multiplier: number
          plan_at_credit: string | null
          source: string
          total_bc: number
          user_id: string
        }
        Insert: {
          base_bc?: number
          bet_id: string
          bonus_bc?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          motivo?: string | null
          multiplier?: number
          plan_at_credit?: string | null
          source: string
          total_bc?: number
          user_id: string
        }
        Update: {
          base_bc?: number
          bet_id?: string
          bonus_bc?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          motivo?: string | null
          multiplier?: number
          plan_at_credit?: string | null
          source?: string
          total_bc?: number
          user_id?: string
        }
        Relationships: []
      }
      bet_correlations: {
        Row: {
          correlation_coefficient: number | null
          id: string
          market_a: string
          market_b: string
          sample_size: number
          updated_at: string | null
        }
        Insert: {
          correlation_coefficient?: number | null
          id?: string
          market_a: string
          market_b: string
          sample_size?: number
          updated_at?: string | null
        }
        Update: {
          correlation_coefficient?: number | null
          id?: string
          market_a?: string
          market_b?: string
          sample_size?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      bets_history: {
        Row: {
          asset_classification: string | null
          asset_score: number | null
          away_team: string | null
          bookmaker: string | null
          clv: number | null
          created_at: string
          edge: number | null
          home_team: string | null
          id: string
          league: string | null
          market: string
          match_id: string
          odd: number
          odd_close: number | null
          placed_at: string | null
          probability_market: number | null
          probability_model: number | null
          profit_loss: number | null
          result: string | null
          resulted_at: string | null
          score_away: number | null
          score_home: number | null
          season: string | null
          source: string
          stake: number
          stake_percentage: number | null
          user_id: string
        }
        Insert: {
          asset_classification?: string | null
          asset_score?: number | null
          away_team?: string | null
          bookmaker?: string | null
          clv?: number | null
          created_at?: string
          edge?: number | null
          home_team?: string | null
          id?: string
          league?: string | null
          market: string
          match_id: string
          odd: number
          odd_close?: number | null
          placed_at?: string | null
          probability_market?: number | null
          probability_model?: number | null
          profit_loss?: number | null
          result?: string | null
          resulted_at?: string | null
          score_away?: number | null
          score_home?: number | null
          season?: string | null
          source?: string
          stake?: number
          stake_percentage?: number | null
          user_id: string
        }
        Update: {
          asset_classification?: string | null
          asset_score?: number | null
          away_team?: string | null
          bookmaker?: string | null
          clv?: number | null
          created_at?: string
          edge?: number | null
          home_team?: string | null
          id?: string
          league?: string | null
          market?: string
          match_id?: string
          odd?: number
          odd_close?: number | null
          placed_at?: string | null
          probability_market?: number | null
          probability_model?: number | null
          profit_loss?: number | null
          result?: string | null
          resulted_at?: string | null
          score_away?: number | null
          score_home?: number | null
          season?: string | null
          source?: string
          stake?: number
          stake_percentage?: number | null
          user_id?: string
        }
        Relationships: []
      }
      blackjack_hands: {
        Row: {
          bet_amount: number
          bet_units: number
          created_at: string
          dealer_card: string
          hand_number: number
          id: string
          player_action: string | null
          player_cards: string[]
          player_soft: boolean
          player_total: number
          profit_loss: number
          recommended_action: string | null
          result: string
          running_count: number
          session_id: string
          true_count: number
          was_deviation: boolean
        }
        Insert: {
          bet_amount?: number
          bet_units?: number
          created_at?: string
          dealer_card?: string
          hand_number?: number
          id?: string
          player_action?: string | null
          player_cards?: string[]
          player_soft?: boolean
          player_total?: number
          profit_loss?: number
          recommended_action?: string | null
          result?: string
          running_count?: number
          session_id: string
          true_count?: number
          was_deviation?: boolean
        }
        Update: {
          bet_amount?: number
          bet_units?: number
          created_at?: string
          dealer_card?: string
          hand_number?: number
          id?: string
          player_action?: string | null
          player_cards?: string[]
          player_soft?: boolean
          player_total?: number
          profit_loss?: number
          recommended_action?: string | null
          result?: string
          running_count?: number
          session_id?: string
          true_count?: number
          was_deviation?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "blackjack_hands_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "blackjack_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      blackjack_sessions: {
        Row: {
          base_unit: number
          best_true_count: number
          blackjack_payout: number
          casino: string
          created_at: string
          current_bankroll: number
          decks: number
          ended_at: string | null
          hands_lost: number
          hands_played: number
          hands_pushed: number
          hands_won: number
          id: string
          increment: number
          initial_bankroll: number
          max_bet: number
          started_at: string
          status: string
          stop_loss: number
          stop_win: number
          total_profit: number
          updated_at: string
          use_counting: boolean
          user_id: string
          variant: string
        }
        Insert: {
          base_unit?: number
          best_true_count?: number
          blackjack_payout?: number
          casino?: string
          created_at?: string
          current_bankroll?: number
          decks?: number
          ended_at?: string | null
          hands_lost?: number
          hands_played?: number
          hands_pushed?: number
          hands_won?: number
          id?: string
          increment?: number
          initial_bankroll?: number
          max_bet?: number
          started_at?: string
          status?: string
          stop_loss?: number
          stop_win?: number
          total_profit?: number
          updated_at?: string
          use_counting?: boolean
          user_id: string
          variant?: string
        }
        Update: {
          base_unit?: number
          best_true_count?: number
          blackjack_payout?: number
          casino?: string
          created_at?: string
          current_bankroll?: number
          decks?: number
          ended_at?: string | null
          hands_lost?: number
          hands_played?: number
          hands_pushed?: number
          hands_won?: number
          id?: string
          increment?: number
          initial_bankroll?: number
          max_bet?: number
          started_at?: string
          status?: string
          stop_loss?: number
          stop_win?: number
          total_profit?: number
          updated_at?: string
          use_counting?: boolean
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      bluff_talk_attempts: {
        Row: {
          alignment_check: string | null
          bluff_score: number | null
          created_at: string
          duration_seconds: number | null
          id: string
          intent: string | null
          leak_detection: string | null
          mycroft_bluff_feedback_text: string | null
          opponent_reaction: string | null
          suggested_phrases_json: Json | null
          training_street_id: string
          transcript_text: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          alignment_check?: string | null
          bluff_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          intent?: string | null
          leak_detection?: string | null
          mycroft_bluff_feedback_text?: string | null
          opponent_reaction?: string | null
          suggested_phrases_json?: Json | null
          training_street_id: string
          transcript_text?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          alignment_check?: string | null
          bluff_score?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          intent?: string | null
          leak_detection?: string | null
          mycroft_bluff_feedback_text?: string | null
          opponent_reaction?: string | null
          suggested_phrases_json?: Json | null
          training_street_id?: string
          transcript_text?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bluff_talk_attempts_training_street_id_fkey"
            columns: ["training_street_id"]
            isOneToOne: false
            referencedRelation: "training_streets"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmaker_connections: {
        Row: {
          app_key: string | null
          bookmaker: string
          created_at: string | null
          encrypted_password: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          session_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          app_key?: string | null
          bookmaker?: string
          created_at?: string | null
          encrypted_password?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          session_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          app_key?: string | null
          bookmaker?: string
          created_at?: string | null
          encrypted_password?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          session_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      cached_odds_games: {
        Row: {
          away_team: string
          bookmakers: Json
          commence_time: string
          event_id: string
          expires_at: string
          fetched_at: string
          home_team: string
          id: string
          simulated_odds: boolean
          sport_key: string
        }
        Insert: {
          away_team: string
          bookmakers?: Json
          commence_time: string
          event_id: string
          expires_at?: string
          fetched_at?: string
          home_team: string
          id?: string
          simulated_odds?: boolean
          sport_key: string
        }
        Update: {
          away_team?: string
          bookmakers?: Json
          commence_time?: string
          event_id?: string
          expires_at?: string
          fetched_at?: string
          home_team?: string
          id?: string
          simulated_odds?: boolean
          sport_key?: string
        }
        Relationships: []
      }
      cashout_history: {
        Row: {
          bet_id: string
          cashout_value: number | null
          confianca: number | null
          created_at: string
          current_odd: number
          entry_odd: number | null
          fatores: Json | null
          fonte: string
          id: string
          market: string | null
          match_id: string | null
          minute: number | null
          motivo: string | null
          saude: string | null
          score: string | null
          signal: boolean | null
          user_id: string
        }
        Insert: {
          bet_id: string
          cashout_value?: number | null
          confianca?: number | null
          created_at?: string
          current_odd: number
          entry_odd?: number | null
          fatores?: Json | null
          fonte: string
          id?: string
          market?: string | null
          match_id?: string | null
          minute?: number | null
          motivo?: string | null
          saude?: string | null
          score?: string | null
          signal?: boolean | null
          user_id: string
        }
        Update: {
          bet_id?: string
          cashout_value?: number | null
          confianca?: number | null
          created_at?: string
          current_odd?: number
          entry_odd?: number | null
          fatores?: Json | null
          fonte?: string
          id?: string
          market?: string | null
          match_id?: string | null
          minute?: number | null
          motivo?: string | null
          saude?: string | null
          score?: string | null
          signal?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashout_history_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "virtual_bets"
            referencedColumns: ["id"]
          },
        ]
      }
      cashout_signals_log: {
        Row: {
          accepted_at: string | null
          bet_id: string
          bet_would_have_won: boolean | null
          cashout_value: number
          confidence: number | null
          created_at: string | null
          current_odd: number
          entry_odd: number
          fatores: Json | null
          id: string
          market: string
          match_final_result: string | null
          match_final_score: string | null
          match_id: string
          match_name: string
          minuto: number | null
          modo: string | null
          mycroft_reason: string | null
          odd_fonte: string | null
          placar: string | null
          position_health: string
          potential_profit_loss: number | null
          signal_type: string
          stake: number
          user_id: string
          was_accepted: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          bet_id: string
          bet_would_have_won?: boolean | null
          cashout_value: number
          confidence?: number | null
          created_at?: string | null
          current_odd: number
          entry_odd: number
          fatores?: Json | null
          id?: string
          market: string
          match_final_result?: string | null
          match_final_score?: string | null
          match_id: string
          match_name: string
          minuto?: number | null
          modo?: string | null
          mycroft_reason?: string | null
          odd_fonte?: string | null
          placar?: string | null
          position_health: string
          potential_profit_loss?: number | null
          signal_type?: string
          stake: number
          user_id: string
          was_accepted?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          bet_id?: string
          bet_would_have_won?: boolean | null
          cashout_value?: number
          confidence?: number | null
          created_at?: string | null
          current_odd?: number
          entry_odd?: number
          fatores?: Json | null
          id?: string
          market?: string
          match_final_result?: string | null
          match_final_score?: string | null
          match_id?: string
          match_name?: string
          minuto?: number | null
          modo?: string | null
          mycroft_reason?: string | null
          odd_fonte?: string | null
          placar?: string | null
          position_health?: string
          potential_profit_loss?: number | null
          signal_type?: string
          stake?: number
          user_id?: string
          was_accepted?: boolean | null
        }
        Relationships: []
      }
      cashout_telegram_alerts: {
        Row: {
          bet_id: string
          cashout_value: number | null
          created_at: string
          current_odd: number | null
          dedupe_key: string
          entry_odd: number | null
          id: string
          market: string | null
          match_name: string | null
          minuto: number | null
          motivo: string | null
          placar: string | null
          sent: boolean
          signal_type: string
        }
        Insert: {
          bet_id: string
          cashout_value?: number | null
          created_at?: string
          current_odd?: number | null
          dedupe_key: string
          entry_odd?: number | null
          id?: string
          market?: string | null
          match_name?: string | null
          minuto?: number | null
          motivo?: string | null
          placar?: string | null
          sent?: boolean
          signal_type: string
        }
        Update: {
          bet_id?: string
          cashout_value?: number | null
          created_at?: string
          current_odd?: number | null
          dedupe_key?: string
          entry_odd?: number | null
          id?: string
          market?: string | null
          match_name?: string | null
          minuto?: number | null
          motivo?: string | null
          placar?: string | null
          sent?: boolean
          signal_type?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          consent_given: boolean
          consent_type: string
          consent_version: string | null
          created_at: string
          given_at: string
          id: string
          ip_hash: string | null
          revoked_at: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          consent_given: boolean
          consent_type: string
          consent_version?: string | null
          created_at?: string
          given_at?: string
          id?: string
          ip_hash?: string | null
          revoked_at?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          consent_given?: boolean
          consent_type?: string
          consent_version?: string | null
          created_at?: string
          given_at?: string
          id?: string
          ip_hash?: string | null
          revoked_at?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cron_logs: {
        Row: {
          created_at: string | null
          id: string
          ligas_encontradas: Json | null
          tipo: string | null
          total_filtrados: number | null
          total_recebidos: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ligas_encontradas?: Json | null
          tipo?: string | null
          total_filtrados?: number | null
          total_recebidos?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ligas_encontradas?: Json | null
          tipo?: string | null
          total_filtrados?: number | null
          total_recebidos?: number | null
        }
        Relationships: []
      }
      cron_settings: {
        Row: {
          id: string
          is_enabled: boolean
          setting_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          setting_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      daily_summaries: {
        Row: {
          best_bet: Json | null
          best_market: Json | null
          created_at: string | null
          date: string
          horus: Json
          id: string
          manual: Json
          total_bets: number | null
          total_profit: number | null
          user_id: string
        }
        Insert: {
          best_bet?: Json | null
          best_market?: Json | null
          created_at?: string | null
          date: string
          horus?: Json
          id?: string
          manual?: Json
          total_bets?: number | null
          total_profit?: number | null
          user_id: string
        }
        Update: {
          best_bet?: Json | null
          best_market?: Json | null
          created_at?: string | null
          date?: string
          horus?: Json
          id?: string
          manual?: Json
          total_bets?: number | null
          total_profit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      edge_function_errors: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string
          error_stack: string | null
          function_name: string
          id: string
          severity: string
          status_code: number | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          function_name: string
          id?: string
          severity?: string
          status_code?: number | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          function_name?: string
          id?: string
          severity?: string
          status_code?: number | null
        }
        Relationships: []
      }
      edge_function_runs: {
        Row: {
          context: Json | null
          duration_ms: number | null
          error_message: string | null
          finished_at: string
          function_name: string
          id: string
          started_at: string
          status: string
          status_code: number | null
        }
        Insert: {
          context?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string
          function_name: string
          id?: string
          started_at?: string
          status?: string
          status_code?: number | null
        }
        Update: {
          context?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string
          function_name?: string
          id?: string
          started_at?: string
          status?: string
          status_code?: number | null
        }
        Relationships: []
      }
      email_sequencia_log: {
        Row: {
          aberto: boolean
          clicado: boolean
          email: string
          enviado_em: string
          error_message: string | null
          from_email: string | null
          http_status: number | null
          id: string
          resend_id: string | null
          resend_response: Json | null
          sequencia: string
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          aberto?: boolean
          clicado?: boolean
          email: string
          enviado_em?: string
          error_message?: string | null
          from_email?: string | null
          http_status?: number | null
          id?: string
          resend_id?: string | null
          resend_response?: Json | null
          sequencia: string
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          aberto?: boolean
          clicado?: boolean
          email?: string
          enviado_em?: string
          error_message?: string | null
          from_email?: string | null
          http_status?: number | null
          id?: string
          resend_id?: string | null
          resend_response?: Json | null
          sequencia?: string
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      eventos_raros_candidatos: {
        Row: {
          arenas: string[] | null
          away_team: string
          clean_sheet_rate_away: number | null
          clean_sheet_rate_home: number | null
          created_at: string | null
          desequilibrio_forcas: number | null
          forca_ofensiva_away: number | null
          forca_ofensiva_home: number | null
          fragilidade_def_away: number | null
          fragilidade_def_home: number | null
          freq_1x3_h2h: number | null
          freq_2x2_h2h: number | null
          freq_goleada_away: number | null
          freq_goleada_h2h: number | null
          freq_goleada_home: number | null
          home_team: string
          id: string
          league_id: number
          league_name: string | null
          match_date: string
          match_id: string
          media_gols_h2h: number | null
          motivo_descarte: string | null
          placar_alternativo: string | null
          placar_alvo: string | null
          score_qualidade: number | null
          season: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          arenas?: string[] | null
          away_team: string
          clean_sheet_rate_away?: number | null
          clean_sheet_rate_home?: number | null
          created_at?: string | null
          desequilibrio_forcas?: number | null
          forca_ofensiva_away?: number | null
          forca_ofensiva_home?: number | null
          fragilidade_def_away?: number | null
          fragilidade_def_home?: number | null
          freq_1x3_h2h?: number | null
          freq_2x2_h2h?: number | null
          freq_goleada_away?: number | null
          freq_goleada_h2h?: number | null
          freq_goleada_home?: number | null
          home_team: string
          id?: string
          league_id: number
          league_name?: string | null
          match_date: string
          match_id: string
          media_gols_h2h?: number | null
          motivo_descarte?: string | null
          placar_alternativo?: string | null
          placar_alvo?: string | null
          score_qualidade?: number | null
          season?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          arenas?: string[] | null
          away_team?: string
          clean_sheet_rate_away?: number | null
          clean_sheet_rate_home?: number | null
          created_at?: string | null
          desequilibrio_forcas?: number | null
          forca_ofensiva_away?: number | null
          forca_ofensiva_home?: number | null
          fragilidade_def_away?: number | null
          fragilidade_def_home?: number | null
          freq_1x3_h2h?: number | null
          freq_2x2_h2h?: number | null
          freq_goleada_away?: number | null
          freq_goleada_h2h?: number | null
          freq_goleada_home?: number | null
          home_team?: string
          id?: string
          league_id?: number
          league_name?: string | null
          match_date?: string
          match_id?: string
          media_gols_h2h?: number | null
          motivo_descarte?: string | null
          placar_alternativo?: string | null
          placar_alvo?: string | null
          score_qualidade?: number | null
          season?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      eventos_raros_config: {
        Row: {
          arena: string
          betfair_mode: string
          enabled: boolean
          id: string
          notify_telegram: boolean
          score_threshold: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arena: string
          betfair_mode?: string
          enabled?: boolean
          id?: string
          notify_telegram?: boolean
          score_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arena?: string
          betfair_mode?: string
          enabled?: boolean
          id?: string
          notify_telegram?: boolean
          score_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      eventos_raros_sinais: {
        Row: {
          candidato_id: string | null
          created_at: string | null
          id: string
          match_id: string
          minuto_entrada: number | null
          minuto_saida: number | null
          modo_betfair: string | null
          motivo_saida: string | null
          odd_entrada: number | null
          odd_saida: number | null
          placar_alvo: string
          placar_no_momento: string | null
          placar_saida: string | null
          profit_loss: number | null
          resultado: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          candidato_id?: string | null
          created_at?: string | null
          id?: string
          match_id: string
          minuto_entrada?: number | null
          minuto_saida?: number | null
          modo_betfair?: string | null
          motivo_saida?: string | null
          odd_entrada?: number | null
          odd_saida?: number | null
          placar_alvo: string
          placar_no_momento?: string | null
          placar_saida?: string | null
          profit_loss?: number | null
          resultado?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          candidato_id?: string | null
          created_at?: string | null
          id?: string
          match_id?: string
          minuto_entrada?: number | null
          minuto_saida?: number | null
          modo_betfair?: string | null
          motivo_saida?: string | null
          odd_entrada?: number | null
          odd_saida?: number | null
          placar_alvo?: string
          placar_no_momento?: string | null
          placar_saida?: string | null
          profit_loss?: number | null
          resultado?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_raros_sinais_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "eventos_raros_candidatos"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_stats_cache: {
        Row: {
          expires_at: string
          fetched_at: string
          fixture_id: string
          stats: Json | null
        }
        Insert: {
          expires_at?: string
          fetched_at?: string
          fixture_id: string
          stats?: Json | null
        }
        Update: {
          expires_at?: string
          fetched_at?: string
          fixture_id?: string
          stats?: Json | null
        }
        Relationships: []
      }
      futodds_health_log: {
        Row: {
          created_at: string
          endpoint: string
          error: string | null
          id: number
          items_count: number | null
          latency_ms: number | null
          leagues_count: number | null
          ok: boolean
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error?: string | null
          id?: number
          items_count?: number | null
          latency_ms?: number | null
          leagues_count?: number | null
          ok?: boolean
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: number
          items_count?: number | null
          latency_ms?: number | null
          leagues_count?: number | null
          ok?: boolean
          status_code?: number | null
        }
        Relationships: []
      }
      horus_audio_inventory: {
        Row: {
          audio_url: string | null
          cache_key: string | null
          categoria: string
          contexto: string[]
          created_at: string
          duration_seconds: number | null
          frequencia: Database["public"]["Enums"]["audio_frequency"]
          id: string
          is_generated: boolean
          texto: string
          updated_at: string
          voice_id: string
        }
        Insert: {
          audio_url?: string | null
          cache_key?: string | null
          categoria: string
          contexto?: string[]
          created_at?: string
          duration_seconds?: number | null
          frequencia?: Database["public"]["Enums"]["audio_frequency"]
          id?: string
          is_generated?: boolean
          texto: string
          updated_at?: string
          voice_id?: string
        }
        Update: {
          audio_url?: string | null
          cache_key?: string | null
          categoria?: string
          contexto?: string[]
          created_at?: string
          duration_seconds?: number | null
          frequencia?: Database["public"]["Enums"]["audio_frequency"]
          id?: string
          is_generated?: boolean
          texto?: string
          updated_at?: string
          voice_id?: string
        }
        Relationships: []
      }
      horus_punter_audio_plays: {
        Row: {
          audio_chave: string
          id: string
          played_at: string
          user_id: string
        }
        Insert: {
          audio_chave: string
          id?: string
          played_at?: string
          user_id: string
        }
        Update: {
          audio_chave?: string
          id?: string
          played_at?: string
          user_id?: string
        }
        Relationships: []
      }
      horus_trader_offers: {
        Row: {
          accepted: boolean | null
          created_at: string
          current_bankroll_at_offer: number
          day_offered: number
          id: string
          next_round_result: string | null
          offered_bankroll: number
          session_id: string
          trigger_type: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          current_bankroll_at_offer: number
          day_offered: number
          id?: string
          next_round_result?: string | null
          offered_bankroll: number
          session_id: string
          trigger_type: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          current_bankroll_at_offer?: number
          day_offered?: number
          id?: string
          next_round_result?: string | null
          offered_bankroll?: number
          session_id?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "horus_trader_offers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "arena_trader_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_bets: {
        Row: {
          bet_date: string | null
          bookmaker: string | null
          created_at: string | null
          event_name: string | null
          id: string
          import_batch_id: string | null
          market: string
          odd: number
          profit_loss: number | null
          raw_data: Json | null
          result: string | null
          selection: string | null
          settle_date: string | null
          source: string
          stake: number
          user_id: string
        }
        Insert: {
          bet_date?: string | null
          bookmaker?: string | null
          created_at?: string | null
          event_name?: string | null
          id?: string
          import_batch_id?: string | null
          market: string
          odd: number
          profit_loss?: number | null
          raw_data?: Json | null
          result?: string | null
          selection?: string | null
          settle_date?: string | null
          source?: string
          stake?: number
          user_id: string
        }
        Update: {
          bet_date?: string | null
          bookmaker?: string | null
          created_at?: string | null
          event_name?: string | null
          id?: string
          import_batch_id?: string | null
          market?: string
          odd?: number
          profit_loss?: number | null
          raw_data?: Json | null
          result?: string | null
          selection?: string | null
          settle_date?: string | null
          source?: string
          stake?: number
          user_id?: string
        }
        Relationships: []
      }
      league_id_map: {
        Row: {
          api_football_id: number
          created_at: string
          enabled: boolean
          name: string
          sportmonks_id: number
          updated_at: string
        }
        Insert: {
          api_football_id: number
          created_at?: string
          enabled?: boolean
          name: string
          sportmonks_id: number
          updated_at?: string
        }
        Update: {
          api_football_id?: number
          created_at?: string
          enabled?: boolean
          name?: string
          sportmonks_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      liga_mycroft_seed_users: {
        Row: {
          active: boolean
          bc_earned: number
          created_at: string
          display_name: string
          greens: number
          id: string
          is_horus: boolean
          reds: number
          total_bets: number
          total_returned: number
          total_staked: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          bc_earned?: number
          created_at?: string
          display_name: string
          greens?: number
          id?: string
          is_horus?: boolean
          reds?: number
          total_bets?: number
          total_returned?: number
          total_staked?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          bc_earned?: number
          created_at?: string
          display_name?: string
          greens?: number
          id?: string
          is_horus?: boolean
          reds?: number
          total_bets?: number
          total_returned?: number
          total_staked?: number
          updated_at?: string
        }
        Relationships: []
      }
      live_match_stats_overrides: {
        Row: {
          created_at: string
          edited_by: string | null
          match_id: string
          notes: string | null
          stats: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          edited_by?: string | null
          match_id: string
          notes?: string | null
          stats?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          edited_by?: string | null
          match_id?: string
          notes?: string | null
          stats?: Json
          updated_at?: string
        }
        Relationships: []
      }
      live_matches: {
        Row: {
          away_logo: string | null
          away_team: string
          championship: string
          created_at: string | null
          home_logo: string | null
          home_team: string
          id: string
          match_id: string
          minute: number | null
          mycroft_analysis_id: string | null
          mycroft_status: string | null
          odds_live: Json | null
          period: string | null
          score_away: number | null
          score_home: number | null
          stats: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          away_logo?: string | null
          away_team: string
          championship: string
          created_at?: string | null
          home_logo?: string | null
          home_team: string
          id?: string
          match_id: string
          minute?: number | null
          mycroft_analysis_id?: string | null
          mycroft_status?: string | null
          odds_live?: Json | null
          period?: string | null
          score_away?: number | null
          score_home?: number | null
          stats?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          away_logo?: string | null
          away_team?: string
          championship?: string
          created_at?: string | null
          home_logo?: string | null
          home_team?: string
          id?: string
          match_id?: string
          minute?: number | null
          mycroft_analysis_id?: string | null
          mycroft_status?: string | null
          odds_live?: Json | null
          period?: string | null
          score_away?: number | null
          score_home?: number | null
          stats?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_matches_mycroft_analysis_id_fkey"
            columns: ["mycroft_analysis_id"]
            isOneToOne: false
            referencedRelation: "mycroft_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sinais: {
        Row: {
          analysis_id: string | null
          approved_at_minute: number | null
          approved_at_period: string | null
          approved_at_score: string | null
          away_team: string | null
          championship: string | null
          confidence: number | null
          created_at: string
          goals_away: number | null
          goals_home: number | null
          home_team: string | null
          id: string
          market: string
          market_key: string | null
          match_date: string
          match_id: string
          odd: number | null
          profit_loss: number | null
          result: string | null
          settled_at: string | null
          stake: number
          updated_at: string
          verdict: string
        }
        Insert: {
          analysis_id?: string | null
          approved_at_minute?: number | null
          approved_at_period?: string | null
          approved_at_score?: string | null
          away_team?: string | null
          championship?: string | null
          confidence?: number | null
          created_at?: string
          goals_away?: number | null
          goals_home?: number | null
          home_team?: string | null
          id?: string
          market: string
          market_key?: string | null
          match_date: string
          match_id: string
          odd?: number | null
          profit_loss?: number | null
          result?: string | null
          settled_at?: string | null
          stake?: number
          updated_at?: string
          verdict: string
        }
        Update: {
          analysis_id?: string | null
          approved_at_minute?: number | null
          approved_at_period?: string | null
          approved_at_score?: string | null
          away_team?: string | null
          championship?: string | null
          confidence?: number | null
          created_at?: string
          goals_away?: number | null
          goals_home?: number | null
          home_team?: string | null
          id?: string
          market?: string
          market_key?: string | null
          match_date?: string
          match_id?: string
          odd?: number | null
          profit_loss?: number | null
          result?: string | null
          settled_at?: string | null
          stake?: number
          updated_at?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sinais_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "mycroft_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_bankroll: {
        Row: {
          balance: number | null
          created_at: string | null
          green_bets: number | null
          id: string
          initial_balance: number | null
          red_bets: number | null
          total_bets: number | null
          total_profit: number | null
          total_staked: number | null
          updated_at: string | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          green_bets?: number | null
          id?: string
          initial_balance?: number | null
          red_bets?: number | null
          total_bets?: number | null
          total_profit?: number | null
          total_staked?: number | null
          updated_at?: string | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          green_bets?: number | null
          id?: string
          initial_balance?: number | null
          red_bets?: number | null
          total_bets?: number | null
          total_profit?: number | null
          total_staked?: number | null
          updated_at?: string | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      market_analysis: {
        Row: {
          analyzed_at: string | null
          created_at: string | null
          id: string
          inefficiency_level: string | null
          market: string
          market_inefficiency_score: number | null
          match_id: string
          odd_current: number | null
          odd_open: number | null
          odds_drift_index: number | null
          prob_market: number
          prob_model: number
        }
        Insert: {
          analyzed_at?: string | null
          created_at?: string | null
          id?: string
          inefficiency_level?: string | null
          market: string
          market_inefficiency_score?: number | null
          match_id: string
          odd_current?: number | null
          odd_open?: number | null
          odds_drift_index?: number | null
          prob_market: number
          prob_model: number
        }
        Update: {
          analyzed_at?: string | null
          created_at?: string | null
          id?: string
          inefficiency_level?: string | null
          market?: string
          market_inefficiency_score?: number | null
          match_id?: string
          odd_current?: number | null
          odd_open?: number | null
          odds_drift_index?: number | null
          prob_market?: number
          prob_model?: number
        }
        Relationships: []
      }
      matches: {
        Row: {
          app_version: string | null
          created_at: string
          device_type: string | null
          difficulty_mode: string | null
          ended_at: string | null
          final_score: number | null
          game_mode: string
          id: string
          player_session_id: string | null
          player_user_id: string | null
          room_id: string | null
          rounds_completed: number | null
          started_at: string
          total_rounds: number | null
          user_agent: string | null
          was_completed: boolean | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_type?: string | null
          difficulty_mode?: string | null
          ended_at?: string | null
          final_score?: number | null
          game_mode?: string
          id?: string
          player_session_id?: string | null
          player_user_id?: string | null
          room_id?: string | null
          rounds_completed?: number | null
          started_at?: string
          total_rounds?: number | null
          user_agent?: string | null
          was_completed?: boolean | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_type?: string | null
          difficulty_mode?: string | null
          ended_at?: string | null
          final_score?: number | null
          game_mode?: string
          id?: string
          player_session_id?: string | null
          player_user_id?: string | null
          room_id?: string | null
          rounds_completed?: number | null
          started_at?: string
          total_rounds?: number | null
          user_agent?: string | null
          was_completed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      model_performance: {
        Row: {
          avg_asset_score: number | null
          avg_edge: number | null
          avg_odd: number | null
          created_at: string | null
          date: string
          id: string
          league: string | null
          losses: number
          market: string | null
          odd_range: string | null
          period: string
          profit: number | null
          roi: number | null
          total_bets: number
          win_rate: number | null
          wins: number
        }
        Insert: {
          avg_asset_score?: number | null
          avg_edge?: number | null
          avg_odd?: number | null
          created_at?: string | null
          date: string
          id?: string
          league?: string | null
          losses?: number
          market?: string | null
          odd_range?: string | null
          period: string
          profit?: number | null
          roi?: number | null
          total_bets?: number
          win_rate?: number | null
          wins?: number
        }
        Update: {
          avg_asset_score?: number | null
          avg_edge?: number | null
          avg_odd?: number | null
          created_at?: string | null
          date?: string
          id?: string
          league?: string | null
          losses?: number
          market?: string | null
          odd_range?: string | null
          period?: string
          profit?: number | null
          roi?: number | null
          total_bets?: number
          win_rate?: number | null
          wins?: number
        }
        Relationships: []
      }
      mycroft_alert_thresholds: {
        Row: {
          active: boolean
          divergence_threshold_pct: number
          id: string
          min_samples: number
          modo: string
          updated_at: string
          updated_by: string | null
          window_hours: number
        }
        Insert: {
          active?: boolean
          divergence_threshold_pct?: number
          id?: string
          min_samples?: number
          modo: string
          updated_at?: string
          updated_by?: string | null
          window_hours?: number
        }
        Update: {
          active?: boolean
          divergence_threshold_pct?: number
          id?: string
          min_samples?: number
          modo?: string
          updated_at?: string
          updated_by?: string | null
          window_hours?: number
        }
        Relationships: []
      }
      mycroft_analyses: {
        Row: {
          alerts: string[] | null
          approved_at_minute: number | null
          approved_at_period: string | null
          approved_at_score_away: number | null
          approved_at_score_home: number | null
          approved_at_timestamp: string | null
          confidence: number | null
          created_at: string | null
          final_score_away: number | null
          final_score_home: number | null
          fundamentation: Json | null
          id: string
          market: string
          match_id: string
          odd: number | null
          plan_name: string | null
          result: string | null
          risk_management: Json | null
          settle_reason: string | null
          settled_at: string | null
          stats_snapshot: Json | null
          thesis: string
          verdict: string
        }
        Insert: {
          alerts?: string[] | null
          approved_at_minute?: number | null
          approved_at_period?: string | null
          approved_at_score_away?: number | null
          approved_at_score_home?: number | null
          approved_at_timestamp?: string | null
          confidence?: number | null
          created_at?: string | null
          final_score_away?: number | null
          final_score_home?: number | null
          fundamentation?: Json | null
          id?: string
          market: string
          match_id: string
          odd?: number | null
          plan_name?: string | null
          result?: string | null
          risk_management?: Json | null
          settle_reason?: string | null
          settled_at?: string | null
          stats_snapshot?: Json | null
          thesis: string
          verdict: string
        }
        Update: {
          alerts?: string[] | null
          approved_at_minute?: number | null
          approved_at_period?: string | null
          approved_at_score_away?: number | null
          approved_at_score_home?: number | null
          approved_at_timestamp?: string | null
          confidence?: number | null
          created_at?: string | null
          final_score_away?: number | null
          final_score_home?: number | null
          fundamentation?: Json | null
          id?: string
          market?: string
          match_id?: string
          odd?: number | null
          plan_name?: string | null
          result?: string | null
          risk_management?: Json | null
          settle_reason?: string | null
          settled_at?: string | null
          stats_snapshot?: Json | null
          thesis?: string
          verdict?: string
        }
        Relationships: []
      }
      mycroft_analyses_shadow_af: {
        Row: {
          alerts: Json | null
          approved_at_minute: number | null
          approved_at_score_away: number | null
          approved_at_score_home: number | null
          confidence: number | null
          created_at: string
          final_score_away: number | null
          final_score_home: number | null
          fundamentation: Json | null
          id: string
          market: string | null
          match_id: string
          odd: number | null
          plan_name: string | null
          provider: string
          result: string | null
          risk_management: Json | null
          settle_reason: string | null
          settled_at: string | null
          stats_snapshot: Json | null
          thesis: string | null
          verdict: string
        }
        Insert: {
          alerts?: Json | null
          approved_at_minute?: number | null
          approved_at_score_away?: number | null
          approved_at_score_home?: number | null
          confidence?: number | null
          created_at?: string
          final_score_away?: number | null
          final_score_home?: number | null
          fundamentation?: Json | null
          id?: string
          market?: string | null
          match_id: string
          odd?: number | null
          plan_name?: string | null
          provider?: string
          result?: string | null
          risk_management?: Json | null
          settle_reason?: string | null
          settled_at?: string | null
          stats_snapshot?: Json | null
          thesis?: string | null
          verdict: string
        }
        Update: {
          alerts?: Json | null
          approved_at_minute?: number | null
          approved_at_score_away?: number | null
          approved_at_score_home?: number | null
          confidence?: number | null
          created_at?: string
          final_score_away?: number | null
          final_score_home?: number | null
          fundamentation?: Json | null
          id?: string
          market?: string | null
          match_id?: string
          odd?: number | null
          plan_name?: string | null
          provider?: string
          result?: string | null
          risk_management?: Json | null
          settle_reason?: string | null
          settled_at?: string | null
          stats_snapshot?: Json | null
          thesis?: string | null
          verdict?: string
        }
        Relationships: []
      }
      mycroft_analysis_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          match_id: string
          max_attempts: number
          payload: Json
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          match_id: string
          max_attempts?: number
          payload: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          match_id?: string
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mycroft_chat_access_attempts: {
        Row: {
          away_team: string | null
          created_at: string
          days_left: number | null
          email: string | null
          home_team: string | null
          id: string
          league: string | null
          match_id: string | null
          metadata: Json | null
          plan: string | null
          reason: string
          route: string | null
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          away_team?: string | null
          created_at?: string
          days_left?: number | null
          email?: string | null
          home_team?: string | null
          id?: string
          league?: string | null
          match_id?: string | null
          metadata?: Json | null
          plan?: string | null
          reason: string
          route?: string | null
          source: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          away_team?: string | null
          created_at?: string
          days_left?: number | null
          email?: string | null
          home_team?: string | null
          id?: string
          league?: string | null
          match_id?: string | null
          metadata?: Json | null
          plan?: string | null
          reason?: string
          route?: string | null
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mycroft_chat_logs: {
        Row: {
          away_team: string | null
          content: string
          created_at: string
          home_team: string | null
          id: string
          league: string | null
          match_id: string | null
          minute: number | null
          response_time_ms: number | null
          role: string
          score_away: number | null
          score_home: number | null
          tokens_estimated: number | null
          user_id: string
        }
        Insert: {
          away_team?: string | null
          content: string
          created_at?: string
          home_team?: string | null
          id?: string
          league?: string | null
          match_id?: string | null
          minute?: number | null
          response_time_ms?: number | null
          role: string
          score_away?: number | null
          score_home?: number | null
          tokens_estimated?: number | null
          user_id: string
        }
        Update: {
          away_team?: string | null
          content?: string
          created_at?: string
          home_team?: string | null
          id?: string
          league?: string | null
          match_id?: string | null
          minute?: number | null
          response_time_ms?: number | null
          role?: string
          score_away?: number | null
          score_home?: number | null
          tokens_estimated?: number | null
          user_id?: string
        }
        Relationships: []
      }
      mycroft_config: {
        Row: {
          description: string | null
          id: string
          key: string
          modo: Database["public"]["Enums"]["mycroft_modo"]
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          modo: Database["public"]["Enums"]["mycroft_modo"]
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          modo?: Database["public"]["Enums"]["mycroft_modo"]
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      mycroft_memory: {
        Row: {
          category: string
          context: string[]
          created_at: string
          id: string
          is_active: boolean
          mycroft_type: string
          priority: number
          rule_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          context?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          mycroft_type?: string
          priority?: number
          rule_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          context?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          mycroft_type?: string
          priority?: number
          rule_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mycroft_planos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          categoria: string
          codigo: string
          conceito: string | null
          criado_em: string | null
          criterios: Json
          emoji: string | null
          execucao: string | null
          id: string
          janela: string
          mercado: string
          nome: string
          observacao: string | null
          risco: string
          versao: number | null
          vetos: Json
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria: string
          codigo: string
          conceito?: string | null
          criado_em?: string | null
          criterios?: Json
          emoji?: string | null
          execucao?: string | null
          id?: string
          janela: string
          mercado: string
          nome: string
          observacao?: string | null
          risco: string
          versao?: number | null
          vetos?: Json
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          categoria?: string
          codigo?: string
          conceito?: string | null
          criado_em?: string | null
          criterios?: Json
          emoji?: string | null
          execucao?: string | null
          id?: string
          janela?: string
          mercado?: string
          nome?: string
          observacao?: string | null
          risco?: string
          versao?: number | null
          vetos?: Json
        }
        Relationships: []
      }
      mycroft_rules: {
        Row: {
          active: boolean
          category: string
          created_at: string
          field: string
          id: string
          mercado: string | null
          modo: Database["public"]["Enums"]["mycroft_modo"]
          name: string
          operator: string
          points: number | null
          priority: number
          time_end: number | null
          time_start: number | null
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          field: string
          id?: string
          mercado?: string | null
          modo: Database["public"]["Enums"]["mycroft_modo"]
          name: string
          operator: string
          points?: number | null
          priority?: number
          time_end?: number | null
          time_start?: number | null
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          field?: string
          id?: string
          mercado?: string | null
          modo?: Database["public"]["Enums"]["mycroft_modo"]
          name?: string
          operator?: string
          points?: number | null
          priority?: number
          time_end?: number | null
          time_start?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      mycroft_rules_history: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          changed_fields: string[] | null
          created_at: string
          diff: Json | null
          id: string
          modo: string | null
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          changed_fields?: string[] | null
          created_at?: string
          diff?: Json | null
          id?: string
          modo?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          changed_fields?: string[] | null
          created_at?: string
          diff?: Json | null
          id?: string
          modo?: string | null
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      mycroft_settlement_log: {
        Row: {
          analysis_id: string | null
          created_at: string
          error_message: string | null
          id: string
          market: string | null
          match_id: string | null
          outcome: string | null
          reason: string | null
          result: string | null
          score_away: number | null
          score_home: number | null
          status_new: string | null
          status_old: string | null
          total_goals: number | null
          trigger_source: string | null
          verdict: string | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          market?: string | null
          match_id?: string | null
          outcome?: string | null
          reason?: string | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          status_new?: string | null
          status_old?: string | null
          total_goals?: number | null
          trigger_source?: string | null
          verdict?: string | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          market?: string | null
          match_id?: string | null
          outcome?: string | null
          reason?: string | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          status_new?: string | null
          status_old?: string | null
          total_goals?: number | null
          trigger_source?: string | null
          verdict?: string | null
        }
        Relationships: []
      }
      mycroft_vetoed_log: {
        Row: {
          confianca_recebida: number | null
          created_at: string | null
          edge_recebido: number | null
          id: string
          jogo: string | null
          liga: string | null
          mercado: string | null
          motivo_veto: string | null
          odd: number | null
          raw_response: Json | null
          user_id: string | null
          verdict_gemini: string | null
        }
        Insert: {
          confianca_recebida?: number | null
          created_at?: string | null
          edge_recebido?: number | null
          id?: string
          jogo?: string | null
          liga?: string | null
          mercado?: string | null
          motivo_veto?: string | null
          odd?: number | null
          raw_response?: Json | null
          user_id?: string | null
          verdict_gemini?: string | null
        }
        Update: {
          confianca_recebida?: number | null
          created_at?: string | null
          edge_recebido?: number | null
          id?: string
          jogo?: string | null
          liga?: string | null
          mercado?: string | null
          motivo_veto?: string | null
          odd?: number | null
          raw_response?: Json | null
          user_id?: string | null
          verdict_gemini?: string | null
        }
        Relationships: []
      }
      plano_favorito_runs: {
        Row: {
          created_at: string
          detalhes: Json | null
          duracao_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          jogos_analisados: number | null
          ok: boolean | null
          sinais_bons: number | null
          sinais_espelhados: number | null
          sinais_falha_mirror: number | null
          sinais_fortes: number | null
          started_at: string
          trigger_source: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          duracao_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          jogos_analisados?: number | null
          ok?: boolean | null
          sinais_bons?: number | null
          sinais_espelhados?: number | null
          sinais_falha_mirror?: number | null
          sinais_fortes?: number | null
          started_at?: string
          trigger_source?: string
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          duracao_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          jogos_analisados?: number | null
          ok?: boolean | null
          sinais_bons?: number | null
          sinais_espelhados?: number | null
          sinais_falha_mirror?: number | null
          sinais_fortes?: number | null
          started_at?: string
          trigger_source?: string
        }
        Relationships: []
      }
      poisson_log: {
        Row: {
          created_at: string | null
          dados_reais: boolean | null
          edges_positivos: Json | null
          id: string
          jogo: string | null
          lambda_casa: number | null
          lambda_visitante: number | null
          liga: string | null
          prob_btts: number | null
          prob_casa: number | null
          prob_empate: number | null
          prob_over25: number | null
          prob_visitante: number | null
        }
        Insert: {
          created_at?: string | null
          dados_reais?: boolean | null
          edges_positivos?: Json | null
          id?: string
          jogo?: string | null
          lambda_casa?: number | null
          lambda_visitante?: number | null
          liga?: string | null
          prob_btts?: number | null
          prob_casa?: number | null
          prob_empate?: number | null
          prob_over25?: number | null
          prob_visitante?: number | null
        }
        Update: {
          created_at?: string | null
          dados_reais?: boolean | null
          edges_positivos?: Json | null
          id?: string
          jogo?: string | null
          lambda_casa?: number | null
          lambda_visitante?: number | null
          liga?: string | null
          prob_btts?: number | null
          prob_casa?: number | null
          prob_empate?: number | null
          prob_over25?: number | null
          prob_visitante?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bc_balance: number
          bluff_coins: number
          created_at: string
          daily_streak_count: number
          full_name: string | null
          id: string
          last_daily_bonus: string | null
          last_streak_date: string | null
          matches_played: number
          nt_balance: number
          rank_title: string
          sports_training_completed: boolean
          sports_training_completed_at: string | null
          tutorial_read_at: string | null
          updated_at: string
          user_id: string
          username: string
          wins: number
        }
        Insert: {
          bc_balance?: number
          bluff_coins?: number
          created_at?: string
          daily_streak_count?: number
          full_name?: string | null
          id?: string
          last_daily_bonus?: string | null
          last_streak_date?: string | null
          matches_played?: number
          nt_balance?: number
          rank_title?: string
          sports_training_completed?: boolean
          sports_training_completed_at?: string | null
          tutorial_read_at?: string | null
          updated_at?: string
          user_id: string
          username: string
          wins?: number
        }
        Update: {
          bc_balance?: number
          bluff_coins?: number
          created_at?: string
          daily_streak_count?: number
          full_name?: string | null
          id?: string
          last_daily_bonus?: string | null
          last_streak_date?: string | null
          matches_played?: number
          nt_balance?: number
          rank_title?: string
          sports_training_completed?: boolean
          sports_training_completed_at?: string | null
          tutorial_read_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          wins?: number
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          partner_name: string
          trial_days: number
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          partner_name: string
          trial_days?: number
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          partner_name?: string
          trial_days?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          created_at: string
          id: string
          partner_name: string
          promo_code_id: string | null
          referral_source: string | null
          trial_days_granted: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_name: string
          promo_code_id?: string | null
          referral_source?: string | null
          trial_days_granted?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_name?: string
          promo_code_id?: string | null
          referral_source?: string | null
          trial_days_granted?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_slot_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          promo_id: string
          slots_after: number
          slots_before: number
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          promo_id: string
          slots_after: number
          slots_before: number
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          promo_id?: string
          slots_after?: number
          slots_before?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_slot_events_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_slots: {
        Row: {
          campaign_name: string
          created_at: string
          id: string
          is_active: boolean
          slots_remaining: number
          slots_total: number
          updated_at: string
        }
        Insert: {
          campaign_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          slots_remaining?: number
          slots_total?: number
          updated_at?: string
        }
        Update: {
          campaign_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          slots_remaining?: number
          slots_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      punter_analyses: {
        Row: {
          analysis: string | null
          analyzed_by: string | null
          away_team: string
          bookmaker: string
          commence_time: string
          confidence: number | null
          created_at: string | null
          email_sent_at: string | null
          estimated_probability: number | null
          fair_odd: number | null
          final_score_away: number | null
          final_score_home: number | null
          green_telegram_sent_at: string | null
          home_team: string
          id: string
          implied_probability: number | null
          last_settle_attempt_at: string | null
          league: string
          market: string
          match_id: string
          odd: number
          profit_loss: number | null
          result: string | null
          risk_factors: string | null
          sent_green_to_telegram: boolean
          sent_to_email: boolean | null
          sent_to_telegram: boolean | null
          settle_attempts: number
          settled_at: string | null
          stake_percentage: number | null
          telegram_sent_at: string | null
          thesis: string | null
          value_percentage: number | null
          verdict: string
        }
        Insert: {
          analysis?: string | null
          analyzed_by?: string | null
          away_team: string
          bookmaker: string
          commence_time: string
          confidence?: number | null
          created_at?: string | null
          email_sent_at?: string | null
          estimated_probability?: number | null
          fair_odd?: number | null
          final_score_away?: number | null
          final_score_home?: number | null
          green_telegram_sent_at?: string | null
          home_team: string
          id?: string
          implied_probability?: number | null
          last_settle_attempt_at?: string | null
          league: string
          market: string
          match_id: string
          odd: number
          profit_loss?: number | null
          result?: string | null
          risk_factors?: string | null
          sent_green_to_telegram?: boolean
          sent_to_email?: boolean | null
          sent_to_telegram?: boolean | null
          settle_attempts?: number
          settled_at?: string | null
          stake_percentage?: number | null
          telegram_sent_at?: string | null
          thesis?: string | null
          value_percentage?: number | null
          verdict: string
        }
        Update: {
          analysis?: string | null
          analyzed_by?: string | null
          away_team?: string
          bookmaker?: string
          commence_time?: string
          confidence?: number | null
          created_at?: string | null
          email_sent_at?: string | null
          estimated_probability?: number | null
          fair_odd?: number | null
          final_score_away?: number | null
          final_score_home?: number | null
          green_telegram_sent_at?: string | null
          home_team?: string
          id?: string
          implied_probability?: number | null
          last_settle_attempt_at?: string | null
          league?: string
          market?: string
          match_id?: string
          odd?: number
          profit_loss?: number | null
          result?: string | null
          risk_factors?: string | null
          sent_green_to_telegram?: boolean
          sent_to_email?: boolean | null
          sent_to_telegram?: boolean | null
          settle_attempts?: number
          settled_at?: string | null
          stake_percentage?: number | null
          telegram_sent_at?: string | null
          thesis?: string | null
          value_percentage?: number | null
          verdict?: string
        }
        Relationships: []
      }
      punter_bucket_calibration: {
        Row: {
          accuracy_gap_pp: number
          brier_score: number | null
          bucket_key: string
          expected_hit_rate: number
          hit_rate: number
          market_family: string
          odd_bucket: string
          roi: number
          sample_size: number
          updated_at: string
        }
        Insert: {
          accuracy_gap_pp?: number
          brier_score?: number | null
          bucket_key: string
          expected_hit_rate?: number
          hit_rate?: number
          market_family: string
          odd_bucket: string
          roi?: number
          sample_size?: number
          updated_at?: string
        }
        Update: {
          accuracy_gap_pp?: number
          brier_score?: number | null
          bucket_key?: string
          expected_hit_rate?: number
          hit_rate?: number
          market_family?: string
          odd_bucket?: string
          roi?: number
          sample_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      punter_calibration: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          min_confidence: number
          min_edge: number
          min_probability: number
          notes: string | null
          odd_max: number
          odd_min: number
          target_roi: number
          target_win_rate: number
          tier1_max_stake: number
          tier1_min_conf: number
          tier1_min_edge: number
          tier1_min_prob: number
          tier2_max_stake: number
          tier2_min_conf: number
          tier2_min_edge: number
          tier2_min_prob: number
          tier3_max_stake: number
          tier3_min_conf: number
          tier3_min_edge: number
          tier3_min_prob: number
          tolerance_pp: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_confidence?: number
          min_edge?: number
          min_probability?: number
          notes?: string | null
          odd_max?: number
          odd_min?: number
          target_roi?: number
          target_win_rate?: number
          tier1_max_stake?: number
          tier1_min_conf?: number
          tier1_min_edge?: number
          tier1_min_prob?: number
          tier2_max_stake?: number
          tier2_min_conf?: number
          tier2_min_edge?: number
          tier2_min_prob?: number
          tier3_max_stake?: number
          tier3_min_conf?: number
          tier3_min_edge?: number
          tier3_min_prob?: number
          tolerance_pp?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_confidence?: number
          min_edge?: number
          min_probability?: number
          notes?: string | null
          odd_max?: number
          odd_min?: number
          target_roi?: number
          target_win_rate?: number
          tier1_max_stake?: number
          tier1_min_conf?: number
          tier1_min_edge?: number
          tier1_min_prob?: number
          tier2_max_stake?: number
          tier2_min_conf?: number
          tier2_min_edge?: number
          tier2_min_prob?: number
          tier3_max_stake?: number
          tier3_min_conf?: number
          tier3_min_edge?: number
          tier3_min_prob?: number
          tolerance_pp?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      punter_clv_log: {
        Row: {
          away_team: string | null
          bookmaker_edge_pp: number | null
          bookmaker_odd: number | null
          close_back_odd: number | null
          close_captured_at: string | null
          close_lay_odd: number | null
          close_mid_odd: number | null
          clv_pp: number | null
          commence_time: string | null
          created_at: string
          demoted_by_exchange: boolean | null
          estimated_probability: number | null
          exchange_source: string | null
          futodds_event_id: string | null
          home_team: string | null
          id: string
          market: string
          match_id: string
          open_back_odd: number | null
          open_captured_at: string
          open_edge_pp: number | null
          open_fair_prob: number | null
          open_lay_odd: number | null
          open_mid_odd: number | null
        }
        Insert: {
          away_team?: string | null
          bookmaker_edge_pp?: number | null
          bookmaker_odd?: number | null
          close_back_odd?: number | null
          close_captured_at?: string | null
          close_lay_odd?: number | null
          close_mid_odd?: number | null
          clv_pp?: number | null
          commence_time?: string | null
          created_at?: string
          demoted_by_exchange?: boolean | null
          estimated_probability?: number | null
          exchange_source?: string | null
          futodds_event_id?: string | null
          home_team?: string | null
          id?: string
          market: string
          match_id: string
          open_back_odd?: number | null
          open_captured_at?: string
          open_edge_pp?: number | null
          open_fair_prob?: number | null
          open_lay_odd?: number | null
          open_mid_odd?: number | null
        }
        Update: {
          away_team?: string | null
          bookmaker_edge_pp?: number | null
          bookmaker_odd?: number | null
          close_back_odd?: number | null
          close_captured_at?: string | null
          close_lay_odd?: number | null
          close_mid_odd?: number | null
          clv_pp?: number | null
          commence_time?: string | null
          created_at?: string
          demoted_by_exchange?: boolean | null
          estimated_probability?: number | null
          exchange_source?: string | null
          futodds_event_id?: string | null
          home_team?: string | null
          id?: string
          market?: string
          match_id?: string
          open_back_odd?: number | null
          open_captured_at?: string
          open_edge_pp?: number | null
          open_fair_prob?: number | null
          open_lay_odd?: number | null
          open_mid_odd?: number | null
        }
        Relationships: []
      }
      punter_quarantine: {
        Row: {
          active_until: string
          created_at: string
          id: string
          league: string | null
          market_family: string
          metric_value: number | null
          odd_bucket: string
          reason: string
          sample_size: number | null
          scope_key: string
        }
        Insert: {
          active_until: string
          created_at?: string
          id?: string
          league?: string | null
          market_family: string
          metric_value?: number | null
          odd_bucket: string
          reason: string
          sample_size?: number | null
          scope_key: string
        }
        Update: {
          active_until?: string
          created_at?: string
          id?: string
          league?: string | null
          market_family?: string
          metric_value?: number | null
          odd_bucket?: string
          reason?: string
          sample_size?: number | null
          scope_key?: string
        }
        Relationships: []
      }
      punter_rankings: {
        Row: {
          best_streak: number
          created_at: string
          current_streak: number
          green_bets: number
          id: string
          max_drawdown: number
          profit_factor: number
          red_bets: number
          roi: number
          sharpe_ratio: number
          total_bets: number
          total_profit: number
          total_staked: number
          updated_at: string
          user_id: string
          username: string
          win_rate: number
        }
        Insert: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          green_bets?: number
          id?: string
          max_drawdown?: number
          profit_factor?: number
          red_bets?: number
          roi?: number
          sharpe_ratio?: number
          total_bets?: number
          total_profit?: number
          total_staked?: number
          updated_at?: string
          user_id: string
          username?: string
          win_rate?: number
        }
        Update: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          green_bets?: number
          id?: string
          max_drawdown?: number
          profit_factor?: number
          red_bets?: number
          roi?: number
          sharpe_ratio?: number
          total_bets?: number
          total_profit?: number
          total_staked?: number
          updated_at?: string
          user_id?: string
          username?: string
          win_rate?: number
        }
        Relationships: []
      }
      punter_signals: {
        Row: {
          analysis_id: string | null
          bankroll_at_recalc: number | null
          bookmaker: string
          commence_time: string | null
          created_at: string | null
          dismissed: boolean | null
          dismissed_at: string | null
          id: string
          market: string
          match_date: string | null
          match_id: string
          odd: number
          profit_loss: number | null
          red_card_away: boolean | null
          red_card_home: boolean | null
          result: string | null
          resulted_at: string | null
          score_away: number | null
          score_home: number | null
          sent_at: string | null
          stake_amount: number | null
          stake_confirmed: boolean | null
          stake_percentage: number | null
          stake_percentage_original: number | null
          stake_recalculated_at: string | null
          status: string | null
          updated_at: string | null
          value_percentage: number | null
        }
        Insert: {
          analysis_id?: string | null
          bankroll_at_recalc?: number | null
          bookmaker: string
          commence_time?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          dismissed_at?: string | null
          id?: string
          market: string
          match_date?: string | null
          match_id: string
          odd: number
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          result?: string | null
          resulted_at?: string | null
          score_away?: number | null
          score_home?: number | null
          sent_at?: string | null
          stake_amount?: number | null
          stake_confirmed?: boolean | null
          stake_percentage?: number | null
          stake_percentage_original?: number | null
          stake_recalculated_at?: string | null
          status?: string | null
          updated_at?: string | null
          value_percentage?: number | null
        }
        Update: {
          analysis_id?: string | null
          bankroll_at_recalc?: number | null
          bookmaker?: string
          commence_time?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          dismissed_at?: string | null
          id?: string
          market?: string
          match_date?: string | null
          match_id?: string
          odd?: number
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          result?: string | null
          resulted_at?: string | null
          score_away?: number | null
          score_home?: number | null
          sent_at?: string | null
          stake_amount?: number | null
          stake_confirmed?: boolean | null
          stake_percentage?: number | null
          stake_percentage_original?: number | null
          stake_recalculated_at?: string | null
          status?: string | null
          updated_at?: string | null
          value_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "punter_signals_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "punter_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      punter_sinais: {
        Row: {
          analysis: string | null
          analyzed_by: string | null
          away_team: string
          bankroll_at_recalc: number | null
          bookmaker: string | null
          commence_time: string
          confidence: number | null
          created_at: string
          dismissed: boolean
          dismissed_at: string | null
          email_sent_at: string | null
          estimated_probability: number | null
          fair_odd: number | null
          final_score_away: number | null
          final_score_home: number | null
          fonte_liquidacao: string | null
          green_telegram_sent_at: string | null
          home_team: string
          id: string
          implied_probability: number | null
          last_settle_attempt_at: string | null
          league: string | null
          legacy_analysis_id: string | null
          legacy_signal_id: string | null
          market: string
          match_date: string | null
          match_id: string
          odd: number | null
          profit_loss: number | null
          red_card_away: boolean | null
          red_card_home: boolean | null
          resultado: string | null
          resulted_at: string | null
          risk_factors: string | null
          sent_green_to_telegram: boolean
          sent_to_email: boolean
          sent_to_telegram: boolean
          settle_attempts: number
          settled_at: string | null
          stake_amount: number | null
          stake_confirmed: boolean
          stake_percentage: number | null
          stake_percentage_original: number | null
          stake_recalculated_at: string | null
          status: string
          telegram_sent_at: string | null
          thesis: string | null
          updated_at: string
          value_percentage: number | null
          verdict: string | null
          void_reason: string | null
        }
        Insert: {
          analysis?: string | null
          analyzed_by?: string | null
          away_team: string
          bankroll_at_recalc?: number | null
          bookmaker?: string | null
          commence_time: string
          confidence?: number | null
          created_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          email_sent_at?: string | null
          estimated_probability?: number | null
          fair_odd?: number | null
          final_score_away?: number | null
          final_score_home?: number | null
          fonte_liquidacao?: string | null
          green_telegram_sent_at?: string | null
          home_team: string
          id?: string
          implied_probability?: number | null
          last_settle_attempt_at?: string | null
          league?: string | null
          legacy_analysis_id?: string | null
          legacy_signal_id?: string | null
          market: string
          match_date?: string | null
          match_id: string
          odd?: number | null
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          resultado?: string | null
          resulted_at?: string | null
          risk_factors?: string | null
          sent_green_to_telegram?: boolean
          sent_to_email?: boolean
          sent_to_telegram?: boolean
          settle_attempts?: number
          settled_at?: string | null
          stake_amount?: number | null
          stake_confirmed?: boolean
          stake_percentage?: number | null
          stake_percentage_original?: number | null
          stake_recalculated_at?: string | null
          status?: string
          telegram_sent_at?: string | null
          thesis?: string | null
          updated_at?: string
          value_percentage?: number | null
          verdict?: string | null
          void_reason?: string | null
        }
        Update: {
          analysis?: string | null
          analyzed_by?: string | null
          away_team?: string
          bankroll_at_recalc?: number | null
          bookmaker?: string | null
          commence_time?: string
          confidence?: number | null
          created_at?: string
          dismissed?: boolean
          dismissed_at?: string | null
          email_sent_at?: string | null
          estimated_probability?: number | null
          fair_odd?: number | null
          final_score_away?: number | null
          final_score_home?: number | null
          fonte_liquidacao?: string | null
          green_telegram_sent_at?: string | null
          home_team?: string
          id?: string
          implied_probability?: number | null
          last_settle_attempt_at?: string | null
          league?: string | null
          legacy_analysis_id?: string | null
          legacy_signal_id?: string | null
          market?: string
          match_date?: string | null
          match_id?: string
          odd?: number | null
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          resultado?: string | null
          resulted_at?: string | null
          risk_factors?: string | null
          sent_green_to_telegram?: boolean
          sent_to_email?: boolean
          sent_to_telegram?: boolean
          settle_attempts?: number
          settled_at?: string | null
          stake_amount?: number | null
          stake_confirmed?: boolean
          stake_percentage?: number | null
          stake_percentage_original?: number | null
          stake_recalculated_at?: string | null
          status?: string
          telegram_sent_at?: string | null
          thesis?: string | null
          updated_at?: string
          value_percentage?: number | null
          verdict?: string | null
          void_reason?: string | null
        }
        Relationships: []
      }
      punter_steam_signals: {
        Row: {
          close_mid_odd: number | null
          detected_at: string
          direction: string
          drift_pct: number
          futodds_event_id: string | null
          id: string
          market: string
          match_id: string
          open_mid_odd: number | null
          window_minutes: number
        }
        Insert: {
          close_mid_odd?: number | null
          detected_at?: string
          direction: string
          drift_pct: number
          futodds_event_id?: string | null
          id?: string
          market: string
          match_id: string
          open_mid_odd?: number | null
          window_minutes: number
        }
        Update: {
          close_mid_odd?: number | null
          detected_at?: string
          direction?: string
          drift_pct?: number
          futodds_event_id?: string | null
          id?: string
          market?: string
          match_id?: string
          open_mid_odd?: number | null
          window_minutes?: number
        }
        Relationships: []
      }
      punter_steam_snapshots: {
        Row: {
          back_odd: number | null
          captured_at: string
          futodds_event_id: string
          id: string
          lay_odd: number | null
          market: string
          mid_odd: number | null
          side: string | null
        }
        Insert: {
          back_odd?: number | null
          captured_at?: string
          futodds_event_id: string
          id?: string
          lay_odd?: number | null
          market: string
          mid_odd?: number | null
          side?: string | null
        }
        Update: {
          back_odd?: number | null
          captured_at?: string
          futodds_event_id?: string
          id?: string
          lay_odd?: number | null
          market?: string
          mid_odd?: number | null
          side?: string | null
        }
        Relationships: []
      }
      purchase_events: {
        Row: {
          amount: number | null
          created_at: string
          customer_email: string | null
          event_type: string
          external_order_id: string | null
          id: string
          plan_resolved: string | null
          process_error: string | null
          processed: boolean
          product_name: string | null
          provider: string
          raw_payload: Json
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          customer_email?: string | null
          event_type: string
          external_order_id?: string | null
          id?: string
          plan_resolved?: string | null
          process_error?: string | null
          processed?: boolean
          product_name?: string | null
          provider: string
          raw_payload: Json
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          customer_email?: string | null
          event_type?: string
          external_order_id?: string | null
          id?: string
          plan_resolved?: string | null
          process_error?: string | null
          processed?: boolean
          product_name?: string | null
          provider?: string
          raw_payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rankings: {
        Row: {
          bluffs_detected: number
          created_at: string
          id: string
          nickname: string
          session_id: string
          successful_bluffs: number
          times_fooled: number
          total_games: number
          total_points: number
          total_wins: number
          updated_at: string
        }
        Insert: {
          bluffs_detected?: number
          created_at?: string
          id?: string
          nickname: string
          session_id: string
          successful_bluffs?: number
          times_fooled?: number
          total_games?: number
          total_points?: number
          total_wins?: number
          updated_at?: string
        }
        Update: {
          bluffs_detected?: number
          created_at?: string
          id?: string
          nickname?: string
          session_id?: string
          successful_bluffs?: number
          times_fooled?: number
          total_games?: number
          total_points?: number
          total_wins?: number
          updated_at?: string
        }
        Relationships: []
      }
      room_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          room_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          room_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          current_audio_url: string | null
          current_player_index: number
          current_question_id: string | null
          current_status: Database["public"]["Enums"]["room_status"]
          game_mode: string
          host_id: string
          id: string
          mode: string | null
          pin: string
        }
        Insert: {
          created_at?: string
          current_audio_url?: string | null
          current_player_index?: number
          current_question_id?: string | null
          current_status?: Database["public"]["Enums"]["room_status"]
          game_mode?: string
          host_id: string
          id?: string
          mode?: string | null
          pin: string
        }
        Update: {
          created_at?: string
          current_audio_url?: string | null
          current_player_index?: number
          current_question_id?: string | null
          current_status?: Database["public"]["Enums"]["room_status"]
          game_mode?: string
          host_id?: string
          id?: string
          mode?: string | null
          pin?: string
        }
        Relationships: []
      }
      scheduled_games: {
        Row: {
          away_team: string
          check_time: string
          created_at: string | null
          event_id: string | null
          home_team: string
          id: string
          league_name: string
          match_date: string
          match_datetime: string
          match_id: string | null
          match_time: string
          relevance_score: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          away_team: string
          check_time: string
          created_at?: string | null
          event_id?: string | null
          home_team: string
          id?: string
          league_name: string
          match_date: string
          match_datetime: string
          match_id?: string | null
          match_time: string
          relevance_score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          away_team?: string
          check_time?: string
          created_at?: string | null
          event_id?: string | null
          home_team?: string
          id?: string
          league_name?: string
          match_date?: string
          match_datetime?: string
          match_id?: string | null
          match_time?: string
          relevance_score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      seo_rodadas_publicadas: {
        Row: {
          championship: string
          from_date: string
          id: number
          public_url: string
          published_at: string
          rodada: number
          signals_count: number
          storage_path: string
          to_date: string
          updated_at: string
        }
        Insert: {
          championship?: string
          from_date: string
          id?: number
          public_url: string
          published_at?: string
          rodada: number
          signals_count?: number
          storage_path: string
          to_date: string
          updated_at?: string
        }
        Update: {
          championship?: string
          from_date?: string
          id?: number
          public_url?: string
          published_at?: string
          rodada?: number
          signals_count?: number
          storage_path?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      sharp_money_signals: {
        Row: {
          created_at: string | null
          detected_at: string | null
          has_consensus: boolean | null
          has_rlm: boolean | null
          has_steam: boolean | null
          id: string
          market: string
          match_id: string
          odd_current: number | null
          odd_movement_pct: number | null
          odd_open: number | null
          sharp_activity_score: number | null
        }
        Insert: {
          created_at?: string | null
          detected_at?: string | null
          has_consensus?: boolean | null
          has_rlm?: boolean | null
          has_steam?: boolean | null
          id?: string
          market: string
          match_id: string
          odd_current?: number | null
          odd_movement_pct?: number | null
          odd_open?: number | null
          sharp_activity_score?: number | null
        }
        Update: {
          created_at?: string | null
          detected_at?: string | null
          has_consensus?: boolean | null
          has_rlm?: boolean | null
          has_steam?: boolean | null
          id?: string
          market?: string
          match_id?: string
          odd_current?: number | null
          odd_movement_pct?: number | null
          odd_open?: number | null
          sharp_activity_score?: number | null
        }
        Relationships: []
      }
      sherlock_audit_log: {
        Row: {
          analysis_id: string | null
          away_id: number | null
          away_stats: Json | null
          away_team: string
          bonus: Json
          confidence_delta: number
          created_at: string
          home_id: number | null
          home_stats: Json | null
          home_team: string
          id: string
          market: string | null
          notes: Json
          plan_name: string | null
          request_payload: Json | null
          season: number | null
          user_id: string | null
          veto: boolean
          veto_reason: string | null
          vetos: Json
        }
        Insert: {
          analysis_id?: string | null
          away_id?: number | null
          away_stats?: Json | null
          away_team: string
          bonus?: Json
          confidence_delta?: number
          created_at?: string
          home_id?: number | null
          home_stats?: Json | null
          home_team: string
          id?: string
          market?: string | null
          notes?: Json
          plan_name?: string | null
          request_payload?: Json | null
          season?: number | null
          user_id?: string | null
          veto?: boolean
          veto_reason?: string | null
          vetos?: Json
        }
        Update: {
          analysis_id?: string | null
          away_id?: number | null
          away_stats?: Json | null
          away_team?: string
          bonus?: Json
          confidence_delta?: number
          created_at?: string
          home_id?: number | null
          home_stats?: Json | null
          home_team?: string
          id?: string
          market?: string | null
          notes?: Json
          plan_name?: string | null
          request_payload?: Json | null
          season?: number | null
          user_id?: string | null
          veto?: boolean
          veto_reason?: string | null
          vetos?: Json
        }
        Relationships: []
      }
      signals_sent: {
        Row: {
          analysis_id: string | null
          created_at: string | null
          id: string
          match_id: string | null
          sent_telegram: boolean | null
          sent_whatsapp: boolean | null
          user_id: string | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string | null
          id?: string
          match_id?: string | null
          sent_telegram?: boolean | null
          sent_whatsapp?: boolean | null
          user_id?: string | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string | null
          id?: string
          match_id?: string | null
          sent_telegram?: boolean | null
          sent_whatsapp?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signals_sent_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "mycroft_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      sinais_favorito_prelive: {
        Row: {
          away_team: string
          created_at: string
          fav_odd: number | null
          fav_venceu: boolean | null
          favorito: string | null
          fixture_id: string
          gols_ft: number | null
          gols_ht: number | null
          home_team: string
          id: string
          indicadores: Json | null
          league_id: number | null
          league_name: string | null
          match_date: string | null
          resultado_over15: string | null
          resultado_over25: string | null
          resultado_vitoria: string | null
          score_over15: number | null
          score_over25: number | null
          score_vitoria: number | null
          status_over15: string | null
          status_over25: string | null
          status_vitoria: string | null
          und_odd: number | null
          updated_at: string
        }
        Insert: {
          away_team: string
          created_at?: string
          fav_odd?: number | null
          fav_venceu?: boolean | null
          favorito?: string | null
          fixture_id: string
          gols_ft?: number | null
          gols_ht?: number | null
          home_team: string
          id?: string
          indicadores?: Json | null
          league_id?: number | null
          league_name?: string | null
          match_date?: string | null
          resultado_over15?: string | null
          resultado_over25?: string | null
          resultado_vitoria?: string | null
          score_over15?: number | null
          score_over25?: number | null
          score_vitoria?: number | null
          status_over15?: string | null
          status_over25?: string | null
          status_vitoria?: string | null
          und_odd?: number | null
          updated_at?: string
        }
        Update: {
          away_team?: string
          created_at?: string
          fav_odd?: number | null
          fav_venceu?: boolean | null
          favorito?: string | null
          fixture_id?: string
          gols_ft?: number | null
          gols_ht?: number | null
          home_team?: string
          id?: string
          indicadores?: Json | null
          league_id?: number | null
          league_name?: string | null
          match_date?: string | null
          resultado_over15?: string | null
          resultado_over25?: string | null
          resultado_vitoria?: string | null
          score_over15?: number | null
          score_over25?: number | null
          score_vitoria?: number | null
          status_over15?: string | null
          status_over25?: string | null
          status_vitoria?: string | null
          und_odd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sinais_handicap_prelive: {
        Row: {
          ai_analysis: string | null
          away_team: string
          created_at: string | null
          diferenca_gols: number | null
          fav_odd: number | null
          favorito: string | null
          fixture_id: string
          gols_fav: number | null
          gols_und: number | null
          ha_type: string | null
          home_team: string
          id: string
          indicadores: Json | null
          league_id: number | null
          league_name: string | null
          linha: string
          liquidacao: string | null
          match_date: string | null
          odd_ha: number | null
          resultado_ha: string | null
          score_ha: number | null
          status_ha: string | null
          und_odd: number | null
          underdog: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_analysis?: string | null
          away_team: string
          created_at?: string | null
          diferenca_gols?: number | null
          fav_odd?: number | null
          favorito?: string | null
          fixture_id: string
          gols_fav?: number | null
          gols_und?: number | null
          ha_type?: string | null
          home_team: string
          id?: string
          indicadores?: Json | null
          league_id?: number | null
          league_name?: string | null
          linha: string
          liquidacao?: string | null
          match_date?: string | null
          odd_ha?: number | null
          resultado_ha?: string | null
          score_ha?: number | null
          status_ha?: string | null
          und_odd?: number | null
          underdog?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_analysis?: string | null
          away_team?: string
          created_at?: string | null
          diferenca_gols?: number | null
          fav_odd?: number | null
          favorito?: string | null
          fixture_id?: string
          gols_fav?: number | null
          gols_und?: number | null
          ha_type?: string | null
          home_team?: string
          id?: string
          indicadores?: Json | null
          league_id?: number | null
          league_name?: string | null
          linha?: string
          liquidacao?: string | null
          match_date?: string | null
          odd_ha?: number | null
          resultado_ha?: string | null
          score_ha?: number | null
          status_ha?: string | null
          und_odd?: number | null
          underdog?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      solo_rankings: {
        Row: {
          best_round: number
          bluffs_detected: number
          created_at: string
          id: string
          nickname: string
          session_id: string
          successful_bluffs: number
          times_fooled: number
          total_games: number
          total_points: number
          total_wins: number
          updated_at: string
        }
        Insert: {
          best_round?: number
          bluffs_detected?: number
          created_at?: string
          id?: string
          nickname: string
          session_id: string
          successful_bluffs?: number
          times_fooled?: number
          total_games?: number
          total_points?: number
          total_wins?: number
          updated_at?: string
        }
        Update: {
          best_round?: number
          bluffs_detected?: number
          created_at?: string
          id?: string
          nickname?: string
          session_id?: string
          successful_bluffs?: number
          times_fooled?: number
          total_games?: number
          total_points?: number
          total_wins?: number
          updated_at?: string
        }
        Relationships: []
      }
      sports_bankroll: {
        Row: {
          balance: number | null
          created_at: string | null
          green_bets: number | null
          id: string
          initial_balance: number | null
          red_bets: number | null
          total_bets: number | null
          total_profit: number | null
          total_staked: number | null
          updated_at: string | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          green_bets?: number | null
          id?: string
          initial_balance?: number | null
          red_bets?: number | null
          total_bets?: number | null
          total_profit?: number | null
          total_staked?: number | null
          updated_at?: string | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          green_bets?: number | null
          id?: string
          initial_balance?: number | null
          red_bets?: number | null
          total_bets?: number | null
          total_profit?: number | null
          total_staked?: number | null
          updated_at?: string | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      sports_training_sessions: {
        Row: {
          accuracy: number
          bluff_coins_earned: number
          completed_at: string | null
          created_at: string
          id: string
          passed: boolean
          scenarios_answered: number
          scenarios_correct: number
          scenarios_data: Json | null
          scenarios_total: number
          user_id: string
        }
        Insert: {
          accuracy?: number
          bluff_coins_earned?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          scenarios_answered?: number
          scenarios_correct?: number
          scenarios_data?: Json | null
          scenarios_total?: number
          user_id: string
        }
        Update: {
          accuracy?: number
          bluff_coins_earned?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          scenarios_answered?: number
          scenarios_correct?: number
          scenarios_data?: Json | null
          scenarios_total?: number
          user_id?: string
        }
        Relationships: []
      }
      team_advanced_stats: {
        Row: {
          away_avg_goals_conceded: number | null
          away_avg_goals_scored: number | null
          away_avg_xg: number | null
          away_cv_conceded: number | null
          away_cv_scored: number | null
          created_at: string
          home_avg_goals_conceded: number | null
          home_avg_goals_scored: number | null
          home_avg_xg: number | null
          home_cv_conceded: number | null
          home_cv_scored: number | null
          last_updated: string
          sample_size: number | null
          season: number
          team_id: number
          team_name: string | null
        }
        Insert: {
          away_avg_goals_conceded?: number | null
          away_avg_goals_scored?: number | null
          away_avg_xg?: number | null
          away_cv_conceded?: number | null
          away_cv_scored?: number | null
          created_at?: string
          home_avg_goals_conceded?: number | null
          home_avg_goals_scored?: number | null
          home_avg_xg?: number | null
          home_cv_conceded?: number | null
          home_cv_scored?: number | null
          last_updated?: string
          sample_size?: number | null
          season: number
          team_id: number
          team_name?: string | null
        }
        Update: {
          away_avg_goals_conceded?: number | null
          away_avg_goals_scored?: number | null
          away_avg_xg?: number | null
          away_cv_conceded?: number | null
          away_cv_scored?: number | null
          created_at?: string
          home_avg_goals_conceded?: number | null
          home_avg_goals_scored?: number | null
          home_avg_xg?: number | null
          home_cv_conceded?: number | null
          home_cv_scored?: number | null
          last_updated?: string
          sample_size?: number | null
          season?: number
          team_id?: number
          team_name?: string | null
        }
        Relationships: []
      }
      telegram_dedupe: {
        Row: {
          channel: string
          dedupe_key: string
          expires_at: string
          id: string
          market: string | null
          match_id: string | null
          payload_hash: string | null
          sent_at: string
          source: string | null
          verdict: string | null
        }
        Insert: {
          channel?: string
          dedupe_key: string
          expires_at?: string
          id?: string
          market?: string | null
          match_id?: string | null
          payload_hash?: string | null
          sent_at?: string
          source?: string | null
          verdict?: string | null
        }
        Update: {
          channel?: string
          dedupe_key?: string
          expires_at?: string
          id?: string
          market?: string | null
          match_id?: string | null
          payload_hash?: string | null
          sent_at?: string
          source?: string | null
          verdict?: string | null
        }
        Relationships: []
      }
      trader_leagues: {
        Row: {
          country: string | null
          created_at: string
          enabled: boolean
          league_id: number
          name: string
          odds_sport_key: string | null
          region: string
          tier: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          enabled?: boolean
          league_id: number
          name: string
          odds_sport_key?: string | null
          region?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          enabled?: boolean
          league_id?: number
          name?: string
          odds_sport_key?: string | null
          region?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      trader_notifications_sent: {
        Row: {
          away_team: string | null
          confidence: number | null
          event_type: string
          home_team: string | null
          id: string
          market: string
          match_id: string
          odd: number | null
          push_sent: boolean
          sent_at: string
          sent_date: string
          telegram_sent: boolean
        }
        Insert: {
          away_team?: string | null
          confidence?: number | null
          event_type: string
          home_team?: string | null
          id?: string
          market: string
          match_id: string
          odd?: number | null
          push_sent?: boolean
          sent_at?: string
          sent_date?: string
          telegram_sent?: boolean
        }
        Update: {
          away_team?: string | null
          confidence?: number | null
          event_type?: string
          home_team?: string | null
          id?: string
          market?: string
          match_id?: string
          odd?: number | null
          push_sent?: boolean
          sent_at?: string
          sent_date?: string
          telegram_sent?: boolean
        }
        Relationships: []
      }
      trader_session_snapshots: {
        Row: {
          amount: number
          asset_symbol: string
          candles_snapshot: Json | null
          closed_at: string | null
          entry_price: number
          exit_price: number | null
          horus_message: string | null
          id: string
          leverage: number
          mycroft_analysis: Json | null
          opened_at: string
          pnl: number | null
          session_id: string
          status: string
          stop_loss: number | null
          take_profit: number | null
          trade_type: string
          user_id: string
        }
        Insert: {
          amount: number
          asset_symbol: string
          candles_snapshot?: Json | null
          closed_at?: string | null
          entry_price: number
          exit_price?: number | null
          horus_message?: string | null
          id?: string
          leverage?: number
          mycroft_analysis?: Json | null
          opened_at?: string
          pnl?: number | null
          session_id?: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          trade_type: string
          user_id: string
        }
        Update: {
          amount?: number
          asset_symbol?: string
          candles_snapshot?: Json | null
          closed_at?: string | null
          entry_price?: number
          exit_price?: number | null
          horus_message?: string | null
          id?: string
          leverage?: number
          mycroft_analysis?: Json | null
          opened_at?: string
          pnl?: number | null
          session_id?: string
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          trade_type?: string
          user_id?: string
        }
        Relationships: []
      }
      trader_social_feed: {
        Row: {
          amount: number
          asset_symbol: string
          comment: string | null
          copies_count: number
          created_at: string
          entry_price: number
          exit_price: number
          id: string
          leverage: number
          likes_count: number
          pnl: number
          pnl_percent: number
          trade_type: string
          user_id: string
          username: string
        }
        Insert: {
          amount: number
          asset_symbol: string
          comment?: string | null
          copies_count?: number
          created_at?: string
          entry_price: number
          exit_price: number
          id?: string
          leverage?: number
          likes_count?: number
          pnl: number
          pnl_percent?: number
          trade_type: string
          user_id: string
          username?: string
        }
        Update: {
          amount?: number
          asset_symbol?: string
          comment?: string | null
          copies_count?: number
          created_at?: string
          entry_price?: number
          exit_price?: number
          id?: string
          leverage?: number
          likes_count?: number
          pnl?: number
          pnl_percent?: number
          trade_type?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      training_labels: {
        Row: {
          ai_votes_believe: number | null
          ai_votes_doubt: number | null
          consensus_score: number | null
          created_at: string
          exclusion_reason: string | null
          final_label: string | null
          human_votes_believe: number | null
          human_votes_doubt: number | null
          id: string
          is_valid_for_training: boolean | null
          label_quality: string | null
          label_source: string | null
          match_id: string | null
          metrics_snapshot: Json | null
          player_claimed_truth: boolean | null
          player_was_bluffing: boolean | null
          question_id: string | null
          recording_id: string
          total_votes: number | null
          votes_believe: number | null
          votes_doubt: number | null
        }
        Insert: {
          ai_votes_believe?: number | null
          ai_votes_doubt?: number | null
          consensus_score?: number | null
          created_at?: string
          exclusion_reason?: string | null
          final_label?: string | null
          human_votes_believe?: number | null
          human_votes_doubt?: number | null
          id?: string
          is_valid_for_training?: boolean | null
          label_quality?: string | null
          label_source?: string | null
          match_id?: string | null
          metrics_snapshot?: Json | null
          player_claimed_truth?: boolean | null
          player_was_bluffing?: boolean | null
          question_id?: string | null
          recording_id: string
          total_votes?: number | null
          votes_believe?: number | null
          votes_doubt?: number | null
        }
        Update: {
          ai_votes_believe?: number | null
          ai_votes_doubt?: number | null
          consensus_score?: number | null
          created_at?: string
          exclusion_reason?: string | null
          final_label?: string | null
          human_votes_believe?: number | null
          human_votes_doubt?: number | null
          id?: string
          is_valid_for_training?: boolean | null
          label_quality?: string | null
          label_source?: string | null
          match_id?: string | null
          metrics_snapshot?: Json | null
          player_claimed_truth?: boolean | null
          player_was_bluffing?: boolean | null
          question_id?: string | null
          recording_id?: string
          total_votes?: number | null
          votes_believe?: number | null
          votes_doubt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_labels_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      training_runs: {
        Row: {
          bankroll_current: number
          bankroll_start: number
          created_at: string
          difficulty_level_start: string
          ended_at: string | null
          engine_module: string
          error_mode: string
          golden_ticket_progress_delta: number
          hands_completed: number
          hands_target: number
          id: string
          lives_remaining: number
          lives_start: number
          status: string
          user_id: string
        }
        Insert: {
          bankroll_current?: number
          bankroll_start?: number
          created_at?: string
          difficulty_level_start?: string
          ended_at?: string | null
          engine_module?: string
          error_mode?: string
          golden_ticket_progress_delta?: number
          hands_completed?: number
          hands_target?: number
          id?: string
          lives_remaining?: number
          lives_start?: number
          status?: string
          user_id: string
        }
        Update: {
          bankroll_current?: number
          bankroll_start?: number
          created_at?: string
          difficulty_level_start?: string
          ended_at?: string | null
          engine_module?: string
          error_mode?: string
          golden_ticket_progress_delta?: number
          hands_completed?: number
          hands_target?: number
          id?: string
          lives_remaining?: number
          lives_start?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      training_scenario_history: {
        Row: {
          best_style: string | null
          board_cards: string | null
          correct_action: string
          created_at: string
          ev_diferenca: string | null
          gto_acao: string | null
          gto_ev: string | null
          hero_cards: string | null
          id: string
          lag_acao: string | null
          lag_ev: string | null
          nota: number | null
          player_action: string
          player_ev: string | null
          player_matched_style: string | null
          scenario_number: number
          session_id: string | null
          street: string | null
          tag_acao: string | null
          tag_ev: string | null
          user_id: string
          was_correct: boolean
        }
        Insert: {
          best_style?: string | null
          board_cards?: string | null
          correct_action: string
          created_at?: string
          ev_diferenca?: string | null
          gto_acao?: string | null
          gto_ev?: string | null
          hero_cards?: string | null
          id?: string
          lag_acao?: string | null
          lag_ev?: string | null
          nota?: number | null
          player_action: string
          player_ev?: string | null
          player_matched_style?: string | null
          scenario_number: number
          session_id?: string | null
          street?: string | null
          tag_acao?: string | null
          tag_ev?: string | null
          user_id: string
          was_correct?: boolean
        }
        Update: {
          best_style?: string | null
          board_cards?: string | null
          correct_action?: string
          created_at?: string
          ev_diferenca?: string | null
          gto_acao?: string | null
          gto_ev?: string | null
          hero_cards?: string | null
          id?: string
          lag_acao?: string | null
          lag_ev?: string | null
          nota?: number | null
          player_action?: string
          player_ev?: string | null
          player_matched_style?: string | null
          scenario_number?: number
          session_id?: string | null
          street?: string | null
          tag_acao?: string | null
          tag_ev?: string | null
          user_id?: string
          was_correct?: boolean
        }
        Relationships: []
      }
      training_streets: {
        Row: {
          action_history_json: Json | null
          board_cards: string | null
          correct_action_json: Json | null
          created_at: string
          ev_analysis_json: Json | null
          feedback_mycroft_text: string | null
          hero_bet_size: number | null
          hero_decision: string | null
          hero_options_json: Json | null
          hero_stack: number
          id: string
          nota: number | null
          pot_size: number
          result: string | null
          scenario_text: string | null
          street: string
          training_hand_session_id: string
          user_id: string
          verdict_horus_text: string | null
          villain_stack: number
        }
        Insert: {
          action_history_json?: Json | null
          board_cards?: string | null
          correct_action_json?: Json | null
          created_at?: string
          ev_analysis_json?: Json | null
          feedback_mycroft_text?: string | null
          hero_bet_size?: number | null
          hero_decision?: string | null
          hero_options_json?: Json | null
          hero_stack?: number
          id?: string
          nota?: number | null
          pot_size?: number
          result?: string | null
          scenario_text?: string | null
          street: string
          training_hand_session_id: string
          user_id: string
          verdict_horus_text?: string | null
          villain_stack?: number
        }
        Update: {
          action_history_json?: Json | null
          board_cards?: string | null
          correct_action_json?: Json | null
          created_at?: string
          ev_analysis_json?: Json | null
          feedback_mycroft_text?: string | null
          hero_bet_size?: number | null
          hero_decision?: string | null
          hero_options_json?: Json | null
          hero_stack?: number
          id?: string
          nota?: number | null
          pot_size?: number
          result?: string | null
          scenario_text?: string | null
          street?: string
          training_hand_session_id?: string
          user_id?: string
          verdict_horus_text?: string | null
          villain_stack?: number
        }
        Relationships: []
      }
      trial_notification_log: {
        Row: {
          channel: string
          days_left: number
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel: string
          days_left: number
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          days_left?: number
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      under_cashout_thresholds: {
        Row: {
          created_at: string
          delta_dangerous_attacks: number
          delta_shots_on_target: number
          delta_xg: number
          enabled: boolean
          id: string
          risk_profile: string
          under_line: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_dangerous_attacks?: number
          delta_shots_on_target?: number
          delta_xg?: number
          enabled?: boolean
          id?: string
          risk_profile?: string
          under_line: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta_dangerous_attacks?: number
          delta_shots_on_target?: number
          delta_xg?: number
          enabled?: boolean
          id?: string
          risk_profile?: string
          under_line?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_actions: {
        Row: {
          action: string
          analysis_id: string | null
          created_at: string | null
          id: string
          profit_loss: number | null
          result: string | null
          signal_id: string | null
          stake_amount: number | null
          user_id: string
        }
        Insert: {
          action: string
          analysis_id?: string | null
          created_at?: string | null
          id?: string
          profit_loss?: number | null
          result?: string | null
          signal_id?: string | null
          stake_amount?: number | null
          user_id: string
        }
        Update: {
          action?: string
          analysis_id?: string | null
          created_at?: string | null
          id?: string
          profit_loss?: number | null
          result?: string | null
          signal_id?: string | null
          stake_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_actions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "mycroft_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_actions_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals_sent"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activation_checklist: {
        Row: {
          configured_bankroll: boolean
          created_at: string
          enabled_push: boolean
          placed_first_virtual_bet: boolean
          saw_first_signal: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          configured_bankroll?: boolean
          created_at?: string
          enabled_push?: boolean
          placed_first_virtual_bet?: boolean
          saw_first_signal?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          configured_bankroll?: boolean
          created_at?: string
          enabled_push?: boolean
          placed_first_virtual_bet?: boolean
          saw_first_signal?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bankroll: {
        Row: {
          balance: number | null
          created_at: string | null
          green_bets: number | null
          id: string
          initial_balance: number | null
          red_bets: number | null
          total_bets: number | null
          total_profit: number | null
          total_staked: number | null
          updated_at: string | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          green_bets?: number | null
          id?: string
          initial_balance?: number | null
          red_bets?: number | null
          total_bets?: number | null
          total_profit?: number | null
          total_staked?: number | null
          updated_at?: string | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          green_bets?: number | null
          id?: string
          initial_balance?: number | null
          red_bets?: number | null
          total_bets?: number | null
          total_profit?: number | null
          total_staked?: number | null
          updated_at?: string | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean | null
          horus_alerts: Json
          id: string
          notification_email: string | null
          telegram_notifications: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean | null
          horus_alerts?: Json
          id?: string
          notification_email?: string | null
          telegram_notifications?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean | null
          horus_alerts?: Json
          id?: string
          notification_email?: string | null
          telegram_notifications?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          allowed_arenas: string[] | null
          chat_override_until: string | null
          created_at: string | null
          external_order_id: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          payment_amount: number | null
          payment_provider: string | null
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowed_arenas?: string[] | null
          chat_override_until?: string | null
          created_at?: string | null
          external_order_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_amount?: number | null
          payment_provider?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowed_arenas?: string[] | null
          chat_override_until?: string | null
          created_at?: string | null
          external_order_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_amount?: number | null
          payment_provider?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_vocal_profiles: {
        Row: {
          avg_jitter: number | null
          avg_latency: number | null
          avg_pitch: number | null
          avg_shimmer: number | null
          avg_speech_rate: number | null
          created_at: string | null
          id: string
          jitter_std_dev: number | null
          latency_std_dev: number | null
          pitch_std_dev: number | null
          samples_count: number | null
          shimmer_std_dev: number | null
          speech_rate_std_dev: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_jitter?: number | null
          avg_latency?: number | null
          avg_pitch?: number | null
          avg_shimmer?: number | null
          avg_speech_rate?: number | null
          created_at?: string | null
          id?: string
          jitter_std_dev?: number | null
          latency_std_dev?: number | null
          pitch_std_dev?: number | null
          samples_count?: number | null
          shimmer_std_dev?: number | null
          speech_rate_std_dev?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_jitter?: number | null
          avg_latency?: number | null
          avg_pitch?: number | null
          avg_shimmer?: number | null
          avg_speech_rate?: number | null
          created_at?: string | null
          id?: string
          jitter_std_dev?: number | null
          latency_std_dev?: number | null
          pitch_std_dev?: number | null
          samples_count?: number | null
          shimmer_std_dev?: number | null
          speech_rate_std_dev?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      virtual_bets: {
        Row: {
          auto_cashout_enabled: boolean | null
          auto_cashout_min_value: number | null
          cashed_out_at: string | null
          cashout_odd: number | null
          cashout_value: number | null
          commence_time: string | null
          current_odd: number | null
          entry_odd: number | null
          entry_stats: Json | null
          id: string
          last_cashout_update: string | null
          market: string
          match_id: string
          match_name: string
          mycroft_cashout_reason: string | null
          mycroft_cashout_signal: boolean | null
          odd: number
          odd_fonte: string | null
          placed_at: string | null
          profit_loss: number | null
          red_card_away: boolean | null
          red_card_home: boolean | null
          score_away: number | null
          score_home: number | null
          settled_at: string | null
          signal_id: string | null
          stake: number
          status: string | null
          user_id: string
        }
        Insert: {
          auto_cashout_enabled?: boolean | null
          auto_cashout_min_value?: number | null
          cashed_out_at?: string | null
          cashout_odd?: number | null
          cashout_value?: number | null
          commence_time?: string | null
          current_odd?: number | null
          entry_odd?: number | null
          entry_stats?: Json | null
          id?: string
          last_cashout_update?: string | null
          market: string
          match_id: string
          match_name: string
          mycroft_cashout_reason?: string | null
          mycroft_cashout_signal?: boolean | null
          odd: number
          odd_fonte?: string | null
          placed_at?: string | null
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          score_away?: number | null
          score_home?: number | null
          settled_at?: string | null
          signal_id?: string | null
          stake: number
          status?: string | null
          user_id: string
        }
        Update: {
          auto_cashout_enabled?: boolean | null
          auto_cashout_min_value?: number | null
          cashed_out_at?: string | null
          cashout_odd?: number | null
          cashout_value?: number | null
          commence_time?: string | null
          current_odd?: number | null
          entry_odd?: number | null
          entry_stats?: Json | null
          id?: string
          last_cashout_update?: string | null
          market?: string
          match_id?: string
          match_name?: string
          mycroft_cashout_reason?: string | null
          mycroft_cashout_signal?: boolean | null
          odd?: number
          odd_fonte?: string | null
          placed_at?: string | null
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          score_away?: number | null
          score_home?: number | null
          settled_at?: string | null
          signal_id?: string | null
          stake?: number
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_bets_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "mycroft_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_bets_manual: {
        Row: {
          asset_score: number | null
          commence_time: string | null
          created_at: string | null
          id: string
          market: string
          match_id: string
          match_name: string | null
          odd: number
          profit_loss: number | null
          red_card_away: boolean | null
          red_card_home: boolean | null
          result: string | null
          score_away: number | null
          score_home: number | null
          stake: number
          status: string | null
          thesis: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_score?: number | null
          commence_time?: string | null
          created_at?: string | null
          id?: string
          market: string
          match_id: string
          match_name?: string | null
          odd: number
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          stake: number
          status?: string | null
          thesis?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_score?: number | null
          commence_time?: string | null
          created_at?: string | null
          id?: string
          market?: string
          match_id?: string
          match_name?: string | null
          odd?: number
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          stake?: number
          status?: string | null
          thesis?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      virtual_bets_punter: {
        Row: {
          analysis_id: string | null
          asset_score: number | null
          commence_time: string | null
          created_at: string | null
          id: string
          market: string
          match_id: string
          match_name: string
          odd: number
          profit_loss: number | null
          red_card_away: boolean | null
          red_card_home: boolean | null
          result: string | null
          score_away: number | null
          score_home: number | null
          signal_id: string | null
          stake: number
          status: string | null
          thesis: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          asset_score?: number | null
          commence_time?: string | null
          created_at?: string | null
          id?: string
          market: string
          match_id: string
          match_name: string
          odd: number
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          signal_id?: string | null
          stake: number
          status?: string | null
          thesis?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          asset_score?: number | null
          commence_time?: string | null
          created_at?: string | null
          id?: string
          market?: string
          match_id?: string
          match_name?: string
          odd?: number
          profit_loss?: number | null
          red_card_away?: boolean | null
          red_card_home?: boolean | null
          result?: string | null
          score_away?: number | null
          score_home?: number | null
          signal_id?: string | null
          stake?: number
          status?: string | null
          thesis?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_bets_punter_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "punter_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_bets_punter_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "punter_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          ai_profile: string | null
          confidence_level: number | null
          created_at: string
          id: string
          player_id: string
          question_id: string
          reasoning: string | null
          recording_id: string | null
          room_id: string
          vote_type: string
          voter_type: string | null
        }
        Insert: {
          ai_profile?: string | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          player_id: string
          question_id: string
          reasoning?: string | null
          recording_id?: string | null
          room_id: string
          vote_type: string
          voter_type?: string | null
        }
        Update: {
          ai_profile?: string | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          player_id?: string
          question_id?: string
          reasoning?: string | null
          recording_id?: string | null
          room_id?: string
          vote_type?: string
          voter_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bc_leaderboard_weekly: {
        Row: {
          bc_week: number | null
          display_name: string | null
          rank: number | null
          user_id: string | null
          wins_week: number | null
        }
        Relationships: []
      }
      liga_mycroft_leaderboard: {
        Row: {
          display_name: string | null
          greens: number | null
          is_fake: boolean | null
          is_horus: boolean | null
          plan: string | null
          plan_active: boolean | null
          rank: number | null
          reds: number | null
          roi_pct: number | null
          row_key: string | null
          seed_id: string | null
          total_bets: number | null
          total_returned: number | null
          total_staked: number | null
          user_id: string | null
        }
        Relationships: []
      }
      mycroft_cashout_accuracy: {
        Row: {
          accuracy_pct: number | null
          correct_exits: number | null
          correct_holds: number | null
          modo: string | null
          total_signals: number | null
          user_id: string | null
          wrong_exits: number | null
        }
        Relationships: []
      }
      mycroft_user_roi: {
        Row: {
          greens: number | null
          pushes: number | null
          reds: number | null
          roi_pct: number | null
          total_bets: number | null
          total_returned: number | null
          total_staked: number | null
          user_id: string | null
        }
        Relationships: []
      }
      next_games_to_check: {
        Row: {
          away_team: string | null
          check_time: string | null
          created_at: string | null
          event_id: string | null
          home_team: string | null
          id: string | null
          league_name: string | null
          match_date: string | null
          match_datetime: string | null
          match_id: string | null
          match_time: string | null
          relevance_score: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          away_team?: string | null
          check_time?: string | null
          created_at?: string | null
          event_id?: string | null
          home_team?: string | null
          id?: string | null
          league_name?: string | null
          match_date?: string | null
          match_datetime?: string | null
          match_id?: string | null
          match_time?: string | null
          relevance_score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          away_team?: string | null
          check_time?: string | null
          created_at?: string | null
          event_id?: string | null
          home_team?: string | null
          id?: string | null
          league_name?: string | null
          match_date?: string | null
          match_datetime?: string | null
          match_id?: string | null
          match_time?: string | null
          relevance_score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      punter_user_roi: {
        Row: {
          greens: number | null
          pushes: number | null
          reds: number | null
          roi_pct: number | null
          total_bets: number | null
          total_returned: number | null
          total_staked: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_email_sequencia_status: {
        Row: {
          assinante: boolean | null
          cadastro: string | null
          d1: string | null
          d3: string | null
          d5: string | null
          d7: string | null
          expirado: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      v_email_status_por_usuario: {
        Row: {
          d1_enviado_em: string | null
          d1_erro: string | null
          d1_status: string | null
          d3_enviado_em: string | null
          d3_status: string | null
          d5_enviado_em: string | null
          d5_status: string | null
          d7_enviado_em: string | null
          d7_status: string | null
          email: string | null
          expirado_enviado_em: string | null
          expirado_status: string | null
          total_enviados: number | null
          total_falhas: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_historico_analises: {
        Row: {
          com_aprovado: number | null
          media_aprovados: number | null
          melhor_sinal: string | null
          score_medio: number | null
          total_analises: number | null
          ultima_analise: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_performance_por_mercado_punter: {
        Row: {
          first_match_date: string | null
          greens: number | null
          last_match_date: string | null
          last_settled_at: string | null
          mercado: string | null
          reds: number | null
          roi_pct: number | null
          total_sinais: number | null
          win_rate_pct: number | null
        }
        Relationships: []
      }
      v_performance_por_mercado_trader: {
        Row: {
          first_match_date: string | null
          greens: number | null
          last_match_date: string | null
          last_settled_at: string | null
          mercado: string | null
          reds: number | null
          roi_pct: number | null
          total_sinais: number | null
          win_rate_pct: number | null
        }
        Relationships: []
      }
      v_roi_plano_favorito: {
        Row: {
          greens_o15: number | null
          greens_o25: number | null
          greens_vit: number | null
          status_over15: string | null
          status_over25: string | null
          status_vitoria: string | null
          total_o15: number | null
          total_o25: number | null
          total_vit: number | null
          winrate_o15: number | null
          winrate_o25: number | null
          winrate_vit: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      backfill_live_sinais_from_notifications: {
        Args: { _days?: number }
        Returns: number
      }
      calc_signal_pnl: {
        Args: { _odd: number; _result: string; _stake: number }
        Returns: number
      }
      calculate_rank_title: { Args: { coins: number }; Returns: string }
      claim_daily_nt_bonus: {
        Args: { p_amount?: number; p_user_id: string }
        Returns: boolean
      }
      claim_daily_streak_bonus: { Args: { p_user_id: string }; Returns: number }
      claim_mycroft_analysis_jobs: {
        Args: { p_limit: number; p_worker: string }
        Returns: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          match_id: string
          max_attempts: number
          payload: Json
          processed_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "mycroft_analysis_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      classify_market:
        | { Args: { _market: string }; Returns: string }
        | {
            Args: { _away?: string; _home?: string; _market: string }
            Returns: string
          }
      cleanup_ai_response_cache: { Args: never; Returns: undefined }
      cleanup_cron_logs: { Args: never; Returns: undefined }
      cleanup_expired_fixture_stats_cache: { Args: never; Returns: undefined }
      cleanup_futodds_health_log: { Args: never; Returns: undefined }
      cleanup_log_tables: { Args: never; Returns: Json }
      cleanup_mycroft_analysis_queue: { Args: never; Returns: undefined }
      cleanup_old_edge_function_errors: { Args: never; Returns: undefined }
      cleanup_old_edge_function_runs: { Args: never; Returns: undefined }
      compare_providers_divergences: {
        Args: { p_since: string }
        Returns: {
          divergencia: string
          total: number
        }[]
      }
      compare_providers_metrics: {
        Args: { p_since: string }
        Returns: {
          greens: number
          liquidados: number
          pendentes: number
          provider: string
          reds: number
          total_approvados: number
          win_rate: number
        }[]
      }
      compute_arena_calibration: {
        Args: { p_arena: string; p_limit?: number }
        Returns: {
          greens: number
          hit_rate: number
          last_settled_at: string
          reds: number
          roi: number
          sample_size: number
        }[]
      }
      decrement_promo_slot: {
        Args: {
          p_event_type?: string
          p_ip_hash?: string
          p_promo_id?: string
          p_user_agent?: string
        }
        Returns: {
          is_active: boolean
          slots_remaining: number
          slots_total: number
        }[]
      }
      deduct_bankroll: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      deduct_manual_bankroll: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      expire_old_bc_rewards: {
        Args: never
        Returns: {
          total_expired: number
          users_affected: number
        }[]
      }
      expire_trials: { Args: never; Returns: number }
      generate_training_label: {
        Args: { p_recording_id: string }
        Returns: string
      }
      get_live_sinais_summary: { Args: { _period?: string }; Returns: Json }
      get_performance_punter: {
        Args: { p_days?: number }
        Returns: {
          greens: number
          mercado: string
          reds: number
          roi_pct: number
          total_sinais: number
          win_rate_pct: number
        }[]
      }
      get_performance_trader: {
        Args: { p_days?: number }
        Returns: {
          greens: number
          mercado: string
          reds: number
          roi_pct: number
          total_sinais: number
          win_rate_pct: number
        }[]
      }
      get_trader_balance: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_apc_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      increment_bc_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      increment_bluffcoins: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      increment_nt_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      league_roi_before_after: {
        Args: { p_pivot: string; p_window_days?: number }
        Returns: {
          after_green: number
          after_hit_rate: number
          after_red: number
          after_roi: number
          after_total: number
          before_green: number
          before_hit_rate: number
          before_red: number
          before_roi: number
          before_total: number
          championship: string
          enabled: boolean
          tier: string
        }[]
      }
      log_mycroft_chat_attempt: {
        Args: {
          p_away_team?: string
          p_days_left?: number
          p_home_team?: string
          p_league?: string
          p_match_id?: string
          p_metadata?: Json
          p_plan?: string
          p_reason: string
          p_route?: string
          p_source: string
          p_user_agent?: string
        }
        Returns: string
      }
      norm_market_text: { Args: { _t: string }; Returns: string }
      normalize_match_id: { Args: { mid: string }; Returns: string }
      punter_check_signal_quality: {
        Args: { _league: string; _market: string; _odd: number }
        Returns: Json
      }
      punter_market_family: { Args: { market_text: string }; Returns: string }
      punter_odd_bucket: { Args: { odd: number }; Returns: string }
      recompute_punter_buckets: { Args: never; Returns: number }
      record_arena_session: {
        Args: {
          p_apc_earned: number
          p_is_champion: boolean
          p_scenarios_played: number
          p_scenarios_won: number
          p_user_id: string
        }
        Returns: undefined
      }
      refresh_arena_calibration: {
        Args: { p_arena: string; p_limit?: number }
        Returns: {
          out_arena: string
          out_delta: number
          out_effective_min_confidence: number
          out_hit_rate: number
          out_roi: number
          out_sample_size: number
        }[]
      }
      refresh_punter_quarantine: { Args: never; Returns: number }
      relink_mycroft_analyses: {
        Args: never
        Returns: {
          linked: number
          mismatched: number
        }[]
      }
      requeue_stuck_mycroft_jobs: { Args: never; Returns: number }
      settle_mycroft_analysis: {
        Args: {
          p_analysis_id: string
          p_reason?: string
          p_score_away: number
          p_score_home: number
        }
        Returns: string
      }
      settle_mycroft_shadow_af: {
        Args: {
          p_id: string
          p_reason?: string
          p_score_away: number
          p_score_home: number
        }
        Returns: string
      }
      settle_signal: {
        Args: {
          _ga: number
          _gh: number
          _htga: number
          _htgh: number
          _market_key: string
          _odd: number
          _stake: number
        }
        Returns: {
          profit_loss: number
          result: string
        }[]
      }
      spend_nt_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      sync_live_sinal_from_notification: {
        Args: {
          _away_team: string
          _confidence: number
          _event_type: string
          _home_team: string
          _market: string
          _match_id: string
          _odd: number
          _sent_at: string
        }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_trader_balance: {
        Args: { p_amount: number; p_is_win?: boolean; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      answer_option: "A" | "B" | "C" | "D"
      app_role: "admin" | "user"
      audio_frequency: "alta" | "media" | "baixa"
      difficulty_level: "Easy" | "Medium" | "Hard"
      mycroft_modo: "trader" | "punter"
      room_status:
        | "lobby"
        | "question"
        | "discussion"
        | "voting"
        | "bribe_offer"
        | "result"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      answer_option: ["A", "B", "C", "D"],
      app_role: ["admin", "user"],
      audio_frequency: ["alta", "media", "baixa"],
      difficulty_level: ["Easy", "Medium", "Hard"],
      mycroft_modo: ["trader", "punter"],
      room_status: [
        "lobby",
        "question",
        "discussion",
        "voting",
        "bribe_offer",
        "result",
      ],
    },
  },
} as const
