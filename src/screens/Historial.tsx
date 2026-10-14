import { CalendarCheck, CreditCard, Gift, PiggyBank, Wallet } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { dayLabel, monthLabel, weekRangeLabel } from "@/domain/dates";
import { valorSaldos } from "@/domain/engine";
import { formatARS, formatPercent } from "@/domain/money";
import { useEngine } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { openSheet } from "@/lib/ui-store";
import { PageHeader } from "@/layout/AppShell";
import { useApp } from "@/sync/store";
import { Segmented } from "@/ui/form";
import { Badge, Card, Empty } from "@/ui/primitives";

type Tab = "semanas" | "meses" | "movimientos";

export function Historial() {
  const [tab, setTab] = useState<Tab>("semanas");
  return (
    <>
      <PageHeader title="Historial" />
      <Segmented
        className="mb-4 max-w-md"
        value={tab}
        onChange={setTab}
        options={[
          { value: "semanas", label: "Semanas" },
          { value: "meses", label: "Meses" },
          { value: "movimientos", label: "Movimientos" },
        ]}
      />
      {tab === "semanas" && <Semanas />}
      {tab === "meses" && <Meses />}
      {tab === "movimientos" && <Movimientos />}
    </>
  );
}

function Semanas() {
  const engine = useEngine();
  const semanas = [...engine.semanas].reverse();
  if (!semanas.length) return <Card><Empty title="Todavía no hay semanas" text="Hacé tu primer corte." /></Card>;
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 border-b border-line px-5 py-2.5 text-[12px] font-medium text-faint sm:grid">
        <span>Semana</span>
        <span className="text-right">Gastaste</span>
        <span className="text-right">Límite</span>
        <span className="text-right">Resultado</span>
      </div>
      <ul className="divide-y divide-line">
        {semanas.map((s) => (
          <li key={s.lunes} className="grid grid-cols-2 gap-x-3 gap-y-1 px-5 py-3 text-[14px] sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center">
            <span className="text-ink">
              {weekRangeLabel(s.lunes)}
              {s.cobertura < 1 && <span className="ml-1.5 text-[12px] text-faint">(parcial)</span>}
            </span>
            <span className="text-right text-ink-2 tnum sm:order-none">{s.gastado != null ? formatARS(s.gastado) : s.gastadoParcial > 0 ? `${formatARS(s.gastadoParcial)}…` : "—"}</span>
            <span className="text-[13px] text-muted tnum sm:text-right sm:text-[14px]">límite {formatARS(Math.max(0, s.limite))}</span>
            <span className="text-right">
              {s.estado === "actual" ? (
                <Badge tone="brand">En curso</Badge>
              ) : s.estado === "pendiente" ? (
                <Badge tone="warn">Sin corte</Badge>
              ) : (s.diferencia ?? 0) >= 0 ? (
                <span className="text-[13px] text-good tnum">sobró {formatARS(s.diferencia ?? 0)}</span>
              ) : (
                <span className="text-[13px] text-bad tnum">pasó {formatARS(-(s.diferencia ?? 0))}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Meses() {
  const engine = useEngine();
  const meses = [...engine.resumenes].reverse();
  if (!meses.length) return <Card><Empty title="Todavía no hay meses" text="Hacé tu primer corte." /></Card>;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {meses.map((r) => {
        const linea = (label: string, value: ReactNode, cls?: string) => (
          <div className="flex justify-between gap-3">
            <span className="text-muted">{label}</span>
            <span className={cn("tnum", cls)}>{value}</span>
          </div>
        );
        return (
          <Card key={r.mes} className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-ink">{monthLabel(r.mes)}</div>
              {!r.completo ? (
                <Badge tone="brand">En curso</Badge>
              ) : r.parcial ? (
                <Badge>Parcial</Badge>
              ) : r.ahorroReal >= r.ahorroMeta ? (
                <Badge tone="good">Meta cumplida</Badge>
              ) : (
                <Badge tone={r.ahorroReal >= 0 ? "warn" : "bad"}>Bajo la meta</Badge>
              )}
            </div>
            <div className="mt-3 grid gap-1.5 text-[14px]">
              {linea("Ingresos", formatARS(r.ingresos), "text-ink-2")}
              {linea("Tarjetas", `− ${formatARS(r.tarjetasTotal)}`, "text-ink-2")}
              {linea(`Día a día (${r.semanasCerradas}/${r.semanasTotales} sem.)`, `− ${formatARS(r.gastoSemanal)}`, "text-ink-2")}
              {r.especialesDirectos > 0 && linea("Especiales", `− ${formatARS(r.especialesDirectos)}`, "text-info")}
              <div className="my-1 h-px bg-line" />
              {linea("Consumo total", formatARS(r.consumo), "font-medium text-ink")}
              {r.completo &&
                linea(
                  "Ahorro real",
                  `${formatARS(r.ahorroReal)}${r.ingresos > 0 ? ` · ${formatPercent(r.ahorroReal / r.ingresos)}` : ""}`,
                  r.ahorroReal >= r.ahorroMeta ? "text-good font-medium" : "text-warn font-medium",
                )}
              {linea("Meta del mes", formatARS(r.ahorroMeta), "text-muted")}
              {r.deficitAbsorbido > 0 && (
                <p className="mt-1 text-[12px] text-faint">
                  Cerró {formatARS(r.deficitAbsorbido)} por encima del presupuesto: salió del ahorro y el mes siguiente arrancó limpio.
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

type Mov = { key: string; fecha: string; icon: ReactNode; title: string; sub: string; amount: string; tone?: string; onClick?: () => void };

function Movimientos() {
  const data = useApp((s) => s.data);
  const dispatch = useApp((s) => s.dispatch);
  const tc = data.settings.tipoCambio;
  const tarjeta = (id: string) => data.tarjetas.find((t) => t.id === id)?.nombre ?? "Tarjeta";

  const movs: Mov[] = useMemo(() => {
    const out: Mov[] = [];
    for (const c of data.cortes)
      out.push({
        key: `c-${c.id}`,
        fecha: c.fecha,
        icon: <CalendarCheck className="size-4" />,
        title: "Corte",
        sub: `MP ${formatARS(c.mp)}${c.ahorro ? ` · ahorro ${formatARS(c.ahorro)}` : ""}${c.efectivo ? ` · efectivo ${formatARS(c.efectivo)}` : ""}${c.nota ? ` · ${c.nota}` : ""}`,
        amount: formatARS(valorSaldos(c, tc)),
        onClick: () => openSheet({ kind: "corte", corteId: c.id }),
      });
    for (const i of data.ingresos)
      out.push({
        key: `i-${i.id}`,
        fecha: i.fecha,
        icon: <Wallet className="size-4" />,
        title: i.tipo === "sueldo" ? "Sueldo" : i.tipo === "aguinaldo" ? "Aguinaldo" : i.nota || "Ingreso",
        sub: i.tipo === "extra" ? (i.destino === "semana" ? "sumado a la semana" : "al ahorro") : i.mes ? `de ${monthLabel(i.mes, { capital: false, year: false })}` : "",
        amount: `+${formatARS(i.monto)}`,
        tone: "text-good",
        onClick: () => openSheet({ kind: "ingreso", ingresoId: i.id }),
      });
    for (const p of data.pagos)
      out.push({
        key: `p-${p.id}`,
        fecha: p.fecha,
        icon: <CreditCard className="size-4" />,
        title: `Pago ${tarjeta(p.tarjetaId)}`,
        sub: `resumen de ${monthLabel(p.mes, { capital: false, year: false })}`,
        amount: formatARS(p.montoARS + p.montoUSD * p.tipoCambio),
        onClick: () => openSheet({ kind: "pago", tarjetaId: p.tarjetaId, mes: p.mes }),
      });
    for (const e of data.especiales)
      out.push({
        key: `e-${e.id}`,
        fecha: e.fecha,
        icon: <Gift className="size-4" />,
        title: e.descripcion,
        sub: "gasto especial",
        amount: `−${formatARS(e.monto)}`,
        tone: "text-info",
        onClick: () => openSheet({ kind: "especial", especialId: e.id }),
      });
    for (const x of data.sobrantes)
      out.push({
        key: `s-${x.id}`,
        fecha: x.fecha,
        icon: <PiggyBank className="size-4" />,
        title: "Sobrante al ahorro",
        sub: "tocá para deshacer",
        amount: formatARS(x.monto),
        tone: "text-good",
        onClick: () => {
          if (confirm("¿Deshacer y devolver ese sobrante a la semana?")) dispatch({ type: "sobrante/delete", id: x.id });
        },
      });
    for (const x of data.pases)
      out.push({
        key: `a-${x.id}`,
        fecha: x.fecha,
        icon: <PiggyBank className="size-4" />,
        title: "Pase al ahorro",
        sub: "de gastos a ahorro · tocá para deshacer",
        amount: formatARS(x.monto),
        tone: "text-good",
        onClick: () => {
          if (confirm("¿Deshacer este pase al ahorro?")) dispatch({ type: "pase/delete", id: x.id });
        },
      });
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.key.localeCompare(b.key));
  }, [data, tc, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!movs.length) return <Card><Empty title="Sin movimientos" /></Card>;
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {movs.map((m) => (
          <li key={m.key}>
            <button onClick={m.onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-ink-2">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-ink">{m.title}</span>
                <span className="block truncate text-[12px] text-faint">
                  {dayLabel(m.fecha)}
                  {m.sub && ` · ${m.sub}`}
                </span>
              </span>
              <span className={cn("shrink-0 text-[14px] tnum", m.tone ?? "text-ink-2")}>{m.amount}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
