import {
  BorderStyle,
  Document,
  HeadingLevel,
  IRunOptions,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import { COLOR_CODIGO, MAX_LINEAS_DIFF_DOC } from '../../core/constantes';
import { Etiquetas } from '../../core/i18n';
import { resaltadoSql } from '../../core/formatoVisual';
import { esBloqueSql, formatoFecha, limpiarControl, truncarLineas } from '../../core/texto';
import { ContextoGeneracion, DocuInput } from '../../core/tipos';
import { colorEstado, filasMapeo, segmentarContenido } from './xml';

type Bloque = Paragraph | Table;

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: '999999' };

function lineasARuns(texto: string, opciones: { bold?: boolean } = {}): TextRun[] {
  return limpiarControl(texto)
    .split(/\r?\n/)
    .map((l, i) => new TextRun({ text: l, bold: opciones.bold, break: i > 0 ? 1 : undefined }));
}

function parrafoTexto(texto: string, bold = false): Paragraph {
  return new Paragraph({ children: lineasARuns(texto, { bold }) });
}

function parrafoCodigo(texto: string, resaltado?: string): Paragraph {
  const lineas = limpiarControl(texto).replace(/\t/g, '    ').split(/\r?\n/);
  const highlight = resaltado as IRunOptions['highlight'];
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: COLOR_CODIGO, color: 'auto' },
    children: lineas.map(
      (l, i) => new TextRun({ text: l, font: 'Consolas', size: 18, break: i > 0 ? 1 : undefined, highlight })
    )
  });
}

function contenidoABloques(contenido: string, resaltado?: string): Paragraph[] {
  return segmentarContenido(contenido).map((s) =>
    s.tipo === 'codigo'
      ? parrafoCodigo(s.texto, resaltado && esBloqueSql(s.texto, s.lenguaje) ? resaltado : undefined)
      : parrafoTexto(s.texto)
  );
}

function celda(texto: string, bold: boolean, fill?: string): TableCell {
  return new TableCell({
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    children: [new Paragraph({ children: lineasARuns(texto, { bold }) })]
  });
}

function tabla(cabeceras: string[], filas: string[][], colores: (string | undefined)[] = []): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: BORDE,
      bottom: BORDE,
      left: BORDE,
      right: BORDE,
      insideHorizontal: BORDE,
      insideVertical: BORDE
    },
    rows: [
      new TableRow({ tableHeader: true, children: cabeceras.map((c) => celda(c, true)) }),
      ...filas.map((f, i) => new TableRow({ children: f.map((c) => celda(c, false, colores[i])) }))
    ]
  });
}

function encabezado2(texto: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: limpiarControl(texto) })] });
}

export async function crearDocx(
  input: DocuInput,
  ctx: ContextoGeneracion,
  t: Etiquetas
): Promise<{ buffer: Buffer; encabezados: { texto: string; nivel: number }[] }> {
  const fecha = formatoFecha(ctx.fecha);
  const res = resaltadoSql(input.formatoVisual)?.word;
  const hijos: Bloque[] = [];
  const encabezados: { texto: string; nivel: number }[] = [];
  const h2 = (texto: string): Paragraph => {
    encabezados.push({ texto, nivel: 2 });
    return encabezado2(texto);
  };

  hijos.push(
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: limpiarControl(input.titulo) })] }),
    parrafoTexto(`${t.fecha}: ${fecha}`),
    parrafoTexto(`${t.autor}: ${ctx.autor}`),
    parrafoTexto(`${t.tipoDocumento}: ${t.tipoDoc[input.tipo]}`)
  );

  hijos.push(h2(t.resumen), ...contenidoABloques(input.resumen, res));

  for (const s of input.secciones ?? []) {
    if (s.encabezado.trim() === '') {
      hijos.push(...contenidoABloques(s.contenido, res));
    } else {
      hijos.push(h2(s.encabezado), ...contenidoABloques(s.contenido, res));
    }
  }

  if (input.ejemplos && input.ejemplos.length > 0) {
    hijos.push(h2(t.ejemplos));
    for (const e of input.ejemplos) {
      hijos.push(parrafoTexto(`${e.titulo} (${t.tipoEjemplo[e.tipo] ?? e.tipo})`, true));
      if (e.explicacion) {
        hijos.push(parrafoTexto(e.explicacion));
      }
      hijos.push(parrafoCodigo(e.contenido, e.tipo === 'sql' ? res : undefined));
    }
  }

  if (input.mapeoNombres && input.mapeoNombres.length > 0) {
    hijos.push(
      h2(t.correspondencia),
      tabla(
        [...t.cabMapeo],
        filasMapeo(input.mapeoNombres, t),
        input.mapeoNombres.map((m) => colorEstado(m.estado))
      ),
      new Paragraph({})
    );
  }

  if (input.tipo === 'cambio') {
    const cambios = ctx.cambios ?? [];
    if (cambios.length > 0 || ctx.diff) {
      hijos.push(h2(t.archivosAfectados));
      if (cambios.length > 0) {
        hijos.push(tabla([...t.cabArchivos], cambios.map((c) => [c.ruta, c.estado])), new Paragraph({}));
      }
      if (ctx.diff) {
        const tr = truncarLineas(ctx.diff, MAX_LINEAS_DIFF_DOC);
        hijos.push(parrafoCodigo(tr.texto));
        if (tr.truncado) {
          hijos.push(parrafoTexto(t.diffTruncado(MAX_LINEAS_DIFF_DOC, tr.total)));
        }
      }
    }
  } else if (input.archivosConsultados && input.archivosConsultados.length > 0) {
    hijos.push(h2(t.archivosConsultados), ...input.archivosConsultados.map((a) => parrafoTexto(`• ${a}`)));
  }

  if (ctx.avisos.length > 0) {
    hijos.push(h2(t.avisos), ...ctx.avisos.map((a) => parrafoTexto(`• ${a}`)));
  }

  hijos.push(
    h2(t.historial),
    tabla([...t.cabHistorial], [[fecha, t.tipoDoc[input.tipo], input.titulo, input.resumen]])
  );

  const doc = new Document({
    creator: ctx.autor,
    title: limpiarControl(input.titulo),
    sections: [{ children: hijos }]
  });
  return { buffer: await Packer.toBuffer(doc), encabezados };
}
