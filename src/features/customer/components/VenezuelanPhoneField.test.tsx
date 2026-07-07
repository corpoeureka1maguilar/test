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
  it('renders a normal (non-readOnly) tel input so it integrates with the global keyboard', () => {
    render(<VenezuelanPhoneField {...baseProps} />)
    const input = screen.getByDisplayValue('0424-1')
    expect(input).toHaveAttribute('type', 'tel')
    expect(input).not.toHaveAttribute('readonly')
  })

  it('renders a carrier quick-select button for every prefix while active', () => {
    render(<VenezuelanPhoneField {...baseProps} />)
    for (const prefix of baseProps.prefixes) {
      expect(screen.getByRole('button', { name: prefix })).toBeInTheDocument()
    }
  })

  it('hides the prefix buttons when not active', () => {
    render(<VenezuelanPhoneField {...baseProps} isActive={false} />)
    expect(screen.queryByRole('button', { name: '0424' })).not.toBeInTheDocument()
  })

  it('calls onPrefixSelect with the tapped carrier prefix', () => {
    const onPrefixSelect = vi.fn()
    render(<VenezuelanPhoneField {...baseProps} onPrefixSelect={onPrefixSelect} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: '0424' }))

    expect(onPrefixSelect).toHaveBeenCalledWith('0424')
  })

  it('calls onChange when the user types into the input', () => {
    const onChange = vi.fn()
    render(<VenezuelanPhoneField {...baseProps} onChange={onChange} />)

    fireEvent.change(screen.getByDisplayValue('0424-1'), { target: { value: '0424-12' } })

    expect(onChange).toHaveBeenCalled()
  })
})
