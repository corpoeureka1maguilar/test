import { Component, type ReactNode } from 'react'

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
  state: State = { hasError: false }
  private reloadTimer?: number

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[AppErrorBoundary] Error no controlado en la UI:', error, info)
    this.reloadTimer = window.setTimeout(() => window.location.reload(), AUTO_RELOAD_MS)
  }

  componentWillUnmount() {
    clearTimeout(this.reloadTimer)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <div style={{ fontSize: '4rem' }}>⚠</div>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Algo salió mal</h1>
        <p style={{ fontSize: '1.25rem', margin: 0, color: '#555' }}>
          El kiosko se reiniciará automáticamente en unos segundos.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            fontSize: '1.5rem',
            padding: '1rem 3rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: '#1a73e8',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          Volver a empezar
        </button>
      </div>
    )
  }
}
