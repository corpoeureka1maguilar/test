import { useUIStore } from '@/shared/stores/ui'
import styles from './AppToast.module.css'

export function AppToast() {
  const { toasts, dismissToast } = useUIStore()

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`} onClick={() => dismissToast(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
