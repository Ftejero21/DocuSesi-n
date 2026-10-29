import * as vscode from 'vscode';
import { registrarComando } from './vscode/comando';
import { registrarComandosRuta } from './vscode/comandosRuta';
import { DocumentarTool } from './vscode/documentarTool';
import { EstructuraTool } from './vscode/estructuraTool';
import { registrarParticipante } from './vscode/participanteChat';
import { RutaTool } from './vscode/rutaTool';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.lm.registerTool('docusesion_documentar', new DocumentarTool()));
  context.subscriptions.push(vscode.lm.registerTool('docusesion_leerEstructura', new EstructuraTool()));
  context.subscriptions.push(vscode.lm.registerTool('docusesion_configurarRuta', new RutaTool()));
  registrarParticipante(context);
  registrarComando(context);
  registrarComandosRuta(context);
}

export function deactivate(): void {}
