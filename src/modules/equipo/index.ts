// La entrada de servidor de `equipo`: la lectura de las filas visibles y su etiqueta de caché. El componente de la sección no sale
// por aquí (usa `next/image`): sale por `pantallas/inicio.ts`.
export { ETIQUETA_DEL_EQUIPO, type MiembroDelEquipo } from './entities/miembro'
export { leerEquipoVisible } from './infra/queries/equipo-visible'
