import * as path from 'path';
import * as vscode from 'vscode';
import { valorRutaPorDefecto } from '../core/configurarRuta';
import { i18n } from '../core/i18n';
import { esArchivoDocumento } from '../core/rutas';
import { Idioma } from '../core/tipos';
import { leerAjustes } from './ajustes';
import { elegirCarpeta } from './contexto';
import {
  comprobarToken,
  elegirCarpetaDestino,
  elegirDocumentoExistente,
  destinoTemporal,
  elegirDocumentoNuevo,
  rutasAprobadas
} from './selectorDestino';

const CLAVE_RUTA = 'rutaPorDefecto';
const CLAVE_PERMITIR = 'permitirRutasFueraDelWorkspace';

export interface AmbitoElegido {
  target: vscode.ConfigurationTarget;
  ambito: 'usuario' | 'areaTrabajo';
  etiqueta: string;
}

const esMultiRoot = (): boolean => (vscode.workspace.workspaceFolders?.length ?? 0) > 1;

/** QuickPick de ámbito: Usuario o Área de trabajo (Workspace en una carpeta; WorkspaceFolder en multi-root). */
export async function elegirAmbito(
  folder: vscode.WorkspaceFolder,
  idioma: Idioma,
  token?: vscode.CancellationToken
): Promise<AmbitoElegido | undefined> {
  const t = i18n(idioma).ruta;
  const multi = esMultiRoot();
  const etiquetaArea = multi ? t.ambitoCarpeta(folder.name) : t.ambitoArea;
  const items: Array<vscode.QuickPickItem & { valor: 'usuario' | 'areaTrabajo' }> = [
    { label: t.ambitoUsuario, detail: t.ambitoUsuarioDetalle, valor: 'usuario' },
    { label: etiquetaArea, detail: multi ? t.ambitoCarpetaDetalle : t.ambitoAreaDetalle, valor: 'areaTrabajo' }
  ];
  const sel = await vscode.window.showQuickPick(
    items,
    { title: t.tituloAmbito, placeHolder: t.placeHolderAmbito, ignoreFocusOut: true },
    token
  );
  comprobarToken(token);
  if (!sel) {
    return undefined;
  }
  if (sel.valor === 'usuario') {
    return { target: vscode.ConfigurationTarget.Global, ambito: 'usuario', etiqueta: t.ambitoUsuario };
  }
  return {
    target: multi ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace,
    ambito: 'areaTrabajo',
    etiqueta: etiquetaArea
  };
}

function valorEnAmbito<T>(
  insp: { globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T } | undefined,
  target: vscode.ConfigurationTarget
): T | undefined {
  if (target === vscode.ConfigurationTarget.Global) {
    return insp?.globalValue;
  }
  return target === vscode.ConfigurationTarget.Workspace ? insp?.workspaceValue : insp?.workspaceFolderValue;
}

function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Guarda la ruta por defecto: pregunta el ámbito, calcula el valor (relativo/absoluto) y, si queda fuera del
 * workspace sin permiso, exige activar permitirRutasFueraDelWorkspace en el mismo ámbito (modal).
 * false si el usuario cancela o falla el guardado; CancellationError si el token se cancela.
 */
export async function guardarRutaPorDefecto(
  abs: string,
  idioma: Idioma,
  token?: vscode.CancellationToken
): Promise<boolean> {
  const t = i18n(idioma).ruta;
  const folder = elegirCarpeta(abs);
  const amb = await elegirAmbito(folder, idioma, token);
  if (!amb) {
    return false;
  }
  const { valor, fuera } = valorRutaPorDefecto(abs, folder.uri.fsPath, amb.ambito);
  const cfg = vscode.workspace.getConfiguration('docusesion', folder.uri);

  let activado = false;
  let permitirPrevio: boolean | undefined;
  if (fuera && !leerAjustes(folder).permitirRutasFueraDelWorkspace) {
    const boton = await vscode.window.showWarningMessage(
      t.fueraMensaje(abs),
      { modal: true, detail: t.fueraDetalle },
      t.activarYGuardar
    );
    comprobarToken(token);
    if (boton !== t.activarYGuardar) {
      return false;
    }
    permitirPrevio = valorEnAmbito(cfg.inspect<boolean>(CLAVE_PERMITIR), amb.target);
    try {
      await cfg.update(CLAVE_PERMITIR, true, amb.target);
      activado = true;
    } catch (e) {
      void vscode.window.showErrorMessage(t.errorGuardar(mensajeError(e)));
      return false;
    }
  }

  try {
    await cfg.update(CLAVE_RUTA, valor, amb.target);
  } catch (e) {
    if (activado) {
      try {
        await cfg.update(CLAVE_PERMITIR, permitirPrevio, amb.target);
      } catch {
        // Sin más recurso: el error principal se informa abajo.
      }
    }
    void vscode.window.showErrorMessage(t.errorGuardar(mensajeError(e)));
    return false;
  }

  const a = leerAjustes(folder);
  if (a.rutaPorDefecto !== valor || (fuera && !a.permitirRutasFueraDelWorkspace)) {
    void vscode.window.showWarningMessage(t.noAplicada(amb.etiqueta));
  } else {
    void vscode.window.showInformationMessage(t.guardada(valor, amb.etiqueta));
  }
  return true;
}

/** Quita rutaPorDefecto de todos los ámbitos donde esté definida, para que el valor efectivo quede vacío. */
export async function quitarRutaPorDefecto(folder: vscode.WorkspaceFolder, idioma: Idioma): Promise<boolean> {
  const t = i18n(idioma).ruta;
  const cfg = vscode.workspace.getConfiguration('docusesion', folder.uri);
  const insp = cfg.inspect<string>(CLAVE_RUTA);
  const destinos: vscode.ConfigurationTarget[] = [];
  if (insp?.globalValue !== undefined) {
    destinos.push(vscode.ConfigurationTarget.Global);
  }
  if (insp?.workspaceValue !== undefined) {
    destinos.push(vscode.ConfigurationTarget.Workspace);
  }
  if (esMultiRoot() && insp?.workspaceFolderValue !== undefined) {
    destinos.push(vscode.ConfigurationTarget.WorkspaceFolder);
  }
  for (const d of destinos) {
    try {
      await cfg.update(CLAVE_RUTA, undefined, d);
    } catch (e) {
      void vscode.window.showErrorMessage(t.errorGuardar(mensajeError(e)));
      return false;
    }
  }
  const restante = leerAjustes(folder).rutaPorDefecto;
  if (restante !== '') {
    void vscode.window.showWarningMessage(t.quitadaConLegado(restante));
  } else {
    void vscode.window.showInformationMessage(t.quitada);
  }
  return true;
}

/**
 * Tras elegir la ruta en el selector del chat: pregunta si guardarla como predeterminada.
 * Nunca bloquea la documentación: cancelar o fallar no guarda nada. Solo propaga CancellationError del token.
 */
export async function ofrecerGuardarTrasSelector(
  sel: { opcion: 'nuevo' | 'existente'; abs: string },
  idioma: Idioma,
  token: vscode.CancellationToken
): Promise<void> {
  const t = i18n(idioma).ruta;
  try {
    const items: Array<vscode.QuickPickItem & { valor: 'una' | 'guardar' }> = [
      { label: t.soloEstaVez, detail: t.soloEstaVezDetalle, valor: 'una' },
      { label: t.guardarComoDefecto, detail: t.guardarComoDefectoDetalle, valor: 'guardar' }
    ];
    const p = await vscode.window.showQuickPick(
      items,
      { title: t.preguntaGuardar, placeHolder: t.placeHolderGuardar, ignoreFocusOut: true },
      token
    );
    comprobarToken(token);
    if (!p || p.valor === 'una') {
      return;
    }
    let abs = sel.abs;
    if (sel.opcion === 'nuevo') {
      const dir = path.dirname(sel.abs);
      const q = await vscode.window.showQuickPick(
        [
          { label: t.esteCarpeta(dir), valor: 'carpeta' as const },
          { label: t.esteDocumento(path.basename(sel.abs)), valor: 'documento' as const }
        ],
        { title: t.tituloCarpetaODoc, placeHolder: t.tituloCarpetaODoc, ignoreFocusOut: true },
        token
      );
      comprobarToken(token);
      if (!q) {
        return;
      }
      if (q.valor === 'carpeta') {
        if (esArchivoDocumento(dir)) {
          void vscode.window.showErrorMessage(t.errCarpetaConExtension(path.basename(dir)));
          return;
        }
        abs = dir;
      }
    }
    await guardarRutaPorDefecto(abs, idioma, token);
  } catch (e) {
    if (e instanceof vscode.CancellationError) {
      throw e;
    }
    void vscode.window.showErrorMessage(`DocuSesión: ${mensajeError(e)}`);
  }
}

export type RutaInteractiva =
  | { tipo: 'ruta'; opcion: 'carpeta' | 'existente' | 'nuevo'; abs: string }
  | { tipo: 'quitar' }
  | { tipo: 'quitarEstaVez' };

/**
 * QuickPick compartido por los comandos de ruta: carpeta / documento existente / documento nuevo + extras.
 * undefined si el usuario cancela o la ruta elegida no es válida (se informa con showErrorMessage).
 */
export async function elegirRutaInteractiva(
  folder: vscode.WorkspaceFolder,
  idioma: Idioma,
  opciones: { title: string; placeHolder: string; quitar?: boolean; quitarEstaVez?: boolean },
  token?: vscode.CancellationToken
): Promise<RutaInteractiva | undefined> {
  const t = i18n(idioma).ruta;
  type Valor = 'carpeta' | 'existente' | 'nuevo' | 'quitar' | 'quitarEstaVez';
  const items: Array<vscode.QuickPickItem & { valor: Valor }> = [
    { label: t.opCarpeta, detail: t.opCarpetaDetalle, valor: 'carpeta' },
    { label: t.opExistente, detail: t.opExistenteDetalle, valor: 'existente' },
    { label: t.opNuevo, detail: t.opNuevoDetalle, valor: 'nuevo' }
  ];
  if (opciones.quitar) {
    items.push({ label: t.opQuitar, detail: t.opQuitarDetalle, valor: 'quitar' });
  }
  if (opciones.quitarEstaVez) {
    items.push({ label: t.opQuitarEstaVez, detail: t.opQuitarEstaVezDetalle, valor: 'quitarEstaVez' });
  }
  const sel = await vscode.window.showQuickPick(
    items,
    { title: opciones.title, placeHolder: opciones.placeHolder, ignoreFocusOut: true },
    token
  );
  comprobarToken(token);
  if (!sel) {
    return undefined;
  }
  if (sel.valor === 'quitar' || sel.valor === 'quitarEstaVez') {
    return { tipo: sel.valor };
  }
  try {
    let abs: string | undefined;
    if (sel.valor === 'carpeta') {
      abs = await elegirCarpetaDestino(folder, idioma, token);
    } else if (sel.valor === 'existente') {
      abs = (await elegirDocumentoExistente(folder, idioma, undefined, token))?.abs;
    } else {
      abs = (await elegirDocumentoNuevo(folder, idioma, 'documentacion', undefined, token))?.abs;
    }
    return abs ? { tipo: 'ruta', opcion: sel.valor, abs } : undefined;
  } catch (e) {
    if (e instanceof vscode.CancellationError) {
      throw e;
    }
    void vscode.window.showErrorMessage(`DocuSesión: ${mensajeError(e)}`);
    return undefined;
  }
}

export type UsoRuta =
  | { tipo: 'defecto'; abs: string; guardada: boolean }
  | { tipo: 'estaVez'; abs: string; minutos: number };

/**
 * Tras elegir una ruta: pregunta si es solo para la próxima documentación o la ruta por defecto y lo aplica.
 * undefined si el usuario cancela; CancellationError si el token se cancela.
 */
export async function elegirUsoRuta(
  abs: string,
  idioma: Idioma,
  token?: vscode.CancellationToken
): Promise<UsoRuta | undefined> {
  const t = i18n(idioma).ruta;
  const uso = await vscode.window.showQuickPick(
    [
      { label: t.usoPorDefecto, detail: t.usoPorDefectoDetalle, valor: 'defecto' as const },
      { label: t.usoEstaVez, detail: t.usoEstaVezDetalle, valor: 'estaVez' as const }
    ],
    { title: t.tituloUso, placeHolder: `${t.placeHolderUso} (${abs})`, ignoreFocusOut: true },
    token
  );
  comprobarToken(token);
  if (!uso) {
    return undefined;
  }
  if (uso.valor === 'defecto') {
    const guardada = await guardarRutaPorDefecto(abs, idioma, token);
    if (guardada) {
      destinoTemporal.consumir();
    }
    return { tipo: 'defecto', abs, guardada };
  }
  rutasAprobadas.aprobar(abs);
  destinoTemporal.establecer(abs);
  const minutos = destinoTemporal.minutosRestantes();
  void vscode.window.showInformationMessage(t.estaVezEstablecida(abs, minutos));
  return { tipo: 'estaVez', abs, minutos };
}
