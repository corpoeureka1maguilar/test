import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/shared/lib/odooRepository', () => ({
  checkKioskAdmin: vi.fn(),
  KIOSK_OPERATIONS: {
    saleReturn: 'eu_pos_permission_levels.x_pos_audit_sale_return'
  }
}))

import { checkKioskAdmin } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import { AppPinModal } from './AppPinModal'

const checkKioskAdminMock = checkKioskAdmin as ReturnType<typeof vi.fn>
const OPERATION = 'eu_pos_permission_levels.x_pos_audit_sale_return' as const

function typePinViaScanner(pin: string) {
  const input = document.querySelector('input[aria-hidden="true"]') as HTMLInputElement
  fireEvent.change(input, { target: { value: pin } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

beforeEach(() => {
  checkKioskAdminMock.mockReset()
  useConfigStore.setState({ isConnectionReady: true, branchId: 7 })
  useSessionStore.setState({ sessionId: 42 })
})

describe('AppPinModal', () => {
  it('validates against Odoo when an operationRef is given and the connection is ready', async () => {
    checkKioskAdminMock.mockResolvedValueOnce({ ok: true })
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('1234')

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(checkKioskAdminMock).toHaveBeenCalledWith('1234', OPERATION, 7, 42, undefined)
  })

  it('shows a permission message when Odoo answers no_allowed', async () => {
    checkKioskAdminMock.mockResolvedValueOnce({ ok: false, error: 'no_allowed' })
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('1234')

    await waitFor(() => expect(screen.getByText(/No tenés permiso/)).toBeInTheDocument())
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('falls back to the local PIN when the backend call fails', async () => {
    checkKioskAdminMock.mockRejectedValueOnce(new Error('network down'))
    useConfigStore.setState({ verifyPin: async (pin: string) => pin === '9999' } as never)
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('9999')

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
  })

  it('uses the local PIN when no operationRef is given', async () => {
    useConfigStore.setState({ verifyPin: async (pin: string) => pin === '1111' } as never)
    const onConfirmed = vi.fn()

    render(<AppPinModal onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('1111')

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(checkKioskAdminMock).not.toHaveBeenCalled()
  })
})
