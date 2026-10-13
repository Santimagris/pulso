import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Hoja inferior en el celu (como las de iOS) y modal centrado en la compu.
 * En iPhone se acomoda arriba del teclado usando la VisualViewport API (--kb).
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useKeyboardInset(open);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // En el celu no abrimos el teclado de golpe: molesta más de lo que ayuda.
            if (window.matchMedia("(max-width: 1023px)").matches) e.preventDefault();
          }}
          className={cn(
            "fixed z-50 flex flex-col border-line-2 bg-surface outline-none",
            // Celu: hoja desde abajo
            "inset-x-0 bottom-[var(--kb)] max-h-[calc(100dvh-var(--kb)-env(safe-area-inset-top)-12px)] rounded-t-[28px] border-t shadow-float",
            "data-[state=closed]:animate-sheet-down data-[state=open]:animate-sheet-up",
            // Compu: modal centrado
            "lg:inset-auto lg:top-1/2 lg:left-1/2 lg:max-h-[86dvh] lg:w-[min(560px,calc(100vw-48px))] lg:rounded-3xl lg:border lg:data-[state=closed]:animate-pop-out lg:data-[state=open]:animate-pop-in",
            wide && "lg:w-[min(720px,calc(100vw-48px))]",
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15 lg:hidden" />
          <div className="flex shrink-0 items-start gap-3 px-5 pt-3 pb-3 lg:px-6 lg:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-ink">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 text-[13px] text-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="-mt-1 -mr-2 flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-ink" aria-label="Cerrar">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 lg:px-6">{children}</div>
          {footer && <div className="shrink-0 border-t border-line bg-surface/95 px-5 pt-3 safe-bottom lg:px-6 lg:pb-5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Altura del teclado en iOS → variable CSS --kb, para que la hoja quede visible. */
function useKeyboardInset(active: boolean) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--kb", `${inset > 80 ? inset : 0}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.setProperty("--kb", "0px");
    };
  }, [active]);
}
