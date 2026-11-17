export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          antes: Json | null
          creado_en: string
          despues: Json | null
          id: number
          registro_id: string
          tabla: string
        }
        ComputedFields: never
        Insert: {
          accion: string
          actor_id?: string | null
          antes?: Json | null
          creado_en?: string
          despues?: Json | null
          id?: never
          registro_id: string
          tabla: string
        }
        Update: {
          accion?: string
          actor_id?: string | null
          antes?: Json | null
          creado_en?: string
          despues?: Json | null
          id?: never
          registro_id?: string
          tabla?: string
        }
        Relationships: []
      }
      bloqueos: {
        Row: {
          creado_en: string
          creado_por: string
          fin: string
          id: string
          inicio: string
          motivo: string | null
          perfil_id: string
        }
        ComputedFields: never
        Insert: {
          creado_en?: string
          creado_por: string
          fin: string
          id?: string
          inicio: string
          motivo?: string | null
          perfil_id: string
        }
        Update: {
          creado_en?: string
          creado_por?: string
          fin?: string
          id?: string
          inicio?: string
          motivo?: string | null
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bloqueos_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bloqueos_perfil_id_fkey'
            columns: ['perfil_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      config_agenda: {
        Row: {
          actualizado_en: string
          anticipacion_min_horas: number
          cancelar_hasta_horas: number
          creado_en: string
          descanso_min: number
          duracion_min: number
          horizonte_dias: number
          id: number
          max_reuniones_dia: number
          zona_horaria: string
        }
        ComputedFields: never
        Insert: {
          actualizado_en?: string
          anticipacion_min_horas?: number
          cancelar_hasta_horas?: number
          creado_en?: string
          descanso_min?: number
          duracion_min?: number
          horizonte_dias?: number
          id?: number
          max_reuniones_dia?: number
          zona_horaria?: string
        }
        Update: {
          actualizado_en?: string
          anticipacion_min_horas?: number
          cancelar_hasta_horas?: number
          creado_en?: string
          descanso_min?: number
          duracion_min?: number
          horizonte_dias?: number
          id?: number
          max_reuniones_dia?: number
          zona_horaria?: string
        }
        Relationships: []
      }
      config_calculadora: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          ciclo_dias: number
          creado_en: string
          id: number
          moneda_local: boolean
          pct_local: number
          pct_sena: number
          precio: number
          sena: number
          sueldo: number
          tasa: number
          volatilidad: Database['public']['Enums']['volatilidad']
        }
        ComputedFields: never
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          ciclo_dias?: number
          creado_en?: string
          id?: number
          moneda_local?: boolean
          pct_local?: number
          pct_sena?: number
          precio?: number
          sena?: number
          sueldo?: number
          tasa?: number
          volatilidad?: Database['public']['Enums']['volatilidad']
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          ciclo_dias?: number
          creado_en?: string
          id?: number
          moneda_local?: boolean
          pct_local?: number
          pct_sena?: number
          precio?: number
          sena?: number
          sueldo?: number
          tasa?: number
          volatilidad?: Database['public']['Enums']['volatilidad']
        }
        Relationships: [
          {
            foreignKeyName: 'config_calculadora_actualizado_por_fkey'
            columns: ['actualizado_por']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      correos_salientes: {
        Row: {
          adjunto_ics: string | null
          creado_en: string
          datos: NonNullable<Json>
          enviado_en: string | null
          estado: Database['public']['Enums']['estado_correo']
          id: string
          intentos: number
          para: string
          plantilla: string
          programado_para: string | null
          referencia: string | null
          resend_id: string | null
          reunion_id: string | null
          solicitud_id: string | null
          ultimo_error: string | null
        }
        ComputedFields: never
        Insert: {
          adjunto_ics?: string | null
          creado_en?: string
          datos?: NonNullable<Json>
          enviado_en?: string | null
          estado: Database['public']['Enums']['estado_correo']
          id?: string
          intentos?: number
          para: string
          plantilla: string
          programado_para?: string | null
          referencia?: string | null
          resend_id?: string | null
          reunion_id?: string | null
          solicitud_id?: string | null
          ultimo_error?: string | null
        }
        Update: {
          adjunto_ics?: string | null
          creado_en?: string
          datos?: NonNullable<Json>
          enviado_en?: string | null
          estado?: Database['public']['Enums']['estado_correo']
          id?: string
          intentos?: number
          para?: string
          plantilla?: string
          programado_para?: string | null
          referencia?: string | null
          resend_id?: string | null
          reunion_id?: string | null
          solicitud_id?: string | null
          ultimo_error?: string | null
        }
        Relationships: []
      }
      enlaces_prospeccion: {
        Row: {
          activo: boolean
          actualizado_en: string
          codigo: string
          creado_en: string
          creado_por: string
          etiqueta: string | null
          id: string
        }
        ComputedFields: never
        Insert: {
          activo?: boolean
          actualizado_en?: string
          codigo: string
          creado_en?: string
          creado_por: string
          etiqueta?: string | null
          id?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          codigo?: string
          creado_en?: string
          creado_por?: string
          etiqueta?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enlaces_prospeccion_creado_por_fkey'
            columns: ['creado_por']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      equipo: {
        Row: {
          actualizado_en: string
          cargo: string
          creado_en: string
          foto_ruta: string | null
          frase: string | null
          id: string
          nombre: string
          orden: number
          visible: boolean
        }
        ComputedFields: never
        Insert: {
          actualizado_en?: string
          cargo: string
          creado_en?: string
          foto_ruta?: string | null
          frase?: string | null
          id?: string
          nombre: string
          orden?: number
          visible?: boolean
        }
        Update: {
          actualizado_en?: string
          cargo?: string
          creado_en?: string
          foto_ruta?: string | null
          frase?: string | null
          id?: string
          nombre?: string
          orden?: number
          visible?: boolean
        }
        Relationships: []
      }
      eventos: {
        Row: {
          creado_en: string
          id: number
          pagina: string | null
          perfil_id: string | null
          solicitud_id: string | null
          tipo: Database['public']['Enums']['tipo_evento']
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        ComputedFields: never
        Insert: {
          creado_en?: string
          id?: never
          pagina?: string | null
          perfil_id?: string | null
          solicitud_id?: string | null
          tipo: Database['public']['Enums']['tipo_evento']
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          creado_en?: string
          id?: never
          pagina?: string | null
          perfil_id?: string | null
          solicitud_id?: string | null
          tipo?: Database['public']['Enums']['tipo_evento']
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      horario_base: {
        Row: {
          actualizado_en: string
          creado_en: string
          desde: string
          dia_semana: number
          hasta: string
          id: string
        }
        ComputedFields: never
        Insert: {
          actualizado_en?: string
          creado_en?: string
          desde: string
          dia_semana: number
          hasta: string
          id?: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          desde?: string
          dia_semana?: number
          hasta?: string
          id?: string
        }
        Relationships: []
      }
      invitaciones: {
        Row: {
          aceptada_en: string | null
          actualizado_en: string
          creado_en: string
          email: string
          estado: string
          expira_en: string
          id: string
          invitado_por: string
        }
        ComputedFields: never
        Insert: {
          aceptada_en?: string | null
          actualizado_en?: string
          creado_en?: string
          email: string
          estado?: string
          expira_en?: string
          id?: string
          invitado_por: string
        }
        Update: {
          aceptada_en?: string | null
          actualizado_en?: string
          creado_en?: string
          email?: string
          estado?: string
          expira_en?: string
          id?: string
          invitado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invitaciones_invitado_por_fkey'
            columns: ['invitado_por']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      latidos: {
        Row: {
          creado_en: string
          fallos_seguidos: number
          tarea: string
          ultimo_error: string | null
          ultimo_ok: string | null
        }
        ComputedFields: never
        Insert: {
          creado_en?: string
          fallos_seguidos?: number
          tarea: string
          ultimo_error?: string | null
          ultimo_ok?: string | null
        }
        Update: {
          creado_en?: string
          fallos_seguidos?: number
          tarea?: string
          ultimo_error?: string | null
          ultimo_ok?: string | null
        }
        Relationships: []
      }
      limites: {
        Row: {
          clave: string
          conteo: number
          creado_en: string
          ventana_inicio: string
        }
        ComputedFields: never
        Insert: {
          clave: string
          conteo?: number
          creado_en?: string
          ventana_inicio?: string
        }
        Update: {
          clave?: string
          conteo?: number
          creado_en?: string
          ventana_inicio?: string
        }
        Relationships: []
      }
      metricas_diarias: {
        Row: {
          calculadoras: number
          clics_whatsapp: number
          creado_en: string
          dia: string
          ganadas: number
          reuniones_realizadas: number
          reuniones_reservadas: number
          solicitudes: number
        }
        ComputedFields: never
        Insert: {
          calculadoras?: number
          clics_whatsapp?: number
          creado_en?: string
          dia: string
          ganadas?: number
          reuniones_realizadas?: number
          reuniones_reservadas?: number
          solicitudes?: number
        }
        Update: {
          calculadoras?: number
          clics_whatsapp?: number
          creado_en?: string
          dia?: string
          ganadas?: number
          reuniones_realizadas?: number
          reuniones_reservadas?: number
          solicitudes?: number
        }
        Relationships: []
      }
      metricas_persona: {
        Row: {
          creado_en: string
          dia: string
          ganadas: number
          perfil_id: string
          reuniones_realizadas: number
          reuniones_reservadas: number
          solicitudes_asignadas: number
        }
        ComputedFields: never
        Insert: {
          creado_en?: string
          dia: string
          ganadas?: number
          perfil_id: string
          reuniones_realizadas?: number
          reuniones_reservadas?: number
          solicitudes_asignadas?: number
        }
        Update: {
          creado_en?: string
          dia?: string
          ganadas?: number
          perfil_id?: string
          reuniones_realizadas?: number
          reuniones_reservadas?: number
          solicitudes_asignadas?: number
        }
        Relationships: []
      }
      notas: {
        Row: {
          actualizado_en: string
          autor_id: string
          creado_en: string
          id: string
          solicitud_id: string
          texto: string
        }
        ComputedFields: never
        Insert: {
          actualizado_en?: string
          autor_id: string
          creado_en?: string
          id?: string
          solicitud_id: string
          texto: string
        }
        Update: {
          actualizado_en?: string
          autor_id?: string
          creado_en?: string
          id?: string
          solicitud_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notas_autor_id_fkey'
            columns: ['autor_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notas_solicitud_id_fkey'
            columns: ['solicitud_id']
            isOneToOne: false
            referencedRelation: 'solicitudes'
            referencedColumns: ['id']
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          actualizado_en: string
          creado_en: string
          email: string
          en_turno: boolean
          enlace_meet: string | null
          id: string
          nombre: string
          rol: Database['public']['Enums']['rol_usuario']
          whatsapp: string | null
        }
        ComputedFields: never
        Insert: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          email: string
          en_turno?: boolean
          enlace_meet?: string | null
          id: string
          nombre: string
          rol?: Database['public']['Enums']['rol_usuario']
          whatsapp?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          creado_en?: string
          email?: string
          en_turno?: boolean
          enlace_meet?: string | null
          id?: string
          nombre?: string
          rol?: Database['public']['Enums']['rol_usuario']
          whatsapp?: string | null
        }
        Relationships: []
      }
      permisos: {
        Row: {
          clave: string
          creado_en: string
          descripcion: string
        }
        ComputedFields: never
        Insert: {
          clave: string
          creado_en?: string
          descripcion: string
        }
        Update: {
          clave?: string
          creado_en?: string
          descripcion?: string
        }
        Relationships: []
      }
      permisos_rol: {
        Row: {
          alcance: string
          clave: string
          creado_en: string
          rol: Database['public']['Enums']['rol_usuario']
        }
        ComputedFields: never
        Insert: {
          alcance: string
          clave: string
          creado_en?: string
          rol: Database['public']['Enums']['rol_usuario']
        }
        Update: {
          alcance?: string
          clave?: string
          creado_en?: string
          rol?: Database['public']['Enums']['rol_usuario']
        }
        Relationships: [
          {
            foreignKeyName: 'permisos_rol_clave_fkey'
            columns: ['clave']
            isOneToOne: false
            referencedRelation: 'permisos'
            referencedColumns: ['clave']
          },
        ]
      }
      reuniones: {
        Row: {
          actualizado_en: string
          anfitrion_id: string
          cancelada_en: string | null
          creado_en: string
          enlace_meet: string
          estado: Database['public']['Enums']['estado_reunion']
          fin: string
          id: string
          inicio: string
          recordatorio_1_en: string | null
          recordatorio_24_en: string | null
          secuencia_ics: number
          solicitud_id: string
          token_hash: string
          zona_visitante: string
        }
        ComputedFields: never
        Insert: {
          actualizado_en?: string
          anfitrion_id: string
          cancelada_en?: string | null
          creado_en?: string
          enlace_meet: string
          estado?: Database['public']['Enums']['estado_reunion']
          fin: string
          id?: string
          inicio: string
          recordatorio_1_en?: string | null
          recordatorio_24_en?: string | null
          secuencia_ics?: number
          solicitud_id: string
          token_hash: string
          zona_visitante: string
        }
        Update: {
          actualizado_en?: string
          anfitrion_id?: string
          cancelada_en?: string | null
          creado_en?: string
          enlace_meet?: string
          estado?: Database['public']['Enums']['estado_reunion']
          fin?: string
          id?: string
          inicio?: string
          recordatorio_1_en?: string | null
          recordatorio_24_en?: string | null
          secuencia_ics?: number
          solicitud_id?: string
          token_hash?: string
          zona_visitante?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reuniones_anfitrion_id_fkey'
            columns: ['anfitrion_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reuniones_solicitud_id_fkey'
            columns: ['solicitud_id']
            isOneToOne: false
            referencedRelation: 'solicitudes'
            referencedColumns: ['id']
          },
        ]
      }
      solicitudes: {
        Row: {
          actualizado_en: string
          administracion: number | null
          asignado_a: string | null
          autos_hoy: number | null
          autos_meta: number | null
          aviso_sin_reunion_en: string | null
          calc_consultas: number | null
          calc_margen: number | null
          calc_respuesta: Database['public']['Enums']['tiempo_respuesta'] | null
          consentimiento_en: string
          creado_en: string
          email: string
          estado: Database['public']['Enums']['estado_solicitud']
          id: string
          importadora: string | null
          nombre: string
          origen: Database['public']['Enums']['origen_solicitud']
          origenes: string[]
          pagina_origen: string | null
          pais: string | null
          ref_codigo: string | null
          ultimo_contacto_en: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          vendedores: number | null
          whatsapp: string | null
        }
        ComputedFields: never
        Insert: {
          actualizado_en?: string
          administracion?: number | null
          asignado_a?: string | null
          autos_hoy?: number | null
          autos_meta?: number | null
          aviso_sin_reunion_en?: string | null
          calc_consultas?: number | null
          calc_margen?: number | null
          calc_respuesta?: Database['public']['Enums']['tiempo_respuesta'] | null
          consentimiento_en: string
          creado_en?: string
          email: string
          estado?: Database['public']['Enums']['estado_solicitud']
          id?: string
          importadora?: string | null
          nombre: string
          origen: Database['public']['Enums']['origen_solicitud']
          origenes?: string[]
          pagina_origen?: string | null
          pais?: string | null
          ref_codigo?: string | null
          ultimo_contacto_en?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vendedores?: number | null
          whatsapp?: string | null
        }
        Update: {
          actualizado_en?: string
          administracion?: number | null
          asignado_a?: string | null
          autos_hoy?: number | null
          autos_meta?: number | null
          aviso_sin_reunion_en?: string | null
          calc_consultas?: number | null
          calc_margen?: number | null
          calc_respuesta?: Database['public']['Enums']['tiempo_respuesta'] | null
          consentimiento_en?: string
          creado_en?: string
          email?: string
          estado?: Database['public']['Enums']['estado_solicitud']
          id?: string
          importadora?: string | null
          nombre?: string
          origen?: Database['public']['Enums']['origen_solicitud']
          origenes?: string[]
          pagina_origen?: string | null
          pais?: string | null
          ref_codigo?: string | null
          ultimo_contacto_en?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vendedores?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'solicitudes_asignado_a_fkey'
            columns: ['asignado_a']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _acotar_pagina: {
        Args: { p_maximo: number; p_pedido: number; p_por_defecto: number }
        Returns: number
      }
      _columna_cambiada: {
        Args: { p_antes: Json; p_despues: Json; p_permitidas: string[] }
        Returns: string
      }
      _mas_minutos: { Args: { p_min: number; p_t: string }; Returns: string }
      es_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      es_usuario_activo: { Args: Record<PropertyKey, never>; Returns: boolean }
      ids_con_alcance: { Args: { p_clave: string }; Returns: string[] }
      mis_permisos: { Args: Record<PropertyKey, never>; Returns: Json }
      puede_en_solicitud: { Args: { p_clave: string; p_solicitud: string }; Returns: boolean }
      tiene_permiso: { Args: { p_clave: string }; Returns: boolean }
    }
    Enums: {
      estado_correo: 'enviado' | 'programado' | 'cancelado' | 'fallido'
      estado_reunion: 'confirmada' | 'cancelada' | 'realizada' | 'no_asistio'
      estado_solicitud: 'nueva' | 'agendada' | 'realizada' | 'no_asistio' | 'ganada' | 'descartada'
      origen_solicitud: 'formulario' | 'calculadora' | 'prospeccion'
      rol_usuario: 'admin' | 'vendedor'
      tiempo_respuesta: 'h1' | 'h4' | 'dia' | 'sig'
      tipo_evento:
        | 'clic_agendar'
        | 'clic_whatsapp'
        | 'calculadora_usada'
        | 'detalle_calculadora'
        | 'formulario_enviado'
        | 'reunion_reservada'
        | 'reunion_cambiada'
        | 'reunion_cancelada'
      volatilidad: 'baja' | 'media' | 'alta'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_correo: ['enviado', 'programado', 'cancelado', 'fallido'],
      estado_reunion: ['confirmada', 'cancelada', 'realizada', 'no_asistio'],
      estado_solicitud: ['nueva', 'agendada', 'realizada', 'no_asistio', 'ganada', 'descartada'],
      origen_solicitud: ['formulario', 'calculadora', 'prospeccion'],
      rol_usuario: ['admin', 'vendedor'],
      tiempo_respuesta: ['h1', 'h4', 'dia', 'sig'],
      tipo_evento: [
        'clic_agendar',
        'clic_whatsapp',
        'calculadora_usada',
        'detalle_calculadora',
        'formulario_enviado',
        'reunion_reservada',
        'reunion_cambiada',
        'reunion_cancelada',
      ],
      volatilidad: ['baja', 'media', 'alta'],
    },
  },
} as const
