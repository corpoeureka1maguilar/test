import { WarningCircle } from '@phosphor-icons/react'

interface Props {
  code: string
}

/** Toast de producto no encontrado */
export function NotFoundToast({ code }: Props) {
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-red-100 border border-red-300 text-red-800 px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-[2000] font-bold text-base pointer-events-none animate-bounce">
      <WarningCircle size={24} weight="fill" className="text-red-600 shrink-0" />
      <span>Producto no encontrado: &quot;{code}&quot;</span>
    </div>
  )
}
