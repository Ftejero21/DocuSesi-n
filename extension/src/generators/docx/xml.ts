import { DOMParser, type Node } from '@xmldom/xmldom';
import { COLOR_CODIGO, COLOR_ENTORNO, COLOR_PENDIENTE, MAX_LINEAS_DIFF_DOC } from '../../core/constantes';
import { ClaveSeccionFija, Etiquetas } from '../../core/i18n';
import { escaparXml, esBloqueSql, formatoFecha, limpiarControl, truncarLineas } from '../../core/texto';
import { ContextoGeneracion, DocuInput, Ejemplo, EstadoMapeo, MapeoNombre } from '../../core/tipos';

export const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function run(texto: string, rPr = ''): string {
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r>`;
}

function runsConSaltos(texto: string, rPr = ''): string {
  return limpiarControl(texto)
    .split(/\r?\n/)
    .map((l, i) => (i > 0 ? '<w:r><w:br/></w:r>' : '') + run(l, rPr))
    .join('');
}

function pPr(pStyle?: string, extra = ''): string {
  const estilo = pStyle ? `<w:pStyle w:val="${escaparXml(pStyle)}"/>` : '';
  return estilo || extra ? `<w:pPr>${estilo}${extra}</w:pPr>` : '';
}

export function parrafo(texto: string, pStyle?: string): string {
  return `<w:p>${pPr(pStyle)}${runsConSaltos(texto)}</w:p>`;
}

export function parrafoNegrita(texto: string, pStyle?: string): string {
  return `<w:p>${pPr(pStyle)}${runsConSaltos(texto, '<w:b/>')}</w:p>`;
}

/** `resaltado`: valor de w:highlight ya validado contra la tabla cerrada de colores (formatoVisual.ts). */
export function parrafoCodigo(texto: string, resaltado?: string): string {
  const rPr =
    '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas" w:eastAsia="Consolas"/><w:sz w:val="18"/><w:szCs w:val="18"/>' +
    (resaltado ? `<w:highlight w:val="${escaparXml(resaltado)}"/>` : '');
  const lineas = limpiarControl(texto).replace(/\t/g, '    ').split(/\r?\n/);
  const runs = lineas.map((l, i) => (i > 0 ? `<w:r><w:rPr>${rPr}</w:rPr><w:br/></w:r>` : '') + run(l, rPr)).join('');
  return `<w:p>${pPr(undefined, `<w:shd w:val="clear" w:color="auto" w:fill="${COLOR_CODIGO}"/>`)}${runs}</w:p>`;
}

export function encabezado(texto: string, styleId: string): string {
  return parrafo(texto, styleId);
}

export interface OpcionesTabla {
  colorPorFila?: (string | undefined)[];
  tblStyle?: string;
}

function celda(texto: string, ancho: number, negrita: boolean, fill?: string): string {
  const shd = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '';
  const runs = runsConSaltos(texto, negrita ? '<w:b/>' : '');
  return `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${shd}</w:tcPr><w:p>${runs}</w:p></w:tc>`;
}

/** Tabla WordprocessingML seguida de un párrafo vacío (separación). */
export function tabla(cabeceras: string[], filas: string[][], opciones: OpcionesTabla = {}): string {
  const n = cabeceras.length;
  const ancho = Math.floor(9000 / n);
  const borde = (lado: string) => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`;
  const bordes = opciones.tblStyle
    ? ''
    : `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borde).join('')}</w:tblBorders>`;
  const estilo = opciones.tblStyle ? `<w:tblStyle w:val="${escaparXml(opciones.tblStyle)}"/>` : '';
  const grid = Array.from({ length: n }, () => `<w:gridCol w:w="${ancho}"/>`).join('');
  const cab = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${cabeceras.map((c) => celda(c, ancho, true)).join('')}</w:tr>`;
  const cuerpo = filas
    .map((fila, i) => {
      const fill = opciones.colorPorFila?.[i];
      return `<w:tr>${fila.map((c) => celda(c, ancho, false, fill)).join('')}</w:tr>`;
    })
    .join('');
  return (
    `<w:tbl><w:tblPr>${estilo}<w:tblW w:w="5000" w:type="pct"/>${bordes}</w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${cab}${cuerpo}</w:tbl><w:p/>`
  );
}

export interface SegmentoContenido {
  tipo: 'parrafo' | 'codigo';
  texto: string;
  lenguaje?: string;
}

/** Texto libre -> segmentos. ``` abre/cierra bloques de código; "- " y "* " se convierten en viñetas "• ". */
export function segmentarContenido(contenido: string): SegmentoContenido[] {
  const salida: SegmentoContenido[] = [];
  let enCodigo = false;
  let lenguaje = '';
  let bloque: string[] = [];
  for (const linea of limpiarControl(contenido).split(/\r?\n/)) {
    const valla = /^\s*```\s*([\w+#.-]*)/.exec(linea);
    if (valla) {
      if (enCodigo) {
        salida.push({ tipo: 'codigo', texto: bloque.join('\n'), lenguaje: lenguaje || undefined });
        bloque = [];
      } else {
        lenguaje = valla[1] ?? '';
      }
      enCodigo = !enCodigo;
      continue;
    }
    if (enCodigo) {
      bloque.push(linea);
      continue;
    }
    if (linea.trim() === '') {
      continue;
    }
    const m = /^\s*[-*]\s+(.*)$/.exec(linea);
    salida.push({ tipo: 'parrafo', texto: m ? `• ${m[1]}` : linea.trim() });
  }
  if (enCodigo && bloque.length > 0) {
    salida.push({ tipo: 'codigo', texto: bloque.join('\n'), lenguaje: lenguaje || undefined });
  }
  return salida;
}

/** Texto libre -> párrafos. ``` abre/cierra bloques de código; "- " y "* " se convierten en viñetas "• ". */
export function contenidoAParrafos(contenido: string, pStyle?: string, resaltado?: string): string {
  return segmentarContenido(contenido)
    .map((s) => (s.tipo === 'codigo'
        ? parrafoCodigo(s.texto, resaltado && esBloqueSql(s.texto, s.lenguaje) ? resaltado : undefined)
        : parrafo(s.texto, pStyle)))
    .join('');
}

/** Parsea fragmentos WordprocessingML y devuelve los nodos importables. */
export function fragmento(xml: string): Node[] {
  const doc = new DOMParser().parseFromString(`<w:root xmlns:w="${NS_W}">${xml}</w:root>`, 'text/xml');
  const nodos: Node[] = [];
  const hijos = doc.documentElement?.childNodes;
  if (!hijos) {
    return nodos;
  }
  for (let i = 0; i < hijos.length; i++) {
    nodos.push(hijos[i]);
  }
  return nodos;
}

export function colorEstado(estado: EstadoMapeo): string | undefined {
  if (estado === 'pendiente_de_verificar') {
    return COLOR_PENDIENTE;
  }
  if (estado === 'depende_de_entorno') {
    return COLOR_ENTORNO;
  }
  return undefined;
}

export function filasMapeo(mapeo: MapeoNombre[], t: Etiquetas): string[][] {
  return mapeo.map((m) => [
    m.nombreEnCodigo,
    m.nombreReal,
    t.tipoObjeto[m.tipoObjeto] ?? m.tipoObjeto,
    m.origen,
    t.estado[m.estado] ?? m.estado,
    m.notas ?? ''
  ]);
}

export interface BloqueFijo {
  clave: ClaveSeccionFija;
  encabezado: string;
  xml: string;
  /** Solo se aplica si ya existe el encabezado en el documento. */
  soloSiExiste?: boolean;
}

export interface OpcionesBloques {
  estiloCuerpo?: string;
  tblStyle?: string;
  /** Valor de w:highlight para los ejemplos SQL. */
  resaltadoSql?: string;
}

/** XML de un ejemplo: título en negrita con su tipo, explicación opcional y código. */
export function xmlEjemplo(e: Ejemplo, t: Etiquetas, estiloCuerpo?: string, resaltado?: string): string {
  const titulo = `${e.titulo} (${t.tipoEjemplo[e.tipo] ?? e.tipo})`;
  return parrafoNegrita(titulo, estiloCuerpo) + (e.explicacion ? parrafo(e.explicacion, estiloCuerpo) : '') + parrafoCodigo(e.contenido, e.tipo === 'sql' ? resaltado : undefined);
}

/** Bloques de las secciones fijas (Ejemplos, Correspondencia, Archivos, Avisos). Compartido por "actualizar" y "plantilla". */
export function bloquesFijos(
  input: DocuInput,
  ctx: ContextoGeneracion,
  t: Etiquetas,
  opciones: OpcionesBloques = {}
): BloqueFijo[] {
  const bloques: BloqueFijo[] = [];
  const cuerpo = opciones.estiloCuerpo;

  if (input.ejemplos && input.ejemplos.length > 0) {
    const xml = input.ejemplos.map((e) => xmlEjemplo(e, t, cuerpo, opciones.resaltadoSql)).join('');
    bloques.push({ clave: 'ejemplos', encabezado: t.ejemplos, xml });
  }

  if (input.mapeoNombres && input.mapeoNombres.length > 0) {
    const xml = tabla([...t.cabMapeo], filasMapeo(input.mapeoNombres, t), {
      colorPorFila: input.mapeoNombres.map((m) => colorEstado(m.estado)),
      tblStyle: opciones.tblStyle
    });
    bloques.push({ clave: 'correspondencia', encabezado: t.correspondencia, xml });
  }

  if (input.tipo === 'cambio') {
    const cambios = ctx.cambios ?? [];
    if (cambios.length > 0 || ctx.diff) {
      let xml = '';
      if (cambios.length > 0) {
        xml += tabla([...t.cabArchivos], cambios.map((c) => [c.ruta, c.estado]), { tblStyle: opciones.tblStyle });
      }
      if (ctx.diff) {
        const tr = truncarLineas(ctx.diff, MAX_LINEAS_DIFF_DOC);
        xml += parrafoCodigo(tr.texto);
        if (tr.truncado) {
          xml += parrafo(t.diffTruncado(MAX_LINEAS_DIFF_DOC, tr.total), cuerpo);
        }
      }
      bloques.push({ clave: 'archivosAfectados', encabezado: t.archivosAfectados, xml });
    }
  } else {
    const archivos = input.archivosConsultados ?? [];
    if (archivos.length > 0) {
      bloques.push({
        clave: 'archivosConsultados',
        encabezado: t.archivosConsultados,
        xml: archivos.map((a) => parrafo(`• ${a}`, cuerpo)).join('')
      });
    }
  }

  if (ctx.avisos.length > 0) {
    bloques.push({
      clave: 'avisos',
      encabezado: t.avisos,
      xml: ctx.avisos.map((a) => parrafo(`• ${a}`, cuerpo)).join('')
    });
  } else {
    bloques.push({
      clave: 'avisos',
      encabezado: t.avisos,
      xml: parrafo(t.sinAvisos(formatoFecha(ctx.fecha)), cuerpo),
      soloSiExiste: true
    });
  }
  return bloques;
}
