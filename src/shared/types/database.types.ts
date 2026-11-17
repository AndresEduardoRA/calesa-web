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
      _bloquear_agenda: { Args: Record<PropertyKey, never>; Returns: undefined }
      _bloquear_solicitudes: { Args: Record<PropertyKey, never>; Returns: undefined }
      _bloquear_vigente: {
        Args: { p_reunion: string; p_solicitud: string }
        Returns: {
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
        SetofOptions: {
          from: '*'
          to: 'reuniones'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _cancelar_reunion: {
        Args: {
          p_esperado: string
          p_r: Omit<
            Database['public']['Tables']['reuniones']['Row'],
            Database['public']['Tables']['reuniones']['ComputedFields']
          >
        }
        Returns: Json
      }
      _candidatos_reunion: {
        Args: { p_excluir: string; p_exigir_turno?: boolean; p_h: string; p_limitar_a: string }
        Returns: string[]
      }
      _columna_cambiada: {
        Args: { p_antes: Json; p_despues: Json; p_permitidas: string[] }
        Returns: string
      }
      _elegir_asignado: { Args: { p_extra?: Json }; Returns: string }
      _es_elegible: {
        Args: { p_excluir: string; p_exigir_turno?: boolean; p_h: string; p_perfil: string }
        Returns: boolean
      }
      _fallar: { Args: { p_e: string }; Returns: undefined }
      _hora_ofrecible: { Args: { p_h: string }; Returns: boolean }
      _intentar_reserva: {
        Args: {
          p_inicio: string
          p_orden: string[]
          p_solicitud: string
          p_token: string
          p_zona: string
        }
        Returns: string
      }
      _juntar_solicitud: {
        Args: {
          p_e: Omit<
            Database['public']['Tables']['solicitudes']['Row'],
            Database['public']['Tables']['solicitudes']['ComputedFields']
          >
          p_n: Omit<
            Database['public']['Tables']['solicitudes']['Row'],
            Database['public']['Tables']['solicitudes']['ComputedFields']
          >
        }
        Returns: string[]
      }
      _limitar_a: { Args: { p_solicitud: string }; Returns: string }
      _mas_minutos: { Args: { p_min: number; p_t: string }; Returns: string }
      _mover_reunion: {
        Args: {
          p_esperado: string
          p_h: string
          p_limitar_a: string
          p_r: Omit<
            Database['public']['Tables']['reuniones']['Row'],
            Database['public']['Tables']['reuniones']['ComputedFields']
          >
        }
        Returns: Json
      }
      _orden_reunion: {
        Args: { p_asignado: string; p_candidatos: string[]; p_excluir: string; p_h: string }
        Returns: string[]
      }
      _pasar_reunion: {
        Args: {
          p_orden: string[]
          p_r: Omit<
            Database['public']['Tables']['reuniones']['Row'],
            Database['public']['Tables']['reuniones']['ComputedFields']
          >
        }
        Returns: string
      }
      _repartir_reuniones: { Args: { p_perfil: string; p_respaldo: string }; Returns: Json }
      _repartir_solicitudes: { Args: { p_perfil: string }; Returns: Json }
      _resumen_reunion: { Args: { p_anfitrion_anterior: string; p_reunion: string }; Returns: Json }
      _reunion_del_panel: {
        Args: { p_esperado: string; p_reunion_id: string }
        Returns: {
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
        SetofOptions: {
          from: '*'
          to: 'reuniones'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _reunion_del_token: {
        Args: { p_esperado: string; p_token_hash: string }
        Returns: {
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
        SetofOptions: {
          from: '*'
          to: 'reuniones'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _transicion: {
        Args: {
          p_desde: Database['public']['Enums']['estado_solicitud']
          p_hacia: Database['public']['Enums']['estado_solicitud']
        }
        Returns: {
          actores: string[]
          efecto: Database['public']['Enums']['estado_reunion']
          solo_despues_del_inicio: boolean
        }[]
      }
      _validar_zona: { Args: { p_zona: string }; Returns: undefined }
      cambiar_estado_solicitud: {
        Args: {
          p_actualizado_en_esperado: string
          p_estado: Database['public']['Enums']['estado_solicitud']
          p_solicitud_id: string
        }
        Returns: Json
      }
      cambiar_reunion: {
        Args: { p_actualizado_en_esperado: string; p_inicio: string; p_token_hash: string }
        Returns: Json
      }
      cambiar_reunion_panel: {
        Args: { p_actualizado_en_esperado: string; p_inicio: string; p_reunion_id: string }
        Returns: Json
      }
      cancelar_reunion: {
        Args: { p_actualizado_en_esperado: string; p_token_hash: string }
        Returns: Json
      }
      cancelar_reunion_panel: {
        Args: { p_actualizado_en_esperado: string; p_reunion_id: string }
        Returns: Json
      }
      contar_envio: {
        Args: { p_clave: string; p_maximo: number; p_ventana_segundos: number }
        Returns: boolean
      }
      crear_o_juntar_solicitud: {
        Args: {
          p_administracion?: number
          p_autos_hoy?: number
          p_autos_meta?: number
          p_calc_consultas?: number
          p_calc_margen?: number
          p_calc_respuesta?: Database['public']['Enums']['tiempo_respuesta']
          p_consentimiento_en: string
          p_email: string
          p_importadora?: string
          p_nombre: string
          p_origen: Database['public']['Enums']['origen_solicitud']
          p_origenes?: string[]
          p_pagina_origen?: string
          p_pais?: string
          p_ref_codigo?: string
          p_utm_campaign?: string
          p_utm_content?: string
          p_utm_medium?: string
          p_utm_source?: string
          p_utm_term?: string
          p_vendedores?: number
          p_whatsapp?: string
        }
        Returns: Json
      }
      datos_para_horas: { Args: { p_solicitud_id: string; p_token_hash: string }; Returns: Json }
      desactivar_usuario: {
        Args: { p_actualizado_en_esperado: string; p_perfil_id: string }
        Returns: Json
      }
      es_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      es_usuario_activo: { Args: Record<PropertyKey, never>; Returns: boolean }
      ids_con_alcance: { Args: { p_clave: string }; Returns: string[] }
      mis_permisos: { Args: Record<PropertyKey, never>; Returns: Json }
      puede_en_solicitud: { Args: { p_clave: string; p_solicitud: string }; Returns: boolean }
      reasignar_solicitud: {
        Args: { p_actualizado_en_esperado: string; p_asignar_a: string; p_solicitud_id: string }
        Returns: Json
      }
      reservar_reunion: {
        Args: {
          p_inicio: string
          p_solicitud_id: string
          p_token_anterior: string
          p_token_hash: string
          p_zona_visitante: string
        }
        Returns: Json
      }
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
