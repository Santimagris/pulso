import { CalendarCheck, Check, ChevronRight, CircleCheck, Gauge, PiggyBank, Sparkles, TrendingDown, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";

import { BarChart, Legend, type BarDatum } from "@/charts/BarChart";
import { billEstimadoARS, billsDelMes, billTotalARS } from "@/domain/bills";
import { addMonthsISO, daysBetween, dayLabel, monthLabel, monthShort, weekRangeLabel } from "@/domain/dates";
import type { EngineResult, WeekResult } from "@/domain/engine";
import { formatARS, formatPercent, formatUSD } from "@/domain/money";
import { useEngine, useMesActual, useMetrics } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { navigate } from "@/lib/router";
import { openSheet } from "@/lib/ui-store";
import { PageHeader } from "@/layout/AppShell";
import { SyncPill } from "@/layout/SyncPill";
import { useApp } from "@/sync/store";
import { Logo } from "@/ui/Logo";
import { Badge, Button, Card, Dot, HeroMoney, Progress, SectionTitle } from "@/ui/primitives";

const hoyLargo = (iso: string) => {
  const t = format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function Home() {
  const data = useApp((s) => s.data);
  const engine = useEngine();
  const hayCortes = data.cortes.length > 0;

  return (
    <>
      <div className="mb-5 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-2.5">
          <Logo className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Pulso</span>
        </div>
        <PageHeaderSyncOnly />
      </div>
      <div className="hidden lg:block">
        <PageHeader title="Inicio" subtitle={hoyLargo(engine.hoy)} />
      </div>

      {!hayCortes ? (
        <PrimerosPasos />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-5">
          <div className="grid grid-cols-1 content-start gap-4 lg:gap-5">
            <CorteDue engine={engine} />
            <Hero engine={engine} />
            <Reservas engine={engine} />
            <SobranteDeMes engine={engine} />
            <SemanaPasada w={engine.ultimaCerrada} />
            <MesActual engine={engine} />
          </div>
          <div className="grid grid-cols-1 content-start gap-4 lg:gap-5">
            <Promedios />
            <GraficoSemanas engine={engine} />
            <ProximosPagos />
          </div>
        </div>
      )}
    </>
  );
}

function PageHeaderSyncOnly() {
  return (
    <div className="-mr-2">
      <SyncPill compact />
    </div>
  );
}

/* ------------------------------- Primeros pasos ------------------------------ */

function PrimerosPasos() {
  const data = useApp((s) => s.data);
  const pasos = [
    {
      done: data.settings.sueldo > 0,
      title: "Tu sueldo y cuánto ahorrar",
      text: "Con eso Pulso arma tu límite semanal. Recomendado: arrancar con 20%.",
      onClick: () => openSheet({ kind: "plan" }),
    },
    {
      done: data.tarjetas.length > 0,
      title: "Tus tarjetas",
      text: "Con el día aproximado de cierre y vencimiento.",
      onClick: () => openSheet({ kind: "tarjeta" }),
    },
    {
      done: data.recurrentes.length > 0,
      title: "Fijos que llegan a la tarjeta",
      text: "Plan del auto, Spotify… Se cargan solos todos los meses.",
      onClick: () => openSheet({ kind: "recurrente" }),
      optional: true,
    },
    {
      done: data.compras.length > 0,
      title: "Cuotas que estás pagando",
      text: "Las compras en cuotas que todavía tienen cuotas por venir.",
      onClick: () => openSheet({ kind: "compra" }),
      optional: true,
    },
    {
      done: data.cortes.length > 0,
      title: "Tu primer corte",
      text: "Anotá cuánto tenés hoy. Desde ahí, todos los lunes.",
      onClick: () => openSheet({ kind: "corte" }),
    },
  ];
  const hechos = pasos.filter((p) => p.done).length;
  return (
    <div className="mx-auto max-w-xl animate-rise">
      <Card className="overflow-hidden">
        <div className="border-b border-line p-5">
          <Badge tone="brand" icon={<Sparkles className="size-3.5" />}>
            Primeros pasos
          </Badge>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Dejá Pulso listo en 3 minutos</h2>
          <p className="mt-1 text-sm text-muted">
            Arrancás de cero, sin arrastrar nada viejo. Después solo hacés el corte de los lunes y cargás las compras con tarjeta.
          </p>
          <Progress value={hechos / pasos.length} className="mt-4" />
        </div>
        <ol>
          {pasos.map((p, i) => (
            <li key={p.title} className="border-b border-line last:border-0">
              <button onClick={p.onClick} className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition hover:bg-white/[0.03]">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    p.done ? "bg-brand text-brand-ink" : "bg-white/[0.06] text-muted",
                  )}
                >
                  {p.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-medium", p.done ? "text-muted line-through decoration-white/20" : "text-ink")}>
                    {p.title}
                    {p.optional && !p.done && <span className="ml-2 text-xs font-normal text-faint">opcional</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-faint">{p.text}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/* ----------------------------------- Hero ----------------------------------- */

function CorteDue({ engine }: { engine: EngineResult }) {
  const { actual, ultimoCorte, pendientes, hoy } = engine;
  if (!actual || !ultimoCorte) return null;
  const debe = ultimoCorte.fecha < actual.lunes;
  if (!debe) return null;
  const dias = daysBetween(ultimoCorte.fecha, hoy);
  const esLunes = hoy === actual.lunes;
  return (
    <button
      onClick={() => openSheet({ kind: "corte" })}
      className="flex animate-rise items-center gap-3.5 rounded-2xl border border-brand/30 bg-brand/[0.08] p-4 text-left transition hover:bg-brand/[0.12]"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
        <CalendarCheck className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink">{esLunes ? "Es lunes: hacé el corte" : "Te falta el corte de esta semana"}</div>
        <div className="mt-0.5 text-[13px] text-ink-2/80">
          {pendientes > 0
            ? `Hace ${dias} días que no anotás. Hacelo y Pulso reparte el gasto entre las semanas.`
            : "Anotá cuánto tenés y te digo cómo te fue la semana pasada."}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-brand" />
    </button>
  );
}

function Hero({ engine }: { engine: EngineResult }) {
  const w = engine.actual;
  if (!w) return null;
  const plan = engine.meses[w.mes];
  const limite = Math.max(0, w.limite);
  const restante = w.limite - w.gastadoParcial;
  const sinMargen = w.limite <= 0;
  const tone = sinMargen ? "bad" : w.acumulado > 0 ? "good" : w.arrastre < 0 ? "warn" : "neutral";

  return (
    <Card className="relative animate-rise overflow-hidden p-5 lg:p-6">
      <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] font-medium text-muted">Semana del {weekRangeLabel(w.lunes)}</div>
          {tone === "good" && <Badge tone="good" icon={<Sparkles className="size-3" />}>Con premio</Badge>}
          {tone === "warn" && <Badge tone="warn" icon={<TrendingDown className="size-3" />}>Recuperando</Badge>}
          {tone === "bad" && <Badge tone="bad" icon={<TriangleAlert className="size-3" />}>Sin margen</Badge>}
          {tone === "neutral" && <Badge icon={<Gauge className="size-3" />}>En línea</Badge>}
        </div>
        <div className="mt-4 text-[15px] text-ink-2">Podés gastar esta semana</div>
        <HeroMoney value={w.gastadoParcial > 0 ? Math.max(0, restante) : limite} className="mt-1 text-[52px] leading-none lg:text-[60px]" />

        {w.gastadoParcial > 0 && (
          <div className="mt-4">
            <Progress value={w.gastadoParcial / Math.max(1, w.limite)} tone={restante < 0 ? "bad" : "brand"} />
            <div className="mt-2 text-[13px] text-muted">
              Llevás {formatARS(w.gastadoParcial)} de {formatARS(limite)} · te {restante >= 0 ? "quedan" : "pasaste"}{" "}
              <span className={restante >= 0 ? "text-ink" : "text-bad"}>{formatARS(Math.abs(restante))}</span>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-ink-2">
            Base <span className="font-semibold text-ink">{formatARS(w.presupuesto)}</span>
          </span>
          {w.arrastre > 0 && (
            <span className="rounded-lg bg-good/10 px-2.5 py-1.5 text-good">
              + sobrante <span className="font-semibold">{formatARS(w.arrastre)}</span>
            </span>
          )}
          {w.arrastre < 0 && (
            <span className="rounded-lg bg-warn/10 px-2.5 py-1.5 text-warn">
              − recupero <span className="font-semibold">{formatARS(-w.arrastre)}</span>
            </span>
          )}
          {engine.pendientes > 0 && (
            <span className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-muted">incluye {engine.pendientes} semana(s) sin corte</span>
          )}
        </div>

        {sinMargen && (
          <p className="mt-4 rounded-xl bg-bad/10 p-3 text-[13px] text-bad">
            Este mes ya usaste todo el presupuesto{plan?.faltante ? " (las tarjetas y el ahorro superan tu sueldo)" : ""}. Lo que gastes
            hasta el cobro sale del ahorro. El mes que viene arrancás limpio.
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="subtle" onClick={() => openSheet({ kind: "consulta" })}>
            ¿Cuánto me queda?
          </Button>
          <Button variant="secondary" icon={<CalendarCheck className="size-4" />} onClick={() => openSheet({ kind: "corte" })}>
            Hacer corte
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Saldo de cada reserva según el último corte (los mismos números que usa Ahorro). */
function Reservas({ engine }: { engine: EngineResult }) {
  const m = useMetrics();
  const u = engine.ultimoCorte;
  if (!u || m.ahorroAcumulado == null) return null;
  const cuando = u.fecha === engine.hoy ? "al corte de hoy" : `al corte del ${dayLabel(u.fecha)}`;
  const items = [
    {
      label: "Reserva de gastos",
      icon: <Wallet className="size-4" />,
      value: u.mp + u.efectivo,
      detalle: u.efectivo ? `incluye ${formatARS(u.efectivo)} en efectivo` : null,
    },
    {
      label: "Reserva de ahorro",
      icon: <PiggyBank className="size-4" />,
      value: m.ahorroAcumulado,
      detalle: m.usdTenes ? `incluye ${formatUSD(m.usdTenes)}` : null,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:gap-5">
      {items.map((it) => (
        <Card key={it.label} className="p-4 lg:p-5">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            {/* El ícono solo donde entra al lado del título sin partirlo en dos líneas. */}
            <span className="hidden shrink-0 text-faint sm:block lg:hidden xl:block">{it.icon}</span>
            {it.label}
          </div>
          <HeroMoney value={it.value} className="mt-2.5 text-[22px] leading-none" />
          <div className="mt-2 text-[12px] leading-snug text-faint">
            {it.detalle && <div>{it.detalle}</div>}
            {cuando}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Al arrancar un mes con sobrante del anterior: ofrecer mandarlo al ahorro. */
function SobranteDeMes({ engine }: { engine: EngineResult }) {
  const w = engine.actual;
  if (!w || w.acumulado <= 0) return null;
  const plan = engine.meses[w.mes];
  const esPrimeraDelMes = plan?.lunes[0] === w.lunes;
  const grande = w.acumulado > (plan?.base ?? 0);
  if (!esPrimeraDelMes && !grande) return null;
  return (
    <Card className="flex animate-rise items-center gap-3.5 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-good/12 text-good">
        <PiggyBank className="size-5" />
      </div>
      <div className="min-w-0 flex-1 text-[13px] text-muted">
        <div className="text-[15px] font-medium text-ink">Tenés {formatARS(w.acumulado)} de sobrante</div>
        {esPrimeraDelMes ? "Te sobró del mes pasado. Ya está sumado a esta semana." : "Se viene acumulando de otras semanas."} ¿Lo guardás?
      </div>
      <Button size="sm" variant="secondary" onClick={() => openSheet({ kind: "sobrante" })}>
        Al ahorro
      </Button>
    </Card>
  );
}

function SemanaPasada({ w }: { w: WeekResult | null }) {
  if (!w || w.gastado == null || w.diferencia == null) return null;
  const sobro = w.diferencia >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-muted">La semana pasada</div>
          <div className="text-[12px] text-faint">{weekRangeLabel(w.lunes)}</div>
        </div>
        {sobro ? (
          <Badge tone="good" icon={<CircleCheck className="size-3" />}>Dentro del límite</Badge>
        ) : (
          <Badge tone="bad" icon={<TriangleAlert className="size-3" />}>Te pasaste</Badge>
        )}
      </div>
      <div className="mt-3 text-[22px] font-semibold tracking-tight">
        {formatARS(w.gastado)} <span className="text-base font-normal text-muted">de {formatARS(Math.max(0, w.limite))}</span>
      </div>
      <Progress className="mt-3" value={w.gastado / Math.max(1, w.limite)} tone={sobro ? "good" : "bad"} />
      <p className="mt-3 text-[13px] text-muted">
        {sobro ? (
          <>
            Te sobraron <span className="font-medium text-good">{formatARS(w.diferencia)}</span>: se sumaron enteros a esta semana.
          </>
        ) : (
          <>
            Te pasaste <span className="font-medium text-bad">{formatARS(-w.diferencia)}</span>: se descuenta repartido en las semanas que
            quedan del mes.
          </>
        )}
      </p>
    </Card>
  );
}

/* --------------------------------- Mes actual -------------------------------- */

function MesActual({ engine }: { engine: EngineResult }) {
  const data = useApp((s) => s.data);
  const w = engine.actual;
  if (!w) return null;
  const plan = engine.meses[w.mes];
  const tc = data.settings.tipoCambio;
  const bills = billsDelMes(data, w.mes);
  const pagadas = bills.filter((b) => b.pagado).length;
  const tarjetasCaja = bills.reduce((s, b) => s + billTotalARS(b, tc), 0);
  const ahorroPct = plan.sueldo > 0 ? plan.ahorroDelSueldo / (plan.sueldo + plan.aguinaldoPresupuesto) : 0;
  const recuperando = w.acumulado < 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-muted">{monthLabel(w.mes)}</div>
        {plan.faltante > 0 ? (
          <Badge tone="bad">No alcanza</Badge>
        ) : recuperando ? (
          <Badge tone="warn">Ahorro en riesgo</Badge>
        ) : (
          <Badge tone="good" icon={<CircleCheck className="size-3" />}>Ahorro en camino</Badge>
        )}
      </div>
      <dl className="mt-4 grid gap-3 text-[15px]">
        <Linea label="Sueldo" value={formatARS(plan.sueldo + plan.aguinaldo)} note={plan.sueldoEstimado ? "estimado" : plan.aguinaldo ? "con aguinaldo" : undefined} />
        <Linea
          label={`Ahorro del mes${ahorroPct ? ` (${formatPercent(ahorroPct)})` : ""}`}
          value={`− ${formatARS(plan.ahorroMeta)}`}
          tone="good"
        />
        <Linea
          label="Tarjetas"
          value={`− ${formatARS(plan.tarjetas)}`}
          note={bills.length ? `${pagadas}/${bills.length} pagas` : undefined}
          onClick={() => navigate("/tarjetas")}
        />
        <div className="h-px bg-line" />
        <Linea label={`Para el día a día (${plan.lunes.length} semanas)`} value={formatARS(Math.max(0, plan.libre))} strong />
      </dl>
      {Math.abs(tarjetasCaja - plan.tarjetas) > 100 && (
        <p className="mt-3 text-[12px] text-faint">
          En caja este mes salen {formatARS(tarjetasCaja)} de tarjetas: los fijos corridos de mes se cuentan una vez por mes para que no te
          desarmen la semana.
        </p>
      )}
      {recuperando && (
        <p className="mt-3 text-[13px] text-warn">
          Venís {formatARS(-w.acumulado)} arriba del presupuesto. Si respetás los próximos límites, lo recuperás antes de fin de mes.
        </p>
      )}
    </Card>
  );
}

function Linea({
  label,
  value,
  note,
  tone,
  strong,
  onClick,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good";
  strong?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <dt className="min-w-0 truncate text-muted">
        {label}
        {note && <span className="ml-2 text-xs text-faint">{note}</span>}
      </dt>
      <dd className={cn("shrink-0 tnum", strong ? "font-semibold text-ink" : "text-ink-2", tone === "good" && "text-good")}>{value}</dd>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className="-mx-1 flex items-center justify-between gap-3 rounded-md px-1 text-left hover:bg-white/[0.03]">
      {inner}
    </button>
  ) : (
    <div className="flex items-center justify-between gap-3">{inner}</div>
  );
}

/* --------------------------------- Promedios -------------------------------- */

function Promedios() {
  const m = useMetrics();
  const vs = m.vsMesAnterior;
  const items = [
    { label: "Promedio 4 semanas", value: m.promedio4 != null ? formatARS(m.promedio4) : "—", sub: "día a día" },
    {
      label: "Gasto mensual",
      value: m.promedioMensual != null ? formatARS(m.promedioMensual) : "—",
      sub: m.mesesConDatos ? `promedio de ${m.mesesConDatos} mes${m.mesesConDatos > 1 ? "es" : ""}` : "al cerrar el 1er mes",
    },
    {
      label: "vs mes anterior",
      value:
        vs == null ? (
          "—"
        ) : (
          <span className={cn("inline-flex items-center gap-1", vs > 0 ? "text-bad" : "text-good")}>
            {vs > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            {formatPercent(vs, { signed: true })}
          </span>
        ),
      sub: m.ultimoMesCompleto ? `gasto total de ${monthLabel(m.ultimoMesCompleto.mes, { capital: false, year: false })}` : "gasto total",
    },
  ];
  return (
    <Card className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y xl:grid-cols-3 xl:divide-x xl:divide-y-0">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between gap-3 px-5 py-3.5 sm:block sm:p-4 lg:flex lg:px-5 lg:py-3.5 xl:block xl:p-4"
        >
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-muted">{it.label}</div>
            <div className="text-[12px] text-faint sm:hidden lg:block xl:hidden">{it.sub}</div>
          </div>
          <div className="shrink-0 text-right sm:mt-1 sm:text-left lg:mt-0 lg:text-right xl:mt-1 xl:text-left">
            <div className="text-lg font-semibold tracking-tight text-ink">{it.value}</div>
            <div className="mt-0.5 hidden truncate text-xs text-faint sm:block lg:hidden xl:block">{it.sub}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------------------------------- Gráfico --------------------------------- */

function GraficoSemanas({ engine }: { engine: EngineResult }) {
  const datos: BarDatum[] = useMemo(
    () =>
      engine.semanas
        .filter((s) => s.estado === "cerrada" && s.gastado != null)
        .slice(-10)
        .map((s) => ({
          key: s.lunes,
          label: s.lunes.slice(8, 10) + "/" + s.lunes.slice(5, 7),
          value: s.gastado ?? 0,
          ref: Math.max(0, s.limite),
          tone: (s.diferencia ?? 0) >= 0 ? "good" : "bad",
        })),
    [engine.semanas],
  );
  return (
    <Card className="p-5">
      <SectionTitle className="px-0">Gasto por semana</SectionTitle>
      {datos.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Aparece cuando cierres tu primera semana (el próximo corte).</p>
      ) : (
        <>
          <BarChart
            data={datos}
            ariaLabel="Gasto del día a día por semana, con el límite de cada una"
            renderTooltip={(d) => {
              const dif = (d.ref ?? 0) - d.value;
              return (
                <div className="text-[13px]">
                  <div className="font-semibold text-ink tnum">{formatARS(d.value)}</div>
                  <div className="text-muted">Semana del {weekRangeLabel(d.key)}</div>
                  <div className="mt-1 text-muted">
                    Límite {formatARS(d.ref ?? 0)} · <span className={dif >= 0 ? "text-good" : "text-bad"}>{dif >= 0 ? "sobró" : "pasó"} {formatARS(Math.abs(dif))}</span>
                  </div>
                </div>
              );
            }}
          />
          <div className="mt-3">
            <Legend
              items={[
                { label: "Dentro del límite", tone: "good" },
                { label: "Te pasaste", tone: "bad" },
                { label: "Límite", kind: "ref" },
              ]}
            />
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------ Próximos pagos ------------------------------ */

function ProximosPagos() {
  const data = useApp((s) => s.data);
  const mes = useMesActual();
  const tc = data.settings.tipoCambio;
  const tarjeta = (id: string) => data.tarjetas.find((t) => t.id === id);
  const filas = [mes, addMonthsISO(mes, 1)].flatMap((m) =>
    billsDelMes(data, m)
      .filter((b) => b.lines.length > 0 || b.pagado)
      .map((b) => ({ b, m })),
  );
  if (!filas.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <SectionTitle className="mb-0 px-0">Tarjetas</SectionTitle>
        <button onClick={() => navigate("/tarjetas")} className="text-[13px] font-medium text-brand hover:underline">
          Ver todo
        </button>
      </div>
      <ul>
        {filas.map(({ b, m }) => {
          const t = tarjeta(b.tarjetaId);
          return (
            <li key={`${m}-${b.tarjetaId}`} className="flex items-center gap-3 border-t border-line px-5 py-3">
              <Dot color={t?.color ?? "#71717a"} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] text-ink">{t?.nombre ?? "Tarjeta"}</div>
                <div className="text-[13px] text-muted">
                  {monthShort(m)}
                  {b.pagado ? ` · pagada el ${dayLabel(b.pagos[0].fecha)}` : t?.vencimientoDia ? ` · vence ~${t.vencimientoDia}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("text-[15px] tnum", b.pagado ? "text-muted line-through decoration-white/20" : "text-ink")}>
                  {formatARS(b.pagado ? b.pagadoEquivARS : billEstimadoARS(b, tc))}
                </div>
                {!b.pagado && m === mes && (
                  <button onClick={() => openSheet({ kind: "pago", tarjetaId: b.tarjetaId, mes: m })} className="text-[13px] font-medium text-brand hover:underline">
                    Pagar
                  </button>
                )}
                {b.pagado && <span className="text-[12px] text-good">Pagada</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
