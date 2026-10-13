import { useMemo, useSyncExternalStore } from "react";

import { monthOf } from "@/domain/dates";
import { computeEngine } from "@/domain/engine";
import { computeMetrics } from "@/domain/metrics";
import { useApp } from "@/sync/store";

/** Motor recalculado cuando cambian los datos o el día. */
export function useEngine() {
  const data = useApp((s) => s.data);
  const hoy = useApp((s) => s.hoy);
  return useMemo(() => computeEngine(data, hoy), [data, hoy]);
}

export function useMetrics() {
  const data = useApp((s) => s.data);
  const engine = useEngine();
  return useMemo(() => computeMetrics(data, engine), [data, engine]);
}

export function useMesActual() {
  return monthOf(useApp((s) => s.hoy));
}

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMedia("(min-width: 1024px)");
