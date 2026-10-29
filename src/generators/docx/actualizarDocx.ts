import { XMLSerializer, type Element, type Node } from '@xmldom/xmldom';
import { resaltadoSql } from '../../core/formatoVisual';
import { aliasNormalizados, aliasTipoObjeto, ClaveSeccionFija, Etiquetas, esHistorial, etiquetasTipoEjemplo, i18n } from '../../core/i18n';
import { formatoFecha, normalizar } from '../../core/texto';
import { ContextoGeneracion, DocuInput, PlanActualizacion } from '../../core/tipos';
import { crearBackup } from '../backup';
import { cargarDocx, colapsar, elementos, hijo, textoConSaltos, textoDe } from './modeloDocx';
import { bloquesFijos, colorEstado, contenidoAParrafos, encabezado, filasMapeo, NS_W, tabla, xmlEjemplo } from './xml';

export interface ResultadoActualizarDocx {
  buffer: Buffer;
  seccionesCreadas: string[];
  seccionesActualizadas: string[];
  encabezados: { texto: string; nivel: number }[];
  backup?: string;
}

function quitarHijos(el: Node, filtro: (n: Node) => boolean): void {
  for (let n = el.firstChild; n; ) {
    const sig = n.nextSibling;
    if (filtro(n)) {
      el.removeChild(n);
    }
    n = sig;
  }
}

interface SeccionAplicar {
  encabezado: string;
  candidatos: string[];
  xml: string;
  soloSiExiste?: boolean;
  clave?: ClaveSeccionFija;
}

/** Secciones a aplicar: primero las del input, después las fijas. Compartido por actualizarDocx y planActualizarDocx. */
function construirSecciones(
  input: DocuInput,
  ctx: ContextoGeneracion,
  t: Etiquetas,
  estiloCuerpo: string | undefined,
  tblStyle: string | undefined
): SeccionAplicar[] {
  const res = resaltadoSql(input.formatoVisual)?.word;
  const secciones: SeccionAplicar[] = (input.secciones ?? []).map((s) => ({
    encabezado: s.encabezado,
    candidatos: [normalizar(s.encabezado)],
    xml: contenidoAParrafos(s.contenido, estiloCuerpo, res)
  }));
  for (const b of bloquesFijos(input, ctx, t, { estiloCuerpo, tblStyle, resaltadoSql: res })) {
    secciones.push({
      encabezado: b.encabezado,
      candidatos: aliasNormalizados(b.clave),
      xml: b.xml,
      soloSiExiste: b.soloSiExiste,
      clave: b.clave
    });
  }
  return secciones;
}

/** Primer encabezado del documento cuyo texto normalizado está entre los candidatos. */
function encontrarEncabezado(body: Element, nivelDe: (el: Element) => number | undefined, candidatos: string[]): Element | undefined {
  return elementos(body).find((el) => nivelDe(el) !== undefined && candidatos.includes(normalizar(textoDe(el))));
}

/**
 * Plan de cambios de actualizarDocx (con fusionar) sin modificar nada: ni el buffer, ni el disco, ni ctx.avisos.
 * Replica la clasificación del bucle de actualizarDocx.
 */
export function planActualizarDocx(buffer: Buffer, input: DocuInput, ctx: ContextoGeneracion): PlanActualizacion {
  const t = i18n(ctx.idioma);
  const c = t.confirmacion;
  const { body, info, estiloCuerpo, nivelDe } = cargarDocx(buffer);
  const secciones = construirSecciones(input, ctx, t, estiloCuerpo, info.idTablaRejilla);
  const plan: PlanActualizacion = { formato: 'docx', sustituir: [], ampliar: [], anadir: [] };

  for (const s of secciones) {
    if (!s.clave && s.encabezado.trim() === '') {
      continue;
    }
    if (esHistorial(s.encabezado)) {
      continue;
    }
    const existente = encontrarEncabezado(body, nivelDe, s.candidatos);
    if (existente) {
      const texto = textoDe(existente);
      if (s.clave === 'correspondencia' && input.mapeoNombres?.length) {
        plan.ampliar.push(c.ampliarFilas(texto));
      } else if (s.clave === 'ejemplos' && input.ejemplos?.length) {
        plan.ampliar.push(c.ampliarEjemplos(texto));
      } else if (!s.clave && input.tipo === 'cambio') {
        const marca = t.marcaCambio(formatoFecha(ctx.fecha), colapsar(input.titulo));
        plan.ampliar.push(c.ampliarCambio(texto, marca));
      } else {
        plan.sustituir.push(texto);
      }
    } else if (!s.soloSiExiste) {
      plan.anadir.push(s.encabezado);
    }
  }

  const hist = elementos(body).find((el) => nivelDe(el) !== undefined && esHistorial(textoDe(el)));
  if (hist) {
    plan.ampliar.push(c.filaHistorial(textoDe(hist)));
  } else {
    plan.anadir.push(t.historial);
  }
  return plan;
}

export async function actualizarDocx(
  buffer: Buffer,
  input: DocuInput,
  ctx: ContextoGeneracion,
  opciones: { conBackup: boolean; fusionar?: boolean }
): Promise<ResultadoActualizarDocx> {
  const t = i18n(ctx.idioma);
  let backup: string | undefined;
  if (opciones.conBackup) {
    backup = await crearBackup(ctx.rutaDestino, ctx.backupDir, ctx.fecha);
  }

  const { zip, doc, body, info, estiloCuerpo, pStyleDe, nivelDe, estiloEncabezado, sectPr, importar } = cargarDocx(buffer);

  const buscarEncabezado = (candidatos: string[]): Element | undefined => encontrarEncabezado(body, nivelDe, candidatos);
  const buscarHistorial = (): Element | undefined =>
    elementos(body).find((el) => nivelDe(el) !== undefined && esHistorial(textoDe(el)));

  const insertarAntes = (nodos: Node[], ref: Node | null): void => {
    for (const n of nodos) {
      body.insertBefore(n, ref);
    }
  };

  const creadas: string[] = [];
  const actualizadas: string[] = [];

  const tblStyle = info.idTablaRejilla;
  const secciones = construirSecciones(input, ctx, t, estiloCuerpo, tblStyle);

  for (const s of secciones) {
    if (!s.clave && s.encabezado.trim() === '') {
      ctx.avisos.push('La sección sin encabezado se ignora: solo se admite en modo "anexar" o al crear un documento nuevo.');
      continue;
    }
    if (esHistorial(s.encabezado)) {
      ctx.avisos.push(`La sección "${s.encabezado}" coincide con el historial de cambios y se ignora (el historial se gestiona automáticamente).`);
      continue;
    }
    const existente = buscarEncabezado(s.candidatos);
    if (existente) {
      if (opciones.fusionar && s.clave === 'correspondencia' && input.mapeoNombres?.length) {
        fusionarMapeo(existente, s);
      } else if (opciones.fusionar && s.clave === 'ejemplos' && input.ejemplos?.length) {
        fusionarEjemplos(existente);
      } else if (opciones.fusionar && !s.clave && input.tipo === 'cambio') {
        anexarCambio(existente, s);
      } else {
        const nivel = nivelDe(existente) as number;
        // Elimina los hermanos hasta el siguiente encabezado de nivel <= nivel (o hasta sectPr).
        for (let n = existente.nextSibling; n; ) {
          const sig = n.nextSibling;
          if (n.nodeType === 1) {
            const el = n as Element;
            if (el.nodeName === 'w:sectPr') {
              break;
            }
            const nv = nivelDe(el);
            if (nv !== undefined && nv <= nivel) {
              break;
            }
          }
          body.removeChild(n);
          n = sig;
        }
        const nodos = importar(s.xml);
        const ref = existente.nextSibling;
        insertarAntes(nodos, ref);
      }
      actualizadas.push(s.encabezado);
    } else {
      if (s.soloSiExiste) {
        continue;
      }
      const hist = buscarHistorial();
      const nivel = hist ? (nivelDe(hist) as number) : 2;
      const ref: Node | null = hist ?? sectPr() ?? null;
      insertarAntes(importar(encabezado(s.encabezado, estiloEncabezado(nivel)) + s.xml), ref);
      creadas.push(s.encabezado);
    }
  }

  // Historial de cambios
  const valores = [formatoFecha(ctx.fecha), t.tipoDoc[input.tipo], input.titulo, input.resumen].map((v) =>
    v.replace(/\s*\r?\n\s*/g, ' ')
  );
  const hist = buscarHistorial();
  if (hist) {
    const nivelHist = nivelDe(hist) as number;
    let tbl: Element | undefined;
    for (let n = hist.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType !== 1) {
        continue;
      }
      const el = n as Element;
      const nv = nivelDe(el);
      if (nv !== undefined && nv <= nivelHist) {
        break;
      }
      if (el.nodeName === 'w:tbl') {
        tbl = el;
        break;
      }
    }
    if (tbl) {
      agregarFilaHistorial(tbl, valores);
    } else {
      const xml = tabla([...t.cabHistorial], [valores], { tblStyle });
      insertarAntes(importar(xml), hist.nextSibling);
    }
  } else {
    const xml = encabezado(t.historial, estiloEncabezado(1)) + tabla([...t.cabHistorial], [valores], { tblStyle });
    insertarAntes(importar(xml), sectPr() ?? null);
  }

  const xmlSalida = new XMLSerializer().serializeToString(doc);
  zip.file('word/document.xml', xmlSalida);
  const salida = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;

  const encabezados: { texto: string; nivel: number }[] = [];
  for (const el of elementos(body)) {
    const n = nivelDe(el);
    if (n !== undefined) {
      encabezados.push({ texto: textoDe(el), nivel: n });
    }
  }
  return { buffer: salida, seccionesCreadas: creadas, seccionesActualizadas: actualizadas, encabezados, backup };

  function agregarFilaHistorial(tbl: Element, vals: string[]): void {
    const filas = elementos(tbl).filter((e) => e.nodeName === 'w:tr');
    const esperados = vals.map((v) => colapsar(limpiar(v)));
    const repetida = filas.slice(1).some((tr) => {
      const tcs = elementos(tr).filter((e) => e.nodeName === 'w:tc');
      return tcs.length >= 4 && esperados.slice(0, 4).every((v, i) => colapsar(textoConSaltos(tcs[i])) === v);
    });
    if (repetida) {
      return;
    }
    const nueva = clonarFilaBase(tbl, vals.length);
    const celdas = elementos(nueva).filter((e) => e.nodeName === 'w:tc');
    celdas.forEach((tc, i) => ponerTextoCelda(tc, vals[i] ?? ''));
    const ultima = filas[filas.length - 1];
    if (ultima) {
      tbl.insertBefore(nueva, ultima.nextSibling);
    } else {
      tbl.appendChild(nueva);
    }
  }

  function ponerTextoCelda(tc: Element, texto: string): void {
    const parrafos = elementos(tc).filter((e) => e.nodeName === 'w:p');
    let p = parrafos[0];
    if (!p) {
      p = importar('<w:p/>')[0] as Element;
      tc.appendChild(p);
    }
    for (const extra of parrafos.slice(1)) {
      tc.removeChild(extra);
    }
    const runs = elementos(p).filter((e) => e.nodeName === 'w:r');
    let rPr: Node | undefined;
    if (runs[0]) {
      const r = hijo(runs[0], 'w:rPr');
      rPr = r ? r.cloneNode(true) : undefined;
    }
    quitarHijos(p, (n) => !(n.nodeType === 1 && (n as Element).nodeName === 'w:pPr'));
    const run = doc.createElementNS(NS_W, 'w:r');
    if (rPr) {
      run.appendChild(rPr);
    }
    limpiar(texto)
      .split(/\r?\n/)
      .forEach((linea, i) => {
        if (i > 0) {
          run.appendChild(doc.createElementNS(NS_W, 'w:br'));
        }
        const tEl = doc.createElementNS(NS_W, 'w:t');
        tEl.setAttribute('xml:space', 'preserve');
        tEl.appendChild(doc.createTextNode(linea));
        run.appendChild(tEl);
      });
    p.appendChild(run);
  }

  function limpiar(texto: string): string {
    return texto.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  /** Elementos de la sección de un encabezado y el nodo límite (siguiente encabezado de nivel <= nivel, w:sectPr o null). */
  function rangoSeccion(h: Element): { nodos: Element[]; fin: Node | null } {
    const nivel = nivelDe(h) as number;
    const nodos: Element[] = [];
    for (let n = h.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType !== 1) {
        continue;
      }
      const el = n as Element;
      if (el.nodeName === 'w:sectPr') {
        return { nodos, fin: el };
      }
      const nv = nivelDe(el);
      if (nv !== undefined && nv <= nivel) {
        return { nodos, fin: el };
      }
      nodos.push(el);
    }
    return { nodos, fin: null };
  }

  function clonarFilaBase(tbl: Element, numCeldas: number): Element {
    const filas = elementos(tbl).filter((e) => e.nodeName === 'w:tr');
    if (filas.length > 1) {
      return filas[filas.length - 1].cloneNode(true) as Element;
    }
    if (filas.length === 1) {
      const nueva = filas[0].cloneNode(true) as Element;
      for (const tag of ['w:b', 'w:bCs']) {
        const bs = nueva.getElementsByTagName(tag);
        for (let i = bs.length - 1; i >= 0; i--) {
          bs[i].parentNode?.removeChild(bs[i]);
        }
      }
      const trPr = hijo(nueva, 'w:trPr');
      const th = trPr ? hijo(trPr, 'w:tblHeader') : undefined;
      if (trPr && th) {
        trPr.removeChild(th);
      }
      return nueva;
    }
    const ancho = Math.floor(9000 / numCeldas);
    const celdas = Array.from(
      { length: numCeldas },
      () => `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t/></w:r></w:p></w:tc>`
    ).join('');
    return importar(`<w:tr>${celdas}</w:tr>`)[0] as Element;
  }

  function ponerSombreadoFila(tr: Element, fill?: string): void {
    const despuesDeShd = [
      'w:noWrap', 'w:tcMar', 'w:textDirection', 'w:tcFitText', 'w:vAlign', 'w:hideMark',
      'w:headers', 'w:cellIns', 'w:cellDel', 'w:cellMerge', 'w:tcPrChange'
    ];
    for (const tc of elementos(tr).filter((e) => e.nodeName === 'w:tc')) {
      let tcPr = hijo(tc, 'w:tcPr');
      if (!tcPr) {
        tcPr = doc.createElementNS(NS_W, 'w:tcPr');
        tc.insertBefore(tcPr, tc.firstChild);
      }
      quitarHijos(tcPr, (n) => n.nodeType === 1 && (n as Element).nodeName === 'w:shd');
      if (!fill) {
        continue;
      }
      const shd = doc.createElementNS(NS_W, 'w:shd');
      shd.setAttribute('w:val', 'clear');
      shd.setAttribute('w:color', 'auto');
      shd.setAttribute('w:fill', fill);
      const ref = elementos(tcPr).find((e) => despuesDeShd.includes(e.nodeName));
      tcPr.insertBefore(shd, ref ?? null);
    }
  }

  function fusionarMapeo(h: Element, sec: SeccionAplicar): void {
    const { nodos, fin } = rangoSeccion(h);
    const tbl = nodos.find((e) => e.nodeName === 'w:tbl');
    if (!tbl) {
      insertarAntes(importar(sec.xml), fin);
      return;
    }
    for (const m of input.mapeoNombres ?? []) {
      const clave = normalizar(m.nombreEnCodigo);
      const tipos = aliasTipoObjeto(m.tipoObjeto);
      const filas = elementos(tbl).filter((e) => e.nodeName === 'w:tr');
      const valores = filasMapeo([m], t)[0];
      let tr = filas.slice(1).find((fila) => {
        const tcs = elementos(fila).filter((e) => e.nodeName === 'w:tc');
        return tcs.length >= 3 && normalizar(textoConSaltos(tcs[0])) === clave && tipos.includes(normalizar(textoConSaltos(tcs[2])));
      });
      if (!tr) {
        tr = clonarFilaBase(tbl, valores.length);
        const ultima = filas[filas.length - 1];
        if (ultima) {
          tbl.insertBefore(tr, ultima.nextSibling);
        } else {
          tbl.appendChild(tr);
        }
      }
      elementos(tr)
        .filter((e) => e.nodeName === 'w:tc')
        .forEach((tc, i) => ponerTextoCelda(tc, valores[i] ?? ''));
      ponerSombreadoFila(tr, colorEstado(m.estado));
    }
  }

  function fusionarEjemplos(h: Element): void {
    const alternativas = etiquetasTipoEjemplo()
      .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const reTitulo = new RegExp(`^(.*)\\s\\((?:${alternativas})\\)$`);
    const tituloDe = (n: Node): string | undefined => {
      if (n.nodeType !== 1 || (n as Element).nodeName !== 'w:p') {
        return undefined;
      }
      const p = n as Element;
      if (nivelDe(p) !== undefined) {
        return undefined;
      }
      const ppr = hijo(p, 'w:pPr');
      if (ppr && hijo(ppr, 'w:shd')) {
        return undefined;
      }
      if (p.getElementsByTagName('w:b').length === 0) {
        return undefined;
      }
      const m = reTitulo.exec(textoDe(p).trim());
      return m ? m[1] : undefined;
    };

    for (const e of input.ejemplos ?? []) {
      const { fin } = rangoSeccion(h);
      // Nodos de la sección (incluidos los de texto intermedios) hasta el límite.
      const todos: Node[] = [];
      for (let n = h.nextSibling; n && n !== fin; n = n.nextSibling) {
        todos.push(n);
      }
      const clave = normalizar(e.titulo);
      let inicio = -1;
      let final = todos.length;
      for (let i = 0; i < todos.length; i++) {
        const titulo = tituloDe(todos[i]);
        if (titulo === undefined) {
          continue;
        }
        if (inicio >= 0) {
          final = i;
          break;
        }
        if (normalizar(titulo) === clave) {
          inicio = i;
        }
      }
      const nodos = importar(xmlEjemplo(e, t, estiloCuerpo, resaltadoSql(input.formatoVisual)?.word));
      if (inicio < 0) {
        insertarAntes(nodos, fin);
        continue;
      }
      const grupo = todos.slice(inicio, final);
      insertarAntes(nodos, grupo[0]);
      for (const n of grupo) {
        (body as Element).removeChild(n);
      }
    }
  }

  function anexarCambio(h: Element, sec: SeccionAplicar): void {
    const nivel = nivelDe(h) as number;
    const estiloMarca = estiloEncabezado(Math.min(nivel + 1, 9));
    const marca = t.marcaCambio(formatoFecha(ctx.fecha), input.titulo.replace(/\s*\r?\n\s*/g, ' '));
    const { nodos, fin } = rangoSeccion(h);
    const claveMarca = normalizar(marca);
    const existenteMarca = nodos.find((el) => el.nodeName === 'w:p' && normalizar(textoDe(el)) === claveMarca);
    if (!existenteMarca) {
      insertarAntes(importar(encabezado(marca, estiloMarca) + sec.xml), fin);
      return;
    }
    for (let n = existenteMarca.nextSibling; n && n !== fin; ) {
      const sig = n.nextSibling;
      if (n.nodeType === 1) {
        const el = n as Element;
        if (nivelDe(el) !== undefined || (el.nodeName === 'w:p' && pStyleDe(el) === estiloMarca)) {
          break;
        }
      }
      (body as Element).removeChild(n);
      n = sig;
    }
    insertarAntes(importar(sec.xml), existenteMarca.nextSibling);
  }
}
