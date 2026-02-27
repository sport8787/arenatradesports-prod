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
      arena_poker_rankings: {
        Row: {
          apc_balance: number
          best_win_streak: number
          champion_titles: number
          created_at: string
          golden_tickets: number
          id: string
          total_scenarios_played: number
          total_scenarios_won: number
          total_sessions: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          apc_balance?: number
          best_win_streak?: number
          champion_titles?: number
          created_at?: string
          golden_tickets?: number
          id?: string
          total_scenarios_played?: number
          total_scenarios_won?: number
          total_sessions?: number
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          apc_balance?: number
          best_win_streak?: number
          champion_titles?: number
          created_at?: string
          golden_tickets?: number
          id?: string
          total_scenarios_played?: number
          total_scenarios_won?: number
          total_sessions?: number
          updated_at?: string
          user_id?: string
          username?: string
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
      biometric_baselines: {
        Row: {
          blink_rate_deviation_threshold: number | null
          calibrated_at: string
          capture_mode: string
          created_at: string
          expires_at: string
          id: string
          is_valid: boolean
          jitter_deviation_threshold: number | null
          lie_avg_pitch: number | null
          lie_blink_rate: number | null
          lie_brow_asymmetry: number | null
          lie_face_symmetry: number | null
          lie_facial_stress_score: number | null
          lie_gaze_deviation: number | null
          lie_jitter: number | null
          lie_lip_tension: number | null
          lie_longest_pause: number | null
          lie_mouth_openness: number | null
          lie_pitch_variance: number | null
          lie_response_latency: number | null
          lie_shimmer: number | null
          lie_silent_periods: number | null
          lie_speech_continuity: number | null
          lie_speech_rate: number | null
          lip_tension_deviation_threshold: number | null
          pitch_deviation_threshold: number | null
          session_id: string | null
          stress_score_deviation_threshold: number | null
          truth_avg_pitch: number | null
          truth_blink_rate: number | null
          truth_brow_asymmetry: number | null
          truth_face_symmetry: number | null
          truth_facial_stress_score: number | null
          truth_gaze_deviation: number | null
          truth_jitter: number | null
          truth_lip_tension: number | null
          truth_longest_pause: number | null
          truth_mouth_openness: number | null
          truth_pitch_variance: number | null
          truth_response_latency: number | null
          truth_shimmer: number | null
          truth_silent_periods: number | null
          truth_speech_continuity: number | null
          truth_speech_rate: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          blink_rate_deviation_threshold?: number | null
          calibrated_at?: string
          capture_mode?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_valid?: boolean
          jitter_deviation_threshold?: number | null
          lie_avg_pitch?: number | null
          lie_blink_rate?: number | null
          lie_brow_asymmetry?: number | null
          lie_face_symmetry?: number | null
          lie_facial_stress_score?: number | null
          lie_gaze_deviation?: number | null
          lie_jitter?: number | null
          lie_lip_tension?: number | null
          lie_longest_pause?: number | null
          lie_mouth_openness?: number | null
          lie_pitch_variance?: number | null
          lie_response_latency?: number | null
          lie_shimmer?: number | null
          lie_silent_periods?: number | null
          lie_speech_continuity?: number | null
          lie_speech_rate?: number | null
          lip_tension_deviation_threshold?: number | null
          pitch_deviation_threshold?: number | null
          session_id?: string | null
          stress_score_deviation_threshold?: number | null
          truth_avg_pitch?: number | null
          truth_blink_rate?: number | null
          truth_brow_asymmetry?: number | null
          truth_face_symmetry?: number | null
          truth_facial_stress_score?: number | null
          truth_gaze_deviation?: number | null
          truth_jitter?: number | null
          truth_lip_tension?: number | null
          truth_longest_pause?: number | null
          truth_mouth_openness?: number | null
          truth_pitch_variance?: number | null
          truth_response_latency?: number | null
          truth_shimmer?: number | null
          truth_silent_periods?: number | null
          truth_speech_continuity?: number | null
          truth_speech_rate?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          blink_rate_deviation_threshold?: number | null
          calibrated_at?: string
          capture_mode?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_valid?: boolean
          jitter_deviation_threshold?: number | null
          lie_avg_pitch?: number | null
          lie_blink_rate?: number | null
          lie_brow_asymmetry?: number | null
          lie_face_symmetry?: number | null
          lie_facial_stress_score?: number | null
          lie_gaze_deviation?: number | null
          lie_jitter?: number | null
          lie_lip_tension?: number | null
          lie_longest_pause?: number | null
          lie_mouth_openness?: number | null
          lie_pitch_variance?: number | null
          lie_response_latency?: number | null
          lie_shimmer?: number | null
          lie_silent_periods?: number | null
          lie_speech_continuity?: number | null
          lie_speech_rate?: number | null
          lip_tension_deviation_threshold?: number | null
          pitch_deviation_threshold?: number | null
          session_id?: string | null
          stress_score_deviation_threshold?: number | null
          truth_avg_pitch?: number | null
          truth_blink_rate?: number | null
          truth_brow_asymmetry?: number | null
          truth_face_symmetry?: number | null
          truth_facial_stress_score?: number | null
          truth_gaze_deviation?: number | null
          truth_jitter?: number | null
          truth_lip_tension?: number | null
          truth_longest_pause?: number | null
          truth_mouth_openness?: number | null
          truth_pitch_variance?: number | null
          truth_response_latency?: number | null
          truth_shimmer?: number | null
          truth_silent_periods?: number | null
          truth_speech_continuity?: number | null
          truth_speech_rate?: number | null
          updated_at?: string
          user_id?: string | null
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
      founder_cases: {
        Row: {
          activated_at: string | null
          case_code: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          case_code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          case_code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string | null
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
      mycroft_analyses: {
        Row: {
          alerts: string[] | null
          confidence: number | null
          created_at: string | null
          fundamentation: Json | null
          id: string
          market: string
          match_id: string
          odd: number | null
          risk_management: Json | null
          thesis: string
          verdict: string
        }
        Insert: {
          alerts?: string[] | null
          confidence?: number | null
          created_at?: string | null
          fundamentation?: Json | null
          id?: string
          market: string
          match_id: string
          odd?: number | null
          risk_management?: Json | null
          thesis: string
          verdict: string
        }
        Update: {
          alerts?: string[] | null
          confidence?: number | null
          created_at?: string | null
          fundamentation?: Json | null
          id?: string
          market?: string
          match_id?: string
          odd?: number | null
          risk_management?: Json | null
          thesis?: string
          verdict?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          avatar_url: string | null
          bluffcoins: number
          created_at: string
          detective_score: number
          id: string
          is_host: boolean
          nickname: string
          role: string | null
          room_id: string
          score: number
          session_id: string
        }
        Insert: {
          avatar_url?: string | null
          bluffcoins?: number
          created_at?: string
          detective_score?: number
          id?: string
          is_host?: boolean
          nickname: string
          role?: string | null
          room_id: string
          score?: number
          session_id: string
        }
        Update: {
          avatar_url?: string | null
          bluffcoins?: number
          created_at?: string
          detective_score?: number
          id?: string
          is_host?: boolean
          nickname?: string
          role?: string | null
          room_id?: string
          score?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bc_balance: number
          bluff_coins: number
          created_at: string
          daily_streak_count: number
          id: string
          last_daily_bonus: string | null
          last_streak_date: string | null
          matches_played: number
          nt_balance: number
          rank_title: string
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
          id?: string
          last_daily_bonus?: string | null
          last_streak_date?: string | null
          matches_played?: number
          nt_balance?: number
          rank_title?: string
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
          id?: string
          last_daily_bonus?: string | null
          last_streak_date?: string | null
          matches_played?: number
          nt_balance?: number
          rank_title?: string
          updated_at?: string
          user_id?: string
          username?: string
          wins?: number
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
          estimated_probability: number | null
          fair_odd: number | null
          home_team: string
          id: string
          implied_probability: number | null
          league: string
          market: string
          match_id: string
          odd: number
          risk_factors: string | null
          stake_percentage: number | null
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
          estimated_probability?: number | null
          fair_odd?: number | null
          home_team: string
          id?: string
          implied_probability?: number | null
          league: string
          market: string
          match_id: string
          odd: number
          risk_factors?: string | null
          stake_percentage?: number | null
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
          estimated_probability?: number | null
          fair_odd?: number | null
          home_team?: string
          id?: string
          implied_probability?: number | null
          league?: string
          market?: string
          match_id?: string
          odd?: number
          risk_factors?: string | null
          stake_percentage?: number | null
          thesis?: string | null
          value_percentage?: number | null
          verdict?: string
        }
        Relationships: []
      }
      punter_signals: {
        Row: {
          analysis_id: string | null
          bookmaker: string
          created_at: string | null
          id: string
          market: string
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
          stake_percentage: number | null
          status: string | null
          updated_at: string | null
          value_percentage: number | null
        }
        Insert: {
          analysis_id?: string | null
          bookmaker: string
          created_at?: string | null
          id?: string
          market: string
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
          stake_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          value_percentage?: number | null
        }
        Update: {
          analysis_id?: string | null
          bookmaker?: string
          created_at?: string | null
          id?: string
          market?: string
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
          stake_percentage?: number | null
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
      questions: {
        Row: {
          category: string
          correct_option: Database["public"]["Enums"]["answer_option"]
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          id: string
          mycroft_bluff_suggestion: string | null
          mycroft_risk_analysis: string | null
          mycroft_risk_level: number | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
        }
        Insert: {
          category: string
          correct_option: Database["public"]["Enums"]["answer_option"]
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          mycroft_bluff_suggestion?: string | null
          mycroft_risk_analysis?: string | null
          mycroft_risk_level?: number | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
        }
        Update: {
          category?: string
          correct_option?: Database["public"]["Enums"]["answer_option"]
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          id?: string
          mycroft_bluff_suggestion?: string | null
          mycroft_risk_analysis?: string | null
          mycroft_risk_level?: number | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_text?: string
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
        Relationships: [
          {
            foreignKeyName: "rooms_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
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
      training_hand_sessions: {
        Row: {
          ante: string | null
          bc_awarded: number
          blind_level: string | null
          board_cards_flop: string | null
          board_cards_river: string | null
          board_cards_turn: string | null
          created_at: string
          current_street: string
          hand_number: number
          hero_hole_cards: string
          hero_stack: number
          id: string
          initial_stacks_json: Json | null
          metadata_json: Json | null
          position_hero: string | null
          position_villain: string | null
          pot_size: number
          status: string
          training_run_id: string
          user_id: string
          villain_name: string | null
          villain_profile: string | null
          villain_stack: number
        }
        Insert: {
          ante?: string | null
          bc_awarded?: number
          blind_level?: string | null
          board_cards_flop?: string | null
          board_cards_river?: string | null
          board_cards_turn?: string | null
          created_at?: string
          current_street?: string
          hand_number?: number
          hero_hole_cards: string
          hero_stack?: number
          id?: string
          initial_stacks_json?: Json | null
          metadata_json?: Json | null
          position_hero?: string | null
          position_villain?: string | null
          pot_size?: number
          status?: string
          training_run_id: string
          user_id: string
          villain_name?: string | null
          villain_profile?: string | null
          villain_stack?: number
        }
        Update: {
          ante?: string | null
          bc_awarded?: number
          blind_level?: string | null
          board_cards_flop?: string | null
          board_cards_river?: string | null
          board_cards_turn?: string | null
          created_at?: string
          current_street?: string
          hand_number?: number
          hero_hole_cards?: string
          hero_stack?: number
          id?: string
          initial_stacks_json?: Json | null
          metadata_json?: Json | null
          position_hero?: string | null
          position_villain?: string | null
          pot_size?: number
          status?: string
          training_run_id?: string
          user_id?: string
          villain_name?: string | null
          villain_profile?: string | null
          villain_stack?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_hand_sessions_training_run_id_fkey"
            columns: ["training_run_id"]
            isOneToOne: false
            referencedRelation: "training_runs"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "training_labels_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_labels_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: true
            referencedRelation: "voice_recordings"
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
        Relationships: [
          {
            foreignKeyName: "training_streets_training_hand_session_id_fkey"
            columns: ["training_hand_session_id"]
            isOneToOne: false
            referencedRelation: "training_hand_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_hand_files: {
        Row: {
          created_at: string
          file_hash: string
          filename: string
          hands_count: number
          id: string
          platform: string
          players_extracted: string[] | null
          raw_content: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_hash: string
          filename: string
          hands_count?: number
          id?: string
          platform?: string
          players_extracted?: string[] | null
          raw_content: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_hash?: string
          filename?: string
          hands_count?: number
          id?: string
          platform?: string
          players_extracted?: string[] | null
          raw_content?: string
          storage_path?: string | null
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
      user_question_history: {
        Row: {
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string | null
          id: string
          is_active: boolean | null
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
          created_at?: string | null
          id?: string
          is_active?: boolean | null
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
          created_at?: string | null
          id?: string
          is_active?: boolean | null
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
      villain_profiles: {
        Row: {
          ai_danger_level: string | null
          ai_evolution_notes: string | null
          ai_exploitable_tendencies: string | null
          ai_style_summary: string | null
          created_at: string
          estimated_3bet: number | null
          estimated_aggression: number | null
          estimated_fold_to_3bet: number | null
          estimated_pfr: number | null
          estimated_vpip: number | null
          first_seen_at: string
          id: string
          last_seen_at: string
          platform: string
          player_name: string
          showdown_frequency: number | null
          tags: string[] | null
          times_seen: number
          total_hands_against: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_danger_level?: string | null
          ai_evolution_notes?: string | null
          ai_exploitable_tendencies?: string | null
          ai_style_summary?: string | null
          created_at?: string
          estimated_3bet?: number | null
          estimated_aggression?: number | null
          estimated_fold_to_3bet?: number | null
          estimated_pfr?: number | null
          estimated_vpip?: number | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          player_name: string
          showdown_frequency?: number | null
          tags?: string[] | null
          times_seen?: number
          total_hands_against?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_danger_level?: string | null
          ai_evolution_notes?: string | null
          ai_exploitable_tendencies?: string | null
          ai_style_summary?: string | null
          created_at?: string
          estimated_3bet?: number | null
          estimated_aggression?: number | null
          estimated_fold_to_3bet?: number | null
          estimated_pfr?: number | null
          estimated_vpip?: number | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          player_name?: string
          showdown_frequency?: number | null
          tags?: string[] | null
          times_seen?: number
          total_hands_against?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      villain_session_stats: {
        Row: {
          aggression_session: number | null
          all_ins: number
          biggest_pot_bb: number | null
          created_at: string
          hands_played: number
          hands_won: number
          id: string
          notable_plays: string | null
          pfr_session: number | null
          showdowns: number
          uploaded_file_id: string
          user_id: string
          villain_profile_id: string
          vpip_session: number | null
        }
        Insert: {
          aggression_session?: number | null
          all_ins?: number
          biggest_pot_bb?: number | null
          created_at?: string
          hands_played?: number
          hands_won?: number
          id?: string
          notable_plays?: string | null
          pfr_session?: number | null
          showdowns?: number
          uploaded_file_id: string
          user_id: string
          villain_profile_id: string
          vpip_session?: number | null
        }
        Update: {
          aggression_session?: number | null
          all_ins?: number
          biggest_pot_bb?: number | null
          created_at?: string
          hands_played?: number
          hands_won?: number
          id?: string
          notable_plays?: string | null
          pfr_session?: number | null
          showdowns?: number
          uploaded_file_id?: string
          user_id?: string
          villain_profile_id?: string
          vpip_session?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "villain_session_stats_uploaded_file_id_fkey"
            columns: ["uploaded_file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_hand_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "villain_session_stats_villain_profile_id_fkey"
            columns: ["villain_profile_id"]
            isOneToOne: false
            referencedRelation: "villain_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_bets: {
        Row: {
          id: string
          market: string
          match_id: string
          match_name: string
          odd: number
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
          id?: string
          market: string
          match_id: string
          match_name: string
          odd: number
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
          id?: string
          market?: string
          match_id?: string
          match_name?: string
          odd?: number
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
      virtual_bets_punter: {
        Row: {
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
          updated_at: string | null
          user_id: string
        }
        Insert: {
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
          updated_at?: string | null
          user_id: string
        }
        Update: {
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
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_bets_punter_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "punter_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_recordings: {
        Row: {
          answer_was_correct: boolean | null
          audio_url: string
          avg_pitch: number | null
          baseline_id: string | null
          blink_rate: number | null
          brow_asymmetry: number | null
          capture_mode: string | null
          combined_suspicion_score: number | null
          consent_level: string | null
          created_at: string
          device_type: string | null
          eye_gaze_dominant: string | null
          facial_analysis_json: Json | null
          facial_stress_score: number | null
          filler_words_count: number | null
          harmonics_to_noise: number | null
          id: string
          jitter: number | null
          jitter_absolute: number | null
          jitter_deviation: number | null
          latency_deviation: number | null
          lip_tension: number | null
          longest_pause_ms: number | null
          match_id: string | null
          micro_expressions_detected: string[] | null
          mycroft_forensic_details: string | null
          mycroft_verdict: string | null
          peak_amplitude: number | null
          pitch_deviation: number | null
          pitch_stability: string | null
          pitch_variance: number | null
          player_id: string | null
          player_name: string | null
          pnl_access_type: string | null
          question_category: string | null
          question_difficulty: string | null
          question_id: string | null
          recording_duration_ms: number | null
          response_latency_ms: number | null
          room_id: string | null
          round_number: number
          session_id: string | null
          shimmer: number | null
          silent_periods_count: number | null
          speech_continuity: number | null
          speech_rate_bpm: number | null
          speech_rate_deviation: number | null
          stress_level: string | null
          stress_score: number | null
          time_to_answer_ms: number | null
          video_url: string | null
          was_bluffing: boolean | null
          words_per_minute: number | null
        }
        Insert: {
          answer_was_correct?: boolean | null
          audio_url: string
          avg_pitch?: number | null
          baseline_id?: string | null
          blink_rate?: number | null
          brow_asymmetry?: number | null
          capture_mode?: string | null
          combined_suspicion_score?: number | null
          consent_level?: string | null
          created_at?: string
          device_type?: string | null
          eye_gaze_dominant?: string | null
          facial_analysis_json?: Json | null
          facial_stress_score?: number | null
          filler_words_count?: number | null
          harmonics_to_noise?: number | null
          id?: string
          jitter?: number | null
          jitter_absolute?: number | null
          jitter_deviation?: number | null
          latency_deviation?: number | null
          lip_tension?: number | null
          longest_pause_ms?: number | null
          match_id?: string | null
          micro_expressions_detected?: string[] | null
          mycroft_forensic_details?: string | null
          mycroft_verdict?: string | null
          peak_amplitude?: number | null
          pitch_deviation?: number | null
          pitch_stability?: string | null
          pitch_variance?: number | null
          player_id?: string | null
          player_name?: string | null
          pnl_access_type?: string | null
          question_category?: string | null
          question_difficulty?: string | null
          question_id?: string | null
          recording_duration_ms?: number | null
          response_latency_ms?: number | null
          room_id?: string | null
          round_number?: number
          session_id?: string | null
          shimmer?: number | null
          silent_periods_count?: number | null
          speech_continuity?: number | null
          speech_rate_bpm?: number | null
          speech_rate_deviation?: number | null
          stress_level?: string | null
          stress_score?: number | null
          time_to_answer_ms?: number | null
          video_url?: string | null
          was_bluffing?: boolean | null
          words_per_minute?: number | null
        }
        Update: {
          answer_was_correct?: boolean | null
          audio_url?: string
          avg_pitch?: number | null
          baseline_id?: string | null
          blink_rate?: number | null
          brow_asymmetry?: number | null
          capture_mode?: string | null
          combined_suspicion_score?: number | null
          consent_level?: string | null
          created_at?: string
          device_type?: string | null
          eye_gaze_dominant?: string | null
          facial_analysis_json?: Json | null
          facial_stress_score?: number | null
          filler_words_count?: number | null
          harmonics_to_noise?: number | null
          id?: string
          jitter?: number | null
          jitter_absolute?: number | null
          jitter_deviation?: number | null
          latency_deviation?: number | null
          lip_tension?: number | null
          longest_pause_ms?: number | null
          match_id?: string | null
          micro_expressions_detected?: string[] | null
          mycroft_forensic_details?: string | null
          mycroft_verdict?: string | null
          peak_amplitude?: number | null
          pitch_deviation?: number | null
          pitch_stability?: string | null
          pitch_variance?: number | null
          player_id?: string | null
          player_name?: string | null
          pnl_access_type?: string | null
          question_category?: string | null
          question_difficulty?: string | null
          question_id?: string | null
          recording_duration_ms?: number | null
          response_latency_ms?: number | null
          room_id?: string | null
          round_number?: number
          session_id?: string | null
          shimmer?: number | null
          silent_periods_count?: number | null
          speech_continuity?: number | null
          speech_rate_bpm?: number | null
          speech_rate_deviation?: number | null
          stress_level?: string | null
          stress_score?: number | null
          time_to_answer_ms?: number | null
          video_url?: string | null
          was_bluffing?: boolean | null
          words_per_minute?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_recordings_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "biometric_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_recordings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_recordings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_recordings_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_recordings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
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
            foreignKeyName: "votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "voice_recordings"
            referencedColumns: ["id"]
          },
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
    }
    Functions: {
      calculate_rank_title: { Args: { coins: number }; Returns: string }
      claim_daily_nt_bonus: {
        Args: { p_amount?: number; p_user_id: string }
        Returns: boolean
      }
      claim_daily_streak_bonus: { Args: { p_user_id: string }; Returns: number }
      generate_training_label: {
        Args: { p_recording_id: string }
        Returns: string
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
      spend_nt_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: boolean
      }
      update_trader_balance: {
        Args: { p_amount: number; p_is_win?: boolean; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      answer_option: "A" | "B" | "C" | "D"
      app_role: "admin" | "user"
      difficulty_level: "Easy" | "Medium" | "Hard"
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
      difficulty_level: ["Easy", "Medium", "Hard"],
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
