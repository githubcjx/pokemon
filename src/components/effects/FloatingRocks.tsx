import {interpolate, random} from 'remotion';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// 悬浮岛：上方是较平的岩面，下方是参差的岩锥
const islandPath = (seed: string, w: number, h: number) => {
	const pts: [number, number][] = [];
	const topN = 7;
	for (let i = 0; i <= topN; i++) {
		const x = -w / 2 + (w * i) / topN;
		pts.push([x, -h * 0.18 + (random(`${seed}t${i}`) - 0.5) * h * 0.12]);
	}
	const botN = 9;
	for (let i = botN; i >= 1; i--) {
		const u = i / botN;
		const x = -w / 2 + w * u;
		// 越靠中间越深，形成倒锥
		const depth = Math.sin(u * Math.PI) ** 1.4 * h * (0.7 + random(`${seed}b${i}`) * 0.5);
		pts.push([x + (random(`${seed}x${i}`) - 0.5) * w * 0.06, depth]);
	}
	return `M ${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')} Z`;
};

type Rock = {x: number; y: number; w: number; rot: number; spin: number; rise: number; depth: number; path: string};

const ROCKS: Rock[] = [
	// depth: 0 远景 → 1 近景
	{x: 180, y: 380, w: 170, rot: 172, depth: 0.1},
	{x: 1720, y: 330, w: 200, rot: 8, depth: 0.15},
	{x: 420, y: 820, w: 130, rot: -24, depth: 0.05},
	{x: 1500, y: 780, w: 150, rot: 196, depth: 0.1},
	{x: 1180, y: 250, w: 110, rot: 140, depth: 0},
	{x: 760, y: 230, w: 90, rot: -160, depth: 0},
	{x: 90, y: 900, w: 420, rot: 18, depth: 0.9},
	{x: 1860, y: 180, w: 380, rot: 186, depth: 0.85},
	{x: 1820, y: 960, w: 300, rot: -12, depth: 0.7},
].map((r, i) => ({
	...r,
	spin: (random(`rk-s${i}`) - 0.5) * 0.12,
	rise: 0.15 + r.depth * 0.5 + random(`rk-r${i}`) * 0.2,
	path: islandPath(`rk${i}`, r.w, r.w * 0.55),
}));

/** 毁坏的世界里的悬浮碎岩：多层景深、角度各异、缓慢上浮与自转 */
export const FloatingRocks: React.FC<{from: number; opacity?: number; depthRange?: [number, number]}> = ({
	from,
	opacity = 1,
	depthRange = [0, 1],
}) => {
	const frame = useFrame();
	const fade = interpolate(frame, [from, from + 50], [0, 1], clamp);
	if (fade <= 0) return null;
	const t = frame - from;

	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: fade * opacity}}>
			<defs>
				<linearGradient id="rockFill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#3a2618" />
					<stop offset="0.25" stopColor="#1c120c" />
					<stop offset="1" stopColor="#0a0608" />
				</linearGradient>
				{[0, 1, 2].map((b) => (
					<filter key={b} id={`rockBlur${b}`} x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation={b === 0 ? 0.8 : b === 1 ? 0 : 3} />
					</filter>
				))}
			</defs>
			{ROCKS.map((r, i) => {
				if (r.depth < depthRange[0] || r.depth > depthRange[1]) return null;
				const y = r.y - t * r.rise;
				const rot = r.rot + t * r.spin;
				// 远景偏淡偏虚，近景更暗且带景深模糊
				const blur = r.depth > 0.6 ? 2 : r.depth < 0.08 ? 0 : 1;
				const alpha = 0.45 + r.depth * 0.55;
				return (
					<g key={i} transform={`translate(${r.x} ${y}) rotate(${rot})`} opacity={alpha} filter={`url(#rockBlur${blur})`}>
						<path
							d={r.path}
							fill="url(#rockFill)"
							stroke={`rgba(214,170,120,${0.55 - r.depth * 0.3})`}
							strokeWidth={1.2}
						/>
					</g>
				);
			})}
		</svg>
	);
};
