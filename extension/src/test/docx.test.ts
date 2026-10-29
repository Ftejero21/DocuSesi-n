import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { documentar } from '../core/documentar';
import { analizarEstilos } from '../generators/docx/estilos';
import { copiarFixture, crearRoot, ctxBase, inputBase, leerParte, MAPEO, textoPlano } from './util';

function contar(texto: string, patron: RegExp): number {
  return (texto.match(patron) ?? []).length;
}

describe('docx', () => {
  describe('crear', () => {
    it('crea el documento con encabezados, mapeo coloreado, código Consolas y sin diff en explicacion', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'nuevo.docx');
      const ctx = ctxBase(root, destino, {
        diff: 'diff --git a/x b/x\n+no debe aparecer',
        cambios: [{ ruta: 'x.java', estado: 'Modificado' }]
      });
      const input = inputBase({
        mapeoNombres: MAPEO,
        ejemplos: [
          {
            titulo: 'Consulta de verificación',
            tipo: 'sql',
            contenido: 'SELECT *\nFROM SEGUROS_PRE.T_SOL_ASEG\nWHERE ID_ASEG = :idAsegurado',
            explicacion: 'Comprueba la solicitud.'
          }
        ],
        archivosConsultados: ['src/Foo.java']
      });
      const r = await documentar(input, ctx);
      assert.strictEqual(r.accion, 'creado');
      const xml = leerParte(destino, 'word/document.xml');
      const plano = textoPlano(xml);
      for (const h of [
        'Resumen',
        'Propósito',
        'Ejemplos',
        'Correspondencia de nombres con la base de datos',
        'Archivos consultados',
        'Historial de cambios'
      ]) {
        assert.ok(plano.includes(h), `falta el encabezado ${h}`);
      }
      assert.ok(xml.includes('w:fill="FFFF00"'), 'fila pendiente en amarillo');
      assert.ok(xml.includes('w:fill="DDEBF7"'), 'fila de entorno en azul claro');
      assert.ok(xml.includes('w:fill="F2F2F2"'), 'sombreado gris del código');
      assert.ok(xml.includes('Consolas'), 'fuente Consolas');
      assert.ok(!plano.includes('Archivos afectados'), 'explicacion no lleva archivos afectados');
      assert.ok(!plano.includes('no debe aparecer'), 'explicacion no lleva diff');
      assert.ok(plano.includes('Resumen de prueba con <etiquetas> & "comillas".'), 'texto escapado correctamente');
      assert.ok(plano.includes('Consulta de verificación'));
    });

    it('en cambio incluye archivos afectados y diff, excluyendo el destino y .docusesion', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'cambio.docx');
      const diff = [
        'diff --git a/src/A.java b/src/A.java',
        '--- a/src/A.java',
        '+++ b/src/A.java',
        '+private String estado;',
        'diff --git a/docs/cambio.docx b/docs/cambio.docx',
        'Binary files a/docs/cambio.docx and b/docs/cambio.docx differ',
        'diff --git a/.docusesion/backups/x.docx b/.docusesion/backups/x.docx',
        'Binary files differ'
      ].join('\n');
      const ctx = ctxBase(root, destino, {
        diff,
        cambios: [
          { ruta: 'src/A.java', estado: 'Modificado' },
          { ruta: 'docs/cambio.docx', estado: 'Añadido' },
          { ruta: '.docusesion/backups/x.docx', estado: 'Añadido' }
        ]
      });
      await documentar(inputBase({ tipo: 'cambio' }), ctx);
      const plano = textoPlano(leerParte(destino, 'word/document.xml'));
      assert.ok(plano.includes('Archivos afectados'));
      assert.ok(plano.includes('src/A.java'));
      assert.ok(plano.includes('private String estado;'));
      assert.ok(!plano.includes('docs/cambio.docx'), 'el destino se excluye');
      assert.ok(!plano.includes('.docusesion'), '.docusesion se excluye');
    });

    it('trunca el diff a 400 líneas', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'grande.docx');
      const diff =
        'diff --git a/a b/a\n' + Array.from({ length: 900 }, (_, i) => `+linea ${i}`).join('\n');
      await documentar(inputBase({ tipo: 'cambio' }), ctxBase(root, destino, { diff, cambios: [{ ruta: 'a', estado: 'Modificado' }] }));
      const plano = textoPlano(leerParte(destino, 'word/document.xml'));
      assert.ok(plano.includes('+linea 100'));
      assert.ok(!plano.includes('+linea 800'));
      assert.ok(plano.includes('Diff truncado'));
    });
  });

  describe('actualizar', () => {
    it('sustituye una sección existente (sin tildes ni mayúsculas) sin duplicar el encabezado', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const r = await documentar(
        inputBase({ secciones: [{ encabezado: 'servicio DE solicitudes', contenido: 'Texto nuevo del servicio' }] }),
        ctxBase(root, destino)
      );
      assert.strictEqual(r.accion, 'actualizado');
      assert.deepStrictEqual(r.seccionesActualizadas.includes('servicio DE solicitudes'), true);
      const plano = textoPlano(leerParte(destino, 'word/document.xml'));
      assert.ok(!plano.includes('Texto antiguo'));
      assert.ok(plano.includes('Texto nuevo del servicio'));
      assert.strictEqual(contar(plano, /Servicio de solicitudes/g), 1);
      assert.ok(!plano.includes('servicio DE solicitudes'));
    });

    it('añade una sección nueva antes de "Historial de cambios" con el estilo de título del documento', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const r = await documentar(
        inputBase({ secciones: [{ encabezado: 'Flujo interno', contenido: 'Controlador -> servicio' }] }),
        ctxBase(root, destino)
      );
      assert.ok(r.seccionesCreadas.includes('Flujo interno'));
      const xml = leerParte(destino, 'word/document.xml');
      const iNueva = xml.indexOf('Flujo interno');
      const iHist = xml.indexOf('Historial de cambios');
      assert.ok(iNueva > 0 && iNueva < iHist, 'la sección nueva va antes del historial');
      // El encabezado nuevo usa el estilo del encabezado de historial (Título 1 en el fixture).
      const parrafo = xml.slice(xml.lastIndexOf('<w:p>', iNueva), iNueva);
      assert.match(parrafo, /<w:pStyle w:val="Ttulo1"\/>/);
      assert.ok(r.encabezados.some((e) => e.texto === 'Flujo interno'));
    });

    it('conserva los estilos: styles.xml idéntico, encabezados Ttulo* y cuerpo Cuerpo', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const antes = leerParte(destino, 'word/styles.xml');
      await documentar(
        inputBase({
          secciones: [
            { encabezado: 'Entrada', contenido: 'Parámetros del servicio' },
            { encabezado: 'Salida', contenido: 'Lista de solicitudes' }
          ]
        }),
        ctxBase(root, destino)
      );
      assert.strictEqual(leerParte(destino, 'word/styles.xml'), antes);
      const xml = leerParte(destino, 'word/document.xml');
      assert.ok(!xml.includes('w:val="Heading'), 'no se usan estilos Heading*');
      assert.match(xml, /<w:pStyle w:val="Cuerpo"\/>(?:(?!<\/w:p>).)*Parámetros del servicio/);
    });

    it('crea la copia de seguridad con el patrón -YYYYMMDD-HHmmss', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const original = fs.readFileSync(destino);
      const r = await documentar(inputBase(), ctxBase(root, destino));
      const dir = path.join(root, '.docusesion', 'backups');
      const archivos = fs.readdirSync(dir);
      assert.strictEqual(archivos.length, 1);
      assert.match(archivos[0], /^diseno-20260517-103045\.docx$/);
      assert.ok(r.backup);
      assert.ok(fs.readFileSync(path.join(dir, archivos[0])).equals(original), 'el backup es el original');
    });

    it('añade una fila al historial de cambios', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const antes = contar(leerParte(destino, 'word/document.xml'), /<w:tr[ >]/g);
      await documentar(inputBase({ titulo: 'Título del cambio' }), ctxBase(root, destino));
      const xml = leerParte(destino, 'word/document.xml');
      assert.strictEqual(contar(xml, /<w:tr[ >]/g), antes + 1);
      assert.ok(textoPlano(xml).includes('Título del cambio'));
      assert.ok(textoPlano(xml).includes('2026-05-17'));
    });

    it('una segunda actualización con las mismas secciones no duplica nada', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const input = inputBase({ mapeoNombres: MAPEO });
      await documentar(input, ctxBase(root, destino));
      await documentar(input, ctxBase(root, destino, { fecha: new Date(2026, 4, 17, 10, 31, 0) }));
      const plano = textoPlano(leerParte(destino, 'word/document.xml'));
      assert.strictEqual(contar(plano, /Propósito/g), 1);
      assert.strictEqual(contar(plano, /Correspondencia de nombres con la base de datos/g), 1);
    });

    it('la tabla de mapeo insertada lleva el sombreado por estado', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      await documentar(inputBase({ mapeoNombres: MAPEO }), ctxBase(root, destino));
      const xml = leerParte(destino, 'word/document.xml');
      assert.ok(xml.includes('w:fill="FFFF00"'));
      assert.ok(xml.includes('w:fill="DDEBF7"'));
      assert.ok(textoPlano(xml).includes('T_SOL_ASEG'));
    });
  });

  describe('fusionar al actualizar', () => {
    const XML = 'word/document.xml';
    const nuevaFecha = () => ({ fecha: new Date(2026, 4, 17, 10, 31, 0) });

    function tablaTrasEncabezado(xml: string, encabezado: string): string {
      const i = xml.indexOf(encabezado);
      const ini = xml.indexOf('<w:tbl', i);
      return xml.slice(ini, xml.indexOf('</w:tbl>', ini));
    }

    it('mapeo: actualiza la fila existente, añade las nuevas y conserva las demás con su sombreado', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'fusion.docx');
      await documentar(inputBase({ mapeoNombres: MAPEO }), ctxBase(root, destino));
      await documentar(
        inputBase({
          mapeoNombres: [
            {
              nombreEnCodigo: 'FECHAALTA',
              tipoObjeto: 'columna',
              nombreReal: 'FECHA_ALTA',
              estado: 'depende_de_entorno',
              notas: 'nota nueva',
              origen: 'x'
            },
            { nombreEnCodigo: 'estado', tipoObjeto: 'columna', nombreReal: 'ESTADO', estado: 'pendiente_de_verificar', origen: 'x' },
            { nombreEnCodigo: 'SolicitudAsegurado', tipoObjeto: 'vista', nombreReal: 'V_SOL', estado: 'pendiente_de_verificar', origen: 'x' }
          ]
        }),
        ctxBase(root, destino, nuevaFecha())
      );
      const xml = leerParte(destino, XML);
      const tbl = tablaTrasEncabezado(xml, 'Correspondencia de nombres con la base de datos');
      assert.strictEqual(contar(tbl, /<w:tr[ >]/g), 1 + 5);
      const plano = textoPlano(tbl);
      assert.ok(plano.includes('T_SOL_ASEG'));
      assert.ok(plano.includes('SEGUROS_PRE'));
      assert.ok(plano.includes('ESTADO'));
      assert.ok(plano.includes('nota nueva'));
      const filas = tbl.split('<w:tr').slice(1);
      const filaFecha = filas.find((f) => f.includes('FECHA_ALTA')) as string;
      const filaEstado = filas.find((f) => f.includes('>ESTADO<')) as string;
      assert.ok(filaFecha.includes('DDEBF7') && !filaFecha.includes('FFFF00'));
      assert.ok(filaEstado.includes('FFFF00'));
      assert.strictEqual(contar(textoPlano(xml), /Correspondencia de nombres con la base de datos/g), 1);
    });

    it('mapeo: una fila que pasa a verificado pierde el sombreado', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'fusion.docx');
      const fila = { nombreEnCodigo: 'SolicitudAsegurado', tipoObjeto: 'tabla' as const, nombreReal: 'T_SOL_ASEG', origen: 'src/main/resources/V1__crear_tablas.sql:1' };
      await documentar(inputBase({ mapeoNombres: [{ ...fila, estado: 'pendiente_de_verificar' }] }), ctxBase(root, destino));
      assert.ok(leerParte(destino, XML).includes('FFFF00'));
      await documentar(
        inputBase({
          mapeoNombres: [
            {
              nombreEnCodigo: 'SolicitudAsegurado',
              tipoObjeto: 'tabla',
              nombreReal: 'T_SOL_ASEG',
              origen: 'src/main/resources/V1__crear_tablas.sql:1',
              estado: 'verificado'
            }
          ]
        }),
        ctxBase(root, destino, nuevaFecha())
      );
      const tbl = tablaTrasEncabezado(leerParte(destino, XML), 'Correspondencia de nombres con la base de datos');
      assert.strictEqual(contar(tbl, /<w:tr[ >]/g), 1 + 1);
      assert.ok(!tbl.includes('FFFF00'));
    });

    it('ejemplos: reemplaza el del mismo título, añade el nuevo y conserva los demás', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'fusion.docx');
      await documentar(
        inputBase({
          ejemplos: [
            { titulo: 'Petición de consulta', tipo: 'peticion', explicacion: '', contenido: 'GET /solicitudes' },
            { titulo: 'Consulta SQL de verificación', tipo: 'sql', explicacion: '', contenido: 'SELECT VIEJO FROM T' },
            { titulo: 'Otra SQL', tipo: 'sql', explicacion: '', contenido: 'SELECT OTRO FROM T' }
          ]
        }),
        ctxBase(root, destino)
      );
      await documentar(
        inputBase({
          ejemplos: [
            { titulo: 'consulta sql de verificacion', tipo: 'sql', explicacion: '', contenido: 'SELECT NUEVO FROM T' },
            { titulo: 'Ejemplo nuevo', tipo: 'otro', explicacion: '', contenido: 'algo' }
          ]
        }),
        ctxBase(root, destino, nuevaFecha())
      );
      const xml = leerParte(destino, XML);
      const plano = textoPlano(xml);
      assert.ok(plano.includes('Petición de consulta'));
      assert.ok(plano.includes('Otra SQL'));
      assert.ok(plano.includes('SELECT OTRO'));
      assert.ok(!plano.includes('SELECT VIEJO'));
      assert.strictEqual(contar(plano, /SELECT NUEVO/g), 1);
      assert.ok(plano.includes('Ejemplo nuevo'));
      assert.strictEqual(contar(xml, />Ejemplos</g), 1);
      assert.strictEqual(contar(plano, /consulta sql de verificacion \(SQL\)/gi), 1);
    });

    it('historial: no duplica una fila idéntica y añade una si cambia el título', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const antes = contar(leerParte(destino, XML), /<w:tr[ >]/g);
      const input = inputBase({ titulo: 'Título del cambio' });
      await documentar(input, ctxBase(root, destino));
      await documentar(input, ctxBase(root, destino, nuevaFecha()));
      assert.strictEqual(contar(leerParte(destino, XML), /<w:tr[ >]/g), antes + 1);
      await documentar(inputBase({ titulo: 'Otro título' }), ctxBase(root, destino, nuevaFecha()));
      assert.strictEqual(contar(leerParte(destino, XML), /<w:tr[ >]/g), antes + 2);
    });

    it('cambio: anexa a la sección existente con una marca idempotente; explicacion la sustituye', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'fusion.docx');
      await documentar(inputBase({ secciones: [{ encabezado: 'Salida', contenido: 'Salida original' }] }), ctxBase(root, destino));
      const cambio = () =>
        inputBase({
          tipo: 'cambio',
          titulo: 'Añadir campo estado',
          secciones: [{ encabezado: 'Salida', contenido: 'Se añade estado' }]
        });
      const r = await documentar(cambio(), ctxBase(root, destino, nuevaFecha()));
      assert.ok(r.seccionesActualizadas.includes('Salida'));
      let xml = leerParte(destino, XML);
      let plano = textoPlano(xml);
      assert.ok(plano.includes('Salida original'));
      const marca = 'Cambio 2026-05-17: Añadir campo estado';
      assert.ok(plano.includes(marca));
      assert.ok(plano.indexOf(marca) < plano.indexOf('Se añade estado'));
      assert.ok(plano.indexOf('Salida original') < plano.indexOf(marca));
      assert.strictEqual(contar(xml, />Salida</g), 1);

      await documentar(cambio(), ctxBase(root, destino, nuevaFecha()));
      xml = leerParte(destino, XML);
      plano = textoPlano(xml);
      assert.strictEqual(contar(plano, /Cambio 2026-05-17: Añadir campo estado/g), 1);
      assert.strictEqual(contar(plano, /Se añade estado/g), 1);
      assert.ok(plano.includes('Salida original'));

      await documentar(
        inputBase({ secciones: [{ encabezado: 'Salida', contenido: 'Salida reescrita' }] }),
        ctxBase(root, destino, nuevaFecha())
      );
      plano = textoPlano(leerParte(destino, XML));
      assert.ok(!plano.includes('Salida original'));
      assert.ok(!plano.includes('Cambio 2026-05-17: Añadir campo estado'));
      assert.ok(plano.includes('Salida reescrita'));
    });

    it('cambio: elimina el prefijo "Cambio YYYY-MM-DD:" que el modelo copia en el contenido', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'prefijo.docx');
      await documentar(inputBase({ secciones: [{ encabezado: 'Salida', contenido: 'Salida original' }] }), ctxBase(root, destino));
      await documentar(
        inputBase({
          tipo: 'cambio',
          titulo: 'Añadir campo estado',
          secciones: [{ encabezado: 'Salida', contenido: 'Cambio YYYY-MM-DD: Se añade estado' }]
        }),
        ctxBase(root, destino, nuevaFecha())
      );
      const plano = textoPlano(leerParte(destino, XML));
      assert.ok(plano.includes('Cambio 2026-05-17: Añadir campo estado' + 'Se añade estado'));
      assert.ok(!plano.includes('YYYY-MM-DD'));
      assert.strictEqual(contar(plano, /Cambio 2026-05-17/g), 1);
    });
  });

  describe('plantilla', () => {
    async function crearPlantilla(root: string): Promise<string> {
      const p = (texto: string) => new Paragraph({ children: [new TextRun(texto)] });
      const doc = new Document({
        styles: {
          paragraphStyles: [
            { id: 'Ttulo1', name: 'Título 1', basedOn: 'Normal', paragraph: { outlineLevel: 0 } },
            { id: 'Cuerpo', name: 'Cuerpo', basedOn: 'Normal' }
          ]
        },
        sections: [
          {
            children: [
              p('{titulo}'),
              p('Fecha: {fecha}'),
              new Paragraph({ style: 'Ttulo1', children: [new TextRun('Introducción')] }),
              new Paragraph({ style: 'Cuerpo', children: [new TextRun('{resumen}')] }),
              new Paragraph({ style: 'Ttulo1', children: [new TextRun('Historial de cambios')] }),
              new Table({
                rows: [
                  new TableRow({
                    children: ['Fecha', 'Tipo', 'Título', 'Resumen'].map(
                      (c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })] })
                    )
                  })
                ]
              })
            ]
          }
        ]
      });
      const abs = path.join(root, 'plantillas', 'plantilla.docx');
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, await Packer.toBuffer(doc));
      return abs;
    }

    it('rellena {titulo}, {fecha} y {resumen} y aplica la lógica de actualizar', async () => {
      const root = await crearRoot();
      const plantilla = await crearPlantilla(root);
      const destino = path.join(root, 'docs', 'diseno.docx');
      const r = await documentar(
        inputBase({ titulo: 'Diseño del servicio', resumen: 'Resumen real del servicio' }),
        ctxBase(root, destino, { plantilla })
      );
      assert.strictEqual(r.accion, 'creado_desde_plantilla');
      assert.strictEqual(r.backup, undefined, 'sin backup: el archivo es nuevo');
      const xml = leerParte(destino, 'word/document.xml');
      const plano = textoPlano(xml);
      assert.ok(plano.includes('Diseño del servicio'));
      assert.ok(plano.includes('Fecha: 2026-05-17'));
      assert.ok(plano.includes('Resumen real del servicio'));
      assert.ok(!plano.includes('{titulo}') && !plano.includes('{resumen}') && !plano.includes('{fecha}'));
      // Propósito se añade antes del historial y la tabla (solo cabecera) gana una fila.
      assert.ok(xml.indexOf('Propósito') < xml.indexOf('Historial de cambios'));
      assert.strictEqual(contar(xml, /<w:tr[ >]/g), 2);
      assert.ok(!fs.existsSync(path.join(root, '.docusesion')), 'no se crea backup');
    });

    it('con una plantilla inexistente avisa y crea el documento desde cero', async () => {
      const root = await crearRoot();
      const destino = path.join(root, 'docs', 'sin-plantilla.docx');
      const r = await documentar(inputBase(), ctxBase(root, destino, { plantilla: path.join(root, 'no-existe.docx') }));
      assert.strictEqual(r.accion, 'creado');
      assert.ok(r.avisos.some((a) => a.includes('plantilla')));
    });
  });

  describe('modos', () => {
    it('"crear" con un archivo existente genera un archivo con sufijo y no sobrescribe', async () => {
      const root = await crearRoot();
      const destino = await copiarFixture(root, 'docs/diseno.docx');
      const original = fs.readFileSync(destino);
      const r = await documentar(inputBase({ modo: 'crear' }), ctxBase(root, destino));
      assert.strictEqual(r.accion, 'nuevo_con_sufijo');
      assert.match(path.basename(r.rutaFinal), /^diseno-20260517-103045\.docx$/);
      assert.ok(fs.readFileSync(destino).equals(original), 'el original no cambia');
      assert.ok(r.avisos.length > 0);
    });

    it('"actualizar" sin archivo es un error', async () => {
      const root = await crearRoot();
      await assert.rejects(
        documentar(inputBase({ modo: 'actualizar' }), ctxBase(root, path.join(root, 'docs', 'no.docx'))),
        /actualizar/
      );
    });
  });

  describe('estilos', () => {
    it('detecta el nivel por el nombre del estilo aunque el styleId sea distinto', () => {
      const xml =
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:style w:type="paragraph" w:styleId="MiEstilo"><w:name w:val="Título 2"/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Otro"><w:name w:val="Otro"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style>' +
        '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>' +
        '</w:styles>';
      const info = analizarEstilos(xml);
      assert.strictEqual(info.nivelPorStyleId.get('MiEstilo'), 2);
      assert.strictEqual(info.nivelPorStyleId.get('Heading1'), 1);
      assert.strictEqual(info.nivelPorStyleId.get('Otro'), 3);
      assert.strictEqual(info.idHeading2, 'MiEstilo');
      assert.strictEqual(info.idTablaRejilla, 'TableGrid');
    });
  });
});
