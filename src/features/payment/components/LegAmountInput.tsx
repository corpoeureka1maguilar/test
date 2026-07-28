import { useState } from 'react'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'

interface LegAmountInputProps {
  title: string
  // Remanente calculado por el context de la máquina (gift card parcial o
  // pierna(s) previas); null cuando esta es la primera/única pierna de la
  // venta (sin gift card, sin piernas previas) — en ese caso el default y
  // el tope son `total` (regresión: venta de un solo método).
  remainingAmount: number | null
  total: number
  onConfirm: (baseBs: number) => void
  onBack: () => void
}

// generic-partial-payment (post-design decision 0.2, tasks 3.3/3.4): monto de
// la pierna confirmado por el cajero ANTES de cobrar (lanzar el terminal VPOS
// o pedir banco/referencia en una transferencia). Pre-llenado con el remanente
// completo (nunca vacío/free-form), editable SOLO hacia abajo (max =
// remanente). Confirmar sin editar preserva el comportamiento de un solo
// método que cierra el remanente completo.
export function LegAmountInput({ title, remainingAmount, total, onConfirm, onBack }: LegAmountInputProps) {
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
      <h1 className="mb-6 text-center font-extrabold tracking-[-0.05em]">{title}</h1>

      <div className="mx-auto mb-12 w-full max-w-[600px] animate-scaleIn">
        <div className="glass-card flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
            <span>Total de la compra</span>
            <strong className="flex flex-col items-end font-bold text-text">
              {globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(total / globalRate)}</span>}
              <span className="mt-[0.15em] block text-[0.85em] font-medium text-text-muted [font-variant-numeric:tabular-nums]">{formatBs(total)}</span>
            </strong>
          </div>

          {remainingAmount !== null && remainingAmount < total && (
            <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
              <span>Saldo pendiente actual</span>
              <strong className="flex flex-col items-end font-bold text-text">
                {globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(remainingAmount / globalRate)}</span>}
                <span className="mt-[0.15em] block text-[0.85em] font-medium text-text-muted [font-variant-numeric:tabular-nums]">{formatBs(remainingAmount)}</span>
              </strong>
            </div>
          )}

          <hr className="my-4 border-0 border-t border-surface-border" />

          <div className="label-premium">
            <span>Monto a cobrar con este método (Bs)</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
              <input
                type="number"
                value={value}
                max={max}
                min={0.0001}
                step="0.0001"
                onChange={handleChange}
                className="!w-auto !flex-1 font-bold uppercase"
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 800,
                  textAlign: 'right',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  width: '100%'
                }}
                aria-label="Monto a cobrar"
                autoFocus
              />
              {globalRate > 0 && (
                <div style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-accent)' }}>
                  Equivalente: {formatUSD(validNumericValue / globalRate)}
                </div>
              )}
            </div>
          </div>

          <hr className="my-4 border-0 border-t border-surface-border" />

          <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
            <span>Monto restante después de este pago</span>
            <strong className="flex flex-col items-end font-bold text-text">
              {globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(remainingAfterBs / globalRate)}</span>}
              <span className="mt-[0.15em] block text-[0.85em] font-medium text-text-muted [font-variant-numeric:tabular-nums]">{formatBs(remainingAfterBs)}</span>
            </strong>
          </div>
        </div>
      </div>

      <div className="mt-6 flex w-full flex-col items-center gap-4">
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
