import { useLocation } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { useConfigStore } from '@/shared/stores/config'

// Mapas explícitos por estado del paso (activo/completado/pendiente): no se puede
// indexar Tailwind dinámicamente como con CSS Modules (styles[algoDinamico])
const DOT_CLASSES: Record<'active' | 'completed' | 'pending', string> = {
  pending:
    'w-7 h-7 rounded-full bg-surface-heavy shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-center text-[0.85rem] font-bold text-text-muted transition-[transform,background-color,box-shadow] duration-[600ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
  active:
    'w-7 h-7 rounded-full bg-accent scale-[1.15] shadow-[0_0_15px_var(--color-accent-glow)] flex items-center justify-center text-[0.85rem] font-bold text-bg transition-[transform,background-color,box-shadow] duration-[600ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
  completed:
    'w-7 h-7 rounded-full bg-text scale-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-center text-[0.85rem] font-bold text-bg transition-[transform,background-color,box-shadow] duration-[600ms] [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
}

const LABEL_CLASSES: Record<'active' | 'completed' | 'pending', string> = {
  pending:
    'text-[0.9rem] font-semibold text-text-muted uppercase tracking-[0.05em] opacity-60 transition-[transform,color,opacity] duration-[400ms] ease',
  active:
    'text-[0.9rem] font-semibold text-text uppercase tracking-[0.05em] opacity-100 -translate-y-0.5 transition-[transform,color,opacity] duration-[400ms] ease',
  completed:
    'text-[0.9rem] font-semibold text-text-muted uppercase tracking-[0.05em] opacity-80 transition-[transform,color,opacity] duration-[400ms] ease',
}

const LINE_CLASSES: Record<'completed' | 'other', string> = {
  other:
    'absolute top-[14px] left-[calc(50%+22px)] right-[calc(-50%+22px)] h-0.5 bg-surface-border -z-10 transition-colors duration-[400ms] ease',
  completed:
    'absolute top-[14px] left-[calc(50%+22px)] right-[calc(-50%+22px)] h-0.5 bg-text -z-10 transition-colors duration-[400ms] ease',
}

const STEPS = [
  { id: 'id', label: 'Identidad', paths: ['/cedula', '/registro'] },
  { id: 'select', label: 'Selección', paths: ['/productos', '/carrito'] },
  { id: 'pay', label: 'Pago', paths: ['/pago'] },
  { id: 'done', label: 'Listo', paths: ['/resultado'] },
]

export function AppStepper() {
  const location = useLocation()
  const { context } = useSaleMachine()
  const rate = useExchangeRateStore((s) => s.rate)
  const companyLogo = useConfigStore((s) => s.companyLogo)
  
  // Don't show stepper on home, setup or advanced
  const noStepperPaths = ['/', '/setup', '/advanced']
  if (noStepperPaths.includes(location.pathname)) return null

  // Find current step index
  const currentStepIndex = STEPS.findIndex(step => 
    step.paths.some(p => location.pathname.startsWith(p))
  )

  if (currentStepIndex === -1) return null

  const customerName = context.customer?.name ?? null
  const customerDoc = context.customer?.cedula ?? null
  const formattedRate = rate > 0 ? rate.toFixed(2) : null

  return (
    <div className="flex items-center justify-between pt-2.5 pb-1 px-4 desktop:px-6 gap-3 animate-[appleFadeIn_1s_cubic-bezier(0.2,0.8,0.2,1)] bg-bg">
      {/* Logo - left side */}
      <div className="flex-none min-w-[120px] flex items-center gap-3">
        {companyLogo && (
          <img
            src={`data:image/png;base64,${companyLogo}`}
            alt="Logo empresa"
            className="h-[clamp(44px,6vh,80px)] w-auto max-w-[170px] object-contain opacity-95"
          />
        )}
      </div>

      {/* Stepper - center */}
      <div className="flex-1 max-w-[600px] flex items-center justify-between px-4 relative z-10">
        {STEPS.map((step, index) => {
          const isActive = index === currentStepIndex
          const isCompleted = index < currentStepIndex
          const state = isActive ? 'active' : isCompleted ? 'completed' : 'pending'
          const isLast = index === STEPS.length - 1

          return (
            <div
              key={step.id}
              className="flex flex-col items-center gap-3 relative flex-1"
            >
              <div className={DOT_CLASSES[state]}>
                {index + 1}
              </div>
              <span className={LABEL_CLASSES[state]}>{step.label}</span>
              {!isLast && (
                <div className={isCompleted ? LINE_CLASSES.completed : LINE_CLASSES.other} />
              )}
            </div>
          )
        })}
      </div>

      {/* Buyer & Exchange rate - right side */}
      <div className="flex-none flex items-center gap-6 min-w-[140px] justify-end">
        {customerName && (
          <div className="flex flex-col gap-[0.15rem] justify-center items-end text-right">
            <span className="text-base font-extrabold uppercase tracking-[0.04em] text-text leading-[1.1]">{customerName}</span>
            {customerDoc && <span className="text-[1.05rem] font-bold text-text-muted opacity-85">{customerDoc}</span>}
          </div>
        )}
        {formattedRate && (
          <div className="flex-none min-w-[140px] flex flex-col items-end gap-[0.15rem]">
            <span className="text-[0.7rem] font-medium uppercase tracking-[0.06em] text-text-muted opacity-70">Tasa del día</span>
            <span className="text-[0.95rem] font-bold text-text tracking-[0.02em]">Bs. {formattedRate}</span>
          </div>
        )}
      </div>
    </div>
  )
}
