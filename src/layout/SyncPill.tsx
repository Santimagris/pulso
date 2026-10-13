import { CircleAlert, Cloud, CloudOff, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/cn";
import { navigate } from "@/lib/router";
import { useApp } from "@/sync/store";

/** Estado del guardado en GitHub. Tocarlo reintenta si hubo un error. */
export function SyncPill({ compact }: { compact?: boolean }) {
  const status = useApp((s) => s.status);
  const pending = useApp((s) => s.pending.length);
  const error = useApp((s) => s.error);
  const flush = useApp((s) => s.flush);
  const load = useApp((s) => s.load);

  const map = {
    idle: { icon: Cloud, text: pending ? "Sin subir" : "Guardado", cls: "text-faint" },
    loading: { icon: LoaderCircle, text: "Cargando…", cls: "text-muted" },
    saving: { icon: LoaderCircle, text: "Guardando…", cls: "text-muted" },
    offline: { icon: CloudOff, text: "Sin conexión", cls: "text-warn" },
    error: { icon: CircleAlert, text: "Error al guardar", cls: "text-bad" },
  } as const;
  const m = map[status];
  const Icon = m.icon;
  const spinning = status === "saving" || status === "loading";

  return (
    <button
      title={error ?? (pending ? `${pending} cambio(s) sin subir` : "Todo guardado en GitHub")}
      onClick={() => {
        if (status === "error" && error?.includes("token")) navigate("/ajustes");
        else if (pending) void flush();
        else void load();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-xs font-medium transition hover:text-ink",
        compact ? "h-8 px-2.5" : "h-8 px-2",
        m.cls,
      )}
    >
      <Icon className={cn("size-4", spinning && "animate-spin")} />
      {(!compact || status !== "idle" || pending > 0) && <span>{m.text}</span>}
    </button>
  );
}
