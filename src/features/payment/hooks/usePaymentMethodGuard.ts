import { useEffect } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { KioskPaymentMethod } from '@/shared/types/types'

// Si no hay un método de pago seleccionado en el context de la state machine
// (p. ej. se entra directo a la ruta de detalle sin pasar por la selección),
// redirige a /pago en vez de renderizar un formulario sin método.
export function usePaymentMethodGuard(method: KioskPaymentMethod | null, navigate: NavigateFunction) {
  useEffect(() => {
    if (!method) navigate('/pago')
  }, [method, navigate])
}
