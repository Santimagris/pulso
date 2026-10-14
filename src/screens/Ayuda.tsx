import { CalendarCheck, CircleHelp, CreditCard, Gift, History, PiggyBank, Repeat, Settings, Shield, Sparkles, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { navigate } from "@/lib/router";
import { PageHeader } from "@/layout/AppShell";
import { Card, Row } from "@/ui/primitives";

function Bloque({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">{icon}</span>
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 grid gap-2.5 text-[14px] leading-relaxed text-muted [&_b]:font-medium [&_b]:text-ink-2">{children}</div>
    </Card>
  );
}

export function Ayuda() {
  return (
    <>
      <PageHeader title="Cómo funciona" subtitle="Todo el sistema en 2 minutos." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloque icon={<Sparkles className="size-4" />} title="La idea">
          <p>
            Anotás <b>una vez por semana</b> cuánta plata tenés. Con eso Pulso deduce cuánto gastaste, sin que tengas que anotar cada café.
            Lo único que cargás aparte es lo que el saldo no ve: <b>las compras con tarjeta</b> (porque se pagan después) y el sueldo.
          </p>
        </Bloque>

        <Bloque icon={<Wallet className="size-4" />} title="Tu límite semanal">
          <p>Cada mes:</p>
          <p className="rounded-xl bg-white/[0.04] p-3 font-medium text-ink-2">
            sueldo − ahorro del mes − resúmenes de tarjeta del mes = libre para el día a día
          </p>
          <p>
            Eso se divide por las semanas del mes (las que arrancan un lunes de ese mes). Ese es tu <b>límite base</b>. Como el ahorro sale
            primero, si respetás el límite, el ahorro está asegurado.
          </p>
        </Bloque>

        <Bloque icon={<CreditCard className="size-4" />} title="Por qué pagar la tarjeta no es gasto">
          <p>
            Lo que compraste con tarjeta ya está restado del mes en que lo pagás. Cuando pagás el resumen, la plata sale de tu cuenta pero{" "}
            <b>no cuenta como gasto de esa semana</b>: es cancelar una deuda que ya estaba en el presupuesto.
          </p>
          <p>Por eso ya no hay semanas con picos de un millón: en el corte marcás “pagué la Visa” y listo.</p>
        </Bloque>

        <Bloque icon={<CalendarCheck className="size-4" />} title="El corte de los lunes">
          <p>Gasto de la semana = lo que tenías + lo que entró − lo que tenés hoy − pagos de tarjeta − gastos especiales.</p>
          <p>
            Si te salteás un lunes no pasa nada: el próximo corte reparte el gasto entre las semanas.
          </p>
        </Bloque>

        <Bloque icon={<PiggyBank className="size-4" />} title="Ahorrar">
          <p>
            El día que cobrás, el Inicio te muestra cuánto <b>te sobra en gastos</b>: es el ahorro del mes. Tocá <b>Ahorrar</b>, cambiá el
            monto si querés redondear y hacé el mismo pase en Mercado Pago.
          </p>
          <p>
            Pasar plata de una reserva a otra <b>no es gasto</b>: el corte mide el total, que no cambia. Tus reservas se actualizan al toque y
            el próximo corte confirma los saldos.
          </p>
          <p>
            Si te falta en gastos, en la misma hoja tenés <b>Sacar del ahorro</b>. Tampoco te sube el límite: si es para algo grande (un
            viaje, un regalo), cargalo como gasto especial.
          </p>
        </Bloque>

        <Bloque icon={<Sparkles className="size-4" />} title="El arrastre">
          <p>
            <b>Si te sobra</b>, se suma entero a la semana siguiente: es tu premio. Si se te junta mucho, mandalo al ahorro con un toque.
          </p>
          <p>
            <b>Si te pasás</b>, se descuenta repartido entre las semanas que quedan del mes, para que ninguna quede en cero. Si a fin de mes
            no lo recuperaste, sale del ahorro de ese mes y <b>el mes siguiente arrancás limpio</b>. Nunca más un número hundido por meses.
          </p>
        </Bloque>

        <Bloque icon={<Gift className="size-4" />} title="Gastos especiales">
          <p>
            Un regalo, un viaje, el aniversario: cosas grandes que no son del día a día. Marcalas como <b>especiales</b> (en el corte o al
            cargar la compra con tarjeta) y salen del ahorro, sin destruirte la semana. Quedan registradas, así ves cuánto se fue en eso.
          </p>
        </Bloque>

        <Bloque icon={<Repeat className="size-4" />} title="Fijos de tarjeta (plan del auto)">
          <p>
            Los fijos se cargan solos en cada resumen con el <b>último monto anotado</b>, así los meses que vienen ya lo tienen en
            cuenta. Cuando te llega el resumen, tocás el fijo en <b>Tarjetas</b> y anotás el monto real de ese mes: queda para ese mes
            y pasa a ser el estimado de los siguientes.
          </p>
          <p>
            Si un mes te vienen <b>dos cuotas juntas</b> (o ninguna), lo marcás ahí mismo: la caja de ese mes lo muestra, pero el
            presupuesto cuenta <b>una por mes</b>, así un corrimiento de fechas no te hunde un mes y te infla el siguiente.
          </p>
        </Bloque>

        <Bloque icon={<Shield className="size-4" />} title="Tus datos">
          <p>
            Todo vive en <b>data.json</b> en tu repo privado de GitHub. Cada cambio es un commit con un mensaje legible, así que tenés el
            historial completo y podés volver atrás. Si te quedás sin señal, los cambios se guardan en el dispositivo y se suben solos.
          </p>
        </Bloque>
      </div>
    </>
  );
}

/** Menú "Más" del celu. */
export function Mas() {
  return (
    <>
      <PageHeader title="Más" />
      <Card className="overflow-hidden">
        <Row onClick={() => navigate("/historial")} leading={<History className="size-5 text-muted" />} title="Historial" subtitle="Semanas, meses y movimientos" />
        <div className="border-t border-line" />
        <Row onClick={() => navigate("/ajustes")} leading={<Settings className="size-5 text-muted" />} title="Ajustes" subtitle="Plan, dólar y tus datos" />
        <div className="border-t border-line" />
        <Row onClick={() => navigate("/ayuda")} leading={<CircleHelp className="size-5 text-muted" />} title="Cómo funciona" subtitle="El modelo en 2 minutos" />
      </Card>
    </>
  );
}
