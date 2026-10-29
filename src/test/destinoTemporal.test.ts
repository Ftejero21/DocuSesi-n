import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { debeConsumirTemporal, elegirOrigenDestino, RegistroDestinoTemporal } from '../core/destinoTemporal';

describe('RegistroDestinoTemporal', () => {
  const base = path.resolve(os.tmpdir(), 'ext-temporal');
  const doc = path.join(base, 'a.docx');
  const carpeta = path.join(base, 'carpeta');
  const MIN = 60 * 1000;

  function crear(ahora: { t: number }, insensible = false): RegistroDestinoTemporal {
    return new RegistroDestinoTemporal({ ahora: () => ahora.t, insensibleMayusculas: insensible });
  }

  it('establece, devuelve y consume', () => {
    const reloj = { t: 1000 };
    const r = crear(reloj);
    assert.strictEqual(r.actual(), undefined);
    r.establecer(doc);
    assert.strictEqual(r.actual()?.ruta, path.resolve(doc));
    assert.strictEqual(r.actual()?.tipo, 'documento');
    r.consumir();
    assert.strictEqual(r.actual(), undefined);
  });

  it('distingue documento y carpeta', () => {
    const r = crear({ t: 0 });
    r.establecer(carpeta);
    assert.strictEqual(r.actual()?.tipo, 'carpeta');
    r.establecer(path.join(base, 'x.XLSX'));
    assert.strictEqual(r.actual()?.tipo, 'documento');
  });

  it('rechaza rutas relativas', () => {
    const r = crear({ t: 0 });
    assert.throws(() => r.establecer('docs/a.docx'));
    assert.strictEqual(r.actual(), undefined);
  });

  it('caduca a los 30 minutos', () => {
    const reloj = { t: 0 };
    const r = crear(reloj);
    r.establecer(doc);
    reloj.t = 30 * MIN - 1;
    assert.ok(r.actual());
    assert.strictEqual(r.minutosRestantes(), 1);
    reloj.t = 30 * MIN;
    assert.strictEqual(r.actual(), undefined);
    assert.strictEqual(r.cubre(doc), false);
  });

  it('cubre: documento exacto', () => {
    const r = crear({ t: 0 });
    r.establecer(doc);
    assert.strictEqual(r.cubre(doc), true);
    assert.strictEqual(r.cubre(path.join(base, 'b.docx')), false);
    assert.strictEqual(r.cubre(path.join(base, 'sub', 'a.docx')), false);
    assert.strictEqual(r.cubre('a.docx'), false);
  });

  it('cubre: carpeta solo hijos directos', () => {
    const r = crear({ t: 0 });
    r.establecer(carpeta);
    assert.strictEqual(r.cubre(path.join(carpeta, 'x.docx')), true);
    assert.strictEqual(r.cubre(path.join(carpeta, 'sub', 'x.docx')), false);
    assert.strictEqual(r.cubre(path.join(base, 'x.docx')), false);
  });

  it('cubre es false tras consumir', () => {
    const r = crear({ t: 0 });
    r.establecer(doc);
    r.consumir();
    assert.strictEqual(r.cubre(doc), false);
  });

  it('cubre respeta mayúsculas según la opción', () => {
    const sensible = crear({ t: 0 }, false);
    sensible.establecer(doc);
    assert.strictEqual(sensible.cubre(doc.toUpperCase()), false);
    const insensible = crear({ t: 0 }, true);
    insensible.establecer(doc);
    assert.strictEqual(insensible.cubre(doc.toUpperCase()), true);
  });
});

describe('elegirOrigenDestino', () => {
  it('destino explícito gana a todo', () => {
    assert.deepStrictEqual(elegirOrigenDestino(' x.docx ', '/t/a.docx', ' docs '), { origen: 'explicito', rutaBase: 'docs' });
  });

  it('sin destino usa el temporal antes que la ruta por defecto', () => {
    assert.deepStrictEqual(elegirOrigenDestino('  ', ' /t/a.docx ', 'docs'), { origen: 'temporal', rutaBase: '/t/a.docx' });
  });

  it('sin destino ni temporal usa la ruta por defecto', () => {
    assert.deepStrictEqual(elegirOrigenDestino(undefined, undefined, ' docs '), { origen: 'porDefecto', rutaBase: 'docs' });
    assert.deepStrictEqual(elegirOrigenDestino(undefined, '  ', 'docs'), { origen: 'porDefecto', rutaBase: 'docs' });
  });

  it('sin nada usa el selector', () => {
    assert.deepStrictEqual(elegirOrigenDestino(undefined, undefined, '  '), { origen: 'selector', rutaBase: '' });
  });
});

describe('debeConsumirTemporal', () => {
  it('consume tras escribir o sin_cambios', () => {
    assert.strictEqual(debeConsumirTemporal({ accion: 'creado' }), true);
    assert.strictEqual(debeConsumirTemporal({ accion: 'anexado' }), true);
    assert.strictEqual(debeConsumirTemporal({ accion: 'sin_cambios' }), true);
  });

  it('no consume con no_escrito', () => {
    assert.strictEqual(debeConsumirTemporal({ accion: 'no_escrito' }), false);
  });

  it('no consume con no_escrito y anexar', () => {
    assert.strictEqual(debeConsumirTemporal({ accion: 'no_escrito', decisionUsuario: 'anexar' }), false);
  });

  it('consume con cancelar', () => {
    assert.strictEqual(debeConsumirTemporal({ accion: 'no_escrito', decisionUsuario: 'cancelar' }), true);
  });
});
