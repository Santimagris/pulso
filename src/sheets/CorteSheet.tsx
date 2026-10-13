import { Gift, Plus, Sparkles, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { reduce, type Action } from "@/domain/actions";
import { billEstimadoARS, billsDelMes } from "@/domain/bills";
import { addMonthsISO, dayLabel, firstBusinessDay, monthLabel, monthOf, weekRangeLabel } from "@/domain/dates";
import { computeEngine, sortedCortes } from "@/domain/engine";
import { formatARS } from "@/domain/money";
import type { Corte, Data, GastoEspecial, Ingreso, PagoTarjeta } from "@/domain/types";
import { cn, uid } from "@/lib/cn";
import { closeSheet, toast } from "@/lib/ui-store";
import { useApp } from "@/sync/store";
import { DateInput, Field, MoneyInput, Segmented, Switch, TextInput } from "@/ui/form";
import { Badge, Button, Card, Dot, HeroMoney } from "@/ui/primitives";
import { Sheet } from "@/ui/sheet";

interface PagoDraft {
  tarjetaId: string;
  mes: string;
  on: boolean;
  ars: number | null;
  usd: number | null;
}
interface ExtraDraft {
  id: string;
  monto: number | null;
  texto: string;
}
interface IngresoDraft extends ExtraDraft {
  destino: "ahorro" | "semana";
}

export function ultimoSueldo(data: Data): number {
  const s = [...data.ingresos].filter((i) => i.tipo === "sueldo").sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return s?.monto ?? data.settings.sueldo;
}

/** Mes de sueldo para preguntar en el corte (el del mes, o el siguiente si te lo adelantan a fin de mes). */
function mesSueldoAPreguntar(data: Data, fecha: string): { mes: string; adelantado: boolean } | null {
  const tiene = (m: string) => data.ingresos.some((i) => i.tipo === "sueldo" && (i.mes ?? monthOf(i.fecha)) === m);
  const mes = monthOf(fecha);
  if (!tiene(mes) && fecha >= firstBusinessDay(mes)) return { mes, adelantado: false };
  const sig = addMonthsISO(mes, 1);
  if (!tiene(sig) && Number(fecha.slice(8, 10)) >= 26) return { mes: sig, adelantado: true };
  return null;
}

export function CorteSheet({ open, corteId }: { open: boolean; corteId?: string }) {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  const dispatch = useApp((s) => s.dispatch);
  const { settings } = data;
  const tc = settings.tipoCambio;

  const editando = corteId ? data.cortes.find((c) => c.id === corteId) : undefined;
  const cortes = sortedCortes(data);
  const anterior = editando ? cortes.filter((c) => c.fecha < editando.fecha).at(-1) : cortes.at(-1);
  const esPrimero = !editando && cortes.length === 0;

  const [fecha, setFecha] = useState(editando?.fecha ?? hoy);
  const [mp, setMp] = useState<number | null>(editando?.mp ?? null);
  const [ahorro, setAhorro] = useState<number | null>(editando?.ahorro ?? anterior?.ahorro ?? (settings.usaReservaAhorro ? null : 0));
  const [efectivo, setEfectivo] = useState<number | null>(editando?.efectivo ?? anterior?.efectivo ?? 0);
  const [usd, setUsd] = useState<number | null>(editando?.usd ?? anterior?.usd ?? (settings.usaDolares ? null : 0));
  const [nota, setNota] = useState(editando?.nota ?? "");
  const [nuevoId] = useState(() => uid());
  const [abiertoEn] = useState(() => Date.now());

  // Preguntas del corte (solo al crear).
  const sueldoQ = !editando ? mesSueldoAPreguntar(data, fecha) : null;
  const [sueldoOn, setSueldoOn] = useState(() => (sueldoQ ? !sueldoQ.adelantado : false));
  const [sueldoMonto, setSueldoMonto] = useState<number | null>(() => ultimoSueldo(data) || null);
  const aguinaldoQ = !editando && ["06", "07", "12"].includes(fecha.slice(5, 7));
  const [aguinaldoOn, setAguinaldoOn] = useState(false);
  const [aguinaldoMonto, setAguinaldoMonto] = useState<number | null>(() => Math.round(ultimoSueldo(data) / 2) || null);

  const billsAPreguntar = useMemo(() => {
    if (editando) return [];
    const mes = monthOf(fecha);
    return [addMonthsISO(mes, -1), mes]
      .flatMap((m) => billsDelMes(data, m))
      .filter((b) => !b.pagado && b.lines.length > 0);
  }, [data, fecha, editando]);
  const [pagos, setPagos] = useState<PagoDraft[]>(() =>
    billsAPreguntar.map((b) => ({
      tarjetaId: b.tarjetaId,
      mes: b.mes,
      on: false,
      ars: Math.round(settings.usaDolares ? b.ars : billEstimadoARS(b, tc)),
      usd: settings.usaDolares ? b.usd : 0,
    })),
  );
  const [especiales, setEspeciales] = useState<ExtraDraft[]>([]);
  const [extras, setExtras] = useState<IngresoDraft[]>([]);

  const valido = mp != null && (!settings.usaReservaAhorro || ahorro != null) && (!settings.usaDolares || usd != null);

  /** Arma la acción completa (corte + movimientos). Los movimientos quedan "antes" del corte. */
  function buildAction(nowMs: number): Action | null {
    if (!valido) return null;
    const tsMov = new Date(nowMs - 1000).toISOString();
    const corte: Corte = {
      id: editando?.id ?? nuevoId,
      fecha,
      mp: mp ?? 0,
      ahorro: ahorro ?? 0,
      efectivo: efectivo ?? 0,
      usd: usd ?? 0,
      tipoCambio: tc,
      nota: nota.trim() || undefined,
      creadoEn: editando?.creadoEn ?? new Date(nowMs).toISOString(),
    };
    const ingresos: Ingreso[] = [];
    if (sueldoQ && sueldoOn && sueldoMonto) {
      const fb = firstBusinessDay(sueldoQ.mes);
      ingresos.push({
        id: uid(),
        fecha: fb <= fecha ? fb : fecha,
        mes: sueldoQ.mes,
        monto: sueldoMonto,
        tipo: "sueldo",
        nota: `Sueldo ${monthLabel(sueldoQ.mes, { capital: false, year: false })}`,
        creadoEn: tsMov,
      });
    }
    if (aguinaldoQ && aguinaldoOn && aguinaldoMonto) {
      ingresos.push({ id: uid(), fecha, monto: aguinaldoMonto, tipo: "aguinaldo", nota: "Aguinaldo", creadoEn: tsMov });
    }
    for (const x of extras) {
      if (x.monto) ingresos.push({ id: x.id, fecha, monto: x.monto, tipo: "extra", destino: x.destino, nota: x.texto.trim() || undefined, creadoEn: tsMov });
    }
    const pagosOk: PagoTarjeta[] = pagos
      .filter((p) => p.on && ((p.ars ?? 0) > 0 || (p.usd ?? 0) > 0))
      .map((p) => ({
        id: uid(),
        tarjetaId: p.tarjetaId,
        mes: p.mes,
        fecha,
        montoARS: p.ars ?? 0,
        montoUSD: p.usd ?? 0,
        tipoCambio: tc,
        creadoEn: tsMov,
      }));
    const esp: GastoEspecial[] = especiales
      .filter((e) => (e.monto ?? 0) > 0)
      .map((e) => ({ id: e.id, fecha, monto: e.monto ?? 0, descripcion: e.texto.trim() || "Gasto especial", creadoEn: tsMov }));
    return { type: "corte/save", corte, ingresos, pagos: pagosOk, especiales: esp };
  }

  const actionKey = JSON.stringify(buildAction(abiertoEn));
  const preview = useMemo(() => {
    const action = JSON.parse(actionKey) as Action | null;
    if (!action || action.type !== "corte/save") return null;
    const before = computeEngine(data, hoy);
    const after = computeEngine(reduce(data, action), hoy > fecha ? hoy : fecha);
    const intervalo = after.intervalos.find((iv) => iv.hasta.id === action.corte.id) ?? null;
    const cerradaAntes = new Set(before.semanas.filter((s) => s.estado === "cerrada").map((s) => s.lunes));
    const nuevasCerradas = after.semanas.filter((s) => s.estado === "cerrada" && !cerradaAntes.has(s.lunes));
    return { intervalo, nuevasCerradas, actual: after.actual, after };
  }, [actionKey, data, hoy, fecha]);

  function guardar() {
    const a = buildAction(Date.now());
    if (!a) return;
    dispatch(a);
    closeSheet();
    toast(editando ? "Corte actualizado" : "Corte guardado", "good");
  }

  const iv = preview?.intervalo;
  const sospechaTarjeta = iv && pagos.some((p) => !p.on) && iv.gasto > 2.5 * (preview?.after.meses[monthOf(fecha)]?.base ?? Infinity);

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={editando ? "Editar corte" : esPrimero ? "Tu primer corte" : "Corte de la semana"}
      description={esPrimero ? "Anotá cuánto tenés hoy. Desde acá arranca todo." : `${dayLabel(fecha)} · anotá cuánto tenés`}
      footer={
        <Button variant="primary" size="lg" block disabled={!valido} onClick={guardar}>
          {editando ? "Guardar cambios" : "Guardar corte"}
        </Button>
      }
    >
      <div className="grid gap-5">
        <section className="grid gap-3.5">
          <MoneyInput value={mp} onChange={setMp} size="lg" id="corte-mp" placeholder="0" />
          <p className="-mt-2 px-1 text-[13px] text-muted">
            {settings.usaReservaAhorro ? "Mercado Pago para gastar (cuenta + reserva de gastos)" : "Mercado Pago (todo: cuenta + reservas)"}
            {anterior && <span className="text-faint"> · la vez pasada {formatARS(anterior.mp)}</span>}
          </p>
          {settings.usaReservaAhorro && (
            <Field label="Reserva de ahorro" htmlFor="corte-ahorro" hint={anterior ? "Precargado con el corte anterior: cambialo si moviste plata." : "Si todavía no la creaste, poné 0."}>
              <MoneyInput id="corte-ahorro" value={ahorro} onChange={setAhorro} />
            </Field>
          )}
          <div className={cn("grid gap-3.5", settings.usaDolares && "grid-cols-2")}>
            <Field label="Efectivo" htmlFor="corte-efectivo">
              <MoneyInput id="corte-efectivo" value={efectivo} onChange={setEfectivo} />
            </Field>
            {settings.usaDolares && (
              <Field label="Dólares" htmlFor="corte-usd">
                <MoneyInput id="corte-usd" moneda="USD" value={usd} onChange={setUsd} />
              </Field>
            )}
          </div>
        </section>

        {!editando && (sueldoQ || aguinaldoQ || pagos.length > 0 || !esPrimero) && (
          <section className="grid gap-3">
            <h3 className="px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
              {esPrimero ? "Antes de hoy" : anterior ? `Desde el ${dayLabel(anterior.fecha)}` : "Movimientos"}
            </h3>

            {sueldoQ && (
              <Card className="grid gap-3 p-4">
                <Switch
                  checked={sueldoOn}
                  onChange={setSueldoOn}
                  label={sueldoQ.adelantado ? `¿Ya te pagaron el sueldo de ${monthLabel(sueldoQ.mes, { capital: false, year: false })}?` : `¿Cobraste el sueldo de ${monthLabel(sueldoQ.mes, { capital: false, year: false })}?`}
                  description="Con el real, el límite del mes queda exacto."
                />
                {sueldoOn && <MoneyInput value={sueldoMonto} onChange={setSueldoMonto} />}
              </Card>
            )}

            {aguinaldoQ && (
              <Card className="grid gap-3 p-4">
                <Switch checked={aguinaldoOn} onChange={setAguinaldoOn} label="¿Cobraste aguinaldo?" />
                {aguinaldoOn && <MoneyInput value={aguinaldoMonto} onChange={setAguinaldoMonto} />}
              </Card>
            )}

            {pagos.map((p, i) => {
              const t = data.tarjetas.find((x) => x.id === p.tarjetaId);
              const set = (patch: Partial<PagoDraft>) => setPagos((ps) => ps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <Card key={`${p.tarjetaId}-${p.mes}`} className="grid gap-3 p-4">
                  <Switch
                    checked={p.on}
                    onChange={(on) => set({ on })}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <Dot color={t?.color ?? "#71717a"} />
                        {esPrimero ? "Ya pagué" : "Pagué"} {t?.nombre} · {monthLabel(p.mes, { capital: false, year: false })}
                      </span>
                    }
                    description="Pagar la tarjeta no es gasto: ya está contado en el mes."
                  />
                  {p.on && (
                    <div className={cn("grid gap-2", settings.usaDolares && "grid-cols-2")}>
                      <MoneyInput value={p.ars} onChange={(ars) => set({ ars })} />
                      {settings.usaDolares && <MoneyInput moneda="USD" value={p.usd} onChange={(usd) => set({ usd })} />}
                    </div>
                  )}
                </Card>
              );
            })}

            {!esPrimero && (
              <>
                {especiales.map((e, i) => (
                  <Card key={e.id} className="grid gap-2.5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-[15px] text-ink">
                        <Gift className="size-4 text-info" /> Gasto especial
                      </span>
                      <button aria-label="Quitar" className="text-faint hover:text-bad" onClick={() => setEspeciales((xs) => xs.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <MoneyInput value={e.monto} onChange={(monto) => setEspeciales((xs) => xs.map((x, j) => (j === i ? { ...x, monto } : x)))} />
                    <TextInput placeholder="Qué fue (ej: regalo día de la madre)" value={e.texto} onChange={(ev) => setEspeciales((xs) => xs.map((x, j) => (j === i ? { ...x, texto: ev.target.value } : x)))} />
                  </Card>
                ))}
                {extras.map((x, i) => (
                  <Card key={x.id} className="grid gap-2.5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-[15px] text-ink">
                        <Wallet className="size-4 text-good" /> Otro ingreso
                      </span>
                      <button aria-label="Quitar" className="text-faint hover:text-bad" onClick={() => setExtras((xs) => xs.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <MoneyInput value={x.monto} onChange={(monto) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, monto } : y)))} />
                    <TextInput placeholder="De dónde (ej: venta, regalo)" value={x.texto} onChange={(ev) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, texto: ev.target.value } : y)))} />
                    <Segmented
                      size="sm"
                      value={x.destino}
                      onChange={(destino) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, destino } : y)))}
                      options={[
                        { value: "ahorro", label: "Va al ahorro" },
                        { value: "semana", label: "Lo sumo a la semana" },
                      ]}
                    />
                  </Card>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="subtle" size="sm" icon={<Plus className="size-4" />} onClick={() => setEspeciales((xs) => [...xs, { id: uid(), monto: null, texto: "" }])}>
                    Gasto especial
                  </Button>
                  <Button variant="subtle" size="sm" icon={<Plus className="size-4" />} onClick={() => setExtras((xs) => [...xs, { id: uid(), monto: null, texto: "", destino: "ahorro" }])}>
                    Otro ingreso
                  </Button>
                </div>
                <p className="px-1 text-[12px] leading-relaxed text-faint">
                  Gasto especial = algo grande que no es del día a día (regalo, viaje, un arreglo). Sale del ahorro y no te come la semana.
                </p>
              </>
            )}
          </section>
        )}

        <Field label="Fecha del corte" htmlFor="corte-fecha" hint={!editando ? "Normalmente hoy. Si lo hacés atrasado, poné el día al que corresponden los saldos." : undefined}>
          <DateInput id="corte-fecha" value={fecha} onChange={setFecha} max={hoy} />
        </Field>
        <Field label="Nota (opcional)" htmlFor="corte-nota">
          <TextInput id="corte-nota" placeholder="Ej: semana de cumpleaños" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Field>

        {valido && preview && (
          <Resultado
            esPrimero={esPrimero}
            gasto={iv?.gasto ?? null}
            desde={anterior?.fecha}
            nuevas={preview.nuevasCerradas}
            limiteActual={preview.actual?.limite ?? null}
            lunesActual={preview.actual?.lunes}
            sospechaTarjeta={!!sospechaTarjeta}
          />
        )}
      </div>
    </Sheet>
  );
}

function Resultado({
  esPrimero,
  gasto,
  desde,
  nuevas,
  limiteActual,
  lunesActual,
  sospechaTarjeta,
}: {
  esPrimero: boolean;
  gasto: number | null;
  desde?: string;
  nuevas: { lunes: string; gastado: number | null; limite: number; diferencia: number | null }[];
  limiteActual: number | null;
  lunesActual?: string;
  sospechaTarjeta: boolean;
}) {
  const ultima = nuevas.at(-1);
  return (
    <Card className="grid gap-3 border-brand/20 bg-brand/[0.05] p-4">
      {!esPrimero && gasto != null && (
        <div>
          <div className="text-[13px] text-muted">Desde el {desde ? dayLabel(desde) : "último corte"} gastaste en el día a día</div>
          <HeroMoney value={gasto} className="mt-1 text-[30px]" tone={gasto < 0 ? "warn" : undefined} />
        </div>
      )}
      {gasto != null && gasto < 0 && (
        <p className="flex gap-2 text-[13px] text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Dio negativo: ¿entró plata que no anotaste (sueldo, un regalo, una venta)? Agregala como ingreso.
        </p>
      )}
      {sospechaTarjeta && (
        <p className="flex gap-2 text-[13px] text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Es mucho para una semana. ¿Pagaste alguna tarjeta? Marcala arriba para que no cuente como gasto.
        </p>
      )}
      {ultima && ultima.diferencia != null && ultima.gastado != null && (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
          <span className="text-muted">Semana del {weekRangeLabel(ultima.lunes)}</span>
          {ultima.diferencia >= 0 ? (
            <Badge tone="good" icon={<Sparkles className="size-3" />}>Te sobraron {formatARS(ultima.diferencia)}</Badge>
          ) : (
            <Badge tone="bad">Te pasaste {formatARS(-ultima.diferencia)}</Badge>
          )}
        </div>
      )}
      {limiteActual != null && lunesActual && (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-[13px] text-muted">{esPrimero ? "Tu límite para esta semana" : "Esta semana vas a poder gastar"}</span>
          <span className="text-lg font-semibold text-ink tnum">{formatARS(Math.max(0, limiteActual))}</span>
        </div>
      )}
    </Card>
  );
}
