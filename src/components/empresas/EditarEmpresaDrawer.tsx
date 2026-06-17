import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Empresa, Sector, Canal, Prioridad } from '@/types/domain'

const SECTORES: Sector[] = [
  'Siderurgia', 'Metalurgia', 'Autopartes', 'Maquinaria agrícola',
  'Agroexportadora', 'Lácteos', 'Alimentos', 'Frigorífico',
  'Seguros', 'Prepaga', 'Salud', 'Banca', 'Cooperativa',
  'Retail', 'Mutual', 'Automotriz', 'Industria',
  'Servicio público', 'Entretenimiento', 'Otro',
]
const CANALES: Canal[] = ['Email', 'Formulario', 'Portal', 'WhatsApp', 'Teléfono']
const PRIORIDADES: Prioridad[] = ['Alta', 'Media', 'Baja']

const schema = z.object({
  razon_social:      z.string().min(1, 'Requerido'),
  nombre_fantasia:   z.string().optional(),
  cuit:              z.string().optional(),
  sector:            z.enum([
    'Siderurgia','Metalurgia','Autopartes','Maquinaria agrícola',
    'Agroexportadora','Lácteos','Alimentos','Frigorífico',
    'Seguros','Prepaga','Salud','Banca','Cooperativa',
    'Retail','Mutual','Automotriz','Industria',
    'Servicio público','Entretenimiento','Otro',
  ]),
  ciudad:            z.string().min(1, 'Requerido'),
  provincia:         z.string().min(1, 'Requerido'),
  distancia_km:      z.coerce.number().optional().nullable(),
  domicilio:         z.string().optional(),
  email_principal:   z.string().email('Email inválido').optional().or(z.literal('')),
  telefono_principal: z.string().optional(),
  sitio_web:         z.string().optional(),
  canal_preferido:   z.enum(['Email','Formulario','Portal','WhatsApp','Teléfono']),
  prioridad:         z.enum(['Alta','Media','Baja']),
  origen:            z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface Props {
  empresa: Empresa
  open: boolean
  onClose: () => void
}

const inputClass = 'w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep'
const inputStyle = (err?: boolean) => ({
  borderColor: err ? '#ef4444' : 'var(--border)',
  backgroundColor: 'var(--bg)',
  color: 'var(--text)',
})
const labelClass = 'block text-xs font-medium mb-1'

export default function EditarEmpresaDrawer({ empresa, open, onClose }: Props) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      razon_social:      empresa.razon_social,
      nombre_fantasia:   empresa.nombre_fantasia ?? '',
      cuit:              empresa.cuit ?? '',
      sector:            empresa.sector,
      ciudad:            empresa.ciudad,
      provincia:         empresa.provincia,
      distancia_km:      empresa.distancia_km ?? undefined,
      domicilio:         empresa.domicilio ?? '',
      email_principal:   empresa.email_principal ?? '',
      telefono_principal: empresa.telefono_principal ?? '',
      sitio_web:         empresa.sitio_web ?? '',
      canal_preferido:   empresa.canal_preferido,
      prioridad:         empresa.prioridad,
      origen:            empresa.origen ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('empresas').update({
        razon_social:      data.razon_social,
        nombre_fantasia:   data.nombre_fantasia || null,
        cuit:              data.cuit || null,
        sector:            data.sector,
        ciudad:            data.ciudad,
        provincia:         data.provincia,
        distancia_km:      data.distancia_km ?? null,
        domicilio:         data.domicilio || null,
        email_principal:   data.email_principal || null,
        telefono_principal: data.telefono_principal || null,
        sitio_web:         data.sitio_web || null,
        canal_preferido:   data.canal_preferido,
        prioridad:         data.prioridad,
        origen:            data.origen || null,
      }).eq('id', empresa.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa', empresa.id] })
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      onClose()
    },
  })

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog" aria-modal="true" aria-label="Editar empresa"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>
              Editar empresa
            </h2>
            <p className="text-sm mt-0.5 truncate max-w-[280px]" style={{ color: 'var(--text-2)' }}>
              {empresa.razon_social}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 px-5 py-5 space-y-5">

            {/* Contacto — primero porque es lo que más se actualiza */}
            <section>
              <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: '#A8893A' }}>
                Datos de contacto
              </p>
              <div className="space-y-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Email principal</label>
                  <input
                    type="email"
                    {...register('email_principal')}
                    placeholder="compras@empresa.com"
                    className={inputClass}
                    style={inputStyle(!!errors.email_principal)}
                  />
                  {errors.email_principal && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.email_principal.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Teléfono / celular</label>
                  <input
                    {...register('telefono_principal')}
                    placeholder="+54 341 000-0000"
                    className={`${inputClass} font-mono`}
                    style={inputStyle()}
                  />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Sitio web</label>
                  <input
                    {...register('sitio_web')}
                    placeholder="empresa.com.ar"
                    className={inputClass}
                    style={inputStyle()}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} style={{ color: 'var(--text)' }}>Canal preferido</label>
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
              </div>
            </section>

            {/* Razón social */}
            <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-2)' }}>
                Datos legales
              </p>
              <div className="space-y-3">
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Razón social *</label>
                  <input
                    {...register('razon_social')}
                    className={inputClass}
                    style={inputStyle(!!errors.razon_social)}
                  />
                  {errors.razon_social && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.razon_social.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Nombre fantasia</label>
                  <input {...register('nombre_fantasia')} className={inputClass} style={inputStyle()} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>CUIT</label>
                  <input
                    {...register('cuit')}
                    placeholder="20-00000000-0"
                    className={`${inputClass} font-mono`}
                    style={inputStyle()}
                  />
                </div>
              </div>
            </section>

            {/* Ubicación */}
            <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-2)' }}>
                Ubicación
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} style={{ color: 'var(--text)' }}>Ciudad *</label>
                    <input
                      {...register('ciudad')}
                      className={inputClass}
                      style={inputStyle(!!errors.ciudad)}
                    />
                    {errors.ciudad && <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.ciudad.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: 'var(--text)' }}>Provincia *</label>
                    <input
                      {...register('provincia')}
                      className={inputClass}
                      style={inputStyle(!!errors.provincia)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} style={{ color: 'var(--text)' }}>Distancia (km)</label>
                    <input
                      type="number"
                      {...register('distancia_km')}
                      placeholder="0"
                      className={`${inputClass} font-mono`}
                      style={inputStyle()}
                    />
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: 'var(--text)' }}>Sector</label>
                    <select {...register('sector')} className={inputClass} style={inputStyle()}>
                      {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass} style={{ color: 'var(--text)' }}>Domicilio</label>
                  <input {...register('domicilio')} className={inputClass} style={inputStyle()} />
                </div>
              </div>
            </section>

            {/* Origen */}
            <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <div>
                <label className={labelClass} style={{ color: 'var(--text)' }}>Origen del contacto</label>
                <input
                  {...register('origen')}
                  placeholder="Ej: Referido por cliente X, LinkedIn, feria…"
                  className={inputClass}
                  style={inputStyle()}
                />
              </div>
            </section>

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
                {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
