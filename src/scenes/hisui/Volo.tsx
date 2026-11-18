import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {ArtLighting, PokemonArt3D} from '../../components/PokemonArt3D';
import {Person} from '../../components/unown/Silhouette';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {CoronetLights, Sky, Snow, Terrain} from '../../three/hisui/coronet';
import {StoneStatue} from '../../three/hisui/statue';
import {COLUMNS, groundAt, PEDESTAL_H, ruinTop, STATUES, TEMPLE, Temple} from '../../three/hisui/temple';
import {CameraRig, V3} from '../../three/stage';
import {TrainerSil} from './Clans';
import {flow, prog, SUB, T, track} from './common';
import {Glow, toScreen, View} from './Overlays';
import {RuinShot} from './Plates';
import {REI, ScreenSil} from './Rift';

// ─── 第 7 段「望罗」──────────────────────────────────────────────────────────
// 寺院遗址叠化成黄昏的神殿废墟（3D，第 5 段塌下来的样子）→ 沿削尖的断柱仰上去（"一柱一柱的枪"，回扣第 1 段开场）
// → 脱下商会的衣服（剪影的光由暖转冷，一件外衣被风卷走）→ 回忆（2D，红色）：骑拉帝纳撕开裂缝、双神发狂 → 天上的金光
// → 洗翠化成光点散去 → 古代神奥人的跪拜，望罗站在其中 → 回到废墟，天暗下去 → 世界背面的裂口，骑拉帝纳钻出（名称卡、叫声）
// → 起源形态（第二次叫声）→ 没有天地之分的世界（2D）→ 输了、退回裂口 → 望罗向天喊 → 笛子变成天界之笛 → 望罗离开。

const ease = (t: number) => t * t * (3 - 2 * t);
const rnd = (s: number) => {
	const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/** 第 1 段开场对准的那根削尖的断柱 */
export const SPEAR = COLUMNS.filter((c) => c.z === 18 && c.tipH > 0).sort((a, b) => b.keep - a.keep)[0];
const SPEAR_TOP = ruinTop(SPEAR);
const g = (x: number, z: number): V3 => [x, groundAt(x, z), z];

const VOLO_P: V3 = g(SPEAR.x + 2.2, 23.6);
export const REI_P: V3 = g(SPEAR.x + 5.4, 25.2);
/** 世界背面的裂口：废墟正上方 */
const TEAR: V3 = [0, 40, -34];
const GIRA_P: V3 = [0, 25, -12];
const GIRA_BOX = 30;

// ── 3D 镜头 ──

const CAM7: [number, number[]][] = [
	// 叠化进来：黄昏的废墟，两个人走进断柱之间
	[T.end6, [SPEAR.x - 12, 2.2, 44, 0, 5, 4, 44]],
	[T.l73 - 10, [SPEAR.x + 6, 2.0, 35, SPEAR.x + 1, 3.2, 20, 40]],
	// "一柱一柱的枪"：沿那根断柱仰上去（第 1 段开场的机位）
	[T.l73 + 30, [SPEAR.x + 4, 2.4, 33, SPEAR_TOP[0], SPEAR_TOP[1], SPEAR_TOP[2], 36]],
	[T.l73 + 115, [SPEAR.x + 4.2, 2.4, 33.5, SPEAR_TOP[0], SPEAR_TOP[1] + 4, SPEAR_TOP[2], 40]],
	// 摇下来看望罗
	[T.coat + 10, [SPEAR.x + 6.5, 1.9, 31, VOLO_P[0], VOLO_P[1] + 1.4, VOLO_P[2], 36]],
	[T.memory, [SPEAR.x + 6.2, 1.9, 30.6, VOLO_P[0], VOLO_P[1] + 1.4, VOLO_P[2], 35]],
	// 回到废墟：仰望变暗的天
	[T.back7, [SPEAR.x + 9, 2.2, 44, 0, 14, -6, 48]],
	[T.revTear, [5, 2.0, 50, 0, 24, -18, 52]],
	[T.giraPeak + 20, [4, 2.2, 52, 0, 23, -14, 50]],
	[T.origin + 30, [2, 2.3, 50, 0, 24, -14, 48]],
	// 对抗：从那个人身后仰望骑拉帝纳，慢慢推近
	[T.duel, [REI_P[0] + 1.8, REI_P[1] + 1.1, REI_P[2] + 3.6, GIRA_P[0], GIRA_P[1] - 4, GIRA_P[2], 56]],
	[T.duel + 150, [REI_P[0] + 1.6, REI_P[1] + 1.05, REI_P[2] + 3.1, GIRA_P[0] + 0.5, GIRA_P[1] - 3.5, GIRA_P[2], 52]],
	[T.l82 + 70, [6, 2.4, 54, 0, 26, -20, 52]],
	// 望罗向天喊：低机位仰拍
	[T.l83 + 20, [VOLO_P[0] + 3.4, VOLO_P[1] + 0.7, VOLO_P[2] + 6.5, VOLO_P[0] - 0.5, VOLO_P[1] + 4.2, VOLO_P[2] - 4, 46]],
	[T.l84 + 110, [VOLO_P[0] + 3.0, VOLO_P[1] + 0.65, VOLO_P[2] + 5.9, VOLO_P[0] - 0.5, VOLO_P[1] + 4.6, VOLO_P[2] - 4, 44]],
	// 笛子：那个人的手
	[T.flute + 10, [REI_P[0] + 2.4, REI_P[1] + 1.5, REI_P[2] + 4.2, REI_P[0], REI_P[1] + 1.05, REI_P[2], 36]],
	[T.l86 - 10, [REI_P[0] + 2.2, REI_P[1] + 1.5, REI_P[2] + 3.9, REI_P[0], REI_P[1] + 1.1, REI_P[2], 34]],
	// 望罗离开：拉开
	[T.end7, [SPEAR.x + 11, 2.6, 44, SPEAR.x + 1, 3, 22, 42]],
];

const viewAt = (f: number): View => {
	const c = flow(f, CAM7);
	const kick = (at: number, amp: number, len: number) => (f >= at && f < at + len ? amp * Math.exp(-(f - at) / 10) : 0);
	const k = kick(T.origin, 0.9, 40) + kick(DUEL.clash, 0.6, 40) + kick(DUEL.hit, 1.0, 50);
	return {pos: [c[0], c[1], c[2]], target: [c[3] + Math.sin(f * 2.3) * k, c[4] + Math.sin(f * 1.7) * k * 0.7, c[5]], fov: c[6]};
};

/** 天色：黄昏 → 回忆后变暗 → 裂口打开时近乎入夜，天泛紫红 → 骑拉帝纳退走后夜色 */
const duskAt = (f: number) => track(f, [[T.l79, 1], [T.revTear, 0.45], [T.l82 + 60, 0.35], [T.end7, 0.25]]);
const redAt = (f: number) => track(f, [[T.revTear - 20, 0], [T.gira, 0.7], [T.l82 + 20, 0.7], [T.l83, 0]]);

const RuinsWorld: React.FC<{f: number; v: View}> = ({f, v}) => {
	const time = f / 30;
	const dusk = duskAt(f);
	return (
		<ThreeCanvas width={1920} height={1080} shadows gl={{antialias: true}}>
			<CameraRig pos={v.pos} target={v.target} fov={v.fov} far={900} />
			<CoronetLights dusk={dusk} />
			<Sky cam={v.pos} s={{dusk, starRot: f * 0.0006, trail: 0, gold: 0, red: redAt(f), time}} />
			<Terrain />
			<Temple ruin={0.25} build={1} blast={1} early={1} />
			{STATUES.map((s, i) => (
				<StoneStatue key={s.name} dir={s.dir} pos={[s.x, TEMPLE.stepTop + PEDESTAL_H, s.z]} ry={s.ry} height={3.3} opacity={1} shatter={8} seed={i + 3} />
			))}
			<Snow cam={v.pos} time={time} amount={0.35 + 0.3 * prog(f, T.l86, T.end7)} wind={1.3} color={dusk > 0.5 ? '#f3e8e4' : '#e4e2f0'} />
		</ThreeCanvas>
	);
};

// ── 2D：叠在废墟上的东西 ──

const GIRA_LIGHT: ArtLighting = {
	depthScale: 0.5,
	ambient: [0.55, 0.5, 0.58],
	dirLights: [
		{dir: [0.1, -1, 0.5], color: [0.95, 0.75, 0.85], wrap: 0.45},
		{dir: [-0.8, 0.2, 0.4], color: [0.35, 0.1, 0.18], wrap: 0.5},
	],
	rim: {dir: [0, -1], color: [1.2, 0.45, 0.45], power: 3},
};

/** 世界背面的裂口：一团黑，边缘一圈暗红的光，慢慢翻涌 */
const TearLayer: React.FC<{f: number; v: View}> = ({f, v}) => {
	const open = ease(prog(f, T.revTear, T.gira + 20)) * (1 - ease(prog(f, T.l82 + 40, T.l82 + 85)));
	if (open <= 0.001) return null;
	const c = toScreen(v, TEAR);
	const R = 420 * open;
	const pts = Array.from({length: 40}, (_, i) => {
		const a = (i / 40) * Math.PI * 2;
		const w = 1 + 0.18 * Math.sin(a * 5 + f * 0.05) + 0.1 * Math.sin(a * 11 - f * 0.08) + 0.08 * (rnd(i) - 0.5);
		return `${c.x + Math.cos(a) * R * w},${c.y + Math.sin(a) * R * 0.42 * w}`;
	}).join(' ');
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: c.x - R * 1.8, top: c.y - R * 1.1, width: R * 3.6, height: R * 2.2, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(200,30,50,0.45) 0%, rgba(120,10,40,0.2) 45%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, filter: 'drop-shadow(0 0 10px rgba(255,60,70,0.9)) drop-shadow(0 0 40px rgba(200,20,40,0.6))'}}>
				<polygon points={pts} fill="#050006" stroke="rgba(255,80,90,0.9)" strokeWidth={4} />
			</svg>
		</AbsoluteFill>
	);
};

/** 骑拉帝纳在空中的位置：从裂口钻出 → 悬在废墟上方（被打中时往后一退）→ 缩回裂口 */
const giraAt = (f: number): V3 => {
	const out = ease(prog(f, T.gira, T.giraPeak));
	const back = ease(prog(f, T.l82 + 22, T.l82 + 70));
	const recoil = interpolate(f, [DUEL.hit, DUEL.hit + 8, DUEL.hit + 70], [0, 1, 0.4], clamp);
	const k = out * (1 - back);
	return [TEAR[0] + (GIRA_P[0] - TEAR[0]) * k, TEAR[1] + (GIRA_P[1] - TEAR[1]) * k + Math.sin(f * 0.05) * 0.5 + 2.5 * recoil, TEAR[2] + (GIRA_P[2] - TEAR[2]) * k - 6 * recoil];
};

/** 对抗的节拍（2026-10-25 加）：那个人的宝可梦不露面，只用它那一侧的蓝白光表现 */
const DUEL = {
	charge: T.duel + 8,
	fire: T.duel + 62,
	clash: T.duel + 70,
	hit: T.duel + 116,
};
/** 抖动的光束：从 a 到 b 的折线，n 段，振幅 amp（两端不抖） */
const jag = (a: {x: number; y: number}, b: {x: number; y: number}, f: number, seed: number, amp: number, n = 14) => {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const l = Math.hypot(dx, dy) || 1;
	const nx = -dy / l;
	const ny = dx / l;
	return Array.from({length: n + 1}, (_, i) => {
		const t = i / n;
		const w = i === 0 || i === n ? 0 : (rnd(i * 7.3 + seed + Math.floor(f / 2) * 1.7) - 0.5) * amp * Math.sin(Math.PI * t);
		return `${a.x + dx * t + nx * w},${a.y + dy * t + ny * w}`;
	}).join(' ');
};

/** 对抗：骑拉帝纳蓄力、打出暗红的光 → 蓝白的光在那个人身前挡住 → 一点点推回去 → 打中骑拉帝纳 */
const DuelLayer: React.FC<{f: number; v: View}> = ({f, v}) => {
	if (f < T.duel - 5 || f > T.l82 + 10) return null;
	const gs = toScreen(v, giraAt(f));
	const rs = toScreen(v, [REI_P[0] - 0.6, REI_P[1] + 1.3, REI_P[2] - 2.5]);
	if (gs.behind || rs.behind) return null;
	const k = Math.max(1.15, gs.s / 40);
	const charge = ease(prog(f, DUEL.charge, DUEL.fire)) * (1 - prog(f, DUEL.fire, DUEL.fire + 8));
	const orb = {x: gs.x, y: gs.y + 60 * k};
	const fired = f >= DUEL.fire && f < DUEL.hit + 6;
	const reach = ease(prog(f, DUEL.fire, DUEL.clash));
	const front = 0.82 * reach - 0.82 * ease(prog(f, DUEL.clash + 10, DUEL.hit));
	const meet = {x: orb.x + (rs.x - orb.x) * Math.max(0, front), y: orb.y + (rs.y - orb.y) * Math.max(0, front)};
	const blue = f >= DUEL.clash - 4 && f < DUEL.hit + 30;
	const blueEnd = f < DUEL.hit ? meet : orb;
	const blueO = interpolate(f, [DUEL.clash - 4, DUEL.clash, DUEL.hit + 6, DUEL.hit + 30], [0, 1, 1, 0], clamp);
	const redO = interpolate(f, [DUEL.fire, DUEL.fire + 4, DUEL.hit - 6, DUEL.hit + 2], [0, 1, 1, 0], clamp);
	const clashFlash = interpolate(f, [DUEL.clash - 2, DUEL.clash, DUEL.clash + 30], [0, 1, 0.35], clamp) * (f < DUEL.hit ? 1 : 0);
	const hitFlash = interpolate(f, [DUEL.hit - 2, DUEL.hit + 1, DUEL.hit + 45], [0, 1, 0], clamp);
	const shield = interpolate(f, [DUEL.clash - 6, DUEL.clash + 4, DUEL.hit + 20, DUEL.hit + 50], [0, 1, 1, 0], clamp);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{charge > 0.01 ? (
				<>
					<div style={{position: 'absolute', left: orb.x - 260 * k, top: orb.y - 260 * k, width: 520 * k, height: 520 * k, borderRadius: '50%', opacity: charge, background: 'radial-gradient(circle, rgba(255,90,110,0.55) 0%, rgba(150,10,50,0.35) 30%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
					<div style={{position: 'absolute', left: orb.x - 70 * k * charge, top: orb.y - 70 * k * charge, width: 140 * k * charge, height: 140 * k * charge, borderRadius: '50%', background: 'radial-gradient(circle, #070006 0%, #12000a 55%, rgba(255,70,90,0.9) 72%, rgba(255,70,90,0) 100%)', boxShadow: `0 0 ${40 * k}px rgba(255,60,80,0.8)`}} />
					<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
						{Array.from({length: 22}, (_, i) => {
							const t = ((f - DUEL.charge) * 0.03 + rnd(i * 2.1)) % 1;
							const a = rnd(i * 4.7) * Math.PI * 2 + f * 0.02;
							const r = (1 - t) * 300 * k;
							return <circle key={i} cx={orb.x + Math.cos(a) * r} cy={orb.y + Math.sin(a) * r * 0.7} r={2 + 3 * t} fill={`rgba(255,110,120,${charge * t})`} />;
						})}
					</svg>
				</>
			) : null}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{fired && redO > 0 ? (
					<g opacity={redO} style={{filter: 'drop-shadow(0 0 10px rgba(255,50,70,0.95)) drop-shadow(0 0 34px rgba(180,10,40,0.7))'}}>
						<polyline points={jag(orb, meet, f, 3, 40 * k)} fill="none" stroke="#0a0006" strokeWidth={30 * k} strokeLinecap="round" strokeLinejoin="round" />
						<polyline points={jag(orb, meet, f, 9, 26 * k)} fill="none" stroke="rgba(255,80,95,0.95)" strokeWidth={5 * k} strokeLinecap="round" strokeLinejoin="round" />
					</g>
				) : null}
				{blue && blueO > 0 ? (
					<g opacity={blueO} style={{mixBlendMode: 'screen', filter: 'drop-shadow(0 0 12px rgba(170,215,255,1)) drop-shadow(0 0 44px rgba(110,170,255,0.8))'}}>
						<polyline points={jag(rs, blueEnd, f, 5, 22 * k)} fill="none" stroke="rgba(150,200,255,0.75)" strokeWidth={26 * k} strokeLinecap="round" strokeLinejoin="round" />
						<polyline points={jag(rs, blueEnd, f, 11, 10 * k)} fill="none" stroke="#ffffff" strokeWidth={8 * k} strokeLinecap="round" strokeLinejoin="round" />
					</g>
				) : null}
			</svg>
			{shield > 0 ? <div style={{position: 'absolute', left: rs.x - 200 * k, top: rs.y - 200 * k, width: 400 * k, height: 400 * k, borderRadius: '50%', opacity: shield, background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(170,215,255,0.7) 16%, rgba(110,170,255,0.22) 42%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} /> : null}
			{clashFlash > 0 ? <div style={{position: 'absolute', left: meet.x - 320 * k, top: meet.y - 320 * k, width: 640 * k, height: 640 * k, borderRadius: '50%', opacity: clashFlash, background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(230,190,255,0.7) 14%, rgba(200,120,200,0.2) 40%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} /> : null}
			{hitFlash > 0 ? (
				<>
					<div style={{position: 'absolute', left: orb.x - 700 * k, top: orb.y - 700 * k, width: 1400 * k, height: 1400 * k, borderRadius: '50%', opacity: hitFlash, background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(190,225,255,0.8) 12%, rgba(110,170,255,0.25) 38%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
					<AbsoluteFill style={{background: `rgba(220,235,255,${0.35 * hitFlash})`, mixBlendMode: 'screen'}} />
				</>
			) : null}
		</AbsoluteFill>
	);
};

/** 骑拉帝纳（官方立绘）：从裂口里钻出、显色 → 全身发光，光里换成起源形态，光退去 → 输了，光里变回别种形态、缩回裂口
 *  （游戏里：以别种形态现身，战斗中变成起源形态，输后变回别种形态逃走。Bulbapedia「Volo」「Temple of Sinnoh」） */
/** 输了、变回别种形态的那一帧 */
const REVERT = T.l82 + 6;
const GIRA_ART = {altered: 'pokemon/giratina/art.png', origin: 'pokemon/giratina/art-origin.png'};
const GiratinaLayer: React.FC<{f: number; v: View}> = ({f, v}) => {
	if (f < T.gira || f > T.l82 + 80) return null;
	const out = ease(prog(f, T.gira, T.giraPeak));
	const back = ease(prog(f, T.l82 + 22, T.l82 + 70));
	const p = giraAt(f);
	const s = toScreen(v, p);
	if (s.behind) return null;
	const size = GIRA_BOX * s.s * (0.45 + 0.55 * out) * (1 - 0.85 * back);
	const reverted = f >= REVERT;
	const origin = f >= T.origin && !reverted;
	// 全身发光：别种形态越来越亮、整个轮廓被白光盖满 → 换成起源形态，白光从轮廓上褪去
	const glowUp = ease(prog(f, T.origin - 42, T.origin));
	const glowDown = 1 - ease(prog(f, T.origin + 2, T.originPeak + 14));
	// 输了：再被一层淡一些的白光盖住，光里变回别种形态
	const revUp = ease(prog(f, REVERT - 16, REVERT));
	const revDown = 1 - ease(prog(f, REVERT + 2, REVERT + 26));
	const white = reverted ? 0.85 * revDown : origin ? Math.max(glowDown, 0.85 * revUp) : glowUp;
	const hitK = interpolate(f, [DUEL.hit - 2, DUEL.hit + 2, DUEL.hit + 40], [0, 1, 0], clamp);
	const bright = (reverted ? 0.8 + 1.2 * revDown : origin ? 1 + 1.4 * glowDown + 1.2 * revUp : interpolate(f, [T.gira, T.giraPeak], [0.03, 1], clamp) + 1.6 * glowUp) + 1.3 * hitK;
	const o = interpolate(f, [T.gira, T.gira + 15, T.l82 + 50, T.l82 + 74], [0, 1, 1, 0], clamp);
	const pulse = 0.85 + 0.15 * Math.sin(f * 0.6);
	const art = origin ? GIRA_ART.origin : GIRA_ART.altered;
	const halo = white * pulse;
	return (
		<>
			<div style={{position: 'absolute', left: s.x - size * 0.7, top: s.y - size * 0.7, width: size * 1.4, height: size * 1.4, borderRadius: '50%', opacity: 0.5 * o, background: 'radial-gradient(circle, rgba(255,70,90,0.35) 0%, rgba(120,0,40,0.18) 40%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			<PokemonArt3D dir="pokemon/giratina" variant={origin ? '-origin' : ''} x={s.x} y={s.y} size={size} {...GIRA_LIGHT} brightness={bright} opacity={o} resolution={1.3} />
			{white > 0.003 ? (
				<>
					{/* 轮廓外的光晕 */}
					<Img src={staticFile(art)} style={{position: 'absolute', left: s.x - size / 2, top: s.y - size / 2, width: size, height: size, opacity: halo * o, filter: 'brightness(0) invert(1) blur(18px) drop-shadow(0 0 30px rgba(230,150,255,0.9))', mixBlendMode: 'screen'}} />
					{/* 整个身体被白光盖满 */}
					<Img src={staticFile(art)} style={{position: 'absolute', left: s.x - size / 2, top: s.y - size / 2, width: size, height: size, opacity: Math.pow(white, 1.4) * o, filter: 'brightness(0) invert(1) drop-shadow(0 0 6px rgba(255,220,255,1))'}} />
				</>
			) : null}
		</>
	);
};

/** 外衣：从望罗身上被风卷走 */
const Coat: React.FC<{f: number; v: View}> = ({f, v}) => {
	const t = prog(f, T.coat, T.coat + 75);
	if (t <= 0 || t >= 1) return null;
	const s = toScreen(v, [VOLO_P[0], VOLO_P[1] + 1.2, VOLO_P[2]]);
	const h = 1.1 * s.s;
	const x = s.x + 520 * t * t + Math.sin(t * 9) * 30;
	const y = s.y - 260 * t + 60 * Math.sin(t * 5);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: 1 - t}}>
			<g transform={`translate(${x},${y}) rotate(${-20 + 200 * t}) scale(${h / 170}, ${(h / 170) * (0.6 + 0.4 * Math.cos(t * 7))})`}>
				<path d="M-30,-50 L30,-50 L46,-30 L40,50 L-40,50 L-46,-30 Z M-46,-30 L-70,20 L-58,26 L-38,-10 Z M46,-30 L70,20 L58,26 L38,-10 Z" fill="#0b0808" stroke="rgba(255,190,140,0.6)" strokeWidth={2} />
			</g>
		</svg>
	);
};

/** 天界之笛：那个人手里的笛子亮起来，一圈蓝白的光 */
export const Flute: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.flute, T.flute + 30, T.end7 - 20, T.end7], [0, 1, 1, 0.7], clamp);
	if (a <= 0) return null;
	const s = toScreen(v, [REI_P[0] + 0.12, REI_P[1] + 1.05, REI_P[2] + 0.15]);
	const ring = prog(f, T.flute + 20, T.flute + 70);
	const k = s.s / 130;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: s.x - 220 * k, top: s.y - 220 * k, width: 440 * k, height: 440 * k, borderRadius: '50%', opacity: a, background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(150,200,255,0.75) 12%, rgba(90,150,255,0.22) 40%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
				<ellipse cx={s.x} cy={s.y} rx={40 * k + 600 * k * ring} ry={14 * k + 210 * k * ring} fill="none" stroke={`rgba(170,215,255,${0.8 * (1 - ring)})`} strokeWidth={4} />
				{Array.from({length: 24}, (_, i) => {
					const t = ((f - T.flute) * (0.6 + rnd(i) * 0.6) + rnd(i * 3) * 120) % 120;
					const x = s.x + (rnd(i * 5) - 0.5) * 260 * k + Math.sin(t * 0.08 + i) * 20 * k;
					const y = s.y - t * 3 * k;
					return <circle key={i} cx={x} cy={y} r={2 + rnd(i * 7) * 3} fill={`rgba(200,230,255,${a * (1 - t / 120)})`} />;
				})}
			</svg>
		</AbsoluteFill>
	);
};

const Layers3D: React.FC<{f: number; v: View}> = ({f, v}) => {
	const cold = prog(f, T.coat, T.coat + 50);
	const rgb = `${Math.round(255 - 70 * cold)},${Math.round(190 - 40 * cold)},${Math.round(140 + 115 * cold)}`;
	// 望罗离开：往左边走、隐进风雪里
	const leave = prog(f, T.l86 + 40, T.end7);
	const volo: V3 = g(VOLO_P[0] - 6 * leave, VOLO_P[2] + 1.5 * leave);
	const voloO = interpolate(f, [T.end6, T.l72 + 10], [0, 1], clamp) * (1 - prog(f, T.l86 + 90, T.end7));
	const reiO = interpolate(f, [T.end6, T.l72 + 10], [0, 1], clamp);
	const shout = interpolate(f, [T.l83, T.l83 + 20], [0, 1], clamp);
	return (
		<>
			<TearLayer f={f} v={v} />
			<GiratinaLayer f={f} v={v} />
			<DuelLayer f={f} v={v} />
			<Glow v={v} p={[VOLO_P[0], VOLO_P[1] + 1.7, VOLO_P[2] - 1]} r={260} rgb="200,170,255" a={0.18 * shout * (1 - prog(f, T.l85, T.l85 + 40))} />
			<TrainerSil v={v} {...REI} foot={REI_P} h={1.65} o={reiO} from="right" rgb="255,200,170" lift={0.12} />
			<TrainerSil v={v} file="trainers/volo/la.png" aspect={630 / 1600} foot={volo} h={1.78} o={voloO} from="left" rgb={rgb} lift={0.13} />
			<Coat f={f} v={v} />
			<Flute f={f} v={v} />
		</>
	);
};

// ── 2D：回忆（红色）──

const MEM_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTear;
out vec4 outColor;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * vn(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = (uv - vec2(0.5, 0.62)) * vec2(uRes.x / uRes.y, 1.0);
	float n = fbm(p * 2.2 + vec2(uTime * 0.04, -uTime * 0.02) + fbm(p * 1.3 - uTime * 0.03));
	vec3 col = mix(vec3(0.08, 0.01, 0.02), vec3(0.42, 0.08, 0.08), smoothstep(0.3, 0.85, n));
	// 撕开的裂缝：中间一道白红的光，向外炸出裂纹
	float r = length(p);
	float a = atan(p.y, p.x);
	float cracks = 0.0;
	for (int k = 0; k < 12; k++) {
		float fk = float(k);
		float th = fk * 0.5236 + (h1(vec2(fk, 1.7)) - 0.5) * 0.4;
		float len = (0.25 + 0.5 * h1(vec2(fk, 4.2))) * uTear;
		float d = abs(mod(a - th + (vn(vec2(r * 18.0, fk)) - 0.5) * 0.3 + 3.14159, 6.28318) - 3.14159);
		cracks += smoothstep(0.02 / max(r, 0.05), 0.0, d) * step(r, len) * (1.0 - r / max(len, 0.001));
	}
	col += vec3(1.0, 0.75, 0.7) * (cracks * 0.9 + exp(-r / max(0.04 * uTear, 0.001)) * 1.4 * uTear);
	// 旧胶片：晕影与闪烁
	col *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length((uv - 0.5) * vec2(1.3, 1.0)));
	col *= 0.92 + 0.08 * vn(vec2(uTime * 12.0, 0.0));
	outColor = vec4(col, 1.0);
}`;

/** 回忆一：骑拉帝纳撕开时空、双神发狂（红色、旧胶片） */
const MemoryRift: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.memory - 10, T.memory + 15, T.l76 - 10, T.l76 + 15], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const tear = ease(prog(f, T.l75, T.l75 + 70));
	const mad = prog(f, T.l75 + 70, T.l75 + 110);
	const shake = (seed: number) => (mad > 0 ? Math.sin(f * 1.9 + seed) * 6 * mad : 0);
	const sil = (rgb: string, k = 1) => `brightness(0) drop-shadow(0 0 ${3 * k}px rgba(${rgb},0.95)) drop-shadow(0 0 ${22 * k}px rgba(${rgb},0.6))`;
	return (
		<AbsoluteFill style={{opacity: o}}>
			<ShaderCanvas frag={MEM_FRAG} width={1920} height={1080} scale={0.5} uniforms={{uTime: f / 30, uTear: tear}} style={{position: 'absolute', inset: 0}} />
			{/* 骑拉帝纳：裂缝后面的一团黑影 */}
			<Img src={staticFile('pokemon/giratina/art.png')} style={{position: 'absolute', left: 960 - 520, top: 120 - 30 * tear, width: 1040, height: 1040, opacity: 0.85 * interpolate(f, [T.l75 - 5, T.l75 + 40], [0, 1], clamp), filter: sil('255,60,60', 1.5)}} />
			{/* 双神：两边的黑影，发狂时一抖一抖 */}
			<Img src={staticFile('pokemon/dialga/art.png')} style={{position: 'absolute', left: 40 + shake(1), top: 380 + shake(2), width: 640, height: 640, opacity: mad, filter: sil('110,150,255')}} />
			<Img src={staticFile('pokemon/palkia/art-origin.png')} style={{position: 'absolute', left: 1240 + shake(3), top: 340 + shake(4), width: 680, height: 680, opacity: mad, transform: 'scaleX(-1)', filter: sil('255,130,200')}} />
		</AbsoluteFill>
	);
};

/** 回忆二：天上的金光，望罗仰望；洗翠化成光点散去 */
const DUST = Array.from({length: 160}, (_, i) => ({x: rnd(i * 1.3) * 1920, y: 560 + rnd(i * 2.7) * 520, v: 1 + rnd(i * 4.1) * 3, r: 1 + rnd(i * 5.9) * 2.5}));
const RIDGES = (() => {
	const line = (seed: number, y: number, amp: number) =>
		'M0,1080 ' +
		Array.from({length: 33}, (_, i) => {
			const x = i * 60;
			return `L${x},${y - amp * (0.5 + 0.5 * Math.sin(i * 0.7 + seed) * Math.cos(i * 0.23 + seed * 2))}`;
		}).join(' ') +
		' L1920,1080 Z';
	return [line(1, 720, 140), line(4, 820, 90)];
})();
const VILLAGE = Array.from({length: 26}, (_, i) => ({x: 260 + rnd(i * 3.3) * 1400, y: 820 + rnd(i * 1.7) * 160}));

/** 缠住金光的暗流：从地平线各处伸出，末端落在金光边上 */
const TENDRILS = [
	{x: 240, y: 1000, c1: 120, c2: -420, ex: -70, ey: 40, w: 16},
	{x: 620, y: 1040, c1: -80, c2: -220, ex: -40, ey: 60, w: 22},
	{x: 900, y: 1080, c1: 60, c2: -60, ex: -10, ey: 70, w: 26},
	{x: 1180, y: 1060, c1: -40, c2: 160, ex: 30, ey: 64, w: 20},
	{x: 1520, y: 1020, c1: -150, c2: 360, ex: 60, ey: 44, w: 18},
	{x: 1760, y: 960, c1: -60, c2: 520, ex: 80, ey: 20, w: 12},
];

const MemoryGold: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.l76 - 10, T.l76 + 15, T.l78 - 10, T.l78 + 15], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const gold = interpolate(f, [T.l76, T.l76 + 60], [0.3, 1], clamp);
	const erase = prog(f, T.l77 + 20, T.l77 + 140);
	const white = interpolate(f, [T.l77 + 100, T.l78 - 5], [0, 0.85], clamp);
	// "把创造神逼出来，让它臣服"：地底伸出暗红的锁链状暗流，缠住金光往下拽，金光一抖一抖（2026-10-25 加）
	const grab = ease(prog(f, T.l76 + 10, T.l76 + 80));
	const pull = ease(prog(f, T.l76 + 60, T.l77 + 20));
	const chainsO = 1 - prog(f, T.l77 + 20, T.l77 + 80);
	const gy = 200 + 110 * pull + Math.sin(f * 1.3) * 5 * pull;
	const gx = 960 + Math.sin(f * 1.1 + 1) * 4 * pull;
	return (
		<AbsoluteFill style={{opacity: o, background: 'linear-gradient(180deg, #120a10 0%, #2a1418 55%, #3a1e1a 100%)'}}>
			<div style={{position: 'absolute', left: gx - 260 - 160 * gold, top: gy - 260 - 160 * gold, width: (260 + 160 * gold) * 2, height: (260 + 160 * gold) * 2, borderRadius: '50%', opacity: 1 - 0.25 * pull, background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,214,140,0.85) 8%, rgba(255,200,120,0.22) 30%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			{grab > 0 && chainsO > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: chainsO, filter: 'drop-shadow(0 0 6px rgba(255,50,70,0.9)) drop-shadow(0 0 22px rgba(170,10,40,0.6))'}}>
					{TENDRILS.map((t, i) => {
						const w = Math.sin(f * 0.05 + i * 1.7) * 60;
						const d = `M${t.x},${t.y} C${t.x + t.c1 + w},${t.y - 300} ${gx + t.c2 - w},${gy + 260} ${gx + t.ex},${gy + t.ey}`;
						return (
							<g key={i}>
								<path d={d} pathLength={1} fill="none" stroke="#0a0006" strokeWidth={t.w} strokeLinecap="round" strokeDasharray={`${grab} 1`} />
								<path d={d} pathLength={1} fill="none" stroke="rgba(255,80,95,0.85)" strokeWidth={t.w * 0.18} strokeLinecap="round" strokeDasharray={`${grab} 1`} />
							</g>
						);
					})}
				</svg>
			) : null}
			{/* 洗翠：山影、村子的灯，一点点化成光点往上散 */}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: 1 - erase}}>
				<path d={RIDGES[0]} fill="#1a0e10" />
				<path d={RIDGES[1]} fill="#0c0708" />
				{VILLAGE.map((p, i) => (
					<circle key={i} cx={p.x} cy={p.y} r={3} fill="rgba(255,190,110,0.9)" opacity={1 - prog(erase, (i % 7) / 9, (i % 7) / 9 + 0.2)} />
				))}
			</svg>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{DUST.map((d, i) => {
					const t = Math.max(0, f - T.l77 - 20 - (i % 20) * 3);
					if (t <= 0) return null;
					const a = Math.min(1, t / 20) * (1 - Math.min(1, t / 130));
					return <circle key={i} cx={d.x + Math.sin(t * 0.04 + i) * 20} cy={d.y - t * d.v} r={d.r} fill={`rgba(255,226,170,${a})`} />;
				})}
			</svg>
			<ScreenSil file="trainers/volo/la.png" aspect={630 / 1600} x={1400} y={1080 - 300} h={620} rgb="255,214,150" lift={0.1} from="top" o={1 - erase * 0.8} />
			<AbsoluteFill style={{background: `rgba(255,246,230,${white})`}} />
		</AbsoluteFill>
	);
};

/** 回忆三：古代神奥人朝金光跪拜，望罗站在他们中间 */
const ANCIENTS = Array.from({length: 13}, (_, i) => ({x: 200 + i * 125 + (rnd(i * 2.2) - 0.5) * 50, y: 880 + (i % 3) * 22, h: 150 + rnd(i * 3.1) * 30}));
const MemoryAncients: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.l78 - 10, T.l78 + 20, T.back7 - 10, T.back7 + 15], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const white = interpolate(f, [T.l78 - 10, T.l78 + 30], [0.85, 0], clamp);
	const volo = interpolate(f, [T.l78 + 50, T.l78 + 90], [0, 1], clamp);
	return (
		<AbsoluteFill style={{opacity: o, background: 'linear-gradient(180deg, #3a2a3e 0%, #a46a5a 55%, #e0a070 78%, #6a3e30 100%)'}}>
			<div style={{position: 'absolute', left: 960 - 360, top: 160 - 360, width: 720, height: 720, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,220,150,0.8) 10%, rgba(255,200,120,0.2) 35%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<path d="M0,1080 L0,900 C300,880 700,860 960,860 C1220,860 1620,880 1920,900 L1920,1080 Z" fill="#e8dcd8" />
			</svg>
			{ANCIENTS.map((p, i) => (
				<Person key={i} x={p.x} y={p.y} height={p.h} pose={i % 3 === 1 ? 'pray' : 'kneel'} t={0.5 + 0.5 * Math.sin(f * 0.04 + i)} flip={i % 2 === 0} rimDir={[0, -1]} rim={0.9} rimColor="#ffd38a" opacity={1} />
			))}
			<ScreenSil file="trainers/volo/la.png" aspect={630 / 1600} x={1250} y={1080 - 330} h={560} rgb="255,214,150" lift={0.1} from="top" o={volo} />
			<AbsoluteFill style={{background: `rgba(255,246,230,${white})`}} />
		</AbsoluteFill>
	);
};

// ── 2D：没有天地之分的世界 ──

const VOID_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
out vec4 outColor;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p *= 2.03; a *= 0.5; } return v; }
// 浮岛：上下都有，有的倒挂；平顶、往下（或往上）收尖
float island(vec2 p, vec2 c, float w, float flip) {
	vec2 q = (p - c) / w;
	q.y *= flip;
	float top = abs(q.x) < 1.0 ? 0.0 : 1.0;
	float body = q.y < 0.05 && q.y > -(1.0 - q.x * q.x) * (0.9 + 0.3 * vn(vec2(q.x * 6.0, c.x))) ? 1.0 : 0.0;
	return body * (1.0 - top);
}
void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
	float n = fbm(p * 1.8 + vec2(0.0, uTime * 0.05));
	vec3 col = mix(vec3(0.03, 0.05, 0.05), vec3(0.16, 0.22, 0.2), smoothstep(0.3, 0.9, n));
	// 往上流的瀑布
	for (int k = 0; k < 4; k++) {
		float fk = float(k);
		float x = -0.7 + fk * 0.47 + 0.1 * sin(fk * 3.0);
		float band = smoothstep(0.035, 0.0, abs(p.x - x));
		float flow = vn(vec2(p.x * 40.0, p.y * 6.0 + uTime * 2.0 + fk * 9.0));
		col += vec3(0.35, 0.5, 0.55) * band * (0.4 + 0.6 * flow) * 0.5;
	}
	// 浮岛
	float isl = 0.0;
	for (int k = 0; k < 9; k++) {
		float fk = float(k);
		vec2 c = vec2(h1(vec2(fk, 1.0)) * 1.8 - 0.9, h1(vec2(fk, 2.0)) * 0.9 - 0.45 + 0.03 * sin(uTime * 0.6 + fk));
		float w = 0.06 + 0.1 * h1(vec2(fk, 3.0));
		float flip = h1(vec2(fk, 4.0)) < 0.5 ? 1.0 : -1.0;
		isl = max(isl, island(p, c, w, flip));
	}
	col = mix(col, vec3(0.02, 0.025, 0.03), isl * 0.9);
	col *= 1.0 - 0.5 * smoothstep(0.4, 1.0, length((uv - 0.5) * vec2(1.3, 1.0)));
	outColor = vec4(col, 1.0);
}`;

const VoidShot: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.void7 - 8, T.void7 + 12, T.duel - 12, T.duel + 6], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const spin = -40 * ease(prog(f, T.void7, T.duel));
	return (
		<AbsoluteFill style={{opacity: o}}>
			<ShaderCanvas frag={VOID_FRAG} width={1920} height={1080} scale={0.5} uniforms={{uTime: f / 30}} style={{position: 'absolute', inset: 0}} />
			<PokemonArt3D dir="pokemon/giratina" variant="-origin" x={960} y={520} size={900} {...GIRA_LIGHT} ambient={[0.5, 0.58, 0.55]} rim={{dir: [0, -1], color: [0.6, 0.9, 0.8], power: 3}} resolution={1.2} style={{transform: `rotate(${spin}deg)`}} />
		</AbsoluteFill>
	);
};

// ── 合在一起 ──

export const VoloMaster: React.FC<{f: number}> = ({f}) => {
	const v = viewAt(f);
	const dissolve = prog(f, T.end6, T.end6 + 40);
	const in3D = f < T.memory + 20 || f >= T.back7 - 15;
	const lum = in3D ? 0.5 : 0.2;
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			{in3D ? <RuinsWorld f={f} v={v} /> : null}
			{in3D ? <Layers3D f={f} v={v} /> : null}
			{dissolve < 1 ? (
				<AbsoluteFill style={{opacity: 1 - ease(dissolve)}}>
					<RuinShot f={f} />
				</AbsoluteFill>
			) : null}
			<MemoryRift f={f} />
			<MemoryGold f={f} />
			<MemoryAncients f={f} />
			<VoidShot f={f} />
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.52) 100%)', pointerEvents: 'none'}} />
			<NameTag from={T.giraPeak + 4} x={150} y={560} no="No.0487" zh="骑拉帝纳" en="GIRATINA" category="反抗宝可梦" categoryEn="Renegade Pokémon" opacity={interpolate(f, [T.origin - 20, T.origin], [1, 0], clamp)} />
			{SUBS_VOLO.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			<Cry name="giratina" at={T.giraPeak} />
			<Cry name="giratina-origin" at={T.originPeak} />
			<Grain opacity={0.12 - 0.05 * lum} />
		</AbsoluteFill>
	);
};

export const SUBS_VOLO: [number, number, string, string, SubtitleSource?][] = [
	[T.l72, T.l72 + 115, '你们回到神殿的废墟。望罗看着那些断掉的石头，说：', 'You returned with him to the temple ruins. Looking at the broken stone, Volo said:'],
	[T.l73, T.l73 + 115, '「神殿毁成这样……简直就像一柱一柱的枪啊。」', '"Like pillars now turned into spears, stabbing into the heavens..."', {zh: '《传说 阿尔宙斯》望罗台词', en: 'Bulbapedia, Volo/Quotes'}],
	[T.l74, T.l74 + 75, '然后，他脱下了商会的衣服。', 'Then he cast off his guild uniform.'],
	[T.l75, T.l75 + 185, '裂缝是他帮着打开的。他找到了骑拉帝纳，让它撕开时空，逼时间与空间之神发狂。', 'He had helped open the rift. He sought out Giratina, had it tear through space and time, and drove the gods of time and space mad.'],
	[T.l76, T.l76 + 145, '他想把创造神逼出来，让它臣服，再用它的力量重新创造世界。', 'He meant to drag the creator out, make it submit, and use its power to make the world anew.'],
	[T.l77, T.l77 + 150, '那样一来，洗翠和这里所有的人与宝可梦，都会像从没存在过一样。', 'And Hisui—every person and Pokémon in it—would be as if it had never been.'],
	[T.l78, T.l78 + 155, '他说，自己是古代神奥人的后代——最早崇拜神奥大尊的那群人。', 'He claimed descent from the ancient Sinnoh people—the first who worshipped almighty Sinnoh.'],
	[T.l79, T.l79 + 110, '唯一认得真神的人，想把神的世界推倒重来。', 'The one man who knew the true god wanted to tear its world down and begin again.'],
	[T.l80, T.l80 + 85, '骑拉帝纳从世界的背面钻了出来。', 'Giratina emerged from the reverse side of the world.'],
	[T.l81, T.l81 + 110, '据推测，它栖息在一个没有天地之分的世界。', 'It is thought to dwell in a world where there is no up and no down.', {zh: '骑拉帝纳（起源形态）《传说 阿尔宙斯》图鉴，改写', en: 'Giratina (Origin Forme) LA Pokédex, paraphrased'}],
	[T.l82, T.l82 + 95, '它也输给了你，变回原样，逃回了世界的背面。', 'It too fell to you, changed back, and fled to the other side.'],
	[T.l83, T.l83 + 125, '「阿尔宙斯啊，如果你还有心的话，就告诉小生吧！」', '"Almighty Arceus, if you have any heart within you, then tell me..."', {zh: '《传说 阿尔宙斯》望罗台词', en: 'Bulbapedia, Volo/Quotes'}],
	[T.l84, T.l84 + 125, '「继承了古代神奥人血脉的小生，究竟哪里不好？」', '"The blood of the ancient Sinnoh people flows in my veins, does it not?! What is it, then, that you find so lacking in me?!"', {zh: '《传说 阿尔宙斯》望罗台词', en: 'Bulbapedia, Volo/Quotes'}],
	[T.l85, T.l85 + 125, '没有回答。只有你身上的笛子，变成了天界之笛。', 'No answer came. Only the flute you carried became the Azure Flute.'],
	[T.l86, T.l86 + 170, '望罗明白，神选的是你，不是他。他发誓：「不管要几年、几十年，还是几百年。」', 'Volo understood: the god had chosen you, not him. He swore: "No matter how many years, how many decades, how many centuries."'],
];
