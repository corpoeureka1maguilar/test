import { useConfigStore } from '@/shared/stores/config'
import { applyAccentColor } from '@/shared/lib/theme'

// Aplica el accentColor persistido ANTES del primer render (cold reload /
// reconexión), sin esperar a que reauthenticate() resuelva. Evita el flash
// del verde por defecto en estaciones que ya tienen un color propio.
export function applyPersistedAccent(): void {
  applyAccentColor(useConfigStore.getState().accentColor)
}
