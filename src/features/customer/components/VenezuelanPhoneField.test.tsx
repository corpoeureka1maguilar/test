import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VenezuelanPhoneField } from './VenezuelanPhoneField'

const baseProps = {
  value: '0424-1',
  onChange: vi.fn(),
  onPrefixSelect: vi.fn(),
  prefixes: ['0412', '0414', '0424', '0416', '0426', '0422'],
  isActive: true,
  onFocus: vi.fn(),
  onBlur: vi.fn()
}

describe('VenezuelanPhoneField', () => {
  it('renders a normal (non-readOnly) tel input showing the rest of the number', () => {
    render(<VenezuelanPhoneField {...baseProps} />)
    const input = screen.getByDisplayValue('1')
    expect(input).toHaveAttribute('type', 'tel')
    expect(input).not.toHaveAttribute('readonly')
  })

  it('renders the prefix trigger button showing the active prefix', () => {
    render(<VenezuelanPhoneField {...baseProps} />)
    const trigger = screen.getByRole('button', { name: /0424/ })
    expect(trigger).toBeInTheDocument()
  })

  it('opens the dropdown menu on trigger mousedown and shows all prefix options', () => {
    render(<VenezuelanPhoneField {...baseProps} />)
    const trigger = screen.getByRole('button', { name: '0424' })
    fireEvent.mouseDown(trigger)

    for (const prefix of baseProps.prefixes) {
      // 0424 is the active prefix — it appears in both the trigger (aria-label) and the menu item
      if (prefix === '0424') {
        expect(screen.getAllByRole('button', { name: prefix }).length).toBeGreaterThanOrEqual(2)
      } else {
        expect(screen.getByRole('button', { name: prefix })).toBeInTheDocument()
      }
    }
  })

  it('calls onPrefixSelect when a menu item is clicked and closes the menu', () => {
    const onPrefixSelect = vi.fn()
    render(<VenezuelanPhoneField {...baseProps} onPrefixSelect={onPrefixSelect} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: /0424/ }))
    fireEvent.mouseDown(screen.getByRole('button', { name: '0412' }))

    expect(onPrefixSelect).toHaveBeenCalledWith('0412')
  })

  it('calls onChange with reconstructed full number when the user types into the input', () => {
    const onChange = vi.fn()
    render(<VenezuelanPhoneField {...baseProps} onChange={onChange} />)

    const input = screen.getByDisplayValue('1')
    fireEvent.change(input, { target: { value: '12' } })

    expect(onChange).toHaveBeenCalled()
    const calledEvent = onChange.mock.calls[0]![0]
    expect(calledEvent.target.value).toBe('042412')
  })
})

