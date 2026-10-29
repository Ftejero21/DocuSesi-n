import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export function traducirErrorEscritura(e: unknown, abs: string): Error {
  const code = (e as NodeJS.ErrnoException)?.code;
  if (code === 'EBUSY' || code === 'EPERM') {
    return new Error(
      `No se puede escribir "${path.basename(abs)}": cierra el documento en Word/Excel/PowerPoint y vuelve a intentarlo.`
    );
  }
  return e instanceof Error ? e : new Error(String(e));
}

/** Escribe en un temporal del mismo directorio y hace rename. */
export async function escribirAtomico(abs: string, buffer: Buffer): Promise<void> {
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  try {
    await fs.promises.writeFile(tmp, buffer);
    await fs.promises.rename(tmp, abs);
  } catch (e) {
    try {
      await fs.promises.unlink(tmp);
    } catch (u) {
      if ((u as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw traducirErrorEscritura(u, abs);
      }
    }
    throw traducirErrorEscritura(e, abs);
  }
}
