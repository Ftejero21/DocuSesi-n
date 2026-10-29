import { i18n } from './i18n';
import { limpiarControl, normalizar } from './texto';
import { Idioma, PlanActualizacion } from './tipos';

function limpiarTitulo(valor: string): string {
  return limpiarControl(valor).replace(/\s+/g, ' ').trim();
}

/** "<titulo> (n)" con el primer n >= 2 cuyo valor normalizado no esté en 'existentes'. */
export function sugerirTituloAlternativo(titulo: string, existentes: string[]): string {
  const usados = new Set(existentes.map(normalizar));
  const base = limpiarTitulo(titulo);
  for (let n = 2; ; n++) {
    const candidato = `${base} (${n})`;
    if (!usados.has(normalizar(candidato))) {
      return candidato;
    }
  }
}

/** Mensaje de error si el título alternativo queda vacío o coincide (normalizado) con uno existente; undefined si es válido. */
export function validarTituloAlternativo(valor: string, existentes: string[], idioma: Idioma): string | undefined {
  const c = i18n(idioma).confirmacion;
  const limpio = limpiarTitulo(valor);
  if (limpio === '') {
    return c.errTituloVacio;
  }
  const clave = normalizar(limpio);
  if (existentes.some((e) => normalizar(e) === clave)) {
    return c.errTituloExiste(limpio);
  }
  return undefined;
}

/** Texto plano (para el detail de un modal) con el nombre del archivo y las tres listas del plan. */
export function textoPlan(plan: PlanActualizacion, archivo: string, idioma: Idioma): string {
  const c = i18n(idioma).confirmacion;
  const lista = (cab: string, items: string[]): string[] => [
    '',
    `${cab}:`,
    ...(items.length > 0 ? items.map((i) => `• ${i}`) : [c.ninguna])
  ];
  return [
    `${c.detalleArchivo}: ${archivo}`,
    ...lista(c.cabSustituir, plan.sustituir),
    ...lista(c.cabAmpliar, plan.ampliar),
    ...lista(c.cabAnadir, plan.anadir)
  ].join('\n');
}
