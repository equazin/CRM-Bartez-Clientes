import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Empresa, Etapa, Prioridad, Canal } from '@/types/domain'
import { etapaConfig, ETAPAS_ORDEN, canalEmoji, formatFechaDoble, esFechaVencida, prioridadConfig } from '@/lib/utils'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Plus, Upload, Filter, AlertTriangle } from 'lucide-react'
import EditarEmpresaDrawer from '@/components/empresas/EditarEmpresaDrawer'
import ImportarEmpresasDrawer from '@/components/empresas/ImportarEmpresasDrawer'
import { downloadCSV } from '@/lib/export'
import { findDuplicateGroups, isEmpresaSinSeguimiento } from '@/lib/crmInsights'

const SECTORES = [
  'Agroexportadora','Alimentos','Autopartes','Automotriz','Banca','Cooperativa',
  'Entretenimiento','Frigorífico','Industria','Lácteos','Maquinaria agrícola',
  'Metalurgia','Mutual','Otro','Prepaga','Retail','Salud','Seguros',
  'Servicio público','Siderurgia',
]
const PRIORIDADES: Prioridad[] = ['Alta', 'Media', 'Baja']
const CANALES: Canal[] = ['Email', 'Formulario', 'Portal', 'WhatsApp', 'Teléfono']

type SortKey = 'razon_social' | 'etapa' | 'sector' | 'ciudad' | 'prioridad' | 'proxima_accion_fecha'
type SortDir = 'asc' | 'desc'
type SavedFilter = {
  id: string
  name: string
  search: string
  etapa: Etapa | ''
  sector: string
  prioridad: Prioridad | ''
  canal: Canal | ''
}

const PRIORIDAD_ORDEN: Record<Prioridad, number> = { Alta: 0, Media: 1, Baja: 2 }
const ETAPA_ORDEN: Record<Etapa, number> = {
  'Prospecto': 0, 'Contactado': 1, 'Derivado a Compras': 2,
  'En alta de proveedor': 3, 'Proveedor habilitado': 4,
  'Cotización enviada': 5, 'Cliente': 6, 'Inactivo/Perdido': 7,
}

function safeText(value: unknown) {
  return String(value ?? '')
}

function safeLower(value: unknown) {
  return safeText(value).toLowerCase()
}

function getEtapaCfg(etapa: unknown) {
  return etapaConfig[etapa as Etapa] ?? etapaConfig.Prospecto
}

function getPrioridadCfg(prioridad: unknown) {
  return prioridadConfig[prioridad as Prioridad] ?? prioridadConfig.Media
}

function getCanalIcon(canal: unknown) {
  return canalEmoji[canal as Canal] ?? '·'
}

export default function Empresas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editarEmpresa, setEditarEmpresa] = useState<Empresa | null>(null)
  const [importarOpen, setImportarOpen] = useState(false)
  const [search, setSearch]           = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState<Etapa | ''>('')
  const [filtroSector, setFiltroSector] = useState('')
  const [filtroPrio, setFiltroPrio]   = useState<Prioridad | ''>('')
  const [filtroCanal, setFiltroCanal] = useState<Canal | ''>('')
  const [sortKey, setSortKey]         = useState<SortKey>('proxima_accion_fecha')
  const [sortDir, setSortDir]         = useState<SortDir>('asc')
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bartez:filtros-empresas') ?? '[]') as SavedFilter[]
    } catch {
      return []
    }
  })

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('owner_id', user!.id)
      if (error) throw error
      return data as Empresa[]
    },
    enabled: !!user,
  })

  const etapaMutation = useMutation({
    mutationFn: async ({ id, etapa, etapaAnterior }: { id: string; etapa: Etapa; etapaAnterior: Etapa }) => {
      await supabase.from('historial_etapas').insert({
        empresa_id: id, user_id: user!.id,
        etapa_desde: etapaAnterior, etapa_hasta: etapa,
      })
      const { error } = await supabase.from('empresas').update({ etapa }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, etapa }) => {
      await queryClient.cancelQueries({ queryKey: ['empresas', user?.id] })
      const prev = queryClient.getQueryData<Empresa[]>(['empresas', user?.id])
      queryClient.setQueryData<Empresa[]>(['empresas', user?.id], old =>
        old?.map(e => e.id === id ? { ...e, etapa } : e) ?? []
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['empresas', user?.id], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['empresas', user?.id] }),
  })

  const filtradas = useMemo(() => {
    let result = empresas.filter(e => {
      const q = safeLower(search)
      const matchSearch = !search ||
        safeLower(e.razon_social).includes(q) ||
        safeLower(e.nombre_fantasia).includes(q) ||
        safeLower(e.cuit).includes(q) ||
        safeLower(e.ciudad).includes(q) ||
        safeLower(e.sector).includes(q) ||
        safeLower(e.email_principal).includes(q) ||
        safeLower(e.sitio_web).includes(q)
      return (
        matchSearch &&
        (!filtroEtapa  || e.etapa === filtroEtapa) &&
        (!filtroSector || e.sector === filtroSector) &&
        (!filtroPrio   || e.prioridad === filtroPrio) &&
        (!filtroCanal  || e.canal_preferido === filtroCanal)
      )
    })

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'razon_social') cmp = safeText(a.razon_social).localeCompare(safeText(b.razon_social), 'es')
      else if (sortKey === 'etapa') cmp = (ETAPA_ORDEN[a.etapa] ?? 99) - (ETAPA_ORDEN[b.etapa] ?? 99)
      else if (sortKey === 'sector') cmp = safeText(a.sector).localeCompare(safeText(b.sector), 'es')
      else if (sortKey === 'ciudad') cmp = safeText(a.ciudad).localeCompare(safeText(b.ciudad), 'es')
      else if (sortKey === 'prioridad') cmp = (PRIORIDAD_ORDEN[a.prioridad] ?? 99) - (PRIORIDAD_ORDEN[b.prioridad] ?? 99)
      else if (sortKey === 'proxima_accion_fecha') {
        const da = a.proxima_accion_fecha ?? '9999-12-31'
        const db = b.proxima_accion_fecha ?? '9999-12-31'
        cmp = da.localeCompare(db)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [empresas, search, filtroEtapa, filtroSector, filtroPrio, filtroCanal, sortKey, sortDir])

  const duplicados = useMemo(() => findDuplicateGroups(empresas), [empresas])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function exportCSV() {
    const headers = ['Empresa','Etapa','Sector','Ciudad','km','Canal','Email','Próxima acción','Fecha']
    const rows = filtradas.map(e => [
      e.razon_social, e.etapa, e.sector, e.ciudad,
      e.distancia_km ?? '', e.canal_preferido,
      e.email_principal ?? '',
      e.proxima_accion ?? '',
      e.proxima_accion_fecha ?? '',
    ])
    downloadCSV(`bartez-empresas-${new Date().toISOString().slice(0,10)}.csv`, headers, rows)
    return
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `bartez-empresas-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function openNuevaEmpresa() {
    window.dispatchEvent(new CustomEvent('bartez:nueva-empresa'))
  }

  function aplicarFiltro(filtro: SavedFilter) {
    setSearch(filtro.search)
    setFiltroEtapa(filtro.etapa)
    setFiltroSector(filtro.sector)
    setFiltroPrio(filtro.prioridad)
    setFiltroCanal(filtro.canal)
  }

  function guardarVistaActual() {
    const name = window.prompt('Nombre de la vista')
    if (!name?.trim()) return
    const next = [
      ...savedFilters.filter(item => item.name.toLowerCase() !== name.trim().toLowerCase()),
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        search,
        etapa: filtroEtapa,
        sector: filtroSector,
        prioridad: filtroPrio,
        canal: filtroCanal,
      },
    ]
    setSavedFilters(next)
    localStorage.setItem('bartez:filtros-empresas', JSON.stringify(next))
  }

  function aplicarPreset(tipo: 'sin-contacto' | 'alta-trabada' | 'cotizacion' | 'clientes') {
    setSearch('')
    setFiltroSector('')
    setFiltroCanal('')
    setFiltroPrio('')
    if (tipo === 'sin-contacto') {
      setFiltroEtapa('Prospecto')
      setSortKey('proxima_accion_fecha')
    } else if (tipo === 'alta-trabada') {
      setFiltroEtapa('En alta de proveedor')
      setSortKey('proxima_accion_fecha')
    } else if (tipo === 'cotizacion') {
      setFiltroEtapa('Cotización enviada')
      setSortKey('proxima_accion_fecha')
    } else {
      setFiltroEtapa('Cliente')
      setSortKey('razon_social')
    }
    setSortDir('asc')
  }

  const hayFiltros = !!(search || filtroEtapa || filtroSector || filtroPrio || filtroCanal)

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--text)' }}>Empresas</h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-2)' }}>
            {isLoading ? '…' : `${filtradas.length} de ${empresas.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportarOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-sm transition-colors hover:bg-green-deep/5"
            style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            <Upload size={13} />
            Importar CSV
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-sm transition-colors hover:bg-green-deep/5"
            style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            <Download size={13} />
            Exportar CSV
          </button>
          <button
            onClick={openNuevaEmpresa}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors"
            style={{ backgroundColor: '#14532D', color: 'white' }}
          >
            <Plus size={13} />
            Nueva empresa
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-2)' }} />
          <input
            type="text"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep w-52"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text)' }}
          />
        </div>

        {([
          { value: filtroEtapa,  set: setFiltroEtapa,  opts: ETAPAS_ORDEN, label: 'Etapa' },
          { value: filtroSector, set: setFiltroSector, opts: SECTORES,     label: 'Sector' },
          { value: filtroPrio,   set: setFiltroPrio,   opts: PRIORIDADES,  label: 'Prioridad' },
          { value: filtroCanal,  set: setFiltroCanal,  opts: CANALES,      label: 'Canal' },
        ] as const).map(({ value, set, opts, label }) => (
          <select
            key={label}
            value={value}
            onChange={e => (set as (v: string) => void)(e.target.value)}
            className="px-2.5 py-1.5 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-green-deep"
            style={{
              borderColor: value ? '#14532D' : 'var(--border)',
              backgroundColor: 'var(--surface)',
              color: value ? '#14532D' : 'var(--text-2)',
            }}
          >
            <option value="">{label}</option>
            {(opts as readonly string[]).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}

        {hayFiltros && (
          <button
            onClick={() => { setSearch(''); setFiltroEtapa(''); setFiltroSector(''); setFiltroPrio(''); setFiltroCanal('') }}
            className="text-xs hover:underline"
            style={{ color: 'var(--text-2)' }}
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
            Vistas rapidas
          </span>
          {[
            { key: 'sin-contacto', label: `Prospectos sin contacto (${empresas.filter(isEmpresaSinSeguimiento).length})` },
            { key: 'alta-trabada', label: `Alta trabada (${empresas.filter(e => e.etapa === 'En alta de proveedor').length})` },
            { key: 'cotizacion', label: `Cotizaciones (${empresas.filter(e => e.etapa === 'Cotización enviada').length})` },
            { key: 'clientes', label: `Clientes (${empresas.filter(e => e.etapa === 'Cliente').length})` },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => aplicarPreset(item.key as 'sin-contacto' | 'alta-trabada' | 'cotizacion' | 'clientes')}
              className="px-2.5 py-1 text-xs border rounded-sm transition-colors hover:bg-green-deep/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={guardarVistaActual}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border rounded-sm transition-colors hover:bg-green-deep/5"
            style={{ borderColor: '#14532D40', color: '#14532D' }}
          >
            <Filter size={12} />
            Guardar vista
          </button>
        </div>
        {savedFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--text-2)' }}>Guardadas:</span>
            {savedFilters.map(filtro => (
              <button
                key={filtro.id}
                onClick={() => aplicarFiltro(filtro)}
                className="px-2 py-1 text-xs rounded-sm"
                style={{ backgroundColor: '#14532D10', color: '#14532D' }}
              >
                {filtro.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {duplicados.length > 0 && (
        <div className="mb-4 border rounded-sm px-4 py-3" style={{ borderColor: '#A8893A40', backgroundColor: '#A8893A0D' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: '#A8893A' }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {duplicados.length} posibles duplicados para revisar
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {duplicados.slice(0, 4).map(group => (
                  <button
                    key={group.key}
                    onClick={() => setSearch(safeText(group.empresas[0]?.razon_social || group.label))}
                    className="text-xs px-2 py-1 rounded-sm border"
                    style={{ borderColor: '#A8893A40', color: '#A8893A', backgroundColor: 'var(--surface)' }}
                    title={group.empresas.map(e => safeText(e.razon_social)).join(' / ')}
                  >
                    {group.reason}: {group.empresas.length} coincidencias
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <SortTh label="Empresa"       col="razon_social"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width="24%" />
                <SortTh label="Etapa"         col="etapa"               sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width="16%" />
                <SortTh label="Sector"        col="sector"              sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width="12%" />
                <SortTh label="Ciudad"        col="ciudad"              sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width="10%" />
                <th className="text-left px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)', width: '6%' }}>Canal</th>
                <SortTh label="Prioridad"     col="prioridad"           sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width="8%" />
                <SortTh label="Próxima acción" col="proxima_accion_fecha" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} width="24%" />
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(10)].map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 skeleton rounded-sm" /></td>
                  ))}
                </tr>
              ))}

              {!isLoading && filtradas.map((empresa, idx) => {
                const etapa = getEtapaCfg(empresa.etapa)
                const vencida = esFechaVencida(empresa.proxima_accion_fecha)
                const prio = getPrioridadCfg(empresa.prioridad)
                return (
                  <tr
                    key={empresa.id}
                    className="group transition-colors hover:bg-green-deep/5"
                    style={{
                      borderBottom: idx < filtradas.length - 1 ? '1px solid var(--border)' : undefined,
                      backgroundColor: idx % 2 === 1 ? 'var(--surface)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/empresas/${empresa.id}`)}
                  >
                    {/* Empresa */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: prio.color }} />
                        <span className="font-medium truncate" style={{ color: 'var(--text)' }}>
                          {safeText(empresa.razon_social) || 'Sin razon social'}
                        </span>
                      </div>
                    </td>

                    {/* Etapa — editable inline, evitar propagación al click de fila */}
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <select
                        value={ETAPAS_ORDEN.includes(empresa.etapa as Etapa) ? empresa.etapa : 'Prospecto'}
                        onChange={e => etapaMutation.mutate({
                          id: empresa.id,
                          etapa: e.target.value as Etapa,
                          etapaAnterior: (ETAPAS_ORDEN.includes(empresa.etapa as Etapa) ? empresa.etapa : 'Prospecto') as Etapa,
                        })}
                        className="text-xs px-1.5 py-0.5 rounded-sm border focus:outline-none focus:ring-1 focus:ring-green-deep"
                        style={{ backgroundColor: etapa.bg, color: etapa.color, borderColor: etapa.color + '40' }}
                      >
                        {ETAPAS_ORDEN.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </td>

                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-2)' }}>{safeText(empresa.sector) || '-'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-2)' }}>{safeText(empresa.ciudad) || '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-center" title={safeText(empresa.canal_preferido)}>
                      {getCanalIcon(empresa.canal_preferido)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: prio.color }} />
                        <span className="text-xs" style={{ color: 'var(--text-2)' }}>{safeText(empresa.prioridad) || 'Media'}</span>
                      </div>
                    </td>

                    {/* Próxima acción + botón editar */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {empresa.proxima_accion && (
                          <span className="text-xs truncate max-w-[140px]" style={{ color: vencida ? '#A8893A' : 'var(--text-2)' }}>
                            {empresa.proxima_accion}
                          </span>
                        )}
                        {empresa.proxima_accion_fecha && (
                          <span className="font-mono text-xs flex-shrink-0" style={{ color: vencida ? '#A8893A' : 'var(--text-2)' }}>
                            {formatFechaDoble(empresa.proxima_accion_fecha)}
                          </span>
                        )}
                        {!empresa.proxima_accion && !empresa.proxima_accion_fecha && (
                          <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setEditarEmpresa(empresa) }}
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm hover:bg-green-deep/10"
                          title="Editar empresa"
                          style={{ color: 'var(--text-2)' }}
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!isLoading && filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm" style={{ color: 'var(--text-2)' }}>
                    {hayFiltros
                      ? 'Ninguna empresa coincide con los filtros.'
                      : 'No hay empresas cargadas todavía.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer edición */}
      {editarEmpresa && (
        <EditarEmpresaDrawer
          empresa={editarEmpresa}
          open={!!editarEmpresa}
          onClose={() => setEditarEmpresa(null)}
        />
      )}
      <ImportarEmpresasDrawer
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
      />
    </div>
  )
}

// ── Encabezado de columna ordenable ──────────────────────
interface SortThProps {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  width?: string
}

function SortTh({ label, col, sortKey, sortDir, onSort, width }: SortThProps) {
  const active = sortKey === col
  return (
    <th
      className="text-left px-4 py-2.5 text-xs font-display font-semibold uppercase tracking-wider select-none cursor-pointer hover:text-green-deep transition-colors"
      style={{ color: active ? '#14532D' : 'var(--text-2)', width }}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />}
      </div>
    </th>
  )
}
