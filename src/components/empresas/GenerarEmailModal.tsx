import { useState } from 'react'
import { X, Copy, Mail, Check, RefreshCw } from 'lucide-react'
import type { Empresa, Contacto, Interaccion } from '@/types/domain'

type TipoEmail = 'prospeccion' | 'seguimiento' | 'cotizacion' | 'alta' | 'reactivacion'

const TIPOS: { key: TipoEmail; label: string; desc: string }[] = [
  { key: 'prospeccion',  label: 'Prospección',       desc: 'Primer contacto' },
  { key: 'seguimiento',  label: 'Seguimiento',        desc: 'Continuación de conversación' },
  { key: 'cotizacion',   label: 'Cotización',         desc: 'Envío o seguimiento de precio' },
  { key: 'alta',         label: 'Alta de proveedor',  desc: 'Proceso de documentación' },
  { key: 'reactivacion', label: 'Reactivación',       desc: 'Retomar contacto inactivo' },
]

// Salutación según contacto principal
function saludo(contactos: Contacto[], empresa: Empresa): string {
  const principal = contactos.find(c => c.es_contacto_principal) ?? contactos[0]
  if (principal?.nombre) {
    const nombre = principal.nombre.split(' ')[0]
    return `Hola ${nombre}`
  }
  return `Estimado equipo de ${empresa.nombre_fantasia ?? empresa.razon_social}`
}

// Referencia al sector para personalizar el cuerpo
function contextSector(sector: string): string {
  const map: Record<string, string> = {
    'Siderurgia': 'la industria siderúrgica',
    'Metalurgia': 'el sector metalúrgico',
    'Autopartes': 'la industria de autopartes',
    'Maquinaria agrícola': 'el rubro de maquinaria agrícola',
    'Agroexportadora': 'el sector agroexportador',
    'Lácteos': 'la industria láctea',
    'Alimentos': 'la industria alimenticia',
    'Frigorífico': 'el sector frigorífico',
    'Seguros': 'el sector asegurador',
    'Prepaga': 'el sector de salud prepaga',
    'Salud': 'el sector salud',
    'Banca': 'el sector bancario',
    'Cooperativa': 'el movimiento cooperativo',
    'Retail': 'el sector retail',
    'Mutual': 'el sector mutual',
    'Automotriz': 'la industria automotriz',
    'Industria': 'el sector industrial',
    'Servicio público': 'los servicios públicos',
    'Entretenimiento': 'el sector de entretenimiento',
  }
  return map[sector] ?? 'su sector'
}

// Referencia a la ubicación
function contextUbicacion(empresa: Empresa): string {
  if (empresa.distancia_km && empresa.distancia_km < 100) {
    return `en ${empresa.ciudad}`
  }
  return `en ${empresa.ciudad}, ${empresa.provincia}`
}

// Última interacción relevante
function ultimaInteraccion(interacciones: Interaccion[]): string | null {
  if (interacciones.length === 0) return null
  const last = interacciones[0]
  if (last.asunto) return last.asunto
  if (last.tipo === 'Llamada') return 'nuestra llamada'
  if (last.tipo === 'Reunión') return 'nuestra reunión'
  if (last.tipo === 'Email') return 'nuestro intercambio de correos'
  if (last.tipo === 'WhatsApp') return 'nuestra conversación por WhatsApp'
  return 'nuestro último contacto'
}

function generarEmail(
  tipo: TipoEmail,
  empresa: Empresa,
  contactos: Contacto[],
  interacciones: Interaccion[],
): { asunto: string; cuerpo: string } {
  const s = saludo(contactos, empresa)
  const nombre = empresa.nombre_fantasia ?? empresa.razon_social
  const sector = contextSector(empresa.sector)
  const ubic = contextUbicacion(empresa)
  const ultimaRef = ultimaInteraccion(interacciones)
  const proximaAccion = empresa.proxima_accion

  switch (tipo) {
    case 'prospeccion': {
      const asunto = `Equipamiento IT para ${nombre} – Bartez Tecnología`
      const cuerpo = `${s},

Mi nombre es [Tu nombre] y me comunico desde Bartez Tecnología, distribuidora mayorista de equipamiento informático con base en Rosario.

Llegamos a ustedes porque trabajamos con varias empresas de ${sector} ${ubic} y vemos una oportunidad real de acompañarlos con soluciones de infraestructura IT: servidores, storage, networking, endpoints y más — con stock disponible y tiempos de entrega competitivos.

¿Tienen proyectos de renovación o ampliación de equipamiento previstos para este año? Me gustaría entender sus necesidades para armarles una propuesta adecuada.

Quedo a disposición para coordinar una llamada breve o una visita si lo prefieren.

Saludos,
Nicolás Benítez
Bartez Tecnología
+54 9 341 510-4902`
      return { asunto, cuerpo }
    }

    case 'seguimiento': {
      const ref = ultimaRef ? `luego de ${ultimaRef}` : 'luego de nuestro último contacto'
      const asunto = `Seguimiento – ${nombre}`
      const cuerpo = `${s},

Quería escribirles ${ref} para ver cómo evolucionó la situación desde nuestra última charla.

${proximaAccion ? `Quedamos en: ${proximaAccion}. ¿Pudieron avanzar en ese punto?` : '¿Tuvieron oportunidad de evaluar lo que estuvimos conversando?'}

Estamos disponibles para responder cualquier consulta o ampliar información sobre los equipos que les presentamos. Si necesitan una actualización de precios o disponibilidad, con gusto se la acercamos.

Quedamos atentos a su respuesta.

Saludos,
Nicolás Benítez
Bartez Tecnología
+54 9 341 510-4902`
      return { asunto, cuerpo }
    }

    case 'cotizacion': {
      const asunto = `Cotización de equipamiento IT – ${nombre}`
      const cuerpo = `${s},

Adjunto a este correo la cotización que les preparamos según los requerimientos que nos indicaron.

El detalle incluye:
– Especificaciones técnicas de cada equipo
– Precios unitarios y totales (con IVA discriminado)
– Plazo de entrega estimado
– Condiciones de pago

Les pedimos que revisen el documento y nos hagan saber si desean ajustar algún ítem, modificar cantidades o consultar por alguna alternativa dentro de su presupuesto.

Dado el contexto de precios actual, la cotización tiene validez de [X días]. Si necesitan más tiempo para evaluar, avisennos y actualizamos.

Cualquier duda estamos disponibles.

Saludos,
Nicolás Benítez
Bartez Tecnología
+54 9 341 510-4902`
      return { asunto, cuerpo }
    }

    case 'alta': {
      const asunto = `Alta como proveedor – Documentación pendiente – ${nombre}`
      const cuerpo = `${s},

Nos comunicamos para coordinar la documentación necesaria para completar el alta de Bartez Tecnología como proveedor en su sistema.

Para poder operar, generalmente las empresas nos solicitan:
– Constancia de inscripción en AFIP
– Constancia de IIBB (Rosario / Santa Fe)
– Datos bancarios para pago de facturas
– Formulario de alta de proveedor (si aplica)
– Contrato de provisión firmado (si corresponde)

¿Nos pueden indicar cuál es el proceso interno de ustedes y qué documentos necesitan de nuestra parte? Así lo coordinamos rápido y empezamos a operar.

Quedamos a disposición.

Saludos,
Nicolás Benítez
Bartez Tecnología
+54 9 341 510-4902`
      return { asunto, cuerpo }
    }

    case 'reactivacion': {
      const asunto = `Retomando contacto – Novedades de Bartez Tecnología`
      const cuerpo = `${s},

Hace un tiempo que no nos comunicamos y quería retomar el contacto para ver cómo están y si surgió alguna necesidad de equipamiento IT en ${nombre}.

Desde nuestra última charla incorporamos nuevos productos y mejoramos los tiempos de entrega. También tenemos buenas condiciones de financiación vigentes que pueden ser de interés para ${sector}.

¿Tienen algo en carpeta para los próximos meses? Con gusto les actualizamos precios y disponibilidad.

Saludos,
Nicolás Benítez
Bartez Tecnología
+54 9 341 510-4902`
      return { asunto, cuerpo }
    }
  }
}

interface Props {
  open: boolean
  empresa: Empresa
  contactos: Contacto[]
  interacciones: Interaccion[]
  onClose: () => void
}

export default function GenerarEmailModal({ open, empresa, contactos, interacciones, onClose }: Props) {
  const [tipo, setTipo] = useState<TipoEmail>('prospeccion')
  const [copiado, setCopiado] = useState<'asunto' | 'todo' | null>(null)

  if (!open) return null

  const { asunto, cuerpo } = generarEmail(tipo, empresa, contactos, interacciones)
  const emailCompleto = `Asunto: ${asunto}\n\n${cuerpo}`

  function copiar(cual: 'asunto' | 'todo') {
    const texto = cual === 'asunto' ? asunto : emailCompleto
    navigator.clipboard.writeText(texto)
    setCopiado(cual)
    setTimeout(() => setCopiado(null), 2000)
  }

  const emailDest = contactos.find(c => c.es_contacto_principal && c.email)?.email
    ?? contactos.find(c => c.email)?.email
    ?? empresa.email_principal
    ?? ''

  function abrirEnMail() {
    const params = new URLSearchParams()
    if (emailDest) params.set('to', emailDest)
    params.set('subject', asunto)
    params.set('body', cuerpo)
    window.open(`mailto:${emailDest}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-lg z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog" aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>
              Generar email
            </h2>
            <p className="text-sm truncate max-w-[320px]" style={{ color: 'var(--text-2)' }}>
              {empresa.razon_social}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/10 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        {/* Tipo selector */}
        <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Tipo de email</p>
          <div className="grid grid-cols-5 gap-1">
            {TIPOS.map(t => (
              <button
                key={t.key}
                onClick={() => setTipo(t.key)}
                className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-sm text-center transition-colors border"
                style={{
                  borderColor: tipo === t.key ? '#14532D' : 'var(--border)',
                  backgroundColor: tipo === t.key ? '#14532D15' : 'transparent',
                  color: tipo === t.key ? '#14532D' : 'var(--text-2)',
                }}
                title={t.desc}
              >
                <span className="text-xs font-medium leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Asunto */}
        <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Asunto</p>
            <button
              onClick={() => copiar('asunto')}
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: copiado === 'asunto' ? '#14532D' : 'var(--text-2)' }}
            >
              {copiado === 'asunto' ? <Check size={11} /> : <Copy size={11} />}
              {copiado === 'asunto' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p
            className="text-sm px-3 py-2 rounded-sm border select-all"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            {asunto}
          </p>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Cuerpo</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTipo(t => t)} // fuerza re-render para "regenerar" variante
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: 'var(--text-2)' }}
                title="Cambiar tipo para obtener otra variante"
              >
                <RefreshCw size={11} />
                Cambiar tipo
              </button>
            </div>
          </div>
          <pre
            className="text-sm whitespace-pre-wrap leading-relaxed select-all font-sans"
            style={{ color: 'var(--text)' }}
          >
            {cuerpo}
          </pre>
        </div>

        {/* Footer acciones */}
        <div className="px-5 py-4 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => copiar('todo')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-sm transition-colors"
            style={{
              borderColor: copiado === 'todo' ? '#14532D' : 'var(--border)',
              color: copiado === 'todo' ? '#14532D' : 'var(--text-2)',
              backgroundColor: copiado === 'todo' ? '#14532D10' : 'transparent',
            }}
          >
            {copiado === 'todo' ? <Check size={13} /> : <Copy size={13} />}
            {copiado === 'todo' ? '¡Copiado!' : 'Copiar todo'}
          </button>

          <button
            onClick={abrirEnMail}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-sm font-medium ml-auto"
            style={{ backgroundColor: '#14532D', color: 'white' }}
          >
            <Mail size={13} />
            Abrir en cliente de mail
          </button>
        </div>
      </div>
    </>
  )
}
