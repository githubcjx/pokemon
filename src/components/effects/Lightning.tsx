import {random} from 'remotion';
import {useFrame} from '../../time';

type Pt = [number, number];

/** 中点位移生成一条锯齿闪电（确定性） */
const bolt = (seed: string, from: Pt, to: Pt, depth: number, spread: number): Pt[] => {
	let pts: Pt[] = [from, to];
	for (let d = 0; d < depth; d++) {
		const next: Pt[] = [pts[0]];
		for (let i = 1; i < pts.length; i++) {
			const [x0, y0] = pts[i - 1];
			const [x1, y1] = pts[i];
			const len = Math.hypot(x1 - x0, y1 - y0);
			const off = (random(`${seed}-${d}-${i}`) - 0.5) * spread * len;
			// 沿垂直方向偏移中点
			next.push([(x0 + x1) / 2 + (-(y1 - y0) / len) * off, (y0 + y1) / 2 + ((x1 - x0) / len) * off], pts[i]);
		}
		pts = next;
	}
	return pts;
};

const toPath = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** 闪电劈下：at 帧出现，约 7 帧内闪烁两下后消失。返回 null 时不渲染 */
export const Lightning: React.FC<{at: number; from: Pt; to: Pt; seed: string; rgb?: string; width?: number}> = ({
	at,
	from,
	to,
	seed,
	rgb = '215,230,255',
	width = 3,
}) => {
	const frame = useFrame();
	const t = frame - at;
	if (t < 0 || t > 8) return null;
	// 两次闪烁：亮 → 暗 → 再亮 → 熄灭
	const o = t < 2 ? 1 : t < 3.5 ? 0.25 : t < 5.5 ? 0.85 : Math.max(0, 1 - (t - 5.5) / 2.5);
	const main = bolt(seed, from, to, 6, 0.55);
	// 两条分叉：从主干中段向下岔出
	const branches = [0.35, 0.6].map((k, i) => {
		const start = main[Math.floor(main.length * k)];
		const dx = (random(`${seed}-b${i}`) - 0.5) * 260;
		return bolt(`${seed}-br${i}`, start, [start[0] + dx, start[1] + 180 + random(`${seed}-bl${i}`) * 160], 4, 0.6);
	});
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: o, overflow: 'visible'}}>
			<g style={{filter: `drop-shadow(0 0 6px rgba(${rgb},0.9)) drop-shadow(0 0 22px rgba(${rgb},0.7))`}} fill="none" strokeLinecap="round" strokeLinejoin="round">
				<path d={toPath(main)} stroke={`rgba(${rgb},0.9)`} strokeWidth={width * 2.2} />
				<path d={toPath(main)} stroke="#fff" strokeWidth={width} />
				{branches.map((b, i) => (
					<path key={i} d={toPath(b)} stroke={`rgba(${rgb},0.8)`} strokeWidth={width * 0.7} />
				))}
			</g>
		</svg>
	);
};
