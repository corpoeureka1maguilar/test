import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'

interface Props {
  amountStr: string
  setAmountStr: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

/** Modal de monto para la compra de una tarjeta de regalo */
export function GiftCardAmountModal({ amountStr, setAmountStr, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[3000] p-4 animate-fadeIn" onClick={onCancel}>
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5 text-white animate-scaleIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-extrabold text-slate-100 m-0">Monto de la Tarjeta</h3>
          <span className="text-sm text-slate-400">Ingrese el monto a recargar en USD</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Monto ($)</span>
          <div className="bg-black/30 border border-white/10 rounded-2xl p-4 text-3xl font-black text-center text-emerald-400 tabular-nums">
            {amountStr ? `$ ${amountStr}` : <span className="opacity-30">$ 0.00</span>}
          </div>
        </div>
        <AppNumericKeyboard
          value={amountStr}
          onChange={setAmountStr}
          maxLength={5}
          onConfirm={onConfirm}
        />
        <div className="flex gap-3">
          <button
            type="button"
            className="w-full h-13 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base transition-all active:scale-95 cursor-pointer"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
