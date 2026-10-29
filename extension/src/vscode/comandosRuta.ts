import * as vscode from 'vscode';
import { i18n } from '../core/i18n';
import { leerAjustes } from './ajustes';
import { elegirCarpeta } from './contexto';
import { elegirRutaInteractiva, elegirUsoRuta, guardarRutaPorDefecto, quitarRutaPorDefecto } from './rutaPorDefectoUI';
import { destinoTemporal } from './selectorDestino';

const CMD_CONFIGURAR = 'docusesion.configurarRutaPorDefecto';
const CMD_CAMBIAR = 'docusesion.cambiarRutaDestino';

async function configurarRutaPorDefecto(): Promise<void> {
  const folder = elegirCarpeta();
  const ajustes = leerAjustes(folder);
  const t = i18n(ajustes.idioma).ruta;
  const r = await elegirRutaInteractiva(folder, ajustes.idioma, {
    title: t.tituloConfigurar,
    placeHolder: t.rutaActual(ajustes.rutaPorDefecto || t.ninguna),
    quitar: true
  });
  if (!r) {
    return;
  }
  if (r.tipo === 'quitar') {
    await quitarRutaPorDefecto(folder, ajustes.idioma);
  } else if (r.tipo === 'ruta' && (await guardarRutaPorDefecto(r.abs, ajustes.idioma))) {
    destinoTemporal.consumir();
  }
}

async function cambiarRutaDestino(): Promise<void> {
  const folder = elegirCarpeta();
  const ajustes = leerAjustes(folder);
  const idioma = ajustes.idioma;
  const t = i18n(idioma).ruta;
  const temporal = destinoTemporal.actual();
  const r = await elegirRutaInteractiva(folder, idioma, {
    title: t.tituloCambiar,
    placeHolder: temporal ? t.estaVezActiva(temporal.ruta) : t.rutaActual(ajustes.rutaPorDefecto || t.ninguna),
    quitarEstaVez: temporal !== undefined
  });
  if (!r) {
    return;
  }
  if (r.tipo === 'quitarEstaVez') {
    destinoTemporal.consumir();
    void vscode.window.showInformationMessage(t.estaVezQuitada);
    return;
  }
  if (r.tipo !== 'ruta') {
    return;
  }
  await elegirUsoRuta(r.abs, idioma);
}

function registrar(context: vscode.ExtensionContext, comando: string, accion: () => Promise<void>): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(comando, async () => {
      try {
        await accion();
      } catch (e) {
        if (e instanceof vscode.CancellationError) {
          return;
        }
        void vscode.window.showErrorMessage(`DocuSesión: ${(e as Error).message}`);
      }
    })
  );
}

export function registrarComandosRuta(context: vscode.ExtensionContext): void {
  registrar(context, CMD_CONFIGURAR, configurarRutaPorDefecto);
  registrar(context, CMD_CAMBIAR, cambiarRutaDestino);
}
