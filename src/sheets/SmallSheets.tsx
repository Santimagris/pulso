import { CalendarCheck, CreditCard, Gift, Gauge, PiggyBank, TriangleAlert, Wallet } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { dayLabel, monthLabel, weekRangeLabel } from "@/domain/dates";
import { consultar, necesidadReservaGastos, sortedCortes } from "@/domain/engine";
import { formatARS } from "@/domain/money";
import type { GastoEspecial, Ingreso } from "@/domain/types";
import { useEngine } from "@/lib/hooks";
import { nowISO, uid } from "@/lib/cn";
import { closeSheet, openSheet, toast } from "@/lib/ui-store";
import { useApp } from "@/sync/store";
import { DateInput, Field, MoneyInput, Segmented, TextInput } from "@/ui/form";
import { Button, Card, HeroMoney, Progress } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";

/* ------------------------------- Acciones (+) ------------------------------- */

export function AccionesSheet({ open }: { open: boolean }) {
  const puedeAhorrar = useApp((s) => s.data.settings.usaReservaAhorro && s.data.cortes.length > 0);
  const item = (icon: ReactNode, title: string, text: string, onClick: () => void, primary?: boolean) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        primary ? "border-brand/30 bg-brand/[0.08] hover:bg-brand/[0.12]" : "border-line bg-surface-2 hover:bg-surface-3"
      }`}
    >
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${primary ? "bg-brand text-brand-ink" : "bg-white/[0.06] text-ink-2"}`}>{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-[13px] text-muted">{text}</div>
      </div>
    </button>
  );
  return (
    <Sheet open={open} onClose={closeSheet} title="¿Qué querés anotar?">
      <div className="grid gap-2.5 pb-2">
        {item(<CalendarCheck className="size-5" />, "Hacer el corte", "Cuánto tenés hoy. Lo hacés los lunes.", () => openSheet({ kind: "corte" }), true)}
        {puedeAhorrar &&
          item(<PiggyBank className="size-5" />, "Ahorrar", "Pasá plata de gastos a la reserva de ahorro.", () => openSheet({ kind: "ahorrar" }))}
        {item(<CreditCard className="size-5" />, "Compra con tarjeta", "En 1 o más cuotas.", () => openSheet({ kind: "compra" }))}
        {item(<Gauge className="size-5" />, "¿Cuánto me queda?", "Consultá la semana sin guardar nada.", () => openSheet({ kind: "consulta" }))}
        {item(<Gift className="size-5" />, "Gasto especial", "Algo grande que sale del ahorro (regalo, viaje).", () => openSheet({ kind: "especial" }))}
        {item(<Wallet className="size-5" />, "Ingreso", "Sueldo, aguinaldo u otra plata que entró.", () => openSheet({ kind: "ingreso" }))}
      </div>
    </Sheet>
  );
}

/* -------------------------------- Consulta -------------------------------- */

export function ConsultaSheet({ open }: { open: boolean }) {
  const data = useApp((s) => s.data);
  const engine = useEngine();
  const ultimo = sortedCortes(data).at(-1);
  const { settings } = data;
  const [mp, setMp] = useState<number | null>(null);
  const [ahorro, setAhorro] = useState<number | null>(engine.reservas?.ahorro ?? ultimo?.ahorro ?? 0);
  const [efectivo, setEfectivo] = useState<number | null>(ultimo?.efectivo ?? 0);
  const [usd, setUsd] = useState<number | null>(ultimo?.usd ?? 0);

  const r = useMemo(
    () => (mp == null ? null : consultar(data, engine, { mp, ahorro: ahorro ?? 0, efectivo: efectivo ?? 0, usd: usd ?? 0 })),
    [data, engine, mp, ahorro, efectivo, usd],
  );

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title="¿Cuánto me queda?"
      description={ultimo ? `Comparo con tu corte del ${dayLabel(ultimo.fecha)}. No se guarda nada.` : "Hacé tu primer corte para poder consultar."}
      footer={
        <Button block size="lg" variant="secondary" onClick={closeSheet}>
          Listo
        </Button>
      }
    >
      {!ultimo || !engine.actual ? (
        <p className="py-6 text-center text-sm text-muted">Todavía no hay cortes.</p>
      ) : (
        <div className="grid gap-4">
          <MoneyInput value={mp} onChange={setMp} size="lg" placeholder="Saldo de Mercado Pago ahora" />
          {settings.usaReservaAhorro && (
            <Field label="Reserva de ahorro" hint="Si no la tocaste, dejala como está.">
              <MoneyInput value={ahorro} onChange={setAhorro} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Efectivo">
              <MoneyInput value={efectivo} onChange={setEfectivo} />
            </Field>
            {settings.usaDolares && (
              <Field label="Dólares">
                <MoneyInput moneda="USD" value={usd} onChange={setUsd} />
              </Field>
            )}
          </div>
          {r && (
            <Card className="grid gap-3 p-4">
              <div className="text-[13px] text-muted">Te quedan para la semana del {weekRangeLabel(engine.actual.lunes)}</div>
              <HeroMoney value={Math.max(0, r.restante)} className="text-[40px] leading-none" tone={r.restante < 0 ? "bad" : undefined} />
              <Progress value={r.gastoSemana / Math.max(1, r.limite)} tone={r.restante < 0 ? "bad" : "brand"} />
              <div className="text-[13px] text-muted">
                Llevás gastado {formatARS(r.gastoSemana)} de {formatARS(Math.max(0, r.limite))}
                {r.restante < 0 && <span className="text-bad"> · te pasaste {formatARS(-r.restante)}</span>}
              </div>
              {(r.pagos > 0 || r.especiales > 0 || r.ingresos > 0) && (
                <div className="text-[12px] text-faint">
                  Ya descuenta {r.pagos > 0 && `pagos de tarjeta ${formatARS(r.pagos)} `}
                  {r.especiales > 0 && `especiales ${formatARS(r.especiales)} `}
                  {r.ingresos > 0 && `y suma ingresos ${formatARS(r.ingresos)}`} cargados desde el corte.
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------ Gasto especial ------------------------------ */

export function EspecialSheet({ open, especialId }: { open: boolean; especialId?: string }) {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const prev = especialId ? data.especiales.find((e) => e.id === especialId) : undefined;
  const [monto, setMonto] = useState<number | null>(prev?.monto ?? null);
  const [desc, setDesc] = useState(prev?.descripcion ?? "");
  const [fecha, setFecha] = useState(prev?.fecha ?? hoy);

  function guardar() {
    if (!monto) return;
    const e: GastoEspecial = { id: prev?.id ?? uid(), fecha, monto, descripcion: desc.trim() || "Gasto especial", creadoEn: prev?.creadoEn ?? nowISO() };
    dispatch({ type: "especial/save", especial: e });
    closeSheet();
    toast("Gasto especial guardado", "good");
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={prev ? "Editar gasto especial" : "Gasto especial"}
      description="Algo grande que no es del día a día. Sale del ahorro: no te come el límite de la semana."
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!monto} onClick={guardar}>
            Guardar
          </Button>
          {prev && (
            <Button
              variant="danger"
              block
              onClick={() => {
                dispatch({ type: "especial/delete", id: prev.id });
                closeSheet();
              }}
            >
              Eliminar
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        <MoneyInput value={monto} onChange={setMonto} size="lg" />
        <Field label="Qué fue">
          <TextInput placeholder="Ej: regalo día de la madre, aniversario" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Fecha" hint="Si lo pagaste con tarjeta, cargalo como compra y marcalo como especial.">
          <DateInput value={fecha} onChange={setFecha} max={hoy} />
        </Field>
      </div>
    </Sheet>
  );
}

/* --------------------------------- Ingreso --------------------------------- */

export function IngresoSheet({ open, ingresoId, tipo: tipoInicial }: { open: boolean; ingresoId?: string; tipo?: Ingreso["tipo"] }) {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const prev = ingresoId ? data.ingresos.find((i) => i.id === ingresoId) : undefined;
  const [tipo, setTipo] = useState<Ingreso["tipo"]>(prev?.tipo ?? tipoInicial ?? "sueldo");
  const [monto, setMonto] = useState<number | null>(prev?.monto ?? null);
  const [fecha, setFecha] = useState(prev?.fecha ?? hoy);
  const [mes, setMes] = useState(prev?.mes ?? hoy.slice(0, 7));
  const [destino, setDestino] = useState<"ahorro" | "semana">(prev?.destino ?? "ahorro");
  const [nota, setNota] = useState(prev?.nota ?? "");

  function guardar() {
    if (!monto) return;
    const i: Ingreso = {
      id: prev?.id ?? uid(),
      fecha,
      monto,
      tipo,
      mes: tipo === "extra" ? undefined : mes,
      destino: tipo === "extra" ? destino : undefined,
      nota: nota.trim() || undefined,
      creadoEn: prev?.creadoEn ?? nowISO(),
    };
    dispatch({ type: "ingreso/save", ingreso: i });
    closeSheet();
    toast("Ingreso guardado", "good");
  }

  const meses = [-1, 0, 1].map((d) => {
    const dt = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 + d, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={prev ? "Editar ingreso" : "Ingreso"}
      description="Normalmente lo cargás en el corte. Usá esto para corregir o agregar algo puntual."
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!monto} onClick={guardar}>
            Guardar
          </Button>
          {prev && (
            <Button
              variant="danger"
              block
              onClick={() => {
                dispatch({ type: "ingreso/delete", id: prev.id });
                closeSheet();
              }}
            >
              Eliminar
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        <Segmented
          value={tipo}
          onChange={setTipo}
          options={[
            { value: "sueldo", label: "Sueldo" },
            { value: "aguinaldo", label: "Aguinaldo" },
            { value: "extra", label: "Otro" },
          ]}
        />
        <MoneyInput value={monto} onChange={setMonto} size="lg" />
        {tipo !== "extra" ? (
          <Field label="Corresponde al mes" hint="Ej: si el sueldo de noviembre entra el 31 de octubre, elegí noviembre.">
            <Segmented value={mes} onChange={setMes} options={meses.map((m) => ({ value: m, label: monthLabel(m, { year: false }) }))} />
          </Field>
        ) : (
          <Field label="¿Qué hago con esta plata?">
            <Segmented
              value={destino}
              onChange={setDestino}
              options={[
                { value: "ahorro", label: "Al ahorro" },
                { value: "semana", label: "Sumar a la semana" },
              ]}
            />
          </Field>
        )}
        <Field label="Fecha en que entró">
          <DateInput value={fecha} onChange={setFecha} max={hoy} />
        </Field>
        <Field label="Nota (opcional)">
          <TextInput value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: venta, regalo" />
        </Field>
      </div>
    </Sheet>
  );
}

/* ----------------------------- Sobrante al ahorro ----------------------------- */

export function SobranteSheet({ open }: { open: boolean }) {
  const engine = useEngine();
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const usaReserva = useApp((s) => s.data.settings.usaReservaAhorro);
  const disponible = Math.max(0, engine.actual?.acumulado ?? 0);
  const [monto, setMonto] = useState<number | null>(disponible || null);

  function guardar() {
    if (!monto) return;
    dispatch({ type: "sobrante/save", sobrante: { id: uid(), fecha: hoy, monto: Math.min(monto, disponible), creadoEn: nowISO() } });
    closeSheet();
    toast("Sobrante guardado en el ahorro", "good");
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title="Mandar sobrante al ahorro"
      description="Deja de estar disponible para gastar y suma a tu ahorro."
      footer={
        <Button variant="primary" size="lg" block disabled={!monto || disponible <= 0} onClick={guardar} icon={<PiggyBank className="size-4" />}>
          Mandar al ahorro
        </Button>
      }
    >
      <div className="grid gap-4">
        <div className="text-[13px] text-muted">Sobrante acumulado: {formatARS(disponible)}</div>
        <MoneyInput value={monto} onChange={setMonto} size="lg" />
        {usaReserva && (
          <p className="rounded-xl bg-white/[0.04] p-3 text-[13px] text-muted">
            Acordate de pasar la plata en Mercado Pago de la reserva de gastos a la de ahorro, así coincide con tu próximo corte.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/* --------------------------------- Ahorrar --------------------------------- */

/** Pase de la reserva de gastos a la de ahorro: no es gasto, solo mueve los saldos hasta el próximo corte. */
export function AhorrarSheet({ open }: { open: boolean }) {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const engine = useEngine();
  const reservas = engine.reservas;
  const reserva = necesidadReservaGastos(data, engine);
  const sobra = reserva?.paraAhorrar ?? 0;
  const [monto, setMonto] = useState<number | null>(sobra || null);
  const m = monto ?? 0;
  const falta = m - (reserva?.diferencia ?? 0);
  const mes = engine.actual ? monthLabel(engine.actual.mes, { capital: false, year: false }) : "este mes";

  function guardar() {
    if (!monto) return;
    dispatch({ type: "pase/save", pase: { id: uid(), fecha: hoy, monto, creadoEn: nowISO() } });
    closeSheet();
    toast(`${formatARS(monto)} al ahorro`, "good");
  }

  const fila = (label: string, desde: number, hasta: number) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="text-muted">{label}</span>
      <span className="ml-auto tnum text-ink-2">
        {formatARS(desde)} <span className="text-faint">→</span> <span className="font-medium text-ink">{formatARS(hasta)}</span>
      </span>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title="Ahorrar"
      description="Pasá plata de la reserva de gastos a la de ahorro."
      footer={
        <Button variant="primary" size="lg" block disabled={!monto || !reservas} onClick={guardar} icon={<PiggyBank className="size-4" />}>
          {monto ? `Ahorrar ${formatARS(monto)}` : "Ahorrar"}
        </Button>
      }
    >
      {!reservas ? (
        <p className="py-6 text-center text-sm text-muted">Hacé tu primer corte para saber cuánto tenés en cada reserva.</p>
      ) : (
        <div className="grid gap-4">
          <MoneyInput value={monto} onChange={setMonto} size="lg" placeholder="0" />
          <p className="-mt-2 px-1 text-[13px] text-muted">
            {sobra > 0 ? `Te sobran ${formatARS(sobra)} en gastos. Podés cambiar el monto (por ejemplo, redondearlo).` : "Hoy no te sobra plata en gastos."}
          </p>
          <Card className="grid gap-2 p-4 text-[14px]">
            {fila("Reserva de gastos", reservas.gastos, reservas.gastos - m)}
            {fila("Reserva de ahorro", reservas.ahorro, reservas.ahorro + m)}
          </Card>
          {m > 0 && falta >= 100 && (
            <p className="flex gap-2 text-[13px] text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Es más de lo que te sobra: te van a faltar {formatARS(falta)} en gastos para tus límites y tarjetas de {mes}.
            </p>
          )}
          <p className="rounded-xl bg-white/[0.04] p-3 text-[13px] text-muted">
            Hacé el pase también en Mercado Pago, así coincide con tu próximo corte. No es un gasto: tu límite de la semana no cambia.
          </p>
        </div>
      )}
    </Sheet>
  );
}
