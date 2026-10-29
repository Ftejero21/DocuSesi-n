import * as path from 'path';
import * as vscode from 'vscode';
import { Idioma } from '../core/tipos';

export interface Ajustes {
  /** Ruta por defecto (carpeta o archivo docx/xlsx/pptx). '' = sin ruta por defecto. */
  rutaPorDefecto: string;
  plantillaWord?: string;
  plantillaExcel?: string;
  idioma: Idioma;
  permitirRutasFueraDelWorkspace: boolean;
}

function resolverPlantilla(root: string, valor: string | undefined): string | undefined {
  const v = (valor ?? '').trim();
  if (v === '') {
    return undefined;
  }
  return path.isAbsolute(v) ? v : path.resolve(root, v);
}

/** Lee los ajustes con el scope de la carpeta del workspace. Las plantillas relativas se resuelven contra el root. */
export function leerAjustes(folder: vscode.WorkspaceFolder): Ajustes {
  const cfg = vscode.workspace.getConfiguration('docusesion', folder.uri);
  const root = folder.uri.fsPath;
  const idioma = cfg.get<string>('idioma', 'es') === 'en' ? 'en' : 'es';
  let rutaPorDefecto = (cfg.get<string>('rutaPorDefecto', '') ?? '').trim();
  if (rutaPorDefecto === '') {
    // 'carpetaPorDefecto' es un ajuste obsoleto y ya no está declarado en el manifiesto: sin valor implícito,
    // solo cuenta si el usuario lo puso explícitamente en su settings.json.
    const legado = cfg.get<unknown>('carpetaPorDefecto');
    rutaPorDefecto = typeof legado === 'string' ? legado.trim() : '';
  }
  return {
    rutaPorDefecto,
    plantillaWord: resolverPlantilla(root, cfg.get<string>('plantillaWord', '')),
    plantillaExcel: resolverPlantilla(root, cfg.get<string>('plantillaExcel', '')),
    idioma,
    permitirRutasFueraDelWorkspace: cfg.get<boolean>('permitirRutasFueraDelWorkspace', false) === true
  };
}
