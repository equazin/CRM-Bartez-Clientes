import type { Empresa } from '@/types/domain'

export interface DuplicateGroup {
  key: string
  label: string
  reason: string
  empresas: Empresa[]
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\//g, '')
    .replace(/^www\./g, '')
    .replace(/[^a-z0-9]/g, '')
}

function addCandidate(map: Map<string, DuplicateGroup>, reason: string, label: string, empresa: Empresa, raw: string | null | undefined) {
  const normalized = normalizeText(raw)
  if (normalized.length < 4) return
  const key = `${reason}:${normalized}`
  const current = map.get(key) ?? { key, label, reason, empresas: [] }
  current.empresas.push(empresa)
  map.set(key, current)
}

export function findDuplicateGroups(empresas: Empresa[]): DuplicateGroup[] {
  const candidates = new Map<string, DuplicateGroup>()

  empresas.forEach(empresa => {
    addCandidate(candidates, 'CUIT', empresa.cuit ?? '', empresa, empresa.cuit)
    addCandidate(candidates, 'Email', empresa.email_principal ?? '', empresa, empresa.email_principal)
    addCandidate(candidates, 'Web', empresa.sitio_web ?? '', empresa, empresa.sitio_web)
    addCandidate(candidates, 'Razon social', empresa.razon_social, empresa, empresa.razon_social)
  })

  return [...candidates.values()]
    .filter(group => group.empresas.length > 1)
    .sort((a, b) => b.empresas.length - a.empresas.length || a.reason.localeCompare(b.reason, 'es'))
}

export function isEmpresaSinSeguimiento(empresa: Empresa) {
  return !empresa.proxima_accion_fecha && empresa.etapa !== 'Cliente' && empresa.etapa !== 'Inactivo/Perdido'
}
