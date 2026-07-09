import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConfigStore } from '@/shared/stores/config'
import { applyAccentColor } from '@/shared/lib/theme'
import { applyPersistedAccent } from './bootstrapTheme'

vi.mock('@/shared/lib/theme', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/lib/theme')>()
  return {
    ...original,
    applyAccentColor: vi.fn()
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('bootstrapTheme — applyPersistedAccent', () => {
  it('applies the persisted accentColor from the config store eagerly, without waiting for reauthenticate', () => {
    useConfigStore.setState({ accentColor: '#3b82f6' })

    applyPersistedAccent()

    expect(applyAccentColor).toHaveBeenCalledWith('#3b82f6')
    expect(applyAccentColor).toHaveBeenCalledTimes(1)
  })
})
