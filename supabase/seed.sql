-- Lo configurable y los ejemplos de desarrollo (lo aplica `supabase db reset`; la nube no lo vuelve a correr). Un dato de catálogo
-- (permiso, estado, bucket, job) no va aquí: va en su migración con `insert … on conflict` (.claude/rules/migraciones.md).
-- config_agenda, config_calculadora y el horario de B11 nacen en sus migraciones (la nube también los necesita). Aquí: la tarjeta
-- del fundador en «Quiénes somos» (§3 › equipo, A6), sin foto hasta que el admin la suba desde el panel.
insert into public.equipo (nombre, cargo, frase, foto_ruta, orden, visible)
select 'Andrés Eduardo Rosas Alpiri',
       'Desarrollador y fundador de Calesa',
       'Estudié decenas de importadoras, de Bolivia a Centroamérica, y en todas vi lo mismo: consultas que se enfrían en WhatsApp, '
         'cotizaciones armadas a mano y clientes que llaman para saber dónde está su auto. Construí Calesa para que una importadora '
         'venda más y funcione igual aunque cambien las personas.',
       null, 1, true
 where not exists (select 1 from public.equipo where orden = 1);
