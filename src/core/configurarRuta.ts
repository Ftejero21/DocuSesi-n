import * as path from 'path';
import { estaDentro } from './rutas';

/**
 * Valor a guardar en docusesion.rutaPorDefecto. Ámbito área de trabajo y ruta dentro del workspace → relativa POSIX
 * ('.' si es la propia raíz); en otro caso absoluta. 'fuera' indica que la ruta queda fuera del workspace.
 */
export function valorRutaPorDefecto(
  abs: string,
  root: string,
  ambito: 'usuario' | 'areaTrabajo'
): { valor: string; fuera: boolean } {
  if (!path.isAbsolute(abs)) {
    throw new Error('La ruta debe ser absoluta.');
  }
  const fuera = !estaDentro(root, abs);
  if (ambito === 'areaTrabajo' && !fuera) {
    return { valor: path.relative(root, abs).split(path.sep).join('/') || '.', fuera };
  }
  return { valor: path.normalize(abs), fuera };
}
