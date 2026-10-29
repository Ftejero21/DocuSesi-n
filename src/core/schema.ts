// Esquema de entrada de la herramienta. DEBE ser idéntico al de package.json (lo comprueba schema.test.ts).
export const inputSchema: Record<string, unknown> = {
  "type": "object",
  "properties": {
    "tipo": {
      "type": "string",
      "enum": [
        "cambio",
        "explicacion"
      ],
      "description": "Document type. 'cambio' documents the uncommitted modifications of the workspace git working tree (not the generation of the document): the git diff and the 'affected files' table are attached automatically. 'explicacion' documents how something that already exists works: NO diff and NO changed files are attached, only 'archivosConsultados'."
    },
    "titulo": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500,
      "description": "Document title (short, descriptive)."
    },
    "resumen": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100000,
      "description": "Summary of what was done or what is being explained, and why. Plain text."
    },
    "secciones": {
      "type": "array",
      "maxItems": 50,
      "description": "Document sections. Cover: purpose, input (parameters and validations), output (response structure), internal flow (controller -> service -> repository -> DB), possible errors and how to test it. Reuse existing or canonical headings exactly so that an update replaces the section instead of duplicating it.",
      "items": {
        "type": "object",
        "properties": {
          "encabezado": {
            "type": "string",
            "maxLength": 500,
            "description": "Section heading. May be empty (\"\") only with modo 'anexar' to place content directly under the title."
          },
          "contenido": {
            "type": "string",
            "maxLength": 100000,
            "description": "Section body. Plain text; lines starting with '- ' become bullets; fenced blocks (```) become code paragraphs. In modo 'anexar' fenced blocks use the code format of the document."
          }
        },
        "required": [
          "encabezado",
          "contenido"
        ]
      }
    },
    "ejemplos": {
      "type": "array",
      "maxItems": 50,
      "description": "Optional verification examples (sample requests, verification SQL). SQL examples must use the REAL physical names resolved in mapeoNombres.",
      "items": {
        "type": "object",
        "properties": {
          "titulo": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500,
            "description": "Example title."
          },
          "tipo": {
            "type": "string",
            "enum": [
              "peticion",
              "sql",
              "codigo",
              "otro"
            ],
            "description": "Example kind: 'peticion' (HTTP/SOAP request), 'sql' (verification query), 'codigo' or 'otro'."
          },
          "contenido": {
            "type": "string",
            "maxLength": 100000,
            "description": "The example itself (request, SQL, code)."
          },
          "explicacion": {
            "type": "string",
            "maxLength": 100000,
            "description": "What the example shows and how to read it."
          }
        },
        "required": [
          "titulo",
          "tipo",
          "contenido",
          "explicacion"
        ]
      }
    },
    "mapeoNombres": {
      "type": "array",
      "maxItems": 500,
      "description": "Mapping between names used in code and real physical database names. REQUIRED whenever the document mentions tables, columns, schemas or databases.",
      "items": {
        "type": "object",
        "properties": {
          "nombreEnCodigo": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500,
            "description": "Name as it appears in code (entity, attribute, constant, variable, placeholder)."
          },
          "nombreReal": {
            "type": "string",
            "minLength": 1,
            "maxLength": 500,
            "description": "Physical name in the database: the simple unqualified identifier, exactly as it appears literally in \"origen\"."
          },
          "tipoObjeto": {
            "type": "string",
            "enum": [
              "base_datos",
              "esquema",
              "tabla",
              "vista",
              "columna",
              "secuencia",
              "procedimiento",
              "sinonimo"
            ],
            "description": "Kind of database object."
          },
          "origen": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000,
            "description": "File and line where the real name was resolved, relative to the workspace, e.g. src/main/resources/application-pre.yml:12. Several references may be given separated by ';' (path[:line] each); 'verificado' is kept if nombreReal appears in at least one of them."
          },
          "estado": {
            "type": "string",
            "enum": [
              "verificado",
              "depende_de_entorno",
              "pendiente_de_verificar"
            ],
            "description": "'verificado': confirmed in the file named in origen. 'depende_de_entorno': value changes per environment (list the values in notas). 'pendiente_de_verificar': could not be verified."
          },
          "notas": {
            "type": "string",
            "maxLength": 5000,
            "description": "Optional notes, e.g. the value per environment."
          }
        },
        "required": [
          "nombreEnCodigo",
          "nombreReal",
          "tipoObjeto",
          "origen",
          "estado"
        ]
      }
    },
    "archivosConsultados": {
      "type": "array",
      "maxItems": 500,
      "description": "Workspace-relative paths of the files that were read to write the document.",
      "items": {
        "type": "string",
        "maxLength": 1000
      }
    },
    "formato": {
      "type": "string",
      "enum": [
        "docx",
        "xlsx",
        "pptx"
      ],
      "description": "Output format. Optional: when missing it is deduced from the extension of \"destino\" (default docx)."
    },
    "destino": {
      "type": "string",
      "maxLength": 1000,
      "description": "Optional output path: relative to the workspace (e.g. docs/diseno.docx) or absolute (e.g. C:/Users/me/Desktop/doc.docx). Absolute paths outside the workspace require the setting docusesion.permitirRutasFueraDelWorkspace. Extension must be docx, xlsx or pptx (or none). Only set it when the user said where to save; NEVER invent it. When missing, the default path of the setting docusesion.rutaPorDefecto is used (a folder: new file named after titulo; or a document file); if no default path is configured the extension shows the user a picker to choose where to save (see rule 8)."
    },
    "modo": {
      "type": "string",
      "enum": [
        "crear",
        "actualizar",
        "auto",
        "anexar"
      ],
      "default": "auto",
      "description": "'crear' never overwrites (a dated copy is created if the file exists); 'actualizar' updates an existing file; 'auto' (default) updates if the file exists and creates it otherwise; 'anexar' (docx) ONLY appends a new block at the end of an existing document (titulo as a top-level heading, secciones as sub-headings) imitating its existing structure and format, never modifying existing content; it creates the file normally if it does not exist. 'actualizar'/'auto' on an existing file always ask the user for confirmation before writing."
    },
    "formatoVisual": {
      "type": "object",
      "description": "Optional visual formatting explicitly requested by the user (e.g. \"resalta las sql\", \"highlight the SQL in yellow\"). Omit it when the user did not ask for any visual format. Applies only to the new content written by this invocation; existing content is never restyled.",
      "properties": {
        "resaltarSql": {
          "type": "boolean",
          "description": "Highlight SQL code. What is highlighted: fenced ```sql blocks (or fenced blocks without a language that look like SQL) and examples with tipo 'sql'. Where: in docx, text highlight on the new, updated and appended content; in pptx, the SQL code lines of the sections; in xlsx, the content cell of the SQL examples."
        },
        "colorResaltado": {
          "type": "string",
          "enum": [
            "amarillo",
            "verde",
            "azul",
            "gris",
            "rosa"
          ],
          "default": "amarillo",
          "description": "Highlight color. Default 'amarillo' (yellow). 'azul' is light blue (cyan). Only used when resaltarSql is true."
        }
      }
    }
  },
  "required": [
    "tipo",
    "titulo",
    "resumen"
  ]
};

// Esquema de entrada de la herramienta de solo lectura docusesion_leerEstructura. DEBE ser idéntico al de package.json.
export const inputSchemaEstructura: Record<string, unknown> = {
  "type": "object",
  "properties": {
    "destino": {
      "type": "string",
      "minLength": 1,
      "maxLength": 1000,
      "description": "Optional path of the document to inspect: relative to the workspace or absolute (absolute paths outside the workspace require the setting docusesion.permitirRutasFueraDelWorkspace). Omit it only when the user did not say which document: then the default document of the setting docusesion.rutaPorDefecto is used if it is a docx/xlsx/pptx file; otherwise the extension shows the user an Open dialog to choose the document. NEVER invent a path."
    }
  }
};

// Esquema de entrada de la herramienta docusesion_configurarRuta (sin parámetros). DEBE ser idéntico al de package.json.
export const inputSchemaRuta: Record<string, unknown> = {
  "type": "object",
  "properties": {}
};
