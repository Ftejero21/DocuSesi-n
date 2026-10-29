import { MAX_LINEAS_DIFF_DOC } from './constantes';
import { formatoFecha, truncarLineas } from './texto';
import { CambioGit, DocuInput, Idioma, TipoDoc } from './tipos';

const MAX_CARACTERES = 90000;

/** Documento generado solo con los datos disponibles (sin modelo): diff y archivos. */
export function inputDesdeDatos(p: {
  tipo: TipoDoc;
  fecha: Date;
  idioma: Idioma;
  cambios?: CambioGit[];
  diff?: string;
  archivos?: string[];
  pregunta?: string;
}): DocuInput {
  const es = p.idioma === 'es';
  const f = formatoFecha(p.fecha);
  if (p.tipo === 'cambio') {
    const lista = (p.cambios ?? []).map((c) => `- ${c.ruta} (${c.estado})`).join('\n');
    const input: DocuInput = {
      tipo: 'cambio',
      titulo: es ? `Cambios ${f}` : `Changes ${f}`,
      resumen: es
        ? 'Documentación generada automáticamente a partir del diff actual, sin redacción por modelo.'
        : 'Documentation generated automatically from the current diff, without model-written text.',
      secciones: [
        {
          encabezado: es ? 'Resumen de cambios' : 'Summary of changes',
          contenido: lista || (es ? 'No hay archivos cambiados.' : 'There are no changed files.')
        }
      ]
    };
    if (p.diff && p.diff.trim() !== '') {
      const tr = truncarLineas(p.diff, MAX_LINEAS_DIFF_DOC);
      input.ejemplos = [
        {
          titulo: 'Diff',
          tipo: 'codigo',
          contenido: tr.texto.slice(0, MAX_CARACTERES),
          explicacion: es ? 'Diff actual del repositorio (staged y unstaged).' : 'Current repository diff (staged and unstaged).'
        }
      ];
    }
    return input;
  }
  const archivos = p.archivos ?? [];
  return {
    tipo: 'explicacion',
    titulo: es ? `Explicación ${f}` : `Explanation ${f}`,
    resumen:
      p.pregunta && p.pregunta.trim() !== ''
        ? p.pregunta.trim()
        : es
          ? 'Documentación generada automáticamente a partir de los archivos seleccionados, sin redacción por modelo.'
          : 'Documentation generated automatically from the selected files, without model-written text.',
    secciones: [
      {
        encabezado: es ? 'Archivos analizados' : 'Analyzed files',
        contenido: archivos.length ? archivos.map((a) => `- ${a}`).join('\n') : es ? 'No se seleccionaron archivos.' : 'No files were selected.'
      }
    ],
    archivosConsultados: archivos
  };
}
