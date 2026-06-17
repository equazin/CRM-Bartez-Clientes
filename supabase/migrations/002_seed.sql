-- ──────────────────────────────────────────────────────
-- Bartez CRM — Seed: 36 empresas reales
-- INSTRUCCIONES: Reemplazar USER_ID con el UUID del usuario
-- creado en Supabase Auth antes de ejecutar este seed.
-- Ejemplo: SELECT id FROM auth.users LIMIT 1;
-- ──────────────────────────────────────────────────────

-- Variable de trabajo: reemplazar con el UUID real del usuario
DO $$
DECLARE
  uid uuid := (SELECT id FROM auth.users LIMIT 1);
BEGIN

-- ── CONTACTADAS POR EMAIL (etapa: Contactado) ──────────

INSERT INTO empresas (user_id, razon_social, nombre_fantasia, sector, ciudad, provincia, distancia_km, email_principal, sitio_web, prioridad, canal_preferido, etapa, proxima_accion, proxima_accion_fecha, notas)
VALUES
  (uid, 'Acindar S.A. / ArcelorMittal', 'Acindar', 'Siderurgia', 'Villa Constitución', 'Santa Fe', 60, 'sac@acindar.com.ar', 'www.acindar.com.ar', 'Alta', 'Email', 'Contactado',
   'Hacer seguimiento — preguntar si derivaron a Compras', CURRENT_DATE + 2, 'Planta siderúrgica grande. Email genérico SAC. Clave para credencial industrial.'),

  (uid, 'Mutual Acindar Salud', NULL, 'Mutual', 'Villa Constitución', 'Santa Fe', 60, 'mutualacindar@mutualacindar.org.ar', 'www.mutualacindar.org.ar', 'Media', 'Email', 'Contactado',
   'Seguimiento por email', CURRENT_DATE + 3, 'Mutual de empleados de Acindar. Compra notebooks y equipos para administración.'),

  (uid, 'La Gallega Supermercados', NULL, 'Retail', 'Rosario', 'Santa Fe', 0, 'lagallega@lagallega.com.ar', 'www.lagallega.com.ar', 'Media', 'Email', 'Contactado',
   'Confirmar recepción email', CURRENT_DATE + 1, 'Cadena regional. Equipamiento para cajas, administración y depósitos.'),

  (uid, 'Frigorífico Paladini', NULL, 'Frigorífico', 'Villa Gobernador Gálvez', 'Santa Fe', 15, 'info@paladini.com', 'www.paladini.com', 'Alta', 'Email', 'Contactado',
   'Llamar a recepción para confirmar derivación', CURRENT_DATE + 1, 'Frigorífico grande de la región. Sector IT necesita equipos para planta y oficinas.'),

  (uid, 'San Cristóbal Seguros', NULL, 'Seguros', 'Rosario', 'Santa Fe', 0, 'casacentral@sancristobal.com.ar', 'www.sancristobal.com.ar', 'Alta', 'Email', 'Contactado',
   '2° seguimiento por email', CURRENT_DATE + 2, 'Aseguradora grande regional. Flota de laptops y servidores para sucursales.'),

  (uid, 'Cafés La Virginia', NULL, 'Alimentos', 'Rosario', 'Santa Fe', 0, 'lavirginia@lavirginia.com.ar', 'www.lavirginia.com.ar', 'Media', 'Email', 'Contactado',
   'Reenviar presentación con foco en servidores', CURRENT_DATE + 3, 'Empresa de cafés y alimentos. Infraestructura de servidores para planta.'),

  (uid, 'Sanatorio Británico', NULL, 'Salud', 'Rosario', 'Santa Fe', 0, 'info@sanbritanico.com.ar', 'www.sanbritanico.com.ar', 'Alta', 'Email', 'Contactado',
   'Seguimiento — buscar contacto IT', CURRENT_DATE + 2, 'Sanatorio privado grande. Equipamiento clínico-informático y notebooks para médicos.'),

  (uid, 'Nuevo Banco de Santa Fe', NULL, 'Banca', 'Rosario', 'Santa Fe', 0, 'atencionausuarios@bancosantafe.com.ar', 'www.bancosantafe.com.ar', 'Alta', 'Email', 'Contactado',
   'Buscar contacto de Compras o Sistemas', CURRENT_DATE + 4, 'Banco provincial. Licitaciones de equipamiento regulares. Alto volumen potencial.'),

  (uid, 'Grupo Oroño', NULL, 'Salud', 'Rosario', 'Santa Fe', 0, 'info@grupoorono.com.ar', 'www.grupoorono.com.ar', 'Alta', 'Email', 'Contactado',
   'Seguimiento por email — preguntar por IT', CURRENT_DATE + 3, 'Grupo de sanatorios y clínicas en Rosario. Necesidades de equipamiento médico-informático.'),

  (uid, 'Grupo Sancor Seguros', NULL, 'Seguros', 'Sunchales', 'Santa Fe', 140, 'SAA@sancorseguros.com', 'www.sancorseguros.com', 'Alta', 'Email', 'Contactado',
   'Reenviar email con catálogo de notebooks corporativas', CURRENT_DATE + 1, 'Grupo asegurador grande con sede en Sunchales. Múltiples delegaciones en la región.'),

  (uid, 'Essen Aluminio', NULL, 'Industria', 'Venado Tuerto', 'Santa Fe', 120, 'g.pieroni@essen.com.ar', NULL, 'Media', 'Email', 'Contactado',
   'Seguimiento directo a Gerardo Pieroni', CURRENT_DATE + 2, 'Contacto directo obtenido: g.pieroni@essen.com.ar. Avanzar directo.');

-- ── DERIVADO A COMPRAS ─────────────────────────────────

INSERT INTO empresas (user_id, razon_social, nombre_fantasia, sector, ciudad, provincia, distancia_km, email_principal, sitio_web, prioridad, canal_preferido, etapa, proxima_accion, proxima_accion_fecha, notas)
VALUES
  (uid, 'La Segunda Seguros', NULL, 'Seguros', 'Rosario', 'Santa Fe', 0, 'compras@lasegunda.com.ar', 'www.lasegunda.com.ar', 'Alta', 'Email', 'Derivado a Compras',
   'Enviar presentación formal de Bartez a compras@lasegunda.com.ar', CURRENT_DATE + 1, 'Contacto de compras obtenido: compras@lasegunda.com.ar. Etapa clave — avanzar rápido.');

-- ── PROSPECTOS — WhatsApp ──────────────────────────────

INSERT INTO empresas (user_id, razon_social, nombre_fantasia, sector, ciudad, provincia, distancia_km, telefono, sitio_web, prioridad, canal_preferido, etapa, proxima_accion, proxima_accion_fecha, notas)
VALUES
  (uid, 'Cormetal S.A.', NULL, 'Metalurgia', 'Pérez', 'Santa Fe', 20, NULL, NULL, 'Media', 'WhatsApp', 'Prospecto',
   'Enviar mensaje inicial por WhatsApp', CURRENT_DATE + 1, 'Metalúrgica en Pérez. Contacto vía WhatsApp según referencia.');

-- ── PROSPECTOS — Formulario web ────────────────────────

INSERT INTO empresas (user_id, razon_social, nombre_fantasia, sector, ciudad, provincia, distancia_km, sitio_web, prioridad, canal_preferido, etapa, proxima_accion, proxima_accion_fecha)
VALUES
  (uid, 'Federada Salud', NULL, 'Prepaga', 'Rosario', 'Santa Fe', 0, 'www.federadasalud.com.ar', 'Alta', 'Formulario', 'Prospecto',
   'Completar formulario de contacto en el sitio web', CURRENT_DATE + 2),

  (uid, 'Basso – Válvulas 3B', 'Válvulas 3B', 'Autopartes', 'Rafaela', 'Santa Fe', 100, 'www.valvulas3b.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Completar formulario web de proveedores', CURRENT_DATE + 3),

  (uid, 'Sancor Cooperativas Unidas', 'Sancor', 'Lácteos', 'Sunchales', 'Santa Fe', 140, 'www.sancor.com', 'Alta', 'Formulario', 'Prospecto',
   'Completar formulario de alta de proveedores en sancor.com', CURRENT_DATE + 2),

  (uid, 'Sancor Salud', NULL, 'Prepaga', 'Sunchales', 'Santa Fe', 140, 'www.sancorsalud.com.ar', 'Alta', 'Formulario', 'Prospecto',
   'Enviar formulario de contacto comercial', CURRENT_DATE + 2),

  (uid, 'Liliana Electrodomésticos', NULL, 'Industria', 'Granadero Baigorria', 'Santa Fe', 10, 'www.liliana.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Completar formulario de proveedores', CURRENT_DATE + 4),

  (uid, 'Vassalli Fabril', NULL, 'Maquinaria agrícola', 'Firmat', 'Santa Fe', 90, 'www.vassalli.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Completar formulario web — buscar contacto IT', CURRENT_DATE + 3),

  (uid, 'Crucianelli S.A.', NULL, 'Maquinaria agrícola', 'Armstrong', 'Santa Fe', 80, 'www.crucianelli.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Completar formulario de proveedores', CURRENT_DATE + 5),

  (uid, 'Bunge Argentina', 'Bunge', 'Agroexportadora', 'Puerto General San Martín', 'Santa Fe', 35, 'www.bunge.com.ar', 'Alta', 'Formulario', 'Prospecto',
   'Completar formulario del portal de proveedores', CURRENT_DATE + 2),

  (uid, 'Louis Dreyfus Company / LDC', 'LDC', 'Agroexportadora', 'Timbúes', 'Santa Fe', 25, 'www.ldc.com', 'Alta', 'Formulario', 'Prospecto',
   'Completar formulario de proveedores en portal LDC', CURRENT_DATE + 3),

  (uid, 'ACA Cooperativas Argentinas', 'ACA', 'Cooperativa', 'Rosario', 'Santa Fe', 0, 'www.acaagro.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Completar formulario web de contacto comercial', CURRENT_DATE + 4),

  (uid, 'Apache S.A.', NULL, 'Maquinaria agrícola', 'Las Parejas', 'Santa Fe', 85, 'www.apachesas.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Completar formulario de proveedores', CURRENT_DATE + 5),

  (uid, 'Casino City Center Rosario', 'City Center', 'Entretenimiento', 'Rosario', 'Santa Fe', 0, 'www.citycenterrosario.com.ar', 'Baja', 'Formulario', 'Prospecto',
   'Completar formulario de contacto', CURRENT_DATE + 7),

  (uid, 'Federación Patronal Seguros', NULL, 'Seguros', 'Rosario', 'Santa Fe', 0, 'www.federacionpatronal.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Enviar formulario de contacto comercial', CURRENT_DATE + 4),

  (uid, 'Aguas Santafesinas S.A. / ASSA', 'ASSA', 'Servicio público', 'Rosario', 'Santa Fe', 0, 'www.aguassantafesinas.com.ar', 'Media', 'Formulario', 'Prospecto',
   'Seguir licitaciones en el portal ASSA y BOE', CURRENT_DATE + 7);

-- ── PROSPECTOS — Teléfono ──────────────────────────────

INSERT INTO empresas (user_id, razon_social, nombre_fantasia, sector, ciudad, provincia, distancia_km, telefono, sitio_web, prioridad, canal_preferido, etapa, proxima_accion, proxima_accion_fecha, notas)
VALUES
  (uid, 'Sanatorio de la Mujer', NULL, 'Salud', 'Rosario', 'Santa Fe', 0, NULL, 'www.sanatoriomujer.com.ar', 'Alta', 'Teléfono', 'Prospecto',
   'Llamar a recepción y pedir con Sistemas o Compras', CURRENT_DATE + 1, 'Sanatorio privado importante en Rosario. Contactar por teléfono.'),

  (uid, 'Edival / Grupo Mahle', 'Edival', 'Autopartes', 'Rafaela', 'Santa Fe', 100, NULL, 'www.edival.com.ar', 'Media', 'Teléfono', 'Prospecto',
   'Llamar y pedir con área de Compras', CURRENT_DATE + 3, 'Fabricante de válvulas. Grupo Mahle. Planta en Rafaela.');

-- ── PROSPECTOS — Portal de proveedores ────────────────

INSERT INTO empresas (user_id, razon_social, nombre_fantasia, sector, ciudad, provincia, distancia_km, sitio_web, prioridad, canal_preferido, etapa, proxima_accion, proxima_accion_fecha, notas)
VALUES
  (uid, 'Molinos Agro S.A.', 'Molinos Agro', 'Agroexportadora', 'San Lorenzo', 'Santa Fe', 30, 'www.molinosagro.com.ar', 'Alta', 'Portal', 'Prospecto',
   'Registrarse en portal de proveedores de Molinos', CURRENT_DATE + 2, 'Agroexportadora grande. Planta en San Lorenzo. Portal de proveedores obligatorio.'),

  (uid, 'Ternium Siderar / Techint', 'Ternium', 'Siderurgia', 'San Nicolás', 'Buenos Aires', 180, 'www.ternium.com.ar', 'Alta', 'Portal', 'Prospecto',
   'Registrarse en portal de proveedores Ternium', CURRENT_DATE + 2, 'Siderúrgica gigante del grupo Techint. Portal de proveedores obligatorio. Alto potencial.'),

  (uid, 'Arcor S.A.I.C.', 'Arcor', 'Alimentos', 'Arroyito', 'Córdoba', 200, 'www.arcor.com.ar', 'Alta', 'Portal', 'Prospecto',
   'Registrarse en programa PyMEs de Arcor / portal proveedores', CURRENT_DATE + 3, 'Corporación alimenticia grande. Programa PyMEs activo. Sede en Arroyito, Córdoba.'),

  (uid, 'Metalfor S.A.', NULL, 'Maquinaria agrícola', 'Marcos Juárez', 'Córdoba', 190, 'www.metalfor.com.ar', 'Media', 'Portal', 'Prospecto',
   'Completar formulario de proveedores en portal Metalfor', CURRENT_DATE + 4, 'Fabricante de pulverizadoras. Sede en Marcos Juárez.'),

  (uid, 'Cargill S.A.C.I.', 'Cargill', 'Agroexportadora', 'Puerto General San Martín', 'Santa Fe', 35, 'www.cargill.com.ar', 'Alta', 'Portal', 'Prospecto',
   'Registrarse en portal de proveedores Cargill', CURRENT_DATE + 1, 'Agroexportadora multinacional. Portal de proveedores propio. Planta en Pto. Gral. San Martín.'),

  (uid, 'John Deere Argentina', 'John Deere', 'Maquinaria agrícola', 'Granadero Baigorria', 'Santa Fe', 10, 'www.deere.com.ar', 'Alta', 'Portal', 'Prospecto',
   'Registrarse en portal de proveedores John Deere', CURRENT_DATE + 2, 'Planta de ensamble en Baigorria. Portal de proveedores multinacional.'),

  (uid, 'General Motors / Planta Alvear', 'GM Alvear', 'Automotriz', 'General Alvear', 'Santa Fe', 25, 'www.gm.com.ar', 'Alta', 'Portal', 'Prospecto',
   'Registrarse en portal de proveedores GM', CURRENT_DATE + 3, 'Planta automotriz en Gral. Alvear. Portal de proveedores con requisitos específicos.');

END $$;
