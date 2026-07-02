import { describe, it, expect } from 'vitest'
import { OdooServerError, isMissingRecordError } from './odooEnv'

describe('odooEnv — isMissingRecordError', () => {
  it('detects MissingError by the Odoo exception name', () => {
    const err = new OdooServerError('Odoo Server Error', 'odoo.exceptions.MissingError')
    expect(isMissingRecordError(err)).toBe(true)
  })

  it('detects MissingError by message when the exception name is absent (EN and ES)', () => {
    expect(isMissingRecordError(new OdooServerError('Record does not exist or has been deleted.'))).toBe(true)
    expect(isMissingRecordError(new OdooServerError('El registro no existe o ha sido eliminado.'))).toBe(true)
  })

  it('does not flag other Odoo errors or plain errors as missing-record', () => {
    expect(isMissingRecordError(new OdooServerError('Access Denied', 'odoo.exceptions.AccessError'))).toBe(false)
    expect(isMissingRecordError(new Error('Record does not exist or has been deleted.'))).toBe(false)
    expect(isMissingRecordError('ABORTED')).toBe(false)
  })
})
