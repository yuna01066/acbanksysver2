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
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_name: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_name?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_name?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      adhesive_costs: {
        Row: {
          cost: number
          created_at: string | null
          id: string
          panel_master_id: string
          thickness: string
          updated_at: string | null
        }
        Insert: {
          cost?: number
          created_at?: string | null
          id?: string
          panel_master_id: string
          thickness: string
          updated_at?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          id?: string
          panel_master_id?: string
          thickness?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adhesive_costs_panel_master_id_fkey"
            columns: ["panel_master_id"]
            isOneToOne: false
            referencedRelation: "panel_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      advanced_processing_settings: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          setting_key: string
          setting_value: number
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          setting_key: string
          setting_value: number
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          setting_key?: string
          setting_value?: number
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string
          author_name: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in: string | null
          check_in_location: Json | null
          check_out: string | null
          check_out_location: Json | null
          created_at: string
          date: string
          id: string
          memo: string | null
          status: string
          updated_at: string
          user_id: string
          user_name: string
          work_hours: number | null
        }
        Insert: {
          check_in?: string | null
          check_in_location?: Json | null
          check_out?: string | null
          check_out_location?: Json | null
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_name: string
          work_hours?: number | null
        }
        Update: {
          check_in?: string | null
          check_in_location?: Json | null
          check_out?: string | null
          check_out_location?: Json | null
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_name?: string
          work_hours?: number | null
        }
        Relationships: []
      }
      category_logic_slots: {
        Row: {
          category: string
          created_at: string
          id: string
          slot_key: string
          slot_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          slot_key: string
          slot_order: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          slot_key?: string
          slot_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      color_mixing_costs: {
        Row: {
          cost: number
          created_at: string | null
          id: string
          panel_master_id: string
          thickness: string
          updated_at: string | null
        }
        Insert: {
          cost: number
          created_at?: string | null
          id?: string
          panel_master_id: string
          thickness: string
          updated_at?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          id?: string
          panel_master_id?: string
          thickness?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "color_mixing_costs_panel_master_id_fkey"
            columns: ["panel_master_id"]
            isOneToOne: false
            referencedRelation: "panel_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      color_options: {
        Row: {
          color_code: string | null
          color_name: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          panel_master_id: string
          updated_at: string | null
        }
        Insert: {
          color_code?: string | null
          color_name: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          panel_master_id: string
          updated_at?: string | null
        }
        Update: {
          color_code?: string | null
          color_name?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          panel_master_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "color_options_panel_master_id_fkey"
            columns: ["panel_master_id"]
            isOneToOne: false
            referencedRelation: "panel_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      company_holidays: {
        Row: {
          created_at: string
          end_date: string
          holiday_type: string
          id: string
          is_recurring: boolean
          name: string
          start_date: string
          substitute_holiday: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          holiday_type?: string
          id?: string
          is_recurring?: boolean
          name: string
          start_date: string
          substitute_holiday?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          holiday_type?: string
          id?: string
          is_recurring?: boolean
          name?: string
          start_date?: string
          substitute_holiday?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      company_info: {
        Row: {
          address: string | null
          business_number: string | null
          business_type: string | null
          ceo_name: string | null
          company_name: string
          created_at: string
          detail_address: string | null
          email: string | null
          established_date: string | null
          fax: string | null
          id: string
          industry: string | null
          logo_url: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name?: string
          created_at?: string
          detail_address?: string | null
          email?: string | null
          established_date?: string | null
          fax?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name?: string
          created_at?: string
          detail_address?: string | null
          email?: string | null
          established_date?: string | null
          fax?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          pay_day: number | null
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          pay_day?: number | null
          template_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pay_day?: number | null
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      document_categories: {
        Row: {
          allow_multiple: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_confidential: boolean
          name: string
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_confidential?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_confidential?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          category_id: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          annual_salary: number | null
          base_pay: number | null
          birth_date: string | null
          comprehensive_wage_basis: string | null
          comprehensive_wage_hours: number | null
          comprehensive_wage_type: string | null
          contract_date: string
          contract_end_date: string | null
          contract_start_date: string | null
          contract_type: string
          created_at: string
          department: string | null
          fixed_overtime_hours: number | null
          fixed_overtime_pay: number | null
          id: string
          monthly_salary: number | null
          notes: string | null
          other_allowances: Json | null
          pay_day: number | null
          position: string | null
          probation_end_date: string | null
          probation_period: string | null
          probation_salary_rate: number | null
          probation_start_date: string | null
          requested_at: string | null
          requested_by: string | null
          signed_at: string | null
          status: string
          template_id: string | null
          updated_at: string
          user_id: string
          user_name: string
          wage_basis: string | null
          wage_start_date: string | null
          work_days: string | null
          work_type: string | null
        }
        Insert: {
          annual_salary?: number | null
          base_pay?: number | null
          birth_date?: string | null
          comprehensive_wage_basis?: string | null
          comprehensive_wage_hours?: number | null
          comprehensive_wage_type?: string | null
          contract_date?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string
          created_at?: string
          department?: string | null
          fixed_overtime_hours?: number | null
          fixed_overtime_pay?: number | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          other_allowances?: Json | null
          pay_day?: number | null
          position?: string | null
          probation_end_date?: string | null
          probation_period?: string | null
          probation_salary_rate?: number | null
          probation_start_date?: string | null
          requested_at?: string | null
          requested_by?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id: string
          user_name: string
          wage_basis?: string | null
          wage_start_date?: string | null
          work_days?: string | null
          work_type?: string | null
        }
        Update: {
          annual_salary?: number | null
          base_pay?: number | null
          birth_date?: string | null
          comprehensive_wage_basis?: string | null
          comprehensive_wage_hours?: number | null
          comprehensive_wage_type?: string | null
          contract_date?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string
          created_at?: string
          department?: string | null
          fixed_overtime_hours?: number | null
          fixed_overtime_pay?: number | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          other_allowances?: Json | null
          pay_day?: number | null
          position?: string | null
          probation_end_date?: string | null
          probation_period?: string | null
          probation_salary_rate?: number | null
          probation_start_date?: string | null
          requested_at?: string | null
          requested_by?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
          user_name?: string
          wage_basis?: string | null
          wage_start_date?: string | null
          work_days?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_law_settings: {
        Row: {
          created_at: string | null
          id: string
          minimum_hourly_wage: number
          monthly_work_hours: number
          notes: string | null
          updated_at: string | null
          weekly_holiday_hours: number
          weekly_work_hours: number
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          minimum_hourly_wage?: number
          monthly_work_hours?: number
          notes?: string | null
          updated_at?: string | null
          weekly_holiday_hours?: number
          weekly_work_hours?: number
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          minimum_hourly_wage?: number
          monthly_work_hours?: number
          notes?: string | null
          updated_at?: string | null
          weekly_holiday_hours?: number
          weekly_work_hours?: number
          year?: number
        }
        Relationships: []
      }
      leave_general_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      leave_policy_settings: {
        Row: {
          allow_advance_use: boolean
          approver_required: boolean
          auto_expire_enabled: boolean
          auto_expire_type: string
          created_at: string | null
          description: string | null
          grant_basis: string
          grant_method: string
          id: string
          is_default: boolean
          leave_unit: string
          policy_name: string
          smart_promotion: string
          updated_at: string | null
        }
        Insert: {
          allow_advance_use?: boolean
          approver_required?: boolean
          auto_expire_enabled?: boolean
          auto_expire_type?: string
          created_at?: string | null
          description?: string | null
          grant_basis?: string
          grant_method?: string
          id?: string
          is_default?: boolean
          leave_unit?: string
          policy_name?: string
          smart_promotion?: string
          updated_at?: string | null
        }
        Update: {
          allow_advance_use?: boolean
          approver_required?: boolean
          auto_expire_enabled?: boolean
          auto_expire_type?: string
          created_at?: string | null
          description?: string | null
          grant_basis?: string
          grant_method?: string
          id?: string
          is_default?: boolean
          leave_unit?: string
          policy_name?: string
          smart_promotion?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          reject_reason: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          days?: number
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          reject_reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          reject_reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          description: string
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          description: string
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          description?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      panel_masters: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          material: Database["public"]["Enums"]["panel_material"]
          name: string
          quality: Database["public"]["Enums"]["panel_quality"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          material: Database["public"]["Enums"]["panel_material"]
          name: string
          quality: Database["public"]["Enums"]["panel_quality"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          material?: Database["public"]["Enums"]["panel_material"]
          name?: string
          quality?: Database["public"]["Enums"]["panel_quality"]
          updated_at?: string | null
        }
        Relationships: []
      }
      panel_sizes: {
        Row: {
          actual_height: number
          actual_width: number
          created_at: string | null
          id: string
          is_active: boolean | null
          panel_master_id: string
          price: number | null
          size_name: string
          thickness: string
          updated_at: string | null
        }
        Insert: {
          actual_height: number
          actual_width: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          panel_master_id: string
          price?: number | null
          size_name: string
          thickness: string
          updated_at?: string | null
        }
        Update: {
          actual_height?: number
          actual_width?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          panel_master_id?: string
          price?: number | null
          size_name?: string
          thickness?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panel_sizes_panel_master_id_fkey"
            columns: ["panel_master_id"]
            isOneToOne: false
            referencedRelation: "panel_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      peer_feedback: {
        Row: {
          created_at: string
          emoji: string | null
          feedback_type: string
          id: string
          is_read: boolean
          meeting_date: string | null
          meeting_status: string
          meeting_time: string | null
          message: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          feedback_type: string
          id?: string
          is_read?: boolean
          meeting_date?: string | null
          meeting_status?: string
          meeting_time?: string | null
          message: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          feedback_type?: string
          id?: string
          is_read?: boolean
          meeting_date?: string | null
          meeting_status?: string
          meeting_time?: string | null
          message?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      performance_review_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      performance_review_cycles: {
        Row: {
          created_at: string
          end_date: string
          id: string
          quarter: number
          start_date: string
          status: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          quarter: number
          start_date: string
          status?: string
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          quarter?: number
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      performance_review_scores: {
        Row: {
          category_id: string
          comment: string | null
          created_at: string
          id: string
          review_id: string
          score: number
        }
        Insert: {
          category_id: string
          comment?: string | null
          created_at?: string
          id?: string
          review_id: string
          score?: number
        }
        Update: {
          category_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_scores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "performance_review_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_review_summaries: {
        Row: {
          avg_goal_rate: number | null
          avg_score: number | null
          category_scores: Json | null
          created_at: string
          cycle_id: string
          general_comment: string | null
          id: string
          improvements_summary: string | null
          overall_grade: string | null
          reviewee_id: string
          reviewee_name: string
          sent_at: string
          sent_by: string
          sent_by_name: string
          strengths_summary: string | null
          updated_at: string
        }
        Insert: {
          avg_goal_rate?: number | null
          avg_score?: number | null
          category_scores?: Json | null
          created_at?: string
          cycle_id: string
          general_comment?: string | null
          id?: string
          improvements_summary?: string | null
          overall_grade?: string | null
          reviewee_id: string
          reviewee_name: string
          sent_at?: string
          sent_by: string
          sent_by_name: string
          strengths_summary?: string | null
          updated_at?: string
        }
        Update: {
          avg_goal_rate?: number | null
          avg_score?: number | null
          category_scores?: Json | null
          created_at?: string
          cycle_id?: string
          general_comment?: string | null
          id?: string
          improvements_summary?: string | null
          overall_grade?: string | null
          reviewee_id?: string
          reviewee_name?: string
          sent_at?: string
          sent_by?: string
          sent_by_name?: string
          strengths_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_summaries_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_review_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          created_at: string
          cycle_id: string
          general_comment: string | null
          goal_achievement_rate: number | null
          id: string
          improvements: string | null
          overall_grade: string | null
          reviewee_id: string
          reviewee_name: string
          reviewer_id: string
          reviewer_name: string
          reviewer_type: string
          status: string
          strengths: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          general_comment?: string | null
          goal_achievement_rate?: number | null
          id?: string
          improvements?: string | null
          overall_grade?: string | null
          reviewee_id: string
          reviewee_name: string
          reviewer_id: string
          reviewer_name: string
          reviewer_type?: string
          status?: string
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          general_comment?: string | null
          goal_achievement_rate?: number | null
          id?: string
          improvements?: string | null
          overall_grade?: string | null
          reviewee_id?: string
          reviewee_name?: string
          reviewer_id?: string
          reviewer_name?: string
          reviewer_type?: string
          status?: string
          strengths?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_review_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      pluuug_sync_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          pluuug_estimate_id: string
          quote_id: string
          resolved_action: string | null
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          pluuug_estimate_id: string
          quote_id: string
          resolved_action?: string | null
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          pluuug_estimate_id?: string
          quote_id?: string
          resolved_action?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      processing_categories: {
        Row: {
          category_key: string
          category_name: string
          created_at: string
          display_order: number
          icon_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category_key: string
          category_name: string
          created_at?: string
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category_key?: string
          category_name?: string
          created_at?: string
          display_order?: number
          icon_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      processing_options: {
        Row: {
          allow_multiple: boolean | null
          applicable_thicknesses: string[] | null
          base_cost: number | null
          category:
            | Database["public"]["Enums"]["processing_option_category"]
            | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          max_quantity: number | null
          min_quantity: number | null
          multiplier: number | null
          name: string
          option_id: string
          option_type: Database["public"]["Enums"]["processing_option_type"]
          updated_at: string | null
        }
        Insert: {
          allow_multiple?: boolean | null
          applicable_thicknesses?: string[] | null
          base_cost?: number | null
          category?:
            | Database["public"]["Enums"]["processing_option_category"]
            | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          min_quantity?: number | null
          multiplier?: number | null
          name: string
          option_id: string
          option_type: Database["public"]["Enums"]["processing_option_type"]
          updated_at?: string | null
        }
        Update: {
          allow_multiple?: boolean | null
          applicable_thicknesses?: string[] | null
          base_cost?: number | null
          category?:
            | Database["public"]["Enums"]["processing_option_category"]
            | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          min_quantity?: number | null
          multiplier?: number | null
          name?: string
          option_id?: string
          option_type?: Database["public"]["Enums"]["processing_option_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          awards: string | null
          bank_account: string | null
          bank_name: string | null
          birthday: string | null
          career_history: string | null
          created_at: string | null
          department: string | null
          detail_address: string | null
          disciplinary: string | null
          education: string | null
          email: string
          employee_number: string | null
          family_basic_deduction: number | null
          family_child_tax_credit: number | null
          family_health_dependents: number | null
          family_info: string | null
          full_name: string
          group_join_date: string | null
          holidays: string | null
          id: string
          is_approved: boolean
          job_group: string | null
          job_title: string | null
          join_date: string | null
          join_type: string | null
          leave_history: string | null
          leave_policy: string | null
          nationality: string | null
          nickname: string | null
          overtime_policy: string | null
          personal_email: string | null
          phone: string | null
          position: string | null
          rank_level: string | null
          rank_title: string | null
          resident_registration_number: string | null
          salary_info: string | null
          special_notes: string | null
          updated_at: string | null
          wage_contract: string | null
          work_hours_per_week: number | null
          work_type: string | null
          zipcode: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          awards?: string | null
          bank_account?: string | null
          bank_name?: string | null
          birthday?: string | null
          career_history?: string | null
          created_at?: string | null
          department?: string | null
          detail_address?: string | null
          disciplinary?: string | null
          education?: string | null
          email: string
          employee_number?: string | null
          family_basic_deduction?: number | null
          family_child_tax_credit?: number | null
          family_health_dependents?: number | null
          family_info?: string | null
          full_name: string
          group_join_date?: string | null
          holidays?: string | null
          id: string
          is_approved?: boolean
          job_group?: string | null
          job_title?: string | null
          join_date?: string | null
          join_type?: string | null
          leave_history?: string | null
          leave_policy?: string | null
          nationality?: string | null
          nickname?: string | null
          overtime_policy?: string | null
          personal_email?: string | null
          phone?: string | null
          position?: string | null
          rank_level?: string | null
          rank_title?: string | null
          resident_registration_number?: string | null
          salary_info?: string | null
          special_notes?: string | null
          updated_at?: string | null
          wage_contract?: string | null
          work_hours_per_week?: number | null
          work_type?: string | null
          zipcode?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          awards?: string | null
          bank_account?: string | null
          bank_name?: string | null
          birthday?: string | null
          career_history?: string | null
          created_at?: string | null
          department?: string | null
          detail_address?: string | null
          disciplinary?: string | null
          education?: string | null
          email?: string
          employee_number?: string | null
          family_basic_deduction?: number | null
          family_child_tax_credit?: number | null
          family_health_dependents?: number | null
          family_info?: string | null
          full_name?: string
          group_join_date?: string | null
          holidays?: string | null
          id?: string
          is_approved?: boolean
          job_group?: string | null
          job_title?: string | null
          join_date?: string | null
          join_type?: string | null
          leave_history?: string | null
          leave_policy?: string | null
          nationality?: string | null
          nickname?: string | null
          overtime_policy?: string | null
          personal_email?: string | null
          phone?: string | null
          position?: string | null
          rank_level?: string | null
          rank_title?: string | null
          resident_registration_number?: string | null
          salary_info?: string | null
          special_notes?: string | null
          updated_at?: string | null
          wage_contract?: string | null
          work_hours_per_week?: number | null
          work_type?: string | null
          zipcode?: string | null
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          content: string
          created_at: string
          id: string
          notion_links: Json | null
          project_id: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          notion_links?: Json | null
          project_id: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          notion_links?: Json | null
          project_id?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          payment_status: string
          recipient_id: string | null
          specs: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          payment_status?: string
          recipient_id?: string | null
          specs?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          payment_status?: string
          recipient_id?: string | null
          specs?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_memos: {
        Row: {
          content: string
          created_at: string
          id: string
          quote_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          quote_id: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          quote_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_memos_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipients: {
        Row: {
          address: string | null
          branch_number: string | null
          business_class: string | null
          business_document_url: string | null
          business_registration_number: string | null
          business_type: string | null
          ceo_name: string | null
          company_name: string
          contact_person: string
          created_at: string
          detail_address: string | null
          email: string
          id: string
          memo: string | null
          phone: string
          pluuug_client_id: number | null
          pluuug_synced_at: string | null
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          branch_number?: string | null
          business_class?: string | null
          business_document_url?: string | null
          business_registration_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name: string
          contact_person: string
          created_at?: string
          detail_address?: string | null
          email: string
          id?: string
          memo?: string | null
          phone: string
          pluuug_client_id?: number | null
          pluuug_synced_at?: string | null
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          branch_number?: string | null
          business_class?: string | null
          business_document_url?: string | null
          business_registration_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name?: string
          contact_person?: string
          created_at?: string
          detail_address?: string | null
          email?: string
          id?: string
          memo?: string | null
          phone?: string
          pluuug_client_id?: number | null
          pluuug_synced_at?: string | null
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_quotes: {
        Row: {
          attachments: Json | null
          created_at: string
          custom_color_name: string | null
          custom_opacity: string | null
          delivery_period: string | null
          desired_delivery_date: string | null
          id: string
          issuer_department: string | null
          issuer_email: string | null
          issuer_name: string | null
          issuer_phone: string | null
          issuer_position: string | null
          items: Json
          payment_condition: string | null
          pluuug_estimate_id: string | null
          pluuug_synced: boolean | null
          pluuug_synced_at: string | null
          project_id: string | null
          project_name: string | null
          project_stage: string
          quote_date: string
          quote_date_display: string | null
          quote_number: string
          recipient_address: string | null
          recipient_company: string | null
          recipient_email: string | null
          recipient_memo: string | null
          recipient_name: string | null
          recipient_phone: string | null
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          custom_color_name?: string | null
          custom_opacity?: string | null
          delivery_period?: string | null
          desired_delivery_date?: string | null
          id?: string
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items: Json
          payment_condition?: string | null
          pluuug_estimate_id?: string | null
          pluuug_synced?: boolean | null
          pluuug_synced_at?: string | null
          project_id?: string | null
          project_name?: string | null
          project_stage?: string
          quote_date?: string
          quote_date_display?: string | null
          quote_number: string
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_memo?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          subtotal: number
          tax: number
          total: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          custom_color_name?: string | null
          custom_opacity?: string | null
          delivery_period?: string | null
          desired_delivery_date?: string | null
          id?: string
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items?: Json
          payment_condition?: string | null
          pluuug_estimate_id?: string | null
          pluuug_synced?: boolean | null
          pluuug_synced_at?: string | null
          project_id?: string | null
          project_name?: string | null
          project_stage?: string
          quote_date?: string
          quote_date_display?: string | null
          quote_number?: string
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_memo?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_types: {
        Row: {
          allow_multiple_selection: boolean | null
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          label: string
          show_quantity_control: boolean | null
          slot_key: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          allow_multiple_selection?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          show_quantity_control?: boolean | null
          slot_key: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_multiple_selection?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          show_quantity_control?: boolean | null
          slot_key?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_messages: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          message: string
          user_id: string
          user_name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          message: string
          user_id: string
          user_name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          message?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator" | "manager" | "employee"
      panel_material: "acrylic" | "pet"
      panel_quality:
        | "glossy-color"
        | "glossy-standard"
        | "astel-color"
        | "satin-color"
        | "acrylic-mirror"
        | "astel-mirror"
      processing_option_category:
        | "raw"
        | "simple"
        | "complex"
        | "full"
        | "adhesion"
        | "additional"
      processing_option_type:
        | "additional"
        | "processing"
        | "adhesion"
        | "raw"
        | "slot1"
        | "slot2"
        | "slot3"
        | "slot4"
        | "slot5"
        | "slot6"
        | "advanced_pricing"
        | "slot7"
        | "slot8"
        | "slot9"
        | "slot10"
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
      app_role: ["admin", "user", "moderator", "manager", "employee"],
      panel_material: ["acrylic", "pet"],
      panel_quality: [
        "glossy-color",
        "glossy-standard",
        "astel-color",
        "satin-color",
        "acrylic-mirror",
        "astel-mirror",
      ],
      processing_option_category: [
        "raw",
        "simple",
        "complex",
        "full",
        "adhesion",
        "additional",
      ],
      processing_option_type: [
        "additional",
        "processing",
        "adhesion",
        "raw",
        "slot1",
        "slot2",
        "slot3",
        "slot4",
        "slot5",
        "slot6",
        "advanced_pricing",
        "slot7",
        "slot8",
        "slot9",
        "slot10",
      ],
    },
  },
} as const
