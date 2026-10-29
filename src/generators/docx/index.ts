import * as fs from 'fs';
import * as path from 'path';
import { i18n } from '../../core/i18n';
import { ModoEfectivo, rutaConSufijoFecha } from '../../core/rutas';
import { formatoFecha } from '../../core/texto';
import { ContextoGeneracion, DocuInput, ResultadoGeneracion } from '../../core/tipos';
import { escribirAtomico } from '../escritura';
import { actualizarDocx } from './actualizarDocx';
import { anexarDocx } from './anexarDocx';
import { crearDocx } from './crearDocx';
import { rellenarPlantilla } from './plantillaDocx';

/** Devuelve el buffer de la plantilla si es válida; si no, añade un aviso y devuelve undefined. */
export async function leerPlantilla(ctx: ContextoGeneracion, extension: '.docx' | '.xlsx'): Promise<Buffer | undefined> {
  const p = ctx.plantilla;
  if (!p) {
    return undefined;
  }
  if (path.extname(p).toLowerCase() !== extension) {
    ctx.avisos.push(`La plantilla "${p}" no es un archivo ${extension}; se crea el documento desde cero.`);
    return undefined;
  }
  try {
    const st = await fs.promises.stat(p);
    if (!st.isFile()) {
      throw new Error('no es un archivo');
    }
    return await fs.promises.readFile(p);
  } catch (e) {
    ctx.avisos.push(`No se pudo usar la plantilla "${p}" (${(e as Error).message}); se crea el documento desde cero.`);
    return undefined;
  }
}

export async function generarDocx(
  input: DocuInput,
  ctx: ContextoGeneracion,
  modo: ModoEfectivo
): Promise<ResultadoGeneracion> {
  const t = i18n(ctx.idioma);

  if (modo === 'actualizar') {
    const existente = await fs.promises.readFile(ctx.rutaDestino);
    const r = await actualizarDocx(existente, input, ctx, { conBackup: true, fusionar: true });
    await escribirAtomico(ctx.rutaDestino, r.buffer);
    return {
      rutaFinal: ctx.rutaDestino,
      accion: 'actualizado',
      seccionesCreadas: r.seccionesCreadas,
      seccionesActualizadas: r.seccionesActualizadas,
      encabezados: r.encabezados,
      backup: r.backup,
      avisos: ctx.avisos
    };
  }

  if (modo === 'anexar') {
    const existente = await fs.promises.readFile(ctx.rutaDestino);
    const r = await anexarDocx(existente, input, ctx);
    if (r.buffer) {
      await escribirAtomico(ctx.rutaDestino, r.buffer);
    }
    return {
      rutaFinal: ctx.rutaDestino,
      accion: r.accion,
      seccionesCreadas: r.seccionesCreadas,
      seccionesActualizadas: r.seccionesActualizadas ?? [],
      encabezados: r.encabezados,
      backup: r.backup,
      avisos: ctx.avisos,
      decisionUsuario: r.decisionUsuario
    };
  }

  const rutaFinal = modo === 'sufijo' ? rutaConSufijoFecha(ctx.rutaDestino, ctx.fecha) : ctx.rutaDestino;
  const accionBase = modo === 'sufijo' ? 'nuevo_con_sufijo' : undefined;
  const ctxFinal: ContextoGeneracion = { ...ctx, rutaDestino: rutaFinal };

  const plantilla = await leerPlantilla(ctx, '.docx');
  if (plantilla) {
    let base = plantilla;
    try {
      base = rellenarPlantilla(plantilla, {
        titulo: input.titulo,
        fecha: formatoFecha(ctx.fecha),
        resumen: input.resumen
      });
    } catch (e) {
      ctx.avisos.push(`No se pudieron rellenar los marcadores de la plantilla (${(e as Error).message}); se usa sin rellenar.`);
    }
    const r = await actualizarDocx(base, input, ctxFinal, { conBackup: false });
    await escribirAtomico(rutaFinal, r.buffer);
    return {
      rutaFinal,
      accion: accionBase ?? 'creado_desde_plantilla',
      seccionesCreadas: r.seccionesCreadas,
      seccionesActualizadas: r.seccionesActualizadas,
      encabezados: r.encabezados,
      avisos: ctx.avisos
    };
  }

  const { buffer, encabezados } = await crearDocx(input, ctx, t);
  await escribirAtomico(rutaFinal, buffer);
  return {
    rutaFinal,
    accion: accionBase ?? 'creado',
    seccionesCreadas: encabezados.map((e) => e.texto),
    seccionesActualizadas: [],
    encabezados,
    avisos: ctx.avisos
  };
}
