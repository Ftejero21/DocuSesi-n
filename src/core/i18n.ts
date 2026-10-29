import { normalizar } from './texto';
import { EstadoMapeo, Idioma, TipoDoc, TipoEjemplo, TipoObjeto } from './tipos';

export interface Etiquetas {
  // Secciones fijas
  resumen: string;
  ejemplos: string;
  correspondencia: string;
  archivosAfectados: string;
  archivosConsultados: string;
  avisos: string;
  historial: string;
  // Portada
  fecha: string;
  autor: string;
  tipoDocumento: string;
  // Tablas
  cabMapeo: [string, string, string, string, string, string];
  cabArchivos: [string, string];
  cabHistorial: [string, string, string, string];
  cabRegistro: [string, string, string, string, string];
  cabEjemplos: [string, string, string, string];
  // Hojas Excel
  hojaRegistro: string;
  hojaMapeo: string;
  hojaEjemplos: string;
  // Valores
  tipoDoc: Record<TipoDoc, string>;
  tipoEjemplo: Record<TipoEjemplo, string>;
  tipoObjeto: Record<TipoObjeto, string>;
  estado: Record<EstadoMapeo, string>;
  // Textos sueltos
  sinAvisos: (fecha: string) => string;
  diffTruncado: (mostradas: number, total: number) => string;
  sinDiff: string;
  marcaCambio: (fecha: string, titulo: string) => string;
  // Resultado de la herramienta
  res: {
    archivo: string;
    accion: string;
    acciones: Record<string, string>;
    seccionesCreadas: string;
    seccionesActualizadas: string;
    encabezados: string;
    backup: string;
    mapeosDegradados: string;
    avisos: string;
    ninguno: string;
    corrige: string;
    corrigeAnexado: string;
    sinDestino: string;
    sinDocumentoEstructura: string;
    selectorCancelado: string;
    documentoExistenteElegido: (ruta: string) => string;
    documentoElegidoEstructura: (ruta: string) => string;
    confirmacionAnexar: (ruta: string) => string;
    confirmacionCancelada: string;
    anexarCancelado: (titulo: string) => string;
    sustituidoUltimo: (titulo: string, n: number) => string;
    tituloAlternativoExiste: (titulo: string) => string;
    noReintentar: string;
  };
  // Confirmaciones nativas (modales) antes de modificar contenido existente
  confirmacion: {
    mensajeActualizar: string;
    detalleArchivo: string;
    cabSustituir: string;
    cabAmpliar: string;
    cabAnadir: string;
    ninguna: string;
    opActualizar: string;
    opAnexar: string;
    opCancelar: string;
    ampliarFilas: (encabezado: string) => string;
    ampliarEjemplos: (encabezado: string) => string;
    ampliarCambio: (encabezado: string, marca: string) => string;
    filaHistorial: (encabezado: string) => string;
    filaRegistro: (hoja: string) => string;
    hojaNueva: (hoja: string) => string;
    formatoVisual: (color: string) => string;
    filaMapeo: (hoja: string, nombre: string, tipo: string) => string;
    filaEjemplo: (hoja: string, titulo: string) => string;
    duplicadoMensaje: (titulo: string, nivel: number) => string;
    duplicadoDetalle: string;
    duplicadoVarias: (n: number) => string;
    opSustituir: string;
    opNuevoTitulo: string;
    inputTitulo: string;
    inputPrompt: string;
    errTituloVacio: string;
    errTituloExiste: (titulo: string) => string;
    prepararActualizar: string;
  };
  // Selector nativo de destino (QuickPick y diálogos)
  selector: {
    tituloQuickPick: string;
    placeHolder: string;
    nuevo: string;
    nuevoDetalle: string;
    existente: string;
    existenteDetalle: string;
    cancelar: string;
    cancelarDetalle: string;
    tituloGuardar: string;
    etiquetaGuardar: string;
    tituloAbrir: string;
    etiquetaAbrir: string;
    filtroDocumentos: string;
    extensionNoSoportada: (ext: string) => string;
    formatoNoCoincide: (ext: string, formato: string) => string;
  };
  // Configuración de la ruta por defecto / ruta elegida para esta vez
  rutaHerramienta: {
    invocando: string;
    tituloMenu: string;
    opMantener: string;
    opMantenerDetalle: (ruta: string) => string;
    opCambiar: string;
    opCambiarDetalle: string;
    accion: {
      mantener: string;
      defecto: (ruta: string) => string;
      defectoNoGuardada: (ruta: string) => string;
      estaVez: (ruta: string) => string;
      quitada: string;
      estaVezQuitada: string;
      cancelado: string;
    };
    lineaPorDefecto: (v: string) => string;
    lineaEstaVez: (ruta: string, minutos: number) => string;
    lineaSinEstaVez: string;
    ningunaSelector: string;
    lineaProxima: (v: string) => string;
    instruccionModelo: string;
    ayudaParticipante: string;
    botonCambiarRutaDestino: string;
    botonConfigurarRuta: string;
  };
  ruta: {
    tituloConfigurar: string;
    tituloCambiar: string;
    rutaActual: (v: string) => string;
    ninguna: string;
    estaVezActiva: (ruta: string) => string;
    opCarpeta: string;
    opCarpetaDetalle: string;
    opExistente: string;
    opExistenteDetalle: string;
    opNuevo: string;
    opNuevoDetalle: string;
    opQuitar: string;
    opQuitarDetalle: string;
    opQuitarEstaVez: string;
    opQuitarEstaVezDetalle: string;
    dlgCarpetaTitulo: string;
    dlgCarpetaEtiqueta: string;
    errCarpetaConExtension: (nombre: string) => string;
    tituloUso: string;
    placeHolderUso: string;
    usoPorDefecto: string;
    usoPorDefectoDetalle: string;
    usoEstaVez: string;
    usoEstaVezDetalle: string;
    preguntaGuardar: string;
    placeHolderGuardar: string;
    soloEstaVez: string;
    soloEstaVezDetalle: string;
    guardarComoDefecto: string;
    guardarComoDefectoDetalle: string;
    tituloCarpetaODoc: string;
    esteCarpeta: (dir: string) => string;
    esteDocumento: (nombre: string) => string;
    tituloAmbito: string;
    placeHolderAmbito: string;
    ambitoUsuario: string;
    ambitoUsuarioDetalle: string;
    ambitoArea: string;
    ambitoAreaDetalle: string;
    ambitoCarpeta: (nombre: string) => string;
    ambitoCarpetaDetalle: string;
    fueraMensaje: (ruta: string) => string;
    fueraDetalle: string;
    activarYGuardar: string;
    guardada: (valor: string, ambito: string) => string;
    noAplicada: (ambito: string) => string;
    quitada: string;
    quitadaConLegado: (valor: string) => string;
    estaVezEstablecida: (ruta: string, minutos: number) => string;
    estaVezQuitada: string;
    errorGuardar: (msg: string) => string;
    prepararEstaVez: (ruta: string) => string;
    estructuraEstaVez: string;
    botonCambiarRuta: string;
  };
}

const es: Etiquetas = {
  resumen: 'Resumen',
  ejemplos: 'Ejemplos',
  correspondencia: 'Correspondencia de nombres con la base de datos',
  archivosAfectados: 'Archivos afectados',
  archivosConsultados: 'Archivos consultados',
  avisos: 'Avisos de verificación',
  historial: 'Historial de cambios',
  fecha: 'Fecha',
  autor: 'Autor',
  tipoDocumento: 'Tipo de documento',
  cabMapeo: ['Nombre en código', 'Nombre real', 'Tipo', 'Origen', 'Estado', 'Notas'],
  cabArchivos: ['Archivo', 'Estado'],
  cabHistorial: ['Fecha', 'Tipo', 'Título', 'Resumen'],
  cabRegistro: ['Fecha', 'Tipo', 'Título', 'Resumen', 'Archivos'],
  cabEjemplos: ['Título', 'Tipo', 'Explicación', 'Contenido'],
  hojaRegistro: 'Registro',
  hojaMapeo: 'Mapeo BD',
  hojaEjemplos: 'Ejemplos',
  tipoDoc: { cambio: 'Cambio', explicacion: 'Explicación' },
  tipoEjemplo: { peticion: 'Petición', sql: 'SQL', codigo: 'Código', otro: 'Otro' },
  tipoObjeto: {
    base_datos: 'Base de datos',
    esquema: 'Esquema',
    tabla: 'Tabla',
    vista: 'Vista',
    columna: 'Columna',
    secuencia: 'Secuencia',
    procedimiento: 'Procedimiento',
    sinonimo: 'Sinónimo'
  },
  estado: {
    verificado: 'Verificado',
    depende_de_entorno: 'Depende de entorno',
    pendiente_de_verificar: 'Pendiente de verificar'
  },
  sinAvisos: (f) => `Sin avisos en la última actualización (${f})`,
  diffTruncado: (m, t) => `Diff truncado: se muestran ${m} de ${t} líneas.`,
  sinDiff: 'No se pudo obtener el diff (no hay repositorio git o no hay cambios).',
  marcaCambio: (f, ti) => `Cambio ${f}: ${ti}`,
  res: {
    archivo: 'Archivo',
    accion: 'Acción',
    acciones: {
      creado: 'creado',
      actualizado: 'actualizado',
      creado_desde_plantilla: 'creado desde plantilla',
      nuevo_con_sufijo: 'nuevo archivo con sufijo de fecha',
      no_escrito: 'no escrito (el documento no se ha creado ni modificado)',
      anexado: 'añadido al final (el contenido existente no se ha modificado)',
      sin_cambios: 'sin cambios (este bloque ya estaba añadido al final del documento; no se ha modificado nada)',
      sustituido: 'bloque sustituido (solo se ha reemplazado el bloque con ese título; el resto del documento no se ha modificado)'
    },
    seccionesCreadas: 'Secciones creadas',
    seccionesActualizadas: 'Secciones actualizadas',
    encabezados: 'Encabezados actuales del documento',
    backup: 'Copia de seguridad',
    mapeosDegradados: 'Mapeos degradados a pendiente_de_verificar',
    avisos: 'Avisos',
    ninguno: '(ninguno)',
    corrige: 'Corrige los avisos y vuelve a invocar la herramienta.',
    corrigeAnexado: 'El bloque ya está en el documento: NO vuelvas a invocar la herramienta para este título; informa de los avisos al usuario.',
    sinDestino:
      'No se ha indicado destino y no hay ruta por defecto configurada (ajuste "docusesion.rutaPorDefecto"): el documento NO se ha creado ni modificado. ' +
      'NO inventes una ruta. Pregunta al usuario si quiere crear un documento NUEVO (y en qué ruta, relativa al workspace o absoluta) o AÑADIR la documentación a un documento EXISTENTE (cuál). ' +
      'Después vuelve a invocar la herramienta con "destino"; si es un documento existente y se añade documentación nueva, invoca antes docusesion_leerEstructura y luego esta herramienta con modo "anexar". ' +
      'El usuario también puede configurar una ruta por defecto en Ajustes > DocuSesión > Ruta por defecto.',
    sinDocumentoEstructura:
      'No se ha indicado qué documento leer y la ruta por defecto (ajuste "docusesion.rutaPorDefecto") no está configurada o es una carpeta. ' +
      'NO inventes una ruta: pregunta al usuario a qué documento existente quiere añadir la documentación (o si prefiere crear uno nuevo y dónde) y vuelve a invocar con "destino".',
    selectorCancelado:
      'El usuario cerró el selector de destino de DocuSesión sin elegir nada. Pregúntale en el chat dónde guardar la documentación; NO vuelvas a invocar la herramienta sin "destino".',
    documentoExistenteElegido: (ruta) =>
      `El usuario ha elegido en el selector el documento existente "${ruta}". NO se ha escrito nada todavía. ` +
      `Invoca ahora docusesion_leerEstructura con destino "${ruta}" y después invoca docusesion_documentar UNA sola vez con modo "anexar" y el mismo destino "${ruta}", ` +
      'reproduciendo el patrón del documento (regla 7). No omitas el destino ni vuelvas a preguntar al usuario.',
    documentoElegidoEstructura: (ruta) =>
      `El usuario ha elegido el documento "${ruta}": usa exactamente este destino en docusesion_documentar con modo "anexar".`,
    confirmacionAnexar: (ruta) =>
      `El usuario ha elegido NO modificar el contenido existente de "${ruta}" y añadir al final. NO se ha escrito nada. ` +
      `Si aún no lo has hecho, invoca docusesion_leerEstructura con destino "${ruta}" y después invoca docusesion_documentar UNA sola vez con modo "anexar" y el mismo destino, ` +
      'imitando el patrón del documento (regla 7). No uses "actualizar" ni "auto".',
    confirmacionCancelada:
      'El usuario ha cancelado la modificación del documento existente. NO se ha escrito nada. NO reintentes con otro modo ni con otro título: pregunta al usuario en el chat qué quiere hacer.',
    anexarCancelado: (titulo) =>
      `El usuario ha cancelado: el documento ya tiene un bloque "${titulo}" y no se ha escrito nada. NO reintentes con otro modo ni con otro título: pregunta al usuario en el chat qué quiere hacer.`,
    sustituidoUltimo: (titulo, n) =>
      `El documento tenía ${n} bloques con el título "${titulo}": se ha sustituido solo el último; los demás no se han modificado.`,
    tituloAlternativoExiste: (titulo) =>
      `El título alternativo "${titulo}" está vacío o ya existe como encabezado de ese nivel. No se ha escrito nada. NO reintentes con otro título: pregunta al usuario en el chat qué quiere hacer.`,
    noReintentar: 'Sigue la instrucción del usuario indicada en los avisos y no vuelvas a invocar la herramienta con otro modo ni con otro título.'
  },
  confirmacion: {
    mensajeActualizar: 'DocuSesión va a modificar un documento existente',
    detalleArchivo: 'Archivo',
    cabSustituir: 'Se sustituirán',
    cabAmpliar: 'Se ampliarán',
    cabAnadir: 'Se añadirán',
    ninguna: '(ninguna)',
    opActualizar: 'Actualizar (modificar secciones existentes)',
    opAnexar: 'Añadir al final sin tocar nada (anexar)',
    opCancelar: 'Cancelar',
    ampliarFilas: (e) => `${e} (las filas con la misma clave se sobrescriben; el resto se añade)`,
    ampliarEjemplos: (e) => `${e} (los ejemplos con el mismo título se sobrescriben; el resto se añade)`,
    ampliarCambio: (e, m) => `${e} (subapartado "${m}")`,
    filaHistorial: (e) => `${e} (fila nueva)`,
    filaRegistro: (h) => `${h}: fila nueva de registro`,
    hojaNueva: (h) => `Hoja nueva: ${h}`,
    formatoVisual: (c) => `**Formato visual:** resaltar SQL (${c})`,
    filaMapeo: (h, n, t) => `${h}: ${n} (${t})`,
    filaEjemplo: (h, ti) => `${h}: ${ti}`,
    duplicadoMensaje: (t, n) => `El documento ya tiene un bloque «${t}» (nivel ${n}) con contenido distinto`,
    duplicadoDetalle: 'Elige qué hacer. No se modificará nada más del documento.',
    duplicadoVarias: (n) => `Hay ${n} bloques con ese título: se sustituirá el último. No se modificará nada más del documento.`,
    opSustituir: 'Sustituir ese bloque',
    opNuevoTitulo: 'Añadir como bloque nuevo con otro título',
    inputTitulo: 'DocuSesión: título del bloque nuevo',
    inputPrompt: 'Título que no coincida con ningún bloque existente',
    errTituloVacio: 'El título no puede estar vacío.',
    errTituloExiste: (t) => `Ya existe un bloque con el título «${t}».`,
    prepararActualizar:
      'Actualizar el archivo existente: antes de escribir, DocuSesión te mostrará qué secciones se modificarán y pedirá confirmación (con copia de seguridad)'
  },
  selector: {
    tituloQuickPick: 'DocuSesión: ¿dónde guardar la documentación?',
    placeHolder: 'Elige cómo quieres guardar la documentación',
    nuevo: 'Crear documento nuevo…',
    nuevoDetalle: 'Elige la carpeta y el nombre del documento nuevo (Word, Excel o PowerPoint).',
    existente: 'Añadir a un documento existente…',
    existenteDetalle: 'Elige un documento Word, Excel o PowerPoint al que añadir la documentación.',
    cancelar: 'Cancelar / responder en el chat',
    cancelarDetalle: 'No se escribe nada; Copilot te preguntará dónde guardar en el chat.',
    tituloGuardar: 'DocuSesión: dónde guardar el documento nuevo',
    etiquetaGuardar: 'Guardar documentación aquí',
    tituloAbrir: 'Elige el documento al que añadir la documentación',
    etiquetaAbrir: 'Elegir este documento',
    filtroDocumentos: 'Documentos',
    extensionNoSoportada: (ext) =>
      ext === ''
        ? 'El archivo elegido no tiene extensión. Usa docx, xlsx o pptx.'
        : `Extensión no soportada en el archivo elegido (.${ext}). Usa docx, xlsx o pptx.`,
    formatoNoCoincide: (ext, formato) =>
      `La extensión del archivo elegido (.${ext}) no coincide con el formato solicitado (${formato}).`
  },
  rutaHerramienta: {
    invocando: 'Abriendo el selector de la ruta de la documentación…',
    tituloMenu: 'DocuSesión: ruta de la documentación',
    opMantener: 'Mantener la ruta actual',
    opMantenerDetalle: (r) => `No se cambia nada. Ruta que se usará: ${r}`,
    opCambiar: 'Cambiar ruta…',
    opCambiarDetalle: 'Elige una carpeta o un documento y decide si es solo para la próxima documentación o por defecto.',
    accion: {
      mantener: 'El usuario mantuvo la ruta actual; no se ha cambiado nada.',
      defecto: (r) => `El usuario guardó ${r} como ruta por defecto.`,
      defectoNoGuardada: (r) => `El usuario no llegó a guardar ${r} como ruta por defecto; no se ha cambiado la ruta por defecto.`,
      estaVez: (r) => `El usuario eligió ${r} solo para la próxima documentación.`,
      quitada: 'El usuario quitó la ruta por defecto.',
      estaVezQuitada: 'El usuario descartó la ruta elegida para esta vez.',
      cancelado: 'El usuario canceló; no se ha cambiado nada.'
    },
    lineaPorDefecto: (v) => `Ruta por defecto vigente: ${v}`,
    lineaEstaVez: (r, m) => `Ruta solo para la próxima documentación: ${r} (caduca en ${m} min)`,
    lineaSinEstaVez: 'Ruta solo para la próxima documentación: ninguna',
    ningunaSelector: 'ninguna: se mostrará un selector',
    lineaProxima: (v) => `Ruta que se usará en la próxima documentación sin destino: ${v}`,
    instruccionModelo:
      'No documentes nada salvo que el usuario lo haya pedido en el mismo mensaje; en ese caso invoca docusesion_documentar SIN "destino". Si el usuario canceló, no vuelvas a invocar esta herramienta.',
    ayudaParticipante:
      'Soy **DocuSesión**. Usa **/ruta** para ver o cambiar dónde se guarda la documentación (solo para la próxima vez o por defecto).\n\n' +
      'Para documentar escribe **#documentacion** en el chat (modo agente). Con **#rutaDocumentacion** el agente abre este mismo selector al enviar el mensaje.',
    botonCambiarRutaDestino: 'Cambiar ruta de destino',
    botonConfigurarRuta: 'Configurar ruta por defecto'
  },
  ruta: {
    tituloConfigurar: 'DocuSesión: configurar la ruta por defecto',
    tituloCambiar: 'DocuSesión: cambiar la ruta de destino',
    rutaActual: (v) => `Ruta por defecto actual: ${v}`,
    ninguna: 'ninguna: se pregunta cada vez',
    estaVezActiva: (ruta) => `Ruta elegida para esta vez: ${ruta}`,
    opCarpeta: 'Carpeta…',
    opCarpetaDetalle: 'Se crea un documento nuevo con el nombre del título dentro de esa carpeta.',
    opExistente: 'Documento existente…',
    opExistenteDetalle: 'Se usa siempre ese documento Word, Excel o PowerPoint.',
    opNuevo: 'Documento nuevo…',
    opNuevoDetalle: 'Elige la carpeta y el nombre de un documento que todavía no existe.',
    opQuitar: 'Quitar la ruta por defecto',
    opQuitarDetalle: 'Se elimina de Usuario, Área de trabajo y Carpeta del área de trabajo: se volverá a preguntar cada vez.',
    opQuitarEstaVez: 'Quitar la ruta elegida para esta vez',
    opQuitarEstaVezDetalle: 'Descarta la ruta temporal; se usará la ruta por defecto o el selector.',
    dlgCarpetaTitulo: 'DocuSesión: elige la carpeta de destino',
    dlgCarpetaEtiqueta: 'Elegir esta carpeta',
    errCarpetaConExtension: (n) =>
      `La carpeta elegida («${n}») termina en .docx, .xlsx o .pptx y se interpretaría como un documento. Elige otra carpeta.`,
    tituloUso: 'DocuSesión: ¿cómo usar esta ruta?',
    placeHolderUso: 'Elige para qué usar la ruta',
    usoPorDefecto: 'Usar como ruta por defecto',
    usoPorDefectoDetalle: 'Se guarda en los ajustes y se reutiliza en cada documentación.',
    usoEstaVez: 'Solo para la próxima documentación',
    usoEstaVezDetalle: 'Solo en memoria: se usa una vez y caduca a los 30 minutos.',
    preguntaGuardar: 'DocuSesión: ¿guardar esta ruta como predeterminada?',
    placeHolderGuardar: '¿Guardar esta ruta como predeterminada?',
    soloEstaVez: 'Solo esta vez',
    soloEstaVezDetalle: 'No se guarda nada; la próxima vez se volverá a preguntar.',
    guardarComoDefecto: 'Guardar como ruta por defecto',
    guardarComoDefectoDetalle: 'Se guarda en los ajustes (docusesion.rutaPorDefecto).',
    tituloCarpetaODoc: 'DocuSesión: ¿qué guardar como ruta por defecto?',
    esteCarpeta: (d) => `Esta carpeta (${d})`,
    esteDocumento: (n) => `Este documento (${n})`,
    tituloAmbito: 'DocuSesión: ¿dónde guardar la ruta por defecto?',
    placeHolderAmbito: 'Elige el ámbito del ajuste',
    ambitoUsuario: 'Usuario',
    ambitoUsuarioDetalle: 'Para todos tus proyectos (ruta absoluta).',
    ambitoArea: 'Área de trabajo',
    ambitoAreaDetalle: 'Solo para este proyecto (ruta relativa si está dentro del workspace).',
    ambitoCarpeta: (n) => `Carpeta del área de trabajo (${n})`,
    ambitoCarpetaDetalle: 'Solo para esta carpeta del área de trabajo.',
    fueraMensaje: (r) => `La ruta «${r}» queda fuera del workspace. ¿Activar «docusesion.permitirRutasFueraDelWorkspace» y guardarla?`,
    fueraDetalle:
      'La ruta por defecto se reutilizará en invocaciones futuras propuestas por el modelo, y la aprobación por diálogo solo dura 30 minutos. ' +
      'Por eso, para guardarla hay que activar el ajuste «permitirRutasFueraDelWorkspace» en el mismo ámbito. Si cancelas, no se guarda nada.',
    activarYGuardar: 'Activar y guardar',
    guardada: (v, a) => `DocuSesión: ruta por defecto guardada (${a}): ${v}`,
    noAplicada: (a) =>
      `DocuSesión: se ha guardado en ${a}, pero otro ámbito con más prioridad define un valor distinto y prevalece. Revisa los ajustes de DocuSesión.`,
    quitada: 'DocuSesión: ruta por defecto quitada. Se preguntará cada vez.',
    quitadaConLegado: (v) =>
      `DocuSesión: se quitó la ruta por defecto, pero sigue vigente el ajuste obsoleto «carpetaPorDefecto» (${v}). Elimínalo de tu settings.json.`,
    estaVezEstablecida: (r, m) => `DocuSesión: la próxima documentación se guardará en ${r} (caduca en ${m} min).`,
    estaVezQuitada: 'DocuSesión: ruta elegida para esta vez descartada.',
    errorGuardar: (m) => `DocuSesión: no se pudo guardar el ajuste: ${m}`,
    prepararEstaVez: (r) => `**Destino:** ruta elegida para esta vez (\`${r}\`)\n\n`,
    estructuraEstaVez: 'Leyendo la estructura del documento (ruta elegida para esta vez)…',
    botonCambiarRuta: 'Cambiar ruta por defecto'
  }
};

const en: Etiquetas = {
  resumen: 'Summary',
  ejemplos: 'Examples',
  correspondencia: 'Mapping of code names to database names',
  archivosAfectados: 'Affected files',
  archivosConsultados: 'Consulted files',
  avisos: 'Verification warnings',
  historial: 'Change history',
  fecha: 'Date',
  autor: 'Author',
  tipoDocumento: 'Document type',
  cabMapeo: ['Name in code', 'Real name', 'Type', 'Source', 'Status', 'Notes'],
  cabArchivos: ['File', 'Status'],
  cabHistorial: ['Date', 'Type', 'Title', 'Summary'],
  cabRegistro: ['Date', 'Type', 'Title', 'Summary', 'Files'],
  cabEjemplos: ['Title', 'Type', 'Explanation', 'Content'],
  hojaRegistro: 'Log',
  hojaMapeo: 'DB Mapping',
  hojaEjemplos: 'Examples',
  tipoDoc: { cambio: 'Change', explicacion: 'Explanation' },
  tipoEjemplo: { peticion: 'Request', sql: 'SQL', codigo: 'Code', otro: 'Other' },
  tipoObjeto: {
    base_datos: 'Database',
    esquema: 'Schema',
    tabla: 'Table',
    vista: 'View',
    columna: 'Column',
    secuencia: 'Sequence',
    procedimiento: 'Procedure',
    sinonimo: 'Synonym'
  },
  estado: {
    verificado: 'Verified',
    depende_de_entorno: 'Environment dependent',
    pendiente_de_verificar: 'Pending verification'
  },
  sinAvisos: (f) => `No warnings in the last update (${f})`,
  diffTruncado: (m, t) => `Diff truncated: showing ${m} of ${t} lines.`,
  sinDiff: 'The diff could not be obtained (no git repository or no changes).',
  marcaCambio: (f, ti) => `Change ${f}: ${ti}`,
  res: {
    archivo: 'File',
    accion: 'Action',
    acciones: {
      creado: 'created',
      actualizado: 'updated',
      creado_desde_plantilla: 'created from template',
      nuevo_con_sufijo: 'new file with date suffix',
      no_escrito: 'not written (the document was not created or modified)',
      anexado: 'appended at the end (existing content was not modified)',
      sin_cambios: 'unchanged (this block was already appended at the end of the document; nothing was modified)',
      sustituido: 'block replaced (only the block with that title was replaced; the rest of the document was not modified)'
    },
    seccionesCreadas: 'Sections created',
    seccionesActualizadas: 'Sections updated',
    encabezados: 'Current headings of the document',
    backup: 'Backup',
    mapeosDegradados: 'Mappings downgraded to pendiente_de_verificar',
    avisos: 'Warnings',
    ninguno: '(none)',
    corrige: 'Fix the warnings and invoke the tool again.',
    corrigeAnexado: 'The block is already in the document: do NOT invoke the tool again for this title; report the warnings to the user.',
    sinDestino:
      'No destino was given and no default path is configured (setting "docusesion.rutaPorDefecto"): the document was NOT created or modified. ' +
      'Do NOT invent a path. Ask the user whether to create a NEW document (and at which path, relative to the workspace or absolute) or to ADD the documentation to an EXISTING document (which one). ' +
      'Then invoke the tool again with "destino"; if it is an existing document and new documentation is added, first invoke docusesion_leerEstructura and then this tool with modo "anexar". ' +
      'The user can also configure a default path in Settings > DocuSesión > Ruta por defecto.',
    sinDocumentoEstructura:
      'No destino was given for the document to read, and the default path (setting "docusesion.rutaPorDefecto") is not configured or is a folder. ' +
      'Do NOT invent a path: ask the user which existing document to add the documentation to (or whether they prefer a new one and where) and invoke again with "destino".',
    selectorCancelado:
      'The user closed the DocuSesión destination picker without choosing anything. Ask them in the chat where to save the documentation; do NOT invoke the tool again without "destino".',
    documentoExistenteElegido: (ruta) =>
      `The user selected the existing document "${ruta}" in the picker. Nothing has been written yet. ` +
      `Now invoke docusesion_leerEstructura with destino "${ruta}" and then invoke docusesion_documentar ONCE with modo "anexar" and the same destino "${ruta}", ` +
      'reproducing the document pattern (rule 7). Do not omit the destino and do not ask the user again.',
    documentoElegidoEstructura: (ruta) =>
      `The user chose the document "${ruta}": use exactly this destino in docusesion_documentar with modo "anexar".`,
    confirmacionAnexar: (ruta) =>
      `The user chose NOT to modify the existing content of "${ruta}" and to append at the end instead. Nothing was written. ` +
      `If you have not done so yet, invoke docusesion_leerEstructura with destino "${ruta}" and then invoke docusesion_documentar ONCE with modo "anexar" and the same destino, ` +
      'reproducing the document pattern (rule 7). Do not use "actualizar" or "auto".',
    confirmacionCancelada:
      'The user cancelled the modification of the existing document. Nothing was written. Do NOT retry with another modo or another title: ask the user in the chat what they want to do.',
    anexarCancelado: (titulo) =>
      `The user cancelled: the document already has a block "${titulo}" and nothing was written. Do NOT retry with another modo or another title: ask the user in the chat what they want to do.`,
    sustituidoUltimo: (titulo, n) =>
      `The document had ${n} blocks titled "${titulo}": only the last one was replaced; the others were not modified.`,
    tituloAlternativoExiste: (titulo) =>
      `The alternative title "${titulo}" is empty or already exists as a heading of that level. Nothing was written. Do NOT retry with another title: ask the user in the chat what they want to do.`,
    noReintentar: "Follow the user's instruction given in the warnings and do not invoke the tool again with another modo or another title."
  },
  confirmacion: {
    mensajeActualizar: 'DocuSesión is about to modify an existing document',
    detalleArchivo: 'File',
    cabSustituir: 'Will be replaced',
    cabAmpliar: 'Will be extended',
    cabAnadir: 'Will be added',
    ninguna: '(none)',
    opActualizar: 'Update (modify existing sections)',
    opAnexar: 'Add at the end without touching anything (append)',
    opCancelar: 'Cancel',
    ampliarFilas: (e) => `${e} (rows with the same key are overwritten; the rest is added)`,
    ampliarEjemplos: (e) => `${e} (examples with the same title are overwritten; the rest is added)`,
    ampliarCambio: (e, m) => `${e} (sub-heading "${m}")`,
    filaHistorial: (e) => `${e} (new row)`,
    filaRegistro: (h) => `${h}: new log row`,
    hojaNueva: (h) => `New sheet: ${h}`,
    formatoVisual: (c) => `**Visual format:** highlight SQL (${c})`,
    filaMapeo: (h, n, t) => `${h}: ${n} (${t})`,
    filaEjemplo: (h, ti) => `${h}: ${ti}`,
    duplicadoMensaje: (t, n) => `The document already has a block «${t}» (level ${n}) with different content`,
    duplicadoDetalle: 'Choose what to do. Nothing else in the document will be modified.',
    duplicadoVarias: (n) => `There are ${n} blocks with that title: the last one will be replaced. Nothing else in the document will be modified.`,
    opSustituir: 'Replace that block',
    opNuevoTitulo: 'Add as a new block with another title',
    inputTitulo: 'DocuSesión: title of the new block',
    inputPrompt: 'A title that does not match any existing block',
    errTituloVacio: 'The title cannot be empty.',
    errTituloExiste: (t) => `A block titled «${t}» already exists.`,
    prepararActualizar:
      'Update the existing file: before writing, DocuSesión will show which sections will be modified and ask for confirmation (with a backup)'
  },
  selector: {
    tituloQuickPick: 'DocuSesión: where to save the documentation?',
    placeHolder: 'Choose how to save the documentation',
    nuevo: 'Create a new document…',
    nuevoDetalle: 'Choose the folder and name of the new document (Word, Excel or PowerPoint).',
    existente: 'Add to an existing document…',
    existenteDetalle: 'Choose a Word, Excel or PowerPoint document to add the documentation to.',
    cancelar: 'Cancel / answer in the chat',
    cancelarDetalle: 'Nothing is written; Copilot will ask you in the chat where to save.',
    tituloGuardar: 'DocuSesión: where to save the new document',
    etiquetaGuardar: 'Save documentation here',
    tituloAbrir: 'Choose the document to add the documentation to',
    etiquetaAbrir: 'Choose this document',
    filtroDocumentos: 'Documents',
    extensionNoSoportada: (ext) =>
      ext === ''
        ? 'The chosen file has no extension. Use docx, xlsx or pptx.'
        : `Unsupported extension in the chosen file (.${ext}). Use docx, xlsx or pptx.`,
    formatoNoCoincide: (ext, formato) =>
      `The extension of the chosen file (.${ext}) does not match the requested format (${formato}).`
  },
  rutaHerramienta: {
    invocando: 'Opening the documentation path picker…',
    tituloMenu: 'DocuSesión: documentation path',
    opMantener: 'Keep the current path',
    opMantenerDetalle: (r) => `Nothing changes. Path that will be used: ${r}`,
    opCambiar: 'Change path…',
    opCambiarDetalle: 'Choose a folder or a document and decide whether it is only for the next documentation or the default.',
    accion: {
      mantener: 'The user kept the current path; nothing was changed.',
      defecto: (r) => `The user saved ${r} as the default path.`,
      defectoNoGuardada: (r) => `The user did not finish saving ${r} as the default path; the default path was not changed.`,
      estaVez: (r) => `The user chose ${r} only for the next documentation.`,
      quitada: 'The user removed the default path.',
      estaVezQuitada: 'The user discarded the path chosen for this time.',
      cancelado: 'The user cancelled; nothing was changed.'
    },
    lineaPorDefecto: (v) => `Current default path: ${v}`,
    lineaEstaVez: (r, m) => `Path only for the next documentation: ${r} (expires in ${m} min)`,
    lineaSinEstaVez: 'Path only for the next documentation: none',
    ningunaSelector: 'none: a picker will be shown',
    lineaProxima: (v) => `Path that will be used in the next documentation without destination: ${v}`,
    instruccionModelo:
      'Do not document anything unless the user asked for it in the same message; in that case invoke docusesion_documentar WITHOUT "destino". If the user cancelled, do not invoke this tool again.',
    ayudaParticipante:
      'I am **DocuSesión**. Use **/ruta** to see or change where the documentation is saved (only for the next time or as default).\n\n' +
      'To document, write **#documentacion** in the chat (agent mode). With **#rutaDocumentacion** the agent opens this same picker when you send the message.',
    botonCambiarRutaDestino: 'Change destination path',
    botonConfigurarRuta: 'Configure default path'
  },
  ruta: {
    tituloConfigurar: 'DocuSesión: configure the default path',
    tituloCambiar: 'DocuSesión: change the destination path',
    rutaActual: (v) => `Current default path: ${v}`,
    ninguna: 'none: asked every time',
    estaVezActiva: (ruta) => `Path chosen for this time: ${ruta}`,
    opCarpeta: 'Folder…',
    opCarpetaDetalle: 'A new document named after the title is created inside that folder.',
    opExistente: 'Existing document…',
    opExistenteDetalle: 'That Word, Excel or PowerPoint document is always used.',
    opNuevo: 'New document…',
    opNuevoDetalle: 'Choose the folder and name of a document that does not exist yet.',
    opQuitar: 'Remove the default path',
    opQuitarDetalle: 'Removed from User, Workspace and Workspace folder: you will be asked every time.',
    opQuitarEstaVez: 'Remove the path chosen for this time',
    opQuitarEstaVezDetalle: 'Discards the temporary path; the default path or the picker will be used.',
    dlgCarpetaTitulo: 'DocuSesión: choose the destination folder',
    dlgCarpetaEtiqueta: 'Choose this folder',
    errCarpetaConExtension: (n) =>
      `The chosen folder ("${n}") ends in .docx, .xlsx or .pptx and would be interpreted as a document. Choose another folder.`,
    tituloUso: 'DocuSesión: how to use this path?',
    placeHolderUso: 'Choose how to use the path',
    usoPorDefecto: 'Use as default path',
    usoPorDefectoDetalle: 'Saved in the settings and reused for every documentation.',
    usoEstaVez: 'Only for the next documentation',
    usoEstaVezDetalle: 'Memory only: used once and expires after 30 minutes.',
    preguntaGuardar: 'DocuSesión: save this path as the default?',
    placeHolderGuardar: 'Save this path as the default?',
    soloEstaVez: 'Only this time',
    soloEstaVezDetalle: 'Nothing is saved; you will be asked again next time.',
    guardarComoDefecto: 'Save as default path',
    guardarComoDefectoDetalle: 'Saved in the settings (docusesion.rutaPorDefecto).',
    tituloCarpetaODoc: 'DocuSesión: what to save as the default path?',
    esteCarpeta: (d) => `This folder (${d})`,
    esteDocumento: (n) => `This document (${n})`,
    tituloAmbito: 'DocuSesión: where to save the default path?',
    placeHolderAmbito: 'Choose the scope of the setting',
    ambitoUsuario: 'User',
    ambitoUsuarioDetalle: 'For all your projects (absolute path).',
    ambitoArea: 'Workspace',
    ambitoAreaDetalle: 'Only for this project (relative path when inside the workspace).',
    ambitoCarpeta: (n) => `Workspace folder (${n})`,
    ambitoCarpetaDetalle: 'Only for this workspace folder.',
    fueraMensaje: (r) => `The path "${r}" is outside the workspace. Enable "docusesion.permitirRutasFueraDelWorkspace" and save it?`,
    fueraDetalle:
      'The default path will be reused in future invocations proposed by the model, and the approval given through a dialog only lasts 30 minutes. ' +
      'That is why saving it requires enabling the "permitirRutasFueraDelWorkspace" setting in the same scope. If you cancel, nothing is saved.',
    activarYGuardar: 'Enable and save',
    guardada: (v, a) => `DocuSesión: default path saved (${a}): ${v}`,
    noAplicada: (a) =>
      `DocuSesión: saved in ${a}, but another scope with higher priority defines a different value and prevails. Check the DocuSesión settings.`,
    quitada: 'DocuSesión: default path removed. You will be asked every time.',
    quitadaConLegado: (v) =>
      `DocuSesión: the default path was removed, but the obsolete "carpetaPorDefecto" setting (${v}) is still in effect. Delete it from your settings.json.`,
    estaVezEstablecida: (r, m) => `DocuSesión: the next documentation will be saved in ${r} (expires in ${m} min).`,
    estaVezQuitada: 'DocuSesión: path chosen for this time discarded.',
    errorGuardar: (m) => `DocuSesión: the setting could not be saved: ${m}`,
    prepararEstaVez: (r) => `**Destination:** path chosen for this time (\`${r}\`)\n\n`,
    estructuraEstaVez: 'Reading the document structure (path chosen for this time)…',
    botonCambiarRuta: 'Change default path'
  }
};

export function i18n(idioma: Idioma): Etiquetas {
  return idioma === 'en' ? en : es;
}

export type ClaveSeccionFija = 'resumen' | 'ejemplos' | 'correspondencia' | 'archivosAfectados' | 'archivosConsultados' | 'avisos' | 'historial';

/** Textos normalizados (es y en) que identifican una sección fija, para reconocerla en documentos existentes. */
export function aliasNormalizados(clave: ClaveSeccionFija): string[] {
  return [normalizar(es[clave]), normalizar(en[clave])];
}

export function esHistorial(texto: string): boolean {
  return aliasNormalizados('historial').includes(normalizar(texto));
}

/** Textos normalizados con los que puede aparecer un tipo de objeto: clave cruda, etiqueta es y etiqueta en. */
export function aliasTipoObjeto(tipo: TipoObjeto): string[] {
  return [tipo, es.tipoObjeto[tipo], en.tipoObjeto[tipo]].map((v) => normalizar(v));
}

/** Etiquetas (es y en, sin repetir) con las que se rotula el tipo de un ejemplo. */
export function etiquetasTipoEjemplo(): string[] {
  return [...new Set([...Object.values(es.tipoEjemplo), ...Object.values(en.tipoEjemplo)])];
}
