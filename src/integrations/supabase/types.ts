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
          audio_url: string
          avg_pitch: number | null
          created_at: string
          harmonics_to_noise: number | null
          id: string
          jitter: number | null
          jitter_absolute: number | null
          jitter_deviation: number | null
          latency_deviation: number | null
          mycroft_forensic_details: string | null
          mycroft_verdict: string | null
          peak_amplitude: number | null
          pitch_deviation: number | null
          pitch_stability: string | null
          pitch_variance: number | null
          player_id: string | null
          player_name: string | null
          question_id: string | null
          recording_duration_ms: number | null
          response_latency_ms: number | null
          room_id: string | null
          round_number: number
          session_id: string | null
          shimmer: number | null
          speech_rate_bpm: number | null
          speech_rate_deviation: number | null
          stress_level: string | null
          stress_score: number | null
          was_bluffing: boolean | null
        }
        Insert: {
          audio_url: string
          avg_pitch?: number | null
          created_at?: string
          harmonics_to_noise?: number | null
          id?: string
          jitter?: number | null
          jitter_absolute?: number | null
          jitter_deviation?: number | null
          latency_deviation?: number | null
          mycroft_forensic_details?: string | null
          mycroft_verdict?: string | null
          peak_amplitude?: number | null
          pitch_deviation?: number | null
          pitch_stability?: string | null
          pitch_variance?: number | null
          player_id?: string | null
          player_name?: string | null
          question_id?: string | null
          recording_duration_ms?: number | null
          response_latency_ms?: number | null
          room_id?: string | null
          round_number?: number
          session_id?: string | null
          shimmer?: number | null
          speech_rate_bpm?: number | null
          speech_rate_deviation?: number | null
          stress_level?: string | null
          stress_score?: number | null
          was_bluffing?: boolean | null
        }
        Update: {
          audio_url?: string
          avg_pitch?: number | null
          created_at?: string
          harmonics_to_noise?: number | null
          id?: string
          jitter?: number | null
          jitter_absolute?: number | null
          jitter_deviation?: number | null
          latency_deviation?: number | null
          mycroft_forensic_details?: string | null
          mycroft_verdict?: string | null
          peak_amplitude?: number | null
          pitch_deviation?: number | null
          pitch_stability?: string | null
          pitch_variance?: number | null
          player_id?: string | null
          player_name?: string | null
          question_id?: string | null
          recording_duration_ms?: number | null
          response_latency_ms?: number | null
          room_id?: string | null
          round_number?: number
          session_id?: string | null
          shimmer?: number | null
          speech_rate_bpm?: number | null
          speech_rate_deviation?: number | null
          stress_level?: string | null
          stress_score?: number | null
          was_bluffing?: boolean | null
        }
        Relationships: [
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
          created_at: string
          id: string
          player_id: string
          question_id: string
          room_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          question_id: string
          room_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          question_id?: string
          room_id?: string
          vote_type?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
