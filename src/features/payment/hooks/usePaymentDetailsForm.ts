import { useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { KioskPaymentMethod } from '@/shared/types/types'
import type { SaleEvent } from '@/features/payment/machines/saleMachine'
import { isValidVenezuelanPhone } from '@/shared/lib/paymentUtils'
import type { PaymentAmounts } from './usePaymentAmounts'

interface UsePaymentDetailsFormParams {
  method: KioskPaymentMethod | null
  amounts: PaymentAmounts
  // generic-partial-payment: monto BASE (sin IGTF) en Bs confirmado por el
  // cajero para ESTA pierna, cuando el método admite cobro parcial manual
  // (transferencia — ver isPartialCapableManualMethod). `null` para el resto:
  // ese camino sigue emitiendo SUBMIT_PAYMENT sin cambios.
  legBaseBs?: number | null
  // Remanente vigente en la máquina (null = primera/única pierna). Se usa solo
  // para decidir la navegación post-cobro, igual que en useVposCheckout: la
  // transición real la decide el guard `coversRemaining` de la máquina.
  remainingAmount?: number | null
  total?: number
  send: (event: SaleEvent) => void
  navigate: NavigateFunction
  pushToast: (type: 'success' | 'error', message: string) => void
}

// Estado de los campos del formulario estándar (banco/teléfono/referencia,
// según getPaymentFormFields) y su envío hacia la state machine.
export function usePaymentDetailsForm({
  method,
  amounts,
  legBaseBs = null,
  remainingAmount = null,
  total = 0,
  send,
  navigate,
  pushToast
}: UsePaymentDetailsFormParams) {
  const [reference, setReference] = useState('')
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!method) return

    if (amounts.fields.includes('phone') && !isValidVenezuelanPhone(phone)) {
      pushToast('error', 'El número de teléfono ingresado no es válido')
      return
    }

    const payment = {
      methodId: method.id,
      reference,
      bank: bank || undefined,
      phone: phone || undefined,
      amount: amounts.paymentAmount,
      igtfAmount: amounts.paymentIgtf
    }

    // Cobro parcial manual (transferencia): emite una PIERNA (LEG_PAID) con el
    // monto base confirmado. El guard `coversRemaining` de la máquina decide
    // processing vs. selectingMethod; acá navegamos según la misma condición
    // para no desincronizar la UI de la transición real.
    if (legBaseBs !== null) {
      send({ type: 'LEG_PAID', payment, method, baseBs: legBaseBs })
      const remaining = remainingAmount ?? total
      navigate(legBaseBs >= remaining ? '/resultado' : '/pago')
      return
    }

    send({ type: 'SUBMIT_PAYMENT', payment })
    navigate('/resultado')
  }

  return { reference, setReference, bank, setBank, phone, setPhone, handleSubmit }
}
