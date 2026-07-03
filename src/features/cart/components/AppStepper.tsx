import { useLocation } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { useConfigStore } from '@/shared/stores/config'
import styles from './AppStepper.module.css'

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
  const formattedRate = rate > 0 ? rate.toFixed(2) : null

  return (
    <div className={styles.headerBar}>
      {/* Customer name - left side */}
      <div className={styles.customerInfo}>
        {companyLogo && (
          <img
            src={`data:image/png;base64,${companyLogo}`}
            alt="Logo empresa"
            className={styles.companyLogo}
          />
        )}
        {customerName && (
          <span className={styles.customerName}>{customerName}</span>
        )}
      </div>

      {/* Stepper - center */}
      <div className={styles.wrapper}>
        {STEPS.map((step, index) => {
          const isActive = index === currentStepIndex
          const isCompleted = index < currentStepIndex
          
          return (
            <div 
              key={step.id} 
              className={`
                ${styles.step} 
                ${isActive ? styles.active : ''} 
                ${isCompleted ? styles.completed : ''}
              `}
            >
              <div className={styles.dot}>
                {index + 1}
              </div>
              <span className={styles.label}>{step.label}</span>
              <div className={styles.line} />
            </div>
          )
        })}
      </div>

      {/* Exchange rate - right side */}
      <div className={styles.rateInfo}>
        {formattedRate && (
          <>
            <span className={styles.rateLabel}>Tasa del día</span>
            <span className={styles.rateValue}>Bs. {formattedRate}</span>
          </>
        )}
      </div>
    </div>
  )
}
