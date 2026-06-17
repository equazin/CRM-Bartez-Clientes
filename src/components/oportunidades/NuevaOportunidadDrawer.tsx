import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Empresa, EstadoOportunidad } from '@/types/domain'

const ESTADOS: EstadoOportunidad[] = ['Abierta', 'Cotizada', 'En negociación', 'Ganada', 'Perdida']

const schema = z.object({
  empresa_id:           z.string().min(1, 'Seleccioná una empresa'),
  titulo:               z.string().min(1, 'El título es obligatorio'),
  descripcion:          z.string().optional(),
  monto_estimado:       z.coerce.number().positive('Ingresá un monto').optional().nullable(),
  moneda:               z.enum(['ARS', 'USD']),
  estado:               z.enum(['Abierta', 'Cotizada', 'En negociación', 'Ganada', 'Perdida']),
  probabilidad:         z.coerce.number().min(0).max(100).optional().nullable(),
  fecha_cierre_estimada: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  empresaIdInicial?: string
}

const inputClass = 'w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep'
const inputStyle = (err?: boolean) => ({
  borderColor: err ? '#ef4444' : 'var(--border)',
  backgroundColor: 'var(--bg)',
  color: 'var(--text)',
})
const labelClass = 'block text-xs font-medium mb-1'

export default function NuevaOportunidadDrawer({ open, onClose, empresaIdInicial }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-select', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas').select('id, razon_social').eq('owner_id', user!.id)
        .not('etapa', 'in', '("Inactivo/Perdido")')
        .order('razon_social')
      if (error) throw error
      return data as Pick<Empresa, 'id' | 'razon_social'>[]
    },
    enabled: !!user && open,
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      empresa_id: empresaIdInicial ?? '',
      moneda: 'ARS',
      estado: 'Abierta',
      probabilidad: 50,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('oportunidades').insert({
        empresa_id:            data.empresa_id,
        owner_id:              user!.id,
        titulo:                data.titulo,
        descripcion:           data.descripcion || null,
        monto_estimado:        data.monto_estimado ?? null,
        moneda:                data.moneda,
        estado:                data.estado,
        probabilidad:          data.probabilidad ?? null,
        fecha_cierre_estimada: data.fecha_cierre_estimada || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oportunidades'] })
      queryClient.invalidateQueries({ queryKey: ['oportunidades-empresa'] })
      reset()
      onClose()
      toast.success('Oportunidad creada')
    },
    onError: () => toast.error('No se pudo crear la oportunidad'),
  })

  if (!open) return null

  const monedaActual = watch('moneda')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog" aria-modal="true" aria-label="Nueva oportunidad"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>
            Nueva oportunidad
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 px-5 py-5 space-y-4">

            {/* Empresa */}
            {!empresaIdInicial && (
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Empresa *</label>
                <select
                  {...register('empresa_id')}
                  className={inputClass}
                  style={inputStyle(!!errors.empresa_id)}
                >
                  <option value="">Seleccioná una empresa…</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
                </select>
                {errors.empresa_id && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.empresa_id.message}</p>}
              </div>
            )}

            {/* Título */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text)' }}>Título *</label>
              <input
                {...register('titulo')}
                placeholder="Ej: Equipamiento sala de servidores — 40 PCs"
                className={inputClass}
                style={inputStyle(!!errors.titulo)}
              />
              {errors.titulo && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.titulo.message}</p>}
            </div>

            {/* Descripción */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text)' }}>Descripción <span style={{ color: 'var(--text-2)' }}>(opcional)</span></label>
              <textarea
                {...register('descripcion')}
                rows={2}
                placeholder="Contexto del negocio, condiciones, etc."
                className={inputClass}
                style={{ ...inputStyle(), resize: 'none' }}
              />
            </div>

            {/* Monto + moneda */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text)' }}>Monto estimado</label>
              <div className="flex gap-2">
                {/* Toggle moneda */}
                <div className="flex border rounded-sm overflow-hidden flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                  {(['ARS', 'USD'] as const).map(m => (
                    <label
                      key={m}
                      className="px-3 py-2 text-xs font-mono font-medium cursor-pointer select-none transition-colors"
                      style={{
                        backgroundColor: monedaActual === m ? '#14532D' : 'var(--surface)',
                        color: monedaActual === m ? 'white' : 'var(--text-2)',
                      }}
                    >
                      <input type="radio" {...register('moneda')} value={m} className="sr-only" />
                      {m}
                    </label>
                  ))}
                </div>
                <input
                  type="number"
                  {...register('monto_estimado')}
                  placeholder="0"
                  min="0"
                  step="1000"
                  className={`${inputClass} font-mono`}
                  style={inputStyle(!!errors.monto_estimado)}
                />
              </div>
              {errors.monto_estimado && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.monto_estimado.message}</p>}
            </div>

            {/* Estado + probabilidad */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Estado</label>
                <select {...register('estado')} className={inputClass} style={inputStyle()}>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>
                  Probabilidad <span className="font-mono" style={{ color: 'var(--text-2)' }}>%</span>
                </label>
                <input
                  type="number"
                  {...register('probabilidad')}
                  min="0" max="100"
                  placeholder="50"
                  className={`${inputClass} font-mono`}
                  style={inputStyle()}
                />
              </div>
            </div>

            {/* Fecha cierre estimada */}
            <div>
              <label className={labelClass} style={{ color: 'var(--text)' }}>
                Cierre estimado <span style={{ color: 'var(--text-2)' }}>(opcional)</span>
              </label>
              <input
                type="date"
                {...register('fecha_cierre_estimada')}
                className={`${inputClass} font-mono`}
                style={inputStyle()}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {mutation.error && (
              <p className="text-xs mb-2" style={{ color: '#ef4444' }}>Error al guardar. Intentá de nuevo.</p>
            )}
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
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 py-2 text-sm font-medium rounded-sm disabled:opacity-60"
                style={{ backgroundColor: '#14532D', color: 'white' }}
              >
                {mutation.isPending ? 'Guardando…' : 'Crear oportunidad'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
