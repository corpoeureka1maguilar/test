import { createContext, useContext, type ReactNode } from 'react'
import { useMachine } from '@xstate/react'
import { saleMachine, type SaleContext, type SaleEvent } from './saleMachine'
import type { StateValue } from 'xstate'

interface SaleMachineContextValue {
  state: StateValue
  context: SaleContext
  send: (event: SaleEvent) => void
  matches: (state: string) => boolean
}

const SaleMachineCtx = createContext<SaleMachineContextValue | null>(null)

export function SaleMachineProvider({ children }: { children: ReactNode }) {
  const [snapshot, send] = useMachine(saleMachine)

  const value: SaleMachineContextValue = {
    state: snapshot.value,
    context: snapshot.context,
    send,
    matches: (s) => snapshot.matches(s as Parameters<typeof snapshot.matches>[0])
  }

  return <SaleMachineCtx.Provider value={value}>{children}</SaleMachineCtx.Provider>
}

export function useSaleMachine(): SaleMachineContextValue {
  const ctx = useContext(SaleMachineCtx)
  if (!ctx) throw new Error('useSaleMachine must be used within SaleMachineProvider')
  return ctx
}
