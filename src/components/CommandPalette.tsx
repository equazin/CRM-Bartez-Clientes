import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Kanban, Building2, CalendarCheck, TrendingUp, Search, Plus, BarChart3,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Empresa } from '@/types/domain'
import { etapaConfig } from '@/lib/utils'

const PAGINAS = [
  { to: '/',             label: 'Hoy',           icon: LayoutDashboard },
  { to: '/pipeline',     label: 'Pipeline',      icon: Kanban },
  { to: '/empresas',     label: 'Empresas',      icon: Building2 },
  { to: '/agenda',       label: 'Agenda',        icon: CalendarCheck },
  { to: '/oportunidades', label: 'Oportunidades', icon: TrendingUp },
  { to: '/reportes',     label: 'Reportes',      icon: BarChart3 },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  // Ctrl/Cmd + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas').select('id, razon_social, ciudad, etapa').eq('owner_id', user!.id)
      if (error) throw error
      return data as Pick<Empresa, 'id' | 'razon_social' | 'ciudad' | 'etapa'>[]
    },
    enabled: !!user && open,
  })

  function go(to: string) {
    setOpen(false)
    navigate(to)
  }

  function nuevaEmpresa() {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('bartez:nueva-empresa'))
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="fixed left-1/2 top-[15vh] -translate-x-1/2 z-[91] w-full max-w-lg px-4">
        <Command
          className="rounded-md border shadow-2xl overflow-hidden fade-in"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          loop
        >
          <div className="flex items-center gap-2 px-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <Search size={15} style={{ color: 'var(--text-2)' }} />
            <Command.Input
              autoFocus
              placeholder="Buscar empresa o ir a una sección…"
              className="flex-1 py-3 text-sm bg-transparent focus:outline-none"
              style={{ color: 'var(--text)' }}
            />
            <kbd className="text-2xs font-mono px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-2)' }}>
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[55vh] overflow-y-auto p-1.5">
            <Command.Empty className="py-6 text-center text-sm" style={{ color: 'var(--text-2)' }}>
              Sin resultados.
            </Command.Empty>

            <Command.Group heading="Acciones">
              <Command.Item
                value="crear nueva empresa prospecto alta rapida"
                onSelect={nuevaEmpresa}
                className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer text-sm aria-selected:bg-green-deep/10"
                style={{ color: 'var(--text)' }}
              >
                <Plus size={15} style={{ color: '#14532D' }} />
                Nueva empresa
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Ir a">
              {PAGINAS.map(({ to, label, icon: Icon }) => (
                <Command.Item
                  key={to}
                  value={`ir ${label}`}
                  onSelect={() => go(to)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer text-sm aria-selected:bg-green-deep/10"
                  style={{ color: 'var(--text)' }}
                >
                  <Icon size={15} style={{ color: 'var(--text-2)' }} />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>

            {empresas.length > 0 && (
              <Command.Group heading="Empresas">
                {empresas.map(e => {
                  const cfg = etapaConfig[e.etapa]
                  return (
                    <Command.Item
                      key={e.id}
                      value={`${e.razon_social} ${e.ciudad}`}
                      onSelect={() => go(`/empresas/${e.id}`)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-sm cursor-pointer text-sm aria-selected:bg-green-deep/10"
                      style={{ color: 'var(--text)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="flex-1 truncate">{e.razon_social}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-2)' }}>{e.ciudad}</span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </>
  )
}
