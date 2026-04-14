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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          speed: number | null
          updated_at: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          speed?: number | null
          updated_at?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_zones: {
        Row: {
          created_at: string
          fixed_price: number | null
          id: string
          max_km: number | null
          min_km: number
          name: string
          per_km_price: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixed_price?: number | null
          id?: string
          max_km?: number | null
          min_km?: number
          name: string
          per_km_price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixed_price?: number | null
          id?: string
          max_km?: number | null
          min_km?: number
          name?: string
          per_km_price?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          avatar_url: string | null
          created_at: string
          default_pickup_address: string | null
          default_pickup_lat: number | null
          default_pickup_lng: number | null
          fiscal_address: string | null
          full_name: string
          iban: string | null
          id: string
          is_active: boolean | null
          nif: string | null
          phone: string | null
          privacy_accepted_at: string | null
          shop_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          default_pickup_address?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          fiscal_address?: string | null
          full_name: string
          iban?: string | null
          id?: string
          is_active?: boolean | null
          nif?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          shop_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          avatar_url?: string | null
          created_at?: string
          default_pickup_address?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          fiscal_address?: string | null
          full_name?: string
          iban?: string | null
          id?: string
          is_active?: boolean | null
          nif?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          shop_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stops: {
        Row: {
          client_name: string
          client_notes: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_address: string
          delivery_lat: number
          delivery_lng: number
          distance_km: number | null
          driver_id: string | null
          id: string
          order_code: string | null
          package_size: Database["public"]["Enums"]["package_size"] | null
          paid_by_client: boolean
          paid_by_client_at: string | null
          paid_to_driver: boolean
          paid_to_driver_at: string | null
          picked_at: string | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          price: number | null
          price_company: number | null
          price_driver: number | null
          proof_photo_url: string | null
          scheduled_pickup_at: string | null
          shop_id: string | null
          shop_name: string | null
          status: Database["public"]["Enums"]["stop_status"]
          updated_at: string
        }
        Insert: {
          client_name: string
          client_notes?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_address: string
          delivery_lat: number
          delivery_lng: number
          distance_km?: number | null
          driver_id?: string | null
          id?: string
          order_code?: string | null
          package_size?: Database["public"]["Enums"]["package_size"] | null
          paid_by_client?: boolean
          paid_by_client_at?: string | null
          paid_to_driver?: boolean
          paid_to_driver_at?: string | null
          picked_at?: string | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          price?: number | null
          price_company?: number | null
          price_driver?: number | null
          proof_photo_url?: string | null
          scheduled_pickup_at?: string | null
          shop_id?: string | null
          shop_name?: string | null
          status?: Database["public"]["Enums"]["stop_status"]
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_notes?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_address?: string
          delivery_lat?: number
          delivery_lng?: number
          distance_km?: number | null
          driver_id?: string | null
          id?: string
          order_code?: string | null
          package_size?: Database["public"]["Enums"]["package_size"] | null
          paid_by_client?: boolean
          paid_by_client_at?: string | null
          paid_to_driver?: boolean
          paid_to_driver_at?: string | null
          picked_at?: string | null
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          price?: number | null
          price_company?: number | null
          price_driver?: number | null
          proof_photo_url?: string | null
          scheduled_pickup_at?: string | null
          shop_id?: string | null
          shop_name?: string | null
          status?: Database["public"]["Enums"]["stop_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stops_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      cleanup_old_driver_locations: { Args: never; Returns: undefined }
      get_profile_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "shop"
      package_size: "small" | "medium" | "large"
      stop_status: "pending" | "picked" | "delivered" | "assigned"
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
      app_role: ["admin", "driver", "shop"],
      package_size: ["small", "medium", "large"],
      stop_status: ["pending", "picked", "delivered", "assigned"],
    },
  },
} as const
