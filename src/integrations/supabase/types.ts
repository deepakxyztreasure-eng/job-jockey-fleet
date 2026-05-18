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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      driver_checklist_logs: {
        Row: {
          checklist_completed: boolean
          date: string
          driver_id: string
          id: string
          submitted_at: string
        }
        Insert: {
          checklist_completed?: boolean
          date?: string
          driver_id: string
          id?: string
          submitted_at?: string
        }
        Update: {
          checklist_completed?: boolean
          date?: string
          driver_id?: string
          id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_checklist_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          driver_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
        }
        Insert: {
          driver_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
        }
        Update: {
          driver_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          license_number: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
          vehicle: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          license_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          license_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
        }
        Relationships: []
      }
      job_titles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          assigned_driver_id: string | null
          cod: boolean
          completion_notes: string | null
          completion_requested_at: string | null
          created_at: string
          created_by: string | null
          customer_mobile: string | null
          customer_name: string | null
          delivery_address: string | null
          delivery_location_id: string | null
          description: string | null
          end_time: string | null
          id: string
          instructions: string | null
          invoice_number: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          pending_edit: Json | null
          pending_edit_at: string | null
          pending_edit_by: string | null
          pickup_address: string | null
          pickup_location_id: string | null
          price: number | null
          priority: Database["public"]["Enums"]["job_priority"]
          proof_image_url: string | null
          quantity: number | null
          quantity_unit: string | null
          rejection_reason: string | null
          scheduled_date: string | null
          show_price: boolean
          start_time: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          assigned_driver_id?: string | null
          cod?: boolean
          completion_notes?: string | null
          completion_requested_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_location_id?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          instructions?: string | null
          invoice_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pending_edit?: Json | null
          pending_edit_at?: string | null
          pending_edit_by?: string | null
          pickup_address?: string | null
          pickup_location_id?: string | null
          price?: number | null
          priority?: Database["public"]["Enums"]["job_priority"]
          proof_image_url?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          show_price?: boolean
          start_time?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          assigned_driver_id?: string | null
          cod?: boolean
          completion_notes?: string | null
          completion_requested_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_location_id?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          instructions?: string | null
          invoice_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pending_edit?: Json | null
          pending_edit_at?: string | null
          pending_edit_by?: string | null
          pickup_address?: string | null
          pickup_location_id?: string | null
          price?: number | null
          priority?: Database["public"]["Enums"]["job_priority"]
          proof_image_url?: string | null
          quantity?: number | null
          quantity_unit?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          show_price?: boolean
          start_time?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_delivery_location_id_fkey"
            columns: ["delivery_location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_submissions: {
        Row: {
          business_type: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
        }
        Insert: {
          business_type?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          business_type?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          job_id: string | null
          read: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          read?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          read?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_locations: {
        Row: {
          active: boolean
          address: string
          city: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          city?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "member" | "driver"
      job_priority: "standard" | "priority"
      job_status:
        | "pending"
        | "assigned"
        | "accepted"
        | "in_progress"
        | "completed"
        | "payment_pending"
        | "closed"
        | "completion_requested"
        | "rejected"
        | "issue"
      payment_status: "pending" | "partial" | "paid"
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
      app_role: ["super_admin", "member", "driver"],
      job_priority: ["standard", "priority"],
      job_status: [
        "pending",
        "assigned",
        "accepted",
        "in_progress",
        "completed",
        "payment_pending",
        "closed",
        "completion_requested",
        "rejected",
        "issue",
      ],
      payment_status: ["pending", "partial", "paid"],
    },
  },
} as const
