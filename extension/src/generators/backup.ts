import * as fs from 'fs';
import * as path from 'path';
import { nombreBackup } from '../core/rutas';

/** Copia 'abs' a <backupDir>/<nombre>-YYYYMMDD-HHmmss.<ext> y devuelve la ruta del backup. */
export async function crearBackup(abs: string, backupDir: string, fecha: Date): Promise<string> {
  await fs.promises.mkdir(backupDir, { recursive: true });
  const destino = nombreBackup(abs, backupDir, fecha);
  await fs.promises.copyFile(abs, destino);
  return path.resolve(destino);
}
