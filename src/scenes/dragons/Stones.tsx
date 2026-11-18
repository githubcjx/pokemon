import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {clamp} from '../../theme';
import {ACCENT} from './Mono';
import {SEG_START} from './continuity';

/**
 * 双龙消失后坠落的两团光 → 落地化作两块石头（第 4 段结尾 / 第 5 段开头共用）。
 * 按整期帧号 g（30fps）计算，段落交界处无缝。
 * 只画成普通的石头剪影（光明石 / 黑暗石的具体外观不画），靠暖白 / 蓝色的余光区分。
 */
export const FALL_START = SEG_START.war + 640;
export const LAND = SEG_START.husk + 18;

const LIGHTS = [
	{rgb: ACCENT.warmRgb, from: [560, -80], to: [760, 872], delay: 0},
	{rgb: ACCENT.blueRgb, from: [1400, -80], to: [1160, 872], delay: 8},
];

// 石头剪影：不规则的圆润多边形
const stonePath = (seed: string, w: number, h: number) => {
	const n = 11;
	const pts = Array.from({length: n}, (_, i) => {
		const a = Math.PI + (i / (n - 1)) * Math.PI; // 上半圈
		const r = 0.86 + random(`${seed}${i}`) * 0.2;
		return [Math.cos(a) * (w / 2) * r, Math.sin(a) * h * r] as [number, number];
	});
	return `M${-w / 2},6 ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${w / 2},6 Z`;
};
const STONES = [stonePath('ls', 128, 92), stonePath('ds', 120, 98)];

/** 坠落的光 + 落地后的石头。g = 整期帧号（30fps） */
export const FallingStones: React.FC<{g: number; dune?: number}> = ({g, dune = 0}) => {
	return (
		<AbsoluteFill>
			{/* 沙丘：落地的光照亮了一点点地面 */}
			<svg width={1920} height={1080} style={{position: 'absolute', opacity: dune}}>
				<path
					d="M-20,900 C220,860 420,890 640,876 C840,864 980,890 1180,872 C1400,856 1600,884 1940,866 L1940,1100 L-20,1100 Z"
					fill="#010101"
					style={{filter: 'drop-shadow(0 -1px 1.5px rgba(255,255,255,0.22))'}}
				/>
			</svg>
			{LIGHTS.map((L, i) => {
				const start = FALL_START + L.delay;
				const end = LAND + L.delay;
				const p = interpolate(g, [start, end], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
				const landed = g >= end;
				const x = L.from[0] + (L.to[0] - L.from[0]) * p;
				const y = L.from[1] + (L.to[1] - L.from[1]) * p;
				const trail = 60 + p * 260;
				const ang = Math.atan2(L.to[1] - L.from[1], L.to[0] - L.from[0]);
				const after = g - end; // 落地后的帧数
				const glow = landed ? interpolate(after, [0, 4, 120], [1.6, 1, 0.35], clamp) : 1;
				const stoneIn = interpolate(after, [0, 10], [0, 1], clamp);
				return (
					<div key={i}>
						{!landed && g >= start && (
							<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
								<line
									x1={x - Math.cos(ang) * trail}
									y1={y - Math.sin(ang) * trail}
									x2={x}
									y2={y}
									stroke={`rgba(${L.rgb},0.85)`}
									strokeWidth={4}
									strokeLinecap="round"
									style={{filter: `drop-shadow(0 0 8px rgba(${L.rgb},0.9))`}}
								/>
								<circle cx={x} cy={y} r={9} fill="#fff" style={{filter: `drop-shadow(0 0 10px rgba(${L.rgb},1)) drop-shadow(0 0 28px rgba(${L.rgb},0.8))`}} />
							</svg>
						)}
						{landed && (
							<>
								<AbsoluteFill
									style={{
										background: `radial-gradient(ellipse 260px 160px at ${L.to[0]}px ${L.to[1] - 30}px, rgba(${L.rgb},${0.45 * glow}) 0%, transparent 100%)`,
									}}
								/>
								<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible', opacity: stoneIn}}>
									<g transform={`translate(${L.to[0]}, ${L.to[1]})`}>
										<path d={STONES[i]} fill="#030303" style={{filter: `drop-shadow(0 0 ${3 + glow * 4}px rgba(${L.rgb},${Math.min(1, 0.55 * glow + 0.25)}))`}} />
									</g>
								</svg>
							</>
						)}
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

/** 单块石头（第 6 段三联画用）：i = 0 光明石（暖白余光），1 黑暗石（蓝色余光） */
export const Stone: React.FC<{i: 0 | 1; x: number; y: number; scale?: number; glow?: number}> = ({i, x, y, scale = 1, glow = 0.6}) => {
	const rgb = LIGHTS[i].rgb;
	return (
		<>
			<AbsoluteFill style={{background: `radial-gradient(ellipse ${260 * scale}px ${160 * scale}px at ${x}px ${y - 30 * scale}px, rgba(${rgb},${0.45 * glow}) 0%, transparent 100%)`}} />
			<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
				<g transform={`translate(${x}, ${y}) scale(${scale})`}>
					<path d={STONES[i]} fill="#030303" style={{filter: `drop-shadow(0 0 ${3 + glow * 4}px rgba(${rgb},${Math.min(1, 0.55 * glow + 0.25)}))`}} />
				</g>
			</svg>
		</>
	);
};
