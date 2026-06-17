import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { differenceInDays, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Empresa, Etapa } from '@/types/domain'
import { etapaConfig, ETAPAS_ORDEN, canalEmoji, formatFechaDoble, esFechaVencida, prioridadConfig } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import MotivoPerdidaModal from '@/components/empresas/MotivoPerdidaModal'

// ── Columnas visibles (excluye las terminales del ancho principal) ──────────
const ETAPAS_ACTIVAS: Etapa[] = [
  'Prospecto', 'Contactado', 'Derivado a Compras',
  'En alta de proveedor', 'Proveedor habilitado', 'Cotización enviada',
]
export default function Pipeline() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [filtroEtapas, setFiltroEtapas] = useState<'todas' | 'activas'>('activas')
  const [activeEmpresa, setActiveEmpresa] = useState<Empresa | null>(null)
  const [perdidaPendiente, setPerdidaPendiente] = useState<{ id: string; nombre: string; etapaAnterior: Etapa } | null>(null)

  const etapasVisibles = filtroEtapas === 'activas' ? ETAPAS_ACTIVAS : ETAPAS_ORDEN

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas').select('*').eq('owner_id', user!.id)
        .order('proxima_accion_fecha', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as Empresa[]
    },
    enabled: !!user,
  })

  const etapaMutation = useMutation({
    mutationFn: async ({ id, nuevaEtapa, etapaAnterior, motivo }: { id: string; nuevaEtapa: Etapa; etapaAnterior: Etapa; motivo?: string }) => {
      await supabase.from('historial_etapas').insert({
        empresa_id: id, user_id: user!.id,
        etapa_desde: etapaAnterior, etapa_hasta: nuevaEtapa,
        notas: motivo || null,
      })
      const update: { etapa: Etapa; motivo_perdida?: string | null } = { etapa: nuevaEtapa }
      if (nuevaEtapa === 'Inactivo/Perdido') update.motivo_perdida = motivo || null
      const { error } = await supabase.from('empresas').update(update).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, nuevaEtapa }) => {
      await queryClient.cancelQueries({ queryKey: ['empresas', user?.id] })
      const prev = queryClient.getQueryData<Empresa[]>(['empresas', user?.id])
      queryClient.setQueryData<Empresa[]>(['empresas', user?.id], old =>
        old?.map(e => e.id === id ? { ...e, etapa: nuevaEtapa } : e) ?? []
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['empresas', user?.id], ctx.prev)
      toast.error('No se pudo mover la empresa')
    },
    onSuccess: (_d, { nuevaEtapa }) => {
      setPerdidaPendiente(null)
      toast.success(`Movida a "${nuevaEtapa}"`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['hoy', user?.id] })
    },
  })

  const porEtapa = ETAPAS_ORDEN.reduce<Record<Etapa, Empresa[]>>((acc, etapa) => {
    acc[etapa] = empresas.filter(e => e.etapa === etapa)
    return acc
  }, {} as Record<Etapa, Empresa[]>)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const emp = empresas.find(e => e.id === event.active.id)
    setActiveEmpresa(emp ?? null)
  }, [empresas])

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // preview handled via optimistic update in dragEnd
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveEmpresa(null)
    const { active, over } = event
    if (!over) return
    const empresa = empresas.find(e => e.id === active.id)
    if (!empresa) return

    // "over" puede ser una tarjeta (empresa.id) o una columna (etapa string)
    const targetEtapa = ETAPAS_ORDEN.includes(over.id as Etapa)
      ? (over.id as Etapa)
      : (empresas.find(e => e.id === over.id)?.etapa ?? null)

    if (!targetEtapa || targetEtapa === empresa.etapa) return

    // Si va a perdido, pedir motivo antes de confirmar
    if (targetEtapa === 'Inactivo/Perdido') {
      setPerdidaPendiente({ id: empresa.id, nombre: empresa.razon_social, etapaAnterior: empresa.etapa })
      return
    }

    etapaMutation.mutate({
      id: empresa.id,
      nuevaEtapa: targetEtapa,
      etapaAnterior: empresa.etapa,
    })
  }, [empresas, etapaMutation])

  const totalActivas = ETAPAS_ACTIVAS.reduce((n, e) => n + (porEtapa[e]?.length ?? 0), 0)
  const totalClientes = porEtapa['Cliente']?.length ?? 0
  const totalPerdidos = porEtapa['Inactivo/Perdido']?.length ?? 0

  return (
    <div className="px-6 py-6 h-full flex flex-col" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--text)' }}>Pipeline</h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-2)' }}>
            {empresas.length} empresas · {totalActivas} activas · {totalClientes} clientes · {totalPerdidos} perdidas
          </p>
        </div>

        {/* Filtro terminales */}
        <div className="flex items-center gap-1 border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {(['activas', 'todas'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFiltroEtapas(v)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: filtroEtapas === v ? '#14532D' : 'var(--surface)',
                color: filtroEtapas === v ? 'white' : 'var(--text-2)',
              }}
            >
              {v === 'activas' ? 'Solo activas' : 'Todas las etapas'}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto" style={{ minHeight: 0 }}>
          <div className="flex gap-3 h-full pb-4" style={{ minWidth: `${etapasVisibles.length * 224}px` }}>
            {etapasVisibles.map(etapa => (
              <KanbanColumna
                key={etapa}
                etapa={etapa}
                empresas={porEtapa[etapa] ?? []}
                isLoading={isLoading}
                isDragging={!!activeEmpresa}
                onCardClick={id => navigate(`/empresas/${id}`)}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeEmpresa && (
            <PipelineCard empresa={activeEmpresa} onClick={() => {}} isDragging />
          )}
        </DragOverlay>
      </DndContext>

      {/* Modal motivo de pérdida */}
      <MotivoPerdidaModal
        open={!!perdidaPendiente}
        empresaNombre={perdidaPendiente?.nombre ?? ''}
        pending={etapaMutation.isPending}
        onConfirm={motivo => {
          if (!perdidaPendiente) return
          etapaMutation.mutate({
            id: perdidaPendiente.id,
            nuevaEtapa: 'Inactivo/Perdido',
            etapaAnterior: perdidaPendiente.etapaAnterior,
            motivo,
          })
        }}
        onCancel={() => setPerdidaPendiente(null)}
      />
    </div>
  )
}

// ── Columna ───────────────────────────────────────────────────────────────────

interface ColumnaProps {
  etapa: Etapa
  empresas: Empresa[]
  isLoading: boolean
  isDragging: boolean
  onCardClick: (id: string) => void
}

function KanbanColumna({ etapa, empresas, isLoading, isDragging, onCardClick }: ColumnaProps) {
  const config = etapaConfig[etapa]
  const { setNodeRef, isOver } = useDroppable({ id: etapa })

  return (
    <div className="w-52 flex-shrink-0 flex flex-col" style={{ minWidth: 208 }}>
      {/* Header columna */}
      <div
        className="px-3 py-2 rounded-t-sm border border-b-0 flex items-center justify-between"
        style={{ backgroundColor: config.bg, borderColor: config.color + '35' }}
      >
        <span className="text-xs font-display font-semibold leading-tight" style={{ color: config.color }}>
          {etapa}
        </span>
        <span
          className="font-mono text-xs px-1.5 py-0.5 rounded-sm flex-shrink-0"
          style={{ backgroundColor: config.color + '20', color: config.color }}
        >
          {empresas.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 border rounded-b-sm p-1.5 space-y-1.5 overflow-y-auto transition-colors"
        style={{
          borderColor: isOver ? config.color : config.color + '35',
          backgroundColor: isOver ? config.color + '08' : 'var(--bg)',
          minHeight: 400,
          outline: isOver ? `1px solid ${config.color}50` : undefined,
        }}
      >
        {isLoading && etapa === 'Prospecto' && (
          <div className="space-y-1.5">
            {[1, 2, 3].map(i => <div key={i} className="h-20 skeleton rounded-sm" />)}
          </div>
        )}

        {empresas.map(empresa => (
          <DraggableCard
            key={empresa.id}
            empresa={empresa}
            onClick={() => onCardClick(empresa.id)}
          />
        ))}

        {empresas.length === 0 && !isLoading && (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: isDragging ? config.color + '60' : 'var(--border)', minHeight: 80 }}
          >
            {isDragging ? 'Soltar aquí' : '—'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tarjeta draggable ─────────────────────────────────────────────────────────

function DraggableCard({ empresa, onClick }: { empresa: Empresa; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: empresa.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <PipelineCard empresa={empresa} onClick={onClick} isDragging={false} />
    </div>
  )
}

// ── Tarjeta visual ────────────────────────────────────────────────────────────

interface CardProps {
  empresa: Empresa
  onClick: () => void
  isDragging: boolean
}

function PipelineCard({ empresa, onClick, isDragging }: CardProps) {
  const vencida = esFechaVencida(empresa.proxima_accion_fecha)
  const prio = prioridadConfig[empresa.prioridad]

  const diasEnEtapa = empresa.updated_at
    ? differenceInDays(new Date(), parseISO(empresa.updated_at))
    : null

  return (
    <div
      onClick={isDragging ? undefined : onClick}
      className="px-3 py-2.5 border rounded-sm transition-all cursor-grab active:cursor-grabbing select-none"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--surface)',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
        transform: isDragging ? 'rotate(1.5deg)' : undefined,
      }}
    >
      {/* Nombre + indicador prioridad */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: prio.color }}
          title={`Prioridad ${empresa.prioridad}`}
        />
        <p className="text-xs font-medium leading-tight" style={{ color: 'var(--text)' }}>
          {empresa.razon_social}
        </p>
      </div>

      {/* Ciudad + canal */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs" title={empresa.canal_preferido}>{canalEmoji[empresa.canal_preferido]}</span>
        <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{empresa.ciudad}</span>
        {diasEnEtapa !== null && diasEnEtapa > 0 && (
          <span
            className="ml-auto font-mono text-xs flex-shrink-0"
            style={{ color: diasEnEtapa > 14 ? '#ef4444' : 'var(--text-2)' }}
            title={`${diasEnEtapa} días en esta etapa`}
          >
            {diasEnEtapa}d
          </span>
        )}
      </div>

      {/* Próxima acción */}
      {empresa.proxima_accion && (
        <p
          className="text-xs truncate"
          style={{ color: vencida ? '#A8893A' : 'var(--text-2)' }}
        >
          {empresa.proxima_accion}
        </p>
      )}
      {empresa.proxima_accion_fecha && (
        <p className="font-mono text-xs mt-0.5" style={{ color: vencida ? '#A8893A' : 'var(--text-2)' }}>
          {formatFechaDoble(empresa.proxima_accion_fecha)}
        </p>
      )}
    </div>
  )
}
