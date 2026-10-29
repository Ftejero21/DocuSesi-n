import * as fs from 'fs';
import { MAX_BYTES_ORIGEN } from './constantes';
import { resolverEnWorkspace } from './rutas';
import { Ejemplo, MapeoNombre } from './tipos';

export interface ResultadoMapeo {
  mapeo: MapeoNombre[];
  avisos: string[];
  /** Descripciones de los elementos degradados de 'verificado' a 'pendiente_de_verificar'. */
  degradados: string[];
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Quita del SQL los comentarios de línea (--), los de bloque y los literales entre comillas simples.
export function limpiarSql(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
}

/** Quita el sufijo `:línea` o `:a-b` de un origen. */
export function quitarLinea(origen: string): string {
  return origen.trim().replace(/:\d+(?:-\d+)?$/, '');
}

/** Separa un origen con varias referencias `ruta[:línea]` separadas por ';' o ','. */
export function separarOrigenes(origen: string): string[] {
  return origen
    .split(/[;,]/)
    .map((r) => r.trim())
    .filter((r) => r !== '');
}

async function leerOrigen(
  root: string,
  origen: string
): Promise<{ ok: true; texto: string } | { ok: false; motivo: string }> {
  const ruta = quitarLinea(origen);
  const abs = await resolverEnWorkspace(root, ruta);
  if (!abs) {
    return { ok: false, motivo: `el origen "${origen}" queda fuera del workspace` };
  }
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(abs);
  } catch {
    return { ok: false, motivo: `el archivo de origen "${ruta}" no existe` };
  }
  if (!stat.isFile()) {
    return { ok: false, motivo: `el origen "${ruta}" no es un archivo` };
  }
  if (stat.size > MAX_BYTES_ORIGEN) {
    return { ok: false, motivo: `el archivo de origen "${ruta}" supera 2 MB y no se puede comprobar` };
  }
  try {
    return { ok: true, texto: await fs.promises.readFile(abs, 'utf8') };
  } catch (e) {
    return { ok: false, motivo: `no se pudo leer "${ruta}" (${(e as Error).message})` };
  }
}

export async function validarMapeo(
  root: string,
  mapeo: MapeoNombre[] | undefined,
  ejemplos: Ejemplo[] | undefined
): Promise<ResultadoMapeo> {
  const copia: MapeoNombre[] = (mapeo ?? []).map((m) => ({ ...m }));
  const avisos: string[] = [];
  const degradados: string[] = [];
  const cache = new Map<string, Awaited<ReturnType<typeof leerOrigen>>>();

  for (const m of copia) {
    if (m.estado !== 'verificado') {
      continue;
    }
    const refs = separarOrigenes(m.origen);
    const nombre = m.nombreReal.toLowerCase();
    const motivos: string[] = [];
    let ok = false;
    for (const ref of refs) {
      const clave = quitarLinea(ref);
      let lectura = cache.get(clave);
      if (!lectura) {
        lectura = await leerOrigen(root, ref);
        cache.set(clave, lectura);
      }
      if (lectura.ok && lectura.texto.toLowerCase().includes(nombre)) {
        ok = true;
        break;
      }
      motivos.push(lectura.ok ? `"${m.nombreReal}" no aparece literalmente en "${clave}"` : lectura.motivo);
    }
    let motivo: string | undefined;
    if (!ok) {
      motivo =
        refs.length === 0
          ? 'el origen está vacío'
          : refs.length === 1
            ? motivos[0]
            : `"${m.nombreReal}" no aparece en ninguno de los orígenes (${motivos.join('; ')})`;
    }
    if (motivo) {
      m.estado = 'pendiente_de_verificar';
      degradados.push(`${m.nombreEnCodigo} -> ${m.nombreReal}`);
      avisos.push(
        `Mapeo "${m.nombreEnCodigo}" -> "${m.nombreReal}" pasa a pendiente_de_verificar: ${motivo}.`
      );
    }
  }

  for (const e of ejemplos ?? []) {
    if (e.tipo !== 'sql') {
      continue;
    }
    const sql = limpiarSql(e.contenido);
    for (const m of copia) {
      const enCodigo = m.nombreEnCodigo.trim();
      if (enCodigo === '' || enCodigo.toLowerCase() === m.nombreReal.trim().toLowerCase()) {
        continue;
      }
      const re = new RegExp(`(?<![\\w:$.])${escaparRegex(enCodigo)}(?![\\w])`, 'i');
      if (re.test(sql)) {
        avisos.push(
          `El SQL del ejemplo "${e.titulo}" usa \`${enCodigo}\`, usa \`${m.nombreReal}\` (nombre real).`
        );
      }
    }
  }

  return { mapeo: copia, avisos: [...new Set(avisos)], degradados };
}
