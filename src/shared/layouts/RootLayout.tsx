import { useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useInactivityTimer } from '@/shared/hooks/useInactivityTimer'
import { AppStepper } from '@/features/cart/components/AppStepper'

export function RootLayout() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()

  const handleInactive = useCallback(() => {
    send({ type: 'RESET' })
    navigate('/')
  }, [send, navigate])

  useInactivityTimer(90_000, handleInactive)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppStepper />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  )
}
