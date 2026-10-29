import * as path from 'path';
import * as vscode from 'vscode';
import { CambioGit, Idioma } from '../core/tipos';

// Interfaces mínimas de la API de la extensión integrada vscode.git (solo lo que se usa).
interface GitChange {
  readonly uri: vscode.Uri;
  readonly status: number;
}
interface GitRepoState {
  readonly indexChanges: GitChange[];
  readonly workingTreeChanges: GitChange[];
  readonly untrackedChanges?: GitChange[];
}
interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: GitRepoState;
  diff(cached?: boolean): Promise<string>;
}
interface GitAPI {
  readonly state: 'uninitialized' | 'initialized';
  readonly onDidChangeState: vscode.Event<'uninitialized' | 'initialized'>;
  readonly repositories: GitRepository[];
  getRepository(uri: vscode.Uri): GitRepository | null;
}
interface GitExtension {
  getAPI(version: 1): GitAPI;
}

const ETIQUETAS: Record<Idioma, Record<'mod' | 'add' | 'del' | 'ren' | 'cop' | 'otro', string>> = {
  es: { mod: 'Modificado', add: 'Añadido', del: 'Eliminado', ren: 'Renombrado', cop: 'Copiado', otro: 'Otro' },
  en: { mod: 'Modified', add: 'Added', del: 'Deleted', ren: 'Renamed', cop: 'Copied', otro: 'Other' }
};

export function etiquetaEstado(status: number, idioma: Idioma): string {
  const e = ETIQUETAS[idioma];
  switch (status) {
    case 0:
    case 5:
      return e.mod;
    case 1:
    case 7:
    case 9:
      return e.add;
    case 2:
    case 6:
      return e.del;
    case 3:
      return e.ren;
    case 4:
      return e.cop;
    default:
      return e.otro;
  }
}

async function esperarInicializacion(api: GitAPI, token?: vscode.CancellationToken): Promise<void> {
  if (api.state === 'initialized') {
    return;
  }
  await new Promise<void>((resolve) => {
    const temporizador = setTimeout(done, 10000);
    const sub = api.onDidChangeState((s) => {
      if (s === 'initialized') {
        done();
      }
    });
    const cancel = token?.onCancellationRequested(done);
    function done(): void {
      clearTimeout(temporizador);
      sub.dispose();
      cancel?.dispose();
      resolve();
    }
  });
}

/** Diff (staged + unstaged) y archivos cambiados del repositorio que contiene 'root'. undefined si no hay git/repositorio. */
export async function obtenerCambios(
  root: string,
  idioma: Idioma,
  token?: vscode.CancellationToken
): Promise<{ diff: string; cambios: CambioGit[] } | undefined> {
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) {
    return undefined;
  }
  const exports = ext.isActive ? ext.exports : await ext.activate();
  const api = exports.getAPI(1);
  await esperarInicializacion(api, token);

  const repo = api.getRepository(vscode.Uri.file(root)) ?? api.repositories[0];
  if (!repo) {
    return undefined;
  }
  const staged = await repo.diff(true);
  const unstaged = await repo.diff(false);
  const diff = [staged, unstaged].filter((d) => d && d.trim() !== '').join('\n');

  const vistos = new Set<string>();
  const cambios: CambioGit[] = [];
  const grupos = [repo.state.indexChanges, repo.state.workingTreeChanges, repo.state.untrackedChanges ?? []];
  for (const grupo of grupos) {
    for (const c of grupo) {
      const rel = path.relative(root, c.uri.fsPath).split(path.sep).join('/');
      if (vistos.has(rel)) {
        continue;
      }
      vistos.add(rel);
      cambios.push({ ruta: rel, estado: etiquetaEstado(c.status, idioma) });
    }
  }
  return { diff, cambios };
}
