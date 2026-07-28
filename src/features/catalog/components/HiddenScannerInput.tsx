import type { RefObject } from 'react'

interface Props {
  searchRef: RefObject<HTMLInputElement>
  search: string
  setSearch: (value: string) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

/** Input oculto para el scanner físico cuando el modal manual está cerrado */
export function HiddenScannerInput({ searchRef, search, setSearch, handleKeyDown }: Props) {
  return (
    <input
      ref={searchRef}
      type="text"
      className="absolute opacity-0 pointer-events-none left-[-9999px]"
      value={search}
      onChange={e => setSearch(e.target.value)}
      onKeyDown={handleKeyDown}
      inputMode="none"
      autoComplete="off"
    />
  )
}
