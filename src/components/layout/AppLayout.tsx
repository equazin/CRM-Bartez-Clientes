import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import BrandMark from './BrandMark'
import CommandPalette from '@/components/CommandPalette'
import NuevaEmpresaDrawer from '@/components/empresas/NuevaEmpresaDrawer'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [nuevaEmpresaOpen, setNuevaEmpresaOpen] = useState(false)

  useEffect(() => {
    const openNuevaEmpresa = () => setNuevaEmpresaOpen(true)
    window.addEventListener('bartez:nueva-empresa', openNuevaEmpresa)
    return () => window.removeEventListener('bartez:nueva-empresa', openNuevaEmpresa)
  }, [])

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <main
        className="flex-1 overflow-y-auto min-w-0"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        {/* Barra superior móvil */}
        <div
          className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--nav-bg)', borderColor: '#1E3A25' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1 rounded-sm hover:bg-white/10 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} style={{ color: '#E8E6DF' }} />
          </button>
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <span className="font-display font-semibold text-sm" style={{ color: '#E8E6DF' }}>Bartez CRM</span>
          </div>
        </div>

        <Outlet />
      </main>

      <CommandPalette />
      <NuevaEmpresaDrawer open={nuevaEmpresaOpen} onClose={() => setNuevaEmpresaOpen(false)} />
    </div>
  )
}
