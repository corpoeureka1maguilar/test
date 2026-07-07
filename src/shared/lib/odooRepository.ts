import { odooEnv } from '@/shared/lib/odooEnv'
import { useConfigStore } from '@/shared/stores/config'
import type { KioskPartner, KioskPaymentMethod, KioskProduct, KioskOrder, KioskOrderLine, AdConfig, GiftCard } from '@/shared/types/types'

// ─── Raw Odoo shapes ──────────────────────────────────────────────────────────

interface RawPartner {
  id: number
  name: string
  cedula: string
  phone: string | false
  street: string | false
  email: string | false
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

interface RawBarcodeMulti {
  product_id: [number, string]
  name: string
}

interface RawOrderHeader {
  id: number
  name: string
  partner_id: [number, string]
  amount_total: number
  x_fex_id: string
  order_line: number[]
  state: string
  x_printer_number: string | false
  x_printer_serial_number: string | false
  x_printer_date: string | false
  manual_rate: number | false
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
  return { id: r.id, name: r.name, cedula: r.cedula, phone: r.phone || undefined, street: r.street || undefined, email: r.email || undefined }
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

function mapProduct(r: RawProduct, taxRateMap: Map<number, number>, secondaryBarcodesMap: Map<number, string>): KioskProduct {
  const firstTaxId = r.taxes_id?.[0]
  const taxRate = firstTaxId != null ? (taxRateMap.get(firstTaxId) ?? 0.16) : 0.16
  // Los códigos secundarios (product.barcode.multi) se anexan al barcode principal
  // separados por coma; matchBarcode/matchBarcodeIncludes ya soportan ese formato
  const barcode = [r.barcode || undefined, secondaryBarcodesMap.get(r.id)].filter(Boolean).join(',')
  const giftCardProductId = useConfigStore.getState().giftCardProductId
  return {
    id: r.id,
    name: r.name,
    defaultCode: r.default_code || '',
    barcode: barcode || undefined,
    price: r.list_price,
    priceUsd: r.list_price,
    taxRate,
    categId: r.categ_id[0],
    categName: r.categ_id[1],
    uomName: r.uom_id[1],
    isGiftCard: r.id === giftCardProductId
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
    state: r.state,
    printerNumber: r.x_printer_number || undefined,
    printerSerial: r.x_printer_serial_number || undefined,
    printerDate: r.x_printer_date || undefined,
    rate: r.manual_rate || undefined
  }
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

const PRODUCT_FIELDS = ['id', 'name', 'default_code', 'barcode', 'list_price', 'taxes_id', 'categ_id', 'uom_id']

// Sin catch: quien la llama decide qué hacer con el fallo (no todo fallo debe
// pisar la última tasa buena conocida — ver fetchProducts más abajo)
export async function fetchExchangeRate(): Promise<number> {
  return odooEnv.callMethod<number>('res.currency', 'action_get_rate')
}

export async function fetchProducts(fixedProductIds: number[] = [], pricelistId = 0): Promise<KioskProduct[]> {
  let rateFetchFailed = false
  const [raw, rate] = await Promise.all([
    odooEnv.callMethod<RawProduct[]>(
      'product.product', 'search_read',
      [[['sale_ok', '=', true], ['active', '=', true], ['invoice_policy', '=', 'order']]],
      { fields: PRODUCT_FIELDS, limit: 200 }
    ),
    fetchExchangeRate().catch((err) => {
      console.error('[fetchProducts] Error fetching currency rate:', err)
      rateFetchFailed = true
      return 1
    })
  ])

  // Los productos fijos de la sucursal deben estar siempre disponibles,
  // aunque el dominio o el límite del catálogo los haya dejado fuera
  const missingFixedIds = fixedProductIds.filter(id => !raw.some(r => r.id === id))
  if (missingFixedIds.length > 0) {
    try {
      const fixedRaw = await odooEnv.callMethod<RawProduct[]>(
        'product.product', 'search_read',
        [[['id', 'in', missingFixedIds]]],
        { fields: PRODUCT_FIELDS }
      )
      raw.push(...fixedRaw)
    } catch (err) {
      console.error('[fetchProducts] Error fetching branch fixed products:', err)
    }
  }

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

  // Códigos de barra secundarios (módulo product_multiple_barcodes); un producto
  // sin código secundario simplemente no aparece en el resultado, de ahí el Map
  const secondaryBarcodesMap = new Map<number, string>()
  try {
    const barcodesMulti = await odooEnv.callMethod<RawBarcodeMulti[]>(
      'product.barcode.multi', 'search_read',
      [[['product_id', 'in', raw.map(r => r.id)]]],
      { fields: ['product_id', 'name'] }
    )
    for (const b of barcodesMulti) {
      const productId = b.product_id[0]
      const existing = secondaryBarcodesMap.get(productId)
      secondaryBarcodesMap.set(productId, existing ? `${existing},${b.name}` : b.name)
    }
  } catch (err) {
    console.error('[fetchProducts] Error fetching secondary barcodes:', err)
  }

  // Persistir la tasa globalmente (para otras pantallas como /advanced), pero
  // solo si el fetch fue exitoso: nunca pisar la última tasa buena conocida
  // con el fallback de 1 usado solo para no romper el cálculo de precios acá
  if (!rateFetchFailed) {
    const { useExchangeRateStore } = await import('@/shared/stores/exchangeRate')
    useExchangeRateStore.getState().setRate(rate)
  }

  // Si la sucursal tiene una pricelist por defecto, sus reglas priman sobre
  // list_price; un fallo acá no bloquea el catálogo, solo deja list_price
  const pricelistPriceMap = new Map<number, number>()
  if (pricelistId && raw.length > 0) {
    try {
      const prices = await odooEnv.callMethod<Record<string, number>>(
        'product.product', 'action_get_prices_by_pricelist',
        [raw.map(r => r.id), pricelistId]
      )
      for (const [id, price] of Object.entries(prices)) {
        pricelistPriceMap.set(Number(id), price)
      }
    } catch (err) {
      console.error('[fetchProducts] Error fetching pricelist prices:', err)
    }
  }

  return raw.map(r => {
    const p = mapProduct(r, taxRateMap, secondaryBarcodesMap)
    const basePriceUsd = pricelistPriceMap.get(r.id) ?? p.price
    p.priceUsd = basePriceUsd
    // Cualquier tasa positiva es válida (una tasa legítima puede ser ≤ 1);
    // solo se omite el 0/negativo que indicaría un dato corrupto del backend
    p.price = rate > 0 ? basePriceUsd * rate : basePriceUsd
    return p
  })
}

// ─── Sale orders ──────────────────────────────────────────────────────────────

export async function createSaleOrder(payload: unknown): Promise<unknown> {
  return odooEnv.callMethod('sale.order', 'action_create_sale_order_from_pos', [payload])
}

// La tasa de IVA por línea sale del producto (misma fuente que usa el backend
// al armar la factura rectificativa); sin ella la nota de crédito saldría con
// IVA general para productos de tasa reducida. Un fallo acá no bloquea la
// devolución: la línea queda sin taxRate y la impresora asume la general.
async function fetchLineTaxRates(rawLines: RawOrderLine[]): Promise<Map<number, number>> {
  const taxRateByProduct = new Map<number, number>()
  try {
    const productIds = [...new Set(rawLines.map(l => l.product_id[0]))]
    if (!productIds.length) return taxRateByProduct

    const products = await odooEnv.callMethod<{ id: number; taxes_id: number[] }[]>(
      'product.product', 'read', [productIds], { fields: ['id', 'taxes_id'] }
    )
    const taxIds = [...new Set(products.flatMap(p => p.taxes_id ?? []))]
    if (!taxIds.length) return taxRateByProduct

    const taxes = await odooEnv.callMethod<{ id: number; amount: number }[]>(
      'account.tax', 'search_read',
      [[['id', 'in', taxIds]]],
      { fields: ['id', 'amount'] }
    )
    const amountById = new Map(taxes.map(t => [t.id, t.amount / 100]))
    for (const p of products) {
      const firstTaxId = p.taxes_id?.[0]
      const rate = firstTaxId != null ? amountById.get(firstTaxId) : undefined
      if (rate != null) taxRateByProduct.set(p.id, rate)
    }
  } catch (err) {
    console.error('[fetchOrder] Error fetching line tax rates:', err)
  }
  return taxRateByProduct
}

export async function fetchOrder(id: number): Promise<KioskOrder> {
  const [rawOrder] = await odooEnv.callMethod<RawOrderHeader[]>(
    'sale.order', 'read', [[id]],
    { fields: ['id', 'name', 'partner_id', 'amount_total', 'x_fex_id', 'order_line', 'state', 'x_printer_number', 'x_printer_serial_number', 'x_printer_date', 'manual_rate'] }
  )
  const [rawLines, [rawPartner]] = await Promise.all([
    odooEnv.callMethod<RawOrderLine[]>(
      'sale.order.line', 'read', [rawOrder.order_line],
      { fields: ['id', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal'] }
    ),
    odooEnv.callMethod<RawPartner[]>(
      'res.partner', 'read', [[rawOrder.partner_id[0]]],
      { fields: ['id', 'name', 'cedula', 'phone', 'street'] }
    )
  ])
  const taxRateByProduct = await fetchLineTaxRates(rawLines)
  const lines: KioskOrderLine[] = rawLines.map(l => ({
    id: l.id,
    productId: l.product_id,
    productUomQty: l.product_uom_qty,
    priceUnit: l.price_unit,
    priceSubtotal: l.price_subtotal,
    taxRate: taxRateByProduct.get(l.product_id[0])
  }))
  return { ...mapOrderHeader(rawOrder), lines, partner: mapPartner(rawPartner) }
}

export async function searchOrders(pattern: string): Promise<KioskOrder[]> {
  const domain: unknown[] = [['x_is_paid', '=', false]]

  // Reimpresión y devolución solo operan sobre las órdenes emitidas por esta
  // estación: sin el filtro, el kiosco muestra (y permite tocar) ventas ajenas
  const { stationId } = useConfigStore.getState()
  if (stationId) {
    domain.push(['x_station_id', '=', stationId])
  }

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
      fields: ['id', 'name', 'partner_id', 'amount_total', 'x_fex_id', 'order_line', 'state', 'x_printer_number', 'x_printer_serial_number', 'x_printer_date', 'manual_rate'],
      limit: 10,
      order: 'id desc'
    }
  )
  return raw.map(mapOrderHeader)
}

// El backend exige las líneas con producto/cantidad/precio: con una lista
// vacía, action_create_invoice_return lanza UserError y, como el retorno corre
// en un job diferido (with_delay), el fallo sería invisible para el kiosco
export async function returnOrder(order: KioskOrder, reason: string, sessionId: number | null): Promise<void> {
  const lines = (order.lines ?? []).map((l) => ({
    product: l.productId[0],
    quantity: l.productUomQty,
    priceUnit: l.priceUnit
  }))

  if (!lines.length) {
    throw new Error('La orden no tiene líneas para devolver. Esperá a que cargue el detalle e intentá de nuevo.')
  }

  await odooEnv.callMethod('sale.order', 'action_return_order_total', [order.id, reason, lines, sessionId])
}

// Registra en Odoo el n° de la nota de crédito emitida por la impresora
// (nro_control y factura/serial afectados en la rectificativa); sin esto los
// libros fiscales quedan sin el vínculo entre la devolución y su nota
export async function setRefundCodeToInvoices(orderId: number, code: string, serial: string): Promise<void> {
  await odooEnv.callMethod('sale.order', 'action_set_refund_code_to_invoices', [orderId, code, serial, false])
}

// Registra en la orden el número fiscal devuelto por la impresora tras la
// venta (x_printer_number); sin esto la orden no se puede reimprimir después
export async function setOrderPrinterData(orderId: number, code: string, date: string, serial: string): Promise<void> {
  await odooEnv.callMethod('sale.order', 'action_set_printer_data', [orderId, code, date, serial])
}

// ─── Validación de administrador del kiosco ───────────────────────────────────

// xml ids de x.pos.audit.operation: las tres primeras son propias del
// autoservicio (data de eu_autopay_bridge); las demás se comparten con el POS
// para que el permiso se configure una sola vez por cajero
export const KIOSK_OPERATIONS = {
  advancedAccess: 'eu_autopay_bridge.x_pos_audit_autoservicio_advanced_access',
  openSession: 'eu_autopay_bridge.x_pos_audit_autoservicio_open_session',
  terminalConfig: 'eu_autopay_bridge.x_pos_audit_autoservicio_terminal_config',
  continueWithoutInvoice: 'eu_autopay_bridge.x_pos_audit_autoservicio_continue_without_invoice',
  saleReturn: 'eu_pos_permission_levels.x_pos_audit_sale_return',
  invoiceReprint: 'eu_pos_permission_levels.x_pos_audit_invoice_reprint',
  shiftClose: 'eu_pos_permission_levels.x_pos_audit_midday_close',
  sessionClose: 'eu_pos_permission_levels.x_pos_audit_session_close'
} as const

export type KioskOperationRef = (typeof KIOSK_OPERATIONS)[keyof typeof KIOSK_OPERATIONS]

export interface KioskAdminCheck {
  ok: boolean
  approverCashierId?: number
  approverName?: string
  error?: 'operation_not_found' | 'admin_not_found' | 'no_allowed'
}

export async function checkKioskAdmin(
  password: string,
  operationRef: KioskOperationRef,
  branchId: number,
  sessionId: number | null = null,
  message = ''
): Promise<KioskAdminCheck> {
  return odooEnv.callMethod<KioskAdminCheck>(
    'x.pos.cashier', 'action_check_kiosk_admin',
    [password, operationRef, branchId, sessionId, message]
  )
}

export async function fetchCompanyLogo(): Promise<string> {
  const results = await odooEnv.callMethod<{ x_fex_image: string | false }[]>(
    'res.branch', 'search_read',
    [[]],
    { fields: ['x_fex_image'], limit: 1 }
  )
  return results?.[0]?.x_fex_image || ''
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
  const sessions = await odooEnv.callMethod<{ id: number; opening_date: string }[]>(
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
  const result = await odooEnv.callMethod<{ cashierId: number | false; name: string } | false>(
    'x.pos.cashier',
    'action_get_cashier_by_user',
    [uid, stationId]
  )
  return result && result.cashierId ? { id: result.cashierId, name: result.name } : null
}

export async function fetchBranchState(): Promise<string> {
  // const [branch] = await odooEnv.callMethod<{ id: number; state_id: [number, string] | false }[]>(
  //   'res.branch', 'read', [[branchId]],
  //   { fields: ['id', 'state_id'] }
  // )
  // return branch?.state_id ? branch.state_id[1] : ''
  return ''
}

export async function fetchBranchFixedProducts(branchId: number): Promise<number[]> {
  const [branch] = await odooEnv.callMethod<{ id: number; x_autopay_fixed_product_ids: number[] | false }[]>(
    'res.branch', 'read', [[branchId]],
    { fields: ['id', 'x_autopay_fixed_product_ids'] }
  )
  return branch?.x_autopay_fixed_product_ids || []
}

export async function fetchBranchDefaultPricelist(branchId: number): Promise<number> {
  const [branch] = await odooEnv.callMethod<{ id: number; x_fex_default_pricelist_id: [number, string] | false }[]>(
    'res.branch', 'read', [[branchId]],
    { fields: ['id', 'x_fex_default_pricelist_id'] }
  )
  return branch?.x_fex_default_pricelist_id ? branch.x_fex_default_pricelist_id[0] : 0
}

export interface OdooState {
  id: number
  name: string
  code: string
}

export async function fetchStates(): Promise<OdooState[]> {
  const raw = await odooEnv.callMethod<any[]>(
    'res.country.state', 'search_read',
    [[['country_id.code', '=', 'VE']]],
    { fields: ['id', 'name', 'code'] }
  )
  return raw.map(r => ({
    id: r.id,
    name: r.name,
    code: r.code
  }))
}

// ─── Métricas del kiosco ───────────────────────────────────────────────────────

// Envía el snapshot acumulado de métricas (ver shared/lib/metrics.ts) a Odoo,
// donde se guarda como jsonb (upsert por estación, ver x.pos.kiosk.metric)
export async function syncMetrics(stationId: number, branchId: number, metadata: unknown): Promise<void> {
  await odooEnv.callMethod(
    'x.pos.kiosk.metric', 'action_report_metrics',
    [stationId, metadata, branchId || null]
  )
}

// ─── Gift Cards ──────────────────────────────────────────────────────────────

export async function searchGiftCard(code: string): Promise<GiftCard | null> {
  const result = await odooEnv.callMethod<GiftCard | null>(
    'x.pos.gift.card',
    'action_search_gift_card',
    [code]
  )
  return result
}

export interface AssignCardFromSaleInput {
  amount: number
  partner_id: number
  code: string
}

export async function assignCardFromSale(data: AssignCardFromSaleInput): Promise<GiftCard> {
  return odooEnv.callMethod<GiftCard>(
    'x.pos.gift.card',
    'action_assign_card_from_sale',
    [data]
  )
}


