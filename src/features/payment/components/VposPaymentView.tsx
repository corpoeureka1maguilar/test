interface VposPaymentViewProps {
  title: string
  vposStatus: 'checking' | 'waiting'
  iframeUrl: string
  onCancel: () => void
}

export function VposPaymentView({ title, vposStatus, iframeUrl, onCancel }: VposPaymentViewProps) {
  return (
    <div className="kiosk-container">
      <h1 className="mb-6 text-center font-extrabold tracking-[-0.05em]">{title}</h1>

      <div className="flex w-full flex-col items-center gap-8">
        {vposStatus === 'checking' ? (
          <>
            <div className="w-14 h-14 border-[5px] border-solid border-[#e0e0e0] border-t-black rounded-full animate-spin [animation-duration:0.8s]" />
            <p>Conectando con el terminal VPOS...</p>
          </>
        ) : (
          <iframe
            src={iframeUrl}
            title="VPOS Checkout"
            className="h-[360px] w-full max-w-[360px] rounded-lg border border-[#cbd5e1]"
          />
        )}

        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar y Volver
          </button>
        </div>
      </div>
    </div>
  )
}
