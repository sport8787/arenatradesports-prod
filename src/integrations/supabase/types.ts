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
      players: {
        Row: {
          avatar_url: string | null
          bluffcoins: number
          created_at: string
          id: string
          is_host: boolean
          nickname: string
          room_id: string
          score: number
          session_id: string
        }
        Insert: {
          avatar_url?: string | null
          bluffcoins?: number
          created_at?: string
          id?: string
          is_host?: boolean
          nickname: string
          room_id: string
          score?: number
          session_id: string
        }
        Update: {
          avatar_url?: string | null
          bluffcoins?: number
          created_at?: string
          id?: string
          is_host?: boolean
          nickname?: string
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
      rooms: {
        Row: {
          created_at: string
          current_player_index: number
          current_question_id: string | null
          current_status: Database["public"]["Enums"]["room_status"]
          host_id: string
          id: string
          pin: string
        }
        Insert: {
          created_at?: string
          current_player_index?: number
          current_question_id?: string | null
          current_status?: Database["public"]["Enums"]["room_status"]
          host_id: string
          id?: string
          pin: string
        }
        Update: {
          created_at?: string
          current_player_index?: number
          current_question_id?: string | null
          current_status?: Database["public"]["Enums"]["room_status"]
          host_id?: string
          id?: string
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
      [_ in never]: never
    }
    Enums: {
      answer_option: "A" | "B" | "C" | "D"
      difficulty_level: "Easy" | "Medium" | "Hard"
      room_status: "lobby" | "question" | "discussion" | "voting" | "result"
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
      difficulty_level: ["Easy", "Medium", "Hard"],
      room_status: ["lobby", "question", "discussion", "voting", "result"],
    },
  },
} as const
