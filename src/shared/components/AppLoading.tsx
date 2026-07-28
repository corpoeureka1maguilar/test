import { useUIStore } from '@/shared/stores/ui'

export function AppLoading() {
  const loading = useUIStore((s) => s.loading)
  if (!loading) return null

  return (
    <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-[900]">
      <div className="w-14 h-14 border-[5px] border-solid border-[#e0e0e0] border-t-black rounded-full animate-spin [animation-duration:0.8s]" />
    </div>
  )
}
