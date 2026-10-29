import * as assert from 'assert';
import { quitarPrefijoCambio } from '../core/texto';

describe('quitarPrefijoCambio', () => {
  const titulo = 'Añadir campo estado';

  it('quita el placeholder YYYY-MM-DD / AAAA-MM-DD', () => {
    assert.strictEqual(quitarPrefijoCambio('Cambio YYYY-MM-DD: Se añade estado', titulo), 'Se añade estado');
    assert.strictEqual(quitarPrefijoCambio('cambio aaaa-mm-dd: Se añade estado', titulo), 'Se añade estado');
    assert.strictEqual(quitarPrefijoCambio('Change YYYY-MM-DD: Se añade estado', titulo), 'Se añade estado');
  });

  it('quita una fecha real', () => {
    assert.strictEqual(quitarPrefijoCambio('Cambio 2026-05-17: Se añade estado', titulo), 'Se añade estado');
    assert.strictEqual(quitarPrefijoCambio('  \nChange 2026-05-17: Se añade estado', titulo), 'Se añade estado');
  });

  it('quita también el título si le sigue ":" o salto de línea', () => {
    assert.strictEqual(
      quitarPrefijoCambio('Cambio 2026-05-17: Añadir campo estado: Se añade estado', titulo),
      'Se añade estado'
    );
    assert.strictEqual(
      quitarPrefijoCambio('Cambio 2026-05-17: añadir campo estado\nSe añade estado', titulo),
      'Se añade estado'
    );
    assert.strictEqual(
      quitarPrefijoCambio('Cambio 2026-05-17: Añadir campo estado\r\nSe añade estado', titulo),
      'Se añade estado'
    );
  });

  it('no quita el título si no va seguido de separador', () => {
    assert.strictEqual(
      quitarPrefijoCambio('Cambio 2026-05-17: Añadir campo estadísticas', titulo),
      'Añadir campo estadísticas'
    );
  });

  it('no toca contenido sin prefijo', () => {
    assert.strictEqual(quitarPrefijoCambio('Se añade estado', titulo), 'Se añade estado');
    assert.strictEqual(quitarPrefijoCambio('Este cambio añade estado', titulo), 'Este cambio añade estado');
    assert.strictEqual(quitarPrefijoCambio('Cambio: X', titulo), 'Cambio: X');
    assert.strictEqual(quitarPrefijoCambio('Cambio de estado: X', titulo), 'Cambio de estado: X');
  });

  it('conserva el original si quedaría vacío', () => {
    const solo = 'Cambio 2026-05-17: Añadir campo estado';
    assert.strictEqual(quitarPrefijoCambio(solo, titulo), solo);
  });
});
