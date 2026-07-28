import type { KioskPaymentMethod, PaymentType } from '@/shared/types/types'

// generic-partial-payment: tope de piernas de pago por venta (gift card + N
// cobros sucesivos). La gift card cuenta como 1 pierna. v1: constante;
// mover a config store si operaciones lo pide (el state model soporta N sin
// cambios — ver design.md Open Questions).
export const MAX_PAYMENT_LEGS = 4

// generic-partial-payment: tipos de pago MANUALES (sin terminal) habilitados
// para cobros parciales. Los métodos VPOS (`withMerchant`) ya son parciales
// por definición y no necesitan estar acá. La tarjeta de regalo (id -999)
// tiene su propio flujo de parcial (GIFT_CARD_PARTIAL) y tampoco entra.
//
// Solo 'transferencia' por ahora: es el único caso operativo pedido (el
// cliente transfiere desde varios bancos y cada transferencia llega con su
// propio banco + referencia). Agregar un tipo acá lo habilita completo —
// la máquina de estados ya es genérica en N piernas.
export const PARTIAL_CAPABLE_PAYMENT_TYPES: PaymentType[] = ['transferencia']

/**
 * ¿Este método manual admite cobro parcial (monto editable hacia abajo +
 * pierna vía LEG_PAID)? Excluye VPOS y tarjeta de regalo: esos tienen su
 * propio camino de parcial.
 */
export function isPartialCapableManualMethod(method: KioskPaymentMethod | null): boolean {
  if (!method || method.withMerchant || method.id === -999) return false
  return PARTIAL_CAPABLE_PAYMENT_TYPES.includes(method.paymentType)
}
