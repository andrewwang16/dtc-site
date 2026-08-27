"use client";

import { useMemo, useState, type MouseEvent, type TouchEvent } from "react";
import {
  HITTER_COLUMNS,
  PITCHER_COLUMNS,
  computeRollingValue,
  formatRollingValue,
  type GameLogEntry,
  type PlayerRole,
} from "@/lib/mlb";

const WINDOW_SIZES = [3, 5, 7, 10, 15, 20, 30] as const;

function formatChartDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatDelta(statKey: string, value: number, average: number) {
  const delta = value - average;
  const formatted = formatRollingValue(statKey, Math.abs(delta));

  if (formatted === "-") {
    return "-";
  }

  return delta >= 0 ? `+${formatted}` : `-${formatted}`;
}

export default function RollingTrendChart({
  gameLog,
  role,
}: {
  gameLog: GameLogEntry[];
  role: PlayerRole;
}) {
  const columns = role === "Pitcher" ? PITCHER_COLUMNS : HITTER_COLUMNS;
  const defaultStat = role === "Pitcher" ? "ERA" : "OPS";
  const playingTimeKey = role === "Pitcher" ? "IP" : "PA";

  const [windowSize, setWindowSize] = useState<number>(10);
  const [statKey, setStatKey] = useState<string>(defaultStat);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = useMemo(() => {
    const results: Array<{ date: string; value: number; playingTime: number }> = [];

    for (let i = windowSize - 1; i < gameLog.length; i += 1) {
      const window = gameLog.slice(i - windowSize + 1, i + 1);
      const value = computeRollingValue(window, statKey, role);
      const playingTime = computeRollingValue(window, playingTimeKey, role);

      if (value !== null && Number.isFinite(value)) {
        results.push({ date: gameLog[i].date, value, playingTime: playingTime ?? 0 });
      }
    }

    return results;
  }, [gameLog, windowSize, statKey, playingTimeKey, role]);

  const seasonAverage = useMemo(
    () => computeRollingValue(gameLog, statKey, role),
    [gameLog, statKey, role]
  );

  const width = 640;
  const height = 260;
  const paddingLeft = 52;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 36;

  const chart = useMemo(() => {
    if (points.length < 2) {
      return null;
    }

    const values = points.map((p) => p.value);

    if (seasonAverage !== null && Number.isFinite(seasonAverage)) {
      values.push(seasonAverage);
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const span = maxValue - minValue || 1;
    const padded = { min: minValue - span * 0.1, max: maxValue + span * 0.1 };

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const toY = (value: number) =>
      paddingTop +
      plotHeight -
      ((value - padded.min) / (padded.max - padded.min)) * plotHeight;

    const coords = points.map((point, index) => {
      const x =
        paddingLeft + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth);

      return { x, y: toY(point.value), ...point };
    });

    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

    const averageY =
      seasonAverage !== null && Number.isFinite(seasonAverage) ? toY(seasonAverage) : null;

    return { coords, path, minValue, maxValue, averageY, plotWidth };
  }, [points, seasonAverage]);

  const hovered =
    chart && hoveredIndex !== null ? chart.coords[hoveredIndex] : undefined;

  function updateHoveredFromClientX(svg: SVGSVGElement | null | undefined, clientX: number) {
    if (!chart) {
      return;
    }

    const rect = svg?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const xInViewBox = ((clientX - rect.left) / rect.width) * width;

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    chart.coords.forEach((coord, index) => {
      const distance = Math.abs(coord.x - xInViewBox);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setHoveredIndex(nearestIndex);
  }

  function handlePointerMove(event: MouseEvent<SVGRectElement>) {
    updateHoveredFromClientX(event.currentTarget.ownerSVGElement, event.clientX);
  }

  function handleTouchMove(event: TouchEvent<SVGRectElement>) {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    updateHoveredFromClientX(event.currentTarget.ownerSVGElement, touch.clientX);
  }

  return (
    <div className="rolling-trend-root" style={{ display: "grid", gap: "1rem" }}>
      <div className="rolling-trend-controls" style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {WINDOW_SIZES.map((size) => {
            const isActive = size === windowSize;

            return (
              <button
                key={size}
                type="button"
                onClick={() => setWindowSize(size)}
                style={{
                  border: `1px solid ${isActive ? "#8a1024" : "var(--line)"}`,
                  background: isActive
                    ? "rgba(194,30,58,0.12)"
                    : "rgba(15,31,61,0.02)",
                  color: "var(--text)",
                  borderRadius: "999px",
                  padding: "0.45rem 0.85rem",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {size}G
              </button>
            );
          })}
        </div>

        <select
          value={statKey}
          onChange={(event) => setStatKey(event.target.value)}
          style={{
            padding: "0.5rem 0.9rem",
            borderRadius: "999px",
            border: "1px solid var(--line)",
            background: "var(--panel)",
            color: "var(--text)",
            fontWeight: 700,
          }}
        >
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
      </div>

      {!chart ? (
        <p style={{ color: "var(--muted)" }}>
          Not enough games this season for a {windowSize}-game rolling average.
        </p>
      ) : (
        <div className="rolling-trend-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke="var(--line)"
          />
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="var(--line)"
          />

          <text x={4} y={paddingTop + 4} fill="var(--muted)" fontSize="11">
            {formatRollingValue(statKey, chart.maxValue)}
          </text>
          <text x={4} y={height - paddingBottom} fill="var(--muted)" fontSize="11">
            {formatRollingValue(statKey, chart.minValue)}
          </text>

          <text x={paddingLeft} y={height - 8} fill="var(--muted)" fontSize="11">
            {formatChartDate(points[0].date)}
          </text>
          <text
            x={width - paddingRight}
            y={height - 8}
            fill="var(--muted)"
            fontSize="11"
            textAnchor="end"
          >
            {formatChartDate(points[points.length - 1].date)}
          </text>

          {chart.averageY !== null && (
            <>
              <line
                x1={paddingLeft}
                y1={chart.averageY}
                x2={width - paddingRight}
                y2={chart.averageY}
                stroke="#f2e3c7"
                strokeWidth={1.5}
                strokeDasharray="5,4"
                opacity={0.85}
              />
              <text
                x={4}
                y={chart.averageY + 3.5}
                fill="#f2e3c7"
                fontSize="11"
                fontWeight={700}
              >
                {formatRollingValue(statKey, seasonAverage as number)}
              </text>
            </>
          )}

          <path d={chart.path} fill="none" stroke="#c41e3a" strokeWidth={2.5} />

          {chart.coords.map((coord, index) => (
            <circle
              key={index}
              cx={coord.x}
              cy={coord.y}
              r={hoveredIndex === index ? 5 : 3}
              fill="#f2e3c7"
              stroke="#c41e3a"
              strokeWidth={hoveredIndex === index ? 1.5 : 0}
              style={{ transition: "r 0.1s ease" }}
            />
          ))}

          {hovered && (
            <line
              x1={hovered.x}
              y1={paddingTop}
              x2={hovered.x}
              y2={height - paddingBottom}
              stroke="rgba(15,31,61,0.35)"
              strokeWidth={1}
            />
          )}

          {/* Invisible full-width strip: hover anywhere along the x-axis to
              activate the nearest point, rather than needing to hit a dot. */}
          <rect
            x={paddingLeft}
            y={paddingTop}
            width={chart.plotWidth}
            height={height - paddingTop - paddingBottom}
            fill="transparent"
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={handleTouchMove}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => setHoveredIndex(null)}
            style={{ cursor: "crosshair", touchAction: "none" }}
          />

          {hovered &&
            seasonAverage !== null &&
            Number.isFinite(seasonAverage) &&
            (() => {
              const lines = [
                formatChartDate(hovered.date),
                `${statKey}: ${formatRollingValue(statKey, hovered.value)}`,
                `${playingTimeKey}: ${formatRollingValue(playingTimeKey, hovered.playingTime)}`,
                `vs avg: ${formatDelta(statKey, hovered.value, seasonAverage)}`,
              ];
              const boxWidth = Math.max(96, Math.max(...lines.map((l) => l.length)) * 6 + 16);
              const boxHeight = lines.length * 14 + 12;
              const boxX = Math.min(
                Math.max(hovered.x - boxWidth / 2, paddingLeft),
                width - paddingRight - boxWidth
              );
              const boxY = Math.max(hovered.y - boxHeight - 12, paddingTop);

              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxWidth}
                    height={boxHeight}
                    rx={6}
                    fill="var(--panel)"
                    stroke="var(--line)"
                  />
                  {lines.map((line, index) => (
                    <text
                      key={index}
                      x={boxX + boxWidth / 2}
                      y={boxY + 15 + index * 14}
                      fill={index === 0 ? "var(--muted)" : "var(--text)"}
                      fontSize="11"
                      fontWeight={index === 0 ? 400 : 700}
                      textAnchor="middle"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            })()}
        </svg>
        </div>
      )}
    </div>
  );
}
