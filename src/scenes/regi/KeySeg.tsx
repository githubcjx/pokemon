import {useLayoutEffect, useRef} from 'react';
import {interpolate} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {BASE_FPS} from '../../time';
import {flow, H, T, track, W} from './common';
import {RegionLabel, TrainerSilhouette} from './DoorsSeg';
import {ELEKI_SIL, GIANTS, giantY} from './FearSeg';
import {FACE_DOTS, GIGAS_HOLES} from './GiantsSeg';
import {DOORS_FRAG, TUNDRA_FRAG} from './gl4';
import {GLView} from './GLView';
import {artToScreen} from './Rocks';
import {Pt} from './shapes';

/**
 * 第 7 段 · 雪峰神殿（下篇开头）。
 * 洗翠：雪原着色器打开 uTemple（山崖上的神殿）；殿内和地底的门用石门着色器的新实例（只留一道门，整体偏冷）。
 * 今天：同一种石壁，雷吉奇卡斯像一尊石像（立绘去色），三个巨人到场后慢慢恢复颜色。
 * 伽勒尔：再用一次第 4 段的雪原（巨人睡榻）。
 */

type Keys = [number, number[]][];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

const goldDot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) => {
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

// ── 开头：石室暗下去，只剩七个光点（雷吉奇卡斯身上的七个圆孔）──
const HOLE_MU: Pt = [GIGAS_HOLES.reduce((a, p) => a + p[0], 0) / 7, GIGAS_HOLES.reduce((a, p) => a + p[1], 0) / 7];
export const KingDots: React.FC<{f: number}> = ({f}) => {
	const dim = interpolate(f, [T.keyCard + 4, T.keyCard + 30], [0, 0.72], clamp) * interpolate(f, [T.hisui - 30, T.hisui + 10], [1, 0], clamp);
	const cv = useCanvas((ctx) => {
		ctx.globalCompositeOperation = 'lighter';
		GIGAS_HOLES.forEach((uv, i) => {
			const on = interpolate(f, [T.king2 + 40 + i * 9, T.king2 + 52 + i * 9], [0, 1], clamp);
			// 进入洗翠时化成雪往下飘
			const fall = interpolate(f, [T.hisui - 30, T.hisui + 30], [0, 1], clamp);
			const x = 960 + (uv[0] - HOLE_MU[0]) * 1500 + Math.sin(f * 0.05 + i) * 10 * fall;
			const y = 470 + (uv[1] - HOLE_MU[1]) * 1500 + fall * fall * 260;
			goldDot(ctx, x, y, 7 * (1 - fall * 0.6), on * (1 - fall) * (0.8 + 0.2 * Math.sin(f * 0.12 + i)));
		});
		ctx.globalCompositeOperation = 'source-over';
	});
	if (f < T.keyCard || f > T.hisui + 32) return null;
	return (
		<>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, background: '#000', opacity: dim}} />
			{cv}
		</>
	);
};

// ── 洗翠：山崖上的雪峰神殿 ──
const HISUI_CAM: Keys = [
	[T.hisui - 36, [960, 540, 1.0]],
	[T.temple + 30, [1090, 500, 1.1]],
	[T.statues + 34, [1330, 380, 1.6]],
];
export const hisuiOpacity = (f: number) => interpolate(f, [T.hisui - 36, T.hisui + 10, T.statues - 6, T.statues + 30], [0, 1, 1, 0], clamp);
export const HisuiView: React.FC<{f: number}> = ({f}) => {
	const o = hisuiOpacity(f);
	if (o <= 0) return null;
	const [cx, cy, z] = flow(f, HISUI_CAM);
	return (
		<>
			<GLView
				frag={TUNDRA_FRAG}
				style={{opacity: o}}
				uniforms={{uTime: f / BASE_FPS, uCam: [cx, cy, z], uTint: [0.95, 1.0, 1.08], uFlash: [960, 300, 0], uStorm: 0.7, uTemple: 1, uDim: 0.05, uExposure: 1.55, uFade: 0}}
			/>
			<RegionLabel x={110} y={130} zh="洗翠 · 雪峰神殿" en="HISUI · SNOWPOINT TEMPLE" o={o * interpolate(f, [T.temple + 10, T.temple + 34, T.statues - 16, T.statues + 6], [0, 1, 1, 0], clamp)} />
		</>
	);
};

// ── 石门着色器的新实例：只留一道门 ──
const FAR4 = [100, 104, 108, 112].flatMap((x) => [x, 0, 0, 0]);
const ZERO_GLOW = Array.from({length: 16}, () => 0);
const marksOf = (pts: Pt[] | null) => {
	if (!pts) return Array.from({length: 80}, () => 50);
	const mx = pts.reduce((a, p) => a + p[0], 0) / 7;
	const my = pts.reduce((a, p) => a + p[1], 0) / 7;
	const span = Math.max(...pts.map((p) => Math.hypot(p[0] - mx, p[1] - my)));
	const k = 0.3 / span;
	return [...pts.flatMap((p) => [(p[0] - mx) * k, -(p[1] - my) * k]), 0, 0, ...Array.from({length: 64}, () => 0)];
};
export const GIGAS_MARKS = marksOf(GIGAS_HOLES);
const NO_MARKS = marksOf(null);
export const FROST: [number, number, number] = [0.72, 0.84, 1.08];

type View = [number, number, number];
const toScreen = (v: View, x: number, y: number) => {
	const s = H / v[2];
	return {x: 960 + (x - v[0]) * s, y: 540 - (y - v[1]) * s, s};
};
export const OneDoor: React.FC<{f: number; view: View; o: number; door: number[]; glow: number[]; marks: number[]; layer: 0 | 1; tint?: [number, number, number]}> = ({f, view, o, door, glow, marks, layer, tint = [0, 0, 0]}) =>
	o > 0 ? (
		<GLView
			frag={DOORS_FRAG}
			style={{opacity: o}}
			uniforms={{uTime: f / BASE_FPS, uView: view, uLayer: layer, uWallTint: tint, 'uDoor[]': [...door, ...FAR4], 'uGlow[]': [...glow, ...ZERO_GLOW], 'uMarks[]': marks, uExposure: 1.8, uFade: 0}}
		/>
	) : null;

// 殿内：两排巨人石像，基座上刻着岩、冰、钢的记号
const HALL_VIEW: Keys = [
	[T.statues - 6, [0, 1.45, 5.8]],
	[T.adaman - 10, [0, 1.3, 4.8]],
];
export const templeHallOpacity = (f: number) => interpolate(f, [T.statues - 6, T.statues + 30, T.adaman - 24, T.adaman + 16], [0, 1, 1, 0], clamp);
const STATUES = [
	{dir: 'regirock', x: -4.3, mark: 0, foot: 0.988, size: 1.15},
	{dir: 'regice', x: -3.0, mark: 1, foot: 0.987, size: 1.15},
	{dir: 'registeel', x: -1.75, mark: 2, foot: 0.867, size: 1.25},
	{dir: 'registeel', x: 1.75, mark: 2, foot: 0.867, size: 1.25},
	{dir: 'regice', x: 3.0, mark: 1, foot: 0.987, size: 1.15},
	{dir: 'regirock', x: 4.3, mark: 0, foot: 0.988, size: 1.15},
];
const MARK_AT = [T.statues + 104, T.statues + 124, T.statues + 144];
const markGlyph = (k: number, x: number, y: number, r: number, lit: number, key: string) => {
	const col = lit > 0.01 ? `rgba(255,214,143,${0.35 + 0.65 * lit})` : 'rgba(150,150,160,0.45)';
	const st = {stroke: col, strokeWidth: Math.max(2, r * 0.12), fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
	const glow = lit > 0.01 ? {filter: `drop-shadow(0 0 ${8 * lit}px rgba(255,180,80,0.95))`} : undefined;
	if (k === 0)
		return (
			<polygon key={key} points={[0, 1, 2, 3, 4, 5].map((i) => `${x + Math.cos(i * 1.05 + 0.3) * r * (i % 2 ? 0.8 : 1)},${y + Math.sin(i * 1.05 + 0.3) * r * (i % 2 ? 0.8 : 1)}`).join(' ')} {...st} style={glow} />
		);
	if (k === 1)
		return (
			<g key={key} style={glow}>
				{[0, 1, 2].map((i) => {
					const a = (i * Math.PI) / 3;
					return <line key={i} x1={x - Math.cos(a) * r} y1={y - Math.sin(a) * r} x2={x + Math.cos(a) * r} y2={y + Math.sin(a) * r} {...st} />;
				})}
			</g>
		);
	return (
		<g key={key} style={glow}>
			<circle cx={x} cy={y} r={r} {...st} />
			<circle cx={x} cy={y} r={r * 0.45} {...st} />
		</g>
	);
};

export const TempleHall: React.FC<{f: number; layer: 'bg' | 'fg'}> = ({f, layer}) => {
	const o = templeHallOpacity(f);
	if (o <= 0) return null;
	const v = flow(f, HALL_VIEW) as View;
	const open = track(f, [[MARK_AT[2] + 14, 0], [MARK_AT[2] + 60, 0.55]]);
	const seam = interpolate(f, [MARK_AT[2], MARK_AT[2] + 14], [0, 1], clamp);
	if (layer === 'bg')
		return <OneDoor f={f} view={v} o={o} door={[0, 1 - open, seam, 0]} glow={[1.0, 0.72, 0.35, seam * 1.2]} marks={NO_MARKS} layer={0} tint={FROST} />;
	const lit = (k: number) => interpolate(f, [MARK_AT[k], MARK_AT[k] + 8, MARK_AT[2] + 40, MARK_AT[2] + 80], [0, 1, 1, 0.5], clamp);
	return (
		<>
			<OneDoor f={f} view={v} o={o} door={[0, 1 - open, seam, 0]} glow={[1.0, 0.72, 0.35, seam * 1.2]} marks={NO_MARKS} layer={1} tint={FROST} />
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
				{STATUES.map((st, i) => {
					const c = toScreen(v, st.x, (st.foot - 0.5) * st.size + 0.3);
					return (
						<div key={i} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, filter: 'grayscale(1) sepia(0.15) brightness(0.85) contrast(1.05)'}}>
							<PokemonArt3D
								dir={`pokemon/${st.dir}`}
								x={c.x}
								y={c.y}
								size={st.size * c.s}
								depthScale={0.5}
								ambient={[0.2, 0.21, 0.24]}
								dirLights={[{dir: [-0.3, -0.8, 0.6], color: [0.6, 0.65, 0.75], wrap: 0.4}]}
								rim={{dir: [0, -1], color: [0.7, 0.8, 1.0], power: 2.6}}
							/>
						</div>
					);
				})}
				<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
					{STATUES.map((st, i) => {
						// 基座
						const a = toScreen(v, st.x - 0.42, 0.3);
						const b = toScreen(v, st.x + 0.42, 0);
						const m = toScreen(v, st.x, 0.15);
						return (
							<g key={i}>
								<rect x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} fill="rgba(40,46,56,0.9)" stroke="rgba(150,165,190,0.35)" strokeWidth={1.5} />
								{markGlyph(st.mark, m.x, m.y, 0.09 * m.s, lit(st.mark), `m${i}`)}
							</g>
						);
					})}
				</svg>
			</div>
		</>
	);
};

// ── 地底的门：刚石、三块石板、门开 ──
const BASE_VIEW: Keys = [
	[T.adaman - 24, [0, 1.35, 3.6]],
	[T.unseal + 20, [0, 1.3, 3.4]],
	[T.today + 20, [0, 1.1, 1.9]],
];
export const basementOpacity = (f: number) => interpolate(f, [T.adaman - 24, T.adaman + 16, T.today - 4, T.today + 30], [0, 1, 1, 0], clamp);
const baseView = (f: number): View => {
	const v = flow(f, BASE_VIEW) as View;
	// "怎么试都打不开"：门被推得一震
	const q = interpolate(f, [T.stuck + 20, T.stuck + 24, T.stuck + 40], [0, 1, 0], clamp);
	return [v[0] + Math.sin(f * 3.1) * 0.012 * q, v[1] + Math.sin(f * 4.3) * 0.01 * q, v[2] * (1 - 0.01 * q)];
};
const baseOpen = (f: number) => track(f, [[T.unseal + 26, 0], [T.unseal + 80, 1]]);
const baseDoorArgs = (f: number) => {
	const open = baseOpen(f);
	const mark = interpolate(f, [T.plates + 60, T.stuff + 20], [0, 1], clamp);
	const seam = interpolate(f, [T.unseal, T.unseal + 26], [0, 1], clamp);
	return {door: [0, 1 - open, seam, mark], glow: [1.0, 0.72, 0.35, open * 1.6 + seam * 0.4]};
};
export const BasementDoor: React.FC<{f: number; layer: 0 | 1}> = ({f, layer}) => {
	const o = basementOpacity(f);
	const a = baseDoorArgs(f);
	return <OneDoor f={f} view={baseView(f)} o={o} door={a.door} glow={a.glow} marks={GIGAS_MARKS} layer={layer} tint={FROST} />;
};

/** 门里：雷吉奇卡斯（门开后才看得到，很暗，像一尊石像） */
export const BasementGigas: React.FC<{f: number}> = ({f}) => {
	const o = basementOpacity(f) * interpolate(f, [T.unseal + 30, T.unseal + 70], [0, 1], clamp);
	if (o <= 0) return null;
	const c = toScreen(baseView(f), 0, 1.0);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, filter: 'grayscale(0.8)'}}>
			<PokemonArt3D dir="pokemon/regigigas" x={c.x} y={c.y} size={1.55 * c.s} depthScale={0.5} ambient={[0.05, 0.05, 0.06]} brightness={0.45} rim={{dir: [0, -1], color: [1.6, 1.1, 0.5], power: 2.6}} opacity={o} />
		</div>
	);
};

const PLATES = [
	{zh: '岩石石板', en: 'STONE PLATE', col: ['#8a6a44', '#b48a5a'], giant: 'regirock', foot: 0.988, rim: [1.4, 0.9, 0.5] as [number, number, number]},
	{zh: '冰柱石板', en: 'ICICLE PLATE', col: ['#7fb3c4', '#c4e6ef'], giant: 'regice', foot: 0.987, rim: [0.7, 1.0, 1.4] as [number, number, number]},
	{zh: '钢铁石板', en: 'IRON PLATE', col: ['#6f7782', '#a7b0bb'], giant: 'registeel', foot: 0.867, rim: [1.0, 1.05, 1.2] as [number, number, number]},
];
export const BasementFx: React.FC<{f: number}> = ({f}) => {
	const o = basementOpacity(f);
	if (o <= 0) return null;
	const adamanO = interpolate(f, [T.adaman - 6, T.adaman + 24, T.plates - 14, T.plates + 14], [0, 1, 1, 0], clamp);
	const h = 840;
	const w = (h * 2253) / 4637;
	const fly = ease(interpolate(f, [T.unseal + 2, T.unseal + 34], [0, 1], clamp));
	const silO = interpolate(f, [T.stuff, T.stuff + 30, T.unseal, T.unseal + 24], [0, 0.85, 0.85, 0], clamp);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
			{adamanO > 0 ? (
				<>
					{/* 剪影；微光来自右边的门缝（暖色） */}
					<TrainerSilhouette file="trainers/adaman/la.png" x={330} top={1080 - h + 40} h={h} aspect={w / h} o={adamanO} from="right" rgb="255,205,140" />
					<RegionLabel x={110} y={130} zh="金刚队队长 · 刚石" en="ADAMAN · DIAMOND CLAN" o={adamanO * interpolate(f, [T.adaman + 10, T.adaman + 30, T.stuck - 10, T.stuck + 10], [0, 1, 1, 0], clamp)} />
				</>
			) : null}
			{/* 三块石板背后：三个巨人的影子 */}
			{silO > 0
				? PLATES.map((p, i) => (
						<PokemonArt3D key={p.giant} dir={`pokemon/${p.giant}`} x={660 + i * 300} y={330} size={300} depthScale={0.5} ambient={[0.03, 0.03, 0.04]} brightness={0.4} rim={{dir: [0, -1], color: p.rim, power: 2.4}} opacity={silO} />
					))
				: null}
			{PLATES.map((p, i) => {
				const a = interpolate(f, [T.plates + 30 + i * 22, T.plates + 50 + i * 22], [0, 1], clamp) * interpolate(f, [T.unseal + 26, T.unseal + 36], [1, 0], clamp);
				if (a <= 0) return null;
				const x0 = 660 + i * 300;
				const y0 = 520;
				const x = x0 + (960 - x0) * fly;
				const y = y0 + (560 - y0) * fly;
				const k = 1 - 0.8 * fly;
				const bob = Math.sin(f * 0.06 + i * 2) * 6 * (1 - fly);
				return (
					<div key={p.zh} style={{position: 'absolute', left: x - 80, top: y - 105 + bob, width: 160, height: 210, opacity: a, transform: `scale(${k})`}}>
						<div style={{position: 'absolute', inset: 0, borderRadius: 10, background: `linear-gradient(160deg, ${p.col[1]} 0%, ${p.col[0]} 70%)`, boxShadow: `0 0 26px rgba(255,190,90,0.55), inset 0 0 0 3px rgba(255,220,160,0.5), inset 0 0 30px rgba(0,0,0,0.35)`}} />
						<div style={{position: 'absolute', left: 14, top: 14, right: 14, bottom: 14, borderRadius: 6, border: '1px solid rgba(255,235,200,0.35)'}} />
						<div style={{position: 'absolute', left: -60, width: 280, top: 226, textAlign: 'center', opacity: 1 - fly}}>
							<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 30, letterSpacing: 6, color: '#f3d9a2', textShadow: '0 0 10px rgba(0,0,0,0.9)'}}>{p.zh}</div>
							<div style={{fontFamily: CINZEL, fontSize: 15, letterSpacing: 4, color: 'rgba(230,205,160,0.75)', marginTop: 3}}>{p.en}</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

// ── 今天：石像一样的雷吉奇卡斯 ──
export const todayOpacity = (f: number) => interpolate(f, [T.today - 4, T.today + 30, T.bed - 24, T.bed + 20], [0, 1, 1, 0], clamp);
const TODAY_VIEW: View = [0, 2.0, 5.6];
export const TodayWall: React.FC<{f: number}> = ({f}) => (
	<OneDoor f={f} view={[TODAY_VIEW[0] + (f - T.today) * 0.0002, TODAY_VIEW[1], TODAY_VIEW[2]]} o={todayOpacity(f)} door={[100, 0, 0, 0]} glow={[0, 0, 0, 0]} marks={NO_MARKS} layer={0} tint={FROST} />
);
const GIGAS_TODAY: Keys = [
	[T.today, [960, 450, 800]],
	[T.reverse, [960, 450, 800]],
	[T.reverse + 44, [560, 480, 600]],
];
const FRONT = [
	{dir: 'regirock', x: 560, size: 250},
	{dir: 'regice', x: 960, size: 250},
	{dir: 'registeel', x: 1360, size: 270},
];
const FLOOR_C: Pt = [1360, 720];
export const TodayScene: React.FC<{f: number}> = ({f}) => {
	const o = todayOpacity(f);
	const p = flow(f, GIGAS_TODAY);
	// 三个巨人到场后慢慢恢复颜色（醒着，但还没站起来）
	const wake = interpolate(f, [T.three + 40, T.three + 130], [0, 1], clamp);
	const gray = 1 - 0.6 * wake;
	const frontO = interpolate(f, [T.three, T.three + 30, T.reverse, T.reverse + 30], [0, 1, 1, 0], clamp);
	const rockO = interpolate(f, [T.reverse + 110, T.reverse + 150], [0, 1], clamp);
	const cv = useCanvas((ctx) => {
		if (o <= 0) return;
		ctx.globalCompositeOperation = 'lighter';
		// 七个圆孔一个接一个亮起
		GIGAS_HOLES.forEach((uv, i) => {
			const a = interpolate(f, [T.three + 40 + i * 8, T.three + 52 + i * 8], [0, 1], clamp);
			const q = artToScreen(uv, p[0], p[1], p[2]);
			goldDot(ctx, q[0], q[1], (p[2] / 1050) * 9, a * o);
		});
		// 反过来：地上浮现雷吉洛克的七个点（先亮起一圈地面上的圆）
		const ring = o * interpolate(f, [T.reverse + 44, T.reverse + 64, T.keys + 40, T.bed - 20], [0, 1, 1, 0.4], clamp);
		if (ring > 0) {
			ctx.globalAlpha = ring * 0.7;
			ctx.strokeStyle = '#ffd68f';
			ctx.lineWidth = 2;
			ctx.shadowColor = 'rgba(255,180,80,0.9)';
			ctx.shadowBlur = 10;
			ctx.beginPath();
			ctx.ellipse(FLOOR_C[0], FLOOR_C[1], 210, 56, 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1;
		}
		const uvs = FACE_DOTS.regirock;
		const mx = uvs.reduce((a, u) => a + u[0], 0) / 7;
		const my = uvs.reduce((a, u) => a + u[1], 0) / 7;
		uvs.forEach((uv, i) => {
			const a = interpolate(f, [T.reverse + 56 + i * 6, T.reverse + 66 + i * 6], [0, 1], clamp) * interpolate(f, [T.reverse + 150, T.keys + 40], [1, 0.5], clamp);
			goldDot(ctx, FLOOR_C[0] + (uv[0] - mx) * 2200, FLOOR_C[1] + (uv[1] - my) * 2200 * 0.32, 7, a * o);
		});
		// 互为钥匙：两道金线，光点一来一回
		const kv = o * interpolate(f, [T.keys - 4, T.keys + 20, T.bed - 30, T.bed], [0, 1, 1, 0], clamp);
		if (kv > 0) {
			const A = artToScreen([0.47, 0.36], p[0], p[1], p[2]);
			const B: Pt = [1360, 520];
			for (const dir of [1, -1]) {
				const off = dir * 14;
				ctx.globalAlpha = kv * 0.6;
				ctx.strokeStyle = '#ffd68f';
				ctx.lineWidth = 2;
				ctx.setLineDash([4, 8]);
				ctx.beginPath();
				ctx.moveTo(A[0], A[1] + off);
				ctx.lineTo(B[0], B[1] + off);
				ctx.stroke();
				ctx.setLineDash([]);
				for (let j = 0; j < 3; j++) {
					const t = (((f - T.keys) * 0.012 + j / 3) % 1 + 1) % 1;
					const tt = dir > 0 ? t : 1 - t;
					ctx.globalAlpha = 1;
					goldDot(ctx, A[0] + (B[0] - A[0]) * tt, A[1] + off + (B[1] - A[1]) * tt, 5, kv);
				}
			}
			ctx.globalAlpha = 1;
		}
		ctx.globalCompositeOperation = 'source-over';
	});
	if (o <= 0) return null;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, filter: `grayscale(${gray}) sepia(${0.15 * gray}) brightness(${0.8 + 0.2 * wake})`}}>
				<PokemonArt3D
					dir="pokemon/regigigas"
					x={p[0]}
					y={p[1]}
					size={p[2]}
					depthScale={0.5}
					ambient={[0.32, 0.34, 0.38]}
					dirLights={[{dir: [-0.3, -0.8, 0.6], color: [0.7, 0.75, 0.85], wrap: 0.4}]}
					rim={{dir: [0, -1], color: [0.8 + wake, 0.9 + wake * 0.4, 1.1 - wake * 0.5], power: 2.6}}
				/>
			</div>
			{frontO > 0
				? FRONT.map((g) => (
						<PokemonArt3D key={g.dir} dir={`pokemon/${g.dir}`} x={g.x} y={760} size={g.size} depthScale={0.5} ambient={[0.45, 0.47, 0.5]} dirLights={[{dir: [-0.3, -0.8, 0.6], color: [0.6, 0.6, 0.65], wrap: 0.4}]} rim={{dir: [0, -1], color: [1.6, 1.1, 0.5], power: 2.4}} opacity={frontO} />
					))
				: null}
			{rockO > 0 ? (
				<PokemonArt3D dir="pokemon/regirock" x={FLOOR_C[0]} y={FLOOR_C[1] - 190} size={380} depthScale={0.5} ambient={[0.45, 0.47, 0.5]} dirLights={[{dir: [-0.3, -0.8, 0.6], color: [0.6, 0.6, 0.65], wrap: 0.4}]} rim={{dir: [0, -1], color: [1.6, 1.1, 0.5], power: 2.4}} opacity={rockO} />
			) : null}
			{cv}
			<RegionLabel x={110} y={130} zh="今天 · 神奥 雪峰神殿" en="TODAY · SINNOH, SNOWPOINT TEMPLE" o={interpolate(f, [T.today + 20, T.today + 44, T.statue + 30, T.statue + 54], [0, 1, 1, 0], clamp)} />
		</div>
	);
};

// ── 伽勒尔的巨人睡榻；动画与游戏 ──
export const GalarBed: React.FC<{f: number; part: 'back' | 'front'}> = ({f, part}) => {
	if (f < T.bed - 24 || f > T.endE + 52) return null;
	const out = interpolate(f, [T.endE + 4, T.endE + 50], [1, 0], clamp);
	return <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: out}}>{galarBed(f, part)}</div>;
};
const galarBed = (f: number, part: 'back' | 'front') => {
	const anime = interpolate(f, [T.anime + 4, T.anime + 20, T.anime + 112, T.anime + 136], [0, 1, 1, 0], clamp);
	const game = interpolate(f, [T.anime + 120, T.anime + 150], [0, 1], clamp);
	if (part === 'back') {
		const rise = ease(interpolate(f, [T.bed + 20, T.bed + 110], [0, 1], clamp));
		const shake = anime * (Math.sin(f * 2.3) + Math.sin(f * 3.7)) * 6;
		const holes = interpolate(f, [T.bed + 90, T.bed + 130], [0, 1], clamp);
		const gx = 960 + shake;
		const gy = 860 - 470 * rise;
		return (
			<>
				<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, mixBlendMode: 'screen', opacity: rise * 0.9, background: `radial-gradient(ellipse 34% 40% at 50% ${(gy / H) * 100}%, rgba(255,190,110,0.22), rgba(0,0,0,0) 100%)`}} />
				<PokemonArt3D
					dir="pokemon/regigigas"
					x={gx}
					y={gy}
					size={780}
					depthScale={0.5}
					ambient={[0.04 + 0.3 * anime, 0.04 + 0.05 * anime, 0.05 + 0.05 * anime]}
					brightness={0.32 + 0.4 * anime}
					rim={{dir: [0, -1], color: [1.6, 1.0 - 0.5 * anime, 0.45 - 0.2 * anime], power: 3.0}}
					opacity={interpolate(f, [T.bed + 10, T.bed + 50], [0, 1], clamp)}
				/>
				<HoleDots f={f} x={gx} y={gy} size={780} a={holes * (1 - anime * 0.7)} />
			</>
		);
	}
	const silO = interpolate(f, [T.bed + 40, T.bed + 80], [0, 1], clamp) * (1 - anime * 0.85);
	return (
		<>
			{silO > 0
				? [...GIANTS.map((g) => ({...g, y: giantY(g)})), {dir: 'regieleki', x: ELEKI_SIL[0], y: ELEKI_SIL[1], size: 400, foot: 0.5, rim: [1.5, 1.35, 0.4] as [number, number, number], at: 0}].map((g) => (
						<PokemonArt3D key={g.dir} dir={`pokemon/${g.dir}`} x={g.x} y={g.y} size={g.size} depthScale={0.5} ambient={[0.04, 0.045, 0.06]} brightness={0.4 + 0.2 * game} rim={{dir: [-0.6, -0.8], color: [g.rim[0] * 1.5, g.rim[1] * 1.5, g.rim[2] * 1.5], power: 2.4}} opacity={silO} />
					))
				: null}
			{/* 动画：红光；游戏：金光 */}
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, mixBlendMode: 'screen', opacity: anime * (0.8 + 0.2 * Math.sin(f * 0.9)), background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,60,40,0.35), rgba(120,10,0,0.15) 60%, rgba(0,0,0,0) 100%)'}} />
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, mixBlendMode: 'screen', opacity: game, background: 'radial-gradient(ellipse 55% 45% at 50% 40%, rgba(255,190,100,0.18), rgba(0,0,0,0) 100%)'}} />
			<RegionLabel x={110} y={130} zh="伽勒尔 · 巨人睡榻" en="GALAR · GIANT'S BED" o={interpolate(f, [T.bed + 40, T.bed + 64, T.anime - 20, T.anime + 4], [0, 1, 1, 0], clamp)} />
			<RegionLabel x={110} y={130} zh="动画" en="IN THE ANIME" o={anime} />
			<RegionLabel x={110} y={130} zh="游戏" en="IN THE GAMES" o={game * interpolate(f, [T.endE - 40, T.endE - 10], [1, 0], clamp)} />
		</>
	);
};

const HoleDots: React.FC<{f: number; x: number; y: number; size: number; a: number}> = ({f, x, y, size, a}) =>
	useCanvas((ctx) => {
		if (a <= 0) return;
		ctx.globalCompositeOperation = 'lighter';
		GIGAS_HOLES.forEach((uv, i) => {
			const q = artToScreen(uv, x, y, size);
			goldDot(ctx, q[0], q[1], (size / 1050) * 9, a * (0.8 + 0.2 * Math.sin(f * 0.1 + i)));
		});
		ctx.globalCompositeOperation = 'source-over';
	});
