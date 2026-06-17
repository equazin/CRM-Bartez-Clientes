import { format, differenceInDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Empresa, Interaccion, Oportunidad, Etapa } from '@/types/domain'
import {
  canalEmoji, etapaConfig, formatFechaDoble,
  formatMoneda, esFechaVencida, esFechaHoy,
} from '@/lib/utils'
import { Clock, Plus, AlertTriangle, TrendingUp, Building2, CheckCircle } from 'lucide-react'
import RegistrarInteraccionDrawer from '@/components/interacciones/RegistrarInteraccionDrawer'
import type { Contacto } from '@/types/domain'

const ETAPAS_ACTIVAS: Etapa[] = [
  'Prospecto', 'Contactado', 'Derivado a Compras',
  'En alta de proveedor', 'Proveedor habilitado', 'Cotización enviada',
]

// ── helpers ──────────────────────────────────────────────────────────────────
function getSaludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function getDiasSinContacto(fecha?: string): number | null {
  if (!fecha) return null
  return differenceInDays(new Date(), parseISO(fecha))
}

function getDiasEnEtapa(empresa: Empresa): number {
  if (!empresa.updated_at) return 0
  return Math.max(0, differenceInDays(new Date(), parseISO(empresa.updated_at)))
}

function getPrioridadOperativa(empresa: Empresa): number {
  const diasEnEtapa = getDiasEnEtapa(empresa)
  let score = 0
  if (empresa.proxima_accion_fecha && esFechaVencida(empresa.proxima_accion_fecha)) score += 45
  else if (empresa.proxima_accion_fecha && esFechaHoy(empresa.proxima_accion_fecha)) score += 28
  else if (!empresa.proxima_accion_fecha) score += 18

  if (empresa.prioridad === 'Alta') score += 30
  if (empresa.prioridad === 'Media') score += 15

  if (['Derivado a Compras', 'En alta de proveedor', 'Proveedor habilitado', 'Cotización enviada'].includes(empresa.etapa)) score += 18
  if (diasEnEtapa >= 21) score += 18
  else if (diasEnEtapa >= 14) score += 10

  return score
}

// ── componentes auxiliares ────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, icon: Icon,
}: {
  label: string; value: string | number; sub?: string
  accent?: string; icon: React.ElementType
}) {
  return (
    <div
      className="px-4 py-3.5 border rounded-sm flex items-start gap-3"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div
        className="w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: accent ? accent + '18' : '#14532D18' }}
      >
        <Icon size={15} style={{ color: accent ?? '#14532D' }} />
      </div>
      <div className="min-w-0">
        <p className="font-mono font-semibold text-xl leading-none" style={{ color: accent ?? 'var(--text)' }}>
          {value}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5 font-mono" style={{ color: accent ?? 'var(--text-2)' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── página principal ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fechaLarga = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null)

  // ── queries ─────────────────────────────────────────────────────────────────
  const { data: empresas = [], isLoading: loadEmp } = useQuery({
    queryKey: ['empresas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas').select('*').eq('owner_id', user!.id)
      if (error) throw error
      return data as Empresa[]
    },
    enabled: !!user,
  })

  const { data: oportunidades = [] } = useQuery({
    queryKey: ['oportunidades', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oportunidades')
        .select('id, titulo, monto_estimado, moneda, estado, probabilidad, empresa_id')
        .eq('owner_id', user!.id)
        .not('estado', 'in', '("Ganada","Perdida")')
      if (error) throw error
      return data as Oportunidad[]
    },
    enabled: !!user,
  })

  const { data: interaccionesRecientes = [] } = useQuery({
    queryKey: ['interacciones-recientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interacciones')
        .select('id, tipo, canal, fecha, resultado, empresa_id, empresa:empresas(id, razon_social)')
        .eq('user_id', user!.id)
        .order('fecha', { ascending: false })
        .limit(8)
      if (error) throw error
      return data as unknown as (Interaccion & { empresa: { id: string; razon_social: string } | null })[]
    },
    enabled: !!user,
  })

  const { data: contactosDrawer = [] } = useQuery({
    queryKey: ['contactos-drawer', drawerEmpresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contactos').select('*').eq('empresa_id', drawerEmpresaId!)
        .order('es_contacto_principal', { ascending: false })
      if (error) throw error
      return data as Contacto[]
    },
    enabled: !!drawerEmpresaId,
  })

  // ── cálculos derivados ───────────────────────────────────────────────────────
  const hoy = format(new Date(), 'yyyy-MM-dd')

  const activas      = empresas.filter(e => e.etapa !== 'Inactivo/Perdido' && e.etapa !== 'Cliente')
  const clientes     = empresas.filter(e => e.etapa === 'Cliente')
  const conFechaPendiente = empresas.filter(e =>
    e.proxima_accion_fecha && e.proxima_accion_fecha <= hoy &&
    e.etapa !== 'Inactivo/Perdido' && e.etapa !== 'Cliente'
  )
  const vencidas     = conFechaPendiente.filter(e => esFechaVencida(e.proxima_accion_fecha))
  const deHoy        = conFechaPendiente.filter(e => esFechaHoy(e.proxima_accion_fecha))
  const sinAgendar   = activas.filter(e => !e.proxima_accion_fecha && (e.prioridad === 'Alta' || e.prioridad === 'Media'))
  const conAccion    = [...conFechaPendiente, ...sinAgendar]
    .sort((a, b) => {
      const byScore = getPrioridadOperativa(b) - getPrioridadOperativa(a)
      if (byScore !== 0) return byScore
      return (a.proxima_accion_fecha ?? '9999-12-31').localeCompare(b.proxima_accion_fecha ?? '9999-12-31')
    })
  const trabadas = activas
    .filter(e => getDiasEnEtapa(e) >= 14 || !e.proxima_accion_fecha)
    .sort((a, b) => getPrioridadOperativa(b) - getPrioridadOperativa(a))

  const ponderadoARS = oportunidades
    .filter(o => o.moneda === 'ARS' && o.monto_estimado && o.probabilidad)
    .reduce((n, o) => n + o.monto_estimado! * (o.probabilidad! / 100), 0)
  const ponderadoUSD = oportunidades
    .filter(o => o.moneda === 'USD' && o.monto_estimado && o.probabilidad)
    .reduce((n, o) => n + o.monto_estimado! * (o.probabilidad! / 100), 0)

  const porEtapa = ETAPAS_ACTIVAS.reduce<Record<Etapa, number>>((acc, e) => {
    acc[e] = empresas.filter(emp => emp.etapa === e).length
    return acc
  }, {} as Record<Etapa, number>)
  const maxEnEtapa = Math.max(...Object.values(porEtapa), 1)

  const drawerEmpresa = empresas.find(e => e.id === drawerEmpresaId) ?? null

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs capitalize" style={{ color: 'var(--text-2)' }}>{fechaLarga}</p>
          <h1 className="font-display font-semibold text-2xl mt-0.5" style={{ color: 'var(--text)' }}>
            {getSaludo()}, {user?.email?.split('@')[0]}
          </h1>
        </div>
        {vencidas.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs font-medium"
            style={{ borderColor: '#A8893A40', backgroundColor: '#A8893A0D', color: '#A8893A' }}>
            <AlertTriangle size={13} />
            {vencidas.length} {vencidas.length === 1 ? 'acción vencida' : 'acciones vencidas'}
          </div>
        )}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Building2}   label="Empresas activas"  value={activas.length}      sub={`${empresas.length} total`} />
        <KpiCard icon={AlertTriangle} label="Acciones vencidas" value={vencidas.length}  accent="#A8893A" sub={`${deHoy.length} para hoy`} />
        <KpiCard icon={Clock}       label="Sin agendar"        value={sinAgendar.length}   accent="#6B8CAE" sub="prioridad alta/media" />
        <KpiCard icon={TrendingUp}  label="Cuentas trabadas"   value={trabadas.length}     accent="#B5895A" sub="14d o sin paso" />
        <KpiCard icon={CheckCircle} label="Clientes"           value={clientes.length}     accent="#14532D" sub={`${empresas.filter(e => e.etapa === 'Inactivo/Perdido').length} inactivos`} />
      </div>

      {/* ── Grid principal ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Pipeline funnel — 2 cols */}
        <div className="lg:col-span-2 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
              Pipeline activo
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>{activas.length} empresas</span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {ETAPAS_ACTIVAS.map(etapa => {
              const cfg   = etapaConfig[etapa]
              const count = porEtapa[etapa] ?? 0
              const pct   = Math.round((count / maxEnEtapa) * 100)
              return (
                <div key={etapa} className="flex items-center gap-3">
                  <span
                    className="text-xs w-44 flex-shrink-0 truncate text-right"
                    style={{ color: 'var(--text-2)' }}
                  >
                    {etapa}
                  </span>
                  <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                    <div
                      className="h-full rounded-sm transition-all duration-500 flex items-center"
                      style={{ width: `${pct}%`, backgroundColor: cfg.color + '30', minWidth: count > 0 ? 28 : 0 }}
                    >
                      {count > 0 && (
                        <span className="font-mono text-xs px-2 font-medium" style={{ color: cfg.color }}>
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                  {count === 0 && (
                    <span className="font-mono text-xs w-6 text-center" style={{ color: 'var(--border)' }}>—</span>
                  )}
                </div>
              )
            })}
            {/* Terminales */}
            <div className="flex gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              {(['Cliente', 'Inactivo/Perdido'] as Etapa[]).map(etapa => {
                const cfg = etapaConfig[etapa]
                const count = empresas.filter(e => e.etapa === etapa).length
                return (
                  <div key={etapa} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <span className="text-xs font-mono" style={{ color: 'var(--text-2)' }}>{etapa}: <strong style={{ color: 'var(--text)' }}>{count}</strong></span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Oportunidades — 1 col */}
        <div className="space-y-3">
          <div className="border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
                Oportunidades abiertas
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-2)' }}>Pipeline ponderado ARS</p>
                <p className="font-mono font-semibold text-lg leading-none" style={{ color: '#14532D' }}>
                  {ponderadoARS > 0 ? formatMoneda(ponderadoARS, 'ARS') : '—'}
                </p>
              </div>
              {ponderadoUSD > 0 && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-2)' }}>Pipeline ponderado USD</p>
                  <p className="font-mono font-semibold text-lg leading-none" style={{ color: '#14532D' }}>
                    {formatMoneda(ponderadoUSD, 'USD')}
                  </p>
                </div>
              )}
              <div className="border-t pt-3 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>Abiertas</span>
                <span className="font-mono font-semibold text-lg" style={{ color: 'var(--text)' }}>{oportunidades.length}</span>
              </div>
              <button
                onClick={() => navigate('/oportunidades')}
                className="w-full py-1.5 text-xs text-center border rounded-sm transition-colors hover:bg-green-deep/5"
                style={{ borderColor: 'var(--border)', color: '#14532D' }}
              >
                Ver todas las oportunidades →
              </button>
            </div>
          </div>

          {/* Distribución por sector top-5 */}
          <SectorWidget empresas={activas} />
        </div>
      </div>

      {/* ── Fila inferior ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Cola de trabajo — 2 cols */}
        <div className="lg:col-span-2 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
              Cola de trabajo priorizada
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>
              {conAccion.length} pendientes
            </span>
          </div>

          {loadEmp ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 skeleton rounded-sm" />)}
            </div>
          ) : conAccion.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Sin acciones pendientes</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>Agendá próximos pasos en las fichas.</p>
            </div>
          ) : (
            <div>
              {conAccion.slice(0, 8).map((empresa, idx) => {
                const urgente = esFechaVencida(empresa.proxima_accion_fecha)
                const etapa   = etapaConfig[empresa.etapa]
                const score = getPrioridadOperativa(empresa)
                const diasEtapa = getDiasEnEtapa(empresa)
                return (
                  <div
                    key={empresa.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer group transition-colors hover:bg-green-deep/5"
                    style={{
                      borderBottom: idx < conAccion.slice(0,8).length - 1 ? '1px solid var(--border)' : undefined,
                      backgroundColor: idx % 2 !== 0 ? 'var(--bg)' : undefined,
                    }}
                    onClick={() => navigate(`/empresas/${empresa.id}`)}
                  >
                    {/* dot etapa */}
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.color }} />

                    {/* nombre + acción */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: urgente ? '#A8893A' : 'var(--text)' }}>
                          {empresa.razon_social}
                        </span>
                        <span className="text-xs flex-shrink-0 font-mono" style={{ color: 'var(--text-2)' }}>
                          {empresa.ciudad}
                        </span>
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: urgente ? '#A8893A90' : 'var(--text-2)' }}>
                        {empresa.proxima_accion ?? 'Definir próximo paso'}
                      </p>
                    </div>

                    {/* canal + fecha */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {diasEtapa >= 14 && (
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: '#B5895A18', color: '#B5895A' }}>
                          {diasEtapa}d
                        </span>
                      )}
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: '#14532D10', color: '#14532D' }}>
                        {score}
                      </span>
                      <span className="text-sm">{canalEmoji[empresa.canal_preferido]}</span>
                      <span className="font-mono text-xs" style={{ color: urgente ? '#A8893A' : 'var(--text-2)' }}>
                        {formatFechaDoble(empresa.proxima_accion_fecha)}
                      </span>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={e => { e.stopPropagation(); setDrawerEmpresaId(empresa.id) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-medium flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: urgente ? '#A8893A15' : '#14532D10', color: urgente ? '#A8893A' : '#14532D' }}
                    >
                      <Plus size={11} /> Registrar
                    </button>
                  </div>
                )
              })}
              {conAccion.length > 8 && (
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-2.5 text-xs border-t text-center hover:bg-green-deep/5 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                >
                  {conAccion.length - 8} más → ver cola completa
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
        {/* Actividad reciente — 1 col */}
        <div className="border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
              Actividad reciente
            </span>
          </div>
          <div>
            {interaccionesRecientes.length === 0 ? (
              <p className="px-4 py-8 text-xs text-center" style={{ color: 'var(--text-2)' }}>
                Sin interacciones registradas.
              </p>
            ) : (
              interaccionesRecientes.map((inter, idx) => {
                const dias = getDiasSinContacto(inter.fecha)
                return (
                  <div
                    key={inter.id}
                    className="flex items-start gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-green-deep/5 transition-colors"
                    style={{
                      borderBottom: idx < interaccionesRecientes.length - 1 ? '1px solid var(--border)' : undefined,
                      backgroundColor: idx % 2 !== 0 ? 'var(--bg)' : undefined,
                    }}
                    onClick={() => inter.empresa && navigate(`/empresas/${inter.empresa.id}`)}
                  >
                    <span className="text-sm flex-shrink-0 mt-0.5">
                      {inter.canal ? canalEmoji[inter.canal] : '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                        {inter.empresa?.razon_social ?? '—'}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-2)' }}>
                        {inter.tipo}{inter.resultado ? ` · ${inter.resultado}` : ''}
                      </p>
                    </div>
                    <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                      {dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `${dias}d`}
                    </span>
                  </div>
                )
              })
            )}
          </div>
          <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => navigate('/empresas')}
              className="w-full py-1 text-xs text-center hover:underline"
              style={{ color: '#14532D' }}
            >
              Ver todas las empresas →
            </button>
          </div>
        </div>
          <TrabadasWidget empresas={trabadas.slice(0, 5)} onClick={id => navigate(`/empresas/${id}`)} />
      </div>

      </div>

      {/* Drawer interacción */}
      {drawerEmpresa && (
        <RegistrarInteraccionDrawer
          empresa={drawerEmpresa}
          contactos={contactosDrawer}
          open={!!drawerEmpresaId}
          onClose={() => setDrawerEmpresaId(null)}
        />
      )}
    </div>
  )
}

// ── Widget distribución por sector ───────────────────────────────────────────

function TrabadasWidget({ empresas, onClick }: { empresas: Empresa[]; onClick: (id: string) => void }) {
  if (empresas.length === 0) return null

  return (
    <div className="border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
          Cuentas trabadas
        </span>
        <span className="font-mono text-xs" style={{ color: '#B5895A' }}>{empresas.length}</span>
      </div>
      <div>
        {empresas.map((empresa, idx) => {
          const dias = getDiasEnEtapa(empresa)
          const cfg = etapaConfig[empresa.etapa]
          return (
            <button
              key={empresa.id}
              onClick={() => onClick(empresa.id)}
              className="w-full text-left flex items-start gap-2.5 px-4 py-2.5 hover:bg-green-deep/5 transition-colors"
              style={{
                borderBottom: idx < empresas.length - 1 ? '1px solid var(--border)' : undefined,
                backgroundColor: idx % 2 !== 0 ? 'var(--bg)' : undefined,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: cfg.color }} />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{empresa.razon_social}</span>
                <span className="block text-xs truncate mt-0.5" style={{ color: 'var(--text-2)' }}>
                  {empresa.proxima_accion_fecha ? empresa.etapa : 'Sin próximo paso'}
                </span>
              </span>
              <span className="font-mono text-xs px-1.5 py-0.5 rounded-sm flex-shrink-0" style={{ backgroundColor: '#B5895A18', color: '#B5895A' }}>
                {dias >= 14 ? `${dias}d` : 'sin fecha'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectorWidget({ empresas }: { empresas: Empresa[] }) {
  const conteo = empresas.reduce<Record<string, number>>((acc, e) => {
    acc[e.sector] = (acc[e.sector] ?? 0) + 1
    return acc
  }, {})
  const top5 = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxCount = top5[0]?.[1] ?? 1

  if (top5.length === 0) return null

  return (
    <div className="border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-display font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
          Top sectores
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {top5.map(([sector, count]) => (
          <div key={sector} className="flex items-center gap-2">
            <span className="text-xs w-28 flex-shrink-0 truncate" style={{ color: 'var(--text-2)' }} title={sector}>
              {sector}
            </span>
            <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
              <div
                className="h-full rounded-sm"
                style={{ width: `${Math.round((count / maxCount) * 100)}%`, backgroundColor: '#14532D30' }}
              />
            </div>
            <span className="font-mono text-xs w-4 text-right flex-shrink-0" style={{ color: 'var(--text)' }}>
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
