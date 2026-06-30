import { describe, it, expect } from 'vitest'
import { ves, toFloat, addVES, subVES, mulVES, formatUSD, formatBs, formatVES } from './money'

describe('money', () => {
  it('converts a float amount to a dinero VES object and back', () => {
    expect(toFloat(ves(125.5))).toBe(125.5)
  })

  it('adds two VES amounts', () => {
    expect(toFloat(addVES(ves(10.25), ves(5.5)))).toBe(15.75)
  })

  it('subtracts two VES amounts', () => {
    expect(toFloat(subVES(ves(10), ves(3.25)))).toBe(6.75)
  })

  it('multiplies a VES amount by a decimal factor', () => {
    expect(toFloat(mulVES(ves(100), 0.16))).toBe(16)
  })

  it('formats USD with two decimals', () => {
    expect(formatUSD(1234.5)).toBe('$1,234.50')
  })

  it('formats VES with Bs. prefix and comma decimals', () => {
    expect(formatBs(1234.56)).toBe('Bs.1.234,56')
  })

  it('formats a zero VES amount', () => {
    expect(formatVES(ves(0))).toBe('Bs.0,00')
  })
})
