import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { formatARSCompact } from "@/domain/money";
import { cn } from "@/lib/cn";

/**
 * Barras de una sola serie (gasto por semana, ahorro por mes, tarjetas por mes).
 * Specs de dataviz: barras ≤ 24px con punta redondeada de 4px y base recta, grilla hairline
 * sólida y recesiva, marca de referencia por barra (límite/meta), tooltip en hover, foco y toque.
 * Los valores siempre están también en la lista/tabla de la pantalla (el tooltip no es la única vía).
 */

export type BarTone = "good" | "bad" | "warn" | "neutral" | "brand";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Marca de referencia (límite o meta). */
  ref?: number | null;
  tone?: BarTone;
}

const FILL: Record<BarTone, string> = {
  good: "#34d399",
  brand: "#34d399",
  bad: "#f87171",
  warn: "#fbbf24",
  neutral: "#52525b",
};

const PAD = { top: 14, right: 6, bottom: 26, left: 46 };

function niceStep(span: number, count: number): number {
  if (span <= 0) return 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export function BarChart({
  data,
  height = 200,
  renderTooltip,
  selectedKey,
  onSelect,
  formatAxis = formatARSCompact,
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  renderTooltip: (d: BarDatum) => ReactNode;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  formatAxis?: (v: number) => string;
  ariaLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    const vals = data.flatMap((d) => [d.value, d.ref ?? 0]);
    const max = Math.max(0, ...vals);
    const min = Math.min(0, ...vals);
    const step = niceStep(max - min || 1, 3);
    const yMax = Math.ceil(max / step) * step || step;
    const yMin = Math.floor(min / step) * step;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);
    return { yMax, yMin, ticks };
  }, [data]);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((scale.yMax - v) / (scale.yMax - scale.yMin || 1)) * plotH;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(6, Math.min(24, slot * 0.56));
  const labelEvery = slot < 34 ? Math.ceil(34 / Math.max(slot, 1)) : 1;

  const activeIndex = data.findIndex((d) => d.key === active);
  const activeDatum = activeIndex >= 0 ? data[activeIndex] : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }} onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgb(255 255 255 / 0.16)" : "rgb(255 255 255 / 0.06)"} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={PAD.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className="fill-faint text-[11px] tnum">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const top = y(Math.max(0, d.value));
            const bottom = y(Math.min(0, d.value));
            const h = Math.max(d.value === 0 ? 0 : 2, bottom - top);
            const r = Math.min(4, h / 2, barW / 2);
            const x0 = cx - barW / 2;
            const up = d.value >= 0;
            const path = up
              ? `M${x0},${top + h} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${top + h} Z`
              : `M${x0},${top} V${top + h - r} Q${x0},${top + h} ${x0 + r},${top + h} H${x0 + barW - r} Q${x0 + barW},${top + h} ${x0 + barW},${top + h - r} V${top} Z`;
            const dim = (selectedKey && selectedKey !== d.key) || (active && active !== d.key);
            return (
              <g key={d.key} opacity={dim ? 0.55 : 1} style={{ transition: "opacity 150ms" }}>
                <path d={path} fill={FILL[d.tone ?? "brand"]} />
                {d.ref != null && d.ref > 0 && (
                  <line x1={cx - barW / 2 - 5} x2={cx + barW / 2 + 5} y1={y(d.ref)} y2={y(d.ref)} stroke="#e4e4e7" strokeOpacity={0.75} strokeWidth={2} strokeLinecap="round" />
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" className={cn("text-[11px]", selectedKey === d.key ? "fill-ink" : "fill-faint")}>
                    {d.label}
                  </text>
                )}
                {/* Zona de toque: toda la columna, más grande que la barra. */}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={d.label}
                  onPointerEnter={() => setActive(d.key)}
                  onPointerDown={() => setActive(d.key)}
                  onFocus={() => setActive(d.key)}
                  onBlur={() => setActive(null)}
                  onClick={() => onSelect?.(d.key)}
                  className="cursor-pointer outline-none"
                />
              </g>
            );
          })}
        </svg>
      )}
      {activeDatum && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-[120px] rounded-xl border border-line-2 bg-surface-3/95 px-3 py-2 text-left shadow-float backdrop-blur"
          style={{
            left: Math.min(Math.max(PAD.left + slot * activeIndex + slot / 2, 70), width - 70),
            top: Math.max(0, y(Math.max(activeDatum.value, activeDatum.ref ?? 0, 0)) - 10),
            transform: "translate(-50%, -100%)",
          }}
        >
          {renderTooltip(activeDatum)}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; tone?: BarTone; kind?: "bar" | "ref" }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "ref" ? (
            <span className="h-0.5 w-3.5 rounded-full bg-zinc-200/75" />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: FILL[it.tone ?? "brand"] }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
