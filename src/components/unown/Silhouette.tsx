import {random} from 'remotion';

// ─── 阿露福一族：代码画的人物剪影（人不是宝可梦，可以画）───────────────────────────
// 坐标：身高 100 个单位，原点在两脚之间，y 向下（头顶约 -100）。长袍、束发，朝右为正面。
// 剪影本身近乎全黑，只在朝向火光的一侧留一圈暖色轮廓光。

export type Pose = 'stand' | 'raise' | 'walk' | 'kneel' | 'pull' | 'reach' | 'place' | 'look' | 'pray';

type Pt = [number, number];

type Shape = {
	body: string;
	head: Pt;
	bun: Pt;
	/** 手臂：肩 → 肘 → 手 */
	arms: [Pt, Pt, Pt][];
	legs?: [Pt, Pt][];
	/** 手里拿着的东西 */
	torch?: {hand: Pt; tip: Pt};
	tool?: {hand: Pt; tip: Pt; head?: boolean};
	rope?: Pt;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 各姿势的剪影；t 为动作相位（走路摆腿、凿击抬锤） */
const shape = (pose: Pose, t: number): Shape => {
	const robe = 'M -7,-80 L 7,-80 Q 10.5,-63 9,-48 L 15,0 L -15,0 L -9,-48 Q -10.5,-63 -7,-80 Z';
	switch (pose) {
		case 'raise':
			// 高举火把
			return {
				body: robe,
				head: [0.5, -89],
				bun: [-3.5, -97],
				arms: [
					[[6, -78], [12, -92], [13, -108]],
					[[-6, -78], [-9, -63], [-6, -50]],
				],
				torch: {hand: [13, -108], tip: [16, -125]},
			};
		case 'walk': {
			const s = Math.sin(t * Math.PI * 2);
			const hemL = -15 + s * 4;
			const hemR = 15 + s * 4;
			return {
				body: `M -7,-80 L 7,-80 Q 10.5,-63 9,-48 L ${hemR},-4 L ${hemL},-4 L -9,-48 Q -10.5,-63 -7,-80 Z`,
				head: [1.5, -89],
				bun: [-2.5, -97],
				arms: [
					[[6, -78], [13, -66], [20, -70]],
					[[-6, -78], [-8 - s * 4, -63], [-5 - s * 8, -50]],
				],
				legs: [
					[[-3, -6], [-6 - s * 9, 0]],
					[[3, -6], [6 + s * 9, 0]],
				],
				torch: {hand: [20, -70], tip: [26, -88]},
			};
		}
		case 'kneel': {
			// 跪在地上：左手扶凿子，右手抬锤落下
			const strike = Math.pow(Math.abs(Math.sin(t * Math.PI)), 0.6);
			const hx = lerp(17, 4, strike);
			const hy = lerp(-30, -70, strike);
			return {
				body: 'M -5,-52 L 7,-52 Q 10,-38 9,-25 L 20,-14 L 21,0 L -14,0 L -11,-19 Q -9,-36 -5,-52 Z',
				head: [5, -61],
				bun: [1, -69],
				arms: [
					[[6, -50], [16, -38], [22, -22]],
					[[-3, -50], [lerp(3, -6, strike), lerp(-36, -60, strike)], [hx, hy]],
				],
				tool: {hand: [22, -22], tip: [27, -4]},
				...{hammer: [hx, hy]},
			} as Shape & {hammer: Pt};
		}
		case 'pull': {
			// 后仰拉绳
			const sway = Math.sin(t * Math.PI * 2) * 2;
			return {
				body: `M ${-11 + sway},-78 L ${3 + sway},-80 Q 6,-62 4,-48 L 13,0 L -14,0 L -12,-48 Q -14,-63 ${-11 + sway},-78 Z`,
				head: [-6 + sway, -88],
				bun: [-10 + sway, -95],
				arms: [
					[[2 + sway, -76], [12, -70], [22, -66]],
					[[-8 + sway, -76], [6, -68], [20, -62]],
				],
				rope: [22, -64],
			};
		}
		case 'place': {
			// 踮脚把东西按到高处（右手），左手垂着火把；t 控制手臂伸到多高（0 收着 … 1 伸直）
			const up = Math.max(0, Math.min(1, t));
			return {
				body: robe,
				head: [1.5, -89 - up * 1.5],
				bun: [-2.5, -97 - up * 1.5],
				arms: [
					[[6, -78], [lerp(13, 12, up), lerp(-72, -96, up)], [lerp(22, 19, up), lerp(-80, -116, up)]],
					[[-6, -78], [-11, -66], [-11, -58]],
				],
				torch: {hand: [-11, -58], tip: [-15, -76]},
			};
		}
		case 'look':
			// 举着火把仰望
			return {
				body: robe,
				head: [2, -88.5],
				bun: [-2.5, -96],
				arms: [
					[[6, -78], [14, -82], [18, -96]],
					[[-6, -78], [-9, -63], [-6, -50]],
				],
				torch: {hand: [18, -96], tip: [22, -113]},
			};
		case 'pray': {
			// 跪拜（《神奥之名》）：跪着向前上方举起双手；t 为俯身的程度（0 直身举手 … 1 伏地）
			const b = Math.max(0, Math.min(1, t));
			const hx = lerp(6, 15, b);
			const hy = lerp(-61, -40, b);
			return {
				body: `M -5,-52 L 7,-52 Q ${lerp(10, 16, b)},-38 ${lerp(9, 13, b)},-25 L 20,-14 L 21,0 L -14,0 L -11,-19 Q -9,-36 -5,-52 Z`,
				head: [hx, hy],
				bun: [hx - 4, hy - 8 + b * 4],
				arms: [
					[[lerp(6, 11, b), lerp(-50, -34, b)], [lerp(15, 22, b), lerp(-60, -22, b)], [lerp(19, 28, b), lerp(-76, -6, b)]],
					[[lerp(3, 9, b), lerp(-50, -34, b)], [lerp(12, 20, b), lerp(-58, -20, b)], [lerp(16, 26, b), lerp(-74, -5, b)]],
				],
			};
		}
		case 'reach':
			// 伸手：未知图腾停在手边
			return {
				body: robe,
				head: [1, -89],
				bun: [-3, -97],
				arms: [
					[[6, -78], [16, -76], [27, -84]],
					[[-6, -78], [-9, -63], [-6, -50]],
				],
			};
		default:
			return {
				body: robe,
				head: [0.5, -89],
				bun: [-3.5, -97],
				arms: [
					[[6, -78], [9, -63], [8, -50]],
					[[-6, -78], [-9, -63], [-6, -50]],
				],
			};
	}
};

/** 姿势里火把顶端 / 锤头 / 绳头的位置（身高 100 的局部坐标） */
export const poseAnchor = (pose: Pose, t: number, what: 'torch' | 'hammer' | 'rope' | 'hand'): Pt | null => {
	const s = shape(pose, t) as Shape & {hammer?: Pt};
	if (what === 'torch') return s.torch ? s.torch.tip : null;
	if (what === 'hammer') return s.hammer ?? null;
	if (what === 'rope') return s.rope ?? null;
	return s.arms[0][2];
};

const Figure: React.FC<{s: Shape & {hammer?: Pt}; fill: string; stroke?: number; traveler?: boolean; hood?: boolean}> = ({s, fill, stroke = 0, traveler = false, hood = false}) => (
	<g fill={fill} stroke={fill} strokeLinecap="round" strokeLinejoin="round">
		<path d={s.body} strokeWidth={stroke} />
		<ellipse cx={s.head[0]} cy={s.head[1]} rx={6 + stroke / 2} ry={7.2 + stroke / 2} />
		{hood ? (
			// 迁徙的人：兜帽斗篷（不是一族，也不是后来的旅人）
			<>
				<path
					d={`M ${s.head[0] - 8},${s.head[1] + 8} Q ${s.head[0] - 10},${s.head[1] - 6} ${s.head[0] - 2},${s.head[1] - 10} Q ${s.head[0] + 6},${s.head[1] - 11} ${s.head[0] + 7.5},${s.head[1] - 2} L ${s.head[0] + 8.5},${s.head[1] + 9} Z`}
					strokeWidth={stroke}
				/>
				<path d={`M -10,-80 Q -18,-50 -17,-4 L -9,-4 Z`} strokeWidth={stroke} />
			</>
		) : traveler ? (
			// 后来的旅人：宽檐帽 + 背包（与束发长袍的一族区分开）
			<>
				<ellipse cx={s.head[0] - 0.5} cy={s.head[1] - 5.5} rx={11.5 + stroke / 2} ry={1.8 + stroke / 2} />
				<path d={`M ${s.head[0] - 5.5},${s.head[1] - 5.5} Q ${s.head[0] - 5},${s.head[1] - 13} ${s.head[0]},${s.head[1] - 13} Q ${s.head[0] + 5},${s.head[1] - 13} ${s.head[0] + 5.5},${s.head[1] - 5.5} Z`} strokeWidth={stroke} />
				<rect x={s.head[0] - 17} y={s.head[1] + 11} width={9 + stroke} height={22 + stroke} rx={3} strokeWidth={stroke} />
			</>
		) : (
			<circle cx={s.bun[0]} cy={s.bun[1]} r={3.2 + stroke / 2} />
		)}
		<rect x={s.head[0] - 2.6} y={s.head[1] + 4} width={5.2} height={7} />
		{s.arms.map((a, i) => (
			<polyline key={i} points={a.map((p) => p.join(',')).join(' ')} fill="none" strokeWidth={5.2 + stroke} />
		))}
		{s.legs?.map((l, i) => (
			<polyline key={`l${i}`} points={l.map((p) => p.join(',')).join(' ')} fill="none" strokeWidth={4.5 + stroke} />
		))}
		{s.torch ? (
			<line x1={s.torch.hand[0] - 1} y1={s.torch.hand[1] + 9} x2={s.torch.tip[0]} y2={s.torch.tip[1]} strokeWidth={2.6 + stroke} />
		) : null}
		{s.tool ? <line x1={s.tool.hand[0]} y1={s.tool.hand[1]} x2={s.tool.tip[0]} y2={s.tool.tip[1]} strokeWidth={1.8 + stroke} /> : null}
		{s.hammer ? <rect x={s.hammer[0] - 3} y={s.hammer[1] - 4} width={6} height={5} strokeWidth={stroke} /> : null}
	</g>
);

/**
 * 一个人的剪影。x / y 为脚底的屏幕坐标，height 为屏幕上的身高（像素）。
 * rimDir：火光在剪影的哪一侧（屏幕方向），留一圈暖色轮廓光。
 */
export const Person: React.FC<{
	x: number;
	y: number;
	height: number;
	pose: Pose;
	t?: number;
	flip?: boolean;
	rimDir?: [number, number];
	rim?: number;
	opacity?: number;
	tone?: string;
	/** 横向比例：俯拍时人的高度被透视压短，宽度不变 */
	aspect?: number;
	/** 后来的旅人（戴帽、背包） */
	traveler?: boolean;
	/** 迁徙的人（兜帽斗篷） */
	hood?: boolean;
	/** 轮廓光颜色 */
	rimColor?: string;
}> = ({x, y, height, pose, t = 0, flip = false, rimDir = [1, 0], rim = 0.8, opacity = 1, tone = '#060403', aspect = 1, traveler = false, hood = false, rimColor = '#ffb067'}) => {
	const s = shape(pose, t) as Shape & {hammer?: Pt};
	const k = height / 100;
	const len = Math.hypot(rimDir[0], rimDir[1]) || 1;
	// 轮廓光：剪影朝光一侧露出的一圈暖边（局部坐标里的偏移）
	const ox = ((rimDir[0] / len) * 1.6 * (flip ? -1 : 1)) / Math.max(k, 0.4);
	const oy = ((rimDir[1] / len) * 1.6) / Math.max(k, 0.4);
	// 画布 160 × 150 个单位，脚底在 (80, 130)
	return (
		<svg
			width={160 * k}
			height={150 * k}
			viewBox="-80 -130 160 150"
			style={{
				position: 'absolute',
				left: x - 80 * k,
				top: y - 130 * k,
				opacity,
				overflow: 'visible',
				transform: `scaleX(${(flip ? -1 : 1) * aspect})`,
				pointerEvents: 'none',
			}}
		>
			<g transform={`translate(${ox * 1.4},${oy * 1.4})`} opacity={rim}>
				<Figure s={s} fill={rimColor} stroke={0.6} traveler={traveler} hood={hood} />
			</g>
			<Figure s={s} fill={tone} traveler={traveler} hood={hood} />
		</svg>
	);
};

/**
 * 火把的火焰（屏幕坐标，size 为火焰高度）：几层随时间抖动的焰舌 + 外圈光晕。
 */
export const Flame: React.FC<{x: number; y: number; size: number; f: number; seed?: number; opacity?: number; glow?: number}> = ({
	x,
	y,
	size,
	f,
	seed = 0,
	opacity = 1,
	glow = 1,
}) => {
	const w = (k: number) => Math.sin(f * (0.9 + k * 0.37) + seed * 7 + k * 2.1) * 0.5 + Math.sin(f * (2.3 + k * 0.5) + seed * 3) * 0.3;
	const tongues = [0, 1, 2].map((i) => {
		const h = size * (1 - i * 0.22) * (0.9 + 0.12 * w(i));
		const bw = size * (0.36 - i * 0.08);
		const tipX = w(i + 3) * size * 0.16;
		return `M ${-bw / 2},0 C ${-bw / 2},${-h * 0.45} ${tipX - bw * 0.1},${-h * 0.7} ${tipX},${-h} C ${tipX + bw * 0.1},${-h * 0.7} ${bw / 2},${-h * 0.45} ${bw / 2},0 Q 0,${bw * 0.35} ${-bw / 2},0 Z`;
	});
	const g = size * 3.2 * glow;
	return (
		<div style={{position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none'}}>
			<div
				style={{
					position: 'absolute',
					left: -g,
					top: -g - size * 0.4,
					width: g * 2,
					height: g * 2,
					borderRadius: '50%',
					mixBlendMode: 'screen',
					background: 'radial-gradient(circle, rgba(255,170,80,0.55) 0%, rgba(255,120,40,0.18) 35%, transparent 70%)',
					opacity: 0.8 + 0.2 * w(5),
				}}
			/>
			<svg width={size * 2} height={size * 2} viewBox={`${-size} ${-size * 1.6} ${size * 2} ${size * 2}`} style={{position: 'absolute', left: -size, top: -size * 1.6, overflow: 'visible', mixBlendMode: 'screen'}}>
				<path d={tongues[0]} fill="rgba(255,90,20,0.75)" />
				<path d={tongues[1]} fill="rgba(255,165,50,0.9)" />
				<path d={tongues[2]} fill="rgba(255,236,170,0.95)" />
			</svg>
		</div>
	);
};

/** 凿击溅起的火星（屏幕坐标） */
export const Sparks: React.FC<{x: number; y: number; scale: number; f: number; at: number; seed?: number}> = ({x, y, scale, f, at, seed = 0}) => {
	const t = f - at;
	if (t < 0 || t > 14) return null;
	return (
		<div style={{position: 'absolute', left: x, top: y, pointerEvents: 'none', mixBlendMode: 'screen'}}>
			{Array.from({length: 9}, (_, i) => {
				const a = -Math.PI * (0.15 + random(`sa${seed}${i}`) * 0.7);
				const v = (3 + random(`sv${seed}${i}`) * 5) * scale;
				const px = Math.cos(a) * v * t;
				const py = Math.sin(a) * v * t + 0.35 * scale * t * t;
				const o = 1 - t / 14;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: px,
							top: py,
							width: 3 * scale,
							height: 3 * scale,
							borderRadius: '50%',
							background: 'rgba(255,214,140,1)',
							boxShadow: `0 0 ${6 * scale}px rgba(255,150,60,0.9)`,
							opacity: o,
						}}
					/>
				);
			})}
		</div>
	);
};
