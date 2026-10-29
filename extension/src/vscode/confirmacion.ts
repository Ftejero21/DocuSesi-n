import * as path from 'path';
import * as vscode from 'vscode';
import { sugerirTituloAlternativo, textoPlan, validarTituloAlternativo } from '../core/confirmacion';
import { i18n } from '../core/i18n';
import { DecisionActualizacion, DecisionDuplicado, Idioma, InfoTituloDuplicado, PlanActualizacion } from '../core/tipos';
import { comprobarToken } from './selectorDestino';

interface OpcionActualizar extends vscode.MessageItem {
  decision: DecisionActualizacion;
}

interface OpcionDuplicado extends vscode.MessageItem {
  accion: DecisionDuplicado['accion'];
}

/**
 * Modal nativo previo a modificar un documento existente: muestra el plan de cambios.
 * Cerrar el modal equivale a cancelar. Los textos se pasan como texto plano (los modales no interpretan markdown).
 */
export async function confirmarActualizacionUI(
  plan: PlanActualizacion,
  rutaAbs: string,
  idioma: Idioma,
  token?: vscode.CancellationToken
): Promise<DecisionActualizacion> {
  const c = i18n(idioma).confirmacion;
  const actualizar: OpcionActualizar = { title: c.opActualizar, decision: 'actualizar' };
  const anexar: OpcionActualizar = { title: c.opAnexar, decision: 'anexar' };
  const cancelar: OpcionActualizar = { title: c.opCancelar, isCloseAffordance: true, decision: 'cancelar' };
  const opciones = plan.formato === 'docx' ? [actualizar, anexar, cancelar] : [actualizar, cancelar];
  const elegida = await vscode.window.showWarningMessage(
    c.mensajeActualizar,
    { modal: true, detail: textoPlan(plan, path.basename(rutaAbs), idioma) },
    ...opciones
  );
  comprobarToken(token);
  return elegida?.decision ?? 'cancelar';
}

/**
 * Modal nativo para un bloque duplicado en modo "anexar": sustituir, añadir con otro título (InputBox) o cancelar.
 * Cerrar el modal o el InputBox equivale a cancelar.
 */
export async function resolverTituloDuplicadoUI(
  info: InfoTituloDuplicado,
  idioma: Idioma,
  token?: vscode.CancellationToken
): Promise<DecisionDuplicado> {
  const c = i18n(idioma).confirmacion;
  const sustituir: OpcionDuplicado = { title: c.opSustituir, accion: 'sustituir' };
  const nuevo: OpcionDuplicado = { title: c.opNuevoTitulo, accion: 'nuevoTitulo' };
  const cancelar: OpcionDuplicado = { title: c.opCancelar, isCloseAffordance: true, accion: 'cancelar' };
  const elegida = await vscode.window.showWarningMessage(
    c.duplicadoMensaje(info.titulo, info.nivel),
    { modal: true, detail: info.ocurrencias > 1 ? c.duplicadoVarias(info.ocurrencias) : c.duplicadoDetalle },
    sustituir,
    nuevo,
    cancelar
  );
  comprobarToken(token);
  if (!elegida || elegida.accion === 'cancelar') {
    return { accion: 'cancelar' };
  }
  if (elegida.accion === 'sustituir') {
    return { accion: 'sustituir' };
  }
  const valor = await vscode.window.showInputBox(
    {
      title: c.inputTitulo,
      prompt: c.inputPrompt,
      value: sugerirTituloAlternativo(info.titulo, info.titulosExistentes),
      ignoreFocusOut: true,
      validateInput: (v: string) => validarTituloAlternativo(v, info.titulosExistentes, idioma)
    },
    token
  );
  comprobarToken(token);
  if (valor === undefined) {
    return { accion: 'cancelar' };
  }
  return { accion: 'nuevoTitulo', titulo: valor };
}
