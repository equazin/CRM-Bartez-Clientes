import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Empresa, Interaccion, Contacto, Tarea, Oportunidad, Etapa, Prioridad,
  DocsAlta, HistorialEtapa, DocAltaDetalle, EstadoDocAlta,
} from '@/types/domain'
import {
  etapaConfig, ETAPAS_ORDEN, formatFecha, formatFechaDoble,
  canalEmoji, esFechaVencida, formatCuit, formatMoneda,
} from '@/lib/utils'
import {
  ArrowLeft, Plus, Phone, Mail, Globe, MapPin, Building2,
  Check, ExternalLink, FileText, Pencil, Trash2, History, CalendarPlus,
  Activity, Clock, BriefcaseBusiness, MailPlus,
} from 'lucide-react'
import RegistrarInteraccionDrawer from '@/components/interacciones/RegistrarInteraccionDrawer'
import NuevoContactoForm from '@/components/contactos/NuevoContactoForm'
import EditarEmpresaDrawer from '@/components/empresas/EditarEmpresaDrawer'
import SecuenciaSeguimientoDrawer from '@/components/empresas/SecuenciaSeguimientoDrawer'
import NuevaOportunidadDrawer from '@/components/oportunidades/NuevaOportunidadDrawer'
import ActualizarOportunidadDrawer from '@/components/oportunidades/ActualizarOportunidadDrawer'
import MotivoPerdidaModal from '@/components/empresas/MotivoPerdidaModal'
import GenerarEmailModal from '@/components/empresas/GenerarEmailModal'
import { useToast } from '@/contexts/ToastContext'

const DOCS_LABELS: Record<keyof DocsAlta, string> = {
  constancia_afip:    'Constancia AFIP',
  iibb:               'IIBB',
  datos_bancarios:    'Datos bancarios',
  cuit_certificado:   'CUIT certificado',
  formulario_proveedor: 'Formulario proveedor',
  contrato_firmado:   'Contrato firmado',
}

const DOC_ESTADOS: EstadoDocAlta[] = ['pendiente', 'enviado', 'observado', 'aprobado']

const DOC_ESTADO_CONFIG: Record<EstadoDocAlta, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'var(--text-2)', bg: 'transparent' },
  enviado: { label: 'Enviado', color: '#14532D', bg: '#14532D10' },
  observado: { label: 'Observado', color: '#A8893A', bg: '#A8893A12' },
  aprobado: { label: 'Aprobado', color: '#14532D', bg: '#14532D18' },
}

function normalizarDocAlta(value: DocsAlta[keyof DocsAlta] | undefined): DocAltaDetalle {
  if (typeof value === 'boolean') {
    return { estado: value ? 'aprobado' : 'pendiente', fecha: null, notas: null }
  }

  if (value && typeof value === 'object') {
    return {
      estado: DOC_ESTADOS.includes(value.estado) ? value.estado : 'pendiente',
      fecha: value.fecha ?? null,
      notas: value.notas ?? null,
    }
  }

  return { estado: 'pendiente', fecha: null, notas: null }
}

function docAprobado(value: DocsAlta[keyof DocsAlta] | undefined) {
  return normalizarDocAlta(value).estado === 'aprobado'
}

function fechaEnDias(dias: number) {
  const date = new Date()
  date.setDate(date.getDate() + dias)
  return date.toISOString().slice(0, 10)
}

function getTareaPorCambioEtapa(etapa: Etapa): { titulo: string; descripcion: string; vencimiento: string; prioridad: Prioridad } | null {
  if (etapa === 'Cotización enviada') {
    return {
      titulo: 'Confirmar recepcion de cotizacion',
      descripcion: 'Automatica: la empresa paso a Cotizacion enviada. Validar recepcion y proximo decisor.',
      vencimiento: fechaEnDias(1),
      prioridad: 'Alta',
    }
  }
  if (etapa === 'En alta de proveedor') {
    return {
      titulo: 'Revisar documentacion para alta',
      descripcion: 'Automatica: preparar o completar documentos requeridos para el alta de proveedor.',
      vencimiento: fechaEnDias(1),
      prioridad: 'Alta',
    }
  }
  return null
}

export default function EmpresaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [drawerOpen, setDrawerOpen]           = useState(false)
  const [editarOpen, setEditarOpen]           = useState(false)
  const [secuenciaOpen, setSecuenciaOpen]     = useState(false)
  const [opDrawerOpen, setOpDrawerOpen]       = useState(false)
  const [editarOportunidad, setEditarOportunidad] = useState<Oportunidad | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [motivoPerdidaOpen, setMotivoPerdidaOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [contactoFormOpen, setContactoFormOpen] = useState(false)
  const [notasEditando, setNotasEditando]     = useState(false)
  const [notasTemp, setNotasTemp]             = useState('')
  const [seccionAbierta, setSeccionAbierta]   = useState<'actividad' | 'bitacora' | 'tareas' | 'oportunidades'>('actividad')

  // ── Queries ──────────────────────────────────────────
  const { data: empresa, isLoading } = useQuery({
    queryKey: ['empresa', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas').select('*')
        .eq('id', id).eq('owner_id', user!.id).single()
      if (error) throw error
      return data as Empresa
    },
    enabled: !!id && !!user,
  })

  const { data: interacciones = [] } = useQuery({
    queryKey: ['interacciones', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interacciones')
        .select('*, contacto:contactos(id, nombre, cargo, area)')
        .eq('empresa_id', id!).order('fecha', { ascending: false })
      if (error) throw error
      return data as Interaccion[]
    },
    enabled: !!id,
  })

  const { data: contactos = [] } = useQuery({
    queryKey: ['contactos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contactos').select('*').eq('empresa_id', id!)
        .order('es_contacto_principal', { ascending: false })
      if (error) throw error
      return data as Contacto[]
    },
    enabled: !!id,
  })

  const { data: tareas = [] } = useQuery({
    queryKey: ['tareas-empresa', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tareas').select('*').eq('empresa_id', id!)
        .eq('completada', false).order('vencimiento', { ascending: true })
      if (error) throw error
      return data as Tarea[]
    },
    enabled: !!id,
  })

  const { data: oportunidades = [] } = useQuery({
    queryKey: ['oportunidades-empresa', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oportunidades').select('*').eq('empresa_id', id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Oportunidad[]
    },
    enabled: !!id,
  })

  const { data: historialEtapas = [] } = useQuery({
    queryKey: ['historial-etapas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historial_etapas')
        .select('*')
        .eq('empresa_id', id!)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data as HistorialEtapa[]
    },
    enabled: !!id,
  })

  // ── Mutations ─────────────────────────────────────────
  const etapaMutation = useMutation({
    mutationFn: async ({ nuevaEtapa, motivo }: { nuevaEtapa: Etapa; motivo?: string }) => {
      await supabase.from('historial_etapas').insert({
        empresa_id: id, user_id: user!.id,
        etapa_desde: empresa?.etapa ?? null, etapa_hasta: nuevaEtapa,
        notas: motivo || null,
      })
      const update: { etapa: Etapa; motivo_perdida?: string | null } = { etapa: nuevaEtapa }
      if (nuevaEtapa === 'Inactivo/Perdido') update.motivo_perdida = motivo || null
      const { error } = await supabase.from('empresas').update(update).eq('id', id)
      if (error) throw error

      const automatizacion = getTareaPorCambioEtapa(nuevaEtapa)
      if (automatizacion) {
        const { error: tareaError } = await supabase.from('tareas').insert({
          owner_id: user!.id,
          empresa_id: id,
          oportunidad_id: null,
          titulo: automatizacion.titulo,
          descripcion: automatizacion.descripcion,
          vencimiento: automatizacion.vencimiento,
          prioridad: automatizacion.prioridad,
          completada: false,
        })
        if (tareaError) throw tareaError
      }
    },
    onSuccess: (_d, { nuevaEtapa }) => {
      queryClient.invalidateQueries({ queryKey: ['empresa', id] })
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['historial-etapas', id] })
      queryClient.invalidateQueries({ queryKey: ['tareas-empresa', id] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
      setMotivoPerdidaOpen(false)
      toast.success(`Etapa cambiada a "${nuevaEtapa}"`)
    },
    onError: () => toast.error('No se pudo cambiar la etapa'),
  })

  // Intercepta el cambio: si va a Inactivo/Perdido, pide motivo primero
  function cambiarEtapa(nuevaEtapa: Etapa) {
    if (nuevaEtapa === empresa?.etapa) return
    if (nuevaEtapa === 'Inactivo/Perdido') {
      setMotivoPerdidaOpen(true)
      return
    }
    etapaMutation.mutate({ nuevaEtapa })
  }

  const docsMutation = useMutation({
    mutationFn: async ({ docs, tareaAutomatica }: { docs: DocsAlta; tareaAutomatica?: { titulo: string; descripcion: string } }) => {
      const { error } = await supabase.from('empresas').update({ docs_alta: docs }).eq('id', id)
      if (error) throw error
      if (tareaAutomatica) {
        const { error: tareaError } = await supabase.from('tareas').insert({
          owner_id: user!.id,
          empresa_id: id,
          oportunidad_id: null,
          titulo: tareaAutomatica.titulo,
          descripcion: tareaAutomatica.descripcion,
          vencimiento: fechaEnDias(1),
          prioridad: 'Alta',
          completada: false,
        })
        if (tareaError) throw tareaError
      }
    },
    onMutate: async ({ docs }) => {
      queryClient.setQueryData<Empresa>(['empresa', id], old =>
        old ? { ...old, docs_alta: docs } : old
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa', id] })
      queryClient.invalidateQueries({ queryKey: ['tareas-empresa', id] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
    },
  })

  const notasMutation = useMutation({
    mutationFn: async (notas: string) => {
      const { error } = await supabase.from('empresas').update({ notas }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa', id] })
      setNotasEditando(false)
      toast.success('Notas guardadas')
    },
    onError: () => toast.error('No se pudieron guardar las notas'),
  })

  const eliminarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('empresas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      toast.success('Empresa eliminada')
      navigate('/empresas')
    },
    onError: () => toast.error('No se pudo eliminar la empresa'),
  })

  const completarTareaMutation = useMutation({
    mutationFn: async (tareaId: string) => {
      const { error } = await supabase.from('tareas').update({
        completada: true, completada_en: new Date().toISOString(),
      }).eq('id', tareaId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas-empresa', id] }),
  })

  // ── Carga ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-4">
        <div className="h-6 w-24 skeleton rounded-sm" />
        <div className="h-36 skeleton rounded-sm" />
        <div className="h-64 skeleton rounded-sm" />
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="px-6 py-8">
        <button onClick={() => navigate('/empresas')} className="flex items-center gap-1.5 text-sm mb-4 hover:underline" style={{ color: 'var(--text-2)' }}>
          <ArrowLeft size={14} /> Empresas
        </button>
        <p style={{ color: 'var(--text-2)' }}>Empresa no encontrada.</p>
      </div>
    )
  }

  const etapa = etapaConfig[empresa.etapa]
  const vencida = esFechaVencida(empresa.proxima_accion_fecha)
  const docsAlta = empresa.docs_alta ?? {} as DocsAlta
  const docsCompletados = (Object.keys(DOCS_LABELS) as (keyof DocsAlta)[])
    .filter(key => docAprobado(docsAlta[key]))
    .length
  const docsTotal = Object.keys(DOCS_LABELS).length
  const enAltaOHabilitado = ['En alta de proveedor', 'Proveedor habilitado', 'Cotización enviada', 'Cliente'].includes(empresa.etapa)
  const actividadCount = interacciones.length + tareas.length + oportunidades.length + historialEtapas.length + docsCompletados
  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/empresas')}
        className="flex items-center gap-1.5 text-sm mb-5 hover:underline"
        style={{ color: 'var(--text-2)' }}
      >
        <ArrowLeft size={14} />
        Empresas
      </button>

      {/* ── CABECERA ──────────────────────────────────── */}
      <div className="border rounded-sm p-5 mb-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex items-start gap-4">
          {/* Datos principales */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Building2 size={15} style={{ color: 'var(--text-2)' }} />
              <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--text)' }}>
                {empresa.razon_social}
              </h1>
              {empresa.nombre_fantasia && empresa.nombre_fantasia !== empresa.razon_social && (
                <span className="text-sm" style={{ color: 'var(--text-2)' }}>· {empresa.nombre_fantasia}</span>
              )}
              <span className="text-xs px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: etapa.bg, color: etapa.color }}>
                {empresa.etapa}
              </span>
            </div>

            {/* Datos fila */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3" style={{ color: 'var(--text-2)' }}>
              <span>{empresa.sector}</span>
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {empresa.ciudad}, {empresa.provincia}
                {empresa.distancia_km != null && (
                  <span className="font-mono ml-1">{empresa.distancia_km} km</span>
                )}
              </span>
              {empresa.cuit && (
                <span className="font-mono">CUIT {formatCuit(empresa.cuit)}</span>
              )}
              <span className="flex items-center gap-1">
                {canalEmoji[empresa.canal_preferido]}
                <span>{empresa.canal_preferido}</span>
              </span>
              <span
                className="px-1.5 py-0 rounded-sm text-xs"
                style={{ backgroundColor: 'var(--border)' }}
              >
                Prioridad {empresa.prioridad}
              </span>
            </div>

            {/* Contacto */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {empresa.email_principal && (
                <a href={`mailto:${empresa.email_principal}`} className="flex items-center gap-1 hover:underline" style={{ color: '#14532D' }}>
                  <Mail size={11} />{empresa.email_principal}
                </a>
              )}
              {empresa.telefono_principal && (
                <span className="flex items-center gap-1 font-mono" style={{ color: 'var(--text-2)' }}>
                  <Phone size={11} />{empresa.telefono_principal}
                </span>
              )}
              {empresa.sitio_web && (
                <a
                  href={`https://${empresa.sitio_web.replace(/^https?:\/\//, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                  style={{ color: '#14532D' }}
                >
                  <Globe size={11} />{empresa.sitio_web}
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          {/* Controles: editar + eliminar + etapa */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setEmailModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-sm hover:border-green-deep hover:text-green-deep transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                title="Generar email personalizado"
              >
                <MailPlus size={12} />
                Email
              </button>
              <button
                onClick={() => setSecuenciaOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-sm hover:border-green-deep hover:text-green-deep transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                title="Crear secuencia de seguimiento"
              >
                <CalendarPlus size={12} />
                Secuencia
              </button>
              <button
                onClick={() => setEditarOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-sm hover:border-green-deep hover:text-green-deep transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                title="Editar datos de la empresa"
              >
                <Pencil size={12} />
                Editar
              </button>
              <button
                onClick={() => setConfirmarEliminar(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-sm hover:border-red-500 hover:text-red-500 transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                title="Eliminar empresa"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div>
            <p className="text-xs mb-1 text-right" style={{ color: 'var(--text-2)' }}>Etapa</p>
            <select
              value={empresa.etapa}
              onChange={e => cambiarEtapa(e.target.value as Etapa)}
              className="px-2.5 py-1.5 text-sm rounded-sm border font-medium focus:outline-none focus:ring-2 focus:ring-green-deep transition-colors"
              style={{ backgroundColor: etapa.bg, color: etapa.color, borderColor: etapa.color + '40' }}
            >
              {ETAPAS_ORDEN.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {etapaMutation.isPending && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>Guardando…</p>
            )}
            </div>
          </div>
        </div>

        {/* Motivo de pérdida */}
        {empresa.etapa === 'Inactivo/Perdido' && empresa.motivo_perdida && (
          <div
            className="mt-4 flex items-start gap-2 px-4 py-2.5 rounded-sm border-l-2"
            style={{ backgroundColor: '#4A4A4A0D', borderLeftColor: '#6B6B6A' }}
          >
            <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-2)' }}>Motivo:</span>
            <span className="text-sm" style={{ color: 'var(--text)' }}>{empresa.motivo_perdida}</span>
          </div>
        )}

        {/* Próxima acción */}
        {empresa.proxima_accion ? (
          <div
            className="mt-4 flex items-center gap-3 px-4 py-2.5 rounded-sm border-l-2"
            style={{
              backgroundColor: vencida ? '#A8893A08' : '#14532D08',
              borderLeftColor: vencida ? '#A8893A' : '#14532D',
            }}
          >
            <span className="text-sm flex-shrink-0">{canalEmoji[empresa.canal_preferido]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: vencida ? '#A8893A' : 'var(--text)' }}>
                {empresa.proxima_accion}
              </p>
              <p className="font-mono text-xs" style={{ color: vencida ? '#A8893A' : 'var(--text-2)' }}>
                {formatFechaDoble(empresa.proxima_accion_fecha)}
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors"
              style={{ backgroundColor: '#14532D', color: 'white' }}
            >
              <Plus size={11} />
              Registrar
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 px-4 py-2.5 rounded-sm border" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>Sin próxima acción agendada.</span>
            <button
              onClick={() => setDrawerOpen(true)}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-sm"
              style={{ backgroundColor: '#14532D10', color: '#14532D' }}
            >
              <Plus size={11} /> Agendar
            </button>
          </div>
        )}
      </div>

      {/* ── GRID PRINCIPAL ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Columna izquierda: bitácora + tabs ──────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tabs de sección */}
          <div className="flex gap-0 border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {([
              { key: 'actividad',    label: `Actividad (${actividadCount})` },
              { key: 'bitacora',     label: `Bitácora (${interacciones.length})` },
              { key: 'tareas',       label: `Tareas (${tareas.length})` },
              { key: 'oportunidades', label: `Oportunidades (${oportunidades.length})` },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setSeccionAbierta(tab.key)}
                className="flex-1 py-2 text-sm font-display font-medium transition-colors border-r last:border-r-0"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: seccionAbierta === tab.key ? '#14532D' : 'var(--surface)',
                  color: seccionAbierta === tab.key ? 'white' : 'var(--text-2)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {seccionAbierta === 'actividad' && (
            <ActividadUnificada
              interacciones={interacciones}
              tareas={tareas}
              oportunidades={oportunidades}
              historial={historialEtapas}
              docs={docsAlta}
            />
          )}

          {/* ── Bitácora ─────────────────────────────── */}
          {seccionAbierta === 'bitacora' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                  Historial de interacciones
                </span>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-sm font-medium"
                  style={{ backgroundColor: '#14532D10', color: '#14532D' }}
                >
                  <Plus size={12} /> Nueva interacción
                </button>
              </div>

              {interacciones.length === 0 ? (
                <EmptyState
                  msg="Sin interacciones registradas."
                  cta="Registrar la primera"
                  onCta={() => setDrawerOpen(true)}
                />
              ) : (
                <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {interacciones.map((inter, idx) => (
                    <div
                      key={inter.id}
                      className="px-4 py-3 fade-in"
                      style={{
                        borderBottom: idx < interacciones.length - 1 ? '1px solid var(--border)' : undefined,
                        backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-base flex-shrink-0 mt-0.5">
                          {inter.canal ? canalEmoji[inter.canal] : '📝'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{inter.tipo}</span>
                            {inter.contacto && (
                              <span className="text-xs px-1 py-0 rounded-sm" style={{ backgroundColor: 'var(--border)', color: 'var(--text-2)' }}>
                                {inter.contacto.nombre}
                              </span>
                            )}
                            {inter.asunto && (
                              <span className="text-xs" style={{ color: 'var(--text-2)' }}>— {inter.asunto}</span>
                            )}
                            <span className="font-mono text-xs ml-auto flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                              {formatFecha(inter.fecha)}
                            </span>
                          </div>
                          {inter.resultado && (
                            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{inter.resultado}</p>
                          )}
                          {inter.descripcion && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{inter.descripcion}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tareas ───────────────────────────────── */}
          {seccionAbierta === 'tareas' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                  Tareas pendientes
                </span>
              </div>

              {tareas.length === 0 ? (
                <EmptyState msg="Sin tareas pendientes." />
              ) : (
                <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {tareas.map((tarea, idx) => {
                    const venc = esFechaVencida(tarea.vencimiento)
                    return (
                      <div
                        key={tarea.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{
                          borderBottom: idx < tareas.length - 1 ? '1px solid var(--border)' : undefined,
                          backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                        }}
                      >
                        <button
                          onClick={() => completarTareaMutation.mutate(tarea.id)}
                          className="w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 hover:border-green-deep hover:bg-green-deep/10 transition-colors"
                          style={{ borderColor: venc ? '#A8893A' : 'var(--border)' }}
                          title="Completar"
                        >
                          <Check size={11} className="opacity-0 group-hover:opacity-100" style={{ color: '#14532D' }} />
                        </button>
                        <p className="flex-1 text-sm" style={{ color: 'var(--text)' }}>{tarea.titulo}</p>
                        <span className="font-mono text-xs flex-shrink-0" style={{ color: venc ? '#A8893A' : 'var(--text-2)' }}>
                          {formatFecha(tarea.vencimiento)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Oportunidades ────────────────────────── */}
          {seccionAbierta === 'oportunidades' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                  Oportunidades
                </span>
                <button
                  onClick={() => setOpDrawerOpen(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-sm font-medium"
                  style={{ backgroundColor: '#14532D10', color: '#14532D' }}
                >
                  <Plus size={12} /> Nueva oportunidad
                </button>
              </div>

              {oportunidades.length === 0 ? (
                <EmptyState msg="Sin oportunidades registradas." />
              ) : (
                <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {oportunidades.map((op, idx) => (
                    <div
                      key={op.id}
                      className="px-4 py-3"
                      style={{
                        borderBottom: idx < oportunidades.length - 1 ? '1px solid var(--border)' : undefined,
                        backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{op.titulo}</p>
                          {op.descripcion && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{op.descripcion}</p>
                          )}
                          {op.estado === 'Perdida' && op.motivo_perdida && (
                            <p className="text-xs mt-1" style={{ color: '#A8893A' }}>
                              Motivo: {op.motivo_perdida}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {op.monto_estimado != null && (
                            <p className="font-mono text-sm font-medium" style={{ color: '#14532D' }}>
                              {formatMoneda(op.monto_estimado, op.moneda as 'ARS' | 'USD')}
                            </p>
                          )}
                          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                            {op.estado}{op.probabilidad != null ? ` · ${op.probabilidad}%` : ''}
                          </p>
                          <button
                            onClick={() => setEditarOportunidad(op)}
                            className="text-xs mt-1 hover:underline"
                            style={{ color: '#14532D' }}
                          >
                            Actualizar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                Notas
              </span>
              {!notasEditando && (
                <button
                  onClick={() => { setNotasTemp(empresa.notas ?? ''); setNotasEditando(true) }}
                  className="text-xs hover:underline"
                  style={{ color: 'var(--text-2)' }}
                >
                  Editar
                </button>
              )}
            </div>
            {notasEditando ? (
              <div>
                <textarea
                  autoFocus
                  value={notasTemp}
                  onChange={e => setNotasTemp(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep resize-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setNotasEditando(false)}
                    className="text-xs px-3 py-1.5 border rounded-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => notasMutation.mutate(notasTemp)}
                    disabled={notasMutation.isPending}
                    className="text-xs px-3 py-1.5 rounded-sm font-medium"
                    style={{ backgroundColor: '#14532D', color: 'white' }}
                  >
                    {notasMutation.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm min-h-[40px] px-3 py-2 rounded-sm border whitespace-pre-wrap"
                style={{ borderColor: 'var(--border)', color: empresa.notas ? 'var(--text)' : 'var(--text-2)' }}
              >
                {empresa.notas || 'Sin notas.'}
              </p>
            )}
          </div>
        </div>

        {/* ── Columna derecha: contactos + docs alta ── */}
        <div className="space-y-5">

          {/* Contactos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                Contactos
              </span>
              <button
                onClick={() => setContactoFormOpen(v => !v)}
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: '#14532D' }}
              >
                <Plus size={12} /> Agregar
              </button>
            </div>

            {contactoFormOpen && (
              <NuevoContactoForm
                empresaId={id!}
                onSaved={() => {
                  setContactoFormOpen(false)
                  queryClient.invalidateQueries({ queryKey: ['contactos', id] })
                }}
                onCancel={() => setContactoFormOpen(false)}
              />
            )}

            {contactos.length === 0 && !contactoFormOpen ? (
              <div
                className="text-center py-5 border rounded-sm text-xs"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                Sin contactos cargados.
              </div>
            ) : (
              <div className="space-y-1.5">
                {contactos.map(c => (
                  <div
                    key={c.id}
                    className="px-3 py-2.5 border rounded-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.nombre}</p>
                        <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                          {[c.cargo, c.area].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {c.es_contacto_principal && (
                        <span className="text-xs px-1 rounded-sm flex-shrink-0" style={{ backgroundColor: '#14532D15', color: '#14532D' }}>
                          principal
                        </span>
                      )}
                    </div>
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-xs hover:underline block mt-1 truncate" style={{ color: '#14532D' }}>
                        {c.email}
                      </a>
                    )}
                    {c.telefono && (
                      <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{c.telefono}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <HistorialEtapasWidget
            historial={historialEtapas}
            etapaActual={empresa.etapa}
            creadoEn={empresa.created_at}
          />

          {/* Checklist docs de alta */}
          {enAltaOHabilitado && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} style={{ color: 'var(--text-2)' }} />
                <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                  Docs de alta
                </span>
                <span className="font-mono text-xs ml-auto" style={{ color: docsCompletados === docsTotal ? '#14532D' : '#A8893A' }}>
                  {docsCompletados}/{docsTotal}
                </span>
              </div>
              <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {(Object.keys(DOCS_LABELS) as (keyof DocsAlta)[]).map((key, idx, arr) => {
                  const doc = normalizarDocAlta(docsAlta[key])
                  const cfg = DOC_ESTADO_CONFIG[doc.estado]

                  function actualizarDoc(patch: Partial<DocAltaDetalle>) {
                    const siguienteDoc: DocAltaDetalle = {
                      ...doc,
                      ...patch,
                      fecha: patch.estado && patch.estado !== 'pendiente' && !doc.fecha
                        ? new Date().toISOString().slice(0, 10)
                        : patch.fecha ?? doc.fecha,
                    }
                    const nuevo = { ...docsAlta, [key]: siguienteDoc } as DocsAlta
                    docsMutation.mutate({
                      docs: nuevo,
                      tareaAutomatica: patch.estado === 'observado'
                        ? {
                            titulo: `Resolver observacion: ${DOCS_LABELS[key]}`,
                            descripcion: `Automatica: el documento "${DOCS_LABELS[key]}" quedo observado. Revisar nota y reenviar correccion.`,
                          }
                        : undefined,
                    })
                  }

                  return (
                    <div
                      key={key}
                      className="px-3 py-3 space-y-2"
                      style={{
                        borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : undefined,
                        backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0"
                          style={{
                            borderColor: doc.estado === 'aprobado' ? '#14532D' : 'var(--border)',
                            backgroundColor: doc.estado === 'aprobado' ? '#14532D' : cfg.bg,
                          }}
                        >
                          {doc.estado === 'aprobado' && <Check size={10} color="white" />}
                        </span>
                        <span className="text-xs font-medium flex-1 min-w-0" style={{ color: 'var(--text)' }}>
                          {DOCS_LABELS[key]}
                        </span>
                        <select
                          value={doc.estado}
                          onChange={e => actualizarDoc({ estado: e.target.value as EstadoDocAlta })}
                          disabled={docsMutation.isPending}
                          className="px-2 py-1 text-xs border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
                          style={{ borderColor: cfg.color, backgroundColor: cfg.bg, color: cfg.color }}
                        >
                          {DOC_ESTADOS.map(estado => (
                            <option key={estado} value={estado}>{DOC_ESTADO_CONFIG[estado].label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <input
                          type="date"
                          value={doc.fecha ?? ''}
                          onChange={e => actualizarDoc({ fecha: e.target.value || null })}
                          disabled={docsMutation.isPending}
                          className="font-mono px-2 py-1.5 text-xs border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                        />
                        <input
                          value={doc.notas ?? ''}
                          onChange={e => actualizarDoc({ notas: e.target.value || null })}
                          disabled={docsMutation.isPending}
                          placeholder="Nota"
                          className="px-2 py-1.5 text-xs border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawer interacción */}
      <RegistrarInteraccionDrawer
        empresa={empresa}
        contactos={contactos}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Drawer edición */}
      <EditarEmpresaDrawer
        empresa={empresa}
        open={editarOpen}
        onClose={() => setEditarOpen(false)}
      />

      <SecuenciaSeguimientoDrawer
        empresa={empresa}
        open={secuenciaOpen}
        onClose={() => setSecuenciaOpen(false)}
      />

      {/* Modal confirmar eliminación */}
      {confirmarEliminar && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setConfirmarEliminar(false)} />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 rounded-sm shadow-xl fade-in"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#ef444415' }}>
                <Trash2 size={16} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>
                  Eliminar empresa
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                  Vas a eliminar <strong style={{ color: 'var(--text)' }}>{empresa.razon_social}</strong> junto con toda su bitácora, contactos y tareas. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            {eliminarMutation.error && (
              <p className="text-xs mb-3" style={{ color: '#ef4444' }}>Error al eliminar. Intentá de nuevo.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmarEliminar(false)}
                className="px-4 py-2 text-sm border rounded-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarMutation.mutate()}
                disabled={eliminarMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-sm disabled:opacity-60"
                style={{ backgroundColor: '#ef4444', color: 'white' }}
              >
                {eliminarMutation.isPending ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal motivo de pérdida */}
      <MotivoPerdidaModal
        open={motivoPerdidaOpen}
        empresaNombre={empresa.razon_social}
        pending={etapaMutation.isPending}
        onConfirm={motivo => etapaMutation.mutate({ nuevaEtapa: 'Inactivo/Perdido', motivo })}
        onCancel={() => setMotivoPerdidaOpen(false)}
      />

      {/* Drawer nueva oportunidad */}
      <NuevaOportunidadDrawer
        open={opDrawerOpen}
        empresaIdInicial={empresa.id}
        onClose={() => {
          setOpDrawerOpen(false)
          queryClient.invalidateQueries({ queryKey: ['oportunidades-empresa', id] })
        }}
      />
      <ActualizarOportunidadDrawer
        oportunidad={editarOportunidad}
        open={!!editarOportunidad}
        onClose={() => setEditarOportunidad(null)}
      />

      <GenerarEmailModal
        open={emailModalOpen}
        empresa={empresa}
        contactos={contactos}
        interacciones={interacciones}
        onClose={() => setEmailModalOpen(false)}
      />
    </div>
  )
}

function ActividadUnificada({
  interacciones,
  tareas,
  oportunidades,
  historial,
  docs,
}: {
  interacciones: Interaccion[]
  tareas: Tarea[]
  oportunidades: Oportunidad[]
  historial: HistorialEtapa[]
  docs: DocsAlta
}) {
  const docItems = (Object.keys(DOCS_LABELS) as (keyof DocsAlta)[])
    .map(key => ({ key, doc: normalizarDocAlta(docs[key]) }))
    .filter(item => item.doc.estado !== 'pendiente')

  const items = [
    ...interacciones.map(item => ({
      id: `inter-${item.id}`,
      fecha: item.fecha,
      color: '#14532D',
      icon: <Activity size={13} />,
      titulo: item.asunto || item.tipo,
      meta: `${item.tipo}${item.canal ? ` · ${item.canal}` : ''}`,
      texto: item.resultado || item.descripcion || null,
    })),
    ...tareas.map(item => ({
      id: `tarea-${item.id}`,
      fecha: item.vencimiento,
      color: item.completada ? '#14532D' : '#A8893A',
      icon: <Clock size={13} />,
      titulo: item.titulo,
      meta: `Tarea ${item.completada ? 'completada' : 'pendiente'} · ${item.prioridad}`,
      texto: item.descripcion,
    })),
    ...oportunidades.map(item => ({
      id: `op-${item.id}`,
      fecha: item.updated_at || item.created_at,
      color: '#6B8CAE',
      icon: <BriefcaseBusiness size={13} />,
      titulo: item.titulo,
      meta: `${item.estado}${item.probabilidad != null ? ` · ${item.probabilidad}%` : ''}`,
      texto: item.monto_estimado != null ? formatMoneda(item.monto_estimado, item.moneda) : item.descripcion,
    })),
    ...historial.map(item => ({
      id: `hist-${item.id}`,
      fecha: item.creado_en,
      color: etapaConfig[item.etapa_hasta].color,
      icon: <History size={13} />,
      titulo: item.etapa_hasta,
      meta: item.etapa_desde ? `${item.etapa_desde} -> ${item.etapa_hasta}` : 'Cambio de etapa',
      texto: item.notas,
    })),
    ...docItems.map(item => ({
      id: `doc-${String(item.key)}`,
      fecha: item.doc.fecha || new Date(0).toISOString(),
      color: DOC_ESTADO_CONFIG[item.doc.estado].color,
      icon: <FileText size={13} />,
      titulo: DOCS_LABELS[item.key],
      meta: `Documento ${DOC_ESTADO_CONFIG[item.doc.estado].label.toLowerCase()}`,
      texto: item.doc.notas || null,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
          Centro de actividad
        </span>
        <span className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>{items.length} eventos</span>
      </div>

      {items.length === 0 ? (
        <EmptyState msg="Sin actividad registrada." />
      ) : (
        <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="px-4 py-3 flex gap-3"
              style={{
                borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : undefined,
                backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
              }}
            >
              <div className="w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{item.titulo}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{item.meta}</p>
                  </div>
                  <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                    {formatFecha(item.fecha)}
                  </span>
                </div>
                {item.texto && (
                  <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--text)' }}>{item.texto}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistorialEtapasWidget({
  historial,
  etapaActual,
  creadoEn,
}: {
  historial: HistorialEtapa[]
  etapaActual: Etapa
  creadoEn: string
}) {
  const actualCfg = etapaConfig[etapaActual]

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <History size={13} style={{ color: 'var(--text-2)' }} />
        <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
          Historial de etapas
        </span>
        <span className="font-mono text-xs ml-auto" style={{ color: 'var(--text-2)' }}>
          {historial.length}
        </span>
      </div>
      <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="px-3 py-2.5 flex items-start gap-2.5" style={{ backgroundColor: 'var(--surface)', borderBottom: historial.length ? '1px solid var(--border)' : undefined }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: actualCfg.color }} />
          <div className="min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>Etapa actual</p>
            <p className="text-xs mt-0.5" style={{ color: actualCfg.color }}>{etapaActual}</p>
          </div>
        </div>

        {historial.length === 0 ? (
          <p className="px-3 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
            Sin cambios registrados. Empresa creada el {formatFecha(creadoEn)}.
          </p>
        ) : (
          historial.map((item, idx) => {
            const cfg = etapaConfig[item.etapa_hasta]
            return (
              <div
                key={item.id}
                className="px-3 py-2.5 flex items-start gap-2.5"
                style={{
                  borderBottom: idx < historial.length - 1 ? '1px solid var(--border)' : undefined,
                  backgroundColor: idx % 2 === 0 ? 'var(--bg)' : 'transparent',
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: cfg.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {item.etapa_desde && (
                      <span className="text-xs" style={{ color: 'var(--text-2)' }}>{item.etapa_desde}</span>
                    )}
                    {item.etapa_desde && <span className="text-xs" style={{ color: 'var(--text-2)' }}>→</span>}
                    <span className="text-xs font-medium" style={{ color: cfg.color }}>{item.etapa_hasta}</span>
                  </div>
                  <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{formatFecha(item.creado_en)}</p>
                  {item.notas && (
                    <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--text)' }}>{item.notas}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Estado vacío ─────────────────────────────────────────
function EmptyState({ msg, cta, onCta }: { msg: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="text-center py-10 border rounded-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
      <p className="text-sm">{msg}</p>
      {cta && onCta && (
        <button onClick={onCta} className="text-sm mt-2 hover:underline" style={{ color: '#14532D' }}>
          {cta}
        </button>
      )}
    </div>
  )
}
