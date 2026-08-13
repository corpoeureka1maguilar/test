interface Props {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  masked?: boolean
  onConfirm?: () => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'] as const

export function AppNumericKeyboard({ value, onChange, maxLength = 6, masked = false, onConfirm }: Props) {
  const handleKey = (key: string) => {
    if (key === '←') {
      onChange(value.slice(0, -1))
    } else if (key === '✓') {
      onConfirm?.()
    } else if (value.length < maxLength) {
      onChange(value + key)
    }
  }

  const display = masked ? '●'.repeat(value.length) : value

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[420px] mx-auto desktop:max-w-[380px]">
      {/* Display interno oculto: choca con los layouts de página */}
      <div className="hidden">{display || <span>—</span>}</div>
      <div className="grid grid-cols-3 gap-[0.8rem] w-full desktop:gap-[0.75rem]">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`h-[100px] w-[100px] mx-auto text-[3rem] font-app font-medium bg-surface text-text border-none rounded-full cursor-pointer transition-[transform,background-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.02)] active:bg-surface-heavy active:scale-[0.96] active:shadow-none desktop:h-[clamp(54px,8vh,76px)] desktop:w-[clamp(54px,8vh,76px)] desktop:text-[1.65rem] desktop:hover:bg-surface-hover ${key === '✓' ? 'text-[1.4rem] text-accent desktop:text-[1.3rem]' : ''} ${key === '←' ? 'text-[1.4rem] text-text-muted desktop:text-[1.3rem]' : ''}`}
            onClick={() => handleKey(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
