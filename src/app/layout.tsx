import type { Metadata, Viewport } from 'next'
import { Archivo, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { Toaster } from 'sonner'
import {
  COLOR_FONDO_CLARO,
  COLOR_FONDO_OSCURO,
  DESCRIPCION_APP,
  NOMBRE_APP,
} from '@/shared/config/app'
import { robotsDelLayout } from '@/shared/config/cabeceras'
import { leerEntornoPublico } from '@/shared/config/entorno'
import './globals.css'

// Las fuentes de la semilla (§8.2), con next/font/google: las baja `next build` (necesita salir a Google al compilar) y las sirve el
// propio sitio, así que el navegador nunca le pide nada a Google y la CSP sólo deja `font-src 'self'`. Sus variables van en <html> y
// `globals.css` las enchufa a `--font-sans` y `--font-mono`.
// - Archivo, variable con el eje `wdth` (62–125 %): con `axes` el peso es `variable` y trae `wght` 100–900, que cubre 400–800.
// - JetBrains Mono 400 y 500, sin precarga: sólo sale en rótulos, VIN, códigos y tablas, nunca en el LCP de la portada.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--fuente-archivo',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  variable: '--fuente-mono',
})

export const metadata: Metadata = {
  title: { default: NOMBRE_APP, template: `%s · ${NOMBRE_APP}` },
  description: DESCRIPCION_APP,
  applicationName: NOMBRE_APP,
  // Fuera de producción nada se indexa (el mismo noindex que la cabecera X-Robots-Tag de next.config.ts).
  ...robotsDelLayout(leerEntornoPublico()['VERCEL_ENV']),
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: COLOR_FONDO_CLARO },
    { media: '(prefers-color-scheme: dark)', color: COLOR_FONDO_OSCURO },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // next-themes pone la clase `.dark` en <html> antes de hidratar: de ahí el suppressHydrationWarning.
    <html
      lang="es"
      className={`${archivo.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Filtros, panel abierto y registro elegido viven en la URL (nuqs). */}
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster position="bottom-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
