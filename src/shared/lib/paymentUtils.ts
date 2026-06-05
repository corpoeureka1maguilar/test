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

export function calcIgtf(method: KioskPaymentMethod, baseAmount: number): number {
  if (!method.applyIgtf || !method.igtfPercent) return 0
  return Math.round(baseAmount * (method.igtfPercent / 100) * 100) / 100
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
