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
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_secret: boolean
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key: string
          label?: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          code: string
          code_erp: string | null
          created_at: string
          description: string | null
          designation: string
          family_id: string | null
          fournisseur: string | null
          id: string
          is_active: boolean
          prix_unitaire: number | null
          search_vector: unknown
          stock_actuel: number
          stock_min: number
          unite: string
          updated_at: string
        }
        Insert: {
          code: string
          code_erp?: string | null
          created_at?: string
          description?: string | null
          designation: string
          family_id?: string | null
          fournisseur?: string | null
          id?: string
          is_active?: boolean
          prix_unitaire?: number | null
          search_vector?: unknown
          stock_actuel?: number
          stock_min?: number
          unite?: string
          updated_at?: string
        }
        Update: {
          code?: string
          code_erp?: string | null
          created_at?: string
          description?: string | null
          designation?: string
          family_id?: string | null
          fournisseur?: string | null
          id?: string
          is_active?: boolean
          prix_unitaire?: number | null
          search_vector?: unknown
          stock_actuel?: number
          stock_min?: number
          unite?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          action_label: string | null
          action_type: string | null
          archived_at: string | null
          changed_fields: Json | null
          created_at: string
          description: string | null
          entity_code: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          search_vector: unknown
          severity: string
          source: string
          status: string
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_full_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          action_label?: string | null
          action_type?: string | null
          archived_at?: string | null
          changed_fields?: Json | null
          created_at?: string
          description?: string | null
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          search_vector?: unknown
          severity?: string
          source?: string
          status?: string
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_full_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          action_label?: string | null
          action_type?: string | null
          archived_at?: string | null
          changed_fields?: Json | null
          created_at?: string
          description?: string | null
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          search_vector?: unknown
          severity?: string
          source?: string
          status?: string
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_full_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_role_settings: {
        Row: {
          audit_enabled: boolean
          created_at: string
          id: string
          module: string
          role: string
          severity_threshold: string
          updated_at: string
        }
        Insert: {
          audit_enabled?: boolean
          created_at?: string
          id?: string
          module: string
          role: string
          severity_threshold?: string
          updated_at?: string
        }
        Update: {
          audit_enabled?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: string
          severity_threshold?: string
          updated_at?: string
        }
        Relationships: []
      }
      bill_of_materials: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          product_id: string
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          product_id: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          product_id?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          article_id: string
          bom_id: string
          created_at: string
          id: string
          is_mandatory: boolean
          is_quality_sensitive: boolean
          item_type: string
          notes: string | null
          quantity_per_unit: number
          unit: string
          updated_at: string
          waste_percent: number | null
        }
        Insert: {
          article_id: string
          bom_id: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          is_quality_sensitive?: boolean
          item_type: string
          notes?: string | null
          quantity_per_unit?: number
          unit?: string
          updated_at?: string
          waste_percent?: number | null
        }
        Update: {
          article_id?: string
          bom_id?: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          is_quality_sensitive?: boolean
          item_type?: string
          notes?: string | null
          quantity_per_unit?: number
          unit?: string
          updated_at?: string
          waste_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      consumptions: {
        Row: {
          article_id: string
          batch_number: string | null
          created_at: string
          declared_by: string | null
          erp_ref: string | null
          erp_synced_at: string | null
          expiry_date: string | null
          id: string
          lot_number: string | null
          notes: string | null
          of_id: string
          quantite: number
          search_vector: unknown
          shift_id: string | null
          supplier_lot: string | null
          unite: string
          validation_request_id: string | null
          validation_status: string | null
        }
        Insert: {
          article_id: string
          batch_number?: string | null
          created_at?: string
          declared_by?: string | null
          erp_ref?: string | null
          erp_synced_at?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          of_id: string
          quantite?: number
          search_vector?: unknown
          shift_id?: string | null
          supplier_lot?: string | null
          unite?: string
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Update: {
          article_id?: string
          batch_number?: string | null
          created_at?: string
          declared_by?: string | null
          erp_ref?: string | null
          erp_synced_at?: string | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          of_id?: string
          quantite?: number
          search_vector?: unknown
          shift_id?: string | null
          supplier_lot?: string | null
          unite?: string
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumptions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumptions_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumptions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          code: string
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          inherits_from: Database["public"]["Enums"]["app_role"] | null
          is_active: boolean
          label: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inherits_from?: Database["public"]["Enums"]["app_role"] | null
          is_active?: boolean
          label: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inherits_from?: Database["public"]["Enums"]["app_role"] | null
          is_active?: boolean
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      direction_dashboard_shares: {
        Row: {
          created_at: string
          created_by: string | null
          dashboard_id: string
          id: string
          shared_role: Database["public"]["Enums"]["app_role"] | null
          shared_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dashboard_id: string
          id?: string
          shared_role?: Database["public"]["Enums"]["app_role"] | null
          shared_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dashboard_id?: string
          id?: string
          shared_role?: Database["public"]["Enums"]["app_role"] | null
          shared_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direction_dashboard_shares_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "direction_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      direction_dashboard_versions: {
        Row: {
          created_at: string
          created_by: string
          dashboard_id: string
          global_filters: Json
          id: string
          layout: Json
          name: string
          theme: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          dashboard_id: string
          global_filters?: Json
          id?: string
          layout?: Json
          name: string
          theme?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          dashboard_id?: string
          global_filters?: Json
          id?: string
          layout?: Json
          name?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direction_dashboard_versions_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "direction_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      direction_dashboards: {
        Row: {
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          created_at: string
          description: string | null
          global_filters: Json
          id: string
          layout: Json
          name: string
          owner_id: string
          refresh_seconds: number
          theme: Json
          updated_at: string
          visibility: string
        }
        Insert: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          description?: string | null
          global_filters?: Json
          id?: string
          layout?: Json
          name: string
          owner_id?: string
          refresh_seconds?: number
          theme?: Json
          updated_at?: string
          visibility?: string
        }
        Update: {
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          description?: string | null
          global_filters?: Json
          id?: string
          layout?: Json
          name?: string
          owner_id?: string
          refresh_seconds?: number
          theme?: Json
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      document_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          document_id: string | null
          document_name: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          document_id?: string | null
          document_name?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          document_id?: string | null
          document_name?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_audit_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "entity_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_permissions: {
        Row: {
          can_delete: boolean
          can_download: boolean
          can_edit_metadata: boolean
          can_upload: boolean
          can_view: boolean
          created_at: string
          entity_type: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          can_delete?: boolean
          can_download?: boolean
          can_edit_metadata?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          entity_type: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          can_delete?: boolean
          can_download?: boolean
          can_edit_metadata?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          entity_type?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body: string | null
          cc: string[]
          created_at: string
          error_message: string | null
          from_email: string | null
          id: string
          is_html: boolean
          sent_at: string | null
          sent_to: string[]
          status: string
          subject: string
          template_id: string | null
          template_name: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          cc?: string[]
          created_at?: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          is_html?: boolean
          sent_at?: string | null
          sent_to?: string[]
          status?: string
          subject: string
          template_id?: string | null
          template_name?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          cc?: string[]
          created_at?: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          is_html?: boolean
          sent_at?: string | null
          sent_to?: string[]
          status?: string
          subject?: string
          template_id?: string | null
          template_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          default_recipients: string | null
          description: string | null
          id: string
          is_active: boolean
          is_html: boolean
          name: string
          subject: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          default_recipients?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_html?: boolean
          name: string
          subject: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          default_recipients?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_html?: boolean
          name?: string
          subject?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      entity_documents: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number
          file_type: string | null
          file_url: string
          id: string
          search_vector: unknown
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          file_name?: string
          file_size?: number
          file_type?: string | null
          file_url: string
          id?: string
          search_vector?: unknown
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number
          file_type?: string | null
          file_url?: string
          id?: string
          search_vector?: unknown
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_images: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number
          id: string
          image_url: string
          is_primary: boolean
          sort_order: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name?: string
          file_size?: number
          id?: string
          image_url: string
          is_primary?: boolean
          sort_order?: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number
          id?: string
          image_url?: string
          is_primary?: boolean
          sort_order?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      equipements: {
        Row: {
          code: string
          code_erp: string | null
          created_at: string
          criticite: Database["public"]["Enums"]["criticite"]
          criticite_maintenance:
            | Database["public"]["Enums"]["criticite_maintenance"]
            | null
          date_mise_en_service: string | null
          description: string | null
          designation: string
          family_id: string | null
          id: string
          is_active: boolean
          line_id: string | null
          localisation: string | null
          machine_id: string | null
          marque: string | null
          modele: string | null
          numero_serie: string | null
          qr_code: string | null
          role_fonctionnel:
            | Database["public"]["Enums"]["role_fonctionnel"]
            | null
          search_vector: unknown
          statut: Database["public"]["Enums"]["equipement_statut"]
          type: Database["public"]["Enums"]["equipement_type"]
          updated_at: string
        }
        Insert: {
          code: string
          code_erp?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"]
          criticite_maintenance?:
            | Database["public"]["Enums"]["criticite_maintenance"]
            | null
          date_mise_en_service?: string | null
          description?: string | null
          designation: string
          family_id?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          localisation?: string | null
          machine_id?: string | null
          marque?: string | null
          modele?: string | null
          numero_serie?: string | null
          qr_code?: string | null
          role_fonctionnel?:
            | Database["public"]["Enums"]["role_fonctionnel"]
            | null
          search_vector?: unknown
          statut?: Database["public"]["Enums"]["equipement_statut"]
          type?: Database["public"]["Enums"]["equipement_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          code_erp?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"]
          criticite_maintenance?:
            | Database["public"]["Enums"]["criticite_maintenance"]
            | null
          date_mise_en_service?: string | null
          description?: string | null
          designation?: string
          family_id?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          localisation?: string | null
          machine_id?: string | null
          marque?: string | null
          modele?: string | null
          numero_serie?: string | null
          qr_code?: string | null
          role_fonctionnel?:
            | Database["public"]["Enums"]["role_fonctionnel"]
            | null
          search_vector?: unknown
          statut?: Database["public"]["Enums"]["equipement_statut"]
          type?: Database["public"]["Enums"]["equipement_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipements_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "machine_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sync_logs: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          direction: string
          duration_ms: number | null
          error: string | null
          id: string
          method: string
          ok: boolean
          record_count: number
          request_summary: Json
          resource: string
          response_summary: Json
          status_code: number
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          direction: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          method: string
          ok?: boolean
          record_count?: number
          request_summary?: Json
          resource: string
          response_summary?: Json
          status_code?: number
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          direction?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          method?: string
          ok?: boolean
          record_count?: number
          request_summary?: Json
          resource?: string
          response_summary?: Json
          status_code?: number
        }
        Relationships: []
      }
      erp_sync_state: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_error_at: string | null
          last_record_count: number
          last_success_at: string | null
          resource: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_record_count?: number
          last_success_at?: string | null
          resource: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_record_count?: number
          last_success_at?: string | null
          resource?: string
          updated_at?: string
        }
        Relationships: []
      }
      intervention_pdr: {
        Row: {
          cause_remplacement: string | null
          commentaire_technique: string | null
          compteur_fin: number | null
          compteur_initial_new: number | null
          created_at: string
          id: string
          intervention_id: string | null
          pdr_id: string
          photo_apres_path: string | null
          photo_avant_path: string | null
          position_id: string | null
          preventive_execution_id: string | null
          quantite: number
        }
        Insert: {
          cause_remplacement?: string | null
          commentaire_technique?: string | null
          compteur_fin?: number | null
          compteur_initial_new?: number | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          pdr_id: string
          photo_apres_path?: string | null
          photo_avant_path?: string | null
          position_id?: string | null
          preventive_execution_id?: string | null
          quantite?: number
        }
        Update: {
          cause_remplacement?: string | null
          commentaire_technique?: string | null
          compteur_fin?: number | null
          compteur_initial_new?: number | null
          created_at?: string
          id?: string
          intervention_id?: string | null
          pdr_id?: string
          photo_apres_path?: string | null
          photo_avant_path?: string | null
          position_id?: string | null
          preventive_execution_id?: string | null
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "intervention_pdr_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_pdr_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_pdr_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "pdr_install_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_pdr_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "pdr_position_status"
            referencedColumns: ["position_id"]
          },
          {
            foreignKeyName: "intervention_pdr_preventive_execution_id_fkey"
            columns: ["preventive_execution_id"]
            isOneToOne: false
            referencedRelation: "preventive_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string | null
          description: string
          id: string
          notes: string | null
          role: Database["public"]["Enums"]["intervention_role"]
          search_vector: unknown
          statut: Database["public"]["Enums"]["intervention_statut"]
          technicien_id: string
          ticket_id: string
          updated_at: string
          validation_request_id: string | null
          validation_status: string | null
        }
        Insert: {
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          description?: string
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["intervention_role"]
          search_vector?: unknown
          statut?: Database["public"]["Enums"]["intervention_statut"]
          technicien_id: string
          ticket_id: string
          updated_at?: string
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          description?: string
          id?: string
          notes?: string | null
          role?: Database["public"]["Enums"]["intervention_role"]
          search_vector?: unknown
          statut?: Database["public"]["Enums"]["intervention_statut"]
          technicien_id?: string
          ticket_id?: string
          updated_at?: string
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interventions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_assignment_scopes: {
        Row: {
          assignment_id: string
          created_at: string
          family_id: string
          id: string
          include_children: boolean
        }
        Insert: {
          assignment_id: string
          created_at?: string
          family_id: string
          id?: string
          include_children?: boolean
        }
        Update: {
          assignment_id?: string
          created_at?: string
          family_id?: string
          id?: string
          include_children?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_assignment_scopes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "inventory_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assignment_scopes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "pdr_families"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_assignments: {
        Row: {
          agent_id: string
          campaign_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["inventory_assignment_role"]
        }
        Insert: {
          agent_id: string
          campaign_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["inventory_assignment_role"]
        }
        Update: {
          agent_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["inventory_assignment_role"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "inventory_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_campaign_scopes: {
        Row: {
          campaign_id: string
          created_at: string
          family_id: string
          id: string
          include_children: boolean
        }
        Insert: {
          campaign_id: string
          created_at?: string
          family_id: string
          id?: string
          include_children?: boolean
        }
        Update: {
          campaign_id?: string
          created_at?: string
          family_id?: string
          id?: string
          include_children?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_campaign_scopes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "inventory_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_campaign_scopes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "pdr_families"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_campaigns: {
        Row: {
          campaign_type: Database["public"]["Enums"]["inventory_campaign_type"]
          code: string | null
          created_at: string
          created_by: string | null
          date_cloture: string | null
          date_debut: string | null
          date_fin_prevue: string | null
          description: string | null
          id: string
          label: string
          motif: string | null
          responsable_id: string | null
          scope_equipements: boolean
          scope_machines: boolean
          scope_organes: boolean
          scope_pdr: boolean
          status: Database["public"]["Enums"]["inventory_campaign_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          campaign_type?: Database["public"]["Enums"]["inventory_campaign_type"]
          code?: string | null
          created_at?: string
          created_by?: string | null
          date_cloture?: string | null
          date_debut?: string | null
          date_fin_prevue?: string | null
          description?: string | null
          id?: string
          label: string
          motif?: string | null
          responsable_id?: string | null
          scope_equipements?: boolean
          scope_machines?: boolean
          scope_organes?: boolean
          scope_pdr?: boolean
          status?: Database["public"]["Enums"]["inventory_campaign_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          campaign_type?: Database["public"]["Enums"]["inventory_campaign_type"]
          code?: string | null
          created_at?: string
          created_by?: string | null
          date_cloture?: string | null
          date_debut?: string | null
          date_fin_prevue?: string | null
          description?: string | null
          id?: string
          label?: string
          motif?: string | null
          responsable_id?: string | null
          scope_equipements?: boolean
          scope_machines?: boolean
          scope_organes?: boolean
          scope_pdr?: boolean
          status?: Database["public"]["Enums"]["inventory_campaign_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inventory_counts: {
        Row: {
          agent_id: string
          assignment_id: string
          created_at: string
          id: string
          notes: string | null
          qty_comptee: number
          role: Database["public"]["Enums"]["inventory_assignment_role"]
          round: number
          target_id: string
          validated_at: string
        }
        Insert: {
          agent_id: string
          assignment_id: string
          created_at?: string
          id?: string
          notes?: string | null
          qty_comptee: number
          role: Database["public"]["Enums"]["inventory_assignment_role"]
          round?: number
          target_id: string
          validated_at?: string
        }
        Update: {
          agent_id?: string
          assignment_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          qty_comptee?: number
          role?: Database["public"]["Enums"]["inventory_assignment_role"]
          round?: number
          target_id?: string
          validated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "inventory_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "inventory_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_results: {
        Row: {
          campaign_id: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["inventory_decision"]
          ecart_ab: number | null
          ecart_ac: number | null
          ecart_bc: number | null
          qty_a: number | null
          qty_b: number | null
          qty_c: number | null
          qty_finale: number | null
          round: number
          target_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["inventory_decision"]
          ecart_ab?: number | null
          ecart_ac?: number | null
          ecart_bc?: number | null
          qty_a?: number | null
          qty_b?: number | null
          qty_c?: number | null
          qty_finale?: number | null
          round?: number
          target_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["inventory_decision"]
          ecart_ab?: number | null
          ecart_ac?: number | null
          ecart_bc?: number | null
          qty_a?: number | null
          qty_b?: number | null
          qty_c?: number | null
          qty_finale?: number | null
          round?: number
          target_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "inventory_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_results_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: true
            referencedRelation: "inventory_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_targets: {
        Row: {
          campaign_id: string
          created_at: string
          current_round: number
          entity_code: string | null
          entity_id: string
          entity_label: string | null
          entity_type: Database["public"]["Enums"]["inventory_entity_type"]
          family_id: string | null
          id: string
          qty_systeme: number
          status: Database["public"]["Enums"]["inventory_target_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          current_round?: number
          entity_code?: string | null
          entity_id: string
          entity_label?: string | null
          entity_type: Database["public"]["Enums"]["inventory_entity_type"]
          family_id?: string | null
          id?: string
          qty_systeme?: number
          status?: Database["public"]["Enums"]["inventory_target_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          current_round?: number
          entity_code?: string | null
          entity_id?: string
          entity_label?: string | null
          entity_type?: Database["public"]["Enums"]["inventory_entity_type"]
          family_id?: string | null
          id?: string
          qty_systeme?: number
          status?: Database["public"]["Enums"]["inventory_target_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "inventory_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_targets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "pdr_families"
            referencedColumns: ["id"]
          },
        ]
      }
      line_products: {
        Row: {
          created_at: string
          id: string
          line_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          line_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_products_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_documents: {
        Row: {
          created_at: string
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          machine_id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          machine_id: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          machine_id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_documents_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_families: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_families_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "machine_families"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_line_assignments: {
        Row: {
          created_at: string
          id: string
          line_id: string
          machine_id: string
          priority: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_id: string
          machine_id: string
          priority?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_id?: string
          machine_id?: string
          priority?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "machine_line_assignments_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_line_assignments_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_pdr: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          pdr_id: string
          quantite_recommandee: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          pdr_id: string
          quantite_recommandee?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          pdr_id?: string
          quantite_recommandee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_pdr_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_pdr_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          annee_fabrication: number | null
          cadence_nominale: number | null
          capacite_nominale: number | null
          caracteristiques_techniques: Json | null
          code: string
          code_erp: string | null
          code_immobilisation: string | null
          commentaire_technique: string | null
          conditions_utilisation: string | null
          consignes_securite: string | null
          created_at: string
          criticite: Database["public"]["Enums"]["criticite"]
          criticite_maintenance:
            | Database["public"]["Enums"]["criticite_maintenance"]
            | null
          date_mise_en_service: string | null
          description: string | null
          designation: string
          disponibilite_pdr:
            | Database["public"]["Enums"]["disponibilite_pdr"]
            | null
          energie_utilisee: Database["public"]["Enums"]["energie_type"] | null
          fabricant: string | null
          family_id: string | null
          frequence_hz: number | null
          hauteur_mm: number | null
          id: string
          impact_ligne: Database["public"]["Enums"]["impact_ligne"] | null
          is_active: boolean
          largeur_mm: number | null
          localisation: string | null
          longueur_mm: number | null
          marque: string | null
          matiere_principale: string | null
          modele: string | null
          niveau_risque: string | null
          numero_serie: string | null
          poids_kg: number | null
          pression_service_bar: number | null
          puissance_kw: number | null
          qr_code: string | null
          reference_constructeur: string | null
          role_fonctionnel:
            | Database["public"]["Enums"]["role_fonctionnel"]
            | null
          search_vector: unknown
          statut: Database["public"]["Enums"]["machine_statut"]
          tension_v: number | null
          unite_cadence: string | null
          unite_capacite: string | null
          updated_at: string
          zone_installation: string | null
        }
        Insert: {
          annee_fabrication?: number | null
          cadence_nominale?: number | null
          capacite_nominale?: number | null
          caracteristiques_techniques?: Json | null
          code: string
          code_erp?: string | null
          code_immobilisation?: string | null
          commentaire_technique?: string | null
          conditions_utilisation?: string | null
          consignes_securite?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"]
          criticite_maintenance?:
            | Database["public"]["Enums"]["criticite_maintenance"]
            | null
          date_mise_en_service?: string | null
          description?: string | null
          designation: string
          disponibilite_pdr?:
            | Database["public"]["Enums"]["disponibilite_pdr"]
            | null
          energie_utilisee?: Database["public"]["Enums"]["energie_type"] | null
          fabricant?: string | null
          family_id?: string | null
          frequence_hz?: number | null
          hauteur_mm?: number | null
          id?: string
          impact_ligne?: Database["public"]["Enums"]["impact_ligne"] | null
          is_active?: boolean
          largeur_mm?: number | null
          localisation?: string | null
          longueur_mm?: number | null
          marque?: string | null
          matiere_principale?: string | null
          modele?: string | null
          niveau_risque?: string | null
          numero_serie?: string | null
          poids_kg?: number | null
          pression_service_bar?: number | null
          puissance_kw?: number | null
          qr_code?: string | null
          reference_constructeur?: string | null
          role_fonctionnel?:
            | Database["public"]["Enums"]["role_fonctionnel"]
            | null
          search_vector?: unknown
          statut?: Database["public"]["Enums"]["machine_statut"]
          tension_v?: number | null
          unite_cadence?: string | null
          unite_capacite?: string | null
          updated_at?: string
          zone_installation?: string | null
        }
        Update: {
          annee_fabrication?: number | null
          cadence_nominale?: number | null
          capacite_nominale?: number | null
          caracteristiques_techniques?: Json | null
          code?: string
          code_erp?: string | null
          code_immobilisation?: string | null
          commentaire_technique?: string | null
          conditions_utilisation?: string | null
          consignes_securite?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"]
          criticite_maintenance?:
            | Database["public"]["Enums"]["criticite_maintenance"]
            | null
          date_mise_en_service?: string | null
          description?: string | null
          designation?: string
          disponibilite_pdr?:
            | Database["public"]["Enums"]["disponibilite_pdr"]
            | null
          energie_utilisee?: Database["public"]["Enums"]["energie_type"] | null
          fabricant?: string | null
          family_id?: string | null
          frequence_hz?: number | null
          hauteur_mm?: number | null
          id?: string
          impact_ligne?: Database["public"]["Enums"]["impact_ligne"] | null
          is_active?: boolean
          largeur_mm?: number | null
          localisation?: string | null
          longueur_mm?: number | null
          marque?: string | null
          matiere_principale?: string | null
          modele?: string | null
          niveau_risque?: string | null
          numero_serie?: string | null
          poids_kg?: number | null
          pression_service_bar?: number | null
          puissance_kw?: number | null
          qr_code?: string | null
          reference_constructeur?: string | null
          role_fonctionnel?:
            | Database["public"]["Enums"]["role_fonctionnel"]
            | null
          search_vector?: unknown
          statut?: Database["public"]["Enums"]["machine_statut"]
          tension_v?: number | null
          unite_cadence?: string | null
          unite_capacite?: string | null
          updated_at?: string
          zone_installation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "machine_families"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_shifts: {
        Row: {
          created_at: string
          date_shift: string
          heure_debut: string
          heure_fin: string | null
          id: string
          is_active: boolean
          line_ids: string[]
          maintenancier_id: string
          observations: string | null
          opened_by: string | null
          shift_team_id: string | null
          shift_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_shift?: string
          heure_debut?: string
          heure_fin?: string | null
          id?: string
          is_active?: boolean
          line_ids?: string[]
          maintenancier_id: string
          observations?: string | null
          opened_by?: string | null
          shift_team_id?: string | null
          shift_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_shift?: string
          heure_debut?: string
          heure_fin?: string | null
          id?: string
          is_active?: boolean
          line_ids?: string[]
          maintenancier_id?: string
          observations?: string | null
          opened_by?: string | null
          shift_team_id?: string | null
          shift_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_shifts_shift_team_id_fkey"
            columns: ["shift_team_id"]
            isOneToOne: false
            referencedRelation: "shift_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_email_log: {
        Row: {
          created_at: string
          dedup_key: string | null
          error: string | null
          id: string
          notification_id: string | null
          recipient_email: string
          recipient_user_id: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          dedup_key?: string | null
          error?: string | null
          id?: string
          notification_id?: string | null
          recipient_email: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Update: {
          created_at?: string
          dedup_key?: string | null
          error?: string | null
          id?: string
          notification_id?: string | null
          recipient_email?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          channels: Json
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          excluded_users: Json | null
          frequency: Database["public"]["Enums"]["notification_frequency"]
          id: string
          is_active: boolean
          is_critical: boolean
          module: string
          name: string
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          severity: Database["public"]["Enums"]["notification_severity"]
          target_roles: Json
          target_users: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channels?: Json
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          excluded_users?: Json | null
          frequency?: Database["public"]["Enums"]["notification_frequency"]
          id?: string
          is_active?: boolean
          is_critical?: boolean
          module: string
          name: string
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          target_roles?: Json
          target_users?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channels?: Json
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          excluded_users?: Json | null
          frequency?: Database["public"]["Enums"]["notification_frequency"]
          id?: string
          is_active?: boolean
          is_critical?: boolean
          module?: string
          name?: string
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"]
          target_roles?: Json
          target_users?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          archived_at: string | null
          created_at: string
          deduplication_key: string | null
          entity_code: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          group_key: string | null
          id: string
          is_critical: boolean
          message: string
          metadata: Json | null
          module: string
          notification_type: string
          read_at: string | null
          recipient_role: string | null
          recipient_user_id: string | null
          rule_id: string | null
          search_vector: unknown
          severity: Database["public"]["Enums"]["notification_severity"]
          source: string
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          triggered_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          deduplication_key?: string | null
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          group_key?: string | null
          id?: string
          is_critical?: boolean
          message?: string
          metadata?: Json | null
          module: string
          notification_type: string
          read_at?: string | null
          recipient_role?: string | null
          recipient_user_id?: string | null
          rule_id?: string | null
          search_vector?: unknown
          severity?: Database["public"]["Enums"]["notification_severity"]
          source?: string
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          triggered_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          deduplication_key?: string | null
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          group_key?: string | null
          id?: string
          is_critical?: boolean
          message?: string
          metadata?: Json | null
          module?: string
          notification_type?: string
          read_at?: string | null
          recipient_role?: string | null
          recipient_user_id?: string | null
          rule_id?: string | null
          search_vector?: unknown
          severity?: Database["public"]["Enums"]["notification_severity"]
          source?: string
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          triggered_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      of_mode_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_mode_id: string
          of_id: string
          old_mode_id: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_mode_id: string
          of_id: string
          old_mode_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_mode_id?: string
          of_id?: string
          old_mode_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "of_mode_history_new_mode_id_fkey"
            columns: ["new_mode_id"]
            isOneToOne: false
            referencedRelation: "shift_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "of_mode_history_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "of_mode_history_old_mode_id_fkey"
            columns: ["old_mode_id"]
            isOneToOne: false
            referencedRelation: "shift_modes"
            referencedColumns: ["id"]
          },
        ]
      }
      of_shift_assignments: {
        Row: {
          chef_ligne_id: string
          created_at: string
          created_by: string | null
          id: string
          of_id: string
          shift_team_id: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at: string
        }
        Insert: {
          chef_ligne_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          of_id: string
          shift_team_id: string
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
        }
        Update: {
          chef_ligne_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          of_id?: string
          shift_team_id?: string
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "of_shift_assignments_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "of_shift_assignments_shift_team_id_fkey"
            columns: ["shift_team_id"]
            isOneToOne: false
            referencedRelation: "shift_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ordres_fabrication: {
        Row: {
          auto_generate_shifts: boolean
          bom_id: string | null
          created_at: string
          created_by: string | null
          date_debut_prevue: string | null
          date_debut_reelle: string | null
          date_fin_prevue: string | null
          date_fin_reelle: string | null
          id: string
          is_active: boolean
          line_id: string | null
          numero: string
          product_id: string
          quality_status:
            | Database["public"]["Enums"]["of_quality_status"]
            | null
          quantite_prevue: number
          quantite_produite: number
          quantite_rebut: number
          recipe_id: string | null
          search_vector: unknown
          shift_mode_id: string | null
          statut: Database["public"]["Enums"]["of_statut"]
          unite: string
          updated_at: string
        }
        Insert: {
          auto_generate_shifts?: boolean
          bom_id?: string | null
          created_at?: string
          created_by?: string | null
          date_debut_prevue?: string | null
          date_debut_reelle?: string | null
          date_fin_prevue?: string | null
          date_fin_reelle?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          numero: string
          product_id: string
          quality_status?:
            | Database["public"]["Enums"]["of_quality_status"]
            | null
          quantite_prevue?: number
          quantite_produite?: number
          quantite_rebut?: number
          recipe_id?: string | null
          search_vector?: unknown
          shift_mode_id?: string | null
          statut?: Database["public"]["Enums"]["of_statut"]
          unite?: string
          updated_at?: string
        }
        Update: {
          auto_generate_shifts?: boolean
          bom_id?: string | null
          created_at?: string
          created_by?: string | null
          date_debut_prevue?: string | null
          date_debut_reelle?: string | null
          date_fin_prevue?: string | null
          date_fin_reelle?: string | null
          id?: string
          is_active?: boolean
          line_id?: string | null
          numero?: string
          product_id?: string
          quality_status?:
            | Database["public"]["Enums"]["of_quality_status"]
            | null
          quantite_prevue?: number
          quantite_produite?: number
          quantite_rebut?: number
          recipe_id?: string | null
          search_vector?: unknown
          shift_mode_id?: string | null
          statut?: Database["public"]["Enums"]["of_statut"]
          unite?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordres_fabrication_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordres_fabrication_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordres_fabrication_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordres_fabrication_shift_mode_id_fkey"
            columns: ["shift_mode_id"]
            isOneToOne: false
            referencedRelation: "shift_modes"
            referencedColumns: ["id"]
          },
        ]
      }
      organes: {
        Row: {
          caracteristiques_techniques: Json | null
          code: string
          code_barres: string | null
          code_erp: string | null
          code_immobilisation: string | null
          commentaire_technique: string | null
          consignes_securite: string | null
          created_at: string
          criticite: Database["public"]["Enums"]["criticite"]
          debit: number | null
          description: string | null
          designation: string
          diametre_ext: number | null
          diametre_int: number | null
          duree_vie_estimee_jours: number | null
          epaisseur: number | null
          equipement_id: string | null
          fabricant: string | null
          filetage: string | null
          frequence: number | null
          frequence_inspection_jours: number | null
          hauteur: number | null
          id: string
          impact_panne:
            | Database["public"]["Enums"]["organe_impact_panne"]
            | null
          intensite: number | null
          is_active: boolean
          largeur: number | null
          longueur: number | null
          machine_id: string | null
          marque: string | null
          matiere: string | null
          modele: string | null
          numero_serie: string | null
          poids: number | null
          pression: number | null
          puissance: number | null
          qr_code: string | null
          reference_constructeur: string | null
          search_vector: unknown
          sort_order: number
          statut: Database["public"]["Enums"]["organe_statut"]
          temperature_max: number | null
          temperature_min: number | null
          tension: number | null
          type: Database["public"]["Enums"]["organe_type"]
          type_connexion: string | null
          unite_dimension: string | null
          unite_poids: string | null
          updated_at: string
          vitesse_rotation: number | null
        }
        Insert: {
          caracteristiques_techniques?: Json | null
          code: string
          code_barres?: string | null
          code_erp?: string | null
          code_immobilisation?: string | null
          commentaire_technique?: string | null
          consignes_securite?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"]
          debit?: number | null
          description?: string | null
          designation: string
          diametre_ext?: number | null
          diametre_int?: number | null
          duree_vie_estimee_jours?: number | null
          epaisseur?: number | null
          equipement_id?: string | null
          fabricant?: string | null
          filetage?: string | null
          frequence?: number | null
          frequence_inspection_jours?: number | null
          hauteur?: number | null
          id?: string
          impact_panne?:
            | Database["public"]["Enums"]["organe_impact_panne"]
            | null
          intensite?: number | null
          is_active?: boolean
          largeur?: number | null
          longueur?: number | null
          machine_id?: string | null
          marque?: string | null
          matiere?: string | null
          modele?: string | null
          numero_serie?: string | null
          poids?: number | null
          pression?: number | null
          puissance?: number | null
          qr_code?: string | null
          reference_constructeur?: string | null
          search_vector?: unknown
          sort_order?: number
          statut?: Database["public"]["Enums"]["organe_statut"]
          temperature_max?: number | null
          temperature_min?: number | null
          tension?: number | null
          type?: Database["public"]["Enums"]["organe_type"]
          type_connexion?: string | null
          unite_dimension?: string | null
          unite_poids?: string | null
          updated_at?: string
          vitesse_rotation?: number | null
        }
        Update: {
          caracteristiques_techniques?: Json | null
          code?: string
          code_barres?: string | null
          code_erp?: string | null
          code_immobilisation?: string | null
          commentaire_technique?: string | null
          consignes_securite?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"]
          debit?: number | null
          description?: string | null
          designation?: string
          diametre_ext?: number | null
          diametre_int?: number | null
          duree_vie_estimee_jours?: number | null
          epaisseur?: number | null
          equipement_id?: string | null
          fabricant?: string | null
          filetage?: string | null
          frequence?: number | null
          frequence_inspection_jours?: number | null
          hauteur?: number | null
          id?: string
          impact_panne?:
            | Database["public"]["Enums"]["organe_impact_panne"]
            | null
          intensite?: number | null
          is_active?: boolean
          largeur?: number | null
          longueur?: number | null
          machine_id?: string | null
          marque?: string | null
          matiere?: string | null
          modele?: string | null
          numero_serie?: string | null
          poids?: number | null
          pression?: number | null
          puissance?: number | null
          qr_code?: string | null
          reference_constructeur?: string | null
          search_vector?: unknown
          sort_order?: number
          statut?: Database["public"]["Enums"]["organe_statut"]
          temperature_max?: number | null
          temperature_min?: number | null
          tension?: number | null
          type?: Database["public"]["Enums"]["organe_type"]
          type_connexion?: string | null
          unite_dimension?: string | null
          unite_poids?: string | null
          updated_at?: string
          vitesse_rotation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organes_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_levels: {
        Row: {
          coefficient: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          level_order: number
          poids: number | null
          unite_name: string
        }
        Insert: {
          coefficient?: number
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          level_order?: number
          poids?: number | null
          unite_name: string
        }
        Update: {
          coefficient?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          level_order?: number
          poids?: number | null
          unite_name?: string
        }
        Relationships: []
      }
      panne_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      pdr: {
        Row: {
          approvisionnement: Database["public"]["Enums"]["approvisionnement_type"]
          caracteristiques_techniques: Json | null
          code_barres: string | null
          code_erp: string | null
          commentaire_technique: string | null
          couleur: string | null
          created_at: string
          criticite: Database["public"]["Enums"]["criticite"] | null
          debit: number | null
          delai_approvisionnement: number
          description: string | null
          designation: string
          devise: string
          diametre_ext: number | null
          diametre_int: number | null
          duree_vie_max_jours: number | null
          duree_vie_min_jours: number | null
          emplacement: string | null
          epaisseur: number | null
          fabricant: string | null
          family_id: string | null
          filetage: string | null
          fournisseur: string | null
          frequence: number | null
          hauteur: number | null
          id: string
          intensite: number | null
          is_active: boolean
          largeur: number | null
          longueur: number | null
          marque: string | null
          matiere: string | null
          modele: string | null
          nombre_dents: number | null
          pas: number | null
          pmp: number
          poids: number | null
          point_commande: number
          pression: number | null
          prix_unitaire: number | null
          puissance: number | null
          qr_code: string | null
          reference: string
          reference_constructeur: string | null
          search_vector: unknown
          sous_famille: string | null
          statut_pdr: Database["public"]["Enums"]["statut_pdr"]
          stock_actuel: number
          stock_max: number
          stock_min: number
          stock_reserve: number
          stock_securite: number
          temperature_max: number | null
          temperature_min: number | null
          tension: number | null
          type_connexion: string | null
          type_signal: string | null
          unite_dimension: string | null
          unite_poids: string | null
          unite_stock: string | null
          updated_at: string
          vitesse_rotation: number | null
        }
        Insert: {
          approvisionnement?: Database["public"]["Enums"]["approvisionnement_type"]
          caracteristiques_techniques?: Json | null
          code_barres?: string | null
          code_erp?: string | null
          commentaire_technique?: string | null
          couleur?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"] | null
          debit?: number | null
          delai_approvisionnement?: number
          description?: string | null
          designation: string
          devise?: string
          diametre_ext?: number | null
          diametre_int?: number | null
          duree_vie_max_jours?: number | null
          duree_vie_min_jours?: number | null
          emplacement?: string | null
          epaisseur?: number | null
          fabricant?: string | null
          family_id?: string | null
          filetage?: string | null
          fournisseur?: string | null
          frequence?: number | null
          hauteur?: number | null
          id?: string
          intensite?: number | null
          is_active?: boolean
          largeur?: number | null
          longueur?: number | null
          marque?: string | null
          matiere?: string | null
          modele?: string | null
          nombre_dents?: number | null
          pas?: number | null
          pmp?: number
          poids?: number | null
          point_commande?: number
          pression?: number | null
          prix_unitaire?: number | null
          puissance?: number | null
          qr_code?: string | null
          reference: string
          reference_constructeur?: string | null
          search_vector?: unknown
          sous_famille?: string | null
          statut_pdr?: Database["public"]["Enums"]["statut_pdr"]
          stock_actuel?: number
          stock_max?: number
          stock_min?: number
          stock_reserve?: number
          stock_securite?: number
          temperature_max?: number | null
          temperature_min?: number | null
          tension?: number | null
          type_connexion?: string | null
          type_signal?: string | null
          unite_dimension?: string | null
          unite_poids?: string | null
          unite_stock?: string | null
          updated_at?: string
          vitesse_rotation?: number | null
        }
        Update: {
          approvisionnement?: Database["public"]["Enums"]["approvisionnement_type"]
          caracteristiques_techniques?: Json | null
          code_barres?: string | null
          code_erp?: string | null
          commentaire_technique?: string | null
          couleur?: string | null
          created_at?: string
          criticite?: Database["public"]["Enums"]["criticite"] | null
          debit?: number | null
          delai_approvisionnement?: number
          description?: string | null
          designation?: string
          devise?: string
          diametre_ext?: number | null
          diametre_int?: number | null
          duree_vie_max_jours?: number | null
          duree_vie_min_jours?: number | null
          emplacement?: string | null
          epaisseur?: number | null
          fabricant?: string | null
          family_id?: string | null
          filetage?: string | null
          fournisseur?: string | null
          frequence?: number | null
          hauteur?: number | null
          id?: string
          intensite?: number | null
          is_active?: boolean
          largeur?: number | null
          longueur?: number | null
          marque?: string | null
          matiere?: string | null
          modele?: string | null
          nombre_dents?: number | null
          pas?: number | null
          pmp?: number
          poids?: number | null
          point_commande?: number
          pression?: number | null
          prix_unitaire?: number | null
          puissance?: number | null
          qr_code?: string | null
          reference?: string
          reference_constructeur?: string | null
          search_vector?: unknown
          sous_famille?: string | null
          statut_pdr?: Database["public"]["Enums"]["statut_pdr"]
          stock_actuel?: number
          stock_max?: number
          stock_min?: number
          stock_reserve?: number
          stock_securite?: number
          temperature_max?: number | null
          temperature_min?: number | null
          tension?: number | null
          type_connexion?: string | null
          type_signal?: string | null
          unite_dimension?: string | null
          unite_poids?: string | null
          unite_stock?: string | null
          updated_at?: string
          vitesse_rotation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "pdr_families"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_entity_links: {
        Row: {
          commentaire: string | null
          created_at: string
          criticite_sur_actif: Database["public"]["Enums"]["criticite"] | null
          entity_id: string
          entity_type: string
          id: string
          pdr_id: string
          position_installation: string | null
          quantite_recommandee: number
          updated_at: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          criticite_sur_actif?: Database["public"]["Enums"]["criticite"] | null
          entity_id: string
          entity_type: string
          id?: string
          pdr_id: string
          position_installation?: string | null
          quantite_recommandee?: number
          updated_at?: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          criticite_sur_actif?: Database["public"]["Enums"]["criticite"] | null
          entity_id?: string
          entity_type?: string
          id?: string
          pdr_id?: string
          position_installation?: string | null
          quantite_recommandee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_entity_links_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_equivalences: {
        Row: {
          brand: string | null
          created_at: string
          created_by: string | null
          equivalence_type: string
          equivalent_pdr_id: string | null
          external_reference: string | null
          id: string
          manufacturer: string | null
          notes: string | null
          pdr_id: string
          updated_at: string
          updated_by: string | null
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          equivalence_type?: string
          equivalent_pdr_id?: string | null
          external_reference?: string | null
          id?: string
          manufacturer?: string | null
          notes?: string | null
          pdr_id: string
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          equivalence_type?: string
          equivalent_pdr_id?: string | null
          external_reference?: string | null
          id?: string
          manufacturer?: string | null
          notes?: string | null
          pdr_id?: string
          updated_at?: string
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_equivalences_equivalent_pdr_id_fkey"
            columns: ["equivalent_pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_equivalences_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_families: {
        Row: {
          approvisionnement: Database["public"]["Enums"]["approvisionnement_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          statut_default: Database["public"]["Enums"]["statut_pdr"]
          updated_at: string
        }
        Insert: {
          approvisionnement?: Database["public"]["Enums"]["approvisionnement_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          statut_default?: Database["public"]["Enums"]["statut_pdr"]
          updated_at?: string
        }
        Update: {
          approvisionnement?: Database["public"]["Enums"]["approvisionnement_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          statut_default?: Database["public"]["Enums"]["statut_pdr"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_families_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pdr_families"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_family_suppliers: {
        Row: {
          adresse: string | null
          created_at: string
          created_by: string | null
          delai_jours: number | null
          email: string | null
          family_id: string
          id: string
          is_principal: boolean | null
          nom: string
          notes: string | null
          prix: number | null
          reference_fournisseur: string | null
          search_vector: unknown
          tel: string | null
          updated_at: string
          updated_by: string | null
          url1: string | null
          url2: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          delai_jours?: number | null
          email?: string | null
          family_id: string
          id?: string
          is_principal?: boolean | null
          nom: string
          notes?: string | null
          prix?: number | null
          reference_fournisseur?: string | null
          search_vector?: unknown
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
          url1?: string | null
          url2?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          delai_jours?: number | null
          email?: string | null
          family_id?: string
          id?: string
          is_principal?: boolean | null
          nom?: string
          notes?: string | null
          prix?: number | null
          reference_fournisseur?: string | null
          search_vector?: unknown
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
          url1?: string | null
          url2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_family_suppliers_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "pdr_families"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_holding_transfers: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          destination: Database["public"]["Enums"]["pdr_transfer_destination"]
          from_holder: string
          id: string
          motif: string | null
          pdr_id: string
          quantite: number
          request_item_id: string | null
          statut: Database["public"]["Enums"]["pdr_transfer_status"]
          to_holder: string | null
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          destination: Database["public"]["Enums"]["pdr_transfer_destination"]
          from_holder: string
          id?: string
          motif?: string | null
          pdr_id: string
          quantite: number
          request_item_id?: string | null
          statut?: Database["public"]["Enums"]["pdr_transfer_status"]
          to_holder?: string | null
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          destination?: Database["public"]["Enums"]["pdr_transfer_destination"]
          from_holder?: string
          id?: string
          motif?: string | null
          pdr_id?: string
          quantite?: number
          request_item_id?: string | null
          statut?: Database["public"]["Enums"]["pdr_transfer_status"]
          to_holder?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_holding_transfers_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_install_positions: {
        Row: {
          compteur_manuel: number | null
          created_at: string
          created_by: string | null
          description: string | null
          designation: string
          id: string
          lifespan_mode: string
          link_id: string
          marker_x: number | null
          marker_y: number | null
          position_index: number
          production_coefficient: number | null
          production_rule: string | null
          seuil_alerte_pct: number | null
          seuil_max: number | null
          seuil_min: number | null
          statut: string
          unite_mesure: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          compteur_manuel?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          designation: string
          id?: string
          lifespan_mode?: string
          link_id: string
          marker_x?: number | null
          marker_y?: number | null
          position_index: number
          production_coefficient?: number | null
          production_rule?: string | null
          seuil_alerte_pct?: number | null
          seuil_max?: number | null
          seuil_min?: number | null
          statut?: string
          unite_mesure?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          compteur_manuel?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          designation?: string
          id?: string
          lifespan_mode?: string
          link_id?: string
          marker_x?: number | null
          marker_y?: number | null
          position_index?: number
          production_coefficient?: number | null
          production_rule?: string | null
          seuil_alerte_pct?: number | null
          seuil_max?: number | null
          seuil_min?: number | null
          statut?: string
          unite_mesure?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_install_positions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "pdr_entity_links"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_instances: {
        Row: {
          compteur_pose_at: number | null
          created_at: string | null
          date_installation: string
          date_remplacement: string | null
          equipement_id: string | null
          id: string
          installed_by: string | null
          intervention_id: string | null
          machine_id: string | null
          notes: string | null
          organe_id: string | null
          pdr_id: string
          position_id: string | null
          statut: string
          ticket_id: string | null
        }
        Insert: {
          compteur_pose_at?: number | null
          created_at?: string | null
          date_installation?: string
          date_remplacement?: string | null
          equipement_id?: string | null
          id?: string
          installed_by?: string | null
          intervention_id?: string | null
          machine_id?: string | null
          notes?: string | null
          organe_id?: string | null
          pdr_id: string
          position_id?: string | null
          statut?: string
          ticket_id?: string | null
        }
        Update: {
          compteur_pose_at?: number | null
          created_at?: string | null
          date_installation?: string
          date_remplacement?: string | null
          equipement_id?: string | null
          id?: string
          installed_by?: string | null
          intervention_id?: string | null
          machine_id?: string | null
          notes?: string | null
          organe_id?: string | null
          pdr_id?: string
          position_id?: string | null
          statut?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_instances_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_instances_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_instances_organe_id_fkey"
            columns: ["organe_id"]
            isOneToOne: false
            referencedRelation: "organes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_instances_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_instances_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "pdr_install_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_instances_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "pdr_position_status"
            referencedColumns: ["position_id"]
          },
        ]
      }
      pdr_maintenance_holdings: {
        Row: {
          created_at: string
          holder_id: string
          id: string
          intervention_id: string | null
          pdr_id: string
          quantite: number
          request_item_id: string | null
          statut: Database["public"]["Enums"]["pdr_holding_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          holder_id: string
          id?: string
          intervention_id?: string | null
          pdr_id: string
          quantite: number
          request_item_id?: string | null
          statut?: Database["public"]["Enums"]["pdr_holding_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          holder_id?: string
          id?: string
          intervention_id?: string | null
          pdr_id?: string
          quantite?: number
          request_item_id?: string | null
          statut?: Database["public"]["Enums"]["pdr_holding_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_maintenance_holdings_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_maintenance_holdings_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_maintenance_holdings_request_item_id_fkey"
            columns: ["request_item_id"]
            isOneToOne: false
            referencedRelation: "pdr_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_request_items: {
        Row: {
          cause_remplacement: string | null
          commentaire: string | null
          created_at: string
          dispo_snapshot: boolean | null
          id: string
          pdr_id: string
          position_id: string | null
          prepared_at: string | null
          prepared_by: string | null
          quantite_demandee: number
          quantite_preparee: number | null
          quantite_prise: number | null
          refused_reason: string | null
          request_id: string
          statut: Database["public"]["Enums"]["pdr_request_item_status"]
          taken_at: string | null
          taken_by: string | null
          updated_at: string
        }
        Insert: {
          cause_remplacement?: string | null
          commentaire?: string | null
          created_at?: string
          dispo_snapshot?: boolean | null
          id?: string
          pdr_id: string
          position_id?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          quantite_demandee: number
          quantite_preparee?: number | null
          quantite_prise?: number | null
          refused_reason?: string | null
          request_id: string
          statut?: Database["public"]["Enums"]["pdr_request_item_status"]
          taken_at?: string | null
          taken_by?: string | null
          updated_at?: string
        }
        Update: {
          cause_remplacement?: string | null
          commentaire?: string | null
          created_at?: string
          dispo_snapshot?: boolean | null
          id?: string
          pdr_id?: string
          position_id?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          quantite_demandee?: number
          quantite_preparee?: number | null
          quantite_prise?: number | null
          refused_reason?: string | null
          request_id?: string
          statut?: Database["public"]["Enums"]["pdr_request_item_status"]
          taken_at?: string | null
          taken_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_request_items_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "pdr_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_requests: {
        Row: {
          commentaire: string | null
          created_at: string
          created_by: string | null
          id: string
          intervention_id: string | null
          ligne_id: string | null
          machine_id: string | null
          numero: string
          preventive_plan_id: string | null
          priorite: string
          refused_reason: string | null
          requested_by: string
          statut: Database["public"]["Enums"]["pdr_request_status"]
          ticket_id: string | null
          type: Database["public"]["Enums"]["pdr_request_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intervention_id?: string | null
          ligne_id?: string | null
          machine_id?: string | null
          numero: string
          preventive_plan_id?: string | null
          priorite?: string
          refused_reason?: string | null
          requested_by?: string
          statut?: Database["public"]["Enums"]["pdr_request_status"]
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["pdr_request_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          intervention_id?: string | null
          ligne_id?: string | null
          machine_id?: string | null
          numero?: string
          preventive_plan_id?: string | null
          priorite?: string
          refused_reason?: string | null
          requested_by?: string
          statut?: Database["public"]["Enums"]["pdr_request_status"]
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["pdr_request_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_requests_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_requests_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_requests_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_requests_preventive_plan_id_fkey"
            columns: ["preventive_plan_id"]
            isOneToOne: false
            referencedRelation: "preventive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_stock_movements: {
        Row: {
          applied: boolean
          created_at: string
          erp_synced_at: string | null
          id: string
          modified_at: string | null
          modified_by: string | null
          motif: string | null
          pdr_id: string
          prix_unitaire: number | null
          quantite: number
          ref_document_erp: string | null
          reference_source: string | null
          search_vector: unknown
          source_id: string | null
          source_type: string | null
          stock_apres: number
          stock_avant: number
          type: Database["public"]["Enums"]["mouvement_type"]
          updated_at: string
          user_id: string | null
          validation_request_id: string | null
          validation_status: string | null
        }
        Insert: {
          applied?: boolean
          created_at?: string
          erp_synced_at?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          motif?: string | null
          pdr_id: string
          prix_unitaire?: number | null
          quantite: number
          ref_document_erp?: string | null
          reference_source?: string | null
          search_vector?: unknown
          source_id?: string | null
          source_type?: string | null
          stock_apres?: number
          stock_avant?: number
          type: Database["public"]["Enums"]["mouvement_type"]
          updated_at?: string
          user_id?: string | null
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Update: {
          applied?: boolean
          created_at?: string
          erp_synced_at?: string | null
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          motif?: string | null
          pdr_id?: string
          prix_unitaire?: number | null
          quantite?: number
          ref_document_erp?: string | null
          reference_source?: string | null
          search_vector?: unknown
          source_id?: string | null
          source_type?: string | null
          stock_apres?: number
          stock_avant?: number
          type?: Database["public"]["Enums"]["mouvement_type"]
          updated_at?: string
          user_id?: string | null
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_stock_movements_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_stock_permissions: {
        Row: {
          can_cancel_movement: boolean
          can_correct_stock: boolean
          can_create_entry: boolean
          can_create_exit: boolean
          can_create_supplier: boolean
          can_delete_supplier: boolean
          can_edit_supplier: boolean
          can_inventory: boolean
          can_view_suppliers: boolean
          created_at: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          can_cancel_movement?: boolean
          can_correct_stock?: boolean
          can_create_entry?: boolean
          can_create_exit?: boolean
          can_create_supplier?: boolean
          can_delete_supplier?: boolean
          can_edit_supplier?: boolean
          can_inventory?: boolean
          can_view_suppliers?: boolean
          created_at?: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          can_cancel_movement?: boolean
          can_correct_stock?: boolean
          can_create_entry?: boolean
          can_create_exit?: boolean
          can_create_supplier?: boolean
          can_delete_supplier?: boolean
          can_edit_supplier?: boolean
          can_inventory?: boolean
          can_view_suppliers?: boolean
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdr_suppliers: {
        Row: {
          adresse: string | null
          brand: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          delai_jours: number | null
          email: string | null
          id: string
          is_active: boolean
          is_principal: boolean
          last_purchase_date: string | null
          last_purchase_price: number | null
          manufacturer_reference: string | null
          moq: number | null
          nom: string
          notes: string | null
          packaging_unit: string | null
          pdr_id: string
          prix: number | null
          reference_fournisseur: string | null
          supplier_designation: string | null
          supplier_url: string | null
          tel: string | null
          updated_at: string
          updated_by: string | null
          url1: string | null
          url2: string | null
        }
        Insert: {
          adresse?: string | null
          brand?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          delai_jours?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_principal?: boolean
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          manufacturer_reference?: string | null
          moq?: number | null
          nom: string
          notes?: string | null
          packaging_unit?: string | null
          pdr_id: string
          prix?: number | null
          reference_fournisseur?: string | null
          supplier_designation?: string | null
          supplier_url?: string | null
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
          url1?: string | null
          url2?: string | null
        }
        Update: {
          adresse?: string | null
          brand?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          delai_jours?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_principal?: boolean
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          manufacturer_reference?: string | null
          moq?: number | null
          nom?: string
          notes?: string | null
          packaging_unit?: string | null
          pdr_id?: string
          prix?: number | null
          reference_fournisseur?: string | null
          supplier_designation?: string | null
          supplier_url?: string | null
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
          url1?: string | null
          url2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_suppliers_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_action_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          echeance_cible: string | null
          id: string
          opened_at: string
          opened_by: string | null
          plan_id: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          echeance_cible?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          plan_id: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          echeance_cible?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          plan_id?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_action_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "preventive_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_executions: {
        Row: {
          checklist_results: Json | null
          created_at: string
          date_execution: string
          duree_minutes: number | null
          executed_by: string
          heure_debut: string | null
          heure_fin: string | null
          id: string
          notes: string | null
          pdr_used: Json | null
          plan_id: string
          session_id: string | null
          statut: string
        }
        Insert: {
          checklist_results?: Json | null
          created_at?: string
          date_execution?: string
          duree_minutes?: number | null
          executed_by: string
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          notes?: string | null
          pdr_used?: Json | null
          plan_id: string
          session_id?: string | null
          statut?: string
        }
        Update: {
          checklist_results?: Json | null
          created_at?: string
          date_execution?: string
          duree_minutes?: number | null
          executed_by?: string
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          notes?: string | null
          pdr_used?: Json | null
          plan_id?: string
          session_id?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_executions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "preventive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_executions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "preventive_action_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_plan_assignees: {
        Row: {
          created_at: string | null
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_plan_assignees_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "preventive_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_plan_pdr: {
        Row: {
          created_at: string | null
          id: string
          pdr_id: string
          plan_id: string
          quantite: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          pdr_id: string
          plan_id: string
          quantite?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          pdr_id?: string
          plan_id?: string
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "preventive_plan_pdr_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_plan_pdr_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "preventive_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      preventive_plans: {
        Row: {
          checklist: Json | null
          created_at: string
          derniere_execution: string | null
          description: string | null
          equipement_id: string | null
          frequence: Database["public"]["Enums"]["frequence_preventif"]
          id: string
          is_active: boolean
          line_id: string | null
          machine_id: string
          numero: string | null
          organe_id: string | null
          prochaine_echeance: string | null
          search_vector: unknown
          source: string | null
          source_pdr_id: string | null
          statut_plan: string
          title: string
          type_maintenance: string | null
          updated_at: string
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          derniere_execution?: string | null
          description?: string | null
          equipement_id?: string | null
          frequence?: Database["public"]["Enums"]["frequence_preventif"]
          id?: string
          is_active?: boolean
          line_id?: string | null
          machine_id: string
          numero?: string | null
          organe_id?: string | null
          prochaine_echeance?: string | null
          search_vector?: unknown
          source?: string | null
          source_pdr_id?: string | null
          statut_plan?: string
          title: string
          type_maintenance?: string | null
          updated_at?: string
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          derniere_execution?: string | null
          description?: string | null
          equipement_id?: string | null
          frequence?: Database["public"]["Enums"]["frequence_preventif"]
          id?: string
          is_active?: boolean
          line_id?: string | null
          machine_id?: string
          numero?: string | null
          organe_id?: string | null
          prochaine_echeance?: string | null
          search_vector?: unknown
          source?: string | null
          source_pdr_id?: string | null
          statut_plan?: string
          title?: string
          type_maintenance?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_plans_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_plans_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_plans_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_plans_organe_id_fkey"
            columns: ["organe_id"]
            isOneToOne: false
            referencedRelation: "organes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preventive_plans_source_pdr_id_fkey"
            columns: ["source_pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
        ]
      }
      product_families: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_families_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      production_declarations: {
        Row: {
          created_at: string
          declared_by: string | null
          erp_ref: string | null
          erp_synced_at: string | null
          heure_production: string
          id: string
          notes: string | null
          of_id: string
          quantite_produite: number
          quantite_rebut: number
          shift_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          declared_by?: string | null
          erp_ref?: string | null
          erp_synced_at?: string | null
          heure_production: string
          id?: string
          notes?: string | null
          of_id: string
          quantite_produite?: number
          quantite_rebut?: number
          shift_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          declared_by?: string | null
          erp_ref?: string | null
          erp_synced_at?: string | null
          heure_production?: string
          id?: string
          notes?: string | null
          of_id?: string
          quantite_produite?: number
          quantite_rebut?: number
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_declarations_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_declarations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lines: {
        Row: {
          atelier: string | null
          code: string
          created_at: string
          description: string | null
          designation: string
          id: string
          is_active: boolean
          machine_id: string | null
          search_vector: unknown
          updated_at: string
        }
        Insert: {
          atelier?: string | null
          code: string
          created_at?: string
          description?: string | null
          designation: string
          id?: string
          is_active?: boolean
          machine_id?: string | null
          search_vector?: unknown
          updated_at?: string
        }
        Update: {
          atelier?: string | null
          code?: string
          created_at?: string
          description?: string | null
          designation?: string
          id?: string
          is_active?: boolean
          machine_id?: string | null
          search_vector?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_lines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stops: {
        Row: {
          created_at: string
          declared_by: string | null
          description: string | null
          duree_minutes: number | null
          heure_debut: string
          heure_fin: string | null
          id: string
          line_id: string | null
          machine_id: string | null
          of_id: string
          search_vector: unknown
          shift_id: string
          ticket_id: string | null
          type: Database["public"]["Enums"]["arret_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          declared_by?: string | null
          description?: string | null
          duree_minutes?: number | null
          heure_debut?: string
          heure_fin?: string | null
          id?: string
          line_id?: string | null
          machine_id?: string | null
          of_id: string
          search_vector?: unknown
          shift_id: string
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["arret_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          declared_by?: string | null
          description?: string | null
          duree_minutes?: number | null
          heure_debut?: string
          heure_fin?: string | null
          id?: string
          line_id?: string | null
          machine_id?: string | null
          of_id?: string
          search_vector?: unknown
          shift_id?: string
          ticket_id?: string | null
          type?: Database["public"]["Enums"]["arret_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stops_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stops_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stops_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stops_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_stops_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          code: string
          code_erp: string | null
          created_at: string
          description: string | null
          designation: string
          family_id: string | null
          id: string
          is_active: boolean
          poids_unitaire: number | null
          search_vector: unknown
          unite: string
          unite_base: string | null
          updated_at: string
        }
        Insert: {
          code: string
          code_erp?: string | null
          created_at?: string
          description?: string | null
          designation: string
          family_id?: string | null
          id?: string
          is_active?: boolean
          poids_unitaire?: number | null
          search_vector?: unknown
          unite?: string
          unite_base?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          code_erp?: string | null
          created_at?: string
          description?: string | null
          designation?: string
          family_id?: string | null
          id?: string
          is_active?: boolean
          poids_unitaire?: number | null
          search_vector?: unknown
          unite?: string
          unite_base?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          poste: string | null
          public_access: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          poste?: string | null
          public_access?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          poste?: string | null
          public_access?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quality_action_categories: {
        Row: {
          code: string
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quality_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["quality_action_type"]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          nc_id: string | null
          of_id: string | null
          priority: Database["public"]["Enums"]["quality_action_priority"]
          responsible_user_id: string | null
          search_vector: unknown
          status: Database["public"]["Enums"]["quality_action_status"]
          title: string
          updated_at: string
          verification_comment: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["quality_action_type"]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          nc_id?: string | null
          of_id?: string | null
          priority?: Database["public"]["Enums"]["quality_action_priority"]
          responsible_user_id?: string | null
          search_vector?: unknown
          status?: Database["public"]["Enums"]["quality_action_status"]
          title: string
          updated_at?: string
          verification_comment?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["quality_action_type"]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          nc_id?: string | null
          of_id?: string | null
          priority?: Database["public"]["Enums"]["quality_action_priority"]
          responsible_user_id?: string | null
          search_vector?: unknown
          status?: Database["public"]["Enums"]["quality_action_status"]
          title?: string
          updated_at?: string
          verification_comment?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      quality_checks: {
        Row: {
          comment: string
          control_time: string
          controlled_by: string | null
          created_at: string
          deviation_percent: number | null
          deviation_value: number | null
          id: string
          indicator_id: string
          is_conform: boolean | null
          max_value: number | null
          measured_value_boolean: boolean | null
          measured_value_numeric: number | null
          measured_value_text: string | null
          min_value: number | null
          of_id: string
          product_id: string | null
          production_line_id: string | null
          quality_shift_id: string | null
          selected_value: string | null
          shift_id: string | null
          status: string
          target_value: number | null
          team_id: string | null
          unit: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          comment?: string
          control_time?: string
          controlled_by?: string | null
          created_at?: string
          deviation_percent?: number | null
          deviation_value?: number | null
          id?: string
          indicator_id: string
          is_conform?: boolean | null
          max_value?: number | null
          measured_value_boolean?: boolean | null
          measured_value_numeric?: number | null
          measured_value_text?: string | null
          min_value?: number | null
          of_id: string
          product_id?: string | null
          production_line_id?: string | null
          quality_shift_id?: string | null
          selected_value?: string | null
          shift_id?: string | null
          status?: string
          target_value?: number | null
          team_id?: string | null
          unit?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          comment?: string
          control_time?: string
          controlled_by?: string | null
          created_at?: string
          deviation_percent?: number | null
          deviation_value?: number | null
          id?: string
          indicator_id?: string
          is_conform?: boolean | null
          max_value?: number | null
          measured_value_boolean?: boolean | null
          measured_value_numeric?: number | null
          measured_value_text?: string | null
          min_value?: number | null
          of_id?: string
          product_id?: string | null
          production_line_id?: string | null
          quality_shift_id?: string | null
          selected_value?: string | null
          shift_id?: string | null
          status?: string
          target_value?: number | null
          team_id?: string | null
          unit?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "quality_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_quality_shift_id_fkey"
            columns: ["quality_shift_id"]
            isOneToOne: false
            referencedRelation: "quality_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "shift_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_control_point_lines: {
        Row: {
          control_point_id: string
          created_at: string
          created_by: string | null
          id: string
          production_line_id: string
        }
        Insert: {
          control_point_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          production_line_id: string
        }
        Update: {
          control_point_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          production_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_control_point_lines_control_point_id_fkey"
            columns: ["control_point_id"]
            isOneToOne: false
            referencedRelation: "quality_control_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_control_point_lines_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_control_point_ofs: {
        Row: {
          control_point_id: string
          created_at: string
          created_by: string | null
          id: string
          of_id: string
        }
        Insert: {
          control_point_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          of_id: string
        }
        Update: {
          control_point_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          of_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_control_point_ofs_control_point_id_fkey"
            columns: ["control_point_id"]
            isOneToOne: false
            referencedRelation: "quality_control_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_control_point_ofs_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_control_points: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          production_line_id: string | null
          scope: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          production_line_id?: string | null
          scope?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          production_line_id?: string | null
          scope?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quality_decision_reasons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          decision_type: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          decision_type?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          decision_type?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quality_defect_types: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          default_severity: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          default_severity?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          default_severity?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quality_indicator_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          frequency_minutes: number | null
          frequency_type:
            | Database["public"]["Enums"]["quality_frequency_type"]
            | null
          id: string
          indicator_id: string
          is_blocking: boolean
          is_required: boolean
          notes: string
          product_family_id: string | null
          product_id: string | null
          production_line_id: string | null
          recipe_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency_minutes?: number | null
          frequency_type?:
            | Database["public"]["Enums"]["quality_frequency_type"]
            | null
          id?: string
          indicator_id: string
          is_blocking?: boolean
          is_required?: boolean
          notes?: string
          product_family_id?: string | null
          product_id?: string | null
          production_line_id?: string | null
          recipe_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency_minutes?: number | null
          frequency_type?:
            | Database["public"]["Enums"]["quality_frequency_type"]
            | null
          id?: string
          indicator_id?: string
          is_blocking?: boolean
          is_required?: boolean
          notes?: string
          product_family_id?: string | null
          product_id?: string | null
          production_line_id?: string | null
          recipe_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_indicator_assignments_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "quality_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_indicator_assignments_product_family_id_fkey"
            columns: ["product_family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_indicator_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_indicator_assignments_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_indicator_assignments_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_indicators: {
        Row: {
          category: Database["public"]["Enums"]["quality_indicator_category"]
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          frequency_minutes: number | null
          frequency_type: Database["public"]["Enums"]["quality_frequency_type"]
          id: string
          indicator_type: Database["public"]["Enums"]["quality_indicator_type"]
          is_active: boolean
          is_blocking: boolean
          is_required: boolean
          max_value: number | null
          min_value: number | null
          name: string
          select_options: Json | null
          target_value: number | null
          tolerance_minus: number | null
          tolerance_plus: number | null
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["quality_indicator_category"]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency_minutes?: number | null
          frequency_type?: Database["public"]["Enums"]["quality_frequency_type"]
          id?: string
          indicator_type: Database["public"]["Enums"]["quality_indicator_type"]
          is_active?: boolean
          is_blocking?: boolean
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          name: string
          select_options?: Json | null
          target_value?: number | null
          tolerance_minus?: number | null
          tolerance_plus?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["quality_indicator_category"]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency_minutes?: number | null
          frequency_type?: Database["public"]["Enums"]["quality_frequency_type"]
          id?: string
          indicator_type?: Database["public"]["Enums"]["quality_indicator_type"]
          is_active?: boolean
          is_blocking?: boolean
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          name?: string
          select_options?: Json | null
          target_value?: number | null
          tolerance_minus?: number | null
          tolerance_plus?: number | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quality_lot_investigation_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          investigation_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          investigation_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          investigation_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_lot_investigation_logs_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "quality_lot_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_lot_investigations: {
        Row: {
          analysis: string | null
          anomaly_description: string | null
          closed_at: string | null
          closed_by: string | null
          conclusion: string | null
          created_at: string
          created_by: string | null
          id: string
          investigation_number: string | null
          lot_reference: string | null
          nc_id: string | null
          product_id: string | null
          production_date: string
          production_time: string
          reopened_at: string | null
          status: string
          updated_at: string
          window_hours: number
        }
        Insert: {
          analysis?: string | null
          anomaly_description?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conclusion?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          investigation_number?: string | null
          lot_reference?: string | null
          nc_id?: string | null
          product_id?: string | null
          production_date: string
          production_time: string
          reopened_at?: string | null
          status?: string
          updated_at?: string
          window_hours?: number
        }
        Update: {
          analysis?: string | null
          anomaly_description?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conclusion?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          investigation_number?: string | null
          lot_reference?: string | null
          nc_id?: string | null
          product_id?: string | null
          production_date?: string
          production_time?: string
          reopened_at?: string | null
          status?: string
          updated_at?: string
          window_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_lot_investigations_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "quality_non_conformities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_lot_investigations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_nc_categories: {
        Row: {
          code: string
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quality_non_conformities: {
        Row: {
          affected_quantity: number | null
          article_id: string | null
          batch_number: string | null
          closed_at: string | null
          closed_by: string | null
          closure_comment: string | null
          created_at: string
          decision: Database["public"]["Enums"]["nc_decision"] | null
          decision_at: string | null
          decision_by: string | null
          declared_by: string | null
          description: string | null
          detected_at: string
          detected_quantity: number | null
          id: string
          immediate_action: string | null
          lot_number: string | null
          metadata: Json | null
          nc_category: string | null
          nc_number: string | null
          nc_type: Database["public"]["Enums"]["nc_type"]
          of_id: string | null
          packaging_article_id: string | null
          product_id: string | null
          production_line_id: string | null
          quality_check_id: string | null
          quality_shift_id: string | null
          root_cause: string | null
          search_vector: unknown
          severity: Database["public"]["Enums"]["nc_severity"]
          shift_id: string | null
          status: Database["public"]["Enums"]["nc_status"]
          team_id: string | null
          title: string
          unit: string | null
          updated_at: string
          validation_status: string
        }
        Insert: {
          affected_quantity?: number | null
          article_id?: string | null
          batch_number?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_comment?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["nc_decision"] | null
          decision_at?: string | null
          decision_by?: string | null
          declared_by?: string | null
          description?: string | null
          detected_at?: string
          detected_quantity?: number | null
          id?: string
          immediate_action?: string | null
          lot_number?: string | null
          metadata?: Json | null
          nc_category?: string | null
          nc_number?: string | null
          nc_type: Database["public"]["Enums"]["nc_type"]
          of_id?: string | null
          packaging_article_id?: string | null
          product_id?: string | null
          production_line_id?: string | null
          quality_check_id?: string | null
          quality_shift_id?: string | null
          root_cause?: string | null
          search_vector?: unknown
          severity?: Database["public"]["Enums"]["nc_severity"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["nc_status"]
          team_id?: string | null
          title: string
          unit?: string | null
          updated_at?: string
          validation_status?: string
        }
        Update: {
          affected_quantity?: number | null
          article_id?: string | null
          batch_number?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_comment?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["nc_decision"] | null
          decision_at?: string | null
          decision_by?: string | null
          declared_by?: string | null
          description?: string | null
          detected_at?: string
          detected_quantity?: number | null
          id?: string
          immediate_action?: string | null
          lot_number?: string | null
          metadata?: Json | null
          nc_category?: string | null
          nc_number?: string | null
          nc_type?: Database["public"]["Enums"]["nc_type"]
          of_id?: string | null
          packaging_article_id?: string | null
          product_id?: string | null
          production_line_id?: string | null
          quality_check_id?: string | null
          quality_shift_id?: string | null
          root_cause?: string | null
          search_vector?: unknown
          severity?: Database["public"]["Enums"]["nc_severity"]
          shift_id?: string | null
          status?: Database["public"]["Enums"]["nc_status"]
          team_id?: string | null
          title?: string
          unit?: string | null
          updated_at?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_non_conformities_quality_shift_id_fkey"
            columns: ["quality_shift_id"]
            isOneToOne: false
            referencedRelation: "quality_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_of_indicator_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          frequency_minutes: number | null
          id: string
          indicator_id: string
          is_blocking: boolean
          is_required: boolean
          mode: string
          notes: string
          of_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          frequency_minutes?: number | null
          id?: string
          indicator_id: string
          is_blocking?: boolean
          is_required?: boolean
          mode: string
          notes?: string
          of_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          frequency_minutes?: number | null
          id?: string
          indicator_id?: string
          is_blocking?: boolean
          is_required?: boolean
          mode?: string
          notes?: string
          of_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_of_indicator_overrides_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "quality_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_of_indicator_overrides_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_permissions: {
        Row: {
          can_close_action: boolean
          can_close_nc: boolean
          can_create_action: boolean
          can_create_check: boolean
          can_create_nc: boolean
          can_decide_nc: boolean
          can_export_tracability: boolean
          can_manage_assignments: boolean
          can_manage_indicators: boolean
          can_publish_bom: boolean
          can_publish_recipe: boolean
          can_reject_check: boolean
          can_validate_check: boolean
          can_verify_action: boolean
          can_view_reports: boolean
          created_at: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          can_close_action?: boolean
          can_close_nc?: boolean
          can_create_action?: boolean
          can_create_check?: boolean
          can_create_nc?: boolean
          can_decide_nc?: boolean
          can_export_tracability?: boolean
          can_manage_assignments?: boolean
          can_manage_indicators?: boolean
          can_publish_bom?: boolean
          can_publish_recipe?: boolean
          can_reject_check?: boolean
          can_validate_check?: boolean
          can_verify_action?: boolean
          can_view_reports?: boolean
          created_at?: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          can_close_action?: boolean
          can_close_nc?: boolean
          can_create_action?: boolean
          can_create_check?: boolean
          can_create_nc?: boolean
          can_decide_nc?: boolean
          can_export_tracability?: boolean
          can_manage_assignments?: boolean
          can_manage_indicators?: boolean
          can_publish_bom?: boolean
          can_publish_recipe?: boolean
          can_reject_check?: boolean
          can_validate_check?: boolean
          can_verify_action?: boolean
          can_view_reports?: boolean
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      quality_shift_assignments: {
        Row: {
          all_open_ofs: boolean
          controller_id: string
          created_at: string
          created_by: string | null
          id: string
          line_ids: string[]
          of_ids: string[]
          shift_team_id: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at: string
        }
        Insert: {
          all_open_ofs?: boolean
          controller_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          line_ids?: string[]
          of_ids?: string[]
          shift_team_id?: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
        }
        Update: {
          all_open_ofs?: boolean
          controller_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          line_ids?: string[]
          of_ids?: string[]
          shift_team_id?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_shift_assignments_shift_team_id_fkey"
            columns: ["shift_team_id"]
            isOneToOne: false
            referencedRelation: "shift_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_shift_lines: {
        Row: {
          production_line_id: string
          quality_shift_id: string
        }
        Insert: {
          production_line_id: string
          quality_shift_id: string
        }
        Update: {
          production_line_id?: string
          quality_shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_shift_lines_production_line_id_fkey"
            columns: ["production_line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_shift_lines_quality_shift_id_fkey"
            columns: ["quality_shift_id"]
            isOneToOne: false
            referencedRelation: "quality_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_shift_pins: {
        Row: {
          created_at: string
          id: string
          indicator_id: string
          of_id: string
          pinned_by: string | null
          quality_shift_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicator_id: string
          of_id: string
          pinned_by?: string | null
          quality_shift_id: string
        }
        Update: {
          created_at?: string
          id?: string
          indicator_id?: string
          of_id?: string
          pinned_by?: string | null
          quality_shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_shift_pins_quality_shift_id_fkey"
            columns: ["quality_shift_id"]
            isOneToOne: false
            referencedRelation: "quality_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_shift_production_links: {
        Row: {
          linked_at: string
          production_shift_id: string
          quality_shift_id: string
        }
        Insert: {
          linked_at?: string
          production_shift_id: string
          quality_shift_id: string
        }
        Update: {
          linked_at?: string
          production_shift_id?: string
          quality_shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_shift_production_links_production_shift_id_fkey"
            columns: ["production_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_shift_production_links_quality_shift_id_fkey"
            columns: ["quality_shift_id"]
            isOneToOne: false
            referencedRelation: "quality_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_shifts: {
        Row: {
          controller_id: string
          created_at: string
          date_shift: string
          heure_debut: string
          heure_fin: string | null
          id: string
          intervention_reason: string | null
          is_active: boolean
          is_self_intervention: boolean
          observations: string | null
          opened_by: string | null
          shift_team_id: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at: string
        }
        Insert: {
          controller_id: string
          created_at?: string
          date_shift?: string
          heure_debut?: string
          heure_fin?: string | null
          id?: string
          intervention_reason?: string | null
          is_active?: boolean
          is_self_intervention?: boolean
          observations?: string | null
          opened_by?: string | null
          shift_team_id?: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
        }
        Update: {
          controller_id?: string
          created_at?: string
          date_shift?: string
          heure_debut?: string
          heure_fin?: string | null
          id?: string
          intervention_reason?: string | null
          is_active?: boolean
          is_self_intervention?: boolean
          observations?: string | null
          opened_by?: string | null
          shift_team_id?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_shifts_shift_team_id_fkey"
            columns: ["shift_team_id"]
            isOneToOne: false
            referencedRelation: "shift_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_units: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          symbol: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          symbol: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          symbol?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reception_campaigns: {
        Row: {
          actif: boolean
          code: string
          created_at: string
          created_by: string | null
          date_debut: string
          date_fin: string
          id: string
          is_default: boolean
          kpi_targets: Json
          libelle: string
          objectif_kg: number | null
          product_id: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          date_debut: string
          date_fin: string
          id?: string
          is_default?: boolean
          kpi_targets?: Json
          libelle: string
          objectif_kg?: number | null
          product_id: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string
          id?: string
          is_default?: boolean
          kpi_targets?: Json
          libelle?: string
          objectif_kg?: number | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reception_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["product_id"]
          },
        ]
      }
      reception_products: {
        Row: {
          actif: boolean
          calibres: string[]
          caracteristiques: Json
          code: string
          code_digits: number | null
          code_prefix: string | null
          created_at: string
          created_by: string | null
          description: string | null
          designation: string
          id: string
          normes: string[]
          updated_at: string
          varietes: string[]
        }
        Insert: {
          actif?: boolean
          calibres?: string[]
          caracteristiques?: Json
          code: string
          code_digits?: number | null
          code_prefix?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          designation: string
          id?: string
          normes?: string[]
          updated_at?: string
          varietes?: string[]
        }
        Update: {
          actif?: boolean
          calibres?: string[]
          caracteristiques?: Json
          code?: string
          code_digits?: number | null
          code_prefix?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          designation?: string
          id?: string
          normes?: string[]
          updated_at?: string
          varietes?: string[]
        }
        Relationships: []
      }
      reception_suppliers: {
        Row: {
          actif: boolean
          adresse: string | null
          agree: boolean
          code: string
          contact: string | null
          created_at: string
          created_by: string | null
          id: string
          nom: string
          notes: string | null
          region: string | null
          telephone: string | null
          updated_at: string
          wilaya: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          agree?: boolean
          code: string
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nom: string
          notes?: string | null
          region?: string | null
          telephone?: string | null
          updated_at?: string
          wilaya?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          agree?: boolean
          code?: string
          contact?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nom?: string
          notes?: string | null
          region?: string | null
          telephone?: string | null
          updated_at?: string
          wilaya?: string | null
        }
        Relationships: []
      }
      reception_ticket_orientations: {
        Row: {
          created_at: string
          explication: string | null
          id: string
          taux_recommande: number
          ticket_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          explication?: string | null
          id?: string
          taux_recommande: number
          ticket_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          explication?: string | null
          id?: string
          taux_recommande?: number
          ticket_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_ticket_orientations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "reception_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_ticket_orientations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_ticket_orientations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "v_reception_ticket_orientations_summary"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      reception_ticket_photos: {
        Row: {
          id: string
          slot: number
          storage_path: string
          ticket_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          slot: number
          storage_path: string
          ticket_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          slot?: number
          storage_path?: string
          ticket_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reception_ticket_photos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "reception_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_ticket_photos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_ticket_photos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "v_reception_ticket_orientations_summary"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      reception_tickets: {
        Row: {
          annule_at: string | null
          annule_by: string | null
          campaign_id: string
          cloture_at: string | null
          cloture_by: string | null
          commentaire: string | null
          created_at: string
          created_by: string | null
          date_ticket: string
          heure_debut: string | null
          heure_fin: string | null
          id: string
          motif_annulation: string | null
          numero: string
          product_id: string
          statut: string
          supplier_id: string
          taux_abattement: number
          updated_at: string
        }
        Insert: {
          annule_at?: string | null
          annule_by?: string | null
          campaign_id: string
          cloture_at?: string | null
          cloture_by?: string | null
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          date_ticket?: string
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          motif_annulation?: string | null
          numero?: string
          product_id: string
          statut?: string
          supplier_id: string
          taux_abattement?: number
          updated_at?: string
        }
        Update: {
          annule_at?: string | null
          annule_by?: string | null
          campaign_id?: string
          cloture_at?: string | null
          cloture_by?: string | null
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          date_ticket?: string
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          motif_annulation?: string | null
          numero?: string
          product_id?: string
          statut?: string
          supplier_id?: string
          taux_abattement?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_tickets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "reception_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_tickets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "reception_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reception_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reception_tickets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "reception_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_tickets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      reception_weighings: {
        Row: {
          code_pesee: string
          code_saisi: string | null
          created_at: string
          id: string
          poids_abattement_kg: number | null
          poids_brut_kg: number
          poids_net_kg: number | null
          taux_abattement_snapshot: number
          ticket_id: string
          updated_at: string
          weighed_at: string
          weighed_by: string | null
        }
        Insert: {
          code_pesee?: string
          code_saisi?: string | null
          created_at?: string
          id?: string
          poids_abattement_kg?: number | null
          poids_brut_kg: number
          poids_net_kg?: number | null
          taux_abattement_snapshot: number
          ticket_id: string
          updated_at?: string
          weighed_at?: string
          weighed_by?: string | null
        }
        Update: {
          code_pesee?: string
          code_saisi?: string | null
          created_at?: string
          id?: string
          poids_abattement_kg?: number | null
          poids_brut_kg?: number
          poids_net_kg?: number | null
          taux_abattement_snapshot?: number
          ticket_id?: string
          updated_at?: string
          weighed_at?: string
          weighed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reception_weighings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "reception_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_weighings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "v_reception_global"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_weighings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "v_reception_ticket_orientations_summary"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      recipe_lines: {
        Row: {
          article_id: string
          created_at: string
          id: string
          is_mandatory: boolean
          is_quality_sensitive: boolean
          item_type: string
          quantite: number
          recipe_id: string
          unite: string
          waste_percent: number | null
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          is_quality_sensitive?: boolean
          item_type?: string
          quantite?: number
          recipe_id: string
          unite?: string
          waste_percent?: number | null
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          is_mandatory?: boolean
          is_quality_sensitive?: boolean
          item_type?: string
          quantite?: number
          recipe_id?: string
          unite?: string
          waste_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_lines_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_lines_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          created_at: string
          created_by: string | null
          critical_control_point: boolean
          description: string | null
          expected_duration_minutes: number | null
          id: string
          process_parameter: Json | null
          quality_indicator_id: string | null
          recipe_id: string
          step_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          critical_control_point?: boolean
          description?: string | null
          expected_duration_minutes?: number | null
          id?: string
          process_parameter?: Json | null
          quality_indicator_id?: string | null
          recipe_id: string
          step_order: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          critical_control_point?: boolean
          description?: string | null
          expected_duration_minutes?: number | null
          id?: string
          process_parameter?: Json | null
          quality_indicator_id?: string | null
          recipe_id?: string
          step_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_quality_indicator_id_fkey"
            columns: ["quality_indicator_id"]
            isOneToOne: false
            referencedRelation: "quality_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          product_id: string
          search_vector: unknown
          status: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          product_id: string
          search_vector?: unknown
          status?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          product_id?: string
          search_vector?: unknown
          status?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      scan_history: {
        Row: {
          code_format: string | null
          context: string | null
          entity_code: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          match_quality: string | null
          matches_count: number
          normalized_value: string | null
          outcome: string
          raw_value: string
          scanned_at: string
          search_vector: unknown
          source: string
          user_id: string
        }
        Insert: {
          code_format?: string | null
          context?: string | null
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          match_quality?: string | null
          matches_count?: number
          normalized_value?: string | null
          outcome: string
          raw_value: string
          scanned_at?: string
          search_vector?: unknown
          source?: string
          user_id?: string
        }
        Update: {
          code_format?: string | null
          context?: string | null
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          match_quality?: string | null
          matches_count?: number
          normalized_value?: string | null
          outcome?: string
          raw_value?: string
          scanned_at?: string
          search_vector?: unknown
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      shift_mode_slots: {
        Row: {
          created_at: string
          heure_debut: string
          heure_fin: string
          id: string
          label: string
          shift_mode_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          heure_debut: string
          heure_fin: string
          id?: string
          label: string
          shift_mode_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          heure_debut?: string
          heure_fin?: string
          id?: string
          label?: string
          shift_mode_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_mode_slots_shift_mode_id_fkey"
            columns: ["shift_mode_id"]
            isOneToOne: false
            referencedRelation: "shift_modes"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_modes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          nb_shifts: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label: string
          nb_shifts?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          nb_shifts?: number
          updated_at?: string
        }
        Relationships: []
      }
      shift_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label?: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      shift_team_members: {
        Row: {
          anchor_date: string | null
          autorisation_libre: boolean
          created_at: string
          created_by: string | null
          cycle_pattern: string[]
          id: string
          is_active: boolean
          role_in_team: string
          scope_kind: string
          shift_mode_id: string | null
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_date?: string | null
          autorisation_libre?: boolean
          created_at?: string
          created_by?: string | null
          cycle_pattern?: string[]
          id?: string
          is_active?: boolean
          role_in_team?: string
          scope_kind?: string
          shift_mode_id?: string | null
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_date?: string | null
          autorisation_libre?: boolean
          created_at?: string
          created_by?: string | null
          cycle_pattern?: string[]
          id?: string
          is_active?: boolean
          role_in_team?: string
          scope_kind?: string
          shift_mode_id?: string | null
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_team_members_shift_mode_id_fkey"
            columns: ["shift_mode_id"]
            isOneToOne: false
            referencedRelation: "shift_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "shift_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_teams: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shift_templates: {
        Row: {
          code: string
          couleur: string | null
          created_at: string
          created_by: string | null
          crosses_midnight: boolean
          heure_debut: string
          heure_fin: string
          id: string
          is_active: boolean
          label: string
          shift_mode_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          couleur?: string | null
          created_at?: string
          created_by?: string | null
          crosses_midnight?: boolean
          heure_debut: string
          heure_fin: string
          id?: string
          is_active?: boolean
          label: string
          shift_mode_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          couleur?: string | null
          created_at?: string
          created_by?: string | null
          crosses_midnight?: boolean
          heure_debut?: string
          heure_fin?: string
          id?: string
          is_active?: boolean
          label?: string
          shift_mode_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_shift_mode_id_fkey"
            columns: ["shift_mode_id"]
            isOneToOne: false
            referencedRelation: "shift_modes"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          chef_ligne_id: string | null
          created_at: string
          date_shift: string
          heure_debut: string
          heure_debut_reelle: string | null
          heure_fin: string
          heure_fin_reelle: string | null
          id: string
          is_active: boolean
          line_id: string
          observations: string | null
          of_id: string
          opened_by: string | null
          shift_team_id: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          statut: string
          updated_at: string
        }
        Insert: {
          chef_ligne_id?: string | null
          created_at?: string
          date_shift: string
          heure_debut: string
          heure_debut_reelle?: string | null
          heure_fin: string
          heure_fin_reelle?: string | null
          id?: string
          is_active?: boolean
          line_id: string
          observations?: string | null
          of_id: string
          opened_by?: string | null
          shift_team_id?: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          statut?: string
          updated_at?: string
        }
        Update: {
          chef_ligne_id?: string | null
          created_at?: string
          date_shift?: string
          heure_debut?: string
          heure_debut_reelle?: string | null
          heure_fin?: string
          heure_fin_reelle?: string | null
          id?: string
          is_active?: boolean
          line_id?: string
          observations?: string | null
          of_id?: string
          opened_by?: string | null
          shift_team_id?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_shift_team_id_fkey"
            columns: ["shift_team_id"]
            isOneToOne: false
            referencedRelation: "shift_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_collaborators: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          removed_at: string | null
          removed_by: string | null
          role_label: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          role_label?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          role_label?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assignee_id: string | null
          assignment_status:
            | Database["public"]["Enums"]["ticket_assignment_status"]
            | null
          cause_racine: string | null
          created_at: string
          declarant_id: string | null
          description: string
          equipement_id: string | null
          heure_cloture: string | null
          heure_declaration: string
          heure_prise_en_charge: string | null
          heure_resolution: string | null
          id: string
          is_from_gpao: boolean | null
          ligne_id: string | null
          machine_id: string
          numero: string
          of_id: string | null
          organe_id: string | null
          panne_type_id: string | null
          priorite: Database["public"]["Enums"]["ticket_priorite"]
          quality_check_id: string | null
          quality_nc_id: string | null
          quality_production_decision: string | null
          quality_risk: boolean
          quality_risk_declared_at: string | null
          quality_risk_declared_by: string | null
          quality_risk_level: string | null
          quality_risk_note: string | null
          quality_shift_id: string | null
          search_vector: unknown
          shift_id: string | null
          solution: string | null
          statut: Database["public"]["Enums"]["ticket_statut"]
          temps_arret_minutes: number | null
          temps_intervention_minutes: number | null
          updated_at: string
          validation_request_id: string | null
          validation_status: string | null
        }
        Insert: {
          assignee_id?: string | null
          assignment_status?:
            | Database["public"]["Enums"]["ticket_assignment_status"]
            | null
          cause_racine?: string | null
          created_at?: string
          declarant_id?: string | null
          description?: string
          equipement_id?: string | null
          heure_cloture?: string | null
          heure_declaration?: string
          heure_prise_en_charge?: string | null
          heure_resolution?: string | null
          id?: string
          is_from_gpao?: boolean | null
          ligne_id?: string | null
          machine_id: string
          numero: string
          of_id?: string | null
          organe_id?: string | null
          panne_type_id?: string | null
          priorite?: Database["public"]["Enums"]["ticket_priorite"]
          quality_check_id?: string | null
          quality_nc_id?: string | null
          quality_production_decision?: string | null
          quality_risk?: boolean
          quality_risk_declared_at?: string | null
          quality_risk_declared_by?: string | null
          quality_risk_level?: string | null
          quality_risk_note?: string | null
          quality_shift_id?: string | null
          search_vector?: unknown
          shift_id?: string | null
          solution?: string | null
          statut?: Database["public"]["Enums"]["ticket_statut"]
          temps_arret_minutes?: number | null
          temps_intervention_minutes?: number | null
          updated_at?: string
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Update: {
          assignee_id?: string | null
          assignment_status?:
            | Database["public"]["Enums"]["ticket_assignment_status"]
            | null
          cause_racine?: string | null
          created_at?: string
          declarant_id?: string | null
          description?: string
          equipement_id?: string | null
          heure_cloture?: string | null
          heure_declaration?: string
          heure_prise_en_charge?: string | null
          heure_resolution?: string | null
          id?: string
          is_from_gpao?: boolean | null
          ligne_id?: string | null
          machine_id?: string
          numero?: string
          of_id?: string | null
          organe_id?: string | null
          panne_type_id?: string | null
          priorite?: Database["public"]["Enums"]["ticket_priorite"]
          quality_check_id?: string | null
          quality_nc_id?: string | null
          quality_production_decision?: string | null
          quality_risk?: boolean
          quality_risk_declared_at?: string | null
          quality_risk_declared_by?: string | null
          quality_risk_level?: string | null
          quality_risk_note?: string | null
          quality_shift_id?: string | null
          search_vector?: unknown
          shift_id?: string | null
          solution?: string | null
          statut?: Database["public"]["Enums"]["ticket_statut"]
          temps_arret_minutes?: number | null
          temps_intervention_minutes?: number | null
          updated_at?: string
          validation_request_id?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ligne_id_fkey"
            columns: ["ligne_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_of_id_fkey"
            columns: ["of_id"]
            isOneToOne: false
            referencedRelation: "ordres_fabrication"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organe_id_fkey"
            columns: ["organe_id"]
            isOneToOne: false
            referencedRelation: "organes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_panne_type_id_fkey"
            columns: ["panne_type_id"]
            isOneToOne: false
            referencedRelation: "panne_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_preferences: {
        Row: {
          created_at: string
          default_dashboard_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_dashboard_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_dashboard_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_preferences_default_dashboard_id_fkey"
            columns: ["default_dashboard_id"]
            isOneToOne: false
            referencedRelation: "direction_dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_accounts: {
        Row: {
          connected_at: string | null
          created_at: string
          display_name: string | null
          email: string
          encrypted_password: string | null
          id: string
          is_connected: boolean
          last_error: string | null
          provider: string
          smtp_host: string | null
          smtp_port: number | null
          smtp_secure: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          encrypted_password?: string | null
          id?: string
          is_connected?: boolean
          last_error?: string | null
          provider?: string
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          encrypted_password?: string | null
          id?: string
          is_connected?: boolean
          last_error?: string | null
          provider?: string
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          minimum_severity: Database["public"]["Enums"]["notification_severity"]
          module: string | null
          muted: boolean
          notification_type: string | null
          push_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          minimum_severity?: Database["public"]["Enums"]["notification_severity"]
          module?: string | null
          muted?: boolean
          notification_type?: string | null
          push_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          minimum_severity?: Database["public"]["Enums"]["notification_severity"]
          module?: string | null
          muted?: boolean
          notification_type?: string | null
          push_enabled?: boolean | null
          updated_at?: string
          user_id?: string
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
      validation_permissions: {
        Row: {
          approve: boolean
          cancel: boolean
          configure_rules: boolean
          created_at: string
          id: string
          reject: boolean
          role: string
          submit: boolean
          updated_at: string
          view_all: boolean
          view_own: boolean
          view_technical_details: boolean
        }
        Insert: {
          approve?: boolean
          cancel?: boolean
          configure_rules?: boolean
          created_at?: string
          id?: string
          reject?: boolean
          role: string
          submit?: boolean
          updated_at?: string
          view_all?: boolean
          view_own?: boolean
          view_technical_details?: boolean
        }
        Update: {
          approve?: boolean
          cancel?: boolean
          configure_rules?: boolean
          created_at?: string
          id?: string
          reject?: boolean
          role?: string
          submit?: boolean
          updated_at?: string
          view_all?: boolean
          view_own?: boolean
          view_technical_details?: boolean
        }
        Relationships: []
      }
      validation_requests: {
        Row: {
          action_url: string | null
          applied_at: string | null
          archived_at: string | null
          assigned_validator_role: string | null
          assigned_validator_user_id: string | null
          cancelled_at: string | null
          changed_fields: Json | null
          created_at: string
          description: string | null
          enforcement: Database["public"]["Enums"]["validation_enforcement"]
          entity_code: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          is_blocking: boolean
          justification: string | null
          metadata: Json | null
          module: string
          old_values: Json | null
          priority: Database["public"]["Enums"]["validation_priority"]
          proposed_values: Json | null
          rejected_at: string | null
          rejected_by_user_id: string | null
          rejection_reason: string | null
          request_type: string
          requested_action: string
          rule_id: string | null
          search_vector: unknown
          source: string
          status: Database["public"]["Enums"]["validation_status_enum"]
          submitted_at: string | null
          submitted_by_email: string | null
          submitted_by_name: string | null
          submitted_by_user_id: string | null
          target_record_id: string | null
          title: string
          updated_at: string
          validated_at: string | null
          validated_by_user_id: string | null
          validation_comment: string | null
        }
        Insert: {
          action_url?: string | null
          applied_at?: string | null
          archived_at?: string | null
          assigned_validator_role?: string | null
          assigned_validator_user_id?: string | null
          cancelled_at?: string | null
          changed_fields?: Json | null
          created_at?: string
          description?: string | null
          enforcement?: Database["public"]["Enums"]["validation_enforcement"]
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          is_blocking?: boolean
          justification?: string | null
          metadata?: Json | null
          module: string
          old_values?: Json | null
          priority?: Database["public"]["Enums"]["validation_priority"]
          proposed_values?: Json | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          request_type: string
          requested_action: string
          rule_id?: string | null
          search_vector?: unknown
          source?: string
          status?: Database["public"]["Enums"]["validation_status_enum"]
          submitted_at?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          submitted_by_user_id?: string | null
          target_record_id?: string | null
          title: string
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
          validation_comment?: string | null
        }
        Update: {
          action_url?: string | null
          applied_at?: string | null
          archived_at?: string | null
          assigned_validator_role?: string | null
          assigned_validator_user_id?: string | null
          cancelled_at?: string | null
          changed_fields?: Json | null
          created_at?: string
          description?: string | null
          enforcement?: Database["public"]["Enums"]["validation_enforcement"]
          entity_code?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          is_blocking?: boolean
          justification?: string | null
          metadata?: Json | null
          module?: string
          old_values?: Json | null
          priority?: Database["public"]["Enums"]["validation_priority"]
          proposed_values?: Json | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          request_type?: string
          requested_action?: string
          rule_id?: string | null
          search_vector?: unknown
          source?: string
          status?: Database["public"]["Enums"]["validation_status_enum"]
          submitted_at?: string | null
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          submitted_by_user_id?: string | null
          target_record_id?: string | null
          title?: string
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
          validation_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validation_requests_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "validation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_rules: {
        Row: {
          action_type: string
          auto_approve_if_low_risk: boolean
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          enforcement: Database["public"]["Enums"]["validation_enforcement"]
          entity_type: string | null
          id: string
          is_active: boolean
          is_required: boolean
          module: string
          name: string
          priority: Database["public"]["Enums"]["validation_priority"]
          updated_at: string
          updated_by: string | null
          validator_roles: Json
          validator_users: Json | null
        }
        Insert: {
          action_type: string
          auto_approve_if_low_risk?: boolean
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enforcement?: Database["public"]["Enums"]["validation_enforcement"]
          entity_type?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          module: string
          name: string
          priority?: Database["public"]["Enums"]["validation_priority"]
          updated_at?: string
          updated_by?: string | null
          validator_roles?: Json
          validator_users?: Json | null
        }
        Update: {
          action_type?: string
          auto_approve_if_low_risk?: boolean
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enforcement?: Database["public"]["Enums"]["validation_enforcement"]
          entity_type?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          module?: string
          name?: string
          priority?: Database["public"]["Enums"]["validation_priority"]
          updated_at?: string
          updated_by?: string | null
          validator_roles?: Json
          validator_users?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      pdr_position_status: {
        Row: {
          compteur_actuel: number | null
          compteur_max: number | null
          compteur_restant: number | null
          current_instance_id: string | null
          date_dernier_changement: string | null
          date_pose: string | null
          designation: string | null
          entity_id: string | null
          entity_type: string | null
          last_ticket_id: string | null
          lifespan_mode: string | null
          link_id: string | null
          niveau: string | null
          pct_consomme: number | null
          pdr_id: string | null
          position_id: string | null
          production_coefficient: number | null
          production_rule: string | null
          seuil_alerte_pct: number | null
          seuil_max: number | null
          seuil_min: number | null
          statut: string | null
          unite_mesure: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_entity_links_pdr_id_fkey"
            columns: ["pdr_id"]
            isOneToOne: false
            referencedRelation: "pdr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_install_positions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "pdr_entity_links"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reception_global: {
        Row: {
          campagne: string | null
          campaign_id: string | null
          cloture_at: string | null
          cloture_by: string | null
          cloture_by_name: string | null
          code_digits: number | null
          code_pesee: string | null
          code_prefix: string | null
          code_saisi: string | null
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          date_ticket: string | null
          duree_minutes: number | null
          etat_pesee: string | null
          fournisseur: string | null
          heure_debut: string | null
          heure_fin: string | null
          id: string | null
          nb_photos: number | null
          numero: string | null
          objectif_kg: number | null
          poids_abattement_kg: number | null
          poids_brut_kg: number | null
          poids_net_kg: number | null
          product_id: string | null
          produit: string | null
          produit_code: string | null
          region: string | null
          statut: string | null
          supplier_code: string | null
          supplier_id: string | null
          taux_abattement: number | null
          weighed_at: string | null
          weighing_id: string | null
          wilaya: string | null
        }
        Relationships: []
      }
      v_reception_orientations: {
        Row: {
          author_name: string | null
          campagne_nom: string | null
          campaign_id: string | null
          created_at: string | null
          explication: string | null
          id: string | null
          product_id: string | null
          produit_nom: string | null
          taux_recommande: number | null
          ticket_date: string | null
          ticket_id: string | null
          ticket_numero: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reception_ticket_orientations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "reception_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_ticket_orientations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_ticket_orientations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "v_reception_ticket_orientations_summary"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "reception_tickets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "reception_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_tickets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "reception_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reception_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_reception_ticket_orientations_summary: {
        Row: {
          campagne_nom: string | null
          campaign_id: string | null
          heure_debut: string | null
          last_orientation_at: string | null
          orientations: Json | null
          orientations_count: number | null
          poids_net_kg: number | null
          product_id: string | null
          produit_nom: string | null
          taux_applique: number | null
          taux_moyen: number | null
          ticket_date: string | null
          ticket_id: string | null
          ticket_numero: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reception_tickets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "reception_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_tickets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "reception_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "reception_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_tickets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_reception_global"
            referencedColumns: ["product_id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_reception_ticket: {
        Args: { p_reason?: string; p_ticket_id: string }
        Returns: undefined
      }
      apply_maintenance_shift_schedules: { Args: never; Returns: string[] }
      attach_quality_risk_to_ticket: {
        Args: {
          p_check_id?: string
          p_decision?: string
          p_level?: string
          p_nc_id?: string
          p_note?: string
          p_shift_id?: string
          p_ticket_id: string
        }
        Returns: {
          assignee_id: string | null
          assignment_status:
            | Database["public"]["Enums"]["ticket_assignment_status"]
            | null
          cause_racine: string | null
          created_at: string
          declarant_id: string | null
          description: string
          equipement_id: string | null
          heure_cloture: string | null
          heure_declaration: string
          heure_prise_en_charge: string | null
          heure_resolution: string | null
          id: string
          is_from_gpao: boolean | null
          ligne_id: string | null
          machine_id: string
          numero: string
          of_id: string | null
          organe_id: string | null
          panne_type_id: string | null
          priorite: Database["public"]["Enums"]["ticket_priorite"]
          quality_check_id: string | null
          quality_nc_id: string | null
          quality_production_decision: string | null
          quality_risk: boolean
          quality_risk_declared_at: string | null
          quality_risk_declared_by: string | null
          quality_risk_level: string | null
          quality_risk_note: string | null
          quality_shift_id: string | null
          search_vector: unknown
          shift_id: string | null
          solution: string | null
          statut: Database["public"]["Enums"]["ticket_statut"]
          temps_arret_minutes: number | null
          temps_intervention_minutes: number | null
          updated_at: string
          validation_request_id: string | null
          validation_status: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_close_stale_shifts: {
        Args: never
        Returns: {
          closed_id: string
          kind: string
        }[]
      }
      can_manage_lot_investigation: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_manage_notification_rule: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      can_manage_shifts: { Args: { _user_id: string }; Returns: boolean }
      can_manage_validation_rule: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      can_validate_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_holding_transfer: {
        Args: { p_raison?: string; p_transfer_id: string }
        Returns: undefined
      }
      cancel_pdr_request: {
        Args: { p_motif?: string; p_request_id: string }
        Returns: undefined
      }
      cancel_reception_ticket: {
        Args: { _motif: string; _ticket_id: string }
        Returns: undefined
      }
      check_document_permission: {
        Args: { _action: string; _entity_type: string; _user_id: string }
        Returns: boolean
      }
      check_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      close_preventive_action: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      close_reception_ticket: {
        Args: { _ticket_id: string }
        Returns: {
          annule_at: string | null
          annule_by: string | null
          campaign_id: string
          cloture_at: string | null
          cloture_by: string | null
          commentaire: string | null
          created_at: string
          created_by: string | null
          date_ticket: string
          heure_debut: string | null
          heure_fin: string | null
          id: string
          motif_annulation: string | null
          numero: string
          product_id: string
          statut: string
          supplier_id: string
          taux_abattement: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "reception_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_holding_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      confirm_request_item_taken: {
        Args: { p_item_id: string; p_qte?: number }
        Returns: string
      }
      consume_adhoc_pdr_preventive: {
        Args: {
          p_cause?: string
          p_commentaire?: string
          p_execution_id: string
          p_pdr_id: string
          p_position_id?: string
          p_qte: number
        }
        Returns: undefined
      }
      consume_from_ministock: {
        Args: {
          p_cause?: string
          p_commentaire?: string
          p_holding_id: string
          p_intervention_id: string
          p_position_id?: string
          p_qte_consomme: number
        }
        Returns: undefined
      }
      consume_maintenance_holding: {
        Args: {
          p_cause?: string
          p_commentaire?: string
          p_holding_id: string
          p_intervention_id: string
          p_position_id?: string
          p_qte_consomme: number
        }
        Returns: undefined
      }
      consume_maintenance_holding_preventive: {
        Args: {
          p_cause?: string
          p_commentaire?: string
          p_execution_id: string
          p_holding_id: string
          p_position_id?: string
          p_qte_consomme: number
        }
        Returns: undefined
      }
      dashboard_is_mine: { Args: { _dashboard_id: string }; Returns: boolean }
      dashboard_is_shared_with_me: {
        Args: { _dashboard_id: string }
        Returns: boolean
      }
      derive_shift_type_from_now: {
        Args: never
        Returns: Database["public"]["Enums"]["shift_type"]
      }
      ensure_app_role_value: { Args: { _code: string }; Returns: undefined }
      ensure_my_production_shift_session: { Args: never; Returns: string }
      ensure_my_production_shifts: { Args: never; Returns: string[] }
      ensure_my_quality_shifts: { Args: never; Returns: string[] }
      ensure_production_shift_session: {
        Args: { p_of_id: string }
        Returns: string
      }
      filter_reception_tickets: {
        Args: {
          p_campaign_id?: string
          p_conformite?: string
          p_date_from?: string
          p_date_to?: string
          p_dt_from?: string
          p_dt_to?: string
          p_etat?: string
          p_product_id?: string
          p_search?: string
          p_supplier_id?: string
        }
        Returns: {
          campagne: string | null
          campaign_id: string | null
          cloture_at: string | null
          cloture_by: string | null
          cloture_by_name: string | null
          code_digits: number | null
          code_pesee: string | null
          code_prefix: string | null
          code_saisi: string | null
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          date_ticket: string | null
          duree_minutes: number | null
          etat_pesee: string | null
          fournisseur: string | null
          heure_debut: string | null
          heure_fin: string | null
          id: string | null
          nb_photos: number | null
          numero: string | null
          objectif_kg: number | null
          poids_abattement_kg: number | null
          poids_brut_kg: number | null
          poids_net_kg: number | null
          product_id: string | null
          produit: string | null
          produit_code: string | null
          region: string | null
          statut: string | null
          supplier_code: string | null
          supplier_id: string | null
          taux_abattement: number | null
          weighed_at: string | null
          weighing_id: string | null
          wilaya: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_reception_global"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fts_build: { Args: { parts: string[] }; Returns: unknown }
      get_active_shift_context: {
        Args: { _at?: string; _user_id: string }
        Returns: {
          autorisation_libre: boolean
          heure_debut: string
          heure_fin: string
          is_on_shift: boolean
          team_id: string
          team_name: string
          template_code: string
          template_id: string
        }[]
      }
      get_maintenance_context_for_of: {
        Args: { p_of_id: string }
        Returns: {
          id: string
          kind: string
          label: string
          ligne_id: string
          machine_id: string
          numero: string
          priorite: string
          statut: string
        }[]
      }
      get_position_counter: { Args: { p_position_id: string }; Returns: number }
      get_quality_due_for_shift: {
        Args: { p_limit?: number; p_quality_shift_id?: string }
        Returns: {
          critical_overdue: number
          due: number
          line_id: string
          line_label: string
          numero: string
          of_id: string
          on_covered_line: boolean
          overdue: number
          product_id: string
          product_label: string
          total: number
        }[]
      }
      get_quality_indicators_for_of: {
        Args: { p_of_id: string }
        Returns: {
          assignment_id: string
          category: string
          code: string
          description: string
          effective_frequency_minutes: number
          effective_frequency_type: string
          effective_is_blocking: boolean
          effective_is_required: boolean
          indicator_id: string
          indicator_type: string
          match_scope: string
          max_value: number
          min_value: number
          name: string
          select_options: Json
          target_value: number
          tolerance_minus: number
          tolerance_plus: number
          unit: string
        }[]
      }
      get_reception_kpis: {
        Args: {
          p_campaign_id?: string
          p_conformite?: string
          p_date_from?: string
          p_date_to?: string
          p_dt_from?: string
          p_dt_to?: string
          p_etat?: string
          p_product_id?: string
          p_search?: string
          p_supplier_id?: string
        }
        Returns: Json
      }
      get_reception_user_kpis: {
        Args: { _end_date: string; _start_date: string; _user_id: string }
        Returns: Json
      }
      get_recipe_for_of: {
        Args: { p_of_id: string }
        Returns: {
          components: Json
          product_id: string
          quality_sensitive_components: Json
          recipe_id: string
          recipe_name: string
          status: string
          steps: Json
          version: number
        }[]
      }
      get_scope_shift_context: {
        Args: { _at?: string; _scope: string; _user_id: string }
        Returns: {
          autorisation_libre: boolean
          heure_debut: string
          heure_fin: string
          is_on_shift: boolean
          line_ids: string[]
          team_id: string
          template_code: string
          template_id: string
        }[]
      }
      global_search: {
        Args: {
          date_from?: string
          date_to?: string
          limit_per_module?: number
          modules?: string[]
          q: string
        }
        Returns: {
          code: string
          entity_id: string
          label: string
          module: string
          score: number
          severity: string
          snippet: string
          updated_at: string
          url: string
        }[]
      }
      has_audit_access: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      has_quality_permission: {
        Args: { _action: string; _user_id: string }
        Returns: boolean
      }
      has_reception_consult_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_articles: {
        Args: { _rows: Json; _update_existing: boolean }
        Returns: Json
      }
      import_enum: {
        Args: { _allowed: string[]; _default: string; _val: string }
        Returns: string
      }
      import_equipements: {
        Args: { _rows: Json; _update_existing: boolean }
        Returns: Json
      }
      import_machines: {
        Args: { _rows: Json; _update_existing: boolean }
        Returns: Json
      }
      import_organes: {
        Args: { _rows: Json; _update_existing: boolean }
        Returns: Json
      }
      import_pdr: {
        Args: { _rows: Json; _update_existing: boolean }
        Returns: Json
      }
      import_products: {
        Args: { _rows: Json; _update_existing: boolean }
        Returns: Json
      }
      import_reception_poids_bruts: { Args: { rows: Json }; Returns: Json }
      import_reception_suppliers: { Args: { rows: Json }; Returns: Json }
      import_reception_tickets: {
        Args: { on_conflict?: string; rows: Json }
        Returns: Json
      }
      import_resolve_mfamily: {
        Args: { _fam: string; _sub: string }
        Returns: string
      }
      import_resolve_pfamily: {
        Args: { _fam: string; _sub: string }
        Returns: string
      }
      import_resolve_prodfamily: {
        Args: { _fam: string; _sub: string }
        Returns: string
      }
      initiate_holding_transfer: {
        Args: {
          p_destination: Database["public"]["Enums"]["pdr_transfer_destination"]
          p_holding_id: string
          p_motif?: string
          p_qte: number
          p_to_holder?: string
        }
        Returns: string
      }
      inv_assignment_authorized_families: {
        Args: { p_assignment_id: string }
        Returns: string[]
      }
      inv_campaign_authorized_families: {
        Args: { p_campaign_id: string }
        Returns: string[]
      }
      inv_close_campaign: {
        Args: { p_campaign_id: string; p_motif?: string }
        Returns: undefined
      }
      inv_ensure_targets: { Args: { p_campaign_id: string }; Returns: number }
      inv_family_descendants: {
        Args: { p_family_id: string }
        Returns: string[]
      }
      inv_open_campaign: { Args: { p_campaign_id: string }; Returns: undefined }
      inv_recompute_result: {
        Args: { p_target_id: string }
        Returns: undefined
      }
      inv_register_count: {
        Args: { p_notes?: string; p_qty: number; p_target_id: string }
        Returns: string
      }
      is_audit_enabled: {
        Args: { _module: string; _role: string }
        Returns: boolean
      }
      is_user_on_shift: {
        Args: { _at?: string; _scope?: string; _user_id: string }
        Returns: boolean
      }
      lot_investigation_events: {
        Args: { p_from: string; p_to: string }
        Returns: {
          detail: string
          duration_minutes: number
          ended_at: string
          event_type: string
          occurred_at: string
          ref_id: string
          title: string
        }[]
      }
      next_reception_ticket_no: { Args: never; Returns: string }
      next_reception_weighing_no: { Args: never; Returns: string }
      open_my_work_session: { Args: never; Returns: Json }
      pdr_request_audit: {
        Args: {
          p_action: string
          p_label: string
          p_new: Json
          p_old: Json
          p_record_id: string
        }
        Returns: undefined
      }
      purge_imported_reception_tickets: {
        Args: { p_dry_run?: boolean; p_hours: number }
        Returns: number
      }
      quality_shift_refresh_links: {
        Args: { p_quality_shift_id: string }
        Returns: number
      }
      reception_global_stats:
        | {
            Args: {
              p_campaign?: string
              p_conformite?: string
              p_etat?: string
              p_from?: string
              p_from_ts?: string
              p_product?: string
              p_q?: string
              p_supplier?: string
              p_to?: string
              p_to_ts?: string
            }
            Returns: Json
          }
        | { Args: { p_end_date: string; p_start_date: string }; Returns: Json }
      refuse_request_item: {
        Args: { p_item_id: string; p_motif: string }
        Returns: undefined
      }
      rename_reception_ticket: {
        Args: { p_new_numero: string; p_ticket_id: string }
        Returns: undefined
      }
      reopen_preventive_action: {
        Args: { p_plan_id: string; p_reason: string }
        Returns: string
      }
      resolve_scanned_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          entity_id: string
          entity_type: string
          label: string
          match_quality: string
          matched_field: string
          url: string
        }[]
      }
      search_suggest: {
        Args: { max_results?: number; q: string }
        Returns: {
          code: string
          label: string
          module: string
          score: number
          url: string
        }[]
      }
      set_bom_status: {
        Args: { p_bom_id: string; p_reason?: string; p_status: string }
        Returns: undefined
      }
      set_of_quality_status: {
        Args: {
          p_of_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["of_quality_status"]
        }
        Returns: undefined
      }
      set_recipe_status: {
        Args: { p_reason?: string; p_recipe_id: string; p_status: string }
        Returns: undefined
      }
      set_request_item_ready: {
        Args: { p_comment?: string; p_item_id: string; p_qte?: number }
        Returns: undefined
      }
      shift_cycle_slot: {
        Args: { _anchor: string; _d: string; _pattern: string[] }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_or_join_preventive_action: {
        Args: { p_plan_id: string }
        Returns: string
      }
      transfer_reception_ticket_photos: {
        Args: {
          p_reason?: string
          p_source_ticket_id: string
          p_target_ticket_id: string
        }
        Returns: number
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_has_role_text: {
        Args: { _role_text: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "resp_maintenance"
        | "maintenancier"
        | "resp_production"
        | "chef_ligne"
        | "operateur"
        | "gestionnaire_magasin"
        | "bureau_methode"
        | "responsable_si"
        | "auditeur"
        | "controleur_qualite"
        | "responsable_controle_qualite"
        | "directeur_qualite"
        | "responsable_inventaire"
        | "agent_inventaire"
        | "responsable_magasin"
        | "agent_pont_bascule"
        | "agreeur"
        | "test"
      approvisionnement_type: "local" | "importation" | "mixte"
      arret_type:
        | "panne"
        | "changement_serie"
        | "pause"
        | "nettoyage"
        | "attente_matiere"
        | "qualite"
        | "autre"
      criticite: "A" | "B" | "C"
      criticite_maintenance: "faible" | "moyenne" | "elevee" | "critique"
      disponibilite_pdr: "disponible" | "partiel" | "indisponible"
      energie_type:
        | "electrique"
        | "pneumatique"
        | "hydraulique"
        | "vapeur"
        | "gaz"
        | "mixte"
        | "autre"
      equipement_statut:
        | "en_service"
        | "hors_service"
        | "en_maintenance"
        | "reforme"
      equipement_type:
        | "capteur"
        | "actionneur"
        | "convoyeur"
        | "peripherique"
        | "utilite"
        | "sous_ensemble"
        | "instrument"
        | "autre"
      frequence_preventif:
        | "quotidien"
        | "hebdomadaire"
        | "mensuel"
        | "trimestriel"
        | "semestriel"
        | "annuel"
      impact_ligne: "arret_complet" | "arret_partiel" | "degradation" | "aucun"
      intervention_role: "lead" | "aide" | "co_intervenant"
      intervention_statut:
        | "en_cours"
        | "terminee"
        | "annulee"
        | "transferee"
        | "liberee"
      inventory_assignment_role: "agent_a" | "agent_b" | "agent_c"
      inventory_campaign_status:
        | "draft"
        | "en_cours"
        | "arbitrage"
        | "cloturee"
        | "annulee"
      inventory_campaign_type: "pdr" | "investissement"
      inventory_decision:
        | "en_attente"
        | "conforme_ab"
        | "conforme_c_eq_a"
        | "conforme_c_eq_b"
        | "recompte_ab"
      inventory_entity_type: "pdr" | "organe" | "machine" | "equipement"
      inventory_target_status:
        | "a_compter"
        | "en_arbitrage"
        | "conforme"
        | "a_recompter"
        | "cloture"
      machine_statut: "en_marche" | "arret" | "maintenance"
      mouvement_type: "entree" | "sortie" | "correction" | "inventaire"
      nc_decision:
        | "bloquer_lot"
        | "liberer"
        | "liberer_sous_derogation"
        | "retraiter"
        | "trier"
        | "rebuter"
        | "retour_fournisseur"
        | "quarantaine"
        | "autre"
      nc_severity: "minor" | "major" | "critical"
      nc_status:
        | "draft"
        | "declared"
        | "under_review"
        | "blocked"
        | "decision_pending"
        | "action_in_progress"
        | "verified"
        | "closed"
        | "cancelled"
      nc_type:
        | "produit_fini"
        | "emballage"
        | "matiere_premiere"
        | "process"
        | "hygiene"
        | "etiquetage"
        | "poids"
        | "aspect"
        | "securite_alimentaire"
        | "autre"
      notification_frequency: "immediate" | "grouped_hourly" | "grouped_daily"
      notification_severity: "info" | "low" | "medium" | "high" | "critical"
      notification_status: "unread" | "read" | "archived"
      of_quality_status:
        | "non_demarre"
        | "en_controle"
        | "conforme"
        | "conforme_sous_reserve"
        | "non_conforme"
        | "bloque"
        | "libere"
        | "rebute"
        | "a_retraiter"
      of_statut: "planifie" | "en_cours" | "termine" | "annule"
      organe_impact_panne:
        | "arret_complet"
        | "arret_partiel"
        | "degradation"
        | "aucun"
      organe_statut:
        | "en_service"
        | "en_panne"
        | "en_maintenance"
        | "hors_service"
      organe_type:
        | "mecanique"
        | "electrique"
        | "pneumatique"
        | "hydraulique"
        | "electronique"
        | "automatisme"
        | "instrumentation"
        | "autre"
      pdr_holding_status: "en_main" | "consomme" | "retourne"
      pdr_request_item_status:
        | "demandee"
        | "prete"
        | "prise"
        | "refusee"
        | "annulee"
      pdr_request_status:
        | "demandee"
        | "prete"
        | "partielle"
        | "prise"
        | "refusee"
        | "annulee"
      pdr_request_type: "curative" | "preventive"
      pdr_transfer_destination: "maintainer" | "magasin"
      pdr_transfer_status: "en_attente" | "confirme" | "refuse" | "annule"
      quality_action_priority: "low" | "medium" | "high" | "critical"
      quality_action_status:
        | "open"
        | "in_progress"
        | "done"
        | "verified"
        | "closed"
        | "cancelled"
      quality_action_type: "curative" | "corrective" | "preventive"
      quality_frequency_type:
        | "hourly"
        | "shift"
        | "daily"
        | "per_of"
        | "per_lot"
        | "manual"
      quality_indicator_category:
        | "produit_fini"
        | "emballage"
        | "process"
        | "hygiene"
        | "poids"
        | "controle_visuel"
        | "autre"
        | "physico_chimique"
        | "conditionnement"
        | "organoleptique"
      quality_indicator_type: "numeric" | "boolean" | "text" | "select"
      role_fonctionnel:
        | "alimentation"
        | "transformation"
        | "dosage"
        | "melange"
        | "convoyage"
        | "conditionnement"
        | "controle"
        | "evacuation"
        | "utilite"
        | "autre"
      shift_type: "matin" | "apres_midi" | "nuit"
      statut_pdr: "strategique" | "commune"
      ticket_assignment_status:
        | "unassigned"
        | "assigned"
        | "transferred"
        | "released"
      ticket_priorite: "critique" | "haute" | "normale" | "basse"
      ticket_statut:
        | "ouvert"
        | "pris_en_charge"
        | "en_cours"
        | "resolu"
        | "cloture"
      validation_enforcement: "post_hoc" | "blocking"
      validation_priority: "low" | "medium" | "high" | "critical"
      validation_status_enum:
        | "draft"
        | "submitted"
        | "pending_post_hoc"
        | "approved"
        | "rejected"
        | "cancelled"
        | "applied"
        | "archived"
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
      app_role: [
        "admin",
        "resp_maintenance",
        "maintenancier",
        "resp_production",
        "chef_ligne",
        "operateur",
        "gestionnaire_magasin",
        "bureau_methode",
        "responsable_si",
        "auditeur",
        "controleur_qualite",
        "responsable_controle_qualite",
        "directeur_qualite",
        "responsable_inventaire",
        "agent_inventaire",
        "responsable_magasin",
        "agent_pont_bascule",
        "agreeur",
        "test",
      ],
      approvisionnement_type: ["local", "importation", "mixte"],
      arret_type: [
        "panne",
        "changement_serie",
        "pause",
        "nettoyage",
        "attente_matiere",
        "qualite",
        "autre",
      ],
      criticite: ["A", "B", "C"],
      criticite_maintenance: ["faible", "moyenne", "elevee", "critique"],
      disponibilite_pdr: ["disponible", "partiel", "indisponible"],
      energie_type: [
        "electrique",
        "pneumatique",
        "hydraulique",
        "vapeur",
        "gaz",
        "mixte",
        "autre",
      ],
      equipement_statut: [
        "en_service",
        "hors_service",
        "en_maintenance",
        "reforme",
      ],
      equipement_type: [
        "capteur",
        "actionneur",
        "convoyeur",
        "peripherique",
        "utilite",
        "sous_ensemble",
        "instrument",
        "autre",
      ],
      frequence_preventif: [
        "quotidien",
        "hebdomadaire",
        "mensuel",
        "trimestriel",
        "semestriel",
        "annuel",
      ],
      impact_ligne: ["arret_complet", "arret_partiel", "degradation", "aucun"],
      intervention_role: ["lead", "aide", "co_intervenant"],
      intervention_statut: [
        "en_cours",
        "terminee",
        "annulee",
        "transferee",
        "liberee",
      ],
      inventory_assignment_role: ["agent_a", "agent_b", "agent_c"],
      inventory_campaign_status: [
        "draft",
        "en_cours",
        "arbitrage",
        "cloturee",
        "annulee",
      ],
      inventory_campaign_type: ["pdr", "investissement"],
      inventory_decision: [
        "en_attente",
        "conforme_ab",
        "conforme_c_eq_a",
        "conforme_c_eq_b",
        "recompte_ab",
      ],
      inventory_entity_type: ["pdr", "organe", "machine", "equipement"],
      inventory_target_status: [
        "a_compter",
        "en_arbitrage",
        "conforme",
        "a_recompter",
        "cloture",
      ],
      machine_statut: ["en_marche", "arret", "maintenance"],
      mouvement_type: ["entree", "sortie", "correction", "inventaire"],
      nc_decision: [
        "bloquer_lot",
        "liberer",
        "liberer_sous_derogation",
        "retraiter",
        "trier",
        "rebuter",
        "retour_fournisseur",
        "quarantaine",
        "autre",
      ],
      nc_severity: ["minor", "major", "critical"],
      nc_status: [
        "draft",
        "declared",
        "under_review",
        "blocked",
        "decision_pending",
        "action_in_progress",
        "verified",
        "closed",
        "cancelled",
      ],
      nc_type: [
        "produit_fini",
        "emballage",
        "matiere_premiere",
        "process",
        "hygiene",
        "etiquetage",
        "poids",
        "aspect",
        "securite_alimentaire",
        "autre",
      ],
      notification_frequency: ["immediate", "grouped_hourly", "grouped_daily"],
      notification_severity: ["info", "low", "medium", "high", "critical"],
      notification_status: ["unread", "read", "archived"],
      of_quality_status: [
        "non_demarre",
        "en_controle",
        "conforme",
        "conforme_sous_reserve",
        "non_conforme",
        "bloque",
        "libere",
        "rebute",
        "a_retraiter",
      ],
      of_statut: ["planifie", "en_cours", "termine", "annule"],
      organe_impact_panne: [
        "arret_complet",
        "arret_partiel",
        "degradation",
        "aucun",
      ],
      organe_statut: [
        "en_service",
        "en_panne",
        "en_maintenance",
        "hors_service",
      ],
      organe_type: [
        "mecanique",
        "electrique",
        "pneumatique",
        "hydraulique",
        "electronique",
        "automatisme",
        "instrumentation",
        "autre",
      ],
      pdr_holding_status: ["en_main", "consomme", "retourne"],
      pdr_request_item_status: [
        "demandee",
        "prete",
        "prise",
        "refusee",
        "annulee",
      ],
      pdr_request_status: [
        "demandee",
        "prete",
        "partielle",
        "prise",
        "refusee",
        "annulee",
      ],
      pdr_request_type: ["curative", "preventive"],
      pdr_transfer_destination: ["maintainer", "magasin"],
      pdr_transfer_status: ["en_attente", "confirme", "refuse", "annule"],
      quality_action_priority: ["low", "medium", "high", "critical"],
      quality_action_status: [
        "open",
        "in_progress",
        "done",
        "verified",
        "closed",
        "cancelled",
      ],
      quality_action_type: ["curative", "corrective", "preventive"],
      quality_frequency_type: [
        "hourly",
        "shift",
        "daily",
        "per_of",
        "per_lot",
        "manual",
      ],
      quality_indicator_category: [
        "produit_fini",
        "emballage",
        "process",
        "hygiene",
        "poids",
        "controle_visuel",
        "autre",
        "physico_chimique",
        "conditionnement",
        "organoleptique",
      ],
      quality_indicator_type: ["numeric", "boolean", "text", "select"],
      role_fonctionnel: [
        "alimentation",
        "transformation",
        "dosage",
        "melange",
        "convoyage",
        "conditionnement",
        "controle",
        "evacuation",
        "utilite",
        "autre",
      ],
      shift_type: ["matin", "apres_midi", "nuit"],
      statut_pdr: ["strategique", "commune"],
      ticket_assignment_status: [
        "unassigned",
        "assigned",
        "transferred",
        "released",
      ],
      ticket_priorite: ["critique", "haute", "normale", "basse"],
      ticket_statut: [
        "ouvert",
        "pris_en_charge",
        "en_cours",
        "resolu",
        "cloture",
      ],
      validation_enforcement: ["post_hoc", "blocking"],
      validation_priority: ["low", "medium", "high", "critical"],
      validation_status_enum: [
        "draft",
        "submitted",
        "pending_post_hoc",
        "approved",
        "rejected",
        "cancelled",
        "applied",
        "archived",
      ],
    },
  },
} as const
