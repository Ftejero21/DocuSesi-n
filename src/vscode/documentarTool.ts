import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { debeConsumirTemporal, elegirOrigenDestino } from '../core/destinoTemporal';
import { COLORES_RESALTADO } from '../core/formatoVisual';
import { i18n } from '../core/i18n';
import { estaDentro, modoEfectivo, resolverDestino, resultadoSinDestino } from '../core/rutas';
import { decidirTrasSeleccion } from '../core/selectorDestino';
import { DocuInput, Formato, ResultadoGeneracion } from '../core/tipos';
import { validarInput } from '../core/validacion';
import { leerAjustes } from './ajustes';
import { elegirCarpeta, ejecutarDocumentacion } from './contexto';
import { mostrarNotificacion } from './notificacion';
import { ofrecerGuardarTrasSelector } from './rutaPorDefectoUI';
import { destinoTemporal, elegirDestinoDocumentar, esRutaAprobada } from './selectorDestino';

function enLinea(s: unknown): string {
  return String(s ?? '').replace(/[`\r\n]+/g, ' ');
}

/** Ruta relativa POSIX si está dentro del workspace; si no, la absoluta. */
function rutaVisible(root: string, abs: string): string {
  return estaDentro(root, abs) ? path.relative(root, abs).split(path.sep).join('/') : abs;
}

export function formatearResultado(r: ResultadoGeneracion, rel: string, root: string, idioma: 'es' | 'en'): string {
  const t = i18n(idioma);
  const L = t.res;
  if (r.rutaFinal === '') {
    return [`${L.accion}: ${L.acciones.no_escrito}`, `${L.avisos}:`, ...r.avisos.map((a) => `  - ${a}`)].join('\n');
  }
  const lineas: string[] = [];
  lineas.push(`${L.archivo}: ${rel}`);
  lineas.push(`${L.accion}: ${L.acciones[r.accion] ?? r.accion}`);
  if (path.resolve(r.rutaFinal) !== path.resolve(root, rel)) {
    lineas.push(`${L.archivo} (final): ${rutaVisible(root, r.rutaFinal)}`);
  }
  lineas.push(`${L.seccionesCreadas}: ${r.seccionesCreadas.length ? r.seccionesCreadas.join('; ') : L.ninguno}`);
  lineas.push(`${L.seccionesActualizadas}: ${r.seccionesActualizadas.length ? r.seccionesActualizadas.join('; ') : L.ninguno}`);
  if (r.accion !== 'no_escrito') {
    lineas.push(`${L.encabezados}:`);
    for (const e of r.encabezados) {
      lineas.push(`  ${'#'.repeat(Math.max(1, e.nivel))} ${e.texto}`);
    }
  }
  if (r.backup) {
    lineas.push(`${L.backup}: ${rutaVisible(root, r.backup)}`);
  }
  if (r.mapeosDegradados && r.mapeosDegradados.length > 0) {
    lineas.push(`${L.mapeosDegradados}: ${r.mapeosDegradados.join('; ')}`);
  }
  lineas.push(`${L.avisos}: ${r.avisos.length ? '' : L.ninguno}`);
  for (const a of r.avisos) {
    lineas.push(`  - ${a}`);
  }
  if (r.avisos.length > 0) {
    lineas.push(
      r.decisionUsuario
        ? L.noReintentar
        : r.accion === 'anexado' || r.accion === 'sin_cambios' || r.accion === 'sustituido'
          ? L.corrigeAnexado
          : L.corrige
    );
  }
  return lineas.join('\n');
}

function textoResultado(texto: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(texto)]);
}

export class DocumentarTool implements vscode.LanguageModelTool<DocuInput> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<DocuInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const md = new vscode.MarkdownString();
    const raw = (options.input ?? {}) as Partial<DocuInput>;
    try {
      const destinoRaw = typeof raw.destino === 'string' ? raw.destino : undefined;
      const folderIni = elegirCarpeta(destinoRaw);
      const ajustesIni = leerAjustes(folderIni);
      const temporal = destinoTemporal.actual();
      const { origen, rutaBase } = elegirOrigenDestino(destinoRaw, temporal?.ruta, ajustesIni.rutaPorDefecto);
      const folder = origen === 'temporal' ? elegirCarpeta(rutaBase) : folderIni;
      const ajustes = origen === 'temporal' ? leerAjustes(folder) : ajustesIni;
      const root = folder.uri.fsPath;
      if (origen === 'selector') {
        return {
          invocationMessage: 'Se abrirá un selector para elegir dónde guardar la documentación…'
        };
      }
      const formatoRaw = (['docx', 'xlsx', 'pptx'] as string[]).includes(String(raw.formato))
        ? (raw.formato as Formato)
        : undefined;
      const dest = resolverDestino(
        root,
        { titulo: typeof raw.titulo === 'string' && raw.titulo ? raw.titulo : 'documento', destino: destinoRaw, formato: formatoRaw },
        rutaBase,
        ajustes.permitirRutasFueraDelWorkspace,
        esRutaAprobada
      );
      const existe = fs.existsSync(dest.abs);
      let modoTxt: string;
      try {
        const modo = modoEfectivo(raw.modo, existe, dest.formato);
        modoTxt =
          modo === 'anexar'
            ? 'Añadir al final del documento existente (solo se añadirá al final; no se modifica contenido existente; se crea una copia de seguridad)'
            : modo === 'crear'
              ? 'Crear archivo nuevo'
              : modo === 'actualizar'
                ? i18n(ajustes.idioma).confirmacion.prepararActualizar
                : 'Crear un archivo nuevo con sufijo de fecha (el existente no se modifica)';
        if (raw.modo === 'anexar') {
          if (modo === 'crear') {
            modoTxt += ' (modo anexar: el archivo no existe, se crea nuevo)';
          } else if (modo === 'actualizar') {
            modoTxt += ' (anexar solo se aplica a docx)';
          }
        }
      } catch (e) {
        modoTxt = `No válido: ${enLinea((e as Error).message)}`;
      }
      if (origen === 'temporal') {
        md.appendMarkdown(i18n(ajustes.idioma).ruta.prepararEstaVez(enLinea(rutaBase)));
      } else if (dest.porDefecto) {
        md.appendMarkdown(
          `**Destino:** ruta por defecto de los ajustes (\`docusesion.rutaPorDefecto\` = \`${enLinea(ajustes.rutaPorDefecto)}\`)\n\n`
        );
      }
      md.appendMarkdown(`**Archivo:** \`${enLinea(dest.abs)}\`\n\n`);
      if (dest.fuera) {
        md.appendMarkdown(
          `**Atención:** el destino está FUERA del workspace (\`${enLinea(root)}\`). ` +
            'Se escribirá directamente en esa ruta; la copia de seguridad se guarda en `.docusesion/backups` del workspace.\n\n'
        );
      }
      md.appendMarkdown(`**Modo:** ${modoTxt}\n\n`);
      md.appendMarkdown(`**Tipo:** ${enLinea(raw.tipo ?? '(sin indicar)')}\n\n`);
      md.appendMarkdown(`**Formato:** ${dest.formato}`);
      if (raw.formatoVisual?.resaltarSql === true) {
        const c = raw.formatoVisual.colorResaltado;
        const color = typeof c === 'string' && Object.prototype.hasOwnProperty.call(COLORES_RESALTADO, c) ? c : 'amarillo';
        md.appendMarkdown(`\n\n${i18n(ajustes.idioma).confirmacion.formatoVisual(enLinea(color))}`);
      }
    } catch (e) {
      md.appendMarkdown(`No se pudo calcular el destino: ${enLinea((e as Error).message)}\n\n`);
      md.appendMarkdown(`**Tipo:** ${enLinea(raw.tipo ?? '(sin indicar)')}  \n**Formato:** ${enLinea(raw.formato ?? '(sin indicar)')}`);
    }
    return {
      invocationMessage: 'Generando documentación…',
      confirmationMessages: { title: 'DocuSesión: generar documentación', message: md }
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<DocuInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const v = validarInput(options.input);
    if (!v.ok) {
      throw new Error(
        `La entrada de la herramienta no es válida. Corrígela y vuelve a invocarla:\n- ${v.errores.join('\n- ')}`
      );
    }
    let input = v.input;
    let folder = elegirCarpeta(input.destino);
    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    const ajustesIni = leerAjustes(folder);
    const temporal = destinoTemporal.actual();
    const { origen, rutaBase } = elegirOrigenDestino(input.destino, temporal?.ruta, ajustesIni.rutaPorDefecto);
    if (origen === 'temporal') {
      folder = elegirCarpeta(rutaBase);
    }
    if (origen === 'selector') {
      const idioma = ajustesIni.idioma;
      const t = i18n(idioma);
      const sel = await elegirDestinoDocumentar(folder, input, idioma, token);
      if (!sel) {
        const r = resultadoSinDestino(idioma);
        r.avisos.unshift(t.res.selectorCancelado);
        return textoResultado(formatearResultado(r, '', folder.uri.fsPath, idioma));
      }
      // Pregunta opcional de guardar la ruta como predeterminada: nunca bloquea la documentación.
      await ofrecerGuardarTrasSelector(sel, idioma, token);
      const d = decidirTrasSeleccion(sel.opcion, sel.formato, input.modo);
      if (d.accion === 'pedirAnexar') {
        const r: ResultadoGeneracion = {
          rutaFinal: '',
          accion: 'no_escrito',
          seccionesCreadas: [],
          seccionesActualizadas: [],
          encabezados: [],
          avisos: [t.res.documentoExistenteElegido(sel.abs)]
        };
        return textoResultado(formatearResultado(r, '', folder.uri.fsPath, idioma));
      }
      input = { ...input, destino: sel.abs, formato: sel.formato, modo: d.modo };
      folder = elegirCarpeta(sel.abs);
    }

    const { resultado, rel, ajustes, abs } = await ejecutarDocumentacion(input, folder, token, [], {
      exigirMencionCambios: true,
      rutaPorDefecto: origen === 'temporal' ? rutaBase : undefined
    });
    // El destino temporal se consume tras escribir (o sin_cambios) o si el usuario cancela; no con anexar,
    // avisos de validación, excepciones ni confirmación rechazada, para que los reintentos usen la misma ruta.
    if ((origen === 'temporal' || (abs !== '' && destinoTemporal.cubre(abs))) && debeConsumirTemporal(resultado)) {
      destinoTemporal.consumir();
    }
    if (resultado.accion !== 'no_escrito' && resultado.accion !== 'sin_cambios') {
      mostrarNotificacion(resultado.rutaFinal, ajustes.idioma);
    }

    const texto = formatearResultado(resultado, rel, folder.uri.fsPath, ajustes.idioma);
    return textoResultado(texto);
  }
}
