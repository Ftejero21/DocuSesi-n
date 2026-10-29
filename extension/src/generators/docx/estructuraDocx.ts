import { type Element } from '@xmldom/xmldom';
import {
  cargarDocx,
  colapsar,
  elementos,
  esParrafoCodigo,
  esSeccionDocuSesion,
  hijo,
  nivelBase,
  textoConSaltos,
  textoDe,
  tipoElemento
} from './modeloDocx';

export interface EstructuraDocx {
  encabezados: { texto: string; nivel: number; styleId?: string }[];
  nivelBase: number;
  bloques: { titulo: string; patron: string[] }[];
  patronDominante?: { patron: string[]; bloques: number; total: number };
  muestra?: { titulo: string; lineas: string[] };
  estilos: { nivel: number; styleId: string }[];
  formatoCodigo?: { fuente?: string; sombreado?: string; styleId?: string };
  seccionesDocuSesion: string[];
}

export const MAX_LINEA_MUESTRA = 2000;
export const MAX_MUESTRA = 8000;
export const MAX_ENCABEZADOS_LISTADOS = 200;
const MAX_BLOQUES_LISTADOS = 50;

function colapsarRepetidos(tipos: string[]): string[] {
  const res: string[] = [];
  for (const t of tipos) {
    if (res[res.length - 1] !== t) {
      res.push(t);
    }
  }
  return res;
}

function recortar(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function leerEstructuraDocx(buffer: Buffer): EstructuraDocx {
  const { body, nivelDe, pStyleDe, estiloEncabezado } = cargarDocx(buffer);
  const nb = nivelBase(body, nivelDe);
  const hijos = elementos(body);

  const encabezados = hijos
    .filter((el) => nivelDe(el) !== undefined)
    .map((el) => ({ texto: colapsar(textoDe(el)), nivel: nivelDe(el) as number, styleId: pStyleDe(el) }));

  // Bloques de primer nivel: cada encabezado de nivel base que no sea una sección de DocuSesión.
  interface Bloque {
    cabecera: Element;
    elementos: Element[];
  }
  const bloquesRaw: Bloque[] = [];
  let actual: Bloque | undefined;
  for (const el of hijos) {
    const n = nivelDe(el);
    if (n !== undefined && n <= nb) {
      if (esSeccionDocuSesion(textoDe(el))) {
        actual = undefined;
      } else {
        actual = { cabecera: el, elementos: [] };
        bloquesRaw.push(actual);
      }
      continue;
    }
    if (el.nodeName === 'w:sectPr') {
      actual = undefined;
      continue;
    }
    if (actual) {
      actual.elementos.push(el);
    }
  }
  const bloques = bloquesRaw.map((b) => ({
    titulo: colapsar(textoDe(b.cabecera)),
    patron: colapsarRepetidos(
      b.elementos.map((el) => tipoElemento(el, nivelDe, pStyleDe)).filter((t): t is string => t !== undefined)
    )
  }));

  // Patrón dominante: el más frecuente; en empate, el del bloque más reciente.
  let patronDominante: EstructuraDocx['patronDominante'];
  if (bloques.length > 0) {
    const cuenta = new Map<string, number>();
    for (const b of bloques) {
      const k = b.patron.join('\u0000');
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    }
    let mejor = bloques[bloques.length - 1];
    let mejorN = cuenta.get(mejor.patron.join('\u0000')) ?? 0;
    for (let i = bloques.length - 1; i >= 0; i--) {
      const n = cuenta.get(bloques[i].patron.join('\u0000')) ?? 0;
      if (n > mejorN) {
        mejor = bloques[i];
        mejorN = n;
      }
    }
    patronDominante = { patron: mejor.patron, bloques: mejorN, total: bloques.length };
  }

  // Muestra: último bloque completo con marcas de tipo.
  let muestra: EstructuraDocx['muestra'];
  const ultimo = bloquesRaw[bloquesRaw.length - 1];
  if (ultimo) {
    const lineas: string[] = [];
    let total = 0;
    const añadir = (linea: string): boolean => {
      const l = recortar(linea, MAX_LINEA_MUESTRA);
      if (total + l.length > MAX_MUESTRA) {
        lineas.push('[... sample truncated]');
        return false;
      }
      lineas.push(l);
      total += l.length;
      return true;
    };
    const cab = ultimo.cabecera;
    let seguir = añadir(`[heading level ${nivelDe(cab)} | style ${pStyleDe(cab) ?? ''}] ${colapsar(textoDe(cab))}`);
    for (const el of ultimo.elementos) {
      if (!seguir) {
        break;
      }
      const tipo = tipoElemento(el, nivelDe, pStyleDe);
      if (tipo === undefined) {
        continue;
      }
      let linea: string;
      if (tipo.startsWith('H')) {
        linea = `[heading level ${nivelDe(el)} | style ${pStyleDe(el) ?? ''}] ${colapsar(textoDe(el))}`;
      } else if (tipo === 'codigo') {
        linea = `[code] ${textoConSaltos(el)}`;
      } else if (tipo === 'lista') {
        linea = `[list] ${colapsar(textoConSaltos(el))}`;
      } else if (tipo === 'tabla') {
        const filas = elementos(el).filter((e) => e.nodeName === 'w:tr');
        const celdas = filas[0] ? elementos(filas[0]).filter((e) => e.nodeName === 'w:tc') : [];
        linea = `[table ${filas.length}x${celdas.length}] ${celdas.map((c) => colapsar(textoConSaltos(c))).join(' | ')}`;
      } else if (tipo === 'titulo') {
        linea = `[title] ${colapsar(textoDe(el))}`;
      } else {
        linea = `[paragraph] ${colapsar(textoConSaltos(el))}`;
      }
      seguir = añadir(linea);
    }
    muestra = { titulo: colapsar(textoDe(cab)), lineas };
  }

  // Estilos que usará "anexar": el del último encabezado de cada nivel, o el estilo de encabezado por defecto.
  const ns = Math.min(nb + 1, 9);
  const estilos = [nb, ns]
    .filter((n, i, a) => a.indexOf(n) === i)
    .map((n) => {
      let el: Element | undefined;
      for (let i = hijos.length - 1; i >= 0; i--) {
        if (nivelDe(hijos[i]) === n) {
          el = hijos[i];
          break;
        }
      }
      return { nivel: n, styleId: (el ? pStyleDe(el) : undefined) ?? estiloEncabezado(n) };
    });

  // Formato de código: el del último párrafo de código.
  let formatoCodigo: EstructuraDocx['formatoCodigo'];
  for (let i = hijos.length - 1; i >= 0; i--) {
    const el = hijos[i];
    if (!esParrafoCodigo(el, nivelDe, pStyleDe)) {
      continue;
    }
    const ppr = hijo(el, 'w:pPr');
    const shd = ppr ? hijo(ppr, 'w:shd') : undefined;
    let fuente: string | undefined;
    const rs = el.getElementsByTagName('w:r');
    for (let j = 0; j < rs.length && !fuente; j++) {
      const rpr = hijo(rs[j] as Element, 'w:rPr');
      const rf = rpr ? hijo(rpr, 'w:rFonts') : undefined;
      fuente = rf?.getAttribute('w:ascii') || rf?.getAttribute('w:hAnsi') || undefined;
    }
    formatoCodigo = { fuente, sombreado: shd?.getAttribute('w:fill') || undefined, styleId: pStyleDe(el) };
    break;
  }

  const seccionesDocuSesion = [...new Set(encabezados.filter((e) => esSeccionDocuSesion(e.texto)).map((e) => e.texto))];

  return { encabezados, nivelBase: nb, bloques, patronDominante, muestra, estilos, formatoCodigo, seccionesDocuSesion };
}

const NOMBRE_TIPO: Record<string, string> = {
  codigo: 'code',
  parrafo: 'paragraph',
  lista: 'list',
  tabla: 'table',
  titulo: 'title'
};

function patronLegible(patron: string[]): string {
  return patron.length === 0 ? '(empty)' : patron.map((t) => NOMBRE_TIPO[t] ?? t).join(', ');
}

/** Texto en inglés para el modelo. */
export function formatearEstructuraDocx(e: EstructuraDocx): string {
  const out: string[] = [];
  const hs = e.encabezados.slice(0, MAX_ENCABEZADOS_LISTADOS);
  out.push(`Headings (${e.encabezados.length}):`);
  if (e.encabezados.length === 0) {
    out.push('  (none: the document has no headings; "anexar" will use default heading styles)');
  }
  for (const h of hs) {
    out.push(`  - [H${h.nivel} | style ${h.styleId ?? '(none)'}] ${recortar(h.texto, MAX_LINEA_MUESTRA)}`);
  }
  if (e.encabezados.length > hs.length) {
    out.push(`  ... and ${e.encabezados.length - hs.length} more`);
  }

  const nb = e.nivelBase;
  const ns = Math.min(nb + 1, 9);
  out.push(`Base level of top-level blocks: H${nb}`);
  out.push(`Top-level blocks (${e.bloques.length}), pattern of elements under each heading:`);
  if (e.bloques.length === 0) {
    out.push('  (none: no block pattern can be derived)');
  }
  const bs = e.bloques.slice(-MAX_BLOQUES_LISTADOS);
  if (e.bloques.length > bs.length) {
    out.push(`  ... and ${e.bloques.length - bs.length} earlier blocks`);
  }
  for (const b of bs) {
    out.push(`  - "${recortar(b.titulo, 200)}": ${patronLegible(b.patron)}`);
  }
  if (e.patronDominante) {
    out.push(`Dominant pattern: "${patronLegible(e.patronDominante.patron)}" (${e.patronDominante.bloques} of ${e.patronDominante.total} blocks)`);
  }

  if (e.muestra) {
    out.push(`Sample (last top-level block, "${recortar(e.muestra.titulo, 200)}"):`);
    for (const l of e.muestra.lineas) {
      out.push(l);
    }
  }

  out.push(`Styles "anexar" will use: ${e.estilos.map((s) => `H${s.nivel} -> ${s.styleId}`).join('; ')}`);
  if (e.formatoCodigo) {
    const f = e.formatoCodigo;
    out.push(
      `Code format detected: font ${f.fuente ?? '(not set)'}, shading ${f.sombreado ?? '(none)'}, paragraph style ${f.styleId ?? '(none)'}`
    );
  } else {
    out.push('Code format detected: none (the default DocuSesión code format will be used)');
  }
  if (e.seccionesDocuSesion.length > 0) {
    out.push(`DocuSesión sections present: ${e.seccionesDocuSesion.join('; ')}; "anexar" never modifies them, the new block goes at the very end.`);
  }

  out.push(
    `To add new documentation use docusesion_documentar with modo "anexar", titulo = the new feature name, and secciones reproducing this pattern: ` +
      `elements before the first H${ns} -> a section with encabezado ""; each H${ns} -> a section with that encabezado; ` +
      'each code element -> a fenced block (```) in contenido; each paragraph -> plain text.'
  );
  out.push(
    'If a top-level block with the same title as the new feature already exists, do NOT skip it nor decide on your own: ' +
      'still invoke docusesion_documentar ONCE with modo "anexar" and that titulo; the extension will ask the user whether to replace that block, use another title or cancel.'
  );
  return out.join('\n');
}
