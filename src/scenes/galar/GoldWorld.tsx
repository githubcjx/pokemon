import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Grain} from '../../components/Grain';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {GALAR_GOLD_FRAG} from '../../gl/galarGold';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS} from '../../time';

/**
 * ②③ 共用的金线刺绣世界。T 是两段连起来的故事时间（30fps 帧号）：② 为 0–1150，③ 为 1150–2410。
 * 世界坐标与挂毯 Tapestry 的画心坐标一致，所以 ① 末帧那颗绣星就是这里的星。
 */

export type GoldCam = {x: number; y: number; z: number};

const smooth = (t: number, a: number, b: number) => {
	const p = Math.max(0, Math.min(1, (t - a) / (b - a)));
	return p * p * (3 - 2 * p);
};
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const keys = (t: number, k: Array<[number, number]>) => {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], smooth(t, k[i - 1][0], k[i][0]));
	return k[k.length - 1][1];
};

// 与着色器 hill() 一致
export const hill = (x: number, i: 0 | 1 | 2) =>
	i === 0 ? 548 + 26 * Math.sin(x * 0.011 + 0.7) + 14 * Math.sin(x * 0.027 + 2.1)
	: i === 1 ? 598 + 22 * Math.sin(x * 0.014 + 2.4) + 10 * Math.sin(x * 0.033 + 0.4)
	: 640 + 18 * Math.sin(x * 0.012 - 0.6) + 9 * Math.sin(x * 0.029 + 1.3);

export const STAR_HOME = {x: 328, y: 170};
export const CRATER = {x: 150, y: hill(150, 2) + 4};
const FALL = {x: CRATER.x - STAR_HOME.x, y: CRATER.y - 20 - STAR_HOME.y};
const FALL_LEN = Math.hypot(FALL.x, FALL.y);
const FALL_DIR = {x: FALL.x / FALL_LEN, y: FALL.y / FALL_LEN};

// ① 末帧镜头：挂毯坐标 (275,185)、3 倍。开头以星为锚点推进，星在屏幕上原地不动
export const ANCHOR_SCREEN = {x: 960 + (STAR_HOME.x - 275) * 3, y: 540 + (STAR_HOME.y - 185) * 3};
export const anchoredCam = (z: number): GoldCam => ({x: STAR_HOME.x - (ANCHOR_SCREEN.x - 960) / z, y: STAR_HOME.y - (ANCHOR_SCREEN.y - 540) / z, z});
/** 递归：挂毯里套着缩小到 DIVE_RATIO 的同一幅挂毯，镜头推进两层（0–DIVE_END），画面与 ① 末帧重合 */
export const DIVE_RATIO = 0.35;
export const DIVE_END = 85;
/** 星周围的布面拆开、露出金线世界的时间段 */
export const IRIS = [72, 118] as const;
export const ANCHOR_END = IRIS[1];
const R2 = DIVE_RATIO * DIVE_RATIO;
/** 挂毯（宝物库）坐标下的镜头倍数 */
export const vaultZoomAt = (t: number) => t <= DIVE_END ? 3 * Math.pow(1 / R2, smooth(t, 0, DIVE_END)) : worldZoomAt(t) / R2;
/** 金线世界里的镜头倍数：世界对应第二层挂毯的画心 */
const worldZoomAt = (t: number): number => t <= DIVE_END ? vaultZoomAt(t) * R2 : 3 * Math.pow(3.4 / 3, smooth(t, DIVE_END, ANCHOR_END));

const CAM: Array<[number, GoldCam]> = [
	[ANCHOR_END, anchoredCam(3.4)],
	[245, {x: 215, y: 430, z: 1.95}],
	[420, {x: 205, y: 432, z: 1.95}],
	[700, {x: 195, y: 440, z: 2.1}],
	[930, {x: 190, y: 452, z: 2.12}],
	[1150, {x: 168, y: 560, z: 2.6}],
	[1330, {x: 190, y: 400, z: 1.5}],
	[1470, {x: 186, y: 392, z: 1.45}],
	[1620, {x: 192, y: 402, z: 1.52}],
	[1790, {x: 200, y: 412, z: 1.62}],
	[1910, {x: 215, y: 425, z: 1.95}],
	[2090, {x: 240, y: 430, z: 2.05}],
	[2280, {x: 260, y: 440, z: 2.25}],
	[2409, {x: 500, y: 505, z: 3.4}],
];

export const camAt = (t: number): GoldCam => {
	if (t <= ANCHOR_END) return anchoredCam(worldZoomAt(t));
	for (let i = 1; i < CAM.length; i++) {
		if (t <= CAM[i][0]) {
			const [ta, a] = CAM[i - 1];
			const [tb, b] = CAM[i];
			const p = smooth(t, ta, tb);
			return {x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), z: a.z * Math.pow(b.z / a.z, p)};
		}
	}
	return CAM[CAM.length - 1][1];
};

// 撞击时的震动（只在震动时放大）
const shake = (t: number) => {
	const k = Math.max(0, 1 - Math.abs(t - 250) / 40) + 0.8 * Math.max(0, 1 - Math.abs(t - 1192) / 45);
	return {x: Math.sin(t * 2.1) * 9 * k, y: Math.cos(t * 2.7) * 7 * k, s: 1 + 0.025 * k};
};

const GIANTS = [
	{dir: 'charizard', x: -250, y: 470, size: 330, from: 1480},
	{dir: 'snorlax', x: 560, y: 470, size: 360, from: 1500},
	{dir: 'gengar', x: 745, y: 505, size: 260, from: 1520},
] as const;
export const GIANT_CRY_AT = GIANTS.map((g) => g.from + 35);

export const worldAt = (t: number) => {
	const fall = smooth(t, 120, 245);
	const fallE = Math.pow(Math.max(0, Math.min(1, (t - 120) / 125)), 1.8);
	const starOn = t < 245 ? 1 : 0;
	return {
		star: [STAR_HOME.x + FALL.x * fallE, STAR_HOME.y + FALL.y * fallE, 1 - 0.25 * fall, starOn] as [number, number, number, number],
		trail: [FALL_DIR.x, FALL_DIR.y, 320 * smooth(t, 118, 190)] as [number, number, number],
		craterOn: t < 242 ? 0 : 1,
		craterGlow: keys(t, [[242, 0], [250, 1.1], [340, .45], [600, .6], [780, .6], [900, .06], [960, .06], [1120, .75], [1190, 1.1], [1300, .85], [1640, .85], [1780, .5]]),
		shock: t > 245 && t < 335 ? (t - 245) / 90 : t > 1186 && t < 1276 ? (t - 1186) / 90 : 0,
		energy: keys(t, [[500, 0], [600, 1], [780, 1], [900, 0], [1180, 0], [1260, 1], [1600, 1], [1700, 0]]),
		burial: keys(t, [[800, 0], [930, 1], [1183, 1], [1192, 0]]),
		rupture: keys(t, [[960, 0], [1120, 1], [1190, 1], [1300, .4], [1640, .4], [1760, 0]]),
		skyRot: keys(t, [[760, 0], [1000, 1.3]]),
		redSky: keys(t, [[1200, 0], [1350, 1]]),
		vortex: keys(t, [[1330, 0], [1470, 1]]),
		beam: keys(t, [[1220, 0], [1300, 1], [1460, 1], [1560, .3], [1640, .3], [1760, 0]]),
		tear: keys(t, [[1630, 0], [1790, 1], [1900, 1], [2080, 0]]),
		dark: keys(t, [[1760, 0], [1810, .78], [1900, .78], [2000, 0]]),
		geo: keys(t, [[1910, 0], [2080, 1]]),
		key: keys(t, [[780, 1], [1000, .72], [1150, 1]]),
		eternatusY: keys(t, [[330, 300], [410, 0], [760, 0], [900, 330], [1180, 330], [1262, 0]]),
		eternatusOn: keys(t, [[330, 0], [380, 1], [800, 1], [900, 0], [1180, 0], [1215, 1], [1650, 1], [1760, 0]]),
		giants: GIANTS.map((g) => ({rise: smooth(t, g.from, g.from + 80), on: smooth(t, g.from, g.from + 30) * (1 - smooth(t, 1650, 1760))})),
	};
};

const screen = (cam: GoldCam, x: number, y: number) => ({x: 960 + (x - cam.x) * cam.z, y: 540 + (y - cam.y) * cam.z});
// 沿山脊线裁掉山后面的部分（屏幕坐标多边形）
const ridgeClip = (cam: GoldCam, layer: 0 | 1 | 2, dy: number) => {
	const pts: string[] = ['-10px -10px', '1930px -10px'];
	for (let sx = 1930; sx >= -10; sx -= 20) {
		const wx = cam.x + (sx - 960) / cam.z;
		pts.push(`${sx}px ${screen(cam, wx, hill(wx, layer) + dy).y}px`);
	}
	return `polygon(${pts.join(', ')})`;
};

export const GoldWorld: React.FC<{t: number; globalFrame: number; frameOffset: number; iris?: [number, number, number, number]; children?: React.ReactNode}> = ({t, globalFrame, frameOffset, iris = [0, 0, 0, 0], children}) => {
	const c0 = camAt(t);
	const sh = shake(t);
	const cam: GoldCam = {x: c0.x - sh.x / c0.z, y: c0.y - sh.y / c0.z, z: c0.z * sh.s};
	const s = worldAt(t);
	const ET = {x: 190, y: 468, size: 470};
	const et = screen(cam, ET.x, ET.y + s.eternatusY);
	const giants = GIANTS.map((g, i) => {
		const st = s.giants[i];
		const yOff = (1 - st.rise) * g.size * 0.75;
		return {...g, ...st, yOff, crown: [g.x - g.size * 0.05, g.y - g.size * 0.47 + yOff, g.size / 330, st.on] as [number, number, number, number]};
	});
	const noCrown: [number, number, number, number] = [0, 0, 1, 0];
	return (
		<AbsoluteFill style={{background: iris[3] > 0 ? undefined : '#04050c'}}>
			<ShaderCanvas
				frag={GALAR_GOLD_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: globalFrame / BASE_FPS,
					uCam: [cam.x, cam.y, cam.z],
					uIris: iris,
					uStar: s.star,
					uTrail: s.trail,
					uCrater: [CRATER.x, CRATER.y, s.craterGlow, s.craterOn],
					uShock: s.shock,
					uEnergy: s.energy,
					uBurial: s.burial,
					uRupture: s.rupture,
					uSkyRot: s.skyRot,
					uRedSky: s.redSky,
					uVortex: s.vortex,
					uVortexC: [185, 90],
					uBeam: s.beam,
					uTear: s.tear,
					uDark: s.dark,
					uGeo: s.geo,
					uKey: s.key,
					uG0: giants[0].on > 0 ? giants[0].crown : noCrown,
					uG1: giants[1].on > 0 ? giants[1].crown : noCrown,
					uG2: giants[2].on > 0 ? giants[2].crown : noCrown,
				}}
			/>
			{giants.map((g) => {
				if (g.on <= 0) return null;
				const p = screen(cam, g.x, g.y + g.yOff);
				return (
					<AbsoluteFill key={g.dir} style={{clipPath: ridgeClip(cam, 0, 2)}}>
						<PokemonArt3D dir={`pokemon/${g.dir}`} x={p.x} y={p.y} size={g.size * cam.z} depthScale={0.5} silhouette={{color: [0.05, 0.012, 0.02]}} opacity={g.on * 0.95} resolution={1} style={{filter: 'drop-shadow(0 0 14px rgba(210,40,40,0.75)) drop-shadow(0 0 40px rgba(150,10,20,0.6))'}} />
					</AbsoluteFill>
				);
			})}
			{s.eternatusOn > 0 && (
				<AbsoluteFill style={{clipPath: ridgeClip(cam, 2, 14), opacity: 1 - s.dark * 0.8}}>
					<PokemonArt3D
						dir="pokemon/eternatus"
						x={et.x}
						y={et.y}
						size={ET.size * cam.z}
						yaw={Math.sin(globalFrame * 0.009) * 3}
						pitch={Math.sin(globalFrame * 0.007) * 2}
						depthScale={0.5}
						ambient={[0.5, 0.48, 0.55]}
						dirLights={[{dir: [-0.55, -0.6, 0.6], color: [0.75, 0.62, 0.5], wrap: 0.4}]}
						pointLights={[{pos: [(CRATER.x - ET.x) / ET.size, (CRATER.y - ET.y - s.eternatusY) / ET.size, 0.25], color: [1.4 * s.craterGlow + s.beam, 0.3 * s.craterGlow, 0.16 * s.craterGlow], radius: 1.1}]}
						rim={{dir: [0.2, 1], color: [1, 0.3, 0.2], power: 2.5}}
						emissive={0.35 + s.energy * 0.8 + s.beam * 0.6}
						emissiveTint={[1.5, 0.26, 0.4]}
						emissiveKey={[0.3, 0.65, 0.25, 0.55]}
						stitch={{amount: 0.8, frequency: 320}}
						opacity={s.eternatusOn}
						resolution={1.3}
					/>
				</AbsoluteFill>
			)}
			{children && <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<g transform={`translate(960 540) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`}>{children}</g>
			</svg>}
			<DustMotes frameOffset={frameOffset} opacity={0.22 * (1 - s.dark)} rgb="236,190,120" />
			<Vignette strength={0.62} />
			<Grain opacity={0.1} frameOffset={frameOffset} />
		</AbsoluteFill>
	);
};
