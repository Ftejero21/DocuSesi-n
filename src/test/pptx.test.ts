import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { documentar } from '../core/documentar';
import { crearRoot, ctxBase, inputBase, MAPEO } from './util';

function diapositivas(abs: string): string[] {
  const zip = new PizZip(fs.readFileSync(abs));
  return Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .map((n) => zip.file(n)!.asText());
}

describe('pptx', () => {
  it('crea portada + una diapositiva por sección + tabla del mapeo con colores', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'presentacion.pptx');
    const secciones = [
      { encabezado: 'Propósito', contenido: 'Explica el servicio' },
      { encabezado: 'Entrada', contenido: '- idAsegurado\n- poliza' }
    ];
    const r = await documentar(inputBase({ secciones, mapeoNombres: MAPEO }), ctxBase(root, destino));
    assert.strictEqual(r.accion, 'creado');
    const slides = diapositivas(destino);
    assert.strictEqual(slides.length, 1 + secciones.length + 1);
    const todo = slides.join('\n');
    assert.ok(todo.includes('T_SOL_ASEG'));
    assert.ok(todo.includes('FFFF00'));
    assert.ok(todo.includes('DDEBF7'));
    assert.ok(todo.includes('Documento de prueba'));
  });

  it('si el archivo existe crea uno nuevo con sufijo de fecha y avisa', async () => {
    const root = await crearRoot();
    const destino = path.join(root, 'docs', 'presentacion.pptx');
    await documentar(inputBase(), ctxBase(root, destino));
    const original = fs.readFileSync(destino);
    for (const modo of ['auto', 'actualizar'] as const) {
      const r = await documentar(inputBase({ modo }), ctxBase(root, destino));
      assert.strictEqual(r.accion, 'nuevo_con_sufijo');
      assert.match(path.basename(r.rutaFinal), /^presentacion-20260517-103045\.pptx$/);
      assert.ok(fs.existsSync(r.rutaFinal));
      assert.ok(r.avisos.some((a) => a.includes('pptx')));
      assert.ok(fs.readFileSync(destino).equals(original));
      fs.unlinkSync(r.rutaFinal);
    }
  });
});
