import { ArrowRightLeft, Car, ChevronDown, Coins, Lightbulb, PiggyBank, Target, TrendingUp } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { BarChart, Legend, type BarDatum } from "@/charts/BarChart";
import { monthLabel, monthShort } from "@/domain/dates";
import { necesidadReservaGastos } from "@/domain/engine";
import { formatARS, formatMoney, formatPercent, formatUSD } from "@/domain/money";
import { mesesComparables, projectGoal } from "@/domain/metrics";
import { useEngine, useMesActual, useMetrics } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { openSheet } from "@/lib/ui-store";
import { PageHeader } from "@/layout/AppShell";
import { useApp } from "@/sync/store";
import { Badge, Button, Card, HeroMoney, Progress, SectionTitle } from "@/ui/primitives";

export function Ahorro() {
  const data = useApp((s) => s.data);
  const engine = useEngine();
  const m = useMetrics();
  const mes = useMesActual();
  const s = data.settings;
  const plan = engine.meses[mes];
  const goal = useMemo(() => projectGoal(data, engine, m, mes), [data, engine, m, mes]);
  const reserva = s.usaReservaAhorro ? necesidadReservaGastos(data, engine) : null;
  const actual = engine.actual;

  const meses = mesesComparables(engine);
  const chart: BarDatum[] = meses.slice(-8).map((r) => ({
    key: r.mes,
    label: monthShort(r.mes),
    value: r.ahorroReal,
    ref: r.ahorroMeta,
    tone: r.ahorroReal >= r.ahorroMeta ? "good" : r.ahorroReal >= 0 ? "warn" : "bad",
  }));

  return (
    <>
      <PageHeader title="Ahorro" subtitle="Primero te pagás a vos; después gastás." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="grid grid-cols-1 content-start gap-4">
          {/* Hero */}
          <Card className="relative overflow-hidden p-5 lg:p-6">
            <div className="pointer-events-none absolute -top-20 -left-10 size-56 rounded-full bg-brand/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[13px] text-muted">
                <PiggyBank className="size-4" /> {m.ahorroAcumulado != null ? "Tenés ahorrado" : "Tenés en total"}
              </div>
              <HeroMoney value={(m.ahorroAcumulado ?? m.totalTenes ?? 0)} className="mt-2 text-[46px] leading-none" />
              <div className="mt-2 text-[13px] text-muted">
                {m.ahorroAcumulado != null
                  ? `En la reserva de ahorro${m.usdTenes ? ` (incluye ${formatUSD(m.usdTenes)})` : ""} · según tu último corte${engine.reservas?.pasado ? " y lo que pasaste después" : ""}`
                  : "Ahorro y plata para gastar juntos. Separalos para ver tu ahorro real."}
              </div>
              {m.ahorroAcumulado == null && (
                <Button className="mt-4" size="sm" variant="secondary" onClick={() => openSheet({ kind: "plan" })}>
                  Separar en una reserva
                </Button>
              )}
            </div>
          </Card>

          {/* Este mes */}
          {plan && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-medium text-muted">{monthLabel(mes)}</div>
                {actual && actual.acumulado < 0 ? (
                  <Badge tone="warn">En riesgo</Badge>
                ) : plan.faltante > 0 ? (
                  <Badge tone="bad">No alcanza</Badge>
                ) : (
                  <Badge tone="good">En camino</Badge>
                )}
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="text-[15px] text-ink-2">Ahorro del mes</span>
                <span className="text-2xl font-semibold text-good tnum">{formatARS(plan.ahorroMeta)}</span>
              </div>
              <div className="mt-1 text-[13px] text-muted">
                {s.ahorroModo === "porcentaje" ? `${s.ahorroPorcentaje}% del sueldo` : "monto fijo"}
                {plan.aguinaldoAhorro > 0 && ` + ${formatARS(plan.aguinaldoAhorro)} de aguinaldo`}
                {plan.extrasAhorro > 0 && ` + ${formatARS(plan.extrasAhorro)} de extras`}
              </div>
              {(plan.tarjetasEspeciales > 0 || engine.resumenes.find((r) => r.mes === mes)?.especialesDirectos) ? (
                <div className="mt-2 text-[13px] text-info">
                  Gastos especiales del mes: −{formatARS(plan.tarjetasEspeciales + (engine.resumenes.find((r) => r.mes === mes)?.especialesDirectos ?? 0))}
                </div>
              ) : null}
              {actual && actual.acumulado < 0 && (
                <p className="mt-3 text-[13px] text-warn">
                  Vas {formatARS(-actual.acumulado)} por encima del presupuesto. Si no lo recuperás antes de fin de mes, sale de este ahorro.
                </p>
              )}
              {actual && actual.acumulado > 0 && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-good/[0.07] p-3">
                  <div className="text-[13px] text-ink-2">
                    Sobrante disponible <span className="font-semibold text-good">{formatARS(actual.acumulado)}</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openSheet({ kind: "sobrante" })}>
                    Al ahorro
                  </Button>
                </div>
              )}
              <div className="mt-4 rounded-xl bg-white/[0.04] p-3 text-[13px] leading-relaxed text-muted">
                <b className="text-ink-2">El día que cobrás:</b> pasá {formatARS(plan.ahorroMeta)} a la reserva de ahorro antes de gastar nada. Lo que queda es para
                tarjetas y el día a día.
              </div>
            </Card>
          )}

          {/* Reservas */}
          {reserva && (
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
                <ArrowRightLeft className="size-4" /> Organizá tus reservas
              </div>
              <div className="mt-3 grid gap-1.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-muted">En gastos tenés (cuenta + reserva)</span>
                  <span className="tnum">{formatARS(reserva.tenes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Para lo que queda del mes necesitás</span>
                  <span className="tnum">{formatARS(reserva.necesario - (reserva.mesQueViene?.monto ?? 0))}</span>
                </div>
                {reserva.mesQueViene && (
                  <div className="flex justify-between">
                    <span className="text-muted">Para {monthLabel(reserva.mesQueViene.mes, { capital: false, year: false })} (ya cobraste el sueldo)</span>
                    <span className="tnum">{formatARS(reserva.mesQueViene.monto)}</span>
                  </div>
                )}
              </div>
              {reserva.paraAhorrar > 0 ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-good">Te sobran {formatARS(reserva.paraAhorrar)}: podés pasarlos a la reserva de ahorro.</p>
                  <Button size="sm" variant="secondary" icon={<PiggyBank className="size-4" />} onClick={() => openSheet({ kind: "ahorrar" })}>
                    Ahorrar
                  </Button>
                </div>
              ) : reserva.paraSacar > 0 ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-warn">Te faltan {formatARS(reserva.paraSacar)} en gastos: pasalos desde ahorro (o ajustá esta semana).</p>
                  <Button size="sm" variant="secondary" icon={<PiggyBank className="size-4" />} onClick={() => openSheet({ kind: "ahorrar", sacar: true })}>
                    Sacar del ahorro
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-good">Está justo: no te sobra ni te falta.</p>
              )}
              <p className="mt-1 text-[12px] text-faint">
                Calculado con tu último corte (y lo que moviste entre reservas después): tarjetas pendientes + lo que te queda de límite este mes.
              </p>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 content-start gap-4">
          {/* Historia */}
          <Card className="p-5">
            <SectionTitle className="px-0">Ahorro real por mes</SectionTitle>
            {chart.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">Aparece cuando cierres tu primer mes completo.</p>
            ) : (
              <>
                <BarChart
                  data={chart}
                  height={180}
                  ariaLabel="Ahorro real de cada mes contra la meta del mes"
                  renderTooltip={(d) => (
                    <div className="text-[13px]">
                      <div className="font-semibold text-ink tnum">{formatARS(d.value)}</div>
                      <div className="text-muted capitalize">{monthLabel(d.key, { capital: false })}</div>
                      <div className="mt-1 text-muted">Meta {formatARS(d.ref ?? 0)}</div>
                    </div>
                  )}
                />
                <div className="mt-3">
                  <Legend items={[{ label: "Llegaste a la meta", tone: "good" }, { label: "Ahorraste menos", tone: "warn" }, { label: "Gastaste de más", tone: "bad" }, { label: "Meta", kind: "ref" }]} />
                </div>
                <ul className="mt-4 divide-y divide-line border-t border-line text-[13px]">
                  {meses.slice(-6).reverse().map((r) => (
                    <li key={r.mes} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-muted capitalize">{monthLabel(r.mes, { capital: false })}</span>
                      <span className="tnum">
                        <span className={r.ahorroReal >= r.ahorroMeta ? "text-good" : r.ahorroReal < 0 ? "text-bad" : "text-warn"}>{formatARS(r.ahorroReal)}</span>
                        <span className="text-faint"> · {r.ingresos > 0 ? formatPercent(r.ahorroReal / r.ingresos) : "—"} del ingreso</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Meta */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
                <Target className="size-4" /> Meta
              </div>
              <button className="text-[13px] font-medium text-brand" onClick={() => openSheet({ kind: "meta" })}>
                {goal ? "Editar" : "Ponerme una"}
              </button>
            </div>
            {!goal ? (
              <p className="mt-2 text-[13px] text-muted">
                Opcional. Por ejemplo: cancelar el plan del auto, o juntar dólares. Te digo cuándo llegás o cuánto comprar por mes.
              </p>
            ) : (
              <div className="mt-3">
                <div className="font-semibold text-ink">{goal.meta.nombre}</div>
                <div className="mt-1 text-[13px] text-muted">
                  {formatMoney(goal.actual, goal.meta.moneda)} de {formatMoney(goal.meta.monto, goal.meta.moneda)}
                </div>
                <Progress className="mt-3" value={goal.progreso} />
                <div className="mt-3 grid gap-1.5 text-[13px]">
                  {goal.faltante === 0 ? (
                    <span className="text-good">¡Llegaste! 🎉</span>
                  ) : (
                    <>
                      <span className="text-muted">
                        A tu ritmo ({formatMoney(goal.ritmoMensual, goal.meta.moneda)}/mes{goal.ritmoFuente === "plan" ? ", el del plan" : ""}):{" "}
                        <span className="text-ink">{goal.mesEstimado ? `llegás en ${monthLabel(goal.mesEstimado, { capital: false })}` : "no llegás sin ahorrar más"}</span>
                      </span>
                      {goal.requeridoMensual != null && (
                        <span className="text-muted">
                          Para llegar en fecha necesitás <span className="text-ink">{formatMoney(goal.requeridoMensual, goal.meta.moneda)}/mes</span>
                          {goal.requeridoMensualARS != null && ` (~${formatARS(goal.requeridoMensualARS)})`}
                        </span>
                      )}
                      {goal.meta.moneda === "USD" && (
                        <span className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-2 text-ink-2">
                          <Coins className="size-4 text-warn" />
                          Comprá {formatUSD(Math.ceil((goal.requeridoMensual ?? goal.ritmoMensual) / 100) * 100)} por mes, siempre el mismo día (después de cobrar).
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Plan */}
          <Card className="flex items-center justify-between gap-3 p-5">
            <div className="min-w-0 text-[13px] text-muted">
              <div className="text-[15px] font-medium text-ink">Tu plan</div>
              {s.ahorroModo === "porcentaje" ? `Ahorrás ${s.ahorroPorcentaje}% del sueldo` : `Ahorrás ${formatARS(s.ahorroMonto)} por mes`} · aguinaldo{" "}
              {s.aguinaldo === "presupuesto" ? "como sueldo" : s.aguinaldo === "mitad" ? "mitad al ahorro" : "todo al ahorro"}
            </div>
            <Button size="sm" variant="secondary" onClick={() => openSheet({ kind: "plan" })}>
              Editar
            </Button>
          </Card>

          <Consejos />
        </div>
      </div>
    </>
  );
}

function Consejos() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2 text-[13px] font-medium text-muted">
        <Lightbulb className="size-4 text-warn" /> Cómo ahorrar mejor
      </div>
      <Consejo icon={<PiggyBank className="size-4" />} title="Págate primero, no lo que sobra">
        El ahorro se separa el día que cobrás, antes de gastar nada. Lo que sobra a fin de mes casi nunca existe; lo que separás primero, sí.
      </Consejo>
      <Consejo icon={<ArrowRightLeft className="size-4" />} title="Dos reservas en Mercado Pago">
        Una para gastar y otra para el ahorro. Rinden lo mismo, pero separadas no te comés el ahorro sin darte cuenta, y ves cuánto
        ahorraste de verdad.
      </Consejo>
      <Consejo icon={<Coins className="size-4" />} title="Pesos para el colchón, dólares para lo que no vas a tocar">
        Un colchón de 2 a 3 meses de gastos en la reserva en pesos: rinde y lo tenés al toque. Lo que pase de ahí, en dólares de a poco
        todos los meses (siempre el mismo día), así promediás el precio.
      </Consejo>
      <Consejo icon={<Car className="size-4" />} title="¿Adelantar cuotas del auto?">
        La cuota del plan sigue al precio del auto. Si sube por mes más de lo que te rinde la reserva (TNA ÷ 12), adelantar cuotas te
        conviene más que tener la plata quieta. Pedí a la administradora el valor para adelantar o cancelar y comparalo.
      </Consejo>
      <Consejo icon={<TrendingUp className="size-4" />} title="Subí el ahorro de a poco">
        Arrancá con algo que puedas sostener (20%) y subilo 2 puntos cada 2 o 3 meses, o cuando te aumentan el sueldo. Un plan imposible
        se abandona.
      </Consejo>
    </Card>
  );
}

function Consejo({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.03]" aria-expanded={open}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-ink-2">{icon}</span>
        <span className="flex-1 text-[14px] font-medium text-ink">{title}</span>
        <ChevronDown className={cn("size-4 text-faint transition", open && "rotate-180")} />
      </button>
      {open && <p className="px-5 pb-4 pl-16 text-[13px] leading-relaxed text-muted">{children}</p>}
    </div>
  );
}
