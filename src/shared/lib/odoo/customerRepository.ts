import { odooEnv } from '@/shared/lib/odooEnv'
import type { KioskPartner } from '@/shared/types/types'

// ─── Raw Odoo shapes ──────────────────────────────────────────────────────────

export interface RawPartner {
  id: number
  name: string
  cedula: string
  phone: string | false
  street: string | false
  email: string | false
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

export function mapPartner(r: RawPartner): KioskPartner {
  return { id: r.id, name: r.name, cedula: r.cedula, phone: r.phone || undefined, street: r.street || undefined, email: r.email || undefined }
}

// ─── Partner ──────────────────────────────────────────────────────────────────

export async function searchPartnerByCedula(cedula: string): Promise<KioskPartner | null> {
  const results = await odooEnv.callMethod<RawPartner[]>(
    'res.partner', 'search_read',
    [[['cedula', '=', cedula]]],
    { fields: ['id', 'name', 'cedula', 'phone', 'street', 'email'], limit: 1 }
  )
  return results.length ? mapPartner(results[0]) : null
}

export interface CreatePartnerInput {
  name: string
  cedula: string
  phone?: string
  street?: string
  email?: string
}

export async function createPartner(data: CreatePartnerInput): Promise<KioskPartner> {
  const newId = await odooEnv.callMethod<number>(
    'res.partner', 'create',
    [{ name: data.name, cedula: data.cedula, phone: data.phone || false, street: data.street || false, email: data.email || false }]
  )
  const [raw] = await odooEnv.callMethod<RawPartner[]>(
    'res.partner', 'read', [[newId]],
    { fields: ['id', 'name', 'cedula', 'phone', 'street', 'email'] }
  )
  return mapPartner(raw)
}
