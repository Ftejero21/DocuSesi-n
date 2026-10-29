# DocuSesión: desarrollo

Este archivo no se incluye en el `.vsix` (ver `.vscodeignore`).

## Cómo probarlo

### 1. Arrancar el Extension Development Host

1. Abre la carpeta `extension/` en VS Code (1.143 o superior) y ejecuta `npm install` si no lo has hecho.
2. Pulsa **F5** y elige la configuración **Run Extension**. Se compila (`npm: bundle`) y se abre un Extension Development Host con la carpeta `demo-angular` abierta.
3. En esa ventana inicia sesión en GitHub Copilot, abre el chat en **modo agente** y comprueba que `#documentacion` está disponible. Confía en la carpeta cuando lo pida.

### Prueba A: explicación (documento nuevo desde plantilla)

Escribe en el chat:

```
#documentacion documenta cómo funciona el Web Service obtenerSolicitudesAsegurados y da ejemplos de cómo comprobar en la base de datos una solicitud por idAsegurado y póliza en docs/diseno.docx
```

Comprueba que:

1. Se pide confirmación antes de generar el documento.
2. Se crea `docs/diseno.docx` desde la plantilla (`docs/plantillas/plantilla-diseno.docx`): `{titulo}`, `{fecha}` y `{resumen}` rellenados, las secciones del modelo insertadas antes de "Historial de cambios" y una fila nueva en el historial.
3. El SQL usa `T_SOL_ASEG`, `ID_ASEG` y `NUM_POL`, no los nombres Java (`SolicitudAsegurado`, `idAsegurado`, `numeroPoliza`).
4. El esquema aparece como `depende_de_entorno` (`SEGUROS_DEV` / `SEGUROS_PRE`) en una fila azul, y la tabla "Correspondencia de nombres con la base de datos" está completa (incluye `fechaAlta` -> `fecha_alta` por la estrategia de nombres).
5. No aparece el diff ni "Archivos afectados" (solo "Archivos consultados").

### Prueba B: cambio (actualización con backup)

1. En `demo-angular/backend/src/main/java/com/demo/solicitudes/entity/SolicitudAsegurado.java` añade:

   ```java
   @Column(name = "ESTADO")
   private String estado;
   ```

   (con su getter y setter si quieres) y en `demo-angular/backend/src/main/resources/db/migration/V1__crear_tablas.sql` añade la columna `ESTADO VARCHAR(20)` a `T_SOL_ASEG`.
2. Escribe en el chat:

   ```
   #documentacion documenta este cambio en docs/diseno.docx
   ```

3. Comprueba que:
   - Se crea una copia de seguridad en `.docusesion/backups/diseno-YYYYMMDD-HHmmss.docx`.
   - Las secciones que coinciden con las existentes se sustituyen sin duplicarse y se añade una fila al historial.
   - Aparecen "Archivos afectados" y el diff, sin el propio `docs/diseno.docx` ni `.docusesion/`.

### Prueba C: sin destino

La demo **no** tiene ruta por defecto, a propósito. Escribe en el chat:

```
#documentacion documenta cómo funciona el Web Service obtenerSolicitudesAsegurados
```

Comprueba que no se pide confirmación de escritura y que aparece el selector "DocuSesión: ¿dónde guardar la documentación?". Prueba las tres opciones:

1. **Crear documento nuevo…**: elige una ruta en el diálogo "Guardar" (también fuera del workspace) y comprueba que se genera el documento.
2. **Añadir a un documento existente…**: elige un `.docx`; no se escribe en esa invocación y Copilot lee la estructura y añade al final con `anexar`.
3. **Cancelar / responder en el chat** (o Escape): no se escribe nada (ni `docs/` ni `.docusesion/`) y Copilot te pregunta en el chat.

Para probar la ruta por defecto, añade por ejemplo a `demo-angular/.vscode/settings.json`:

```json
"docusesion.rutaPorDefecto": "docs"
```

y repite la petición sin indicar ruta: se crea `docs/<titulo>.docx` y la confirmación indica que se usa la ruta por defecto.

### Probar el comando

En el Extension Development Host: `Ctrl+Shift+P` -> **DocuSesión: Documentar cambios actuales**. Elige tipo, formato y destino. Con Copilot disponible redacta el contenido; sin sesión de Copilot (o cancelando) genera el documento solo con los datos del diff.

### Instalar el .vsix

```
npm run package
code --install-extension docusesion-0.1.0.vsix
```

## Desarrollo

| Comando | Qué hace |
| --- | --- |
| `npm run compile` | Compila con `tsc` a `out/` (usado por los tests). |
| `npm test` | Compila y ejecuta los tests Mocha (`out/test/**/*.test.js`). |
| `npm run bundle` / `npm run bundle:prod` | Empaqueta con esbuild a `dist/extension.js` (el segundo, minificado). |
| `npm run fixtures` | Regenera `test-fixtures/documento-es.docx`. |
| `npm run icon` | Regenera `images/icon.png` (128x128) con `scripts/generar-icono.mjs`, sin dependencias. |
| `npm run package` | Genera el `.vsix` con `@vscode/vsce` (sin `node_modules`: todo va en el bundle). |
| `npm run publish:vsce` | Publica en el Marketplace de VS Code con `@vscode/vsce` (ver "Publicación"). |

`src/core/**` y `src/generators/**` no importan `vscode`, por lo que se prueban con Mocha sin el editor.

## Limitaciones de desarrollo

- exceljs, pptxgenjs y docx se empaquetan en el bundle; se recomienda comprobarlo manualmente con F5.
- Desarrollado y probado con Node 18.13 (fin de vida), lo que fija vsce 2.x, mocha 10 y TypeScript 5.9.

## Publicación

1. Crea el publisher `ftejero` en https://marketplace.visualstudio.com/manage.
2. Crea un Personal Access Token en https://dev.azure.com: Organization "All accessible organizations" y scope Marketplace -> Manage.
3. Inicia sesión con vsce (pide el PAT de forma interactiva; no lo escribas en ningún archivo ni script):

   ```
   node -r ./scripts/node18-file-shim.cjs ./node_modules/@vscode/vsce/vsce login ftejero
   ```

4. Sube el código a https://github.com/Ftejero21/DocuSesi-n (rama por defecto): `package.json` (`repository`, `bugs`, `homepage`) y los enlaces de `README.md`/`README.es.md` (idioma y LICENSE) apuntan a ese repositorio, así que deben existir allí `extension/README.md`, `extension/README.es.md` y `extension/LICENSE` (el repositorio tiene la extensión en la subcarpeta `extension/`).
5. Ejecuta `npm test`, `npm run package` y revisa el contenido del paquete:

   ```
   node -r ./scripts/node18-file-shim.cjs ./node_modules/@vscode/vsce/vsce ls --no-dependencies
   ```

6. Publica con `npm run publish:vsce` (o `npm run publish:vsce -- patch` / `-- minor` para subir la versión antes de publicar).
7. Open VSX (opcional, sin dependencia en el proyecto): crea una cuenta en https://open-vsx.org, acepta el Publisher Agreement de Eclipse, genera un token y ejecuta (`<TOKEN>` es un marcador, no escribas el valor real en archivos):

   ```
   npx ovsx create-namespace ftejero -p <TOKEN>
   npx ovsx publish docusesion-0.1.0.vsix -p <TOKEN>
   ```

   Nota: las versiones recientes de ovsx pueden requerir Node >= 20 (no verificado).
