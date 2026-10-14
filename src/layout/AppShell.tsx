import { CalendarCheck, CircleHelp, CreditCard, Ellipsis, History, House, PiggyBank, Plus, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { navigate, useRoute, type Route } from "@/lib/router";
import { openSheet, useUI } from "@/lib/ui-store";
import { useApp } from "@/sync/store";
import { Logo } from "@/ui/Logo";
import { Button } from "@/ui/primitives";

import { SyncPill } from "./SyncPill";

const NAV: { route: Route; label: string; icon: typeof House }[] = [
  { route: "/", label: "Inicio", icon: House },
  { route: "/tarjetas", label: "Tarjetas", icon: CreditCard },
  { route: "/ahorro", label: "Ahorro", icon: PiggyBank },
  { route: "/historial", label: "Historial", icon: History },
  { route: "/ajustes", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const puedeAhorrar = useApp((s) => s.data.settings.usaReservaAhorro && s.data.cortes.length > 0);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1280px]">
      {/* Sidebar (compu) */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <Logo className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Pulso</span>
        </div>
        <div className="mt-6 grid gap-2">
          <Button variant="primary" icon={<CalendarCheck className="size-4" />} onClick={() => openSheet({ kind: "corte" })}>
            Hacer corte
          </Button>
          <Button variant="secondary" icon={<CreditCard className="size-4" />} onClick={() => openSheet({ kind: "compra" })}>
            Cargar compra
          </Button>
          {puedeAhorrar && (
            <Button variant="secondary" icon={<PiggyBank className="size-4" />} onClick={() => openSheet({ kind: "ahorrar" })}>
              Ahorrar
            </Button>
          )}
        </div>
        <nav className="mt-6 grid gap-0.5" aria-label="Secciones">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <button
              key={r}
              onClick={() => navigate(r)}
              aria-current={route === r ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition",
                route === r ? "bg-white/[0.07] text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink",
              )}
            >
              <Icon className={cn("size-[18px]", route === r && "text-brand")} />
              {label}
            </button>
          ))}
          <button
            onClick={() => navigate("/ayuda")}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition",
              route === "/ayuda" ? "bg-white/[0.07] text-ink" : "text-muted hover:bg-white/[0.04] hover:text-ink",
            )}
          >
            <CircleHelp className="size-[18px]" />
            Cómo funciona
          </button>
        </nav>
        <div className="mt-auto px-1">
          <SyncPill />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-[980px] px-4 pt-[max(env(safe-area-inset-top),14px)] pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-8 lg:pb-16">
          {children}
        </main>
      </div>

      <BottomNav route={route} />
      <Toasts />
    </div>
  );
}

function BottomNav({ route }: { route: Route }) {
  const items: { route: Route; label: string; icon: typeof House }[] = [
    { route: "/", label: "Inicio", icon: House },
    { route: "/tarjetas", label: "Tarjetas", icon: CreditCard },
    { route: "/ahorro", label: "Ahorro", icon: PiggyBank },
    { route: "/mas", label: "Más", icon: Ellipsis },
  ];
  const isMas = route === "/mas" || route === "/historial" || route === "/ajustes" || route === "/ayuda";
  const item = (it: (typeof items)[number]) => {
    const active = it.route === "/mas" ? isMas : route === it.route;
    const Icon = it.icon;
    return (
      <button
        key={it.route}
        onClick={() => navigate(it.route)}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1 text-[11px] font-medium transition", active ? "text-ink" : "text-faint")}
      >
        <Icon className={cn("size-[22px]", active && "text-brand")} strokeWidth={active ? 2.2 : 1.8} />
        {it.label}
      </button>
    );
  };
  return (
    <nav
      aria-label="Navegación"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[#0b0b0e]/85 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-[60px] max-w-md items-stretch px-2">
        {item(items[0])}
        {item(items[1])}
        <div className="flex flex-1 items-center justify-center">
          <button
            aria-label="Nueva acción"
            onClick={() => openSheet({ kind: "acciones" })}
            className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-ink shadow-[0_10px_28px_-8px_rgb(52_211_153/0.7)] transition active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.4} />
          </button>
        </div>
        {item(items[2])}
        {item(items[3])}
      </div>
    </nav>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[60] flex flex-col items-center gap-2 px-4 lg:top-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-rise rounded-full border px-4 py-2.5 text-sm font-medium shadow-float backdrop-blur-xl",
            t.tone === "good" && "border-good/25 bg-[#0f2a20]/90 text-good",
            t.tone === "bad" && "border-bad/25 bg-[#2a1214]/90 text-bad",
            (!t.tone || t.tone === "neutral") && "border-line-2 bg-surface-3/90 text-ink",
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3 lg:mb-7">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink lg:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <div className="lg:hidden">
          <SyncPill compact />
        </div>
      </div>
    </header>
  );
}
