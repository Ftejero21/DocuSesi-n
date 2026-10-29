import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import ExcelJS from 'exceljs';
import { Document, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from 'docx';
import PizZip from 'pizzip';
import { documentar } from '../core/documentar';
import { resaltadoSql } from '../core/formatoVisual';
import { inputSchema, inputSchemaRuta } from '../core/schema';
import { esBloqueSql } from '../core/texto';
import { validarInput } from '../core/validacion';
import { crearRoot, ctxBase, inputBase, leerParte, MAPEO, textoPlano } from './util';

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));

const SQL = 'SELECT ID_ASEG FROM T_SOL_ASEG';

function parrafos(xml: string): string[] {
  return xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
}

function parrafoCon(xml: string, texto: string): string {
  const p = parrafos(xml).find((x) => textoPlano(x).includes(texto));
  assert.ok(p, `no hay párrafo con "${texto}"`);
  return p;
}

describe('formato visual: detección y colores', () => {
  it('esBloqueSql: el lenguaje explícito manda; sin lenguaje, la heurística', () => {
    assert.strictEqual(esBloqueSql('SELECT 1 FROM T', 'sql'), true);
    assert.strictEqual(esBloqueSql('x', 'SQL'), true);
    assert.strictEqual(esBloqueSql('SELECT a FROM T', 'java'), false);
    assert.strictEqual(esBloqueSql('SELECT a FROM T'), true);
    assert.strictEqual(esBloqueSql('texto normal sin consulta'), false);
  });

  it('resaltadoSql: undefined sin resaltarSql, amarillo por defecto y mapa de colores', () => {
    assert.strictEqual(resaltadoSql(undefined), undefined);
    assert.strictEqual(resaltadoSql({}), undefined);
    assert.strictEqual(resaltadoSql({ colorResaltado: 'verde' }), undefined);
    assert.deepStrictEqual(resaltadoSql({ resaltarSql: true }), { word: 'yellow', hex: 'FFFF00' });
    assert.strictEqual(resaltadoSql({ resaltarSql: true, colorResaltado: 'azul' })?.word, 'cyan');
    assert.strictEqual(resaltadoSql({ resaltarSql: true, colorResaltado: 'verde' })?.word, 'green');
    assert.strictEqual(resaltadoSql({ resaltarSql: true, colorResaltado: 'violeta' as never })?.word, 'yellow');
  });
});

describe('formato visual: docx crear', () => {
  const secciones = [
    { encabezado: 'SQL', contenido: `Texto.\n\`\`\`sql\n${SQL}\n\`\`\`` },
    { encabezado: 'Java', contenido: '```java\nint x = 1;\n```' }
  ];
  const ejemplos = [
    { titulo: 'Consulta', tipo: 'sql' as const, contenido: 'SELECT NUM_POL FROM T_SOL_ASEG', explicacion: 'e' },
    { titulo: 'Llamada', tipo: 'peticion' as const, contenido: 'GET /servicio/1', explicacion: 'e' }
  ];

  it('resalta solo el SQL con el color pedido', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'sql.docx');
    await documentar(
      inputBase({ secciones, ejemplos, mapeoNombres: MAPEO, formatoVisual: { resaltarSql: true, colorResaltado: 'verde' } }),
      ctxBase(root, destino)
    );
    const xml = leerParte(destino, 'word/document.xml');
    assert.ok(parrafoCon(xml, SQL).includes('w:highlight w:val="green"'));
    assert.ok(parrafoCon(xml, 'SELECT NUM_POL').includes('w:highlight w:val="green"'));
    assert.ok(!parrafoCon(xml, 'int x = 1;').includes('w:highlight'));
    assert.ok(!parrafoCon(xml, 'GET /servicio/1').includes('w:highlight'));
  });

  it('sin formatoVisual no genera ningún w:highlight', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'sin.docx');
    await documentar(inputBase({ secciones, ejemplos, mapeoNombres: MAPEO }), ctxBase(root, destino));
    assert.ok(!leerParte(destino, 'word/document.xml').includes('w:highlight'));
  });
});

describe('formato visual: docx anexar', () => {
  const ser = (el: Element): string => new XMLSerializer().serializeToString(el);
  const hijosBody = (xml: string): Element[] => {
    const body = new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagName('w:body')[0];
    const res: Element[] = [];
    for (let n = body.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1) {
        res.push(n as Element);
      }
    }
    return res;
  };

  async function crearFixture(root: string): Promise<string> {
    const codigo = (t: string): Paragraph =>
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'EEEEEE', color: 'auto' },
        children: [new TextRun({ text: t, font: 'Consolas' })]
      });
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Documentación')] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('obtenerReembolsos')] }),
            codigo('SELECT ID_REEMBOLSO FROM T_REEMBOLSOS')
          ]
        }
      ]
    });
    const destino = path.join(root, 'docs', 'funcionalidades.docx');
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    await fs.promises.writeFile(destino, await Packer.toBuffer(doc));
    return destino;
  }

  it('resalta los párrafos SQL nuevos conservando el formato clonado y no toca lo existente', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    const original = leerParte(destino, 'word/document.xml');
    await documentar(
      inputBase({
        modo: 'anexar',
        titulo: 'obtenerSolicitudes',
        secciones: [
          { encabezado: '', contenido: `\`\`\`sql\n${SQL}\n\`\`\`` },
          { encabezado: '¿Otra pregunta?', contenido: '```java\nint x = 1;\n```' }
        ],
        mapeoNombres: MAPEO,
        formatoVisual: { resaltarSql: true }
      }),
      ctxBase(root, destino)
    );
    const nuevo = leerParte(destino, 'word/document.xml');
    const pSql = parrafoCon(nuevo, SQL);
    assert.ok(pSql.includes('w:highlight w:val="yellow"'));
    assert.ok(pSql.includes('EEEEEE'));
    assert.ok(pSql.includes('Consolas'));
    const pJava = parrafoCon(nuevo, 'int x = 1;');
    assert.ok(!pJava.includes('w:highlight'));
    assert.ok(pJava.includes('EEEEEE'));

    const antes = hijosBody(original);
    const despues = hijosBody(nuevo);
    antes.slice(0, -1).forEach((el, i) => assert.strictEqual(ser(despues[i]), ser(el), `nodo ${i} cambiado`));
    assert.ok(!ser(despues[2]).includes('w:highlight'));
  });
});

describe('formato visual: xlsx y pptx', () => {
  it('xlsx: rellena la celda de contenido del ejemplo SQL', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'sql.xlsx');
    await documentar(
      inputBase({
        ejemplos: [
          { titulo: 'Consulta', tipo: 'sql', contenido: 'SELECT 1', explicacion: 'p' },
          { titulo: 'Llamada', tipo: 'peticion', contenido: 'GET /x', explicacion: 'p' }
        ],
        formatoVisual: { resaltarSql: true, colorResaltado: 'rosa' }
      }),
      ctxBase(root, destino)
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(destino);
    const ws = wb.getWorksheet('Ejemplos')!;
    const argb = (c: ExcelJS.Cell): string | undefined => (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;
    assert.strictEqual(argb(ws.getRow(2).getCell(4)), 'FFFF00FF');
    assert.notStrictEqual(argb(ws.getRow(3).getCell(4)), 'FFFF00FF');
  });

  it('pptx: resalta las líneas de código SQL de las secciones', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'sql.pptx');
    await documentar(
      inputBase({
        secciones: [{ encabezado: 'SQL', contenido: `\`\`\`sql\n${SQL}\n\`\`\`\n\`\`\`java\nint x = 1;\n\`\`\`` }],
        formatoVisual: { resaltarSql: true }
      }),
      ctxBase(root, destino)
    );
    const zip = new PizZip(fs.readFileSync(destino));
    const slide = zip.file('ppt/slides/slide2.xml')!.asText();
    assert.ok(slide.includes('<a:highlight>'));
    const runJava = slide.split('<a:r>').find((r) => r.includes('int x = 1;'));
    assert.ok(runJava && !runJava.includes('<a:highlight>'));
  });
});

describe('formato visual: esquema y manifiesto', () => {
  it('la herramienta de ruta y el participante se declaran como se espera', () => {
    const t = pkg.contributes.languageModelTools[2];
    assert.strictEqual(t.name, 'docusesion_configurarRuta');
    assert.strictEqual(t.toolReferenceName, 'rutaDocumentacion');
    assert.strictEqual(t.canBeReferencedInPrompt, true);
    assert.deepStrictEqual(t.inputSchema, inputSchemaRuta);
    const p = pkg.contributes.chatParticipants[0];
    assert.strictEqual(p.name, 'docusesion');
    assert.ok(p.commands.some((c: { name: string }) => c.name === 'ruta'));
  });

  it('formatoVisual de package.json es idéntico al de schema.ts', () => {
    const props = (inputSchema as { properties: Record<string, unknown> }).properties;
    assert.deepStrictEqual(pkg.contributes.languageModelTools[0].inputSchema.properties.formatoVisual, props.formatoVisual);
  });

  it('validarInput acepta formatoVisual, rellena el color y rechaza colores desconocidos', () => {
    const base = { tipo: 'explicacion', titulo: 't', resumen: 'r' };
    const ok = validarInput({ ...base, formatoVisual: { resaltarSql: true } });
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.strictEqual(ok.input.formatoVisual?.colorResaltado, 'amarillo');
    }
    assert.strictEqual(validarInput({ ...base, formatoVisual: { resaltarSql: true, colorResaltado: 'violeta' } }).ok, false);
  });
});
