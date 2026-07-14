import { useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { GiftCard, KioskPaymentMethod } from '@/shared/types/types'
import type { SaleEvent } from '@/features/payment/machines/saleMachine'
import { searchGiftCard } from '@/shared/lib/odooRepository'

interface UseGiftCardPaymentParams {
  method: KioskPaymentMethod | null
  total: number
  globalRate: number
  send: (event: SaleEvent) => void
  navigate: NavigateFunction
  pushToast: (type: 'success' | 'error', message: string) => void
}

// Estado y acciones del pago con Tarjeta de Regalo (method.id === -999):
// búsqueda del código contra Odoo y confirmación del consumo del saldo.
export function useGiftCardPayment({ method, total, globalRate, send, navigate, pushToast }: UseGiftCardPaymentParams) {
  const [giftCardCode, setGiftCardCode] = useState('')
  const [searchingCard, setSearchingCard] = useState(false)
  const [foundCard, setFoundCard] = useState<GiftCard | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [showKeyboard, setShowKeyboard] = useState(false)

  const orderTotalUSD = total / globalRate
  const hasSufficientBalance = foundCard ? foundCard.balance >= orderTotalUSD : false

  const handleSearchCard = async () => {
    if (!giftCardCode.trim()) return
    setSearchingCard(true)
    setCardError(null)
    setFoundCard(null)
    try {
      const card = await searchGiftCard(giftCardCode.trim())
      if (!card) {
        setCardError('No se encontró ninguna tarjeta de regalo con ese código.')
      } else if (card.state !== 'available') {
        setCardError('Esta tarjeta de regalo no está activa o ya fue consumida.')
      } else {
        setFoundCard(card)
      }
    } catch (err) {
      console.error(err)
      setCardError('Error al buscar la tarjeta de regalo en Odoo.')
    } finally {
      setSearchingCard(false)
      setShowKeyboard(false)
    }
  }

  const handleGiftCardSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!method || !foundCard) return

    const orderTotalUSD = total / globalRate
    if (foundCard.balance < orderTotalUSD) {
      pushToast('error', 'El saldo de la tarjeta es insuficiente.')
      return
    }

    send({
      type: 'SUBMIT_PAYMENT',
      payment: {
        methodId: method.id,
        reference: foundCard.code,
        amount: total,
        igtfAmount: 0
      },
      giftCard: {
        id: foundCard.id,
        code: foundCard.code,
        amount: orderTotalUSD,
        balance: foundCard.balance,
        state: 'available'
      }
    })
    navigate('/resultado')
  }

  const handleUseAnotherCard = () => {
    setFoundCard(null)
    setGiftCardCode('')
  }

  return {
    giftCardCode,
    setGiftCardCode,
    searchingCard,
    foundCard,
    cardError,
    showKeyboard,
    setShowKeyboard,
    orderTotalUSD,
    hasSufficientBalance,
    handleSearchCard,
    handleGiftCardSubmit,
    handleUseAnotherCard
  }
}
