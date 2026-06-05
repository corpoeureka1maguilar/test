import { useUIStore } from '@/shared/stores/ui'
import styles from './AppLoading.module.css'

export function AppLoading() {
  const loading = useUIStore((s) => s.loading)
  if (!loading) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.spinner} />
    </div>
  )
}
