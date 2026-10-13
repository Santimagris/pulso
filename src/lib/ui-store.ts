import { create } from "zustand";

import type { ISOMonth } from "@/domain/types";

/** Hojas (bottom sheets / modales) que se pueden abrir desde cualquier pantalla. */
export type SheetSpec =
  | { kind: "acciones" }
  | { kind: "corte"; corteId?: string }
  | { kind: "consulta" }
  | { kind: "compra"; compraId?: string; tarjetaId?: string }
  | { kind: "pago"; tarjetaId: string; mes: ISOMonth }
  | { kind: "tarjeta"; tarjetaId?: string }
  | { kind: "recurrente"; recurrenteId?: string; tarjetaId?: string }
  | { kind: "especial"; especialId?: string }
  | { kind: "ingreso"; ingresoId?: string; tipo?: "sueldo" | "aguinaldo" | "extra" }
  | { kind: "plan" }
  | { kind: "meta" }
  | { kind: "sobrante" };

export interface Toast {
  id: number;
  text: string;
  tone?: "good" | "bad" | "neutral";
}

interface UIState {
  /** Hoja abierta (null = cerrada). */
  sheet: SheetSpec | null;
  /** Última hoja abierta: se sigue renderizando cerrada para que Radix anime la salida. */
  lastSheet: SheetSpec | null;
  /** Cambia en cada apertura: remonta el formulario con estado limpio. */
  sheetKey: number;
  toasts: Toast[];
  openSheet: (s: SheetSpec) => void;
  closeSheet: () => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
}

let toastSeq = 1;

export const useUI = create<UIState>()((set) => ({
  sheet: null,
  lastSheet: null,
  sheetKey: 0,
  toasts: [],
  openSheet: (sheet) => set((st) => ({ sheet, lastSheet: sheet, sheetKey: st.sheetKey + 1 })),
  closeSheet: () => set({ sheet: null }),
  toast: (text, tone = "neutral") => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600);
  },
}));

export const openSheet = (s: SheetSpec) => useUI.getState().openSheet(s);
export const closeSheet = () => useUI.getState().closeSheet();
export const toast = (text: string, tone?: Toast["tone"]) => useUI.getState().toast(text, tone);
