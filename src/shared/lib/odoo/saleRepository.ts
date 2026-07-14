import { odooEnv } from '@/shared/lib/odooEnv'
import { useConfigStore } from '@/shared/stores/config'
import type { KioskOrder, KioskOrderLine } from '@/shared/types/types'
import { mapPartner, type RawPartner } from './customerRepository'

// ─── Raw Odoo shapes ──────────────────────────────────────────────────────────

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
