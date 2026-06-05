import styles from './AppNumericKeyboard.module.css'

interface Props {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  masked?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'] as const

export function AppNumericKeyboard({ value, onChange, maxLength = 6, masked = false }: Props) {
  const handleKey = (key: string) => {
    if (key === '←') {
      onChange(value.slice(0, -1))
    } else if (key === '✓') {
      // handled externally
    } else if (value.length < maxLength) {
      onChange(value + key)
    }
  }

  const display = masked ? '●'.repeat(value.length) : value

  return (
    <div className={styles.wrapper}>
      <div className={styles.display}>{display || <span className={styles.placeholder}>—</span>}</div>
      <div className={styles.grid}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.key} ${key === '✓' ? styles.confirm : ''} ${key === '←' ? styles.delete : ''}`}
            onClick={() => handleKey(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
