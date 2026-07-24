import { odooEnv } from '@/shared/lib/odooEnv'
import type { KioskPaymentMethod } from '@/shared/types/types'

// ─── Raw Odoo shapes ──────────────────────────────────────────────────────────

interface RawMethod {
  id: number
  name: string
  payment_type: string
  apply_igtf: boolean
  igtf_percent: number
  journal_id: [number, string]
  currency_id: [number, string] | false
  use_for_change: boolean
  with_merchant: boolean
  printer_code: string | false
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapMethod(r: RawMethod): KioskPaymentMethod {
  return {
    id: r.id,
    name: r.name,
    paymentType: r.payment_type as KioskPaymentMethod['paymentType'],
    applyIgtf: r.apply_igtf,
    igtfPercent: r.igtf_percent,
    journalId: r.journal_id[0],
    currencyId: r.currency_id ? r.currency_id[0] : 0,
    useForChange: r.use_for_change,
    withMerchant: r.with_merchant,
    // fiscal-tender-code-mapping: nunca inventar un código — '' si Odoo no lo tiene
    printerCode: r.printer_code || ''
  }
}

// ─── Payment methods ──────────────────────────────────────────────────────────

export async function fetchPaymentMethods(branchId?: number): Promise<KioskPaymentMethod[]> {
  const domain: unknown[] = [
    ['use_for_payment', '=', true],
    ['caja_autoservicio', '=', true],
    ['active', '=', true]
  ]
  if (branchId) {
    // Mismo criterio que el backend: métodos de la sucursal o globales (sin sucursal)
    domain.push('|', ['branch_id', '=', branchId], ['branch_id', '=', false])
  }

  const raw = await odooEnv.callMethod<RawMethod[]>(
    'x.pos.payment.method', 'search_read',
    [domain],
    { fields: ['id', 'name', 'payment_type', 'apply_igtf', 'igtf_percent', 'journal_id', 'currency_id', 'use_for_change', 'with_merchant', 'printer_code'] }
  )

  const mapped = raw.map(mapMethod)

  // Fetch unique currency info to get name, symbol and rate
  const uniqueCurrencyIds = Array.from(
    new Set(raw.map(r => (r.currency_id ? r.currency_id[0] : null)).filter((id): id is number => id !== null))
  )

  if (uniqueCurrencyIds.length > 0) {
    try {
      const currencies = await odooEnv.callMethod<{ id: number; name: string; symbol: string; rate: number }[]>(
        'res.currency', 'search_read',
        [[['id', 'in', uniqueCurrencyIds]]],
        { fields: ['id', 'name', 'symbol', 'rate'] }
      )
      const currencyMap = new Map(currencies.map(c => [c.id, c]))

      for (const m of mapped) {
        const cInfo = currencyMap.get(m.currencyId)
        if (cInfo) {
          m.currencyName = cInfo.name
          m.currencySymbol = cInfo.symbol
          m.currencyRate = cInfo.rate
        }
      }
    } catch (err) {
      console.error('Error fetching currency rates:', err)
    }
  }

  return mapped
}
