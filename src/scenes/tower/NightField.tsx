import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import {AbsoluteFill, interpolate, random} from 'remotion';
import * as THREE from 'three';
import {NightSky} from '../../components/screen/GoldScreen';
import {AshField, Pagoda, PagodaRuin} from '../../three/Pagoda';
import {PAGODA_TOP} from '../../three/pagodaGeometry';
import {CameraRig, mixHex, MoonLights, projectToScreen, V3} from '../../three/stage';
import {clamp} from '../../theme';

// ─── 第 6、7 段共用的"今"：月夜的原野、废墟、东塔、远山、草丛；dawn = 1 时为破晓 ───────────

/** 东塔（铃铛塔）：缘朱的东北方，月雾里（与第 1 段相同的位置） */
export const BELL_TOWER: V3 = [38, 0, -120];

/** 月亮的方向：挂在东塔左上方（只用于画面上的月亮，主光仍是 MoonLights） */
export const MOON_DIR: V3 = (() => {
	const d: V3 = [0.035, 0.445, -1];
	const l = Math.hypot(...d);
	return [d[0] / l, d[1] / l, d[2] / l];
})();

export type FieldCam = {pos: V3; target: V3; yaw: number; pitch: number; fov: number};

/** 由位置 + 朝向（yaw：0 = 朝南 +z，-90 = 朝西，-180 = 朝北；pitch：仰角）算出视线目标 */
export const lookFrom = (pos: V3, yaw: number, pitch: number, fov: number): FieldCam => {
	const y = (yaw * Math.PI) / 180;
	const p = (pitch * Math.PI) / 180;
	const target: V3 = [pos[0] + Math.sin(y) * Math.cos(p) * 50, pos[1] + Math.sin(p) * 50, pos[2] + Math.cos(y) * Math.cos(p) * 50];
	return {pos, target, yaw, pitch, fov};
};

/** 前景的草丛（屏幕空间，随镜头转身产生视差） */
const GRASS = Array.from({length: 460}, (_, i) => ({
	x: random(`wg${i}`) * 2600,
	h: 70 + random(`wh${i}`) * 230,
	lean: (random(`wl${i}`) - 0.5) * 0.3,
	w: 3 + random(`ww${i}`) * 5,
	ph: random(`wp${i}`) * 6.28,
	k: 0.6 + random(`wk${i}`) * 0.7,
}));

/** 远处低矮的山丘轮廓（贴着地平线，随镜头转身平移） */
const HILLS = (() => {
	const pts: string[] = [];
	for (let x = 0; x <= 4800; x += 40) {
		const h = 18 + 22 * Math.sin(x / 330) * Math.sin(x / 910 + 1.3) + 12 * Math.sin(x / 140 + 2) + 14 * random(`hl${x}`) * 0.4;
		pts.push(`${x},${-Math.max(4, h + 20)}`);
	}
	return `M0,40 L${pts.join(' L')} L4800,40 Z`;
})();

export type Gust = {at: number; y: number; wash: string};
export const GUST_LEN = 46;

export const NightField: React.FC<{
	/** 第 6 段的帧号（第 7 段接着往下数），用于余烬、灰烬、草的摆动 */
	f: number;
	cam: FieldCam;
	corona: number;
	warmCore: number;
	grassO: number;
	gusts?: Gust[];
	dawn?: number;
	/** 第一缕阳光照在东塔塔顶：0 = 无，1 = 照亮塔顶几层；sunDrop 让光斑沿塔身往下爬（0–1） */
	sunTop?: number;
	sunDrop?: number;
}> = ({f, cam, corona, warmCore, grassO, gusts = [], dawn = 0, sunTop = 0, sunDrop = 0}) => {
	const sunTarget = useMemo(() => new THREE.Object3D(), []);
	sunTarget.position.set(BELL_TOWER[0], PAGODA_TOP - 1 - sunDrop * 9, BELL_TOWER[2]);
	const {pos, target, yaw, pitch, fov} = cam;
	const moonP = projectToScreen(pos, target, fov, [pos[0] + MOON_DIR[0] * 400, pos[1] + MOON_DIR[1] * 400, pos[2] + MOON_DIR[2] * 400]);
	const moon = moonP.behind || moonP.x < -1200 || moonP.x > 3100 ? {x: 960, y: -2400} : {x: moonP.x, y: moonP.y};
	const ringR = 230;
	const horizonY = 540 + (Math.tan((pitch * Math.PI) / 180) / Math.tan((fov * Math.PI) / 360)) * 540;
	const hillsX = ((((-yaw * 30) % 2400) + 2400) % 2400) - 2400;
	const coronaO = corona * (1 - dawn);

	// 风：每阵风是一道从右往左横扫的"风口"，所到之处草被压弯
	const gustAt = (x: number) =>
		gusts.reduce(
			(acc, g) => {
				const t = (f - g.at) / GUST_LEN;
				if (t < -0.3 || t > 1.3) return acc;
				const gx = 2300 - t * 2700;
				const v = Math.exp(-(((x - gx) / 260) ** 2));
				return {v: acc.v + v, wash: v > acc.top ? g.wash : acc.wash, top: Math.max(acc.top, v)};
			},
			{v: 0, wash: '200,210,226', top: 0},
		);

	// 破晓：东边（画面右侧之外）的地平线先亮，天色由灰蓝转向金粉
	const sunX = 1920 + 520;
	return (
		<AbsoluteFill>
			<NightSky moon={moon} />
			{dawn > 0 ? (
				<>
					<AbsoluteFill
						style={{
							opacity: dawn,
							background: `linear-gradient(to bottom, #4c5b7a 0px, #8f8aa0 ${horizonY * 0.45}px, #d8a98f ${horizonY * 0.8}px, #f2c98c ${horizonY}px, #e9c08a ${horizonY + 60}px)`,
						}}
					/>
					<AbsoluteFill
						style={{
							opacity: dawn,
							mixBlendMode: 'screen',
							background: `radial-gradient(ellipse 1500px 700px at ${sunX}px ${horizonY}px, rgba(255,226,170,0.95) 0px, rgba(255,190,120,0.5) 500px, rgba(255,170,110,0.15) 1100px, transparent 1500px)`,
						}}
					/>
				</>
			) : null}
			{/* 七色月晕 */}
			{coronaO > 0.003 ? (
				<AbsoluteFill
					style={{
						opacity: coronaO * (0.55 + 0.25 * warmCore),
						background: `radial-gradient(circle at ${moon.x}px ${moon.y}px, transparent ${ringR * 0.8}px, rgba(170,120,230,0.18) ${ringR * 0.86}px, rgba(110,170,240,0.22) ${ringR * 0.91}px, rgba(140,210,120,0.22) ${ringR * 0.96}px, rgba(255,214,110,0.26) ${ringR * 1.01}px, rgba(255,150,90,0.24) ${ringR * 1.06}px, rgba(240,100,90,0.16) ${ringR * 1.11}px, transparent ${ringR * 1.2}px)`,
					}}
				/>
			) : null}
			{warmCore * (1 - dawn) > 0 ? (
				<AbsoluteFill
					style={{
						opacity: warmCore * 0.35 * (1 - dawn),
						mixBlendMode: 'screen',
						background: `radial-gradient(circle at ${moon.x}px ${moon.y}px, rgba(255,226,170,0.7) 0px, rgba(255,200,130,0.25) ${ringR * 0.5}px, transparent ${ringR * 1.1}px)`,
					}}
				/>
			) : null}
			{/* 远山：月雾里一道低矮的墨色山影，破晓时透出暖灰 */}
			<svg width={1920} height={1080} style={{position: 'absolute', opacity: 0.85}}>
				<defs>
					<linearGradient id="hillG" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor={mixHex('#2a3240', '#7d6a66', dawn)} />
						<stop offset="1" stopColor={mixHex('#353e4c', '#a3887a', dawn)} />
					</linearGradient>
					<filter id="hillBlur">
						<feGaussianBlur stdDeviation={1.5} />
					</filter>
				</defs>
				<path d={HILLS} transform={`translate(${hillsX},${horizonY})`} fill="url(#hillG)" filter="url(#hillBlur)" />
			</svg>
			<AbsoluteFill style={{filter: dawn > 0 ? `sepia(${0.45 * dawn}) saturate(${1 + 0.4 * dawn}) brightness(${1 + 0.35 * dawn})` : undefined}}>
				<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
					<CameraRig pos={pos} target={target} fov={fov} />
					<MoonLights />
					<directionalLight position={[90, 10, -60]} intensity={3.2 * dawn} color="#ffc58a" />
					{/* 第一缕阳光：从东边低低地射来，只照亮塔顶几层 */}
					<primitive object={sunTarget} />
					<spotLight
						position={[BELL_TOWER[0] + 170, PAGODA_TOP + 12, BELL_TOWER[2] + 30]}
						target={sunTarget}
						angle={0.075 + 0.03 * sunDrop}
						penumbra={0.55}
						intensity={55 * sunTop}
						decay={0}
						distance={0}
						color="#ffc47a"
					/>
					<pointLight
						position={[0.5, 2.2, 0.3]}
						intensity={22 + 8 * Math.sin(f * 0.31) * Math.sin(f * 0.13 + 1.7)}
						distance={18}
						decay={2}
						color="#ff6a22"
					/>
					<PagodaRuin frame={600 + f} />
					<group position={BELL_TOWER}>
						<Pagoda />
					</group>
					<AshField frame={600 + f} />
				</ThreeCanvas>
			</AbsoluteFill>
			{/* 破晓时地面的暖雾 */}
			{dawn > 0 ? (
				<AbsoluteFill
					style={{
						opacity: dawn * 0.55,
						background: `linear-gradient(to bottom, transparent ${horizonY - 30}px, rgba(232,190,140,0.55) ${horizonY + 10}px, rgba(150,120,100,0.25) ${horizonY + 200}px, transparent ${horizonY + 420}px)`,
					}}
				/>
			) : null}

			{/* 风掠过原野：拖着淡彩的风痕（不画宝可梦本身） */}
			{gusts.length ? (
				<svg width={1920} height={1080} style={{position: 'absolute'}}>
					<defs>
						<filter id="gustBlur" x="-10%" y="-200%" width="120%" height="500%">
							<feGaussianBlur stdDeviation="14 7" />
						</filter>
					</defs>
					{gusts.map((g, i) => {
						const t = (f - g.at) / GUST_LEN;
						if (t < 0 || t > 1.6) return null;
						const head = 2300 - Math.min(t, 1.25) * 2700;
						const len = 700 * Math.min(1, t * 2.5);
						const o = interpolate(t, [0, 0.15, 0.9, 1.6], [0, 1, 0.8, 0], clamp);
						return (
							<g key={i} filter="url(#gustBlur)" opacity={o}>
								{[0, 1, 2].map((k) => (
									<path
										key={k}
										d={`M${head},${g.y + k * 14} Q${head + len * 0.5},${g.y + k * 14 - 22 + k * 8} ${head + len},${g.y + k * 14 + 6}`}
										stroke={k === 1 ? `rgba(${g.wash},0.26)` : 'rgba(210,218,232,0.12)'}
										strokeWidth={k === 1 ? 10 : 18}
										fill="none"
										strokeLinecap="round"
									/>
								))}
							</g>
						);
					})}
				</svg>
			) : null}

			{/* 前景的草丛：月光下的墨色剪影，风过处被压弯 */}
			{grassO > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', opacity: grassO}}>
					{GRASS.map((g, i) => {
						const x = ((((g.x + yaw * 34 * g.k) % 2600) + 2600) % 2600) - 340;
						const base = 1085 + Math.max(0, pitch) * 34 * g.k - (1 - grassO) * 120;
						const gust = gustAt(x);
						const bend = Math.min(1, gust.v) * 1.1;
						const sway = Math.sin(f / 22 + g.ph) * 0.1 + g.lean - bend;
						const top = base - g.h * g.k * (1 - bend * 0.25);
						return (
							<path
								key={i}
								d={`M${x},${base} Q${x + sway * g.h * 0.4},${(top + base) / 2} ${x + sway * g.h * 0.9},${top}`}
								stroke={
									bend > 0.35
										? i % 3 === 0
											? `rgba(${gust.wash},${0.35 + 0.4 * Math.min(1, bend)})`
											: `rgba(${92 + bend * 60},${104 + bend * 60},${124 + bend * 60},0.9)`
										: i % 4 === 0
											? 'rgba(92,104,124,0.9)'
											: `rgba(${18 + (i % 3) * 6},${21 + (i % 3) * 6},${27 + (i % 3) * 6},0.94)`
								}
								strokeWidth={g.w * g.k}
								fill="none"
								strokeLinecap="round"
							/>
						);
					})}
				</svg>
			) : null}

			<AbsoluteFill style={{background: `radial-gradient(ellipse 100% 85% at 50% 45%, transparent 55%, rgba(${8 + 30 * dawn},${10 + 16 * dawn},16,${0.5 - 0.15 * dawn}) 100%)`}} />
		</AbsoluteFill>
	);
};
