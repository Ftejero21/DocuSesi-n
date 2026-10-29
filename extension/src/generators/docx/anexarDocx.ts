import { XMLSerializer, type Element, type Node } from '@xmldom/xmldom';
import { esHistorial, i18n } from '../../core/i18n';
import { resaltadoSql } from '../../core/formatoVisual';
import { esBloqueSql, limpiarControl, normalizar } from '../../core/texto';
import { ContextoGeneracion, DocuInput } from '../../core/tipos';
import { crearBackup } from '../backup';
import {
  cargarDocx,
  colapsar,
  elementos,
  esParrafoCodigo,
  modeloFormato,
  nivelBase,
  textoConSaltos,
  textoDe,
  tipoElemento
} from './modeloDocx';
import { encabezado, NS_W, parrafo, parrafoCodigo, segmentarContenido } from './xml';

export interface ResultadoAnexarDocx {
  buffer?: Buffer;
  accion: 'anexado' | 'sin_cambios' | 'no_escrito' | 'sustituido';
  seccionesCreadas: string[];
  seccionesActualizadas?: string[];
  decisionUsuario?: 'cancelar';
  encabezados: { texto: string; nivel: number }[];
  backup?: string;
}

type Modelo = { pPr?: Element; rPr?: Element };

/** Hijos de w:rPr que, según el esquema OOXML, van DESPUÉS de w:highlight. */
const POSTERIORES_A_HIGHLIGHT = new Set([
  'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang',
  'w:eastAsianLayout', 'w:specVanish', 'w:oMath', 'w:rPrChange'
]);

/** Pone w:highlight en un w:rPr (clon) respetando el orden del esquema. `valor` viene de la tabla cerrada de colores. */
function ponerResaltado(doc: { createElementNS(ns: string, nombre: string): Element }, rPr: Element, valor: string): void {
  for (const h of elementos(rPr).filter((e) => e.nodeName === 'w:highlight')) {
    rPr.removeChild(h);
  }
  const hl = doc.createElementNS(NS_W, 'w:highlight');
  hl.setAttributeNS(NS_W, 'w:val', valor);
  const siguiente = elementos(rPr).find((e) => POSTERIORES_A_HIGHLIGHT.has(e.nodeName));
  rPr.insertBefore(hl, siguiente ?? null);
}

/**
 * Añade al final de un docx existente un bloque (título + secciones + ejemplos) que imita el formato del documento.
 * No modifica ni elimina ningún nodo existente del body.
 */
export async function anexarDocx(buffer: Buffer, input: DocuInput, ctx: ContextoGeneracion): Promise<ResultadoAnexarDocx> {
  const { zip, doc, body, nivelDe, pStyleDe, estiloEncabezado, sectPr, importar } = cargarDocx(buffer);
  const res = resaltadoSql(input.formatoVisual)?.word;
  const nb = nivelBase(body, nivelDe);
  const ns = Math.min(nb + 1, 9);
  const hijosBody = elementos(body);

  const ultimo = (pred: (el: Element) => boolean): Element | undefined => {
    for (let i = hijosBody.length - 1; i >= 0; i--) {
      if (pred(hijosBody[i])) {
        return hijosBody[i];
      }
    }
    return undefined;
  };
  const elH = new Map<number, Element | undefined>();
  const modeloH = (n: number): Modelo | undefined => {
    if (!elH.has(n)) {
      elH.set(n, ultimo((el) => nivelDe(el) === n));
    }
    const el = elH.get(n);
    return el ? modeloFormato(el) : undefined;
  };
  const elCod = ultimo((el) => esParrafoCodigo(el, nivelDe, pStyleDe));
  const mCod = elCod ? modeloFormato(elCod) : undefined;
  const elCuerpo = ultimo((el) => tipoElemento(el, nivelDe, pStyleDe) === 'parrafo');
  const mCuerpo = elCuerpo ? modeloFormato(elCuerpo, { quitarNumPr: true }) : undefined;

  const parrafoComo = (modelo: Modelo, lineas: string[], resaltado?: string): Node => {
    const p = doc.createElementNS(NS_W, 'w:p');
    if (modelo.pPr) {
      p.appendChild(modelo.pPr.cloneNode(true));
    }
    const nuevoRun = (): Element => {
      const r = doc.createElementNS(NS_W, 'w:r');
      if (resaltado) {
        const rPr = (modelo.rPr?.cloneNode(true) as Element | undefined) ?? doc.createElementNS(NS_W, 'w:rPr');
        ponerResaltado(doc, rPr, resaltado);
        r.appendChild(rPr);
      } else if (modelo.rPr) {
        r.appendChild(modelo.rPr.cloneNode(true));
      }
      return r;
    };
    lineas.forEach((linea, i) => {
      if (i > 0) {
        const rBr = nuevoRun();
        rBr.appendChild(doc.createElementNS(NS_W, 'w:br'));
        p.appendChild(rBr);
      }
      const r = nuevoRun();
      const t = doc.createElementNS(NS_W, 'w:t');
      t.setAttribute('xml:space', 'preserve');
      t.appendChild(doc.createTextNode(linea));
      r.appendChild(t);
      p.appendChild(r);
    });
    return p;
  };

  const construir = (tituloUso: string, avisar: boolean): { nodos: Node[]; creadas: string[] } => {
    const nodos: Node[] = [];
    const cabecera = (texto: string, nivel: number): void => {
      const limpio = colapsar(limpiarControl(texto));
      const modelo = modeloH(nivel);
      nodos.push(modelo ? parrafoComo(modelo, [limpio]) : importar(encabezado(limpio, estiloEncabezado(nivel)))[0]);
    };
    const codigo = (texto: string, sql: boolean): void => {
      const resaltado = sql ? res : undefined;
      nodos.push(
        mCod
          ? parrafoComo(mCod, limpiarControl(texto).replace(/\t/g, '    ').split(/\r?\n/), resaltado)
          : importar(parrafoCodigo(texto, resaltado))[0]
      );
    };
    const cuerpo = (texto: string): void => {
      nodos.push(mCuerpo ? parrafoComo(mCuerpo, limpiarControl(texto).split(/\r?\n/)) : importar(parrafo(texto))[0]);
    };
    const segmentos = (contenido: string): void => {
      for (const s of segmentarContenido(contenido)) {
        if (s.tipo === 'codigo') {
          codigo(s.texto, esBloqueSql(s.texto, s.lenguaje));
        } else {
          cuerpo(s.texto);
        }
      }
    };

    const tit = colapsar(limpiarControl(tituloUso));
    const creadas: string[] = [tit];
    cabecera(tit, nb);
    for (const s of input.secciones ?? []) {
      const enc = s.encabezado.trim();
      if (enc === '' && s.contenido.trim() === '') {
        continue;
      }
      if (enc !== '' && esHistorial(enc)) {
        if (avisar) {
          ctx.avisos.push(`La sección "${s.encabezado}" coincide con el historial de cambios y se ignora (el historial se gestiona automáticamente).`);
        }
        continue;
      }
      if (enc !== '') {
        cabecera(enc, ns);
        creadas.push(colapsar(limpiarControl(enc)));
      }
      segmentos(s.contenido);
    }
    for (const e of input.ejemplos ?? []) {
      cabecera(e.titulo, ns);
      creadas.push(colapsar(limpiarControl(e.titulo)));
      if (e.explicacion && e.explicacion.trim() !== '') {
        segmentos(e.explicacion);
      }
      codigo(e.contenido, e.tipo === 'sql');
    }
    return { nodos, creadas };
  };

  const titulo = colapsar(limpiarControl(input.titulo));
  let { nodos, creadas } = construir(titulo, true);

  const listarEncabezados = (): { texto: string; nivel: number }[] => {
    const res: { texto: string; nivel: number }[] = [];
    for (const el of elementos(body)) {
      const n = nivelDe(el);
      if (n !== undefined) {
        res.push({ texto: textoDe(el), nivel: n });
      }
    }
    return res;
  };

  /** Nodos (incluidos los de texto) del bloque que empieza en h: hasta el siguiente encabezado de nivel <= base o w:sectPr (exclusivo). */
  const rangoBloque = (h: Element): Node[] => {
    const res: Node[] = [h];
    for (let n = h.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === 1) {
        const el = n as Element;
        if (el.nodeName === 'w:sectPr') {
          break;
        }
        const nv = nivelDe(el);
        if (nv !== undefined && nv <= nb) {
          break;
        }
      }
      res.push(n);
    }
    return res;
  };
  const textosDe = (lista: Node[]): string[] =>
    lista
      .filter((n) => n.nodeType === 1)
      .map((n) => colapsar(textoConSaltos(n)))
      .filter((t) => t !== '');

  // Duplicados: nunca se reemplaza ni se duplica sin una decisión explícita del usuario.
  const claveTitulo = normalizar(titulo);
  const iguales = hijosBody.filter((el) => nivelDe(el) === nb && normalizar(textoDe(el)) === claveTitulo);
  if (iguales.length > 0) {
    const nuevos = textosDe(nodos);
    const identico = iguales.some((h) => {
      const existentes = textosDe(rangoBloque(h));
      return existentes.length === nuevos.length && existentes.every((t, i) => t === nuevos[i]);
    });
    if (identico) {
      return { accion: 'sin_cambios', seccionesCreadas: [], encabezados: listarEncabezados() };
    }
    if (!ctx.resolverTituloDuplicado) {
      ctx.avisos.push(
        `Modo "anexar": el documento ya tiene un encabezado de nivel ${nb} "${titulo}" con contenido distinto. ` +
          'No se ha añadido nada para no duplicar ni modificar contenido existente. ' +
          'Si es otra funcionalidad usa un título distinto; si el usuario quiere sustituir ese bloque, pregúntale si prefiere sustituirlo o usar otro título.'
      );
      return { accion: 'no_escrito', seccionesCreadas: [], encabezados: listarEncabezados() };
    }

    const L = i18n(ctx.idioma).res;
    const titulosExistentes = hijosBody.filter((el) => nivelDe(el) === nb).map((el) => textoDe(el));
    const decision = await ctx.resolverTituloDuplicado({ titulo, nivel: nb, ocurrencias: iguales.length, titulosExistentes });
    if (decision.accion === 'cancelar') {
      ctx.avisos.unshift(L.anexarCancelado(titulo));
      return { accion: 'no_escrito', seccionesCreadas: [], encabezados: listarEncabezados(), decisionUsuario: 'cancelar' };
    }
    if (decision.accion === 'sustituir') {
      const objetivo = iguales[iguales.length - 1];
      if (iguales.length > 1) {
        ctx.avisos.push(L.sustituidoUltimo(titulo, iguales.length));
      }
      const respaldo = await crearBackup(ctx.rutaDestino, ctx.backupDir, ctx.fecha);
      for (const n of nodos) {
        body.insertBefore(n, objetivo);
      }
      for (const n of rangoBloque(objetivo)) {
        body.removeChild(n);
      }
      zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
      const salidaSust = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
      return {
        buffer: salidaSust,
        accion: 'sustituido',
        seccionesCreadas: [],
        seccionesActualizadas: [titulo],
        encabezados: listarEncabezados(),
        backup: respaldo
      };
    }
    const nuevoTitulo = colapsar(limpiarControl(decision.titulo));
    const claveNueva = normalizar(nuevoTitulo);
    if (nuevoTitulo === '' || titulosExistentes.some((e) => normalizar(e) === claveNueva)) {
      ctx.avisos.unshift(L.tituloAlternativoExiste(nuevoTitulo));
      return { accion: 'no_escrito', seccionesCreadas: [], encabezados: listarEncabezados(), decisionUsuario: 'cancelar' };
    }
    ({ nodos, creadas } = construir(nuevoTitulo, false));
  }

  const backup = await crearBackup(ctx.rutaDestino, ctx.backupDir, ctx.fecha);
  const ref: Node | null = sectPr() ?? null;
  for (const n of nodos) {
    body.insertBefore(n, ref);
  }
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  const salida = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  return { buffer: salida, accion: 'anexado', seccionesCreadas: creadas, encabezados: listarEncabezados(), backup };
}
