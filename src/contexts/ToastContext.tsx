import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastTipo = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tipo: ToastTipo
  mensaje: string
}

interface ToastAPI {
  success: (mensaje: string) => void
  error: (mensaje: string) => void
  info: (mensaje: string) => void
}

const ToastContext = createContext<ToastAPI | null>(null)

const DURACION_MS = 4000

const config: Record<ToastTipo, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle, color: '#5A8A62' },
  error:   { icon: AlertCircle, color: '#ef4444' },
  info:    { icon: Info,        color: '#6B8CAE' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((tipo: ToastTipo, mensaje: string) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, tipo, mensaje }])
    setTimeout(() => remove(id), DURACION_MS)
  }, [remove])

  const api: ToastAPI = {
    success: useCallback((m: string) => push('success', m), [push]),
    error:   useCallback((m: string) => push('error', m), [push]),
    info:    useCallback((m: string) => push('info', m), [push]),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Contenedor */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm">
        {toasts.map(toast => {
          const { icon: Icon, color } = config[toast.tipo]
          return (
            <div
              key={toast.id}
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-sm shadow-lg fade-in border"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: color + '40',
                borderLeftWidth: 3,
                borderLeftColor: color,
              }}
              role="status"
            >
              <Icon size={16} style={{ color }} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>{toast.mensaje}</p>
              <button
                onClick={() => remove(toast.id)}
                className="flex-shrink-0 p-0.5 rounded-sm hover:bg-black/5 transition-colors"
                aria-label="Cerrar"
              >
                <X size={13} style={{ color: 'var(--text-2)' }} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
