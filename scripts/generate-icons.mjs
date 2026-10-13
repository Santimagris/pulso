// Genera los íconos PNG de la PWA a partir del logo SVG (correr con `npm run icons`).
import { writeFileSync } from "node:fs";

import { Resvg } from "@resvg/resvg-js";

const mark = (stroke = 5) =>
  `<path d="M10 38 H22 L27 25 L34 45 L40 20 L45 32 H54" fill="none" stroke="url(#l)" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
const defs = `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2a24"/><stop offset="1" stop-color="#0a0f0d"/></linearGradient><linearGradient id="l" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#6ee7b7"/></linearGradient></defs>`;

// Ícono cuadrado lleno (iOS redondea las esquinas solo; Android usa el maskable).
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}<rect width="64" height="64" fill="url(#b)"/>${mark()}</svg>`;
// Maskable: el trazo dentro de la zona segura (80% central).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}<rect width="64" height="64" fill="url(#b)"/><g transform="translate(6.4 6.4) scale(0.8)">${mark(5.5)}</g></svg>`;

const render = (svg, size, file) => {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(new URL(`../public/${file}`, import.meta.url), png);
  console.log("ok", file);
};

render(full, 180, "apple-touch-icon.png");
render(full, 192, "icon-192.png");
render(full, 512, "icon-512.png");
render(maskable, 512, "icon-maskable-512.png");
