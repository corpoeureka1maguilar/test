import { useState } from 'react'
import { WifiSlash, ArrowClockwise } from '@phosphor-icons/react'
import { useConfigStore } from '@/shared/stores/config'
import { useShouldBlockUI } from '@/shared/hooks/useShouldBlockUI'

export function OfflineOverlay() {
  const reauthenticate = useConfigStore((s) => s.reauthenticate)
  const [isRetrying, setIsRetrying] = useState(false)

  // Solo bloquea cuando offline Y la cola local está llena (design ADR-4):
  // mientras haya cupo, el kiosko sigue vendiendo offline sin interrupciones
  const shouldBlockUI = useShouldBlockUI()
  if (!shouldBlockUI) return null

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      await reauthenticate()
    } catch (err) {
      console.warn('Reintento manual de conexión fallido:', err)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,42,0.7)] backdrop-blur-md flex items-center justify-center z-[9999] animate-plainFadeIn">
      <div className="bg-white border border-[rgba(226,232,240,0.8)] rounded-[24px] py-12 px-8 w-[90%] max-w-[480px] text-center shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04),0_0_40px_rgba(239,68,68,0.05)] flex flex-col items-center animate-scaleUp">
        <div className="relative w-[90px] h-[90px] flex items-center justify-center mb-6">
          <WifiSlash size={64} className="relative z-[2] text-[#ef4444] drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
          <div className="absolute top-0 left-0 w-[90px] h-[90px] rounded-full bg-[rgba(239,68,68,0.1)] z-[1] animate-pulseRing" />
        </div>

        <h1 className="text-[26px] font-bold text-[#0f172a] m-0 mb-3 tracking-[-0.5px]">Cola de ventas offline llena</h1>

        <p className="text-[15px] leading-[1.6] text-[#475569] m-0 mb-7">
          El servidor central sigue fuera de línea y este kiosco ya alcanzó el
          máximo de ventas que puede guardar localmente. No se pueden registrar
          más ventas hasta reconectar y sincronizar la cola pendiente.
        </p>

        <div className="flex items-center gap-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-xl py-3 px-5 text-[#dc2626] text-sm font-medium mb-6">
          <span className="w-2 h-2 bg-[#ef4444] rounded-full animate-pulseDot" />
          <span>Intentando reconectar automáticamente...</span>
        </div>

        <button
          type="button"
          className="flex items-center justify-center gap-2 bg-[#0f172a] text-white border-none rounded-[14px] py-3.5 px-7 text-base font-semibold cursor-pointer transition-all duration-200 ease-in-out w-full disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:bg-[#1e293b] enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_4px_12px_rgba(15,23,42,0.15)] enabled:active:translate-y-0"
          onClick={() => {
            void handleRetry()
          }}
          disabled={isRetrying}
        >
          <ArrowClockwise size={20} className={isRetrying ? 'animate-spin' : ''} />
          {isRetrying ? 'Conectando...' : 'Reintentar conexión'}
        </button>
      </div>
    </div>
  )
}
