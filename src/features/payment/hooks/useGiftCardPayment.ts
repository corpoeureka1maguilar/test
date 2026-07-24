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
  const [consumedAmountInput, setConsumedAmountInput] = useState('')

  const orderTotalUSD = total / globalRate
  const maxConsumableUSD = foundCard ? Math.min(foundCard.balance, orderTotalUSD) : 0

  const parsedInput = Number(consumedAmountInput)
  const isValidConsumedAmount = foundCard
    ? consumedAmountInput.trim() !== '' && !Number.isNaN(parsedInput) && parsedInput > 0 && parsedInput <= maxConsumableUSD + 0.0001
    : false

  const consumedAmountUSD = isValidConsumedAmount ? Math.min(parsedInput, maxConsumableUSD) : 0
  const hasSufficientBalance = foundCard ? consumedAmountUSD >= orderTotalUSD - 0.0001 : false
  const remainingBs = foundCard ? Math.max(0, total - consumedAmountUSD * globalRate) : 0

  const handleConsumedAmountChange = (raw: string) => {
    if (!foundCard) return
    if (raw === '') {
      setConsumedAmountInput('')
      return
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    const maxAllowed = Math.min(foundCard.balance, orderTotalUSD)
    if (parsed > maxAllowed) {
      setConsumedAmountInput(String(maxAllowed))
    } else {
      setConsumedAmountInput(raw)
    }
  }

  const handleSearchCard = async () => {
    if (!giftCardCode.trim()) return
    setSearchingCard(true)
    setCardError(null)
    setFoundCard(null)
    setConsumedAmountInput('')
    try {
      const card = await searchGiftCard(giftCardCode.trim())
      if (!card) {
        setCardError('No se encontró ninguna tarjeta de regalo con ese código.')
      } else if (card.state !== 'available') {
        setCardError('Esta tarjeta de regalo no está activa o ya fue consumida.')
      } else {
        setFoundCard(card)
        const initialMax = Math.min(card.balance, orderTotalUSD)
        setConsumedAmountInput(String(initialMax))
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

    // Bloqueo duro: solo para saldo agotado o monto inválido.
    if (foundCard.balance <= 0 || !isValidConsumedAmount) {
      pushToast('error', 'El saldo de la tarjeta es insuficiente.')
      return
    }

    if (hasSufficientBalance) {
      // Pago completo: cubre el orderTotalUSD.
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
          amount: consumedAmountUSD,
          balance: foundCard.balance,
          state: 'available'
        }
      })
      navigate('/resultado')
      return
    }

    // Pago parcial (2-leg): consume el monto elegido de la tarjeta y deja el
    // remanente para que el cajero elija un segundo método en /pago.
    send({
      type: 'GIFT_CARD_PARTIAL',
      giftCard: {
        id: foundCard.id,
        code: foundCard.code,
        amount: consumedAmountUSD,
        balance: foundCard.balance,
        state: 'available'
      },
      remainingAmount: remainingBs
    })
    navigate('/pago')
  }

  const handleUseAnotherCard = () => {
    setFoundCard(null)
    setGiftCardCode('')
    setConsumedAmountInput('')
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
    consumedAmountUSD,
    consumedAmountInput,
    handleConsumedAmountChange,
    isValidConsumedAmount,
    remainingBs,
    handleSearchCard,
    handleGiftCardSubmit,
    handleUseAnotherCard
  }
}

