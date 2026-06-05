import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { AppPinModal } from '@/features/payment/components/AppPinModal'
import styles from './Welcome.module.css'

export function Welcome() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const [logoTaps, setLogoTaps] = useState(0)
  const [showPinModal, setShowPinModal] = useState(false)

  const handleStart = () => {
    send({ type: 'START' })
    navigate('/cedula')
  }

  const handleLogoTap = () => {
    const next = logoTaps + 1
    setLogoTaps(next)
    if (next >= 5) {
      setLogoTaps(0)
      setShowPinModal(true)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <button type="button" className={styles.logo} onClick={handleLogoTap}>
          <span className={styles.logoText}>FEX</span>
          <span className={styles.logoSub}>Autopago</span>
        </button>

        <div className={styles.hero}>
          <h1 className={styles.headline}>La mejor forma<br/>de pagar.</h1>
          <p className={styles.sub}>Rápido, seguro y totalmente digital. Pagá tu factura en segundos.</p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.mainBtn} onClick={handleStart}>
            Comenzar
          </button>
          
          <button
            type="button"
            className={styles.devolucionBtn}
            onClick={() => setShowPinModal(true)}
          >
            Opciones Avanzadas
          </button>
        </div>
      </div>

      {showPinModal && (
        <AppPinModal
          onConfirmed={() => {
            setShowPinModal(false)
            navigate('/devolucion')
          }}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </div>
  )

}
