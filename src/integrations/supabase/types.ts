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
          announcement_type: string
          assignee_ids: string[] | null
          assignee_names: string[] | null
          author_id: string
          author_name: string
          content: string
          created_at: string
          event_end_date: string | null
          id: string
          is_pinned: boolean
          meeting_date: string | null
          meeting_location: string | null
          meeting_time: string | null
          recipient_id: string | null
          recipient_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          assignee_ids?: string[] | null
          assignee_names?: string[] | null
          author_id: string
          author_name: string
          content: string
          created_at?: string
          event_end_date?: string | null
          id?: string
          is_pinned?: boolean
          meeting_date?: string | null
          meeting_location?: string | null
          meeting_time?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          assignee_ids?: string[] | null
          assignee_names?: string[] | null
          author_id?: string
          author_name?: string
          content?: string
          created_at?: string
          event_end_date?: string | null
          id?: string
          is_pinned?: boolean
          meeting_date?: string | null
          meeting_location?: string | null
          meeting_time?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
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
          location_memo: string | null
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
          location_memo?: string | null
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
          location_memo?: string | null
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
          workplace_lat: number | null
          workplace_lng: number | null
          workplace_radius: number | null
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
          workplace_lat?: number | null
          workplace_lng?: number | null
          workplace_radius?: number | null
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
          workplace_lat?: number | null
          workplace_lng?: number | null
          workplace_radius?: number | null
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          content: Json | null
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
          content?: Json | null
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
          content?: Json | null
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
      custom_leave_types: {
        Row: {
          approval_required: boolean | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          max_days: number | null
          name: string
          paid: boolean | null
          reference_required: boolean | null
          updated_at: string | null
        }
        Insert: {
          approval_required?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_days?: number | null
          name: string
          paid?: boolean | null
          reference_required?: boolean | null
          updated_at?: string | null
        }
        Update: {
          approval_required?: boolean | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_days?: number | null
          name?: string
          paid?: boolean | null
          reference_required?: boolean | null
          updated_at?: string | null
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
      incident_reports: {
        Row: {
          attachments: Json | null
          cause_analysis: string | null
          created_at: string
          cycle_id: string | null
          description: string
          id: string
          incident_date: string
          incident_location: string | null
          incident_subject: string | null
          incident_time: string | null
          prevention_measures: string | null
          requested_at: string | null
          requested_by: string | null
          requested_by_name: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          attachments?: Json | null
          cause_analysis?: string | null
          created_at?: string
          cycle_id?: string | null
          description: string
          id?: string
          incident_date?: string
          incident_location?: string | null
          incident_subject?: string | null
          incident_time?: string | null
          prevention_measures?: string | null
          requested_at?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          attachments?: Json | null
          cause_analysis?: string | null
          created_at?: string
          cycle_id?: string | null
          description?: string
          id?: string
          incident_date?: string
          incident_location?: string | null
          incident_subject?: string | null
          incident_time?: string | null
          prevention_measures?: string | null
          requested_at?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_review_cycles"
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
          annual_leave_method: string | null
          approver_level: string
          approver_required: boolean
          auto_expire_enabled: boolean
          auto_expire_type: string
          created_at: string | null
          decimal_rounding: string | null
          description: string | null
          fiscal_year_month: number | null
          grant_basis: string
          grant_method: string
          id: string
          is_default: boolean
          leave_unit: string
          monthly_leave_method: string | null
          policy_name: string
          smart_promotion: string
          updated_at: string | null
        }
        Insert: {
          allow_advance_use?: boolean
          annual_leave_method?: string | null
          approver_level?: string
          approver_required?: boolean
          auto_expire_enabled?: boolean
          auto_expire_type?: string
          created_at?: string | null
          decimal_rounding?: string | null
          description?: string | null
          fiscal_year_month?: number | null
          grant_basis?: string
          grant_method?: string
          id?: string
          is_default?: boolean
          leave_unit?: string
          monthly_leave_method?: string | null
          policy_name?: string
          smart_promotion?: string
          updated_at?: string | null
        }
        Update: {
          allow_advance_use?: boolean
          annual_leave_method?: string | null
          approver_level?: string
          approver_required?: boolean
          auto_expire_enabled?: boolean
          auto_expire_type?: string
          created_at?: string | null
          decimal_rounding?: string | null
          description?: string | null
          fiscal_year_month?: number | null
          grant_basis?: string
          grant_method?: string
          id?: string
          is_default?: boolean
          leave_unit?: string
          monthly_leave_method?: string | null
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
      material_orders: {
        Row: {
          color_code: string | null
          created_at: string
          height: number
          id: string
          material: string
          memo: string | null
          order_date: string
          project_id: string | null
          quality: string
          quantity: number
          quote_id: string | null
          quote_item_summary: string | null
          size_name: string
          status: string
          surface_type: string | null
          thickness: string
          updated_at: string
          user_id: string
          user_name: string
          width: number
        }
        Insert: {
          color_code?: string | null
          created_at?: string
          height?: number
          id?: string
          material: string
          memo?: string | null
          order_date?: string
          project_id?: string | null
          quality: string
          quantity?: number
          quote_id?: string | null
          quote_item_summary?: string | null
          size_name: string
          status?: string
          surface_type?: string | null
          thickness: string
          updated_at?: string
          user_id: string
          user_name: string
          width?: number
        }
        Update: {
          color_code?: string | null
          created_at?: string
          height?: number
          id?: string
          material?: string
          memo?: string | null
          order_date?: string
          project_id?: string | null
          quality?: string
          quantity?: number
          quote_id?: string | null
          quote_item_summary?: string | null
          size_name?: string
          status?: string
          surface_type?: string | null
          thickness?: string
          updated_at?: string
          user_id?: string
          user_name?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
        ]
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
      page_access_permissions: {
        Row: {
          created_at: string
          id: string
          page_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_key?: string
          user_id?: string
        }
        Relationships: []
      }
      page_role_access: {
        Row: {
          created_at: string
          id: string
          min_role: string
          page_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_role?: string
          page_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_role?: string
          page_key?: string
          updated_at?: string
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
          attachments: Json | null
          content: string
          created_at: string
          id: string
          mentioned_user_ids: string[] | null
          notion_links: Json | null
          project_id: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          mentioned_user_ids?: string[] | null
          notion_links?: Json | null
          project_id: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          mentioned_user_ids?: string[] | null
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
          linked_project_id: string | null
          name: string
          notion_url: string | null
          payment_status: string
          project_type: string
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
          linked_project_id?: string | null
          name: string
          notion_url?: string | null
          payment_status?: string
          project_type?: string
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
          linked_project_id?: string | null
          name?: string
          notion_url?: string | null
          payment_status?: string
          project_type?: string
          recipient_id?: string | null
          specs?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
      quote_template_items: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          quantity: number
          section_id: string
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          quantity?: number
          section_id: string
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          quantity?: number
          section_id?: string
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_template_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_template_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_template_sections: {
        Row: {
          config: Json | null
          created_at: string
          display_order: number
          id: string
          section_type: string
          template_id: string
          title: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          display_order?: number
          id?: string
          section_type?: string
          template_id: string
          title?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          display_order?: number
          id?: string
          section_type?: string
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          created_at: string
          created_by: string | null
          discount_rate: number
          id: string
          is_default: boolean
          name: string
          notes: string | null
          updated_at: string
          vat_option: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_rate?: number
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          vat_option?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_rate?: number
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          vat_option?: string
        }
        Relationships: []
      }
      recipients: {
        Row: {
          accounting_contact_person: string | null
          accounting_email: string | null
          accounting_phone: string | null
          accounting_position: string | null
          address: string | null
          branch_number: string | null
          business_class: string | null
          business_document_url: string | null
          business_name: string | null
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
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accounting_contact_person?: string | null
          accounting_email?: string | null
          accounting_phone?: string | null
          accounting_position?: string | null
          address?: string | null
          branch_number?: string | null
          business_class?: string | null
          business_document_url?: string | null
          business_name?: string | null
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
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accounting_contact_person?: string | null
          accounting_email?: string | null
          accounting_phone?: string | null
          accounting_position?: string | null
          address?: string | null
          branch_number?: string | null
          business_class?: string | null
          business_document_url?: string | null
          business_name?: string | null
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
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_cycle_targets: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_cycle_targets_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_review_cycles"
            referencedColumns: ["id"]
          },
        ]
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
      tax_deduction_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          dependent_id: string | null
          description: string | null
          id: string
          settlement_id: string
          sub_category: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          dependent_id?: string | null
          description?: string | null
          id?: string
          settlement_id: string
          sub_category: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          dependent_id?: string | null
          description?: string | null
          id?: string
          settlement_id?: string
          sub_category?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_deduction_items_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "tax_dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_deduction_items_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "year_end_tax_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_dependents: {
        Row: {
          basic_deduction: boolean | null
          birth_date: string | null
          created_at: string
          disability_type: string | null
          has_income_limit: boolean | null
          id: string
          is_child_under6: boolean | null
          is_disabled: boolean | null
          is_senior: boolean | null
          is_single_parent: boolean | null
          is_woman_deduction: boolean | null
          name: string
          relationship: string
          resident_number: string | null
          settlement_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          basic_deduction?: boolean | null
          birth_date?: string | null
          created_at?: string
          disability_type?: string | null
          has_income_limit?: boolean | null
          id?: string
          is_child_under6?: boolean | null
          is_disabled?: boolean | null
          is_senior?: boolean | null
          is_single_parent?: boolean | null
          is_woman_deduction?: boolean | null
          name: string
          relationship: string
          resident_number?: string | null
          settlement_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          basic_deduction?: boolean | null
          birth_date?: string | null
          created_at?: string
          disability_type?: string | null
          has_income_limit?: boolean | null
          id?: string
          is_child_under6?: boolean | null
          is_disabled?: boolean | null
          is_senior?: boolean | null
          is_single_parent?: boolean | null
          is_woman_deduction?: boolean | null
          name?: string
          relationship?: string
          resident_number?: string | null
          settlement_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_dependents_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "year_end_tax_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_documents: {
        Row: {
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          memo: string | null
          mime_type: string | null
          settlement_id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          memo?: string | null
          mime_type?: string | null
          settlement_id: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          memo?: string | null
          mime_type?: string | null
          settlement_id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_documents_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "year_end_tax_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_invoices: {
        Row: {
          buyer_addr: string | null
          buyer_biz_class: string | null
          buyer_biz_type: string | null
          buyer_ceo_name: string | null
          buyer_contact_name: string | null
          buyer_corp_name: string | null
          buyer_corp_num: string
          buyer_email: string | null
          buyer_tel: string | null
          charge_direction: string
          created_at: string
          email_sent: boolean | null
          fax_sent: boolean | null
          id: string
          issue_type: string
          items: Json
          memo: string | null
          popbill_issue_id: string | null
          popbill_mgt_key: string | null
          popbill_nts_confirm_num: string | null
          popbill_state_code: string | null
          popbill_state_dt: string | null
          project_id: string | null
          purpose_type: string
          quote_id: string | null
          remark1: string | null
          remark2: string | null
          remark3: string | null
          sms_sent: boolean | null
          status: string
          supplier_addr: string | null
          supplier_biz_class: string | null
          supplier_biz_type: string | null
          supplier_ceo_name: string | null
          supplier_contact_name: string | null
          supplier_corp_name: string | null
          supplier_corp_num: string
          supplier_email: string | null
          supplier_tel: string | null
          supply_cost_total: number
          tax_total: number
          tax_type: string
          total_amount: number
          updated_at: string
          user_id: string
          user_name: string
          write_date: string
        }
        Insert: {
          buyer_addr?: string | null
          buyer_biz_class?: string | null
          buyer_biz_type?: string | null
          buyer_ceo_name?: string | null
          buyer_contact_name?: string | null
          buyer_corp_name?: string | null
          buyer_corp_num: string
          buyer_email?: string | null
          buyer_tel?: string | null
          charge_direction?: string
          created_at?: string
          email_sent?: boolean | null
          fax_sent?: boolean | null
          id?: string
          issue_type?: string
          items?: Json
          memo?: string | null
          popbill_issue_id?: string | null
          popbill_mgt_key?: string | null
          popbill_nts_confirm_num?: string | null
          popbill_state_code?: string | null
          popbill_state_dt?: string | null
          project_id?: string | null
          purpose_type?: string
          quote_id?: string | null
          remark1?: string | null
          remark2?: string | null
          remark3?: string | null
          sms_sent?: boolean | null
          status?: string
          supplier_addr?: string | null
          supplier_biz_class?: string | null
          supplier_biz_type?: string | null
          supplier_ceo_name?: string | null
          supplier_contact_name?: string | null
          supplier_corp_name?: string | null
          supplier_corp_num: string
          supplier_email?: string | null
          supplier_tel?: string | null
          supply_cost_total?: number
          tax_total?: number
          tax_type?: string
          total_amount?: number
          updated_at?: string
          user_id: string
          user_name: string
          write_date?: string
        }
        Update: {
          buyer_addr?: string | null
          buyer_biz_class?: string | null
          buyer_biz_type?: string | null
          buyer_ceo_name?: string | null
          buyer_contact_name?: string | null
          buyer_corp_name?: string | null
          buyer_corp_num?: string
          buyer_email?: string | null
          buyer_tel?: string | null
          charge_direction?: string
          created_at?: string
          email_sent?: boolean | null
          fax_sent?: boolean | null
          id?: string
          issue_type?: string
          items?: Json
          memo?: string | null
          popbill_issue_id?: string | null
          popbill_mgt_key?: string | null
          popbill_nts_confirm_num?: string | null
          popbill_state_code?: string | null
          popbill_state_dt?: string | null
          project_id?: string | null
          purpose_type?: string
          quote_id?: string | null
          remark1?: string | null
          remark2?: string | null
          remark3?: string | null
          sms_sent?: boolean | null
          status?: string
          supplier_addr?: string | null
          supplier_biz_class?: string | null
          supplier_biz_type?: string | null
          supplier_ceo_name?: string | null
          supplier_contact_name?: string | null
          supplier_corp_name?: string | null
          supplier_corp_num?: string
          supplier_email?: string | null
          supplier_tel?: string | null
          supply_cost_total?: number
          tax_total?: number
          tax_type?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
          user_name?: string
          write_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          attachments: Json | null
          avatar_url: string | null
          created_at: string
          id: string
          message: string
          user_id: string
          user_name: string
        }
        Insert: {
          attachments?: Json | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          message: string
          user_id: string
          user_name: string
        }
        Update: {
          attachments?: Json | null
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
      year_end_tax_settlements: {
        Row: {
          confirmed_at: string | null
          created_at: string
          estimated_refund: number | null
          estimated_tax: number | null
          final_refund: number | null
          final_tax: number | null
          id: string
          installment_enabled: boolean | null
          installment_months: number | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          submitted_at: string | null
          tax_year: number
          total_local_tax_paid: number | null
          total_salary: number | null
          total_tax_paid: number | null
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          estimated_refund?: number | null
          estimated_tax?: number | null
          final_refund?: number | null
          final_tax?: number | null
          id?: string
          installment_enabled?: boolean | null
          installment_months?: number | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string | null
          tax_year?: number
          total_local_tax_paid?: number | null
          total_salary?: number | null
          total_tax_paid?: number | null
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          estimated_refund?: number | null
          estimated_tax?: number | null
          final_refund?: number | null
          final_tax?: number | null
          id?: string
          installment_enabled?: boolean | null
          installment_months?: number | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string | null
          tax_year?: number
          total_local_tax_paid?: number | null
          total_salary?: number | null
          total_tax_paid?: number | null
          updated_at?: string
          user_id?: string
          user_name?: string
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
      is_project_assigned: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
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
