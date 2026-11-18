import {Easing, interpolate} from 'remotion';
import {clamp} from '../../theme';

type P = {x: number; y: number};

/** 一根墨丝：从 origin 长向 to；start / dur 为生长的起止（30fps 帧号）；bend 为弯曲程度（占长度的比例，正负决定方向） */
export type Branch = {to: P; start: number; dur: number; bend: number; width?: number; seed: number};

// 确定性的伪随机（同一 seed 每帧结果相同）
const rand = (seed: number) => {
	const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const cubic = (a: P, b: P, c: P, d: P, t: number): P => {
	const u = 1 - t;
	return {
		x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
		y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
	};
};

const N = 64;

/** 曲线采样点（含两段相反的弯曲，像墨在水里游走） */
const curve = (from: P, to: P, bend: number, seed: number): P[] => {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const len = Math.hypot(dx, dy);
	const nx = -dy / len;
	const ny = dx / len;
	const b1 = bend * len * (0.8 + 0.4 * rand(seed));
	const b2 = -bend * len * (0.3 + 0.4 * rand(seed + 1));
	const c1 = {x: from.x + dx * 0.33 + nx * b1, y: from.y + dy * 0.33 + ny * b1};
	const c2 = {x: from.x + dx * 0.7 + nx * b2, y: from.y + dy * 0.7 + ny * b2};
	return Array.from({length: N + 1}, (_, i) => cubic(from, c1, c2, to, i / N));
};

/** 沿采样点生成一条由粗到细的笔触（多边形），grown 为已长出的比例 */
const ribbon = (pts: P[], grown: number, w0: number, seed: number) => {
	const n = Math.max(2, Math.floor(grown * N) + 1);
	const left: string[] = [];
	const right: string[] = [];
	for (let i = 0; i < n; i++) {
		const t = i / N;
		const a = pts[Math.max(0, i - 1)];
		const b = pts[Math.min(N, i + 1)];
		const tx = b.x - a.x;
		const ty = b.y - a.y;
		const l = Math.hypot(tx, ty) || 1;
		// 笔势：整体由粗到细，中段有轻重起伏，生长的前端收尖
		const press = 0.8 + 0.4 * Math.sin(t * 9 + seed * 3) * Math.sin(t * 4.3 + seed);
		const tip = Math.min(1, (grown - t) * 14);
		const w = (w0 * Math.pow(1 - t, 0.7) + 1.2) * press * Math.max(0.15, tip);
		const p = pts[i];
		left.push(`${(p.x - (ty / l) * w * 0.5).toFixed(1)},${(p.y + (tx / l) * w * 0.5).toFixed(1)}`);
		right.push(`${(p.x + (ty / l) * w * 0.5).toFixed(1)},${(p.y - (tx / l) * w * 0.5).toFixed(1)}`);
	}
	return `M${left.join('L')}L${right.reverse().join('L')}Z`;
};

const grow = (frame: number, start: number, dur: number) =>
	interpolate(frame, [start, start + dur], [0, 1], {...clamp, easing: Easing.out(Easing.sin)});

/** 某根墨丝长到 t（0–1）时的位置，供场景把宝可梦放在枝头 */
export const branchPoint = (origin: P, b: Branch, t: number) => curve(origin, b.to, b.bend, b.seed)[Math.round(t * N)];

/**
 * 从一点向外分枝生长的墨丝（墨色笔触 + 中间一道泥金线 + 生长前端的金色光点），每根主枝侧面再长出几根细枝。
 * 放在 CamLayer 里使用，坐标为该层的 1920×1080 坐标。opacity 用于整体淡出。
 */
export const InkBranches: React.FC<{frame: number; origin: P; branches: Branch[]; opacity?: number; id?: string}> = ({
	frame,
	origin,
	branches,
	opacity = 1,
	id = 'branches',
}) => {
	const strokes: {d: string; gold: string; tip: P | null; w: number}[] = [];
	for (const b of branches) {
		const g = grow(frame, b.start, b.dur);
		if (g < 1e-4) continue; // 缓动在 0 处会返回 6e-17 这样的极小值
		const pts = curve(origin, b.to, b.bend, b.seed);
		const w0 = b.width ?? 14;
		strokes.push({d: ribbon(pts, g, w0, b.seed), gold: ribbon(pts, g, w0 * 0.22, b.seed), tip: g < 1 ? pts[Math.floor(g * N)] : null, w: w0});
		// 细枝：从主枝的 30%–75% 处分出
		for (let k = 0; k < 3; k++) {
			const at = 0.3 + 0.45 * rand(b.seed * 7 + k);
			const tg = grow(frame, b.start + b.dur * at, b.dur * 0.45);
			if (tg < 1e-4) continue;
			const base = pts[Math.round(at * N)];
			const next = pts[Math.min(N, Math.round(at * N) + 2)];
			const ang = Math.atan2(next.y - base.y, next.x - base.x) + (k % 2 ? 1 : -1) * (0.5 + 0.4 * rand(b.seed + k * 3));
			const len = Math.hypot(b.to.x - origin.x, b.to.y - origin.y) * (0.12 + 0.14 * rand(b.seed * 3 + k));
			const to = {x: base.x + Math.cos(ang) * len, y: base.y + Math.sin(ang) * len};
			const tp = curve(base, to, 0.25 * (k % 2 ? 1 : -1), b.seed + k * 11);
			strokes.push({d: ribbon(tp, tg, w0 * 0.45 * (1 - at * 0.5), b.seed + k), gold: '', tip: null, w: w0 * 0.4});
		}
	}
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity}}>
			<defs>
				{/* 笔触边缘的毛糙 */}
				<filter id={`${id}-rough`} x="-10%" y="-10%" width="120%" height="120%">
					<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={4} result="t" />
					<feDisplacementMap in="SourceGraphic" in2="t" scale={4} xChannelSelector="R" yChannelSelector="G" />
				</filter>
				<filter id={`${id}-bleed`} x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation={6} />
				</filter>
				<filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={2.5} result="b" />
					<feMerge>
						<feMergeNode in="b" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<radialGradient id={`${id}-spark`}>
					<stop offset="0%" stopColor="#fff4d0" stopOpacity={1} />
					<stop offset="35%" stopColor="#f0c066" stopOpacity={0.8} />
					<stop offset="100%" stopColor="#c08a30" stopOpacity={0} />
				</radialGradient>
			</defs>
			{/* 洇开的淡墨 */}
			<g filter={`url(#${id}-bleed)`} opacity={0.22}>
				{strokes.map((s, i) => (
					<path key={i} d={s.d} fill="#2a2018" />
				))}
			</g>
			{/* 墨色笔触 */}
			<g filter={`url(#${id}-rough)`}>
				{strokes.map((s, i) => (
					<path key={i} d={s.d} fill="rgba(20,15,11,0.9)" />
				))}
			</g>
			{/* 泥金线 */}
			<g filter={`url(#${id}-glow)`}>
				{strokes.map((s, i) => (s.gold ? <path key={i} d={s.gold} fill="#e3b75a" opacity={0.95} /> : null))}
			</g>
			{/* 生长前端的光点 */}
			{strokes.map((s, i) => (s.tip ? <circle key={i} cx={s.tip.x} cy={s.tip.y} r={s.w * 1.6} fill={`url(#${id}-spark)`} /> : null))}
		</svg>
	);
};
