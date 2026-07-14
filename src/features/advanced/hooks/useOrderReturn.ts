import { useState } from 'react'
import { returnOrder, setRefundCodeToInvoices, KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import { buildNotaCreditoPayload } from '@/shared/lib/printPayload'
import { trackRefund } from '@/shared/lib/metrics'
import type { KioskOrder, KioskPaymentMethod } from '@/shared/types/types'
import type { PendingAdminAction } from './useAdminPinAction'

// Sin IGTF: no se conserva el método de pago original de la orden, así que
// la nota de crédito se emite sin recargo (no hay forma de recalcularlo acá)
const NO_IGTF_METHOD: KioskPaymentMethod = {
  id: 0, name: '', paymentType: 'cash', applyIgtf: false, igtfPercent: 0, journalId: 0, currencyId: 0, useForChange: false
}

export function useOrderReturn(order: KioskOrder | null, requestAdminAction: (action: PendingAdminAction) => void) {
  const { pushToast, setLoading } = useUIStore()
  const config = useConfigStore()
  const sessionId = useSessionStore((s) => s.sessionId)
  const rate = useExchangeRateStore((s) => s.rate)

  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)

  const requestReturn = () => {
    if (!order || !reason.trim()) {
      pushToast('error', 'Indicá el motivo de la devolución')
      return
    }
    requestAdminAction({
      title: 'Confirma para procesar la devolución',
      operationRef: KIOSK_OPERATIONS.saleReturn,
      auditMessage: `Devolución de la orden ${order.name} (${reason})`,
      run: handleReturn
    })
  }

  // La nota debe referenciar la fecha en que la impresora emitió la factura
  // original (x_printer_date, "YYYY-MM-DD HH:MM:SS"); con la fecha actual la
  // impresora rechaza el documento por no coincidir con su memoria fiscal
  const getOriginalInvoiceDate = (o: KioskOrder): { fecha: string; hora: string } => {
    const [datePart, timePart] = (o.printerDate ?? '').split(' ')
    if (datePart && timePart) {
      const [year, month, day] = datePart.split('-')
      return { fecha: `${day}${month}${year}`, hora: timePart.slice(0, 5).replace(':', '') }
    }

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      fecha: `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`,
      hora: `${pad(now.getHours())}${pad(now.getMinutes())}`
    }
  }

  const printNotaCredito = async (o: KioskOrder) => {
    const printer = new FiscalPrinterAdapter(config.printerUrl, config.printerModel)
    const status = await printer.checkConnection()

    const { fecha, hora } = getOriginalInvoiceDate(o)

    // Los montos de Odoo vienen en USD; la impresora fiscal exige Bs y la nota
    // debe calzar con la factura original, así que se usa la tasa de la orden
    const orderRate = o.rate || rate || 1

    const lines = (o.lines ?? []).map((l) => ({
      name: l.productId[1],
      qty: l.productUomQty,
      price: l.priceUnit * orderRate,
      taxRate: l.taxRate
    }))

    const payload = buildNotaCreditoPayload(
      o.printerNumber,
      fecha,
      hora,
      o.partner?.name ?? o.partnerId[1],
      o.partner?.cedula ?? '',
      lines,
      NO_IGTF_METHOD,
      o.amountTotal * orderRate,
      // Igual que fex (maquina = printer.code de la impresora conectada): la
      // devolución ocurre en el mismo kiosco que emitió la factura, así que
      // el serial reportado por la impresora es válido si la orden no lo tiene
      o.printerSerial || status.serial || ''
    )

    return printer.printNotaCredito(payload as Record<string, unknown>)
  }

  const handleReturn = async () => {
    if (!order || !reason.trim()) return

    setLoading(true)
    try {
      await returnOrder(order, reason, sessionId)
      trackRefund()
      setDone(true)
      pushToast('success', 'Devolución procesada correctamente')
    } catch (err) {
      pushToast('error', `Error: ${(err as Error).message}`)
      setLoading(false)
      return
    }

    // La devolución ya se registró en Odoo; un fallo de impresión no debe
    // revertirla, pero sí hay que avisar para que se reimprima manualmente
    try {
      const response = await printNotaCredito(order)
      pushToast('success', 'Nota de crédito impresa correctamente')

      // Fire-and-forget (igual que persistPrinterData en saleMachine): la nota
      // ya salió impresa; si el registro falla solo se pierde el vínculo
      // nota-factura en Odoo, que se puede asignar manualmente después
      const code = String(response.numNota || response.numfactura || '')
      if (code) {
        setRefundCodeToInvoices(order.id, code, response.serial)
          .catch((err) => console.error('[AdvancedMenu] Error registrando n° de nota de crédito en la orden:', err))
      }
    } catch (err) {
      pushToast('error', `Devolución registrada, pero falló la impresión de la nota de crédito: ${(err as Error).message}`, true)
    } finally {
      setLoading(false)
    }
  }

  return { reason, setReason, done, requestReturn }
}
