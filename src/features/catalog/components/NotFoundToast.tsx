import { WarningCircle } from '@phosphor-icons/react'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  code: string
}

/** Toast de producto no encontrado */
export function NotFoundToast({ code }: Props) {
  return (
    <div className={styles.toastError}>
      <WarningCircle size={24} weight="fill" />
      <span>Producto no encontrado: "{code}"</span>
    </div>
  )
}
