import type { KioskPaymentMethod } from '@/shared/types/types'
import { getPaymentFormFields } from '@/shared/lib/paymentUtils'

export interface PaymentAmounts {
  fields: ReturnType<typeof getPaymentFormFields>
  isForeign: boolean
  currencySymbol: string
  hasRate: boolean
  igtfBs: number
  totalWithIgtfBs: number
  igtfUSD: number | null
  totalWithIgtfUSD: number | null
  paymentAmount: number
  paymentIgtf: number
}

// Calcula los montos derivados del método de pago seleccionado y el total del
// carrito (en Bs). `method` puede venir null durante el render de guardia
// (ver usePaymentMethodGuard) antes de que PaymentForm redirija — en ese caso
// se devuelven valores neutros ya que el container no llega a usarlos.
export function usePaymentAmounts(method: KioskPaymentMethod | null, total: number, globalRate: number): PaymentAmounts {
  const hasRate = globalRate > 0

  if (!method) {
    return {
      fields: [],
      isForeign: false,
      currencySymbol: '$',
      hasRate,
      igtfBs: 0,
      totalWithIgtfBs: total,
      igtfUSD: null,
      totalWithIgtfUSD: null,
      paymentAmount: 0,
      paymentIgtf: 0
    }
  }

  const fields = getPaymentFormFields(method.paymentType)
  const isForeign = method.currencyRate !== undefined && method.currencyRate > 1
  const currencySymbol = method.currencySymbol || '$'

  // Bs siempre disponible desde el carrito
  const igtfBs = method.applyIgtf ? total * (method.igtfPercent / 100) : 0
  const totalWithIgtfBs = total + igtfBs

  // USD = Bs / tasa BCV (globalRate): es la MISMA tasa usada para construir
  // los precios del carrito y la que se le muestra al cliente en pantalla —
  // method.currencyRate es la tasa de la moneda del método de pago (otra
  // fuente distinta) y no debe usarse para esta conversión.
  const igtfUSD = hasRate ? igtfBs / globalRate : null
  const totalWithIgtfUSD = hasRate ? totalWithIgtfBs / globalRate : null

  const paymentAmount = isForeign ? (totalWithIgtfUSD ?? 0) : totalWithIgtfBs
  const paymentIgtf = isForeign ? (igtfUSD ?? 0) : igtfBs

  return { fields, isForeign, currencySymbol, hasRate, igtfBs, totalWithIgtfBs, igtfUSD, totalWithIgtfUSD, paymentAmount, paymentIgtf }
}
