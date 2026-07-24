import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VposAmountInput } from './VposAmountInput'

// generic-partial-payment (post-design decision 0.2, tasks 3.3/3.4): input
// del monto de la pierna VPOS. Pre-llenado con `remainingAmount ?? total`
// (nunca vacío), editable SOLO hacia abajo (max = remanente). Confirmar sin
// editar preserva el comportamiento de hoy (una sola pierna VPOS cierra el
// remanente completo).

describe('VposAmountInput — pre-filled/editable-down VPOS leg amount', () => {
  it('mounts pre-filled with remainingAmount when a remainder already exists', () => {
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={80} total={200} onConfirm={vi.fn()} onBack={vi.fn()} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('80')
  })

  it('falls back to total when remainingAmount is null (regression: single VPOS-only sale, no gift card)', () => {
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={null} total={200} onConfirm={vi.fn()} onBack={vi.fn()} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('200')
  })

  it('never mounts empty', () => {
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={0} total={200} onConfirm={vi.fn()} onBack={vi.fn()} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).not.toBe('')
  })

  it('sets max to the remainder (never total, when a remainder is smaller)', () => {
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={80} total={200} onConfirm={vi.fn()} onBack={vi.fn()} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.max).toBe('80')
  })

  it('rejects (clamps) a typed value above the remainder — confirming never delivers more than the remainder', () => {
    const onConfirm = vi.fn()
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={80} total={200} onConfirm={onConfirm} onBack={vi.fn()} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '999' } })

    expect(Number(input.value)).toBeLessThanOrEqual(80)

    fireEvent.click(screen.getByText('Confirmar monto'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0]![0]).toBeLessThanOrEqual(80)
  })

  it('confirming WITHOUT editing proceeds with the untouched full remainder (regression: today\'s single closing VPOS leg)', () => {
    const onConfirm = vi.fn()
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={80} total={200} onConfirm={onConfirm} onBack={vi.fn()} />)

    fireEvent.click(screen.getByText('Confirmar monto'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(80)
  })

  it('editing DOWN to a smaller valid value and confirming delivers exactly that value as the leg amount', () => {
    const onConfirm = vi.fn()
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={80} total={200} onConfirm={onConfirm} onBack={vi.fn()} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.click(screen.getByText('Confirmar monto'))

    expect(onConfirm).toHaveBeenCalledWith(30)
  })

  it('disables confirm when the field is cleared to empty (never free-form/empty submission)', () => {
    const onConfirm = vi.fn()
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={80} total={200} onConfirm={onConfirm} onBack={vi.fn()} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })

    expect(screen.getByText('Confirmar monto')).toBeDisabled()
    fireEvent.click(screen.getByText('Confirmar monto'))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onBack when the cancel action is used', () => {
    const onBack = vi.fn()
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={80} total={200} onConfirm={vi.fn()} onBack={onBack} />)

    fireEvent.click(screen.getByText('Cancelar y volver'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders total purchase amount and remaining amount after payment row', () => {
    render(<VposAmountInput title="Terminal Banesco (VPOS)" remainingAmount={100} total={200} onConfirm={vi.fn()} onBack={vi.fn()} />)

    expect(screen.getByText('Total de la compra')).toBeInTheDocument()
    expect(screen.getByText('Saldo pendiente actual')).toBeInTheDocument()
    expect(screen.getByText('Monto restante después de este pago')).toBeInTheDocument()
  })
})

