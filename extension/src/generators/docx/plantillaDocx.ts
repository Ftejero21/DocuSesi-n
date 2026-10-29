import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { limpiarControl } from '../../core/texto';

/**
 * Rellena {titulo}, {fecha} y {resumen} en la COPIA recién hecha de la plantilla.
 * Nunca se aplica a documentos existentes. Lanza si docxtemplater falla (el llamador usa la plantilla sin rellenar).
 */
export function rellenarPlantilla(
  bufferPlantilla: Buffer,
  datos: { titulo: string; fecha: string; resumen: string }
): Buffer {
  const doc = new Docxtemplater(new PizZip(bufferPlantilla), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => ''
  });
  doc.render({
    titulo: limpiarControl(datos.titulo),
    fecha: limpiarControl(datos.fecha),
    resumen: limpiarControl(datos.resumen)
  });
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}
