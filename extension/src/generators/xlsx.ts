import ExcelJS from 'exceljs';
import { ARGB_ENTORNO, ARGB_PENDIENTE } from '../core/constantes';
import { resaltadoSql } from '../core/formatoVisual';
import { Etiquetas, i18n } from '../core/i18n';
import { ModoEfectivo, rutaConSufijoFecha } from '../core/rutas';
import { formatoFecha, limpiarControl, normalizar } from '../core/texto';
import { ContextoGeneracion, DocuInput, Ejemplo, EstadoMapeo, MapeoNombre, PlanActualizacion, ResultadoGeneracion } from '../core/tipos';
import { crearBackup } from './backup';
import { leerPlantilla } from './docx';
import { escribirAtomico } from './escritura';

const ES = i18n('es');
const EN = i18n('en');

type Hoja = 'registro' | 'mapeo' | 'ejemplos';

function nombreHoja(h: Hoja, t: Etiquetas): string {
  return h === 'registro' ? t.hojaRegistro : h === 'mapeo' ? t.hojaMapeo : t.hojaEjemplos;
}

function cabecerasHoja(h: Hoja, t: Etiquetas): string[] {
  return h === 'registro' ? [...t.cabRegistro] : h === 'mapeo' ? [...t.cabMapeo] : [...t.cabEjemplos];
}

function buscarHoja(wb: ExcelJS.Workbook, h: Hoja): ExcelJS.Worksheet | undefined {
  const nombres = [normalizar(nombreHoja(h, ES)), normalizar(nombreHoja(h, EN))];
  return wb.worksheets.find((ws) => nombres.includes(normalizar(ws.name)));
}

function crearHoja(wb: ExcelJS.Workbook, h: Hoja, t: Etiquetas): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(nombreHoja(h, t));
  const cab = cabecerasHoja(h, t);
  const fila = ws.addRow(cab);
  fila.font = { bold: true };
  cab.forEach((c, i) => {
    ws.getColumn(i + 1).width = Math.max(14, Math.min(60, c.length + 10));
  });
  if (h === 'registro') {
    ws.getColumn(3).width = 30;
    ws.getColumn(4).width = 60;
    ws.getColumn(5).width = 40;
  } else if (h === 'ejemplos') {
    ws.getColumn(3).width = 50;
    ws.getColumn(4).width = 70;
  } else {
    ws.getColumn(4).width = 40;
    ws.getColumn(6).width = 30;
  }
  return ws;
}

/** Posición (1-based) de cada columna lógica, por el texto de la cabecera normalizado; con la posición por defecto como respaldo. */
function localizarColumnas(ws: ExcelJS.Worksheet, h: Hoja): number[] {
  const es = cabecerasHoja(h, ES).map(normalizar);
  const en = cabecerasHoja(h, EN).map(normalizar);
  const cabecera = ws.getRow(1);
  const porTexto = new Map<string, number>();
  cabecera.eachCell({ includeEmpty: false }, (cell, col) => {
    const v = normalizar(String(cell.text ?? ''));
    if (v && !porTexto.has(v)) {
      porTexto.set(v, col);
    }
  });
  return es.map((nombre, i) => porTexto.get(nombre) ?? porTexto.get(en[i]) ?? i + 1);
}

function ultimaFilaConDatos(ws: ExcelJS.Worksheet): number {
  let n = ws.rowCount;
  while (n > 1 && !ws.getRow(n).hasValues) {
    n--;
  }
  return Math.max(n, 1);
}

function copiarEstiloFila(ws: ExcelJS.Worksheet, desde: number, hasta: number, columnas: number): void {
  if (desde <= 1) {
    return; // la fila anterior es la cabecera: no se copia el estilo
  }
  const origen = ws.getRow(desde);
  const destino = ws.getRow(hasta);
  const total = Math.max(columnas, origen.cellCount);
  for (let c = 1; c <= total; c++) {
    destino.getCell(c).style = JSON.parse(JSON.stringify(origen.getCell(c).style)) as Partial<ExcelJS.Style>;
  }
}

function ponerValores(fila: ExcelJS.Row, columnas: number[], valores: string[]): void {
  columnas.forEach((col, i) => {
    const c = fila.getCell(col);
    c.value = limpiarControl(valores[i] ?? '');
    c.alignment = { ...(c.alignment ?? {}), wrapText: true, vertical: 'top' };
  });
}

function rellenoEstado(fila: ExcelJS.Row, columnas: number[], estado: EstadoMapeo): void {
  const argb = estado === 'pendiente_de_verificar' ? ARGB_PENDIENTE : estado === 'depende_de_entorno' ? ARGB_ENTORNO : undefined;
  for (const col of columnas) {
    const c = fila.getCell(col);
    c.fill = argb
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb } }
      : { type: 'pattern', pattern: 'none' };
  }
}

function etiquetasPosibles(clave: string, tablas: Record<string, string>[]): string[] {
  return [clave, ...tablas.map((tb) => tb[clave])].filter(Boolean).map(normalizar);
}

function archivosTexto(input: DocuInput, ctx: ContextoGeneracion): string {
  const lista = input.tipo === 'cambio' ? (ctx.cambios ?? []).map((c) => c.ruta) : (input.archivosConsultados ?? []);
  return lista.join('\n');
}

function filaMapeo(m: MapeoNombre, t: Etiquetas): string[] {
  return [
    m.nombreEnCodigo,
    m.nombreReal,
    t.tipoObjeto[m.tipoObjeto] ?? m.tipoObjeto,
    m.origen,
    t.estado[m.estado] ?? m.estado,
    m.notas ?? ''
  ];
}

/** Fila de la hoja de mapeo con el mismo nombre en código y tipo de objeto (la primera). */
function buscarFilaMapeo(ws: ExcelJS.Worksheet, cols: number[], m: MapeoNombre): ExcelJS.Row | undefined {
  const claveTipo = etiquetasPosibles(m.tipoObjeto, [ES.tipoObjeto, EN.tipoObjeto]);
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (
      normalizar(String(row.getCell(cols[0]).text ?? '')) === normalizar(m.nombreEnCodigo) &&
      claveTipo.includes(normalizar(String(row.getCell(cols[2]).text ?? '')))
    ) {
      return row;
    }
  }
  return undefined;
}

/** Fila de la hoja de ejemplos con el mismo título (la primera). */
function buscarFilaEjemplo(ws: ExcelJS.Worksheet, cols: number[], e: Ejemplo): ExcelJS.Row | undefined {
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (normalizar(String(row.getCell(cols[0]).text ?? '')) === normalizar(e.titulo)) {
      return row;
    }
  }
  return undefined;
}

/**
 * Plan de cambios de generarXlsx en modo "actualizar" sin modificar nada: carga el libro en memoria y clasifica
 * las filas que se sobrescribirán (sustituir) y las filas u hojas que se añadirán.
 */
export async function planActualizarXlsx(buffer: Buffer, input: DocuInput, ctx: ContextoGeneracion): Promise<PlanActualizacion> {
  const t = i18n(ctx.idioma);
  const c = t.confirmacion;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const plan: PlanActualizacion = { formato: 'xlsx', sustituir: [], ampliar: [], anadir: [] };

  const wsRegistro = buscarHoja(wb, 'registro');
  const nombreRegistro = wsRegistro?.name ?? nombreHoja('registro', t);
  if (!wsRegistro) {
    plan.anadir.push(c.hojaNueva(nombreRegistro));
  }
  plan.anadir.push(c.filaRegistro(nombreRegistro));

  if (input.mapeoNombres && input.mapeoNombres.length > 0) {
    const ws = buscarHoja(wb, 'mapeo');
    const nombre = ws?.name ?? nombreHoja('mapeo', t);
    if (!ws) {
      plan.anadir.push(c.hojaNueva(nombre));
    }
    const cols = ws ? localizarColumnas(ws, 'mapeo') : [];
    for (const m of input.mapeoNombres) {
      const etiqueta = c.filaMapeo(nombre, m.nombreEnCodigo, t.tipoObjeto[m.tipoObjeto] ?? m.tipoObjeto);
      (ws && buscarFilaMapeo(ws, cols, m) ? plan.sustituir : plan.anadir).push(etiqueta);
    }
  }

  if (input.ejemplos && input.ejemplos.length > 0) {
    const ws = buscarHoja(wb, 'ejemplos');
    const nombre = ws?.name ?? nombreHoja('ejemplos', t);
    if (!ws) {
      plan.anadir.push(c.hojaNueva(nombre));
    }
    const cols = ws ? localizarColumnas(ws, 'ejemplos') : [];
    for (const e of input.ejemplos) {
      (ws && buscarFilaEjemplo(ws, cols, e) ? plan.sustituir : plan.anadir).push(c.filaEjemplo(nombre, e.titulo));
    }
  }
  return plan;
}

function aplicar(
  wb: ExcelJS.Workbook,
  input: DocuInput,
  ctx: ContextoGeneracion,
  t: Etiquetas
): { creadas: string[]; actualizadas: string[] } {
  const creadas: string[] = [];
  const actualizadas: string[] = [];
  const hoja = (h: Hoja): ExcelJS.Worksheet => {
    let ws = buscarHoja(wb, h);
    if (!ws) {
      ws = crearHoja(wb, h, t);
      creadas.push(ws.name);
    } else if (!actualizadas.includes(ws.name)) {
      actualizadas.push(ws.name);
    }
    return ws;
  };

  // Registro
  {
    const ws = hoja('registro');
    const cols = localizarColumnas(ws, 'registro');
    const ultima = ultimaFilaConDatos(ws);
    const nueva = ws.getRow(ultima + 1);
    copiarEstiloFila(ws, ultima, ultima + 1, cols.length);
    ponerValores(nueva, cols, [
      formatoFecha(ctx.fecha),
      t.tipoDoc[input.tipo],
      input.titulo,
      input.resumen,
      archivosTexto(input, ctx)
    ]);
  }

  // Mapeo BD
  if (input.mapeoNombres && input.mapeoNombres.length > 0) {
    const ws = hoja('mapeo');
    const cols = localizarColumnas(ws, 'mapeo');
    for (const m of input.mapeoNombres) {
      let fila = buscarFilaMapeo(ws, cols, m);
      if (!fila) {
        const ultima = ultimaFilaConDatos(ws);
        fila = ws.getRow(ultima + 1);
        copiarEstiloFila(ws, ultima, ultima + 1, cols.length);
      }
      ponerValores(fila, cols, filaMapeo(m, t));
      rellenoEstado(fila, cols, m.estado);
    }
  }

  // Ejemplos
  if (input.ejemplos && input.ejemplos.length > 0) {
    const ws = hoja('ejemplos');
    const cols = localizarColumnas(ws, 'ejemplos');
    const resaltadoHex = resaltadoSql(input.formatoVisual)?.hex;
    for (const e of input.ejemplos) {
      const tipoTxt = t.tipoEjemplo[e.tipo] ?? e.tipo;
      let fila = buscarFilaEjemplo(ws, cols, e);
      if (!fila) {
        const ultima = ultimaFilaConDatos(ws);
        fila = ws.getRow(ultima + 1);
        copiarEstiloFila(ws, ultima, ultima + 1, cols.length);
        if (resaltadoHex && e.tipo !== 'sql' && cols[3] !== undefined) {
          // La fila nueva copia el estilo de la anterior: no debe heredar el resaltado de un ejemplo SQL.
          const previo = (fila.getCell(cols[3]).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;
          if (previo === `FF${resaltadoHex}`) {
            fila.getCell(cols[3]).fill = { type: 'pattern', pattern: 'none' };
          }
        }
      }
      ponerValores(fila, cols, [e.titulo, tipoTxt, e.explicacion, e.contenido]);
      if (resaltadoHex && e.tipo === 'sql' && cols[3] !== undefined) {
        fila.getCell(cols[3]).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${resaltadoHex}` } };
      }
    }
  }
  return { creadas, actualizadas };
}

export async function generarXlsx(
  input: DocuInput,
  ctx: ContextoGeneracion,
  modo: ModoEfectivo
): Promise<ResultadoGeneracion> {
  const t = i18n(ctx.idioma);
  const wb = new ExcelJS.Workbook();
  let rutaFinal = ctx.rutaDestino;
  let backup: string | undefined;
  let accion: ResultadoGeneracion['accion'] = 'creado';

  if (modo === 'actualizar') {
    backup = await crearBackup(ctx.rutaDestino, ctx.backupDir, ctx.fecha);
    await wb.xlsx.readFile(ctx.rutaDestino);
    accion = 'actualizado';
  } else {
    if (modo === 'sufijo') {
      rutaFinal = rutaConSufijoFecha(ctx.rutaDestino, ctx.fecha);
      accion = 'nuevo_con_sufijo';
    }
    const plantilla = await leerPlantilla(ctx, '.xlsx');
    if (plantilla) {
      try {
        await wb.xlsx.load(plantilla as unknown as ArrayBuffer);
        if (accion === 'creado') {
          accion = 'creado_desde_plantilla';
        }
      } catch (e) {
        ctx.avisos.push(`No se pudo leer la plantilla de Excel (${(e as Error).message}); se crea el libro desde cero.`);
      }
    }
    wb.creator = ctx.autor;
  }

  const { creadas, actualizadas } = aplicar(wb, input, ctx, t);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await escribirAtomico(rutaFinal, buffer);
  return {
    rutaFinal,
    accion,
    seccionesCreadas: creadas,
    seccionesActualizadas: actualizadas,
    encabezados: wb.worksheets.map((w) => ({ texto: w.name, nivel: 1 })),
    backup,
    avisos: ctx.avisos
  };
}
