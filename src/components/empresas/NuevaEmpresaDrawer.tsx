import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Canal, Prioridad, Sector } from '@/types/domain'

const SECTORES = [
  'Siderurgia', 'Metalurgia', 'Autopartes', 'Maquinaria agrícola',
  'Agroexportadora', 'Lácteos', 'Alimentos', 'Frigorífico',
  'Seguros', 'Prepaga', 'Salud', 'Banca', 'Cooperativa',
  'Retail', 'Mutual', 'Automotriz', 'Industria',
  'Servicio público', 'Entretenimiento', 'Otro',
] as const

const CANALES: Canal[] = ['Email', 'Formulario', 'Portal', 'WhatsApp', 'Teléfono']
const PRIORIDADES: Prioridad[] = ['Alta', 'Media', 'Baja']

const hoy = format(new Date(), 'yyyy-MM-dd')
const manana = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
const en3dias = format(new Date(Date.now() + 3 * 86400000), 'yyyy-MM-dd')
const en7dias = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')

const schema = z.object({
  razon_social: z.string().min(1, 'La razón social es obligatoria'),
  nombre_fantasia: z.string().optional(),
  sector: z.enum(SECTORES),
  ciudad: z.string().min(1, 'La ciudad es obligatoria'),
  provincia: z.string().min(1, 'La provincia es obligatoria'),
  email_principal: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono_principal: z.string().optional(),
  sitio_web: z.string().optional(),
  canal_preferido: z.enum(['Email', 'Formulario', 'Portal', 'WhatsApp', 'Teléfono']),
  prioridad: z.enum(['Alta', 'Media', 'Baja']),
  origen: z.string().optional(),
  proxima_accion: z.string().optional(),
  proxima_accion_fecha: z.string().optional(),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
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

export default function NuevaEmpresaDrawer({ open, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sector: 'Industria',
      ciudad: 'Rosario',
      provincia: 'Santa Fe',
      canal_preferido: 'Email',
      prioridad: 'Media',
      proxima_accion_fecha: manana,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: created, error } = await supabase
        .from('empresas')
        .insert({
          owner_id: user!.id,
          razon_social: data.razon_social,
          nombre_fantasia: data.nombre_fantasia || null,
          sector: data.sector as Sector,
          ciudad: data.ciudad,
          provincia: data.provincia,
          email_principal: data.email_principal || null,
          telefono_principal: data.telefono_principal || null,
          sitio_web: data.sitio_web || null,
          canal_preferido: data.canal_preferido,
          prioridad: data.prioridad,
          etapa: 'Prospecto',
          origen: data.origen || null,
          proxima_accion: data.proxima_accion || null,
          proxima_accion_fecha: data.proxima_accion_fecha || null,
          notas: data.notas || null,
        })
        .select('id')
        .single()
      if (error) throw error
      return created as { id: string }
    },
    onSuccess: created => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['empresas-select'] })
      reset()
      onClose()
      toast.success('Empresa creada')
      navigate(`/empresas/${created.id}`)
    },
    onError: () => toast.error('No se pudo crear la empresa'),
  })

  if (!open) return null

  const fechaActual = watch('proxima_accion_fecha')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Nueva empresa"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>
              Nueva empresa
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
              Alta rápida de prospecto
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 px-5 py-5 space-y-5">
            <section className="space-y-3">
              <p className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: '#14532D' }}>
                Datos mínimos
              </p>
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Razón social *</label>
                <input {...register('razon_social')} autoFocus className={inputClass} style={inputStyle(!!errors.razon_social)} />
                {errors.razon_social && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.razon_social.message}</p>}
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Nombre fantasía</label>
                <input {...register('nombre_fantasia')} className={inputClass} style={inputStyle()} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Ciudad *</label>
                  <input {...register('ciudad')} className={inputClass} style={inputStyle(!!errors.ciudad)} />
                  {errors.ciudad && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.ciudad.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Provincia *</label>
                  <input {...register('provincia')} className={inputClass} style={inputStyle(!!errors.provincia)} />
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Sector</label>
                <select {...register('sector')} className={inputClass} style={inputStyle()}>
                  {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </section>

            <section className="border-t pt-5 space-y-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                Contacto y prioridad
              </p>
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Email principal</label>
                <input type="email" {...register('email_principal')} placeholder="compras@empresa.com" className={inputClass} style={inputStyle(!!errors.email_principal)} />
                {errors.email_principal && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.email_principal.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Teléfono</label>
                  <input {...register('telefono_principal')} className={`${inputClass} font-mono`} style={inputStyle()} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Sitio web</label>
                  <input {...register('sitio_web')} placeholder="empresa.com.ar" className={inputClass} style={inputStyle()} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Canal</label>
                  <select {...register('canal_preferido')} className={inputClass} style={inputStyle()}>
                    {CANALES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Prioridad</label>
                  <select {...register('prioridad')} className={inputClass} style={inputStyle()}>
                    {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Origen</label>
                <input {...register('origen')} placeholder="Referido, LinkedIn, feria, web..." className={inputClass} style={inputStyle()} />
              </div>
            </section>

            <section className="border-t pt-5 space-y-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: '#A8893A' }}>
                Próximo paso
              </p>
              <input
                {...register('proxima_accion')}
                placeholder="Ej: Enviar presentación y pedir contacto de Compras"
                className={inputClass}
                style={inputStyle()}
              />
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: 'Mañana', val: manana },
                  { label: 'En 3 días', val: en3dias },
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
                    <input type="radio" {...register('proxima_accion_fecha')} value={val} className="sr-only" />
                    {label}
                  </label>
                ))}
                <input type="date" {...register('proxima_accion_fecha')} min={hoy} className="font-mono px-2.5 py-1.5 text-xs border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep" style={inputStyle()} />
              </div>
              <textarea
                {...register('notas')}
                rows={3}
                placeholder="Notas iniciales, contexto, productos posibles..."
                className={inputClass}
                style={{ ...inputStyle(), resize: 'none' }}
              />
            </section>
          </div>

          <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {mutation.error && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>Error al guardar. Intentá de nuevo.</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border rounded-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                Cancelar
              </button>
              <button type="submit" disabled={mutation.isPending} className="flex-1 py-2 text-sm font-medium rounded-sm disabled:opacity-60" style={{ backgroundColor: '#14532D', color: 'white' }}>
                {mutation.isPending ? 'Creando...' : 'Crear y abrir'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
