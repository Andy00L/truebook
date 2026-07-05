import type { ReactElement } from "react";

/**
 * The TrueBook empty-state motif: a pixel mascot dribbling a scoreboard-green
 * ball, adopted from the Claude Design session (design-export, Mascot
 * Dribble). The mascot pigments are the illustration family's own; the ball
 * and ground read from the token sheet.
 */

const PIXEL_SIZE = 6;

const MASCOT_ROWS = [
  "..b..b..b.....",
  ".bbbbbbbbbbb..",
  "sbbbbbbbbbbbb.",
  "sbbebbbbbebbb.",
  "sbbebbbbbebbb.",
  "sbbbbbbbbbbbb.",
  "ssbbbbbbbbbbb.",
  ".sbbbbbbbbbbb.",
] as const;
const LEG_BACK_ROW = ["..s.bb.b......"] as const;
const FOOT_DOWN_ROW = ["..........bb.."] as const;
const FOOT_KICK_ROW = ["............bb"] as const;
const BALL_ROWS = [".xx.", "xxxx", "xxxx", ".xx."] as const;

/** Illustration pigments (not UI roles); sourceRef: design-export mascot. */
const MASCOT_PIGMENTS: Record<string, string> = {
  b: "#d08762",
  s: "#b96f52",
  e: "#0a0a0a",
};

function buildPixelRects(
  rows: readonly string[],
  pigments: Record<string, string>,
): ReactElement[] {
  const rects: ReactElement[] = [];
  rows.forEach((row, rowIndex) => {
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const pixel = row[columnIndex];
      if (pixel === ".") {
        continue;
      }
      rects.push(
        <rect
          key={`${columnIndex}-${rowIndex}`}
          x={columnIndex * PIXEL_SIZE}
          y={rowIndex * PIXEL_SIZE}
          width={PIXEL_SIZE}
          height={PIXEL_SIZE}
          fill={pigments[pixel]}
        />,
      );
    }
  });
  return rects;
}

type MascotDribbleProps = {
  scale?: number;
};

export function MascotDribble({ scale = 1 }: MascotDribbleProps) {
  const spriteWidth = 14 * PIXEL_SIZE + 6 + 4 * PIXEL_SIZE + 4;
  const spriteHeight = 9 * PIXEL_SIZE + 26;
  const dribbleDuration = "0.9s";

  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: spriteWidth * scale,
        height: spriteHeight * scale,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: spriteWidth,
          height: spriteHeight,
        }}
      >
        <svg
          width={14 * PIXEL_SIZE}
          height={9 * PIXEL_SIZE}
          viewBox={`0 0 ${14 * PIXEL_SIZE} ${9 * PIXEL_SIZE}`}
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            display: "block",
            shapeRendering: "crispEdges",
            animation: `mascot-bob ${dribbleDuration} var(--ease-standard) infinite`,
          }}
        >
          {buildPixelRects(MASCOT_ROWS, MASCOT_PIGMENTS)}
          <g transform={`translate(0, ${8 * PIXEL_SIZE})`}>
            {buildPixelRects(LEG_BACK_ROW, MASCOT_PIGMENTS)}
          </g>
          <g
            transform={`translate(0, ${8 * PIXEL_SIZE})`}
            style={{
              animation: `mascot-kick-down ${dribbleDuration} steps(1, end) infinite`,
            }}
          >
            {buildPixelRects(FOOT_DOWN_ROW, MASCOT_PIGMENTS)}
          </g>
          <g
            transform={`translate(0, ${7 * PIXEL_SIZE})`}
            style={{
              animation: `mascot-kick-up ${dribbleDuration} steps(1, end) infinite`,
            }}
          >
            {buildPixelRects(FOOT_KICK_ROW, MASCOT_PIGMENTS)}
          </g>
        </svg>
        <svg
          width={4 * PIXEL_SIZE}
          height={4 * PIXEL_SIZE}
          viewBox={`0 0 ${4 * PIXEL_SIZE} ${4 * PIXEL_SIZE}`}
          style={{
            position: "absolute",
            left: 68,
            bottom: 40,
            display: "block",
            shapeRendering: "crispEdges",
            transformOrigin: "center bottom",
            animation: `mascot-ball ${dribbleDuration} infinite`,
          }}
        >
          {buildPixelRects(BALL_ROWS, { x: "var(--color-accent)" })}
          <rect
            x={0}
            y={2 * PIXEL_SIZE}
            width={PIXEL_SIZE}
            height={PIXEL_SIZE}
            fill="rgba(0,0,0,0.28)"
          />
          <rect
            x={PIXEL_SIZE}
            y={3 * PIXEL_SIZE}
            width={2 * PIXEL_SIZE}
            height={PIXEL_SIZE}
            fill="rgba(0,0,0,0.28)"
          />
          <rect
            x={2 * PIXEL_SIZE}
            y={0}
            width={PIXEL_SIZE}
            height={PIXEL_SIZE}
            fill="rgba(255,255,255,0.30)"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -2,
            height: 2,
            borderRadius: "var(--radius-sm)",
            background: "var(--color-border)",
          }}
        />
      </div>
    </div>
  );
}
