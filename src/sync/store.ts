import { create } from "zustand";

import { describe, reduceAll, type Action } from "@/domain/actions";
import { todayISO } from "@/domain/dates";
import { emptyData, normalizeData } from "@/domain/defaults";
import type { Data } from "@/domain/types";

import { explainError, GitHubError, readData, writeData, type Connection } from "./github";

/**
 * Sync local-first:
 * - `remote` es la última versión confirmada en GitHub (+ su sha).
 * - `pending` son acciones todavía no subidas (persisten en localStorage: sobreviven sin señal).
 * - `data` = remote + pending, lo que ve la UI (actualización optimista).
 * Si otro dispositivo escribió antes (sha viejo), se baja lo nuevo y se re-aplican las acciones.
 */

export type SyncStatus = "idle" | "loading" | "saving" | "offline" | "error";

const K_CONN = "pulso:conn";
const K_CACHE = "pulso:cache";
const K_PENDING = "pulso:pending";

const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* almacenamiento lleno o bloqueado: seguimos en memoria */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  },
};

interface Remote {
  data: Data;
  sha: string | null;
}

interface AppState {
  conn: Connection | null;
  status: SyncStatus;
  error: string | null;
  remote: Remote | null;
  pending: Action[];
  data: Data;
  loaded: boolean;
  lastSyncedAt: string | null;
  hoy: string;

  connect: (conn: Connection) => Promise<void>;
  disconnect: () => void;
  load: () => Promise<void>;
  dispatch: (action: Action | Action[]) => void;
  flush: () => Promise<void>;
  refreshHoy: () => void;
}

const cachedRemote = storage.get<Remote>(K_CACHE);
const cachedPending = storage.get<Action[]>(K_PENDING) ?? [];
const initialRemote: Remote | null = cachedRemote
  ? { data: normalizeData(cachedRemote.data), sha: cachedRemote.sha }
  : null;

let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const view = (remote: Remote | null, pending: Action[]) => reduceAll(remote?.data ?? emptyData(), pending);

function commitMessage(batch: Action[]): string {
  if (batch.length === 1) return describe(batch[0]);
  const head = batch.slice(0, 3).map(describe).join(" · ");
  return `${batch.length} cambios: ${head}${batch.length > 3 ? " …" : ""}`;
}

export const useApp = create<AppState>()((set, get) => ({
  conn: storage.get<Connection>(K_CONN),
  status: "idle",
  error: null,
  remote: initialRemote,
  pending: cachedPending,
  data: view(initialRemote, cachedPending),
  loaded: initialRemote != null,
  lastSyncedAt: null,
  hoy: todayISO(),

  refreshHoy: () => {
    const hoy = todayISO();
    if (hoy !== get().hoy) set({ hoy });
  },

  connect: async (conn) => {
    storage.set(K_CONN, conn);
    storage.del(K_CACHE);
    set({ conn, remote: null, data: view(null, get().pending), loaded: false });
    await get().load();
  },

  disconnect: () => {
    storage.del(K_CONN);
    storage.del(K_CACHE);
    storage.del(K_PENDING);
    set({ conn: null, remote: null, pending: [], data: emptyData(), loaded: false, status: "idle", error: null });
  },

  load: async () => {
    const { conn } = get();
    if (!conn) return;
    set({ status: "loading", error: null });
    try {
      const fresh = await readData(conn);
      const remote: Remote = fresh ?? { data: emptyData(), sha: null };
      storage.set(K_CACHE, remote);
      set((s) => ({
        remote,
        data: view(remote, s.pending),
        loaded: true,
        status: "idle",
        lastSyncedAt: new Date().toISOString(),
      }));
      if (get().pending.length) await get().flush();
    } catch (e) {
      set({ status: e instanceof TypeError ? "offline" : "error", error: explainError(e), loaded: get().remote != null });
      if (e instanceof GitHubError && (e.status === 401 || e.status === 404)) return;
      scheduleRetry(() => get().load());
    }
  },

  dispatch: (action) => {
    const actions = Array.isArray(action) ? action : [action];
    set((s) => {
      const pending = [...s.pending, ...actions];
      storage.set(K_PENDING, pending);
      return { pending, data: reduceAll(s.data, actions) };
    });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void get().flush(), 400);
  },

  flush: async () => {
    const { conn } = get();
    if (!conn || flushing || !get().pending.length) return;
    flushing = true;
    set({ status: "saving", error: null });
    let conflicts = 0;
    try {
      while (get().pending.length) {
        const batch = get().pending.slice();
        const base = get().remote ?? { data: emptyData(), sha: null };
        const next = reduceAll(base.data, batch);
        try {
          const sha = await writeData(conn, next, base.sha, commitMessage(batch));
          const remote = { data: next, sha };
          set((s) => {
            const pending = s.pending.slice(batch.length);
            storage.set(K_PENDING, pending);
            storage.set(K_CACHE, remote);
            return { remote, pending, data: view(remote, pending) };
          });
        } catch (e) {
          const conflicto = e instanceof GitHubError && (e.status === 409 || e.status === 422);
          if (!conflicto || ++conflicts > 3) throw e;
          // Otro dispositivo guardó antes: bajamos su versión y re-aplicamos lo nuestro.
          const fresh = await readData(conn);
          const remote: Remote = fresh ?? { data: emptyData(), sha: null };
          set((s) => ({ remote, data: view(remote, s.pending) }));
        }
      }
      set({ status: "idle", lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      const offline = e instanceof TypeError;
      set({ status: offline ? "offline" : "error", error: explainError(e) });
      const fatal = e instanceof GitHubError && [401, 403, 404].includes(e.status);
      if (!fatal) scheduleRetry(() => get().flush());
    } finally {
      flushing = false;
    }
  },
}));

function scheduleRetry(fn: () => void) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(fn, 15_000);
}

/** Re-sincroniza al volver a la app (cambios desde otro dispositivo) y al recuperar señal. */
export function installSyncListeners() {
  const onFocus = () => {
    const s = useApp.getState();
    s.refreshHoy();
    if (!s.conn) return;
    if (s.pending.length) void s.flush();
    else if (s.status !== "saving" && s.status !== "loading") void s.load();
  };
  window.addEventListener("online", onFocus);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onFocus();
  });
  window.addEventListener("beforeunload", (ev) => {
    if (useApp.getState().pending.length && useApp.getState().status === "saving") ev.preventDefault();
  });
}
