import { CreditCard } from "lucide-react";
import { useMemo, useState } from "react";

import {
  bill,
  billEstimadoARS,
  conMontoDelMes,
  cuotaRecurrente,
  sugerirPrimerMes,
  tieneMontoDelMes,
  ultimoMes,
  vecesRecurrente,
} from "@/domain/bills";
import { addMonthsISO, monthLabel, monthShort, mondaysInMonth } from "@/domain/dates";
import { CARD_COLORS, CARD_SUGGESTIONS } from "@/domain/defaults";
import { formatARS, formatMoney } from "@/domain/money";
import type { Compra, Moneda, Recurrente, Tarjeta } from "@/domain/types";
import { cn, nowISO, uid } from "@/lib/cn";
import { closeSheet, openSheet, toast } from "@/lib/ui-store";
import { useApp } from "@/sync/store";
import { Chip, DateInput, Field, MoneyInput, Segmented, Stepper, Switch, TextInput } from "@/ui/form";
import { Button, Card, Empty } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";

const activas = (ts: Tarjeta[]) => ts.filter((t) => !t.archivada);

function TarjetaPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const tarjetas = activas(useApp((s) => s.data.tarjetas));
  return (
    <div className="flex flex-wrap gap-2">
      {tarjetas.map((t) => (
        <Chip key={t.id} active={value === t.id} color={t.color} onClick={() => onChange(t.id)}>
          {t.nombre}
        </Chip>
      ))}
    </div>
  );
}

/* --------------------------------- Compra --------------------------------- */

export function CompraSheet({ open, compraId, tarjetaId: tarjetaInicial }: { open: boolean; compraId?: string; tarjetaId?: string }) {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const tarjetas = activas(data.tarjetas);
  const prev = compraId ? data.compras.find((c) => c.id === compraId) : undefined;

  const [tarjetaId, setTarjetaId] = useState(prev?.tarjetaId ?? tarjetaInicial ?? tarjetas[0]?.id ?? "");
  const [desc, setDesc] = useState(prev?.descripcion ?? "");
  const [moneda, setMoneda] = useState<Moneda>(prev?.moneda ?? "ARS");
  const [modo, setModo] = useState<"total" | "cuota">("total");
  const [monto, setMonto] = useState<number | null>(prev ? prev.montoCuota * prev.cuotas : null);
  const [cuotas, setCuotas] = useState(prev?.cuotas ?? 1);
  const tarjeta = data.tarjetas.find((t) => t.id === tarjetaId);
  const sugerido = sugerirPrimerMes(tarjeta, hoy);
  const [primerMes, setPrimerMes] = useState<string | null>(prev?.primerMes ?? null);
  const mesElegido = primerMes ?? sugerido;
  const [especial, setEspecial] = useState(prev?.especial ?? false);

  const montoCuota = monto == null ? null : modo === "total" ? Math.round(monto / cuotas) : monto;
  const valido = !!tarjetaId && desc.trim().length > 0 && !!montoCuota && montoCuota > 0;

  const impacto = useMemo(() => {
    if (!montoCuota || especial) return null;
    const ars = moneda === "USD" ? montoCuota * data.settings.tipoCambio : montoCuota;
    return ars / mondaysInMonth(mesElegido).length;
  }, [montoCuota, especial, moneda, data.settings.tipoCambio, mesElegido]);

  function guardar() {
    if (!valido || !montoCuota) return;
    const c: Compra = {
      id: prev?.id ?? uid(),
      tarjetaId,
      descripcion: desc.trim(),
      moneda,
      montoCuota,
      cuotas,
      primerMes: mesElegido,
      especial,
      creadoEn: prev?.creadoEn ?? nowISO(),
    };
    dispatch({ type: "compra/save", compra: c });
    closeSheet();
    toast(prev ? "Compra actualizada" : "Compra cargada", "good");
  }

  if (!tarjetas.length) {
    return (
      <Sheet open={open} onClose={closeSheet} title="Compra con tarjeta">
        <Empty icon={<CreditCard className="size-5" />} title="Primero cargá una tarjeta" text="Andá a Tarjetas → Tus tarjetas." />
      </Sheet>
    );
  }

  const meses = [-1, 0, 1, 2].map((d) => addMonthsISO(sugerido, d));

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={prev ? "Editar compra" : "Compra con tarjeta"}
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!valido} onClick={guardar}>
            {prev ? "Guardar cambios" : "Cargar compra"}
          </Button>
          {prev && (
            <Button
              variant="danger"
              block
              onClick={() => {
                dispatch({ type: "compra/delete", id: prev.id });
                closeSheet();
                toast("Compra eliminada");
              }}
            >
              Eliminar compra
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Qué compraste">
          <TextInput placeholder="Ej: zapatillas, nafta, regalo" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Tarjeta">
          <TarjetaPicker value={tarjetaId} onChange={(id) => { setTarjetaId(id); if (!prev) setPrimerMes(null); }} />
        </Field>
        <Field
          label={modo === "total" ? "Monto total" : "Monto de cada cuota"}
          aside={
            <div className="flex gap-1.5">
              <Segmented size="sm" value={modo} onChange={setModo} options={[{ value: "total", label: "Total" }, { value: "cuota", label: "Cuota" }]} />
              <Segmented size="sm" value={moneda} onChange={setMoneda} options={[{ value: "ARS", label: "$" }, { value: "USD", label: "US$" }]} />
            </div>
          }
        >
          <MoneyInput value={monto} onChange={setMonto} moneda={moneda} size="lg" />
        </Field>
        <Field label="Cuotas">
          <div className="flex flex-wrap items-center gap-2">
            {[1, 3, 6, 9, 12].map((n) => (
              <Chip key={n} active={cuotas === n} onClick={() => setCuotas(n)} className="min-w-12 justify-center">
                {n}
              </Chip>
            ))}
            <Stepper value={cuotas} onChange={setCuotas} max={72} />
          </div>
        </Field>
        <Field label="Primera cuota se paga en" hint={tarjeta?.cierreDia ? `Calculado con el cierre del ${tarjeta.cierreDia} de ${tarjeta.nombre}.` : "Configurá el cierre de la tarjeta para que lo calcule solo."}>
          <div className="grid grid-cols-4 gap-2">
            {meses.map((m) => (
              <Chip key={m} active={mesElegido === m} onClick={() => setPrimerMes(m)} className="justify-center capitalize">
                {monthShort(m, true)}
              </Chip>
            ))}
          </div>
        </Field>
        <Switch
          checked={especial}
          onChange={setEspecial}
          label="Es un gasto especial"
          description="Regalo, viaje o algo grande que sale del ahorro: no te baja el límite semanal."
        />
        {montoCuota != null && montoCuota > 0 && (
          <Card className="p-4 text-[13px] text-muted">
            {cuotas > 1 ? (
              <>
                {cuotas} cuotas de <span className="font-medium text-ink">{formatMoney(montoCuota, moneda)}</span> · de{" "}
                {monthLabel(mesElegido, { capital: false })} a {monthLabel(ultimoMes({ primerMes: mesElegido, cuotas }), { capital: false })}.
              </>
            ) : (
              <>
                Se paga en el resumen de <span className="font-medium text-ink">{monthLabel(mesElegido, { capital: false })}</span>.
              </>
            )}
            {impacto != null && (
              <div className="mt-1">
                Te baja el límite semanal de {monthLabel(mesElegido, { capital: false, year: false })} en ~{formatARS(impacto)}.
              </div>
            )}
          </Card>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------------------------- Pago ---------------------------------- */

export function PagoSheet({ open, tarjetaId, mes }: { open: boolean; tarjetaId: string; mes: string }) {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const tc = data.settings.tipoCambio;
  const b = bill(data, tarjetaId, mes);
  const t = data.tarjetas.find((x) => x.id === tarjetaId);
  const usaUsd = data.settings.usaDolares && b.usd > 0;
  const [ars, setArs] = useState<number | null>(Math.round(usaUsd ? b.ars : billEstimadoARS(b, tc)));
  const [usd, setUsd] = useState<number | null>(usaUsd ? b.usd : 0);
  const [fecha, setFecha] = useState(hoy);

  function guardar() {
    dispatch({
      type: "pago/save",
      pago: { id: uid(), tarjetaId, mes, fecha, montoARS: ars ?? 0, montoUSD: usd ?? 0, tipoCambio: tc, creadoEn: nowISO() },
    });
    closeSheet();
    toast(`${t?.nombre ?? "Tarjeta"} pagada`, "good");
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={`Pagar ${t?.nombre ?? "tarjeta"}`}
      description={`Resumen de ${monthLabel(mes, { capital: false })} · estimado ${formatARS(billEstimadoARS(b, tc))}`}
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block onClick={guardar} disabled={!ars && !usd}>
            Marcar como pagada
          </Button>
          {b.pagos.map((p) => (
            <Button
              key={p.id}
              variant="danger"
              block
              onClick={() => {
                dispatch({ type: "pago/delete", id: p.id });
                closeSheet();
              }}
            >
              Deshacer pago de {formatARS(p.montoARS + p.montoUSD * p.tipoCambio)}
            </Button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4">
        <Field label="Lo que salió de tu cuenta" hint="Poné el total real del resumen (con impuestos o lo que no hayas cargado). La diferencia ajusta el mes.">
          <MoneyInput value={ars} onChange={setArs} size="lg" />
        </Field>
        {usaUsd && (
          <Field label="Pagado con dólares" hint={`Estimado US$${(b.usd / 100).toLocaleString("es-AR")}`}>
            <MoneyInput moneda="USD" value={usd} onChange={setUsd} />
          </Field>
        )}
        <Field label="Fecha de pago">
          <DateInput value={fecha} onChange={setFecha} max={hoy} />
        </Field>
        <p className="rounded-xl bg-white/[0.04] p-3 text-[13px] leading-relaxed text-muted">
          Pagar la tarjeta no es gasto de la semana: ya está contado en el presupuesto del mes. Por eso no te va a aparecer un pico.
        </p>
      </div>
    </Sheet>
  );
}

/* --------------------------------- Tarjeta --------------------------------- */

export function TarjetaSheet({ open, tarjetaId }: { open: boolean; tarjetaId?: string }) {
  const data = useApp((s) => s.data);
  const dispatch = useApp((s) => s.dispatch);
  const prev = tarjetaId ? data.tarjetas.find((t) => t.id === tarjetaId) : undefined;
  const usados = new Set(data.tarjetas.map((t) => t.nombre.toLowerCase()));
  const sugerencias = CARD_SUGGESTIONS.filter((s) => !usados.has(s.nombre.toLowerCase()));
  const [nombre, setNombre] = useState(prev?.nombre ?? "");
  const [color, setColor] = useState(prev?.color ?? CARD_COLORS[data.tarjetas.length % CARD_COLORS.length]);
  const [cierre, setCierre] = useState<string>(prev?.cierreDia ? String(prev.cierreDia) : "");
  const [vence, setVence] = useState<string>(prev?.vencimientoDia ? String(prev.vencimientoDia) : "");

  const dia = (s: string) => {
    const n = Number(s);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined;
  };

  function guardar(seguir = false) {
    if (!nombre.trim()) return;
    const t: Tarjeta = {
      id: prev?.id ?? uid(),
      nombre: nombre.trim(),
      color,
      cierreDia: dia(cierre),
      vencimientoDia: dia(vence),
      creadoEn: prev?.creadoEn ?? nowISO(),
    };
    dispatch({ type: "tarjeta/save", tarjeta: t });
    toast(prev ? "Tarjeta actualizada" : `${t.nombre} agregada`, "good");
    if (seguir) {
      setNombre("");
      setCierre("");
      setVence("");
      setColor(CARD_COLORS[(data.tarjetas.length + 1) % CARD_COLORS.length]);
    } else closeSheet();
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={prev ? "Editar tarjeta" : "Nueva tarjeta"}
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!nombre.trim()} onClick={() => guardar()}>
            Guardar
          </Button>
          {!prev && (
            <Button variant="ghost" block disabled={!nombre.trim()} onClick={() => guardar(true)}>
              Guardar y agregar otra
            </Button>
          )}
          {prev && (
            <Button
              variant="danger"
              block
              onClick={() => {
                dispatch({ type: "tarjeta/delete", id: prev.id });
                closeSheet();
              }}
            >
              {data.compras.some((c) => c.tarjetaId === prev.id) ? "Archivar tarjeta" : "Eliminar tarjeta"}
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        {!prev && sugerencias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((s) => (
              <Chip key={s.nombre} color={s.color} active={nombre === s.nombre} onClick={() => { setNombre(s.nombre); setColor(s.color); }}>
                {s.nombre}
              </Chip>
            ))}
          </div>
        )}
        <Field label="Nombre">
          <TextInput value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Visa Santander" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día de cierre">
            <TextInput inputMode="numeric" value={cierre} onChange={(e) => setCierre(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Ej: 10" />
          </Field>
          <Field label="Día de vencimiento">
            <TextInput inputMode="numeric" value={vence} onChange={(e) => setVence(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Ej: 20" />
          </Field>
        </div>
        <p className="-mt-1 text-[13px] text-faint">
          Aproximados, como figuran en el resumen. Con eso Pulso sabe en qué mes pagás cada compra.
        </p>
        <Field label="Color">
          <div className="flex gap-2.5">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface transition", color === c && "ring-2 ring-white/80")}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

/* -------------------------------- Recurrente -------------------------------- */

export function RecurrenteSheet({ open, recurrenteId, tarjetaId: tarjetaInicial }: { open: boolean; recurrenteId?: string; tarjetaId?: string }) {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const tarjetas = activas(data.tarjetas);
  const prev = recurrenteId ? data.recurrentes.find((r) => r.id === recurrenteId) : undefined;
  const [desc, setDesc] = useState(prev?.descripcion ?? "");
  const [tarjetaId, setTarjetaId] = useState(prev?.tarjetaId ?? tarjetaInicial ?? tarjetas[0]?.id ?? "");
  const [moneda, setMoneda] = useState<Moneda>(prev?.moneda ?? "ARS");
  const [monto, setMonto] = useState<number | null>(prev?.monto ?? null);
  const [desde, setDesde] = useState(prev?.desdeMes ?? hoy.slice(0, 7));
  const [tieneFin, setTieneFin] = useState(!!prev?.hastaMes);
  const [hasta, setHasta] = useState(prev?.hastaMes ?? addMonthsISO(hoy.slice(0, 7), 12));
  const valido = desc.trim() && tarjetaId && monto && monto > 0;

  // Al crear, el monto es el del primer mes. Al editar, si cambia, se anota desde este mes
  // (o desde el inicio si arranca más adelante): los meses anteriores no se tocan.
  const mesRef = desde > hoy.slice(0, 7) ? desde : hoy.slice(0, 7);

  function guardar() {
    if (!valido || !monto) return;
    let r: Recurrente = {
      id: prev?.id ?? uid(),
      tarjetaId,
      descripcion: desc.trim(),
      moneda,
      monto: prev?.monto ?? monto,
      montos: prev?.montos ?? { [desde]: monto },
      desdeMes: desde,
      hastaMes: tieneFin ? hasta : undefined,
      veces: prev?.veces ?? {},
      creadoEn: prev?.creadoEn ?? nowISO(),
    };
    if (prev && monto !== prev.monto) r = conMontoDelMes(r, mesRef, monto);
    dispatch({ type: "recurrente/save", recurrente: r });
    closeSheet();
    toast(prev ? "Fijo actualizado" : "Fijo agregado", "good");
  }

  if (!tarjetas.length) {
    return (
      <Sheet open={open} onClose={closeSheet} title="Fijo de tarjeta">
        <Empty icon={<CreditCard className="size-5" />} title="Primero cargá una tarjeta" />
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={prev ? "Editar fijo" : "Fijo de tarjeta"}
      description="Algo que te cobran todos los meses en la tarjeta. Se carga solo en cada resumen."
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!valido} onClick={guardar}>
            Guardar
          </Button>
          {prev && (
            <Button
              variant="danger"
              block
              onClick={() => {
                dispatch({ type: "recurrente/delete", id: prev.id });
                closeSheet();
              }}
            >
              Eliminar fijo
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4">
        {!prev && (
          <div className="flex flex-wrap gap-2">
            {["Plan de ahorro auto", "Spotify", "Seguro"].map((s) => (
              <Chip key={s} active={desc === s} onClick={() => setDesc(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}
        <Field label="Qué es">
          <TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: Plan de ahorro Fiat" />
        </Field>
        <Field label="Tarjeta">
          <TarjetaPicker value={tarjetaId} onChange={setTarjetaId} />
        </Field>
        <Field
          label={prev ? "Último monto de la cuota" : "Monto de la cuota"}
          hint={
            prev
              ? `Si lo cambiás acá, queda anotado para ${monthLabel(mesRef, { capital: false })} en adelante. Para un mes puntual, tocá el fijo en el resumen de ese mes (Tarjetas).`
              : "Poné el del último resumen. Si cambia mes a mes (como el plan del auto), cada mes anotás el real tocándolo en el resumen."
          }
          aside={<Segmented size="sm" value={moneda} onChange={setMoneda} options={[{ value: "ARS", label: "$" }, { value: "USD", label: "US$" }]} />}
        >
          <MoneyInput value={monto} onChange={setMonto} moneda={moneda} size="lg" />
        </Field>
        <Field label="Desde (mes del primer resumen)">
          <input
            type="month"
            value={desde}
            onChange={(e) => e.target.value && setDesde(e.target.value)}
            className="h-12 w-full rounded-xl border border-line-2 bg-surface-2 px-3.5 text-ink outline-none [color-scheme:dark]"
          />
        </Field>
        <Switch checked={tieneFin} onChange={setTieneFin} label="Tiene fecha de fin" description="Por ejemplo, la última cuota del plan." />
        {tieneFin && (
          <input
            type="month"
            value={hasta}
            onChange={(e) => e.target.value && setHasta(e.target.value)}
            className="h-12 w-full rounded-xl border border-line-2 bg-surface-2 px-3.5 text-ink outline-none [color-scheme:dark]"
          />
        )}
      </div>
    </Sheet>
  );
}

/* --------------------------- Fijo: monto de un mes --------------------------- */

/** El monto real de un fijo en el resumen de un mes (ej: la cuota del Fiat de octubre) y cuántas cuotas vinieron. */
export function FijoMesSheet({ open, recurrenteId, mes }: { open: boolean; recurrenteId: string; mes: string }) {
  const data = useApp((s) => s.data);
  const dispatch = useApp((s) => s.dispatch);
  const r = data.recurrentes.find((x) => x.id === recurrenteId);
  const [monto, setMonto] = useState<number | null>(r ? cuotaRecurrente(r, mes) : null);
  const [veces, setVeces] = useState(r ? vecesRecurrente(r, mes) : 1);
  if (!r) return null;

  const t = data.tarjetas.find((x) => x.id === r.tarjetaId);
  const mesNombre = monthLabel(mes, { capital: false, year: false });
  const anotado = tieneMontoDelMes(r, mes);
  const esUltimo = Object.keys(r.montos ?? {}).every((m) => m <= mes);

  function guardar() {
    if (!r || !monto) return;
    const next = conMontoDelMes(r, mes, monto);
    const v = { ...(next.veces ?? {}) };
    if (veces === 1) delete v[mes];
    else v[mes] = veces;
    dispatch({ type: "recurrente/save", recurrente: { ...next, veces: v } });
    closeSheet();
    toast(`${r.descripcion} de ${mesNombre} guardado`, "good");
  }

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={`${r.descripcion} · ${mesNombre}`}
      description={`${t?.nombre ?? "Tarjeta"} · resumen de ${monthLabel(mes, { capital: false })}`}
      footer={
        <div className="grid gap-2">
          <Button variant="primary" size="lg" block disabled={!monto} onClick={guardar}>
            Guardar
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {anotado ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dispatch({ type: "recurrente/save", recurrente: conMontoDelMes(r, mes, null) });
                  closeSheet();
                }}
              >
                Volver al estimado
              </Button>
            ) : (
              <span />
            )}
            <Button variant="ghost" size="sm" onClick={() => openSheet({ kind: "recurrente", recurrenteId: r.id })}>
              Editar fijo
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5">
        <Field
          label="Cuota de este mes"
          hint={anotado ? `Anotado para ${mesNombre}.` : "Por ahora es un estimado (el último monto anotado). Poné el real cuando te llegue el resumen."}
        >
          <MoneyInput moneda={r.moneda} value={monto} onChange={setMonto} size="lg" />
        </Field>
        <Field label="¿Cuántas cuotas vinieron en este resumen?" hint="Si vinieron dos juntas, el presupuesto igual cuenta una por mes: no te hunde este mes ni te infla el siguiente.">
          <Segmented
            value={String(veces)}
            onChange={(v) => setVeces(Number(v))}
            options={[
              { value: "0", label: "Ninguna" },
              { value: "1", label: "Una" },
              { value: "2", label: "Dos" },
            ]}
          />
        </Field>
        {monto != null && monto > 0 && (
          <Card className="grid gap-1.5 p-4 text-[13px] text-muted">
            <div className="flex justify-between gap-3">
              <span>En este resumen</span>
              <span className="text-ink tnum">{formatMoney(monto * veces, r.moneda)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Estimado para los meses que vienen</span>
              <span className="text-ink-2 tnum">{formatMoney(esUltimo ? monto : r.monto, r.moneda)}</span>
            </div>
          </Card>
        )}
      </div>
    </Sheet>
  );
}
