import { useSyncExternalStore } from "react";

/** Router mínimo por hash: funciona igual en GitHub Pages, en la PWA de iOS y en cualquier subcarpeta. */
export type Route = "/" | "/tarjetas" | "/ahorro" | "/historial" | "/ajustes" | "/ayuda" | "/mas";

const ROUTES: Route[] = ["/", "/tarjetas", "/ahorro", "/historial", "/ajustes", "/ayuda", "/mas"];

function current(): Route {
  const h = window.location.hash.replace(/^#/, "") || "/";
  return (ROUTES as string[]).includes(h) ? (h as Route) : "/";
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => "/");
}

export function navigate(route: Route) {
  if (current() === route) return;
  window.location.hash = route === "/" ? "/" : route;
  window.scrollTo({ top: 0 });
}
