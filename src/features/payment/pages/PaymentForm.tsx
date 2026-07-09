import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartTotal } from '@/features/cart/stores/cart'
import { getPaymentFormFields, getPaymentLabel, isValidVenezuelanPhone } from '@/shared/lib/paymentUtils'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { useUIStore } from '@/shared/stores/ui'
import { searchGiftCard } from '@/shared/lib/odooRepository'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import styles from './PaymentForm.module.css'
import loadingStyles from '@/shared/components/AppLoading.module.css'

const VPOS_BASE_URL = 'http://localhost:8085/vpos/'
const VPOS_RESPONSE_TIMEOUT_MS = 60_000

export function PaymentForm() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const total = useCartTotal()
  const globalRate = useExchangeRateStore((s) => s.rate)
  const pushToast = useUIStore((s) => s.pushToast)

  const method = context.selectedMethod
  const [reference, setReference] = useState('')
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('')

  // Gift Card payment state
  const [giftCardCode, setGiftCardCode] = useState('')
  const [searchingCard, setSearchingCard] = useState(false)
  const [foundCard, setFoundCard] = useState<any | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [showKeyboard, setShowKeyboard] = useState(false)

  // VPOS (merchant) payment state
  const [vposStatus, setVposStatus] = useState<'checking' | 'waiting'>('checking')

  useEffect(() => {
    if (!method) navigate('/pago')
  }, [method, navigate])

  if (!method) return null

  const fields = getPaymentFormFields(method.paymentType)
  const isForeign = !!method.currencyRate && method.currencyRate > 1
  const currencySymbol = method.currencySymbol || '$'
  const hasRate = globalRate > 0

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

  useEffect(() => {
    if (!method?.withMerchant) return

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
    if (!foundCard) return

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (fields.includes('phone') && !isValidVenezuelanPhone(phone)) {
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
        amount: paymentAmount,
        igtfAmount: paymentIgtf
      }
    })
    navigate('/resultado')
  }

  if (method.withMerchant) {
    const docNumber = context.customer?.cedula || context.pendingVat || ''
    const iframeUrl = `${VPOS_BASE_URL}checkout?amount=${totalWithIgtfBs}&cedula=${docNumber}`

    return (
      <div className="kiosk-container">
        <h1 className={styles.title}>{method.name || getPaymentLabel(method.paymentType)} (VPOS)</h1>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '2rem' }}>
          {vposStatus === 'checking' ? (
            <>
              <div className={loadingStyles.spinner} />
              <p>Conectando con el terminal VPOS...</p>
            </>
          ) : (
            <iframe
              src={iframeUrl}
              title="VPOS Checkout"
              style={{
                width: '100%',
                maxWidth: '360px',
                height: '360px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px'
              }}
            />
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { send({ type: 'BACK' }); navigate('/pago') }}
            >
              Cancelar y Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (method.id === -999) {
    const orderTotalUSD = total / globalRate
    const hasSufficientBalance = foundCard ? foundCard.balance >= orderTotalUSD : false

    return (
      <div className="kiosk-container">
        <h1 className={styles.title}>Pago con Tarjeta de Regalo</h1>

        <div className={styles.summaryContainer} style={{ margin: '0 auto 3rem' }}>
          <div className={styles.summaryCard}>
            <div className={styles.amountRow}>
              <span>Total de la compra</span>
              <strong>
                <span className={styles.amountUsd}>{formatUSD(orderTotalUSD)}</span>
                <span className={styles.amountSecondary}>{formatBs(total)}</span>
              </strong>
            </div>

            {foundCard && (
              <>
                <hr className={styles.divider} />
                <div className={styles.amountRow}>
                  <span>Saldo de la tarjeta</span>
                  <strong className={styles.cardBalance}>
                    {formatUSD(foundCard.balance)}
                    <span className={styles.amountSecondary}>{formatBs(foundCard.balance * globalRate)}</span>
                  </strong>
                </div>
                <div className={styles.amountRow}>
                  <span>Monto a consumir</span>
                  <strong className={styles.amountToConsume}>
                    {formatUSD(orderTotalUSD)}
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>

        {!foundCard ? (
          <div className={styles.formContainer}>
            <div className={styles.label}>
              <span>Código de la tarjeta</span>
              <div className={styles.searchRow}>
                <input
                  type="text"
                  value={giftCardCode}
                  onChange={e => setGiftCardCode(e.target.value)}
                  placeholder="CARDXXXXXXXXXX"
                  className={styles.giftCardInput}
                  disabled={searchingCard}
                  onFocus={() => setShowKeyboard(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearchCard()
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSearchCard}
                  className={`btn btn-accent ${styles.searchButton}`}
                  disabled={searchingCard}
                >
                  {searchingCard ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
            {cardError && <p className={styles.errorText}>{cardError}</p>}

            {showKeyboard && (
              <div className={styles.inlineKeyboardContainer}>
                <AppVirtualKeyboard
                  value={giftCardCode}
                  onChange={setGiftCardCode}
                  onClose={() => setShowKeyboard(false)}
                  onEnter={() => {
                    handleSearchCard()
                    setShowKeyboard(false)
                  }}
                />
              </div>
            )}

            <div className={styles.actions} style={{ marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { send({ type: 'BACK' }); navigate('/pago') }}>Volver</button>
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleGiftCardSubmit}>
            {!hasSufficientBalance && (
              <div className={styles.noRateWarning}>
                El saldo de tu tarjeta de regalo ({formatUSD(foundCard.balance)}) es menor que el total a pagar ({formatUSD(orderTotalUSD)}).
              </div>
            )}

            {hasSufficientBalance && (
              <p className={styles.successText}>
                ✓ Tarjeta lista para usar. Se debitarán {formatUSD(orderTotalUSD)} de tu saldo.
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="submit"
                className="btn btn-accent"
                disabled={!hasSufficientBalance}
              >
                Confirmar consumo
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFoundCard(null)
                  setGiftCardCode('')
                }}
              >
                Usar otra tarjeta
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>{method.name || getPaymentLabel(method.paymentType)}</h1>

      <div className={styles.summaryContainer}>
        <div className={styles.summaryCard}>

          {isForeign && !hasRate && (
            <div className={styles.noRateWarning}>
              Sin tasa de cambio disponible. No se puede procesar este método de pago.
            </div>
          )}

          {isForeign ? (
            <>
              <div className={styles.amountRow}>
                <span>Subtotal</span>
                <strong>
                   {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(total / globalRate)}</span>}
                  <span className={styles.amountSecondary}>{formatBs(total)}</span>
          
                </strong>
              </div>

              {igtfBs > 0 && (
                <div className={styles.amountRow}>
                  <span>IGTF ({method.igtfPercent}%)</span>
                  <strong>
                    {currencySymbol} {igtfUSD?.toFixed(2) ?? '—'}
                    <span className={styles.amountSecondary}>{formatBs(igtfBs)}</span>
                    {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(igtfBs / globalRate)}</span>}
                  </strong>
                </div>
              )}

              <div className={`${styles.amountRow} ${styles.total}`}>
                <span>Total a pagar</span>
                <strong>
                  
                  {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(totalWithIgtfBs / globalRate)}</span>}
                  <span className={styles.amountSecondary}>{formatBs(totalWithIgtfBs)}</span>
                </strong>
              </div>
            </>
          ) : (
            <>
              <div className={styles.amountRow}>
                <span>Subtotal</span>
                <strong>{formatBs(total)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(total / globalRate)}</span>}</strong>
              </div>

              {igtfBs > 0 && (
                <div className={styles.amountRow}>
                  <span>IGTF ({method.igtfPercent}%)</span>
                  <strong>{formatBs(igtfBs)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(igtfBs / globalRate)}</span>}</strong>
                </div>
              )}

              <div className={`${styles.amountRow} ${styles.total}`}>
                <span>Total a pagar</span>
                <strong>{formatBs(totalWithIgtfBs)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(totalWithIgtfBs / globalRate)}</span>}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {fields.includes('bank') && (
          <label className={styles.label}>
            <span>Banco</span>
            <input type="text" value={bank} onChange={e => setBank(e.target.value)} placeholder="Ej: Banesco" required />
          </label>
        )}
        {fields.includes('phone') && (
          <label className={styles.label}>
            <span>Teléfono</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="04XX-XXXXXXX" required />
          </label>
        )}
        {fields.includes('reference') && (
          <label className={styles.label}>
            <span>Referencia / Comprobante</span>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° de referencia" required />
          </label>
        )}

        <div className={styles.actions}>
          <button type="submit" className="btn btn-accent" disabled={isForeign && !hasRate}>Confirmar pago</button>
          <button type="button" className="btn btn-secondary" onClick={() => { send({ type: 'BACK' }); navigate('/pago') }}>Volver</button>
        </div>
      </form>
    </div>
  )
}
