import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartStore, useCartTotal, useCartSubtotal, useCartTaxBreakdown } from '@/features/cart/stores/cart'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'

// Celdas de encabezado/cuerpo de la tabla (antes .table th, .table td)
const thClass = 'p-4 px-5 border-b border-surface-border font-medium text-[0.9rem] uppercase tracking-[0.1em] text-text-muted bg-surface text-left'
const tdClass = 'p-4 px-5 border-b border-surface-border text-[1.1rem] text-text'
const tdRightClass = `${tdClass} text-right`
const amountUsdClass = 'block text-[0.75em] text-text-muted font-normal tracking-[0.01em] mt-[0.1em] tabular-nums text-end'

export function CartReview() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { items, setQty, removeItem } = useCartStore()
  const total = useCartTotal()
  const subtotal = useCartSubtotal()
  const taxBreakdown = useCartTaxBreakdown()
  const rate = useExchangeRateStore((s) => s.rate)

  const handlePay = () => {
    if (items.length === 0) return
    send({ type: 'CHECKOUT', cart: items })
    navigate('/lealtad')
  }

  return (
    <div className="kiosk-container">
      <h2 className="m-0 mb-6">Tu Carrito</h2>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-8 py-12 px-6 text-text-muted text-[1.3rem] font-normal">
          <p>Tu carrito está vacío</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/productos')}>
            Ver productos
          </button>
        </div>
      ) : (
        <>
          <div className="glass-card p-0 overflow-hidden rounded-[24px]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Producto</th>
                  <th className={thClass}>Precio</th>
                  <th className={thClass}>Cantidad</th>
                  <th className={thClass}>Subtotal</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.productId}>
                    <td className={tdClass}>
                      <div className="font-normal text-[1.15rem] tracking-[-0.02em] text-text">
                        {item.name}
                        {item.taxRate === 0 && <span className="opacity-60 ml-1 font-normal">(E)</span>}
                      </div>
                      {item.defaultCode && <div className="text-[0.85rem] text-text-muted font-medium">{item.defaultCode}</div>}
                    </td>
                    <td className={tdRightClass}>{formatBs(item.price)}<span className={amountUsdClass}>{formatUSD(item.priceUsd)}</span></td>
                    <td className={tdRightClass}>
                      <div className="inline-flex items-center gap-4 bg-white p-1 rounded-[50px]">
                        <button type="button" className="w-10 h-10 border-none rounded-full bg-surface-heavy text-text text-[1.1rem] font-light cursor-pointer font-app flex items-center justify-center transition-[transform,background-color] duration-200 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] shadow-[0_2px_6px_rgba(0,0,0,0.05)] active:scale-[0.96] active:bg-surface-hover" onClick={() => setQty(item.productId, item.qty - 1)}>−</button>
                        <span className="text-[1.2rem] font-semibold min-w-[2rem] text-center tabular-nums">{item.qty}</span>
                        <button type="button" className="w-10 h-10 border-none rounded-full bg-surface-heavy text-text text-[1.1rem] font-light cursor-pointer font-app flex items-center justify-center transition-[transform,background-color] duration-200 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] shadow-[0_2px_6px_rgba(0,0,0,0.05)] active:scale-[0.96] active:bg-surface-hover" onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
                      </div>
                    </td>
                    <td className="p-4 px-5 border-b border-surface-border text-right font-bold text-text text-[1.2rem] tabular-nums">{formatBs(item.subtotal)}<span className={amountUsdClass}>{formatUSD(item.priceUsd * item.qty)}</span></td>
                    <td className={tdRightClass}>
                      <button type="button" className="bg-transparent border-none text-text-muted text-[1.2rem] w-10 h-10 rounded-full cursor-pointer flex items-center justify-center transition-[transform,color,opacity] duration-200 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] hover:text-danger active:scale-[0.96] active:opacity-50" onClick={() => removeItem(item.productId)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 w-full">
            <div className="flex justify-between items-baseline py-4 text-[1.3rem] font-medium text-text-muted tabular-nums">
              <span>Subtotal</span>
              <span>{formatBs(subtotal)}{rate > 0 && <span className={amountUsdClass}>{formatUSD(subtotal / rate)}</span>}</span>
            </div>
            {taxBreakdown.map((tax) => (
              <div key={tax.rate} className="flex justify-between items-baseline py-4 text-[1.3rem] font-medium text-text-muted tabular-nums">
                <span>{tax.label}</span>
                <span>{formatBs(tax.amount)}{rate > 0 && <span className={amountUsdClass}>{formatUSD(tax.amount / rate)}</span>}</span>
              </div>
            ))}
            <div className="flex justify-between items-baseline py-4 text-[1.3rem] font-medium text-text-muted tabular-nums mt-4 border-t border-surface-border pt-8">
              <span className="text-text text-[2rem] font-semibold">Total</span>
              <strong className="text-[length:var(--font-total)] font-bold text-accent tracking-[-0.04em] tabular-nums">{formatBs(total)}{rate > 0 && <span className={amountUsdClass}>{formatUSD(total / rate)}</span>}</strong>
            </div>
          </div>

          <div className="flex gap-4 mt-6 w-full desktop:justify-center">
            <button type="button" className="btn btn-secondary flex-1 h-[70px] text-[1.3rem] font-bold desktop:flex-[0_1_340px]" onClick={() => navigate('/productos')}>
              Volver
            </button>
            <button type="button" className="btn btn-accent flex-1 h-[70px] text-[1.3rem] font-bold desktop:flex-[0_1_340px]" onClick={handlePay}>
              Finalizar Compra
            </button>
          </div>
        </>
      )}
    </div>

  )

}
