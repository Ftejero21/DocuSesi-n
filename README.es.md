[🇬🇧 Read in English](https://github.com/Ftejero21/DocuSesi-n/blob/HEAD/README.md)

# DocuSesión

Seamos sinceros: nadie se hizo programador por la emoción de escribir documentación. La funcionalidad va, los tests están en verde... y entonces alguien pide "el Word".

DocuSesión lo escribe por ti, a partir de tu código real, mientras tú finges que ya ibas a hacerlo.

**Convierte tu sesión del agente de Copilot en documentación Word, Excel y PowerPoint, escrita a partir de tu código real y tu diff de git, con los nombres reales de la base de datos y sin inventar nada.**

## Características

- Crea y actualiza documentos **Word (docx)** y **Excel (xlsx)**, y crea documentos **PowerPoint (pptx)**.
- Dos tipos de documento: `cambio` (documenta tu trabajo sin commitear; el diff de git se adjunta automáticamente) y `explicacion` (explica cómo funciona algo que ya existe).
- **Modo añadir** (`anexar`): añade un bloque nuevo al final de un docx existente, imitando su estructura y su formato. Primero lee el documento con la herramienta de solo lectura `#estructuraDocumento`.
- **Resaltado de SQL** a petición (amarillo, verde, azul, gris o rosa).
- **Tabla de correspondencia de nombres**: los nombres del código (entidades, atributos, constantes...) emparejados con los nombres físicos reales de la base de datos, validada sin IA.
- El comando **"Documentar cambios actuales"** funciona sin el chat y, si no hay modelo disponible, recurre a los datos del diff.
- **Plantillas** de Word y Excel.
- Etiquetas fijas del documento en español o en inglés.

## Inicio rápido

1. Instala DocuSesión desde el Marketplace. No hay nada que configurar: las herramientas, los comandos, el participante de chat y los ajustes se registran al instalar.
2. Abre Copilot Chat en **modo agente**.
3. Pide lo que quieras documentar:

```
#documentacion documenta cómo funciona el web service obtenerSolicitudes
#documentacion documenta este cambio y resalta las sql
#rutaDocumentacion
@docusesion /ruta
```

Nota: las referencias (`#documentacion`, `#estructuraDocumento`, `#rutaDocumentacion`, `@docusesion`) tienen nombres en español, pero tus prompts pueden escribirse en inglés.

## Cómo funciona

- **Nunca inventa nombres.** Al modelo se le indica que resuelva los nombres reales de la base de datos (anotaciones JPA, propiedades por perfil, constantes, SQL nativo / MyBatis, migraciones) y que registre cada uno con su origen (archivo y línea) y un estado: `verificado`, `depende_de_entorno` o `pendiente_de_verificar`. Después la extensión valida los `verificado` contra tus archivos y avisa si el SQL usa nombres del código en lugar de nombres físicos.
- **Los documentos de tipo `cambio`** usan el diff de git de tus cambios sin commitear (truncado a 400 líneas en el documento).
- **Escritura segura.** Crear nunca sobrescribe: si el archivo existe, se crea una copia con sufijo de fecha. Actualizar respeta los estilos del propio documento. Anexar solo añade al final.
- **Confirmaciones.** VS Code pide confirmación antes de invocar la herramienta y, antes de modificar un docx o xlsx existente, un modal muestra el plan de cambios (Actualizar / Añadir al final / Cancelar). Si un bloque anexado tiene un título duplicado puedes sustituirlo, usar otro título o cancelar.
- **Copias de seguridad** en `.docusesion/backups`, dentro de tu workspace.

## Dónde se guardan los documentos

Orden de prioridad: **ruta indicada en el chat > ruta elegida para esta vez > `docusesion.rutaPorDefecto` > selector**.

- **Ruta indicada en el chat**: se usa tal cual.
- **Ruta solo para esta vez**: se elige con el comando "Cambiar ruta de destino". Se guarda en memoria, se usa una sola vez y caduca a los 30 minutos.
- **Ruta por defecto** (`docusesion.rutaPorDefecto`): una carpeta (se crea dentro un archivo nuevo con el nombre del título) o un archivo `.docx` / `.xlsx` / `.pptx`.
- **Selector**: si no se cumple nada de lo anterior, eliges entre crear un documento nuevo, añadir a uno existente o cancelar (en cuyo caso Copilot te pregunta en el chat).

Las rutas absolutas fuera del workspace requieren `docusesion.permitirRutasFueraDelWorkspace`, salvo la ruta que eliges tú mismo en un diálogo. Las rutas relativas nunca pueden salir del workspace.

Ejemplo de `settings.json`:

```json
{
  // Carpeta relativa al workspace: se crea docs/<titulo>.docx
  "docusesion.rutaPorDefecto": "docs"
}
```

Para ver o cambiar la ruta en cualquier momento usa la herramienta `#rutaDocumentacion`, `@docusesion /ruta` o los comandos de ruta que se listan más abajo.

## Ajustes

Todos los ajustes tienen ámbito `resource` (se pueden definir por carpeta del workspace).

| Ajuste | Por defecto | Qué hace |
| --- | --- | --- |
| `docusesion.rutaPorDefecto` | `""` | Carpeta o archivo `.docx` / `.xlsx` / `.pptx`; vacío muestra el selector |
| `docusesion.permitirRutasFueraDelWorkspace` | `false` | Permite rutas absolutas fuera del workspace; las relativas nunca salen; las copias de seguridad siguen en el workspace |
| `docusesion.plantillaWord` | `""` | Plantilla `.docx` con `{titulo}`, `{fecha}` y `{resumen}` |
| `docusesion.plantillaExcel` | `""` | Plantilla `.xlsx` |
| `docusesion.idioma` | `"es"` | `es` \| `en`: etiquetas fijas del documento y del resultado |

## Comandos

- **DocuSesión: Documentar cambios actuales**: documenta tus cambios actuales desde la paleta de comandos, sin el chat.
- **DocuSesión: Configurar ruta por defecto**: elige o quita el destino por defecto.
- **DocuSesión: Cambiar ruta de destino**: elige un destino solo para la próxima documentación o como ruta por defecto.

También disponibles: el participante de chat `@docusesion /ruta` y la herramienta `#rutaDocumentacion`.

## Requisitos

- VS Code 1.143.0 o superior.
- GitHub Copilot Chat en modo agente (necesario para las herramientas `#`).
- Un workspace de confianza (no se admiten workspaces no confiables ni virtuales).
- `git` en el PATH para los documentos de tipo `cambio`.

## Privacidad

- DocuSesión **no hace ninguna llamada de red propia**. El único servicio externo es tu propio modelo de Copilot, a través de `vscode.lm`.
- El contenido de los documentos, los diffs y el código nunca se escriben en logs.
- La escritura fuera del workspace está restringida: solo ocurre cuando el destino es una ruta absoluta y está activado `docusesion.permitirRutasFueraDelWorkspace`.
- `#estructuraDocumento` es de solo lectura; envía al modelo los encabezados del documento y un bloque de muestra.
- Solo se usa la API estable de VS Code.

## Limitaciones conocidas

- Al actualizar un docx no se procesan los encabezados dentro de controles de contenido `w:sdt` ni dentro de tablas.
- Las viñetas no usan numeración real de Word (llevan el prefijo "•").
- El diff es del repositorio completo (no solo del workspace abierto) y se trunca a 400 líneas en el documento.
- pptx solo se crea, nunca se actualiza, y no incluye ejemplos (por tanto no se resaltan).
- El resaltado de SQL es limitado en xlsx (solo las celdas de los ejemplos SQL) y en pptx (solo las líneas de código de las secciones).
- La validación de `nombreReal` usa el identificador simple; no detecta nombres calificados (`esquema.tabla`).
- Que las secciones coincidan entre dos ejecuciones depende de que el modelo reutilice los mismos encabezados.
- La interfaz (comandos, modales y selectores) está en español; las etiquetas dentro de los documentos pueden ponerse en inglés con `docusesion.idioma`.

## Licencia

MIT. Consulta el archivo [LICENSE](https://github.com/Ftejero21/DocuSesi-n/blob/HEAD/LICENSE).
