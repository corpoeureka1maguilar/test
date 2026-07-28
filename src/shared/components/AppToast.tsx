import { useEffect } from 'react'
import { useUIStore } from '@/shared/stores/ui'
import type { Toast } from '@/shared/types/types'

// Tailwind no puede indexar clases dinámicamente (styles[toast.type]), por
// eso se resuelve con un mapa explícito de strings literales por tipo
const TOAST_TYPE_CLASSES: Record<Toast['type'], string> = {
  success: 'bg-[#24ff07] text-[#998181]',
  error: 'bg-[#dc3545] text-white',
  warning: 'bg-[#ffc107] text-black',
  info: 'bg-black text-white'
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.sticky) return
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.sticky, onDismiss])

  return (
    <div
      className={`p-[1rem_1.5rem] rounded-xl text-[1.1rem] font-semibold cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.15)] animate-slideUp ${TOAST_TYPE_CLASSES[toast.type]}`}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.message}
    </div>
  )
}

export function AppToast() {
  const { toasts, dismissToast } = useUIStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-3 z-[2000] min-w-[320px] max-w-[600px]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
