import type { KioskOrder } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'

interface Props {
  pattern: string
  onPatternChange: (value: string) => void
  placeholder: string
  isFetching: boolean
  results: KioskOrder[]
  rate: number
  onSelectOrder: (order: KioskOrder) => void
}

export function OrderSearchList({ pattern, onPatternChange, placeholder, isFetching, results, rate, onSelectOrder }: Props) {
  return (
    <>
      <input
        type="text"
        className="text-[1.3rem]! h-[60px]! mb-4"
        value={pattern}
        onChange={(e) => onPatternChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {isFetching && <p className="text-text-muted p-4 text-[1.2rem]">Buscando...</p>}
      <div className="flex flex-col gap-4 mb-8 w-full">
        {results.map((o) => (
          <button
            key={o.id}
            type="button"
            className="glass-card flex items-center gap-4 px-6 py-4 cursor-pointer text-left font-app transition-all duration-200 active:border-accent active:bg-surface-hover"
            onClick={() => onSelectOrder(o)}
          >
            <span className="font-extrabold flex-1 text-[1.1rem] text-text">{o.name}</span>
            <span>{o.partnerId[1]}</span>
            <span className="font-black text-accent text-[1.25rem]">
              {formatBs(o.amountTotal * (o.rate || rate))}
              <span className="block text-[0.75em] text-text-muted font-normal tracking-[0.01em] mt-[0.1em] tabular-nums">{formatUSD(o.amountTotal)}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
