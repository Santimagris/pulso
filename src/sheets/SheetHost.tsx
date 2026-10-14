import { useUI } from "@/lib/ui-store";

import { CompraSheet, FijoMesSheet, PagoSheet, RecurrenteSheet, TarjetaSheet } from "./CardSheets";
import { CorteSheet } from "./CorteSheet";
import { MetaSheet, PlanSheet } from "./PlanSheets";
import { AccionesSheet, AhorrarSheet, EspecialSheet, IngresoSheet, SobranteSheet } from "./SmallSheets";

/**
 * Renderiza la hoja activa. La última abierta queda montada (cerrada) para que Radix anime
 * la salida y la saque del DOM; cada apertura nueva cambia la key y remonta el formulario.
 */
export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const spec = useUI((s) => s.lastSheet);
  const key = useUI((s) => s.sheetKey);
  if (!spec) return null;
  const open = sheet != null;
  switch (spec.kind) {
    case "acciones":
      return <AccionesSheet key={key} open={open} />;
    case "corte":
      return <CorteSheet key={key} open={open} corteId={spec.corteId} />;
    case "compra":
      return <CompraSheet key={key} open={open} compraId={spec.compraId} tarjetaId={spec.tarjetaId} />;
    case "pago":
      return <PagoSheet key={key} open={open} tarjetaId={spec.tarjetaId} mes={spec.mes} />;
    case "tarjeta":
      return <TarjetaSheet key={key} open={open} tarjetaId={spec.tarjetaId} />;
    case "recurrente":
      return <RecurrenteSheet key={key} open={open} recurrenteId={spec.recurrenteId} tarjetaId={spec.tarjetaId} />;
    case "fijoMes":
      return <FijoMesSheet key={key} open={open} recurrenteId={spec.recurrenteId} mes={spec.mes} />;
    case "especial":
      return <EspecialSheet key={key} open={open} especialId={spec.especialId} />;
    case "ingreso":
      return <IngresoSheet key={key} open={open} ingresoId={spec.ingresoId} tipo={spec.tipo} />;
    case "plan":
      return <PlanSheet key={key} open={open} />;
    case "meta":
      return <MetaSheet key={key} open={open} />;
    case "sobrante":
      return <SobranteSheet key={key} open={open} />;
    case "ahorrar":
      return <AhorrarSheet key={key} open={open} sacar={spec.sacar} />;
  }
}
