// Genera test-fixtures/documento-es.docx: documento con estilos "Título 1"/"Título 2" (ids Ttulo1/Ttulo2).
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, BorderStyle } from 'docx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const salida = path.join(aqui, '..', 'test-fixtures', 'documento-es.docx');

const t1 = (texto) => new Paragraph({ style: 'Ttulo1', children: [new TextRun(texto)] });
const t2 = (texto) => new Paragraph({ style: 'Ttulo2', children: [new TextRun(texto)] });
const cuerpo = (texto) => new Paragraph({ style: 'Cuerpo', children: [new TextRun(texto)] });
const borde = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const celda = (texto, bold = false) =>
  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: texto, bold })] })] });

const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: 'Ttulo1',
        name: 'Título 1',
        basedOn: 'Normal',
        next: 'Cuerpo',
        quickFormat: true,
        paragraph: { outlineLevel: 0, spacing: { before: 240, after: 120 } },
        run: { bold: true, size: 32 }
      },
      {
        id: 'Ttulo2',
        name: 'Título 2',
        basedOn: 'Normal',
        next: 'Cuerpo',
        quickFormat: true,
        paragraph: { outlineLevel: 1, spacing: { before: 200, after: 100 } },
        run: { bold: true, size: 26 }
      },
      {
        id: 'Cuerpo',
        name: 'Cuerpo',
        basedOn: 'Normal',
        quickFormat: true,
        run: { size: 22 }
      }
    ]
  },
  sections: [
    {
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Documento de prueba')] }),
        t1('Introducción'),
        cuerpo('Texto de introducción.'),
        t1('Servicios'),
        t2('Servicio de solicitudes'),
        cuerpo('Texto antiguo'),
        t1('Historial de cambios'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde },
          rows: [
            new TableRow({ tableHeader: true, children: ['Fecha', 'Tipo', 'Título', 'Resumen'].map((c) => celda(c, true)) }),
            new TableRow({ children: ['2026-01-01', 'Cambio', 'Alta inicial', 'Creación del documento'].map((c) => celda(c)) })
          ]
        })
      ]
    }
  ]
});

fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, await Packer.toBuffer(doc));
console.log('Fixture creado:', salida);
