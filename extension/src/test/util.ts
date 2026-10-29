import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import PizZip from 'pizzip';
import { ContextoGeneracion, DocuInput } from '../core/tipos';

export const FIXTURE = path.join(__dirname, '..', '..', 'test-fixtures', 'documento-es.docx');

export async function crearRoot(): Promise<string> {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'docusesion-'));
  // Archivos de origen para los mapeos "verificado".
  await fs.promises.mkdir(path.join(root, 'src', 'main', 'resources'), { recursive: true });
  await fs.promises.writeFile(
    path.join(root, 'src', 'main', 'resources', 'application-pre.yml'),
    'app:\n  db:\n    schema: SEGUROS_PRE\n'
  );
  await fs.promises.writeFile(
    path.join(root, 'src', 'main', 'resources', 'V1__crear_tablas.sql'),
    'CREATE TABLE T_SOL_ASEG (ID_ASEG VARCHAR(20), NUM_POL VARCHAR(30));\n'
  );
  return root;
}

export function ctxBase(root: string, rutaDestino: string, extra: Partial<ContextoGeneracion> = {}): ContextoGeneracion {
  return {
    root,
    rutaDestino,
    backupDir: path.join(root, '.docusesion', 'backups'),
    fecha: new Date(2026, 4, 17, 10, 30, 45),
    autor: 'tester',
    idioma: 'es',
    avisos: [],
    ...extra
  };
}

export function inputBase(extra: Partial<DocuInput> = {}): DocuInput {
  return {
    tipo: 'explicacion',
    titulo: 'Documento de prueba',
    resumen: 'Resumen de prueba con <etiquetas> & "comillas".',
    secciones: [{ encabezado: 'Propósito', contenido: 'Explica el servicio.\n- punto uno\n- punto dos' }],
    ...extra
  };
}

export const MAPEO = [
  {
    nombreEnCodigo: 'SolicitudAsegurado',
    nombreReal: 'T_SOL_ASEG',
    tipoObjeto: 'tabla' as const,
    origen: 'src/main/resources/V1__crear_tablas.sql:1',
    estado: 'verificado' as const
  },
  {
    nombreEnCodigo: '${app.db.schema}',
    nombreReal: 'SEGUROS_PRE',
    tipoObjeto: 'esquema' as const,
    origen: 'src/main/resources/application-pre.yml:4',
    estado: 'depende_de_entorno' as const,
    notas: 'dev=SEGUROS_DEV; pre=SEGUROS_PRE'
  },
  {
    nombreEnCodigo: 'fechaAlta',
    nombreReal: 'FECHA_ALTA',
    tipoObjeto: 'columna' as const,
    origen: 'src/main/resources/no-existe.sql:1',
    estado: 'pendiente_de_verificar' as const
  }
];

export function leerParte(abs: string, parte: string): string {
  const zip = new PizZip(fs.readFileSync(abs));
  const f = zip.file(parte);
  if (!f) {
    throw new Error(`No existe ${parte} en ${abs}`);
  }
  return f.asText();
}

export function listarPartes(abs: string): string[] {
  return Object.keys(new PizZip(fs.readFileSync(abs)).files);
}

export async function copiarFixture(root: string, rel: string): Promise<string> {
  const destino = path.join(root, rel);
  await fs.promises.mkdir(path.dirname(destino), { recursive: true });
  await fs.promises.copyFile(FIXTURE, destino);
  return destino;
}

export function textoPlano(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
