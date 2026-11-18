import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {Cam, project, shake, track} from '../../camera';
import {CamLayer} from '../../components/CamLayer';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {
	ABSORB,
	add,
	BURST_AT,
	CITY_DARK,
	CLASH,
	CROWN,
	ESCAPE,
	FX_OFF,
	HIT,
	KPPL,
	KS,
	KT,
	Light,
	lightUniforms,
	ORB,
	P,
	PPL_BASE,
	REVEAL,
	riftUniforms,
	SPH,
	SPIRES,
	TOWER_UP,
	ULTRA,
	V3,
	V4,
	YB,
} from './common';
import {Backdrop, BurstShards, Crystal, fadeIn, fadeOut, LightStream, Motes, People, TrainerArt} from './fx';
import {CITY_FRAG, FX_FRAG} from './gl';

/**
 * 究极大都会：
 *   232–2830  远古的金光 → 聚光塔抽光、光团碎裂 → 奈克洛兹玛显色、夺回城市的光 → 黑暗 → 究极大都会塔与光笼 → 推进塔顶的光（曝白）
 *   3760–3935 塔快撑不住了 → 塔顶撕开究极之洞，镜头冲进去（第 7 段开头）
 *   4890–5560 穿过究极空间追到塔顶 → 究极爆发 → 光子喷涌对上Ｚ力量 → Ｚ力量压过去 → 光碎成无数光点（第 8 段）
 *   5630–5790 光回到了阿罗拉，究极大都会依然漆黑（第 9 段）
 */

const on = (f: number) => (f >= 232 && f <= 2832) || (f >= 3758 && f <= 3937) || (f >= 4888 && f <= 5562) || (f >= CITY_DARK - 12 && f <= 5792);

// ─── 镜头 ───────────────────────────────────────────────────────────────
const cityCam = (f: number): Cam => {
	if (f < 3000) {
		const s1 = shake(f, BURST_AT, 20, 46);
		const tr = interpolate(f, [1120, 1250], [0, 1], clamp) * (f < BURST_AT ? 1 : 0);
		// 吸光时整座城在颤
		const ab = interpolate(f, [2020, 2060, 2200, 2240], [0, 1, 1, 0], clamp);
		const s2 = {x: Math.sin(f * 2.1) * (2.2 * tr + 1.6 * ab), y: Math.cos(f * 2.7) * (1.8 * tr + 1.4 * ab), roll: 0};
		return add(
			{
				x: track(f, [
					[236, 1120],
					[540, 1080],
					[900, 980],
					[1740, 1000],
					[1840, 1040],
					[2300, 1000],
					[2380, 960],
				]),
				y: track(f, [
					[236, -700],
					[540, -520],
					[900, 380],
					[1240, 400],
					[1300, 310],
					[1540, 300],
					[1740, 340],
					[1840, 300],
					[2300, 330],
					[2380, 330],
					[2500, 150],
					[2560, -120],
					[2660, -380],
				]),
				zoom: track(f, [
					[236, 1.3],
					[540, 1.18],
					[900, 1.0],
					[1240, 1.07],
					[1300, 1.0],
					[1740, 1.05],
					[1840, 1.14],
					[2250, 1.08],
					[2380, 1.0],
					[2500, 1.0],
					[2560, 1.25],
					[2660, 1.7],
					[2830, 4.2, Easing.in(Easing.cubic)],
				]),
				roll: 0,
			},
			{x: s1.x + s2.x, y: s1.y + s2.y, roll: s1.roll},
		);
	}
	if (f < 4500) {
		// 第 7 段开头：塔顶，光笼在颤；撕开究极之洞后冲进去
		const th = interpolate(f, [3800, 3830, 3880], [0, 1, 1], clamp);
		return {
			x: 960 + Math.sin(f * 1.7) * 2.5 * th,
			y: track(f, [
				[3760, -380],
				[ESCAPE, -400],
				[3935, -470, Easing.in(Easing.cubic)],
			]),
			zoom: track(f, [
				[3760, 1.5],
				[ESCAPE, 1.66],
				[3935, 7, Easing.in(Easing.cubic)],
			]),
			roll: 0,
		};
	}
	if (f >= CITY_DARK - 20) {
		// 第 9 段：依然漆黑的究极大都会（远景，慢推）
		return {
			x: 960,
			y: track(f, [
				[CITY_DARK - 12, 300],
				[5792, 260],
			]),
			zoom: track(f, [
				[CITY_DARK - 12, 0.95],
				[5792, 1.02],
			]),
			roll: 0,
		};
	}
	// 第 8 段：塔顶，究极爆发 → 对撞（推拉 + 震动）
	const s = shake(f, ULTRA, 26, 60);
	const s2 = shake(f, HIT, 22, 44);
	const s3 = shake(f, CLASH + 16, 12, 30);
	const s4 = shake(f, CLASH + 70, 14, 30);
	const s5 = shake(f, CLASH + 120, 16, 30);
	const sx = s.x + s2.x + s3.x + s4.x + s5.x;
	const sy = s.y + s2.y + s3.y + s4.y + s5.y;
	return add(
		{
			x: 960,
			y: track(f, [
				[4888, -330],
				[4990, -300],
				[CLASH, -300],
				[HIT, -250],
				[5560, -230],
			]),
			zoom: track(f, [
				[4888, 1.8],
				[4990, 1.05],
				[ULTRA, 0.98],
				[5170, 1.0],
				[CLASH, 0.96],
				[CLASH + 60, 1.12],
				[CLASH + 90, 0.97],
				[CLASH + 150, 1.16],
				[HIT, 1.22, Easing.in(Easing.cubic)],
				[5560, 1.3],
			]),
			roll: 0,
		},
		{x: sx, y: sy, roll: s.roll + s2.roll},
	);
};

// ─── 城市的状态 ─────────────────────────────────────────────────────────
const cityState = (f: number) => {
	const ultraG = interpolate(f, [ULTRA - 4, ULTRA + 30, HIT, HIT + 60], [0, 0.55, 0.55, 0], clamp) * interpolate(f, [CLASH - 10, CLASH + 20, HIT], [1, 0.6, 0.6], clamp);
	const gold = f < 3000 ? interpolate(f, [BURST_AT, BURST_AT + 60, ABSORB[0], ABSORB[3] + 60], [1, 0.22, 0.22, 0], clamp) : ultraG;
	const dark = f < 3000 ? interpolate(f, [BURST_AT, BURST_AT + 70, ABSORB[0], ABSORB[3] + 60], [0, 0.62, 0.62, 1], clamp) : 1 - ultraG * 0.8;
	const orbW = f < BURST_AT ? 1 : 0;
	const crack = f < 3000 ? interpolate(f, [1110, 1250], [0, 1], clamp) : 0;
	const spire = f < 3000 ? interpolate(f, [880, 1070], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)}) * fadeOut(f, ABSORB[3] + 80, ABSORB[3] + 140) : 0;
	const beam = f < BURST_AT ? interpolate(f, [1060, 1100], [0, 1], clamp) : interpolate(f, [BURST_AT, BURST_AT + 24], [1, 0], clamp);
	const capt = SPIRES.map((_, i) =>
		f < BURST_AT
			? interpolate(f, [1090, 1250], [0, 0.55], clamp)
			: interpolate(f, [BURST_AT + 4 + i * 5, BURST_AT + 30 + i * 5, ABSORB[i], ABSORB[i] + 50], [0.55, 1.15, 1.15, 0], clamp),
	);
	const flash = interpolate(f, [BURST_AT - 2, BURST_AT, BURST_AT + 30], [0, 1, 0], clamp);
	// 究极大都会塔
	const rise = f < 3000 ? interpolate(f, [TOWER_UP, TOWER_UP + 130], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}) : 1;
	const tlight = f < 3000 ? interpolate(f, [TOWER_UP + 10, TOWER_UP + 120], [0, 1], clamp) : f < 4500 ? 1 : f >= CITY_DARK - 20 ? 1 : interpolate(f, [4888, ULTRA, ULTRA + 40], [0.8, 0.8, 0.25], clamp);
	const flicker = f > 3780 && f < 3940 ? interpolate(f, [3780, 3830], [0, 0.9], clamp) : 0;
	const cage = f < 3000 ? interpolate(f, [2560, 2620], [0, 1], clamp) : f < 4500 ? interpolate(f, [ESCAPE - 6, ESCAPE + 4], [1, 0], clamp) * (1 - 0.5 * flicker * (Math.sin(f * 1.9) > 0.3 ? 1 : 0)) : 0;
	// 黑暗最深处：奈克洛兹玛隐没之后、高塔点亮之前
	const dim = f < 3000 ? interpolate(f, [2240, 2320, TOWER_UP, TOWER_UP + 40], [1, 0.55, 0.55, 1], clamp) : 1;
	return {gold, dark, orbW, crack, spire, beam, capt, flash, rise, tlight, flicker, cage, dim, ultraG};
};

// 光团炸开后的究极之洞（屏幕坐标）
const RIFTS = [
	{x: 470, y: 250, h: 300, a: 0.18, open: [BURST_AT + 22, BURST_AT + 60, 1470, 1520]},
	{x: 1560, y: 200, h: 340, a: -0.12, open: [BURST_AT + 30, BURST_AT + 70, 1490, 1540]},
	{x: 960, y: 120, h: 220, a: 0.05, open: [BURST_AT + 40, BURST_AT + 80, 1460, 1500]},
];

// ─── 奈克洛兹玛（通常形态）──────────────────────────────────────────────
// 第 3–4 段：悬在原本光团所在的天空（KS 附近），显色后吸光；第 5、7 段：关在塔顶的光笼里
const NecrozmaCity: React.FC<{f: number; cam: Cam; st: ReturnType<typeof cityState>; tops: P[]}> = ({f, cam, st}) => {
	if (f >= 1590 && f < 2350) {
		const x = track(f, [
			[1740, 1185],
			[1835, 1120],
		]);
		const y = track(f, [
			[1740, 150],
			[1835, 300],
		]);
		const size = track(f, [
			[1740, 250],
			[1835, 560],
		]);
		const lit = interpolate(f, [1800, REVEAL, 2240, 2330], [0, 1, 1, 0], clamp);
		const flare = interpolate(f, [REVEAL - 14, REVEAL, REVEAL + 30], [1, 1.55, 1], clamp);
		const absorb = interpolate(f, [ABSORB[0], ABSORB[0] + 30, ABSORB[3] + 40, ABSORB[3] + 90], [0, 1, 1, 0.3], clamp);
		const warm = st.capt.reduce((a, b) => a + b, 0) / 4;
		const o = fadeIn(f, 1590, 1680) * fadeOut(f, 2280, 2345);
		const writhe = absorb * Math.sin(f * 0.9) * 2.5;
		return (
			<CamLayer cam={cam} k={0.2}>
				<PokemonArt3D
					dir="pokemon/necrozma"
					x={x + writhe}
					y={y + Math.sin(f * 0.05) * 6}
					size={size}
					depthScale={0.5}
					yaw={Math.sin(f * 0.04) * 3}
					resolution={1.5}
					opacity={o}
					brightness={flare}
					ambient={[0.006 + 0.3 * lit, 0.006 + 0.29 * lit, 0.008 + 0.3 * lit]}
					dirLights={[
						{dir: [0.1, 0.9, 0.35], color: [1.1 * warm * lit, 0.9 * warm * lit, 0.6 * warm * lit], wrap: 0.3},
						{dir: [-0.6, -0.5, 0.5], color: [0.25 * lit, 0.28 * lit, 0.36 * lit], wrap: 0.4},
					]}
					rim={{dir: [0.2, 1], color: [0.9 + 0.6 * absorb, 0.8 + 0.5 * absorb, 0.6 + 0.6 * absorb], power: 2.4}}
					emissive={1.6 * absorb + 0.25 * lit}
					emissiveTint={[1.2, 1.2, 1.3]}
					emissiveKey={[0.3, 0.75, 0.2, 0.6]}
				/>
			</CamLayer>
		);
	}
	const caged = (f >= 2556 && f < 2832) || (f >= 3758 && f < ESCAPE + 60);
	if (caged) {
		const struggle = interpolate(f, [3790, 3840], [0, 1], clamp) * (f < 3000 ? 0 : 1);
		const esc = interpolate(f, [ESCAPE, ESCAPE + 50], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
		const o = (f < 3000 ? fadeIn(f, 2556, 2600) : fadeIn(f, 3758, 3790)) * (1 - esc);
		return (
			<CamLayer cam={cam} k={KT}>
				<PokemonArt3D
					dir="pokemon/necrozma"
					x={CROWN.x + Math.sin(f * 1.3) * 5 * struggle}
					y={CROWN.y + 6 - esc * 120}
					size={210 * (1 - 0.6 * esc)}
					depthScale={0.5}
					yaw={Math.sin(f * 0.8) * 6 * struggle}
					resolution={2}
					opacity={o}
					ambient={[0.05, 0.055, 0.07]}
					dirLights={[{dir: [0, 0.9, 0.4], color: [0.55 * st.tlight, 0.62 * st.tlight, 0.75 * st.tlight], wrap: 0.3}]}
					rim={{dir: [0, 1], color: [0.8, 0.9, 1.1], power: 2.2}}
					emissive={0.5 + 0.8 * struggle * (0.5 + 0.5 * Math.sin(f * 0.7))}
					emissiveTint={[1.1, 1.2, 1.4]}
					emissiveKey={[0.3, 0.75, 0.2, 0.6]}
				/>
			</CamLayer>
		);
	}
	return null;
};

// ─── 第 8 段：两道光回到塔顶，晶体碎片绕成光茧 → 究极奈克洛兹玛 ────────────────
const COCOON = Array.from({length: 34}, (_, i) => ({
	a0: random(`ca${i}`) * Math.PI * 2,
	r0: 260 + random(`cr${i}`) * 320,
	sp: 0.05 + random(`cs${i}`) * 0.05,
	size: 14 + random(`cz${i}`) ** 2 * 40,
	tilt: 0.25 + random(`ct${i}`) * 0.35,
}));

const Cocoon: React.FC<{f: number; c: P; scale: number}> = ({f, c, scale}) => {
	if (f < 4895 || f > ULTRA + 4) return null;
	const u = interpolate(f, [4905, ULTRA], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 0 8px rgba(255,220,150,0.8))'}}>
			{COCOON.map((s, i) => {
				const a = s.a0 + f * s.sp * (1 + 3 * u);
				const r = s.r0 * (1 - 0.82 * u) * scale;
				const x = c.x + Math.cos(a) * r;
				const y = c.y + Math.sin(a) * r * s.tilt;
				const o = fadeIn(f, 4898 + i * 2, 4915 + i * 2);
				return <Crystal key={i} x={x} y={y} size={s.size * scale * (1 - 0.3 * u)} rot={a * 57 + i * 31} seed={`coc${i}`} glint={0.5 + 0.5 * u} edge="255,220,140" opacity={o} />;
			})}
		</svg>
	);
};

const LASERS = Array.from({length: 9}, (_, i) => ({a0: (i / 9) * Math.PI * 2 + random(`la${i}`) * 0.4, sp: (random(`ls${i}`) - 0.5) * 0.03, at: 5168 + i * 7}));

const Lasers: React.FC<{f: number; c: P}> = ({f, c}) => {
	if (f < 5160 || f > CLASH + 10) return null;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', mixBlendMode: 'screen'}}>
			{LASERS.map((l, i) => {
				const o = interpolate(f, [l.at, l.at + 6, l.at + 50, l.at + 70], [0, 1, 1, 0], clamp);
				if (o <= 0) return null;
				const a = l.a0 + (f - l.at) * l.sp;
				const x2 = c.x + Math.cos(a) * 2400;
				const y2 = c.y + Math.sin(a) * 2400;
				return (
					<g key={i} opacity={o}>
						<line x1={c.x} y1={c.y} x2={x2} y2={y2} stroke="rgba(255,214,120,0.5)" strokeWidth={26} style={{filter: 'blur(8px)'}} />
						<line x1={c.x} y1={c.y} x2={x2} y2={y2} stroke="rgba(255,250,230,1)" strokeWidth={5} />
					</g>
				);
			})}
		</svg>
	);
};

// ─── 对撞：光子喷涌（金）对上Ｚ力量（虹）──────────────────────────────────
const YOUTH = {x: 1450, y: 526, h: 260}; // KY 层，脚底（画面右下）
const KY = 0.6;
/** 两道光的交汇点在连线上的位置（0 = 究极奈克洛兹玛，1 = 年轻人），来回推挤 */
const clashU = (f: number) =>
	interpolate(f, [CLASH + 14, CLASH + 60, CLASH + 80, CLASH + 150, HIT - 8, HIT], [0.5, 0.8, 0.76, 0.38, 0.18, 0.0], {...clamp, easing: Easing.inOut(Easing.sin)});

export const ShotCity: React.FC<{f: number}> = ({f}) => {
	if (!on(f)) return null;
	const cam = cityCam(f);
	const st = cityState(f);
	const orbS = project(cam, KS, ORB);
	const tops = SPIRES.map((x) => project(cam, KT, {x, y: YB - SPH * st.spire}));
	const crownS = project(cam, KT, {x: CROWN.x, y: YB - 900 * st.rise - 30});
	const ultraO = interpolate(f, [ULTRA - 2, ULTRA + 6, HIT + 10, HIT + 60], [0, 1, 1, 0], clamp);
	const lights: Light[] = [
		{p: orbS, r: 1100, i: st.orbW * st.gold * 1.1, c: [1.0, 0.8, 0.48]},
		...tops.map((p, i) => ({p, r: 420, i: (st.capt[i] * 1.5 + st.beam * 0.3) * st.spire, c: [1.0, 0.88, 0.66] as V3})),
		{p: crownS, r: 1000, i: st.rise > 0 ? st.tlight * 1.5 * (1 - st.flicker * 0.5 * (Math.sin(f * 2.3) > 0 ? 1 : 0)) : 0, c: [0.78, 0.88, 1.0]},
	];
	// 第 8 段：究极奈克洛兹玛自己就是光源（替换掉第一个光源位）
	if (f > 4880 && f < 5600) lights[0] = {p: crownS, r: 1500, i: 2.4 * ultraO, c: [1.0, 0.86, 0.55]};
	// 对撞：两道光的位置
	const youthS = project(cam, KY, {x: YOUTH.x - 10, y: YOUTH.y - YOUTH.h * 0.66});
	const ultraCore = {x: crownS.x, y: crownS.y + 30 * cam.zoom};
	const cu = clashU(f);
	const clashP = {x: ultraCore.x + (youthS.x - ultraCore.x) * cu, y: ultraCore.y + (youthS.y - ultraCore.y) * cu};
	const gW = interpolate(f, [CLASH, CLASH + 14, HIT - 4, HIT + 2], [0, 1, 1, 0], clamp);
	const zW = interpolate(f, [CLASH + 8, CLASH + 18, HIT + 16, HIT + 40], [0, 1, 1.3, 0], clamp);
	const clashI = interpolate(f, [CLASH + 12, CLASH + 20, HIT - 4, HIT + 2], [0, 1, 1, 0], clamp) * (0.85 + 0.15 * Math.sin(f * 2.7));
	const youthO = interpolate(f, [CLASH - 30, CLASH - 10, HIT + 40, HIT + 70], [0, 1, 1, 0], clamp);
	const rifts =
		f < 3000
			? RIFTS.map((r) => ({x: r.x, y: r.y, h: r.h, a: r.a, open: interpolate(f, r.open, [0, 1, 1, 0], clamp)}))
			: f < 4500
			? [{x: crownS.x, y: crownS.y - 60 * cam.zoom, h: 260 * cam.zoom, a: 0, open: interpolate(f, [ESCAPE - 10, ESCAPE + 20], [0, 1], clamp)}]
			: f < 5600
			? [{x: 960, y: crownS.y, h: 420, a: 0, open: interpolate(f, [4888, 4905, 4950], [1, 1, 0], clamp)}]
			: [];
	const pplRim = st.gold > 0.5 ? 'rgb(255,214,150)' : 'rgb(255,234,200)';
	const ultraFlash = interpolate(f, [ULTRA - 2, ULTRA, ULTRA + 34], [0, 1, 0], clamp);
	const hitFlash = interpolate(f, [HIT - 2, HIT, HIT + 40], [0, 1, 0.2], clamp);
	// 推进塔顶的光 → 曝白（转到古书）、冲进究极之洞 → 曝白（转到阿罗拉）、光碎成光点 → 曝白（转到黎明）
	const white =
		f < 3000
			? interpolate(f, [2690, 2800], [0, 1], {...clamp, easing: Easing.in(Easing.quad)})
			: f < 4500
			? interpolate(f, [3900, 3935], [0, 1], {...clamp, easing: Easing.in(Easing.quad)})
			: f < 5600
			? Math.max(interpolate(f, [4888, 4925], [1, 0], clamp), interpolate(f, [HIT + 24, 5520], [0, 1], {...clamp, easing: Easing.in(Easing.quad)}))
			: 0;
	const o = f < 3000 ? fadeIn(f, 232, 282) : f < 4500 ? fadeIn(f, 3758, 3800) : f < 5600 ? 1 : fadeIn(f, CITY_DARK - 12, CITY_DARK + 20) * fadeOut(f, 5760, 5792);
	return (
		<AbsoluteFill style={{opacity: o}}>
			<Backdrop
				frag={CITY_FRAG}
				f={f}
				cam={cam}
				uniforms={{
					uGold: st.gold,
					uOrb: [ORB.x, ORB.y, ORB.r, st.orbW],
					uCrack: st.crack,
					uFlash: st.flash * 0.9,
					uSpire: st.spire,
					uBeam: st.beam,
					uCapt: st.capt as V4,
					uDark: st.dark,
					uTower: [CROWN.x, st.rise, st.tlight, st.flicker],
					uTowerCage: st.cage,
					uDim: st.dim,
					uBright: 1,
					...lightUniforms(lights),
				}}
			/>
			<Backdrop
				frag={FX_FRAG}
				f={f}
				cam={cam}
				blend="screen"
				uniforms={{
					...riftUniforms(rifts),
					...FX_OFF,
				}}
			/>
			{/* 远古：金色浮尘；之后：冷光里的微尘 */}
			<Motes f={f} opacity={f < 3000 ? interpolate(f, [236, 300], [0, 0.55], clamp) * (1 - 0.5 * st.dark) + 0.2 * st.rise : 0.25} rgb={f < TOWER_UP ? '255,226,170' : '210,225,255'} rainbow={0.25} />
			{f < 1800 && (
				<BurstShards
					f={f}
					at={BURST_AT}
					x={orbS.x}
					y={orbS.y}
					scale={1.1}
					into={[
						{i: 3, x: RIFTS[0].x, y: RIFTS[0].y, t: 70},
						{i: 11, x: RIFTS[1].x, y: RIFTS[1].y, t: 80},
						{i: 20, x: RIFTS[2].x, y: RIFTS[2].y, t: 92},
						{i: 27, x: RIFTS[0].x, y: RIFTS[0].y + 40, t: 104},
						{i: 33, x: RIFTS[1].x, y: RIFTS[1].y - 50, t: 110},
					]}
				/>
			)}
			<NecrozmaCity f={f} cam={cam} st={st} tops={tops} />
			{/* 第 4 段：聚光塔里的光被一束束吸走 */}
			{f > ABSORB[0] - 5 && f < ABSORB[3] + 120 && (
				<>
					{tops.map((t, i) => {
						const nec = project(cam, 0.2, {x: 1120, y: 330});
						return <LightStream key={i} f={f} from={t} to={nec} start={ABSORB[i]} end={ABSORB[i] + 60} n={80} seed={`abs${i}`} spread={90} width={2.2} />;
					})}
				</>
			)}
			{/* 第 8 段：光茧、究极奈克洛兹玛、激光 */}
			{f > 4880 && f < 5600 && (
				<>
					<LightStream f={f} from={{x: -100, y: 700}} to={crownS} start={4895} end={4975} n={50} rgb="255,214,120" seed="ingold" spread={120} width={1.6} />
					<LightStream f={f} from={{x: 2020, y: 700}} to={crownS} start={4895} end={4975} n={50} rgb="214,180,255" seed="inviolet" spread={120} width={1.6} />
					<Cocoon f={f} c={crownS} scale={cam.zoom} />
					{ultraO > 0 && (
						<CamLayer cam={cam} k={KT}>
							<PokemonArt3D
								dir="pokemon/necrozma"
								variant="-ultra"
								x={CROWN.x}
								y={CROWN.y - 20 + Math.sin(f * 0.05) * 8}
								size={980}
								depthScale={0.45}
								yaw={Math.sin(f * 0.03) * 3}
								resolution={1.4}
								opacity={ultraO}
								brightness={interpolate(f, [ULTRA, ULTRA + 20, ULTRA + 60], [2.0, 1.25, 1.0], clamp) * interpolate(f, [CLASH - 10, CLASH + 20, HIT, HIT + 8], [1, 0.72, 0.72, 1.3], clamp)}
								ambient={[0.86, 0.82, 0.76]}
								emissive={0.3}
								emissiveTint={[1.2, 1.0, 0.6]}
								emissiveKey={[0.4, 0.9, 0.1, 0.5]}
								style={{filter: 'drop-shadow(0 0 30px rgba(255,220,140,0.75)) drop-shadow(0 0 90px rgba(255,200,110,0.45))'}}
							/>
						</CamLayer>
					)}
					<Lasers f={f} c={crownS} />
					{/* 塔顶平台上的年轻人（官方立绘剪影），Ｚ力量的虹光从他手上升起 */}
					{youthO > 0.01 && (
						<CamLayer cam={cam} k={KY}>
							<TrainerArt who="elio" x={YOUTH.x} y={YOUTH.y} h={YOUTH.h} rimRgb="255,226,170" rim={0.8} opacity={youthO} />
						</CamLayer>
					)}
					{/* 对撞的两道光：画在究极奈克洛兹玛上面 */}
					{gW + zW > 0.001 && (
						<Backdrop
							frag={FX_FRAG}
							f={f}
							cam={cam}
							blend="screen"
							uniforms={{
								...riftUniforms([]),
								...FX_OFF,
								uBeamG: [ultraCore.x, ultraCore.y, clashP.x, clashP.y],
								uBeamGW: [20 * cam.zoom, gW * 1.0],
								uBeamZ: [youthS.x, youthS.y, f < HIT ? clashP.x : ultraCore.x - (youthS.x - ultraCore.x) * 0.4, f < HIT ? clashP.y : ultraCore.y - (youthS.y - ultraCore.y) * 0.4],
								uBeamZW: [18 * cam.zoom, zW * 1.0],
								uClash: [clashP.x, clashP.y, 46 * cam.zoom, clashI],
							}}
						/>
					)}
					{/* 对撞点飞溅的光点 */}
					<LightStream f={f} from={clashP} to={{x: clashP.x - 520, y: clashP.y + 380}} start={CLASH + 20} end={HIT} n={40} rgb="255,236,200" seed="spL" spread={260} width={1.4} />
					<LightStream f={f} from={clashP} to={{x: clashP.x + 520, y: clashP.y - 380}} start={CLASH + 20} end={HIT} n={40} rgb="220,235,255" seed="spR" spread={260} width={1.4} />
					{f > HIT && <BurstShards f={f} at={HIT + 4} x={crownS.x} y={crownS.y} scale={1.6} />}
					<Motes f={f} opacity={interpolate(f, [HIT, HIT + 30], [0, 1], clamp)} dir={-1} rainbow={0.9} rgb="255,240,210" />
				</>
			)}
			{f < 3000 && (
				<CamLayer cam={cam} k={KPPL}>
					<People base={PPL_BASE} rim={pplRim} rimO={0.9 * (1 - interpolate(f, [ABSORB[0], ABSORB[3] + 60], [0, 0.85], clamp))} f={f} />
				</CamLayer>
			)}
			{st.flash > 0.01 && <AbsoluteFill style={{background: `rgba(255,252,240,${st.flash * 0.85})`}} />}
			{ultraFlash > 0.01 && <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 80% at 50% 46%, rgba(255,250,232,${ultraFlash}) 0%, rgba(255,236,190,${ultraFlash * 0.8}) 60%, rgba(255,220,160,${ultraFlash * 0.5}) 100%)`}} />}
			{hitFlash > 0.01 && f > 5400 && <AbsoluteFill style={{background: `rgba(255,255,255,${hitFlash * 0.9})`}} />}
			{white > 0.001 && <AbsoluteFill style={{background: `rgba(255,253,248,${white})`}} />}
		</AbsoluteFill>
	);
};


