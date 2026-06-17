export type Etapa =
  | 'Prospecto'
  | 'Contactado'
  | 'Derivado a Compras'
  | 'En alta de proveedor'
  | 'Proveedor habilitado'
  | 'Cotización enviada'
  | 'Cliente'
  | 'Inactivo/Perdido'

export type Sector =
  | 'Siderurgia'
  | 'Metalurgia'
  | 'Autopartes'
  | 'Maquinaria agrícola'
  | 'Agroexportadora'
  | 'Lácteos'
  | 'Alimentos'
  | 'Frigorífico'
  | 'Seguros'
  | 'Prepaga'
  | 'Salud'
  | 'Banca'
  | 'Cooperativa'
  | 'Retail'
  | 'Mutual'
  | 'Automotriz'
  | 'Industria'
  | 'Servicio público'
  | 'Entretenimiento'
  | 'Otro'

export type Canal = 'Email' | 'Formulario' | 'Portal' | 'WhatsApp' | 'Teléfono'

export type Prioridad = 'Alta' | 'Media' | 'Baja'

export type AreaContacto = 'Recepción' | 'Compras' | 'IT' | 'Administración' | 'Gerencia' | 'Otro'

export type TipoInteraccion =
  | 'Email enviado'
  | 'Email recibido'
  | 'Llamada'
  | 'WhatsApp'
  | 'Formulario'
  | 'Reunión'
  | 'Cotización'
  | 'Nota'

export type EstadoOportunidad =
  | 'Abierta'
  | 'Cotizada'
  | 'En negociación'
  | 'Ganada'
  | 'Perdida'

export type EstadoDocAlta = 'pendiente' | 'enviado' | 'observado' | 'aprobado'

export interface DocAltaDetalle {
  estado: EstadoDocAlta
  fecha?: string | null
  notas?: string | null
}

export type DocAltaValue = boolean | DocAltaDetalle

export interface DocsAlta {
  constancia_afip: DocAltaValue
  iibb: DocAltaValue
  datos_bancarios: DocAltaValue
  cuit_certificado: DocAltaValue
  formulario_proveedor: DocAltaValue
  contrato_firmado: DocAltaValue
}

// Columnas reales en DB (schema existente)
export interface Empresa {
  id: string
  owner_id: string
  razon_social: string
  nombre_fantasia: string | null
  cuit: string | null
  sector: Sector
  ciudad: string
  provincia: string
  distancia_km: number | null
  domicilio: string | null
  sitio_web: string | null
  telefono_principal: string | null   // DB usa telefono_principal
  email_principal: string | null
  prioridad: Prioridad
  canal_preferido: Canal
  etapa: Etapa
  origen: string | null
  notas: string | null
  proxima_accion: string | null
  proxima_accion_fecha: string | null
  motivo_perdida: string | null
  docs_alta: DocsAlta
  created_at: string
  updated_at: string
}

export interface Contacto {
  id: string
  empresa_id: string
  user_id: string | null
  nombre: string
  cargo: string | null
  area: AreaContacto
  email: string | null
  telefono: string | null
  es_contacto_principal: boolean      // DB usa es_contacto_principal
  notas: string | null
  created_at: string
}

export interface Interaccion {
  id: string
  empresa_id: string
  contacto_id: string | null
  user_id: string | null
  tipo: TipoInteraccion
  canal: Canal | null
  fecha: string
  asunto: string | null
  descripcion: string | null
  resultado: string | null
  etapa_snapshot: Etapa | null
  created_at: string
  contacto?: Pick<Contacto, 'id' | 'nombre' | 'cargo' | 'area'>
}

export interface Tarea {
  id: string
  empresa_id: string | null
  oportunidad_id: string | null
  owner_id: string                    // DB usa owner_id
  titulo: string
  descripcion: string | null
  vencimiento: string
  prioridad: Prioridad
  completada: boolean
  completada_en: string | null
  created_at: string
  empresa?: Pick<Empresa, 'id' | 'razon_social' | 'etapa'>
}

export interface Oportunidad {
  id: string
  empresa_id: string
  titulo: string
  descripcion: string | null
  monto_estimado: number | null
  moneda: 'ARS' | 'USD'
  estado: EstadoOportunidad
  probabilidad: number | null
  fecha_cierre_estimada: string | null
  motivo_perdida: string | null
  created_at: string
  updated_at: string
  empresa?: Pick<Empresa, 'id' | 'razon_social'>
}

export interface HistorialEtapa {
  id: string
  empresa_id: string
  user_id: string | null
  etapa_desde: Etapa | null
  etapa_hasta: Etapa
  notas: string | null
  creado_en: string
}
