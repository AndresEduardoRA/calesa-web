import { describe, expect, it } from 'vitest'

import { momentosDeRecordatorio } from './recordatorios'

// La reunión de ejemplo: mar 3 nov 2026, 10:00 en La Paz (14:00 UTC).
const inicio = '2026-11-03T14:00:00Z'

describe('momentosDeRecordatorio', () => {
  it('reservada lun 08:00: 24 h el lun 10:00 y 1 h el mar 09:00 (hora de La Paz)', () => {
    expect(momentosDeRecordatorio({ reservadaEn: '2026-11-02T12:00:00Z', inicio })).toEqual({
      r24: '2026-11-02T14:00:00.000Z',
      r1: '2026-11-03T13:00:00.000Z',
    })
  })

  it('reservada lun 22:00 (12 h antes): no hay de 24 h, sí de 1 h', () => {
    const momentos = momentosDeRecordatorio({ reservadaEn: '2026-11-03T02:00:00Z', inicio })
    expect(momentos.r24).toBeNull()
    expect(momentos.r1).toBe('2026-11-03T13:00:00.000Z')
  })

  it('reservada justo en inicio − 24 h: no hay de 24 h (ya no queda antes)', () => {
    expect(momentosDeRecordatorio({ reservadaEn: '2026-11-02T14:00:00Z', inicio }).r24).toBeNull()
  })

  it('reservada un instante antes de inicio − 24 h: sí hay', () => {
    expect(
      momentosDeRecordatorio({ reservadaEn: '2026-11-02T13:59:59Z', inicio }).r24,
    ).not.toBeNull()
  })
})
