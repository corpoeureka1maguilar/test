import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { FiscalPrinterAdapter, noFiscalItem } from '@/shared/lib/fiscalPrinter'
import { formatBs } from '@/shared/lib/money'
import type { KioskOrder } from '@/shared/types/types'
import type { PendingAdminAction } from './useAdminPinAction'

export function useOrderReprint(order: KioskOrder | null, requestAdminAction: (action: PendingAdminAction) => void) {
  const { pushToast, setLoading } = useUIStore()
  const config = useConfigStore()
  const rate = useExchangeRateStore((s) => s.rate)

  const requestReprint = () => {
    if (!order) return
    requestAdminAction({
      title: 'Confirma para reimprimir la factura',
      operationRef: KIOSK_OPERATIONS.invoiceReprint,
      auditMessage: order.printerNumber
        ? `Reimpresión de la factura ${order.printerNumber} (orden ${order.name})`
        : `Reimpresión no fiscal de la orden ${order.name} (sin número fiscal registrado)`,
      run: handleReprint
    })
  }

  // Si la orden no tiene número fiscal registrado en Odoo (x_printer_number),
  // se reimprime una copia no fiscal en vez de bloquear la operación
  const buildNoFiscalReceipt = (o: KioskOrder) => {
    // Montos de Odoo en USD → Bs con la tasa histórica de la orden
    const orderRate = o.rate || rate || 1
    const separator = noFiscalItem('-'.repeat(30), 'NC')
    const items = [
      noFiscalItem(o.name, 'N'),
      noFiscalItem(o.partnerId[1]),
      separator
    ]
    o.lines?.forEach((line) => {
      items.push(
        noFiscalItem(line.productId[1]),
        noFiscalItem(`${formatBs(line.priceUnit * orderRate)} x ${line.productUomQty}`),
        noFiscalItem(`Subtotal: ${formatBs(line.priceSubtotal * orderRate)}`),
        separator
      )
    })
    items.push(noFiscalItem(`TOTAL: ${formatBs(o.amountTotal * orderRate)}`, 'NC'))
    return items
  }

  const handleReprint = async () => {
    if (!order) return

    setLoading(true)
    try {
      const printer = new FiscalPrinterAdapter(config.printerUrl, config.printerModel)
      await printer.checkConnection()

      if (order.printerNumber) {
        // La impresora fiscal reimprime desde su memoria por n° de factura:
        // mismo formato que el POS, numérico con padding a 7 dígitos
        let code = order.printerNumber
        if (/^\d+$/.test(code)) code = String(Number(code)).padStart(7, '0')
        code = code.slice(0, 7)
        await printer.sendRequest('PrintReimpresion', { tipo: 'F', desde: code, hasta: code })
        pushToast('success', `Factura ${order.printerNumber} reimpresa con éxito`)
      } else {
        await printer.printNoFiscal(buildNoFiscalReceipt(order))
        pushToast('success', 'Copia no fiscal de la orden impresa con éxito')
      }
    } catch (err) {
      pushToast('error', `Error al reimprimir: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return { requestReprint }
}
