import { useState } from 'react'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import styles from '../pages/PaymentForm.module.css'

interface VposAmountInputProps {
  title: string
  // Remanente calculado por el context de la máquina (gift card parcial o
  // pierna(s) VPOS previas); null cuando esta es la primera/única pierna de
  // la venta (sin gift card, sin piernas previas) — en ese caso el default y
  // el tope son `total` (regresión: venta VPOS de un solo método).
  remainingAmount: number | null
  total: number
  onConfirm: (baseBs: number) => void
  onBack: () => void
}

// generic-partial-payment (post-design decision 0.2, tasks 3.3/3.4): monto
// de la pierna VPOS confirmado por el cajero ANTES de lanzar el terminal.
// Pre-llenado con el remanente completo (nunca vacío/free-form), editable
// SOLO hacia abajo (max = remanente). Confirmar sin editar preserva el
// comportamiento de hoy (una sola pierna VPOS cierra el remanente completo).
export function VposAmountInput({ title, remainingAmount, total, onConfirm, onBack }: VposAmountInputProps) {
  const globalRate = useExchangeRateStore((s) => s.rate)
  const max = remainingAmount ?? total
  const [value, setValue] = useState<string>(String(max))

  const numericValue = Number(value)
  const isValid = value.trim() !== '' && !Number.isNaN(numericValue) && numericValue > 0 && numericValue <= max + 0.0001
  const validNumericValue = isValid ? Math.min(numericValue, max) : 0

  const remainingAfterBs = Math.max(0, max - validNumericValue)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      // Se permite el estado transitorio vacío mientras el cajero edita,
      // pero el botón "Confirmar monto" queda deshabilitado (isValid=false).
      setValue('')
      return
    }
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    // Editable SOLO hacia abajo: cualquier intento de superar el remanente
    // se clampa al tope, nunca se acepta un valor mayor.
    setValue(parsed > max ? String(max) : raw)
  }

  const handleConfirm = () => {
    if (!isValid) return
    onConfirm(validNumericValue)
  }

  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>{title}</h1>

      <div className={`${styles.summaryContainer} ${styles.summaryContainerCentered}`}>
        <div className={styles.summaryCard}>
          <div className={styles.amountRow}>
            <span>Total de la compra</span>
            <strong>
              {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(total / globalRate)}</span>}
              <span className={styles.amountSecondary}>{formatBs(total)}</span>
            </strong>
          </div>

          {remainingAmount !== null && remainingAmount < total && (
            <div className={styles.amountRow}>
              <span>Saldo pendiente actual</span>
              <strong>
                {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(remainingAmount / globalRate)}</span>}
                <span className={styles.amountSecondary}>{formatBs(remainingAmount)}</span>
              </strong>
            </div>
          )}

          <hr className={styles.divider} />

          <div className={styles.label}>
            <span>Monto a cobrar con este método (Bs)</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
              <input
                type="number"
                value={value}
                max={max}
                min={0.0001}
                step="0.0001"
                onChange={handleChange}
                className={styles.giftCardInput}
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  textAlign: 'right',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  width: '100%'
                }}
                aria-label="Monto VPOS"
                autoFocus
              />
              {globalRate > 0 && (
                <div style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-accent)' }}>
                  Equivalente: {formatUSD(validNumericValue / globalRate)}
                </div>
              )}
            </div>
          </div>

          <hr className={styles.divider} />

          <div className={styles.amountRow}>
            <span>Monto restante después de este pago</span>
            <strong>
              {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(remainingAfterBs / globalRate)}</span>}
              <span className={styles.amountSecondary}>{formatBs(remainingAfterBs)}</span>
            </strong>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-accent"
          onClick={handleConfirm}
          disabled={!isValid}
        >
          Confirmar monto
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Cancelar y volver
        </button>
      </div>
    </div>
  )
}
