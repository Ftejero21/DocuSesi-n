import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { asegurarDentro, modoEfectivo, nombreBackup, resolverDestino, rutaConSufijoFecha, slug } from '../core/rutas';
import { crearRoot } from './util';

describe('rutas', () => {
  const root = path.join(os.tmpdir(), 'ws-rutas');

  it('rechaza rutas que escapan del workspace', () => {
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: '../fuera.docx' }, 'docs'), /fuera del workspace/);
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: 'a/../../fuera.docx' }, 'docs'), /fuera del workspace/);
  });

  it('rechaza rutas absolutas externas y admite las internas', () => {
    const externa = path.resolve(os.tmpdir(), 'otra-carpeta', 'x.docx');
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: externa }, 'docs'), /fuera del workspace/);
    const interna = path.join(root, 'docs', 'x.docx');
    const r = resolverDestino(root, { titulo: 't', destino: interna }, 'docs');
    assert.strictEqual(r.rel, 'docs/x.docx');
  });

  it('admite una absoluta externa con permitirFuera (barras nativas, normales y sin extensión)', () => {
    const externa = path.resolve(os.tmpdir(), 'otra-carpeta', 'x.docx');
    const r = resolverDestino(root, { titulo: 't', destino: externa }, 'docs', true);
    assert.strictEqual(r.abs, externa);
    assert.strictEqual(r.fuera, true);
    assert.strictEqual(r.rel, externa);
    assert.strictEqual(r.formato, 'docx');

    const conBarras = externa.split(path.sep).join('/');
    const r2 = resolverDestino(root, { titulo: 't', destino: conBarras }, 'docs', true);
    assert.strictEqual(r2.abs, externa);
    assert.strictEqual(r2.fuera, true);

    const sinExt = path.resolve(os.tmpdir(), 'otra-carpeta', 'y');
    const r3 = resolverDestino(root, { titulo: 't', destino: sinExt, formato: 'xlsx' }, 'docs', true);
    assert.ok(r3.abs.endsWith('.xlsx'));
    assert.strictEqual(r3.formato, 'xlsx');
    assert.strictEqual(r3.fuera, true);
  });

  it('rechaza la absoluta externa con permitirFuera desactivado y menciona el ajuste', () => {
    const externa = path.resolve(os.tmpdir(), 'otra-carpeta', 'x.docx');
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: externa }, 'docs', false), /permitirRutasFueraDelWorkspace/);
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: externa }, 'docs'), /permitirRutasFueraDelWorkspace/);
  });

  it('las relativas que escapan se rechazan siempre, también con permitirFuera', () => {
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: '../fuera.docx' }, 'docs', true), /fuera del workspace/);
    assert.throws(
      () => resolverDestino(root, { titulo: 't', destino: 'a/../../fuera.docx' }, 'docs', true),
      /fuera del workspace/
    );
  });

  it('una absoluta interna con permitirFuera no es externa', () => {
    const interna = path.join(root, 'docs', 'x.docx');
    const r = resolverDestino(root, { titulo: 't', destino: interna }, 'docs', true);
    assert.strictEqual(r.fuera, false);
    assert.strictEqual(r.rel, 'docs/x.docx');
  });

  it('deduce el formato de la extensión y rechaza extensiones incoherentes', () => {
    assert.strictEqual(resolverDestino(root, { titulo: 't', destino: 'docs/a.xlsx' }, 'docs').formato, 'xlsx');
    assert.strictEqual(resolverDestino(root, { titulo: 't', destino: 'docs/a.pptx' }, 'docs').formato, 'pptx');
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: 'docs/a.docx', formato: 'xlsx' }, 'docs'), /no coincide/);
    assert.throws(() => resolverDestino(root, { titulo: 't', destino: 'docs/a.txt' }, 'docs'), /no soportada/);
  });

  it('destino sin extensión añade .formato (docx por defecto)', () => {
    assert.strictEqual(resolverDestino(root, { titulo: 't', destino: 'docs/a', formato: 'xlsx' }, 'docs').rel, 'docs/a.xlsx');
    assert.strictEqual(resolverDestino(root, { titulo: 't', destino: 'docs/a' }, 'docs').rel, 'docs/a.docx');
  });

  it('sin destino usa carpetaPorDefecto/<slug>.<formato>', () => {
    const r = resolverDestino(root, { titulo: 'Diseño: Solicitudes (v2)!' }, 'documentacion');
    assert.strictEqual(r.rel, 'documentacion/diseno-solicitudes-v2.docx');
    assert.strictEqual(r.formato, 'docx');
    assert.strictEqual(resolverDestino(root, { titulo: 'x', formato: 'pptx' }, 'docs').rel, 'docs/x.pptx');
    assert.strictEqual(slug('¡¡'), 'documento');
  });

  it('modoEfectivo', () => {
    assert.strictEqual(modoEfectivo('auto', true, 'docx'), 'actualizar');
    assert.strictEqual(modoEfectivo(undefined, false, 'docx'), 'crear');
    assert.strictEqual(modoEfectivo('crear', true, 'xlsx'), 'sufijo');
    assert.strictEqual(modoEfectivo('crear', false, 'xlsx'), 'crear');
    assert.strictEqual(modoEfectivo('actualizar', true, 'docx'), 'actualizar');
    assert.throws(() => modoEfectivo('actualizar', false, 'docx'), /actualizar/);
    assert.strictEqual(modoEfectivo('auto', true, 'pptx'), 'sufijo');
    assert.strictEqual(modoEfectivo('actualizar', true, 'pptx'), 'sufijo');
  });

  it('sufijo de fecha y nombre de backup (con -1, -2 si colisiona)', async () => {
    const fecha = new Date(2026, 0, 2, 3, 4, 5);
    assert.strictEqual(path.basename(rutaConSufijoFecha(path.join(root, 'a.pptx'), fecha)), 'a-20260102-030405.pptx');
    const dir = await crearRoot();
    const b0 = nombreBackup(path.join(root, 'd.docx'), dir, fecha);
    assert.strictEqual(path.basename(b0), 'd-20260102-030405.docx');
    fs.writeFileSync(b0, 'x');
    assert.strictEqual(path.basename(nombreBackup(path.join(root, 'd.docx'), dir, fecha)), 'd-20260102-030405-1.docx');
  });

  it('asegurarDentro acepta rutas internas aunque no existan y rechaza las externas', async () => {
    const ws = await crearRoot();
    await asegurarDentro(ws, path.join(ws, 'docs', 'nueva', 'x.docx'));
    await assert.rejects(asegurarDentro(ws, path.join(ws, '..', 'fuera.docx')), /fuera del workspace/);
  });

  it('asegurarDentro detecta escapes por enlaces simbólicos', async function () {
    const ws = await crearRoot();
    const fuera = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'docusesion-fuera-'));
    try {
      await fs.promises.symlink(fuera, path.join(ws, 'enlace'), 'junction');
    } catch {
      this.skip(); // sin permisos para crear enlaces
    }
    await assert.rejects(asegurarDentro(ws, path.join(ws, 'enlace', 'x.docx')), /enlace simbólico/);
  });
});
