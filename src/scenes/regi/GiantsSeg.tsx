import {useLayoutEffect, useRef} from 'react';
import {interpolate, staticFile} from 'remotion';
import {DirLight, PokemonArt3D} from '../../components/PokemonArt3D';
import {SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {BASE_FPS} from '../../time';
import {H, T, track, vecAt, W} from './common';
import {GLView} from './GLView';
import {COAST_FRAG} from './gl';
import {artToScreen} from './Rocks';
import {rockPlace} from './RockSeg';
import {CONT, Pt} from './shapes';

/**
 * 第 3 段 · 冰河、地底与造物主。
 * 每只宝可梦的立绘以固定的基准位置渲染，移动和缩放用外层 transform；位置关键帧给的是屏幕中心和边长。
 */

type Place = {cx: number; cy: number; size: number; o: number};
type Keys = [number, number[]][];
const placeAt = (f: number, keys: Keys): Place => {
	const [cx, cy, size, o] = vecAt(f, keys);
	return {cx, cy, size, o};
};

// ── 脸上的七个点、雷吉奇卡斯的七个圆孔（立绘 UV，按颜色检测 / 手动标定） ──
export const FACE_DOTS: Record<'regirock' | 'regice' | 'registeel', Pt[]> = {
	regirock: [[0.3238, 0.178], [0.4081, 0.1769], [0.3175, 0.2171], [0.3587, 0.2177], [0.4048, 0.2169], [0.3088, 0.2559], [0.4068, 0.259]],
	regice: [[0.5954, 0.227], [0.5109, 0.2708], [0.5559, 0.27], [0.5996, 0.2707], [0.6401, 0.2679], [0.6637, 0.2665], [0.604, 0.3115]],
	registeel: [[0.4555, 0.2897], [0.5323, 0.2901], [0.4172, 0.334], [0.4926, 0.3348], [0.5663, 0.3363], [0.4555, 0.3801], [0.5312, 0.3826]],
};
export const GIGAS_HOLES: Pt[] = [[0.439, 0.194], [0.471, 0.22], [0.401, 0.235], [0.415, 0.269], [0.416, 0.3275], [0.426, 0.3815], [0.438, 0.44]];

// ── 位置 ──
const ICE_BASE = {x: 960, y: 540, size: 600};
const ICE_KEYS: Keys = [
	[T.giants + 70, [1190, 470, 560, 0]],
	[T.regice, [1190, 470, 560, 1]],
	[T.magma + 70, [1190, 470, 560, 1]],
	[T.coast - 4, [1250, 440, 520, 0]],
	[T.tri, [1100, 600, 440, 0]],
	[T.tri + 40, [960, 600, 440, 1]],
	[T.holes - 10, [960, 600, 440, 1]],
	[T.holes + 50, [960, 760, 260, 1]],
	[T.king, [960, 760, 260, 1]],
	[T.king + 50, [960, 780, 260, 0]],
];
const STEEL_BASE = {x: 960, y: 540, size: 600};
const STEEL_KEYS: Keys = [
	[T.registeel - 60, [960, 1000, 520, 0]],
	[T.registeel, [960, 540, 560, 1]],
	[T.tri, [960, 540, 560, 1]],
	[T.tri + 40, [1600, 600, 440, 1]],
	[T.holes - 10, [1600, 600, 440, 1]],
	[T.holes + 50, [1380, 760, 260, 1]],
	[T.king, [1380, 760, 260, 1]],
	[T.king + 50, [1380, 780, 260, 0]],
];
const GIGAS_BASE = {x: 960, y: 500, size: 1050};
const GIGAS_KEYS: Keys = [
	[T.holes, [960, 860, 1050, 0]],
	[T.holes + 70, [960, 500, 1050, 1]],
	[T.king, [960, 500, 1050, 1]],
	[T.why, [960, 540, 1180, 1]],
	[T.endA, [960, 545, 1200, 1]],
	// 第 4 段开头：退进黑暗
	[T.tundra + 76, [960, 560, 1150, 0]],
];

export const icePlace = (f: number) => placeAt(f, ICE_KEYS);
export const steelPlace = (f: number) => placeAt(f, STEEL_KEYS);
export const gigasPlace = (f: number) => placeAt(f, GIGAS_KEYS);
const rockP = (f: number): Place => {
	const {dx, dy, k, o} = rockPlace(f);
	return {cx: 960 + dx, cy: 540 + dy, size: 700 * k, o};
};

const Placed: React.FC<{p: Place; base: {x: number; y: number; size: number}; children: React.ReactNode}> = ({p, base, children}) => (
	<div
		style={{
			position: 'absolute',
			left: 0,
			top: 0,
			width: W,
			height: H,
			opacity: p.o,
			display: p.o > 0.001 ? 'block' : 'none',
			transform: `translate(${p.cx - base.x}px, ${p.cy - base.y}px) scale(${p.size / base.size})`,
			transformOrigin: `${base.x}px ${base.y}px`,
		}}
	>
		{children}
	</div>
);

/** 只照在立绘上的一层（用立绘本身做遮罩） */
const ArtMasked: React.FC<{dir: string; base: {x: number; y: number; size: number}; style: React.CSSProperties; scale?: number}> = ({dir, base, style, scale = 1}) => {
	const s = base.size * scale;
	const url = `url(${staticFile(`${dir}/art.png`)})`;
	return (
		<div
			style={{
				position: 'absolute',
				left: base.x - s / 2,
				top: base.y - s / 2,
				width: s,
				height: s,
				WebkitMaskImage: url,
				WebkitMaskSize: '100% 100%',
				maskImage: url,
				maskSize: '100% 100%',
				...style,
			}}
		/>
	);
};

// ── 雷吉艾斯：冰层、熔岩 ──
export const RegiceLayer: React.FC<{f: number}> = ({f}) => {
	const p = icePlace(f);
	const magma = interpolate(f, [T.magma, T.magma + 20, T.coast - 20, T.coast], [0, 1, 1, 0], clamp);
	const pulse = 0.75 + 0.25 * Math.sin(f * 0.21);
	const inIce = interpolate(f, [T.giants + 70, T.regice + 10, T.coast - 20, T.coast], [1, 1, 1, 0], clamp) * (f < T.tri ? 1 : 0);
	const gold = interpolate(f, [T.holes + 40, T.regigigas], [0, 1], clamp);
	const lights: DirLight[] = [{dir: [-0.4, -0.8, 0.5], color: [0.95, 1.05, 1.2], wrap: 0.4}];
	if (magma > 0) lights.push({dir: [0.0, 1.0, 0.25], color: [2.2 * magma * pulse, 0.7 * magma * pulse, 0.2 * magma * pulse], wrap: 0.3});
	return (
		<>
			{magma > 0 ? (
				<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: magma, background: `radial-gradient(ellipse 70% 38% at 62% 108%, rgba(255,110,30,${0.55 * pulse}) 0%, rgba(200,50,10,0.25) 45%, rgba(0,0,0,0) 80%)`}} />
			) : null}
			<Placed p={p} base={ICE_BASE}>
				<PokemonArt3D
					dir="pokemon/regice"
					x={ICE_BASE.x}
					y={ICE_BASE.y}
					size={ICE_BASE.size}
					depthScale={0.5}
					ambient={[0.42, 0.5, 0.6]}
					dirLights={lights}
					rim={{dir: [-0.5, -0.8], color: [0.7 + gold * 0.6, 0.95 + gold * 0.1, 1.2 - gold * 0.6], power: 2.2}}
				/>
				{/* 冻在冰层里：一层半透明的冰和年层纹 */}
				{inIce > 0 ? (
					<ArtMasked
						dir="pokemon/regice"
						base={ICE_BASE}
						scale={1}
						style={{opacity: 0.32 * inIce, background: 'repeating-linear-gradient(178deg, rgba(220,240,255,0.55) 0px, rgba(220,240,255,0.55) 2px, rgba(160,205,230,0.25) 2px, rgba(160,205,230,0.25) 13px)', mixBlendMode: 'screen'}}
					/>
				) : null}
			</Placed>
			{/* 熔岩烤上来的白汽 */}
			{magma > 0
				? Array.from({length: 9}, (_, i) => {
						const t = ((f - T.magma) * 0.012 + i / 9) % 1;
						const x = 1050 + ((i * 53) % 280);
						const y = 860 - t * 380;
						return <div key={i} style={{position: 'absolute', left: x - 80, top: y - 60, width: 160, height: 120, borderRadius: '50%', opacity: magma * Math.sin(t * Math.PI) * 0.35, background: 'radial-gradient(closest-side, rgba(235,240,245,0.8), rgba(235,240,245,0))', filter: 'blur(6px)'}} />;
					})
				: null}
		</>
	);
};

// ── 雷吉斯奇鲁：地幔、压力、中空、金属光泽 ──
export const RegisteelLayer: React.FC<{f: number}> = ({f}) => {
	const p = steelPlace(f);
	const heat = interpolate(f, [T.registeel - 60, T.registeel, T.metal, T.tri + 30], [1, 1, 0.55, 0.2], clamp);
	const hollow = interpolate(f, [T.pressure + 70, T.pressure + 90, T.metal - 14, T.metal], [0, 1, 1, 0], clamp);
	const sheenP = track(f, [[T.metal + 6, -0.3], [T.metal + 70, 1.3]], (t) => t);
	const sheen = interpolate(f, [T.metal, T.metal + 6, T.metal + 70, T.metal + 80], [0, 1, 1, 0], clamp);
	const gold = interpolate(f, [T.holes + 40, T.regigigas], [0, 1], clamp);
	return (
		<Placed p={p} base={STEEL_BASE}>
			<PokemonArt3D
				dir="pokemon/registeel"
				x={STEEL_BASE.x}
				y={STEEL_BASE.y}
				size={STEEL_BASE.size}
				depthScale={0.5}
				ambient={[0.32, 0.3, 0.3]}
				dirLights={[
					{dir: [-0.5, -0.7, 0.5], color: [0.9, 0.9, 0.95], wrap: 0.4},
					{dir: [0.0, 1.0, 0.3], color: [2.0 * heat, 0.6 * heat, 0.15 * heat], wrap: 0.3},
				]}
				rim={{dir: [0.4, 0.9], color: [1.4 * heat + gold * 0.8, 0.5 * heat + gold * 0.6, 0.15 + gold * 0.2], power: 2.0}}
			/>
			{/* 中空：身体里面一片空荡 */}
			{hollow > 0 ? (
				<>
					<ArtMasked dir="pokemon/registeel" base={STEEL_BASE} scale={0.72} style={{opacity: hollow * 0.7, background: 'radial-gradient(ellipse at 50% 45%, rgba(4,6,10,0.95) 0%, rgba(4,6,10,0.85) 55%, rgba(4,6,10,0) 80%)'}} />
					<ArtMasked dir="pokemon/registeel" base={STEEL_BASE} scale={0.72} style={{opacity: hollow * 0.5, background: 'repeating-linear-gradient(0deg, rgba(120,235,255,0.35) 0px, rgba(120,235,255,0.35) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 9px)', mixBlendMode: 'screen'}} />
				</>
			) : null}
			{sheen > 0 ? (
				<ArtMasked
					dir="pokemon/registeel"
					base={STEEL_BASE}
					style={{opacity: sheen, mixBlendMode: 'screen', background: `linear-gradient(115deg, rgba(255,255,255,0) ${sheenP * 100 - 12}%, rgba(235,245,255,0.75) ${sheenP * 100}%, rgba(255,255,255,0) ${sheenP * 100 + 10}%)`}}
				/>
			) : null}
		</Placed>
	);
};

/** 压力：八个方向的箭头一拍一拍往里压 */
export const Pressure: React.FC<{f: number}> = ({f}) => {
	const vis = interpolate(f, [T.pressure, T.pressure + 14, T.pressure + 80, T.pressure + 100], [0, 1, 1, 0], clamp);
	if (vis <= 0) return null;
	const p = steelPlace(f);
	return (
		<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
			{Array.from({length: 8}, (_, i) => {
				const a = (i / 8) * Math.PI * 2 + 0.2;
				const beat = ((f - T.pressure) / 26) % 1;
				const r0 = 380 - beat * 70;
				const r1 = r0 - 90;
				const x0 = p.cx + Math.cos(a) * r0;
				const y0 = p.cy + Math.sin(a) * r0 * 0.8;
				const x1 = p.cx + Math.cos(a) * r1;
				const y1 = p.cy + Math.sin(a) * r1 * 0.8;
				const hx = Math.cos(a + Math.PI);
				const hy = Math.sin(a + Math.PI);
				return (
					<g key={i} opacity={vis * (1 - beat * 0.6)} stroke="#ffb27a" strokeWidth={4} fill="none" strokeLinecap="round">
						<line x1={x0} y1={y0} x2={x1} y2={y1} />
						<polyline points={`${x1 - hy * 16 - hx * 16},${y1 + hx * 16 - hy * 16} ${x1},${y1} ${x1 + hy * 16 - hx * 16},${y1 - hx * 16 - hy * 16}`} />
					</g>
				);
			})}
		</svg>
	);
};

// ── 海岸剖面：冰河时期的海面 ──
const COAST_VIEW: Keys = [
	[T.coast - 10, [0.6, -50, 520]],
	[T.cave, [0.6, -50, 520]],
	[T.cave + 70, [2.8, -72, 150]],
	[T.deep, [2.8, -78, 120]],
];
const seaLevel = (f: number) => track(f, [[T.seaDrop + 10, 0], [T.seaDrop + 100, -120], [T.melt + 10, -120], [T.melt + 110, 0]]);
const glacier = (f: number) => track(f, [[T.seaDrop, 0], [T.seaDrop + 100, 1], [T.melt, 1], [T.melt + 90, 0]]);
export const coastOpacity = (f: number) => interpolate(f, [T.coast - 10, T.coast + 10, T.deep - 10, T.deep + 14], [0, 1, 1, 0], clamp);

export const CoastView: React.FC<{f: number}> = ({f}) => {
	const [vx, vy, vz] = vecAt(f, COAST_VIEW);
	const o = coastOpacity(f);
	if (o <= 0) return null;
	const sea = seaLevel(f);
	// 米 → 屏幕
	const sy = (Y: number) => H / 2 - ((Y - vy) / vz) * H;
	const labelO = interpolate(f, [T.coast + 20, T.coast + 40, T.cave, T.cave + 30], [0, 1, 1, 0], clamp);
	const lowO = interpolate(f, [T.seaDrop + 80, T.seaDrop + 100, T.cave, T.cave + 30], [0, 1, 1, 0], clamp);
	const line = (Y: number, text: string, op: number, col: string) => (
		<div style={{position: 'absolute', left: 1080, width: 760, top: sy(Y) - 1, borderTop: `2px dashed ${col}`, opacity: op}}>
			<span style={{position: 'absolute', right: 0, top: -38, fontFamily: SERIF, fontSize: 26, letterSpacing: 3, color: col, textShadow: '0 0 10px rgba(0,0,0,0.9)'}}>{text}</span>
		</div>
	);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
			<GLView
				frag={COAST_FRAG}
				uniforms={{uTime: f / BASE_FPS, uView: [vx, vy, vz], uSea: sea, uGlacier: glacier(f), uExposure: 1.5, uFade: 0}}
			/>
			{line(0, '今天的海面', labelO, 'rgba(200,236,240,0.85)')}
			{line(-120, '冰河时期的海面 约 −120 米', lowO, 'rgba(255,214,150,0.9)')}
		</div>
	);
};

// ── 七个点、七个圆孔 ──
const CLUSTER_AT: Record<string, Pt> = {regirock: [640, 250], regice: [960, 250], registeel: [1280, 250]};
const placeOf = (name: 'regirock' | 'regice' | 'registeel', f: number) => (name === 'regirock' ? rockP(f) : name === 'regice' ? icePlace(f) : steelPlace(f));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const Dots: React.FC<{f: number}> = ({f}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		const dot = (x: number, y: number, r: number, a: number) => {
			if (a <= 0) return;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
			g.addColorStop(0, `rgba(255,240,200,${a})`);
			g.addColorStop(0.3, `rgba(255,200,110,${a * 0.9})`);
			g.addColorStop(1, 'rgba(255,160,60,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
			ctx.fill();
		};
		ctx.globalCompositeOperation = 'lighter';
		// 三张脸上的七个点：亮起 → 飘到画面中间排成三组 → 飞回脸上
		(['regirock', 'regice', 'registeel'] as const).forEach((name, gi) => {
			const pl = placeOf(name, f);
			const uvs = FACE_DOTS[name];
			const mu: Pt = [uvs.reduce((a, u) => a + u[0], 0) / 7, uvs.reduce((a, u) => a + u[1], 0) / 7];
			uvs.forEach((uv, i) => {
				const on = interpolate(f, [T.dots + gi * 12 + i * 3, T.dots + gi * 12 + i * 3 + 10], [0, 1], clamp);
				const off = interpolate(f, [T.regigigas + 40, T.made + 20], [1, 0.35], clamp) * interpolate(f, [T.king, T.king + 40], [1, 0], clamp);
				if (on <= 0) return;
				const face = artToScreen(uv, pl.cx, pl.cy, pl.size);
				const k = ease(interpolate(f, [T.cluster + gi * 6, T.cluster + 40 + gi * 6], [0, 1], clamp)) * (1 - ease(interpolate(f, [T.holes + 10, T.holes + 50], [0, 1], clamp)));
				const c0 = CLUSTER_AT[name];
				const cl: Pt = [c0[0] + (uv[0] - mu[0]) * 1500, c0[1] + (uv[1] - mu[1]) * 1500];
				const x = face[0] + (cl[0] - face[0]) * k;
				const y = face[1] + (cl[1] - face[1]) * k;
				const r = (pl.size / 600) * 7 * (1 - k) + 9 * k;
				dot(x, y, r, on * off * (0.75 + 0.25 * Math.sin(f * 0.1 + i)) * pl.o);
			});
		});
		// 雷吉奇卡斯的七个圆孔：一个接一个亮起
		const gp = gigasPlace(f);
		GIGAS_HOLES.forEach((uv, i) => {
			const on = interpolate(f, [T.holes + 66 + i * 7, T.holes + 76 + i * 7], [0, 1], clamp) * interpolate(f, [T.regigigas + 10, T.regigigas + 60, T.why, T.why + 50], [1, 0.45, 0.45, 1], clamp);
			const p = artToScreen(uv, gp.cx, gp.cy, gp.size);
			dot(p[0], p[1], (gp.size / 1050) * 9, on * gp.o);
		});
		ctx.globalCompositeOperation = 'source-over';
	});
	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};

// ── 雷吉奇卡斯 ──
export const RegigigasLayer: React.FC<{f: number}> = ({f}) => {
	const p = gigasPlace(f);
	const reveal = interpolate(f, [T.regigigas - 6, T.regigigas + 26, T.why, T.why + 70], [0, 1, 1, 0.15], clamp);
	return (
		<Placed p={p} base={GIGAS_BASE}>
			<PokemonArt3D
				dir="pokemon/regigigas"
				x={GIGAS_BASE.x}
				y={GIGAS_BASE.y}
				size={GIGAS_BASE.size}
				depthScale={0.5}
				ambient={[0.03 + reveal * 0.62, 0.035 + reveal * 0.58, 0.045 + reveal * 0.52]}
				brightness={0.32 + reveal * 0.68}
				dirLights={[{dir: [-0.5, -0.7, 0.6], color: [reveal * 1.0, reveal * 0.85, reveal * 0.65], wrap: 0.4}]}
				rim={{dir: [0, -1], color: [1.6, 1.0, 0.45], power: 3.0}}
			/>
		</Placed>
	);
};

/** "做出了和自己相像的宝可梦"：从它胸口牵出三道金线，连到三个巨人 */
export const Threads: React.FC<{f: number}> = ({f}) => {
	const vis = interpolate(f, [T.made + 30, T.made + 60, T.drag2 - 10, T.drag2 + 20], [0, 1, 1, 0], clamp);
	if (vis <= 0) return null;
	const gp = gigasPlace(f);
	const from = artToScreen([0.47, 0.36], gp.cx, gp.cy, gp.size);
	return (
		<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
			{(['regirock', 'regice', 'registeel'] as const).map((name, i) => {
				const pl = placeOf(name, f);
				const to = artToScreen(FACE_DOTS[name][3], pl.cx, pl.cy, pl.size);
				const grow = interpolate(f, [T.made + 30 + i * 8, T.made + 70 + i * 8], [0, 1], clamp);
				return (
					<line
						key={name}
						x1={from[0]}
						y1={from[1]}
						x2={from[0] + (to[0] - from[0]) * grow}
						y2={from[1] + (to[1] - from[1]) * grow}
						stroke="#ffd68f"
						strokeWidth={3}
						strokeDasharray="4 8"
						opacity={vis * (0.75 + 0.25 * Math.sin(f * 0.2 + i))}
						style={{filter: 'drop-shadow(0 0 6px rgba(255,190,90,0.9))'}}
					/>
				);
			})}
		</svg>
	);
};

/** "把它们放到了今天的位置"：两只手牵着金色绳索，连到身后的点阵大陆 */
export const KingRopes: React.FC<{f: number}> = ({f}) => {
	const vis = interpolate(f, [T.drag2 + 30, T.drag2 + 60, T.king - 10, T.king + 20], [0, 1, 1, 0], clamp);
	if (vis <= 0) return null;
	const gp = gigasPlace(f);
	const hands: Pt[] = [artToScreen([0.08, 0.66], gp.cx, gp.cy, gp.size), artToScreen([0.92, 0.66], gp.cx, gp.cy, gp.size)];
	return (
		<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
			{CONT.map((c, i) => {
				const hand = c.c[0] < 960 ? hands[0] : hands[1];
				const grow = interpolate(f, [T.drag2 + 30 + i * 5, T.drag2 + 70 + i * 5], [0, 1], clamp);
				const end: Pt = [hand[0] + (c.c[0] - hand[0]) * grow, hand[1] + (c.c[1] - hand[1]) * grow];
				const mid: Pt = [(hand[0] + end[0]) / 2, (hand[1] + end[1]) / 2 + 30];
				return <path key={c.name} d={`M${hand[0]},${hand[1]} Q${mid[0]},${mid[1]} ${end[0]},${end[1]}`} stroke="#ffd68f" strokeWidth={3} fill="none" strokeDasharray="3 8" opacity={vis * 0.85} style={{filter: 'drop-shadow(0 0 5px rgba(255,190,90,0.9))'}} />;
			})}
		</svg>
	);
};

/** 雷吉奇卡斯身后的点阵大陆（只淡入淡出，画在雷吉奇卡斯后面） */
export const MapBehind: React.FC<{f: number}> = ({f}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		const vis = interpolate(f, [T.drag2 + 10, T.drag2 + 50, T.king, T.king + 40], [0, 1, 1, 0], clamp);
		if (vis <= 0) return;
		ctx.globalCompositeOperation = 'lighter';
		CONT.forEach((cont, ci) => {
			const a = vis * interpolate(f, [T.drag2 + 10 + ci * 5, T.drag2 + 40 + ci * 5], [0, 1], clamp);
			cont.pts.forEach((p, i) => {
				const tw = 0.7 + 0.3 * Math.sin(f * 0.08 + i * 1.7);
				const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 7);
				g.addColorStop(0, `rgba(255,225,170,${0.75 * a * tw})`);
				g.addColorStop(1, 'rgba(255,170,70,0)');
				ctx.fillStyle = g;
				ctx.fillRect(p[0] - 7, p[1] - 7, 14, 14);
			});
		});
		ctx.globalCompositeOperation = 'source-over';
	});
	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};
