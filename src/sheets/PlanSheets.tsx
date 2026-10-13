import { useMemo, useState } from "react";

import { monthLabel } from "@/domain/dates";
import { planMes } from "@/domain/engine";
import { formatARS, formatMoney } from "@/domain/money";
import type { DestinoAguinaldo, Meta, ModoAhorro, Moneda, Settings } from "@/domain/types";
import { useMesActual } from "@/lib/hooks";
import { closeSheet, toast } from "@/lib/ui-store";
import { useApp } from "@/sync/store";
import { Chip, DateInput, Field, MoneyInput, Segmented, Switch, TextInput } from "@/ui/form";
import { Badge, Button, Card } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";

import { ultimoSueldo } from "./CorteSheet";

/* ------------------------------ Sueldo y ahorro ------------------------------ */

export function PlanSheet({ open }: { open: boolean }) {
  const data = useApp((s) => s.data);
  const dispatch = useApp((s) => s.dispatch);
  const mes = useMesActual();
  const s = data.settings;
  const [sueldo, setSueldo] = useState<number | null>(s.sueldo || ultimoSueldo(data) || null);
  const [modo, setModo] = useState<ModoAhorro>(s.ahorroModo);
  const [pct, setPct] = useState(s.ahorroPorcentaje);
  const [monto, setMonto] = useState<number | null>(s.ahorroMonto || null);
  const [aguinaldo, setAguinaldo] = useState<DestinoAguinaldo>(s.aguinaldo);
  const [reserva, setReserva] = useState(s.usaReservaAhorro);
  const [dolares, setDolares] = useState(s.usaDolares);

  const patch = {
    sueldo: sueldo ?? 0,
    ahorroModo: modo,
    ahorroPorcentaje: pct,
    ahorroMonto: monto ?? 0,
    aguinaldo,
    usaReservaAhorro: reserva,
    usaDolares: dolares,
  };

  const patchKey = JSON.stringify(patch);
  const preview = useMemo(
    () => planMes({ ...data, settings: { ...data.settings, ...(JSON.parse(patchKey) as typeof patch) } }, mes),
    [data, mes, patchKey],
  );

  function guardar() {
    dispatch({ type: "settings/update", patch });
    closeSheet();
    toast("Plan guardado", "good");
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title="Sueldo y ahorro"
      description="Primero te pagás a vos: el ahorro sale apenas cobrás, y con el resto se arma tu límite semanal."
      footer={
        <Button variant="primary" size="lg" block disabled={!sueldo} onClick={guardar}>
          Guardar plan
        </Button>
      }
    >
      <div className="grid gap-5">
        <Field label="Sueldo de bolsillo" hint="Se usa mientras no cargues el sueldo real del mes (te lo pregunto en el corte).">
          <MoneyInput value={sueldo} onChange={setSueldo} size="lg" />
        </Field>

        <Field label="¿Cuánto ahorrás por mes?">
          <Segmented value={modo} onChange={setModo} options={[{ value: "porcentaje", label: "% del sueldo" }, { value: "monto", label: "Monto fijo" }]} />
        </Field>
        {modo === "porcentaje" ? (
          <div className="-mt-2 flex flex-wrap gap-2">
            {[10, 15, 20, 25, 30, 35].map((n) => (
              <Chip key={n} active={pct === n} onClick={() => setPct(n)} className="min-w-14 justify-center">
                {n}%
              </Chip>
            ))}
          </div>
        ) : (
          <MoneyInput value={monto} onChange={setMonto} />
        )}

        <Card className="grid gap-2 p-4 text-[14px]">
          <div className="flex justify-between gap-3">
            <span className="text-muted">Ahorro de {monthLabel(mes, { capital: false, year: false })}</span>
            <span className="font-semibold text-good tnum">{formatARS(preview.ahorroDelSueldo)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">Tarjetas de este mes</span>
            <span className="text-ink-2 tnum">{formatARS(preview.tarjetas)}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2">
            <span className="text-muted">Te quedan por semana</span>
            <span className="text-lg font-semibold text-ink tnum">{formatARS(preview.base)}</span>
          </div>
          {preview.faltante > 0 && <p className="text-[13px] text-bad">Con ese ahorro y estas tarjetas no alcanza el sueldo: bajá el porcentaje.</p>}
          {modo === "porcentaje" && pct > 25 && preview.faltante === 0 && (
            <p className="text-[13px] text-faint">Ojo: un plan que no podés sostener se abandona. Mejor arrancar alcanzable y subirlo de a poco.</p>
          )}
        </Card>

        <Field label="Aguinaldo" hint="Cuando lo cobrás (junio/julio y diciembre).">
          <Segmented
            value={aguinaldo}
            onChange={setAguinaldo}
            options={[
              { value: "presupuesto", label: "Como sueldo" },
              { value: "mitad", label: "½ al ahorro" },
              { value: "ahorro", label: "Al ahorro" },
            ]}
          />
        </Field>
        {aguinaldo === "presupuesto" && (
          <p className="-mt-3 text-[13px] text-faint">
            Ese mes vas a tener un límite semanal mucho más alto. <Badge tone="brand">Recomendado: mitad al ahorro</Badge>
          </p>
        )}

        <div className="grid gap-4 border-t border-line pt-4">
          <Switch
            checked={reserva}
            onChange={setReserva}
            label="Separo el ahorro en una reserva aparte"
            description="En Mercado Pago: una reserva para gastar y otra para el ahorro. En el corte anotás las dos."
          />
          <Switch checked={dolares} onChange={setDolares} label="Tengo dólares" description="Agrega el campo de dólares al corte y al pago de tarjetas." />
        </div>
      </div>
    </Sheet>
  );
}

/* ----------------------------------- Meta ----------------------------------- */

export function MetaSheet({ open }: { open: boolean }) {
  const meta = useApp((s) => s.data.settings.meta);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const [nombre, setNombre] = useState(meta?.nombre ?? "");
  const [moneda, setMoneda] = useState<Moneda>(meta?.moneda ?? "USD");
  const [monto, setMonto] = useState<number | null>(meta?.monto ?? null);
  const [conFecha, setConFecha] = useState(!!meta?.fecha);
  const [fecha, setFecha] = useState(meta?.fecha ?? `${Number(hoy.slice(0, 4)) + 1}-${hoy.slice(5, 7)}-01`);

  function guardar() {
    if (!monto) return;
    const m: Meta = { nombre: nombre.trim() || "Mi meta", moneda, monto, fecha: conFecha ? fecha : undefined };
    const patch: Partial<Settings> = { meta: m };
    // Una meta en dólares se mide con los dólares del corte: activamos ese campo.
    if (moneda === "USD") patch.usaDolares = true;
    dispatch({ type: "settings/update", patch });
    closeSheet();
    toast("Meta guardada", "good");
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={meta ? "Editar meta" : "Meta de ahorro"}
      description="Opcional. Pulso te dice cuándo llegás a tu ritmo real, o cuánto necesitás por mes."
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!monto} onClick={guardar}>
            Guardar meta
          </Button>
          {meta && (
            <Button
              variant="danger"
              block
              onClick={() => {
                dispatch({ type: "settings/update", patch: { meta: null } });
                closeSheet();
              }}
            >
              Quitar meta
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {["Cancelar el plan del auto", "Fondo de emergencia", "Dólares"].map((s) => (
            <Chip key={s} active={nombre === s} onClick={() => setNombre(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <Field label="Nombre">
          <TextInput value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: juntar para el auto" />
        </Field>
        <Field label="Monto" aside={<Segmented size="sm" value={moneda} onChange={setMoneda} options={[{ value: "USD", label: "US$" }, { value: "ARS", label: "$" }]} />}>
          <MoneyInput value={monto} onChange={setMonto} moneda={moneda} size="lg" />
        </Field>
        {moneda === "USD" && (
          <p className="-mt-2 text-[13px] text-faint">En dólares, el avance se mide con los dólares que anotás en el corte, y te digo cuántos comprar por mes.</p>
        )}
        <Switch checked={conFecha} onChange={setConFecha} label="Tiene fecha" description="Si no, te digo cuándo llegás a tu ritmo." />
        {conFecha && <DateInput value={fecha} onChange={setFecha} min={hoy} />}
        {monto != null && <p className="text-[13px] text-muted">Meta: {formatMoney(monto, moneda)}</p>}
      </div>
    </Sheet>
  );
}
