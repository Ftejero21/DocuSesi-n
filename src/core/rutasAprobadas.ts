import * as path from 'path';

/** Normaliza una ruta absoluta para compararla: resolve, sin separador final y, si procede, en minúsculas. */
export function normalizarRutaAprobada(abs: string, insensibleMayusculas: boolean): string {
  let n = path.resolve(abs);
  const raiz = path.parse(n).root;
  while (n.length > raiz.length && (n.endsWith('/') || n.endsWith('\\'))) {
    n = n.slice(0, -1);
  }
  return insensibleMayusculas ? n.toLowerCase() : n;
}

export interface OpcionesRegistroRutas {
  ttlMs?: number;
  max?: number;
  ahora?: () => number;
  insensibleMayusculas?: boolean;
}

/**
 * Rutas absolutas elegidas por el usuario en un diálogo nativo. Solo en memoria, solo la ruta exacta,
 * con caducidad (30 min por defecto) y un máximo de entradas (se expulsa la más antigua).
 */
export class RegistroRutasAprobadas {
  private readonly entradas = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly max: number;
  private readonly ahora: () => number;
  private readonly insensible: boolean;

  constructor(opciones: OpcionesRegistroRutas = {}) {
    this.ttlMs = opciones.ttlMs ?? 30 * 60 * 1000;
    this.max = opciones.max ?? 100;
    this.ahora = opciones.ahora ?? Date.now;
    this.insensible = opciones.insensibleMayusculas ?? process.platform === 'win32';
  }

  private purgar(): void {
    const t = this.ahora();
    for (const [clave, caduca] of this.entradas) {
      if (caduca <= t) {
        this.entradas.delete(clave);
      }
    }
  }

  /** Aprueba una ruta absoluta; las rutas no absolutas se ignoran. */
  aprobar(abs: string): void {
    if (!path.isAbsolute(abs)) {
      return;
    }
    this.purgar();
    const clave = normalizarRutaAprobada(abs, this.insensible);
    this.entradas.delete(clave);
    this.entradas.set(clave, this.ahora() + this.ttlMs);
    while (this.entradas.size > this.max) {
      const masAntigua = this.entradas.keys().next();
      if (masAntigua.done) {
        break;
      }
      this.entradas.delete(masAntigua.value);
    }
  }

  estaAprobada(abs: string): boolean {
    if (!path.isAbsolute(abs)) {
      return false;
    }
    this.purgar();
    return this.entradas.has(normalizarRutaAprobada(abs, this.insensible));
  }

  limpiar(): void {
    this.entradas.clear();
  }
}
