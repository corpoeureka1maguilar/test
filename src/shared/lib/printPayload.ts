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
      tasa: resolvePrinterTaxCode(0.16),
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
