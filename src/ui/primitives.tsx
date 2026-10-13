import { ChevronLeft, ChevronRight, ChevronRight as Chevron, Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";

import { monthLabel } from "@/domain/dates";
import { formatARS, formatMoney } from "@/domain/money";
import type { Moneda } from "@/domain/types";
import { cn } from "@/lib/cn";

/* --------------------------------- Button --------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink font-semibold hover:bg-brand-2 shadow-[0_8px_24px_-10px_rgb(52_211_153/0.55)]",
  secondary: "bg-surface-3 text-ink border border-line-2 hover:bg-[#2a2a31]",
  ghost: "text-ink-2 hover:bg-white/5 hover:text-ink",
  danger: "bg-bad/12 text-bad hover:bg-bad/20",
  subtle: "bg-white/[0.06] text-ink hover:bg-white/10",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-xl gap-2",
  lg: "h-13 px-5 text-base rounded-2xl gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", block, loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-[background,transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink active:scale-95",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...rest} />;
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between gap-3 px-1", className)}>
      <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

/* --------------------------------- Badge ---------------------------------- */

export type Tone = "good" | "warn" | "bad" | "neutral" | "brand" | "info";

const toneText: Record<Tone, string> = {
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
  neutral: "text-ink-2",
  brand: "text-brand",
  info: "text-info",
};
const toneBg: Record<Tone, string> = {
  good: "bg-good/12 text-good",
  warn: "bg-warn/12 text-warn",
  bad: "bg-bad/12 text-bad",
  neutral: "bg-white/[0.07] text-ink-2",
  brand: "bg-brand/12 text-brand",
  info: "bg-info/12 text-info",
};
export const toneClass = (t: Tone) => toneText[t];

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", toneBg[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/* --------------------------------- Money ---------------------------------- */

export function Money({
  value,
  moneda = "ARS",
  signed,
  tone,
  className,
}: {
  value: number;
  moneda?: Moneda;
  signed?: boolean;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn(tone && toneText[tone], className)}>{formatMoney(value, moneda, { signed })}</span>;
}

/** Número protagonista: "$" chico, cifra grande, cifras proporcionales. */
export function HeroMoney({ value, className, tone }: { value: number; className?: string; tone?: Tone }) {
  const text = formatARS(value);
  const negative = text.startsWith("−");
  const digits = text.replace("−", "").replace("$", "");
  return (
    <span className={cn("inline-flex items-baseline font-semibold tracking-[-0.035em]", tone && toneText[tone], className)}>
      {negative && <span className="mr-1">−</span>}
      <span className="mr-[0.06em] text-[0.55em] font-medium text-muted">$</span>
      {digits}
    </span>
  );
}

/* ---------------------------------- Stat ---------------------------------- */

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-faint">{sub}</div>}
    </div>
  );
}

/* -------------------------------- Progress -------------------------------- */

export function Progress({ value, tone = "brand", className }: { value: number; tone?: Tone; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill: Record<Tone, string> = {
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-bad",
    neutral: "bg-ink-2",
    brand: "bg-brand",
    info: "bg-info",
  };
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-white/[0.07]", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* -------------------------------- Rows/Misc ------------------------------- */

export function Row({
  title,
  subtitle,
  right,
  leading,
  onClick,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  leading?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left",
        onClick && "transition hover:bg-white/[0.03] active:bg-white/[0.05]",
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0 text-right text-[15px]">{right}</div>}
      {onClick && <Chevron className="size-4 shrink-0 text-faint" />}
    </Comp>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-line", className)} />;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/[0.05] text-muted">{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {text && <div className="mt-1 max-w-sm text-sm text-muted">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

export function MonthStepper({ mes, onChange, className }: { mes: string; onChange: (delta: number) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconButton label="Mes anterior" onClick={() => onChange(-1)}>
        <ChevronLeft className="size-5" />
      </IconButton>
      <div className="min-w-[150px] text-center text-[15px] font-semibold text-ink">{monthLabel(mes)}</div>
      <IconButton label="Mes siguiente" onClick={() => onChange(1)}>
        <ChevronRight className="size-5" />
      </IconButton>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-2 bg-white/5 px-1.5 py-0.5 font-sans text-[11px] text-muted">{children}</kbd>;
}
