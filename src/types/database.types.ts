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
      blog_posts: {
        Row: {
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          preview_token: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tag_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          preview_token?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tag_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          preview_token?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tag_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          form_type: string
          id: string
          message: string
          name: string
          read_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          form_type: string
          id?: string
          message: string
          name: string
          read_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          form_type?: string
          id?: string
          message?: string
          name?: string
          read_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      csp_reports: {
        Row: {
          blocked_uri: string | null
          client_ip: unknown
          column_number: number | null
          created_at: string
          disposition: string
          document_uri: string | null
          effective_directive: string | null
          id: string
          line_number: number | null
          raw: Json
          referrer: string | null
          sample: string | null
          source_file: string | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          blocked_uri?: string | null
          client_ip?: unknown
          column_number?: number | null
          created_at?: string
          disposition: string
          document_uri?: string | null
          effective_directive?: string | null
          id?: string
          line_number?: number | null
          raw: Json
          referrer?: string | null
          sample?: string | null
          source_file?: string | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          blocked_uri?: string | null
          client_ip?: unknown
          column_number?: number | null
          created_at?: string
          disposition?: string
          document_uri?: string | null
          effective_directive?: string | null
          id?: string
          line_number?: number | null
          raw?: Json
          referrer?: string | null
          sample?: string | null
          source_file?: string | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      custom_itinerary_requests: {
        Row: {
          auth_user_id: string | null
          consultation_notes: string | null
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          delivered_at: string | null
          delivery_email_message_id: string | null
          delivery_email_sent_at: string | null
          email_resend_counts: Json
          final_pdf_uploaded_at: string | null
          final_pdf_url: string | null
          form_data: Json
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          consultation_notes?: string | null
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          delivered_at?: string | null
          delivery_email_message_id?: string | null
          delivery_email_sent_at?: string | null
          email_resend_counts?: Json
          final_pdf_uploaded_at?: string | null
          final_pdf_url?: string | null
          form_data: Json
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          consultation_notes?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          delivered_at?: string | null
          delivery_email_message_id?: string | null
          delivery_email_sent_at?: string | null
          email_resend_counts?: Json
          final_pdf_uploaded_at?: string | null
          final_pdf_url?: string | null
          form_data?: Json
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_itinerary_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          ecomail_subscriber_id: string | null
          email: string
          id: string
          last_purchase_at: string | null
          name: string
          phone: string | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ecomail_subscriber_id?: string | null
          email: string
          id: string
          last_purchase_at?: string | null
          name: string
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ecomail_subscriber_id?: string | null
          email?: string
          id?: string
          last_purchase_at?: string | null
          name?: string
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      download_tokens: {
        Row: {
          asset_type: string
          created_at: string
          custom_itinerary_request_id: string | null
          download_count: number
          expires_at: string | null
          id: string
          last_downloaded_at: string | null
          order_id: string | null
          token: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          custom_itinerary_request_id?: string | null
          download_count?: number
          expires_at?: string | null
          id?: string
          last_downloaded_at?: string | null
          order_id?: string | null
          token: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          custom_itinerary_request_id?: string | null
          download_count?: number
          expires_at?: string | null
          id?: string
          last_downloaded_at?: string | null
          order_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_tokens_custom_itinerary_request_id_fkey"
            columns: ["custom_itinerary_request_id"]
            isOneToOne: false
            referencedRelation: "custom_itinerary_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          email_to: string
          event_type: string
          id: string
          payload: Json
          resend_email_id: string
        }
        Insert: {
          created_at?: string
          email_to: string
          event_type: string
          id?: string
          payload: Json
          resend_email_id: string
        }
        Update: {
          created_at?: string
          email_to?: string
          event_type?: string
          id?: string
          payload?: Json
          resend_email_id?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          notes: string | null
          reason: string
          source_event_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          notes?: string | null
          reason: string
          source_event_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          notes?: string | null
          reason?: string
          source_event_id?: string | null
        }
        Relationships: []
      }
      fakturoid_tokens: {
        Row: {
          access_token: string
          expires_at: string
          id: boolean
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at: string
          id?: boolean
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          service: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          service: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          service?: string
          status?: string
        }
        Relationships: []
      }
      newsletter_consent_log: {
        Row: {
          consent_given: boolean
          created_at: string
          email: string
          id: string
          ip_address: unknown
          privacy_policy_version: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          consent_given: boolean
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          privacy_policy_version?: string | null
          source: string
          user_agent?: string | null
        }
        Update: {
          consent_given?: boolean
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          privacy_policy_version?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      newsletter_consent_logs: {
        Row: {
          consent_given: boolean
          created_at: string
          email: string
          id: string
          ip_address: unknown
          privacy_policy_version: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          consent_given: boolean
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown
          privacy_policy_version?: string | null
          source: string
          user_agent?: string | null
        }
        Update: {
          consent_given?: boolean
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          privacy_policy_version?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          custom_itinerary_request_id: string | null
          id: string
          order_id: string
          price_at_purchase: number
          product_id: string
          quantity: number
          vat_rate_at_purchase: number
        }
        Insert: {
          created_at?: string
          custom_itinerary_request_id?: string | null
          id?: string
          order_id: string
          price_at_purchase: number
          product_id: string
          quantity?: number
          vat_rate_at_purchase: number
        }
        Update: {
          created_at?: string
          custom_itinerary_request_id?: string | null
          id?: string
          order_id?: string
          price_at_purchase?: number
          product_id?: string
          quantity?: number
          vat_rate_at_purchase?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_custom_itinerary_request_id_fkey"
            columns: ["custom_itinerary_request_id"]
            isOneToOne: false
            referencedRelation: "custom_itinerary_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auth_user_id: string | null
          billing_city: string | null
          billing_street: string | null
          billing_zip: string | null
          company_dic: string | null
          company_ico: string | null
          company_name: string | null
          confirmation_email_message_id: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string | null
          ecomail_synced: boolean
          email_resend_counts: Json
          fakturoid_invoice_id: string | null
          fakturoid_invoice_number: string | null
          fakturoid_invoice_url: string | null
          fakturoid_storno_id: string | null
          fakturoid_storno_number: string | null
          id: string
          invoice_error: string | null
          invoice_sent: boolean
          invoice_sent_at: string | null
          is_company: boolean
          refund_email_message_id: string | null
          refund_email_sent_at: string | null
          status: string
          stripe_payment_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          billing_city?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company_dic?: string | null
          company_ico?: string | null
          company_name?: string | null
          confirmation_email_message_id?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name?: string | null
          ecomail_synced?: boolean
          email_resend_counts?: Json
          fakturoid_invoice_id?: string | null
          fakturoid_invoice_number?: string | null
          fakturoid_invoice_url?: string | null
          fakturoid_storno_id?: string | null
          fakturoid_storno_number?: string | null
          id?: string
          invoice_error?: string | null
          invoice_sent?: boolean
          invoice_sent_at?: string | null
          is_company?: boolean
          refund_email_message_id?: string | null
          refund_email_sent_at?: string | null
          status?: string
          stripe_payment_id?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          billing_city?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company_dic?: string | null
          company_ico?: string | null
          company_name?: string | null
          confirmation_email_message_id?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string | null
          ecomail_synced?: boolean
          email_resend_counts?: Json
          fakturoid_invoice_id?: string | null
          fakturoid_invoice_number?: string | null
          fakturoid_invoice_url?: string | null
          fakturoid_storno_id?: string | null
          fakturoid_storno_number?: string | null
          id?: string
          invoice_error?: string | null
          invoice_sent?: boolean
          invoice_sent_at?: string | null
          is_company?: boolean
          refund_email_message_id?: string | null
          refund_email_sent_at?: string | null
          status?: string
          stripe_payment_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          autumn_description: string | null
          average_rating: number | null
          badge: string | null
          budget_level: number | null
          category_ids: string[] | null
          created_at: string
          deleted_at: string | null
          description: string
          detail_title: string | null
          duration: string | null
          gallery_images: Json | null
          hero_line_1: string | null
          hero_line_2: string | null
          hero_line_3: string | null
          hero_line_4: string | null
          hero_subtitle: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_deleted: boolean
          pdf_url: string | null
          price: number
          quiz_data: Json | null
          review_count: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          spring_description: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          stripe_sync_error: string | null
          summer_description: string | null
          title: string
          total_sales: number
          updated_at: string
          vat_rate: number | null
          winter_description: string | null
        }
        Insert: {
          autumn_description?: string | null
          average_rating?: number | null
          badge?: string | null
          budget_level?: number | null
          category_ids?: string[] | null
          created_at?: string
          deleted_at?: string | null
          description: string
          detail_title?: string | null
          duration?: string | null
          gallery_images?: Json | null
          hero_line_1?: string | null
          hero_line_2?: string | null
          hero_line_3?: string | null
          hero_line_4?: string | null
          hero_subtitle?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_deleted?: boolean
          pdf_url?: string | null
          price: number
          quiz_data?: Json | null
          review_count?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          spring_description?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_sync_error?: string | null
          summer_description?: string | null
          title: string
          total_sales?: number
          updated_at?: string
          vat_rate?: number | null
          winter_description?: string | null
        }
        Update: {
          autumn_description?: string | null
          average_rating?: number | null
          badge?: string | null
          budget_level?: number | null
          category_ids?: string[] | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          detail_title?: string | null
          duration?: string | null
          gallery_images?: Json | null
          hero_line_1?: string | null
          hero_line_2?: string | null
          hero_line_3?: string | null
          hero_line_4?: string | null
          hero_subtitle?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_deleted?: boolean
          pdf_url?: string | null
          price?: number
          quiz_data?: Json | null
          review_count?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          spring_description?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_sync_error?: string | null
          summer_description?: string | null
          title?: string
          total_sales?: number
          updated_at?: string
          vat_rate?: number | null
          winter_description?: string | null
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          bucket: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      review_admin_notes: {
        Row: {
          notes: string
          review_id: string
          updated_at: string
        }
        Insert: {
          notes: string
          review_id: string
          updated_at?: string
        }
        Update: {
          notes?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_admin_notes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invitation_email_id: string | null
          order_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          invitation_email_id?: string | null
          order_id: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invitation_email_id?: string | null
          order_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string
          rating: number
          review_text: string
          reviewer_name: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          rating: number
          review_text: string
          reviewer_name: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          rating?: number
          review_text?: string
          reviewer_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      cleanup_orphaned_anon_users: {
        Args: { retention_days?: number }
        Returns: number
      }
      create_order_with_items: { Args: { p_payload: Json }; Returns: Json }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      increment_download_count: {
        Args: { token_id: string }
        Returns: undefined
      }
      increment_email_resend_count: {
        Args: { key: string; row_id: string; table_name: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_permanent_user: { Args: never; Returns: boolean }
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
    Enums: {},
  },
} as const
