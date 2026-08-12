import { useEffect, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { KioskPaymentMethod } from '@/shared/types/types'
import type { SaleContext, SaleEvent } from '@/features/payment/machines/saleMachine'

const VPOS_BASE_URL = 'http://localhost:8085/vpos/'
const VPOS_RESPONSE_TIMEOUT_MS = 60_000

export const fixNumberForAPI = (amount: number, decimals: number = 2): string =>
  amount.toFixed(decimals).replace('.', '')

interface UseVposCheckoutParams {
  method: KioskPaymentMethod | null
  context: SaleContext
  totalWithIgtfBs: number
  paymentAmount: number
  paymentIgtf: number
  // generic-partial-payment (3.2): monto BASE (sin IGTF) confirmado por el
  // cajero para esta pierna VPOS — autoritativo para PaymentLeg.baseBs, nunca
  // se infiere ciegamente de remainingAmount/totalWithIgtfBs. Alimentado por
  // LegAmountInput (Fase 3.3/3.4, todavía no wireado — ver PaymentForm.tsx).
  confirmedBaseBs: number
  // generic-partial-payment (3.4): gatea el ping/iframe del terminal VPOS —
  // no debe arrancar hasta que el cajero confirme el monto de la pierna en
  // LegAmountInput (Fase 3.3/3.4). Default `true` es retrocompatible: cualquier
  // caller/test que no pase este param explícitamente preserva el ping
  // inmediato de Work Unit 3.
  confirmed?: boolean
  // Total de la venta (carrito con IVA, en Bs): remanente inicial cuando
  // todavía no hay ninguna pierna. Sin él, la navegación comparaba el monto
  // de la pierna contra sí mismo y siempre iba a /resultado, desincronizándose
  // del guard `coversRemaining` de la máquina (que loopea).
  saleTotalBs: number
  send: (event: SaleEvent) => void
  navigate: NavigateFunction
  pushToast: (type: 'success' | 'error', message: string) => void
}

interface UseVposCheckoutResult {
  vposStatus: 'checking' | 'waiting'
}

// Maneja el cobro con terminal VPOS (Merchant): pinguea el terminal, envía la
// petición POST a /vpos/metodo (o /vpos/metodo_cashea) para iniciar la transacción
// en el punto de venta físico, y procesa la respuesta.
export function useVposCheckout({
  method,
  context,
  totalWithIgtfBs,
  paymentAmount,
  paymentIgtf,
  confirmedBaseBs,
  confirmed = true,
  saleTotalBs,
  send,
  navigate,
  pushToast
}: UseVposCheckoutParams): UseVposCheckoutResult {
  const [vposStatus, setVposStatus] = useState<'checking' | 'waiting'>('checking')

  useEffect(() => {
    // generic-partial-payment (3.4): sin confirmación del monto de la
    // pierna (LegAmountInput todavía no confirmó) no se pinguea el
    // terminal — evita cobrar con un monto que el cajero aún puede editar.
    if (!method?.withMerchant || !confirmed) return

    setVposStatus('checking')
    let cancelled = false
    let handled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const abortController = new AbortController()

    const processResponse = (data: any) => {
      if (handled || cancelled) return
      handled = true
      clearTimeout(timeoutId)

      if (data.codRespuesta === '00' || data.codRespuesta === 0 || data.codRespuesta === '0') {
        pushToast('success', 'Pago procesado exitosamente por VPOS')
        send({
          type: 'LEG_PAID',
          payment: {
            methodId: method.id,
            reference: String(data.numeroReferencia || data.numSeq || 'MOCK-VPOS'),
            amount: paymentAmount,
            igtfAmount: paymentIgtf
          },
          method,
          baseBs: confirmedBaseBs
        })
        const remaining = context.remainingAmount ?? saleTotalBs
        navigate(confirmedBaseBs >= remaining - 0.01 ? '/resultado' : '/pago')
      } else {
        pushToast('error', `VPOS Rechazado: ${data.mensajeRespuesta || 'Error en transacción'}`)
        send({ type: 'BACK' })
        navigate('/pago')
      }
    }

    const handleIframeMessage = (e: MessageEvent) => {
      try {
        if (typeof e.data === 'string') {
          const data = JSON.parse(e.data)
          processResponse(data)
        } else if (typeof e.data === 'object' && e.data !== null) {
          processResponse(e.data)
        }
      } catch (err) {
        // Ignore non-JSON messages
      }
    }

    window.addEventListener('message', handleIframeMessage)

    fetch(`${VPOS_BASE_URL}ping`, { signal: abortController.signal })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) throw new Error('Ping VPOS falló')

        setVposStatus('waiting')

        timeoutId = setTimeout(() => {
          if (!handled && !cancelled) {
            handled = true
            pushToast('error', 'El terminal VPOS no respondió a tiempo. Intente nuevamente.')
            send({ type: 'BACK' })
            navigate('/pago')
          }
        }, VPOS_RESPONSE_TIMEOUT_MS)

        // Petición POST directa a /vpos/metodo (o /vpos/metodo_cashea)
        const docNumber = context.customer?.cedula || context.pendingVat || ''
        const isCashea = (method.paymentType as string) === 'cashea' || method.name?.toLowerCase().includes('cashea')
        const endpoint = isCashea ? `${VPOS_BASE_URL}metodo_cashea` : `${VPOS_BASE_URL}metodo`

        const body = {
          accion: isCashea ? 'creacionCashea' : 'tarjeta',
          cedula: docNumber,
          montoTransaccion: fixNumberForAPI(totalWithIgtfBs)
        }

        try {
          const postRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(body),
            signal: abortController.signal
          })

          if (cancelled || handled) return
          if (postRes.ok && typeof postRes.json === 'function') {
            const data = await postRes.json()
            if (data && !cancelled && !handled) {
              processResponse(data)
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || cancelled || handled) return
          console.error('[useVposCheckout] Error enviando petición a merchant:', err)
        }
      })
      .catch((err) => {
        if (cancelled || handled || err.name === 'AbortError') return
        handled = true
        pushToast('error', 'No se pudo conectar con el terminal VPOS.')
        send({ type: 'BACK' })
        navigate('/pago')
      })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      abortController.abort()
      window.removeEventListener('message', handleIframeMessage)
    }
  }, [method, paymentAmount, paymentIgtf, confirmedBaseBs, confirmed, context.remainingAmount, saleTotalBs, send, navigate, pushToast])

  return { vposStatus }
}
