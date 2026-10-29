import { execFile } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { documentar } from '../core/documentar';
import { asegurarDentro, estaDentro, resolverDestino, resultadoSinDestino, sinDestino } from '../core/rutas';
import { ContextoGeneracion, DocuInput, ResultadoGeneracion } from '../core/tipos';
import { Ajustes, leerAjustes } from './ajustes';
import { confirmarActualizacionUI, resolverTituloDuplicadoUI } from './confirmacion';
import { obtenerCambios } from './git';
import { esRutaAprobada } from './selectorDestino';

/**
 * Carpeta del workspace: la que contiene el destino absoluto o, si no, la primera.
 * La validación de rutas externas la hace resolverDestino según el ajuste permitirRutasFueraDelWorkspace.
 */
export function elegirCarpeta(destino?: string): vscode.WorkspaceFolder {
  const carpetas = vscode.workspace.workspaceFolders;
  if (!carpetas || carpetas.length === 0) {
    throw new Error('Abre una carpeta en VS Code antes de generar documentación (no hay ningún workspace abierto).');
  }
  if (destino && path.isAbsolute(destino)) {
    const f = carpetas.find((c) => estaDentro(c.uri.fsPath, destino));
    if (f) {
      return f;
    }
  }
  return carpetas[0];
}

/** Autor: `git config user.name` (sin shell, timeout 5 s) o, si falla, el usuario del sistema. */
export function obtenerAutor(root: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('git', ['config', 'user.name'], { cwd: root, timeout: 5000, windowsHide: true }, (err, stdout) => {
      const nombre = err ? '' : String(stdout).trim();
      resolve(nombre || os.userInfo().username);
    });
  });
}

export interface ResultadoEjecucion {
  resultado: ResultadoGeneracion;
  rel: string;
  ajustes: Ajustes;
  fuera: boolean;
  /** Ruta absoluta del destino ('' si no hubo destino). */
  abs: string;
}

/**
 * Orquestación compartida por la herramienta y el comando: resuelve destino, obtiene el diff (solo en "cambio"),
 * construye el contexto y llama a documentar().
 */
export async function ejecutarDocumentacion(
  input: DocuInput,
  folder: vscode.WorkspaceFolder,
  token?: vscode.CancellationToken,
  avisosExtra: string[] = [],
  opciones: { exigirMencionCambios?: boolean; rutaPorDefecto?: string } = {}
): Promise<ResultadoEjecucion> {
  const ajustes = leerAjustes(folder);
  const root = folder.uri.fsPath;
  const rutaBase = opciones.rutaPorDefecto ?? ajustes.rutaPorDefecto;
  if (sinDestino(input.destino, rutaBase)) {
    // Sin destino ni ruta por defecto: no se escribe nada (ni backup ni git); el modelo debe preguntar al usuario.
    return { resultado: resultadoSinDestino(ajustes.idioma), rel: '', ajustes, fuera: false, abs: '' };
  }
  const dest = resolverDestino(root, input, rutaBase, ajustes.permitirRutasFueraDelWorkspace, esRutaAprobada);
  if (!dest.fuera) {
    await asegurarDentro(root, dest.abs);
  }
  if (token?.isCancellationRequested) {
    throw new vscode.CancellationError();
  }

  const avisos: string[] = [...avisosExtra];
  let diff: string | undefined;
  let cambios: ContextoGeneracion['cambios'];
  if (input.tipo === 'cambio') {
    try {
      const git = await obtenerCambios(root, ajustes.idioma, token);
      if (git) {
        diff = git.diff;
        cambios = git.cambios;
        if (git.diff.trim() === '' && git.cambios.length === 0) {
          avisos.push('El repositorio git no tiene cambios pendientes: el documento se genera sin diff.');
        }
      } else {
        avisos.push('No se encontró un repositorio git: el documento se genera sin diff.');
      }
    } catch (e) {
      avisos.push(`No se pudo obtener el diff de git (${(e as Error).message}): el documento se genera sin diff.`);
    }
  }
  if (token?.isCancellationRequested) {
    throw new vscode.CancellationError();
  }

  const plantilla =
    dest.formato === 'docx' ? ajustes.plantillaWord : dest.formato === 'xlsx' ? ajustes.plantillaExcel : undefined;
  const ctx: ContextoGeneracion = {
    root,
    rutaDestino: dest.abs,
    backupDir: path.join(root, '.docusesion', 'backups'),
    fecha: new Date(),
    autor: await obtenerAutor(root),
    idioma: ajustes.idioma,
    diff,
    cambios,
    plantilla,
    avisos,
    exigirMencionCambios: opciones.exigirMencionCambios,
    // dest.fuera solo es true si resolverDestino lo permitió (ajuste activo o ruta elegida por el usuario en un diálogo).
    permitirFueraDelWorkspace: ajustes.permitirRutasFueraDelWorkspace || dest.fuera,
    // UI nativa inyectada: nunca se modifica contenido existente sin confirmación del usuario.
    confirmarActualizacion: (plan) => confirmarActualizacionUI(plan, dest.abs, ajustes.idioma, token),
    resolverTituloDuplicado: (info) => resolverTituloDuplicadoUI(info, ajustes.idioma, token)
  };
  const resultado = await documentar({ ...input, formato: dest.formato }, ctx);
  return { resultado, rel: dest.rel, ajustes, fuera: dest.fuera, abs: dest.abs };
}
