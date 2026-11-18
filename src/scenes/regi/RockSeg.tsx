import {useLayoutEffect, useMemo, useRef} from 'react';
import {interpolate, staticFile} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {BASE_FPS} from '../../time';
import {H, T, track, W} from './common';
import {rng} from './DotTitle';
import {Stage} from './DotMorph';
import {GLView} from './GLView';
import {STRATA_FRAG} from './gl';
import {artToScreen, RockAssembly} from './Rocks';
import {CONT, lonLat, Pt} from './shapes';

/**
 * 第 3 段 · 岩石巨人。
 * 雷吉洛克的立绘固定以 (960, 540)、边长 700 渲染，移动和缩放用外层 transform（避免逐帧重建画布）。
 */

export const ROCK_ART = {x: 960, y: 540, size: 700};

// ── 地层剖面 ──
/** 画面中心的深度（米）：先停在海床上方，再往下沉 */
const viewDepth = (f: number) =>
	track(f, [[T.strata, -2.6], [T.strata + 16, -2.4], [2110, 3.4], [T.lands, 3.6], [T.end3, 3.85], [3130, -1.7], [T.coast, -1.9], [T.deep, 3.0], [T.registeel - 20, 13.2], [T.tri, 13.6]]);
const VIEW_ZOOM = 6.5;
const viewZoom = (f: number) => track(f, [[T.deep, VIEW_ZOOM], [T.registeel - 20, 9.5]]);
/** 各层中间的深度和碎石颜色 */
const LAYERS: {mid: number; col: string}[] = [
	{mid: 0.45, col: '#6b5638'},
	{mid: 1.5, col: '#3e3a37'},
	{mid: 2.8, col: '#7c786b'},
	{mid: 4.15, col: '#7a3a24'},
	{mid: 5.45, col: '#6d6253'},
	{mid: 6.9, col: '#7d6a68'},
];

export const StrataView: React.FC<{f: number; opacity: number}> = ({f, opacity}) => (
	<GLView
		frag={STRATA_FRAG}
		style={{opacity}}
		uniforms={{
			uTime: f / BASE_FPS,
			uView: [track(f, [[T.strata, 0], [T.end3, 1.6], [T.endA, 4.0]], (t) => t), viewDepth(f), viewZoom(f)],
			uDim: track(f, [[T.strata, 0], [T.lands - 10, 0.12], [T.lands + 40, 0.8], [T.home - 10, 0.8], [T.home + 50, 0.45], [T.end3, 0.45], [3110, 0.05], [T.tri, 0.05], [T.holes - 20, 0.1], [T.holes + 60, 0.9]]),
			uIce: track(f, [[T.end3 + 10, 0], [3150, 1]]),
			uTri: track(f, [[T.tri, 0], [T.tri + 45, 1]]),
			uHL: [-1, 0],
			uExposure: 1.45,
			uFade: 0,
		}}
	/>
);

/** 碎石出发点：从剖面各层随机取（按碎石出发那一刻的镜头深度换算到屏幕） */
const ROCK_SOURCES = (() => {
	const r = rng(99);
	const dc = 3.4;
	return Array.from({length: 230}, () => {
		const L = LAYERS[Math.floor(r() * LAYERS.length)];
		const depth = L.mid + (r() - 0.5) * 0.6;
		const y = H / 2 + ((depth - dc) / VIEW_ZOOM) * H;
		return {p: [r() * W, y] as Pt, col: L.col};
	});
})();

// ── 雷吉洛克的位置 ──
/** 外层 transform：平移（像素）和缩放 */
export const rockPlace = (f: number) => {
	// 讲大西洋时从右边退出画面；说"一个用各地石头拼成的巨人"时再从右边滑回中央、慢慢放大（全程不隐身）
	// 第 3 段：先往左退场，三联画时回到左边一格，讲造物主时站到前排
	const dx = track(f, [[T.lands, 0], [T.lands + 50, 520], [T.atlantic, 520], [T.atlantic + 50, 1250], [T.home, 1250], [T.home + 64, 0], [T.end3, 0], [3110, -760], [T.tri, -760], [T.tri + 40, -640], [T.holes - 10, -640], [T.holes + 50, -420]]);
	const dy = track(f, [[T.lands, 0], [T.lands + 50, 60], [T.home, 60], [T.home + 64, 0], [T.end3, 0], [T.tri, 60], [T.holes - 10, 60], [T.holes + 50, 220]]);
	const k = track(f, [[T.lands, 1], [T.lands + 50, 0.74], [T.home, 0.74], [T.home + 64, 0.92], [T.end3, 0.92], [3110, 0.7], [T.tri, 0.63], [T.holes - 10, 0.63], [T.holes + 50, 0.37]]);
	const o = interpolate(f, [T.regirock - 22, T.regirock + 6, T.end3, 3105, T.tri, T.tri + 35, T.king, T.king + 50], [0, 1, 1, 0, 0, 1, 1, 0], clamp);
	return {dx, dy, k, o};
};
/** 立绘 UV → 当前屏幕位置 */
export const rockUV = (f: number, uv: Pt): Pt => {
	const {dx, dy, k} = rockPlace(f);
	const p = artToScreen(uv, ROCK_ART.x, ROCK_ART.y, ROCK_ART.size);
	return [ROCK_ART.x + (p[0] - ROCK_ART.x) * k + dx, ROCK_ART.y + (p[1] - ROCK_ART.y) * k + dy];
};

export const RegirockLayer: React.FC<{f: number; mask: Pt[] | null; light?: number}> = ({f, mask, light = 0}) => {
	const {dx, dy, k, o} = rockPlace(f);
	const visible = o > 0.001;
	const scanP = track(f, [[T.scan + 14, -0.1], [T.scan + 110, 1.1]], (t) => t);
	const scanO = interpolate(f, [T.scan + 10, T.scan + 22, T.scan + 104, T.scan + 120], [0, 1, 1, 0], clamp);
	const homeGlow = interpolate(f, [T.home + 30, T.home + 80, T.end3], [0, 1, 0.8], clamp);
	const art = ROCK_ART;
	return (
		<>
			<RockAssembly
				f={f}
				mask={mask}
				start={2066}
				dur={56}
				spread={30}
				fadeAt={[T.regirock - 6, T.regirock + 18]}
				target={art}
				sources={ROCK_SOURCES}
			/>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: W,
					height: H,
					opacity: o,
					display: visible ? 'block' : 'none',
					transform: `translate(${dx}px, ${dy}px) scale(${k})`,
					transformOrigin: `${art.x}px ${art.y}px`,
				}}
			>
				<PokemonArt3D
					dir="pokemon/regirock"
					x={art.x}
					y={art.y}
					size={art.size}
					depthScale={0.5}
					ambient={[0.3, 0.28, 0.26]}
					dirLights={[{dir: [-0.5, -0.65, 0.6], color: [1.25, 1.0, 0.75], wrap: 0.35}]}
					rim={{dir: [-0.6, -0.8], color: [1.1 + homeGlow + light, 0.75 + homeGlow * 0.6 + light * 0.7, 0.4 + homeGlow * 0.2 + light * 0.3], power: 2.4}}
				/>
				{/* 扫描：一道青光从上往下扫过，只照在它身上 */}
				{scanO > 0 ? (
					<div
						style={{
							position: 'absolute',
							left: art.x - art.size / 2,
							top: art.y - art.size / 2,
							width: art.size,
							height: art.size,
							opacity: scanO,
							mixBlendMode: 'screen',
							WebkitMaskImage: `url(${staticFile('pokemon/regirock/art.png')})`,
							WebkitMaskSize: '100% 100%',
							maskImage: `url(${staticFile('pokemon/regirock/art.png')})`,
							maskSize: '100% 100%',
							background: `linear-gradient(180deg, rgba(90,230,255,0) ${scanP * 100 - 14}%, rgba(90,230,255,0.18) ${scanP * 100 - 3}%, rgba(200,250,255,0.85) ${scanP * 100}%, rgba(90,230,255,0) ${scanP * 100 + 0.8}%), repeating-linear-gradient(180deg, rgba(120,235,255,0.12) 0px, rgba(120,235,255,0.12) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 7px)`,
						}}
					/>
				) : null}
			</div>
		</>
	);
};

// ── 地图上的连线和地层柱 ──
const SITES: Pt[] = [
	[-100, 40],
	[-60, -15],
	[22, 5],
	[15, 48],
	[95, 45],
	[134, -25],
].map((p) => lonLat(p as Pt));
const COLUMN = LAYERS.map((l) => l.col);

export const MapLinks: React.FC<{f: number; mask: Pt[] | null}> = ({f, mask}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const anchors = useMemo(() => {
		if (!mask) return [];
		const r = rng(5);
		return SITES.map(() => mask[Math.floor(r() * mask.length)]);
	}, [mask]);
	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		const vis = interpolate(f, [T.lands + 40, T.lands + 70, T.atlantic - 20, T.atlantic + 4], [0, 1, 1, 0], clamp);
		if (vis <= 0 || !anchors.length) return;
		SITES.forEach((s, i) => {
			const a = rockUV(f, anchors[i]);
			const grow = interpolate(f, [T.lands + 50 + i * 10, T.lands + 90 + i * 10], [0, 1], clamp);
			// 虚线：从雷吉洛克身上连到这块土地
			ctx.save();
			ctx.globalAlpha = vis * 0.95;
			ctx.strokeStyle = '#ffd68f';
			ctx.lineWidth = 2.4;
			ctx.setLineDash([4, 7]);
			ctx.beginPath();
			ctx.moveTo(a[0], a[1]);
			ctx.lineTo(a[0] + (s[0] - a[0]) * grow, a[1] + (s[1] - a[1]) * grow);
			ctx.stroke();
			ctx.restore();
			// 地点：一圈圈荡开的光环
			if (grow >= 1) {
				for (let k = 0; k < 2; k++) {
					const ph = ((f - T.lands) * 0.02 + k * 0.5 + i * 0.13) % 1;
					ctx.globalAlpha = vis * (1 - ph) * 0.8;
					ctx.strokeStyle = '#ffe2a8';
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.arc(s[0], s[1], 5 + ph * 22, 0, Math.PI * 2);
					ctx.stroke();
				}
			}
			// 一模一样的地层柱：一层层长出来
			const col = interpolate(f, [T.columns + i * 8, T.columns + 36 + i * 8], [0, 1], clamp);
			if (col > 0) {
				const cw = 22;
				const lh = 9;
				const n = Math.ceil(col * COLUMN.length);
				for (let j = 0; j < n; j++) {
					ctx.globalAlpha = vis * (j < n - 1 ? 1 : (col * COLUMN.length) % 1 || 1);
					ctx.fillStyle = COLUMN[j];
					ctx.fillRect(s[0] - cw / 2, s[1] - 18 - (COLUMN.length - j) * lh, cw, lh - 1);
				}
				ctx.globalAlpha = vis;
				ctx.strokeStyle = 'rgba(255,226,170,0.8)';
				ctx.lineWidth = 1;
				ctx.strokeRect(s[0] - cw / 2 - 1.5, s[1] - 18 - COLUMN.length * lh - 1.5, cw + 3, COLUMN.length * lh + 2);
			}
		});
		ctx.globalAlpha = 1;
	});
	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};

// ── 大西洋两岸 ──
const SA_IDX = CONT.findIndex((c) => c.name === 'southAmerica');
const AF_IDX = CONT.findIndex((c) => c.name === 'africa');
const OFFSET = CONT.map((_, k) => CONT.slice(0, k).reduce((a, c) => a + c.pts.length, 0));
/** 南美贴到非洲西岸：绕自身中心转 −37.4°，再平移（由五对海岸点做刚体最小二乘得出） */
const FIT_FROM: Pt = [745.7, 552];
const FIT_TO: Pt = [952.3, 524.6];
const FIT_ANGLE = (-37.4 * Math.PI) / 180;
const fitPt = (p: Pt, k: number): Pt => {
	const a = FIT_ANGLE * k;
	const dx = p[0] - FIT_FROM[0];
	const dy = p[1] - FIT_FROM[1];
	return [FIT_FROM[0] + (FIT_TO[0] - FIT_FROM[0]) * k + dx * Math.cos(a) - dy * Math.sin(a), FIT_FROM[1] + (FIT_TO[1] - FIT_FROM[1]) * k + dx * Math.sin(a) + dy * Math.cos(a)];
};
const fitK = (f: number) => track(f, [[T.fit + 6, 0], [T.fit + 76, 1], [T.drift + 4, 1], [T.drift + 104, 0]]);

/** 拼合后的坐标落在哪条色带上：1 = 相同的岩层（青），2 = 相同的化石（玫红） */
const BAND = (() => {
	const out: number[] = [];
	CONT.forEach((c, k) => {
		c.pts.forEach((p) => {
			if (k !== SA_IDX && k !== AF_IDX) return out.push(0);
			const q = k === SA_IDX ? fitPt(p, 1) : p;
			const nearSeam = Math.abs(q[0] - 905) < 190;
			out.push(nearSeam && q[1] > 470 && q[1] < 500 ? 1 : nearSeam && q[1] > 575 && q[1] < 602 ? 2 : 0);
		});
	});
	return out;
})();

export function rockStages(mask: Pt[] | null, book: {pts: Pt[]; truth: number}): Stage[] {
	const mapPts = () => CONT.flatMap((c) => c.pts);
	const contOf = (i: number) => {
		let k = CONT.length - 1;
		while (k > 0 && i < OFFSET[k]) k--;
		return k;
	};
	const home = mask ?? [[0.5, 0.5] as Pt];
	return [
		// 第 2 段末尾的那颗光点：随岩缝移到画面中心，再没入地里
		{
			at: T.rock,
			dur: 1,
			spread: 0,
			pts: (f) => book.pts.map((p, i) => (i === book.truth ? ([960, track(f, [[T.rock, 1000], [T.rock + 70, 560]])] as Pt) : ([p[0], p[1] + 90] as Pt))),
			alpha: (i, f) => (i === book.truth ? 3 * interpolate(f, [T.strata + 8, T.strata + 40], [1, 0], clamp) : 0),
			size: (i) => (i === book.truth ? 4 : 1),
		},
		{at: T.lands, dur: 50, spread: 40, pts: mapPts, alpha: () => 0.5},
		{at: T.atlantic + 6, dur: 40, spread: 20, pts: mapPts, alpha: (i) => (contOf(i) === SA_IDX || contOf(i) === AF_IDX ? 0.95 : 0)},
		{
			at: T.fit,
			dur: 1,
			spread: 0,
			pts: (f) => {
				const k = fitK(f);
				return CONT.flatMap((c, ci) => (ci === SA_IDX ? c.pts.map((p) => fitPt(p, k)) : c.pts));
			},
			alpha: (i) => (contOf(i) === SA_IDX || contOf(i) === AF_IDX ? 0.95 : 0),
			color: (i, f) => (f > T.fit + 60 ? BAND[i] ?? 0 : 0),
			size: (i, f) => (f > T.fit + 60 && BAND[i] ? 1.25 : 1),
		},
		// 地图的光点流进雷吉洛克的身体
		{at: T.home, dur: 70, spread: 50, pts: (f) => Array.from({length: 2000}, (_, i) => rockUV(f, home[(i * 37) % home.length])), alpha: () => 0.75, color: (i) => BAND[i] ?? 0},
		{at: T.home + 96, dur: 40, spread: 20, pts: (f) => Array.from({length: 2000}, (_, i) => rockUV(f, home[(i * 37) % home.length])), alpha: () => 0},
	];
}
