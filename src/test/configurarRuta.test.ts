import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { valorRutaPorDefecto } from '../core/configurarRuta';

describe('valorRutaPorDefecto', () => {
  const root = path.resolve(os.tmpdir(), 'ext-configurar', 'proyecto');
  const fueraDir = path.resolve(os.tmpdir(), 'ext-configurar', 'otro');

  it('área de trabajo y dentro: relativa POSIX', () => {
    const r = valorRutaPorDefecto(path.join(root, 'docs', 'sub', 'a.docx'), root, 'areaTrabajo');
    assert.deepStrictEqual(r, { valor: 'docs/sub/a.docx', fuera: false });
  });

  it('área de trabajo y la propia raíz: punto', () => {
    assert.deepStrictEqual(valorRutaPorDefecto(root, root, 'areaTrabajo'), { valor: '.', fuera: false });
  });

  it('usuario: absoluta aunque esté dentro', () => {
    const abs = path.join(root, 'docs');
    assert.deepStrictEqual(valorRutaPorDefecto(abs, root, 'usuario'), { valor: path.normalize(abs), fuera: false });
  });

  it('fuera del workspace: absoluta y fuera', () => {
    const abs = path.join(fueraDir, 'a.docx');
    assert.deepStrictEqual(valorRutaPorDefecto(abs, root, 'areaTrabajo'), { valor: path.normalize(abs), fuera: true });
    assert.deepStrictEqual(valorRutaPorDefecto(abs, root, 'usuario'), { valor: path.normalize(abs), fuera: true });
  });

  it('lanza con ruta relativa', () => {
    assert.throws(() => valorRutaPorDefecto('docs/a.docx', root, 'areaTrabajo'));
  });
});
