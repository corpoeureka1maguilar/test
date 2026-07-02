import { createElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/shared/lib/odooRepository', () => ({
  searchOrders: vi.fn().mockResolvedValue([]),
  returnOrder: vi.fn(),
  setRefundCodeToInvoices: vi.fn(),
  fetchExchangeRate: vi.fn().mockResolvedValue(0),
  checkKioskAdmin: vi.fn().mockResolvedValue({ ok: true }),
  KIOSK_OPERATIONS: {
    advancedAccess: 'eu_autopay_bridge.x_pos_audit_autoservicio_advanced_access',
    openSession: 'eu_autopay_bridge.x_pos_audit_autoservicio_open_session',
    terminalConfig: 'eu_autopay_bridge.x_pos_audit_autoservicio_terminal_config',
    saleReturn: 'eu_pos_permission_levels.x_pos_audit_sale_return',
    invoiceReprint: 'eu_pos_permission_levels.x_pos_audit_invoice_reprint',
    shiftClose: 'eu_pos_permission_levels.x_pos_audit_midday_close',
    sessionClose: 'eu_pos_permission_levels.x_pos_audit_session_close'
  }
}))

import { AdvancedMenu } from './AdvancedMenu'

function renderAdvancedMenu() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, createElement(AdvancedMenu))
    )
  )
}

describe('AdvancedMenu', () => {
  it('renders the Menú Avanzado title with the tabs for devoluciones, reimpresión, cierres, terminal y métricas', () => {
    renderAdvancedMenu()

    expect(screen.getByRole('heading', { name: 'Menú Avanzado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Devoluciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reimpresión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cierres de Caja' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Métricas' })).toBeInTheDocument()
  })
})
