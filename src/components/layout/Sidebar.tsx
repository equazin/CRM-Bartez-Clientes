import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Kanban, CalendarCheck, TrendingUp, LogOut, Search, X, Plus, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import BrandMark from './BrandMark'

const navItems = [
  { to: '/',            label: 'Hoy',          icon: LayoutDashboard },
  { to: '/pipeline',    label: 'Pipeline',      icon: Kanban },
  { to: '/empresas',    label: 'Empresas',      icon: Building2 },
  { to: '/agenda',      label: 'Agenda',        icon: CalendarCheck },
  { to: '/oportunidades', label: 'Oportunidades', icon: TrendingUp },
  { to: '/reportes',    label: 'Reportes',      icon: BarChart3 },
]

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // Dispara el atajo del command palette
  function openSearch() {
    onCloseMobile()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
  }

  function openNuevaEmpresa() {
    onCloseMobile()
    window.dispatchEvent(new CustomEvent('bartez:nueva-empresa'))
  }

  const emailShort = user?.email?.split('@')[0] ?? 'Usuario'

  return (
    <>
      {/* Overlay móvil */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          'flex flex-col h-screen w-[220px] flex-shrink-0 border-r z-50',
          'md:relative md:translate-x-0 md:transition-none',
          'fixed top-0 left-0 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        style={{ backgroundColor: 'var(--nav-bg)', borderColor: '#1E3A25' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: '#1E3A25' }}>
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="font-display font-semibold text-md" style={{ color: '#E8E6DF' }}>
              Bartez CRM
            </span>
          </div>
          {/* Cerrar (solo móvil) */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 rounded-sm hover:bg-white/10 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={16} style={{ color: '#8A9E8A' }} />
          </button>
        </div>

        {/* Buscar */}
        <div className="px-2 pt-3">
          <button
            onClick={openNuevaEmpresa}
            className="flex items-center gap-2.5 w-full px-3 py-2 mb-1 rounded-sm text-sm font-medium transition-colors"
            style={{ backgroundColor: '#14532D', color: 'white' }}
          >
            <Plus size={15} strokeWidth={1.8} />
            <span className="flex-1 text-left">Nueva empresa</span>
          </button>
          <button
            onClick={openSearch}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-sm text-sm transition-colors hover:bg-white/5"
            style={{ color: 'var(--nav-text)' }}
          >
            <Search size={15} strokeWidth={1.8} />
            <span className="flex-1 text-left">Buscar</span>
            <kbd className="text-2xs font-mono px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: '#0B2818', color: '#6A8A6A' }}>
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navegación */}
        <div className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-0.5 px-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-medium transition-colors',
                      isActive ? 'text-white bg-green-deep' : 'hover:bg-white/5',
                    )
                  }
                  style={({ isActive }) => ({
                    color: isActive ? '#ffffff' : 'var(--nav-text)',
                  })}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t px-2 py-3" style={{ borderColor: '#1E3A25' }}>
          <div className="px-3 py-1.5 mb-1">
            <p className="text-xs truncate" style={{ color: '#6A8A6A' }}>
              {user?.email ?? ''}
            </p>
            <p className="text-sm font-medium capitalize" style={{ color: 'var(--nav-text)' }}>
              {emailShort}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-sm text-sm transition-colors hover:bg-white/5"
            style={{ color: '#6A8A6A' }}
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </nav>
    </>
  )
}
