import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { documentar } from '../core/documentar';
import { crearRoot, ctxBase, inputBase, MAPEO } from './util';

async function abrir(abs: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(abs);
  return wb;
}

function filaPor(ws: ExcelJS.Worksheet, texto: string): ExcelJS.Row | undefined {
  for (let r = 2; r <= ws.rowCount; r++) {
    if (String(ws.getRow(r).getCell(1).text) === texto) {
      return ws.getRow(r);
    }
  }
  return undefined;
}

const argb = (c: ExcelJS.Cell): string | undefined => (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

const EJEMPLOS = [
  { titulo: 'Consulta', tipo: 'sql' as const, contenido: 'SELECT 1', explicacion: 'Prueba' }
];

describe('xlsx', () => {
  it('crea las hojas Registro, Mapeo BD y Ejemplos con el resaltado por estado', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'registro.xlsx');
    const r = await documentar(inputBase({ mapeoNombres: MAPEO, ejemplos: EJEMPLOS }), ctxBase(root, destino));
    assert.strictEqual(r.accion, 'creado');
    const wb = await abrir(destino);
    assert.deepStrictEqual(wb.worksheets.map((w) => w.name), ['Registro', 'Mapeo BD', 'Ejemplos']);

    const registro = wb.getWorksheet('Registro')!;
    assert.deepStrictEqual(
      [1, 2, 3, 4, 5].map((c) => registro.getRow(1).getCell(c).text),
      ['Fecha', 'Tipo', 'Título', 'Resumen', 'Archivos']
    );
    assert.strictEqual(registro.getRow(2).getCell(3).text, 'Documento de prueba');

    const mapeo = wb.getWorksheet('Mapeo BD')!;
    assert.strictEqual(argb(filaPor(mapeo, 'fechaAlta')!.getCell(1)), 'FFFFFF00');
    assert.strictEqual(argb(filaPor(mapeo, '${app.db.schema}')!.getCell(2)), 'FFDDEBF7');
    assert.notStrictEqual(argb(filaPor(mapeo, 'SolicitudAsegurado')!.getCell(1)), 'FFFFFF00');
    assert.strictEqual(filaPor(mapeo, 'SolicitudAsegurado')!.getCell(2).text, 'T_SOL_ASEG');
  });

  it('no crea las hojas Mapeo BD y Ejemplos si no hay datos', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'solo-registro.xlsx');
    await documentar(inputBase(), ctxBase(root, destino));
    const wb = await abrir(destino);
    assert.deepStrictEqual(wb.worksheets.map((w) => w.name), ['Registro']);
  });

  it('actualiza: copia el estilo de la fila anterior, actualiza el mapeo existente, añade el nuevo y hace backup', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'registro.xlsx');
    await documentar(
      inputBase({
        titulo: 'Primero',
        mapeoNombres: [
          { nombreEnCodigo: 'fechaAlta', nombreReal: 'FECHA_ALTA', tipoObjeto: 'columna', origen: 'x.sql:1', estado: 'pendiente_de_verificar' }
        ]
      }),
      ctxBase(root, destino)
    );

    // Estilo propio en la fila 2 de Registro.
    let wb = await abrir(destino);
    const reg = wb.getWorksheet('Registro')!;
    for (let c = 1; c <= 5; c++) {
      const cell = reg.getRow(2).getCell(c);
      cell.font = { bold: true, italic: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    }
    await wb.xlsx.writeFile(destino);

    const r = await documentar(
      inputBase({
        titulo: 'Segundo',
        mapeoNombres: [
          // Mismo nombreEnCodigo + tipoObjeto (otro caso): se actualiza y deja de ser pendiente.
          { nombreEnCodigo: 'FECHAALTA', nombreReal: 'FECHA_ALTA', tipoObjeto: 'columna', origen: 'src/main/resources/V1__crear_tablas.sql:1', estado: 'depende_de_entorno' },
          // Nuevo.
          { nombreEnCodigo: 'SolicitudAsegurado', nombreReal: 'T_SOL_ASEG', tipoObjeto: 'tabla', origen: 'src/main/resources/V1__crear_tablas.sql:1', estado: 'verificado' }
        ]
      }),
      ctxBase(root, destino, { fecha: new Date(2026, 4, 17, 10, 31, 0) })
    );
    assert.strictEqual(r.accion, 'actualizado');
    assert.ok(r.backup && fs.existsSync(r.backup));
    assert.match(path.basename(r.backup!), /^registro-20260517-103100\.xlsx$/);

    wb = await abrir(destino);
    const reg2 = wb.getWorksheet('Registro')!;
    assert.strictEqual(reg2.getRow(3).getCell(3).text, 'Segundo');
    assert.strictEqual(reg2.getRow(3).getCell(3).font?.bold, true);
    assert.strictEqual(reg2.getRow(3).getCell(3).font?.italic, true);
    assert.strictEqual(argb(reg2.getRow(3).getCell(3)), 'FF00FF00');

    const mapeo = wb.getWorksheet('Mapeo BD')!;
    assert.strictEqual(mapeo.rowCount, 3, 'cabecera + fila actualizada + fila nueva');
    const fila = filaPor(mapeo, 'FECHAALTA') ?? filaPor(mapeo, 'fechaAlta')!;
    assert.strictEqual(argb(fila.getCell(1)), 'FFDDEBF7', 'el relleno se actualiza al cambiar el estado');
    const nueva = filaPor(mapeo, 'SolicitudAsegurado')!;
    assert.notStrictEqual(argb(nueva.getCell(1)), 'FFDDEBF7');
    assert.notStrictEqual(argb(nueva.getCell(1)), 'FFFFFF00');
  });

  it('al pasar de pendiente a verificado quita el relleno amarillo', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'estado.xlsx');
    const m = (estado: 'pendiente_de_verificar' | 'verificado') => [
      { nombreEnCodigo: 'SolicitudAsegurado', nombreReal: 'T_SOL_ASEG', tipoObjeto: 'tabla' as const, origen: 'src/main/resources/V1__crear_tablas.sql:1', estado }
    ];
    await documentar(inputBase({ mapeoNombres: m('pendiente_de_verificar') }), ctxBase(root, destino));
    let wb = await abrir(destino);
    assert.strictEqual(argb(filaPor(wb.getWorksheet('Mapeo BD')!, 'SolicitudAsegurado')!.getCell(1)), 'FFFFFF00');
    await documentar(inputBase({ mapeoNombres: m('verificado') }), ctxBase(root, destino, { fecha: new Date(2026, 4, 17, 11, 0, 0) }));
    wb = await abrir(destino);
    assert.notStrictEqual(argb(filaPor(wb.getWorksheet('Mapeo BD')!, 'SolicitudAsegurado')!.getCell(1)), 'FFFFFF00');
  });

  it('crea las hojas que faltan al actualizar un libro existente', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'faltan.xlsx');
    await documentar(inputBase(), ctxBase(root, destino));
    const r = await documentar(inputBase({ mapeoNombres: MAPEO, ejemplos: EJEMPLOS }), ctxBase(root, destino, { fecha: new Date(2026, 4, 17, 11, 0, 0) }));
    assert.deepStrictEqual(r.seccionesCreadas.sort(), ['Ejemplos', 'Mapeo BD']);
    const wb = await abrir(destino);
    assert.deepStrictEqual(wb.worksheets.map((w) => w.name), ['Registro', 'Mapeo BD', 'Ejemplos']);
  });

  it('localiza las columnas por el texto de la cabecera aunque estén reordenadas', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'orden.xlsx');
    await fs.promises.mkdir(path.dirname(destino), { recursive: true });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Registro');
    ws.addRow(['Título', 'Resumen', 'Fecha', 'Tipo', 'Archivos']);
    await wb.xlsx.writeFile(destino);
    await documentar(inputBase({ titulo: 'Reordenado' }), ctxBase(root, destino));
    const wb2 = await abrir(destino);
    const fila = wb2.getWorksheet('Registro')!.getRow(2);
    assert.strictEqual(fila.getCell(1).text, 'Reordenado');
    assert.strictEqual(fila.getCell(3).text, '2026-05-17');
  });
});
