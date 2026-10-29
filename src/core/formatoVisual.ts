import { ColorResaltado, FormatoVisual } from './tipos';

export interface ColorResaltadoDef {
  /** Valor de w:highlight en Word. */
  word: string;
  /** Color hexadecimal RRGGBB (pptx/xlsx). */
  hex: string;
}

/** Tabla cerrada: "azul" es cyan porque el azul oscuro con texto negro no se lee. */
export const COLORES_RESALTADO: Record<ColorResaltado, ColorResaltadoDef> = {
  amarillo: { word: 'yellow', hex: 'FFFF00' },
  verde: { word: 'green', hex: '00FF00' },
  azul: { word: 'cyan', hex: '00FFFF' },
  gris: { word: 'lightGray', hex: 'C0C0C0' },
  rosa: { word: 'magenta', hex: 'FF00FF' }
};

/** Resaltado de SQL pedido, o undefined si no se pidió. Color ausente o desconocido: amarillo. */
export function resaltadoSql(fv?: FormatoVisual): ColorResaltadoDef | undefined {
  if (fv?.resaltarSql !== true) {
    return undefined;
  }
  const c = fv.colorResaltado;
  if (typeof c === 'string' && Object.prototype.hasOwnProperty.call(COLORES_RESALTADO, c)) {
    return COLORES_RESALTADO[c];
  }
  return COLORES_RESALTADO.amarillo;
}
