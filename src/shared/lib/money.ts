import { dinero, add, subtract, multiply, toDecimal } from 'dinero.js'

export const VES = {
  code: 'VES',
  base: 10,
  exponent: 2,
}

export function ves(amount: number) {
  return dinero({ amount: Math.round(amount * 100), currency: VES })
}

export function toFloat(d: any): number {
  return parseFloat(toDecimal(d))
}

export function addVES(d1: any, d2: any) {
  return add(d1, d2)
}

export function subVES(d1: any, d2: any) {
  return subtract(d1, d2)
}

export function mulVES(d: any, multiplier: number) {
  return multiply(d, { amount: Math.round(multiplier * 100), scale: 2 })
}

export function formatBs(amount: number): string {
  return formatVES(ves(amount))
}

export function formatVES(d: any): string {
  return toDecimal(d, ({ value, currency }) => {
    const [intPart, decPart = ''] = value.split('.')
    const paddedDec = decPart.padEnd(currency.exponent as number, '0')
    const formattedInt = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseInt(intPart, 10))
    return `Bs. ${formattedInt},${paddedDec}`
  })
}
