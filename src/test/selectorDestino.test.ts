import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { resolverDestino } from '../core/rutas';
import { RegistroRutasAprobadas } from '../core/rutasAprobadas';
import { decidirTrasSeleccion, rutaSugeridaNueva, validarArchivoElegido } from '../core/selectorDestino';

describe('RegistroRutasAprobadas', () => {
  const base = path.resolve(os.tmpdir(), 'ext-aprobadas');
  const ruta = path.join(base, 'a.docx');
  const MIN = 60 * 1000;

  it('aprueba y consulta la ruta exacta', () => {
    const r = new RegistroRutasAprobadas({ insensibleMayusculas: false });
    r.aprobar(ruta);
    assert.strictEqual(r.estaAprobada(ruta), true);
    assert.strictEqual(r.estaAprobada(path.join(base, 'b.docx')), false);
  });

  it('las rutas relativas no se aprueban ni se consultan', () => {
    const r = new RegistroRutasAprobadas({ insensibleMayusculas: false });
    r.aprobar('a.docx');
    assert.strictEqual(r.estaAprobada('a.docx'), false);
  });

  it('caduca con el ttl (29 min si, 31 min no)', () => {
    let ahora = 1000;
    const r = new RegistroRutasAprobadas({ ahora: () => ahora, insensibleMayusculas: false });
    r.aprobar(ruta);
    ahora += 29 * MIN;
    assert.strictEqual(r.estaAprobada(ruta), true);
    ahora += 2 * MIN;
    assert.strictEqual(r.estaAprobada(ruta), false);
  });

  it('respeta el máximo expulsando la más antigua', () => {
    const r = new RegistroRutasAprobadas({ max: 2, insensibleMayusculas: false });
    const a = path.join(base, '1.docx');
    const b = path.join(base, '2.docx');
    const c = path.join(base, '3.docx');
    r.aprobar(a);
    r.aprobar(b);
    r.aprobar(c);
    assert.strictEqual(r.estaAprobada(a), false);
    assert.strictEqual(r.estaAprobada(b), true);
    assert.strictEqual(r.estaAprobada(c), true);
  });

  it('insensible a mayúsculas solo con la opción explícita', () => {
    const sensible = new RegistroRutasAprobadas({ insensibleMayusculas: false });
    const insensible = new RegistroRutasAprobadas({ insensibleMayusculas: true });
    sensible.aprobar(ruta);
    insensible.aprobar(ruta);
    assert.strictEqual(sensible.estaAprobada(ruta.toUpperCase()), false);
    assert.strictEqual(insensible.estaAprobada(ruta.toUpperCase()), true);
  });

  it('limpiar vacía el registro', () => {
    const r = new RegistroRutasAprobadas({ insensibleMayusculas: false });
    r.aprobar(ruta);
    r.limpiar();
    assert.strictEqual(r.estaAprobada(ruta), false);
  });

  it('en win32 C:/X/a.docx equivale a c:\\x\\A.DOCX', function () {
    if (process.platform !== 'win32') {
      this.skip();
    }
    const r = new RegistroRutasAprobadas();
    r.aprobar('C:/X/a.docx');
    assert.strictEqual(r.estaAprobada('c:\\x\\A.DOCX'), true);
  });
});

describe('resolverDestino con ruta aprobada', () => {
  const root = path.resolve(os.tmpdir(), 'ws-selector');
  const fuera = path.resolve(os.tmpdir(), 'otro-sitio-selector', 'doc.docx');

  it('acepta una absoluta externa aprobada sin permitirFuera', () => {
    const d = resolverDestino(root, { titulo: 't', destino: fuera }, '', false, (abs) => abs === fuera);
    assert.strictEqual(d.fuera, true);
    assert.strictEqual(d.abs, fuera);
  });

  it('rechaza una absoluta externa no aprobada mencionando el ajuste', () => {
    assert.throws(
      () => resolverDestino(root, { titulo: 't', destino: fuera }, '', false, () => false),
      /permitirRutasFueraDelWorkspace/
    );
  });

  it('una relativa que escapa se rechaza aunque el callback devuelva true', () => {
    assert.throws(
      () => resolverDestino(root, { titulo: 't', destino: '../fuera.docx' }, '', false, () => true),
      /fuera del workspace/
    );
  });
});

describe('validarArchivoElegido', () => {
  const base = path.resolve(os.tmpdir(), 'ext-validar');

  it('sin extensión añade docx o el formato pedido', () => {
    assert.strictEqual(validarArchivoElegido(path.join(base, 'doc'), undefined, true, 'es').abs, path.join(base, 'doc.docx'));
    const x = validarArchivoElegido(path.join(base, 'doc'), 'xlsx', true, 'es');
    assert.strictEqual(x.abs, path.join(base, 'doc.xlsx'));
    assert.strictEqual(x.formato, 'xlsx');
  });

  it('sin extensión y sin permiso lanza', () => {
    assert.throws(() => validarArchivoElegido(path.join(base, 'doc'), undefined, false, 'es'), /extensión/);
  });

  it('extensión no soportada lanza', () => {
    assert.throws(() => validarArchivoElegido(path.join(base, 'a.txt'), undefined, true, 'es'), /\.txt/);
    assert.throws(() => validarArchivoElegido(path.join(base, 'a.txt'), undefined, true, 'en'), /\.txt/);
  });

  it('formato que no coincide lanza', () => {
    assert.throws(() => validarArchivoElegido(path.join(base, 'a.xlsx'), 'docx', true, 'es'), /no coincide/);
  });

  it('acepta mayúsculas y las conserva', () => {
    const v = validarArchivoElegido(path.join(base, 'A.DOCX'), 'docx', false, 'es');
    assert.strictEqual(v.abs, path.join(base, 'A.DOCX'));
    assert.strictEqual(v.formato, 'docx');
  });
});

describe('decidirTrasSeleccion', () => {
  it('nuevo: auto salvo crear', () => {
    assert.deepStrictEqual(decidirTrasSeleccion('nuevo', 'docx', undefined), { accion: 'escribir', modo: 'auto' });
    assert.deepStrictEqual(decidirTrasSeleccion('nuevo', 'docx', 'crear'), { accion: 'escribir', modo: 'crear' });
    assert.deepStrictEqual(decidirTrasSeleccion('nuevo', 'docx', 'anexar'), { accion: 'escribir', modo: 'auto' });
    assert.deepStrictEqual(decidirTrasSeleccion('nuevo', 'xlsx', 'actualizar'), { accion: 'escribir', modo: 'auto' });
  });

  it('existente docx pide anexar', () => {
    assert.deepStrictEqual(decidirTrasSeleccion('existente', 'docx', 'auto'), { accion: 'pedirAnexar' });
  });

  it('existente xlsx/pptx escribe en auto', () => {
    assert.deepStrictEqual(decidirTrasSeleccion('existente', 'xlsx', 'anexar'), { accion: 'escribir', modo: 'auto' });
    assert.deepStrictEqual(decidirTrasSeleccion('existente', 'pptx', undefined), { accion: 'escribir', modo: 'auto' });
  });
});

describe('rutaSugeridaNueva', () => {
  it('usa docs/<slug>.<formato>', () => {
    const root = path.resolve(os.tmpdir(), 'ws-sugerida');
    assert.strictEqual(rutaSugeridaNueva(root, 'Mi Título Ñandú', undefined), path.join(root, 'docs', 'mi-titulo-nandu.docx'));
    assert.strictEqual(rutaSugeridaNueva(root, 'Datos', 'xlsx'), path.join(root, 'docs', 'datos.xlsx'));
  });
});
