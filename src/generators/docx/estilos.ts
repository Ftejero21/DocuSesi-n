import { DOMParser, type Element } from '@xmldom/xmldom';
import { normalizar } from '../../core/texto';

export interface InfoEstilos {
  nivelPorStyleId: Map<string, number>;
  /** Nombre normalizado de cada estilo de encabezado (por styleId). */
  nombrePorStyleId: Map<string, string>;
  idHeading1?: string;
  idHeading2?: string;
  idTablaRejilla?: string;
}

function hijoDirecto(el: Element, nombre: string): Element | undefined {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).nodeName === nombre) {
      return n as Element;
    }
  }
  return undefined;
}

/** Analiza styles.xml: nivel de cada estilo de encabezado y estilo de tabla con rejilla. */
export function analizarEstilos(stylesXml: string): InfoEstilos {
  const info: InfoEstilos = { nivelPorStyleId: new Map(), nombrePorStyleId: new Map() };
  if (!stylesXml) {
    return info;
  }
  const doc = new DOMParser().parseFromString(stylesXml, 'text/xml');
  const estilos = doc.getElementsByTagName('w:style');
  const explicitos = new Map<number, string>();
  const porOutline = new Map<number, string>();

  for (let i = 0; i < estilos.length; i++) {
    const st = estilos[i];
    const id = st.getAttribute('w:styleId');
    if (!id) {
      continue;
    }
    const tipo = st.getAttribute('w:type');
    const nombre = normalizar(hijoDirecto(st, 'w:name')?.getAttribute('w:val') ?? '');

    if (tipo === 'table' || tipo === null) {
      if (/^(tablegrid|tablaconcuadrcula|tablaconcuadricula)$/i.test(id) || /table grid|tabla con cuadricula/.test(nombre)) {
        info.idTablaRejilla = info.idTablaRejilla ?? id;
      }
    }
    if (tipo !== 'paragraph' && tipo !== null) {
      continue;
    }

    let nivel: number | undefined;
    let explicito = false;
    const mId = /^(heading|ttulo|titulo)([1-9])$/i.exec(id);
    const mNombre = /^(heading|titulo) ([1-9])$/.exec(nombre);
    if (mId) {
      nivel = Number(mId[2]);
      explicito = true;
    } else if (mNombre) {
      nivel = Number(mNombre[2]);
      explicito = true;
    } else {
      const ppr = hijoDirecto(st, 'w:pPr');
      const outline = ppr ? hijoDirecto(ppr, 'w:outlineLvl') : undefined;
      const val = outline?.getAttribute('w:val');
      if (val !== null && val !== undefined && /^\d+$/.test(val) && Number(val) < 9) {
        nivel = Number(val) + 1;
      }
    }
    if (nivel === undefined) {
      continue;
    }
    info.nivelPorStyleId.set(id, nivel);
    info.nombrePorStyleId.set(id, nombre);
    const destino = explicito ? explicitos : porOutline;
    if (!destino.has(nivel)) {
      destino.set(nivel, id);
    }
  }
  info.idHeading1 = explicitos.get(1) ?? porOutline.get(1);
  info.idHeading2 = explicitos.get(2) ?? porOutline.get(2);
  return info;
}

/**
 * Estilo de nivel `nivel` de la misma familia que `idReferencia` (Ttulo1 -> Ttulo2 por id; "Título 1" -> "Título 2" por nombre).
 * Devuelve undefined si la familia no tiene ese nivel.
 */
export function estiloMismaFamilia(info: InfoEstilos, idReferencia: string, nivel: number): string | undefined {
  const mId = /^(.*?)([1-9])$/.exec(idReferencia);
  if (mId) {
    const objetivo = (mId[1] + nivel).toLowerCase();
    for (const [id, n] of info.nivelPorStyleId) {
      if (n === nivel && id.toLowerCase() === objetivo) {
        return id;
      }
    }
  }
  const nombre = info.nombrePorStyleId.get(idReferencia);
  const mNombre = nombre ? /^(.*?)\s*([1-9])$/.exec(nombre) : null;
  if (mNombre) {
    const objetivo = (mNombre[1] + nivel).replace(/\s+/g, '');
    for (const [id, n] of info.nivelPorStyleId) {
      if (n === nivel && (info.nombrePorStyleId.get(id) ?? '').replace(/\s+/g, '') === objetivo) {
        return id;
      }
    }
  }
  return undefined;
}
