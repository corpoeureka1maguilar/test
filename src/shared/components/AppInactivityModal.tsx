import { useEffect, useState } from 'react'

interface Props {
  seconds: number
  onContinue: () => void
  onCancel: () => void
  onTimeout: () => void
}

export function AppInactivityModal({ seconds, onContinue, onCancel, onTimeout }: Props) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => r - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // onTimeout se dispara desde un efecto (no dentro del setInterval) para no
  // ejecutar side effects del padre durante el render de este componente
  useEffect(() => {
    if (remaining <= 0) onTimeout()
  }, [remaining, onTimeout])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-[20px] p-10 w-[min(480px,90vw)] flex flex-col gap-6 items-center" role="alertdialog" aria-labelledby="inactivity-title">
        <h2 id="inactivity-title" className="text-2xl font-bold m-0 text-center">¿Sigues allí?</h2>
        <p className="text-[1.1rem] text-center text-[#666] m-0">Tu compra se cancelará por inactividad en</p>
        {/* --app-color-danger no estaba definida globalmente (solo dentro de .container de AppToast),
            por lo que este color ya se resolvía roto/heredado en el original; se preserva ese comportamiento */}
        <span className="text-[3.5rem] font-extrabold leading-none [font-variant-numeric:tabular-nums]">{Math.max(remaining, 0)}</span>
        <div className="flex flex-col gap-3 w-full">
          <button className="btn btn-primary" onClick={onContinue}>
            Sí, continuar con mi compra
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            No, cancelar compra
          </button>
        </div>
      </div>
    </div>
  )
}
