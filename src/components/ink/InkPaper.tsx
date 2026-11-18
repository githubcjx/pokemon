import {AbsoluteFill} from 'remotion';
import {Cam} from '../../camera';
import {INK_DIARY_FRAG, INK_FIRE_FRAG, INK_MOUNTAIN_FRAG, INK_PAPER_FRAG, INK_VORTEX_FRAG} from '../../gl/ink';
import {INK_CAVE_FRAG, INK_CLASH_FRAG} from '../../gl/inkCave';
import {INK_DUO_FRAG} from '../../gl/inkDuo';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS, useFrame} from '../../time';

/** 一滴墨：落点为该景深层上的坐标，at 为落下的帧号（30fps），size 为最终晕开的半径（px） */
export type InkDrop = {x: number; y: number; at: number; size: number};

/** 墨潮：从 (x, y) 漫开，radius 为当前半径（px），由场景按帧驱动 */
export type InkFlood = {x: number; y: number; radius: number};

const OFF: [number, number, number] = [0, 0, 1e6];

/**
 * 古纸水墨背景。直接铺满屏幕，镜头换算在着色器里完成，
 * 所以不要放进 CamLayer，而是把 cam 和景深系数 k 传进来。
 */
export const InkPaper: React.FC<{
	cam: Cam;
	k?: number;
	drops?: InkDrop[];
	flood?: InkFlood;
	/** 墨退：墨潮从这里向外退开（需同时有 flood 覆盖画面） */
	clear?: InkFlood;
	gold?: number;
	ripple?: number;
	bright?: number;
}> = ({cam, k = 0.7, drops = [], flood, clear, gold = 1, ripple = 1, bright = 1}) => {
	const frame = useFrame();
	const drop = (i: number): [number, number, number] => {
		const d = drops[i];
		return d ? [d.x, d.y, d.at / BASE_FPS] : OFF;
	};
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={INK_PAPER_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uK: k,
					uDrop0: drop(0),
					uDrop1: drop(1),
					uDrop2: drop(2),
					uDropSize: [drops[0]?.size ?? 0, drops[1]?.size ?? 0, drops[2]?.size ?? 0],
					uFloodC: flood ? [flood.x, flood.y, flood.radius] : [0, 0, 0],
					uClearC: clear ? [clear.x, clear.y, clear.radius] : [0, 0, 0],
					uGold: gold,
					uRipple: ripple,
					// 金箔反光随镜头横移与推拉变化，像纸面在光下微微转动
					uLight: cam.x / 120 + cam.zoom * 3,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

/**
 * 水墨远山背景：四层山峦按各自的景深系数随镜头产生视差，同样直接铺满屏幕、不放进 CamLayer。
 * sun 在最远层上；flood / clear 的坐标在主体层（k = 1）上。
 */
export const InkMountains: React.FC<{
	cam: Cam;
	sun?: InkFlood;
	mist?: number;
	flood?: InkFlood;
	clear?: InkFlood;
	gold?: number;
	bright?: number;
	/** 时间偏移（30fps 帧）：分段接续时用整期时间轴，云带不会在段落交界处跳变 */
	timeOffset?: number;
}> = ({cam, sun = {x: 1420, y: 300, radius: 120}, mist = 1, flood, clear, gold = 0.6, bright = 1, timeOffset = 0}) => {
	const frame = useFrame() + timeOffset;
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={INK_MOUNTAIN_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uSun: [sun.x, sun.y, sun.radius],
					uMist: mist,
					uFloodC: flood ? [flood.x, flood.y, flood.radius] : [0, 0, 0],
					uClearC: clear ? [clear.x, clear.y, clear.radius] : [0, 0, 0],
					uGold: gold,
					uLight: cam.x / 120 + cam.zoom * 3,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

/**
 * 摊开的研究日记：书在主体层（k = 1）上，左页 x 140–960、右页 960–1780、y 70–1010，
 * 横格线的基线在 y = 253 + 66n。blot 为落在纸上的墨渍，burn 为页角焦痕的程度。
 */
export const InkDiary: React.FC<{
	cam: Cam;
	blot?: InkDrop;
	burn?: number;
	flood?: InkFlood;
	clear?: InkFlood;
	gold?: number;
	bright?: number;
}> = ({cam, blot, burn = 1, flood, clear, gold = 0.8, bright = 1}) => {
	const frame = useFrame();
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={INK_DIARY_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uDrop0: blot ? [blot.x, blot.y, blot.at / BASE_FPS] : OFF,
					uDropSize: blot?.size ?? 0,
					uBurn: burn,
					uFloodC: flood ? [flood.x, flood.y, flood.radius] : [0, 0, 0],
					uClearC: clear ? [clear.x, clear.y, clear.radius] : [0, 0, 0],
					uGold: gold,
					uLight: cam.x / 120 + cam.zoom * 3,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

/**
 * 燃烧的日记页：纸页在主体层（k = 1）上，x 560–1360、y 90–990，横格基线 y = 253 + 66n。
 * burn：火线从纸边向内烧进的距离（px）；splash：墨爆（at 为帧号，size 为半径 px）。
 */
export const InkFirePage: React.FC<{
	cam: Cam;
	burn: number;
	splash?: InkDrop;
	ember?: number;
	fire?: number;
	page?: number;
	flood?: InkFlood;
	bright?: number;
}> = ({cam, burn, splash, ember = 1, fire = 1, page = 1, flood, bright = 1}) => {
	const frame = useFrame();
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={INK_FIRE_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uBurnR: burn,
					uSplash: splash ? [splash.x, splash.y, splash.at / BASE_FPS] : OFF,
					uSplashSize: splash?.size ?? 0,
					uEmber: ember,
					uFire: fire,
					uPage: page,
					uFloodC: flood ? [flood.x, flood.y, flood.radius] : [0, 0, 0],
					uClearC: [0, 0, 0],
					uGold: 0,
					uLight: 0,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

/**
 * 墨云漩涡：纸面上浓墨云绕 center 旋转，中心空出半径 open 的纸面。坐标在主体层（k = 1）上。
 * dark：整体被墨盖住的程度（开场 / 收尾用）；ember：余烬。
 */
export const InkVortex: React.FC<{
	cam: Cam;
	center: {x: number; y: number};
	open: number;
	swirl?: number;
	dark?: number;
	ember?: number;
	flood?: InkFlood;
	gold?: number;
	bright?: number;
}> = ({cam, center, open, swirl = 1, dark = 0, ember = 0, flood, gold = 0.7, bright = 1}) => {
	const frame = useFrame();
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={INK_VORTEX_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uCenter: [center.x, center.y],
					uOpen: open,
					uSwirl: swirl,
					uDark: dark,
					uEmber: ember,
					uFloodC: flood ? [flood.x, flood.y, flood.radius] : [0, 0, 0],
					uClearC: [0, 0, 0],
					uGold: gold,
					uLight: cam.x / 120 + cam.zoom * 3,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

/**
 * 水墨洞窟：钟乳石分层视差、深处微光、幽暗水面倒影。坐标在主体层（k = 1）上，psy 的坐标是屏幕坐标。
 * fire：火光 (x, y, 强度)；psy：念力扭曲 (x, y, 强度)；waterY：水面；dark：整体被墨盖住的程度。
 */
export const InkCave: React.FC<{
	cam: Cam;
	fire?: {x: number; y: number; strength: number};
	psy?: {x: number; y: number; strength: number};
	waterY?: number;
	dark?: number;
	flood?: InkFlood;
	clear?: InkFlood;
	gold?: number;
	bright?: number;
}> = ({cam, fire, psy, waterY = 880, dark = 0, flood, clear, gold = 0.35, bright = 1}) => {
	const frame = useFrame();
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={INK_CAVE_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uFire: fire ? [fire.x, fire.y, fire.strength] : [0, 0, 0],
					uPsyC: psy ? [psy.x, psy.y, psy.strength] : [960, 540, 0],
					uWaterY: waterY,
					uDark: dark,
					uFloodC: flood ? [flood.x, flood.y, flood.radius] : [0, 0, 0],
					uClearC: clear ? [clear.x, clear.y, clear.radius] : [0, 0, 0],
					uGold: gold,
					uLight: cam.x / 120 + cam.zoom * 3,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

/** 一道气流：从 from 射向 to，只显示 [tail, head] 这一段（0–1）；width 为半宽（px），strength 为浓度 */
export type InkStream = {from: [number, number]; to: [number, number]; tail: number; head: number; width: number; strength: number};

/**
 * 战斗特效层（透明，叠在宝可梦之上）：火墨、念力浓墨、超梦周身的墨云、对撞的墨爆与火星。坐标在主体层（k = 1）上。
 * boom 的 at 为帧号（30fps），size 为半径（px）。
 */
export const InkClash: React.FC<{
	cam: Cam;
	fire?: InkStream;
	psy?: InkStream;
	aura?: {x: number; y: number; radius: number; strength: number};
	boom?: InkDrop;
	ember?: number;
}> = ({cam, fire, psy, aura, boom, ember = 0}) => {
	const frame = useFrame();
	const st = (s?: InkStream) => ({
		A: (s ? [s.from[0], s.from[1], s.width] : [0, 0, 1]) as [number, number, number],
		B: (s ? [s.to[0], s.to[1], s.strength] : [1, 0, 0]) as [number, number, number],
		T: (s ? [s.tail, s.head] : [0, 0]) as [number, number],
	});
	const f = st(fire);
	const p = st(psy);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<ShaderCanvas
				frag={INK_CLASH_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uFireA: f.A,
					uFireB: f.B,
					uFireT: f.T,
					uPsyA: p.A,
					uPsyB: p.B,
					uPsyT: p.T,
					uAura: aura ? [aura.x, aura.y, aura.strength] : [0, 0, 0],
					uAuraR: aura?.radius ?? 1,
					uBoom: boom ? [boom.x, boom.y, boom.at / BASE_FPS] : OFF,
					uBoomSize: boom?.size ?? 0,
					uEmber: ember,
					uFloodC: [0, 0, 0],
					uClearC: [0, 0, 0],
					uGold: 0,
					uLight: 0,
					uBright: 1,
				}}
			/>
		</AbsoluteFill>
	);
};

/**
 * 两种命运：左边淡彩丛林、右边浓墨洞窟，中间一道流动的墨缝。坐标在主体层（k = 1）上。
 * seam：墨缝的 x；meet：两边的墨在中间交汇（卷成 S 形）的程度；caveDark：洞窟一侧额外压暗。
 */
export const InkDuo: React.FC<{
	cam: Cam;
	seam: number;
	meet?: number;
	caveDark?: number;
	sun?: number;
	waterY?: number;
	flood?: InkFlood;
	gold?: number;
	bright?: number;
}> = ({cam, seam, meet = 0, caveDark = 0.3, sun = 1, waterY = 900, flood, gold = 0.45, bright = 1}) => {
	const frame = useFrame();
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={INK_DUO_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.zoom],
					uRoll: cam.roll,
					uSeam: seam,
					uMeet: meet,
					uCaveDark: caveDark,
					uSun: sun,
					uWaterY: waterY,
					uFloodC: flood ? [flood.x, flood.y, flood.radius] : [0, 0, 0],
					uClearC: [0, 0, 0],
					uGold: gold,
					uLight: cam.x / 120 + cam.zoom * 3,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

/** 屏幕空间的古纸暗角：四周发暗、偏棕，像纸边受潮氧化 */
export const PaperVignette: React.FC<{strength?: number}> = ({strength = 1}) => (
	<AbsoluteFill
		style={{
			pointerEvents: 'none',
			mixBlendMode: 'multiply',
			opacity: strength,
			background:
				'radial-gradient(ellipse 72% 68% at 50% 48%, rgba(255,250,240,0) 40%, rgba(150,110,60,0.55) 85%, rgba(70,45,20,0.9) 120%)',
		}}
	/>
);
