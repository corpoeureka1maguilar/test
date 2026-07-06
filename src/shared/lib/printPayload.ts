import type { KioskPaymentMethod } from '@/shared/types/types'
import { calcIgtf } from './paymentUtils'

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
  taxRate?: number
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

  // La nota de crédito no reporta la caja de origen: igual que fex, la clave
  // se elimina del payload en vez de mandarse vacía
  const { Items, caja: _caja, ...rest } = buildFacturaPayload(partnerName, partnerVat, lines, method, totalAmount, '')

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

export function buildFacturaPayload(
  partnerName: string,
  partnerVat: string,
  lines: PrintLine[],
  method: KioskPaymentMethod,
  totalAmount: number,
  stationLabel = 'Autopago'
): FacturaPayload {
  const igtfAmount = calcIgtf(method, totalAmount)
  const codeCreator = (code: string) => 'pago' + code.slice(0, 2)
  const methodCode = codeCreator('01')

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
    montoigtf: igtfAmount ? fixNumberForAPI(igtfAmount) : '0',
    direccion: sanitize(partnerName),
    documento: sanitize(partnerVat),
    nombre: sanitize(partnerName),
    referencia: sanitize('REF: ' + totalAmount.toFixed(2)),
    rif: sanitize(partnerVat),
    caja: sanitize(stationLabel),
    Items: items
  }

  payload[methodCode] = fixNumberForAPI(totalAmount)

  return payload
}
