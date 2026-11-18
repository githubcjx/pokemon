import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {CINZEL} from '../../fonts';
import {CameraRig} from '../../three/stage';
import {useFrame} from '../../time';
import {Cam, camAt, project, pxOf} from './cam';
import {bf, env, prog, rnd, smooth, SUB, SUBS} from './common';
import {
	crackDraw,
	crackGlow,
	CUT_NORMAL,
	CUT_WORLD,
	Floor,
	OPEN_AT,
	PEARL,
	PEARLS,
	PINK,
	PinWall,
	RETRACT_AT,
	ScreenHalves,
	SkyDome,
	StarField,
	TITLE_AT,
	TITLE_BOTTOM,
	TITLE_TOP,
	TITLE_Y,
	Trails,
	WALL,
	CRACK_AT,
} from './hook';
import {BuildCube, BurstFlash, DimLabels, FarPalkia, floorDissolveAt, Lattice, pointAt, ScaleOverlay, ScaleStage, ScaleWhoosh, Shards} from './infinite';
import {BACK_PAGES, FRONT_PAGES, GlassPages, NAME_FROM, nameOpacity, Palkia, pagesOn, PearlGlints, REVEAL} from './palkia';
import {BallSun, CosmicWeb, Dough, DoughLabels, EclipseNote, ORIGIN_AT, SpaceSheet, StarBeam, Streams, SunGlow} from './bend';
import {ChargeMotes, OriginBurst, OriginHalo, OriginPalkia, OriginTag, RendFlash} from './origin';
import {FarOrigin, Paper, PaperGlow, paperBright, Ribbons, Thread, Tube, TubeLabel} from './fold';
import {ChainBloom, Chains, CLASH_AT, ClashBurst, DIALGA_AT, dialgaNameOpacity, Forces, Gods, Mountains, RiftFlash, Rifts, Snow, SpearPillar, tearAt, tearClip, TearGap, TEAR_N} from './clash';
import {BreathHeart, Cloth, Dome, LightAges, Matter, ScreenRuler, SlapFlash, WeaveLights} from './fabric';

/**
 * 《空间的形状》整期总时间轴。整期是一台连续的 3D 镜头（cam.ts）；各段（Segments.tsx）只是窗口。
 * 第 1 段「钩子」的物体在 hook.tsx；第 2、3 段在 palkia.tsx、infinite.tsx；第 4–6 段在 bend.tsx、origin.tsx、fold.tsx；
 * 第 7 段在 clash.tsx，第 8、9 段在 fabric.tsx。
 */

// ════════ 第 1 段的 2D 叠层 ════════

/** 裂痕的光晕（裂开前，面板还没动时贴在斩痕上） */
const CrackBloom: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = crackGlow(f) * (1 - smooth(prog(f, OPEN_AT, OPEN_AT + 10)));
	if (f < CRACK_AT || a <= 0.01) return null;
	const p1 = project(c, CUT_WORLD[0]);
	const p2full = project(c, CUT_WORLD[1]);
	const k = crackDraw(f);
	const p2 = {x: p1.x + (p2full.x - p1.x) * k, y: p1.y + (p2full.y - p1.y) * k};
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
			<defs>
				<filter id="sp-bloom-w" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="26" />
				</filter>
				<filter id="sp-bloom-n" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="6" />
				</filter>
			</defs>
			<line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={`rgba(${PINK},${0.55 * a})`} strokeWidth={46} strokeLinecap="round" filter="url(#sp-bloom-w)" />
			<line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={`rgba(${PEARL},${0.75 * Math.min(1, a)})`} strokeWidth={8} strokeLinecap="round" filter="url(#sp-bloom-n)" />
		</svg>
	);
};

/** 裂开那一下：沿斩痕的闪光与四散的火星 */
const OpenBurst: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const t = f - OPEN_AT;
	if (t < -1 || t > 40) return null;
	const flash = Math.exp(-Math.max(0, t) / 5) * smooth(prog(t, -1, 0));
	const p1 = project(c, CUT_WORLD[0]);
	const p2 = project(c, CUT_WORLD[1]);
	const mx = (p1.x + p2.x) / 2;
	const my = (p1.y + p2.y) / 2;
	const nx = CUT_NORMAL[0];
	const ny = -CUT_NORMAL[1];
	const sparks = Array.from({length: 54}, (_, i) => {
		const u = rnd(i * 2.3 + 0.7);
		const side = rnd(i * 4.1 + 1.1) < 0.5 ? -1 : 1;
		const sp = 9 + 26 * rnd(i * 6.7 + 3);
		const along = (rnd(i * 8.3 + 5) - 0.5) * 6;
		const d = sp * (1 - Math.exp(-Math.max(0, t) / 9)) * 9;
		const x = p1.x + (p2.x - p1.x) * u + (nx * side) * d + along * t * 0.5;
		const y = p1.y + (p2.y - p1.y) * u + (ny * side) * d;
		// 当前速度（画短光线的方向和长度）
		const v = sp * Math.exp(-Math.max(0, t) / 9);
		const life = 1 - prog(t, 6 + 18 * rnd(i * 3.3), 30 + 10 * rnd(i * 1.9));
		return {x, y, vx: nx * side * v + along * 0.5, vy: ny * side * v, r: 1.2 + 1.8 * rnd(i * 5.1), a: life * smooth(prog(t, 0, 2))};
	});
	return (
		<>
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					background: `radial-gradient(ellipse 70% 55% at ${mx}px ${my}px, rgba(255,236,246,${0.55 * flash}) 0%, rgba(${PINK},${0.3 * flash}) 35%, rgba(0,0,0,0) 75%)`,
				}}
			/>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
				{sparks.map((s, i) =>
					s.a > 0.01 ? (
						<line key={i} x1={s.x} y1={s.y} x2={s.x - s.vx * 2.2} y2={s.y - s.vy * 2.2} stroke={`rgba(${PEARL},${s.a})`} strokeWidth={s.r} strokeLinecap="round" />
					) : null,
				)}
			</svg>
		</>
	);
};

/** 一点光（屏幕空间的光晕 + 十字星芒） */
const Glint: React.FC<{x: number; y: number; r: number; a: number; star: number}> = ({x, y, r, a, star}) => {
	if (a <= 0.01) return null;
	const L = r * (3 + 5 * star);
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: x - r * 3,
					top: y - r * 3,
					width: r * 6,
					height: r * 6,
					mixBlendMode: 'screen',
					background: `radial-gradient(circle, rgba(255,248,252,${a}) 0%, rgba(${PINK},${0.55 * a}) 14%, rgba(${PINK},${0.16 * a}) 38%, rgba(0,0,0,0) 70%)`,
				}}
			/>
			{star > 0.02 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
					<line x1={x - L} y1={y} x2={x + L} y2={y} stroke={`rgba(${PEARL},${0.7 * a * star})`} strokeWidth={1.6} />
					<line x1={x} y1={y - L * 0.6} x2={x} y2={y + L * 0.6} stroke={`rgba(${PEARL},${0.55 * a * star})`} strokeWidth={1.2} />
				</svg>
			) : null}
		</>
	);
};

/** 第 3 段开头的那一个点 */
const PointGlint: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const {p, a} = pointAt(f);
	if (a <= 0) return null;
	const pr = project(c, p);
	if (pr.depth <= 0) return null;
	return <Glint x={pr.x} y={pr.y} r={12} a={a} star={0.5 * a} />;
};

/** 片名凸出时的辉光与英文副题 */
const TitleLayers: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const glow = env(f, TITLE_AT, RETRACT_AT + 30, 10, 26);
	const en = env(f, bf(4, 2), bf(5, 2), 16, 18);
	if (glow <= 0 && en <= 0) return null;
	const ctr = project(c, [0, TITLE_Y, WALL.z + 1.2]);
	const sub = project(c, [0, TITLE_BOTTOM - 1.15, WALL.z + 0.2]);
	const w = pxOf(c, ctr.depth, 34);
	const h = pxOf(c, ctr.depth, TITLE_TOP - TITLE_BOTTOM) * 1.6;
	const spacing = 26 - 8 * smooth(prog(f, bf(4, 2), bf(5)));
	return (
		<>
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					background: `radial-gradient(ellipse ${w * 0.62}px ${h}px at ${ctr.x}px ${ctr.y}px, rgba(${PINK},${0.2 * glow}) 0%, rgba(${PINK},${0.07 * glow}) 45%, rgba(0,0,0,0) 100%)`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: 1920,
					top: sub.y - 22,
					textAlign: 'center',
					transform: `translateX(${sub.x - 960}px)`,
					opacity: en,
					fontFamily: CINZEL,
					fontWeight: 600,
					fontSize: 34,
					letterSpacing: spacing,
					paddingLeft: spacing,
					color: 'rgba(255,240,248,0.95)',
					textShadow: `0 0 18px rgba(${PINK},0.75), 0 0 2px rgba(255,255,255,0.6)`,
				}}
			>
				THE SHAPE OF SPACE
			</div>
		</>
	);
};

// ════════ 3D 世界 ════════

const World: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	// 深空在面板后面：裂开前看不见，所以一开始就开着
	return (
		<>
			<CameraRig pos={c.pos} target={c.tgt} fov={c.fov} far={3000} />
			<SkyDome f={f} cam={c} />
			<Floor f={f} cam={c} on={1} dissolve={floorDissolveAt(f)} />
			<StarField f={f} on={1} />
			<Trails f={f} cam={c} />
			<ScreenHalves f={f} />
			<PinWall f={f} />
			<GlassPages f={f} pages={BACK_PAGES} />
			<Lattice f={f} />
			<Shards f={f} />
			<ScaleStage f={f} c={c} />
			<SpaceSheet f={f} />
			<CosmicWeb f={f} />
			<Dough f={f} />
			<Streams f={f} />
			<BallSun f={f} />
			<Ribbons f={f} />
			<Paper f={f} />
			<Tube f={f} />
			<Mountains f={f} />
			<SpearPillar f={f} />
			<Rifts f={f} c={c} />
			<Forces f={f} />
			<Chains f={f} />
			<Snow f={f} />
			<Dome f={f} />
			<Cloth f={f} />
			<Matter f={f} />
		</>
	);
};

/** 画面本身（3D 世界 + 2D 叠层）；第 54 小节被撕开时复制成两半 */
const Scene: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	return (
		<AbsoluteFill style={{background: '#05040a'}}>
			<ThreeCanvas width={1920} height={1080} gl={{antialias: true}}>
				<World f={f} c={c} />
			</ThreeCanvas>
			<CrackBloom f={f} c={c} />
			<OpenBurst f={f} c={c} />
			<TitleLayers f={f} c={c} />
			<FarPalkia f={f} c={c} />
			<Palkia f={f} c={c} />
			{pagesOn(f) ? (
				<ThreeCanvas width={1920} height={1080} gl={{antialias: true, alpha: true}} style={{position: 'absolute', inset: 0}}>
					<CameraRig pos={c.pos} target={c.tgt} fov={c.fov} far={3000} />
					<GlassPages f={f} pages={FRONT_PAGES} front />
				</ThreeCanvas>
			) : null}
			<PearlGlints f={f} c={c} Glint={Glint} />
			<PointGlint f={f} c={c} />
			<BuildCube f={f} c={c} />
			<DimLabels f={f} c={c} />
			<BurstFlash f={f} c={c} />
			<ScaleWhoosh f={f} />
			<ScaleOverlay f={f} c={c} Glint={Glint} />
			<DoughLabels f={f} c={c} />
			<SunGlow f={f} c={c} />
			<StarBeam f={f} c={c} Glint={Glint} />
			<EclipseNote f={f} />
			<OriginBurst f={f} c={c} />
			<RendFlash f={f} c={c} />
			<OriginHalo f={f} c={c} />
			<FarOrigin f={f} c={c} />
			<OriginPalkia f={f} c={c} />
			<ChargeMotes f={f} c={c} />
			<OriginTag f={f} />
			<Thread f={f} c={c} Glint={Glint} />
			<PaperGlow f={f} c={c} />
			<TubeLabel f={f} c={c} />
			<ChainBloom f={f} c={c} />
			<RiftFlash f={f} c={c} />
			<Gods f={f} c={c} />
			<ClashBurst f={f} c={c} />
			<LightAges f={f} c={c} Glint={Glint} />
			<WeaveLights f={f} c={c} Glint={Glint} />
			<SlapFlash f={f} />
			<ScreenRuler f={f} />
			<BreathHeart f={f} Glint={Glint} />
			<NameTag
				from={NAME_FROM}
				x={1770}
				y={230}
				align="right"
				no="No.0484"
				zh="帕路奇亚"
				en="PALKIA"
				category="空间宝可梦"
				categoryEn="Spatial Pokémon"
				tone="mono"
				glowRgb={PINK}
				opacity={nameOpacity(f)}
			/>
			<NameTag
				from={DIALGA_AT + 4}
				x={110}
				y={96}
				align="left"
				no="No.0483"
				zh="帝牙卢卡"
				en="DIALGA"
				category="时间宝可梦"
				categoryEn="Temporal Pokémon"
				tone="mono"
				glowRgb="120,170,255"
				opacity={dialgaNameOpacity(f)}
			/>
		</AbsoluteFill>
	);
};

/** 撕开的画面：两半各自裁切、往两边错开，中间是撕口 */
const TornScene: React.FC<{f: number; c: Cam; w: number}> = ({f, c, w}) => (
	<AbsoluteFill style={{background: '#120c18'}}>
		{([1, -1] as const).map((s) => (
			<AbsoluteFill key={s} style={{clipPath: tearClip(s), transform: `translate(${TEAR_N[0] * s * w * 0.5}px, ${TEAR_N[1] * s * w * 0.5}px) rotate(${s * w * 0.004}deg) scale(${1 + w * 0.0004})`}}>
				<Scene f={f} c={c} />
			</AbsoluteFill>
		))}
		<TearGap f={f} w={w} />
	</AbsoluteFill>
);

export const SpaceMaster: React.FC = () => {
	const f = useFrame();
	const c = camAt(f);
	const tear = tearAt(f);
	return (
		<AbsoluteFill style={{background: '#05040a'}}>
			{tear > 0.5 ? <TornScene f={f} c={c} w={tear} /> : <Scene f={f} c={c} />}
			<Cry name="palkia" at={REVEAL} />
			<Cry name="palkia-origin" at={ORIGIN_AT} />
			<Cry name="dialga" at={DIALGA_AT} />
			{/* 全片最大爆发点：帕路奇亚第二次叫声 */}
			<Cry name="palkia" at={CLASH_AT} />
			<Vignette strength={0.5} />
			{SUBS.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			{/* 白纸亮着时颗粒减半（浅色画面上颗粒特别耗码率） */}
			<Grain opacity={0.12 - 0.06 * paperBright(f)} />
		</AbsoluteFill>
	);
};

