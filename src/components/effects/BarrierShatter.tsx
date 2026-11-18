import {Easing, interpolate, random} from 'remotion';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// 覆盖范围比画面大，镜头平移 / 拉远时屏障也能铺满
const COLS = 18;
const ROWS = 11;
const CELL_W = 2800 / COLS;
const CELL_H = 1700 / ROWS;

// 抖动网格 → 三角形碎片
const POINTS = Array.from({length: ROWS + 1}, (_, r) =>
	Array.from({length: COLS + 1}, (_, c) => {
		const edge = r === 0 || c === 0 || r === ROWS || c === COLS;
		const jx = edge ? 0 : (random(`bx${r}-${c}`) - 0.5) * CELL_W * 0.7;
		const jy = edge ? 0 : (random(`by${r}-${c}`) - 0.5) * CELL_H * 0.7;
		return [c * CELL_W - 440 + jx, r * CELL_H - 310 + jy] as const;
	}),
);

const SHARDS = (() => {
	const list: {pts: (readonly [number, number])[]; cx: number; cy: number; rand: number}[] = [];
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const a = POINTS[r][c];
			const b = POINTS[r][c + 1];
			const d = POINTS[r + 1][c];
			const e = POINTS[r + 1][c + 1];
			const tris = (r + c) % 2 === 0 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]];
			for (const pts of tris) {
				list.push({
					pts,
					cx: (pts[0][0] + pts[1][0] + pts[2][0]) / 3,
					cy: (pts[0][1] + pts[1][1] + pts[2][1]) / 3,
					rand: random(`bs${list.length}`),
				});
			}
		}
	}
	return list;
})();

/**
 * 屏障破碎（帕路奇亚 · "阻隔现世的屏障消失"）：
 * 一整面玻璃屏障显现 → 裂纹从中心向外蔓延 → 碎片向外飞散消失。
 */
export const BarrierShatter: React.FC<{
	cx: number;
	cy: number;
	crackStart: number;
	breakAt: number;
	rgb?: string;
}> = ({cx, cy, crackStart, breakAt, rgb = '255,232,236'}) => {
	const frame = useFrame();
	if (frame < crackStart - 24 || frame > breakAt + 60) return null;

	const sheen = interpolate(frame, [crackStart - 24, crackStart], [0, 1], clamp);
	const front = interpolate(frame, [crackStart, breakAt], [0, 2300], {...clamp, easing: Easing.in(Easing.quad)});
	const t = interpolate(frame, [breakAt, breakAt + 55], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const flash = interpolate(frame, [breakAt - 2, breakAt + 3, breakAt + 18], [0, 1, 0], clamp);

	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
			{SHARDS.map((s, i) => {
				const dx = s.cx - cx;
				const dy = s.cy - cy;
				const dist = Math.hypot(dx, dy) || 1;
				const cracked = interpolate(front - dist, [0, 120], [0, 1], clamp);
				const push = t * (260 + s.rand * 700) * (0.6 + 400 / (dist + 400));
				const tx = (dx / dist) * push;
				const ty = (dy / dist) * push;
				const rot = t * (s.rand - 0.5) * 160;
				const alpha = sheen * (1 - t);
				return (
					<polygon
						key={i}
						points={s.pts.map((p) => p.join(',')).join(' ')}
						transform={`translate(${tx} ${ty}) rotate(${rot} ${s.cx} ${s.cy})`}
						fill={`rgba(${rgb},${(0.035 + flash * 0.25 + cracked * 0.03) * alpha})`}
						stroke={`rgba(${rgb},${(0.05 + cracked * 0.42 + flash * 0.25) * alpha})`}
						strokeWidth={0.8 + cracked * 0.6}
					/>
				);
			})}
		</svg>
	);
};
