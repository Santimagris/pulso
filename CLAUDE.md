# Pulso — instrucciones para Claude

Leé primero **`docs/SISTEMA.md`**: modelo, motor de cálculo, sync con GitHub y reglas de "no romper".

## Formato

- Sin preámbulos ni postambles. Respuesta directa.
- Código: diffs o bloques mínimos (`// ... código existente`). Nunca el archivo completo si cambió una parte.
- No releer archivos ya en contexto; en archivos grandes, `grep` primero.

## Reglas del repo

- El repo de la app es **público**: jamás commitear datos personales (montos reales, tokens, exports).
- Lógica de plata = `src/domain/` (pura, testeada). Cualquier cambio de cálculo lleva test con números a mano.
- Toda modificación de datos es una `Action` del reducer (serializable, idempotente).
- Antes de dar algo por hecho: `npm test -- --run`, `npx tsc -b`, `npm run lint`, `npm run build`.
- Deploy: `npm run deploy` (tests + build + push de `dist/` a la rama `gh-pages` → GitHub Pages).
