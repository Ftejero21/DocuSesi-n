import { i18n } from './i18n';
import { Idioma } from './tipos';

export type AccionRuta = 'mantener' | 'defecto' | 'defectoNoGuardada' | 'estaVez' | 'quitada' | 'estaVezQuitada' | 'cancelado';

export interface EstadoRuta {
  accion: AccionRuta;
  /** Ruta implicada en la acción (defecto / defectoNoGuardada / estaVez). */
  ruta?: string;
  /** Ruta por defecto vigente ('' si no hay). */
  rutaPorDefecto: string;
  temporal?: { ruta: string; minutos: number };
}

/**
 * Texto del estado de las rutas tras el menú. Las rutas deben llegar ya saneadas (y envueltas en backticks si va a markdown).
 * `paraModelo` añade la instrucción final para el modelo.
 */
export function textoEstadoRuta(e: EstadoRuta, idioma: Idioma, paraModelo: boolean): string {
  const t = i18n(idioma).rutaHerramienta;
  const r = e.ruta ?? '';
  const accion =
    e.accion === 'defecto' || e.accion === 'defectoNoGuardada' || e.accion === 'estaVez'
      ? t.accion[e.accion](r)
      : t.accion[e.accion];
  const defecto = e.rutaPorDefecto !== '' ? e.rutaPorDefecto : undefined;
  const proxima = e.temporal?.ruta ?? defecto ?? t.ningunaSelector;
  const lineas = [
    accion,
    '',
    `- ${t.lineaPorDefecto(defecto ?? t.ningunaSelector)}`,
    `- ${e.temporal ? t.lineaEstaVez(e.temporal.ruta, e.temporal.minutos) : t.lineaSinEstaVez}`,
    `- ${t.lineaProxima(proxima)}`
  ];
  if (paraModelo) {
    lineas.push('', t.instruccionModelo);
  }
  return lineas.join('\n');
}
