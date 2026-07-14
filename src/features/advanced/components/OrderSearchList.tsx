import type { KioskOrder } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import styles from '../pages/AdvancedMenu.module.css'

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
        className={styles.search}
        value={pattern}
        onChange={(e) => onPatternChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {isFetching && <p className={styles.info}>Buscando...</p>}
      <div className={styles.results}>
        {results.map((o) => (
          <button key={o.id} type="button" className={styles.resultCard} onClick={() => onSelectOrder(o)}>
            <span className={styles.orderName}>{o.name}</span>
            <span>{o.partnerId[1]}</span>
            <span className={styles.amount}>{formatBs(o.amountTotal * (o.rate || rate))}<span className={styles.amountUsd}>{formatUSD(o.amountTotal)}</span></span>
          </button>
        ))}
      </div>
    </>
  )
}
