import { useState } from 'react'
import { XCircle } from 'lucide-react'

const MOTIVOS_FRECUENTES = [
  'Sin presupuesto',
  'Eligió otro proveedor',
  'No responde hace tiempo',
  'No es el momento',
  'Fuera de zona / logística',
  'Precio no competitivo',
]

interface Props {
  open: boolean
  empresaNombre: string
  pending?: boolean
  onConfirm: (motivo: string) => void
  onCancel: () => void
}

export default function MotivoPerdidaModal({ open, empresaNombre, pending, onConfirm, onCancel }: Props) {
  const [motivo, setMotivo] = useState('')

  if (!open) return null

  function confirmar() {
    onConfirm(motivo.trim())
    setMotivo('')
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onCancel} aria-hidden="true" />
      <div
        className="fixed z-[61] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 rounded-sm shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        role="dialog" aria-modal="true"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#4A4A4A20' }}>
            <XCircle size={16} style={{ color: '#6B6B6A' }} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base" style={{ color: 'var(--text)' }}>
              Marcar como perdida
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
              <strong style={{ color: 'var(--text)' }}>{empresaNombre}</strong> pasa a Inactivo/Perdido. ¿Por qué? Te sirve para aprender del pipeline.
            </p>
          </div>
        </div>

        {/* Motivos frecuentes */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {MOTIVOS_FRECUENTES.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivo(m)}
              className="px-2.5 py-1 text-xs border rounded-sm transition-colors"
              style={{
                borderColor: motivo === m ? '#A8893A' : 'var(--border)',
                backgroundColor: motivo === m ? '#A8893A15' : 'transparent',
                color: motivo === m ? '#A8893A' : 'var(--text-2)',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <textarea
          autoFocus
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={3}
          placeholder="Detalle del motivo (opcional pero recomendado)…"
          className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep resize-none"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
        />

        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border rounded-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium rounded-sm disabled:opacity-60"
            style={{ backgroundColor: '#4A4A4A', color: 'white' }}
          >
            {pending ? 'Guardando…' : 'Marcar como perdida'}
          </button>
        </div>
      </div>
    </>
  )
}
