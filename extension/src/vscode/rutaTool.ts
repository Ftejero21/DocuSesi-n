import * as vscode from 'vscode';
import { EstadoRuta, textoEstadoRuta } from '../core/estadoRuta';
import { i18n } from '../core/i18n';
import { Idioma } from '../core/tipos';
import { leerAjustes } from './ajustes';
import { elegirCarpeta } from './contexto';
import { elegirRutaInteractiva, elegirUsoRuta, quitarRutaPorDefecto } from './rutaPorDefectoUI';
import { comprobarToken, destinoTemporal } from './selectorDestino';

export function enLinea(s: unknown): string {
  return String(s ?? '').replace(/[`\r\n]+/g, ' ');
}

export interface ResultadoMenuRuta {
  estado: EstadoRuta;
  idioma: Idioma;
}

/**
 * Menú de la ruta de la documentación: informa de la ruta por defecto y de la de "esta vez" y deja mantenerla,
 * cambiarla (solo la próxima vez o por defecto) o quitarla. Solo cambia ajustes por elección del usuario.
 * CancellationError si el token se cancela; si no hay workspace, lanza el error de elegirCarpeta.
 */
export async function menuRuta(token?: vscode.CancellationToken): Promise<ResultadoMenuRuta> {
  const folder = elegirCarpeta();
  const ajustes = leerAjustes(folder);
  const idioma = ajustes.idioma;
  const t = i18n(idioma);
  const tr = t.ruta;
  const th = t.rutaHerramienta;
  const temporal = destinoTemporal.actual();
  const rutaActual = temporal?.ruta ?? ajustes.rutaPorDefecto;
  const placeHolder = temporal ? tr.estaVezActiva(temporal.ruta) : tr.rutaActual(ajustes.rutaPorDefecto || tr.ninguna);

  type Valor = 'mantener' | 'cambiar' | 'quitarEstaVez' | 'quitar';
  const items: Array<vscode.QuickPickItem & { valor: Valor }> = [
    {
      label: th.opMantener,
      description: th.opMantenerDetalle(rutaActual !== '' ? rutaActual : tr.ninguna),
      valor: 'mantener'
    },
    { label: th.opCambiar, detail: th.opCambiarDetalle, valor: 'cambiar' }
  ];
  if (temporal) {
    items.push({ label: tr.opQuitarEstaVez, detail: tr.opQuitarEstaVezDetalle, valor: 'quitarEstaVez' });
  }
  if (ajustes.rutaPorDefecto !== '') {
    items.push({ label: tr.opQuitar, detail: tr.opQuitarDetalle, valor: 'quitar' });
  }
  const sel = await vscode.window.showQuickPick(items, { title: th.tituloMenu, placeHolder, ignoreFocusOut: true }, token);
  comprobarToken(token);

  let accion: EstadoRuta['accion'] = 'cancelado';
  let ruta: string | undefined;
  if (sel?.valor === 'mantener') {
    accion = 'mantener';
  } else if (sel?.valor === 'quitarEstaVez') {
    destinoTemporal.consumir();
    void vscode.window.showInformationMessage(tr.estaVezQuitada);
    accion = 'estaVezQuitada';
  } else if (sel?.valor === 'quitar') {
    accion = (await quitarRutaPorDefecto(folder, idioma)) ? 'quitada' : 'cancelado';
  } else if (sel?.valor === 'cambiar') {
    const r = await elegirRutaInteractiva(folder, idioma, { title: tr.tituloCambiar, placeHolder }, token);
    if (r?.tipo === 'ruta') {
      const uso = await elegirUsoRuta(r.abs, idioma, token);
      if (uso?.tipo === 'defecto') {
        accion = uso.guardada ? 'defecto' : 'defectoNoGuardada';
        ruta = uso.abs;
      } else if (uso?.tipo === 'estaVez') {
        accion = 'estaVez';
        ruta = uso.abs;
      }
    }
  }

  // Estado resultante, releído tras la elección.
  const despues = destinoTemporal.actual();
  return {
    idioma,
    estado: {
      accion,
      ruta,
      rutaPorDefecto: leerAjustes(folder).rutaPorDefecto,
      temporal: despues ? { ruta: despues.ruta, minutos: destinoTemporal.minutosRestantes() } : undefined
    }
  };
}

/** Texto del estado con las rutas saneadas; `markdown` las envuelve en backticks. */
export function textoMenuRuta(r: ResultadoMenuRuta, paraModelo: boolean, markdown: boolean): string {
  const fmt = (v: string): string => (v === '' ? '' : markdown ? `\`${enLinea(v)}\`` : enLinea(v));
  const e = r.estado;
  return textoEstadoRuta(
    {
      accion: e.accion,
      ruta: e.ruta === undefined ? undefined : fmt(e.ruta),
      rutaPorDefecto: fmt(e.rutaPorDefecto),
      temporal: e.temporal ? { ruta: fmt(e.temporal.ruta), minutos: e.temporal.minutos } : undefined
    },
    r.idioma,
    paraModelo
  );
}

/** Herramienta del modelo (#rutaDocumentacion): abre el menú de la ruta. Sin entrada: el modelo no propone rutas. */
export class RutaTool implements vscode.LanguageModelTool<Record<string, never>> {
  prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<Record<string, never>>,
    _token: vscode.CancellationToken
  ): vscode.PreparedToolInvocation {
    let idioma: Idioma = 'es';
    try {
      idioma = leerAjustes(elegirCarpeta()).idioma;
    } catch {
      // Sin workspace: se usa el idioma por defecto; el error se informa en invoke.
    }
    return { invocationMessage: i18n(idioma).rutaHerramienta.invocando };
  }

  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const r = await menuRuta(token);
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(textoMenuRuta(r, true, false))]);
  }
}
