import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Empresa, Prioridad } from '@/types/domain'

const hoy     = format(new Date(), 'yyyy-MM-dd')
const manana  = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
const en7dias = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')

const schema = z.object({
  titulo:      z.string().min(1, 'El título es obligatorio'),
  vencimiento: z.string().min(1, 'Elegí una fecha'),
  prioridad:   z.enum(['Alta', 'Media', 'Baja']),
  empresa_id:  z.string().optional(),
})

type FormData = z.infer<typeof schema>

const inputClass = 'w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep'
const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }

export default function NuevaTareaForm({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

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
    enabled: !!user,
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { vencimiento: manana, prioridad: 'Media' },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('tareas').insert({
        owner_id:    user!.id,
        titulo:      data.titulo,
        vencimiento: data.vencimiento,
        prioridad:   data.prioridad,
        empresa_id:  data.empresa_id || null,
        completada:  false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
      reset({ vencimiento: manana, prioridad: 'Media' })
      onSaved?.()
    },
  })

  const fechaActual = watch('vencimiento')

  return (
    <form
      onSubmit={handleSubmit(d => mutation.mutate(d))}
      className="border rounded-sm p-4 mb-6 space-y-3"
      style={{ borderColor: '#14532D25', backgroundColor: '#14532D05' }}
    >
      <p className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: '#14532D' }}>
        Nueva tarea
      </p>

      {/* Título */}
      <div>
        <input
          {...register('titulo')}
          placeholder="¿Qué tenés que hacer?"
          autoComplete="off"
          className={inputClass}
          style={{ ...inputStyle, borderColor: errors.titulo ? '#ef4444' : 'var(--border)' }}
        />
        {errors.titulo && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.titulo.message}</p>}
      </div>

      {/* Segunda fila: empresa + prioridad + fecha */}
      <div className="flex gap-2 flex-wrap">
        <select
          {...register('empresa_id')}
          className="flex-1 min-w-[160px] px-2.5 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
          style={inputStyle}
        >
          <option value="">Sin empresa</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
        </select>

        <select
          {...register('prioridad')}
          className="w-28 px-2.5 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
          style={inputStyle}
        >
          {(['Alta', 'Media', 'Baja'] as Prioridad[]).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Fecha: shortcuts + input */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-2)' }}>Vence:</span>
        {[
          { label: 'Hoy',      val: hoy     },
          { label: 'Mañana',   val: manana  },
          { label: 'En 1 sem', val: en7dias },
        ].map(({ label, val }) => (
          <label
            key={val}
            className="px-2 py-1 text-xs border rounded-sm cursor-pointer select-none transition-colors"
            style={{
              borderColor: fechaActual === val ? '#14532D' : 'var(--border)',
              backgroundColor: fechaActual === val ? '#14532D10' : 'transparent',
              color: fechaActual === val ? '#14532D' : 'var(--text-2)',
            }}
          >
            <input type="radio" {...register('vencimiento')} value={val} className="sr-only" />
            {label}
          </label>
        ))}
        <input
          type="date"
          {...register('vencimiento')}
          min={hoy}
          className="font-mono px-2.5 py-1.5 text-xs border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
          style={inputStyle}
        />
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: '#ef4444' }}>Error al guardar. Intentá de nuevo.</p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-sm disabled:opacity-60 transition-colors"
        style={{ backgroundColor: '#14532D', color: 'white' }}
      >
        <Plus size={14} />
        {mutation.isPending ? 'Guardando…' : 'Agregar tarea'}
      </button>
    </form>
  )
}
