import * as path from 'path';
import * as vscode from 'vscode';
import { i18n } from '../core/i18n';
import { Idioma } from '../core/tipos';

/** Notificación no bloqueante (sin await) con los botones "Abrir documento", "Abrir carpeta" y "Cambiar ruta por defecto". */
export function mostrarNotificacion(abs: string, idioma: Idioma = 'es'): void {
  const abrirDoc = 'Abrir documento';
  const abrirCarpeta = 'Abrir carpeta';
  const cambiarRuta = i18n(idioma).ruta.botonCambiarRuta;
  void vscode.window
    .showInformationMessage(`DocuSesión: documento generado (${path.basename(abs)})`, abrirDoc, abrirCarpeta, cambiarRuta)
    .then(
      async (sel) => {
        if (sel === abrirDoc) {
          await vscode.env.openExternal(vscode.Uri.file(abs));
        } else if (sel === abrirCarpeta) {
          await vscode.env.openExternal(vscode.Uri.file(path.dirname(abs)));
        } else if (sel === cambiarRuta) {
          await vscode.commands.executeCommand('docusesion.configurarRutaPorDefecto');
        }
      },
      (e: unknown) => console.error('DocuSesión: error en la notificación', e instanceof Error ? e.message : e)
    );
}
