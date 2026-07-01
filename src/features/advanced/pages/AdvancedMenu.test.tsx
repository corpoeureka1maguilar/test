import { createElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/shared/lib/odooRepository', () => ({
  searchOrders: vi.fn().mockResolvedValue([]),
  returnOrder: vi.fn()
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
  it('renders the Menú Avanzado title with the tabs for devoluciones, cierres, terminal y métricas', () => {
    renderAdvancedMenu()

    expect(screen.getByRole('heading', { name: 'Menú Avanzado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Devoluciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cierres de Caja' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Métricas' })).toBeInTheDocument()
  })
})
