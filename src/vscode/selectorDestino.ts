import * as path from 'path';
import * as vscode from 'vscode';
import { RegistroDestinoTemporal } from '../core/destinoTemporal';
import { i18n } from '../core/i18n';
import { esArchivoDocumento } from '../core/rutas';
import { RegistroRutasAprobadas } from '../core/rutasAprobadas';
import { OpcionSelector, rutaSugeridaNueva, validarArchivoElegido } from '../core/selectorDestino';
import { DocuInput, Formato, Idioma } from '../core/tipos';

/** Rutas elegidas por el usuario en un diálogo nativo (solo memoria, 30 min). */
export const rutasAprobadas = new RegistroRutasAprobadas();

/** Ruta "elegida para esta vez": solo memoria, un solo uso, caduca a los 30 min. */
export const destinoTemporal = new RegistroDestinoTemporal();

export const esRutaAprobada = (abs: string): boolean => rutasAprobadas.estaAprobada(abs) || destinoTemporal.cubre(abs);

export function comprobarToken(token?: vscode.CancellationToken): void {
  if (token?.isCancellationRequested) {
    throw new vscode.CancellationError();
  }
}

export function filtrosDocumento(idioma: Idioma, formato?: Formato, separados = false): { [nombre: string]: string[] } {
  if (formato) {
    return { [formato.toUpperCase()]: [formato] };
  }
  if (separados) {
    return { Word: ['docx'], Excel: ['xlsx'], PowerPoint: ['pptx'] };
  }
  return { [i18n(idioma).selector.filtroDocumentos]: ['docx', 'xlsx', 'pptx'] };
}

/**
 * Diálogo Abrir para elegir un documento existente. Valida la extensión y aprueba la ruta exacta.
 * undefined si el usuario cancela; CancellationError si el token se cancela.
 */
export async function elegirDocumentoExistente(
  folder: vscode.WorkspaceFolder,
  idioma: Idioma,
  formato?: Formato,
  token?: vscode.CancellationToken
): Promise<{ abs: string; formato: Formato } | undefined> {
  const t = i18n(idioma).selector;
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: folder.uri,
    filters: filtrosDocumento(idioma, formato),
    openLabel: t.etiquetaAbrir,
    title: t.tituloAbrir
  });
  comprobarToken(token);
  if (!uris || uris.length === 0) {
    return undefined;
  }
  const v = validarArchivoElegido(uris[0].fsPath, formato, false, idioma);
  rutasAprobadas.aprobar(v.abs);
  return v;
}

/**
 * Diálogo Guardar para un documento nuevo. Valida la extensión y aprueba la ruta exacta.
 * undefined si el usuario cancela; CancellationError si el token se cancela.
 */
export async function elegirDocumentoNuevo(
  folder: vscode.WorkspaceFolder,
  idioma: Idioma,
  titulo: string,
  formato?: Formato,
  token?: vscode.CancellationToken
): Promise<{ abs: string; formato: Formato } | undefined> {
  const t = i18n(idioma).selector;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(rutaSugeridaNueva(folder.uri.fsPath, titulo, formato)),
    filters: filtrosDocumento(idioma, formato, true),
    saveLabel: t.etiquetaGuardar,
    title: t.tituloGuardar
  });
  comprobarToken(token);
  if (!uri) {
    return undefined;
  }
  const v = validarArchivoElegido(uri.fsPath, formato, true, idioma);
  rutasAprobadas.aprobar(v.abs);
  return v;
}

/**
 * Diálogo Abrir para elegir una carpeta de destino. Rechaza nombres que terminan en docx/xlsx/pptx y aprueba la ruta.
 * undefined si el usuario cancela; CancellationError si el token se cancela.
 */
export async function elegirCarpetaDestino(
  folder: vscode.WorkspaceFolder,
  idioma: Idioma,
  token?: vscode.CancellationToken
): Promise<string | undefined> {
  const t = i18n(idioma).ruta;
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: folder.uri,
    openLabel: t.dlgCarpetaEtiqueta,
    title: t.dlgCarpetaTitulo
  });
  comprobarToken(token);
  if (!uris || uris.length === 0) {
    return undefined;
  }
  const abs = uris[0].fsPath;
  if (esArchivoDocumento(abs)) {
    throw new Error(t.errCarpetaConExtension(path.basename(abs) || abs));
  }
  rutasAprobadas.aprobar(abs);
  return abs;
}

/**
 * Selector de destino cuando el modelo no indica destino y no hay ruta por defecto:
 * QuickPick (nuevo / existente / cancelar) y el diálogo nativo correspondiente.
 * undefined si el usuario cancela en cualquier punto; CancellationError si el token se cancela.
 */
export async function elegirDestinoDocumentar(
  folder: vscode.WorkspaceFolder,
  input: DocuInput,
  idioma: Idioma,
  token: vscode.CancellationToken
): Promise<{ opcion: 'nuevo' | 'existente'; abs: string; formato: Formato } | undefined> {
  const t = i18n(idioma).selector;
  const items: Array<vscode.QuickPickItem & { valor: OpcionSelector }> = [
    { label: t.nuevo, detail: t.nuevoDetalle, valor: 'nuevo' },
    { label: t.existente, detail: t.existenteDetalle, valor: 'existente' },
    { label: t.cancelar, detail: t.cancelarDetalle, valor: 'cancelar' }
  ];
  const sel = await vscode.window.showQuickPick(
    items,
    { title: t.tituloQuickPick, placeHolder: t.placeHolder, ignoreFocusOut: true },
    token
  );
  comprobarToken(token);
  if (!sel || sel.valor === 'cancelar') {
    return undefined;
  }

  if (sel.valor === 'existente') {
    const e = await elegirDocumentoExistente(folder, idioma, input.formato, token);
    return e ? { opcion: 'existente', abs: e.abs, formato: e.formato } : undefined;
  }

  const n = await elegirDocumentoNuevo(folder, idioma, input.titulo, input.formato, token);
  return n ? { opcion: 'nuevo', abs: n.abs, formato: n.formato } : undefined;
}
