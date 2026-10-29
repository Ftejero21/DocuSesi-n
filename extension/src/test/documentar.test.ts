import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { cambiosSinMencion, documentar } from '../core/documentar';
import { analizarEstilos, estiloMismaFamilia } from '../generators/docx/estilos';
import { copiarFixture, crearRoot, ctxBase, inputBase, leerParte } from './util';

const XML = 'word/document.xml';
const CAMBIOS = [
  { ruta: 'backend/src/SolicitudAsegurado.java', estado: 'Modificado' },
  { ruta: 'docs/diseno.docx', estado: 'Modificado' },
  { ruta: '.docusesion/backups/x.docx', estado: 'Nuevo' }
];

describe('cambiosSinMencion', () => {
  const c = [{ ruta: 'backend/src/SolicitudAsegurado.java', estado: 'M' }];

  it('menciona por ruta sin distinguir mayúsculas ni separadores', () => {
    assert.deepStrictEqual(cambiosSinMencion(inputBase({ resumen: 'Cambia BACKEND\\SRC\\solicitudasegurado.java' }), c), []);
  });

  it('menciona por nombre base sin extensión', () => {
    assert.deepStrictEqual(cambiosSinMencion(inputBase({ resumen: 'Se toca SolicitudAsegurado' }), c), []);
  });

  it('menciona en archivosConsultados y en ejemplos', () => {
    assert.deepStrictEqual(
      cambiosSinMencion(inputBase({ archivosConsultados: ['backend/src/SolicitudAsegurado.java'] }), c),
      []
    );
    const ej = [{ titulo: 't', tipo: 'codigo' as const, contenido: 'class SolicitudAsegurado {}', explicacion: 'e' }];
    assert.deepStrictEqual(cambiosSinMencion(inputBase({ ejemplos: ej }), c), []);
  });

  it('sin mención devuelve las rutas', () => {
    assert.deepStrictEqual(cambiosSinMencion(inputBase(), c), ['backend/src/SolicitudAsegurado.java']);
  });

  it('sin cambios devuelve []', () => {
    assert.deepStrictEqual(cambiosSinMencion(inputBase(), []), []);
    assert.deepStrictEqual(cambiosSinMencion(inputBase(), undefined), []);
  });
});

describe('documentar: exigirMencionCambios', () => {
  const sinMencion = () =>
    inputBase({ tipo: 'cambio', titulo: 'Documentar generación', resumen: 'Se generó el documento' });
  const conMencion = () =>
    inputBase({ tipo: 'cambio', titulo: 'Añadir estado', resumen: 'Se modifica SolicitudAsegurado.java' });

  it('no escribe si el contenido no menciona ningún archivo cambiado', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'diseno.docx');
    const r = await documentar(sinMencion(), ctxBase(root, destino, { cambios: CAMBIOS, exigirMencionCambios: true }));
    assert.strictEqual(r.accion, 'no_escrito');
    assert.ok(!fs.existsSync(destino));
    assert.ok(!fs.existsSync(path.join(root, '.docusesion')));
    const aviso = r.avisos.join('\n');
    assert.ok(aviso.includes('SolicitudAsegurado.java'));
    assert.ok(aviso.includes('NO se ha escrito'));
    assert.ok(!aviso.includes('docs/diseno.docx'));
    assert.ok(!aviso.includes('.docusesion'));
  });

  it('escribe si menciona algún archivo cambiado', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'diseno.docx');
    const r = await documentar(conMencion(), ctxBase(root, destino, { cambios: CAMBIOS, exigirMencionCambios: true }));
    assert.strictEqual(r.accion, 'creado');
    assert.ok(fs.existsSync(destino));
  });

  it('sin el flag escribe aunque no haya mención', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'diseno.docx');
    const r = await documentar(sinMencion(), ctxBase(root, destino, { cambios: CAMBIOS }));
    assert.strictEqual(r.accion, 'creado');
    assert.ok(fs.existsSync(destino));
  });

  it('si solo cambian el destino o .docusesion, escribe', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'diseno.docx');
    const r = await documentar(
      sinMencion(),
      ctxBase(root, destino, { cambios: CAMBIOS.slice(1), exigirMencionCambios: true })
    );
    assert.strictEqual(r.accion, 'creado');
    assert.ok(fs.existsSync(destino));
  });

  it('limita la lista del aviso a 20 archivos', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'diseno.docx');
    const cambios = Array.from({ length: 25 }, (_, i) => ({ ruta: `src/zz${i}.java`, estado: 'M' }));
    const r = await documentar(sinMencion(), ctxBase(root, destino, { cambios, exigirMencionCambios: true }));
    assert.ok(r.avisos.join('\n').includes('y 5 más'));
  });
});

describe('estilo de encabezado de la misma familia', () => {
  async function crearDoc(root: string): Promise<string> {
    const h = (estilo: string, t: string) => new Paragraph({ style: estilo, children: [new TextRun(t)] });
    const doc = new Document({
      styles: {
        paragraphStyles: [
          { id: 'Ttulo1', name: 'Título 1', basedOn: 'Normal', paragraph: { outlineLevel: 0 } },
          { id: 'Ttulo2', name: 'Título 2', basedOn: 'Normal', paragraph: { outlineLevel: 1 } }
        ]
      },
      sections: [
        {
          children: [
            h('Ttulo1', 'Introducción'),
            h('Ttulo1', 'Salida'),
            new Paragraph({ children: [new TextRun('Salida original')] }),
            h('Ttulo1', 'Anexos'),
            h('Heading2', 'Suelto')
          ]
        }
      ]
    });
    const abs = path.join(root, 'docs', 'diseno.docx');
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, await Packer.toBuffer(doc));
    return abs;
  }

  it('la marca de cambio usa Ttulo2 aunque exista un Heading2 suelto', async () => {
    const root = await crearRoot();
    const destino = await crearDoc(root);
    await documentar(
      inputBase({
        tipo: 'cambio',
        titulo: 'Añadir campo estado',
        secciones: [{ encabezado: 'Salida', contenido: 'Se añade estado' }]
      }),
      ctxBase(root, destino)
    );
    const xml = leerParte(destino, XML);
    const parrafos = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
    const marca = parrafos.find((p) => p.includes('Cambio 2026-05-17: Añadir campo estado'));
    assert.ok(marca, 'existe la marca');
    assert.ok(marca.includes('<w:pStyle w:val="Ttulo2"/>'), marca);
  });

  const estilo = (id: string, nombre: string) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nombre}"/></w:style>`;
  const styles = (...e: string[]) =>
    `<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${e.join('')}</w:styles>`;

  it('familia por nombre cuando el id no acaba en dígito', () => {
    const info = analizarEstilos(styles(estilo('TituloUno', 'Título 1'), estilo('TituloDos', 'Título 2')));
    assert.strictEqual(estiloMismaFamilia(info, 'TituloUno', 2), 'TituloDos');
  });

  it('familia por id Ttulo1 -> Ttulo2', () => {
    const info = analizarEstilos(
      styles(estilo('Ttulo1', 'Título 1'), estilo('Ttulo2', 'Título 2'), estilo('Heading2', 'heading 2'))
    );
    assert.strictEqual(estiloMismaFamilia(info, 'Ttulo1', 2), 'Ttulo2');
  });

  it('familia sin ese nivel devuelve undefined', () => {
    const info = analizarEstilos(styles(estilo('Ttulo1', 'Título 1'), estilo('Ttulo2', 'Título 2')));
    assert.strictEqual(estiloMismaFamilia(info, 'Ttulo1', 3), undefined);
  });
});

describe('documentar: destino fuera del workspace', () => {
  let ws: string;
  let ext: string;

  beforeEach(async () => {
    ws = await crearRoot();
    ext = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'docusesion-externo-'));
  });

  it('crea el archivo externo con el permiso', async () => {
    const destino = path.join(ext, 'nuevo.docx');
    const ctx = ctxBase(ws, destino, { permitirFueraDelWorkspace: true });
    const r = await documentar(inputBase(), ctx);
    assert.strictEqual(r.accion, 'creado');
    assert.ok(fs.existsSync(destino));
  });

  it('rechaza el destino externo sin el permiso', async () => {
    const destino = path.join(ext, 'nuevo.docx');
    await assert.rejects(documentar(inputBase(), ctxBase(ws, destino)), /fuera del workspace/);
    assert.ok(!fs.existsSync(destino));
  });

  it('el backup de un destino externo queda en el workspace', async () => {
    const destino = await copiarFixture(ext, 'externo.docx');
    const original = await fs.promises.readFile(destino);
    const ctx = ctxBase(ws, destino, { permitirFueraDelWorkspace: true });
    const r = await documentar(inputBase(), ctx);

    const dirBackups = path.join(ws, '.docusesion', 'backups');
    const archivos = await fs.promises.readdir(dirBackups);
    assert.strictEqual(archivos.length, 1);
    assert.match(archivos[0], /^externo-20260517-103045\.docx$/);
    assert.deepStrictEqual(await fs.promises.readFile(path.join(dirBackups, archivos[0])), original);
    assert.ok(r.backup && r.backup.startsWith(ws));
    assert.deepStrictEqual(await fs.promises.readdir(ext), ['externo.docx']);
  });
});
