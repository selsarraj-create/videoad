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
      affiliate_items: {
        Row: {
          affiliate_url: string | null
          category: string
          created_at: string | null
          id: string
          image_url: string | null
          price: number | null
          title: string
        }
        Insert: {
          affiliate_url?: string | null
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          title: string
        }
        Update: {
          affiliate_url?: string | null
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          price?: number | null
          title?: string
        }
        Relationships: []
      }
      asset_library: {
        Row: {
          brand: string | null
          category: string | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          iptc_tagged: boolean | null
          is_trending: boolean | null
          last_trend_refresh: string | null
          merchant_link: string
          merchant_name: string | null
          merchant_offer_id: string
          original_image_url: string
          price: string | null
          product_url_hash: string | null
          synthid_applied: boolean | null
          tags: string[] | null
          title: string
          trend_keyword: string | null
          universal_vto_url: string | null
          universal_vto_urls: string[] | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          iptc_tagged?: boolean | null
          is_trending?: boolean | null
          last_trend_refresh?: string | null
          merchant_link: string
          merchant_name?: string | null
          merchant_offer_id: string
          original_image_url: string
          price?: string | null
          product_url_hash?: string | null
          synthid_applied?: boolean | null
          tags?: string[] | null
          title: string
          trend_keyword?: string | null
          universal_vto_url?: string | null
          universal_vto_urls?: string[] | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          iptc_tagged?: boolean | null
          is_trending?: boolean | null
          last_trend_refresh?: string | null
          merchant_link?: string
          merchant_name?: string | null
          merchant_offer_id?: string
          original_image_url?: string
          price?: string | null
          product_url_hash?: string | null
          synthid_applied?: boolean | null
          tags?: string[] | null
          title?: string
          trend_keyword?: string | null
          universal_vto_url?: string | null
          universal_vto_urls?: string[] | null
        }
        Relationships: []
      }
      click_events: {
        Row: {
          clicked_at: string | null
          commission_amount: number | null
          converted: boolean | null
          created_at: string | null
          id: string
          platform_fee_saved: number | null
          post_id: string | null
          rakuten_link: string | null
          referrer: string | null
          sub_id: string
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          commission_amount?: number | null
          converted?: boolean | null
          created_at?: string | null
          id?: string
          platform_fee_saved?: number | null
          post_id?: string | null
          rakuten_link?: string | null
          referrer?: string | null
          sub_id: string
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          commission_amount?: number | null
          converted?: boolean | null
          created_at?: string | null
          id?: string
          platform_fee_saved?: number | null
          post_id?: string | null
          rakuten_link?: string | null
          referrer?: string | null
          sub_id?: string
          user_id?: string
        }
        Relationships: []
      }
      clothes: {
        Row: {
          build_status: Database["public"]["Enums"]["build_status"] | null
          category: string | null
          created_at: string | null
          error_message: string | null
          glb_url: string | null
          id: string
          name: string
          processed_3d_url: string | null
          raw_image_url: string
          updated_at: string | null
        }
        Insert: {
          build_status?: Database["public"]["Enums"]["build_status"] | null
          category?: string | null
          created_at?: string | null
          error_message?: string | null
          glb_url?: string | null
          id?: string
          name: string
          processed_3d_url?: string | null
          raw_image_url: string
          updated_at?: string | null
        }
        Update: {
          build_status?: Database["public"]["Enums"]["build_status"] | null
          category?: string | null
          created_at?: string | null
          error_message?: string | null
          glb_url?: string | null
          id?: string
          name?: string
          processed_3d_url?: string | null
          raw_image_url?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          created_at: string | null
          id: string
          source: string
          status: string | null
          total_amount: number
          transaction_id: string
          user_amount: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          source: string
          status?: string | null
          total_amount: number
          transaction_id: string
          user_amount: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          source?: string
          status?: string | null
          total_amount?: number
          transaction_id?: string
          user_amount?: number
          user_id?: string | null
        }
        Relationships: []
      }
      content_links: {
        Row: {
          affiliate_url: string | null
          created_at: string
          id: string
          job_id: string
          look_id: string | null
          outfit_cost: number | null
          title: string | null
          user_id: string
        }
        Insert: {
          affiliate_url?: string | null
          created_at?: string
          id?: string
          job_id: string
          look_id?: string | null
          outfit_cost?: number | null
          title?: string | null
          user_id: string
        }
        Update: {
          affiliate_url?: string | null
          created_at?: string
          id?: string
          job_id?: string
          look_id?: string | null
          outfit_cost?: number | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_links_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_links_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "current_looks"
            referencedColumns: ["id"]
          },
        ]
      }
      content_violations: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          job_id: string | null
          source_api: string
          user_id: string
          violation_type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          job_id?: string | null
          source_api?: string
          user_id: string
          violation_type?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          job_id?: string | null
          source_api?: string
          user_id?: string
          violation_type?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          engine_id: string | null
          id: string
          job_id: string | null
          metadata: Json | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          engine_id?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          engine_id?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      current_looks: {
        Row: {
          claid_result_url: string | null
          created_at: string | null
          garments: Json | null
          id: string
          identity_id: string | null
          name: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          claid_result_url?: string | null
          created_at?: string | null
          garments?: Json | null
          id?: string
          identity_id?: string | null
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          claid_result_url?: string | null
          created_at?: string | null
          garments?: Json | null
          id?: string
          identity_id?: string | null
          name?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "current_looks_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_log: {
        Row: {
          content: string | null
          created_at: string | null
          delivery_status: string | null
          disclosure_included: boolean | null
          error_message: string | null
          id: string
          ig_media_id: string | null
          ig_recipient_id: string
          ig_recipient_username: string | null
          message_type: string
          rakuten_link: string | null
          sent_at: string | null
          sub_id: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivery_status?: string | null
          disclosure_included?: boolean | null
          error_message?: string | null
          id?: string
          ig_media_id?: string | null
          ig_recipient_id: string
          ig_recipient_username?: string | null
          message_type?: string
          rakuten_link?: string | null
          sent_at?: string | null
          sub_id?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivery_status?: string | null
          disclosure_included?: boolean | null
          error_message?: string | null
          id?: string
          ig_media_id?: string | null
          ig_recipient_id?: string
          ig_recipient_username?: string | null
          message_type?: string
          rakuten_link?: string | null
          sent_at?: string | null
          sub_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dm_rate_limits: {
        Row: {
          ig_account_id: string
          message_count: number
          window_start: string
        }
        Insert: {
          ig_account_id: string
          message_count?: number
          window_start?: string
        }
        Update: {
          ig_account_id?: string
          message_count?: number
          window_start?: string
        }
        Relationships: []
      }
      garment_cache: {
        Row: {
          clean_url: string
          created_at: string | null
          id: string
          source_url: string
          source_url_hash: string
        }
        Insert: {
          clean_url: string
          created_at?: string | null
          id?: string
          source_url: string
          source_url_hash: string
        }
        Update: {
          clean_url?: string
          created_at?: string | null
          id?: string
          source_url?: string
          source_url_hash?: string
        }
        Relationships: []
      }
      identities: {
        Row: {
          created_at: string | null
          id: string
          master_identity_url: string | null
          onboarding_mode: string | null
          raw_selfie_url: string
          status: string
          user_id: string | null
          validation_result: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          master_identity_url?: string | null
          onboarding_mode?: string | null
          raw_selfie_url: string
          status?: string
          user_id?: string | null
          validation_result?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          master_identity_url?: string | null
          onboarding_mode?: string | null
          raw_selfie_url?: string
          status?: string
          user_id?: string | null
          validation_result?: Json | null
        }
        Relationships: []
      }
      identity_masters: {
        Row: {
          created_at: string | null
          id: string
          identity_image_url: string
          is_default: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          identity_image_url: string
          is_default?: boolean
          name?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          identity_image_url?: string
          is_default?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      identity_views: {
        Row: {
          angle: string
          created_at: string | null
          id: string
          identity_id: string | null
          image_url: string
          master_url: string | null
          source: string | null
          status: string | null
          validation_result: Json | null
        }
        Insert: {
          angle: string
          created_at?: string | null
          id?: string
          identity_id?: string | null
          image_url: string
          master_url?: string | null
          source?: string | null
          status?: string | null
          validation_result?: Json | null
        }
        Update: {
          angle?: string
          created_at?: string | null
          id?: string
          identity_id?: string | null
          image_url?: string
          master_url?: string | null
          source?: string | null
          status?: string | null
          validation_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_views_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connections: {
        Row: {
          access_token: string
          account_type: string | null
          created_at: string | null
          id: string
          ig_profile_picture_url: string | null
          ig_user_id: string
          ig_username: string | null
          is_active: boolean | null
          page_id: string
          page_name: string | null
          scopes: string[] | null
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_type?: string | null
          created_at?: string | null
          id?: string
          ig_profile_picture_url?: string | null
          ig_user_id: string
          ig_username?: string | null
          is_active?: boolean | null
          page_id: string
          page_name?: string | null
          scopes?: string[] | null
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_type?: string | null
          created_at?: string | null
          id?: string
          ig_profile_picture_url?: string | null
          ig_user_id?: string
          ig_username?: string | null
          is_active?: boolean | null
          page_id?: string
          page_name?: string | null
          scopes?: string[] | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          camera_metadata: Json | null
          created_at: string
          error_message: string | null
          id: string
          input_params: Json
          model: string | null
          motion_reference_url: string | null
          output_url: string | null
          project_id: string
          provider_metadata: Json | null
          provider_task_id: string | null
          status: string | null
          tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          camera_metadata?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_params?: Json
          model?: string | null
          motion_reference_url?: string | null
          output_url?: string | null
          project_id: string
          provider_metadata?: Json | null
          provider_task_id?: string | null
          status?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          camera_metadata?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_params?: Json
          model?: string | null
          motion_reference_url?: string | null
          output_url?: string | null
          project_id?: string
          provider_metadata?: Json | null
          provider_task_id?: string | null
          status?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          created_at: string
          garment_image_url: string | null
          id: string
          image_url: string
          job_id: string | null
          label: string | null
          person_image_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          garment_image_url?: string | null
          id?: string
          image_url: string
          job_id?: string | null
          label?: string | null
          person_image_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          garment_image_url?: string | null
          id?: string
          image_url?: string
          job_id?: string | null
          label?: string | null
          person_image_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      post_affiliate_links: {
        Row: {
          created_at: string | null
          id: string
          ig_media_id: string
          ig_media_thumbnail: string | null
          ig_media_url: string | null
          is_active: boolean | null
          product_brand: string | null
          product_name: string | null
          product_price: number | null
          rakuten_link: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ig_media_id: string
          ig_media_thumbnail?: string | null
          ig_media_url?: string | null
          is_active?: boolean | null
          product_brand?: string | null
          product_name?: string | null
          product_price?: number | null
          rakuten_link: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ig_media_id?: string
          ig_media_thumbnail?: string | null
          ig_media_url?: string | null
          is_active?: boolean | null
          product_brand?: string | null
          product_name?: string | null
          product_price?: number | null
          rakuten_link?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          cooldown_until: string | null
          created_at: string | null
          credit_balance: number | null
          full_name: string | null
          id: string
          monthly_credit_grant: number | null
          render_credits: number | null
          render_priority: number | null
          stripe_account_id: string | null
          subscription_status: string | null
          suspension_reason: string | null
          trial_ends_at: string | null
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          cooldown_until?: string | null
          created_at?: string | null
          credit_balance?: number | null
          full_name?: string | null
          id: string
          monthly_credit_grant?: number | null
          render_credits?: number | null
          render_priority?: number | null
          stripe_account_id?: string | null
          subscription_status?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          cooldown_until?: string | null
          created_at?: string | null
          credit_balance?: number | null
          full_name?: string | null
          id?: string
          monthly_credit_grant?: number | null
          render_credits?: number | null
          render_priority?: number | null
          stripe_account_id?: string | null
          subscription_status?: string | null
          suspension_reason?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          data: Json | null
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      public_showcase: {
        Row: {
          ai_labeled: boolean | null
          allow_remix: boolean | null
          created_at: string | null
          garment_metadata: Json
          hearts: number | null
          id: string
          original_creator_id: string | null
          original_showcase_id: string | null
          persona_id: string | null
          user_id: string | null
          video_url: string
        }
        Insert: {
          ai_labeled?: boolean | null
          allow_remix?: boolean | null
          created_at?: string | null
          garment_metadata?: Json
          hearts?: number | null
          id?: string
          original_creator_id?: string | null
          original_showcase_id?: string | null
          persona_id?: string | null
          user_id?: string | null
          video_url: string
        }
        Update: {
          ai_labeled?: boolean | null
          allow_remix?: boolean | null
          created_at?: string | null
          garment_metadata?: Json
          hearts?: number | null
          id?: string
          original_creator_id?: string | null
          original_showcase_id?: string | null
          persona_id?: string | null
          user_id?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_showcase_original_showcase_id_fkey"
            columns: ["original_showcase_id"]
            isOneToOne: false
            referencedRelation: "public_showcase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_showcase_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_ledger: {
        Row: {
          cleared_at: string | null
          created_at: string | null
          currency: string | null
          ebay_transaction_id: string | null
          id: string
          item_name: string
          metadata: Json | null
          paid_at: string | null
          platform_fee: number
          raw_commission: number
          skimlinks_transaction_id: string | null
          status: string
          total_sale_amount: number
          user_id: string
          user_share: number
        }
        Insert: {
          cleared_at?: string | null
          created_at?: string | null
          currency?: string | null
          ebay_transaction_id?: string | null
          id?: string
          item_name: string
          metadata?: Json | null
          paid_at?: string | null
          platform_fee: number
          raw_commission: number
          skimlinks_transaction_id?: string | null
          status?: string
          total_sale_amount: number
          user_id: string
          user_share: number
        }
        Update: {
          cleared_at?: string | null
          created_at?: string | null
          currency?: string | null
          ebay_transaction_id?: string | null
          id?: string
          item_name?: string
          metadata?: Json | null
          paid_at?: string | null
          platform_fee?: number
          raw_commission?: number
          skimlinks_transaction_id?: string | null
          status?: string
          total_sale_amount?: number
          user_id?: string
          user_share?: number
        }
        Relationships: []
      }
      trends: {
        Row: {
          created_at: string | null
          discovery_log: Json | null
          growth_score: number | null
          id: string
          look_of_the_day_date: string | null
          retail_item: Json
          vibe_category: string
          vintage_accessory: Json
        }
        Insert: {
          created_at?: string | null
          discovery_log?: Json | null
          growth_score?: number | null
          id?: string
          look_of_the_day_date?: string | null
          retail_item: Json
          vibe_category: string
          vintage_accessory: Json
        }
        Update: {
          created_at?: string | null
          discovery_log?: Json | null
          growth_score?: number | null
          id?: string
          look_of_the_day_date?: string | null
          retail_item?: Json
          vibe_category?: string
          vintage_accessory?: Json
        }
        Relationships: []
      }
      wardrobe: {
        Row: {
          affiliate_url: string | null
          clean_image_url: string | null
          created_at: string | null
          id: string
          original_image_url: string
          source: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          affiliate_url?: string | null
          clean_image_url?: string | null
          created_at?: string | null
          id?: string
          original_image_url: string
          source?: string
          status?: string
          title?: string
          user_id: string
        }
        Update: {
          affiliate_url?: string | null
          clean_image_url?: string | null
          created_at?: string | null
          id?: string
          original_image_url?: string
          source?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      build_status: "pending" | "processing" | "ready" | "failed"
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
      build_status: ["pending", "processing", "ready", "failed"],
    },
  },
} as const
