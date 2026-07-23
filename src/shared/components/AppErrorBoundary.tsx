import { Component, type ReactNode } from 'react'
import styles from './AppErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

const AUTO_RELOAD_MS = 15_000

// Un kiosko desatendido no tiene quién lo reinicie: un throw en cualquier
// render dejaría pantalla blanca hasta intervención manual. Este boundary
// muestra un mensaje y recarga la app sola (la configuración persiste en
// localStorage, así que el kiosko vuelve operativo sin re-setup).
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }
  private reloadTimer?: number

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown, info: unknown) {
    console.error('[AppErrorBoundary] Error no controlado en la UI:', error, info)
    this.reloadTimer = window.setTimeout(() => window.location.reload(), AUTO_RELOAD_MS)
  }

  override componentWillUnmount() {
    clearTimeout(this.reloadTimer)
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className={styles.wrapper}>
        <div className={styles.icon}>⚠</div>
        <h1 className={styles.title}>Algo salió mal</h1>
        <p className={styles.message}>
          El kiosko se reiniciará automáticamente en unos segundos.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={styles.button}
        >
          Volver a empezar
        </button>
      </div>
    )
  }
}
