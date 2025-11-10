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
          created_at: string | null
          department: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      saved_quotes: {
        Row: {
          attachments: Json | null
          created_at: string
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
          project_name: string | null
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
          project_name?: string | null
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
          project_name?: string | null
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
        Relationships: []
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
      app_role: "admin" | "user" | "moderator"
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
      app_role: ["admin", "user", "moderator"],
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
