import Ajv from 'ajv';
import { inputSchema } from './schema';
import { DocuInput } from './tipos';

// Un único ajv compilado una sola vez.
const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false });
const validate = ajv.compile(inputSchema);

export type ResultadoValidacion = { ok: true; input: DocuInput } | { ok: false; errores: string[] };

/** Valida (y rellena los defaults sobre una copia) la entrada de la herramienta. */
export function validarInput(raw: unknown): ResultadoValidacion {
  let copia: unknown;
  try {
    copia = JSON.parse(JSON.stringify(raw ?? {}));
  } catch {
    return { ok: false, errores: ['La entrada no es un JSON válido'] };
  }
  if (validate(copia)) {
    return { ok: true, input: copia as DocuInput };
  }
  const errores = (validate.errors ?? []).map((e) => {
    const ruta = e.instancePath ? e.instancePath : '(raíz)';
    let extra = '';
    if (e.keyword === 'enum' && 'allowedValues' in e.params) {
      extra = ` (valores permitidos: ${(e.params as { allowedValues: unknown[] }).allowedValues.join(', ')})`;
    } else if (e.keyword === 'required' && 'missingProperty' in e.params) {
      extra = ` (falta: ${(e.params as { missingProperty: string }).missingProperty})`;
    }
    return `${ruta}: ${e.message ?? 'inválido'}${extra}`;
  });
  return { ok: false, errores };
}
