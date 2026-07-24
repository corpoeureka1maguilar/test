import type { KioskPaymentMethod } from '@/shared/types/types'

const STR_DENIED: Record<string, string> = {
  Ñ: 'N', ñ: 'n', Á: 'A', á: 'a', É: 'E', é: 'e',
  Í: 'I', í: 'i', Ó: 'O', ó: 'o', Ú: 'U', ú: 'u'
}
const STR_DENIED_PATTERN = new RegExp(
  [...Object.keys(STR_DENIED), String.raw`[^\w\[\]/&|, ._+-]`].join('|'),
  'g'
)

export const sanitize = (command: string): string =>
  command.replace(STR_DENIED_PATTERN, (c) => STR_DENIED[c] ?? '').slice(0, 100)

const TAX_CODE_BY_RATE = [
  { rate: 0.16, code: '1' },
  { rate: 0.08, code: '2' },
  { rate: 0.31, code: '3' }
] as const

function resolvePrinterTaxCode(taxRate?: number): string {
  if (typeof taxRate === 'number') {
    const match = TAX_CODE_BY_RATE.find(({ rate }) => Math.abs(rate - taxRate) < 0.001)
    if (match) return match.code
  }
  return '1'
}

function fixNumberForAPI(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace('.', '')
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Código de tender de la tarjeta de regalo en el protocolo ServWebImpresion de
// la impresora fiscal. Confirmado a nivel de código ('15', ya en producción
// para el pago completo con gift card) — reutilizado para el/los legs de
// gift card de un pago parcial N-piernas (generic-partial-payment). Exportado
// para que el caller (saleMachine.ts) lo use al construir `tenders[]`.
export const GIFT_CARD_TENDER_CODE = '15'

/**
 * generic-partial-payment / fiscal-tender-code-mapping: una línea de tender
 * fiscal ya resuelta por el caller (saleMachine.ts), a partir de una pierna
 * de pago (`PaymentLeg.method.printerCode`) o del leg de gift card
 * (`GIFT_CARD_TENDER_CODE`, fijo). `buildFacturaPayload` NUNCA inventa un
 * código — si `code` viene vacío, debe explotar (ver más abajo).
 */
export interface Tender {
  code: string
  amountBs: number
  igtfBs: number
}

export interface FacturaPayload {
  condicion: string
  codigobarra: string
  montoigtf: string
  direccion: string
  documento: string
  nombre: string
  referencia: string
  rif: string
  caja: string
  Items: FacturaItem[]
  [key: string]: unknown
}

interface FacturaItem {
  codigo: string
  descripcion: string
  impuesto: string
  tasa: string
  cantidad: string
  precio: string
  descuentop: string
}

export interface PrintLine {
  name: string
  qty: number
  price: number
  taxRate?: number | undefined
}

export interface NotaCreditoPayload {
  ItemsNota: FacturaItem[]
  factura: string
  fecha: string
  hora: string
  maquina: string
  condicion: string
  codigobarra: string
  montoigtf: string
  direccion: string
  documento: string
  nombre: string
  referencia: string
  rif: string
  [key: string]: unknown
}

// La impresora fiscal exige referenciar la factura afectada: su n° (padded a
// 7 dígitos, igual que la reimpresión), su fecha/hora de emisión y el serial
// de la máquina que la emitió; con datos que no coincidan rechaza la nota
export function buildNotaCreditoPayload(
  invoiceNumber: string | undefined,
  fecha: string,
  hora: string,
  partnerName: string,
  partnerVat: string,
  lines: PrintLine[],
  method: KioskPaymentMethod,
  totalAmount: number,
  maquina = ''
): NotaCreditoPayload {
  let factura = invoiceNumber || ''
  if (/^\d+$/.test(factura)) factura = String(Number(factura))
  factura = factura.padStart(7, '0').slice(0, 7)

  // Notas de crédito: no hay un `printerCode` real disponible para el método
  // acá (`NO_IGTF_METHOD` en useOrderReturn.ts no conserva el método de pago
  // original de la orden — ver su propio comentario) — se mantiene el código
  // fijo histórico ('01' normal, GIFT_CARD_TENDER_CODE si method.id === -999),
  // EXENTO de la regla "nunca default de fiscal-tender-code-mapping", que
  // aplica a piernas de pago de una venta en curso, no a refunds.
  const code = method.id === -999 ? GIFT_CARD_TENDER_CODE : '01'

  // La nota de crédito no reporta la caja de origen: igual que fex, la clave
  // se elimina del payload en vez de mandarse vacía
  const { Items, caja: _caja, ...rest } = buildFacturaPayload(
    partnerName, partnerVat, lines, [{ code, amountBs: totalAmount, igtfBs: 0 }], ''
  )

  return {
    ...rest,
    montoigtf: '0',
    codigobarra: '',
    ItemsNota: Items,
    factura,
    fecha,
    hora,
    maquina
  }
}

/**
 * generic-partial-payment / fiscal-tender-code-mapping: recibe `tenders[]`
 * ya resuelto por el caller (saleMachine.ts) — una línea por pierna de pago
 * real (`printerCode`) + el/los tenders de gift card (`GIFT_CARD_TENDER_CODE`,
 * fijo). Acumula numéricamente por código (nunca sobreescribe) y recién al
 * final formatea con `fixNumberForAPI`. Si algún tender llega con `code`
 * vacío/falsy, explota — nunca inventa/asume un código.
 */
export function buildFacturaPayload(
  partnerName: string,
  partnerVat: string,
  lines: PrintLine[],
  tenders: Tender[],
  stationLabel = 'Autopago'
): FacturaPayload {
  const totalAmount = tenders.reduce((sum, t) => sum + t.amountBs, 0)
  const totalIgtf = round2(tenders.reduce((sum, t) => sum + t.igtfBs, 0))

  const accByCode = new Map<string, number>()
  for (const tender of tenders) {
    if (!tender.code) {
      throw new Error(
        'buildFacturaPayload: tender sin printerCode real — no se puede imprimir sin un código fiscal real (fiscal-tender-code-mapping, nunca se inventa un default)'
      )
    }
    accByCode.set(tender.code, round2((accByCode.get(tender.code) ?? 0) + tender.amountBs))
  }

  const items: FacturaItem[] = lines
    .filter(l => l.qty > 0)
    .map(l => ({
      codigo: '',
      descripcion: sanitize(l.name),
      impuesto: '1',
      tasa: resolvePrinterTaxCode(l.taxRate),
      cantidad: fixNumberForAPI(l.qty, 3),
      precio: fixNumberForAPI(l.price),
      descuentop: '0'
    }))

  const payload: FacturaPayload = {
    condicion: 'Pago inmediato',
    codigobarra: '',
    montoigtf: totalIgtf ? fixNumberForAPI(totalIgtf) : '0',
    direccion: sanitize(partnerName),
    documento: sanitize(partnerVat),
    nombre: sanitize(partnerName),
    referencia: sanitize('REF: ' + totalAmount.toFixed(2)),
    rif: sanitize(partnerVat),
    caja: sanitize(stationLabel),
    Items: items
  }

  for (const [code, amount] of accByCode) {
    payload['pago' + code.slice(0, 2)] = fixNumberForAPI(amount)
  }

  return payload
}
