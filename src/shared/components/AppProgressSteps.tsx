
const STEPS = [
  { key: 'searching', label: 'Buscar orden' },
  { key: 'orderReady', label: 'Orden' },
  { key: 'selectingMethod', label: 'Método de pago' },
  { key: 'enteringDetails', label: 'Datos de pago' },
  { key: 'processing', label: 'Procesando' },
  { key: 'success', label: 'Confirmado' }
] as const

const STATE_INDEX: Record<string, number> = {
  idle: -1,
  searching: 0,
  orderReady: 1,
  selectingMethod: 2,
  enteringDetails: 3,
  processing: 4,
  printing: 4,
  printingError: 4,
  success: 5,
  paymentError: 3
}

interface Props {
  currentState: string
}

export function AppProgressSteps({ currentState }: Props) {
  const currentIdx = STATE_INDEX[currentState] ?? -1
  if (currentIdx < 0) return null

  return (
    <div className="flex items-center gap-0 w-full py-4 overflow-x-auto">
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx
        const isActive = i === currentIdx
        const isLast = i === STEPS.length - 1
        const isDoneOrActive = isDone || isActive
        // El conector (::after) solo existe en pasos que no son el último,
        // y cambia de color cuando el paso está completado o activo
        const connectorClasses = isLast
          ? ''
          : `after:content-[''] after:absolute after:top-[18px] after:left-[calc(50%+18px)] after:right-[calc(-50%+18px)] after:h-[2px] ${isDoneOrActive ? 'after:bg-black' : 'after:bg-[#e0e0e0]'}`

        return (
          <div
            key={step.key}
            className={`flex flex-col items-center gap-[0.4rem] flex-1 relative ${connectorClasses}`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[0.9rem] z-[1] relative ${
                isDoneOrActive ? 'bg-black text-white' : 'bg-[#e0e0e0]'
              } ${isActive ? 'shadow-[0_0_0_4px_rgba(0,0,0,0.15)]' : ''}`}
            >
              {isDone ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs text-center whitespace-nowrap ${isDoneOrActive ? 'text-black font-semibold' : 'text-[#999]'}`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
