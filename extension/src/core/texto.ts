/** Normaliza: NFD, sin diacríticos, minúsculas, trim y espacios colapsados. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Elimina los caracteres de control no válidos en XML 1.0. */
export function limpiarControl(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
}

/** Escapa & < > " ' y limpia caracteres de control. */
export function escaparXml(s: string): string {
  return limpiarControl(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dos(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'fecha' -> YYYY-MM-DD; 'sello' -> YYYYMMDD-HHmmss; 'fechaHora' -> YYYY-MM-DD HH:mm */
export function formatoFecha(d: Date, tipo: 'fecha' | 'sello' | 'fechaHora' = 'fecha'): string {
  const f = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  if (tipo === 'fecha') {
    return f;
  }
  if (tipo === 'fechaHora') {
    return `${f} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
  }
  return `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
}

/** Trunca a un máximo de líneas; devuelve el texto y si se truncó. */
export function truncarLineas(texto: string, max: number): { texto: string; truncado: boolean; total: number } {
  const lineas = texto.split(/\r?\n/);
  if (lineas.length <= max) {
    return { texto, truncado: false, total: lineas.length };
  }
  return { texto: lineas.slice(0, max).join('\n'), truncado: true, total: lineas.length };
}

const PREFIJO_CAMBIO = /^(?:cambio|change)\s*(?:yyyy-mm-dd|aaaa-mm-dd|\d{4}-\d{2}-\d{2})\s*:\s*/i;

/**
 * Quita del inicio del contenido el subtítulo que la extensión añade por su cuenta
 * ("Cambio AAAA-MM-DD:" / "Change YYYY-MM-DD:", con fecha real o placeholder) y, si le sigue,
 * el título del input. Si no hay prefijo, o el resultado quedaría vacío, devuelve el original.
 */
export function quitarPrefijoCambio(contenido: string, titulo: string): string {
  const m = PREFIJO_CAMBIO.exec(contenido.trimStart());
  if (!m) {
    return contenido;
  }
  let resto = contenido.trimStart().slice(m[0].length);
  const tit = titulo.replace(/\s+/g, ' ').trim();
  if (tit !== '' && resto.slice(0, tit.length).toLowerCase() === tit.toLowerCase()) {
    const sep = /^[ \t]*(?::|\r?\n|$)/.exec(resto.slice(tit.length));
    if (sep) {
      resto = resto.slice(tit.length + sep[0].length);
    }
  }
  resto = resto.trimStart();
  return resto === '' ? contenido : resto;
}

/** Heurística para detectar SQL en un bloque de código sin lenguaje declarado. */
export const RE_SQL = /\bselect\b[\s\S]*\bfrom\b|\binsert\s+into\b|\bupdate\s+\w+[\s\S]*\bset\b|\bdelete\s+from\b/i;

const LENGUAJES_SQL = new Set(['sql', 'plsql', 'tsql', 'mysql', 'pgsql', 'postgresql', 'sqlite', 'oracle']);

/** ¿Es SQL este bloque de código? Con lenguaje explícito manda el lenguaje; sin él, la heurística. */
export function esBloqueSql(texto: string, lenguaje?: string): boolean {
  const l = (lenguaje ?? '').trim().toLowerCase();
  if (l !== '') {
    return LENGUAJES_SQL.has(l);
  }
  return RE_SQL.test(texto);
}
