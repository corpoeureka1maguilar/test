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
      <div className="flex flex-col items-center justify-center gap-6 h-screen p-8 text-center font-sans">
        <div className="text-[4rem]">⚠</div>
        <h1 className="text-[2rem] m-0">Algo salió mal</h1>
        <p className="text-[1.25rem] m-0 text-[#555]">
          El kiosko se reiniciará automáticamente en unos segundos.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-[1.5rem] px-12 py-4 rounded-xl border-none bg-[#1a73e8] text-white cursor-pointer"
        >
          Volver a empezar
        </button>
      </div>
    )
  }
}
