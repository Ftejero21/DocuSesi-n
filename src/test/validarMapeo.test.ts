import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { limpiarSql, quitarLinea, separarOrigenes, validarMapeo } from '../core/validarMapeo';
import { Ejemplo, MapeoNombre } from '../core/tipos';
import { crearRoot } from './util';

const TABLA: MapeoNombre = {
  nombreEnCodigo: 'SolicitudAsegurado',
  nombreReal: 'T_SOL_ASEG',
  tipoObjeto: 'tabla',
  origen: 'src/main/resources/V1__crear_tablas.sql:1',
  estado: 'verificado'
};
const COLUMNA: MapeoNombre = {
  nombreEnCodigo: 'idAsegurado',
  nombreReal: 'ID_ASEG',
  tipoObjeto: 'columna',
  origen: 'src/main/resources/V1__crear_tablas.sql:1',
  estado: 'verificado'
};

function sql(contenido: string): Ejemplo {
  return { titulo: 'Consulta', tipo: 'sql', contenido, explicacion: 'x' };
}

describe('validarMapeo', () => {
  it('mantiene "verificado" si el nombre aparece en el archivo (sin distinguir mayúsculas)', async () => {
    const root = await crearRoot();
    const r = await validarMapeo(root, [TABLA, { ...TABLA, nombreReal: 't_sol_aseg' }], []);
    assert.deepStrictEqual(r.mapeo.map((m) => m.estado), ['verificado', 'verificado']);
    assert.deepStrictEqual(r.avisos, []);
  });

  it('pasa a "pendiente_de_verificar" y avisa si el nombre no aparece en el archivo', async () => {
    const root = await crearRoot();
    const original = { ...TABLA, nombreReal: 'T_NO_EXISTE' };
    const r = await validarMapeo(root, [original], []);
    assert.strictEqual(r.mapeo[0].estado, 'pendiente_de_verificar');
    assert.strictEqual(original.estado, 'verificado', 'no muta el original');
    assert.strictEqual(r.avisos.length, 1);
    assert.ok(r.avisos[0].includes('T_NO_EXISTE'));
    assert.strictEqual(r.degradados.length, 1);
  });

  it('pasa a pendiente si el archivo no existe o queda fuera del workspace', async () => {
    const root = await crearRoot();
    const fuera = path.join(os.tmpdir(), 'docusesion-fuera.txt');
    await fs.promises.writeFile(fuera, 'T_SOL_ASEG');
    const r = await validarMapeo(
      root,
      [
        { ...TABLA, origen: 'no/existe.sql:3' },
        { ...TABLA, origen: fuera },
        { ...TABLA, origen: '../docusesion-fuera.txt:1-2' }
      ],
      []
    );
    assert.deepStrictEqual(r.mapeo.map((m) => m.estado), ['pendiente_de_verificar', 'pendiente_de_verificar', 'pendiente_de_verificar']);
    assert.strictEqual(r.avisos.length, 3);
    await fs.promises.unlink(fuera);
  });

  it('no toca los estados que no son "verificado"', async () => {
    const root = await crearRoot();
    const r = await validarMapeo(root, [{ ...TABLA, estado: 'depende_de_entorno', origen: 'no/existe.yml:1' }], []);
    assert.strictEqual(r.mapeo[0].estado, 'depende_de_entorno');
    assert.deepStrictEqual(r.avisos, []);
  });

  it('avisa si el SQL usa el nombre de la entidad en lugar del de la tabla', async () => {
    const root = await crearRoot();
    const r = await validarMapeo(root, [TABLA], [sql('SELECT * FROM SolicitudAsegurado s WHERE s.ID_ASEG = :idAsegurado')]);
    assert.strictEqual(r.avisos.length, 1);
    assert.ok(r.avisos[0].includes('SolicitudAsegurado'));
    assert.ok(r.avisos[0].includes('T_SOL_ASEG'));
  });

  it('no avisa con parámetros con nombre (:idAsegurado), comentarios ni literales', async () => {
    const root = await crearRoot();
    const r = await validarMapeo(
      root,
      [TABLA, COLUMNA],
      [
        sql(
          [
            '-- idAsegurado viene de SolicitudAsegurado.idAsegurado',
            '/* SolicitudAsegurado */',
            "SELECT 'SolicitudAsegurado' AS x",
            'FROM T_SOL_ASEG s',
            'WHERE s.ID_ASEG = :idAsegurado'
          ].join('\n')
        )
      ]
    );
    assert.deepStrictEqual(r.avisos, []);
  });

  it('escapa los caracteres especiales de regex en nombreEnCodigo', async () => {
    const root = await crearRoot();
    const m: MapeoNombre = { ...TABLA, nombreEnCodigo: 'Tablas.SOLICITUDES', estado: 'pendiente_de_verificar' };
    const ok = await validarMapeo(root, [m], [sql('SELECT * FROM T_SOL_ASEG')]);
    assert.deepStrictEqual(ok.avisos, []);
    const placeholder: MapeoNombre = { ...TABLA, nombreEnCodigo: '${app.db.schema}', nombreReal: 'SEGUROS_PRE', estado: 'depende_de_entorno' };
    const mal = await validarMapeo(root, [placeholder], [sql('SELECT * FROM ${app.db.schema}.T_SOL_ASEG')]);
    assert.strictEqual(mal.avisos.length, 1);
    const calificado = await validarMapeo(root, [placeholder], [sql('SELECT 1 FROM otro.${app.db.schema} x')]);
    assert.strictEqual(calificado.avisos.length, 0, 'un identificador calificado no se detecta (limitación documentada)');
  });

  it('origen múltiple: verificado si el nombre aparece en alguno de los archivos', async () => {
    const root = await crearRoot();
    const m: MapeoNombre = {
      ...TABLA,
      origen: 'no/existe.java:6; src/main/resources/application-pre.yml:2, src/main/resources/V1__crear_tablas.sql:1'
    };
    const r = await validarMapeo(root, [m], []);
    assert.strictEqual(r.mapeo[0].estado, 'verificado');
    assert.deepStrictEqual(r.avisos, []);
    assert.deepStrictEqual(r.degradados, []);
  });

  it('origen múltiple: se degrada si el nombre no aparece en ninguno', async () => {
    const root = await crearRoot();
    const m: MapeoNombre = { ...TABLA, origen: 'no/existe.java:6; src/main/resources/application-pre.yml:2' };
    const r = await validarMapeo(root, [m], []);
    assert.strictEqual(r.mapeo[0].estado, 'pendiente_de_verificar');
    assert.strictEqual(r.avisos.length, 1);
    assert.strictEqual(r.degradados.length, 1);
  });

  it('helper: separarOrigenes', () => {
    assert.deepStrictEqual(separarOrigenes('a.sql:1; b.java:2 ,c.yml'), ['a.sql:1', 'b.java:2', 'c.yml']);
  });

  it('helpers: quitarLinea y limpiarSql', () => {
    assert.strictEqual(quitarLinea('a/b.yml:12'), 'a/b.yml');
    assert.strictEqual(quitarLinea('a/b.yml:12-20'), 'a/b.yml');
    assert.strictEqual(quitarLinea('a/b.yml'), 'a/b.yml');
    assert.ok(!limpiarSql("SELECT 'a--b' -- c\nFROM t /* x */").includes('--'));
  });
});
