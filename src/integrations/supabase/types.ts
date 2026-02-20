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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
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
      [_ in never]: never
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
