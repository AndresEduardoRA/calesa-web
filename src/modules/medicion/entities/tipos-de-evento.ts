// Los eventos que el registro público acepta (F8, X7): sólo lo que el navegador del visitante puede afirmar por sí mismo. Los demás
// (`clic_whatsapp`, `formulario_enviado`, las reuniones…) los escribe la RPC del caso que los provoca. Sin Zod: lo puede importar
// cualquiera sin arrastrar el esquema.
export const TIPOS_DE_EVENTO_PUBLICOS = ['clic_agendar', 'calculadora_usada'] as const

export type TipoDeEventoPublico = (typeof TIPOS_DE_EVENTO_PUBLICOS)[number]
