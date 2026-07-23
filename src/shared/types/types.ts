export type PaymentType =
  | 'cash'
  | 'pago_movil'
  | 'card'
  | 'transferencia'
  | 'crypto'
  | 'zelle'
  | 'otro'
  | 'biopago'
  | 'banplus'

export interface KioskPartner {
  id: number
  name: string
  cedula: string
  phone?: string | undefined
  street?: string | undefined
  email?: string | undefined
}

export interface KioskProduct {
  id: number
  name: string
  defaultCode: string
  barcode?: string | undefined
  price: number
  priceUsd: number
  taxRate: number
  categId: number
  categName: string
  uomName: string
  isGiftCard?: boolean
}

export interface CartItem {
  productId: number
  name: string
  defaultCode: string
  price: number
  priceUsd: number
  taxRate: number
  qty: number
  subtotal: number
  isGiftCard?: boolean | undefined
}

export interface GiftCard {
  id: number
  code: string
  amount: number
  balance: number
  state: 'new' | 'available' | 'consumed'
}

export interface KioskPaymentMethod {
  id: number
  name: string
  paymentType: PaymentType
  applyIgtf: boolean
  igtfPercent: number
  journalId: number
  currencyId: number       // requerido por account_payment_fex.currency_id (NOT NULL)
  currencyName?: string
  currencySymbol?: string
  currencyRate?: number
  useForChange: boolean
  withMerchant?: boolean
}

export interface ActivePayment {
  methodId: number
  reference: string
  bank?: string | undefined
  phone?: string | undefined
  amount: number
  igtfAmount: number
}

export interface PrinterApiResponse {
  numNota?: string | undefined
  numReporte?: string | undefined
  numfactura?: string | undefined
  fecha: string
  hora: string
  indimpresion: string
  serial: string
  error?: Record<string, unknown> | undefined
}

export interface PrinterInvoiceData {
  code: string
  date: string
  serial: string
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  sticky?: boolean
}

// Mantenidos para AdvancedMenu.tsx
export interface KioskOrderLine {
  id: number
  productId: [number, string]
  productUomQty: number
  priceUnit: number
  priceSubtotal: number
  /** Tasa de IVA del producto (0.16, 0.08...); sin ella la nota de crédito sale con la tasa general */
  taxRate?: number | undefined
}

export interface KioskOrder {
  id: number
  name: string
  partnerId: [number, string]
  partner?: KioskPartner
  amountTotal: number
  xFexId: string
  orderLine: number[]
  lines?: KioskOrderLine[]
  state: string
  /** N° de la factura fiscal (x_printer_number); sin él no hay reimpresión */
  printerNumber?: string | undefined
  /** Serial de la máquina fiscal que emitió la factura (x_printer_serial_number) */
  printerSerial?: string | undefined
  /** Fecha/hora en que la impresora emitió la factura (x_printer_date, "YYYY-MM-DD HH:MM:SS") */
  printerDate?: string | undefined
  /** Tasa Bs/USD con la que se facturó (manual_rate): los montos de Odoo vienen
   *  en USD y se convierten con ESTA tasa, no la actual, para calzar con la
   *  factura fiscal original */
  rate?: number | undefined
}

export interface AdConfig {
  type: 'image' | 'video' | 'gradient'
  url?: string
  title?: string
  description?: string
  colorStart?: string
  colorEnd?: string
  active: boolean
}

