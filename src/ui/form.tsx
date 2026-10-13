import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { amountToInput, formatTyping, parseAmount } from "@/domain/money";
import type { Moneda } from "@/domain/types";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  aside,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("block", className)}>
      {(label || aside) && (
        <div className="mb-1.5 flex items-end justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
              {label}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-[13px] text-bad">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const box =
  "flex items-center rounded-xl border border-line-2 bg-surface-2 transition focus-within:border-brand/60 focus-within:ring-4 focus-within:ring-brand/10";

/** Input de montos: formatea mientras escribís ("1.234.567") y devuelve centavos. */
export function MoneyInput({
  value,
  onChange,
  moneda = "ARS",
  id,
  autoFocus,
  size = "md",
  placeholder = "0",
  onEnter,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  moneda?: Moneda;
  id?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
  onEnter?: () => void;
}) {
  const [text, setText] = useState(() => (value == null ? "" : amountToInput(value, moneda)));
  const lastEmitted = useRef<number | null>(value);

  // Si el valor cambia desde afuera (precarga, reset), reflejarlo.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value == null ? "" : amountToInput(value, moneda));
    }
  }, [value, moneda]);

  return (
    <div className={cn(box, size === "lg" ? "h-16 px-4" : "h-13 px-3.5")}>
      <span className={cn("mr-1.5 shrink-0 font-medium text-muted", size === "lg" ? "text-xl" : "text-[17px]")}>
        {moneda === "USD" ? "US$" : "$"}
      </span>
      <input
        id={id}
        size={1}
        autoFocus={autoFocus}
        inputMode={moneda === "USD" ? "decimal" : "numeric"}
        enterKeyHint="done"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const t = formatTyping(e.target.value, moneda);
          setText(t);
          const v = parseAmount(t, moneda);
          lastEmitted.current = v;
          onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
            onEnter?.();
          }
        }}
        className={cn(
          "w-full min-w-0 bg-transparent font-semibold tracking-tight text-ink tnum outline-none placeholder:text-faint",
          size === "lg" ? "text-[28px]" : "text-[20px]",
        )}
      />
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn(box, "h-12 px-3.5", className)}>
      <input
        size={1}
        autoComplete="off"
        className="w-full min-w-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        {...rest}
      />
    </div>
  );
}

export function DateInput({ value, onChange, id, max, min }: { value: string; onChange: (v: string) => void; id?: string; max?: string; min?: string }) {
  return (
    <div className={cn(box, "h-12 px-3.5")}>
      <input
        id={id}
        type="date"
        size={1}
        value={value}
        max={max}
        min={min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="w-full bg-transparent text-[16px] text-ink outline-none [color-scheme:dark]"
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg px-2 font-medium transition",
              size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm",
              active ? "bg-surface-3 text-ink shadow-[0_1px_0_rgb(255_255_255/0.06)_inset,0_4px_10px_-4px_rgb(0_0_0/0.6)]" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <div className="text-[15px] text-ink">{label}</div>
        {description && <div className="mt-0.5 text-[13px] text-muted">{description}</div>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  color,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition active:scale-[0.97]",
        active ? "border-brand/50 bg-brand/12 text-ink" : "border-line-2 bg-surface-2 text-ink-2 hover:text-ink",
        className,
      )}
    >
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex h-10 items-center rounded-xl border border-line-2 bg-surface-2">
      <button type="button" aria-label="Menos" className="flex size-10 items-center justify-center text-muted hover:text-ink disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-8 text-center font-semibold tnum">{value}</span>
      <button type="button" aria-label="Más" className="flex size-10 items-center justify-center text-muted hover:text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}
