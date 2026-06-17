import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Empresa, Contacto, TipoInteraccion, Canal } from '@/types/domain'
import { cn } from '@/lib/utils'

const schema = z.object({
  tipo: z.enum(['Email enviado','Email recibido','Llamada','WhatsApp','Formulario','Reunión','Cotización','Nota']),
  canal: z.enum(['Email','Formulario','Portal','WhatsApp','Teléfono']).optional(),
  contacto_id: z.string().optional(),
  resultado: z.string().min(1, 'Describí brevemente qué pasó'),
  descripcion: z.string().optional(),
  proxima_accion: z.string().min(1, 'La próxima acción es obligatoria — sin ella la cuenta se enfría'),
  proxima_accion_fecha: z.string().min(1, 'Agendá la fecha de la próxima acción'),
})

type FormData = z.infer<typeof schema>

interface Props {
  empresa: Empresa
  contactos?: Contacto[]
  open: boolean
  onClose: () => void
}

const TIPOS: TipoInteraccion[] = ['Email enviado','Email recibido','Llamada','WhatsApp','Formulario','Reunión','Cotización','Nota']
const CANALES: Canal[] = ['Email','Formulario','Portal','WhatsApp','Teléfono']
const PLANTILLAS: {
  label: string
  tipo: TipoInteraccion
  canal: Canal
  resultado: string
  proxima_accion: string
  fecha: 'manana' | 'en3dias' | 'en7dias'
}[] = [
  {
    label: 'Seguimiento email',
    tipo: 'Email enviado',
    canal: 'Email',
    resultado: 'Se envió seguimiento para confirmar recepción y pedir derivación a Compras/IT.',
    proxima_accion: 'Llamar para confirmar si derivaron el mensaje',
    fecha: 'en3dias',
  },
  {
    label: 'Pedido a Compras',
    tipo: 'Email enviado',
    canal: 'Email',
    resultado: 'Se pidió contacto o confirmación del área de Compras para avanzar con alta/propuesta.',
    proxima_accion: 'Enviar presentación formal y datos de proveedor',
    fecha: 'manana',
  },
  {
    label: 'Llamada sin respuesta',
    tipo: 'Llamada',
    canal: 'Teléfono',
    resultado: 'No atendieron o no se pudo hablar con el área indicada.',
    proxima_accion: 'Reintentar llamado y pedir contacto alternativo',
    fecha: 'manana',
  },
  {
    label: 'Portal proveedor',
    tipo: 'Formulario',
    canal: 'Portal',
    resultado: 'Se revisó el portal/formulario de proveedores y queda pendiente completar o validar requisitos.',
    proxima_accion: 'Completar portal de proveedores y guardar comprobante',
    fecha: 'en3dias',
  },
  {
    label: 'Reactivación',
    tipo: 'WhatsApp',
    canal: 'WhatsApp',
    resultado: 'Se reactivó el contacto para validar si siguen necesitando equipamiento o proveedor.',
    proxima_accion: 'Enviar propuesta breve si responden con interés',
    fecha: 'en7dias',
  },
]

const inputClass = 'w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep'
const inputStyle = (err?: boolean) => ({
  borderColor: err ? '#ef4444' : 'var(--border)',
  backgroundColor: 'var(--bg)',
  color: 'var(--text)',
})

export default function RegistrarInteraccionDrawer({ empresa, contactos = [], open, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [alertaSinProximo, setAlertaSinProximo] = useState(false)

  const hoy     = format(new Date(), 'yyyy-MM-dd')
  const manana  = format(new Date(Date.now() + 86400000),     'yyyy-MM-dd')
  const en3dias = format(new Date(Date.now() + 3 * 86400000), 'yyyy-MM-dd')
  const en7dias = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd')

  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'Email enviado',
      canal: empresa.canal_preferido,
      proxima_accion_fecha: manana,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error: errInt } = await supabase.from('interacciones').insert({
        empresa_id:     empresa.id,
        user_id:        user!.id,
        contacto_id:    data.contacto_id || null,
        tipo:           data.tipo,
        canal:          data.canal ?? null,
        fecha:          new Date().toISOString(),
        resultado:      data.resultado,
        descripcion:    data.descripcion ?? null,
        etapa_snapshot: empresa.etapa,
      })
      if (errInt) throw errInt

      const { error: errEmp } = await supabase.from('empresas').update({
        proxima_accion:      data.proxima_accion,
        proxima_accion_fecha: data.proxima_accion_fecha,
      }).eq('id', empresa.id)
      if (errEmp) throw errEmp
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hoy'] })
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['empresa', empresa.id] })
      queryClient.invalidateQueries({ queryKey: ['interacciones', empresa.id] })
      queryClient.invalidateQueries({ queryKey: ['interacciones-recientes'] })
      reset()
      setAlertaSinProximo(false)
      onClose()
      toast.success('Interacción registrada · próxima acción agendada')
    },
    onError: () => toast.error('No se pudo registrar la interacción'),
  })

  function handleClose() {
    const proximo = watch('proxima_accion')
    if (!proximo && !alertaSinProximo) {
      setAlertaSinProximo(true)
      return
    }
    reset()
    setAlertaSinProximo(false)
    onClose()
  }

  function aplicarPlantilla(plantilla: (typeof PLANTILLAS)[number]) {
    const fechas = { manana, en3dias, en7dias }
    setValue('tipo', plantilla.tipo, { shouldValidate: true })
    setValue('canal', plantilla.canal, { shouldValidate: true })
    setValue('resultado', plantilla.resultado, { shouldValidate: true })
    setValue('proxima_accion', plantilla.proxima_accion, { shouldValidate: true })
    setValue('proxima_accion_fecha', fechas[plantilla.fecha], { shouldValidate: true })
  }

  if (!open) return null

  const canalActual = watch('canal')
  const fechaActual = watch('proxima_accion_fecha')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={handleClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog" aria-modal="true" aria-label="Registrar interacción"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>
              Registrar interacción
            </h2>
            <p className="text-sm mt-0.5 truncate max-w-[280px]" style={{ color: 'var(--text-2)' }}>
              {empresa.razon_social}
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 px-5 py-5 space-y-4">

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                Tipo de interacción
              </label>
              <select {...register('tipo')} className={inputClass} style={inputStyle()}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Canal */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                Canal
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {CANALES.map(c => {
                  const sel = canalActual === c
                  return (
                    <label
                      key={c}
                      className="px-2.5 py-1 text-xs border rounded-sm cursor-pointer transition-colors select-none"
                      style={{
                        borderColor: sel ? '#14532D' : 'var(--border)',
                        backgroundColor: sel ? '#14532D10' : 'transparent',
                        color: sel ? '#14532D' : 'var(--text-2)',
                      }}
                    >
                      <input type="radio" {...register('canal')} value={c} className="sr-only" />
                      {c}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Contacto (si hay) */}
            {contactos.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  Contacto <span style={{ color: 'var(--text-2)' }}>(opcional)</span>
                </label>
                <select {...register('contacto_id')} className={inputClass} style={inputStyle()}>
                  <option value="">Sin contacto específico</option>
                  {contactos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}{c.cargo ? ` · ${c.cargo}` : ''} — {c.area}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Plantillas */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                Plantillas rápidas
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {PLANTILLAS.map(plantilla => (
                  <button
                    key={plantilla.label}
                    type="button"
                    onClick={() => aplicarPlantilla(plantilla)}
                    className="px-2.5 py-1 text-xs border rounded-sm transition-colors hover:bg-green-deep/5"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                  >
                    {plantilla.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resultado */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                ¿Qué pasó?
              </label>
              <textarea
                {...register('resultado')}
                rows={3}
                placeholder="Ej: Respondieron que me derivan a Compras, pedí el contacto…"
                className={inputClass}
                style={{ ...inputStyle(!!errors.resultado), resize: 'none' }}
              />
              {errors.resultado && (
                <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.resultado.message}</p>
              )}
            </div>

            {/* Próximo paso */}
            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-display font-semibold uppercase tracking-wider mb-3" style={{ color: '#A8893A' }}>
                Próximo paso — obligatorio
              </p>

              <div className="mb-3">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  ¿Qué hacés después?
                </label>
                <input
                  type="text"
                  {...register('proxima_accion')}
                  placeholder="Ej: Llamar a Roberto de Compras para confirmar el alta"
                  className={inputClass}
                  style={inputStyle(!!errors.proxima_accion)}
                />
                {errors.proxima_accion && (
                  <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.proxima_accion.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
                  ¿Cuándo?
                </label>
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {[
                    { label: 'Mañana',    val: manana  },
                    { label: 'En 3 días', val: en3dias },
                    { label: 'En 1 sem',  val: en7dias },
                  ].map(({ label, val }) => (
                    <label
                      key={val}
                      className="px-2.5 py-1 text-xs border rounded-sm cursor-pointer select-none transition-colors"
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
                </div>
                <input
                  type="date"
                  {...register('proxima_accion_fecha')}
                  min={hoy}
                  className={cn(inputClass, 'font-mono')}
                  style={inputStyle(!!errors.proxima_accion_fecha)}
                />
                {errors.proxima_accion_fecha && (
                  <p className="mt-1 text-xs" style={{ color: '#ef4444' }}>{errors.proxima_accion_fecha.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            {alertaSinProximo && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-sm text-xs" style={{ backgroundColor: '#A8893A15', color: '#A8893A' }}>
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <p>Cerrás sin agendar la próxima acción — la cuenta quedará sin seguimiento. ¿Salís igual?</p>
              </div>
            )}

            {mutation.error && (
              <p className="text-xs" style={{ color: '#ef4444' }}>Error al guardar. Intentá de nuevo.</p>
            )}

            {alertaSinProximo ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { reset(); setAlertaSinProximo(false); onClose() }}
                  className="flex-1 py-2 text-sm border rounded-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                >
                  Salir igual
                </button>
                <button
                  type="button"
                  onClick={() => setAlertaSinProximo(false)}
                  className="flex-1 py-2 text-sm font-medium rounded-sm"
                  style={{ backgroundColor: '#14532D', color: 'white' }}
                >
                  Completar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
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
                  {mutation.isPending ? 'Guardando…' : 'Guardar y agendar'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </>
  )
}
