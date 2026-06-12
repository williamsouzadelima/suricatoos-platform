// Advanced charts drawn with @react-pdf/renderer SVG primitives (self-contained, vector).
// NOTE: SVG <Text> needs font set via PROPS (fontFamily/fontSize/fontWeight), not `style`.
import { Circle, G, Line, Path, Rect, Svg, Text } from '@react-pdf/renderer';

import type { Finding } from './engagement';
import { type ActionItem, COLORS, riskCellColor, riskRating, SEVERITY, WINDOW_COLOR, WINDOWS, type ChartDatum } from './theme';

const FONT = 'NotoSans';

// angle in radians, 0 at top, clockwise
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [
    cx + r * Math.sin(a),
    cy - r * Math.cos(a),
];

function annulus(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number): string {
    const [x0, y0] = polar(cx, cy, rO, a0);
    const [x1, y1] = polar(cx, cy, rO, a1);
    const [x2, y2] = polar(cx, cy, rI, a1);
    const [x3, y3] = polar(cx, cy, rI, a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${rO} ${rO} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rI} ${rI} 0 ${large} 0 ${x3} ${y3} Z`;
}

// ── Donut: severity distribution ────────────────────────────────────────────
export function DonutChart({ data, size = 150, centerLabel }: { data: ChartDatum[]; size?: number; centerLabel?: string }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const cx = size / 2;
    const cy = size / 2;
    const rO = size / 2 - 4;
    const rI = rO * 0.6;
    let acc = 0;
    const segs = data
        .filter((d) => d.value > 0)
        .map((d, i) => {
            const a0 = (acc / total) * 2 * Math.PI;
            acc += d.value;
            const a1 = (acc / total) * 2 * Math.PI;
            return { i, color: d.color, a0, a1, full: d.value >= total };
        });
    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {total === 0 && <Circle cx={cx} cy={cy} r={rO} fill={COLORS.line} />}
            {segs.map((seg) =>
                seg.full ? (
                    <G key={seg.i}>
                        <Circle cx={cx} cy={cy} r={rO} fill={seg.color} />
                        <Circle cx={cx} cy={cy} r={rI} fill={COLORS.paper} />
                    </G>
                ) : (
                    <Path key={seg.i} d={annulus(cx, cy, rO, rI, seg.a0, seg.a1)} fill={seg.color} />
                ),
            )}
            <Text x={cx} y={cy - 2} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT} fontSize={22} fontWeight="bold">
                {String(total)}
            </Text>
            <Text x={cx} y={cy + 12} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={7}>
                {centerLabel ?? 'achados'}
            </Text>
        </Svg>
    );
}

// ── Risk gauge: 0-100 semicircular gauge with colored bands + needle ────────
export function RiskGauge({ score, size = 200 }: { score: number; size?: number }) {
    const w = size;
    const h = size * 0.62;
    const cx = w / 2;
    const cy = h - 6;
    const r = w / 2 - 14;
    const thick = 16;
    const angFor = (sc: number) => Math.PI - (sc / 100) * Math.PI; // radians, 0=right, PI=left
    const pt = (rr: number, ang: number): [number, number] => [cx + rr * Math.cos(ang), cy - rr * Math.sin(ang)];
    const bands = [
        { from: 0, to: 20, color: SEVERITY.info.color },
        { from: 20, to: 40, color: SEVERITY.low.color },
        { from: 40, to: 60, color: SEVERITY.medium.color },
        { from: 60, to: 80, color: SEVERITY.high.color },
        { from: 80, to: 100, color: SEVERITY.critical.color },
    ];
    const bandPath = (from: number, to: number) => {
        const [x0, y0] = pt(r, angFor(from));
        const [x1, y1] = pt(r, angFor(to));
        return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
    };
    const rating = riskRating(score);
    const [nx, ny] = pt(r - thick / 2, angFor(score));
    return (
        <Svg width={w} height={h + 26} viewBox={`0 0 ${w} ${h + 26}`}>
            {bands.map((b) => (
                <Path key={b.from} d={bandPath(b.from, b.to)} stroke={b.color} strokeWidth={thick} fill="none" />
            ))}
            <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke={COLORS.ink} strokeWidth={3} />
            <Circle cx={cx} cy={cy} r={5} fill={COLORS.ink} />
            <Text x={cx} y={cy - 26} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT} fontSize={30} fontWeight="bold">
                {String(score)}
            </Text>
            <Text x={cx} y={cy + 16} textAnchor="middle" fill={rating.color} fontFamily={FONT} fontSize={12} fontWeight="bold">
                {`RISCO ${rating.label}`}
            </Text>
            <Text x={14} y={h + 18} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={7}>0</Text>
            <Text x={w - 14} y={h + 18} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={7}>100</Text>
        </Svg>
    );
}

// ── Horizontal bar chart (findings by category) ─────────────────────────────
export function HBarChart({ data, width = 250, rowH = 22 }: { data: ChartDatum[]; width?: number; rowH?: number }) {
    const max = Math.max(1, ...data.map((d) => d.value));
    const labelW = 96;
    const trackW = width - labelW - 26;
    const h = data.length * rowH + 6;
    return (
        <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
            {data.map((d, i) => {
                const y = i * rowH + 4;
                const bw = Math.max(2, (d.value / max) * trackW);
                return (
                    <G key={d.label}>
                        <Text x={labelW - 6} y={y + rowH / 2 + 1} textAnchor="end" fill={COLORS.slate} fontFamily={FONT} fontSize={8}>
                            {d.label.length > 18 ? `${d.label.slice(0, 17)}…` : d.label}
                        </Text>
                        <Rect x={labelW} y={y + 3} width={trackW} height={rowH - 10} fill={COLORS.panel} rx={2} />
                        <Rect x={labelW} y={y + 3} width={bw} height={rowH - 10} fill={d.color} rx={2} />
                        <Text x={labelW + bw + 5} y={y + rowH / 2 + 1} fill={COLORS.muted} fontFamily={FONT} fontSize={8} fontWeight="bold">
                            {String(d.value)}
                        </Text>
                    </G>
                );
            })}
        </Svg>
    );
}

// ── Risk matrix 5×5 (likelihood × impact) with finding markers ──────────────
export function RiskMatrix({ findings, size = 250 }: { findings: Finding[]; size?: number }) {
    const pad = 26;
    const grid = size - pad - 6;
    const cell = grid / 5;
    const x0 = pad;
    const y0 = 4;
    const cellMap = new Map<string, Finding[]>();
    findings.forEach((f) => {
        const k = `${f.likelihood}-${f.impact}`;
        cellMap.set(k, [...(cellMap.get(k) ?? []), f]);
    });
    const cells = [];
    for (let li = 1; li <= 5; li++) {
        for (let im = 1; im <= 5; im++) {
            const cxr = x0 + (im - 1) * cell;
            const cyr = y0 + (5 - li) * cell;
            cells.push(
                <Rect key={`c-${li}-${im}`} x={cxr} y={cyr} width={cell - 1.5} height={cell - 1.5} fill={riskCellColor(li, im)} opacity={0.9} rx={2} />,
            );
        }
    }
    const markers = [...cellMap.entries()].map(([k, fs]) => {
        const [li, im] = k.split('-').map(Number);
        const cx = x0 + (im - 1) * cell + cell / 2;
        const cy = y0 + (5 - li) * cell + cell / 2;
        const label = fs.length === 1 ? String(Number(fs[0].id.replace('F-', ''))) : `${fs.length}`;
        return (
            <G key={`m-${k}`}>
                <Circle cx={cx} cy={cy} r={cell * 0.3} fill={COLORS.paper} stroke={COLORS.ink} strokeWidth={1} />
                <Text x={cx} y={cy + 3} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT} fontSize={8} fontWeight="bold">
                    {label}
                </Text>
            </G>
        );
    });
    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {cells}
            {markers}
            <Text x={x0 + grid / 2} y={size - 4} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={8} fontWeight="bold">
                Impacto
            </Text>
            <Text x={10} y={y0 + grid / 2} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={8} fontWeight="bold" transform={`rotate(-90 10 ${y0 + grid / 2})`}>
                Probabilidade
            </Text>
        </Svg>
    );
}

// ── Attack chain strip (storytelling summary) ───────────────────────────────
export function AttackChainStrip({ nodes, width = 507 }: { nodes: { n: number; label: string }[]; width?: number }) {
    const seg = width / nodes.length;
    const h = 54;
    const cy = 17;
    const r = 11;
    return (
        <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
            <Line x1={seg / 2} y1={cy} x2={width - seg / 2} y2={cy} stroke={COLORS.brand} strokeWidth={2} />
            {nodes.map((nd, i) => {
                const cx = seg / 2 + i * seg;
                return (
                    <G key={nd.n}>
                        {i < nodes.length - 1 && (
                            <Path d={`M ${cx + seg - 7} ${cy - 3} L ${cx + seg - 2} ${cy} L ${cx + seg - 7} ${cy + 3} Z`} fill={COLORS.brand} />
                        )}
                        <Circle cx={cx} cy={cy} r={r} fill={COLORS.brand} />
                        <Text x={cx} y={cy + 3} textAnchor="middle" fill={COLORS.paper} fontFamily={FONT} fontSize={9} fontWeight="bold">
                            {String(nd.n)}
                        </Text>
                        <Text x={cx} y={h - 12} textAnchor="middle" fill={COLORS.ink} fontFamily={FONT} fontSize={7.5} fontWeight="bold">
                            {nd.label}
                        </Text>
                    </G>
                );
            })}
        </Svg>
    );
}

// ── Quick-wins quadrant (impact × effort) ───────────────────────────────────
export function QuickWinsQuadrant({ items, size = 250 }: { items: ActionItem[]; size?: number }) {
    const pad = 30;
    const plot = size - pad - 10;
    const x0 = pad;
    const y0 = 6;
    const xMid = x0 + plot / 2;
    const yMid = y0 + plot / 2;
    const xFor = (e: number) => x0 + ((e - 1) / 2) * plot; // effort 1..3 -> left..right
    const yFor = (im: number) => y0 + (1 - (im - 1) / 4) * plot; // impact 1..5 -> bottom..top
    // cluster offsets for findings sharing a cell
    const groups = new Map<string, ActionItem[]>();
    items.forEach((a) => {
        const k = `${a.effort}-${a.f.impact}`;
        groups.set(k, [...(groups.get(k) ?? []), a]);
    });
    const dots: { x: number; y: number; color: string; label: string }[] = [];
    groups.forEach((arr) => {
        arr.forEach((a, idx) => {
            const off = (idx - (arr.length - 1) / 2) * 14;
            dots.push({ x: xFor(a.effort) + off, y: yFor(a.f.impact), color: SEVERITY[a.f.severity].color, label: String(Number(a.f.id.replace('F-', ''))) });
        });
    });
    return (
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Rect x={x0} y={y0} width={plot / 2} height={plot / 2} fill="#ECFDF5" rx={3} />
            <Rect x={xMid} y={y0} width={plot / 2} height={plot / 2} fill="#F8FAFC" rx={3} />
            <Rect x={x0} y={yMid} width={plot / 2} height={plot / 2} fill="#F8FAFC" rx={3} />
            <Rect x={xMid} y={yMid} width={plot / 2} height={plot / 2} fill="#F8FAFC" rx={3} />
            <Line x1={x0} y1={yMid} x2={x0 + plot} y2={yMid} stroke={COLORS.line} strokeWidth={1} />
            <Line x1={xMid} y1={y0} x2={xMid} y2={y0 + plot} stroke={COLORS.line} strokeWidth={1} />
            <Text x={x0 + 6} y={y0 + 13} fill="#059669" fontFamily={FONT} fontSize={8} fontWeight="bold">QUICK WINS</Text>
            <Text x={xMid + 6} y={y0 + 13} fill={COLORS.muted} fontFamily={FONT} fontSize={7}>Projetos</Text>
            <Text x={x0 + 6} y={yMid + 13} fill={COLORS.muted} fontFamily={FONT} fontSize={7}>Incrementais</Text>
            <Text x={xMid + 6} y={yMid + 13} fill={COLORS.muted} fontFamily={FONT} fontSize={7}>Baixa prior.</Text>
            {dots.map((d, i) => (
                <G key={i}>
                    <Circle cx={d.x} cy={d.y} r={7} fill={d.color} stroke={COLORS.paper} strokeWidth={1} />
                    <Text x={d.x} y={d.y + 2.5} textAnchor="middle" fill={COLORS.paper} fontFamily={FONT} fontSize={7} fontWeight="bold">{d.label}</Text>
                </G>
            ))}
            <Text x={x0 + plot / 2} y={size - 2} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={8} fontWeight="bold">Esforço (baixo a alto)</Text>
            <Text x={10} y={y0 + plot / 2} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={8} fontWeight="bold" transform={`rotate(-90 10 ${y0 + plot / 2})`}>Impacto</Text>
        </Svg>
    );
}

// ── Remediation roadmap (three sequential PTES-style windows) ────────────────
export function RemediationRoadmap({ items, width = 507 }: { items: ActionItem[]; width?: number }) {
    const gap = 10;
    const blockW = (width - gap * (WINDOWS.length - 1)) / WINDOWS.length;
    const h = 56;
    return (
        <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
            {WINDOWS.map((w, i) => {
                const its = items.filter((a) => a.window === w);
                const maxDays = Math.max(0, ...its.map((a) => a.etaDays));
                const x = i * (blockW + gap);
                return (
                    <G key={w}>
                        <Rect x={x} y={6} width={blockW} height={30} fill={WINDOW_COLOR[w]} rx={5} />
                        <Text x={x + blockW / 2} y={20} textAnchor="middle" fill={COLORS.paper} fontFamily={FONT} fontSize={9} fontWeight="bold">{w}</Text>
                        <Text x={x + blockW / 2} y={30} textAnchor="middle" fill={COLORS.paper} fontFamily={FONT} fontSize={6.5}>{`${its.length} achados`}</Text>
                        <Text x={x + blockW / 2} y={48} textAnchor="middle" fill={COLORS.muted} fontFamily={FONT} fontSize={7}>{`prazo até ${maxDays} dias`}</Text>
                        {i < WINDOWS.length - 1 && (
                            <Path d={`M ${x + blockW + 1} ${17} L ${x + blockW + gap - 1} ${21} L ${x + blockW + 1} ${25} Z`} fill={COLORS.muted} />
                        )}
                    </G>
                );
            })}
        </Svg>
    );
}

// ── Time-to-fix per finding (what takes more / less time) ────────────────────
export function EffortTimeBars({ items, width = 250, rowH = 16 }: { items: ActionItem[]; width?: number; rowH?: number }) {
    const sorted = [...items].sort((a, b) => WINDOWS.indexOf(a.window) - WINDOWS.indexOf(b.window) || b.etaDays - a.etaDays);
    const max = Math.max(1, ...items.map((a) => a.etaDays));
    const labelW = 34;
    const trackW = width - labelW - 32;
    const h = sorted.length * rowH + 4;
    return (
        <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
            {sorted.map((a, i) => {
                const y = i * rowH + 2;
                const bw = Math.max(3, (a.etaDays / max) * trackW);
                return (
                    <G key={a.f.id}>
                        <Text x={labelW - 4} y={y + rowH / 2 + 1} textAnchor="end" fill={COLORS.slate} fontFamily={FONT} fontSize={7}>{a.f.id}</Text>
                        <Rect x={labelW} y={y + 2} width={bw} height={rowH - 6} fill={WINDOW_COLOR[a.window]} rx={2} />
                        <Text x={labelW + bw + 4} y={y + rowH / 2 + 1} fill={COLORS.muted} fontFamily={FONT} fontSize={7}>{`${a.etaDays}d`}</Text>
                    </G>
                );
            })}
        </Svg>
    );
}

// ── PTES phase coverage stepper (7 phases) ──────────────────────────────────
export function PhaseStepper({ phases, width = 520 }: { phases: { n: number; name: string }[]; width?: number }) {
    const n = phases.length;
    const gap = 8;
    const segW = (width - gap * (n - 1)) / n;
    const h = 30;
    return (
        <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
            {phases.map((p, i) => {
                const x = i * (segW + gap);
                return (
                    <G key={p.n}>
                        <Rect x={x} y={2} width={segW} height={h - 4} fill={COLORS.brand} rx={4} />
                        <Circle cx={x + 11} cy={h / 2} r={7} fill={COLORS.paper} />
                        <Text x={x + 11} y={h / 2 + 3} textAnchor="middle" fill={COLORS.brand} fontFamily={FONT} fontSize={8} fontWeight="bold">
                            {String(p.n)}
                        </Text>
                        <Text x={x + 22} y={h / 2 + 3} fill={COLORS.paper} fontFamily={FONT} fontSize={6.5} fontWeight="bold">
                            {p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name}
                        </Text>
                    </G>
                );
            })}
        </Svg>
    );
}
