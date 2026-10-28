export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; institution: string | null; created_at: string; updated_at: string };
        Insert: { id: string; full_name?: string | null; institution?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; full_name?: string | null; institution?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      modules: {
        Row: { id: string; title: string; slug: string; description: string | null; sort_order: number; pass_mark: number; estimated_minutes: number | null; is_published: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; slug: string; description?: string | null; sort_order: number; pass_mark?: number; estimated_minutes?: number | null; is_published?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; title?: string; slug?: string; description?: string | null; sort_order?: number; pass_mark?: number; estimated_minutes?: number | null; is_published?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'modules_pkey'; columns: ['id']; isOneToOne: true; referencedRelation: 'modules'; referencedColumns: ['id'] }];
      };
      lessons: {
        Row: { id: string; module_id: string; title: string; summary: string | null; content: string; sort_order: number; estimated_minutes: number; is_published: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; module_id: string; title: string; summary?: string | null; content?: string; sort_order: number; estimated_minutes?: number; is_published?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; module_id?: string; title?: string; summary?: string | null; content?: string; sort_order?: number; estimated_minutes?: number; is_published?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'lessons_module_id_fkey'; columns: ['module_id']; isOneToOne: false; referencedRelation: 'modules'; referencedColumns: ['id'] }];
      };
      practical_activities: {
        Row: { id: string; module_id: string; lesson_id: string | null; title: string; instructions: string; activity_type: string; configuration: Json; sort_order: number; is_published: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; module_id: string; lesson_id?: string | null; title: string; instructions: string; activity_type: string; configuration?: Json; sort_order: number; is_published?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; module_id?: string; lesson_id?: string | null; title?: string; instructions?: string; activity_type?: string; configuration?: Json; sort_order?: number; is_published?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'practical_activities_module_id_fkey'; columns: ['module_id']; isOneToOne: false; referencedRelation: 'modules'; referencedColumns: ['id'] }, { foreignKeyName: 'practical_activities_lesson_id_fkey'; columns: ['lesson_id']; isOneToOne: false; referencedRelation: 'lessons'; referencedColumns: ['id'] }];
      };
      module_progress: {
        Row: { id: string; user_id: string; module_id: string; status: string; highest_score: number | null; started_at: string | null; completed_at: string | null; updated_at: string };
        Insert: { id?: string; user_id: string; module_id: string; status?: string; highest_score?: number | null; started_at?: string | null; completed_at?: string | null; updated_at?: string };
        Update: { id?: string; user_id?: string; module_id?: string; status?: string; highest_score?: number | null; started_at?: string | null; completed_at?: string | null; updated_at?: string };
        Relationships: [{ foreignKeyName: 'module_progress_module_id_fkey'; columns: ['module_id']; isOneToOne: false; referencedRelation: 'modules'; referencedColumns: ['id'] }];
      };
      lesson_progress: {
        Row: { id: string; user_id: string; lesson_id: string; is_completed: boolean; completed_at: string | null; updated_at: string };
        Insert: { id?: string; user_id: string; lesson_id: string; is_completed?: boolean; completed_at?: string | null; updated_at?: string };
        Update: { id?: string; user_id?: string; lesson_id?: string; is_completed?: boolean; completed_at?: string | null; updated_at?: string };
        Relationships: [{ foreignKeyName: 'lesson_progress_lesson_id_fkey'; columns: ['lesson_id']; isOneToOne: false; referencedRelation: 'lessons'; referencedColumns: ['id'] }];
      };
      assessments: {
        Row: { id: string; module_id: string | null; title: string; assessment_type: string; pass_mark: number; is_published: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; module_id?: string | null; title: string; assessment_type: string; pass_mark?: number; is_published?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; module_id?: string | null; title?: string; assessment_type?: string; pass_mark?: number; is_published?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'assessments_module_id_fkey'; columns: ['module_id']; isOneToOne: false; referencedRelation: 'modules'; referencedColumns: ['id'] }];
      };
      assessment_questions: {
        Row: { id: string; assessment_id: string; topic: string; question_text: string; feedback_text: string | null; sort_order: number; points: number; created_at: string; updated_at: string };
        Insert: { id?: string; assessment_id: string; topic: string; question_text: string; feedback_text?: string | null; sort_order: number; points?: number; created_at?: string; updated_at?: string };
        Update: { id?: string; assessment_id?: string; topic?: string; question_text?: string; feedback_text?: string | null; sort_order?: number; points?: number; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'assessment_questions_assessment_id_fkey'; columns: ['assessment_id']; isOneToOne: false; referencedRelation: 'assessments'; referencedColumns: ['id'] }];
      };
      assessment_options: {
        Row: { id: string; question_id: string; option_text: string; sort_order: number };
        Insert: { id?: string; question_id: string; option_text: string; sort_order: number };
        Update: { id?: string; question_id?: string; option_text?: string; sort_order?: number };
        Relationships: [{ foreignKeyName: 'assessment_options_question_id_fkey'; columns: ['question_id']; isOneToOne: false; referencedRelation: 'assessment_questions'; referencedColumns: ['id'] }];
      };
      assessment_answer_keys: {
        Row: { question_id: string; correct_option_id: string; explanation: string };
        Insert: { question_id: string; correct_option_id: string; explanation: string };
        Update: { question_id?: string; correct_option_id?: string; explanation?: string };
        Relationships: [{ foreignKeyName: 'assessment_answer_keys_question_id_fkey'; columns: ['question_id']; isOneToOne: true; referencedRelation: 'assessment_questions'; referencedColumns: ['id'] }, { foreignKeyName: 'assessment_answer_keys_correct_option_id_fkey'; columns: ['correct_option_id']; isOneToOne: false; referencedRelation: 'assessment_options'; referencedColumns: ['id'] }];
      };
      assessment_attempts: {
        Row: { id: string; user_id: string; assessment_id: string; score: number | null; passed: boolean | null; topic_scores: Json; started_at: string; completed_at: string | null };
        Insert: { id?: string; user_id: string; assessment_id: string; score?: number | null; passed?: boolean | null; topic_scores?: Json; started_at?: string; completed_at?: string | null };
        Update: { id?: string; user_id?: string; assessment_id?: string; score?: number | null; passed?: boolean | null; topic_scores?: Json; started_at?: string; completed_at?: string | null };
        Relationships: [{ foreignKeyName: 'assessment_attempts_assessment_id_fkey'; columns: ['assessment_id']; isOneToOne: false; referencedRelation: 'assessments'; referencedColumns: ['id'] }];
      };
      assessment_answers: {
        Row: { id: string; attempt_id: string; question_id: string; selected_option_id: string; is_correct: boolean | null; answered_at: string };
        Insert: { id?: string; attempt_id: string; question_id: string; selected_option_id: string; is_correct?: boolean | null; answered_at?: string };
        Update: { id?: string; attempt_id?: string; question_id?: string; selected_option_id?: string; is_correct?: boolean | null; answered_at?: string };
        Relationships: [{ foreignKeyName: 'assessment_answers_attempt_id_fkey'; columns: ['attempt_id']; isOneToOne: false; referencedRelation: 'assessment_attempts'; referencedColumns: ['id'] }, { foreignKeyName: 'assessment_answers_question_id_fkey'; columns: ['question_id']; isOneToOne: false; referencedRelation: 'assessment_questions'; referencedColumns: ['id'] }, { foreignKeyName: 'assessment_answers_selected_option_id_fkey'; columns: ['selected_option_id']; isOneToOne: false; referencedRelation: 'assessment_options'; referencedColumns: ['id'] }];
      };
      financial_categories: {
        Row: { id: string; user_id: string | null; name: string; entry_type: string; is_system: boolean; created_at: string };
        Insert: { id?: string; user_id?: string | null; name: string; entry_type: string; is_system?: boolean; created_at?: string };
        Update: { id?: string; user_id?: string | null; name?: string; entry_type?: string; is_system?: boolean; created_at?: string };
        Relationships: [];
      };
      financial_entries: {
        Row: { id: string; user_id: string; category_id: string; entry_type: string; amount: number; description: string | null; occurred_on: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; category_id: string; entry_type: string; amount: number; description?: string | null; occurred_on?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; category_id?: string; entry_type?: string; amount?: number; description?: string | null; occurred_on?: string; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'financial_entries_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'financial_categories'; referencedColumns: ['id'] }];
      };
      recurring_entries: {
        Row: { id: string; user_id: string; category_id: string; entry_type: string; amount: number; description: string | null; frequency_unit: string; interval_count: number; starts_on: string; ends_on: string | null; next_occurrence_on: string; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; category_id: string; entry_type: string; amount: number; description?: string | null; frequency_unit: string; interval_count?: number; starts_on: string; ends_on?: string | null; next_occurrence_on: string; is_active?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; category_id?: string; entry_type?: string; amount?: number; description?: string | null; frequency_unit?: string; interval_count?: number; starts_on?: string; ends_on?: string | null; next_occurrence_on?: string; is_active?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'recurring_entries_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'financial_categories'; referencedColumns: ['id'] }];
      };
      loan_assessments: {
        Row: { id: string; user_id: string; input_source: string; principal: number; annual_interest_rate: number; term_months: number; monthly_income: number; monthly_expenses: number; estimated_monthly_payment: number; estimated_total_repayment: number; repayment_to_income_ratio: number | null; remaining_income: number; affordability_result: string; educational_warning: string; calculated_at: string };
        Insert: { id?: string; user_id: string; input_source: string; principal: number; annual_interest_rate: number; term_months: number; monthly_income: number; monthly_expenses: number; estimated_monthly_payment: number; estimated_total_repayment: number; repayment_to_income_ratio?: number | null; remaining_income: number; affordability_result: string; educational_warning: string; calculated_at?: string };
        Update: { id?: string; user_id?: string; input_source?: string; principal?: number; annual_interest_rate?: number; term_months?: number; monthly_income?: number; monthly_expenses?: number; estimated_monthly_payment?: number; estimated_total_repayment?: number; repayment_to_income_ratio?: number | null; remaining_income?: number; affordability_result?: string; educational_warning?: string; calculated_at?: string };
        Relationships: [];
      };
      ai_explanations: {
        Row: { id: string; user_id: string; lesson_id: string; request_type: string; source_section: string | null; source_fingerprint: string; explanation: string; created_at: string };
        Insert: { id?: string; user_id: string; lesson_id: string; request_type: string; source_section?: string | null; source_fingerprint: string; explanation: string; created_at?: string };
        Update: { id?: string; user_id?: string; lesson_id?: string; request_type?: string; source_section?: string | null; source_fingerprint?: string; explanation?: string; created_at?: string };
        Relationships: [{ foreignKeyName: 'ai_explanations_lesson_id_fkey'; columns: ['lesson_id']; isOneToOne: false; referencedRelation: 'lessons'; referencedColumns: ['id'] }];
      };
      user_streaks: {
        Row: { user_id: string; current_streak: number; longest_streak: number; last_active_on: string | null; updated_at: string };
        Insert: { user_id: string; current_streak?: number; longest_streak?: number; last_active_on?: string | null; updated_at?: string };
        Update: { user_id?: string; current_streak?: number; longest_streak?: number; last_active_on?: string | null; updated_at?: string };
        Relationships: [];
      };
      badges: {
        Row: { id: string; code: string; name: string; description: string; icon_name: string | null; created_at: string };
        Insert: { id?: string; code: string; name: string; description: string; icon_name?: string | null; created_at?: string };
        Update: { id?: string; code?: string; name?: string; description?: string; icon_name?: string | null; created_at?: string };
        Relationships: [];
      };
      user_badges: {
        Row: { user_id: string; badge_id: string; awarded_at: string };
        Insert: { user_id: string; badge_id: string; awarded_at?: string };
        Update: { user_id?: string; badge_id?: string; awarded_at?: string };
        Relationships: [{ foreignKeyName: 'user_badges_badge_id_fkey'; columns: ['badge_id']; isOneToOne: false; referencedRelation: 'badges'; referencedColumns: ['id'] }];
      };
      notification_preferences: {
        Row: { user_id: string; reminders_enabled: boolean; reminder_time: string; timezone: string; inactivity_days: number; updated_at: string };
        Insert: { user_id: string; reminders_enabled?: boolean; reminder_time?: string; timezone?: string; inactivity_days?: number; updated_at?: string };
        Update: { user_id?: string; reminders_enabled?: boolean; reminder_time?: string; timezone?: string; inactivity_days?: number; updated_at?: string };
        Relationships: [];
      };
      push_devices: {
        Row: { id: string; user_id: string; expo_push_token: string; is_enabled: boolean; last_seen_at: string; created_at: string };
        Insert: { id?: string; user_id: string; expo_push_token: string; is_enabled?: boolean; last_seen_at?: string; created_at?: string };
        Update: { id?: string; user_id?: string; expo_push_token?: string; is_enabled?: boolean; last_seen_at?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
