import * as fs from 'fs';
import * as path from 'path';
import { generarDocx } from '../generators/docx';
import { planActualizarDocx } from '../generators/docx/actualizarDocx';
import { generarPptx } from '../generators/pptx';
import { segmentarContenido } from '../generators/docx/xml';
import { generarXlsx, planActualizarXlsx } from '../generators/xlsx';
import { MAX_ARCHIVOS_AVISO } from './constantes';
import { i18n } from './i18n';
import { asegurarDentro, estaDentro, modoEfectivo } from './rutas';
import { CambioGit, ContextoGeneracion, DocuInput, Ejemplo, Formato, ResultadoGeneracion } from './tipos';
import { quitarPrefijoCambio, RE_SQL } from './texto';
import { validarMapeo } from './validarMapeo';

function normalizarRuta(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

/**
 * Rutas de los archivos cambiados si el contenido no menciona ninguno (por ruta relativa o nombre base sin extensión).
 * Devuelve [] si no hay cambios o si al menos uno está mencionado.
 */
export function cambiosSinMencion(input: DocuInput, cambios: CambioGit[] | undefined): string[] {
  if (!cambios || cambios.length === 0) {
    return [];
  }
  const partes: string[] = [input.titulo, input.resumen, ...(input.archivosConsultados ?? [])];
  for (const s of input.secciones ?? []) {
    partes.push(s.encabezado, s.contenido);
  }
  for (const e of input.ejemplos ?? []) {
    partes.push(e.titulo, e.contenido, e.explicacion);
  }
  const corpus = partes
    .filter((p) => typeof p === 'string')
    .join('\n')
    .replace(/\\/g, '/')
    .toLowerCase();
  const mencionado = cambios.some((c) => {
    const r = normalizarRuta(c.ruta);
    const base = path.posix.parse(r).name;
    return corpus.includes(r) || (base !== '' && corpus.includes(base));
  });
  return mencionado ? [] : cambios.map((c) => c.ruta);
}

/** Quita del diff los bloques de los archivos excluidos. */
export function filtrarDiff(diff: string, excluida: (ruta: string) => boolean): string {
  const bloques = diff.split(/^(?=diff --git )/m);
  return bloques
    .filter((b) => {
      const m = /^diff --git a\/(.+?) b\/(.+)$/m.exec(b);
      return !(m && (excluida(m[2]) || excluida(m[1])));
    })
    .join('');
}

/** Quita de cada sección el subtítulo "Cambio AAAA-MM-DD: <titulo>" que añade la propia extensión. No muta el input. */
export function sanearSecciones(input: DocuInput): DocuInput {
  if (!input.secciones) {
    return input;
  }
  const titulo = typeof input.titulo === 'string' ? input.titulo : '';
  return {
    ...input,
    secciones: input.secciones.map((s) =>
      typeof s.contenido === 'string' ? { ...s, contenido: quitarPrefijoCambio(s.contenido, titulo) } : s
    )
  };
}

/** Pseudo-ejemplos SQL extraídos de los bloques de código de las secciones (solo para validar nombres en modo "anexar"). */
function ejemplosDeSecciones(input: DocuInput): Ejemplo[] {
  const res: Ejemplo[] = [];
  for (const s of input.secciones ?? []) {
    if (typeof s.contenido !== 'string') {
      continue;
    }
    for (const seg of segmentarContenido(s.contenido)) {
      if (seg.tipo !== 'codigo') {
        continue;
      }
      if ((seg.lenguaje ?? '').toLowerCase() === 'sql' || RE_SQL.test(seg.texto)) {
        res.push({ titulo: (s.encabezado ?? '').trim() || input.titulo, tipo: 'sql', contenido: seg.texto, explicacion: '' });
      }
    }
  }
  return res;
}

/** Orquestación única, usada por la herramienta y por el comando. */
export async function documentar(entradaOriginal: DocuInput, ctx: ContextoGeneracion): Promise<ResultadoGeneracion> {
  const input = sanearSecciones(entradaOriginal);
  // Solo se omite la comprobación para un destino léxicamente fuera Y con permiso explícito.
  if (!(ctx.permitirFueraDelWorkspace && !estaDentro(ctx.root, ctx.rutaDestino))) {
    await asegurarDentro(ctx.root, ctx.rutaDestino);
  }

  const formato = path.extname(ctx.rutaDestino).slice(1).toLowerCase() as Formato;
  if (!['docx', 'xlsx', 'pptx'].includes(formato)) {
    throw new Error(`Extensión de destino no soportada: ${ctx.rutaDestino}`);
  }

  const ejemplosValidar = input.modo === 'anexar' ? [...(input.ejemplos ?? []), ...ejemplosDeSecciones(input)] : input.ejemplos;
  const validado = await validarMapeo(ctx.root, input.mapeoNombres, ejemplosValidar);
  ctx.avisos.push(...validado.avisos);
  const inputFinal: DocuInput = { ...input, mapeoNombres: input.mapeoNombres ? validado.mapeo : undefined };

  // Cambios: solo en "cambio"; sin el propio destino ni .docusesion/** (un destino externo no aparece en el diff)
  let cambios: CambioGit[] | undefined;
  let diff: string | undefined;
  if (input.tipo === 'cambio') {
    const rel = normalizarRuta(path.relative(ctx.root, ctx.rutaDestino));
    const excluida = (ruta: string): boolean => {
      const r = normalizarRuta(ruta);
      return r === rel || r === '.docusesion' || r.startsWith('.docusesion/');
    };
    cambios = ctx.cambios?.filter((c) => !excluida(c.ruta));
    diff = ctx.diff ? filtrarDiff(ctx.diff, excluida) : undefined;
    if (diff !== undefined && diff.trim() === '') {
      diff = undefined;
    }
  }

  if (input.tipo === 'cambio' && ctx.exigirMencionCambios) {
    const sinMencion = cambiosSinMencion(input, cambios);
    if (sinMencion.length > 0) {
      const lista = sinMencion.slice(0, MAX_ARCHIVOS_AVISO).join(', ');
      const resto = sinMencion.length > MAX_ARCHIVOS_AVISO ? ` y ${sinMencion.length - MAX_ARCHIVOS_AVISO} más` : '';
      ctx.avisos.push(
        `Tipo "cambio": el contenido no menciona ninguno de los archivos con cambios sin confirmar en git (${lista}${resto}). ` +
          '"Este cambio" son esas modificaciones del working tree, no la generación del documento ni la conversación. ' +
          'Revisa el diff, documenta esos archivos y vuelve a invocar la herramienta. El documento NO se ha escrito.'
      );
      return {
        rutaFinal: ctx.rutaDestino,
        accion: 'no_escrito',
        seccionesCreadas: [],
        seccionesActualizadas: [],
        encabezados: [],
        avisos: ctx.avisos,
        mapeosDegradados: validado.degradados
      };
    }
  }

  const existe = fs.existsSync(ctx.rutaDestino);
  const modo = modoEfectivo(input.modo, existe, formato);
  if (input.modo === 'anexar' && formato === 'xlsx' && existe) {
    ctx.avisos.push('El modo "anexar" solo se aplica a docx; en xlsx se usa "auto" (se añaden filas al registro).');
  }
  if (modo === 'sufijo') {
    ctx.avisos.push(
      formato === 'pptx'
        ? 'El archivo pptx ya existe y no se actualiza: se crea un archivo nuevo con sufijo de fecha.'
        : 'El archivo ya existe y el modo es "crear": se crea un archivo nuevo con sufijo de fecha (no se sobrescribe).'
    );
  }

  const ctxGen: ContextoGeneracion = { ...ctx, cambios, diff };

  // Nunca se modifica contenido existente sin confirmación explícita del usuario (la UI se inyecta como callback).
  if (modo === 'actualizar' && ctx.confirmarActualizacion && formato !== 'pptx') {
    const existente = await fs.promises.readFile(ctx.rutaDestino);
    const plan =
      formato === 'docx' ? planActualizarDocx(existente, inputFinal, ctxGen) : await planActualizarXlsx(existente, inputFinal, ctxGen);
    const decision = await ctx.confirmarActualizacion(plan);
    if (decision !== 'actualizar') {
      const L = i18n(ctx.idioma).res;
      const aviso = decision === 'anexar' ? L.confirmacionAnexar(ctx.rutaDestino) : L.confirmacionCancelada;
      return {
        rutaFinal: ctx.rutaDestino,
        accion: 'no_escrito',
        seccionesCreadas: [],
        seccionesActualizadas: [],
        encabezados: [],
        avisos: [aviso, ...ctx.avisos],
        mapeosDegradados: validado.degradados,
        decisionUsuario: decision
      };
    }
  }

  let resultado: ResultadoGeneracion;
  if (formato === 'docx') {
    resultado = await generarDocx(inputFinal, ctxGen, modo);
  } else if (formato === 'xlsx') {
    resultado = await generarXlsx(inputFinal, ctxGen, modo);
  } else {
    resultado = await generarPptx(inputFinal, ctxGen, modo);
  }
  resultado.avisos = ctx.avisos;
  resultado.mapeosDegradados = validado.degradados;
  return resultado;
}
