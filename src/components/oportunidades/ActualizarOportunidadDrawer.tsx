import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { EstadoOportunidad, Oportunidad, Prioridad } from '@/types/domain'

const ESTADOS: EstadoOportunidad[] = ['Abierta', 'Cotizada', 'En negociación', 'Ganada', 'Perdida']
const PRIORIDADES: Prioridad[] = ['Alta', 'Media', 'Baja']

const hoy = format(new Date(), 'yyyy-MM-dd')
const manana = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
const en7dias = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')
const en14dias = format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd')

const schema = z.object({
  estado: z.enum(['Abierta', 'Cotizada', 'En negociación', 'Ganada', 'Perdida']),
  probabilidad: z.coerce.number().min(0).max(100).optional().nullable(),
  fecha_cierre_estimada: z.string().optional(),
  motivo_perdida: z.string().optional(),
  proximo_hito: z.string().optional(),
  proximo_hito_fecha: z.string().optional(),
  proximo_hito_prioridad: z.enum(['Alta', 'Media', 'Baja']),
}).superRefine((data, ctx) => {
  if (data.estado === 'Perdida' && !data.motivo_perdida?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Indicá por qué se perdió',
      path: ['motivo_perdida'],
    })
  }
  if (data.proximo_hito?.trim() && !data.proximo_hito_fecha) {
    ctx.addIssue({
      code: 'custom',
      message: 'Elegí fecha para el hito',
      path: ['proximo_hito_fecha'],
    })
  }
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface Props {
  oportunidad: Oportunidad | null
  open: boolean
  onClose: () => void
}

const inputClass = 'w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep'
const labelClass = 'block text-xs font-medium mb-1'
const inputStyle = (err?: boolean) => ({
  borderColor: err ? '#ef4444' : 'var(--border)',
  backgroundColor: 'var(--bg)',
  color: 'var(--text)',
})

function defaultProbability(estado: EstadoOportunidad, current: number | null): number {
  if (current !== null) return current
  if (estado === 'Ganada') return 100
  if (estado === 'Perdida') return 0
  if (estado === 'Cotizada') return 50
  if (estado === 'En negociación') return 70
  return 25
}

export default function ActualizarOportunidadDrawer({ oportunidad, open, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    values: oportunidad ? {
      estado: oportunidad.estado,
      probabilidad: defaultProbability(oportunidad.estado, oportunidad.probabilidad),
      fecha_cierre_estimada: oportunidad.fecha_cierre_estimada ?? '',
      motivo_perdida: oportunidad.motivo_perdida ?? '',
      proximo_hito: '',
      proximo_hito_fecha: manana,
      proximo_hito_prioridad: 'Media',
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!oportunidad) return

      const { error: opError } = await supabase
        .from('oportunidades')
        .update({
          estado: data.estado,
          probabilidad: data.probabilidad ?? null,
          fecha_cierre_estimada: data.fecha_cierre_estimada || null,
          motivo_perdida: data.estado === 'Perdida' ? data.motivo_perdida || null : null,
        })
        .eq('id', oportunidad.id)
      if (opError) throw opError

      if (data.proximo_hito?.trim()) {
        const { error: tareaError } = await supabase.from('tareas').insert({
          owner_id: user!.id,
          empresa_id: oportunidad.empresa_id,
          oportunidad_id: oportunidad.id,
          titulo: data.proximo_hito.trim(),
          vencimiento: data.proximo_hito_fecha,
          prioridad: data.proximo_hito_prioridad,
          completada: false,
        })
        if (tareaError) throw tareaError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oportunidades'] })
      queryClient.invalidateQueries({ queryKey: ['oportunidades-empresa'] })
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
      queryClient.invalidateQueries({ queryKey: ['tareas-empresa'] })
      reset()
      onClose()
      toast.success('Oportunidad actualizada')
    },
    onError: () => toast.error('No se pudo actualizar la oportunidad'),
  })

  if (!open || !oportunidad) return null

  const estadoActual = watch('estado')
  const fechaHito = watch('proximo_hito_fecha')

  function aplicarEstado(estado: EstadoOportunidad) {
    setValue('estado', estado, { shouldValidate: true })
    setValue('probabilidad', defaultProbability(estado, null), { shouldValidate: true })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Actualizar oportunidad"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-md truncate" style={{ color: 'var(--text)' }}>
              Actualizar oportunidad
            </h2>
            <p className="text-sm mt-0.5 truncate max-w-[280px]" style={{ color: 'var(--text-2)' }}>
              {oportunidad.titulo}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 px-5 py-5 space-y-5">
            <section>
              <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: '#14532D' }}>
                Estado comercial
              </p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {ESTADOS.map(estado => {
                  const selected = estadoActual === estado
                  return (
                    <button
                      key={estado}
                      type="button"
                      onClick={() => aplicarEstado(estado)}
                      className="px-2.5 py-1 text-xs border rounded-sm transition-colors"
                      style={{
                        borderColor: selected ? '#14532D' : 'var(--border)',
                        backgroundColor: selected ? '#14532D10' : 'transparent',
                        color: selected ? '#14532D' : 'var(--text-2)',
                      }}
                    >
                      {estado}
                    </button>
                  )
                })}
              </div>
              <input type="hidden" {...register('estado')} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Probabilidad %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    {...register('probabilidad')}
                    className={`${inputClass} font-mono`}
                    style={inputStyle(!!errors.probabilidad)}
                  />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Cierre estimado</label>
                  <input
                    type="date"
                    {...register('fecha_cierre_estimada')}
                    className={`${inputClass} font-mono`}
                    style={inputStyle()}
                  />
                </div>
              </div>

              {estadoActual === 'Perdida' && (
                <div className="mt-3">
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Motivo de pérdida *</label>
                  <textarea
                    {...register('motivo_perdida')}
                    rows={3}
                    placeholder="Ej: precio, timing, proveedor actual, sin presupuesto..."
                    className={inputClass}
                    style={{ ...inputStyle(!!errors.motivo_perdida), resize: 'none' }}
                  />
                  {errors.motivo_perdida && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.motivo_perdida.message}</p>}
                </div>
              )}
            </section>

            <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: '#A8893A' }}>
                Próximo hito
              </p>
              <div className="space-y-3">
                <input
                  {...register('proximo_hito')}
                  placeholder="Ej: Enviar cotización revisada o llamar para decisión"
                  className={inputClass}
                  style={inputStyle()}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Mañana', val: manana },
                    { label: 'En 1 sem', val: en7dias },
                    { label: 'En 2 sem', val: en14dias },
                  ].map(({ label, val }) => (
                    <label
                      key={val}
                      className="px-2 py-1 text-xs border rounded-sm cursor-pointer select-none transition-colors"
                      style={{
                        borderColor: fechaHito === val ? '#14532D' : 'var(--border)',
                        backgroundColor: fechaHito === val ? '#14532D10' : 'transparent',
                        color: fechaHito === val ? '#14532D' : 'var(--text-2)',
                      }}
                    >
                      <input type="radio" {...register('proximo_hito_fecha')} value={val} className="sr-only" />
                      {label}
                    </label>
                  ))}
                  <input
                    type="date"
                    min={hoy}
                    {...register('proximo_hito_fecha')}
                    className="font-mono px-2.5 py-1.5 text-xs border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
                    style={inputStyle(!!errors.proximo_hito_fecha)}
                  />
                </div>
                {errors.proximo_hito_fecha && <p className="text-xs" style={{ color: '#ef4444' }}>{errors.proximo_hito_fecha.message}</p>}
                <select {...register('proximo_hito_prioridad')} className={inputClass} style={inputStyle()}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>Prioridad {p}</option>)}
                </select>
              </div>
            </section>
          </div>

          <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {mutation.error && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>Error al guardar. Intentá de nuevo.</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border rounded-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                Cancelar
              </button>
              <button type="submit" disabled={mutation.isPending} className="flex-1 py-2 text-sm font-medium rounded-sm disabled:opacity-60" style={{ backgroundColor: '#14532D', color: 'white' }}>
                {mutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
