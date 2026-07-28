import { formatBs, formatUSD } from '@/shared/lib/money'

interface Props {
  count: number
  total: number
  rate: number
  onCheckout: () => void
}

/** Barra de checkout fija para mobile */
export function MobileCheckoutBar({ count, total, rate, onCheckout }: Props) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200/80 p-4 px-6 flex items-center justify-between z-[999] shadow-2xl animate-slideUp">
      <div className="flex flex-col text-left">
        <span className="text-xs text-gray-500 font-semibold">
          {count} {count === 1 ? 'elemento' : 'elementos'}
        </span>
        <span className="text-lg font-black text-emerald-600 tabular-nums">
          Total: {formatBs(total)}
          {rate > 0 && <span className="block text-xs font-medium text-gray-400">{formatUSD(total / rate)}</span>}
        </span>
      </div>
      <button
        type="button"
        className="h-12 px-6 rounded-full bg-emerald-500 text-white font-bold text-base hover:bg-emerald-600 active:scale-95 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
        onClick={onCheckout}
      >
        PAGAR AHORA
      </button>
    </div>
  )
}
