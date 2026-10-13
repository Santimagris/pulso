# Pulso

**Tu plata, semana a semana.** App personal de finanzas: un corte los lunes, las compras con
tarjeta, y un límite semanal que funciona (con premio por lo que te sobra y sin quedar hundido
para siempre si te pasás).

- **Corte semanal:** anotás cuánto tenés; el gasto del día a día se deduce solo.
- **Tarjetas:** cuotas y fijos por mes y por tarjeta. Pagar el resumen **no** es gasto: ya está
  contado en el mes, así que no hay semanas con picos.
- **Ahorro primero:** el ahorro sale del sueldo antes de presupuestar; con el resto se arma tu
  límite semanal. Metas en pesos o dólares (con cuánto comprar por mes).
- **Datos en tu GitHub:** un `data.json` en un repo privado. Cada cambio es un commit. No se
  pausa nunca, funciona sin señal y sincroniza entre la compu y el celu.

📖 Cómo funciona por dentro: [`docs/SISTEMA.md`](docs/SISTEMA.md).

## Puesta en marcha

1. Repo **privado** para los datos (por defecto `pulso-data`).
2. Token fine-grained con acceso **solo** a ese repo y permiso `Contents: Read and write`.
   La pantalla inicial de la app trae el link con el formulario ya completo.
3. Abrí la app, pegá el token y listo. En el iPhone: Safari → Compartir → *Agregar a inicio*.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests del motor (vitest)
npm run build        # tsc + vite build → dist/
npm run icons        # regenera los íconos PWA
```

Stack: Vite · React 19 · TypeScript · Tailwind CSS v4 · Radix · Zustand · date-fns.
Deploy: `npm run deploy` publica `dist/` en la rama `gh-pages` (GitHub Pages).
