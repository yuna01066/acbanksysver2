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
          meeting_reservation_id: string | null
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
          meeting_reservation_id?: string | null
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
          meeting_reservation_id?: string | null
          meeting_time?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_meeting_reservation_id_fkey"
            columns: ["meeting_reservation_id"]
            isOneToOne: false
            referencedRelation: "meeting_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_request_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          approval_request_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          approval_request_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          approval_request_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_request_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_request_events_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          amount: number | null
          cancelled_at: string | null
          created_at: string
          id: string
          payload_snapshot: Json
          priority: string
          related_internal_document_id: string | null
          related_material_order_id: string | null
          related_project_id: string | null
          related_quote_id: string | null
          request_type: string
          requested_by: string
          requested_by_name: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          submitted_at: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          payload_snapshot?: Json
          priority?: string
          related_internal_document_id?: string | null
          related_material_order_id?: string | null
          related_project_id?: string | null
          related_quote_id?: string | null
          request_type: string
          requested_by?: string
          requested_by_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          payload_snapshot?: Json
          priority?: string
          related_internal_document_id?: string | null
          related_material_order_id?: string | null
          related_project_id?: string | null
          related_quote_id?: string | null
          request_type?: string
          requested_by?: string
          requested_by_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_related_internal_document_id_fkey"
            columns: ["related_internal_document_id"]
            isOneToOne: false
            referencedRelation: "internal_project_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_related_material_order_id_fkey"
            columns: ["related_material_order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_related_quote_id_fkey"
            columns: ["related_quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_user_preferences: {
        Row: {
          created_at: string
          shortcut_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          shortcut_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          shortcut_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_requests: {
        Row: {
          attendance_record_id: string | null
          created_at: string
          date: string
          handled_at: string | null
          handled_by: string | null
          handled_memo: string | null
          id: string
          reason: string
          request_type: string
          requested_check_in: string | null
          requested_check_out: string | null
          status: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          attendance_record_id?: string | null
          created_at?: string
          date: string
          handled_at?: string | null
          handled_by?: string | null
          handled_memo?: string | null
          id?: string
          reason: string
          request_type: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          attendance_record_id?: string | null
          created_at?: string
          date?: string
          handled_at?: string | null
          handled_by?: string | null
          handled_memo?: string | null
          id?: string
          reason?: string
          request_type?: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
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
      attendance_records_duplicate_backup_20260701: {
        Row: {
          check_in: string | null
          check_in_location: Json | null
          check_out: string | null
          check_out_location: Json | null
          created_at: string | null
          date: string | null
          duplicate_count: number | null
          duplicate_rank: number | null
          id: string | null
          location_memo: string | null
          memo: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
          work_hours: number | null
        }
        Insert: {
          check_in?: string | null
          check_in_location?: Json | null
          check_out?: string | null
          check_out_location?: Json | null
          created_at?: string | null
          date?: string | null
          duplicate_count?: number | null
          duplicate_rank?: number | null
          id?: string | null
          location_memo?: string | null
          memo?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
          work_hours?: number | null
        }
        Update: {
          check_in?: string | null
          check_in_location?: Json | null
          check_out?: string | null
          check_out_location?: Json | null
          created_at?: string | null
          date?: string | null
          duplicate_count?: number | null
          duplicate_rank?: number | null
          id?: string | null
          location_memo?: string | null
          memo?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
          work_hours?: number | null
        }
        Relationships: []
      }
      branding_intake_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          intake_id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          intake_id: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          intake_id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_intake_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_intake_events_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "branding_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_intake_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          intake_id: string
          metadata: Json
          mime_type: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          intake_id: string
          metadata?: Json
          mime_type?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          intake_id?: string
          metadata?: Json
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "branding_intake_files_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "branding_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_intakes: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          customer_company: string | null
          customer_email: string | null
          customer_estimate_text: string | null
          customer_message: string
          customer_name: string
          customer_phone: string
          customer_position: string | null
          design_subtotal: number
          homepage_url: string | null
          id: string
          industry: string | null
          inquiry_body: string | null
          internal_breakdown: string
          internal_total: number
          lead_time_id: string
          lead_time_label: string
          lead_time_surcharge: number
          marketing_consent: boolean
          memo: string | null
          optimization_tier_id: string
          optimization_tier_label: string
          package_id: string
          package_label: string
          pm_cost: number
          pricing_snapshot: Json
          privacy_consent: boolean
          project_name: string | null
          raw_payload: Json
          reference_note: string | null
          selected_addons: Json
          separate_review_items: string[]
          source: string
          status: string
          submission_token: string | null
          submitter_ip_hash: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_estimate_text?: string | null
          customer_message: string
          customer_name: string
          customer_phone: string
          customer_position?: string | null
          design_subtotal?: number
          homepage_url?: string | null
          id?: string
          industry?: string | null
          inquiry_body?: string | null
          internal_breakdown: string
          internal_total?: number
          lead_time_id: string
          lead_time_label: string
          lead_time_surcharge?: number
          marketing_consent?: boolean
          memo?: string | null
          optimization_tier_id?: string
          optimization_tier_label?: string
          package_id: string
          package_label: string
          pm_cost?: number
          pricing_snapshot?: Json
          privacy_consent?: boolean
          project_name?: string | null
          raw_payload?: Json
          reference_note?: string | null
          selected_addons?: Json
          separate_review_items?: string[]
          source?: string
          status?: string
          submission_token?: string | null
          submitter_ip_hash?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_estimate_text?: string | null
          customer_message?: string
          customer_name?: string
          customer_phone?: string
          customer_position?: string | null
          design_subtotal?: number
          homepage_url?: string | null
          id?: string
          industry?: string | null
          inquiry_body?: string | null
          internal_breakdown?: string
          internal_total?: number
          lead_time_id?: string
          lead_time_label?: string
          lead_time_surcharge?: number
          marketing_consent?: boolean
          memo?: string | null
          optimization_tier_id?: string
          optimization_tier_label?: string
          package_id?: string
          package_label?: string
          pm_cost?: number
          pricing_snapshot?: Json
          privacy_consent?: boolean
          project_name?: string | null
          raw_payload?: Json
          reference_note?: string | null
          selected_addons?: Json
          separate_review_items?: string[]
          source?: string
          status?: string
          submission_token?: string | null
          submitter_ip_hash?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_intakes_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_intakes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_diary_entries: {
        Row: {
          content: string
          created_at: string
          diary_date: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          diary_date: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          diary_date?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_event_participants: {
        Row: {
          created_at: string
          display_name: string | null
          event_id: string
          id: string
          response_status: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          event_id: string
          id?: string
          response_status?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          event_id?: string
          id?: string
          response_status?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_reminders: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_sent: boolean
          reminder_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_sent?: boolean
          reminder_minutes: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_sent?: boolean
          reminder_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_resources: {
        Row: {
          created_at: string
          event_id: string
          id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          resource_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_resources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "calendar_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          accent: string | null
          all_day: boolean
          client_contact: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          description: string | null
          ends_at: string
          icon_type: string | null
          id: string
          location: string | null
          metadata: Json
          recipient_id: string | null
          recurrence_exception_date: string | null
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
          source_id: string | null
          source_path: string | null
          source_subtype: string
          source_type: string
          starts_at: string
          status: string
          team_department: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          accent?: string | null
          all_day?: boolean
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          description?: string | null
          ends_at: string
          icon_type?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          recipient_id?: string | null
          recurrence_exception_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          source_id?: string | null
          source_path?: string | null
          source_subtype?: string
          source_type?: string
          starts_at: string
          status?: string
          team_department?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          accent?: string | null
          all_day?: boolean
          client_contact?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          description?: string | null
          ends_at?: string
          icon_type?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          recipient_id?: string | null
          recurrence_exception_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          source_id?: string | null
          source_path?: string | null
          source_subtype?: string
          source_type?: string
          starts_at?: string
          status?: string
          team_department?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_resources: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          floor: string | null
          id: string
          is_active: boolean
          name: string
          resource_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          floor?: string | null
          id?: string
          is_active?: boolean
          name: string
          resource_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          floor?: string | null
          id?: string
          is_active?: boolean
          name?: string
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_subscriptions: {
        Row: {
          color: string | null
          created_at: string
          display_name: string | null
          display_order: number
          id: string
          is_visible: boolean
          subscriber_id: string
          target_department: string | null
          target_resource_id: string | null
          target_type: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          display_name?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          subscriber_id: string
          target_department?: string | null
          target_resource_id?: string | null
          target_type: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          display_name?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          subscriber_id?: string
          target_department?: string | null
          target_resource_id?: string | null
          target_type?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_subscriptions_target_resource_id_fkey"
            columns: ["target_resource_id"]
            isOneToOne: false
            referencedRelation: "calendar_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          linked_event_id: string | null
          owner_id: string
          priority: string
          status: string
          task_date: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          linked_event_id?: string | null
          owner_id: string
          priority?: string
          status?: string
          task_date: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          linked_event_id?: string | null
          owner_id?: string
          priority?: string
          status?: string
          task_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_tasks_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_team_members: {
        Row: {
          created_at: string
          id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "calendar_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_teams: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_user_settings: {
        Row: {
          calendar_colors: Json
          created_at: string
          default_view: string
          source_filters: string[]
          updated_at: string
          user_id: string
          visible_calendar_keys: string[]
          week_starts_on: number
          workday_end: string
          workday_start: string
        }
        Insert: {
          calendar_colors?: Json
          created_at?: string
          default_view?: string
          source_filters?: string[]
          updated_at?: string
          user_id: string
          visible_calendar_keys?: string[]
          week_starts_on?: number
          workday_end?: string
          workday_start?: string
        }
        Update: {
          calendar_colors?: Json
          created_at?: string
          default_view?: string
          source_filters?: string[]
          updated_at?: string
          user_id?: string
          visible_calendar_keys?: string[]
          week_starts_on?: number
          workday_end?: string
          workday_start?: string
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
      channel_talk_action_logs: {
        Row: {
          action: string
          channel_message_id: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          request_payload: Json
          requested_by: string | null
          response_payload: Json
          sender_name: string | null
          status: string
          visible_sender_name: string | null
        }
        Insert: {
          action: string
          channel_message_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          request_payload?: Json
          requested_by?: string | null
          response_payload?: Json
          sender_name?: string | null
          status: string
          visible_sender_name?: string | null
        }
        Update: {
          action?: string
          channel_message_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          request_payload?: Json
          requested_by?: string | null
          response_payload?: Json
          sender_name?: string | null
          status?: string
          visible_sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_talk_action_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "channel_talk_quote_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_action_logs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_talk_conversations: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          channel_talk_user_id: string | null
          close_reason: string | null
          closed_at: string | null
          created_at: string
          customer_company: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_customer_message_at: string | null
          last_message_at: string | null
          last_staff_reply_at: string | null
          latest_lead_id: string | null
          memo: string | null
          status: string
          updated_at: string
          user_chat_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          channel_talk_user_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string | null
          last_staff_reply_at?: string | null
          latest_lead_id?: string | null
          memo?: string | null
          status?: string
          updated_at?: string
          user_chat_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          channel_talk_user_id?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string | null
          last_staff_reply_at?: string | null
          latest_lead_id?: string | null
          memo?: string | null
          status?: string
          updated_at?: string
          user_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_talk_conversations_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_conversations_latest_lead_id_fkey"
            columns: ["latest_lead_id"]
            isOneToOne: false
            referencedRelation: "channel_talk_quote_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_talk_messages: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          event_id: string | null
          file_keys: string[]
          id: string
          lead_id: string | null
          message_id: string | null
          message_type: string
          raw_payload: Json
          received_at: string
          sender_type: string
          updated_at: string
          user_chat_id: string
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          event_id?: string | null
          file_keys?: string[]
          id?: string
          lead_id?: string | null
          message_id?: string | null
          message_type?: string
          raw_payload?: Json
          received_at?: string
          sender_type?: string
          updated_at?: string
          user_chat_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          event_id?: string | null
          file_keys?: string[]
          id?: string
          lead_id?: string | null
          message_id?: string | null
          message_type?: string
          raw_payload?: Json
          received_at?: string
          sender_type?: string
          updated_at?: string
          user_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_talk_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "channel_talk_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "channel_talk_quote_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_talk_quote_leads: {
        Row: {
          analysis: Json
          assigned_to: string | null
          channel_talk_event_id: string | null
          channel_talk_file_keys: string[]
          channel_talk_message_id: string | null
          channel_talk_user_chat_id: string
          channel_talk_user_id: string | null
          closed_at: string | null
          conversation_id: string | null
          converted_quote_id: string | null
          created_at: string
          customer_company: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          inquiry_type: string
          last_channel_talk_message_id: string | null
          last_message_at: string | null
          last_message_text: string | null
          memo: string | null
          message_count: number
          missing_fields: string[]
          project_id: string | null
          raw_payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          analysis?: Json
          assigned_to?: string | null
          channel_talk_event_id?: string | null
          channel_talk_file_keys?: string[]
          channel_talk_message_id?: string | null
          channel_talk_user_chat_id: string
          channel_talk_user_id?: string | null
          closed_at?: string | null
          conversation_id?: string | null
          converted_quote_id?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          inquiry_type?: string
          last_channel_talk_message_id?: string | null
          last_message_at?: string | null
          last_message_text?: string | null
          memo?: string | null
          message_count?: number
          missing_fields?: string[]
          project_id?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          analysis?: Json
          assigned_to?: string | null
          channel_talk_event_id?: string | null
          channel_talk_file_keys?: string[]
          channel_talk_message_id?: string | null
          channel_talk_user_chat_id?: string
          channel_talk_user_id?: string | null
          closed_at?: string | null
          conversation_id?: string | null
          converted_quote_id?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          inquiry_type?: string
          last_channel_talk_message_id?: string | null
          last_message_at?: string | null
          last_message_text?: string | null
          memo?: string | null
          message_count?: number
          missing_fields?: string[]
          project_id?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_talk_quote_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_quote_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "channel_talk_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_quote_leads_converted_quote_id_fkey"
            columns: ["converted_quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_quote_leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_talk_reply_drafts: {
        Row: {
          body: string
          channel_message_id: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string
          reviewed_by: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          channel_message_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          reviewed_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          channel_message_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          reviewed_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_talk_reply_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_reply_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "channel_talk_quote_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_reply_drafts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_reply_drafts_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_talk_reply_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checked_in_employee_status: {
        Row: {
          avatar_url: string | null
          check_in: string | null
          date: string
          department: string | null
          position: string | null
          status: string
          synced_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          avatar_url?: string | null
          check_in?: string | null
          date: string
          department?: string | null
          position?: string | null
          status: string
          synced_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          avatar_url?: string | null
          check_in?: string | null
          date?: string
          department?: string | null
          position?: string | null
          status?: string
          synced_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      client_consultation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          lead_id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          lead_id: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          lead_id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_consultation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consultation_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "client_consultation_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_consultation_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          lead_id: string
          metadata: Json
          mime_type: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          lead_id: string
          metadata?: Json
          mime_type?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          lead_id?: string
          metadata?: Json
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_consultation_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "client_consultation_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_consultation_items: {
        Row: {
          color_code: string | null
          color_name: string | null
          color_option_id: string | null
          created_at: string
          height: string | null
          id: string
          item_name: string | null
          lead_id: string
          material_name: string | null
          material_quality_id: string | null
          memo: string | null
          processing_options: string[]
          quantity: string | null
          sheet_size: string | null
          sort_order: number
          thickness: string | null
          unit: string | null
          width: string | null
        }
        Insert: {
          color_code?: string | null
          color_name?: string | null
          color_option_id?: string | null
          created_at?: string
          height?: string | null
          id?: string
          item_name?: string | null
          lead_id: string
          material_name?: string | null
          material_quality_id?: string | null
          memo?: string | null
          processing_options?: string[]
          quantity?: string | null
          sheet_size?: string | null
          sort_order?: number
          thickness?: string | null
          unit?: string | null
          width?: string | null
        }
        Update: {
          color_code?: string | null
          color_name?: string | null
          color_option_id?: string | null
          created_at?: string
          height?: string | null
          id?: string
          item_name?: string | null
          lead_id?: string
          material_name?: string | null
          material_quality_id?: string | null
          memo?: string | null
          processing_options?: string[]
          quantity?: string | null
          sheet_size?: string | null
          sort_order?: number
          thickness?: string | null
          unit?: string | null
          width?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_consultation_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "client_consultation_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_consultation_leads: {
        Row: {
          acrylic_type: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          closed_at: string | null
          color_code: string | null
          color_name: string | null
          consultation_type: string
          converted_quote_draft_id: string | null
          converted_quote_id: string | null
          created_at: string
          customer_company: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_position: string | null
          delivery_address: string | null
          desired_delivery_date: string | null
          dimensions: string | null
          follow_up_at: string | null
          id: string
          inquiry_body: string
          marketing_consent: boolean
          memo: string | null
          missing_fields: string[]
          priority: string
          privacy_consent: boolean
          processing: string[]
          product_type: string | null
          project_id: string | null
          project_name: string | null
          public_booking_request_id: string | null
          quality_score: number
          quantity: string | null
          raw_payload: Json
          recipient_id: string | null
          response_status: string
          sheet_size: string | null
          source: string
          status: string
          submission_token: string | null
          submitter_ip_hash: string | null
          thickness: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          acrylic_type?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          color_code?: string | null
          color_name?: string | null
          consultation_type?: string
          converted_quote_draft_id?: string | null
          converted_quote_id?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_position?: string | null
          delivery_address?: string | null
          desired_delivery_date?: string | null
          dimensions?: string | null
          follow_up_at?: string | null
          id?: string
          inquiry_body: string
          marketing_consent?: boolean
          memo?: string | null
          missing_fields?: string[]
          priority?: string
          privacy_consent?: boolean
          processing?: string[]
          product_type?: string | null
          project_id?: string | null
          project_name?: string | null
          public_booking_request_id?: string | null
          quality_score?: number
          quantity?: string | null
          raw_payload?: Json
          recipient_id?: string | null
          response_status?: string
          sheet_size?: string | null
          source?: string
          status?: string
          submission_token?: string | null
          submitter_ip_hash?: string | null
          thickness?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          acrylic_type?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          color_code?: string | null
          color_name?: string | null
          consultation_type?: string
          converted_quote_draft_id?: string | null
          converted_quote_id?: string | null
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_position?: string | null
          delivery_address?: string | null
          desired_delivery_date?: string | null
          dimensions?: string | null
          follow_up_at?: string | null
          id?: string
          inquiry_body?: string
          marketing_consent?: boolean
          memo?: string | null
          missing_fields?: string[]
          priority?: string
          privacy_consent?: boolean
          processing?: string[]
          product_type?: string | null
          project_id?: string | null
          project_name?: string | null
          public_booking_request_id?: string | null
          quality_score?: number
          quantity?: string | null
          raw_payload?: Json
          recipient_id?: string | null
          response_status?: string
          sheet_size?: string | null
          source?: string
          status?: string
          submission_token?: string | null
          submitter_ip_hash?: string | null
          thickness?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_consultation_leads_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consultation_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consultation_leads_converted_quote_draft_id_fkey"
            columns: ["converted_quote_draft_id"]
            isOneToOne: false
            referencedRelation: "quote_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consultation_leads_converted_quote_id_fkey"
            columns: ["converted_quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consultation_leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consultation_leads_public_booking_request_id_fkey"
            columns: ["public_booking_request_id"]
            isOneToOne: false
            referencedRelation: "public_booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consultation_leads_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          route: string | null
          source: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          route?: string | null
          source?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          route?: string | null
          source?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
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
          attributes: Json
          color_attribute_note: string | null
          color_code: string | null
          color_name: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_bright_pigment: boolean
          is_producible: boolean
          panel_master_id: string
          pantone: string | null
          series_key: string | null
          source_url: string | null
          unavailable_reason: string | null
          updated_at: string | null
        }
        Insert: {
          attributes?: Json
          color_attribute_note?: string | null
          color_code?: string | null
          color_name: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_bright_pigment?: boolean
          is_producible?: boolean
          panel_master_id: string
          pantone?: string | null
          series_key?: string | null
          source_url?: string | null
          unavailable_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          attributes?: Json
          color_attribute_note?: string | null
          color_code?: string | null
          color_name?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_bright_pigment?: boolean
          is_producible?: boolean
          panel_master_id?: string
          pantone?: string | null
          series_key?: string | null
          source_url?: string | null
          unavailable_reason?: string | null
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
          company_seal_storage_path: string | null
          created_at: string
          detail_address: string | null
          email: string | null
          established_date: string | null
          fax: string | null
          id: string
          industry: string | null
          logo_url: string | null
          phone: string | null
          quote_bank_info: string | null
          quote_consultation: string | null
          quote_contact_email: string | null
          quote_contact_message: string | null
          quote_contact_phone: string | null
          quote_notes: string | null
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
          company_seal_storage_path?: string | null
          created_at?: string
          detail_address?: string | null
          email?: string | null
          established_date?: string | null
          fax?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          quote_bank_info?: string | null
          quote_consultation?: string | null
          quote_contact_email?: string | null
          quote_contact_message?: string | null
          quote_contact_phone?: string | null
          quote_notes?: string | null
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
          company_seal_storage_path?: string | null
          created_at?: string
          detail_address?: string | null
          email?: string | null
          established_date?: string | null
          fax?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          quote_bank_info?: string | null
          quote_consultation?: string | null
          quote_contact_email?: string | null
          quote_contact_message?: string | null
          quote_contact_phone?: string | null
          quote_notes?: string | null
          updated_at?: string
          website?: string | null
          workplace_lat?: number | null
          workplace_lng?: number | null
          workplace_radius?: number | null
        }
        Relationships: []
      }
      company_public_info: {
        Row: {
          address: string | null
          business_number: string | null
          business_type: string | null
          ceo_name: string | null
          company_name: string | null
          detail_address: string | null
          email: string | null
          established_date: string | null
          fax: string | null
          id: string
          industry: string | null
          logo_url: string | null
          phone: string | null
          quote_consultation: string | null
          quote_contact_email: string | null
          quote_contact_message: string | null
          quote_contact_phone: string | null
          quote_notes: string | null
          synced_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name?: string | null
          detail_address?: string | null
          email?: string | null
          established_date?: string | null
          fax?: string | null
          id: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          quote_consultation?: string | null
          quote_contact_email?: string | null
          quote_contact_message?: string | null
          quote_contact_phone?: string | null
          quote_notes?: string | null
          synced_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name?: string | null
          detail_address?: string | null
          email?: string | null
          established_date?: string | null
          fax?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          quote_consultation?: string | null
          quote_contact_email?: string | null
          quote_contact_message?: string | null
          quote_contact_phone?: string | null
          quote_notes?: string | null
          synced_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_quote_defaults: {
        Row: {
          address: string | null
          business_number: string | null
          business_type: string | null
          ceo_name: string | null
          company_name: string | null
          detail_address: string | null
          email: string | null
          fax: string | null
          id: string
          industry: string | null
          logo_url: string | null
          phone: string | null
          quote_bank_info: string | null
          quote_consultation: string | null
          quote_contact_email: string | null
          quote_contact_message: string | null
          quote_contact_phone: string | null
          quote_notes: string | null
          synced_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name?: string | null
          detail_address?: string | null
          email?: string | null
          fax?: string | null
          id: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          quote_bank_info?: string | null
          quote_consultation?: string | null
          quote_contact_email?: string | null
          quote_contact_message?: string | null
          quote_contact_phone?: string | null
          quote_notes?: string | null
          synced_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_number?: string | null
          business_type?: string | null
          ceo_name?: string | null
          company_name?: string | null
          detail_address?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          phone?: string | null
          quote_bank_info?: string | null
          quote_consultation?: string | null
          quote_contact_email?: string | null
          quote_contact_message?: string | null
          quote_contact_phone?: string | null
          quote_notes?: string | null
          synced_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contract_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          contract_id: string
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          contract_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: ["id"]
          },
        ]
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
      document_files: {
        Row: {
          created_at: string
          document_type: string
          drive_file_id: string | null
          drive_folder_id: string | null
          drive_path: string | null
          external_url: string | null
          file_name: string
          file_size: number | null
          id: string
          metadata: Json
          mime_type: string | null
          owner_type: string
          project_id: string | null
          quote_id: string | null
          recipient_id: string | null
          storage_bucket: string | null
          storage_path: string | null
          storage_provider: string
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_path?: string | null
          external_url?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          owner_type: string
          project_id?: string | null
          quote_id?: string | null
          recipient_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_path?: string | null
          external_url?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          owner_type?: string
          project_id?: string | null
          quote_id?: string | null
          recipient_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          storage_provider?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_files_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
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
      employee_online_heartbeats: {
        Row: {
          created_at: string
          last_seen_at: string
          online_at: string
          updated_at: string
          user_agent: string | null
          user_id: string
          work_status: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string
          online_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
          work_status?: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string
          online_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          work_status?: string
        }
        Relationships: []
      }
      employee_payroll_profiles: {
        Row: {
          annual_salary: number
          created_at: string
          created_by: string | null
          deduction_settings: Json
          effective_from: string
          effective_to: string | null
          fixed_allowances: Json
          hourly_wage: number
          id: string
          monthly_base_pay: number
          non_taxable_allowances: Json
          overtime_policy: Json
          pay_type: string
          standard_monthly_hours: number
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          annual_salary?: number
          created_at?: string
          created_by?: string | null
          deduction_settings?: Json
          effective_from?: string
          effective_to?: string | null
          fixed_allowances?: Json
          hourly_wage?: number
          id?: string
          monthly_base_pay?: number
          non_taxable_allowances?: Json
          overtime_policy?: Json
          pay_type?: string
          standard_monthly_hours?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          annual_salary?: number
          created_at?: string
          created_by?: string | null
          deduction_settings?: Json
          effective_from?: string
          effective_to?: string | null
          fixed_allowances?: Json
          hourly_wage?: number
          id?: string
          monthly_base_pay?: number
          non_taxable_allowances?: Json
          overtime_policy?: Json
          pay_type?: string
          standard_monthly_hours?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          annual_salary: number | null
          base_pay: number | null
          birth_date: string | null
          company_seal_included: boolean
          company_seal_storage_path: string | null
          comprehensive_wage_basis: string | null
          comprehensive_wage_hours: number | null
          comprehensive_wage_type: string | null
          content_sha256: string | null
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
          opened_at: string | null
          other_allowances: Json | null
          pay_day: number | null
          position: string | null
          probation_end_date: string | null
          probation_period: string | null
          probation_salary_rate: number | null
          probation_start_date: string | null
          rejected_at: string | null
          rejected_reason: string | null
          rendered_html: string | null
          requested_at: string | null
          requested_by: string | null
          signature_storage_path: string | null
          signed_at: string | null
          signed_by_name: string | null
          signed_pdf_document_file_id: string | null
          signed_pdf_storage_path: string | null
          signed_rendered_html: string | null
          status: string
          template_id: string | null
          template_snapshot: Json | null
          updated_at: string
          user_id: string
          user_name: string
          wage_basis: string | null
          wage_start_date: string | null
          withdrawn_at: string | null
          withdrawn_by: string | null
          withdrawn_reason: string | null
          work_days: string | null
          work_type: string | null
        }
        Insert: {
          annual_salary?: number | null
          base_pay?: number | null
          birth_date?: string | null
          company_seal_included?: boolean
          company_seal_storage_path?: string | null
          comprehensive_wage_basis?: string | null
          comprehensive_wage_hours?: number | null
          comprehensive_wage_type?: string | null
          content_sha256?: string | null
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
          opened_at?: string | null
          other_allowances?: Json | null
          pay_day?: number | null
          position?: string | null
          probation_end_date?: string | null
          probation_period?: string | null
          probation_salary_rate?: number | null
          probation_start_date?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          rendered_html?: string | null
          requested_at?: string | null
          requested_by?: string | null
          signature_storage_path?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signed_pdf_document_file_id?: string | null
          signed_pdf_storage_path?: string | null
          signed_rendered_html?: string | null
          status?: string
          template_id?: string | null
          template_snapshot?: Json | null
          updated_at?: string
          user_id: string
          user_name: string
          wage_basis?: string | null
          wage_start_date?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          withdrawn_reason?: string | null
          work_days?: string | null
          work_type?: string | null
        }
        Update: {
          annual_salary?: number | null
          base_pay?: number | null
          birth_date?: string | null
          company_seal_included?: boolean
          company_seal_storage_path?: string | null
          comprehensive_wage_basis?: string | null
          comprehensive_wage_hours?: number | null
          comprehensive_wage_type?: string | null
          content_sha256?: string | null
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
          opened_at?: string | null
          other_allowances?: Json | null
          pay_day?: number | null
          position?: string | null
          probation_end_date?: string | null
          probation_period?: string | null
          probation_salary_rate?: number | null
          probation_start_date?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          rendered_html?: string | null
          requested_at?: string | null
          requested_by?: string | null
          signature_storage_path?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signed_pdf_document_file_id?: string | null
          signed_pdf_storage_path?: string | null
          signed_rendered_html?: string | null
          status?: string
          template_id?: string | null
          template_snapshot?: Json | null
          updated_at?: string
          user_id?: string
          user_name?: string
          wage_basis?: string | null
          wage_start_date?: string | null
          withdrawn_at?: string | null
          withdrawn_by?: string | null
          withdrawn_reason?: string | null
          work_days?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_signed_pdf_document_file_id_fkey"
            columns: ["signed_pdf_document_file_id"]
            isOneToOne: false
            referencedRelation: "document_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_checklist_items: {
        Row: {
          assignee_name: string | null
          created_at: string
          display_order: number
          exhibition_id: string
          id: string
          is_completed: boolean
          title: string
          updated_at: string
        }
        Insert: {
          assignee_name?: string | null
          created_at?: string
          display_order?: number
          exhibition_id: string
          id?: string
          is_completed?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          assignee_name?: string | null
          created_at?: string
          display_order?: number
          exhibition_id?: string
          id?: string
          is_completed?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_checklist_items_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_consultations: {
        Row: {
          consultation_content: string | null
          consulted_by: string
          consulted_by_name: string
          created_at: string
          customer_company: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          exhibition_id: string
          follow_up_action: string | null
          follow_up_status: string
          id: string
          updated_at: string
        }
        Insert: {
          consultation_content?: string | null
          consulted_by: string
          consulted_by_name: string
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          exhibition_id: string
          follow_up_action?: string | null
          follow_up_status?: string
          id?: string
          updated_at?: string
        }
        Update: {
          consultation_content?: string | null
          consulted_by?: string
          consulted_by_name?: string
          created_at?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          exhibition_id?: string
          follow_up_action?: string | null
          follow_up_status?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_consultations_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_links: {
        Row: {
          created_at: string
          display_order: number
          exhibition_id: string
          id: string
          memo: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          exhibition_id: string
          id?: string
          memo?: string | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          exhibition_id?: string
          id?: string
          memo?: string | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_links_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibitions: {
        Row: {
          booth_number: string | null
          cost: number | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          location: string | null
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          booth_number?: string | null
          cost?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          location?: string | null
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          booth_number?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          location?: string | null
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      imweb_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      imweb_order_links: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          imweb_order_id: string | null
          imweb_order_no: string
          link_status: string
          memo: string | null
          project_id: string | null
          quote_id: string | null
          recipient_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          imweb_order_id?: string | null
          imweb_order_no: string
          link_status?: string
          memo?: string | null
          project_id?: string | null
          quote_id?: string | null
          recipient_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          imweb_order_id?: string | null
          imweb_order_no?: string
          link_status?: string
          memo?: string | null
          project_id?: string | null
          quote_id?: string | null
          recipient_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imweb_order_links_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imweb_order_links_imweb_order_id_fkey"
            columns: ["imweb_order_id"]
            isOneToOne: false
            referencedRelation: "imweb_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imweb_order_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imweb_order_links_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imweb_order_links_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      imweb_orders: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          created_at: string | null
          id: string
          imweb_order_no: string
          items: Json | null
          order_date: string | null
          order_status: string | null
          raw_data: Json | null
          synced_at: string | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          created_at?: string | null
          id?: string
          imweb_order_no: string
          items?: Json | null
          order_date?: string | null
          order_status?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          created_at?: string | null
          id?: string
          imweb_order_no?: string
          items?: Json | null
          order_date?: string | null
          order_status?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      imweb_product_mappings: {
        Row: {
          auto_stock_sync: boolean
          created_at: string
          created_by: string | null
          external_label: string | null
          id: string
          imweb_prod_no: string
          imweb_product_id: string | null
          inventory_source_type: string
          material_order_id: string | null
          memo: string | null
          min_stock_qty: number
          panel_size_id: string | null
          reorder_qty: number
          sample_chip_inventory_id: string | null
          updated_at: string
        }
        Insert: {
          auto_stock_sync?: boolean
          created_at?: string
          created_by?: string | null
          external_label?: string | null
          id?: string
          imweb_prod_no: string
          imweb_product_id?: string | null
          inventory_source_type?: string
          material_order_id?: string | null
          memo?: string | null
          min_stock_qty?: number
          panel_size_id?: string | null
          reorder_qty?: number
          sample_chip_inventory_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_stock_sync?: boolean
          created_at?: string
          created_by?: string | null
          external_label?: string | null
          id?: string
          imweb_prod_no?: string
          imweb_product_id?: string | null
          inventory_source_type?: string
          material_order_id?: string | null
          memo?: string | null
          min_stock_qty?: number
          panel_size_id?: string | null
          reorder_qty?: number
          sample_chip_inventory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imweb_product_mappings_imweb_product_id_fkey"
            columns: ["imweb_product_id"]
            isOneToOne: false
            referencedRelation: "imweb_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imweb_product_mappings_material_order_id_fkey"
            columns: ["material_order_id"]
            isOneToOne: false
            referencedRelation: "material_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imweb_product_mappings_panel_size_id_fkey"
            columns: ["panel_size_id"]
            isOneToOne: false
            referencedRelation: "panel_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imweb_product_mappings_sample_chip_inventory_id_fkey"
            columns: ["sample_chip_inventory_id"]
            isOneToOne: false
            referencedRelation: "sample_chip_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      imweb_products: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          image_url: string | null
          imweb_prod_no: string
          name: string
          price: number | null
          raw_data: Json | null
          status: string | null
          stock_qty: number | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          imweb_prod_no: string
          name: string
          price?: number | null
          raw_data?: Json | null
          status?: string | null
          stock_qty?: number | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          imweb_prod_no?: string
          name?: string
          price?: number | null
          raw_data?: Json | null
          status?: string | null
          stock_qty?: number | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      imweb_sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          sync_type: string
          synced_count: number | null
          total_count: number | null
          user_id: string
          user_name: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          sync_type: string
          synced_count?: number | null
          total_count?: number | null
          user_id: string
          user_name: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          sync_type?: string
          synced_count?: number | null
          total_count?: number | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
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
      internal_project_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_paid: boolean | null
          items: Json | null
          mime_type: string | null
          ocr_result: Json | null
          paid_at: string | null
          project_id: string
          purchase_date: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string
          uploaded_by: string
          vendor_business_number: string | null
          vendor_name: string | null
          vendor_phone: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_paid?: boolean | null
          items?: Json | null
          mime_type?: string | null
          ocr_result?: Json | null
          paid_at?: string | null
          project_id: string
          purchase_date?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          uploaded_by: string
          vendor_business_number?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_paid?: boolean | null
          items?: Json | null
          mime_type?: string | null
          ocr_result?: Json | null
          paid_at?: string | null
          project_id?: string
          purchase_date?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          uploaded_by?: string
          vendor_business_number?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_action_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          imweb_order_no: string | null
          imweb_prod_no: string | null
          metadata: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          imweb_order_no?: string | null
          imweb_prod_no?: string | null
          metadata?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          imweb_order_no?: string | null
          imweb_prod_no?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      kakao_chatbot_audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          command_text: string | null
          created_at: string
          error_message: string | null
          id: string
          kakao_user_id: string | null
          metadata: Json
          new_value: string | null
          old_value: string | null
          result: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          command_text?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kakao_user_id?: string | null
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          result?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          command_text?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kakao_user_id?: string | null
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          result?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kakao_chatbot_audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kakao_chatbot_users: {
        Row: {
          allowed_actions: string[]
          created_at: string
          display_name: string | null
          is_active: boolean
          kakao_user_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          allowed_actions?: string[]
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          kakao_user_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          allowed_actions?: string[]
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          kakao_user_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kakao_chatbot_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      leave_adjustments: {
        Row: {
          adjustment_type: string
          created_at: string
          days: number
          effective_date: string
          expires_at: string | null
          granted_by: string
          granted_by_name: string
          id: string
          leave_category: string
          reason: string | null
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          adjustment_type?: string
          created_at?: string
          days: number
          effective_date?: string
          expires_at?: string | null
          granted_by: string
          granted_by_name: string
          id?: string
          leave_category?: string
          reason?: string | null
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          adjustment_type?: string
          created_at?: string
          days?: number
          effective_date?: string
          expires_at?: string | null
          granted_by?: string
          granted_by_name?: string
          id?: string
          leave_category?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
          user_name?: string
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
      meeting_reservations: {
        Row: {
          audience_type: string
          calendar_event_id: string | null
          client_contact: string | null
          client_meeting_type: string | null
          client_name: string | null
          created_at: string
          created_by: string
          created_by_name: string
          description: string | null
          employee_meeting_type: string | null
          end_time: string | null
          id: string
          location: string | null
          meeting_date: string
          participant_ids: string[]
          participant_names: string[]
          recipient_id: string | null
          source_announcement_id: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience_type: string
          calendar_event_id?: string | null
          client_contact?: string | null
          client_meeting_type?: string | null
          client_name?: string | null
          created_at?: string
          created_by: string
          created_by_name: string
          description?: string | null
          employee_meeting_type?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          participant_ids?: string[]
          participant_names?: string[]
          recipient_id?: string | null
          source_announcement_id?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience_type?: string
          calendar_event_id?: string | null
          client_contact?: string | null
          client_meeting_type?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string
          description?: string | null
          employee_meeting_type?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          participant_ids?: string[]
          participant_names?: string[]
          recipient_id?: string | null
          source_announcement_id?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reservations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_reservations_source_announcement_id_fkey"
            columns: ["source_announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          dedupe_key: string | null
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
          dedupe_key?: string | null
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
          dedupe_key?: string | null
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
          effect: string
          id: string
          page_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effect?: string
          id?: string
          page_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          effect?: string
          id?: string
          page_key?: string
          updated_at?: string
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
      panel_option_surcharges: {
        Row: {
          cost: number
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          pricing_version_id: string | null
          quality_id: string
          size_name: string
          surcharge_type: string
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          pricing_version_id?: string | null
          quality_id?: string
          size_name: string
          surcharge_type: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          pricing_version_id?: string | null
          quality_id?: string
          size_name?: string
          surcharge_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "panel_option_surcharges_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "panel_pricing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_pricing_versions: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          source_note: string | null
          supplier_name: string
          updated_at: string
          version_name: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          source_note?: string | null
          supplier_name?: string
          updated_at?: string
          version_name: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          source_note?: string | null
          supplier_name?: string
          updated_at?: string
          version_name?: string
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
          pricing_version_id: string | null
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
          pricing_version_id?: string | null
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
          pricing_version_id?: string | null
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
          {
            foreignKeyName: "panel_sizes_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "panel_pricing_versions"
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
      pay_statement_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          pay_statement_id: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          pay_statement_id?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          pay_statement_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_statement_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statement_events_pay_statement_id_fkey"
            columns: ["pay_statement_id"]
            isOneToOne: false
            referencedRelation: "pay_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statement_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_statements: {
        Row: {
          calculation_basis: Json
          calculation_run_id: string | null
          created_at: string
          deductions: Json
          downloaded_at: string | null
          earnings: Json
          file_storage_path: string | null
          gross_pay: number | null
          has_manual_override: boolean
          id: string
          internal_note: string | null
          issued_at: string | null
          issued_by: string | null
          memo: string | null
          net_pay: number | null
          pay_month: string
          pay_period_end: string | null
          pay_period_start: string | null
          payment_date: string | null
          published_at: string | null
          rate_version_id: string | null
          status: string
          total_deductions: number
          updated_at: string
          user_id: string
          viewed_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          calculation_basis?: Json
          calculation_run_id?: string | null
          created_at?: string
          deductions?: Json
          downloaded_at?: string | null
          earnings?: Json
          file_storage_path?: string | null
          gross_pay?: number | null
          has_manual_override?: boolean
          id?: string
          internal_note?: string | null
          issued_at?: string | null
          issued_by?: string | null
          memo?: string | null
          net_pay?: number | null
          pay_month: string
          pay_period_end?: string | null
          pay_period_start?: string | null
          payment_date?: string | null
          published_at?: string | null
          rate_version_id?: string | null
          status?: string
          total_deductions?: number
          updated_at?: string
          user_id: string
          viewed_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          calculation_basis?: Json
          calculation_run_id?: string | null
          created_at?: string
          deductions?: Json
          downloaded_at?: string | null
          earnings?: Json
          file_storage_path?: string | null
          gross_pay?: number | null
          has_manual_override?: boolean
          id?: string
          internal_note?: string | null
          issued_at?: string | null
          issued_by?: string | null
          memo?: string | null
          net_pay?: number | null
          pay_month?: string
          pay_period_end?: string | null
          pay_period_start?: string | null
          payment_date?: string | null
          published_at?: string | null
          rate_version_id?: string | null
          status?: string
          total_deductions?: number
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_statements_calculation_run_id_fkey"
            columns: ["calculation_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_calculation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statements_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statements_rate_version_id_fkey"
            columns: ["rate_version_id"]
            isOneToOne: false
            referencedRelation: "payroll_rate_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statements_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_calculation_runs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          input_snapshot: Json
          pay_month: string
          pay_statement_id: string | null
          rate_version_id: string | null
          result_snapshot: Json
          user_id: string
          warnings: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          input_snapshot?: Json
          pay_month: string
          pay_statement_id?: string | null
          rate_version_id?: string | null
          result_snapshot?: Json
          user_id: string
          warnings?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          input_snapshot?: Json
          pay_month?: string
          pay_statement_id?: string | null
          rate_version_id?: string | null
          result_snapshot?: Json
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payroll_calculation_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_runs_pay_statement_id_fkey"
            columns: ["pay_statement_id"]
            isOneToOne: false
            referencedRelation: "pay_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_runs_rate_version_id_fkey"
            columns: ["rate_version_id"]
            isOneToOne: false
            referencedRelation: "payroll_rate_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_rate_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          employment_insurance_rate: number
          health_insurance_rate: number
          id: string
          income_tax_config: Json
          income_tax_mode: string
          is_active: boolean
          local_income_tax_rate: number
          long_term_care_rate: number
          name: string
          national_pension_rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          employment_insurance_rate?: number
          health_insurance_rate?: number
          id?: string
          income_tax_config?: Json
          income_tax_mode?: string
          is_active?: boolean
          local_income_tax_rate?: number
          long_term_care_rate?: number
          name: string
          national_pension_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          employment_insurance_rate?: number
          health_insurance_rate?: number
          id?: string
          income_tax_config?: Json
          income_tax_mode?: string
          is_active?: boolean
          local_income_tax_rate?: number
          long_term_care_rate?: number
          name?: string
          national_pension_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_rate_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_rate_versions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      portfolio_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          display_order: number
          id: string
          post_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          display_order?: number
          id?: string
          post_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          display_order?: number
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "portfolio_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_collection_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "portfolio_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_collections: {
        Row: {
          collection_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          collection_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          collection_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_images: {
        Row: {
          access_level: string
          caption: string | null
          created_at: string
          delete_error: string | null
          delete_status: string
          display_order: number
          dominant_color: string | null
          drive_file_id: string
          drive_folder_id: string | null
          drive_path: string | null
          file_name: string
          file_size: number | null
          height: number | null
          id: string
          image_url: string | null
          is_main: boolean
          mime_type: string | null
          post_id: string
          storage_provider: string
          taken_at: string | null
          thumbnail_bucket: string | null
          thumbnail_height: number | null
          thumbnail_path: string | null
          thumbnail_url: string | null
          thumbnail_width: number | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          access_level?: string
          caption?: string | null
          created_at?: string
          delete_error?: string | null
          delete_status?: string
          display_order?: number
          dominant_color?: string | null
          drive_file_id: string
          drive_folder_id?: string | null
          drive_path?: string | null
          file_name: string
          file_size?: number | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_main?: boolean
          mime_type?: string | null
          post_id: string
          storage_provider?: string
          taken_at?: string | null
          thumbnail_bucket?: string | null
          thumbnail_height?: number | null
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          thumbnail_width?: number | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          access_level?: string
          caption?: string | null
          created_at?: string
          delete_error?: string | null
          delete_status?: string
          display_order?: number
          dominant_color?: string | null
          drive_file_id?: string
          drive_folder_id?: string | null
          drive_path?: string | null
          file_name?: string
          file_size?: number | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_main?: boolean
          mime_type?: string | null
          post_id?: string
          storage_provider?: string
          taken_at?: string | null
          thumbnail_bucket?: string | null
          thumbnail_height?: number | null
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          thumbnail_width?: number | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "portfolio_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_posts: {
        Row: {
          archived_at: string | null
          category: string | null
          client_name: string | null
          cover_image_id: string | null
          created_at: string
          created_by: string
          gallery_type: string
          id: string
          keywords: string[] | null
          location: string | null
          materials: string[] | null
          memo: string | null
          processes: string[] | null
          project_year: number | null
          title: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          client_name?: string | null
          cover_image_id?: string | null
          created_at?: string
          created_by: string
          gallery_type?: string
          id?: string
          keywords?: string[] | null
          location?: string | null
          materials?: string[] | null
          memo?: string | null
          processes?: string[] | null
          project_year?: number | null
          title: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          client_name?: string | null
          cover_image_id?: string | null
          created_at?: string
          created_by?: string
          gallery_type?: string
          id?: string
          keywords?: string[] | null
          location?: string | null
          materials?: string[] | null
          memo?: string | null
          processes?: string[] | null
          project_year?: number | null
          title?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_posts_cover_image_id_fkey"
            columns: ["cover_image_id"]
            isOneToOne: false
            referencedRelation: "portfolio_images"
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
          pricing_method: string
          rate: number | null
          requires_review: boolean
          unit: string | null
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
          pricing_method?: string
          rate?: number | null
          requires_review?: boolean
          unit?: string | null
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
          pricing_method?: string
          rate?: number | null
          requires_review?: boolean
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profile_directory: {
        Row: {
          avatar_url: string | null
          department: string | null
          full_name: string | null
          id: string
          is_approved: boolean
          job_title: string | null
          position: string | null
          rank_title: string | null
          synced_at: string
        }
        Insert: {
          avatar_url?: string | null
          department?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean
          job_title?: string | null
          position?: string | null
          rank_title?: string | null
          synced_at?: string
        }
        Update: {
          avatar_url?: string | null
          department?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          job_title?: string | null
          position?: string | null
          rank_title?: string | null
          synced_at?: string
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
      project_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          display_order: number
          fixed_stage: string | null
          id: string
          is_completed: boolean
          milestone_type: string
          project_id: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          fixed_stage?: string | null
          id?: string
          is_completed?: boolean
          milestone_type?: string
          project_id: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          fixed_stage?: string | null
          id?: string
          is_completed?: boolean
          milestone_type?: string
          project_id?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
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
          custom_data: Json | null
          description: string | null
          drive_folder_id: string | null
          drive_folder_path: string | null
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
          custom_data?: Json | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_path?: string | null
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
          custom_data?: Json | null
          description?: string | null
          drive_folder_id?: string | null
          drive_folder_path?: string | null
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
      public_booking_links: {
        Row: {
          access_code_hash: string | null
          allowed_resource_ids: string[]
          allowed_weekdays: number[]
          assigned_user_ids: string[]
          buffer_minutes: number
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          end_time: string
          id: string
          is_active: boolean
          link_type: string
          max_days_ahead: number
          meeting_modes: string[]
          metadata: Json
          min_notice_minutes: number
          notify_user_ids: string[]
          preview_description: string | null
          preview_image_url: string | null
          preview_title: string | null
          requires_approval: boolean
          slot_minutes: number
          slug: string
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          access_code_hash?: string | null
          allowed_resource_ids?: string[]
          allowed_weekdays?: number[]
          assigned_user_ids?: string[]
          buffer_minutes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          link_type?: string
          max_days_ahead?: number
          meeting_modes?: string[]
          metadata?: Json
          min_notice_minutes?: number
          notify_user_ids?: string[]
          preview_description?: string | null
          preview_image_url?: string | null
          preview_title?: string | null
          requires_approval?: boolean
          slot_minutes?: number
          slug: string
          start_time?: string
          title: string
          updated_at?: string
        }
        Update: {
          access_code_hash?: string | null
          allowed_resource_ids?: string[]
          allowed_weekdays?: number[]
          assigned_user_ids?: string[]
          buffer_minutes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          link_type?: string
          max_days_ahead?: number
          meeting_modes?: string[]
          metadata?: Json
          min_notice_minutes?: number
          notify_user_ids?: string[]
          preview_description?: string | null
          preview_image_url?: string | null
          preview_title?: string | null
          requires_approval?: boolean
          slot_minutes?: number
          slug?: string
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_booking_requests: {
        Row: {
          assigned_to: string | null
          calendar_event_id: string | null
          company_name: string | null
          consultation_lead_id: string | null
          contact_preference: string | null
          created_at: string
          email: string | null
          ends_at: string
          id: string
          ip_hash: string | null
          link_id: string
          meeting_mode: string
          metadata: Json
          notes: string | null
          phone: string | null
          purpose: string
          requester_name: string
          resource_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          starts_at: string
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          assigned_to?: string | null
          calendar_event_id?: string | null
          company_name?: string | null
          consultation_lead_id?: string | null
          contact_preference?: string | null
          created_at?: string
          email?: string | null
          ends_at: string
          id?: string
          ip_hash?: string | null
          link_id: string
          meeting_mode?: string
          metadata?: Json
          notes?: string | null
          phone?: string | null
          purpose: string
          requester_name: string
          resource_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          assigned_to?: string | null
          calendar_event_id?: string | null
          company_name?: string | null
          consultation_lead_id?: string | null
          contact_preference?: string | null
          created_at?: string
          email?: string | null
          ends_at?: string
          id?: string
          ip_hash?: string | null
          link_id?: string
          meeting_mode?: string
          metadata?: Json
          notes?: string | null
          phone?: string | null
          purpose?: string
          requester_name?: string
          resource_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_booking_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_consultation_lead_id_fkey"
            columns: ["consultation_lead_id"]
            isOneToOne: false
            referencedRelation: "client_consultation_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "public_booking_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "calendar_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_activity_history: {
        Row: {
          action_type: string
          actor_id: string
          actor_name: string
          created_at: string
          id: string
          memo: string | null
          metadata: Json
          new_value: string | null
          old_value: string | null
          quote_id: string
        }
        Insert: {
          action_type: string
          actor_id: string
          actor_name: string
          created_at?: string
          id?: string
          memo?: string | null
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          quote_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string
          actor_name?: string
          created_at?: string
          id?: string
          memo?: string | null
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_activity_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_drafts: {
        Row: {
          created_at: string
          id: string
          issued_at: string | null
          issued_quote_id: string | null
          items: Json
          last_opened_at: string | null
          quote_style: string
          recipient: Json | null
          status: string
          subtotal: number
          tax: number
          title: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_quote_id?: string | null
          items?: Json
          last_opened_at?: string | null
          quote_style?: string
          recipient?: Json | null
          status?: string
          subtotal?: number
          tax?: number
          title?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_quote_id?: string | null
          items?: Json
          last_opened_at?: string | null
          quote_style?: string
          recipient?: Json | null
          status?: string
          subtotal?: number
          tax?: number
          title?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_drafts_issued_quote_id_fkey"
            columns: ["issued_quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
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
      quote_stage_history: {
        Row: {
          changed_by: string
          changed_by_name: string
          created_at: string
          id: string
          memo: string | null
          new_stage: string
          old_stage: string | null
          quote_id: string
        }
        Insert: {
          changed_by: string
          changed_by_name: string
          created_at?: string
          id?: string
          memo?: string | null
          new_stage: string
          old_stage?: string | null
          quote_id: string
        }
        Update: {
          changed_by?: string
          changed_by_name?: string
          created_at?: string
          id?: string
          memo?: string | null
          new_stage?: string
          old_stage?: string | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_stage_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_status_recovery_backup_20260529: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          attachments: Json | null
          auto_cancel_reason: string | null
          auto_cancelled_at: string | null
          calculation_snapshot: Json | null
          created_at: string | null
          custom_color_name: string | null
          custom_opacity: string | null
          delivery_period: string | null
          desired_delivery_date: string | null
          drive_folder_id: string | null
          drive_folder_path: string | null
          drive_pdf_file_id: string | null
          id: string | null
          issuer_department: string | null
          issuer_email: string | null
          issuer_id: string | null
          issuer_name: string | null
          issuer_phone: string | null
          issuer_position: string | null
          items: Json | null
          payment_condition: string | null
          pricing_version_id: string | null
          project_id: string | null
          project_name: string | null
          project_stage: string | null
          quote_date: string | null
          quote_date_display: string | null
          quote_number: string | null
          quote_status: string | null
          recipient_address: string | null
          recipient_company: string | null
          recipient_email: string | null
          recipient_memo: string | null
          recipient_name: string | null
          recipient_phone: string | null
          reissued_at: string | null
          reissued_from_quote_id: string | null
          reissued_quote_id: string | null
          status_updated_at: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string | null
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachments?: Json | null
          auto_cancel_reason?: string | null
          auto_cancelled_at?: string | null
          calculation_snapshot?: Json | null
          created_at?: string | null
          custom_color_name?: string | null
          custom_opacity?: string | null
          delivery_period?: string | null
          desired_delivery_date?: string | null
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_pdf_file_id?: string | null
          id?: string | null
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_id?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items?: Json | null
          payment_condition?: string | null
          pricing_version_id?: string | null
          project_id?: string | null
          project_name?: string | null
          project_stage?: string | null
          quote_date?: string | null
          quote_date_display?: string | null
          quote_number?: string | null
          quote_status?: string | null
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_memo?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reissued_at?: string | null
          reissued_from_quote_id?: string | null
          reissued_quote_id?: string | null
          status_updated_at?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachments?: Json | null
          auto_cancel_reason?: string | null
          auto_cancelled_at?: string | null
          calculation_snapshot?: Json | null
          created_at?: string | null
          custom_color_name?: string | null
          custom_opacity?: string | null
          delivery_period?: string | null
          desired_delivery_date?: string | null
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_pdf_file_id?: string | null
          id?: string | null
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_id?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items?: Json | null
          payment_condition?: string | null
          pricing_version_id?: string | null
          project_id?: string | null
          project_name?: string | null
          project_stage?: string | null
          quote_date?: string | null
          quote_date_display?: string | null
          quote_number?: string | null
          quote_status?: string | null
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_memo?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reissued_at?: string | null
          reissued_from_quote_id?: string | null
          reissued_quote_id?: string | null
          status_updated_at?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      quote_status_recovery_review_20260529: {
        Row: {
          created_at: string
          current_project_stage: string | null
          current_quote_status: string | null
          project_id: string | null
          quote_id: string
          quote_number: string | null
          reason: string | null
          suggested_project_stage: string | null
        }
        Insert: {
          created_at?: string
          current_project_stage?: string | null
          current_quote_status?: string | null
          project_id?: string | null
          quote_id: string
          quote_number?: string | null
          reason?: string | null
          suggested_project_stage?: string | null
        }
        Update: {
          created_at?: string
          current_project_stage?: string | null
          current_quote_status?: string | null
          project_id?: string | null
          quote_id?: string
          quote_number?: string | null
          reason?: string | null
          suggested_project_stage?: string | null
        }
        Relationships: []
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
      quote_versions: {
        Row: {
          change_summary: string | null
          changed_by: string
          changed_by_name: string
          created_at: string
          id: string
          quote_id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          changed_by: string
          changed_by_name: string
          created_at?: string
          id?: string
          quote_id: string
          snapshot: Json
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          changed_by?: string
          changed_by_name?: string
          created_at?: string
          id?: string
          quote_id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_wizard_files: {
        Row: {
          created_at: string
          expires_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          job_id: string
          kind: string
          metadata: Json
          mime_type: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          job_id: string
          kind?: string
          metadata?: Json
          mime_type?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          job_id?: string
          kind?: string
          metadata?: Json
          mime_type?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_wizard_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "quote_wizard_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_wizard_jobs: {
        Row: {
          converted_draft_id: string | null
          created_at: string
          customer_note: string | null
          error_message: string | null
          expires_at: string
          id: string
          result_id: string | null
          review_status: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          converted_draft_id?: string | null
          created_at?: string
          customer_note?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          result_id?: string | null
          review_status?: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          converted_draft_id?: string | null
          created_at?: string
          customer_note?: string | null
          error_message?: string | null
          expires_at?: string
          id?: string
          result_id?: string | null
          review_status?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_wizard_jobs_converted_draft_id_fkey"
            columns: ["converted_draft_id"]
            isOneToOne: false
            referencedRelation: "quote_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_wizard_jobs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "quote_wizard_results"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_wizard_results: {
        Row: {
          analysis_snapshot: Json
          created_at: string
          expires_at: string
          formula_snapshot: Json
          id: string
          job_id: string
          source: string
          status: string
          updated_at: string
          user_id: string
          yield_snapshot: Json
        }
        Insert: {
          analysis_snapshot?: Json
          created_at?: string
          expires_at?: string
          formula_snapshot?: Json
          id?: string
          job_id: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          yield_snapshot?: Json
        }
        Update: {
          analysis_snapshot?: Json
          created_at?: string
          expires_at?: string
          formula_snapshot?: Json
          id?: string
          job_id?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          yield_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quote_wizard_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "quote_wizard_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recipient_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          note_type: string
          recipient_id: string
          title: string | null
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          note_type?: string
          recipient_id: string
          title?: string | null
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          note_type?: string
          recipient_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipient_notes_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
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
          drive_folder_id: string | null
          drive_folder_path: string | null
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
          drive_folder_id?: string | null
          drive_folder_path?: string | null
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
          drive_folder_id?: string | null
          drive_folder_path?: string | null
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
      response_assistant_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      response_cases: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_company: string | null
          customer_contact: string | null
          customer_message: string
          customer_name: string | null
          external_message_id: string | null
          external_thread_id: string | null
          final_response: string | null
          id: string
          inquiry_type: string | null
          internal_context: string | null
          related_project_id: string | null
          related_quote_id: string | null
          review_required: boolean
          risk_level: string
          source_channel: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_company?: string | null
          customer_contact?: string | null
          customer_message: string
          customer_name?: string | null
          external_message_id?: string | null
          external_thread_id?: string | null
          final_response?: string | null
          id?: string
          inquiry_type?: string | null
          internal_context?: string | null
          related_project_id?: string | null
          related_quote_id?: string | null
          review_required?: boolean
          risk_level?: string
          source_channel?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_company?: string | null
          customer_contact?: string | null
          customer_message?: string
          customer_name?: string | null
          external_message_id?: string | null
          external_thread_id?: string | null
          final_response?: string | null
          id?: string
          inquiry_type?: string | null
          internal_context?: string | null
          related_project_id?: string | null
          related_quote_id?: string | null
          review_required?: boolean
          risk_level?: string
          source_channel?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      response_drafts: {
        Row: {
          ai_risk_level: string
          avoid_phrases: Json
          case_id: string
          created_at: string
          created_by: string | null
          drafts_by_tone: Json
          empathy_points: Json
          final_text: string | null
          id: string
          is_used: boolean
          persuasion_points: Json
          review_required: boolean
          selected_tone: string
          summary: string | null
          updated_at: string
          used_knowledge_item_ids: Json
        }
        Insert: {
          ai_risk_level?: string
          avoid_phrases?: Json
          case_id: string
          created_at?: string
          created_by?: string | null
          drafts_by_tone?: Json
          empathy_points?: Json
          final_text?: string | null
          id?: string
          is_used?: boolean
          persuasion_points?: Json
          review_required?: boolean
          selected_tone?: string
          summary?: string | null
          updated_at?: string
          used_knowledge_item_ids?: Json
        }
        Update: {
          ai_risk_level?: string
          avoid_phrases?: Json
          case_id?: string
          created_at?: string
          created_by?: string | null
          drafts_by_tone?: Json
          empathy_points?: Json
          final_text?: string | null
          id?: string
          is_used?: boolean
          persuasion_points?: Json
          review_required?: boolean
          selected_tone?: string
          summary?: string | null
          updated_at?: string
          used_knowledge_item_ids?: Json
        }
        Relationships: [
          {
            foreignKeyName: "response_drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "response_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      response_knowledge_items: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
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
      sample_chip_inventory: {
        Row: {
          color_code: string | null
          color_name: string
          created_at: string
          group_name: string | null
          id: string
          memo: string | null
          min_stock_ea: number
          min_stock_set: number
          panel_master_id: string | null
          stock_ea: number
          stock_set: number
          updated_at: string
        }
        Insert: {
          color_code?: string | null
          color_name: string
          created_at?: string
          group_name?: string | null
          id?: string
          memo?: string | null
          min_stock_ea?: number
          min_stock_set?: number
          panel_master_id?: string | null
          stock_ea?: number
          stock_set?: number
          updated_at?: string
        }
        Update: {
          color_code?: string | null
          color_name?: string
          created_at?: string
          group_name?: string | null
          id?: string
          memo?: string | null
          min_stock_ea?: number
          min_stock_set?: number
          panel_master_id?: string | null
          stock_ea?: number
          stock_set?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_chip_inventory_panel_master_id_fkey"
            columns: ["panel_master_id"]
            isOneToOne: false
            referencedRelation: "panel_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_chip_transactions: {
        Row: {
          created_at: string
          id: string
          inventory_id: string
          quantity_ea: number
          quantity_set: number
          reason: string | null
          recipient_name: string | null
          transaction_type: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_id: string
          quantity_ea?: number
          quantity_set?: number
          reason?: string | null
          recipient_name?: string | null
          transaction_type: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_id?: string
          quantity_ea?: number
          quantity_set?: number
          reason?: string | null
          recipient_name?: string | null
          transaction_type?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_chip_transactions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "sample_chip_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_quotes: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          attachments: Json | null
          auto_cancel_reason: string | null
          auto_cancelled_at: string | null
          calculation_snapshot: Json
          created_at: string
          custom_color_name: string | null
          custom_opacity: string | null
          delivery_period: string | null
          desired_delivery_date: string | null
          drive_folder_id: string | null
          drive_folder_path: string | null
          drive_pdf_file_id: string | null
          id: string
          issuer_department: string | null
          issuer_email: string | null
          issuer_id: string | null
          issuer_name: string | null
          issuer_phone: string | null
          issuer_position: string | null
          items: Json
          lost_by: string | null
          lost_competitor_name: string | null
          lost_follow_up_at: string | null
          lost_price_gap: number | null
          lost_reason_category: string | null
          lost_reason_detail: string | null
          lost_recorded_at: string | null
          lost_recorded_by: string | null
          payment_condition: string | null
          pricing_version_id: string | null
          project_followup_note: string | null
          project_followup_status: string
          project_followup_updated_at: string | null
          project_followup_updated_by: string | null
          project_id: string | null
          project_name: string | null
          project_stage: string
          quote_date: string
          quote_date_display: string | null
          quote_notes: string | null
          quote_number: string
          quote_status: string
          recipient_address: string | null
          recipient_company: string | null
          recipient_email: string | null
          recipient_id: string | null
          recipient_memo: string | null
          recipient_name: string | null
          recipient_phone: string | null
          reissued_at: string | null
          reissued_from_quote_id: string | null
          reissued_quote_id: string | null
          status_updated_at: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachments?: Json | null
          auto_cancel_reason?: string | null
          auto_cancelled_at?: string | null
          calculation_snapshot?: Json
          created_at?: string
          custom_color_name?: string | null
          custom_opacity?: string | null
          delivery_period?: string | null
          desired_delivery_date?: string | null
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_pdf_file_id?: string | null
          id?: string
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_id?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items: Json
          lost_by?: string | null
          lost_competitor_name?: string | null
          lost_follow_up_at?: string | null
          lost_price_gap?: number | null
          lost_reason_category?: string | null
          lost_reason_detail?: string | null
          lost_recorded_at?: string | null
          lost_recorded_by?: string | null
          payment_condition?: string | null
          pricing_version_id?: string | null
          project_followup_note?: string | null
          project_followup_status?: string
          project_followup_updated_at?: string | null
          project_followup_updated_by?: string | null
          project_id?: string | null
          project_name?: string | null
          project_stage?: string
          quote_date?: string
          quote_date_display?: string | null
          quote_notes?: string | null
          quote_number: string
          quote_status?: string
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_memo?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reissued_at?: string | null
          reissued_from_quote_id?: string | null
          reissued_quote_id?: string | null
          status_updated_at?: string
          subtotal: number
          tax: number
          total: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          attachments?: Json | null
          auto_cancel_reason?: string | null
          auto_cancelled_at?: string | null
          calculation_snapshot?: Json
          created_at?: string
          custom_color_name?: string | null
          custom_opacity?: string | null
          delivery_period?: string | null
          desired_delivery_date?: string | null
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_pdf_file_id?: string | null
          id?: string
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_id?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items?: Json
          lost_by?: string | null
          lost_competitor_name?: string | null
          lost_follow_up_at?: string | null
          lost_price_gap?: number | null
          lost_reason_category?: string | null
          lost_reason_detail?: string | null
          lost_recorded_at?: string | null
          lost_recorded_by?: string | null
          payment_condition?: string | null
          pricing_version_id?: string | null
          project_followup_note?: string | null
          project_followup_status?: string
          project_followup_updated_at?: string | null
          project_followup_updated_by?: string | null
          project_id?: string | null
          project_name?: string | null
          project_stage?: string
          quote_date?: string
          quote_date_display?: string | null
          quote_notes?: string | null
          quote_number?: string
          quote_status?: string
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_memo?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reissued_at?: string | null
          reissued_from_quote_id?: string | null
          reissued_quote_id?: string | null
          status_updated_at?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_quotes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_lost_recorded_by_fkey"
            columns: ["lost_recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "panel_pricing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_reissued_from_quote_id_fkey"
            columns: ["reissued_from_quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_quotes_reissued_quote_id_fkey"
            columns: ["reissued_quote_id"]
            isOneToOne: false
            referencedRelation: "saved_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_events: {
        Row: {
          created_at: string
          display_duration: number | null
          emoji: string
          event_type: string
          gradient: string | null
          id: string
          is_active: boolean | null
          message: string
          name: string
          particles: string[] | null
          sound_enabled: boolean | null
          sound_freq: number | null
          sub_message: string | null
          trigger_date: number | null
          trigger_day_of_week: number | null
          trigger_hour: number | null
          trigger_minute: number | null
          trigger_month: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_duration?: number | null
          emoji?: string
          event_type?: string
          gradient?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          name: string
          particles?: string[] | null
          sound_enabled?: boolean | null
          sound_freq?: number | null
          sub_message?: string | null
          trigger_date?: number | null
          trigger_day_of_week?: number | null
          trigger_hour?: number | null
          trigger_minute?: number | null
          trigger_month?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_duration?: number | null
          emoji?: string
          event_type?: string
          gradient?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          name?: string
          particles?: string[] | null
          sound_enabled?: boolean | null
          sound_freq?: number | null
          sub_message?: string | null
          trigger_date?: number | null
          trigger_day_of_week?: number | null
          trigger_hour?: number | null
          trigger_minute?: number | null
          trigger_month?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      settings_change_requests: {
        Row: {
          action: string
          after_value: Json | null
          applied_at: string | null
          before_value: Json | null
          change_summary: string
          created_at: string
          id: string
          requested_by: string
          requested_by_name: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string
          status: string
          target_area: string
          target_key: string
          target_table: string
          updated_at: string
        }
        Insert: {
          action?: string
          after_value?: Json | null
          applied_at?: string | null
          before_value?: Json | null
          change_summary: string
          created_at?: string
          id?: string
          requested_by?: string
          requested_by_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          status?: string
          target_area?: string
          target_key: string
          target_table: string
          updated_at?: string
        }
        Update: {
          action?: string
          after_value?: Json | null
          applied_at?: string | null
          before_value?: Json | null
          change_summary?: string
          created_at?: string
          id?: string
          requested_by?: string
          requested_by_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string
          status?: string
          target_area?: string
          target_key?: string
          target_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      space_project_quotes: {
        Row: {
          area_unit: string | null
          attachments: Json | null
          client_business_address: string | null
          client_business_item: string | null
          client_business_name: string | null
          client_business_number: string | null
          client_business_type: string | null
          client_contact_email: string | null
          client_contact_name: string | null
          client_contact_phone: string | null
          client_contact_position: string | null
          client_name: string | null
          client_representative: string | null
          cost_breakdown: Json | null
          created_at: string
          floor_count: number | null
          id: string
          issuer_department: string | null
          issuer_email: string | null
          issuer_id: string | null
          issuer_name: string | null
          issuer_phone: string | null
          issuer_position: string | null
          items: Json
          location: string | null
          memo: string | null
          project_name: string
          project_type: string | null
          quote_date: string
          quote_number: string
          recipient_address: string | null
          recipient_company: string | null
          recipient_contact: string | null
          recipient_email: string | null
          recipient_phone: string | null
          scheduled_date: string | null
          subtotal: number
          tax: number
          total: number
          total_area: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
          zones: Json | null
        }
        Insert: {
          area_unit?: string | null
          attachments?: Json | null
          client_business_address?: string | null
          client_business_item?: string | null
          client_business_name?: string | null
          client_business_number?: string | null
          client_business_type?: string | null
          client_contact_email?: string | null
          client_contact_name?: string | null
          client_contact_phone?: string | null
          client_contact_position?: string | null
          client_name?: string | null
          client_representative?: string | null
          cost_breakdown?: Json | null
          created_at?: string
          floor_count?: number | null
          id?: string
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_id?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items?: Json
          location?: string | null
          memo?: string | null
          project_name: string
          project_type?: string | null
          quote_date?: string
          quote_number: string
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_contact?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          scheduled_date?: string | null
          subtotal?: number
          tax?: number
          total?: number
          total_area?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
          zones?: Json | null
        }
        Update: {
          area_unit?: string | null
          attachments?: Json | null
          client_business_address?: string | null
          client_business_item?: string | null
          client_business_name?: string | null
          client_business_number?: string | null
          client_business_type?: string | null
          client_contact_email?: string | null
          client_contact_name?: string | null
          client_contact_phone?: string | null
          client_contact_position?: string | null
          client_name?: string | null
          client_representative?: string | null
          cost_breakdown?: Json | null
          created_at?: string
          floor_count?: number | null
          id?: string
          issuer_department?: string | null
          issuer_email?: string | null
          issuer_id?: string | null
          issuer_name?: string | null
          issuer_phone?: string | null
          issuer_position?: string | null
          items?: Json
          location?: string | null
          memo?: string | null
          project_name?: string
          project_type?: string | null
          quote_date?: string
          quote_number?: string
          recipient_address?: string | null
          recipient_company?: string | null
          recipient_contact?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          scheduled_date?: string | null
          subtotal?: number
          tax?: number
          total?: number
          total_area?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          zones?: Json | null
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
          invoice_direction: string
          issue_type: string
          items: Json
          memo: string | null
          popbill_issue_id: string | null
          popbill_mgt_key: string | null
          popbill_nts_confirm_num: string | null
          popbill_state_code: string | null
          popbill_state_dt: string | null
          project_id: string | null
          project_name: string | null
          purpose_type: string
          quote_id: string | null
          quote_number: string | null
          recipient_id: string | null
          recipient_name: string | null
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
          invoice_direction?: string
          issue_type?: string
          items?: Json
          memo?: string | null
          popbill_issue_id?: string | null
          popbill_mgt_key?: string | null
          popbill_nts_confirm_num?: string | null
          popbill_state_code?: string | null
          popbill_state_dt?: string | null
          project_id?: string | null
          project_name?: string | null
          purpose_type?: string
          quote_id?: string | null
          quote_number?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
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
          invoice_direction?: string
          issue_type?: string
          items?: Json
          memo?: string | null
          popbill_issue_id?: string | null
          popbill_mgt_key?: string | null
          popbill_nts_confirm_num?: string | null
          popbill_state_code?: string | null
          popbill_state_dt?: string | null
          project_id?: string | null
          project_name?: string | null
          purpose_type?: string
          quote_id?: string | null
          quote_number?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
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
          {
            foreignKeyName: "tax_invoices_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
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
      yield_calculation_history: {
        Row: {
          best_efficiency: number | null
          combinations: Json | null
          created_at: string
          cut_items: Json
          id: string
          quality: string
          results: Json | null
          thickness: string
          title: string | null
          total_panels_needed: number | null
          user_id: string
          user_name: string
        }
        Insert: {
          best_efficiency?: number | null
          combinations?: Json | null
          created_at?: string
          cut_items: Json
          id?: string
          quality: string
          results?: Json | null
          thickness: string
          title?: string | null
          total_panels_needed?: number | null
          user_id: string
          user_name: string
        }
        Update: {
          best_efficiency?: number | null
          combinations?: Json | null
          created_at?: string
          cut_items?: Json
          id?: string
          quality?: string
          results?: Json | null
          thickness?: string
          title?: string | null
          total_panels_needed?: number | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      yield_cut_presets: {
        Row: {
          created_at: string
          cut_items: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cut_items: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cut_items?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      today_attendance_status: {
        Row: {
          check_in: string | null
          check_out: string | null
          date: string | null
          status: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          date?: string | null
          status?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          date?: string | null
          status?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_supported_settings_change: {
        Args: {
          _request: Database["public"]["Tables"]["settings_change_requests"]["Row"]
        }
        Returns: undefined
      }
      approve_settings_change_request: {
        Args: { _request_id: string; _review_note?: string }
        Returns: string
      }
      assistant_shortcut_ids_allowed: {
        Args: { _ids: string[] }
        Returns: boolean
      }
      calendar_day_end_at: { Args: { _date: string }; Returns: string }
      calendar_day_start_at: { Args: { _date: string }; Returns: string }
      calendar_meeting_start_at: {
        Args: { _date: string; _time: string }
        Returns: string
      }
      calendar_replace_event_participants: {
        Args: {
          _assignee_ids?: string[]
          _attendee_ids?: string[]
          _event_id: string
          _organizer_id?: string
        }
        Returns: undefined
      }
      calendar_sync_announcement_event: {
        Args: { _announcement_id: string }
        Returns: undefined
      }
      calendar_sync_company_holiday: {
        Args: { _holiday_id: string }
        Returns: undefined
      }
      calendar_sync_leave_request: {
        Args: { _leave_id: string }
        Returns: undefined
      }
      calendar_sync_peer_meeting: {
        Args: { _feedback_id: string }
        Returns: undefined
      }
      calendar_sync_project: {
        Args: { _project_id: string }
        Returns: undefined
      }
      calendar_sync_saved_quote: {
        Args: { _quote_id: string }
        Returns: undefined
      }
      calendar_try_date: { Args: { _value: string }; Returns: string }
      calendar_upsert_source_event: {
        Args: {
          _accent: string
          _all_day: boolean
          _client_contact: string
          _client_name: string
          _created_by: string
          _created_by_name: string
          _description: string
          _ends_at: string
          _icon_type: string
          _location: string
          _metadata?: Json
          _recipient_id: string
          _source_id: string
          _source_path: string
          _source_subtype: string
          _source_type: string
          _starts_at: string
          _status: string
          _team_department: string
          _title: string
          _visibility: string
        }
        Returns: string
      }
      can_access_channel_talk_inbox: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_access_feature: { Args: { _feature_key: string }; Returns: boolean }
      can_access_project_approval: {
        Args: { _project_id: string; _user_id?: string }
        Returns: boolean
      }
      can_manage_channel_talk_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_approval_request: {
        Args: { _note?: string; _request_id: string }
        Returns: string
      }
      check_workplace_distance: {
        Args: { input_lat: number; input_lng: number }
        Returns: {
          distance_meters: number
          outside: boolean
          radius_meters: number
        }[]
      }
      cleanup_expired_quote_wizard_data: {
        Args: never
        Returns: {
          deleted_jobs: number
          deleted_storage_objects: number
        }[]
      }
      cleanup_expired_quote_wizard_rows: { Args: never; Returns: number }
      confirm_public_booking_request: {
        Args: {
          _request_id: string
          _review_note?: string
          _reviewer_id?: string
        }
        Returns: string
      }
      create_approval_request: { Args: { _payload: Json }; Returns: string }
      create_calendar_event: { Args: { payload: Json }; Returns: string }
      delete_calendar_event: { Args: { payload: Json }; Returns: string }
      get_assistant_allowed_shortcut_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_calendar_dashboard_summary: {
        Args: { range_end: string; range_start: string; scope?: string }
        Returns: Json
      }
      get_calendar_events: {
        Args: { filters?: Json; range_end: string; range_start: string }
        Returns: {
          accent: string
          all_day: boolean
          can_edit: boolean
          client_contact: string
          client_name: string
          created_by: string
          created_by_name: string
          description: string
          ends_at: string
          icon_type: string
          id: string
          is_redacted: boolean
          location: string
          metadata: Json
          participant_ids: string[]
          participant_names: string[]
          recurrence_exception_date: string
          recurrence_parent_id: string
          recurrence_rule: Json
          reminder_minutes: number[]
          resource_ids: string[]
          resource_names: string[]
          source_id: string
          source_path: string
          source_subtype: string
          source_type: string
          starts_at: string
          status: string
          team_department: string
          title: string
          visibility: string
        }[]
      }
      get_calendar_resource_conflict: {
        Args: {
          _ends_at: string
          _exclude_event_id?: string
          _resource_ids: string[]
          _starts_at: string
        }
        Returns: string
      }
      get_calendar_user_conflict: {
        Args: {
          _ends_at: string
          _exclude_event_id?: string
          _starts_at: string
          _user_ids: string[]
        }
        Returns: string
      }
      get_employee_online_status: {
        Args: never
        Returns: {
          attendance_status: string
          avatar_url: string
          check_in: string
          check_out: string
          department: string
          full_name: string
          last_seen_at: string
          position: string
          user_id: string
          work_status: string
        }[]
      }
      get_portfolio_post_main_images: {
        Args: { p_post_ids: string[] }
        Returns: {
          access_level: string
          caption: string
          created_at: string
          delete_error: string
          delete_status: string
          display_order: number
          dominant_color: string
          drive_file_id: string
          drive_folder_id: string
          drive_path: string
          file_name: string
          file_size: number
          height: number
          id: string
          image_count: number
          image_url: string
          is_main: boolean
          mime_type: string
          post_id: string
          storage_provider: string
          taken_at: string
          thumbnail_bucket: string
          thumbnail_height: number
          thumbnail_path: string
          thumbnail_url: string
          thumbnail_width: number
          uploaded_by: string
          width: number
        }[]
      }
      get_profile_display_name: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_user: { Args: { _user_id?: string }; Returns: boolean }
      is_company_master: { Args: never; Returns: boolean }
      is_project_assigned: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      mark_employee_offline: { Args: never; Returns: undefined }
      notify_approval_reviewers: {
        Args: { _request_id: string }
        Returns: undefined
      }
      record_pay_statement_event: {
        Args: { p_event_type: string; p_statement_id: string }
        Returns: undefined
      }
      reject_settings_change_request: {
        Args: { _request_id: string; _review_note?: string }
        Returns: string
      }
      review_approval_request: {
        Args: { _decision: string; _request_id: string; _review_note?: string }
        Returns: string
      }
      save_assistant_shortcuts: {
        Args: { shortcut_ids: string[] }
        Returns: string[]
      }
      search_portfolio_posts: {
        Args: {
          p_category_keywords?: string[]
          p_exact_keyword?: string
          p_gallery_type?: string
          p_limit?: number
          p_offset?: number
          p_search_text?: string
        }
        Returns: {
          archived_at: string
          category: string
          client_name: string
          cover_image_id: string
          created_at: string
          created_by: string
          gallery_type: string
          id: string
          image_count: number
          keywords: string[]
          location: string
          materials: string[]
          memo: string
          processes: string[]
          project_year: number
          title: string
          total_count: number
          updated_at: string
          visibility: string
        }[]
      }
      update_calendar_event: { Args: { payload: Json }; Returns: string }
      upsert_employee_online_heartbeat: {
        Args: { _user_agent?: string; _work_status?: string }
        Returns: undefined
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
        | "bright-color"
        | "satin-mirror"
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
        "bright-color",
        "satin-mirror",
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
