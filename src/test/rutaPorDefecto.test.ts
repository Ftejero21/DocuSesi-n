import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { documentar } from '../core/documentar';
import { esArchivoDocumento, resolverDestino, resultadoSinDestino, sinDestino } from '../core/rutas';
import { copiarFixture, crearRoot, ctxBase, inputBase } from './util';

async function crearDocxSimple(abs: string): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Documentación de funcionalidades')] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('obtenerReembolsos')] }),
          new Paragraph({ children: [new TextRun('SELECT ID_REEMBOLSO FROM T_REEMBOLSOS')] })
        ]
      }
    ]
  });
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, await Packer.toBuffer(doc));
}

describe('ruta por defecto', () => {
  it('sin destino y sin ruta por defecto: no se escribe nada', async () => {
    assert.strictEqual(sinDestino(undefined, ''), true);
    assert.strictEqual(sinDestino('  ', '  '), true);
    assert.strictEqual(sinDestino('x.docx', ''), false);
    assert.strictEqual(sinDestino(undefined, 'docs'), false);

    const es = resultadoSinDestino('es');
    assert.strictEqual(es.accion, 'no_escrito');
    assert.strictEqual(es.rutaFinal, '');
    assert.strictEqual(es.avisos.length, 1);
    assert.ok(es.avisos[0].includes('docusesion.rutaPorDefecto'));
    assert.ok(es.avisos[0].includes('NO inventes'));
    assert.ok(resultadoSinDestino('en').avisos[0].includes('docusesion.rutaPorDefecto'));

    const root = await crearRoot();
    assert.throws(() => resolverDestino(root, { titulo: 't' }, ''));
    assert.strictEqual(fs.existsSync(path.join(root, 'docs')), false);
    assert.strictEqual(fs.existsSync(path.join(root, '.docusesion')), false);
  });

  it('ruta por defecto carpeta: archivo nuevo con el slug del título', async () => {
    const root = await crearRoot();
    const dest = resolverDestino(root, { titulo: 'Mi Servicio' }, 'documentacion/servicios');
    assert.strictEqual(dest.rel, 'documentacion/servicios/mi-servicio.docx');
    assert.strictEqual(dest.porDefecto, true);
    const r = await documentar(inputBase({ titulo: 'Mi Servicio' }), ctxBase(root, dest.abs));
    assert.strictEqual(r.accion, 'creado');
    assert.ok(fs.existsSync(path.join(root, 'documentacion', 'servicios', 'mi-servicio.docx')));
  });

  it('ruta por defecto archivo existente: se usa ese documento', async () => {
    const root = await crearRoot();
    const existente = await copiarFixture(root, 'docs/funcionalidades.docx');
    const dest = resolverDestino(root, { titulo: 'Otro título' }, 'docs/funcionalidades.docx');
    assert.strictEqual(dest.abs, existente);
    assert.strictEqual(dest.porDefecto, true);
    const r = await documentar(inputBase({ titulo: 'Otro título', modo: 'auto' }), ctxBase(root, dest.abs));
    assert.strictEqual(r.accion, 'actualizado');

    const root2 = await crearRoot();
    const abs2 = path.join(root2, 'docs', 'funcionalidades.docx');
    await crearDocxSimple(abs2);
    const dest2 = resolverDestino(root2, { titulo: 'obtenerPolizas' }, 'docs/funcionalidades.docx');
    assert.strictEqual(dest2.abs, abs2);
    const r2 = await documentar(
      inputBase({ titulo: 'obtenerPolizas', modo: 'anexar', secciones: [{ encabezado: '', contenido: '```sql\nSELECT 1\n```' }] }),
      ctxBase(root2, dest2.abs)
    );
    assert.strictEqual(r2.accion, 'anexado');

    assert.throws(
      () => resolverDestino(root, { titulo: 't', formato: 'xlsx' }, 'docs/funcionalidades.docx'),
      (e: Error) => /no coincide/.test(e.message) && /rutaPorDefecto/.test(e.message)
    );
    const interna = resolverDestino(root, { titulo: 't' }, path.join(root, 'docs', 'funcionalidades.docx'));
    assert.strictEqual(interna.fuera, false);
  });

  it('absoluta fuera del workspace depende del ajuste; relativa que escapa siempre falla', async () => {
    const root = await crearRoot();
    const externa = path.resolve(os.tmpdir(), 'otra-carpeta-def');
    assert.throws(
      () => resolverDestino(root, { titulo: 't' }, externa, false),
      (e: Error) => /permitirRutasFueraDelWorkspace/.test(e.message) && /rutaPorDefecto/.test(e.message)
    );
    const r = resolverDestino(root, { titulo: 't' }, externa, true);
    assert.strictEqual(r.fuera, true);
    assert.ok(r.abs.endsWith('t.docx'));
    assert.throws(() => resolverDestino(root, { titulo: 't' }, '../fuera', true), /fuera del workspace/);
  });

  it('el destino explícito gana sobre la ruta por defecto', () => {
    const root = path.join(os.tmpdir(), 'ws-def');
    const r = resolverDestino(root, { titulo: 't', destino: 'otros/x.docx' }, 'docs/f.docx');
    assert.strictEqual(r.rel, 'otros/x.docx');
    assert.strictEqual(r.porDefecto, false);
  });

  it('esArchivoDocumento detecta solo docx/xlsx/pptx', () => {
    assert.strictEqual(esArchivoDocumento('a/B.DOCX'), true);
    assert.strictEqual(esArchivoDocumento('docs'), false);
    assert.strictEqual(esArchivoDocumento('v1.2'), false);
    assert.strictEqual(esArchivoDocumento('a.txt'), false);
  });
});
