import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import * as THREE from 'three';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {ArtLighting, PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {CloudSea, CoronetLights, Sky, Snow, Terrain} from '../../three/hisui/coronet';
import {StoneStatue} from '../../three/hisui/statue';
import {PEDESTAL_H, STATUES, TEMPLE, Temple} from '../../three/hisui/temple';
import {CameraRig, V3} from '../../three/stage';
import {TrainerSil} from './Clans';
import {flow, prog, SUB, T, track} from './common';
import {Glow, toScreen, View} from './Overlays';
import {REI, ScreenSil} from './Rift';
import {Flute, REI_P, SPEAR} from './Volo';

// ─── 第 8 段「起始之殿」──────────────────────────────────────────────────────
// 夜里的废墟（接上一段）：第一次吹笛，光环散开，天上什么也没有 → 走遍洗翠（2D 延时：雪原、湿地、海岸、火山、冻土）
// → 黎明前的废墟，笛声再响：一级级玻璃般的光阶从断柱中间升上天（3D）→ 镜头沿阶梯穿过云海，到云上的平台
// → 金光里阿尔宙斯显色（名称卡、叫声）→ 全片最大爆发点：金白光爆（第二次叫声）→ 话语 → 一点金光落进那个人手里
// → 拉开：断柱 = 枪之柱，阶梯尽头 = 起始之殿。

const ease = (t: number) => t * t * (3 - 2 * t);
const rnd = (s: number) => {
	const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
const GOLD = '255,214,140';
const AZURE = '170,215,255';

// ── 光之阶梯与云上的平台 ──

const STEP_N = 44;
const STAIR_FROM: V3 = [0, 1.6, 4];
const PLAT: V3 = [0, 72, -62];
/** 第 i 级台阶的中心 */
const stepAt = (i: number): V3 => {
	const t = i / (STEP_N - 1);
	return [0, STAIR_FROM[1] + (PLAT[1] - 0.5 - STAIR_FROM[1]) * t, STAIR_FROM[2] + (PLAT[2] + 9 - STAIR_FROM[2]) * t];
};
/** 阿尔宙斯站在平台中间（立绘画框中心） */
const ARC_P: V3 = [0, PLAT[1] + 4.4, PLAT[2] - 1];
const ARC_BOX = 11;
/** 那个人站上平台、面对阿尔宙斯 */
const REI_TOP: V3 = [5.2, PLAT[1] + 0.2, PLAT[2] + 7.5];
const CLOUD_Y = 40;

const stairsUp = (f: number) => prog(f, T.play2 + 20, T.climb + 40);

const StairWorld: React.FC<{f: number}> = ({f}) => {
	const mats = useMemo(
		() => ({
			glass: new THREE.MeshPhysicalMaterial({color: '#e8f4ff', emissive: new THREE.Color('#9fd0ff'), emissiveIntensity: 0.7, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.62, clearcoat: 1}),
			edge: new THREE.MeshBasicMaterial({color: '#fff6dc', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false}),
			// 平台上的格线压淡、放稀，不抢阿尔宙斯
			grid: new THREE.MeshBasicMaterial({color: '#fff2d8', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false}),
		}),
		[],
	);
	const up = stairsUp(f);
	const plat = ease(prog(f, T.climb, T.climb + 50));
	mats.glass.emissiveIntensity = 0.55 + 0.35 * interpolate(f, [T.burst8 - 10, T.burst8, T.burst8 + 60], [0, 1, 0], clamp);
	return (
		<group>
			{Array.from({length: STEP_N}, (_, i) => {
				const v = prog(up, (i / STEP_N) * 0.85, (i / STEP_N) * 0.85 + 0.15);
				if (v <= 0.01) return null;
				const p = stepAt(i);
				return (
					<group key={i} position={[p[0], p[1] - (1 - v) * 1.5, p[2]]} scale={[v, 1, 1]}>
						<mesh material={mats.glass}>
							<boxGeometry args={[6, 0.28, 1.9]} />
						</mesh>
						<mesh material={mats.edge} position={[0, 0.15, 0.95]}>
							<boxGeometry args={[6.02, 0.04, 0.04]} />
						</mesh>
					</group>
				);
			})}
			{plat > 0.01 ? (
				<group position={PLAT} scale={[plat, 1, plat]}>
					<mesh material={mats.glass}>
						<boxGeometry args={[20, 0.5, 20]} />
					</mesh>
					{/* 平台上的格线 */}
					{Array.from({length: 5}, (_, k) => (
						<group key={k}>
							<mesh material={mats.grid} position={[-8 + k * 4, 0.27, 0]}>
								<boxGeometry args={[0.03, 0.02, 20]} />
							</mesh>
							<mesh material={mats.grid} position={[0, 0.27, -8 + k * 4]}>
								<boxGeometry args={[20, 0.02, 0.03]} />
							</mesh>
						</group>
					))}
				</group>
			) : null}
		</group>
	);
};

// ── 3D 镜头 ──

const CAM8: [number, number[]][] = [
	// 接上一段：夜里的废墟
	[T.end7, [SPEAR.x + 11, 2.6, 44, SPEAR.x + 1, 3, 22, 42]],
	// 第一次吹笛：推近那个人，再仰向空荡荡的夜空
	[T.play1 + 35, [REI_P[0] + 3.2, REI_P[1] + 1.6, REI_P[2] + 5.4, REI_P[0], REI_P[1] + 1.2, REI_P[2], 38]],
	[T.journey + 10, [REI_P[0] + 3.0, REI_P[1] + 1.4, REI_P[2] + 5.6, REI_P[0] - 6, 40, -30, 50]],
	// 黎明前：光阶从断柱中间升起，镜头跟着往上仰
	[T.stairs - 10, [SPEAR.x + 14, 3.2, 52, 0, 8, -6, 46]],
	[T.climb, [SPEAR.x + 12, 3.0, 54, 0, 30, -30, 52]],
	// 沿阶梯慢慢升上去，穿过云海；出云后先只看见平台上的一团金光（不说话，停一拍）
	[T.climb + 60, [2.5, 26, 0, 0, 52, -50, 52]],
	[T.climb + 125, [1.6, 75.5, -16, 0, 75.5, -62, 46]],
	[T.arceus, [1.2, 73.2, -38, ARC_P[0], ARC_P[1] - 0.8, ARC_P[2], 42]],
	// 阿尔宙斯在画面里偏上，给字幕让出位置
	[T.arceusPeak + 20, [1.0, 73.4, -40, ARC_P[0], ARC_P[1] - 1.2, ARC_P[2], 40]],
	// 光爆：往后一拉
	[T.burst8 - 4, [0.6, 73.6, -42, ARC_P[0], ARC_P[1] - 1.0, ARC_P[2], 39]],
	[T.burst8 + 60, [0, 77, -20, ARC_P[0], ARC_P[1] - 2, ARC_P[2], 48]],
	// 话语：推近
	[T.l92 + 60, [0.8, 74.0, -42, ARC_P[0], ARC_P[1] - 1.5, ARC_P[2], 40]],
	// 分身：看那个人
	[T.gift + 50, [4.2, 74, -47, REI_TOP[0], REI_TOP[1] + 2.5, REI_TOP[2] - 4, 42]],
	// 拉开：断柱、光阶、云上的平台
	[T.l94 + 30, [40, 50, 70, 0, 40, -30, 46]],
	[T.end8, [62, 38, 112, 0, 36, -28, 44]],
];

const viewAt = (f: number): View => {
	const c = flow(f, CAM8);
	const k = f >= T.burst8 - 2 && f < T.burst8 + 50 ? 0.5 * Math.exp(-(f - T.burst8) / 12) : 0;
	return {pos: [c[0], c[1], c[2]], target: [c[3] + Math.sin(f * 2.3) * k, c[4] + Math.sin(f * 1.7) * k * 0.7, c[5]], fov: c[6]};
};

/** 天色：夜 → 黎明前的冷蓝 → 光阶升起时变成金色的黎明 */
const duskAt = (f: number) => track(f, [[T.stairs, 0.25], [T.climb + 40, 1]]);
const goldAt = (f: number) => track(f, [[T.play2, 0], [T.climb + 40, 0.9], [T.burst8, 1.4], [T.burst8 + 70, 1]]);

const HallWorld: React.FC<{f: number; v: View}> = ({f, v}) => {
	const time = f / 30;
	const dusk = duskAt(f);
	const gold = goldAt(f);
	const burst = interpolate(f, [T.burst8 - 12, T.burst8, T.burst8 + 70], [0, 1, 0], clamp);
	return (
		<ThreeCanvas width={1920} height={1080} shadows gl={{antialias: true}}>
			<CameraRig pos={v.pos} target={v.target} fov={v.fov} far={1400} />
			<CoronetLights dusk={dusk} gold={gold} fogNear={140} fogFar={900} />
			<Sky cam={v.pos} s={{dusk, starRot: f * 0.0006, trail: 0, gold, time}} />
			<Terrain />
			<Temple ruin={0.25} build={1} blast={1} early={1} />
			{STATUES.map((s, i) => (
				<StoneStatue key={s.name} dir={s.dir} pos={[s.x, TEMPLE.stepTop + PEDESTAL_H, s.z]} ry={s.ry} height={3.3} opacity={1} shatter={8} seed={i + 3} />
			))}
			<StairWorld f={f} />
			{burst > 0 ? <pointLight position={ARC_P} intensity={20000 * burst} distance={220} decay={2} color="#fff2d6" /> : null}
			<pointLight position={ARC_P} intensity={1500 * prog(f, T.arceus, T.arceusPeak)} distance={60} decay={2} color="#ffd98c" />
			<CloudSea y={CLOUD_Y} opacity={0.85 * prog(f, T.stairs, T.climb)} time={time} color="#ffe2c4" shade="#a0788c" cam={v.pos} />
			<Snow cam={v.pos} time={time} amount={0.65 * (1 - prog(f, T.stairs, T.climb + 30))} wind={1.3} color="#e4e2f0" />
		</ThreeCanvas>
	);
};

// ── 2D：叠在 3D 上的东西 ──

const ARC_LIGHT: ArtLighting = {
	depthScale: 0.5,
	ambient: [0.9, 0.86, 0.78],
	dirLights: [{dir: [0.2, -1, 0.6], color: [0.5, 0.45, 0.32], wrap: 0.5}],
	rim: {dir: [0, -1], color: [1.3, 1.05, 0.6], power: 3},
	emissive: 0.6,
	emissiveTint: [1.2, 0.95, 0.5],
};

/** 笛声：从那个人手里散开一圈圈蓝白的光环 */
const FluteRings: React.FC<{f: number; v: View; at: number; n: number}> = ({f, v, at, n}) => {
	if (f < at || f > at + 30 * n + 60) return null;
	const s = toScreen(v, [REI_P[0] + 0.12, REI_P[1] + 1.05, REI_P[2] + 0.15]);
	if (s.behind) return null;
	const k = s.s / 130;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
			{Array.from({length: n}, (_, i) => {
				const t = prog(f, at + i * 30, at + i * 30 + 70);
				if (t <= 0 || t >= 1) return null;
				return <ellipse key={i} cx={s.x} cy={s.y} rx={30 * k + 900 * k * t} ry={10 * k + 300 * k * t} fill="none" stroke={`rgba(${AZURE},${0.8 * (1 - t)})`} strokeWidth={3} />;
			})}
		</svg>
	);
};

const Layers3D: React.FC<{f: number; v: View}> = ({f, v}) => {
	// 那个人：在废墟里吹笛；阶梯升起后出现在平台上
	const reiO = 1 - prog(f, T.climb, T.climb + 30);
	const reiTopO = interpolate(f, [T.arceus - 10, T.arceus + 20], [0, 1], clamp);
	const flute = (f < T.journey ? 0.7 + 0.3 * interpolate(f, [T.play1, T.play1 + 20, T.play1 + 70], [0, 1, 0], clamp) : 0.4) * interpolate(f, [T.play2, T.play2 + 20, T.climb, T.climb + 30], [1, 1.4, 1.4, 0], clamp);
	// 阿尔宙斯：金光里一个剪影 → 显色 → 光爆
	const arcS = toScreen(v, ARC_P);
	const arcSize = ARC_BOX * arcS.s;
	const arcO = interpolate(f, [T.arceus, T.arceus + 20], [0, 1], clamp);
	const arcB = interpolate(f, [T.arceus, T.arceusPeak], [0.04, 1], clamp) + interpolate(f, [T.burst8 - 14, T.burst8, T.burst8 + 40], [0, 1.6, 0], clamp);
	const halo = interpolate(f, [T.arceus - 80, T.arceus - 35, T.arceus + 30, T.burst8, T.burst8 + 60], [0, 0.95, 0.7, 1, 0.55], clamp) * (0.9 + 0.1 * Math.sin(f * 0.08));
	// 光爆：一圈圈金环、旋转的光芒
	const burstK = prog(f, T.burst8 - 6, T.burst8 + 80);
	const rays = interpolate(f, [T.burst8 - 6, T.burst8 + 6, T.burst8 + 120], [0, 1, 0.35], clamp);
	// 分身：一点金光落进那个人手里
	const g = prog(f, T.gift, T.gift + 45);
	const handTop = toScreen(v, [REI_TOP[0], REI_TOP[1] + 1.1, REI_TOP[2]]);
	const chest = toScreen(v, [ARC_P[0], ARC_P[1] - 0.8, ARC_P[2] + 1]);
	return (
		<>
			{/* 接上一段的天界之笛（同一个组件），吹笛时再亮一下 */}
			{reiO > 0.01 ? (
				<AbsoluteFill style={{opacity: reiO}}>
					<Flute f={f} v={v} />
				</AbsoluteFill>
			) : null}
			{reiO > 0.01 ? <Glow v={v} p={[REI_P[0] + 0.12, REI_P[1] + 1.05, REI_P[2] + 0.15]} r={90} rgb={AZURE} a={Math.max(0, flute - 0.7) * reiO} /> : null}
			<FluteRings f={f} v={v} at={T.play1} n={3} />
			<FluteRings f={f} v={v} at={T.play2} n={4} />
			<TrainerSil v={v} {...REI} foot={REI_P} h={1.65} o={reiO} from="right" rgb="200,215,255" lift={0.12} />
			{!arcS.behind && halo > 0 ? (
				<>
					<div style={{position: 'absolute', left: arcS.x - arcSize * 1.3, top: arcS.y - arcSize * 1.3, width: arcSize * 2.6, height: arcSize * 2.6, borderRadius: '50%', opacity: halo, background: `radial-gradient(circle, rgba(255,250,235,0.9) 0%, rgba(${GOLD},0.55) 18%, rgba(${GOLD},0.15) 42%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
					{rays > 0 ? (
						<div
							style={{
								position: 'absolute',
								left: arcS.x - 1400,
								top: arcS.y - 1400,
								width: 2800,
								height: 2800,
								opacity: rays,
								transform: `rotate(${f * 0.25}deg)`,
								background: `repeating-conic-gradient(from 0deg, rgba(${GOLD},0.32) 0deg, rgba(${GOLD},0) 4deg, rgba(${GOLD},0) 11deg)`,
								WebkitMaskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0) 55%)',
								maskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0) 55%)',
								mixBlendMode: 'screen',
							}}
						/>
					) : null}
				</>
			) : null}
			{!arcS.behind && arcO > 0 ? <PokemonArt3D dir="pokemon/arceus" x={arcS.x} y={arcS.y} size={arcSize} {...ARC_LIGHT} brightness={arcB} opacity={arcO} resolution={1.4} /> : null}
			{!arcS.behind && burstK > 0 && burstK < 1 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
					{[0, 0.18, 0.36].map((d, i) => {
						const t = prog(burstK, d, d + 0.64);
						if (t <= 0 || t >= 1) return null;
						return <ellipse key={i} cx={arcS.x} cy={arcS.y} rx={60 + 1500 * t} ry={30 + 560 * t} fill="none" stroke={`rgba(255,236,190,${0.9 * (1 - t)})`} strokeWidth={10 * (1 - t) + 2} />;
					})}
				</svg>
			) : null}
			<TrainerSil v={v} {...REI} foot={REI_TOP} h={1.65} o={reiTopO} from="right" rgb="255,226,170" lift={0.12} />
			{g > 0 && g < 1 && !chest.behind ? (
				<div style={{position: 'absolute', left: chest.x + (handTop.x - chest.x) * ease(g) - 50, top: chest.y + (handTop.y - chest.y) * ease(g) - 50, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(${GOLD},0.85) 22%, rgba(${GOLD},0) 70%)`, mixBlendMode: 'screen'}} />
			) : null}
			{g >= 1 ? <Glow v={v} p={[REI_TOP[0], REI_TOP[1] + 1.1, REI_TOP[2]]} r={80} rgb={GOLD} a={0.9 * (1 - prog(f, T.gift + 45, T.l94 + 60)) + 0.25} /> : null}
		</>
	);
};

// ── 2D：走遍洗翠（延时）──

type Land = {sky: [string, string]; hills: string[]; ground: string; mons: {src: string; x: number; h: number; flip?: boolean}[]; extra?: 'water' | 'sea' | 'lava' | 'aurora'};
const LANDS: Land[] = [
	{sky: ['#a9c4e0', '#f2e2c8'], hills: ['#7d8fa2', '#55677a'], ground: '#e6ecf2', mons: [{src: 'pokemon/wyrdeer/art.png', x: 1380, h: 360}, {src: 'pokemon/ursaluna/art.png', x: 420, h: 300, flip: true}]},
	{sky: ['#8e9a88', '#d8d2b8'], hills: ['#5f6a58', '#3d4637'], ground: '#4b5644', mons: [{src: 'pokemon/basculegion/art.png', x: 1300, h: 300}, {src: 'pokemon/lilligant-hisui/art.png', x: 520, h: 260}], extra: 'water'},
	{sky: ['#5f8fc8', '#cfe2ee'], hills: ['#5b7088', '#3e4e62'], ground: '#d9cfb4', mons: [{src: 'pokemon/arcanine-hisui/art.png', x: 1420, h: 330, flip: true}, {src: 'pokemon/braviary-hisui/art.png', x: 600, h: 300}], extra: 'sea'},
	{sky: ['#3a2a30', '#b0603a'], hills: ['#3a2a2a', '#241818'], ground: '#2c201c', mons: [{src: 'pokemon/kleavor/art.png', x: 1350, h: 340}, {src: 'pokemon/electrode-hisui/art.png', x: 560, h: 200}], extra: 'lava'},
	{sky: ['#0d1830', '#2e4a6a'], hills: ['#2a3a52', '#18243a'], ground: '#c8d6e6', mons: [{src: 'pokemon/avalugg-hisui/art.png', x: 1380, h: 300}, {src: 'pokemon/sneasler/art.png', x: 560, h: 280, flip: true}], extra: 'aurora'},
];
const LAND_LEN = 36;
const ridge = (seed: number, y: number, amp: number) =>
	'M0,1080 ' +
	Array.from({length: 41}, (_, i) => {
		const x = i * 50;
		return `L${x},${y - amp * (0.5 + 0.35 * Math.sin(i * 0.55 + seed) + 0.15 * Math.sin(i * 1.7 + seed * 3))}`;
	}).join(' ') +
	' L2000,1080 Z';

const LandPanel: React.FC<{f: number; i: number}> = ({f, i}) => {
	const L = LANDS[i];
	const t0 = T.journey + 14 + i * LAND_LEN;
	const o = interpolate(f, [t0 - 8, t0 + 4, t0 + LAND_LEN - 2, t0 + LAND_LEN + 8], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const t = prog(f, t0 - 8, t0 + LAND_LEN + 8);
	const sun = {x: 200 + 1500 * t, y: 380 - 260 * Math.sin(Math.PI * t)};
	const walk = 300 + 1300 * t;
	return (
		<AbsoluteFill style={{opacity: o}}>
			<div style={{position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${L.sky[0]} 0%, ${L.sky[1]} 70%)`}} />
			{L.extra === 'aurora' ? <div style={{position: 'absolute', left: 0, right: 0, top: 80, height: 300, opacity: 0.55, background: 'linear-gradient(100deg, rgba(80,255,180,0) 10%, rgba(80,255,180,0.5) 35%, rgba(120,180,255,0.4) 60%, rgba(80,255,180,0) 85%)', filter: 'blur(30px)', transform: `skewY(-6deg) translateX(${-80 * t}px)`}} /> : null}
			<div style={{position: 'absolute', left: sun.x - 90, top: sun.y - 90, width: 180, height: 180, borderRadius: '50%', background: L.extra === 'aurora' ? 'radial-gradient(circle, rgba(240,245,255,0.95) 0%, rgba(200,215,255,0.3) 30%, rgba(0,0,0,0) 70%)' : 'radial-gradient(circle, rgba(255,250,235,1) 0%, rgba(255,214,150,0.5) 25%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<g transform={`translate(${-60 * t},0)`}>
					<path d={ridge(i * 3 + 1, 620, 220)} fill={L.hills[0]} />
					{L.extra === 'lava' ? <path d="M880,640 L980,330 L1080,330 L1180,640 Z" fill="#2a1a18" /> : null}
					{L.extra === 'lava' ? <ellipse cx={1030} cy={320} rx={70} ry={18} fill="rgba(255,120,50,0.9)" /> : null}
				</g>
				<g transform={`translate(${-140 * t},0)`}>
					<path d={ridge(i * 5 + 2, 760, 140)} fill={L.hills[1]} />
				</g>
				<rect x={0} y={800} width={1920} height={280} fill={L.ground} />
				{L.extra === 'water' || L.extra === 'sea' ? <rect x={0} y={800} width={1920} height={L.extra === 'sea' ? 160 : 110} fill={L.extra === 'sea' ? '#4f7fae' : '#6f7d6a'} opacity={0.85} /> : null}
			</svg>
			{L.extra === 'lava' ? <div style={{position: 'absolute', left: 930, top: 120, width: 200, height: 220, opacity: 0.4, background: 'radial-gradient(ellipse, rgba(120,110,110,0.8) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(12px)', transform: `translateY(${-30 * t}px)`}} /> : null}
			{L.mons.map((m, k) => (
				<Img key={k} src={staticFile(m.src)} style={{position: 'absolute', left: m.x - m.h / 2 - 90 * t, top: 860 - m.h, width: m.h, height: m.h, transform: m.flip ? 'scaleX(-1)' : undefined, filter: 'brightness(0) drop-shadow(0 0 3px rgba(255,240,210,0.7))', opacity: 0.92}} />
			))}
			<ScreenSil {...REI} x={walk} y={860 - 120} h={240} rgb="255,240,210" lift={0.08} from="top" />
		</AbsoluteFill>
	);
};

const Journey: React.FC<{f: number}> = ({f}) => {
	if (f < T.journey - 10 || f > T.stairs + 12) return null;
	const o = interpolate(f, [T.journey - 6, T.journey + 14, T.stairs - 8, T.stairs + 10], [0, 1, 1, 0], clamp);
	return (
		<AbsoluteFill style={{opacity: o}}>
			{LANDS.map((_, i) => (
				<LandPanel key={i} f={f} i={i} />
			))}
		</AbsoluteFill>
	);
};

// ── 合在一起 ──

export const HallMaster: React.FC<{f: number}> = ({f}) => {
	const v = viewAt(f);
	const in3D = f < T.journey + 20 || f >= T.stairs - 12;
	// 光爆：金白光吞没画面，停一下再退
	const flash = interpolate(f, [T.burst8 - 4, T.burst8 + 2, T.burst8 + 20, T.burst8 + 80], [0, 1, 0.92, 0], clamp);
	const lum = f >= T.climb ? 0.85 : 0.3;
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			{in3D ? <HallWorld f={f} v={v} /> : null}
			{in3D ? <Layers3D f={f} v={v} /> : null}
			<Journey f={f} />
			{flash > 0 ? <AbsoluteFill style={{background: `rgba(255,248,232,${flash})`, mixBlendMode: 'screen'}} /> : null}
			<AbsoluteFill style={{background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${0.52 - 0.2 * prog(f, T.stairs, T.climb)}) 100%)`, pointerEvents: 'none'}} />
			<NameTag from={T.arceusPeak + 4} x={150} y={560} no="No.0493" zh="阿尔宙斯" en="ARCEUS" category="创造宝可梦" categoryEn="Alpha Pokémon" opacity={interpolate(f, [T.burst8 - 16, T.burst8 - 4], [1, 0], clamp)} />
			{SUBS_HALL.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			<Cry name="arceus" at={T.arceusPeak} />
			<Cry name="arceus" at={T.burst8} volume={0.9} />
			<Grain opacity={f < T.climb ? 0.095 : 0.12 - 0.065 * lum} />
		</AbsoluteFill>
	);
};

export const SUBS_HALL: [number, number, string, string, SubtitleSource?][] = [
	[T.l87, T.l87 + 95, '笛声第一次响起时，什么也没有发生。', 'The first time the flute was played, nothing happened.'],
	[T.l88, T.l88 + 160, '你想起了最初那句话，走遍了洗翠，去和所有的宝可梦相遇。', 'Remembering those first words, you crossed all of Hisui to seek out every Pokémon.'],
	[T.l89, T.l89 + 140, '当笛声再次响起，神殿的废墟上方，出现了一道光的阶梯。', 'When the flute sounded again, a stairway of light rose above the temple ruins.'],
	[T.l90, T.l90 + 85, '阶梯的尽头，就是阿尔宙斯。', 'At the top of the stairs was Arceus.'],
	[T.l91, T.l91 + 150, '它以自身为光源，从天上照耀洗翠的大地，引导并守护宝可梦。', 'It is its own source of light, shining down on Hisui, guiding and protecting Pokémon.', {zh: '阿尔宙斯《传说 阿尔宙斯》图鉴，改写', en: 'Arceus LA Pokédex, paraphrased'}],
	[T.l92, T.l92 + 115, '「把你召唤到这个世界来，真是太好了。」', '"I am glad that I chose thee to call to this world."', {zh: '《传说 阿尔宙斯》阿尔宙斯台词', en: 'Bulbapedia, Arceus (game)/Quotes'}],
	[T.l93, T.l93 + 95, '它把自己的分身，交给了你。', 'It entrusted a part of itself to you.'],
	[T.l94, T.l94 + 170, '很久以后，人们把这片废墟叫作枪之柱，把阶梯的尽头叫作起始之殿。', 'Long after, people would call these ruins the Spear Pillar, and the top of the stairs the Hall of Origin.'],
];
