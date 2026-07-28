import { formatBs, formatUSD } from '@/shared/lib/money'

interface PaymentAmountSummaryProps {
  isForeign: boolean
  hasRate: boolean
  total: number
  globalRate: number
  igtfBs: number
  igtfPercent: number
  currencySymbol: string
  igtfUSD: number | null
  totalWithIgtfBs: number
}

export function PaymentAmountSummary({
  isForeign,
  hasRate,
  total,
  globalRate,
  igtfBs,
  igtfPercent,
  currencySymbol,
  igtfUSD,
  totalWithIgtfBs
}: PaymentAmountSummaryProps) {
  return (
    <div className="mb-6 w-full max-w-[600px] animate-scaleIn">
      <div className="glass-card flex flex-col gap-3 p-6">

        {isForeign && !hasRate && (
          <div className="rounded-xl border border-[color-mix(in_srgb,#e53e3e_40%,transparent)] bg-[color-mix(in_srgb,#e53e3e_12%,transparent)] p-4 px-5 text-center text-[1.2rem] font-semibold text-[#e53e3e]">
            Sin tasa de cambio disponible. No se puede procesar este método de pago.
          </div>
        )}

        {isForeign ? (
          <>
            <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
              <span>Subtotal</span>
              <strong className="flex flex-col items-end font-bold text-text">
                 {globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(total / globalRate)}</span>}
                <span className="mt-[0.15em] block text-[0.85em] font-medium text-text-muted [font-variant-numeric:tabular-nums]">{formatBs(total)}</span>

              </strong>
            </div>

            {igtfBs > 0 && (
              <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
                <span>IGTF ({igtfPercent}%)</span>
                <strong className="flex flex-col items-end font-bold text-text">
                  {currencySymbol} {igtfUSD?.toFixed(2) ?? '—'}
                  <span className="mt-[0.15em] block text-[0.85em] font-medium text-text-muted [font-variant-numeric:tabular-nums]">{formatBs(igtfBs)}</span>
                  {globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(igtfBs / globalRate)}</span>}
                </strong>
              </div>
            )}

            <div className="mt-2 flex items-start justify-between border-t border-surface-border pt-6 text-[1.1rem] font-medium text-text [font-variant-numeric:tabular-nums]">
              <span className="font-bold">Total a pagar</span>
              <strong className="flex flex-col items-end text-[1.8rem] font-extrabold text-accent">

                {globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(totalWithIgtfBs / globalRate)}</span>}
                <span className="mt-[0.15em] block text-[0.85em] font-medium text-text-muted [font-variant-numeric:tabular-nums]">{formatBs(totalWithIgtfBs)}</span>
              </strong>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
              <span>Subtotal</span>
              <strong className="flex flex-col items-end font-bold text-text">{formatBs(total)}{globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(total / globalRate)}</span>}</strong>
            </div>

            {igtfBs > 0 && (
              <div className="flex items-start justify-between text-[1.1rem] font-medium text-text-muted [font-variant-numeric:tabular-nums]">
                <span>IGTF ({igtfPercent}%)</span>
                <strong className="flex flex-col items-end font-bold text-text">{formatBs(igtfBs)}{globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(igtfBs / globalRate)}</span>}</strong>
              </div>
            )}

            <div className="mt-2 flex items-start justify-between border-t border-surface-border pt-6 text-[1.1rem] font-medium text-text [font-variant-numeric:tabular-nums]">
              <span className="font-bold">Total a pagar</span>
              <strong className="flex flex-col items-end text-[1.8rem] font-extrabold text-accent">{formatBs(totalWithIgtfBs)}{globalRate > 0 && <span className="block text-[0.75em] font-normal tracking-[0.01em] text-text-muted [font-variant-numeric:tabular-nums]">{formatUSD(totalWithIgtfBs / globalRate)}</span>}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
