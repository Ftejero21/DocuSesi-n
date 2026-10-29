import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { inputDesdeDatos } from '../core/respaldo';
import { estaDentro, resolverDestino } from '../core/rutas';
import { DocuInput, Formato, TipoDoc } from '../core/tipos';
import { Ajustes, leerAjustes } from './ajustes';
import { elegirCarpeta, ejecutarDocumentacion } from './contexto';
import { obtenerCambios } from './git';
import { mostrarNotificacion } from './notificacion';
import { limitarArchivos, redactarConModelo } from './redaccionModelo';

const COMANDO = 'docusesion.documentarCambios';
const MAX_BYTES_ARCHIVO = 2 * 1024 * 1024;

async function leerArchivosSeleccionados(
  folder: vscode.WorkspaceFolder,
  uris: vscode.Uri[],
  avisos: string[]
): Promise<{ ruta: string; contenido: string }[]> {
  const root = folder.uri.fsPath;
  const salida: { ruta: string; contenido: string }[] = [];
  for (const u of uris) {
    if (!estaDentro(root, u.fsPath)) {
      avisos.push(`Se omitió "${u.fsPath}": está fuera del workspace.`);
      continue;
    }
    const rel = path.relative(root, u.fsPath).split(path.sep).join('/');
    try {
      const st = await fs.promises.stat(u.fsPath);
      if (!st.isFile() || st.size > MAX_BYTES_ARCHIVO) {
        avisos.push(`Se omitió "${rel}": no es un archivo o es demasiado grande.`);
        continue;
      }
      const contenido = await fs.promises.readFile(u.fsPath, 'utf8');
      if (contenido.includes('\u0000')) {
        avisos.push(`Se omitió "${rel}": parece un archivo binario.`);
        continue;
      }
      salida.push({ ruta: rel, contenido });
    } catch (e) {
      avisos.push(`No se pudo leer "${rel}": ${(e as Error).message}`);
    }
  }
  return salida;
}

/** Ubicación sugerida en el diálogo Guardar: sale de la ruta por defecto si existe; si no, docs/documentacion.<formato>. */
function uriSugerida(folder: vscode.WorkspaceFolder, ajustes: Ajustes, formato: Formato): vscode.Uri {
  const root = folder.uri.fsPath;
  if (ajustes.rutaPorDefecto) {
    try {
      // permitirFuera=true solo vale para la sugerencia; la validación real se hace tras el diálogo.
      return vscode.Uri.file(
        resolverDestino(root, { titulo: 'documentacion', formato }, ajustes.rutaPorDefecto, true).abs
      );
    } catch {
      // Extensión distinta del formato elegido o ruta inválida: solo es una sugerencia, la validación real se hace tras el diálogo.
      return vscode.Uri.file(
        path.join(path.dirname(path.resolve(root, ajustes.rutaPorDefecto)), `documentacion.${formato}`)
      );
    }
  }
  return vscode.Uri.joinPath(folder.uri, 'docs', `documentacion.${formato}`);
}

async function ejecutarComando(): Promise<void> {
  let folder = elegirCarpeta();

  const tipoSel = await vscode.window.showQuickPick(
    [
      { label: 'Cambio', description: 'Documenta una modificación (diff de git + archivos afectados)', valor: 'cambio' as TipoDoc },
      { label: 'Explicación', description: 'Documenta cómo funciona algo existente (sin diff)', valor: 'explicacion' as TipoDoc }
    ],
    { title: 'DocuSesión: tipo de documento', placeHolder: 'Elige el tipo de documento' }
  );
  if (!tipoSel) {
    return;
  }
  const tipo = tipoSel.valor;

  const formatoSel = await vscode.window.showQuickPick(
    [
      { label: 'Word (docx)', valor: 'docx' as Formato },
      { label: 'Excel (xlsx)', valor: 'xlsx' as Formato },
      { label: 'PowerPoint (pptx)', valor: 'pptx' as Formato }
    ],
    { title: 'DocuSesión: formato', placeHolder: 'Elige el formato' }
  );
  if (!formatoSel) {
    return;
  }
  const formato = formatoSel.valor;

  const ajustes = leerAjustes(folder);
  const uri = await vscode.window.showSaveDialog({
    defaultUri: uriSugerida(folder, ajustes, formato),
    filters: { [formato.toUpperCase()]: [formato] },
    saveLabel: 'Generar documento',
    title: 'DocuSesión: destino del documento'
  });
  if (!uri) {
    return;
  }
  folder = elegirCarpeta(uri.fsPath); // si queda fuera del workspace, resolverDestino lo valida según el ajuste
  const root = folder.uri.fsPath;
  const ajustesDestino = leerAjustes(folder);
  const destino = resolverDestino(
    root,
    { titulo: 'documentacion', destino: uri.fsPath, formato },
    ajustesDestino.rutaPorDefecto,
    ajustesDestino.permitirRutasFueraDelWorkspace
  );

  let seleccionados: vscode.Uri[] = [];
  let pregunta: string | undefined;
  if (tipo === 'explicacion') {
    const elegidos = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      defaultUri: folder.uri,
      openLabel: 'Seleccionar archivos a documentar',
      title: 'DocuSesión: archivos que explican el tema'
    });
    if (!elegidos || elegidos.length === 0) {
      return;
    }
    seleccionados = elegidos;
    pregunta = await vscode.window.showInputBox({
      title: 'DocuSesión',
      prompt: 'Qué quieres documentar (opcional)',
      placeHolder: 'p. ej. cómo funciona el Web Service obtenerSolicitudesAsegurados'
    });
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'DocuSesión', cancellable: true },
    async (progress, token) => {
      const avisos: string[] = [];

      progress.report({ message: 'Reuniendo el contexto…' });
      let git: Awaited<ReturnType<typeof obtenerCambios>>;
      let archivos: { ruta: string; contenido: string }[] = [];
      if (tipo === 'cambio') {
        try {
          git = await obtenerCambios(root, ajustes.idioma, token);
        } catch (e) {
          avisos.push(`No se pudo obtener el diff de git (${(e as Error).message}).`);
        }
        if (!git || (git.diff.trim() === '' && git.cambios.length === 0)) {
          void vscode.window.showWarningMessage('DocuSesión: no hay cambios que documentar (sin repositorio git o sin cambios pendientes).');
          return;
        }
      } else {
        archivos = limitarArchivos(await leerArchivosSeleccionados(folder, seleccionados, avisos));
      }

      let input: DocuInput | undefined;
      let motivo: string | undefined;
      try {
        const modelos = await vscode.lm.selectChatModels({ vendor: 'copilot' });
        if (modelos.length === 0) {
          motivo = 'no hay ningún modelo de Copilot disponible';
        } else {
          progress.report({ message: 'Redactando con Copilot…' });
          const r = await redactarConModelo(
            modelos[0],
            { tipo, formato, idioma: ajustes.idioma, diff: git?.diff, cambios: git?.cambios, archivos, pregunta },
            token
          );
          if (r.ok) {
            input = r.input;
          } else {
            motivo = r.motivo;
          }
        }
      } catch (e) {
        if (e instanceof vscode.LanguageModelError) {
          motivo = `error del modelo (${e.code}): ${e.message}`;
        } else if (e instanceof vscode.CancellationError || token.isCancellationRequested) {
          motivo = 'redacción cancelada por el usuario';
        } else {
          motivo = (e as Error).message;
        }
      }

      const archivosRel = archivos.map((a) => a.ruta);
      if (!input) {
        avisos.push(`Documento generado solo con los datos disponibles, sin redacción por modelo (${motivo ?? 'motivo desconocido'}).`);
        input = inputDesdeDatos({
          tipo,
          fecha: new Date(),
          idioma: ajustes.idioma,
          cambios: git?.cambios,
          diff: git?.diff,
          archivos: archivosRel,
          pregunta
        });
      } else if (tipo === 'explicacion' && (!input.archivosConsultados || input.archivosConsultados.length === 0)) {
        input.archivosConsultados = archivosRel;
      }
      const final: DocuInput = { ...input, tipo, formato, destino: destino.abs, modo: 'auto' };

      progress.report({ message: 'Generando el documento…' });
      let { resultado, rel } = await ejecutarDocumentacion(final, folder, undefined, avisos);
      if (resultado.decisionUsuario === 'anexar') {
        // El usuario eligió no modificar lo existente: se reejecuta en la misma ejecución añadiendo al final.
        ({ resultado, rel } = await ejecutarDocumentacion({ ...final, modo: 'anexar' }, folder, undefined, avisos));
      }
      if (resultado.decisionUsuario === 'cancelar') {
        return;
      }
      if (resultado.accion === 'no_escrito' || resultado.accion === 'sin_cambios') {
        if (resultado.accion === 'no_escrito' && resultado.avisos.length > 0) {
          void vscode.window.showWarningMessage(`DocuSesión: no se ha escrito ${rel}. ${resultado.avisos[0]}`);
        } else if (resultado.accion === 'sin_cambios') {
          void vscode.window.showInformationMessage(`DocuSesión: ${rel} sin cambios (el bloque ya estaba en el documento).`);
        }
        return;
      }
      mostrarNotificacion(resultado.rutaFinal, ajustes.idioma);
      if (resultado.avisos.length > 0) {
        void vscode.window.showWarningMessage(`DocuSesión: ${rel} generado con ${resultado.avisos.length} aviso(s). Primero: ${resultado.avisos[0]}`);
      }
    }
  );
}

export function registrarComando(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMANDO, async () => {
      try {
        await ejecutarComando();
      } catch (e) {
        if (e instanceof vscode.CancellationError) {
          return;
        }
        void vscode.window.showErrorMessage(`DocuSesión: ${(e as Error).message}`);
      }
    })
  );
}
