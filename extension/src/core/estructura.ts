import * as fs from 'fs';
import { formatearEstructuraDocx, leerEstructuraDocx } from '../generators/docx/estructuraDocx';
import { MAX_BYTES_ESTRUCTURA } from './constantes';
import { Formato } from './tipos';

/** Texto (en inglés, para el modelo) con la estructura del documento. Solo lee; nunca escribe. */
export async function leerEstructura(abs: string, formato: Formato): Promise<string> {
  let stat: fs.Stats | undefined;
  try {
    stat = await fs.promises.stat(abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      throw new Error(`No se pudo acceder a "${abs}": ${(e as Error).message}`);
    }
  }
  if (!stat) {
    return [
      `File: ${abs}`,
      'exists: no',
      `Format: ${formato}`,
      'docusesion_documentar will create a new document (modo "anexar" on a missing file behaves as "crear").'
    ].join('\n');
  }
  if (!stat.isFile()) {
    throw new Error(`La ruta no es un archivo: ${abs}`);
  }

  const cab = [`File: ${abs}`, 'exists: yes', `Format: ${formato}`];
  if (formato === 'xlsx') {
    return [
      ...cab,
      'Structure analysis not supported for xlsx.',
      'With docusesion_documentar (any modo except "crear") the rows are added to the log sheet of the existing workbook; modo "anexar" behaves as "auto" for xlsx.'
    ].join('\n');
  }
  if (formato === 'pptx') {
    return [
      ...cab,
      'Structure analysis not supported for pptx.',
      'docusesion_documentar never modifies an existing pptx: it always creates a new file with a date suffix.'
    ].join('\n');
  }

  if (stat.size > MAX_BYTES_ESTRUCTURA) {
    throw new Error(
      `El documento es demasiado grande para analizar su estructura (${Math.round(stat.size / (1024 * 1024))} MB; máximo ${Math.round(MAX_BYTES_ESTRUCTURA / (1024 * 1024))} MB).`
    );
  }
  const buffer = await fs.promises.readFile(abs);
  const estructura = leerEstructuraDocx(buffer);
  return [...cab, formatearEstructuraDocx(estructura)].join('\n');
}
