import styles from './AppProgressSteps.module.css'

const STEPS = [
  { key: 'searching', label: 'Buscar orden' },
  { key: 'orderReady', label: 'Orden' },
  { key: 'selectingMethod', label: 'Método de pago' },
  { key: 'enteringDetails', label: 'Datos de pago' },
  { key: 'processing', label: 'Procesando' },
  { key: 'success', label: 'Confirmado' }
] as const

const STATE_INDEX: Record<string, number> = {
  idle: -1,
  searching: 0,
  orderReady: 1,
  selectingMethod: 2,
  enteringDetails: 3,
  processing: 4,
  printing: 4,
  printingError: 4,
  success: 5,
  paymentError: 3
}

interface Props {
  currentState: string
}

export function AppProgressSteps({ currentState }: Props) {
  const currentIdx = STATE_INDEX[currentState] ?? -1
  if (currentIdx < 0) return null

  return (
    <div className={styles.wrapper}>
      {STEPS.map((step, i) => (
        <div
          key={step.key}
          className={`${styles.step} ${i < currentIdx ? styles.done : ''} ${i === currentIdx ? styles.active : ''}`}
        >
          <div className={styles.dot}>{i < currentIdx ? '✓' : i + 1}</div>
          <span className={styles.label}>{step.label}</span>
        </div>
      ))}
    </div>
  )
}
