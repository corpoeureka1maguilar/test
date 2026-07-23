import { useEffect } from 'react'
import { useUIStore } from '@/shared/stores/ui'
import type { Toast } from '@/shared/types/types'
import styles from './AppToast.module.css'

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.sticky) return
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.sticky, onDismiss])

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`} onClick={() => onDismiss(toast.id)}>
      {toast.message}
    </div>
  )
}

export function AppToast() {
  const { toasts, dismissToast } = useUIStore()

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
