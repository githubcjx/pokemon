import {AbsoluteFill} from 'remotion';
import {rng} from '../../three/pagodaGeometry';

// ─── 金屏风：金箔方格底 + 横向的"霞"（金云带）───────────────────────────────
// 金箔一张张贴上去，接缝处留下细线（箔足），每张的金色略有深浅。

const LEAF = 54;

const leaves = (() => {
	const r = rng(23);
	const out: {x: number; y: number; l: number}[] = [];
	for (let y = -LEAF; y < 1080 + LEAF * 2; y += LEAF) {
		for (let x = -LEAF * 2; x < 1920 + LEAF * 3; x += LEAF) {
			out.push({x, y, l: r()});
		}
	}
	return out;
})();

const leafColor = (l: number) => {
	const h = 40 + l * 3;
	const s = 56 + l * 8;
	const v = 55 + l * 6;
	return `hsl(${h} ${s}% ${v}%)`;
};

/** 金箔底。dx / dy 是随镜头的视差位移（像素） */
export const GoldLeaf: React.FC<{dx?: number; dy?: number; dim?: number}> = ({dx = 0, dy = 0, dim = 0}) => {
	const ox = ((dx % LEAF) + LEAF) % LEAF;
	const oy = ((dy % LEAF) + LEAF) % LEAF;
	return (
		<AbsoluteFill style={{background: '#c79a45'}}>
			<svg width={1920} height={1080} style={{position: 'absolute'}}>
				<g transform={`translate(${ox - LEAF} ${oy - LEAF})`}>
					{leaves.map((p, k) => (
						<rect
							key={k}
							x={p.x}
							y={p.y}
							width={LEAF + 1}
							height={LEAF + 1}
							fill={leafColor(p.l)}
							stroke="rgba(110,72,18,0.13)"
							strokeWidth={1}
						/>
					))}
				</g>
			</svg>
			{/* 金面的光泽：左上偏亮、四角压暗 */}
			<AbsoluteFill
				style={{
					background:
						'radial-gradient(ellipse 70% 60% at 38% 30%, rgba(255,240,200,0.35), transparent 70%), radial-gradient(ellipse 110% 90% at 50% 50%, transparent 55%, rgba(60,32,8,0.55) 100%)',
				}}
			/>
			{dim > 0 ? <AbsoluteFill style={{background: `rgba(20,12,4,${dim})`}} /> : null}
		</AbsoluteFill>
	);
};

export type CloudBand = {
	/** 带的中心 y（像素） */
	y: number;
	/** 起点 x（像素） */
	x: number;
	/** 组成霞的胶囊：[相对 x, 宽, 高, 相对 y] */
	caps: [number, number, number, number][];
	/** 漂移速度（像素 / 帧） */
	speed?: number;
	/** 视差系数（随镜头位移的倍数） */
	k?: number;
};

/** 一组霞（金云带）：胶囊叠成的横向云，外缘一圈深金描边，内部是更亮的金箔 */
export const GoldClouds: React.FC<{bands: CloudBand[]; frame: number; dx?: number; dy?: number; opacity?: number}> = ({
	bands,
	frame,
	dx = 0,
	dy = 0,
	opacity = 1,
}) => (
	<AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
		<svg width={1920} height={1080} style={{position: 'absolute'}}>
			<defs>
				<pattern id="cloudLeaf" width={38} height={38} patternUnits="userSpaceOnUse">
					<rect width={38} height={38} fill="#efd38c" />
					<rect width={38} height={38} fill="none" stroke="rgba(150,104,34,0.16)" strokeWidth={1} />
				</pattern>
				<filter id="cloudBlur" x="-10%" y="-50%" width="120%" height="200%">
					<feGaussianBlur stdDeviation="9" />
				</filter>
				<linearGradient id="cloudSheen" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="rgba(255,248,224,0.55)" />
					<stop offset="1" stopColor="rgba(255,248,224,0)" />
				</linearGradient>
			</defs>
			{bands.map((b, i) => {
				const x = b.x + frame * (b.speed ?? 0.15) + dx * (b.k ?? 1);
				const y = b.y + dy * (b.k ?? 1);
				return (
					<g key={i} transform={`translate(${x} ${y})`}>
						{/* 云下的淡淡投影，让霞浮在金地上 */}
						{b.caps.map(([cx, w, h, cy], k) => (
							<rect key={`d${k}`} x={cx + 6} y={cy - h / 2 + 10} width={w} height={h} rx={h / 2} fill="rgba(90,56,14,0.22)" filter="url(#cloudBlur)" />
						))}
						{/* 描边：先画略大一圈的深金 */}
						{b.caps.map(([cx, w, h, cy], k) => (
							<rect key={`o${k}`} x={cx - 2.5} y={cy - h / 2 - 2.5} width={w + 5} height={h + 5} rx={(h + 5) / 2} fill="#9a6f2c" />
						))}
						{b.caps.map(([cx, w, h, cy], k) => (
							<rect key={`f${k}`} x={cx} y={cy - h / 2} width={w} height={h} rx={h / 2} fill="url(#cloudLeaf)" />
						))}
						{b.caps.map(([cx, w, h, cy], k) => (
							<rect key={`s${k}`} x={cx} y={cy - h / 2} width={w} height={h * 0.5} rx={h / 4} fill="url(#cloudSheen)" />
						))}
					</g>
				);
			})}
		</svg>
	</AbsoluteFill>
);

/** 月夜（废墟·今）：月光照亮的灰蓝夜空、月亮与大片光晕，地平线附近有一层薄雾 */
export const NightSky: React.FC<{moon?: {x: number; y: number}}> = ({moon = {x: 1460, y: 230}}) => (
	<AbsoluteFill style={{background: 'linear-gradient(to bottom, #1b2433 0%, #2c3646 50%, #455061 78%, #4b5562 100%)'}}>
		<AbsoluteFill
			style={{
				background: `radial-gradient(circle at ${moon.x}px ${moon.y}px, rgba(238,242,250,1) 0px, rgba(232,238,248,1) 50px, rgba(190,204,228,0.45) 56px, rgba(160,178,208,0.22) 200px, rgba(130,150,185,0.1) 520px, transparent 900px)`,
			}}
		/>
	</AbsoluteFill>
);
