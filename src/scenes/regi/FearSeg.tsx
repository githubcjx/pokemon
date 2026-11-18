import {useLayoutEffect, useRef} from 'react';
import {interpolate, staticFile} from 'remotion';
import {DirLight, PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {BASE_FPS} from '../../time';
import {flow, H, T, track, vecAt, W} from './common';
import {rng} from './DotTitle';
import {FACE_DOTS} from './GiantsSeg';
import {GLView} from './GLView';
import {DOORS_FRAG, TUNDRA_FRAG} from './gl4';
import {artToScreen, RockAssembly, useArtMask} from './Rocks';
import {Pt} from './shapes';

/**
 * 第 4 段 · 古人怕的是什么。
 * 雪原部分：所有角色都摆在"基准构图"（1920×1080）上，整组随镜头（中心 + 推近倍数）一起变换；背景着色器用同一个镜头。
 * 石门部分：角色摆在门的世界坐标上，按石门的取景换算到屏幕。
 */

type Keys = [number, number[]][];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ── 雪原的镜头 ──
const TUNDRA_CAM: Keys = [
	[T.tundra, [960, 540, 1.0]],
	[T.elekiLine - 6, [960, 540, 1.0]],
	[T.eleki + 16, [1150, 470, 1.3]],
	[T.power + 6, [1150, 470, 1.3]],
	[T.power + 66, [900, 560, 1.0]],
	[T.rings - 4, [900, 560, 1.0]],
	[T.rings + 46, [1225, 455, 1.55]],
	[T.dragoLine - 6, [1225, 455, 1.55]],
	[T.dragoLine + 44, [960, 540, 1.0]],
	[T.endB, [960, 540, 1.0]],
];
export const tundraCam = (f: number) => {
	const [cx, cy, z] = flow(f, TUNDRA_CAM);
	// "整个国家都会毁灭"：轻微的震动（震动时略微推近，不露边）
	const q = interpolate(f, [T.doom + 40, T.doom + 60, T.doom + 110, T.doom + 140], [0, 1, 1, 0], clamp);
	const sx = (Math.sin(f * 2.3) + Math.sin(f * 3.7)) * 3 * q;
	const sy = (Math.sin(f * 2.9 + 1) + Math.sin(f * 4.1)) * 2.5 * q;
	return {cx: cx + sx, cy: cy + sy, z: z * (1 + 0.02 * q)};
};
export const tundraOpacity = (f: number) =>
	interpolate(f, [T.tundra + 8, T.tundra + 76, T.seal - 6, T.seal + 34], [0, 1, 1, 0], clamp) +
	// 第 6 段：皮欧尼所在的王冠雪原
	interpolate(f, [T.honor + 96, T.peony + 14, T.solve - 20, T.solve + 20], [0, 1, 1, 0], clamp) +
	// 第 7 段：伽勒尔的巨人睡榻（第 8 段开头淡出）
	interpolate(f, [T.bed - 24, T.bed + 20, T.endE + 4, T.endE + 50], [0, 1, 1, 0], clamp);

/** 前景山脊（与 TUNDRA_FRAG 的 ridge 一致）：基准像素 x → 山脊线的 y */
export const ridgeY = (x: number) => {
	const u = (x - 960) / 1080;
	return 540 - (-0.16 + 0.1 * u + 0.02 * Math.sin(u * 3.1 + 0.5) + 0.01 * Math.sin(u * 7.3)) * 1080;
};

/** 灾祸时天色偏红；"整个国家都会毁灭"时更暗更红 */
const tintAt = (f: number): [number, number, number] => {
	const a = interpolate(f, [T.disaster + 10, T.disaster + 40, T.rings + 20, T.rings + 80], [0, 1, 1, 0], clamp);
	const b = interpolate(f, [T.doom + 20, T.doom + 60, T.seal - 20, T.seal + 20], [0, 1, 1, 0], clamp);
	return [1 + 0.35 * a + 0.4 * b, 1 - 0.2 * a - 0.35 * b, 1 - 0.3 * a - 0.4 * b];
};

// ── 灯、雷击 ──
type Town = {c: Pt; n: number; r: number; d: number};
const HUB: Pt = [960, 640];
const TOWNS: Town[] = ([
	{c: [150, 708], n: 46, r: 46, d: 0},
	{c: [330, 655], n: 34, r: 34, d: 0},
	{c: [470, 726], n: 40, r: 42, d: 0},
	{c: [640, 642], n: 30, r: 30, d: 0},
	{c: [760, 694], n: 36, r: 38, d: 0},
	{c: [560, 618], n: 18, r: 22, d: 0},
	{c: [880, 625], n: 22, r: 24, d: 0},
	{c: [250, 622], n: 16, r: 22, d: 0},
] as Town[]).map((t) => ({...t, d: Math.hypot(t.c[0] - HUB[0], t.c[1] - HUB[1])}));
const TOWN_DOTS = (() => {
	const r = rng(894);
	return TOWNS.map((t) =>
		Array.from({length: t.n}, () => {
			const a = r() * Math.PI * 2;
			const d = Math.sqrt(r()) * t.r;
			return {p: [t.c[0] + Math.cos(a) * d * 1.6, t.c[1] + Math.sin(a) * d * 0.45] as Pt, tw: r() * 6.28, s: 0.6 + r() * 0.8};
		}),
	);
})();
/** 电线连成一张网：从中枢往外，按距离由近到远 */
const LINKS: [Pt, Pt][] = (() => {
	const order = [...TOWNS].sort((a, b) => a.d - b.d);
	const out: [Pt, Pt][] = [];
	order.forEach((t, i) => {
		const prev = i === 0 ? HUB : order.slice(0, i).reduce((best, o) => (Math.hypot(o.c[0] - t.c[0], o.c[1] - t.c[1]) < Math.hypot(best[0] - t.c[0], best[1] - t.c[1]) ? o.c : best), HUB);
		out.push([prev, t.c]);
	});
	return out;
})();
const lightOn = (f: number, t: Town) => interpolate(f, [T.power + 24 + t.d * 0.08, T.power + 40 + t.d * 0.08], [0, 1], clamp);
/** 第 i 个城镇被雷击中的时刻 */
const STRIKE = TOWNS.map((_, i) => T.disaster + 14 + ((i * 5) % 8) * 9);

/** 锯齿形的闪电：从 a 到 b，seed 决定形状 */
function bolt(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, seed: number, alpha: number, width: number, col: string) {
	const r = rng(seed);
	const n = 12;
	const pts: Pt[] = [];
	const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const nx = -(b[1] - a[1]) / len;
	const ny = (b[0] - a[0]) / len;
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const j = i === 0 || i === n ? 0 : (r() - 0.5) * len * 0.16;
		pts.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j]);
	}
	const path = () => {
		ctx.beginPath();
		pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
	};
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.globalAlpha = alpha * 0.25;
	ctx.strokeStyle = col;
	ctx.lineWidth = width * 5;
	path();
	ctx.stroke();
	ctx.globalAlpha = alpha * 0.9;
	ctx.lineWidth = width;
	ctx.strokeStyle = '#fff6d0';
	path();
	ctx.stroke();
	ctx.globalAlpha = 1;
}

const useCanvas = (draw: (ctx: CanvasRenderingContext2D) => void) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		draw(ctx);
	});
	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};

/** 山下平原的灯：雷吉艾勒奇一个就能点亮整个伽勒尔；灾祸时被雷击成红色、熄灭 */
const Lights: React.FC<{f: number}> = ({f}) =>
	useCanvas((ctx) => {
		const vis = interpolate(f, [T.power + 10, T.power + 30, T.rings + 30, T.rings + 70], [0, 1, 1, 0], clamp);
		if (vis <= 0) return;
		ctx.globalCompositeOperation = 'lighter';
		// 电线
		LINKS.forEach(([a, b], i) => {
			const t = TOWNS.find((o) => o.c === b)!;
			const grow = interpolate(f, [T.power + 14 + t.d * 0.08, T.power + 32 + t.d * 0.08], [0, 1], clamp);
			if (grow <= 0) return;
			const ti = TOWNS.indexOf(t);
			const hit = interpolate(f, [STRIKE[ti], STRIKE[ti] + 6, STRIKE[ti] + 40], [0, 1, 0.15], clamp);
			const red = f >= STRIKE[ti] ? 1 : 0;
			ctx.globalAlpha = vis * (0.55 - red * 0.35 + hit * 0.4) * (0.75 + 0.25 * Math.sin(f * 0.3 + i));
			ctx.strokeStyle = red ? '#ff6a3a' : '#ffd27a';
			ctx.lineWidth = 1.6;
			ctx.setLineDash([4, 6]);
			ctx.lineDashOffset = -f * 1.2;
			ctx.beginPath();
			ctx.moveTo(a[0], a[1]);
			ctx.lineTo(a[0] + (b[0] - a[0]) * grow, a[1] + (b[1] - a[1]) * grow);
			ctx.stroke();
		});
		ctx.setLineDash([]);
		// 城镇的灯
		TOWNS.forEach((t, ti) => {
			const on = lightOn(f, t);
			const hit = f - STRIKE[ti];
			const burn = interpolate(hit, [0, 4, 30, 70], [0, 1, 0.6, 0], clamp);
			const out = interpolate(hit, [6, 60], [1, 0.08], clamp);
			TOWN_DOTS[ti].forEach((d) => {
				const a = vis * on * out * (0.7 + 0.3 * Math.sin(f * 0.15 + d.tw));
				const rr = 2.2 * d.s * (0.6 + 0.4 * ((d.p[1] - 600) / 130));
				if (a > 0.01) {
					const g = ctx.createRadialGradient(d.p[0], d.p[1], 0, d.p[0], d.p[1], rr * 3);
					g.addColorStop(0, `rgba(255,236,180,${a})`);
					g.addColorStop(1, 'rgba(255,190,90,0)');
					ctx.fillStyle = g;
					ctx.fillRect(d.p[0] - rr * 3, d.p[1] - rr * 3, rr * 6, rr * 6);
				}
				if (burn > 0) {
					const g = ctx.createRadialGradient(d.p[0], d.p[1], 0, d.p[0], d.p[1], rr * 5);
					g.addColorStop(0, `rgba(255,120,60,${burn * vis * 0.8})`);
					g.addColorStop(1, 'rgba(255,60,20,0)');
					ctx.fillStyle = g;
					ctx.fillRect(d.p[0] - rr * 5, d.p[1] - rr * 5, rr * 10, rr * 10);
				}
			});
			// 着火一样的红光
			if (burn > 0) {
				const g = ctx.createRadialGradient(t.c[0], t.c[1], 0, t.c[0], t.c[1], t.r * 2.6);
				g.addColorStop(0, `rgba(255,110,50,${burn * 0.45 * vis})`);
				g.addColorStop(1, 'rgba(255,60,20,0)');
				ctx.fillStyle = g;
				ctx.fillRect(t.c[0] - t.r * 2.6, t.c[1] - t.r * 2.6, t.r * 5.2, t.r * 5.2);
			}
		});
		ctx.globalCompositeOperation = 'source-over';
	});

// ── 山脊上的五个巨人（剪影） ──
export type Giant = {dir: string; x: number; size: number; foot: number; rim: [number, number, number]; at: number};
export const GIANTS: Giant[] = [
	{dir: 'regirock', x: 300, size: 300, foot: 0.988, rim: [0.75, 0.85, 1.05], at: T.notThree + 2},
	{dir: 'regice', x: 565, size: 300, foot: 0.987, rim: [0.75, 0.85, 1.05], at: T.notThree + 10},
	{dir: 'registeel', x: 830, size: 340, foot: 0.867, rim: [0.75, 0.85, 1.05], at: T.notThree + 18},
	{dir: 'regidrago', x: 1580, size: 360, foot: 0.971, rim: [1.5, 0.35, 0.4], at: T.notThree + 46},
];
export const ELEKI_SIL: Pt = [1210, ridgeY(1210) - 190];
export const giantY = (g: Giant) => ridgeY(g.x) - (g.foot - 0.5) * g.size;

const Silhouettes: React.FC<{f: number}> = ({f}) => (
	<>
		{GIANTS.map((g) => {
			const o = interpolate(f, [g.at, g.at + 30, T.elekiLine + 4, T.elekiLine + 40], [0, 1, 1, 0], clamp);
			if (o <= 0) return null;
			return (
				<PokemonArt3D
					key={g.dir}
					dir={`pokemon/${g.dir}`}
					x={g.x}
					y={giantY(g)}
					size={g.size}
					depthScale={0.5}
					ambient={[0.04, 0.045, 0.06]}
					brightness={0.4}
					rim={{dir: [-0.6, -0.8], color: [g.rim[0] * 1.5, g.rim[1] * 1.5, g.rim[2] * 1.5], power: 2.4}}
					opacity={o}
				/>
			);
		})}
	</>
);

// ── 雷吉艾勒奇 ──
const ELEKI_BASE = {x: 960, y: 540, size: 600};
const ELEKI_KEYS: Keys = [
	[T.elekiLine, [ELEKI_SIL[0], ELEKI_SIL[1], 400]],
	[T.eleki + 6, [1250, 440, 540]],
	[T.dragoLine, [1250, 440, 540]],
	[T.dragoLine + 50, [1430, 400, 500]],
];
const RINGS_AT = [T.rings + 18, T.rings + 42, T.rings + 66];
/** 三个圆环（立绘 UV 的中心、半径、旋转），从左到右：左臂、右臂、尾部一串 */
const RING_UV: {c: Pt; rx: number; ry: number; rot: number}[] = [
	{c: [0.269, 0.509], rx: 0.046, ry: 0.06, rot: -0.35},
	{c: [0.437, 0.443], rx: 0.026, ry: 0.07, rot: 0.1},
	{c: [0.37, 0.585], rx: 0.06, ry: 0.022, rot: 0},
];
/** 电的强度：圆环每扣上一个，就弱一截 */
const charge = (f: number) => 1 - RINGS_AT.reduce((a, t) => a + interpolate(f, [t, t + 10], [0, 0.27], clamp), 0);

const Placed: React.FC<{p: number[]; base: {x: number; y: number; size: number}; o: number; children: React.ReactNode}> = ({p, base, o, children}) => (
	<div
		style={{
			position: 'absolute',
			left: 0,
			top: 0,
			width: W,
			height: H,
			opacity: o,
			transform: `translate(${p[0] - base.x}px, ${p[1] - base.y}px) scale(${p[2] / base.size})`,
			transformOrigin: `${base.x}px ${base.y}px`,
		}}
	>
		{children}
	</div>
);

const Masked: React.FC<{file: string; base: {x: number; y: number; size: number}; style: React.CSSProperties}> = ({file, base, style}) => {
	const url = `url(${staticFile(file)})`;
	return (
		<div
			style={{
				position: 'absolute',
				left: base.x - base.size / 2,
				top: base.y - base.size / 2,
				width: base.size,
				height: base.size,
				WebkitMaskImage: url,
				WebkitMaskSize: '100% 100%',
				maskImage: url,
				maskSize: '100% 100%',
				...style,
			}}
		/>
	);
};

const RegielekiLayer: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.notThree + 38, T.notThree + 68, T.dragoLine + 10, T.dragoLine + 50], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const p = vecAt(f, ELEKI_KEYS);
	const lit = ease(interpolate(f, [T.eleki - 16, T.eleki + 2], [0, 1], clamp));
	const ch = charge(f);
	const flick = 0.75 + 0.25 * Math.sin(f * 1.7) * Math.sin(f * 0.53 + 1);
	const side = lit * ch * flick;
	const lights: DirLight[] = [
		{dir: [-1, -0.2, 0.35], color: [1.7 * side, 1.5 * side, 0.55 * side], wrap: 0.35},
		{dir: [1, -0.1, 0.35], color: [1.2 * side, 1.05 * side, 0.4 * side], wrap: 0.35},
		{dir: [-0.3, -0.8, 0.6], color: [0.55 * lit, 0.6 * lit, 0.7 * lit], wrap: 0.5},
	];
	const ringGlow = RINGS_AT.reduce((a, t) => Math.max(a, interpolate(f, [t, t + 4, t + 30], [0, 1, 0.35], clamp)), 0) * interpolate(f, [T.dragoLine, T.dragoLine + 30], [1, 0], clamp);
	return (
		<Placed p={p} base={ELEKI_BASE} o={o}>
			<PokemonArt3D
				dir="pokemon/regieleki"
				x={ELEKI_BASE.x}
				y={ELEKI_BASE.y}
				size={ELEKI_BASE.size}
				depthScale={0.5}
				ambient={[0.04 + 0.4 * lit, 0.045 + 0.42 * lit, 0.06 + 0.46 * lit]}
				dirLights={lights}
				brightness={0.5 + 0.5 * lit}
				emissive={0.45 * lit * ch}
				emissiveTint={[1.0, 0.95, 0.6]}
				rim={{dir: [-0.6, -0.8], color: [1.5 + 0.3 * lit, 1.35, 0.4], power: 2.4}}
				resolution={2.4}
			/>
			{ringGlow > 0 ? (
				<Masked file="pokemon/regieleki/rings.png" base={ELEKI_BASE} style={{opacity: ringGlow, background: 'rgba(255,205,110,0.9)', mixBlendMode: 'screen', filter: 'drop-shadow(0 0 10px rgba(255,190,90,0.9))'}} />
			) : null}
		</Placed>
	);
};

/** 雷吉艾勒奇身上的电弧、劈向平原的闪电、扣上的圆环（基准坐标） */
const ElekiFx: React.FC<{f: number}> = ({f}) =>
	useCanvas((ctx) => {
		const o = interpolate(f, [T.eleki - 4, T.eleki + 6, T.dragoLine + 10, T.dragoLine + 40], [0, 1, 1, 0], clamp);
		if (o <= 0) return;
		const p = vecAt(f, ELEKI_KEYS);
		const at = (uv: Pt) => artToScreen(uv, p[0], p[1], p[2]);
		const body = at([0.32, 0.45]);
		ctx.globalCompositeOperation = 'lighter';
		// 身上噼啪作响的电弧：每 3 帧换一次形状
		const ch = charge(f);
		const n = Math.round(9 * ch);
		const tick = Math.floor(f / 3);
		const r = rng(tick * 31 + 7);
		for (let i = 0; i < n; i++) {
			const a = r() * Math.PI * 2;
			const len = p[2] * (0.12 + r() * 0.22) * (0.5 + 0.5 * ch);
			const from = at([0.32 + Math.cos(a) * 0.05, 0.45 + Math.sin(a) * 0.05]);
			bolt(ctx, from, [from[0] + Math.cos(a) * len, from[1] + Math.sin(a) * len], tick * 13 + i, o * (0.5 + 0.5 * r()), 1.6, '#ffe36a');
		}
		// 伽勒尔的电：一道电流从它身上流向平原的中枢
		const feed = interpolate(f, [T.power + 6, T.power + 18, T.disaster, T.disaster + 10], [0, 1, 1, 0], clamp);
		if (feed > 0) bolt(ctx, body, HUB, tick * 3 + 1, feed * o * 0.85, 2.2, '#ffd25a');
		// 灾祸：闪电劈向各个城镇
		TOWNS.forEach((t, i) => {
			const k = f - STRIKE[i];
			if (k < -2 || k > 12) return;
			const a = interpolate(k, [-2, 0, 4, 12], [0, 1, 0.7, 0], clamp);
			bolt(ctx, body, t.c, STRIKE[i] * 7 + Math.floor(f / 2), a * o, 2.6, '#ffb34a');
		});
		// 圆环：金色的环从外面飞来，扣在三处
		RING_UV.forEach((rg, i) => {
			const t0 = RINGS_AT[i] - 26;
			const k = interpolate(f, [t0, RINGS_AT[i]], [0, 1], clamp);
			if (k <= 0) return;
			const e = ease(k);
			const c = at(rg.c);
			const dir = [i === 0 ? -1 : i === 1 ? 1 : 0.2, i === 2 ? 1 : -0.6];
			const x = c[0] + dir[0] * 420 * (1 - e);
			const y = c[1] + dir[1] * 300 * (1 - e);
			const sc = 1 + 2.2 * (1 - e);
			const settle = interpolate(f, [RINGS_AT[i], RINGS_AT[i] + 18], [1, 0], clamp);
			const a = (f < RINGS_AT[i] ? Math.min(k * 3, 1) : settle) * o;
			if (a <= 0) return;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(rg.rot + (1 - e) * 1.2);
			ctx.globalAlpha = a;
			ctx.strokeStyle = '#ffd68f';
			ctx.shadowColor = 'rgba(255,190,90,0.95)';
			ctx.shadowBlur = 14;
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.ellipse(0, 0, rg.rx * p[2] * sc * 1.15, rg.ry * p[2] * sc * 1.15, 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
			// 扣上的一瞬：一圈光波
			const pulse = interpolate(f, [RINGS_AT[i], RINGS_AT[i] + 16], [0, 1], clamp);
			if (pulse > 0 && pulse < 1) {
				ctx.globalAlpha = (1 - pulse) * 0.8 * o;
				ctx.strokeStyle = '#ffe2a8';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(c[0], c[1], 20 + pulse * 120, 0, Math.PI * 2);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
		});
		ctx.globalCompositeOperation = 'source-over';
	});

// ── 雷吉铎拉戈 ──
const DRAGO_BASE = {x: 960, y: 540, size: 600};
/** 进石门时的位置：门（世界坐标 x = 4.5）里，中心高 1.05，边长 1.45 */
const DRAGO_DOOR = {x: 4.5, y: 1.05, size: 1.45};
const DRAGO_TUNDRA: Keys = [
	[T.drago, [960, 520, 560]],
	[T.crystal + 6, [960, 520, 560]],
	[T.crystal + 50, [1330, 430, 470]],
	[T.seal - 14, [1330, 430, 470]],
];
const CRYSTAL_SOURCES = (() => {
	const r = rng(895);
	const cols = ['#a3203c', '#c8324f', '#7d1a30', '#2f4a4c', '#3c5f5e', '#d24a63'];
	return Array.from({length: 220}, () => {
		const side = r();
		const p: Pt = side < 0.6 ? [r() * W, 780 + r() * 300] : side < 0.8 ? [-40 + r() * 140, 300 + r() * 600] : [W - 100 + r() * 140, 300 + r() * 600];
		return {p, col: cols[Math.floor(r() * cols.length)]};
	});
})();

/** 想象中的龙身：从颈部一路弯到左上方的尾巴（只是虚线勾出的轮廓） */
const bodyAt = (t: number): {c: Pt; w: number} => ({
	c: [1240 - t * 1060, 600 + 120 * Math.sin(t * Math.PI * 1.4) - 70 * t],
	w: 95 * Math.pow(1 - t, 0.6) + 10,
});
const BODY_DOTS = (() => {
	const out: {p: Pt; t: number; edge: boolean}[] = [];
	const N = 90;
	for (let i = 0; i <= N; i++) {
		const t = i / N;
		const {c, w} = bodyAt(t);
		const {c: c2} = bodyAt(Math.min(t + 0.01, 1));
		const {c: c0} = bodyAt(Math.max(t - 0.01, 0));
		const dx = c2[0] - c0[0];
		const dy = c2[1] - c0[1];
		const l = Math.hypot(dx, dy) || 1;
		const nx = -dy / l;
		const ny = dx / l;
		for (const s of [-1, -0.33, 0.33, 1]) {
			if (Math.abs(s) < 1 && i % 2) continue;
			out.push({p: [c[0] + nx * w * s, c[1] + ny * w * s], t, edge: Math.abs(s) === 1});
		}
	}
	return out;
})();

const DragoBody: React.FC<{f: number}> = ({f}) =>
	useCanvas((ctx) => {
		const vis = interpolate(f, [T.crystal + 40, T.crystal + 60, T.seal - 20, T.seal + 16], [0, 1, 1, 0], clamp);
		if (vis <= 0) return;
		const grow = interpolate(f, [T.crystal + 40, T.crystal + 100], [0, 1], clamp);
		// 结晶只填到颈部附近就不够了
		const fill = track(f, [[T.crystal + 96, 0], [T.crystal + 128, 0.16]]);
		// 古人想象的"做完的身体"
		const doom = track(f, [[T.doom + 8, 0], [T.doom + 70, 1]]);
		const doomA = interpolate(f, [T.doom + 8, T.doom + 30], [0, 1], clamp);
		ctx.globalCompositeOperation = 'lighter';
		BODY_DOTS.forEach((d, i) => {
			if (d.t > grow) return;
			const tw = 0.65 + 0.35 * Math.sin(f * 0.2 + i * 1.3);
			const filled = d.t <= fill;
			const imag = d.t <= doom;
			let a: number;
			let col: string;
			let r: number;
			if (imag && doomA > 0) {
				a = vis * doomA * (0.75 + 0.25 * Math.sin(f * 0.35 - d.t * 12));
				col = '255,80,70';
				r = d.edge ? 5 : 6;
			} else if (filled) {
				a = vis * 0.9;
				col = '230,70,95';
				r = 5;
			} else {
				if (!d.edge) return;
				// 空着的部分：虚线，忽明忽暗
				a = vis * 0.75 * tw * (1 - doomA * 0.5);
				col = '255,214,150';
				r = 3.4;
			}
			const g = ctx.createRadialGradient(d.p[0], d.p[1], 0, d.p[0], d.p[1], r * 2.4);
			g.addColorStop(0, `rgba(${col},${a})`);
			g.addColorStop(1, `rgba(${col},0)`);
			ctx.fillStyle = g;
			ctx.fillRect(d.p[0] - r * 2.4, d.p[1] - r * 2.4, r * 4.8, r * 4.8);
		});
		// 最后几块结晶飞进颈部
		const r = rng(53);
		for (let i = 0; i < 26; i++) {
			const t0 = T.crystal + 92 + i * 1.3;
			const k = interpolate(f, [t0, t0 + 18], [0, 1], clamp);
			if (k <= 0 || k >= 1) continue;
			const to = bodyAt(r() * 0.16).c;
			const from: Pt = [1330 + (r() - 0.5) * 200, 430 + (r() - 0.5) * 160];
			const e = ease(k);
			ctx.globalAlpha = vis * (1 - k * 0.3);
			ctx.fillStyle = i % 3 ? '#c8324f' : '#3c5f5e';
			ctx.beginPath();
			ctx.arc(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, 5, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
		}
		// 毁灭的想象：整条龙身发红光
		if (doomA > 0) {
			ctx.globalAlpha = vis * doomA * 0.1;
			ctx.strokeStyle = '#ff4a3a';
			ctx.lineCap = 'round';
			for (let i = 0; i < 40; i++) {
				const t0 = i / 40;
				if (t0 > doom) break;
				const a = bodyAt(t0);
				const b = bodyAt(Math.min(t0 + 1 / 40, 1));
				ctx.lineWidth = a.w * 1.6;
				ctx.beginPath();
				ctx.moveTo(a.c[0], a.c[1]);
				ctx.lineTo(b.c[0], b.c[1]);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
		}
		ctx.globalCompositeOperation = 'source-over';
	});

// ── 石门 ──
export const DOOR_X = [-6.2, -3.9, -1.6, 2.2, 4.5];
const DOOR_VIEW: Keys = [
	[T.seal, [4.5, 1.25, 2.85]],
	[T.might + 20, [4.5, 1.25, 2.85]],
	[T.ruins + 6, [3.35, 1.45, 4.8]],
	[T.ruins + 60, [-0.9, 1.75, 9.6]],
	[T.path + 24, [-0.9, 1.75, 9.6]],
	[T.back - 6, [-3.9, 1.2, 2.5]],
	[T.back + 34, [-3.9, 1.2, 2.1]],
];
/** 第 5 段：地震后三道门同时打开 → 推进沙漠遗迹的门；最后回到三道门前 */
const DOOR_VIEW_C: Keys = [
	[T.quake + 40, [-3.9, 1.55, 6.4]],
	[T.riddle + 50, [-3.9, 1.55, 5.8]],
	[T.riddle + 132, [-6.2, 1.05, 2.3]],
];
const DOOR_VIEW_D: Keys = [
	[T.wait - 40, [-3.9, 1.5, 5.0]],
	[T.endC, [-3.9, 1.65, 6.2]],
];
/** 第 6 段：先慢慢移开（转去合众）；王冠雪原的三扇门 → 移到抉择遗迹 → 拉远看全部的门 */
const DOOR_VIEW_E1: Keys = [
	[T.endC, [-3.9, 1.65, 6.2]],
	[T.unova + 70, [-2.8, 1.7, 6.5]],
];
const DOOR_VIEW_E2: Keys = [
	[T.solve - 20, [-3.9, 1.5, 5.4]],
	[T.pass + 20, [-3.9, 1.55, 5.8]],
	[T.gather + 30, [3.1, 1.45, 6.0]],
	[T.choose + 40, [3.35, 1.45, 5.0]],
	[T.split + 40, [3.35, 1.4, 5.2]],
	[T.every + 70, [-0.9, 1.75, 9.6]],
	[T.last + 30, [-0.9, 1.8, 9.9]],
];
export const doorView = (f: number) =>
	f < T.endB ? flow(f, DOOR_VIEW) : f < T.wait - 40 ? flow(f, DOOR_VIEW_C) : f < T.endC ? flow(f, DOOR_VIEW_D) : f < T.solve - 20 ? flow(f, DOOR_VIEW_E1) : flow(f, DOOR_VIEW_E2);
/** 世界坐标 → 屏幕 */
const doorToScreen = (f: number, x: number, y: number): {x: number; y: number; s: number} => {
	const [vx, vy, vh] = doorView(f);
	const s = H / vh;
	return {x: 960 + (x - vx) * s, y: 540 - (y - vy) * s, s};
};
export const doorsOpacity = (f: number) =>
	f < T.endB
		? interpolate(f, [T.seal - 8, T.seal + 32, T.back - 4, T.back + 34], [0, 1, 1, 0], clamp)
		: f < T.endC
			? interpolate(f, [T.quake + 46, T.quake + 80, T.riddle + 110, T.riddle + 144], [0, 1, 1, 0], clamp) + interpolate(f, [T.wait - 4, T.wait + 36], [0, 1], clamp)
			: interpolate(f, [T.unova + 10, T.unova + 70], [1, 0], clamp) + interpolate(f, [T.solve - 16, T.solve + 20, T.last - 6, T.last + 30], [0, 1, 1, 0], clamp);

const HOENN_CLOSE = [0, 1, 2].map((i) => T.ruins + 62 + i * 26);
const SOLVE_OPEN = [T.solve + 44, T.solve + 120, T.solve + 180];
const closeAt = (f: number, i: number) => {
	// 第 6 段：王冠雪原的三扇门依次打开；三个巨人聚齐后，抉择遗迹的门打开
	if (f >= T.solve - 20) return i >= 3 ? track(f, [[T.gather + 50, 1], [T.gather + 94, 0]]) : track(f, [[SOLVE_OPEN[i], 1], [SOLVE_OPEN[i] + 34, 0]]);
	// 第 5 段：地震后丰缘的三道门同时打开
	if (f >= T.endB) return i >= 3 ? 1 : track(f, [[T.open + 24, 1], [T.open + 76, 0]]);
	if (i === 4) return track(f, [[T.seal + 22, 0], [T.seal + 74, 1]]);
	if (i === 3) return 1;
	const c = track(f, [[HOENN_CLOSE[i], 0], [HOENN_CLOSE[i] + 26, 1]]);
	// "并没有把路堵死"：中间那道门留出一条缝
	return i === 1 ? c - track(f, [[T.path + 40, 0], [T.back, 0.1]]) : c;
};
const GLOW_COL: [number, number, number][] = [
	[1.0, 0.6, 0.3],
	[0.5, 0.8, 1.0],
	[0.75, 0.8, 0.9],
	[1.0, 0.85, 0.3],
	[1.0, 0.22, 0.28],
];
/** 抉择遗迹：两道门里的光轮流亮起（只能唤醒其中一个） */
export const chooseSwing = (f: number) => Math.sin((f - T.choose - 70) * 0.11) * interpolate(f, [T.choose + 60, T.choose + 90], [0, 1], clamp);
const glowAt = (f: number, i: number): number[] => {
	if (f >= T.solve - 20) {
		const open = 1 - closeAt(f, i);
		const sw = chooseSwing(f);
		const a = i === 3 ? 0.9 * open * (1 + 0.6 * sw) : i === 4 ? 0.9 * open * (1 - 0.6 * sw) : 0.7 * open;
		return [...GLOW_COL[i], a];
	}
	const might = interpolate(f, [T.might + 10, T.might + 40], [0, 1], clamp) * (0.6 + 0.4 * Math.sin(f * (i === 3 ? 0.9 : 0.25)));
	let a = 0;
	if (i === 4) a = Math.max(interpolate(f, [T.seal - 8, T.seal + 20], [0, 0.9], clamp) * (1 - closeAt(f, 4) * 0.6), might * 0.9);
	else if (i === 3) a = might * 0.9;
	else a = interpolate(f, [T.ruins + 10, T.ruins + 40], [0, 0.7], clamp) + (i <= 2 ? interpolate(f, [T.wait2 + 20, T.wait2 + 100], [0, 0.35], clamp) : 0);
	const gold = i === 1 ? interpolate(f, [T.path + 30, T.back, T.endB - 1, T.endB], [0, 1, 1, 0], clamp) : 0;
	const c = GLOW_COL[i].map((v, k) => v + ([1.0, 0.72, 0.35][k] - v) * gold);
	return [...c, a + gold * 2.2];
};
// 门楣上的七个点：取各自脸上（雷吉奇卡斯以外的五个巨人）的排法
const ELEKI_DOTS: Pt[] = [[0.3345, 0.4158], [0.3091, 0.4401], [0.2845, 0.4472], [0.2516, 0.4469], [0.3396, 0.4488], [0.2643, 0.4564], [0.2554, 0.4798]];
const DRAGO_DOTS: Pt[] = [[0.5324, 0.5739], [0.4408, 0.5773], [0.4913, 0.5979], [0.5251, 0.6211], [0.4562, 0.6241], [0.4907, 0.6501], [0.4863, 0.6964]];
const MARKS = (() => {
	const sets = [FACE_DOTS.regirock, FACE_DOTS.regice, FACE_DOTS.registeel, ELEKI_DOTS, DRAGO_DOTS];
	return sets.flatMap((pts) => {
		const mx = pts.reduce((a, p) => a + p[0], 0) / 7;
		const my = pts.reduce((a, p) => a + p[1], 0) / 7;
		const span = Math.max(...pts.map((p) => Math.hypot(p[0] - mx, p[1] - my)));
		const k = 0.26 / span;
		const out = pts.flatMap((p) => [(p[0] - mx) * k, -(p[1] - my) * k]);
		return [...out, 0, 0];
	});
})();

export const DoorsView: React.FC<{f: number; layer: 0 | 1}> = ({f, layer}) => {
	const o = doorsOpacity(f);
	if (o <= 0) return null;
	const v = doorView(f);
	const seam = f < T.solve - 20 ? interpolate(f, [T.path, T.path + 40, T.open + 24, T.open + 60], [0, 1, 1, 0], clamp) : 0.8;
	const mark = interpolate(f, [T.path + 10, T.path + 60], [0, 1], clamp);
	const doors = DOOR_X.flatMap((x, i) => [x, closeAt(f, i), seam * (i === 1 ? 1.3 : 0.8), mark]);
	const glows = DOOR_X.flatMap((_, i) => glowAt(f, i));
	return (
		<GLView
			frag={DOORS_FRAG}
			style={{opacity: o}}
			uniforms={{uTime: f / BASE_FPS, uView: v, uLayer: layer, 'uDoor[]': doors, 'uGlow[]': glows, 'uMarks[]': MARKS, uExposure: 1.6, uFade: 0}}
		/>
	);
};

/** 门里的巨人：丰缘的三个只在拉远时出现（剪影），雷吉铎拉戈在最右边一道门里 */
const DOOR_GIANTS = [
	{dir: 'regirock', i: 0, size: 1.5, foot: 0.988},
	{dir: 'regice', i: 1, size: 1.5, foot: 0.987},
	{dir: 'registeel', i: 2, size: 1.65, foot: 0.867},
];
/** 第 6 段"三个巨人集结"：从各自的门走到抉择遗迹门前（世界坐标 x、站位略靠前、略小） */
const GATHER_AT = [0.35, 3.35, 6.35];
const gatherK = (f: number) => (f < T.endC ? 0 : track(f, [[T.gather - 40, 0], [T.gather + 34, 1]]));
const DoorGiants: React.FC<{f: number; front?: boolean}> = ({f, front = false}) => {
	const o = interpolate(f, [T.ruins + 10, T.ruins + 50], [0, 1], clamp) * doorsOpacity(f);
	const k = gatherK(f);
	if (front !== k > 0.02) return null;
	return (
		<>
			{o > 0 && (f < T.path + 30 || f >= T.endB)
				? DOOR_GIANTS.map((g) => {
						// 脚踩在地面（y = 0）上；集结时走到前面
						const x = DOOR_X[g.i] + (GATHER_AT[g.i] - DOOR_X[g.i]) * k;
						const sz = g.size * (1 - 0.1 * k);
						const c0 = doorToScreen(f, x, (g.foot - 0.5) * sz + 0.02);
						const c = {...c0, y: c0.y + k * 0.42 * c0.s};
						const rim = GLOW_COL[g.i];
						return (
							<PokemonArt3D
								key={g.dir}
								dir={`pokemon/${g.dir}`}
								x={c.x}
								y={c.y}
								size={sz * c.s}
								depthScale={0.5}
								ambient={[0.03, 0.03, 0.04]}
								brightness={0.45 + interpolate(f, [T.wait2 + 20, T.wait2 + 100], [0, 0.2], clamp)}
								rim={{dir: [0, -1], color: [rim[0] * 1.4, rim[1] * 1.4, rim[2] * 1.4], power: 2.4}}
								opacity={o}
							/>
						);
					})
				: null}
		</>
	);
};

const RegidragoLayer: React.FC<{f: number; inDoor: boolean}> = ({f, inDoor}) => {
	const o = interpolate(f, [T.drago - 14, T.drago + 4], [0, 1], clamp) * (f < T.might + 10 ? 1 : 0);
	if (o <= 0) return null;
	// 雪原里的位置 → 门里的位置
	const pt = vecAt(f, DRAGO_TUNDRA);
	const d = doorToScreen(f, DRAGO_DOOR.x, DRAGO_DOOR.y);
	const pd = [d.x, d.y, DRAGO_DOOR.size * d.s];
	const k = ease(interpolate(f, [T.seal - 14, T.seal + 20], [0, 1], clamp));
	const p = pt.map((v, i) => v + (pd[i] - v) * k);
	if (inDoor !== k > 0.5) return null;
	const lit = interpolate(f, [T.drago - 10, T.drago + 6], [0, 1], clamp);
	const red = interpolate(f, [T.doom + 10, T.doom + 50, T.seal, T.seal + 30], [0, 1, 1, 0.6], clamp);
	const shut = closeAt(f, 4);
	return (
		<Placed p={p} base={DRAGO_BASE} o={o}>
			<PokemonArt3D
				dir="pokemon/regidrago"
				x={DRAGO_BASE.x}
				y={DRAGO_BASE.y}
				size={DRAGO_BASE.size}
				depthScale={0.5}
				ambient={[(0.1 + 0.4 * lit) * (1 - 0.6 * k), (0.11 + 0.42 * lit) * (1 - 0.7 * k), (0.13 + 0.48 * lit) * (1 - 0.7 * k)]}
				dirLights={[
					{dir: [-0.4, -0.8, 0.5], color: [0.7 * lit * (1 - k), 0.75 * lit * (1 - k), 0.85 * lit * (1 - k)], wrap: 0.45},
					{dir: [0.2, 0.9, 0.4], color: [1.8 * red, 0.35 * red, 0.3 * red], wrap: 0.35},
				]}
				rim={{dir: [0.5, -0.8], color: [1.4, 0.4 + 0.3 * (1 - red), 0.45], power: 2.4}}
				brightness={1 - 0.35 * shut}
			/>
		</Placed>
	);
};

// ── 前景的雪 ──
const FLAKES = (() => {
	const r = rng(2020);
	return Array.from({length: 170}, () => ({x: r() * 2200, y: r() * 1300, z: 0.4 + r() * 0.6, ph: r() * 6.28}));
})();
export const SnowFront: React.FC<{f: number; amount?: number}> = ({f, amount}) =>
	useCanvas((ctx) => {
		const vis = amount !== undefined ? amount : f < T.endB ? interpolate(f, [T.tundra + 10, T.tundra + 70, T.seal - 10, T.seal + 30], [0, 1, 1, 0], clamp) : tundraOpacity(f) * 0.8;
		if (vis <= 0) return;
		const t = f / 30;
		FLAKES.forEach((k) => {
			const x = (((k.x + t * 140 * k.z + Math.sin(t * 1.3 + k.ph) * 18) % 2200) + 2200) % 2200 - 140;
			const y = (((k.y + t * 190 * k.z) % 1300) + 1300) % 1300 - 110;
			const r = 1.2 + k.z * 2.6;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
			g.addColorStop(0, `rgba(235,242,250,${0.75 * vis * k.z})`);
			g.addColorStop(1, 'rgba(235,242,250,0)');
			ctx.fillStyle = g;
			ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
		});
	});

// ── 组合 ──
export const TundraView: React.FC<{f: number}> = ({f}) => {
	const o = tundraOpacity(f);
	if (o <= 0) return null;
	const c = tundraCam(f);
	const strike = TOWNS.reduce((a, t, i) => Math.max(a, interpolate(f - STRIKE[i], [-1, 1, 10], [0, 1, 0], clamp)), 0);
	return (
		<GLView
			frag={TUNDRA_FRAG}
			style={{opacity: o}}
			uniforms={{
				uTime: f / BASE_FPS,
				uCam: [c.cx, c.cy, c.z],
				uTint: tintAt(f),
				uFlash: [1250, 380, strike * 0.6 + interpolate(f, [T.eleki - 6, T.eleki + 4, T.eleki + 30], [0, 0.5, 0.15], clamp) * charge(f)],
				uStorm: 1,
				uDim: interpolate(f, [T.doom + 20, T.doom + 60], [0, 0.25], clamp),
				uExposure: 1.5,
				uFade: 0,
			}}
		/>
	);
};

/** 雪原上的角色：整组随镜头变换 */
export const TundraActors: React.FC<{f: number}> = ({f}) => {
	const mask = useArtMask('pokemon/regidrago');
	const o = tundraOpacity(f);
	if (f < T.notThree - 2 || f > T.seal + 40) return null;
	const c = tundraCam(f);
	return (
		<>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${960 - c.cx * c.z}px, ${540 - c.cy * c.z}px) scale(${c.z})`}}>
				<div style={{position: 'absolute', inset: 0, opacity: o}}>
					<Lights f={f} />
					<Silhouettes f={f} />
					<DragoBody f={f} />
				</div>
				<RegielekiLayer f={f} />
				<ElekiFx f={f} />
				<RockAssembly f={f} mask={mask} start={T.dragoLine + 10} dur={46} spread={36} fadeAt={[T.drago - 4, T.drago + 16]} target={{x: 960, y: 520, size: 560}} sources={CRYSTAL_SOURCES} />
				<RegidragoLayer f={f} inDoor={false} />
			</div>
			<SnowFront f={f} />
		</>
	);
};

/** 石门之间的巨人（画在岩壁和石板之间） */
export const DoorActors: React.FC<{f: number}> = ({f}) => (
	<>
		{f >= T.ruins ? <DoorGiants f={f} /> : null}
		{f >= T.seal - 16 && f < T.might + 12 ? <RegidragoLayer f={f} inDoor /> : null}
		{f >= T.gather + 40 && f < T.last + 32 ? <SplitPair f={f} /> : null}
	</>
);
/** 走到门前的巨人画在石板之上 */
export const DoorFront: React.FC<{f: number}> = ({f}) => (f >= T.gather - 40 && f < T.last + 32 ? <DoorGiants f={f} front /> : null);

/** 抉择遗迹的门里：雷吉艾勒奇和雷吉铎拉戈（剪影，轮流亮起） */
const SplitPair: React.FC<{f: number}> = ({f}) => {
	const o = doorsOpacity(f) * interpolate(f, [T.gather + 50, T.gather + 90], [0, 1], clamp);
	if (o <= 0) return null;
	const sw = chooseSwing(f);
	const e = doorToScreen(f, DOOR_X[3], 1.25);
	const d = doorToScreen(f, DOOR_X[4], (0.971 - 0.5) * 1.5 + 0.02);
	return (
		<>
			<PokemonArt3D dir="pokemon/regieleki" x={e.x} y={e.y} size={1.7 * e.s} depthScale={0.5} ambient={[0.03, 0.03, 0.04]} brightness={0.4 + 0.25 * Math.max(sw, 0)} rim={{dir: [0, -1], color: [1.6, 1.4, 0.45], power: 2.4}} opacity={o} />
			<PokemonArt3D dir="pokemon/regidrago" x={d.x} y={d.y} size={1.5 * d.s} depthScale={0.5} ambient={[0.03, 0.03, 0.04]} brightness={0.4 + 0.25 * Math.max(-sw, 0)} rim={{dir: [0, -1], color: [1.5, 0.35, 0.4], power: 2.4}} opacity={o} />
		</>
	);
};

/** 第 6 段的地名、门前的提示符号、抉择遗迹两道门之间的分界线 */
export const DoorsSixFx: React.FC<{f: number}> = ({f}) => {
	if (f < T.solve - 20 || f > T.last + 32) return null;
	const o = Math.min(doorsOpacity(f), 1);
	const crown = o * interpolate(f, [T.solve + 10, T.solve + 34, T.pass - 10, T.pass + 10], [0, 1, 1, 0], clamp);
	const split = o * interpolate(f, [T.split, T.split + 24, T.every, T.every + 24], [0, 1, 1, 0], clamp);
	const lab = (x: number, y: number, zh: string, en: string, a: number) => {
		if (a <= 0) return null;
		const p = doorToScreen(f, x, y);
		return (
			<div key={zh} style={{position: 'absolute', left: p.x - 400, width: 800, top: p.y, textAlign: 'center', opacity: a}}>
				<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 34, letterSpacing: 8, paddingLeft: 8, color: 'rgba(240,222,186,0.92)', textShadow: '0 0 12px rgba(0,0,0,0.9)'}}>{zh}</div>
				<div style={{fontFamily: CINZEL, fontSize: 17, letterSpacing: 6, paddingLeft: 6, color: 'rgba(220,200,160,0.7)', marginTop: 4}}>{en}</div>
			</div>
		);
	};
	// 门前的提示：不变之石（圆石）、雪之结晶（六角雪花）、口哨（声波）；门开时亮一下再淡去
	const icon = (i: number) => {
		const t0 = SOLVE_OPEN[i] - 30;
		const a = o * interpolate(f, [t0, t0 + 14, SOLVE_OPEN[i] + 30, SOLVE_OPEN[i] + 60], [0, 1, 1, 0], clamp);
		if (a <= 0) return null;
		const p = doorToScreen(f, DOOR_X[i], 1.15);
		const r = 0.26 * p.s;
		const st = {stroke: '#ffd68f', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const};
		return (
			<g key={i} opacity={a} style={{filter: 'drop-shadow(0 0 8px rgba(255,180,80,0.9))'}}>
				{i === 0 ? <ellipse cx={p.x} cy={p.y} rx={r} ry={r * 0.8} {...st} /> : null}
				{i === 1
					? [0, 1, 2].map((k) => {
							const ang = (k * Math.PI) / 3;
							return <line key={k} x1={p.x - Math.cos(ang) * r} y1={p.y - Math.sin(ang) * r} x2={p.x + Math.cos(ang) * r} y2={p.y + Math.sin(ang) * r} {...st} />;
						})
					: null}
				{i === 2
					? [0.45, 0.75, 1.05].map((k) => <path key={k} d={`M ${p.x - r * 0.6 + r * k * 0.5} ${p.y - r * k} A ${r * k} ${r * k} 0 0 1 ${p.x - r * 0.6 + r * k * 0.5} ${p.y + r * k}`} {...st} />)
					: null}
			</g>
		);
	};
	const sw = chooseSwing(f);
	const div = o * interpolate(f, [T.choose + 60, T.choose + 90, T.split + 40, T.split + 70], [0, 1, 1, 0], clamp);
	const top = doorToScreen(f, 3.35, 2.6);
	const bot = doorToScreen(f, 3.35, 0.05);
	return (
		<>
			<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
				{[0, 1, 2].map(icon)}
				{div > 0 ? <line x1={top.x} y1={top.y} x2={bot.x} y2={bot.y} stroke="#ffd68f" strokeWidth={2} strokeDasharray="6 8" opacity={div * (0.6 + 0.2 * Math.abs(sw))} style={{filter: 'drop-shadow(0 0 6px rgba(255,180,80,0.9))'}} /> : null}
			</svg>
			{lab(-3.9, 3.55, '王冠雪原', 'THE CROWN TUNDRA', crown)}
			{lab(3.35, 3.5, '抉择遗迹', 'SPLIT-DECISION RUINS', split)}
		</>
	);
};

/** 门下的地名；门缝透出的金光一路涨满画面，转回海底石室 */
export const DoorLabels: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.ruins + 50, T.ruins + 80, T.path + 20, T.path + 50], [0, 1, 1, 0], clamp);
	const label = (x: number, zh: string, en: string) => {
		const p = doorToScreen(f, x, -0.5);
		return (
			<div style={{position: 'absolute', left: p.x - 300, width: 600, top: p.y, textAlign: 'center', opacity: o}}>
				<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 34, letterSpacing: 10, paddingLeft: 10, color: 'rgba(240,222,186,0.9)', textShadow: '0 0 12px rgba(0,0,0,0.9)'}}>{zh}</div>
				<div style={{fontFamily: CINZEL, fontSize: 18, letterSpacing: 8, paddingLeft: 8, color: 'rgba(220,200,160,0.7)', marginTop: 4}}>{en}</div>
			</div>
		);
	};
	// 第 5 段结尾：三道门下依次浮出"力量""耐心""爱与希望"
	const virtue = (i: number, at: number, zh: string, en: string) => {
		const vo = interpolate(f, [at, at + 24], [0, 1], clamp) * interpolate(f, [T.unova + 6, T.unova + 40], [1, 0], clamp);
		if (vo <= 0) return null;
		const p = doorToScreen(f, DOOR_X[i], 3.32);
		return (
			<div key={zh} style={{position: 'absolute', left: p.x - 200, width: 400, top: p.y - 50, textAlign: 'center', opacity: vo}}>
				<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 32, letterSpacing: 8, paddingLeft: 8, color: '#f3d9a2', textShadow: '0 0 14px rgba(255,170,70,0.7), 0 0 4px rgba(0,0,0,0.9)'}}>{zh}</div>
				<div style={{fontFamily: CINZEL, fontSize: 17, letterSpacing: 6, paddingLeft: 6, color: 'rgba(230,205,160,0.75)', marginTop: 4}}>{en}</div>
			</div>
		);
	};
	const glow = interpolate(f, [T.path + 50, T.back + 2, T.back + 14, T.back + 56], [0, 1, 1, 0], clamp);
	const seam = doorToScreen(f, DOOR_X[1], 1.1);
	return (
		<>
			{o > 0 ? (
				<>
					{label(-3.9, '丰缘', 'HOENN')}
					{label(3.35, '伽勒尔', 'GALAR')}
				</>
			) : null}
			{f >= T.wait2 ? (
				<>
					{virtue(0, T.wait2 + 22, '力量', 'STRENGTH')}
					{virtue(1, T.wait2 + 44, '耐心', 'PATIENCE')}
					{virtue(2, T.wait2 + 74, '爱与希望', 'LOVE & HOPE')}
				</>
			) : null}
			{glow > 0 ? (
				<div
					style={{
						position: 'absolute',
						left: 0,
						top: 0,
						width: W,
						height: H,
						opacity: glow,
						background: `radial-gradient(ellipse ${260 + glow * 900}px ${520 + glow * 700}px at ${seam.x}px ${seam.y}px, rgba(255,190,110,0.36) 0%, rgba(200,130,60,0.18) 40%, rgba(120,70,30,0) 100%)`,
						mixBlendMode: 'screen',
					}}
				/>
			) : null}
		</>
	);
};

