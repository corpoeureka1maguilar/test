import { Money, DeviceMobile, CreditCard, Bank, CurrencyBtc, Envelope, Fingerprint, Wallet } from '@phosphor-icons/react'
import type { KioskPaymentMethod, PaymentType } from '@/shared/types/types'
import { getPaymentLabel } from '@/shared/lib/paymentUtils'

const PAYMENT_ICONS: Record<PaymentType, React.ElementType> = {
  cash: Money,
  pago_movil: DeviceMobile,
  card: CreditCard,
  transferencia: Bank,
  crypto: CurrencyBtc,
  zelle: Envelope,
  otro: Wallet,
  biopago: Fingerprint,
  banplus: Bank,
}

interface Props {
  method: KioskPaymentMethod
  onSelect: (method: KioskPaymentMethod) => void
}

export function AppPaymentMethodCard({ method, onSelect }: Props) {
  const Icon = PAYMENT_ICONS[method.paymentType] ?? Wallet

  return (
    <button
      type="button"
      className="glass-card group flex flex-1 basis-[260px] flex-row items-center gap-6 border border-surface-border bg-white p-7 px-8 text-left transition-[transform,box-shadow,border-color] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] active:scale-[0.96] active:duration-100 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-[3px] [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_var(--color-accent),0_16px_40px_-12px_rgba(0,0,0,0.12)]"
      onClick={() => onSelect(method)}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle transition-colors duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white">
        <Icon
          size={28}
          weight="duotone"
          className="text-[1.75rem] text-accent transition-colors duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-white"
        />
      </div>
      <div className="flex flex-1 flex-col gap-[0.35rem]">
        <span className="text-[1.35rem] font-bold tracking-[-0.02em] text-text [text-wrap:balance]">
          {method.name || getPaymentLabel(method.paymentType)}
        </span>
        {method.applyIgtf && (
          <span className="self-start rounded-full border border-accent-glow bg-accent-subtle px-3 py-[0.2rem] text-[0.85rem] font-semibold tracking-[0.03em] text-accent">
            +IGTF {method.igtfPercent}%
          </span>
        )}
      </div>
    </button>
  )
}
