import * as path from 'path';
import { i18n } from './i18n';
import { slug } from './rutas';
import { Formato, Idioma, Modo } from './tipos';

export type OpcionSelector = 'nuevo' | 'existente' | 'cancelar';

const FORMATOS_SOPORTADOS: string[] = ['docx', 'xlsx', 'pptx'];

/** Ruta sugerida en el diálogo Guardar: <root>/docs/<slug(titulo)>.<formato ?? docx>. */
export function rutaSugeridaNueva(root: string, titulo: string, formato?: Formato): string {
  return path.join(root, 'docs', `${slug(titulo)}.${formato ?? 'docx'}`);
}

/**
 * Valida el archivo elegido en un diálogo nativo (el usuario puede saltarse el filtro escribiendo *.*).
 * Sin extensión y 'permitirSinExtension' → añade .<formatoPedido ?? docx>. Conserva las mayúsculas de la ruta.
 */
export function validarArchivoElegido(
  abs: string,
  formatoPedido: Formato | undefined,
  permitirSinExtension: boolean,
  idioma: Idioma
): { abs: string; formato: Formato } {
  const t = i18n(idioma);
  const ext = path.extname(abs).slice(1).toLowerCase();
  if (ext === '') {
    if (!permitirSinExtension) {
      throw new Error(t.selector.extensionNoSoportada(ext));
    }
    const formato = formatoPedido ?? 'docx';
    return { abs: `${abs}.${formato}`, formato };
  }
  if (!FORMATOS_SOPORTADOS.includes(ext)) {
    throw new Error(t.selector.extensionNoSoportada(ext));
  }
  if (formatoPedido && formatoPedido !== ext) {
    throw new Error(t.selector.formatoNoCoincide(ext, formatoPedido));
  }
  return { abs, formato: ext as Formato };
}

/** Qué hacer tras elegir en el selector: escribir en la misma invocación o pedir al modelo que anexe. */
export function decidirTrasSeleccion(
  opcion: 'nuevo' | 'existente',
  formato: Formato,
  modoInput: Modo | undefined
): { accion: 'escribir'; modo: Modo } | { accion: 'pedirAnexar' } {
  if (opcion === 'nuevo') {
    return { accion: 'escribir', modo: modoInput === 'crear' ? 'crear' : 'auto' };
  }
  if (formato === 'docx') {
    return { accion: 'pedirAnexar' };
  }
  return { accion: 'escribir', modo: 'auto' };
}
