"use client";

import { useMemo, useState, type MouseEvent, type TouchEvent } from "react";
import {
  computeRollingValue,
  formatRollingValue,
  sumGameLogStats,
  type GameLogEntry,
  type PlayerRole,
} from "@/lib/mlb";
import { rollingEraPlus, rollingWrcPlus, type RollingContext } from "@/lib/rolling-advanced";

// Rate stats only — counting stats (HR, K, WAR…) just track playing time
// in a rolling window rather than how well a player is performing.
const HITTER_RATE_STATS = ["AVG", "OBP", "SLG", "OPS", "ISO", "BB%", "K%"];
const PITCHER_RATE_STATS = ["ERA", "WHIP", "K%", "BB%", "K-BB%", "HR/9", "AVG", "OBP", "SLG", "OPS"];

type GroupBy = "games" | "plateAppearances";

const GAME_WINDOWS = [3, 5, 7, 10, 15, 20, 30];
const PLATE_APPEARANCE_WINDOWS = [25, 50, 75, 100, 150, 200];
const DEFAULT_WINDOW: Record<GroupBy, number> = { games: 10, plateAppearances: 100 };

// Colors for the red card (same gradient as the home page scoreboard).
const CHART = {
  text: "rgba(255, 255, 255, 0.9)",
  mutedText: "rgba(255, 255, 255, 0.72)",
  axis: "rgba(255, 255, 255, 0.45)",
  grid: "rgba(255, 255, 255, 0.14)",
  line: "#ffffff",
  dot: "#f3e3c3",
  average: "#f6d58e",
  crosshair: "rgba(255, 255, 255, 0.6)",
  tooltipBackground: "#1a1416",
};

function formatChartDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatDelta(statKey: string, value: number, average: number) {
  const delta = value - average;
  const formatted = formatRollingValue(statKey, Math.abs(delta));

  // No sign on a difference that rounds to zero.
  if (formatted === "-" || Number.parseFloat(formatted) === 0) {
    return formatted;
  }

  return delta >= 0 ? `+${formatted}` : `-${formatted}`;
}

// wRC+/ERA+ need the season's park/league context; everything else comes
// straight from the game log.
function windowValue(
  window: GameLogEntry[],
  statKey: string,
  role: PlayerRole,
  context: RollingContext | null
): number | null {
  if (context && (statKey === "wRC+" || statKey === "ERA+")) {
    const totals = sumGameLogStats(window);
    return context.kind === "hitter" ? rollingWrcPlus(totals, context) : rollingEraPlus(totals, context);
  }

  return computeRollingValue(window, statKey, role);
}

export default function RollingTrendChart({
  gameLog,
  role,
  rollingContext = null,
}: {
  gameLog: GameLogEntry[];
  role: PlayerRole;
  rollingContext?: RollingContext | null;
}) {
  const isPitcher = role === "Pitcher";
  const rateStats = isPitcher ? PITCHER_RATE_STATS : HITTER_RATE_STATS;
  const columns = rollingContext ? [isPitcher ? "ERA+" : "wRC+", ...rateStats] : rateStats;
  const defaultStat = isPitcher ? "ERA" : "OPS";
  const playingTimeKey = isPitcher ? "IP" : "PA";
  // For a pitcher, plate appearances are the batters faced.
  const plateAppearanceLabel = "PA";
  const plateAppearancesOf = (entry: GameLogEntry) =>
    (isPitcher ? entry.stat.battersFaced : entry.stat.plateAppearances) ?? 0;

  const [groupBy, setGroupBy] = useState<GroupBy>("games");
  const [windowSize, setWindowSize] = useState<number>(DEFAULT_WINDOW.games);
  const [statKey, setStatKey] = useState<string>(defaultStat);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const windowSizes = groupBy === "games" ? GAME_WINDOWS : PLATE_APPEARANCE_WINDOWS;
  const windowUnit = groupBy === "games" ? "G" : ` ${plateAppearanceLabel}`;

  function changeGroupBy(next: GroupBy) {
    setGroupBy(next);
    setWindowSize(DEFAULT_WINDOW[next]);
    setHoveredIndex(null);
  }

  const points = useMemo(() => {
    const results: Array<{
      date: string;
      value: number;
      playingTime: number;
      games: number;
      plateAppearances: number;
    }> = [];

    for (let i = 0; i < gameLog.length; i += 1) {
      let start: number;

      if (groupBy === "games") {
        start = i - windowSize + 1;
      } else {
        // Per-game data can't be split mid-game, so a "last N PA" window is
        // the most recent games that add up to at least N.
        let total = 0;
        start = i;
        while (start >= 0 && total < windowSize) {
          total += plateAppearancesOf(gameLog[start]);
          start -= 1;
        }
        start = total >= windowSize ? start + 1 : -1;
      }

      if (start < 0) {
        continue;
      }

      const window = gameLog.slice(start, i + 1);
      const value = windowValue(window, statKey, role, rollingContext);

      if (value !== null && Number.isFinite(value)) {
        results.push({
          date: gameLog[i].date,
          value,
          playingTime: computeRollingValue(window, playingTimeKey, role) ?? 0,
          games: window.length,
          plateAppearances: window.reduce((sum, entry) => sum + plateAppearancesOf(entry), 0),
        });
      }
    }

    return results;
    // plateAppearancesOf only depends on isPitcher, which follows role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameLog, groupBy, windowSize, statKey, playingTimeKey, role, rollingContext]);

  const seasonAverage = useMemo(
    () => windowValue(gameLog, statKey, role, rollingContext),
    [gameLog, statKey, role, rollingContext]
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

    const gridYs = [0.25, 0.5, 0.75].map((fraction) => paddingTop + plotHeight * fraction);

    return { coords, path, minValue, maxValue, averageY, plotWidth, gridYs };
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

  const selectStyle: React.CSSProperties = {
    padding: "0.5rem 0.9rem",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.5)",
    background: "#fdfaf3",
    color: "#2a0a10",
    fontWeight: 700,
  };

  return (
    <div className="rolling-trend-root" style={{ display: "grid", gap: "1rem" }}>
      <div className="rolling-trend-controls" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={groupBy}
          onChange={(event) => changeGroupBy(event.target.value as GroupBy)}
          aria-label="Group rolling window by"
          style={selectStyle}
        >
          <option value="games">G</option>
          <option value="plateAppearances">PA</option>
        </select>

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {windowSizes.map((size) => {
            const isActive = size === windowSize;

            return (
              <button
                key={size}
                type="button"
                onClick={() => setWindowSize(size)}
                aria-pressed={isActive}
                style={{
                  border: `1px solid ${isActive ? "#ffffff" : "rgba(255,255,255,0.4)"}`,
                  background: isActive ? "#fdfaf3" : "rgba(255,255,255,0.1)",
                  color: isActive ? "#8a1024" : "#ffffff",
                  borderRadius: "999px",
                  padding: "0.45rem 0.85rem",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {size}
                {windowUnit}
              </button>
            );
          })}
        </div>

        <select
          value={statKey}
          onChange={(event) => setStatKey(event.target.value)}
          aria-label="Stat"
          style={selectStyle}
        >
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
      </div>

      {!chart ? (
        <p style={{ margin: 0, color: CHART.mutedText }}>
          Not enough {groupBy === "games" ? "games" : "plate appearances"} this
          season for a rolling {windowSize}
          {windowUnit} trend.
        </p>
      ) : (
        <div className="rolling-trend-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {chart.gridYs.map((y) => (
            <line key={y} x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke={CHART.grid} />
          ))}

          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke={CHART.axis}
          />
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke={CHART.axis}
          />

          <text x={4} y={paddingTop + 4} fill={CHART.text} fontSize="11" fontWeight={600}>
            {formatRollingValue(statKey, chart.maxValue)}
          </text>
          <text x={4} y={height - paddingBottom} fill={CHART.text} fontSize="11" fontWeight={600}>
            {formatRollingValue(statKey, chart.minValue)}
          </text>

          <text x={paddingLeft} y={height - 8} fill={CHART.text} fontSize="11" fontWeight={600}>
            {formatChartDate(points[0].date)}
          </text>
          <text
            x={width - paddingRight}
            y={height - 8}
            fill={CHART.text}
            fontSize="11"
            fontWeight={600}
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
                stroke={CHART.average}
                strokeWidth={1.5}
                strokeDasharray="5,4"
              />
              <text
                x={4}
                y={chart.averageY + 3.5}
                fill={CHART.average}
                fontSize="11"
                fontWeight={700}
              >
                {formatRollingValue(statKey, seasonAverage as number)}
              </text>
            </>
          )}

          <path d={chart.path} fill="none" stroke={CHART.line} strokeWidth={1.6} strokeLinejoin="round" />

          {chart.coords.map((coord, index) => (
            <circle
              key={index}
              cx={coord.x}
              cy={coord.y}
              r={hoveredIndex === index ? 3 : 1.3}
              fill={CHART.dot}
              stroke={CHART.line}
              strokeWidth={hoveredIndex === index ? 1 : 0}
              style={{ transition: "r 0.1s ease" }}
            />
          ))}

          {hovered && (
            <line
              x1={hovered.x}
              y1={paddingTop}
              x2={hovered.x}
              y2={height - paddingBottom}
              stroke={CHART.crosshair}
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
                groupBy === "games"
                  ? `${playingTimeKey}: ${formatRollingValue(playingTimeKey, hovered.playingTime)}`
                  : `${plateAppearanceLabel}: ${hovered.plateAppearances} over ${hovered.games} G`,
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
                    fill={CHART.tooltipBackground}
                    stroke="rgba(255,255,255,0.25)"
                  />
                  {lines.map((line, index) => (
                    <text
                      key={index}
                      x={boxX + boxWidth / 2}
                      y={boxY + 15 + index * 14}
                      fill={index === 0 ? CHART.mutedText : "#ffffff"}
                      fontSize="11"
                      fontWeight={index === 0 ? 500 : 700}
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
