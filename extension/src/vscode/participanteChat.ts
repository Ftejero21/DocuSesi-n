import * as vscode from 'vscode';
import { i18n } from '../core/i18n';
import { leerAjustes } from './ajustes';
import { elegirCarpeta } from './contexto';
import { enLinea, menuRuta, textoMenuRuta } from './rutaTool';

const ID_PARTICIPANTE = 'docusesion.participante';

const handler: vscode.ChatRequestHandler = async (request, _ctx, stream, token) => {
  let idioma: 'es' | 'en' = 'es';
  try {
    idioma = leerAjustes(elegirCarpeta()).idioma;
  } catch {
    // Sin workspace: idioma por defecto; menuRuta informará del error.
  }
  const t = i18n(idioma).rutaHerramienta;
  const botones = (): void => {
    stream.button({ command: 'docusesion.cambiarRutaDestino', title: t.botonCambiarRutaDestino });
    stream.button({ command: 'docusesion.configurarRutaPorDefecto', title: t.botonConfigurarRuta });
  };
  try {
    if (request.command === 'ruta') {
      const r = await menuRuta(token);
      stream.markdown(textoMenuRuta(r, false, true));
    } else {
      stream.markdown(t.ayudaParticipante);
    }
  } catch (e) {
    if (e instanceof vscode.CancellationError) {
      return {};
    }
    stream.markdown(`DocuSesión: ${enLinea(e instanceof Error ? e.message : String(e))}`);
  }
  botones();
  return {};
};

/** Participante de chat @docusesion (/ruta): abre el menú de la ruta de forma determinista, sin pasar por el modelo. */
export function registrarParticipante(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.chat.createChatParticipant(ID_PARTICIPANTE, handler));
}
