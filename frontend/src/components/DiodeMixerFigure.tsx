/**
 * Teaching figures for the passive diode-mixer lesson.
 *
 * The ring is a double-balanced quad: LO across one diagonal, RF across the
 * other. Diodes all point the same way around the loop (a ring, not a
 * bridge rectifier). One LO half-cycle forward-biases one pair; the next
 * half-cycle biases the other pair and reverses RF-to-IF polarity.
 */

const LO = 'var(--cat-lo)';
const RF = 'var(--accent)';
const IFC = 'var(--ok)';
const FG = 'var(--fg)';
const DIM = 'var(--fg-dim)';
const MUTED = 'var(--panel-border)';

const SW = 1.7;

function coilPath(
  x: number,
  yStart: number,
  yEnd: number,
  turns: number,
  bulgeRight: boolean,
): string {
  const span = yEnd - yStart;
  const r = span / (2 * turns);
  // Going downward, sweep 1 bulges to +x and sweep 0 bulges to −x.
  const sweep = bulgeRight ? 1 : 0;
  let d = `M ${x} ${yStart}`;
  for (let i = 0; i < turns; i++) {
    const y2 = yStart + (i + 1) * 2 * r;
    d += ` A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${x} ${y2.toFixed(2)}`;
  }
  return d;
}

function Coil({
  x,
  yStart,
  yEnd,
  turns,
  bulgeRight,
}: {
  x: number;
  yStart: number;
  yEnd: number;
  turns: number;
  bulgeRight: boolean;
}) {
  return (
    <path
      d={coilPath(x, yStart, yEnd, turns, bulgeRight)}
      fill="none"
      stroke={FG}
      strokeWidth={SW}
      strokeLinecap="round"
    />
  );
}

function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={DIM} strokeWidth={1.5} strokeLinecap="round">
      <line x1={x} y1={y} x2={x} y2={y + 8} />
      <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} />
      <line x1={x - 5.5} y1={y + 12} x2={x + 5.5} y2={y + 12} />
      <line x1={x - 2.5} y1={y + 16} x2={x + 2.5} y2={y + 16} />
    </g>
  );
}

function Source({
  cx,
  cy,
  label,
  color,
}: {
  cx: number;
  cy: number;
  label: string;
  color: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={15} fill="var(--panel)" stroke={color} strokeWidth={SW} />
      <path
        d={`M ${cx - 8} ${cy} q 4 -8 8 0 t 8 0`}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy - 24}
        textAnchor="middle"
        fill={color}
        fontSize={13}
        fontWeight={650}
      >
        {label}
      </text>
    </g>
  );
}

function Diode({ x, y, degrees }: { x: number; y: number; degrees: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${degrees})`}>
      <polygon points="-11,-6.5 7,0 -11,6.5" fill={RF} />
      <line
        x1={9}
        y1={-7.5}
        x2={9}
        y2={7.5}
        stroke={FG}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Wire along an edge, with a gap at the midpoint for a diode symbol. */
function DiodeEdge({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const gap = 16;
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={mx - ux * gap}
        y2={my - uy * gap}
        stroke={FG}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <line
        x1={mx + ux * gap}
        y1={my + uy * gap}
        x2={x2}
        y2={y2}
        stroke={FG}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <Diode x={mx} y={my} degrees={(ang * 180) / Math.PI} />
    </g>
  );
}

function Dot({ x, y, color = FG }: { x: number; y: number; color?: string }) {
  return <circle cx={x} cy={y} r={3} fill={color} />;
}

/** LO wire arching over the RF lead. Peak sits in a gap in that lead. */
function crossingHop(x: number, y: number): string {
  return `M ${x} ${y - 16} Q ${x + 28} ${y}, ${x} ${y + 16}`;
}

function DiodeRingSchematic() {
  // Diamond nodes. LO on E–W, RF on N–S: the two diagonals.
  const N = { x: 278, y: 96 };
  const E = { x: 356, y: 174 };
  const S = { x: 278, y: 252 };
  const W = { x: 200, y: 174 };

  const loSecX = 112;
  const loPriX = 80;
  const rfSecX = 524;
  const rfPriX = 560;
  const midY = 174;
  const topY = 96;
  const botY = 252;

  return (
    <svg
      viewBox="0 0 680 348"
      role="img"
      aria-label="Double-balanced diode ring. The LO drives the horizontal diagonal through a balun whose center tap is ground. The RF drives the vertical diagonal through a balun whose center tap is the IF."
    >
      <title>Double-balanced diode ring</title>

      {/* LO bypass over the top to the east node. The arch clears the RF lead. */}
      <path
        d={`M ${loSecX} ${topY} L ${loSecX} 40 L 430 40 L 430 ${topY - 16} ${crossingHop(430, topY)} L 430 ${midY} L ${E.x} ${E.y}`}
        fill="none"
        stroke={LO}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* LO to the west node, around the lower-left. */}
      <path
        d={`M ${loSecX} ${botY} L 176 ${botY} L 176 ${midY} L ${W.x} ${W.y}`}
        fill="none"
        stroke={LO}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* LO center tap to ground, in the gap between the windings. */}
      <path
        d={`M ${loSecX} ${midY} L 96 ${midY} L 96 308`}
        fill="none"
        stroke={LO}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Ground x={96} y={308} />

      {/* RF top and bottom, with a gap where the LO wire hops. */}
      {/* Gap only under the LO arch (the arch peaks about 14px to the right of x=430). */}
      <path
        d={`M ${N.x} ${N.y} L 436 ${topY} M 458 ${topY} L ${rfSecX} ${topY}`}
        fill="none"
        stroke={RF}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <line
        x1={S.x}
        y1={S.y}
        x2={rfSecX}
        y2={botY}
        stroke={RF}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      {/* RF center tap is the IF port. */}
      <path
        d={`M ${rfSecX} ${midY} L 542 ${midY} L 542 308 L 640 308`}
        fill="none"
        stroke={IFC}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Dot x={640} y={308} color={IFC} />

      {/* Balun windings. Secondary is center-tapped (gap at midY). */}
      <Coil x={loPriX} yStart={122} yEnd={226} turns={4} bulgeRight={false} />
      <Coil x={loSecX} yStart={topY} yEnd={156} turns={3} bulgeRight />
      <Coil x={loSecX} yStart={192} yEnd={botY} turns={3} bulgeRight />
      <line x1={loSecX} y1={156} x2={loSecX} y2={192} stroke={FG} strokeWidth={SW} />
      <Dot x={loSecX} y={midY} color={LO} />

      <Coil x={rfSecX} yStart={topY} yEnd={156} turns={3} bulgeRight={false} />
      <Coil x={rfSecX} yStart={192} yEnd={botY} turns={3} bulgeRight={false} />
      <line x1={rfSecX} y1={156} x2={rfSecX} y2={192} stroke={FG} strokeWidth={SW} />
      <Coil x={rfPriX} yStart={122} yEnd={226} turns={4} bulgeRight />
      <Dot x={rfSecX} y={midY} color={IFC} />

      {/* Sources across the primaries. */}
      <path
        d={`M 46 148 L ${loPriX} 122 M 46 200 L ${loPriX} 226`}
        fill="none"
        stroke={LO}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <path
        d={`M 624 148 L ${rfPriX} 122 M 624 200 L ${rfPriX} 226`}
        fill="none"
        stroke={RF}
        strokeWidth={SW}
        strokeLinecap="round"
      />
      <Source cx={32} cy={midY} label="LO" color={LO} />
      <Source cx={640} cy={midY} label="RF" color={RF} />

      {/* Clockwise ring: N→E→S→W. */}
      <DiodeEdge x1={N.x} y1={N.y} x2={E.x} y2={E.y} />
      <DiodeEdge x1={E.x} y1={E.y} x2={S.x} y2={S.y} />
      <DiodeEdge x1={S.x} y1={S.y} x2={W.x} y2={W.y} />
      <DiodeEdge x1={W.x} y1={W.y} x2={N.x} y2={N.y} />

      <Dot x={N.x} y={N.y} />
      <Dot x={E.x} y={E.y} />
      <Dot x={S.x} y={S.y} />
      <Dot x={W.x} y={W.y} />

      <text x={114} y={320} fill={DIM} fontSize={11}>
        ground
      </text>
      <text x={612} y={300} textAnchor="end" fill={IFC} fontSize={13} fontWeight={650}>
        IF
      </text>

      <g fontSize={12} fill={DIM}>
        <line x1={200} y1={332} x2={224} y2={332} stroke={LO} strokeWidth={2.4} />
        <text x={230} y={336}>
          LO
        </text>
        <line x1={268} y1={332} x2={292} y2={332} stroke={RF} strokeWidth={2.4} />
        <text x={298} y={336}>
          RF
        </text>
        <line x1={332} y1={332} x2={356} y2={332} stroke={IFC} strokeWidth={2.4} />
        <text x={362} y={336}>
          IF
        </text>
      </g>
    </svg>
  );
}

const RF_CYCLES = 10;
const LO_CYCLES = 8;
const PAD_L = 108;
const PLOT_W = 548;

function tracePath(
  y0: number,
  amp: number,
  fn: (t: number) => number,
  samples = 480,
): string {
  let d = '';
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = PAD_L + t * PLOT_W;
    const y = y0 - amp * fn(t);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function rfTone(t: number): number {
  return Math.sin(2 * Math.PI * RF_CYCLES * t);
}

function loSwitch(t: number): number {
  return (t * LO_CYCLES) % 1 < 0.5 ? 1 : -1;
}

/** Difference term of the fundamental: (2/π) cos((ω_LO − ω_RF) t). */
function ifTerm(t: number): number {
  return (2 / Math.PI) * Math.cos(2 * Math.PI * (LO_CYCLES - RF_CYCLES) * t);
}

function squarePath(y0: number, amp: number): string {
  const steps = LO_CYCLES * 2;
  let d = '';
  for (let i = 0; i < steps; i++) {
    const y = y0 - (i % 2 === 0 ? amp : -amp);
    const x0 = PAD_L + (i / steps) * PLOT_W;
    const x1 = PAD_L + ((i + 1) / steps) * PLOT_W;
    d += `${i === 0 ? 'M' : 'L'}${x0.toFixed(1)} ${y.toFixed(1)} L${x1.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function SwitchingWaveforms() {
  const yRf = 52;
  const yLo = 128;
  const yProd = 214;
  const amp = 22;

  return (
    <svg
      viewBox="0 0 680 268"
      role="img"
      aria-label="The RF tone multiplied by a plus-or-minus-one LO square wave. A dashed curve marks the difference-frequency term, amplitude 2 over pi."
    >
      <title>Switching multiply of a diode ring</title>

      {(
        [
          [yRf, 'v_RF'],
          [yLo, 's(t)'],
          [yProd, 'v_RF·s(t)'],
        ] as const
      ).map(([y, label]) => (
        <g key={label}>
          <line
            x1={PAD_L}
            y1={y}
            x2={PAD_L + PLOT_W}
            y2={y}
            stroke={MUTED}
            strokeWidth={1}
          />
          <text x={8} y={y} dominantBaseline="middle" fill={DIM} fontSize={13}>
            {label}
          </text>
        </g>
      ))}

      <path
        d={tracePath(yRf, amp, rfTone)}
        fill="none"
        stroke={RF}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d={squarePath(yLo, 16)}
        fill="none"
        stroke={LO}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <text x={74} y={yLo - 12} fill={DIM} fontSize={11}>
        +1
      </text>
      <text x={74} y={yLo + 16} fill={DIM} fontSize={11}>
        −1
      </text>
      <path
        d={tracePath(yProd, amp, (t) => rfTone(t) * loSwitch(t))}
        fill="none"
        stroke={FG}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d={tracePath(yProd, amp, ifTerm)}
        fill="none"
        stroke={IFC}
        strokeWidth={1.8}
        strokeDasharray="5 3"
        strokeLinejoin="round"
      />

      {/* One LO period, marked on the last cycle so it clears the axis labels. */}
      <path
        d={`M ${PAD_L + (PLOT_W * 7) / LO_CYCLES} ${yLo - 28} h ${PLOT_W / LO_CYCLES}`}
        fill="none"
        stroke={DIM}
        strokeWidth={1}
      />
      <path
        d={`M ${PAD_L + (PLOT_W * 7) / LO_CYCLES} ${yLo - 32} v 8 M ${PAD_L + PLOT_W} ${yLo - 32} v 8`}
        fill="none"
        stroke={DIM}
        strokeWidth={1}
      />
      <text
        x={PAD_L + (PLOT_W * 7.5) / LO_CYCLES}
        y={yLo - 36}
        textAnchor="middle"
        fill={DIM}
        fontSize={11}
      >
        1/f_LO
      </text>

      <g fontSize={12} fill={DIM}>
        <line x1={PAD_L} y1={256} x2={PAD_L + 22} y2={256} stroke={FG} strokeWidth={1.8} />
        <text x={PAD_L + 28} y={260}>
          product
        </text>
        <line
          x1={PAD_L + 92}
          y1={256}
          x2={PAD_L + 114}
          y2={256}
          stroke={IFC}
          strokeWidth={1.8}
          strokeDasharray="5 3"
        />
        <text x={PAD_L + 120} y={260}>
          IF term, amplitude 2/π
        </text>
      </g>
    </svg>
  );
}

export function PassiveDiodeMixerFigures() {
  return (
    <>
      <figure className="diagram">
        <div className="diagram-scroll">
          <DiodeRingSchematic />
        </div>
        <figcaption>
          Double-balanced diode ring. The LO balun drives one diagonal of the
          quad, and its center tap is ground. The RF balun drives the other
          diagonal, and its center tap is the IF. Two diodes conduct in each
          LO half-cycle; the next half-cycle uses the other pair and flips
          the sign of the RF path. That sign flip is s(t).
        </figcaption>
      </figure>
      <figure className="diagram">
        <div className="diagram-scroll">
          <SwitchingWaveforms />
        </div>
        <figcaption>
          The same multiply, drawn with ten RF cycles and eight LO cycles so
          the polarity flips and the difference beat fit on one line. The
          dashed curve is only the |f_RF − f_LO| term, amplitude 2/π, which
          an IF filter keeps. In the lab the LO is 2.00 GHz, so many more LO
          cycles fall inside one IF cycle than in this sketch.
        </figcaption>
      </figure>
    </>
  );
}
