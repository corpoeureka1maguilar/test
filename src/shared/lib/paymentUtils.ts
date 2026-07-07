import type { PaymentType, KioskPaymentMethod } from '@/shared/types/types'

export const paymentTypeLabels: Record<PaymentType, string> = {
  cash: 'Efectivo',
  pago_movil: 'Pago móvil',
  card: 'Tarjeta',
  transferencia: 'Transferencia',
  zelle: 'Zelle',
  crypto: 'Criptomoneda',
  otro: 'Otros',
  biopago: 'Biopago',
  banplus: 'Banplus'
} as const

export const paymentTypeLabelsByCode: Record<string, string> = {
  '1': 'EFECTIVO',
  '2': 'DOLARES',
  '3': 'ZELLE',
  '4': 'BANPA',
  '5': 'TRANSFERENCIA',
  '6': 'PAGO MOVIL',
  '7': 'BIOPAGO',
  '8': 'MERCHANT',
  '9': 'DEBITO OTROS',
  '10': 'TDC',
  '11': 'CREDITO',
  '12': 'TRANSITO',
  '13': 'RETENCION',
  '14': 'DEVOLUCION',
  '16': 'TARJETA 1',
  '17': 'TARJETA 2',
  '18': 'TARJETA 3',
  '20': 'EFECTIVO DOLAR',
  '21': 'CREDIAGRO',
  CAMBIO: 'CAMBIO'
} as const

import { ves, toFloat, mulVES } from './money'

export function calcIgtf(method: KioskPaymentMethod, baseAmount: number): number {
  if (!method.applyIgtf || !method.igtfPercent) return 0
  const base = ves(baseAmount)
  const igtf = mulVES(base, method.igtfPercent / 100)
  return toFloat(igtf)
}

export function getPaymentLabel(paymentType: PaymentType): string {
  return paymentTypeLabels[paymentType] ?? paymentType
}

/** Fields shown in the payment form for each payment type */
export function getPaymentFormFields(paymentType: PaymentType): ('reference' | 'bank' | 'phone')[] {
  switch (paymentType) {
    case 'pago_movil':
      return ['bank', 'phone', 'reference']
    case 'transferencia':
      return ['bank', 'reference']
    case 'zelle':
    case 'biopago':
    case 'banplus':
      return ['reference']
    case 'card':
      return ['reference']
    case 'crypto':
      return ['reference']
    case 'cash':
    case 'otro':
    default:
      return []
  }
}

export function isValidVenezuelanPhone(phone: string): boolean {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) {
    const clean = trimmed.replace(/\D/g, '')
    return clean.length >= 7 && clean.length <= 15
  }
  const clean = trimmed.replace(/\D/g, '')
  let digits = clean
  if (digits.startsWith('58') && digits.length === 12) {
    digits = digits.slice(2)
  }
  if (digits.length === 10 && (digits.startsWith('4') || digits.startsWith('2'))) {
    digits = '0' + digits
  }
  return /^(0412|0414|0424|0416|0426|0422|02\d{2})\d{7}$/.test(digits)
}

/** Formatea dinámicamente un número de teléfono de Venezuela en formato XXXX-XXXX-XXX */
export function formatPhone(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('+')) {
    return trimmed
  }
  const clean = trimmed.replace(/\D/g, '')
  if (clean.length === 0) return ''
  if (clean.length <= 4) {
    return clean
  } else if (clean.length <= 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`
  } else {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 11)}`
  }
}

/** Compara un código de barras escaneado con los códigos de barras del producto (soporta múltiples códigos separados por espacios/comas/comas/barras) */
export function matchBarcode(productBarcode: string | undefined, query: string): boolean {
  if (!productBarcode) return false
  const q = query.trim().toLowerCase()
  if (!q) return false
  const barcodes = productBarcode.split(/[\s,|;]+/).map(b => b.trim().toLowerCase()).filter(Boolean)
  return barcodes.includes(q)
}

/** Compara de forma parcial un código de barras escaneado con los del producto */
export function matchBarcodeIncludes(productBarcode: string | undefined, query: string): boolean {
  if (!productBarcode) return false
  const q = query.trim().toLowerCase()
  if (!q) return false
  const barcodes = productBarcode.split(/[\s,|;]+/).map(b => b.trim().toLowerCase()).filter(Boolean)
  return barcodes.some(b => b.includes(q))
}
