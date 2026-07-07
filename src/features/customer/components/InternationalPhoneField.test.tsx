import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InternationalPhoneField } from './InternationalPhoneField'

const baseProps = {
  value: '+573101234567',
  onChange: vi.fn(),
  onFocus: vi.fn(),
  onBlur: vi.fn()
}

describe('InternationalPhoneField', () => {
  it('does not render any Venezuelan carrier buttons', () => {
    render(<InternationalPhoneField {...baseProps} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a normal (non-readOnly) tel input so it integrates with the global keyboard', () => {
    render(<InternationalPhoneField {...baseProps} />)
    const input = screen.getByDisplayValue('+573101234567')
    expect(input).toHaveAttribute('type', 'tel')
    expect(input).not.toHaveAttribute('readonly')
  })

  it('calls onChange when the user types into the input', () => {
    const onChange = vi.fn()
    render(<InternationalPhoneField {...baseProps} onChange={onChange} />)

    fireEvent.change(screen.getByDisplayValue('+573101234567'), { target: { value: '+5731012345678' } })

    expect(onChange).toHaveBeenCalled()
  })
})
