// Lo que dibuja `/` de la calculadora: la sección con su lectura de los datos del panel, y el bloque de prueba. P08 los junta en
// `src/app/(sitio)/page.tsx`: `<SeccionCalculadora config={await leerConfigCalculadora()} />` dentro de un `<Suspense>`.
export { SeccionCalculadora } from '../features/publica/components/seccion-calculadora'
export { BloqueDePrueba } from '../features/publica/components/bloque-de-prueba'
export { leerConfigCalculadora } from '../infra/queries/config-publica'
