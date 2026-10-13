import { ArrowUpRight, Download, LogOut, RefreshCw, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { dayLabel } from "@/domain/dates";
import { normalizeData } from "@/domain/defaults";
import { formatARS } from "@/domain/money";
import { cn } from "@/lib/cn";
import { navigate } from "@/lib/router";
import { openSheet, toast } from "@/lib/ui-store";
import { PageHeader } from "@/layout/AppShell";
import { useApp } from "@/sync/store";
import { Switch, TextInput } from "@/ui/form";
import { GitHubMark } from "@/ui/Logo";
import { Button, Card, Row, SectionTitle } from "@/ui/primitives";

/** Dólar oficial (venta) desde dolarapi.com, con Bluelytics de respaldo. */
async function fetchDolarOficial(): Promise<number> {
  try {
    const r = await fetch("https://dolarapi.com/v1/dolares/oficial", { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { venta?: number };
      if (j.venta && j.venta > 0) return j.venta;
    }
  } catch {
    /* sigue con el respaldo */
  }
  const r = await fetch("https://api.bluelytics.com.ar/v2/latest", { cache: "no-store" });
  const j = (await r.json()) as { oficial?: { value_sell?: number } };
  if (j.oficial?.value_sell) return j.oficial.value_sell;
  throw new Error("sin dato");
}

export function Ajustes() {
  const data = useApp((s) => s.data);
  const conn = useApp((s) => s.conn);
  const lastSyncedAt = useApp((s) => s.lastSyncedAt);
  const dispatch = useApp((s) => s.dispatch);
  const load = useApp((s) => s.load);
  const disconnect = useApp((s) => s.disconnect);
  const s = data.settings;
  const [tcText, setTcText] = useState(String(s.tipoCambio).replace(".", ","));
  const [tcBusy, setTcBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function actualizarDolar() {
    setTcBusy(true);
    try {
      const v = await fetchDolarOficial();
      dispatch({ type: "settings/update", patch: { tipoCambio: v, tipoCambioActualizado: new Date().toISOString() } });
      setTcText(String(v).replace(".", ","));
      toast(`Dólar oficial: $${v.toLocaleString("es-AR")}`, "good");
    } catch {
      toast("No pude traer el dólar. Cargalo a mano.", "bad");
    } finally {
      setTcBusy(false);
    }
  }

  function guardarTc() {
    const v = Number(tcText.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(v) && v > 0) {
      dispatch({ type: "settings/update", patch: { tipoCambio: v, tipoCambioActualizado: new Date().toISOString() } });
      toast("Tipo de cambio guardado", "good");
    }
  }

  function exportar() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pulso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importar(file: File) {
    try {
      const parsed = normalizeData(JSON.parse(await file.text()));
      if (!confirm(`Esto reemplaza todos tus datos por los del archivo (${parsed.cortes.length} cortes, ${parsed.compras.length} compras). ¿Seguro?`)) return;
      dispatch({ type: "data/replace", data: parsed });
      toast("Datos importados", "good");
    } catch {
      toast("El archivo no es un backup válido de Pulso", "bad");
    }
  }

  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <section>
            <SectionTitle>Plan</SectionTitle>
            <Card className="overflow-hidden">
              <Row
                onClick={() => openSheet({ kind: "plan" })}
                title="Sueldo y ahorro"
                subtitle={`${formatARS(s.sueldo)} · ${s.ahorroModo === "porcentaje" ? `${s.ahorroPorcentaje}% al ahorro` : `${formatARS(s.ahorroMonto)} al ahorro`} · aguinaldo ${s.aguinaldo === "presupuesto" ? "como sueldo" : s.aguinaldo === "mitad" ? "mitad al ahorro" : "al ahorro"}`}
              />
              <div className="border-t border-line" />
              <Row onClick={() => navigate("/tarjetas")} title="Tarjetas, cuotas y fijos" subtitle={`${data.tarjetas.filter((t) => !t.archivada).length} tarjetas · ${data.recurrentes.length} fijos`} />
            </Card>
          </section>

          <section>
            <SectionTitle>Corte</SectionTitle>
            <Card className="grid gap-5 p-5">
              <Switch
                checked={s.usaReservaAhorro}
                onChange={(v) => dispatch({ type: "settings/update", patch: { usaReservaAhorro: v } })}
                label="Reserva de ahorro aparte"
                description="Pide dos saldos en el corte: lo de gastar y lo ahorrado."
              />
              <Switch
                checked={s.usaDolares}
                onChange={(v) => dispatch({ type: "settings/update", patch: { usaDolares: v } })}
                label="Tengo dólares"
                description="Suma el campo de dólares al corte y al pago de tarjetas."
              />
            </Card>
          </section>

          <section>
            <SectionTitle>Dólar</SectionTitle>
            <Card className="grid gap-3 p-5">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="mb-1.5 text-[13px] text-ink-2">Pesos por dólar</div>
                  <TextInput inputMode="decimal" value={tcText} onChange={(e) => setTcText(e.target.value)} onBlur={guardarTc} />
                </div>
                <Button variant="secondary" loading={tcBusy} icon={<RefreshCw className="size-4" />} onClick={() => void actualizarDolar()}>
                  Oficial hoy
                </Button>
              </div>
              <p className="text-[13px] text-faint">
                Convierte las cuotas en dólares y valúa tus dólares.
                {s.tipoCambioActualizado && ` Actualizado el ${dayLabel(s.tipoCambioActualizado.slice(0, 10))}.`}
              </p>
            </Card>
          </section>
        </div>

        <div className="grid content-start gap-5">
          <section>
            <SectionTitle>Tus datos</SectionTitle>
            <Card className="grid gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06]">
                  <GitHubMark className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">
                    {conn?.owner}/{conn?.repo}
                  </div>
                  <div className="text-[13px] text-muted">
                    {conn?.path} · {lastSyncedAt ? `sincronizado ${new Date(lastSyncedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "sin sincronizar"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={`https://github.com/${conn?.owner}/${conn?.repo}/commits`} target="_blank" rel="noreferrer">
                  <Button block variant="subtle" size="sm" icon={<ArrowUpRight className="size-4" />}>
                    Historial
                  </Button>
                </a>
                <Button variant="subtle" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => void load()}>
                  Recargar
                </Button>
                <Button variant="subtle" size="sm" icon={<Download className="size-4" />} onClick={exportar}>
                  Exportar
                </Button>
                <Button variant="subtle" size="sm" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                  Importar
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importar(f);
                  e.target.value = "";
                }}
              />
              <p className="text-[12px] leading-relaxed text-faint">
                Cada cambio es un commit en tu repo privado: si algo sale mal, se puede volver atrás desde GitHub. Exportar baja una copia
                completa a este dispositivo.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className={cn("justify-start text-bad hover:text-bad")}
                icon={<LogOut className="size-4" />}
                onClick={() => {
                  if (confirm("¿Desconectar este dispositivo? Tus datos quedan en GitHub; solo se borra el token de acá.")) disconnect();
                }}
              >
                Desconectar este dispositivo
              </Button>
            </Card>
          </section>

          <section>
            <SectionTitle>Ayuda</SectionTitle>
            <Card className="overflow-hidden">
              <Row onClick={() => navigate("/ayuda")} title="Cómo funciona Pulso" subtitle="El modelo, el límite semanal y el arrastre" />
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
