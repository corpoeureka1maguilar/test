import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerSchema, makeRegisterSchema, useRegisterForm } from './useRegisterForm'

describe('registerSchema validation', () => {
  const validData = {
    name: 'Juan Perez',
    phone: '0412-1234567',
    estado: 'Miranda',
    street: 'Calle Principal 123',
    email: 'juan@example.com'
  }

  it('passes validation for valid data', () => {
    const result = registerSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('fails if name is empty', () => {
    const result = registerSchema.safeParse({ ...validData, name: '' })
    expect(result.success).toBe(false)
  })

  it('fails if phone is invalid', () => {
    const result = registerSchema.safeParse({ ...validData, phone: '123' })
    expect(result.success).toBe(false)
  })

  it('fails if estado is empty or less than 5 characters', () => {
    // Required (min 1)
    const emptyResult = registerSchema.safeParse({ ...validData, estado: '' })
    expect(emptyResult.success).toBe(false)

    // Min 5 characters
    const shortResult = registerSchema.safeParse({ ...validData, estado: 'Zul' })
    expect(shortResult.success).toBe(false)
  })

  it('fails if street (dirección) is empty or less than 5 characters', () => {
    // Required (min 1)
    const emptyResult = registerSchema.safeParse({ ...validData, street: '' })
    expect(emptyResult.success).toBe(false)

    // Min 5 characters
    const shortResult = registerSchema.safeParse({ ...validData, street: 'Av 1' })
    expect(shortResult.success).toBe(false)
  })
})

describe('makeRegisterSchema(isVenezuelan)', () => {
  const base = {
    name: 'Juan Perez',
    estado: 'Miranda',
    street: 'Calle Principal 123',
    email: 'juan@example.com'
  }

  it('makeRegisterSchema(true) behaves exactly like the back-compat registerSchema', () => {
    const veSchema = makeRegisterSchema(true)
    expect(veSchema.safeParse({ ...base, phone: '0412-1234567' }).success).toBe(true)
    expect(veSchema.safeParse({ ...base, phone: '123' }).success).toBe(false)
  })

  it('makeRegisterSchema(false) accepts a valid international phone', () => {
    const intlSchema = makeRegisterSchema(false)
    expect(intlSchema.safeParse({ ...base, phone: '+573101234567' }).success).toBe(true)
  })

  it('makeRegisterSchema(false) rejects a VE-only format that is not a valid + number', () => {
    const intlSchema = makeRegisterSchema(false)
    expect(intlSchema.safeParse({ ...base, phone: '0412-1234567' }).success).toBe(false)
  })

  it('makeRegisterSchema(false) rejects out-of-range digit counts', () => {
    const intlSchema = makeRegisterSchema(false)
    expect(intlSchema.safeParse({ ...base, phone: '+123456' }).success).toBe(false)
    expect(intlSchema.safeParse({ ...base, phone: '+1234567890123456' }).success).toBe(false)
  })
})

describe('useRegisterForm — country-aware phone delegation', () => {
  it('derives Venezuelan mode and exposes VE carrier prefixes when vat starts with V-', () => {
    const { result } = renderHook(() => useRegisterForm({ branchState: 'Miranda', vat: 'V-12345678' }))
    expect(result.current.phoneInput.prefixes).toEqual(['0412', '0414', '0424', '0416', '0426', '0422'])
  })

  it('derives international mode and exposes no quick-select prefixes when vat does not start with V-', () => {
    const { result } = renderHook(() => useRegisterForm({ branchState: 'Miranda', vat: 'E-12345678' }))
    expect(result.current.phoneInput.prefixes).toEqual([])
  })

  it('does not carry over the previous mode formatting when the nationality signal switches', () => {
    const { result, rerender } = renderHook(
      ({ vat }: { vat: string }) => useRegisterForm({ branchState: 'Miranda', vat }),
      { initialProps: { vat: 'V-12345678' } }
    )

    act(() => result.current.phoneInput.onPrefixSelect('0424'))
    act(() => result.current.phoneInput.onChange({ target: { value: '0424-1' } } as React.ChangeEvent<HTMLInputElement>))
    expect(result.current.phoneInput.value).toBe('0424-1')

    rerender({ vat: 'E-12345678' })

    expect(result.current.phoneInput.value).toBe('')
    expect(result.current.phoneInput.prefixes).toEqual([])
  })
})
