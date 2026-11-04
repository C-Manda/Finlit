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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_explanations: {
        Row: {
          created_at: string
          explanation: string
          id: string
          lesson_id: string
          request_type: string
          source_fingerprint: string
          source_section: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation: string
          id?: string
          lesson_id: string
          request_type: string
          source_fingerprint: string
          source_section?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          explanation?: string
          id?: string
          lesson_id?: string
          request_type?: string
          source_fingerprint?: string
          source_section?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_explanations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answer_keys: {
        Row: {
          correct_option_id: string
          explanation: string
          question_id: string
        }
        Insert: {
          correct_option_id: string
          explanation: string
          question_id: string
        }
        Update: {
          correct_option_id?: string
          explanation?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_key_option_matches_question"
            columns: ["question_id", "correct_option_id"]
            isOneToOne: false
            referencedRelation: "assessment_options"
            referencedColumns: ["question_id", "id"]
          },
          {
            foreignKeyName: "assessment_answer_keys_correct_option_id_fkey"
            columns: ["correct_option_id"]
            isOneToOne: false
            referencedRelation: "assessment_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answer_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_option_id: string
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_option_id: string
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "assessment_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selected_option_matches_question"
            columns: ["question_id", "selected_option_id"]
            isOneToOne: false
            referencedRelation: "assessment_options"
            referencedColumns: ["question_id", "id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessment_id: string
          completed_at: string | null
          id: string
          passed: boolean | null
          revision: number
          score: number | null
          started_at: string
          topic_scores: Json
          user_id: string
        }
        Insert: {
          assessment_id: string
          completed_at?: string | null
          id?: string
          passed?: boolean | null
          revision?: number
          score?: number | null
          started_at?: string
          topic_scores?: Json
          user_id: string
        }
        Update: {
          assessment_id?: string
          completed_at?: string | null
          id?: string
          passed?: boolean | null
          revision?: number
          score?: number | null
          started_at?: string
          topic_scores?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_options: {
        Row: {
          id: string
          option_text: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          option_text: string
          question_id: string
          sort_order: number
        }
        Update: {
          id?: string
          option_text?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          created_at: string
          feedback_text: string | null
          id: string
          points: number
          question_text: string
          skill_metadata: Json
          sort_order: number
          topic: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          points?: number
          question_text: string
          skill_metadata?: Json
          sort_order: number
          topic: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          points?: number
          question_text?: string
          skill_metadata?: Json
          sort_order?: number
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type: string
          assessment_version: number
          comparison_group: string | null
          content_key: string | null
          created_at: string
          id: string
          is_published: boolean
          module_id: string | null
          pass_mark: number
          title: string
          updated_at: string
        }
        Insert: {
          assessment_type: string
          assessment_version?: number
          comparison_group?: string | null
          content_key?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          module_id?: string | null
          pass_mark?: number
          title: string
          updated_at?: string
        }
        Update: {
          assessment_type?: string
          assessment_version?: number
          comparison_group?: string | null
          content_key?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          module_id?: string | null
          pass_mark?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          code: string
          created_at: string
          description: string
          icon_name: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          icon_name?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          icon_name?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      balance_adjustments: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          location_id: string
          reason: string
          request_id: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          location_id: string
          reason?: string
          request_id: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          location_id?: string
          reason?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_adjustments_user_id_location_id_fkey"
            columns: ["user_id", "location_id"]
            isOneToOne: false
            referencedRelation: "money_locations"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      budget_plans: {
        Row: {
          allocations: Json
          created_at: string
          id: string
          period_end: string
          period_start: string
          planned_income: number
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allocations?: Json
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          planned_income: number
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allocations?: Json
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          planned_income?: number
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          created_at: string
          entry_type: string
          id: string
          is_system: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entry_type: string
          id?: string
          is_system?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entry_type?: string
          id?: string
          is_system?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          destination_location_id: string | null
          entry_type: string
          fee_amount: number
          fee_category_id: string | null
          id: string
          import_metadata: Json | null
          location_id: string | null
          occurred_on: string
          request_id: string | null
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          destination_location_id?: string | null
          entry_type: string
          fee_amount?: number
          fee_category_id?: string | null
          id?: string
          import_metadata?: Json | null
          location_id?: string | null
          occurred_on?: string
          request_id?: string | null
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          destination_location_id?: string | null
          entry_type?: string
          fee_amount?: number
          fee_category_id?: string | null
          id?: string
          import_metadata?: Json | null
          location_id?: string | null
          occurred_on?: string
          request_id?: string | null
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_destination_owner"
            columns: ["user_id", "destination_location_id"]
            isOneToOne: false
            referencedRelation: "money_locations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "entry_source_owner"
            columns: ["user_id", "location_id"]
            isOneToOne: false
            referencedRelation: "money_locations"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_fee_category_id_fkey"
            columns: ["fee_category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_assessment_state: {
        Row: {
          baseline_attempt_id: string | null
          baseline_classification: string | null
          created_at: string
          legacy_learner: boolean
          user_id: string
        }
        Insert: {
          baseline_attempt_id?: string | null
          baseline_classification?: string | null
          created_at?: string
          legacy_learner?: boolean
          user_id: string
        }
        Update: {
          baseline_attempt_id?: string | null
          baseline_classification?: string | null
          created_at?: string
          legacy_learner?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_assessment_state_baseline_attempt_id_fkey"
            columns: ["baseline_attempt_id"]
            isOneToOne: true
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          is_completed: boolean
          lesson_id: string
          player_state: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          lesson_id: string
          player_state?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          is_completed?: boolean
          lesson_id?: string
          player_state?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string
          content_key: string | null
          created_at: string
          estimated_minutes: number
          id: string
          is_published: boolean
          module_id: string
          revision: number
          sort_order: number
          structured_content: Json | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          content_key?: string | null
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_published?: boolean
          module_id: string
          revision?: number
          sort_order: number
          structured_content?: Json | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_key?: string | null
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_published?: boolean
          module_id?: string
          revision?: number
          sort_order?: number
          structured_content?: Json | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_assessments: {
        Row: {
          affordability_result: string
          annual_interest_rate: number
          calculated_at: string
          educational_warning: string
          estimated_monthly_payment: number
          estimated_total_repayment: number
          id: string
          input_source: string
          monthly_expenses: number
          monthly_income: number
          principal: number
          remaining_income: number
          repayment_to_income_ratio: number | null
          term_months: number
          user_id: string
        }
        Insert: {
          affordability_result: string
          annual_interest_rate: number
          calculated_at?: string
          educational_warning: string
          estimated_monthly_payment: number
          estimated_total_repayment: number
          id?: string
          input_source: string
          monthly_expenses: number
          monthly_income: number
          principal: number
          remaining_income: number
          repayment_to_income_ratio?: number | null
          term_months: number
          user_id: string
        }
        Update: {
          affordability_result?: string
          annual_interest_rate?: number
          calculated_at?: string
          educational_warning?: string
          estimated_monthly_payment?: number
          estimated_total_repayment?: number
          id?: string
          input_source?: string
          monthly_expenses?: number
          monthly_income?: number
          principal?: number
          remaining_income?: number
          repayment_to_income_ratio?: number | null
          term_months?: number
          user_id?: string
        }
        Relationships: []
      }
      module_progress: {
        Row: {
          completed_at: string | null
          highest_score: number | null
          id: string
          module_id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          highest_score?: number | null
          id?: string
          module_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          highest_score?: number | null
          id?: string
          module_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          content_key: string | null
          created_at: string
          description: string | null
          estimated_minutes: number | null
          id: string
          is_published: boolean
          pass_mark: number
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content_key?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          pass_mark?: number
          slug: string
          sort_order: number
          title: string
          updated_at?: string
        }
        Update: {
          content_key?: string | null
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          pass_mark?: number
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      money_locations: {
        Row: {
          active: boolean
          colour: string
          created_at: string
          id: string
          location_type: string
          nickname: string
          opening_balance: number
          opening_date: string
          provider: string
          request_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          colour: string
          created_at?: string
          id?: string
          location_type: string
          nickname?: string
          opening_balance?: number
          opening_date?: string
          provider: string
          request_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          colour?: string
          created_at?: string
          id?: string
          location_type?: string
          nickname?: string
          opening_balance?: number
          opening_date?: string
          provider?: string
          request_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          inactivity_days: number
          reminder_time: string
          reminders_enabled: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          inactivity_days?: number
          reminder_time?: string
          reminders_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          inactivity_days?: number
          reminder_time?: string
          reminders_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practical_activities: {
        Row: {
          activity_type: string
          configuration: Json
          created_at: string
          id: string
          instructions: string
          is_published: boolean
          lesson_id: string | null
          module_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          activity_type: string
          configuration?: Json
          created_at?: string
          id?: string
          instructions: string
          is_published?: boolean
          lesson_id?: string | null
          module_id: string
          sort_order: number
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          configuration?: Json
          created_at?: string
          id?: string
          instructions?: string
          is_published?: boolean
          lesson_id?: string | null
          module_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practical_activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practical_activities_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          insights_enabled: boolean
          institution: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          insights_enabled?: boolean
          institution?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          insights_enabled?: boolean
          institution?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_devices: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          is_enabled: boolean
          last_seen_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_entries: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          description: string | null
          ends_on: string | null
          entry_type: string
          frequency_unit: string
          id: string
          interval_count: number
          is_active: boolean
          next_occurrence_on: string
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          description?: string | null
          ends_on?: string | null
          entry_type: string
          frequency_unit: string
          id?: string
          interval_count?: number
          is_active?: boolean
          next_occurrence_on: string
          starts_on: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          description?: string | null
          ends_on?: string | null
          entry_type?: string
          frequency_unit?: string
          id?: string
          interval_count?: number
          is_active?: boolean
          next_occurrence_on?: string
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          current_streak: number
          last_active_on: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_active_on?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_active_on?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finlit_api: {
        Args: { p_action: string; p_payload?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
