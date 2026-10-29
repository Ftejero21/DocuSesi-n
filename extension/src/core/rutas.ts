import * as fs from 'fs';
import * as path from 'path';
import { i18n } from './i18n';
import { formatoFecha, normalizar } from './texto';
import { DocuInput, Formato, Idioma, Modo, ResultadoGeneracion } from './tipos';

export type ModoEfectivo = 'crear' | 'actualizar' | 'sufijo' | 'anexar';

const FORMATOS: Formato[] = ['docx', 'xlsx', 'pptx'];

export function slug(texto: string): string {
  const s = normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || 'documento';
}

/** true si 'destino' está dentro de 'base' (comprobación léxica). */
export function estaDentro(base: string, destino: string): boolean {
  const rel = path.relative(base, destino);
  if (rel === '') {
    return true;
  }
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** true si la ruta termina en una extensión de documento soportada (docx, xlsx, pptx; sin distinguir mayúsculas). */
export function esArchivoDocumento(ruta: string): boolean {
  return FORMATOS.includes(path.extname(ruta).slice(1).toLowerCase() as Formato);
}

/** true si no hay destino explícito ni ruta por defecto (ambos vacíos tras trim). */
export function sinDestino(destino: string | undefined, rutaPorDefecto: string): boolean {
  return (destino ?? '').trim() === '' && (rutaPorDefecto ?? '').trim() === '';
}

/** Resultado controlado cuando falta destino: no se escribe nada y se indica al modelo que pregunte al usuario. */
export function resultadoSinDestino(idioma: Idioma): ResultadoGeneracion {
  return {
    rutaFinal: '',
    accion: 'no_escrito',
    seccionesCreadas: [],
    seccionesActualizadas: [],
    encabezados: [],
    avisos: [i18n(idioma).res.sinDestino]
  };
}

/**
 * Resuelve el destino. Las rutas relativas se resuelven contra 'root' y nunca pueden salir de él.
 * Una ruta ABSOLUTA fuera de 'root' solo se admite con 'permitirFuera' (ajuste permitirRutasFueraDelWorkspace);
 * en ese caso 'fuera' es true y 'rel' es la ruta absoluta (en los internos, 'rel' es relativo POSIX).
 * Sin destino se usa 'rutaPorDefecto' (ajuste rutaPorDefecto): una carpeta (archivo nuevo con el slug del título)
 * o un archivo docx/xlsx/pptx. Si tampoco hay ruta por defecto lanza error (los callers lo comprueban antes con sinDestino).
 * 'porDefecto' indica que se ha usado la ruta por defecto.
 * 'rutaAprobada' (opcional) indica si el usuario eligió esa ruta absoluta exacta en un diálogo nativo: en ese caso
 * se admite aunque quede fuera del workspace y 'permitirFuera' sea false. Las rutas relativas nunca salen de 'root'.
 */
export function resolverDestino(
  root: string,
  input: Pick<DocuInput, 'titulo' | 'destino' | 'formato'>,
  rutaPorDefecto: string,
  permitirFuera = false,
  rutaAprobada?: (abs: string) => boolean
): { abs: string; rel: string; formato: Formato; fuera: boolean; porDefecto: boolean } {
  let abs: string;
  let formato: Formato | undefined = input.formato;
  const destino = (input.destino ?? '').trim();
  let absoluta = destino !== '' && path.isAbsolute(destino);
  const rd = (rutaPorDefecto ?? '').trim();
  if (destino === '') {
    if (rd === '') {
      throw new Error(i18n('es').res.sinDestino);
    }
    absoluta = path.isAbsolute(rd);
    const absDef = path.resolve(root, rd);
    if (esArchivoDocumento(rd)) {
      const ext = path.extname(rd).slice(1).toLowerCase() as Formato;
      if (formato && formato !== ext) {
        throw new Error(
          `La extensión de la ruta por defecto (.${ext}, ajuste "docusesion.rutaPorDefecto") no coincide con el formato solicitado (${formato}).`
        );
      }
      formato = ext;
      abs = absDef;
    } else {
      formato = formato ?? 'docx';
      abs = path.join(absDef, `${slug(input.titulo)}.${formato}`);
    }
  } else {
    abs = path.resolve(root, destino);
    const ext = path.extname(abs).slice(1).toLowerCase();
    if (FORMATOS.includes(ext as Formato)) {
      if (formato && formato !== ext) {
        throw new Error(
          `La extensión del destino (.${ext}) no coincide con el formato solicitado (${formato}).`
        );
      }
      formato = ext as Formato;
    } else if (ext === '') {
      formato = formato ?? 'docx';
      abs = `${abs}.${formato}`;
    } else {
      throw new Error(`Extensión no soportada en el destino (.${ext}). Usa docx, xlsx o pptx.`);
    }
  }
  const dentro = estaDentro(root, abs);
  const porDefecto = destino === '';
  if (!dentro) {
    const msgFuera = porDefecto
      ? `La ruta por defecto (ajuste "docusesion.rutaPorDefecto") queda fuera del workspace: ${rd}`
      : `El destino queda fuera del workspace: ${destino}`;
    if (!absoluta) {
      throw new Error(msgFuera);
    }
    if (!permitirFuera && !(rutaAprobada?.(abs) ?? false)) {
      throw new Error(
        `${msgFuera}. ` +
          'Para escribir fuera del workspace activa el ajuste "docusesion.permitirRutasFueraDelWorkspace".'
      );
    }
  }
  const rel = dentro ? path.relative(root, abs).split(path.sep).join('/') : abs;
  return { abs, rel, formato: formato ?? 'docx', fuera: !dentro, porDefecto };
}

async function realpathAncestro(p: string): Promise<string> {
  let actual = p;
  for (;;) {
    try {
      return await fs.promises.realpath(actual);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        throw e;
      }
      const padre = path.dirname(actual);
      if (padre === actual) {
        return actual;
      }
      actual = padre;
    }
  }
}

/** Lanza si 'abs' queda fuera de 'root' (léxico y tras resolver symlinks del ancestro existente). */
export async function asegurarDentro(root: string, abs: string): Promise<void> {
  if (!estaDentro(root, abs)) {
    throw new Error(`La ruta queda fuera del workspace: ${abs}`);
  }
  const realRoot = await fs.promises.realpath(root);
  const realAncestro = await realpathAncestro(abs);
  if (!estaDentro(realRoot, realAncestro)) {
    throw new Error(`La ruta queda fuera del workspace (enlace simbólico): ${abs}`);
  }
}

/** Resuelve una ruta relativa (o absoluta) dentro del workspace; undefined si queda fuera. */
export async function resolverEnWorkspace(root: string, ruta: string): Promise<string | undefined> {
  const abs = path.resolve(root, ruta);
  try {
    await asegurarDentro(root, abs);
  } catch {
    return undefined;
  }
  return abs;
}

export function rutaConSufijoFecha(abs: string, fecha: Date): string {
  const ext = path.extname(abs);
  const base = path.basename(abs, ext);
  return path.join(path.dirname(abs), `${base}-${formatoFecha(fecha, 'sello')}${ext}`);
}

export function nombreBackup(abs: string, backupDir: string, fecha: Date): string {
  const ext = path.extname(abs);
  const base = path.basename(abs, ext);
  const sello = formatoFecha(fecha, 'sello');
  let candidato = path.join(backupDir, `${base}-${sello}${ext}`);
  let n = 1;
  while (fs.existsSync(candidato)) {
    candidato = path.join(backupDir, `${base}-${sello}-${n}${ext}`);
    n++;
  }
  return candidato;
}

/** Modo efectivo. Lanza si 'actualizar' y el archivo no existe. */
export function modoEfectivo(modo: Modo | undefined, existe: boolean, formato: Formato): ModoEfectivo {
  const m: Modo = modo ?? 'auto';
  if (m === 'actualizar' && !existe) {
    throw new Error('El modo "actualizar" requiere que el archivo exista. Usa "crear" o "auto".');
  }
  if (formato === 'pptx') {
    return existe ? 'sufijo' : 'crear';
  }
  if (m === 'crear') {
    return existe ? 'sufijo' : 'crear';
  }
  if (m === 'anexar') {
    if (!existe) {
      return 'crear';
    }
    return formato === 'docx' ? 'anexar' : 'actualizar';
  }
  return existe ? 'actualizar' : 'crear';
}
