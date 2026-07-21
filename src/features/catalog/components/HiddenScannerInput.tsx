import type { RefObject } from 'react'
import styles from './HiddenScannerInput.module.css'

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
      className={styles.input}
      value={search}
      onChange={e => setSearch(e.target.value)}
      onKeyDown={handleKeyDown}
      inputMode="none"
      autoComplete="off"
    />
  )
}
