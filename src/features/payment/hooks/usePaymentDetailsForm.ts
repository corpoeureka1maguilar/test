import { useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { KioskPaymentMethod } from '@/shared/types/types'
import type { SaleEvent } from '@/features/payment/machines/saleMachine'
import { isValidVenezuelanPhone } from '@/shared/lib/paymentUtils'
import type { PaymentAmounts } from './usePaymentAmounts'

interface UsePaymentDetailsFormParams {
  method: KioskPaymentMethod | null
  amounts: PaymentAmounts
  send: (event: SaleEvent) => void
  navigate: NavigateFunction
  pushToast: (type: 'success' | 'error', message: string) => void
}

// Estado de los campos del formulario estándar (banco/teléfono/referencia,
// según getPaymentFormFields) y su envío hacia la state machine.
export function usePaymentDetailsForm({ method, amounts, send, navigate, pushToast }: UsePaymentDetailsFormParams) {
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

    send({
      type: 'SUBMIT_PAYMENT',
      payment: {
        methodId: method.id,
        reference,
        bank: bank || undefined,
        phone: phone || undefined,
        amount: amounts.paymentAmount,
        igtfAmount: amounts.paymentIgtf
      }
    })
    navigate('/resultado')
  }

  return { reference, setReference, bank, setBank, phone, setPhone, handleSubmit }
}
