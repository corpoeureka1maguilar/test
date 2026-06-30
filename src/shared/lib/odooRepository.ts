import { odooEnv } from '@/shared/lib/odooEnv'
import type { KioskPartner, KioskPaymentMethod, KioskProduct, KioskOrder, KioskOrderLine, AdConfig } from '@/shared/types/types'

// ─── Raw Odoo shapes ──────────────────────────────────────────────────────────

interface RawPartner {
  id: number
  name: string
  cedula: string
  phone: string | false
  street: string | false
}

interface RawMethod {
  id: number
  name: string
  payment_type: string
  apply_igtf: boolean
  igtf_percent: number
  journal_id: [number, string]
  currency_id: [number, string] | false
  use_for_change: boolean
}

interface RawProduct {
  id: number
  name: string
  default_code: string | false
  barcode: string | false
  list_price: number
  taxes_id: number[]
  categ_id: [number, string]
  uom_id: [number, string]
}

interface RawOrderHeader {
  id: number
  name: string
  partner_id: [number, string]
  amount_total: number
  x_fex_id: string
  order_line: number[]
  state: string
}

interface RawOrderLine {
  id: number
  product_id: [number, string]
  product_uom_qty: number
  price_unit: number
  price_subtotal: number
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapPartner(r: RawPartner): KioskPartner {
  return { id: r.id, name: r.name, cedula: r.cedula, phone: r.phone || undefined, street: r.street || undefined }
}

function mapMethod(r: RawMethod): KioskPaymentMethod {
  return {
    id: r.id,
    name: r.name,
    paymentType: r.payment_type as KioskPaymentMethod['paymentType'],
    applyIgtf: r.apply_igtf,
    igtfPercent: r.igtf_percent,
    journalId: r.journal_id[0],
    currencyId: r.currency_id ? r.currency_id[0] : 0,
    useForChange: r.use_for_change
  }
}

function mapProduct(r: RawProduct, taxRateMap: Map<number, number>): KioskProduct {
  const firstTaxId = r.taxes_id?.[0]
  const taxRate = firstTaxId != null ? (taxRateMap.get(firstTaxId) ?? 0.16) : 0.16
  return {
    id: r.id,
    name: r.name,
    defaultCode: r.default_code || '',
    barcode: r.barcode || undefined,
    price: r.list_price,
    priceUsd: r.list_price,
    taxRate,
    categId: r.categ_id[0],
    categName: r.categ_id[1],
    uomName: r.uom_id[1]
  }
}

function mapOrderHeader(r: RawOrderHeader): KioskOrder {
  return {
    id: r.id,
    name: r.name,
    partnerId: r.partner_id,
    amountTotal: r.amount_total,
    xFexId: r.x_fex_id,
    orderLine: r.order_line,
    state: r.state
  }
}

// ─── Partner ──────────────────────────────────────────────────────────────────

export async function searchPartnerByCedula(cedula: string): Promise<KioskPartner | null> {
  const results = await odooEnv.callMethod<RawPartner[]>(
    'res.partner', 'search_read',
    [[['cedula', '=', cedula]]],
    { fields: ['id', 'name', 'cedula', 'phone', 'street'], limit: 1 }
  )
  return results.length ? mapPartner(results[0]) : null
}

export interface CreatePartnerInput {
  name: string
  cedula: string
  phone?: string
  street?: string
}

export async function createPartner(data: CreatePartnerInput): Promise<KioskPartner> {
  const newId = await odooEnv.callMethod<number>(
    'res.partner', 'create',
    [{ name: data.name, cedula: data.cedula, phone: data.phone || false, street: data.street || false }]
  )
  const [raw] = await odooEnv.callMethod<RawPartner[]>(
    'res.partner', 'read', [[newId]],
    { fields: ['id', 'name', 'cedula', 'phone', 'street'] }
  )
  return mapPartner(raw)
}

// ─── Payment methods ──────────────────────────────────────────────────────────

export async function fetchPaymentMethods(): Promise<KioskPaymentMethod[]> {
  const raw = await odooEnv.callMethod<RawMethod[]>(
    'x.pos.payment.method', 'search_read',
    [[['use_for_payment', '=', true]]],
    { fields: ['id', 'name', 'payment_type', 'apply_igtf', 'igtf_percent', 'journal_id', 'currency_id', 'use_for_change'] }
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

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<KioskProduct[]> {
  const [raw, rate] = await Promise.all([
    odooEnv.callMethod<RawProduct[]>(
      'product.product', 'search_read',
      [[['sale_ok', '=', true], ['active', '=', true], ['invoice_policy', '=', 'order']]],
      { fields: ['id', 'name', 'default_code', 'barcode', 'list_price', 'taxes_id', 'categ_id', 'uom_id'], limit: 200 }
    ),
    odooEnv.callMethod<number>('res.currency', 'action_get_rate').catch((err) => {
      console.error('[fetchProducts] Error fetching currency rate:', err)
      return 1
    })
  ])

  // Batch-fetch tax rates for all unique tax IDs
  const taxRateMap = new Map<number, number>()
  const uniqueTaxIds = [...new Set(raw.flatMap(r => r.taxes_id ?? []))]
  if (uniqueTaxIds.length > 0) {
    try {
      const taxes = await odooEnv.callMethod<{ id: number; amount: number }[]>(
        'account.tax', 'search_read',
        [[['id', 'in', uniqueTaxIds]]],
        { fields: ['id', 'amount'] }
      )
      for (const t of taxes) {
        taxRateMap.set(t.id, t.amount / 100)
      }
    } catch (err) {
      console.error('[fetchProducts] Error fetching tax rates:', err)
    }
  }

  // Persist rate globally so the header can display it
  const { useExchangeRateStore } = await import('@/shared/stores/exchangeRate')
  useExchangeRateStore.getState().setRate(rate)

  return raw.map(r => {
    const p = mapProduct(r, taxRateMap)
    p.priceUsd = p.price
    if (rate > 1) {
      p.price = p.price * rate
    }
    return p
  })
}

// ─── Sale orders ──────────────────────────────────────────────────────────────

export async function createSaleOrder(payload: unknown): Promise<unknown> {
  return odooEnv.callMethod('sale.order', 'action_create_sale_order_from_pos', [payload])
}

export async function fetchOrder(id: number): Promise<KioskOrder> {
  const [rawOrder] = await odooEnv.callMethod<RawOrderHeader[]>(
    'sale.order', 'read', [[id]],
    { fields: ['id', 'name', 'partner_id', 'amount_total', 'x_fex_id', 'order_line', 'state'] }
  )
  const rawLines = await odooEnv.callMethod<RawOrderLine[]>(
    'sale.order.line', 'read', [rawOrder.order_line],
    { fields: ['id', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal'] }
  )
  const lines: KioskOrderLine[] = rawLines.map(l => ({
    id: l.id,
    productId: l.product_id,
    productUomQty: l.product_uom_qty,
    priceUnit: l.price_unit,
    priceSubtotal: l.price_subtotal
  }))
  return { ...mapOrderHeader(rawOrder), lines }
}

export async function searchOrders(pattern: string): Promise<KioskOrder[]> {
  const domain: any[] = [['x_is_paid', '=', false]]
  if (pattern.trim()) {
    domain.push(
      '|', ['name', 'ilike', pattern],
      '|', ['partner_id.vat', 'ilike', pattern],
      ['partner_id.name', 'ilike', pattern]
    )
  }

  const raw = await odooEnv.callMethod<RawOrderHeader[]>(
    'sale.order', 'search_read',
    [domain],
    {
      fields: ['id', 'name', 'partner_id', 'amount_total', 'x_fex_id', 'order_line', 'state'],
      limit: 10,
      order: 'id desc'
    }
  )
  return raw.map(mapOrderHeader)
}

export async function returnOrder(orderId: number, reason: string): Promise<void> {
  await odooEnv.callMethod('sale.order', 'action_return_order_total', [orderId, reason, [], null])
}

export async function fetchCompanyLogo(): Promise<string> {
  const results = await odooEnv.callMethod<{ x_pos_logo: string | false }[]>(
    'res.config.settings', 'search_read',
    [[]],
    { fields: ['x_pos_logo'], limit: 1 }
  )
  return results?.[0]?.x_pos_logo || ''
}

export async function fetchAdvertisements(): Promise<AdConfig[]> {
  try {
    const config = await odooEnv.callMethod<{ ad_configs?: AdConfig[] }>(
      'x.pos.station',
      'action_get_custom_config'
    )
    return config?.ad_configs || []
  } catch (err) {
    console.error('Error fetching ads from backend:', err)
    return []
  }
}

// ─── Station & Sessions ───────────────────────────────────────────────────────

export interface KioskStation {
  id: number
  name: string
  code: string
}

export interface LinkedStation {
  id: number
  name: string
  code: string
  branchId: number
  companyId: number
  activeSessionId: number | false
  operateWithoutPrinter: boolean
  allowLocalDB: boolean
}

export async function fetchStations(): Promise<KioskStation[]> {
  return odooEnv.callMethod<KioskStation[]>(
    'x.pos.station',
    'search_read',
    [[]],
    { fields: ['id', 'name', 'code'] }
  )
}

export async function linkStation(configToken: string, appToken: string): Promise<LinkedStation> {
  const raw = await odooEnv.callMethod<Record<string, unknown>>(
    'x.pos.station',
    'action_set_config',
    [configToken, appToken]
  )
  return {
    id: raw['id'] as number,
    name: raw['name'] as string,
    code: raw['code'] as string,
    branchId: raw['branchId'] as number,
    companyId: raw['companyId'] as number,
    activeSessionId: raw['activeSessionId'] as number | false,
    operateWithoutPrinter: raw['operateWithoutPrinter'] as boolean,
    allowLocalDB: raw['allowLocalDB'] as boolean,
  }
}

export async function pingStation(stationId: number): Promise<LinkedStation> {
  const raw = await odooEnv.callMethod<Record<string, unknown>>(
    'x.pos.station',
    'action_update_config',
    [[stationId]]
  )
  return {
    id: raw['id'] as number,
    name: raw['name'] as string,
    code: raw['code'] as string,
    branchId: raw['branchId'] as number,
    companyId: raw['companyId'] as number,
    activeSessionId: raw['activeSessionId'] as number | false,
    operateWithoutPrinter: raw['operateWithoutPrinter'] as boolean,
    allowLocalDB: raw['allowLocalDB'] as boolean,
  }
}

export async function fetchActiveSession(stationId: number): Promise<{ id: number; openingDate: string } | null> {
  const sessions = await odooEnv.callMethod<any[]>(
    'x.pos.session',
    'search_read',
    [[['station_id', '=', stationId], ['state', '=', 'active']]],
    { fields: ['id', 'opening_date'], limit: 1 }
  )
  if (sessions && sessions.length > 0) {
    return { id: sessions[0].id, openingDate: sessions[0].opening_date }
  }
  return null
}

export async function openOdooSession(stationId: number, cashierId: number): Promise<number> {
  const sessionId = await odooEnv.callMethod<number>(
    'x.pos.session',
    'action_create_from_pos',
    [
      {
        cashier: cashierId,
        openingDate: new Date().toISOString(),
        station: stationId,
        version: '1.0.0'
      }
    ]
  )

  if (!sessionId) throw new Error('No se pudo aperturar la sesión en Odoo')

  // Establecer cajero activo
  await odooEnv.callMethod<boolean>(
    'x.pos.session',
    'action_set_active_cashier',
    [sessionId, cashierId, '1.0.0']
  )

  return sessionId
}

export async function closeOdooSession(sessionId: number): Promise<void> {
  await odooEnv.callMethod<boolean>(
    'x.pos.session',
    'action_close_session',
    [sessionId]
  )
}

export async function fetchCashier(uid: number, stationId: number): Promise<{ id: number; name: string } | null> {
  const result = await odooEnv.callMethod<any>(
    'x.pos.cashier',
    'action_get_cashier_by_user',
    [uid, stationId]
  )
  return result && result.cashierId ? { id: result.cashierId, name: result.name } : null
}

export async function fetchBranchState(branchId: number): Promise<string> {
  const [branch] = await odooEnv.callMethod<{ id: number; state_id: [number, string] | false }[]>(
    'res.branch', 'read', [[branchId]],
    { fields: ['id', 'state_id'] }
  )
  return branch?.state_id ? branch.state_id[1] : ''
}


