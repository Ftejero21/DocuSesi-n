import * as vscode from 'vscode';
import { MAX_CARACTERES_ARCHIVOS_MODELO, MAX_CARACTERES_DIFF_MODELO } from '../core/constantes';
import { inputSchema } from '../core/schema';
import { CambioGit, DocuInput, Formato, TipoDoc } from '../core/tipos';
import { validarInput } from '../core/validacion';

export interface DatosPrompt {
  tipo: TipoDoc;
  formato: Formato;
  idioma: 'es' | 'en';
  diff?: string;
  cambios?: CambioGit[];
  archivos?: { ruta: string; contenido: string }[];
  pregunta?: string;
}

const REGLAS = `Reglas obligatorias:
- Documenta SOLO lo que se te da (diff o archivos). No añadas otros cambios ni temas.
- NUNCA inventes nombres de tablas, columnas, esquemas, bases de datos, parámetros, URLs ni campos. Lo que no puedas verificar márcalo en el texto como "[pendiente de verificar]".
- Si el código usa nombres no físicos (entidades JPA, atributos Java, constantes, placeholders, alias), resuélvelos hasta el nombre real (anotaciones @Table/@Column, propiedades application*.yml/.properties por perfil, constantes, consultas nativas y alias, migraciones Flyway/Liquibase) y regístralos en "mapeoNombres" con "origen" (archivo:línea) y "estado" (verificado | depende_de_entorno | pendiente_de_verificar). "nombreReal" es el identificador simple tal como aparece literalmente en "origen".
- Si das ejemplos SQL, usa SIEMPRE los nombres reales (esquema.tabla.columna), con parámetros con nombre (:idAsegurado) y un comentario con el origen de cada nombre.
- En "secciones" cubre: Propósito, Entrada, Salida, Flujo interno, Errores posibles, Cómo probarlo (los que apliquen).`;

export function construirPrompt(d: DatosPrompt): string {
  const partes: string[] = [];
  partes.push(
    `Eres un asistente que redacta documentación técnica. Responde SOLO con un objeto JSON (sin texto adicional ni bloques de código) que cumpla este JSON Schema:\n${JSON.stringify(inputSchema)}`
  );
  partes.push(REGLAS);
  partes.push(`Tipo de documento: ${d.tipo}. Formato de salida: ${d.formato}. Idioma del texto: ${d.idioma === 'es' ? 'español' : 'inglés'}.`);
  if (d.pregunta && d.pregunta.trim() !== '') {
    partes.push(`Qué documentar: ${d.pregunta.trim()}`);
  }
  if (d.tipo === 'cambio') {
    if (d.cambios && d.cambios.length > 0) {
      partes.push(`Archivos afectados:\n${d.cambios.map((c) => `- ${c.ruta} (${c.estado})`).join('\n')}`);
    }
    const diff = (d.diff ?? '').slice(0, MAX_CARACTERES_DIFF_MODELO);
    partes.push(`Diff:\n${diff || '(sin diff disponible)'}`);
  } else {
    partes.push('Archivos seleccionados:');
    for (const a of d.archivos ?? []) {
      partes.push(`--- ${a.ruta} ---\n${a.contenido}`);
    }
  }
  return partes.join('\n\n');
}

/** Extrae del primer '{' al último '}' y valida con el mismo ajv. */
export function extraerJson(texto: string): { ok: true; input: DocuInput } | { ok: false; motivo: string } {
  const i = texto.indexOf('{');
  const j = texto.lastIndexOf('}');
  if (i < 0 || j <= i) {
    return { ok: false, motivo: 'La respuesta del modelo no contiene JSON.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(texto.slice(i, j + 1));
  } catch (e) {
    return { ok: false, motivo: `JSON inválido: ${(e as Error).message}` };
  }
  const v = validarInput(parsed);
  return v.ok ? { ok: true, input: v.input } : { ok: false, motivo: `JSON no conforme al esquema: ${v.errores.join('; ')}` };
}

/** Limita el contenido total de archivos enviados al modelo (60 000 caracteres). */
export function limitarArchivos(archivos: { ruta: string; contenido: string }[]): { ruta: string; contenido: string }[] {
  let restante = MAX_CARACTERES_ARCHIVOS_MODELO;
  const salida: { ruta: string; contenido: string }[] = [];
  for (const a of archivos) {
    if (restante <= 0) {
      break;
    }
    const contenido = a.contenido.slice(0, restante);
    restante -= contenido.length;
    salida.push({ ruta: a.ruta, contenido });
  }
  return salida;
}

/** Envía el prompt al modelo y devuelve el input validado. Lanza LanguageModelError / cancelación al llamador. */
export async function redactarConModelo(
  model: vscode.LanguageModelChat,
  datos: DatosPrompt,
  token: vscode.CancellationToken
): Promise<{ ok: true; input: DocuInput } | { ok: false; motivo: string }> {
  const mensajes = [vscode.LanguageModelChatMessage.User(construirPrompt(datos))];
  const respuesta = await model.sendRequest(mensajes, {}, token);
  let texto = '';
  for await (const fragmento of respuesta.text) {
    texto += fragmento;
  }
  return extraerJson(texto);
}
