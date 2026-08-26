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
      app_secrets: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      campaign_sectors: {
        Row: {
          campaign_id: string
          created_at: string
          empresa_id: string
          id: string
          setor_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          empresa_id: string
          id?: string
          setor_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sectors_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sectors_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sectors_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "empresa_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          ativa: boolean
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          codigo: string
          created_at: string
          empresa_id: string
          fim: string | null
          id: string
          inicio: string
          nome: string
          notes: string | null
          parent_campaign_id: string | null
          scope_mode: Database["public"]["Enums"]["campaign_scope_mode"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          codigo: string
          created_at?: string
          empresa_id: string
          fim?: string | null
          id?: string
          inicio?: string
          nome: string
          notes?: string | null
          parent_campaign_id?: string | null
          scope_mode?: Database["public"]["Enums"]["campaign_scope_mode"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          codigo?: string
          created_at?: string
          empresa_id?: string
          fim?: string | null
          id?: string
          inicio?: string
          nome?: string
          notes?: string | null
          parent_campaign_id?: string | null
          scope_mode?: Database["public"]["Enums"]["campaign_scope_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_parent_campaign_id_fkey"
            columns: ["parent_campaign_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      control_measures: {
        Row: {
          campanha_id: string | null
          control_type: string
          created_at: string
          created_by: string | null
          description: string
          dominio: string | null
          due_date: string | null
          effectiveness_status: string
          empresa_id: string
          evidence_description: string | null
          evidence_url: string | null
          funcao_id: string | null
          id: string
          implementation_date: string | null
          notes: string | null
          perigo: string | null
          responsible_name: string | null
          risk_level_pgr: string | null
          setor_id: string | null
          status: string
          updated_at: string
          validated: boolean
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          campanha_id?: string | null
          control_type: string
          created_at?: string
          created_by?: string | null
          description: string
          dominio?: string | null
          due_date?: string | null
          effectiveness_status?: string
          empresa_id: string
          evidence_description?: string | null
          evidence_url?: string | null
          funcao_id?: string | null
          id?: string
          implementation_date?: string | null
          notes?: string | null
          perigo?: string | null
          responsible_name?: string | null
          risk_level_pgr?: string | null
          setor_id?: string | null
          status?: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          campanha_id?: string | null
          control_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          dominio?: string | null
          due_date?: string | null
          effectiveness_status?: string
          empresa_id?: string
          evidence_description?: string | null
          evidence_url?: string | null
          funcao_id?: string | null
          id?: string
          implementation_date?: string | null
          notes?: string | null
          perigo?: string | null
          responsible_name?: string | null
          risk_level_pgr?: string | null
          setor_id?: string | null
          status?: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_measures_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_measures_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_measures_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "empresa_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_measures_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "empresa_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      denuncia_acessos: {
        Row: {
          acao: string
          created_at: string
          denuncia_id: string
          id: string
          ip: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao?: string
          created_at?: string
          denuncia_id: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          denuncia_id?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      denuncias: {
        Row: {
          anonima: boolean
          categoria: string
          codigo_empresa: string | null
          consulta_token: string
          contato_denunciante: string | null
          created_at: string
          descricao: string
          empresa_id: string | null
          id: string
          nome_denunciante: string | null
          parecer: string | null
          protocolo: string
          setor: string | null
          status: string
          updated_at: string
        }
        Insert: {
          anonima?: boolean
          categoria: string
          codigo_empresa?: string | null
          consulta_token: string
          contato_denunciante?: string | null
          created_at?: string
          descricao: string
          empresa_id?: string | null
          id?: string
          nome_denunciante?: string | null
          parecer?: string | null
          protocolo: string
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          anonima?: boolean
          categoria?: string
          codigo_empresa?: string | null
          consulta_token?: string
          contato_denunciante?: string | null
          created_at?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          nome_denunciante?: string | null
          parecer?: string | null
          protocolo?: string
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "denuncias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_funcoes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          nome: string
          setor_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          setor_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          setor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_funcoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_funcoes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "empresa_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_setores: {
        Row: {
          created_at: string
          empresa_id: string
          ges: string | null
          id: string
          merged_at: string | null
          merged_by: string | null
          merged_into_sector_id: string | null
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          ges?: string | null
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          merged_into_sector_id?: string | null
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          ges?: string | null
          id?: string
          merged_at?: string | null
          merged_by?: string | null
          merged_into_sector_id?: string | null
          nome?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_setores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_setores_merged_into_sector_id_fkey"
            columns: ["merged_into_sector_id"]
            isOneToOne: false
            referencedRelation: "empresa_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cidade: string | null
          cnae: string | null
          cnpj: string | null
          codigo: string
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          grau_risco: string | null
          id: string
          logo_url: string | null
          nome: string
          num_trabalhadores: number | null
          owner_user_id: string | null
          razao_social: string | null
          resp_formacao: string | null
          resp_registro: string | null
          responsavel_cargo: string | null
          responsavel_nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          codigo: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          grau_risco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          num_trabalhadores?: number | null
          owner_user_id?: string | null
          razao_social?: string | null
          resp_formacao?: string | null
          resp_registro?: string | null
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          codigo?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          grau_risco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          num_trabalhadores?: number | null
          owner_user_id?: string | null
          razao_social?: string | null
          resp_formacao?: string | null
          resp_registro?: string | null
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          max_avaliacoes: number
          max_empresas: number
          nome: string
          preco_mensal: number
          stripe_price_id: string | null
          tipo: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          max_avaliacoes?: number
          max_empresas?: number
          nome: string
          preco_mensal?: number
          stripe_price_id?: string | null
          tipo: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          max_avaliacoes?: number
          max_empresas?: number
          nome?: string
          preco_mensal?: number
          stripe_price_id?: string | null
          tipo?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          display_name: string | null
          email: string
          empresa_id: string | null
          id: string
          plan_id: string | null
          status: Database["public"]["Enums"]["profile_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          display_name?: string | null
          email: string
          empresa_id?: string | null
          id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          display_name?: string | null
          email?: string
          empresa_id?: string | null
          id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      questionario_dimensoes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          dominio: string | null
          id: string
          ordem: number
          slug: string
          titulo: string
          updated_at: string
          versao_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          dominio?: string | null
          id?: string
          ordem?: number
          slug: string
          titulo: string
          updated_at?: string
          versao_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          dominio?: string | null
          id?: string
          ordem?: number
          slug?: string
          titulo?: string
          updated_at?: string
          versao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionario_dimensoes_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "questionario_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      questionario_versoes: {
        Row: {
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          vigente: boolean
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          vigente?: boolean
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          vigente?: boolean
        }
        Relationships: []
      }
      questionario_opcoes: {
        Row: {
          created_at: string
          id: string
          ordem: number
          pergunta_id: string
          rotulo: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          pergunta_id: string
          rotulo: string
          valor: number
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          pergunta_id?: string
          rotulo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "questionario_opcoes_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "questionario_perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      questionario_perguntas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          dimensao_id: string
          escala: string
          id: string
          ordem: number
          reverse: boolean
          texto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          dimensao_id: string
          escala?: string
          id?: string
          ordem?: number
          reverse?: boolean
          texto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          dimensao_id?: string
          escala?: string
          id?: string
          ordem?: number
          reverse?: boolean
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionario_perguntas_dimensao_id_fkey"
            columns: ["dimensao_id"]
            isOneToOne: false
            referencedRelation: "questionario_dimensoes"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas: {
        Row: {
          answers: Json
          campanha_id: string | null
          codigo_empresa: string
          created_at: string
          empresa_id: string
          funcao: string | null
          id: string
          nome_empresa: string
          setor: string | null
          versao_id: string | null
        }
        Insert: {
          answers: Json
          campanha_id?: string | null
          codigo_empresa: string
          created_at?: string
          empresa_id: string
          funcao?: string | null
          id?: string
          nome_empresa: string
          setor?: string | null
          versao_id?: string | null
        }
        Update: {
          answers?: Json
          campanha_id?: string | null
          codigo_empresa?: string
          created_at?: string
          empresa_id?: string
          funcao?: string | null
          id?: string
          nome_empresa?: string
          setor?: string | null
          versao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "questionario_versoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      setor_merge_history: {
        Row: {
          actor_user_id: string | null
          created_at: string
          destino_ges: string | null
          destino_nome: string
          destino_setor_id: string
          empresa_id: string
          id: string
          message: string
          origem_ges: string | null
          origem_nome: string
          origem_setor_id: string
          summary: Json
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          destino_ges?: string | null
          destino_nome: string
          destino_setor_id: string
          empresa_id: string
          id?: string
          message: string
          origem_ges?: string | null
          origem_nome: string
          origem_setor_id: string
          summary?: Json
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          destino_ges?: string | null
          destino_nome?: string
          destino_setor_id?: string
          empresa_id?: string
          id?: string
          message?: string
          origem_ges?: string | null
          origem_nome?: string
          origem_setor_id?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "setor_merge_history_destino_setor_id_fkey"
            columns: ["destino_setor_id"]
            isOneToOne: false
            referencedRelation: "empresa_setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setor_merge_history_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setor_merge_history_origem_setor_id_fkey"
            columns: ["origem_setor_id"]
            isOneToOne: false
            referencedRelation: "empresa_setores"
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
      _get_secret: { Args: { p_key: string }; Returns: string }
      admin_set_user_plan: {
        Args: { p_plan_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: {
          p_status: Database["public"]["Enums"]["profile_status"]
          p_user_id: string
        }
        Returns: undefined
      }
      atualizar_funcao_resposta: {
        Args: { p_funcao: string; p_id: string }
        Returns: undefined
      }
      atualizar_setor_resposta: {
        Args: { p_funcao?: string; p_id: string; p_setor: string }
        Returns: undefined
      }
      consultar_denuncia_publica: {
        Args: { p_protocolo: string; p_token: string }
        Returns: {
          categoria: string
          created_at: string
          descricao: string
          parecer: string
          protocolo: string
          setor: string
          status: string
          updated_at: string
        }[]
      }
      current_account_type: {
        Args: never
        Returns: Database["public"]["Enums"]["account_type"]
      }
      current_profile_status: {
        Args: never
        Returns: Database["public"]["Enums"]["profile_status"]
      }
      current_user_empresa_id: { Args: never; Returns: string }
      current_user_plan: {
        Args: never
        Returns: {
          max_avaliacoes: number
          max_empresas: number
          nome: string
          plan_id: string
          preco_mensal: number
          tipo: Database["public"]["Enums"]["account_type"]
        }[]
      }
      gerar_link_assinado: {
        Args: { p_codigo: string; p_validade_dias?: number }
        Returns: {
          exp: number
          sig: string
        }[]
      }
      get_empresa_publica: { Args: { p_codigo: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inserir_resposta_admin: {
        Args: {
          p_answers: Json
          p_codigo: string
          p_created_at?: string
          p_funcao: string
          p_setor: string
        }
        Returns: string
      }
      normalize_cargo_nome: { Args: { p: string }; Returns: string }
      preview_unificar_setores: {
        Args: { p_destino: string; p_origem: string }
        Returns: Json
      }
      registrar_acesso_denuncia: {
        Args: {
          p_acao?: string
          p_denuncia_id: string
          p_ip?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      submeter_resposta_assinada: {
        Args: {
          p_answers: Json
          p_codigo: string
          p_exp: number
          p_funcao: string
          p_setor: string
          p_sig: string
        }
        Returns: string
      }
      submeter_resposta_campanha: {
        Args: {
          p_answers: Json
          p_codigo: string
          p_funcao: string
          p_setor: string
        }
        Returns: string
      }
      submeter_resposta_publica: {
        Args: {
          p_answers: Json
          p_codigo: string
          p_exp?: number
          p_funcao: string
          p_setor: string
        }
        Returns: string
      }
      unificar_setores: {
        Args: { p_destino: string; p_origem: string }
        Returns: Json
      }
    }
    Enums: {
      account_type: "admin" | "consultor" | "empresa_direta"
      app_role:
        | "admin"
        | "gestor"
        | "empresa"
        | "tecnico"
        | "visualizador"
        | "consultor"
      campaign_scope_mode: "all_sectors" | "selected_sectors"
      campaign_type: "general" | "sector_reassessment" | "complementary"
      profile_status: "pending" | "active" | "blocked"
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
      account_type: ["admin", "consultor", "empresa_direta"],
      app_role: [
        "admin",
        "gestor",
        "empresa",
        "tecnico",
        "visualizador",
        "consultor",
      ],
      campaign_scope_mode: ["all_sectors", "selected_sectors"],
      campaign_type: ["general", "sector_reassessment", "complementary"],
      profile_status: ["pending", "active", "blocked"],
    },
  },
} as const
