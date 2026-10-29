// Genera images/icon.png (128x128, RGBA) sin dependencias: solo fs, path y zlib.
// Uso: npm run icon
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const TAM = 128;
const SS = 4; // supermuestreo SSxSS por pixel

const rutaRaiz = fileURLToPath(new URL('..', import.meta.url));

// --- PNG ---

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const cabecera = Buffer.alloc(4);
  cabecera.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([cabecera, cuerpo, crc]);
}

function codificarPng(ancho, alto, rgba) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compresion
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // entrelazado
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    const desde = y * (ancho * 4 + 1);
    filas[desde] = 0; // filtro 0
    rgba.copy(filas, desde + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  return Buffer.concat([
    firma,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Formas (coordenadas en pixeles del lienzo 128x128) ---

const rectRedondeado = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const triangulo = (ax, ay, bx, by, cx, cy) => (x, y) => {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const hayNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hayPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hayNeg && hayPos);
};

// Linea horizontal con extremos redondeados (capsula).
const linea = (x0, x1, yc, grosor) => (x, y) => {
  const r = grosor / 2;
  const px = Math.min(Math.max(x, x0), x1);
  return (x - px) ** 2 + (y - yc) ** 2 <= r * r;
};

const AZUL = [0x1f, 0x4e, 0x79];
const BLANCO = [0xff, 0xff, 0xff];
const PLIEGUE = [0xc9, 0xd6, 0xe3];
const GRIS = [0x8a, 0xa1, 0xb8];
const AMARILLO = [0xff, 0xd5, 0x4a];

const esquinaCortada = triangulo(74, 18, 96, 18, 96, 40);
const hoja = rect(32, 18, 96, 110);

// Capas en orden de pintado: la ultima que contiene la muestra gana.
const capas = [
  { color: AZUL, dentro: rectRedondeado(0, 0, TAM, TAM, 22) },
  { color: BLANCO, dentro: (x, y) => hoja(x, y) && !esquinaCortada(x, y) },
  { color: PLIEGUE, dentro: triangulo(74, 18, 74, 40, 96, 40) },
  { color: AMARILLO, dentro: rect(36, 75, 92, 89) },
  { color: GRIS, dentro: linea(42, 86, 54, 5) },
  { color: GRIS, dentro: linea(42, 78, 68, 5) },
  { color: GRIS, dentro: linea(42, 86, 82, 5) },
  { color: GRIS, dentro: linea(42, 66, 96, 5) },
];

function renderizar() {
  const rgba = Buffer.alloc(TAM * TAM * 4);
  const muestras = SS * SS;
  for (let py = 0; py < TAM; py++) {
    for (let px = 0; px < TAM; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let golpes = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          let color = null;
          for (const capa of capas) if (capa.dentro(x, y)) color = capa.color;
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            golpes++;
          }
        }
      }
      const i = (py * TAM + px) * 4;
      if (golpes > 0) {
        rgba[i] = Math.round(r / golpes);
        rgba[i + 1] = Math.round(g / golpes);
        rgba[i + 2] = Math.round(b / golpes);
        rgba[i + 3] = Math.round((golpes / muestras) * 255);
      }
    }
  }
  return rgba;
}

function main() {
  const carpeta = join(rutaRaiz, 'images');
  mkdirSync(carpeta, { recursive: true });
  const destino = join(carpeta, 'icon.png');
  writeFileSync(destino, codificarPng(TAM, TAM, renderizar()));
  console.log(`Icono escrito en ${destino}`);
}

main();
