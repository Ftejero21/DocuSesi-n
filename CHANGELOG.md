# Changelog

## 0.1.0 - 2026-10-29

Initial public release.

- Copilot agent tools: `#documentacion` (creates or updates the document), `#estructuraDocumento` (read-only structure of an existing docx) and `#rutaDocumentacion` (see or change where documentation is saved).
- Chat participant `@docusesion` with the `/ruta` command, which opens the destination picker in any chat mode.
- Commands: "DocuSesión: Documentar cambios actuales", "DocuSesión: Configurar ruta por defecto" and "DocuSesión: Cambiar ruta de destino".
- Create and update docx and xlsx documents; create pptx documents.
- Two document types: `cambio` (attaches the uncommitted git diff) and `explicacion`.
- Append mode (`anexar`): adds a block at the end of an existing docx imitating its structure and formatting, with a dialog to replace, rename or cancel on duplicate titles.
- Confirmations with a plan of changes before modifying an existing docx or xlsx, and backups in `.docusesion/backups`.
- Destination picker, path for this time only and default path (`docusesion.rutaPorDefecto`), with the priority: chat path > path for this time > default path > picker.
- SQL highlighting on request (yellow, green, blue, gray or pink).
- Validation, without AI, of the mapping between code names and real database names.
- Word and Excel templates (`docusesion.plantillaWord`, `docusesion.plantillaExcel`).
- Document labels in Spanish or English (`docusesion.idioma`).
