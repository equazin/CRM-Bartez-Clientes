import { differenceInDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import type { ElementType } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart3, CalendarClock, CircleDollarSign, Download, PhoneCall, Printer, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Canal, Empresa, Oportunidad } from '@/types/domain'
import { canalEmoji, etapaConfig, ETAPAS_ORDEN, esFechaVencida, formatMoneda } from '@/lib/utils'
import { downloadCSV, printCurrentReport } from '@/lib/export'
import { findDuplicateGroups } from '@/lib/crmInsights'

type InteraccionReporte = {
  id: string
  canal: Canal | null
  tipo: string
  fecha: string
  empresa_id: string
}

type ForecastRow = {
  key: string
  label: string
  count: number
  brutoARS: number
  brutoUSD: number
  ponderadoARS: number
  ponderadoUSD: number
}

const terminales = new Set(['Cliente', 'Inactivo/Perdido'])

function getDiasEnEtapa(empresa: Empresa): number {
  if (!empresa.updated_at) return 0
  return Math.max(0, differenceInDays(new Date(), parseISO(empresa.updated_at)))
}

function getForecastLabel(key: string): string {
  if (key === 'sin-fecha') return 'Sin fecha'
  try {
    return format(parseISO(`${key}-01`), 'MMM yyyy', { locale: es })
  } catch {
    return key
  }
}

function groupForecast(oportunidades: Oportunidad[]): ForecastRow[] {
  const rows = new Map<string, ForecastRow>()

  oportunidades
    .filter(op => op.estado !== 'Ganada' && op.estado !== 'Perdida')
    .forEach(op => {
      const key = op.fecha_cierre_estimada ? op.fecha_cierre_estimada.slice(0, 7) : 'sin-fecha'
      const current = rows.get(key) ?? {
        key,
        label: getForecastLabel(key),
        count: 0,
        brutoARS: 0,
        brutoUSD: 0,
        ponderadoARS: 0,
        ponderadoUSD: 0,
      }
      const monto = op.monto_estimado ?? 0
      const ponderado = monto * ((op.probabilidad ?? 0) / 100)
      current.count += 1
      if (op.moneda === 'USD') {
        current.brutoUSD += monto
        current.ponderadoUSD += ponderado
      } else {
        current.brutoARS += monto
        current.ponderadoARS += ponderado
      }
      rows.set(key, current)
    })

  return [...rows.values()].sort((a, b) => {
    if (a.key === 'sin-fecha') return 1
    if (b.key === 'sin-fecha') return -1
    return a.key.localeCompare(b.key)
  })
}

export default function Reportes() {
  const { user } = useAuth()

  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ['reportes-empresas', user?.id],
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

  const { data: oportunidades = [], isLoading: loadingOportunidades } = useQuery({
    queryKey: ['reportes-oportunidades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oportunidades')
        .select('*, empresa:empresas(id, razon_social)')
        .eq('owner_id', user!.id)
      if (error) throw error
      return data as Oportunidad[]
    },
    enabled: !!user,
  })

  const { data: interacciones = [], isLoading: loadingInteracciones } = useQuery({
    queryKey: ['reportes-interacciones', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interacciones')
        .select('id, canal, tipo, fecha, empresa_id')
        .eq('user_id', user!.id)
      if (error) throw error
      return data as InteraccionReporte[]
    },
    enabled: !!user,
  })

  const loading = loadingEmpresas || loadingOportunidades || loadingInteracciones
  const activas = empresas.filter(empresa => !terminales.has(empresa.etapa))
  const clientes = empresas.filter(empresa => empresa.etapa === 'Cliente')
  const perdidas = empresas.filter(empresa => empresa.etapa === 'Inactivo/Perdido')
  const vencidas = activas.filter(empresa => esFechaVencida(empresa.proxima_accion_fecha))
  const sinProximoPaso = activas.filter(empresa => !empresa.proxima_accion_fecha && empresa.prioridad !== 'Baja')
  const trabadas = activas.filter(empresa => getDiasEnEtapa(empresa) >= 14)
  const tasaCliente = empresas.length ? Math.round((clientes.length / empresas.length) * 100) : 0
  const duplicados = findDuplicateGroups(empresas)

  const abiertas = oportunidades.filter(op => op.estado !== 'Ganada' && op.estado !== 'Perdida')
  const ponderadoARS = abiertas
    .filter(op => op.moneda === 'ARS')
    .reduce((acc, op) => acc + (op.monto_estimado ?? 0) * ((op.probabilidad ?? 0) / 100), 0)
  const ponderadoUSD = abiertas
    .filter(op => op.moneda === 'USD')
    .reduce((acc, op) => acc + (op.monto_estimado ?? 0) * ((op.probabilidad ?? 0) / 100), 0)

  const maxEtapa = Math.max(...ETAPAS_ORDEN.map(etapa => empresas.filter(empresa => empresa.etapa === etapa).length), 1)
  const forecast = groupForecast(oportunidades)
  const maxForecast = Math.max(...forecast.map(row => row.ponderadoARS + row.ponderadoUSD), 1)

  const canales = interacciones.reduce<Record<string, number>>((acc, interaccion) => {
    const canal = interaccion.canal ?? 'Sin canal'
    acc[canal] = (acc[canal] ?? 0) + 1
    return acc
  }, {})
  const topCanales = Object.entries(canales).sort((a, b) => b[1] - a[1])
  const maxCanal = Math.max(...topCanales.map(([, count]) => count), 1)

  const motivos = [
    ...perdidas.map(empresa => empresa.motivo_perdida || 'Sin motivo'),
    ...oportunidades.filter(op => op.estado === 'Perdida').map(op => op.motivo_perdida || 'Sin motivo'),
  ].reduce<Record<string, number>>((acc, motivo) => {
    acc[motivo] = (acc[motivo] ?? 0) + 1
    return acc
  }, {})
  const motivosOrdenados = Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 6)

  function exportarReporte() {
    const headers = ['Tipo', 'Empresa', 'Etapa/Estado', 'Prioridad/Monto', 'Fecha', 'Detalle']
    const rows = [
      ...vencidas.map(empresa => ['Accion vencida', empresa.razon_social, empresa.etapa, empresa.prioridad, empresa.proxima_accion_fecha ?? '', empresa.proxima_accion ?? '']),
      ...sinProximoPaso.map(empresa => ['Sin proximo paso', empresa.razon_social, empresa.etapa, empresa.prioridad, '', '']),
      ...trabadas.map(empresa => ['Cuenta trabada', empresa.razon_social, empresa.etapa, empresa.prioridad, empresa.updated_at, `${getDiasEnEtapa(empresa)} dias en etapa`]),
      ...abiertas.map(op => ['Oportunidad abierta', op.empresa?.razon_social ?? '', op.estado, op.monto_estimado ?? '', op.fecha_cierre_estimada ?? '', op.titulo]),
      ...duplicados.flatMap(group => group.empresas.map(empresa => ['Posible duplicado', empresa.razon_social, empresa.etapa, group.reason, '', group.label])),
    ]
    downloadCSV(`bartez-reporte-accionable-${new Date().toISOString().slice(0,10)}.csv`, headers, rows)
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--text)' }}>Reportes</h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-2)' }}>
            {loading ? '...' : `${empresas.length} empresas · ${oportunidades.length} oportunidades · ${interacciones.length} interacciones`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={exportarReporte}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-sm transition-colors hover:bg-green-deep/5"
          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
        >
          <Download size={13} />
          CSV accionable
        </button>
        <button
          onClick={printCurrentReport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-sm transition-colors hover:bg-green-deep/5"
          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
        >
          <Printer size={13} />
          PDF / imprimir
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <ReportKpi icon={Target} label="Tasa a cliente" value={`${tasaCliente}%`} sub={`${clientes.length} clientes`} color="#14532D" />
        <ReportKpi icon={AlertTriangle} label="Acciones vencidas" value={vencidas.length} sub="requieren seguimiento" color="#A8893A" />
        <ReportKpi icon={CalendarClock} label="Sin próximo paso" value={sinProximoPaso.length} sub="alta/media prioridad" color="#6B8CAE" />
        <ReportKpi icon={BarChart3} label="Cuentas trabadas" value={trabadas.length} sub="14d o más" color="#B5895A" />
        <ReportKpi icon={CircleDollarSign} label="Oportunidades" value={abiertas.length} sub="abiertas" color="#14532D" />
      </div>

      {duplicados.length > 0 && (
        <section className="border rounded-sm" style={{ borderColor: '#A8893A40', backgroundColor: '#A8893A0D' }}>
          <SectionHeader title="Limpieza de datos: posibles duplicados" value={duplicados.length} />
          <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {duplicados.slice(0, 6).map(group => (
              <div key={group.key} className="border rounded-sm px-3 py-2" style={{ borderColor: '#A8893A30', backgroundColor: 'var(--surface)' }}>
                <p className="text-xs font-medium" style={{ color: '#A8893A' }}>{group.reason}: {group.label}</p>
                <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-2)' }}>
                  {group.empresas.map(empresa => empresa.razon_social).join(' / ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <SectionHeader title="Conversión por etapa" value={`${empresas.length} empresas`} />
          <div className="px-4 py-4 space-y-2.5">
            {ETAPAS_ORDEN.map(etapa => {
              const count = empresas.filter(empresa => empresa.etapa === etapa).length
              const pct = Math.round((count / maxEtapa) * 100)
              const cfg = etapaConfig[etapa]
              return (
                <div key={etapa} className="flex items-center gap-3">
                  <span className="text-xs w-44 flex-shrink-0 text-right truncate" style={{ color: 'var(--text-2)' }}>{etapa}</span>
                  <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                    <div className="h-full rounded-sm flex items-center" style={{ width: `${pct}%`, minWidth: count ? 28 : 0, backgroundColor: cfg.color + '30' }}>
                      {count > 0 && <span className="font-mono text-xs px-2 font-medium" style={{ color: cfg.color }}>{count}</span>}
                    </div>
                  </div>
                  <span className="font-mono text-xs w-10 text-right" style={{ color: 'var(--text-2)' }}>
                    {empresas.length ? Math.round((count / empresas.length) * 100) : 0}%
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <SectionHeader title="Pipeline ponderado" value={abiertas.length} />
          <div className="px-4 py-4 space-y-4">
            <MoneyLine label="ARS" value={ponderadoARS} moneda="ARS" />
            <MoneyLine label="USD" value={ponderadoUSD} moneda="USD" />
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-2)' }}>Ganadas</p>
              <p className="font-mono text-lg font-semibold" style={{ color: '#14532D' }}>
                {oportunidades.filter(op => op.estado === 'Ganada').length}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <SectionHeader title="Forecast por mes" value={`${forecast.length} cortes`} />
          <div className="px-4 py-4 space-y-3">
            {forecast.length === 0 ? (
              <EmptyReport text="Sin oportunidades abiertas con monto." />
            ) : forecast.map(row => {
              const total = row.ponderadoARS + row.ponderadoUSD
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{row.label}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>{row.count} ops</span>
                  </div>
                  <div className="h-4 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                    <div className="h-full rounded-sm" style={{ width: `${Math.round((total / maxForecast) * 100)}%`, backgroundColor: '#14532D35', minWidth: total ? 24 : 0 }} />
                  </div>
                  <p className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>
                    {row.ponderadoARS > 0 ? `${formatMoneda(row.ponderadoARS, 'ARS')} pond.` : ''}
                    {row.ponderadoARS > 0 && row.ponderadoUSD > 0 ? ' · ' : ''}
                    {row.ponderadoUSD > 0 ? `${formatMoneda(row.ponderadoUSD, 'USD')} pond.` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <SectionHeader title="Pérdidas por motivo" value={motivosOrdenados.length} />
          <div className="px-4 py-4 space-y-2">
            {motivosOrdenados.length === 0 ? (
              <EmptyReport text="Sin pérdidas registradas." />
            ) : motivosOrdenados.map(([motivo, count]) => (
              <div key={motivo} className="flex items-start justify-between gap-3 py-1">
                <span className="text-xs leading-snug" style={{ color: 'var(--text)' }}>{motivo}</span>
                <span className="font-mono text-xs px-1.5 py-0.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#A8893A18', color: '#A8893A' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <SectionHeader title="Actividad por canal" value={interacciones.length} />
          <div className="px-4 py-4 space-y-2.5">
            {topCanales.length === 0 ? (
              <EmptyReport text="Sin interacciones registradas." />
            ) : topCanales.map(([canal, count]) => (
              <div key={canal} className="flex items-center gap-2">
                <span className="text-sm w-6">{canal in canalEmoji ? canalEmoji[canal as Canal] : '•'}</span>
                <span className="text-xs w-24 truncate" style={{ color: 'var(--text-2)' }}>{canal}</span>
                <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="h-full rounded-sm" style={{ width: `${Math.round((count / maxCanal) * 100)}%`, backgroundColor: '#6B8CAE50' }} />
                </div>
                <span className="font-mono text-xs w-8 text-right" style={{ color: 'var(--text)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <SectionHeader title="Alertas operativas" value={vencidas.length + sinProximoPaso.length + trabadas.length} />
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: 'var(--border)' }}>
            <AlertList title="Vencidas" empresas={vencidas.slice(0, 5)} empty="Sin acciones vencidas." />
            <AlertList title="Sin próximo paso" empresas={sinProximoPaso.slice(0, 5)} empty="Todo con seguimiento." />
            <AlertList title="Trabadas" empresas={trabadas.slice(0, 5)} empty="Sin cuentas trabadas." />
          </div>
        </section>
      </div>
    </div>
  )
}

function ReportKpi({ icon: Icon, label, value, sub, color }: {
  icon: ElementType
  label: string
  value: string | number
  sub: string
  color: string
}) {
  return (
    <div className="px-4 py-3.5 border rounded-sm flex items-start gap-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: color + '18' }}>
        <Icon size={15} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="font-mono font-semibold text-xl leading-none" style={{ color }}>{value}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{label}</p>
        <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-2)' }}>{sub}</p>
      </div>
    </div>
  )
}

function SectionHeader({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{title}</span>
      <span className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>{value}</span>
    </div>
  )
}

function MoneyLine({ label, value, moneda }: { label: string; value: number; moneda: 'ARS' | 'USD' }) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-2)' }}>{label}</p>
      <p className="font-mono font-semibold text-lg leading-none" style={{ color: value > 0 ? '#14532D' : 'var(--border)' }}>
        {value > 0 ? formatMoneda(value, moneda) : '—'}
      </p>
    </div>
  )
}

function EmptyReport({ text }: { text: string }) {
  return <p className="text-xs py-6 text-center" style={{ color: 'var(--text-2)' }}>{text}</p>
}

function AlertList({ title, empresas, empty }: { title: string; empresas: Empresa[]; empty: string }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <PhoneCall size={13} style={{ color: 'var(--text-2)' }} />
        <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{title}</span>
      </div>
      {empresas.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-2)' }}>{empty}</p>
      ) : (
        <div className="space-y-2">
          {empresas.map(empresa => (
            <Link key={empresa.id} to={`/empresas/${empresa.id}`} className="block group">
              <p className="text-xs font-medium truncate group-hover:underline" style={{ color: 'var(--text)' }}>{empresa.razon_social}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                {empresa.proxima_accion ?? empresa.etapa}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
