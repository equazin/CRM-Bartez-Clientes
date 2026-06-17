import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { AreaContacto } from '@/types/domain'

const AREAS: AreaContacto[] = ['Recepción', 'Compras', 'IT', 'Administración', 'Gerencia', 'Otro']

const schema = z.object({
  nombre:   z.string().min(1, 'El nombre es obligatorio'),
  cargo:    z.string().optional(),
  area:     z.enum(['Recepción','Compras','IT','Administración','Gerencia','Otro']),
  email:    z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  es_contacto_principal: z.boolean().default(false),
  notas:    z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface Props {
  empresaId: string
  onSaved: () => void
  onCancel: () => void
}

const inputClass = 'w-full px-2.5 py-1.5 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep'
const inputStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }

export default function NuevoContactoForm({ empresaId, onSaved, onCancel }: Props) {
  const { user } = useAuth()
  const toast = useToast()

  const { register, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { area: 'Compras', es_contacto_principal: false },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('contactos').insert({
        empresa_id: empresaId,
        user_id: user!.id,
        nombre: data.nombre,
        cargo: data.cargo || null,
        area: data.area,
        email: data.email || null,
        telefono: data.telefono || null,
        es_contacto_principal: data.es_contacto_principal,
        notas: data.notas || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Contacto agregado')
      onSaved()
    },
    onError: () => toast.error('No se pudo agregar el contacto'),
  })

  return (
    <form
      onSubmit={handleSubmit(d => mutation.mutate(d))}
      className="border rounded-sm p-3 mb-3 space-y-2.5"
      style={{ borderColor: '#14532D30', backgroundColor: '#14532D05' }}
    >
      <p className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: '#14532D' }}>
        Nuevo contacto
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            {...register('nombre')}
            placeholder="Nombre *"
            className={inputClass}
            style={{ ...inputStyle, borderColor: errors.nombre ? '#ef4444' : 'var(--border)' }}
          />
          {errors.nombre && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{errors.nombre.message}</p>}
        </div>
        <input {...register('cargo')} placeholder="Cargo" className={inputClass} style={inputStyle} />
      </div>

      <select {...register('area')} className={inputClass} style={inputStyle}>
        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            {...register('email')}
            type="email"
            placeholder="Email"
            className={inputClass}
            style={{ ...inputStyle, borderColor: errors.email ? '#ef4444' : 'var(--border)' }}
          />
          {errors.email && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{errors.email.message}</p>}
        </div>
        <input {...register('telefono')} placeholder="Teléfono" className={`${inputClass} font-mono`} style={inputStyle} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" {...register('es_contacto_principal')} className="rounded-sm" />
        <span className="text-xs" style={{ color: 'var(--text-2)' }}>Contacto principal</span>
      </label>

      {mutation.error && (
        <p className="text-xs" style={{ color: '#ef4444' }}>Error al guardar. Intentá de nuevo.</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 text-xs border rounded-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 py-1.5 text-xs font-medium rounded-sm"
          style={{ backgroundColor: '#14532D', color: 'white' }}
        >
          {mutation.isPending ? 'Guardando…' : 'Guardar contacto'}
        </button>
      </div>
    </form>
  )
}
