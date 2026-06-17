import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Canal, Empresa, Prioridad, Sector } from '@/types/domain'

const SECTORES: Sector[] = [
  'Siderurgia', 'Metalurgia', 'Autopartes', 'Maquinaria agrícola',
  'Agroexportadora', 'Lácteos', 'Alimentos', 'Frigorífico',
  'Seguros', 'Prepaga', 'Salud', 'Banca', 'Cooperativa',
  'Retail', 'Mutual', 'Automotriz', 'Industria',
  'Servicio público', 'Entretenimiento', 'Otro',
]
const CANALES: Canal[] = ['Email', 'Formulario', 'Portal', 'WhatsApp', 'Teléfono']
const PRIORIDADES: Prioridad[] = ['Alta', 'Media', 'Baja']

type ImportRow = {
  razon_social: string
  nombre_fantasia: string | null
  cuit: string | null
  sector: Sector
  ciudad: string
  provincia: string
  distancia_km: number | null
  sitio_web: string | null
  telefono_principal: string | null
  email_principal: string | null
  prioridad: Prioridad
  canal_preferido: Canal
  origen: string | null
  proxima_accion: string | null
  proxima_accion_fecha: string | null
  notas: string | null
  errores: string[]
  duplicada: boolean
}

interface Props {
  open: boolean
  onClose: () => void
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\//g, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9@.]+/g, ' ')
    .trim()
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map(h => normalize(h).replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line)
    return headers.reduce<Record<string, string>>((acc, header, idx) => {
      acc[header] = values[idx]?.trim() ?? ''
      return acc
    }, {})
  })
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const normalizedKey = normalize(key).replace(/\s+/g, '_')
    if (row[normalizedKey]) return row[normalizedKey]
  }
  return ''
}

function matchOption<T extends string>(value: string, options: readonly T[], fallback: T): T {
  const normalized = normalize(value)
  return options.find(option => normalize(option) === normalized) ?? fallback
}

function toImportRows(rawRows: Record<string, string>[], existentes: Empresa[]): ImportRow[] {
  const seen = new Set<string>()
  const existingKeys = new Set<string>()

  existentes.forEach(empresa => {
    ;[
      normalize(empresa.razon_social),
      normalize(empresa.email_principal),
      normalize(empresa.sitio_web),
      normalize(empresa.cuit),
    ].filter(Boolean).forEach(key => existingKeys.add(key))
  })

  return rawRows.map(row => {
    const razon_social = pick(row, ['razon_social', 'razon social', 'empresa', 'nombre', 'compania', 'compañia'])
    const email_principal = pick(row, ['email_principal', 'email', 'mail', 'correo']) || null
    const sitio_web = pick(row, ['sitio_web', 'web', 'website', 'url']) || null
    const cuit = pick(row, ['cuit', 'cuil']) || null
    const ciudad = pick(row, ['ciudad', 'localidad']) || 'Rosario'
    const provincia = pick(row, ['provincia']) || 'Santa Fe'
    const distancia = pick(row, ['distancia_km', 'distancia', 'km'])
    const keyCandidates = [normalize(razon_social), normalize(email_principal), normalize(sitio_web), normalize(cuit)].filter(Boolean)
    const duplicada = keyCandidates.some(key => existingKeys.has(key) || seen.has(key))
    keyCandidates.forEach(key => seen.add(key))

    const errores: string[] = []
    if (!razon_social) errores.push('Falta empresa')
    if (!ciudad) errores.push('Falta ciudad')

    return {
      razon_social,
      nombre_fantasia: pick(row, ['nombre_fantasia', 'fantasia', 'nombre fantasia']) || null,
      cuit,
      sector: matchOption(pick(row, ['sector', 'rubro', 'industria']), SECTORES, 'Otro'),
      ciudad,
      provincia,
      distancia_km: distancia ? Number(distancia) : null,
      sitio_web,
      telefono_principal: pick(row, ['telefono_principal', 'telefono', 'celular', 'whatsapp']) || null,
      email_principal,
      prioridad: matchOption(pick(row, ['prioridad']), PRIORIDADES, 'Media'),
      canal_preferido: matchOption(pick(row, ['canal_preferido', 'canal']), CANALES, 'Email'),
      origen: pick(row, ['origen', 'fuente']) || null,
      proxima_accion: pick(row, ['proxima_accion', 'proxima accion', 'accion']) || null,
      proxima_accion_fecha: pick(row, ['proxima_accion_fecha', 'fecha', 'proxima fecha']) || null,
      notas: pick(row, ['notas', 'observaciones', 'comentarios']) || null,
      errores,
      duplicada,
    }
  })
}

export default function ImportarEmpresasDrawer({ open, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')

  const { data: existentes = [] } = useQuery({
    queryKey: ['empresas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('owner_id', user!.id)
      if (error) throw error
      return data as Empresa[]
    },
    enabled: !!user && open,
  })

  const importRows = useMemo(() => toImportRows(rows, existentes), [rows, existentes])
  const validas = importRows.filter(row => row.errores.length === 0 && !row.duplicada)
  const duplicadas = importRows.filter(row => row.duplicada)
  const conErrores = importRows.filter(row => row.errores.length > 0)

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = validas.map(row => ({
        owner_id: user!.id,
        razon_social: row.razon_social,
        nombre_fantasia: row.nombre_fantasia,
        cuit: row.cuit,
        sector: row.sector,
        ciudad: row.ciudad,
        provincia: row.provincia,
        distancia_km: Number.isFinite(row.distancia_km) ? row.distancia_km : null,
        sitio_web: row.sitio_web,
        telefono_principal: row.telefono_principal,
        email_principal: row.email_principal,
        prioridad: row.prioridad,
        canal_preferido: row.canal_preferido,
        etapa: 'Prospecto',
        origen: row.origen,
        proxima_accion: row.proxima_accion,
        proxima_accion_fecha: row.proxima_accion_fecha,
        notas: row.notas,
      }))
      const { error } = await supabase.from('empresas').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas'] })
      queryClient.invalidateQueries({ queryKey: ['empresas-select'] })
      toast.success(`${validas.length} empresas importadas`)
      setRows([])
      setFileName('')
      onClose()
    },
    onError: () => toast.error('No se pudieron importar las empresas'),
  })

  function handleFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setRows(parseCsv(String(reader.result ?? '')))
    reader.readAsText(file, 'utf-8')
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed right-0 top-0 h-full w-full max-w-xl z-50 flex flex-col shadow-xl fade-in"
        style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Importar empresas"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-display font-semibold text-md" style={{ color: 'var(--text)' }}>Importar empresas</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>CSV con encabezados</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-sm hover:bg-black/5 transition-colors" aria-label="Cerrar">
            <X size={16} style={{ color: 'var(--text-2)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <label
            className="flex flex-col items-center justify-center gap-2 min-h-36 border rounded-sm cursor-pointer transition-colors hover:bg-green-deep/5"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text-2)' }}
          >
            <Upload size={22} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{fileName || 'Seleccionar CSV'}</span>
            <span className="text-xs">Columnas mínimas: empresa/razon_social y ciudad</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </label>

          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <ImportStat label="Válidas" value={validas.length} color="#14532D" />
                <ImportStat label="Duplicadas" value={duplicadas.length} color="#B5895A" />
                <ImportStat label="Con errores" value={conErrores.length} color="#ef4444" />
              </div>

              <div className="border rounded-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Empresa</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Ciudad</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Sector</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 8).map((row, idx) => (
                      <tr key={`${row.razon_social}-${idx}`} style={{ borderBottom: idx < Math.min(importRows.length, 8) - 1 ? '1px solid var(--border)' : undefined }}>
                        <td className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--text)' }}>{row.razon_social || '-'}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-2)' }}>{row.ciudad}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-2)' }}>{row.sector}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: row.errores.length ? '#ef4444' : row.duplicada ? '#B5895A' : '#14532D' }}>
                          {row.errores.length ? row.errores.join(', ') : row.duplicada ? 'Duplicada' : 'Lista'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importRows.length > 8 && (
                <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                  Mostrando 8 de {importRows.length} filas.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {mutation.error && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>Error al importar. Revisá el CSV e intentá de nuevo.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border rounded-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={validas.length === 0 || mutation.isPending}
              className="flex-1 py-2 text-sm font-medium rounded-sm disabled:opacity-60"
              style={{ backgroundColor: '#14532D', color: 'white' }}
            >
              {mutation.isPending ? 'Importando...' : `Importar ${validas.length}`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ImportStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-3 py-2 border rounded-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
      <p className="font-mono text-lg font-semibold leading-none" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{label}</p>
    </div>
  )
}
