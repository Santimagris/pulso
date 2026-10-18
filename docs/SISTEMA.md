# Pulso — Mapa del sistema

> Fuente de verdad sobre QUÉ es Pulso, CÓMO calcula y QUÉ no romper.
> Si el código contradice este doc, gana el código (y hay que actualizar esto).

## 1. Qué es

App personal de finanzas (un solo usuario). Tres ideas:

1. **Corte semanal (los lunes):** anotás cuánto tenés (Mercado Pago, reserva de ahorro,
   efectivo, dólares). El gasto del día a día **se deduce** del corte: no se carga gasto por gasto.
2. **Tarjeta = deuda:** las compras con tarjeta se cargan (cuotas, mes de la primera cuota,
   tarjeta). Se presupuestan en el mes en que se pagan. **Pagar el resumen no es gasto.**
3. **Págate primero:** el ahorro del mes sale del sueldo antes de presupuestar. Lo que queda,
   menos los resúmenes de tarjeta del mes, se reparte en semanas → **límite semanal**.

## 2. Stack y despliegue

Vite + React 19 + TypeScript + Tailwind v4 · Radix Dialog · Zustand · date-fns · lucide.
SPA estática con router por hash (funciona en GitHub Pages, subcarpetas y como PWA en iOS).

- **Datos:** `data.json` en un repo **privado** de GitHub (`Santimagris/pulso-data` por defecto),
  vía la API de contenidos. Token fine-grained (solo ese repo, `Contents: read & write`)
  guardado en `localStorage` de cada dispositivo. Cada cambio = 1 commit con mensaje legible.
- **Hosting:** GitHub Pages desde la rama `gh-pages`: `npm run deploy` (tests + build + push de `dist/`).
- **Íconos PWA:** `npm run icons` (genera los PNG desde el SVG con resvg).

## 3. Estructura

```
src/
├─ domain/            ← lógica pura, testeada (sin React)
│  ├─ types.ts        modelo persistido (Data)
│  ├─ actions.ts      acciones serializables + reducer idempotente + mensajes de commit
│  ├─ engine.ts       ★ plan del mes, gasto semanal, arrastre, resúmenes mensuales
│  ├─ bills.ts        resúmenes de tarjeta (cuotas + fijos), sugerencia de mes de 1ª cuota
│  ├─ metrics.ts      promedios, variación mensual, proyección de meta
│  ├─ money.ts        formato/parseo de montos (centavos)
│  └─ dates.ts        fechas locales, lunes del mes, etiquetas en español
├─ sync/
│  ├─ github.ts       API de contenidos (leer/escribir data.json, base64 UTF-8)
│  └─ store.ts        ★ sync local-first: remote + pending + reintentos y conflictos
├─ screens/           Inicio, Tarjetas, Ahorro, Historial, Ajustes, Ayuda, Setup
├─ sheets/            hojas (corte, compra, pago, plan, meta…) + SheetHost
├─ charts/BarChart    barras de una serie con marca de referencia (specs de dataviz)
├─ ui/                primitivas (Button, Card, MoneyInput, Sheet, Segmented…)
└─ layout/            AppShell (sidebar en compu, barra inferior en celu), SyncPill
```

## 4. El motor (`domain/engine.ts`)

**Plan del mes** (una semana pertenece al mes de su **lunes**):

```
ahorroDelSueldo = % × (sueldo + aguinaldo que va al presupuesto)   (o monto fijo)
tarjetas        = Σ resúmenes del mes (pagado real si ya se pagó; si no, estimado)
                  − compras "especiales" (salen del ahorro)
                  − corrimiento de fijos (un fijo cuenta 1 vez por mes aunque vengan 2 juntos)
libre           = sueldo + aguinaldo al presupuesto − ahorroDelSueldo − tarjetas
base semanal    = max(0, libre) / lunes del mes
```

**Fijos de tarjeta** (`Recurrente`): la cuota de un mes es la anotada para ese mes
(`montos[mes]`); si no hay, la del último mes anotado antes; si no, `monto` (base). Anotar un
mes no cambia los anteriores y deja ese monto como estimado de los siguientes (`conMontoDelMes`).
`veces[mes]` (0/1/2) solo mueve la caja: el presupuesto cuenta una cuota por mes.

El sueldo cuenta para el mes al que **corresponde** (`Ingreso.mes`), no el de la fecha
(ej: el sueldo de junio cobrado el 31 de mayo).

**Gasto del día a día** entre dos cortes A → B:

```
gasto = valor(A) + ingresos − valor(B) − pagos de tarjeta − gastos especiales
```

Los dólares se valúan al mismo tipo de cambio en ambas puntas (una suba del dólar no es
"gasto negativo"). Si el intervalo cruza semanas, se reparte parejo por día.
Orden de eventos: clave `(fecha, creadoEn)`; los movimientos cargados en el flujo del corte
llevan `creadoEn` un segundo antes que el corte → quedan **antes** del corte.

**Arrastre** (semana a semana):

- Sobrante (+): se suma **entero** a la semana siguiente y se acumula (también cruza de mes).
  "Mandar al ahorro" (`SobranteAlAhorro`) lo descuenta.
- Déficit (−): se reparte entre los lunes que quedan del mes.
- Al cambiar de mes, un déficit sin recuperar se **absorbe** (`deficitAbsorbido`) y el mes
  nuevo arranca en cero. Nunca un número hundido por meses.
- Semanas sin corte: quedan "pendientes" y su presupuesto sigue disponible hasta el próximo corte.

**Reservas y "Ahorrar"** (`engine.reservas`, `necesidadReservaGastos`):

- Saldo de cada reserva = el del último corte + lo que moviste después (`PaseAlAhorro`: positivo
  de "Ahorrar", negativo de "Sacar del ahorro"; y `SobranteAlAhorro`) − gastos especiales
  cargados después (salen de gastos). Solo si hay reserva de ahorro aparte.
- Con reserva de ahorro aparte, el corte pide **Cuenta** y **Reserva de gastos** por separado: se guarda
  el total en `mp` y la reserva en `mpReserva` (opcional; los cortes viejos no la tienen). Los cálculos
  usan el total; el Inicio y la hoja "Ahorrar" muestran solo la reserva (`reservas.reservaGastos`).
- Ahorro → "Ahorraste este mes" (`ahorradoEsteMes`): reserva de ahorro + dólares de hoy − la del último
  corte antes del mes (o del primero del mes si arrancaste a mitad). El plan queda como referencia.
- Un pase **no es gasto ni toca el límite**: el gasto se mide con el total y el total no cambia.
  El próximo corte precarga el ahorro con los pases y vuelve a ser la verdad.
- "Te sobran" = gastos − (tarjetas del mes pendientes **al corte** + lo que queda de límite esta
  semana + base × lunes que faltan [+ todo el mes que viene si su sueldo ya está en el corte]).
  Todo a la fecha del corte: pagar una tarjeta después no cambia lo que sobra. El Inicio ofrece
  "Ahorrar" desde $10.000, con el corte de esta semana hecho.
- La tarjeta "Reserva de ahorro" del Inicio, con dólares activados, muestra pesos y dólares por separado.

**El motor es una función pura** `computeEngine(data, hoy)`: todo se recalcula desde los
datos en cada render. No hay campos derivados persistidos.

## 5. Sync (`sync/store.ts`)

- `remote` = última versión confirmada (+ sha). `pending` = acciones sin subir
  (persisten en `localStorage`). La UI ve `reduce(remote, pending)` (optimista).
- `flush` (debounce 400 ms): aplica `pending` sobre `remote`, `PUT` con sha.
  Si GitHub responde 409/422 (otro dispositivo guardó antes): re-lee y re-aplica (≤3 veces).
- Sin red: estado `offline`, reintento cada 15 s y al volver la conexión/visibilidad.
- Reducer **idempotente** (upsert por id): re-aplicar acciones es seguro.
- `normalizeData` completa lo que falta y **conserva campos que no conoce**: una versión vieja
  abierta en otro dispositivo no borra lo que agregó una más nueva.

## 6. Reglas para no romper

- **Montos en centavos enteros** (ARS y USD). Parse/format solo en los bordes (`money.ts`).
- **Fechas en hora local** con `parseISO('yyyy-MM-dd')`; nunca `new Date('yyyy-MM-dd')` (UTC).
- **Semana = lunes**; una semana pertenece al mes de su lunes.
- **Todo cambio de datos es una `Action`** (serializable) → `dispatch`. Nada de mutar `data`.
- **Nada de datos personales en este repo** (es público). Los datos viven solo en `pulso-data`.
- Lógica nueva de plata → test en `src/domain/*.test.ts` con números a mano.

## 7. Verificación

```bash
npm test -- --run     # tests del dominio
npx tsc -b            # tipos
npm run lint          # eslint (incluye reglas de hooks de React 19)
npm run build         # build de producción
```
