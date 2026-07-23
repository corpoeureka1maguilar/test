import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useRegisterLoyaltyCard } from '@/features/loyalty/hooks/useLoyalty'
import { checkLoyaltyCardExists } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import styles from './LoyaltyCheck.module.css'

// ─── Mask derivation from regex (ej. ^[A-Z0-9]{4}-[A-Z0-9]{4}$) ───────────────

interface MaskSegment { len: number; sep: string }

function deriveInputMask(regex: string): MaskSegment[] | null {
  if (!regex) return null
  try {
    const stripped = regex.replace(/^\^/, '').replace(/\$$/, '')
    const segmentPattern = /(?:\[[^\]]+\]|\\[dDwWsS])\{(\d+)\}([^[{\\]*)/g
    const segments: MaskSegment[] = []
    let match: RegExpExecArray | null
    while ((match = segmentPattern.exec(stripped)) !== null) {
      const len = parseInt(match[1]!, 10)
      const rawSep = match[2]!.replace(/[\\^$*+?.()|[\]{}]/g, '')
      segments.push({ len, sep: rawSep })
    }
    return segments.length > 0 ? segments : null
  } catch {
    return null
  }
}

function formatWithMask(raw: string, mask: MaskSegment[] | null): string {
  if (!mask) return raw.toUpperCase()

  const allSeps = [...new Set(mask.map((s) => s.sep).filter(Boolean))]
  const sepRegex = new RegExp(`[${allSeps.map((s) => `\\${s}`).join('')}]`, 'g')
  const rawChars = raw.toUpperCase().replace(sepRegex, '')

  let formatted = ''
  let rawIdx = 0
  for (const seg of mask) {
    const chunk = rawChars.slice(rawIdx, rawIdx + seg.len)
    if (!chunk) break
    formatted += chunk
    rawIdx += seg.len
    if (rawIdx < rawChars.length && seg.sep) formatted += seg.sep
  }
  return formatted
}

export function LoyaltyCheck() {
  const { context, send, matches } = useSaleMachine()
  const navigate = useNavigate()
  const pushToast = useUIStore((s) => s.pushToast)
  const scannerRef = useRef<HTMLInputElement>(null)
  const { mutateAsync: registerCard, isPending: registering } = useRegisterLoyaltyCard()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardCode, setCardCode] = useState('')
  const [validationError, setValidationError] = useState('')

  const engines = context.requiredEngines
  const engine = engines[currentIndex]

  // Nada que resolver: ya sea porque el carrito no exigía lealtad, ya sea
  // porque se resolvió cada motor — seguir directo al pago.
  useEffect(() => {
    if (!matches('loyaltyRequired') && !matches('checkingLoyalty')) {
      navigate('/pago', { replace: true })
    }
  }, [matches, navigate])

  useEffect(() => {
    scannerRef.current?.focus()
  }, [currentIndex])

  const mask = engine ? deriveInputMask(engine.regex) : null

  const validateCode = (code: string): boolean => {
    if (!code) {
      setValidationError('')
      return false
    }
    if (!engine?.regex) return true
    try {
      if (!new RegExp(engine.regex).test(code)) {
        setValidationError('El formato del código no es válido.')
        return false
      }
    } catch {
      // Regex inválido en el motor: no bloquear al operador
    }
    setValidationError('')
    return true
  }

  const advance = () => {
    setCardCode('')
    setValidationError('')
    if (currentIndex < engines.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      send({ type: 'LOYALTY_DONE' })
    }
  }

  const handleInput = (raw: string) => {
    const formatted = formatWithMask(raw, mask)
    setCardCode(formatted)
    validateCode(formatted)
  }

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const raw = e.currentTarget.value.trim()
    e.currentTarget.value = ''
    if (raw) handleInput(raw)
  }

  const handleSkip = () => {
    if (currentIndex < engines.length - 1) {
      advance()
    } else {
      send({ type: 'LOYALTY_SKIP' })
    }
  }

  const handleConfirm = () => {
    if (engine?.customer_has_card) {
      advance()
    }
  }

  const handleRegister = async () => {
    if (!engine || !cardCode.trim() || !context.customer) return
    if (!validateCode(cardCode)) return

    try {
      const branchId = useConfigStore.getState().branchId
      const existsResult = await checkLoyaltyCardExists(engine.engine_code, cardCode.trim(), branchId || undefined)
      if (!existsResult.found) {
        setValidationError('Tarjeta no encontrada en el sistema de promociones.')
        return
      }
    } catch {
      // checkLoyaltyCardExists nunca lanza
    }

    const result = await registerCard({
      partnerId: context.customer.id,
      engineCode: engine.engine_code,
      cardCode: cardCode.trim()
    })

    if (!result.ok) {
      setValidationError(result.message || 'Error al registrar la tarjeta.')
      return
    }

    pushToast('success', `Tarjeta registrada para ${engine.engine_name}`)
    advance()
  }

  const maxLength = mask ? mask.reduce((acc, seg) => acc + seg.len + seg.sep.length, 0) : 64
  const placeholder = mask ? mask.map((seg) => 'X'.repeat(seg.len)).join(mask[0]?.sep || '') : 'Ingrese el código'
  const canRegister = cardCode.trim().length > 0 && !validationError

  if (matches('checkingLoyalty')) {
    return (
      <div className="kiosk-container">
        <p className={styles.message}>Verificando promociones...</p>
      </div>
    )
  }

  if (!matches('loyaltyRequired') || !engine) {
    return <div className="kiosk-container" />
  }

  return (
    <div className="kiosk-container">
      <input
        ref={scannerRef}
        type="text"
        aria-hidden="true"
        className={styles.scannerInput}
        onKeyDown={handleScannerKeyDown}
        readOnly={registering}
      />

      <p className={styles.eyebrow}>Programa de fidelización</p>
      <h2 className={styles.title}>{engine.engine_name}</h2>

      <div className={`card ${styles.card}`}>
        <p className={styles.message}>{engine.message}</p>

        {engine.customer_has_card ? (
          <>
            <div className={`${styles.status} ${styles.statusOk}`}>
              <span>Código registrado</span>
              <strong>{engine.current_card_code}</strong>
            </div>
            <div className={styles.actions}>
              <button type="button" className="btn btn-primary" onClick={handleConfirm}>
                Continuar
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleSkip}>
                Omitir
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`${styles.status} ${styles.statusMissing}`}>
              Este cliente no tiene una tarjeta para este programa.
            </div>
            <label className={`label-premium ${styles.inputLabel}`}>
              Código de la tarjeta
              <input
                type="text"
                value={cardCode}
                placeholder={placeholder}
                maxLength={maxLength}
                autoComplete="off"
                onChange={(e) => handleInput(e.target.value)}
              />
            </label>
            {validationError && <p className={styles.error}>{validationError}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleRegister().catch((err) => {
                    setValidationError((err as Error).message || 'Error al registrar la tarjeta.')
                  })
                }}
                disabled={!canRegister || registering}
              >
                {registering ? 'Registrando...' : 'Registrar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleSkip}>
                Omitir
              </button>
              <p className={styles.hint}>Si no tienes una tarjeta, puedes omitir este paso.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
