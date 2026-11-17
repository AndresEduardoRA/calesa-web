// Los puertos de los casos son propios de `agenda` (`infra/` no importa otro módulo); esta prueba fija que el notificador real de
// `notificaciones` los cumple. Es de tipos: si P07 cambia una firma, cae `pnpm typecheck`. Sólo importa tipos: no carga `server-only`.
import { describe, expectTypeOf, it } from 'vitest'
import type { DatosDeCorreo, Notificador, momentosDeRecordatorio } from '@/modules/notificaciones'
import type { DatosDeCorreoDeAgenda } from '../correos'
import type { CorreosDeAgenda, MomentosDeRecordatorioDeAgenda } from './tipos'

describe('los puertos de los casos públicos (C11)', () => {
  it('el notificador de notificaciones cumple CorreosDeAgenda', () => {
    expectTypeOf<Notificador>().toExtend<CorreosDeAgenda>()
  })

  it('momentosDeRecordatorio cumple MomentosDeRecordatorioDeAgenda', () => {
    expectTypeOf<typeof momentosDeRecordatorio>().toExtend<MomentosDeRecordatorioDeAgenda>()
  })

  it('los datos que arma agenda son datos de correo de notificaciones', () => {
    expectTypeOf<DatosDeCorreoDeAgenda>().toExtend<DatosDeCorreo>()
  })
})
