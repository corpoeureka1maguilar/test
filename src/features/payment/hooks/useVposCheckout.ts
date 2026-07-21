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
  send,
  navigate,
  pushToast
}: UseVposCheckoutParams): UseVposCheckoutResult {
  const [vposStatus, setVposStatus] = useState<'checking' | 'waiting'>('checking')

  useEffect(() => {
    if (!method?.withMerchant) return

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
            send({
              type: 'SUBMIT_PAYMENT',
              payment: {
                methodId: method.id,
                reference: data.numeroReferencia || data.numSeq || 'MOCK-VPOS',
                amount: paymentAmount,
                igtfAmount: paymentIgtf
              }
            })
            navigate('/resultado')
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
  }, [method, paymentAmount, paymentIgtf, send, navigate, pushToast])

  const docNumber = context.customer?.cedula || context.pendingVat || ''
  const iframeUrl = `${VPOS_BASE_URL}checkout?amount=${totalWithIgtfBs}&cedula=${docNumber}`

  return { vposStatus, iframeUrl }
}
