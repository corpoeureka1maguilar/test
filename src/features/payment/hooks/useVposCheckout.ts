import { useEffect, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { KioskPaymentMethod } from '@/shared/types/types'
import type { SaleContext, SaleEvent } from '@/features/payment/machines/saleMachine'

const VPOS_BASE_URL = 'http://localhost:8085/vpos/'
const VPOS_RESPONSE_TIMEOUT_MS = 60_000

interface UseVposCheckoutParams {
  method: KioskPaymentMethod | null
  context: SaleContext
  totalWithIgtfBs: number
  paymentAmount: number
  paymentIgtf: number
  // generic-partial-payment (3.2): monto BASE (sin IGTF) confirmado por el
  // cajero para esta pierna VPOS — autoritativo para PaymentLeg.baseBs, nunca
  // se infiere ciegamente de remainingAmount/totalWithIgtfBs. Alimentado por
  // VposAmountInput (Fase 3.3/3.4, todavía no wireado — ver PaymentForm.tsx).
  confirmedBaseBs: number
  // generic-partial-payment (3.4): gatea el ping/iframe del terminal VPOS —
  // no debe arrancar hasta que el cajero confirme el monto de la pierna en
  // VposAmountInput (Fase 3.3/3.4). Default `true` es retrocompatible: cualquier
  // caller/test que no pase este param explícitamente preserva el ping
  // inmediato de Work Unit 3.
  confirmed?: boolean
  send: (event: SaleEvent) => void
  navigate: NavigateFunction
  pushToast: (type: 'success' | 'error', message: string) => void
}

interface UseVposCheckoutResult {
  vposStatus: 'checking' | 'waiting'
  iframeUrl: string
}

// Maneja el checkout con terminal VPOS (mock): pinguea el terminal, muestra
// el iframe del checkout cuando responde, escucha el postMessage con el
// resultado de la transacción y cae a /pago si el terminal no responde a
// tiempo o está inalcanzable.
export function useVposCheckout({
  method,
  context,
  totalWithIgtfBs,
  paymentAmount,
  paymentIgtf,
  confirmedBaseBs,
  confirmed = true,
  send,
  navigate,
  pushToast
}: UseVposCheckoutParams): UseVposCheckoutResult {
  const [vposStatus, setVposStatus] = useState<'checking' | 'waiting'>('checking')

  useEffect(() => {
    // generic-partial-payment (3.4): sin confirmación del monto de la
    // pierna (VposAmountInput todavía no confirmó) no se pinguea el
    // terminal — evita cobrar/mostrar el iframe con un monto que el cajero
    // aún puede editar hacia abajo.
    if (!method?.withMerchant || !confirmed) return

    // Patrón estándar de data fetching en efecto: resetea el status antes de
    // arrancar el ping al terminal VPOS (fetch real, con cleanup por abajo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVposStatus('checking')
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const handleIframeMessage = (e: MessageEvent) => {
      try {
        if (typeof e.data === 'string') {
          const data = JSON.parse(e.data)
          if (data.codRespuesta === '00') {
            clearTimeout(timeoutId)
            pushToast('success', 'Pago procesado exitosamente por VPOS')
            // generic-partial-payment / payment-flow: SIEMPRE VPOS_LEG_PAID,
            // nunca SUBMIT_PAYMENT (ese evento queda reservado para el path
            // legacy no-VPOS/full-gift-card — ver saleMachine.ts 0.1). El
            // guard `coversRemaining` de la máquina decide processing vs.
            // selectingMethod; acá solo navegamos según la misma condición
            // para no desincronizar la UI de la transición real de la máquina.
            send({
              type: 'VPOS_LEG_PAID',
              payment: {
                methodId: method.id,
                reference: data.numeroReferencia || data.numSeq || 'MOCK-VPOS',
                amount: paymentAmount,
                igtfAmount: paymentIgtf
              },
              method,
              baseBs: confirmedBaseBs
            })
            const remaining = context.remainingAmount ?? totalWithIgtfBs
            navigate(confirmedBaseBs >= remaining ? '/resultado' : '/pago')
          } else {
            clearTimeout(timeoutId)
            pushToast('error', `VPOS Rechazado: ${data.mensajeRespuesta || 'Error en transacción'}`)
          }
        }
      } catch (err) {
        // Ignore non-JSON messages
      }
    }

    window.addEventListener('message', handleIframeMessage)

    fetch(`${VPOS_BASE_URL}ping`)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) throw new Error('Ping VPOS falló')

        setVposStatus('waiting')
        timeoutId = setTimeout(() => {
          pushToast('error', 'El terminal VPOS no respondió a tiempo. Intente nuevamente.')
          send({ type: 'BACK' })
          navigate('/pago')
        }, VPOS_RESPONSE_TIMEOUT_MS)
      })
      .catch(() => {
        if (cancelled) return
        pushToast('error', 'No se pudo conectar con el terminal VPOS.')
        send({ type: 'BACK' })
        navigate('/pago')
      })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      window.removeEventListener('message', handleIframeMessage)
    }
  }, [method, paymentAmount, paymentIgtf, confirmedBaseBs, confirmed, context.remainingAmount, totalWithIgtfBs, send, navigate, pushToast])

  const docNumber = context.customer?.cedula || context.pendingVat || ''
  const iframeUrl = `${VPOS_BASE_URL}checkout?amount=${totalWithIgtfBs}&cedula=${docNumber}`

  return { vposStatus, iframeUrl }
}
