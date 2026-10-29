[🇪🇸 Leer en español](https://github.com/Ftejero21/DocuSesi-n/blob/HEAD/README.es.md)

# DocuSesión

Let's be honest: nobody became a developer for the thrill of writing documentation. The feature works, the tests are green... and then someone asks for "the Word doc".

DocuSesión writes it for you, from your actual code, while you pretend you were about to do it anyway.

**Turn your Copilot agent session into Word, Excel and PowerPoint documentation, written from your real code and git diff, with real database names and nothing invented.**

## Features

- Creates and updates **Word (docx)** and **Excel (xlsx)** documents, and creates **PowerPoint (pptx)** ones.
- Two document types: `cambio` (documents your uncommitted work; the git diff is attached automatically) and `explicacion` (explains how something that already exists works).
- **Append mode** (`anexar`): adds a new block at the end of an existing docx, imitating its structure and formatting. It reads the document first with the read-only `#estructuraDocumento` tool.
- **SQL highlighting** on request (yellow, green, blue, gray or pink).
- **Name mapping table**: code names (entities, attributes, constants...) matched to the real physical database names, validated without AI.
- The **"Documentar cambios actuales"** command works without the chat and, if no model is available, falls back to the data in the diff.
- Word and Excel **templates**.
- Fixed document labels in Spanish or English.

## Quick start

1. Install DocuSesión from the Marketplace. There is nothing to configure: tools, commands, the chat participant and settings are all registered on install.
2. Open Copilot Chat in **agent mode**.
3. Ask for what you want documented:

```
#documentacion document how the obtenerSolicitudes web service works
#documentacion document this change and highlight the SQL
#rutaDocumentacion
@docusesion /ruta
```

Note: the references (`#documentacion`, `#estructuraDocumento`, `#rutaDocumentacion`, `@docusesion`) have Spanish names, but your prompts can be written in English.

## How it works

- **It never invents names.** The model is told to resolve the real database names (JPA annotations, per-profile properties, constants, native SQL / MyBatis, migrations) and to register each one with its origin (file and line) and a status: `verificado`, `depende_de_entorno` or `pendiente_de_verificar`. The extension then validates the `verificado` ones against your files and warns if the SQL uses code names instead of physical names.
- **Documents of type `cambio`** use the git diff of your uncommitted changes (truncated to 400 lines in the document).
- **Safe writes.** Creating never overwrites: if the file exists, a copy with a date suffix is created. Updating respects the styles of the document itself. Appending only adds at the end.
- **Confirmations.** VS Code asks for confirmation before invoking the tool, and before modifying an existing docx or xlsx a modal shows the plan of changes (Update / Append at the end / Cancel). If an appended block has a duplicate title you can replace it, use another title or cancel.
- **Backups** are kept in `.docusesion/backups` inside your workspace.

## Where documents are saved

Priority order: **path given in the chat > path chosen for this time > `docusesion.rutaPorDefecto` > picker**.

- **Path given in the chat**: used as is.
- **Path for this time only**: chosen with the "Cambiar ruta de destino" command. It is kept in memory, used once and expires after 30 minutes.
- **Default path** (`docusesion.rutaPorDefecto`): a folder (a new file named after the title is created inside) or a `.docx` / `.xlsx` / `.pptx` file.
- **Picker**: if none of the above applies, you choose between creating a new document, adding to an existing one, or cancelling (in which case Copilot asks you in the chat).

Absolute paths outside the workspace require `docusesion.permitirRutasFueraDelWorkspace`, except the path you pick yourself in a dialog. Relative paths can never leave the workspace.

Example `settings.json`:

```json
{
  // A folder relative to the workspace: creates docs/<title>.docx
  "docusesion.rutaPorDefecto": "docs"
}
```

To see or change the path at any time use the `#rutaDocumentacion` tool, `@docusesion /ruta`, or the path commands listed below.

## Settings

All settings have `resource` scope (they can be set per workspace folder).

| Setting | Default | What it does |
| --- | --- | --- |
| `docusesion.rutaPorDefecto` | `""` | Folder or `.docx` / `.xlsx` / `.pptx` file; empty shows the picker |
| `docusesion.permitirRutasFueraDelWorkspace` | `false` | Allows absolute paths outside the workspace; relative ones never leave it; backups stay in the workspace |
| `docusesion.plantillaWord` | `""` | `.docx` template with `{titulo}`, `{fecha}` and `{resumen}` |
| `docusesion.plantillaExcel` | `""` | `.xlsx` template |
| `docusesion.idioma` | `"es"` | `es` \| `en`: fixed labels of the document and of the result |

## Commands

- **DocuSesión: Documentar cambios actuales** (Document current changes): documents your current changes from the command palette, without the chat.
- **DocuSesión: Configurar ruta por defecto** (Configure default path): choose or remove the default destination.
- **DocuSesión: Cambiar ruta de destino** (Change destination path): choose a destination for the next documentation only, or as the default.

Also available: the chat participant `@docusesion /ruta` and the tool `#rutaDocumentacion`.

## Requirements

- VS Code 1.143.0 or later.
- GitHub Copilot Chat in agent mode (needed for the `#` tools).
- A trusted workspace (untrusted and virtual workspaces are not supported).
- `git` in the PATH for documents of type `cambio`.

## Privacy

- DocuSesión makes **no network calls of its own**. The only external service is your own Copilot model, through `vscode.lm`.
- Document contents, diffs and code are never written to logs.
- Writing outside the workspace is restricted: it only happens when the destination is an absolute path and `docusesion.permitirRutasFueraDelWorkspace` is enabled.
- `#estructuraDocumento` is read-only; it sends the headings of the document and a sample block to the model.
- Only the stable VS Code API is used.

## Known limitations

- Headings inside `w:sdt` content controls or inside tables are not processed when updating a docx.
- Bullets do not use real Word numbering (they carry a "•" prefix).
- The diff covers the whole repository (not only the open workspace) and is truncated to 400 lines in the document.
- pptx is only created, never updated, and examples are not included in it (so they are not highlighted).
- SQL highlighting is limited in xlsx (only the cells of SQL examples) and in pptx (only the code lines of sections).
- `nombreReal` validation uses the simple identifier; qualified names (`schema.table`) are not detected.
- Matching sections between two runs depends on the model reusing the same headings.
- The interface (commands, modals and pickers) is in Spanish; the labels inside the documents can be set to English with `docusesion.idioma`.

## License

MIT. See the [LICENSE](https://github.com/Ftejero21/DocuSesi-n/blob/HEAD/LICENSE) file.
