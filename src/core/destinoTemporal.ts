import * as path from 'path';
import { esArchivoDocumento } from './rutas';
import { normalizarRutaAprobada } from './rutasAprobadas';
import { ResultadoGeneracion } from './tipos';

export type OrigenDestino = 'explicito' | 'temporal' | 'porDefecto' | 'selector';

/**
 * Prioridad del destino: explícito > temporal (elegido para esta vez) > ruta por defecto > selector.
 * 'rutaBase' es el valor a pasar como ruta por defecto a resolverDestino.
 */
export function elegirOrigenDestino(
  destino: string | undefined,
  temporal: string | undefined,
  rutaPorDefecto: string
): { origen: OrigenDestino; rutaBase: string } {
  const rd = (rutaPorDefecto ?? '').trim();
  if ((destino ?? '').trim() !== '') {
    return { origen: 'explicito', rutaBase: rd };
  }
  const t = (temporal ?? '').trim();
  if (t !== '') {
    return { origen: 'temporal', rutaBase: t };
  }
  if (rd !== '') {
    return { origen: 'porDefecto', rutaBase: rd };
  }
  return { origen: 'selector', rutaBase: '' };
}

/** El destino temporal se consume tras una escritura real, 'sin_cambios' o una cancelación del usuario. */
export function debeConsumirTemporal(r: Pick<ResultadoGeneracion, 'accion' | 'decisionUsuario'>): boolean {
  return r.accion !== 'no_escrito' || r.decisionUsuario === 'cancelar';
}

export interface DestinoTemporal {
  ruta: string;
  tipo: 'documento' | 'carpeta';
  caduca: number;
}

export interface OpcionesDestinoTemporal {
  ttlMs?: number;
  ahora?: () => number;
  insensibleMayusculas?: boolean;
}

/** Ruta "elegida para esta vez": solo en memoria, un solo uso y caducidad (30 min por defecto). */
export class RegistroDestinoTemporal {
  private entrada: DestinoTemporal | undefined;
  private readonly ttlMs: number;
  private readonly ahora: () => number;
  private readonly insensible: boolean;

  constructor(opciones: OpcionesDestinoTemporal = {}) {
    this.ttlMs = opciones.ttlMs ?? 30 * 60 * 1000;
    this.ahora = opciones.ahora ?? Date.now;
    this.insensible = opciones.insensibleMayusculas ?? process.platform === 'win32';
  }

  establecer(abs: string): void {
    if (!path.isAbsolute(abs)) {
      throw new Error('El destino temporal debe ser una ruta absoluta.');
    }
    this.entrada = {
      ruta: path.resolve(abs),
      tipo: esArchivoDocumento(abs) ? 'documento' : 'carpeta',
      caduca: this.ahora() + this.ttlMs
    };
  }

  actual(): DestinoTemporal | undefined {
    if (this.entrada && this.entrada.caduca <= this.ahora()) {
      this.entrada = undefined;
    }
    return this.entrada;
  }

  consumir(): void {
    this.entrada = undefined;
  }

  minutosRestantes(): number {
    const e = this.actual();
    return e ? Math.max(0, Math.ceil((e.caduca - this.ahora()) / 60000)) : 0;
  }

  /** true solo mientras el temporal esté activo: documento → ruta exacta; carpeta → hijo directo (no recursivo). */
  cubre(abs: string): boolean {
    const e = this.actual();
    if (!e || !path.isAbsolute(abs)) {
      return false;
    }
    const n = normalizarRutaAprobada(abs, this.insensible);
    if (e.tipo === 'documento') {
      return n === normalizarRutaAprobada(e.ruta, this.insensible);
    }
    return normalizarRutaAprobada(path.dirname(abs), this.insensible) === normalizarRutaAprobada(e.ruta, this.insensible);
  }
}
