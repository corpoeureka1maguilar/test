import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/shared/lib/odooRepository', () => ({
  checkKioskAdmin: vi.fn(),
  KIOSK_OPERATIONS: {
    saleReturn: 'eu_pos_permission_levels.x_pos_audit_sale_return'
  }
}))

vi.mock('@/shared/lib/adminSnapshot', () => ({
  verifyAdminOffline: vi.fn()
}))

import { checkKioskAdmin } from '@/shared/lib/odooRepository'
import { verifyAdminOffline } from '@/shared/lib/adminSnapshot'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import { AppPinModal } from './AppPinModal'

const checkKioskAdminMock = checkKioskAdmin as ReturnType<typeof vi.fn>
const verifyAdminOfflineMock = verifyAdminOffline as ReturnType<typeof vi.fn>
const OPERATION = 'eu_pos_permission_levels.x_pos_audit_sale_return' as const

function typePinViaScanner(pin: string) {
  const input = document.querySelector('input[aria-hidden="true"]') as HTMLInputElement
  fireEvent.change(input, { target: { value: pin } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

beforeEach(() => {
  checkKioskAdminMock.mockReset()
  verifyAdminOfflineMock.mockReset()
  useConfigStore.setState({ isConnectionReady: true, branchId: 7 })
  useSessionStore.setState({ sessionId: 42 })
})

describe('AppPinModal', () => {
  it('validates against Odoo when the connection is ready', async () => {
    checkKioskAdminMock.mockResolvedValueOnce({ ok: true })
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('1234')

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(checkKioskAdminMock).toHaveBeenCalledWith('1234', OPERATION, 7, 42, undefined)
    expect(verifyAdminOfflineMock).not.toHaveBeenCalled()
  })

  it('shows a permission message when Odoo answers no_allowed', async () => {
    checkKioskAdminMock.mockResolvedValueOnce({ ok: false, error: 'no_allowed' })
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('1234')

    await waitFor(() => expect(screen.getByText(/No tenés permiso/)).toBeInTheDocument())
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('falls back to the admin snapshot when the backend call fails', async () => {
    checkKioskAdminMock.mockRejectedValueOnce(new Error('network down'))
    verifyAdminOfflineMock.mockResolvedValueOnce({ ok: true, approverCashierId: 3, approverName: 'Ana' })
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('9999')

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(verifyAdminOfflineMock).toHaveBeenCalledWith('9999', OPERATION, undefined)
  })

  it('goes straight to the snapshot when the kiosk is offline', async () => {
    useConfigStore.setState({ isConnectionReady: false })
    verifyAdminOfflineMock.mockResolvedValueOnce({ ok: true })
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('1234')

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))
    expect(checkKioskAdminMock).not.toHaveBeenCalled()
  })

  // Sin PIN local de terminal, un snapshot vencido significa que NO hay forma de
  // aprobar nada hasta que vuelva Odoo. Tiene que decirlo explícitamente en vez
  // de hacer pasar el caso por "PIN incorrecto".
  it('reports an expired snapshot instead of blaming the PIN', async () => {
    useConfigStore.setState({ isConnectionReady: false })
    verifyAdminOfflineMock.mockResolvedValueOnce({ ok: false, error: 'snapshot_unavailable' })
    const onConfirmed = vi.fn()

    render(<AppPinModal operationRef={OPERATION} onConfirmed={onConfirmed} onCancel={vi.fn()} />)
    typePinViaScanner('1234')

    await waitFor(() => expect(screen.getByText(/sin validación local vigente/)).toBeInTheDocument())
    expect(screen.queryByText(/intento/)).not.toBeInTheDocument()
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('maps an unknown admin to a plain wrong-PIN message', async () => {
    useConfigStore.setState({ isConnectionReady: false })
    verifyAdminOfflineMock.mockResolvedValueOnce({ ok: false, error: 'admin_not_found' })

    render(<AppPinModal operationRef={OPERATION} onConfirmed={vi.fn()} onCancel={vi.fn()} />)
    typePinViaScanner('0000')

    await waitFor(() => expect(screen.getByText(/PIN incorrecto/)).toBeInTheDocument())
  })
})
