import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import { Document, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from 'docx';
import { documentar } from '../core/documentar';
import { leerEstructura } from '../core/estructura';
import { modoEfectivo } from '../core/rutas';
import { inputSchemaEstructura } from '../core/schema';
import { leerEstructuraDocx } from '../generators/docx/estructuraDocx';
import { crearRoot, ctxBase, inputBase, leerParte, MAPEO, textoPlano } from './util';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));

const SQL_1 = 'SELECT ID_REEMBOLSO FROM T_REEMBOLSOS';
const SQL_2 = 'SELECT ID_REEMBOLSO FROM T_REEMBOLSOS WHERE NUM_ASEG = :aseg';
const SQL_3 = 'SELECT ID_POLIZA FROM T_POLIZAS';
const SQL_4 = 'SELECT ID_POLIZA FROM T_POLIZAS WHERE FECHA = :fecha';

function codigo(sql: string): Paragraph {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: 'EEEEEE', color: 'auto' },
    children: [new TextRun({ text: sql, font: 'Consolas' })]
  });
}

async function crearFixture(root: string): Promise<string> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Documentación de funcionalidades')] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('obtenerReembolsos')] }),
          codigo(SQL_1),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('¿Cómo filtro por número de asegurado?')] }),
          codigo(SQL_2),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('obtenerPolizas')] }),
          codigo(SQL_3),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('¿Cómo filtro por fecha?')] }),
          codigo(SQL_4)
        ]
      }
    ]
  });
  const destino = path.join(root, 'docs', 'funcionalidades.docx');
  await fs.promises.mkdir(path.dirname(destino), { recursive: true });
  await fs.promises.writeFile(destino, await Packer.toBuffer(doc));
  return destino;
}

function hijosBody(xml: string): Element[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const body = doc.getElementsByTagName('w:body')[0];
  const res: Element[] = [];
  for (let n = body.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1) {
      res.push(n as Element);
    }
  }
  return res;
}

const ser = (el: Element | undefined): string => (el ? new XMLSerializer().serializeToString(el) : '');
function hijo(el: Element, nombre: string): Element | undefined {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).nodeName === nombre) {
      return n as Element;
    }
  }
  return undefined;
}
const pStyle = (el: Element): string | undefined => {
  const ppr = hijo(el, 'w:pPr');
  return (ppr ? hijo(ppr, 'w:pStyle') : undefined)?.getAttribute('w:val') ?? undefined;
};

const SECCIONES = [
  { encabezado: '', contenido: '```sql\nSELECT ID_ASEG FROM T_SOL_ASEG\n```' },
  { encabezado: '¿Cómo filtro por número de póliza?', contenido: '```sql\nSELECT ID_ASEG FROM T_SOL_ASEG WHERE NUM_POL = :poliza\n```' }
];

function entrada(extra = {}) {
  return inputBase({ modo: 'anexar', titulo: 'obtenerSolicitudesAsegurados', secciones: SECCIONES, mapeoNombres: MAPEO, ...extra });
}

describe('estructura y modo anexar', () => {
  it('leerEstructuraDocx detecta encabezados, patrón y muestra', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    const e = leerEstructuraDocx(fs.readFileSync(destino));
    assert.ok(e.encabezados.some((h) => h.texto === 'obtenerReembolsos' && h.nivel === 1 && h.styleId === 'Heading1'));
    assert.ok(e.encabezados.some((h) => h.nivel === 2 && h.styleId === 'Heading2'));
    assert.strictEqual(e.nivelBase, 1);
    assert.deepStrictEqual(e.patronDominante?.patron, ['codigo', 'H2', 'codigo']);
    assert.strictEqual(e.patronDominante?.bloques, 2);
    assert.strictEqual(e.patronDominante?.total, 2);
    const muestra = e.muestra?.lineas.join('\n') ?? '';
    assert.ok(muestra.includes('obtenerPolizas'));
    assert.ok(muestra.includes('FROM T_POLIZAS'));
    assert.deepStrictEqual(e.seccionesDocuSesion, []);
    const txt = await leerEstructura(destino, 'docx');
    assert.ok(txt.includes('exists: yes') && txt.includes('"code, H2, code" (2 of 2 blocks)'));
    assert.ok((await leerEstructura(path.join(root, 'no.docx'), 'docx')).includes('exists: no'));
  });

  it('anexa el bloque al final sin tocar lo existente', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    const original = leerParte(destino, 'word/document.xml');
    const stylesOriginal = leerParte(destino, 'word/styles.xml');
    const bufferOriginal = fs.readFileSync(destino);

    const r = await documentar(entrada(), ctxBase(root, destino));
    assert.strictEqual(r.accion, 'anexado');
    assert.deepStrictEqual(r.avisos, []);

    const nuevo = leerParte(destino, 'word/document.xml');
    const antes = hijosBody(original);
    const despues = hijosBody(nuevo);
    const sectAntes = antes[antes.length - 1];
    assert.strictEqual(sectAntes.nodeName, 'w:sectPr');
    const contenidoAntes = antes.slice(0, -1);
    contenidoAntes.forEach((el, i) => assert.strictEqual(ser(despues[i]), ser(el), `nodo ${i} cambiado`));
    assert.strictEqual(despues[despues.length - 1].nodeName, 'w:sectPr');
    assert.strictEqual(ser(despues[despues.length - 1]), ser(sectAntes));

    const anadidos = despues.slice(contenidoAntes.length, -1);
    assert.strictEqual(anadidos.length, 4);
    assert.strictEqual(pStyle(anadidos[0]), 'Heading1');
    assert.strictEqual(pStyle(anadidos[2]), 'Heading2');
    const origCod = contenidoAntes[contenidoAntes.length - 1];
    for (const i of [1, 3]) {
      assert.strictEqual(ser(hijo(anadidos[i], 'w:pPr')), ser(hijo(origCod, 'w:pPr')));
      const rOrig = hijo(origCod, 'w:r') as Element;
      const rNuevo = hijo(anadidos[i], 'w:r') as Element;
      assert.strictEqual(ser(hijo(rNuevo, 'w:rPr')), ser(hijo(rOrig, 'w:rPr')));
    }
    const plano = textoPlano(nuevo);
    assert.ok(plano.includes('obtenerSolicitudesAsegurados'));
    assert.ok(plano.includes('¿Cómo filtro por número de póliza?'));
    for (const prohibido of ['Historial de cambios', 'Correspondencia', 'Archivos consultados', 'Avisos de verificación']) {
      assert.ok(!plano.includes(prohibido), `no debe aparecer ${prohibido}`);
    }
    assert.strictEqual(leerParte(destino, 'word/styles.xml'), stylesOriginal);

    const dirBackup = path.join(root, '.docusesion', 'backups');
    const backups = fs.readdirSync(dirBackup);
    assert.strictEqual(backups.length, 1);
    assert.ok(fs.readFileSync(path.join(dirBackup, backups[0])).equals(bufferOriginal));
  });

  it('es idempotente: repetición idéntica sin cambios; mismo título con otro contenido se rechaza', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    await documentar(entrada(), ctxBase(root, destino));
    const tras1 = leerParte(destino, 'word/document.xml');

    const r2 = await documentar(entrada(), ctxBase(root, destino));
    assert.strictEqual(r2.accion, 'sin_cambios');
    assert.strictEqual(leerParte(destino, 'word/document.xml'), tras1);
    assert.strictEqual(fs.readdirSync(path.join(root, '.docusesion', 'backups')).length, 1);
    assert.strictEqual(textoPlano(tras1).split('obtenerSolicitudesAsegurados').length - 1, 1);

    const r3 = await documentar(
      entrada({ secciones: [{ encabezado: 'Otra', contenido: 'texto distinto' }] }),
      ctxBase(root, destino)
    );
    assert.strictEqual(r3.accion, 'no_escrito');
    assert.ok(r3.avisos.some((a) => a.includes('con contenido distinto')));
    assert.strictEqual(leerParte(destino, 'word/document.xml'), tras1);
    assert.strictEqual(fs.readdirSync(path.join(root, '.docusesion', 'backups')).length, 1);
  });

  it('anexar sobre un destino inexistente crea el archivo', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'nuevo.docx');
    const r = await documentar(entrada(), ctxBase(root, destino));
    assert.strictEqual(r.accion, 'creado');
    assert.ok(fs.existsSync(destino));
  });

  it('modoEfectivo y manifiesto', () => {
    assert.strictEqual(modoEfectivo('anexar', true, 'docx'), 'anexar');
    assert.strictEqual(modoEfectivo('anexar', false, 'docx'), 'crear');
    assert.strictEqual(modoEfectivo('anexar', true, 'xlsx'), 'actualizar');
    assert.strictEqual(modoEfectivo('anexar', true, 'pptx'), 'sufijo');
    const t = pkg.contributes.languageModelTools;
    assert.strictEqual(t[0].name, 'docusesion_documentar');
    assert.strictEqual(t[1].name, 'docusesion_leerEstructura');
    assert.strictEqual(t[1].toolReferenceName, 'estructuraDocumento');
    assert.deepStrictEqual(t[1].inputSchema, inputSchemaEstructura);
  });
});
