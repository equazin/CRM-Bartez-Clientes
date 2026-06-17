import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNowStrict, isToday, isPast, isFuture, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Etapa, Canal, Prioridad } from '@/types/domain'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Fechas ──────────────────────────────────────────────
export function formatFecha(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    return format(d, 'dd/MM/yyyy', { locale: es })
  } catch {
    return '—'
  }
}

export function formatFechaRelativa(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    if (isToday(d)) return 'hoy'
    const rel = formatDistanceToNowStrict(d, { locale: es, addSuffix: true })
    return rel
  } catch {
    return '—'
  }
}

export function formatFechaDoble(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = parseISO(dateStr)
    const abs = format(d, 'dd/MM', { locale: es })
    if (isToday(d)) return `hoy · ${abs}`
    const rel = formatDistanceToNowStrict(d, { locale: es, addSuffix: true })
    return `${rel} · ${abs}`
  } catch {
    return '—'
  }
}

export function esFechaVencida(dateStr: string | null): boolean {
  if (!dateStr) return false
  try {
    const d = parseISO(dateStr)
    return isPast(d) && !isToday(d)
  } catch {
    return false
  }
}

export function esFechaHoy(dateStr: string | null): boolean {
  if (!dateStr) return false
  try {
    return isToday(parseISO(dateStr))
  } catch {
    return false
  }
}

export function esFechaFutura(dateStr: string | null): boolean {
  if (!dateStr) return false
  try {
    return isFuture(parseISO(dateStr))
  } catch {
    return false
  }
}

// ── Moneda ──────────────────────────────────────────────
export function formatMoneda(monto: number | null, moneda: 'ARS' | 'USD' = 'ARS'): string {
  if (monto === null) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto)
}

// ── CUIT ────────────────────────────────────────────────
export function formatCuit(cuit: string | null): string {
  if (!cuit) return '—'
  const digits = cuit.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
  }
  return cuit
}

// ── Etapa colors ────────────────────────────────────────
export const etapaConfig: Record<Etapa, { color: string; bg: string; label: string }> = {
  'Prospecto':            { color: '#94A3B8', bg: '#94A3B81A', label: 'Prospecto' },
  'Contactado':           { color: '#6B8CAE', bg: '#6B8CAE1A', label: 'Contactado' },
  'Derivado a Compras':   { color: '#5B7FA6', bg: '#5B7FA61A', label: 'Derivado a Compras' },
  'En alta de proveedor': { color: '#B5895A', bg: '#B5895A1A', label: 'En alta de proveedor' },
  'Proveedor habilitado': { color: '#5A8A62', bg: '#5A8A621A', label: 'Proveedor habilitado' },
  'Cotización enviada':   { color: '#2D7A4F', bg: '#2D7A4F1A', label: 'Cotización enviada' },
  'Cliente':              { color: '#14532D', bg: '#14532D1A', label: 'Cliente' },
  'Inactivo/Perdido':     { color: '#4A4A4A', bg: '#4A4A4A1A', label: 'Inactivo/Perdido' },
}

export const ETAPAS_ORDEN: Etapa[] = [
  'Prospecto',
  'Contactado',
  'Derivado a Compras',
  'En alta de proveedor',
  'Proveedor habilitado',
  'Cotización enviada',
  'Cliente',
  'Inactivo/Perdido',
]

// ── Canal icons ─────────────────────────────────────────
export const canalLabel: Record<Canal, string> = {
  Email:     '📧 Email',
  Formulario:'📝 Formulario',
  Portal:    '🌐 Portal',
  WhatsApp:  '💬 WhatsApp',
  Teléfono:  '📞 Teléfono',
}

export const canalEmoji: Record<Canal, string> = {
  Email:     '📧',
  Formulario:'📝',
  Portal:    '🌐',
  WhatsApp:  '💬',
  Teléfono:  '📞',
}

// ── Prioridad ────────────────────────────────────────────
export const prioridadConfig: Record<Prioridad, { color: string; dot: string }> = {
  Alta:  { color: '#A8893A', dot: 'bg-brass' },
  Media: { color: '#6B8CAE', dot: 'bg-blue-400' },
  Baja:  { color: '#94A3B8', dot: 'bg-slate-400' },
}
