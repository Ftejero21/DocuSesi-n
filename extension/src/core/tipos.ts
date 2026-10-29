export type TipoDoc = 'cambio' | 'explicacion';
export type Formato = 'docx' | 'xlsx' | 'pptx';
export type Modo = 'crear' | 'actualizar' | 'auto' | 'anexar';
export type EstadoMapeo = 'verificado' | 'depende_de_entorno' | 'pendiente_de_verificar';
export type TipoObjeto =
  | 'base_datos'
  | 'esquema'
  | 'tabla'
  | 'vista'
  | 'columna'
  | 'secuencia'
  | 'procedimiento'
  | 'sinonimo';
export type TipoEjemplo = 'peticion' | 'sql' | 'codigo' | 'otro';
export type Idioma = 'es' | 'en';
export type ColorResaltado = 'amarillo' | 'verde' | 'azul' | 'gris' | 'rosa';

export interface FormatoVisual {
  resaltarSql?: boolean;
  colorResaltado?: ColorResaltado;
}

export interface Seccion {
  encabezado: string;
  contenido: string;
}

export interface Ejemplo {
  titulo: string;
  tipo: TipoEjemplo;
  contenido: string;
  explicacion: string;
}

export interface MapeoNombre {
  nombreEnCodigo: string;
  nombreReal: string;
  tipoObjeto: TipoObjeto;
  origen: string;
  estado: EstadoMapeo;
  notas?: string;
}

export interface DocuInput {
  tipo: TipoDoc;
  titulo: string;
  resumen: string;
  secciones?: Seccion[];
  ejemplos?: Ejemplo[];
  mapeoNombres?: MapeoNombre[];
  archivosConsultados?: string[];
  formato?: Formato;
  destino?: string;
  modo?: Modo;
  formatoVisual?: FormatoVisual;
}

export interface CambioGit {
  ruta: string;
  estado: string;
}

/** Plan de cambios que se muestra al usuario antes de modificar un documento existente. */
export interface PlanActualizacion {
  formato: 'docx' | 'xlsx';
  sustituir: string[];
  ampliar: string[];
  anadir: string[];
}

export type DecisionActualizacion = 'actualizar' | 'anexar' | 'cancelar';

export interface InfoTituloDuplicado {
  titulo: string;
  nivel: number;
  ocurrencias: number;
  /** Textos de los encabezados de nivel base del documento. */
  titulosExistentes: string[];
}

export type DecisionDuplicado = { accion: 'sustituir' } | { accion: 'nuevoTitulo'; titulo: string } | { accion: 'cancelar' };

export interface ContextoGeneracion {
  root: string;
  rutaDestino: string;
  backupDir: string;
  fecha: Date;
  autor: string;
  idioma: Idioma;
  diff?: string;
  cambios?: CambioGit[];
  plantilla?: string;
  avisos: string[];
  /** Opt-in (herramienta LM): en tipo "cambio", no escribir si el contenido no menciona ningún archivo cambiado. */
  exigirMencionCambios?: boolean;
  /** Si true, se admite rutaDestino absoluta fuera de root; los backups siguen en backupDir. */
  permitirFueraDelWorkspace?: boolean;
  /** UI inyectada: confirmación previa a modificar un archivo existente (modo efectivo "actualizar"). Sin callback no se pregunta. */
  confirmarActualizacion?: (plan: PlanActualizacion) => Promise<DecisionActualizacion>;
  /** UI inyectada: qué hacer en "anexar" cuando ya existe un bloque con el mismo título y contenido distinto. */
  resolverTituloDuplicado?: (info: InfoTituloDuplicado) => Promise<DecisionDuplicado>;
}

export interface ResultadoGeneracion {
  rutaFinal: string;
  accion: 'creado' | 'actualizado' | 'creado_desde_plantilla' | 'nuevo_con_sufijo' | 'no_escrito' | 'anexado' | 'sin_cambios' | 'sustituido';
  seccionesCreadas: string[];
  seccionesActualizadas: string[];
  encabezados: { texto: string; nivel: number }[];
  backup?: string;
  avisos: string[];
  mapeosDegradados?: string[];
  /** Decisión del usuario cuando no se escribe por su elección. */
  decisionUsuario?: 'anexar' | 'cancelar';
}
