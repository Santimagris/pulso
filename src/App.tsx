import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/layout/AppShell";
import { useRoute } from "@/lib/router";
import { Ahorro } from "@/screens/Ahorro";
import { Ajustes } from "@/screens/Ajustes";
import { Ayuda, Mas } from "@/screens/Ayuda";
import { Historial } from "@/screens/Historial";
import { Home } from "@/screens/Home";
import { Setup } from "@/screens/Setup";
import { Tarjetas } from "@/screens/Tarjetas";
import { SheetHost } from "@/sheets/SheetHost";
import { installSyncListeners, useApp } from "@/sync/store";
import { Logo } from "@/ui/Logo";
import { Button } from "@/ui/primitives";

export function App() {
  const conn = useApp((s) => s.conn);
  const loaded = useApp((s) => s.loaded);
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const load = useApp((s) => s.load);
  const disconnect = useApp((s) => s.disconnect);
  const route = useRoute();

  useEffect(() => {
    installSyncListeners();
  }, []);

  useEffect(() => {
    if (conn) void load();
  }, [conn, load]);

  if (!conn) return <Setup />;

  if (!loaded) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <Logo className="size-14" />
        {status === "error" || status === "offline" ? (
          <>
            <p className="max-w-sm text-sm text-muted">{error}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void load()}>
                Reintentar
              </Button>
              <Button variant="ghost" onClick={disconnect}>
                Cambiar token
              </Button>
            </div>
          </>
        ) : (
          <LoaderCircle className="size-5 animate-spin text-muted" />
        )}
      </div>
    );
  }

  return (
    <>
      <AppShell>
        <div key={route} className="animate-rise">
          {route === "/" && <Home />}
          {route === "/tarjetas" && <Tarjetas />}
          {route === "/ahorro" && <Ahorro />}
          {route === "/historial" && <Historial />}
          {route === "/ajustes" && <Ajustes />}
          {route === "/ayuda" && <Ayuda />}
          {route === "/mas" && <Mas />}
        </div>
      </AppShell>
      <SheetHost />
    </>
  );
}
