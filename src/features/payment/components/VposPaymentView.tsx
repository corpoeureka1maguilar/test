interface VposPaymentViewProps {
  title: string
  vposStatus: 'checking' | 'waiting'
  amountBs?: number
  onCancel: () => void
}

export function VposPaymentView({ title, vposStatus, amountBs, onCancel }: VposPaymentViewProps) {
  return (
    <div className="kiosk-container">
      <h1 className="mb-6 text-center font-extrabold tracking-[-0.05em]">{title}</h1>

      <div className="flex w-full flex-col items-center gap-8 py-6">
        {vposStatus === 'checking' ? (
          <>
            <div className="h-14 w-14 animate-spin rounded-full border-[5px] border-solid border-[#e0e0e0] border-t-black [animation-duration:0.8s]" />
            <p className="text-lg font-medium text-slate-700">Conectando con el terminal de pago...</p>
          </>
        ) : (
          <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 animate-pulse">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-800">Procesando pago en el punto de venta</h2>
              <p className="mt-2 text-sm text-slate-600">
                Por favor, deslice o inserte su tarjeta en el punto de venta e ingrese su clave cuando se le solicite.
              </p>
            </div>

            {amountBs !== undefined && (
              <div className="w-full rounded-xl bg-slate-50 p-4 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monto a pagar</span>
                <div className="text-2xl font-extrabold text-slate-900">
                  Bs. {amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex w-full flex-col items-center gap-4">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar y Volver
          </button>
        </div>
      </div>
    </div>
  )
}
