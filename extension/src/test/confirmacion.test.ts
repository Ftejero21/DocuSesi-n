import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { DOMParser, XMLSerializer, type Element } from '@xmldom/xmldom';
import { Document, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from 'docx';
import { sugerirTituloAlternativo, textoPlan, validarTituloAlternativo } from '../core/confirmacion';
import { documentar } from '../core/documentar';
import { i18n } from '../core/i18n';
import { DecisionActualizacion, DecisionDuplicado, InfoTituloDuplicado, PlanActualizacion } from '../core/tipos';
import { planActualizarDocx } from '../generators/docx/actualizarDocx';
import { crearRoot, ctxBase, inputBase, leerParte, MAPEO, textoPlano } from './util';

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

function h(nivel: (typeof HeadingLevel)[keyof typeof HeadingLevel], texto: string): Paragraph {
  return new Paragraph({ heading: nivel, children: [new TextRun(texto)] });
}

async function guardar(root: string, nombre: string, children: Paragraph[]): Promise<string> {
  const doc = new Document({ sections: [{ children }] });
  const destino = path.join(root, 'docs', nombre);
  await fs.promises.mkdir(path.dirname(destino), { recursive: true });
  await fs.promises.writeFile(destino, await Packer.toBuffer(doc));
  return destino;
}

function crearFixture(root: string): Promise<string> {
  return guardar(root, 'funcionalidades.docx', [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Documentación de funcionalidades')] }),
    h(HeadingLevel.HEADING_1, 'obtenerReembolsos'),
    codigo(SQL_1),
    h(HeadingLevel.HEADING_2, '¿Cómo filtro por número de asegurado?'),
    codigo(SQL_2),
    h(HeadingLevel.HEADING_1, 'obtenerPolizas'),
    codigo(SQL_3),
    h(HeadingLevel.HEADING_2, '¿Cómo filtro por fecha?'),
    codigo(SQL_4)
  ]);
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

const SECCIONES = [
  { encabezado: '', contenido: '```sql\nSELECT ID_ASEG FROM T_SOL_ASEG\n```' },
  { encabezado: '¿Cómo filtro por número de póliza?', contenido: '```sql\nSELECT ID_ASEG FROM T_SOL_ASEG WHERE NUM_POL = :poliza\n```' }
];
const DISTINTAS = [{ encabezado: 'Otra', contenido: 'texto distinto' }];
const TITULO = 'obtenerSolicitudesAsegurados';

function entrada(extra = {}) {
  return inputBase({ modo: 'anexar', titulo: TITULO, secciones: SECCIONES, mapeoNombres: MAPEO, ...extra });
}

function dirBackups(root: string): string[] {
  const d = path.join(root, '.docusesion', 'backups');
  return fs.existsSync(d) ? fs.readdirSync(d).map((f) => path.join(d, f)) : [];
}

function spyDuplicado(decision: DecisionDuplicado): { llamadas: InfoTituloDuplicado[]; cb: (i: InfoTituloDuplicado) => Promise<DecisionDuplicado> } {
  const llamadas: InfoTituloDuplicado[] = [];
  return {
    llamadas,
    cb: async (i) => {
      llamadas.push(i);
      return decision;
    }
  };
}

describe('confirmación al actualizar', () => {
  it('planActualizarDocx clasifica sustituir/ampliar/añadir sin tocar nada', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'doc.docx');
    await documentar(inputBase(), ctxBase(root, destino));
    const buffer = fs.readFileSync(destino);

    const ctx = ctxBase(root, destino);
    const input = inputBase({
      secciones: [
        { encabezado: 'Propósito', contenido: 'Nuevo propósito.' },
        { encabezado: 'Entrada', contenido: 'Parámetros.' }
      ],
      mapeoNombres: MAPEO
    });
    const plan = planActualizarDocx(buffer, input, ctx);
    const t = i18n('es');
    assert.strictEqual(plan.formato, 'docx');
    assert.deepStrictEqual(plan.sustituir, ['Propósito']);
    assert.ok(plan.anadir.includes('Entrada'));
    assert.ok(plan.anadir.includes(t.correspondencia));
    assert.ok(!plan.anadir.includes('Propósito'));
    assert.ok(plan.ampliar.some((a) => a.startsWith(t.historial)));
    assert.deepStrictEqual(ctx.avisos, []);
    assert.ok(fs.readFileSync(destino).equals(buffer));
    const texto = textoPlan(plan, 'doc.docx', 'es');
    assert.ok(texto.includes('Archivo: doc.docx') && texto.includes('• Propósito') && texto.includes('• Entrada'));
  });

  it('documentar con auto sobre un docx existente respeta la decisión del usuario', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'doc.docx');
    await documentar(inputBase(), ctxBase(root, destino));
    const original = fs.readFileSync(destino);
    const nuevo = inputBase({ modo: 'auto', titulo: 'Otro', secciones: [{ encabezado: 'Propósito', contenido: 'Cambiado.' }] });

    for (const decision of ['cancelar', 'anexar'] as const) {
      const planes: PlanActualizacion[] = [];
      const r = await documentar(
        nuevo,
        ctxBase(root, destino, {
          confirmarActualizacion: async (p) => {
            planes.push(p);
            return decision;
          }
        })
      );
      assert.strictEqual(r.accion, 'no_escrito');
      assert.strictEqual(r.decisionUsuario, decision);
      assert.strictEqual(planes.length, 1);
      assert.ok(fs.readFileSync(destino).equals(original));
      assert.deepStrictEqual(dirBackups(root), []);
      assert.ok(r.avisos[0].length > 0);
    }

    const r = await documentar(
      nuevo,
      ctxBase(root, destino, { confirmarActualizacion: async (): Promise<DecisionActualizacion> => 'actualizar' })
    );
    assert.strictEqual(r.accion, 'actualizado');
    assert.strictEqual(dirBackups(root).length, 1);
    assert.ok(textoPlano(leerParte(destino, 'word/document.xml')).includes('Cambiado.'));
  });

  it('xlsx existente pide confirmación con plan xlsx; archivo nuevo no pregunta', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'doc.xlsx');
    let llamadas = 0;
    const cb = async (): Promise<DecisionActualizacion> => {
      llamadas++;
      return 'cancelar';
    };
    const r0 = await documentar(inputBase({ mapeoNombres: MAPEO }), ctxBase(root, destino, { confirmarActualizacion: cb }));
    assert.strictEqual(r0.accion, 'creado');
    assert.strictEqual(llamadas, 0);
    const original = fs.readFileSync(destino);

    let plan: PlanActualizacion | undefined;
    const r = await documentar(
      inputBase({ modo: 'auto', mapeoNombres: MAPEO }),
      ctxBase(root, destino, {
        confirmarActualizacion: async (p) => {
          plan = p;
          return 'cancelar';
        }
      })
    );
    assert.strictEqual(r.accion, 'no_escrito');
    assert.strictEqual(plan?.formato, 'xlsx');
    assert.ok(plan?.sustituir.includes('Mapeo BD: SolicitudAsegurado (Tabla)'));
    assert.ok(plan?.anadir.includes('Registro: fila nueva de registro'));
    assert.ok(fs.readFileSync(destino).equals(original));
    assert.deepStrictEqual(dirBackups(root), []);
  });
});

describe('anexar con título duplicado', () => {
  it('contenido idéntico en cualquier ocurrencia: sin_cambios sin preguntar', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    await documentar(entrada(), ctxBase(root, destino));
    // Otro bloque al final: el duplicado ya no es el último.
    await documentar(entrada({ titulo: 'otraFuncionalidad' }), ctxBase(root, destino));
    const antes = leerParte(destino, 'word/document.xml');

    const spy = spyDuplicado({ accion: 'cancelar' });
    const r = await documentar(entrada(), ctxBase(root, destino, { resolverTituloDuplicado: spy.cb }));
    assert.strictEqual(r.accion, 'sin_cambios');
    assert.strictEqual(spy.llamadas.length, 0);
    assert.strictEqual(leerParte(destino, 'word/document.xml'), antes);
  });

  it('sustituir reemplaza solo ese bloque', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    await documentar(entrada(), ctxBase(root, destino));
    const previo = fs.readFileSync(destino);
    const original = leerParte(destino, 'word/document.xml');
    const antes = hijosBody(original);
    const idx = antes.findIndex((el) => textoPlano(ser(el)) === TITULO);
    assert.ok(idx > 0);

    const spy = spyDuplicado({ accion: 'sustituir' });
    const r = await documentar(entrada({ secciones: DISTINTAS }), ctxBase(root, destino, { resolverTituloDuplicado: spy.cb }));
    assert.strictEqual(r.accion, 'sustituido');
    assert.deepStrictEqual(r.seccionesActualizadas, [TITULO]);
    assert.deepStrictEqual(r.seccionesCreadas, []);
    assert.strictEqual(spy.llamadas.length, 1);
    assert.strictEqual(spy.llamadas[0].ocurrencias, 1);
    assert.ok(spy.llamadas[0].titulosExistentes.includes('obtenerPolizas'));

    const nuevo = leerParte(destino, 'word/document.xml');
    const despues = hijosBody(nuevo);
    antes.slice(0, idx).forEach((el, i) => assert.strictEqual(ser(despues[i]), ser(el), `nodo ${i} cambiado`));
    assert.strictEqual(despues[despues.length - 1].nodeName, 'w:sectPr');
    assert.strictEqual(ser(despues[despues.length - 1]), ser(antes[antes.length - 1]));
    assert.strictEqual(ser(hijo(despues[idx], 'w:pPr')), ser(hijo(antes[idx], 'w:pPr')));
    const bloque = textoPlano(despues.slice(idx, -1).map(ser).join(''));
    assert.ok(bloque.includes('texto distinto') && bloque.includes('Otra'));
    assert.ok(!bloque.includes('¿Cómo filtro por número de póliza?'));
    assert.ok(dirBackups(root).some((f) => fs.readFileSync(f).equals(previo)));
  });

  it('con varias ocurrencias sustituye la última y avisa', async () => {
    const root = await crearRoot();
    const destino = await guardar(root, 'dup.docx', [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Doc')] }),
      h(HeadingLevel.HEADING_1, 'dup'),
      codigo('SELECT PRIMERO FROM T_UNO'),
      h(HeadingLevel.HEADING_1, 'dup'),
      codigo('SELECT SEGUNDO FROM T_DOS'),
      h(HeadingLevel.HEADING_1, 'final'),
      codigo('SELECT FINAL FROM T_TRES')
    ]);
    const spy = spyDuplicado({ accion: 'sustituir' });
    const r = await documentar(
      entrada({
        titulo: 'dup',
        mapeoNombres: undefined,
        secciones: [{ encabezado: '', contenido: '```sql\nSELECT NUEVO FROM T_NUEVA\n```' }]
      }),
      ctxBase(root, destino, { resolverTituloDuplicado: spy.cb })
    );
    assert.strictEqual(r.accion, 'sustituido');
    assert.strictEqual(spy.llamadas[0].ocurrencias, 2);
    assert.ok(r.avisos.some((a) => a.includes('solo el último')));
    const plano = textoPlano(leerParte(destino, 'word/document.xml'));
    assert.ok(plano.includes('SELECT PRIMERO FROM T_UNO'));
    assert.ok(!plano.includes('SELECT SEGUNDO FROM T_DOS'));
    assert.ok(plano.includes('SELECT NUEVO FROM T_NUEVA'));
    assert.ok(plano.includes('SELECT FINAL FROM T_TRES'));
  });

  it('nuevoTitulo válido anexa con el título nuevo y deja intacto el bloque original', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    await documentar(entrada(), ctxBase(root, destino));
    const original = leerParte(destino, 'word/document.xml');
    const antes = hijosBody(original).slice(0, -1);

    const nuevoTitulo = `${TITULO} (2)`;
    const spy = spyDuplicado({ accion: 'nuevoTitulo', titulo: `  ${nuevoTitulo}  ` });
    const r = await documentar(entrada({ secciones: DISTINTAS }), ctxBase(root, destino, { resolverTituloDuplicado: spy.cb }));
    assert.strictEqual(r.accion, 'anexado');
    assert.strictEqual(r.seccionesCreadas[0], nuevoTitulo);
    const despues = hijosBody(leerParte(destino, 'word/document.xml'));
    antes.forEach((el, i) => assert.strictEqual(ser(despues[i]), ser(el), `nodo ${i} cambiado`));
    const plano = textoPlano(leerParte(destino, 'word/document.xml'));
    assert.ok(plano.includes(nuevoTitulo) && plano.includes('texto distinto'));
  });

  it('nuevoTitulo ya existente: no_escrito', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    await documentar(entrada(), ctxBase(root, destino));
    const antes = fs.readFileSync(destino);
    const spy = spyDuplicado({ accion: 'nuevoTitulo', titulo: 'OBTENERPOLIZAS' });
    const r = await documentar(entrada({ secciones: DISTINTAS }), ctxBase(root, destino, { resolverTituloDuplicado: spy.cb }));
    assert.strictEqual(r.accion, 'no_escrito');
    assert.ok(fs.readFileSync(destino).equals(antes));
    assert.strictEqual(dirBackups(root).length, 1);
  });

  it('cancelar: no_escrito con decisionUsuario y el archivo sin cambios', async () => {
    const root = await crearRoot();
    const destino = await crearFixture(root);
    await documentar(entrada(), ctxBase(root, destino));
    const antes = fs.readFileSync(destino);
    const spy = spyDuplicado({ accion: 'cancelar' });
    const r = await documentar(entrada({ secciones: DISTINTAS }), ctxBase(root, destino, { resolverTituloDuplicado: spy.cb }));
    assert.strictEqual(r.accion, 'no_escrito');
    assert.strictEqual(r.decisionUsuario, 'cancelar');
    assert.ok(r.avisos.some((a) => a.includes('NO reintentes')));
    assert.ok(fs.readFileSync(destino).equals(antes));
    assert.strictEqual(dirBackups(root).length, 1);
  });
});

describe('título alternativo', () => {
  it('validarTituloAlternativo', () => {
    const existentes = ['obtenerPolizas', 'Cómo funciona'];
    assert.ok(validarTituloAlternativo('', existentes, 'es'));
    assert.ok(validarTituloAlternativo('   ', existentes, 'es'));
    assert.ok(validarTituloAlternativo('OBTENERPOLIZAS', existentes, 'es'));
    assert.ok(validarTituloAlternativo('como funciona', existentes, 'en'));
    assert.strictEqual(validarTituloAlternativo('obtenerPolizas (2)', existentes, 'es'), undefined);
  });

  it('sugerirTituloAlternativo', () => {
    assert.strictEqual(sugerirTituloAlternativo('abc', ['abc']), 'abc (2)');
    assert.strictEqual(sugerirTituloAlternativo('abc', ['abc', 'ABC (2)']), 'abc (3)');
  });
});
