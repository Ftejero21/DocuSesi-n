import PptxGenJS from 'pptxgenjs';
import { COLOR_ENTORNO, COLOR_PENDIENTE } from '../core/constantes';
import { resaltadoSql } from '../core/formatoVisual';
import { i18n } from '../core/i18n';
import { ModoEfectivo, rutaConSufijoFecha } from '../core/rutas';
import { esBloqueSql, formatoFecha, limpiarControl } from '../core/texto';
import { ContextoGeneracion, DocuInput, ResultadoGeneracion } from '../core/tipos';
import { escribirAtomico } from './escritura';

type TextoRun = PptxGenJS.TextProps;

/** `resaltadoHex`: color RRGGBB ya validado (tabla cerrada); se aplica a los bloques de código SQL. */
function contenidoARuns(contenido: string, resaltadoHex?: string): TextoRun[] {
  const runs: TextoRun[] = [];
  let enCodigo = false;
  let lenguaje = '';
  let bloque: string[] = [];
  const cerrarBloque = (): void => {
    const sql = resaltadoHex !== undefined && esBloqueSql(bloque.join('\n'), lenguaje);
    for (const l of bloque) {
      if (l.trim() === '') {
        continue;
      }
      runs.push({
        text: l,
        options: { fontFace: 'Consolas', fontSize: 11, breakLine: true, ...(sql ? { highlight: resaltadoHex } : {}) }
      });
    }
    bloque = [];
  };
  for (const linea of limpiarControl(contenido).split(/\r?\n/)) {
    const valla = /^\s*```\s*([\w+#.-]*)/.exec(linea);
    if (valla) {
      if (enCodigo) {
        cerrarBloque();
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
    runs.push(
      m
        ? { text: m[1], options: { bullet: true, breakLine: true } }
        : { text: linea.trim(), options: { breakLine: true } }
    );
  }
  if (enCodigo) {
    cerrarBloque();
  }
  return runs;
}

export async function generarPptx(
  input: DocuInput,
  ctx: ContextoGeneracion,
  modo: ModoEfectivo
): Promise<ResultadoGeneracion> {
  const t = i18n(ctx.idioma);
  const rutaFinal = modo === 'crear' ? ctx.rutaDestino : rutaConSufijoFecha(ctx.rutaDestino, ctx.fecha);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = ctx.autor;
  pptx.title = limpiarControl(input.titulo);

  const encabezados: { texto: string; nivel: number }[] = [];
  const resaltadoHex = resaltadoSql(input.formatoVisual)?.hex;

  // Portada
  const portada = pptx.addSlide();
  portada.addText(limpiarControl(input.titulo), { x: 0.5, y: 0.6, w: 9, h: 1.2, fontSize: 32, bold: true, fit: 'shrink' });
  portada.addText(limpiarControl(input.resumen), { x: 0.5, y: 1.9, w: 9, h: 2.2, fontSize: 16, valign: 'top', fit: 'shrink' });
  portada.addText(
    [
      { text: `${t.fecha}: ${formatoFecha(ctx.fecha)}`, options: { breakLine: true } },
      { text: `${t.autor}: ${ctx.autor}`, options: { breakLine: true } },
      { text: `${t.tipoDocumento}: ${t.tipoDoc[input.tipo]}`, options: { breakLine: true } }
    ],
    { x: 0.5, y: 4.2, w: 9, h: 1.2, fontSize: 12, color: '595959' }
  );

  // Una diapositiva por sección
  for (const s of input.secciones ?? []) {
    const slide = pptx.addSlide();
    const tituloSlide = s.encabezado.trim() === '' ? input.titulo : s.encabezado;
    slide.addText(limpiarControl(tituloSlide), { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 24, bold: true, fit: 'shrink' });
    const runs = contenidoARuns(s.contenido, resaltadoHex);
    slide.addText(runs.length > 0 ? runs : ' ', { x: 0.5, y: 1.2, w: 9, h: 4.2, fontSize: 14, valign: 'top', fit: 'shrink' });
    encabezados.push({ texto: tituloSlide, nivel: 1 });
  }

  // Tabla resumen del mapeo
  if (input.mapeoNombres && input.mapeoNombres.length > 0) {
    const cab = t.cabMapeo.map((c) => ({ text: c, options: { bold: true, fill: { color: 'D9D9D9' } } }));
    const filas = input.mapeoNombres.map((m) => {
      const fill =
        m.estado === 'pendiente_de_verificar' ? COLOR_PENDIENTE : m.estado === 'depende_de_entorno' ? COLOR_ENTORNO : undefined;
      const valores = [
        m.nombreEnCodigo,
        m.nombreReal,
        t.tipoObjeto[m.tipoObjeto] ?? m.tipoObjeto,
        m.origen,
        t.estado[m.estado] ?? m.estado,
        m.notas ?? ''
      ];
      return valores.map((v) => ({
        text: limpiarControl(v),
        options: fill ? { fill: { color: fill } } : {}
      }));
    });
    const slide = pptx.addSlide();
    slide.addText(t.correspondencia, { x: 0.5, y: 0.2, w: 9, h: 0.6, fontSize: 20, bold: true, fit: 'shrink' });
    slide.addTable([cab, ...filas], {
      x: 0.3,
      y: 0.9,
      w: 9.4,
      colW: [1.7, 1.5, 1.0, 2.6, 1.3, 1.3],
      fontSize: 9,
      border: { type: 'solid', pt: 0.5, color: '999999' },
      autoPage: true,
      autoPageRepeatHeader: true
    });
    encabezados.push({ texto: t.correspondencia, nivel: 1 });
  }

  if (input.ejemplos && input.ejemplos.length > 0) {
    ctx.avisos.push('El formato pptx no incluye los ejemplos; usa docx o xlsx para conservarlos.');
  }

  const datos = await pptx.write({ outputType: 'nodebuffer' });
  await escribirAtomico(rutaFinal, Buffer.from(datos as Buffer));
  return {
    rutaFinal,
    accion: modo === 'crear' ? 'creado' : 'nuevo_con_sufijo',
    seccionesCreadas: encabezados.map((e) => e.texto),
    seccionesActualizadas: [],
    encabezados,
    avisos: ctx.avisos
  };
}
