import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Empresa, Prioridad } from '@/types/domain'

interface Props {
  empresa: Empresa
  open: boolean
  onClose: () => void
}

type PasoSecuencia = {
  offsetDias: number
  titulo: string
  descripcion: string
  prioridad: Prioridad
}

type PlantillaSecuencia = {
  id: string
  nombre: string
  bajada: string
  color: string
  pasos: PasoSecuencia[]
}

const PLANTILLAS: PlantillaSecuencia[] = [
  {
    id: 'prospeccion',
    nombre: 'Prospeccion multicanal',
    bajada: 'Primer contacto, llamado y cierre de intento.',
    color: '#14532D',
    pasos: [
      {
        offsetDias: 0,
        titulo: 'Enviar presentacion comercial',
        descripcion: 'Mandar presentacion breve y pedir contacto de Compras o Administracion.',
        prioridad: 'Alta',
      },
      {
        offsetDias: 2,
        titulo: 'Llamar para validar contacto decisor',
        descripcion: 'Confirmar recepcion y conseguir referente interno.',
        prioridad: 'Alta',
      },
      {
        offsetDias: 5,
        titulo: 'Enviar follow-up por canal preferido',
        descripcion: 'Reforzar propuesta, adjuntar datos utiles y pedir siguiente paso.',
        prioridad: 'Media',
      },
      {
        offsetDias: 10,
        titulo: 'Definir avance o pausar prospecto',
        descripcion: 'Cerrar intento, registrar resultado y actualizar etapa.',
        prioridad: 'Media',
      },
    ],
  },
  {
    id: 'alta-proveedor',
    nombre: 'Alta de proveedor',
    bajada: 'Documentos, envio y seguimiento de habilitacion.',
    color: '#A8893A',
    pasos: [
      {
        offsetDias: 0,
        titulo: 'Revisar documentacion requerida',
        descripcion: 'Chequear documentos disponibles y pendientes para el alta.',
        prioridad: 'Alta',
      },
      {
        offsetDias: 2,
        titulo: 'Enviar documentacion de proveedor',
        descripcion: 'Enviar documentos al contacto administrativo o portal indicado.',
        prioridad: 'Alta',
      },
      {
        offsetDias: 5,
        titulo: 'Confirmar recepcion de documentacion',
        descripcion: 'Validar que no haya observaciones ni formularios faltantes.',
        prioridad: 'Media',
      },
      {
        offsetDias: 12,
        titulo: 'Pedir estado de habilitacion',
        descripcion: 'Solicitar fecha estimada de aprobacion o proximo requisito.',
        prioridad: 'Media',
      },
    ],
  },
  {
    id: 'cotizacion',
    nombre: 'Cotizacion enviada',
    bajada: 'Seguimiento despues de enviar precio o propuesta.',
    color: '#6B6B6A',
    pasos: [
      {
        offsetDias: 1,
        titulo: 'Confirmar recepcion de cotizacion',
        descripcion: 'Verificar que la propuesta llego y quedo en manos del decisor.',
        prioridad: 'Alta',
      },
      {
        offsetDias: 4,
        titulo: 'Resolver dudas tecnicas o comerciales',
        descripcion: 'Preguntar si necesitan ajustes, alternativas o documentacion adicional.',
        prioridad: 'Media',
      },
      {
        offsetDias: 7,
        titulo: 'Pedir decision o fecha de definicion',
        descripcion: 'Alinear siguiente paso concreto con Compras o usuario interno.',
        prioridad: 'Alta',
      },
      {
        offsetDias: 14,
        titulo: 'Cerrar, renegociar o reprogramar oportunidad',
        descripcion: 'Actualizar oportunidad segun respuesta: ganada, perdida o en negociacion.',
        prioridad: 'Media',
      },
    ],
  },
]

const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }

export default function SecuenciaSeguimientoDrawer({ empresa, open, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [plantillaId, setPlantillaId] = useState(PLANTILLAS[0].id)
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'))

  const plantilla = useMemo(
    () => PLANTILLAS.find(item => item.id === plantillaId) ?? PLANTILLAS[0],
    [plantillaId]
  )

  const tareasPreview = useMemo(() => {
    const base = fechaInicio ? new Date(`${fechaInicio}T00:00:00`) : new Date()
    return plantilla.pasos.map(paso => ({
      ...paso,
      vencimiento: format(addDays(base, paso.offsetDias), 'yyyy-MM-dd'),
    }))
  }, [fechaInicio, plantilla])

  const mutation = useMutation({
    mutationFn: async () => {
      const rows = tareasPreview.map(paso => ({
        owner_id: user!.id,
        empresa_id: empresa.id,
        oportunidad_id: null,
        titulo: paso.titulo,
        descripcion: paso.descripcion,
        vencimiento: paso.vencimiento,
        prioridad: paso.prioridad,
        completada: false,
      }))

      const { error } = await supabase.from('tareas').insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
      queryClient.invalidateQueries({ queryKey: ['tareas-empresa', empresa.id] })
      onClose()
      toast.success('Secuencia creada')
    },
    onError: () => toast.error('No se pudo crear la secuencia'),
  })

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-lg z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Crear secuencia comercial"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>
              Crear secuencia
            </h2>
            <p className="text-sm mt-0.5 truncate max-w-[340px]" style={{ color: 'var(--text-2)' }}>
              {empresa.razon_social}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <section>
            <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: '#14532D' }}>
              Plantilla
            </p>
            <div className="grid gap-2">
              {PLANTILLAS.map(item => {
                const selected = item.id === plantilla.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlantillaId(item.id)}
                    className="text-left p-3 border rounded-sm transition-colors"
                    style={{
                      borderColor: selected ? item.color : 'var(--border)',
                      backgroundColor: selected ? `${item.color}10` : 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: selected ? item.color : 'var(--text)' }}>
                          {item.nombre}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{item.bajada}</p>
                      </div>
                      {selected && <Check size={14} className="ml-auto flex-shrink-0" style={{ color: item.color }} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>
              Fecha de inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
              className="font-mono w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
              style={inputStyle}
            />
          </section>

          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-2)' }}>
              Tareas a crear
            </p>
            <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {tareasPreview.map((paso, idx) => (
                <div
                  key={`${paso.offsetDias}-${paso.titulo}`}
                  className="px-3 py-3 flex gap-3"
                  style={{
                    borderBottom: idx < tareasPreview.length - 1 ? '1px solid var(--border)' : undefined,
                    backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                  }}
                >
                  <CalendarPlus size={14} className="mt-0.5 flex-shrink-0" style={{ color: plantilla.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{paso.titulo}</p>
                      <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                        {paso.vencimiento}
                      </span>
                    </div>
                    <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--text-2)' }}>{paso.descripcion}</p>
                    <p className="text-xs mt-1" style={{ color: paso.prioridad === 'Alta' ? '#A8893A' : 'var(--text-2)' }}>
                      Prioridad {paso.prioridad}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {mutation.error && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>Error al crear. Intenta de nuevo.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm border rounded-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || tareasPreview.length === 0}
              className="flex-1 py-2 text-sm font-medium rounded-sm disabled:opacity-60"
              style={{ backgroundColor: '#14532D', color: 'white' }}
            >
              {mutation.isPending ? 'Creando...' : `Crear ${tareasPreview.length} tareas`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
