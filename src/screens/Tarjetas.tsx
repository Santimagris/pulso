import { CircleCheck, CreditCard, Plus, Repeat } from "lucide-react";
import { useMemo, useState } from "react";

import { BarChart, type BarDatum } from "@/charts/BarChart";
import { tieneMontoDelMes, billEstimadoARS, billPresupuestoARS, billsDelMes, billTotalARS, cuotaEnMes, cuotasRestantes, ultimoMes } from "@/domain/bills";
import { addMonthsISO, dayLabel, monthLabel, monthShort } from "@/domain/dates";
import { formatARS, formatMoney } from "@/domain/money";
import type { Bill } from "@/domain/bills";
import { useMesActual } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { openSheet } from "@/lib/ui-store";
import { PageHeader } from "@/layout/AppShell";
import { useApp } from "@/sync/store";
import { Badge, Button, Card, Dot, Empty, MonthStepper, Row, SectionTitle } from "@/ui/primitives";

export function Tarjetas() {
  const data = useApp((s) => s.data);
  const mesActual = useMesActual();
  const [mes, setMes] = useState(mesActual);
  const tc = data.settings.tipoCambio;
  const tarjetas = data.tarjetas.filter((t) => !t.archivada);
  const bills = billsDelMes(data, mes);
  const total = bills.reduce((s, b) => s + billTotalARS(b, tc), 0);
  const pagado = bills.filter((b) => b.pagado).reduce((s, b) => s + b.pagadoEquivARS, 0);
  const presupuesto = bills.reduce((s, b) => s + billPresupuestoARS(b, tc), 0);
  const sinMov = tarjetas.filter((t) => !bills.some((b) => b.tarjetaId === t.id));

  const proyeccion: BarDatum[] = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => addMonthsISO(mesActual, i)).map((m) => ({
        key: m,
        label: monthShort(m),
        value: billsDelMes(data, m).reduce((s, b) => s + billTotalARS(b, tc), 0),
        tone: "brand" as const,
      })),
    [data, mesActual, tc],
  );

  if (!tarjetas.length) {
    return (
      <>
        <PageHeader title="Tarjetas" />
        <Card>
          <Empty
            icon={<CreditCard className="size-5" />}
            title="Cargá tus tarjetas"
            text="Con el día de cierre y vencimiento, Pulso sabe en qué mes pagás cada compra."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openSheet({ kind: "tarjeta" })}>
                Agregar tarjeta
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tarjetas"
        action={
          <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => openSheet({ kind: "compra" })}>
            Compra
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-5">
        <div className="grid content-start gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <MonthStepper mes={mes} onChange={(d) => setMes((m) => addMonthsISO(m, d))} className="-ml-2" />
              {mes !== mesActual && (
                <button className="text-[13px] font-medium text-brand" onClick={() => setMes(mesActual)}>
                  Hoy
                </button>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 px-1">
              <div>
                <div className="text-[13px] text-muted">Total del mes</div>
                <div className="text-[30px] font-semibold tracking-tight">{formatARS(total)}</div>
              </div>
              <div className="text-right text-[13px]">
                {pagado > 0 && <div className="text-good">Pagado {formatARS(pagado)}</div>}
                {total - pagado > 0 && bills.some((b) => !b.pagado) && <div className="text-muted">Pendiente {formatARS(total - pagado)}</div>}
              </div>
            </div>
            {Math.abs(presupuesto - total) > 100 && (
              <p className="mt-2 px-1 text-[12px] text-faint">
                Para tu presupuesto cuentan {formatARS(presupuesto)} (sin especiales y con los fijos una vez por mes).
              </p>
            )}
          </Card>

          {bills.length === 0 && (
            <Card>
              <Empty title={`Sin cuotas en ${monthLabel(mes, { capital: false })}`} text="No hay nada para pagar este mes." />
            </Card>
          )}
          {bills.map((b) => (
            <ResumenCard key={b.tarjetaId} b={b} mesActual={mesActual} />
          ))}
          {sinMov.length > 0 && bills.length > 0 && (
            <p className="px-1 text-[13px] text-faint">Sin movimientos: {sinMov.map((t) => t.nombre).join(", ")}</p>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Card className="p-5">
            <SectionTitle className="px-0">Próximos meses</SectionTitle>
            <BarChart
              data={proyeccion}
              height={170}
              selectedKey={mes}
              onSelect={setMes}
              ariaLabel="Total a pagar de tarjetas en los próximos 6 meses"
              renderTooltip={(d) => (
                <div className="text-[13px]">
                  <div className="font-semibold text-ink tnum">{formatARS(d.value)}</div>
                  <div className="text-muted capitalize">{monthLabel(d.key, { capital: false })}</div>
                </div>
              )}
            />
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
              {proyeccion.map((p) => (
                <li key={p.key}>
                  <button onClick={() => setMes(p.key)} className={cn("flex w-full justify-between gap-2 text-left", p.key === mes ? "text-ink" : "text-muted")}>
                    <span className="capitalize">{p.label}</span> <span className="tnum">{formatARS(p.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <CuotasActivas />
          <Fijos />
          <TusTarjetas />
        </div>
      </div>
    </>
  );
}

function ResumenCard({ b, mesActual }: { b: Bill; mesActual: string }) {
  const data = useApp((s) => s.data);
  const tc = data.settings.tipoCambio;
  const t = data.tarjetas.find((x) => x.id === b.tarjetaId);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Dot color={t?.color ?? "#71717a"} className="size-3" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">{t?.nombre ?? "Tarjeta"}</div>
          <div className="text-[12px] text-faint">
            {t?.cierreDia ? `cierra ~${t.cierreDia}` : "sin cierre"} · {t?.vencimientoDia ? `vence ~${t.vencimientoDia}` : "sin vencimiento"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tnum">{formatARS(b.pagado ? b.pagadoEquivARS : billEstimadoARS(b, tc))}</div>
          {b.usd > 0 && <div className="text-[12px] text-muted">{formatARS(b.ars)} + {formatMoney(b.usd, "USD")}</div>}
        </div>
      </div>
      <ul className="border-t border-line">
        {b.lines.map((l) => {
          const r = l.kind === "recurrente" ? data.recurrentes.find((x) => x.id === l.refId) : undefined;
          return (
            <li key={`${l.kind}-${l.refId}`} className="border-b border-line/70 last:border-0">
              <button
                onClick={() =>
                  openSheet(l.kind === "compra" ? { kind: "compra", compraId: l.refId } : { kind: "fijoMes", recurrenteId: l.refId, mes: b.mes })
                }
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-ink-2">
                    {l.descripcion}
                    {l.especial && <Badge tone="info" className="ml-2 px-1.5 py-0.5 text-[10px]">especial</Badge>}
                  </div>
                  <div className="text-[12px] text-faint">
                    {l.cuota ? (l.cuota.de > 1 ? `cuota ${l.cuota.n} de ${l.cuota.de}` : "1 pago") : (
                      <span>
                        <Repeat className="mr-1 inline size-3 align-[-2px]" />
                        fijo · {r && tieneMontoDelMes(r, b.mes) ? "anotado" : "estimado · tocá para anotar"}
                        {l.veces && l.veces !== 1 ? ` · ${l.veces} cuotas` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-[14px] text-ink tnum">{formatMoney(l.monto, l.moneda)}</div>
              </button>
            </li>
          );
        })}
        {data.recurrentes
          .filter((r) => r.tarjetaId === b.tarjetaId && (r.veces?.[b.mes] ?? 1) === 0 && r.desdeMes <= b.mes && (!r.hastaMes || b.mes <= r.hastaMes))
          .map((r) => (
            <li key={`cero-${r.id}`} className="border-b border-line/70 last:border-0">
              <button
                onClick={() => openSheet({ kind: "fijoMes", recurrenteId: r.id, mes: b.mes })}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] text-faint transition hover:bg-white/[0.03]"
              >
                <span>{r.descripcion} · este mes no vino</span>
                <span className="text-brand">Cambiar</span>
              </button>
            </li>
          ))}
      </ul>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {b.pagado ? (
          <Badge tone="good" icon={<CircleCheck className="size-3" />}>
            Pagada {dayLabel(b.pagos[0].fecha)}
          </Badge>
        ) : (
          <span className="text-[13px] text-muted">{b.mes < mesActual ? "Vencida sin marcar" : "Pendiente"}</span>
        )}
        <Button size="sm" variant={b.pagado ? "ghost" : "secondary"} onClick={() => openSheet({ kind: "pago", tarjetaId: b.tarjetaId, mes: b.mes })}>
          {b.pagado ? "Ver pago" : "Pagar"}
        </Button>
      </div>
    </Card>
  );
}

function CuotasActivas() {
  const data = useApp((s) => s.data);
  const mes = useMesActual();
  const activas = data.compras
    .filter((c) => c.cuotas > 1 && cuotasRestantes(c, mes) > 0)
    .sort((a, b) => ultimoMes(a).localeCompare(ultimoMes(b)));
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <SectionTitle className="mb-0 px-0">Cuotas activas</SectionTitle>
        <span className="text-[13px] text-faint">{activas.length}</span>
      </div>
      {activas.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-muted">No tenés compras en cuotas pendientes.</p>
      ) : (
        <ul>
          {activas.map((c) => {
            const t = data.tarjetas.find((x) => x.id === c.tarjetaId);
            const n = cuotaEnMes(c, mes);
            return (
              <li key={c.id} className="border-t border-line">
                <Row
                  onClick={() => openSheet({ kind: "compra", compraId: c.id })}
                  leading={<Dot color={t?.color ?? "#71717a"} />}
                  title={c.descripcion}
                  subtitle={`${n ? `cuota ${n} de ${c.cuotas}` : `arranca en ${monthShort(c.primerMes)}`} · termina ${monthShort(ultimoMes(c), true)}`}
                  right={<span className="tnum">{formatMoney(c.montoCuota, c.moneda)}</span>}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Fijos() {
  const data = useApp((s) => s.data);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <SectionTitle className="mb-0 px-0">Fijos de tarjeta</SectionTitle>
        <button onClick={() => openSheet({ kind: "recurrente" })} className="text-[13px] font-medium text-brand">
          Agregar
        </button>
      </div>
      {data.recurrentes.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-muted">El plan del auto, Spotify… se cargan solos cada mes.</p>
      ) : (
        <ul>
          {data.recurrentes.map((r) => {
            const t = data.tarjetas.find((x) => x.id === r.tarjetaId);
            return (
              <li key={r.id} className="border-t border-line">
                <Row
                  onClick={() => openSheet({ kind: "recurrente", recurrenteId: r.id })}
                  leading={<Dot color={t?.color ?? "#71717a"} />}
                  title={r.descripcion}
                  subtitle={`${t?.nombre ?? ""}${r.hastaMes ? ` · hasta ${monthShort(r.hastaMes, true)}` : ""}`}
                  right={<span className="tnum">{formatMoney(r.monto, r.moneda)}/mes</span>}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TusTarjetas() {
  const data = useApp((s) => s.data);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <SectionTitle className="mb-0 px-0">Tus tarjetas</SectionTitle>
        <button onClick={() => openSheet({ kind: "tarjeta" })} className="text-[13px] font-medium text-brand">
          Agregar
        </button>
      </div>
      <ul>
        {data.tarjetas
          .filter((t) => !t.archivada)
          .map((t) => (
            <li key={t.id} className="border-t border-line">
              <Row
                onClick={() => openSheet({ kind: "tarjeta", tarjetaId: t.id })}
                leading={<Dot color={t.color} />}
                title={t.nombre}
                subtitle={`${t.cierreDia ? `cierra ~${t.cierreDia}` : "sin cierre"} · ${t.vencimientoDia ? `vence ~${t.vencimientoDia}` : "sin vencimiento"}`}
              />
            </li>
          ))}
      </ul>
    </Card>
  );
}

