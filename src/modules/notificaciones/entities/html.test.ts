import { describe, expect, it } from 'vitest'

import { crudo, escapar, html as seguro, urlSegura } from './html'

describe('escapar', () => {
  it('convierte &, <, >, " y \' en entidades', () => {
    expect(escapar(`<script>alert("x")</script> & 'Co'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Co&#39;',
    )
  })
})

describe('html', () => {
  it('escapa cada dato que se interpola y deja el HTML propio', () => {
    const dato = '<b>"hola" & \'adiós\'</b>'
    expect(seguro`<p>${dato}</p>`.valor).toBe(
      '<p>&lt;b&gt;&quot;hola&quot; &amp; &#39;adiós&#39;&lt;/b&gt;</p>',
    )
  })

  it('no escapa dos veces un HtmlSeguro anidado', () => {
    const interior = seguro`<i>${'a & b'}</i>`
    expect(seguro`<p>${interior}</p>`.valor).toBe('<p><i>a &amp; b</i></p>')
  })

  it('junta listas, números y omite null, undefined y false', () => {
    const items = ['<a>', 'b'].map((x) => seguro`<li>${x}</li>`)
    const lista = seguro`<ul>${items}${null}${undefined}${false}${3}</ul>`
    expect(lista.valor).toBe('<ul><li>&lt;a&gt;</li><li>b</li>3</ul>')
  })

  it('crudo no escapa: es sólo para HTML fijo del módulo', () => {
    expect(seguro`${crudo('<hr>')}`.valor).toBe('<hr>')
  })
})

describe('urlSegura', () => {
  it('deja pasar https y http', () => {
    expect(urlSegura('https://calesa.app/agendar')).toBe('https://calesa.app/agendar')
    expect(urlSegura('http://localhost:3000/x')).toBe('http://localhost:3000/x')
  })

  it('rechaza javascript:, data:, mailto: y lo que no es una URL', () => {
    expect(urlSegura('javascript:alert(1)')).toBeNull()
    expect(urlSegura('data:text/html,<b>')).toBeNull()
    expect(urlSegura('mailto:a@b.com')).toBeNull()
    expect(urlSegura('no es una url')).toBeNull()
  })
})
