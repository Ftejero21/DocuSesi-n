import * as vscode from 'vscode';
import { leerEstructura } from '../core/estructura';
import { i18n } from '../core/i18n';
import { asegurarDentro, esArchivoDocumento, resolverDestino } from '../core/rutas';
import { leerAjustes } from './ajustes';
import { elegirCarpeta } from './contexto';
import { destinoTemporal, elegirDocumentoExistente, esRutaAprobada } from './selectorDestino';

interface EntradaEstructura {
  destino?: string;
}

function enLinea(s: unknown): string {
  return String(s ?? '').replace(/[`\r\n]+/g, ' ');
}

/** Herramienta de solo lectura: devuelve al modelo la estructura de un documento existente. */
export class EstructuraTool implements vscode.LanguageModelTool<EntradaEstructura> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<EntradaEstructura>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const raw = (options.input ?? {}) as Partial<EntradaEstructura>;
    const prepared: vscode.PreparedToolInvocation = { invocationMessage: 'Leyendo la estructura del documento…' };
    try {
      const destinoRaw = typeof raw.destino === 'string' ? raw.destino : undefined;
      const sinDestinoTxt = (destinoRaw ?? '').trim() === '';
      // El documento elegido para esta vez se usa (sin consumirlo) cuando no hay destino.
      const temporal = destinoTemporal.actual();
      const rutaTemporal = sinDestinoTxt && temporal?.tipo === 'documento' ? temporal.ruta : undefined;
      const folder = elegirCarpeta(rutaTemporal ?? destinoRaw);
      const ajustes = leerAjustes(folder);
      const rutaBase = rutaTemporal ?? ajustes.rutaPorDefecto;
      if (sinDestinoTxt && !esArchivoDocumento(rutaBase)) {
        // Sin destino y sin documento por defecto: invoke abre un diálogo Abrir; no hay nada que confirmar.
        prepared.invocationMessage = 'Se abrirá un selector para elegir el documento…';
        return prepared;
      }
      const dest = resolverDestino(
        folder.uri.fsPath,
        { titulo: 'documento', destino: destinoRaw },
        rutaBase,
        ajustes.permitirRutasFueraDelWorkspace,
        esRutaAprobada
      );
      if (rutaTemporal !== undefined) {
        prepared.invocationMessage = i18n(ajustes.idioma).ruta.estructuraEstaVez;
      } else if (dest.porDefecto) {
        prepared.invocationMessage = 'Leyendo la estructura del documento (ruta por defecto de los ajustes)…';
      }
      if (dest.fuera) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(
          `Se leerá un documento FUERA del workspace (\`${enLinea(dest.abs)}\`) y se enviará al modelo un resumen de su estructura ` +
            '(encabezados y un bloque de muestra). No se modificará ningún archivo.'
        );
        prepared.confirmationMessages = { title: 'DocuSesión: leer estructura', message: md };
      }
    } catch {
      // Sin destino calculable: el error se informa en invoke.
    }
    return prepared;
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<EntradaEstructura>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const destino = (options.input as Partial<EntradaEstructura> | undefined)?.destino;
    if (destino !== undefined && (typeof destino !== 'string' || destino.length > 1000)) {
      throw new Error('La entrada no es válida: "destino" debe ser texto de máximo 1000 caracteres (opcional).');
    }
    let destinoTxt = (destino ?? '').trim();
    const temporal = destinoTemporal.actual();
    const rutaTemporal = destinoTxt === '' && temporal?.tipo === 'documento' ? temporal.ruta : undefined;
    let folder = elegirCarpeta(rutaTemporal ?? destinoTxt);
    const ajustes = leerAjustes(folder);
    const rutaBase = rutaTemporal ?? ajustes.rutaPorDefecto;
    let root = folder.uri.fsPath;
    let prefijo = '';
    if (destinoTxt === '' && !esArchivoDocumento(rutaBase)) {
      // Ruta por defecto vacía o carpeta: se abre el diálogo Abrir para que el usuario elija el documento.
      const sel = await elegirDocumentoExistente(folder, ajustes.idioma, undefined, token);
      if (!sel) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(i18n(ajustes.idioma).res.sinDocumentoEstructura)
        ]);
      }
      destinoTxt = sel.abs;
      folder = elegirCarpeta(sel.abs);
      root = folder.uri.fsPath;
      prefijo = `${i18n(ajustes.idioma).res.documentoElegidoEstructura(sel.abs)}\n\n`;
    }
    const dest = resolverDestino(
      root,
      { titulo: 'documento', destino: destinoTxt },
      rutaBase,
      ajustes.permitirRutasFueraDelWorkspace,
      esRutaAprobada
    );
    if (!dest.fuera) {
      await asegurarDentro(root, dest.abs);
    }
    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }
    const texto = await leerEstructura(dest.abs, dest.formato);
    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(prefijo + texto)]);
  }
}
