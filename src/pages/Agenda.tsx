import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tarea } from '@/types/domain'
import { formatFecha, esFechaVencida, esFechaHoy } from '@/lib/utils'
import { Check, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import NuevaTareaForm from '@/components/tareas/NuevaTareaForm'

export default function Agenda() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tareas')
        .select('*, empresa:empresas(id, razon_social, etapa)')
        .eq('owner_id', user!.id)  // tareas usa owner_id
        .eq('completada', false)
        .order('vencimiento', { ascending: true })
      if (error) throw error
      return data as Tarea[]
    },
    enabled: !!user,
  })

  const completarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tareas').update({
        completada: true,
        completada_en: new Date().toISOString(),   // columna agregada en migración
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
    },
  })

  const vencidas = tareas.filter(t => esFechaVencida(t.vencimiento))
  const deHoy    = tareas.filter(t => esFechaHoy(t.vencimiento))
  const proximas = tareas.filter(t => !esFechaVencida(t.vencimiento) && !esFechaHoy(t.vencimiento))

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--text)' }}>Agenda</h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-2)' }}>
            {tareas.length} tareas pendientes
          </p>
        </div>
        <button
          onClick={() => setFormOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors"
          style={{ backgroundColor: formOpen ? 'var(--border)' : '#14532D', color: formOpen ? 'var(--text-2)' : 'white' }}
        >
          <Plus size={14} />
          Nueva tarea
        </button>
      </div>

      {formOpen && (
        <NuevaTareaForm onSaved={() => setFormOpen(false)} />
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 skeleton rounded-sm" />)}
        </div>
      )}

      {!isLoading && tareas.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-2)' }}>
          <p className="text-lg font-display font-semibold" style={{ color: 'var(--text)' }}>Sin tareas pendientes</p>
          <p className="text-sm mt-1">Las tareas se crean al registrar interacciones.</p>
        </div>
      )}

      <TareaGrupo
        titulo="Vencidas"
        tareas={vencidas}
        urgente
        onCompletar={id => completarMutation.mutate(id)}
        onEmpresaClick={id => navigate(`/empresas/${id}`)}
      />
      <TareaGrupo
        titulo="Hoy"
        tareas={deHoy}
        urgente={false}
        onCompletar={id => completarMutation.mutate(id)}
        onEmpresaClick={id => navigate(`/empresas/${id}`)}
      />
      <TareaGrupo
        titulo="Próximas"
        tareas={proximas}
        urgente={false}
        onCompletar={id => completarMutation.mutate(id)}
        onEmpresaClick={id => navigate(`/empresas/${id}`)}
      />
    </div>
  )
}

interface GrupoProps {
  titulo: string
  tareas: Tarea[]
  urgente: boolean
  onCompletar: (id: string) => void
  onEmpresaClick: (id: string) => void
}

function TareaGrupo({ titulo, tareas, urgente, onCompletar, onEmpresaClick }: GrupoProps) {
  if (tareas.length === 0) return null
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs font-display font-semibold uppercase tracking-wider"
          style={{ color: urgente ? '#A8893A' : 'var(--text-2)' }}
        >
          {titulo}
        </span>
        <span
          className="font-mono text-xs px-1.5 py-0.5 rounded-sm"
          style={{
            backgroundColor: urgente ? '#A8893A1A' : 'var(--border)',
            color: urgente ? '#A8893A' : 'var(--text-2)',
          }}
        >
          {tareas.length}
        </span>
      </div>
      <div className="border rounded-sm overflow-hidden" style={{ borderColor: urgente ? '#A8893A30' : 'var(--border)' }}>
        {tareas.map((tarea, idx) => (
          <div
            key={tarea.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom: idx < tareas.length - 1 ? '1px solid var(--border)' : undefined,
              backgroundColor: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
            }}
          >
            <button
              onClick={() => onCompletar(tarea.id)}
              className="w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors hover:border-green-deep hover:bg-green-deep/10"
              style={{ borderColor: urgente ? '#A8893A' : 'var(--border)' }}
              title="Marcar como completada"
            >
              <Check size={11} style={{ color: 'transparent' }} className="group-hover:text-green-deep" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: 'var(--text)' }}>{tarea.titulo}</p>
              {tarea.empresa && (
                <button
                  onClick={() => tarea.empresa && onEmpresaClick(tarea.empresa.id)}
                  className="text-xs hover:underline"
                  style={{ color: '#14532D' }}
                >
                  {tarea.empresa.razon_social}
                </button>
              )}
            </div>
            <span
              className="font-mono text-xs flex-shrink-0"
              style={{ color: urgente ? '#A8893A' : 'var(--text-2)' }}
            >
              {formatFecha(tarea.vencimiento)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
