import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Oportunidad } from '@/types/domain'
import { formatMoneda, formatFecha } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'
import NuevaOportunidadDrawer from '@/components/oportunidades/NuevaOportunidadDrawer'
import ActualizarOportunidadDrawer from '@/components/oportunidades/ActualizarOportunidadDrawer'

export default function Oportunidades() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editarOp, setEditarOp] = useState<Oportunidad | null>(null)

  const { data: oportunidades = [], isLoading } = useQuery({
    queryKey: ['oportunidades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oportunidades')
        .select('*, empresa:empresas(id, razon_social)')
        .eq('owner_id', user!.id)
        .order('creado_en', { ascending: false })
      if (error) throw error
      return data as Oportunidad[]
    },
    enabled: !!user,
  })

  const abiertas = oportunidades.filter(o => o.estado !== 'Ganada' && o.estado !== 'Perdida')

  const totalPonderadoARS = abiertas
    .filter(o => o.moneda === 'ARS' && o.monto_estimado !== null && o.probabilidad !== null)
    .reduce((acc, o) => acc + (o.monto_estimado! * (o.probabilidad! / 100)), 0)

  const totalPonderadoUSD = abiertas
    .filter(o => o.moneda === 'USD' && o.monto_estimado !== null && o.probabilidad !== null)
    .reduce((acc, o) => acc + (o.monto_estimado! * (o.probabilidad! / 100)), 0)

  const estadoColors: Record<string, string> = {
    'Abierta':         '#6B8CAE',
    'Cotizada':        '#B5895A',
    'En negociación':  '#5A8A62',
    'Ganada':          '#14532D',
    'Perdida':         '#4A4A4A',
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--text)' }}>Oportunidades</h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-2)' }}>
            {oportunidades.length} oportunidades
          </p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm"
          style={{ backgroundColor: '#14532D', color: 'white' }}
        >
          <Plus size={14} />
          Nueva oportunidad
        </button>
      </div>

      {/* Totales ponderados */}
      {abiertas.length > 0 && (
        <div className="flex gap-4 mb-6">
          {totalPonderadoARS > 0 && (
            <div className="px-4 py-3 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-2)' }}>Pipeline ponderado ARS</p>
              <p className="font-mono font-semibold text-lg" style={{ color: '#14532D' }}>
                {formatMoneda(totalPonderadoARS, 'ARS')}
              </p>
            </div>
          )}
          {totalPonderadoUSD > 0 && (
            <div className="px-4 py-3 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-2)' }}>Pipeline ponderado USD</p>
              <p className="font-mono font-semibold text-lg" style={{ color: '#14532D' }}>
                {formatMoneda(totalPonderadoUSD, 'USD')}
              </p>
            </div>
          )}
          <div className="px-4 py-3 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-2)' }}>Abiertas</p>
            <p className="font-mono font-semibold text-lg" style={{ color: 'var(--text)' }}>{abiertas.length}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm border-collapse min-w-[860px]">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Título</th>
              <th className="text-left px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Empresa</th>
              <th className="text-left px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Estado</th>
              <th className="text-right px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Monto</th>
              <th className="text-right px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Prob.</th>
              <th className="text-left px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Cierre est.</th>
              <th className="text-right px-4 py-2.5 font-display font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(5)].map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                {[...Array(7)].map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 skeleton rounded-sm" /></td>
                ))}
              </tr>
            ))}
            {!isLoading && oportunidades.map((op, idx) => (
              <tr
                key={op.id}
                onClick={() => op.empresa && navigate(`/empresas/${op.empresa.id}`)}
                className="cursor-pointer transition-colors hover:bg-green-deep/5"
                style={{
                  borderBottom: idx < oportunidades.length - 1 ? '1px solid var(--border)' : undefined,
                  backgroundColor: idx % 2 === 1 ? 'var(--surface)' : 'transparent',
                }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{op.titulo}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{op.empresa?.razon_social ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-sm"
                    style={{
                      backgroundColor: (estadoColors[op.estado] ?? '#94A3B8') + '1A',
                      color: estadoColors[op.estado] ?? '#94A3B8',
                    }}
                  >
                    {op.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--text)' }}>
                  {op.monto_estimado !== null ? formatMoneda(op.monto_estimado, op.moneda as 'ARS' | 'USD') : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: 'var(--text-2)' }}>
                  {op.probabilidad !== null ? `${op.probabilidad}%` : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-2)' }}>
                  {formatFecha(op.fecha_cierre_estimada)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={e => { e.stopPropagation(); setEditarOp(op) }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-colors hover:bg-green-deep/10"
                    style={{ color: '#14532D' }}
                  >
                    <Pencil size={12} />
                    Actualizar
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && oportunidades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-2)' }}>
                  Sin oportunidades registradas. Creá una desde la ficha de una empresa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <NuevaOportunidadDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <ActualizarOportunidadDrawer
        oportunidad={editarOp}
        open={!!editarOp}
        onClose={() => setEditarOp(null)}
      />
    </div>
  )
}
