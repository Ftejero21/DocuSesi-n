import { DOMParser, type Document, type Element, type Node } from '@xmldom/xmldom';
import PizZip from 'pizzip';
import { aliasNormalizados, ClaveSeccionFija } from '../../core/i18n';
import { normalizar } from '../../core/texto';
import { analizarEstilos, estiloMismaFamilia, InfoEstilos } from './estilos';
import { fragmento } from './xml';

export function elementos(padre: Node): Element[] {
  const res: Element[] = [];
  for (let n = padre.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1) {
      res.push(n as Element);
    }
  }
  return res;
}

export function hijo(el: Element, nombre: string): Element | undefined {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).nodeName === nombre) {
      return n as Element;
    }
  }
  return undefined;
}

export function textoDe(el: Element): string {
  const ts = el.getElementsByTagName('w:t');
  let s = '';
  for (let i = 0; i < ts.length; i++) {
    s += ts[i].textContent ?? '';
  }
  return s;
}

/** Texto de un elemento con los saltos (w:br) y tabuladores (w:tab) en su sitio. */
export function textoConSaltos(el: Node): string {
  let res = '';
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) {
      continue;
    }
    const nombre = (n as Element).nodeName;
    if (nombre === 'w:t') {
      res += n.textContent ?? '';
    } else if (nombre === 'w:br') {
      res += '\n';
    } else if (nombre === 'w:tab') {
      res += '\t';
    } else {
      res += textoConSaltos(n);
    }
  }
  return res;
}

export function colapsar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

export interface DocxCargado {
  zip: PizZip;
  doc: Document;
  body: Element;
  info: InfoEstilos;
  estiloCuerpo: string | undefined;
  pStyleDe: (el: Element) => string | undefined;
  nivelDe: (el: Element) => number | undefined;
  estiloEncabezado: (nivel: number) => string;
  sectPr: () => Element | undefined;
  importar: (xml: string) => Node[];
}

/** Carga un docx: zip, document.xml, estilos de encabezado y utilidades de navegación del body. */
export function cargarDocx(buffer: Buffer): DocxCargado {
  const zip = new PizZip(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('El archivo no es un .docx válido (falta word/document.xml).');
  }
  const stylesFile = zip.file('word/styles.xml');
  const info = analizarEstilos(stylesFile ? stylesFile.asText() : '');

  const doc: Document = new DOMParser().parseFromString(docFile.asText(), 'text/xml');
  const body = doc.getElementsByTagName('w:body')[0] as Element | undefined;
  if (!body) {
    throw new Error('El archivo no es un .docx válido (falta w:body).');
  }

  const pStyleDe = (el: Element): string | undefined => {
    const ppr = hijo(el, 'w:pPr');
    const ps = ppr ? hijo(ppr, 'w:pStyle') : undefined;
    return ps?.getAttribute('w:val') ?? undefined;
  };
  const nivelDe = (el: Element): number | undefined => {
    if (el.nodeName !== 'w:p') {
      return undefined;
    }
    const s = pStyleDe(el);
    return s ? info.nivelPorStyleId.get(s) : undefined;
  };

  // Estilo de encabezado por nivel: el primero que aparece en el documento; si no, el de styles.xml; si no, HeadingN.
  const estiloUsado = new Map<number, string>();
  const usosEstilo = new Map<string, number>();
  let estiloCuerpo: string | undefined;
  {
    let vistoEncabezado = false;
    let cuerpoFijado = false;
    for (const el of elementos(body)) {
      const n = nivelDe(el);
      if (n !== undefined) {
        vistoEncabezado = true;
        const s = pStyleDe(el);
        if (s && !estiloUsado.has(n)) {
          estiloUsado.set(n, s);
        }
        if (s) {
          usosEstilo.set(s, (usosEstilo.get(s) ?? 0) + 1);
        }
      } else if (vistoEncabezado && !cuerpoFijado && el.nodeName === 'w:p') {
        estiloCuerpo = pStyleDe(el);
        cuerpoFijado = true;
      }
    }
  }
  // Estilos de encabezado usados, del más al menos frecuente (en empate, el primero que aparece).
  const estilosPorUso = [...usosEstilo.keys()]
    .map((id, i) => ({ id, i, n: usosEstilo.get(id) ?? 0 }))
    .sort((x, y) => y.n - x.n || x.i - y.i)
    .map((x) => x.id);
  const estiloEncabezado = (nivel: number): string => {
    for (const ref of estilosPorUso) {
      const familia = estiloMismaFamilia(info, ref, nivel);
      if (familia) {
        return familia;
      }
    }
    const usado = estiloUsado.get(nivel);
    if (usado) {
      return usado;
    }
    for (const [id, n] of info.nivelPorStyleId) {
      if (n === nivel) {
        return id;
      }
    }
    return nivel === 1 ? info.idHeading1 ?? 'Heading1' : nivel === 2 ? info.idHeading2 ?? 'Heading2' : `Heading${nivel}`;
  };

  const importar = (xml: string): Node[] => fragmento(xml).map((n) => doc.importNode(n as unknown as Node, true));
  const sectPr = (): Element | undefined => hijo(body, 'w:sectPr');

  return { zip, doc, body, info, estiloCuerpo, pStyleDe, nivelDe, estiloEncabezado, sectPr, importar };
}

type NivelDe = (el: Element) => number | undefined;
type PStyleDe = (el: Element) => string | undefined;

const RE_TITULO_DOC = /^(title|titulo|ttulo|subtitle|subtitulo|subttulo)$/i;
const RE_ESTILO_CODIGO = /code|codigo|cdigo|preformat|plaintext|htmlpre|verbatim|sourcecode/i;
const FUENTES_MONO = new Set([
  'consolas',
  'courier new',
  'courier',
  'lucida console',
  'menlo',
  'monaco',
  'cascadia code',
  'cascadia mono',
  'source code pro',
  'fira code',
  'jetbrains mono',
  'dejavu sans mono',
  'liberation mono'
]);

export function esTituloDoc(el: Element, pStyleDe: PStyleDe): boolean {
  const s = pStyleDe(el);
  return !!s && RE_TITULO_DOC.test(s);
}

function runsConTexto(p: Element): Element[] {
  const res: Element[] = [];
  const rs = p.getElementsByTagName('w:r');
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i] as Element;
    const ts = r.getElementsByTagName('w:t');
    let texto = '';
    for (let j = 0; j < ts.length; j++) {
      texto += ts[j].textContent ?? '';
    }
    if (texto !== '') {
      res.push(r);
    }
  }
  return res;
}

export function esParrafoCodigo(el: Element, nivelDe: NivelDe, pStyleDe: PStyleDe): boolean {
  if (el.nodeName !== 'w:p' || nivelDe(el) !== undefined) {
    return false;
  }
  const ppr = hijo(el, 'w:pPr');
  const shd = ppr ? hijo(ppr, 'w:shd') : undefined;
  if (shd) {
    const fill = (shd.getAttribute('w:fill') ?? '').trim().toUpperCase();
    if (fill !== '' && fill !== 'AUTO' && fill !== 'FFFFFF') {
      return true;
    }
  }
  const runs = runsConTexto(el);
  if (runs.length > 0) {
    const todosMono = runs.every((r) => {
      const rpr = hijo(r, 'w:rPr');
      const fuentes = rpr ? hijo(rpr, 'w:rFonts') : undefined;
      if (!fuentes) {
        return false;
      }
      return ['w:ascii', 'w:hAnsi'].some((a) => FUENTES_MONO.has((fuentes.getAttribute(a) ?? '').trim().toLowerCase()));
    });
    if (todosMono) {
      return true;
    }
  }
  const estilo = pStyleDe(el);
  return !!estilo && RE_ESTILO_CODIGO.test(estilo);
}

/** Tipo de un elemento del body: H{n}, tabla, titulo, codigo, lista, parrafo; undefined si es vacío u otro elemento. */
export function tipoElemento(el: Element, nivelDe: NivelDe, pStyleDe: PStyleDe): string | undefined {
  const nivel = nivelDe(el);
  if (nivel !== undefined) {
    return `H${nivel}`;
  }
  if (el.nodeName === 'w:tbl') {
    return 'tabla';
  }
  if (el.nodeName !== 'w:p') {
    return undefined;
  }
  if (esTituloDoc(el, pStyleDe)) {
    return 'titulo';
  }
  if (esParrafoCodigo(el, nivelDe, pStyleDe)) {
    return 'codigo';
  }
  const ppr = hijo(el, 'w:pPr');
  if ((ppr && hijo(ppr, 'w:numPr')) || textoDe(el).startsWith('• ')) {
    return 'lista';
  }
  if (textoDe(el).trim() !== '') {
    return 'parrafo';
  }
  return undefined;
}

function quitarHijosPorNombre(el: Element, nombres: string[]): void {
  for (const n of elementos(el)) {
    if (nombres.includes(n.nodeName)) {
      el.removeChild(n);
    }
  }
}

/** Clon limpio del pPr del elemento y del rPr de su primer run con texto. */
export function modeloFormato(el: Element, opciones: { quitarNumPr?: boolean } = {}): { pPr?: Element; rPr?: Element } {
  const res: { pPr?: Element; rPr?: Element } = {};
  const ppr = hijo(el, 'w:pPr');
  if (ppr) {
    const clon = ppr.cloneNode(true) as Element;
    quitarHijosPorNombre(clon, opciones.quitarNumPr ? ['w:sectPr', 'w:pPrChange', 'w:numPr'] : ['w:sectPr', 'w:pPrChange']);
    res.pPr = clon;
  }
  const run = runsConTexto(el)[0];
  const rpr = run ? hijo(run, 'w:rPr') : undefined;
  if (rpr) {
    const clon = rpr.cloneNode(true) as Element;
    quitarHijosPorNombre(clon, ['w:rPrChange']);
    res.rPr = clon;
  }
  return res;
}

/** Mínimo nivel de encabezado presente en el body (1 si no hay encabezados). */
export function nivelBase(body: Element, nivelDe: NivelDe): number {
  let min: number | undefined;
  for (const el of elementos(body)) {
    const n = nivelDe(el);
    if (n !== undefined && (min === undefined || n < min)) {
      min = n;
    }
  }
  return min ?? 1;
}

const CLAVES_DOCUSESION: ClaveSeccionFija[] = ['historial', 'correspondencia', 'archivosAfectados', 'archivosConsultados', 'avisos'];

/** true si el texto es el encabezado de una sección propia de DocuSesión (historial, correspondencia, archivos, avisos). */
export function esSeccionDocuSesion(texto: string): boolean {
  const n = normalizar(texto);
  return CLAVES_DOCUSESION.some((c) => aliasNormalizados(c).includes(n));
}
