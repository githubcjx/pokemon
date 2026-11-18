import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import * as THREE from 'three';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {ArtLighting, PokemonArt3D} from '../../components/PokemonArt3D';
import {Flame} from '../../components/unown/Silhouette';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {CloudSea, Sky, Snow, Terrain} from '../../three/hisui/coronet';
import {StoneStatue} from '../../three/hisui/statue';
import {groundAt, PEDESTAL_H, STATUES, TEMPLE, Temple} from '../../three/hisui/temple';
import {CameraRig, Env, V3} from '../../three/stage';
import {TrainerSil} from './Clans';
import {flow, prog, SUB, T, track} from './common';
import {pines, Ruins2D, Snowfall} from './Cosmos';
import {Folk, Glow, toScreen, View} from './Overlays';
import {REI, ScreenSil} from './Rift';

// ─── 第 5 段「神殿上的双神」（中篇完）────────────────────────────────────────
// 云雾遗迹的雾化成天冠山的云海，镜头升上山顶：裂缝下完好的神殿（3D）。那个人、马加木、两位首领（剪影）
// → 裂缝失衡，帝牙卢卡降临 → 红色锁链缠上去、碎了 → 收服的光落进那个人手里 → 起源帕路奇亚冲出裂缝，身后隐约一圈创造主的金光
// → 帝牙卢卡被放出来，两股力量在屋顶正中相撞：屋顶真 3D 炸开、十尊石像碎裂（全片第一个爆发点）→ 烟尘里撤下山，神殿只剩断柱
// → 拉苯的工作台：锁链碎片 + 起源矿石合成起源球（3D 特写）→ 回到山顶，裂缝合上 → 图鉴两页 → 吾思与夜空里的一点金光。

const ease = (t: number) => t * t * (3 - 2 * t);
const rnd = (s: number) => {
	const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const BLUE = '120,165,255';
const PINK = '255,150,205';
const PEARL = '255,214,234';
const RED = '255,74,62';

// ── 布景 ──

/** 裂缝的光核：神殿正上方偏后 */
const RIFT5: V3 = [0, 92, -60];
const riftDir5 = (cam: V3): V3 => {
	const d = [RIFT5[0] - cam[0], RIFT5[1] - cam[1], RIFT5[2] - cam[2]];
	const l = Math.hypot(d[0], d[1], d[2]);
	return [d[0] / l, d[1] / l, d[2] / l];
};
const g = (x: number, z: number, up = 0): V3 => [x, groundAt(x, z) + up, z];
/** 台阶：三级，各高 0.5 */
const stepY = (z: number) => (z > 22.4 ? groundAt(0, z) : z > 21.4 ? 0.5 : z > 20.6 ? 1.0 : 1.5);

const REI_TO: V3 = [1.4, 1.5, 20.3];
const REI_FROM: V3 = [2.2, 0, 27.5];
const KAMADO_FROM: V3 = [-15, 0, 37];
const KAMADO_TO: V3 = [-4.2, 0, 25.6];
const ADAMAN: V3 = g(-8.6, 24.2);
const IRIDA: V3 = g(8.8, 24.0);
/** 讨伐组：跟在马加木身后 */
const SQUAD: [number, number][] = [
	[-2.4, 1.6],
	[-1.2, 3.2],
	[-3.6, 3.6],
	[-0.4, 5],
	[-2.8, 5.8],
];

/** 两只宝可梦（世界坐标里立绘画框的中心）与画框边长（米） */
const DIALGA_FROM: V3 = [0, 66, -42];
const DIALGA_AT: V3 = [0, 27.5, -1];
const DIALGA_BOX = 28;
const PALKIA_AT: V3 = [0, 30, -5];
const PALKIA_BOX = 32;
const DIALGA2: V3 = [-15.5, 21.5, 4];
const PALKIA2: V3 = [15.5, 25.5, 1];
const CLASH_BOX = 24;
/** 两股力量相撞的地方：屋脊正上方 */
const CLASH: V3 = [0, TEMPLE.ridge + 2.2, 3];
/** 先是身体撞在一起：两只冲到屋顶正上方，撞上后各自弹回原位 */
const DIALGA_HIT: V3 = [-5.2, 22.6, 4];
const PALKIA_HIT: V3 = [5.0, 24.6, 2.5];
const IMPACT: V3 = [0, 24, 3.4];
const ramAt = (f: number) => (f < T.impact ? Math.pow(prog(f, T.ram, T.impact), 2.2) : 1 - ease(prog(f, T.impact, T.impact + 46)));
/** 冲过去时身体前倾，弹回时往后仰一下再回正 */
const leanAt = (f: number) => (f < T.impact ? 9 * prog(f, T.ram - 6, T.impact) : -7 * Math.sin(Math.PI * prog(f, T.impact, T.impact + 46)));
const mix3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const dialgaPos = (f: number) => mix3(DIALGA2, DIALGA_HIT, ramAt(f));
const palkiaPos = (f: number) => mix3(PALKIA2, PALKIA_HIT, ramAt(f));

// ── 3D 镜头：一个长镜头从云里升到神殿，经过帝牙卢卡、帕路奇亚，到对撞后拉开 ──

const CAM5: [number, number[]][] = [
	[T.end4, [9, 10, 92, 0, 8, 0, 40]],
	[T.l46 + 105, [5.5, 2.8, 41, 0.5, 5.4, 10, 40]],
	[T.l47 + 95, [-9, 2.5, 44, -5, 3.6, 22, 40]],
	[T.l48 + 110, [-2.6, 2.2, 41.5, -1, 3.2, 21, 37]],
	[T.l49 + 25, [-2, 2.1, 42.5, -0.6, 4.2, 18, 39]],
	[T.l50 + 10, [0, 2.0, 48, 0, 25, -10, 50]],
	[T.dialgaPeak + 10, [0, 2.2, 49, 0, 24, -6, 48]],
	[T.l51 + 70, [4.5, 1.5, 50.5, 0, 20.5, -4, 50]],
	[T.chainBreak, [3.2, 1.7, 47.5, 0, 22, -2, 46]],
	[T.l53 + 70, [2, 2.0, 50, 0, 20, -2, 48]],
	[T.palkia + 8, [0, 2.3, 55, 0, 24, -4, 50]],
	[T.dialga2 - 25, [-1.6, 2.5, 50.5, 0, 25.5, -3, 46]],
	[T.dialga2 + 35, [0, 4.4, 65, 0, 17, 0, 50]],
	[T.impact, [0, 4.0, 60, 0, 19, 1, 47]],
	[T.beam + 10, [0, 4.3, 64, 0, 17.5, 1, 49]],
	[T.burst - 4, [0, 3.4, 53, 0, 17.5, 2, 44]],
	[T.burst + 46, [0, 8.5, 86, 0, 12, 0, 50]],
	[T.l57 + 95, [17, 6.2, 72, 0, 6, 0, 44]],
];
/** 回到山顶：收服第二只，裂缝合上，镜头仰向重新露出的星空 */
const CAM5B: [number, number[]][] = [
	[T.summit - 25, [13, 3.4, 50, 0, 15, -4, 46]],
	[T.close + 20, [10, 3.4, 53, 0, 22, -14, 48]],
	[T.dex + 30, [8, 3.2, 55, 0, 36, -30, 52]],
];

/** 爆发点的震动：只动镜头（3D 和对齐在上面的 2D 一起动，画面不露边） */
const shakeAt = (f: number) => {
	const k = (f >= T.chainBreak && f < T.chainBreak + 20 ? 0.35 * Math.exp(-(f - T.chainBreak) / 6) : 0) + (f >= T.palkia && f < T.palkia + 30 ? 0.5 * Math.exp(-(f - T.palkia) / 9) : 0) + (f >= T.impact - 1 && f < T.impact + 55 ? 1.4 * Math.exp(-(f - T.impact) / 13) : 0) + (f >= T.burst - 2 && f < T.burst + 70 ? 1.4 * Math.exp(-(f - T.burst) / 18) : 0);
	return [Math.sin(f * 2.31) * k, Math.sin(f * 1.73 + 1) * k * 0.7, Math.sin(f * 2.97 + 2) * k * 0.5];
};

const viewAt = (f: number): View => {
	const c = f >= T.summit - 25 ? flow(f, CAM5B) : flow(f, CAM5);
	const s = shakeAt(f);
	return {pos: [c[0] + s[0] * 0.4, c[1] + s[1] * 0.4, c[2]], target: [c[3] + s[0], c[4] + s[1], c[5] + s[2]], fov: c[6]};
};

// ── 天色与光 ──

/** 裂缝：张开 → 失衡时一闪一闪 → 第二只收服后合上 */
const riftAt = (f: number) => {
	const base = track(f, [[T.close, 1], [T.close + 55, 0]]);
	const jitter = f >= T.unbalance && f < T.dialga + 30 ? 0.35 * Math.abs(Math.sin(f * 0.9)) * (1 - prog(f, T.dialga, T.dialga + 30)) : 0;
	return base * (1 + jitter);
};
const canopyAt = (f: number) => track(f, [[T.close, 1], [T.close + 60, 0]]);
const redAt = (f: number) => 0.35 * track(f, [[T.close - 10, 1], [T.close + 50, 0]]);

/** 画面里的闪光：降临、锁链碎、冲出、对撞 */
const FLASHES: [number, number, number, string][] = [
	[T.dialga + 4, 0.5, 18, '225,232,255'],
	[T.chainBreak, 0.45, 14, '255,120,110'],
	[T.caught + 14, 0.35, 12, '255,230,230'],
	[T.palkia, 0.85, 22, '255,214,236'],
	[T.impact, 0.7, 16, '236,228,255'],
	[T.burst, 1, 40, '255,250,245'],
];
const flashOf = (f: number) =>
	FLASHES.reduce(
		(m, [t, a, w, rgb]) => {
			const v = f < t - 3 ? 0 : f < t ? (a * (f - t + 3)) / 3 : a * Math.exp(-(f - t) / (w * 0.45));
			return v > m.v ? {v, rgb} : m;
		},
		{v: 0, rgb: '255,255,255'},
	);

const lerpC = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 裂缝下的布光：紫灰的天光从上方来，裂缝的白蓝光做主光；合上后回到月夜 */
const RiftLights: React.FC<{f: number}> = ({f}) => {
	const night = 1 - canopyAt(f);
	const key = new THREE.Vector3(...RIFT5).normalize().lerp(new THREE.Vector3(0.18, 0.34, -1).normalize(), night).normalize().multiplyScalar(90);
	const dPow = interpolate(f, [T.dialga + 20, T.dialgaPeak, T.caught, T.caught + 14], [0, 1, 1, 0], clamp) + interpolate(f, [T.dialga2, T.dialga2 + 30, T.burst + 10, T.burst + 30], [0, 1, 1, 0], clamp);
	const pPow = interpolate(f, [T.palkia, T.palkiaPeak, T.burst + 10, T.burst + 30], [0, 1, 1, 0], clamp);
	const burst = interpolate(f, [T.burst - 14, T.burst, T.burst + 60], [0, 1, 0], clamp);
	const dPos = f < T.dialga2 ? DIALGA_AT : dialgaPos(f);
	const pPos = f < T.dialga2 - 40 ? PALKIA_AT : palkiaPos(f);
	const hit = interpolate(f, [T.impact - 3, T.impact, T.impact + 30], [0, 1, 0], clamp);
	return (
		<>
			<Env intensity={lerp(0.16, 0.12, night)} />
			<fog attach="fog" args={[lerpC('#3a2e4a', '#2a3445', night), 90, 640]} />
			<ambientLight intensity={0.42} color={lerpC('#9886b6', '#8193b5', night)} />
			<hemisphereLight args={[lerpC('#b8a6dc', '#90a4c8', night), lerpC('#271d2e', '#1e2026', night), 0.7]} />
			<directionalLight
				position={[key.x, key.y, key.z]}
				intensity={lerp(2.3, 2.4, night)}
				color={lerpC('#d4dcff', '#c4d3ee', night)}
				castShadow
				shadow-mapSize={[4096, 4096]}
				shadow-camera-left={-40}
				shadow-camera-right={40}
				shadow-camera-top={40}
				shadow-camera-bottom={-40}
				shadow-camera-near={1}
				shadow-camera-far={240}
				shadow-bias={-0.0004}
				shadow-normalBias={0.04}
			/>
			<directionalLight position={[-40, 30, -60]} intensity={0.5} color={lerpC('#a777b8', '#6f86b0', night)} />
			{dPow > 0 ? <pointLight position={dPos} intensity={900 * dPow} distance={80} decay={2} color="#7fa6ff" /> : null}
			{pPow > 0 ? <pointLight position={pPos} intensity={1100 * pPow} distance={90} decay={2} color="#ff9fd6" /> : null}
			{burst > 0 ? <pointLight position={CLASH} intensity={9000 * burst} distance={160} decay={2} color="#fff2ea" /> : null}
			{hit > 0 ? <pointLight position={IMPACT} intensity={5000 * hit} distance={120} decay={2} color="#ece4ff" /> : null}
		</>
	);
};

const blastAt = (f: number) => (f < T.burst ? 0 : prog(f, T.burst + 4, T.burst + 175));
/** 身体相撞后先塌下来的一小块 */
const earlyAt = (f: number) => prog(f, T.impact + 3, T.impact + 75);
/** 石像碎裂：对撞的冲击到达各尊石像的时刻（秒） */
const shatterAt = (f: number, i: number) => Math.max(0, (f - T.burst - 30 - (i % 5) * 9 - (i < 5 ? 0 : 4)) / 30);

const TempleWorld: React.FC<{f: number; v: View}> = ({f, v}) => {
	const time = f / 30;
	const rift = riftAt(f);
	const canopy = canopyAt(f);
	const night = 1 - canopy;
	const cloudY = track(f, [[T.end4, -30], [T.l46 + 100, -46]]);
	return (
		<ThreeCanvas width={1920} height={1080} shadows gl={{antialias: true}}>
			<CameraRig pos={v.pos} target={v.target} fov={v.fov} far={900} />
			<RiftLights f={f} />
			<Sky cam={v.pos} s={{dusk: 0, starRot: f * 0.0006, trail: 0, gold: 0, red: redAt(f), time, rift: Math.min(1.3, rift), canopy, riftDir: riftDir5(v.pos)}} />
			<Terrain />
			<Temple ruin={0} build={1} blast={blastAt(f)} early={earlyAt(f)} />
			{STATUES.map((s, i) => (
				<StoneStatue key={s.name} dir={s.dir} pos={[s.x, TEMPLE.stepTop + PEDESTAL_H, s.z]} ry={s.ry} height={3.3} opacity={1} shatter={shatterAt(f, i)} seed={i + 3} />
			))}
			<CloudSea y={cloudY} opacity={0.75} time={time} color={night > 0.5 ? '#9aa7bd' : '#a99cb8'} shade={night > 0.5 ? '#3d4658' : '#3e3048'} cam={v.pos} />
			<Snow cam={v.pos} time={time} amount={0.45 + 0.35 * prog(f, T.burst, T.burst + 30)} wind={1.4} color={night > 0.5 ? '#e8eef8' : '#e4dcf0'} />
		</ThreeCanvas>
	);
};

// ── 2D：画在 3D 上的宝可梦、锁链、光 ──

const DIALGA_LIGHT: ArtLighting = {
	depthScale: 0.5,
	ambient: [0.58, 0.58, 0.72],
	dirLights: [
		{dir: [0.1, -1, 0.55], color: [0.85, 0.9, 1.1], wrap: 0.45},
		{dir: [-0.8, 0.2, 0.4], color: [0.25, 0.2, 0.42], wrap: 0.5},
	],
	rim: {dir: [0, -1], color: [0.75, 0.75, 1.15], power: 3},
};
const PALKIA_LIGHT: ArtLighting = {
	depthScale: 0.5,
	ambient: [0.62, 0.58, 0.68],
	dirLights: [
		{dir: [0.1, -1, 0.55], color: [0.88, 0.88, 1.05], wrap: 0.45},
		{dir: [0.8, 0.2, 0.4], color: [0.42, 0.22, 0.34], wrap: 0.5},
	],
	rim: {dir: [0, -1], color: [1.1, 0.8, 1.05], power: 3},
};

type Art = {dir: string; variant: string; mouth: [number, number]};
/** 官方立绘（用户 2026-10-31：不用 AI 图）；帝牙卢卡原图就朝右。mouth：嘴 / 发力处在画框里的位置（0–1） */
const DIALGA_ART: Art = {dir: 'pokemon/dialga', variant: '', mouth: [0.875, 0.29]};
const PALKIA_ART: Art = {dir: 'pokemon/palkia', variant: '-origin', mouth: [0.72, 0.2]};

/** 世界坐标里的画框 → 屏幕上的中心与边长 */
const frameOf = (v: View, p: V3, box: number) => {
	const s = toScreen(v, p);
	return {x: s.x, y: s.y, size: box * s.s, behind: s.behind};
};

const Mon: React.FC<{v: View; art: Art; p: V3; box: number; o: number; bright: number; light: ArtLighting; flip?: boolean; yaw?: number; scale?: number; rot?: number}> = ({v, art, p, box, o, bright, light, flip, yaw = 0, scale = 1, rot = 0}) => {
	if (o <= 0.001) return null;
	const fr = frameOf(v, p, box * scale);
	if (fr.behind) return null;
	return (
		<PokemonArt3D
			dir={art.dir}
			variant={art.variant}
			x={fr.x}
			y={fr.y}
			size={fr.size}
			yaw={yaw}
			{...light}
			brightness={bright}
			opacity={o}
			resolution={1.3}
			style={flip || rot ? {transform: `rotate(${rot}deg)${flip ? ' scaleX(-1)' : ''}`} : undefined}
		/>
	);
};

/** 画框里某点（0–1，按未翻转的立绘）→ 屏幕 */
const artPt = (v: View, p: V3, box: number, uv: [number, number], flip = false) => {
	const fr = frameOf(v, p, box);
	const u = flip ? 1 - uv[0] : uv[0];
	return {x: fr.x + (u - 0.5) * fr.size, y: fr.y + (uv[1] - 0.5) * fr.size};
};

/** 一圈锁链：屏幕上的椭圆，环一横一竖 */
const ChainLoop: React.FC<{cx: number; cy: number; rx: number; ry: number; rot: number; grow: number; n: number; k0: number; link: number}> = ({cx, cy, rx, ry, rot, grow, n, k0, link}) => (
	<g transform={`translate(${cx},${cy}) rotate(${rot})`}>
		{Array.from({length: n}, (_, k) => {
			const v = prog(grow, k / n, k / n + 0.12);
			if (v <= 0) return null;
			const a = (k / n) * Math.PI * 2 + k0;
			const x = Math.cos(a) * rx;
			const y = Math.sin(a) * ry;
			const ang = (Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx) * 180) / Math.PI;
			const flat = k % 2 === 0;
			return (
				<g key={k} transform={`translate(${x},${y}) rotate(${ang}) scale(${v * link})`}>
					{flat ? <ellipse rx={22} ry={11} fill="none" stroke="#ff4a3e" strokeWidth={6} /> : <rect x={-21} y={-3} width={42} height={6} rx={3} fill="#d9282a" />}
					{flat ? <ellipse rx={22} ry={11} fill="none" stroke="rgba(255,210,200,0.85)" strokeWidth={1.6} /> : null}
				</g>
			);
		})}
	</g>
);

/** 锁链碎片：从帝牙卢卡身上往外迸开、下落、熄灭 */
const SHARDS = Array.from({length: 70}, (_, i) => ({a: rnd(i * 1.7) * Math.PI * 2, sp: 6 + rnd(i * 2.3) * 16, rot: (rnd(i * 3.1) - 0.5) * 30, w: 8 + rnd(i * 4.7) * 18, life: 40 + rnd(i * 5.9) * 40}));

const ChainLayer: React.FC<{f: number; v: View}> = ({f, v}) => {
	if (f < T.l52 || f > T.chainBreak + 90) return null;
	const c = artPt(v, DIALGA_AT, DIALGA_BOX, [0.5, 0.56]);
	const fr = frameOf(v, DIALGA_AT, DIALGA_BOX);
	const hand = toScreen(v, [REI_TO[0], REI_TO[1] + 1.1, REI_TO[2]]);
	const throwP = ease(prog(f, T.l52 + 5, T.l52 + 30));
	const grow = prog(f, T.l52 + 22, T.chainBreak - 18);
	const tight = 1 - 0.12 * ease(prog(f, T.chainBreak - 26, T.chainBreak - 4));
	const shake = f > T.chainBreak - 26 && f < T.chainBreak ? Math.sin(f * 3.1) * 4 : 0;
	const broken = f >= T.chainBreak;
	const pulse = 0.8 + 0.2 * Math.sin(f * 0.4);
	const R = fr.size * 0.3 * tight;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{!broken ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 0 5px rgba(${RED},${0.95 * pulse})) drop-shadow(0 0 22px rgba(220,30,40,${0.6 * pulse}))`}}>
					{/* 从那个人手里甩出去的一道 */}
					{throwP > 0 && throwP < 1 ? (
						<line x1={hand.x} y1={hand.y} x2={hand.x + (c.x - hand.x) * throwP} y2={hand.y + (c.y - hand.y) * throwP} stroke="#ff5a4a" strokeWidth={5} strokeDasharray="16 8" />
					) : null}
					<ChainLoop cx={c.x + shake} cy={c.y - R * 0.28} rx={R * 0.9} ry={R * 0.2} rot={-8} grow={grow} n={14} k0={0} link={R / 85} />
					<ChainLoop cx={c.x - shake} cy={c.y + R * 0.42} rx={R} ry={R * 0.22} rot={6} grow={prog(grow, 0.25, 1)} n={15} k0={0.6} link={R / 85} />
				</svg>
			) : (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 0 6px rgba(${RED},0.9))`}}>
					{SHARDS.map((s, i) => {
						const t = f - T.chainBreak;
						const a = 1 - t / s.life;
						if (a <= 0) return null;
						const x = c.x + Math.cos(s.a) * (R * 0.6 + s.sp * t * 1.4);
						const y = c.y + Math.sin(s.a) * (R * 0.25 + s.sp * t * 0.8) + 0.12 * t * t;
						return <rect key={i} x={x - s.w / 2} y={y - 3} width={s.w} height={6} rx={2} fill="#ff4a3e" opacity={a} transform={`rotate(${s.rot * t * 0.3 + i * 37} ${x} ${y})`} />;
					})}
				</svg>
			)}
		</AbsoluteFill>
	);
};

/** 两股力量：帝牙卢卡嘴里的蓝光、帕路奇亚的粉光，在屋脊上空撞在一起
 *  蓄力 → 光柱喷出、在中间相抵 → 僵持（交界处来回推、迸出电弧）→ 合成一团光，炸开（用户 2026-10-31：光柱要粗、要炫） */
const CLASH_FIRE = T.burst - 34;
const CLASH_MEET = T.burst - 24;
type P2 = {x: number; y: number};
/** 沿 a→b 的点：t 沿轴，n 垂直于轴（像素） */
const along = (a: P2, b: P2, t: number, n: number): P2 => {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const l = Math.hypot(dx, dy) || 1;
	return {x: a.x + dx * t - (dy / l) * n, y: a.y + dy * t + (dx / l) * n};
};
const pts = (arr: P2[]) => arr.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
/** 交界处的电弧 */
const ARCS = Array.from({length: 9}, (_, i) => ({a: (i / 9) * Math.PI * 2 + rnd(i * 3.7), len: 120 + rnd(i * 5.1) * 200}));
/** 沿光柱飞的光点 */
const MOTES = Array.from({length: 26}, (_, i) => ({t0: rnd(i * 1.7), off: rnd(i * 2.9) - 0.5, sp: 0.05 + rnd(i * 4.3) * 0.05, r: 2 + rnd(i * 6.1) * 4}));

const ClashLayer: React.FC<{f: number; v: View}> = ({f, v}) => {
	if (f < T.beam || f > T.burst + 30) return null;
	const dm = artPt(v, DIALGA2, CLASH_BOX, DIALGA_ART.mouth);
	const pm = artPt(v, PALKIA2, CLASH_BOX * 1.15, PALKIA_ART.mouth, true);
	const c = toScreen(v, CLASH);
	const charge = prog(f, T.beam, CLASH_FIRE);
	const fire = ease(prog(f, CLASH_FIRE, CLASH_MEET));
	const ball = prog(f, T.burst - 12, T.burst);
	const gone = 1 - prog(f, T.burst + 2, T.burst + 24);
	// 僵持：交界点在两只之间来回推
	const push = f < CLASH_MEET ? 0 : 0.07 * Math.sin((f - CLASH_MEET) * 0.45) * (1 - ball);
	const meet = {x: c.x + (pm.x - dm.x) * push * 0.5, y: c.y + (pm.y - dm.y) * push * 0.5};
	const hold = f >= CLASH_MEET && ball < 1;
	// 光柱的粗细：喷出时猛地变粗，僵持时抖动，合成光团时收细
	const swell = ease(prog(f, CLASH_FIRE, CLASH_FIRE + 6)) * (1 - 0.6 * ball);
	const W = 110 * swell * (1 + 0.1 * Math.sin(f * 1.9) + 0.06 * Math.sin(f * 3.7));

	const beam = (from: P2, rgb: string, deep: string, seed: number) => {
		const to = {x: from.x + (meet.x - from.x) * fire, y: from.y + (meet.y - from.y) * fire};
		const len = Math.hypot(to.x - from.x, to.y - from.y);
		if (len < 2 || W < 0.5) return null;
		// 外形：嘴边细、往前张开的光柱
		const shape = (w: number) => {
			const n = 18;
			const up: P2[] = [];
			const dn: P2[] = [];
			for (let i = 0; i <= n; i++) {
				const t = i / n;
				const wt = w * (0.42 + 0.58 * Math.pow(t, 0.6)) * (1 + 0.08 * Math.sin(t * 19 - f * 0.9 + seed));
				up.push(along(from, to, t, wt / 2));
				dn.push(along(from, to, t, -wt / 2));
			}
			return pts([...up, ...dn.reverse()]);
		};
		// 绕着光柱转的两股能量：正弦螺旋，相位往前跑
		const helix = (ph: number) => {
			const n = Math.max(8, Math.round(len / 10));
			return pts(
				Array.from({length: n + 1}, (_, i) => {
					const t = i / n;
					const amp = W * 0.62 * (0.4 + 0.6 * Math.pow(t, 0.6));
					return along(from, to, t, amp * Math.sin(t * len * 0.035 - f * 0.75 + ph));
				}),
			);
		};
		// 往前推进的光环
		const ang = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
		const rings = Array.from({length: 4}, (_, k) => {
			const u = ((f - CLASH_FIRE) * 0.06 + k / 4) % 1;
			const q = along(from, to, u, 0);
			const rw = W * (0.55 + 0.6 * Math.pow(u, 0.6));
			return <ellipse key={k} cx={q.x} cy={q.y} rx={rw * 0.22} ry={rw * 0.78} transform={`rotate(${ang} ${q.x} ${q.y})`} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={4} opacity={Math.sin(Math.PI * u)} />;
		});
		return (
			<g>
				<polygon points={shape(W * 3.4)} fill={`rgba(${rgb},0.32)`} filter="url(#clashBlurL)" />
				<polygon points={shape(W * 1.8)} fill={`rgba(${deep},0.75)`} filter="url(#clashBlurS)" />
				<polygon points={shape(W)} fill={`rgb(${rgb})`} filter="url(#clashBlurT)" />
				<polyline points={helix(Math.PI)} fill="none" stroke={`rgb(${deep})`} strokeWidth={7} strokeLinecap="round" filter="url(#clashBlurT)" />
				<polyline points={helix(0)} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={5} strokeLinecap="round" />
				{rings}
				<polygon points={shape(W * 0.48)} fill="rgba(235,245,255,0.95)" filter="url(#clashBlurT)" />
				<polygon points={shape(W * 0.22)} fill="#ffffff" />
				{MOTES.map((m, i) => {
					const u = (m.t0 + (f - CLASH_FIRE) * m.sp) % 1;
					const q = along(from, to, u, m.off * W * 2.2 * (0.5 + u));
					return <circle key={i} cx={q.x} cy={q.y} r={m.r} fill="#ffffff" opacity={0.9 * Math.sin(Math.PI * u)} />;
				})}
			</g>
		);
	};
	const orb = (p: P2, rgb: string, r: number) => (
		<div style={{position: 'absolute', left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(${rgb},0.85) 22%, rgba(${rgb},0.25) 48%, rgba(${rgb},0) 70%)`, mixBlendMode: 'screen'}} />
	);
	/** 十字星芒：一长一短两道细光 */
	const flare = (p: P2, rgb: string, r: number, rot: number) => (
		<g transform={`translate(${p.x},${p.y}) rotate(${rot})`} filter="url(#clashBlurT)">
			<ellipse rx={r} ry={r * 0.035} fill={`rgba(${rgb},0.9)`} />
			<ellipse rx={r * 0.55} ry={r * 0.03} fill={`rgba(${rgb},0.8)`} transform="rotate(90)" />
			<ellipse rx={r * 0.5} ry={r * 0.016} fill="#ffffff" />
		</g>
	);
	const crackle = hold ? 0.6 + 0.4 * Math.sin(f * 2.3) : 0;
	const step = Math.floor(f / 2);
	return (
		<AbsoluteFill style={{pointerEvents: 'none', opacity: gone}}>
			{orb(dm, BLUE, (36 + 90 * charge) * (1 + 0.25 * swell))}
			{orb(pm, PINK, (36 + 90 * charge) * (1 + 0.25 * swell))}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<defs>
					<filter id="clashBlurL" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation={22} />
					</filter>
					<filter id="clashBlurS" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation={6} />
					</filter>
					<filter id="clashBlurT" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation={2} />
					</filter>
				</defs>
				{charge > 0.2 ? flare(dm, BLUE, 170 * charge * (1 + 0.3 * swell), -6 + 3 * Math.sin(f * 0.2)) : null}
				{charge > 0.2 ? flare(pm, PINK, 170 * charge * (1 + 0.3 * swell), 6 - 3 * Math.sin(f * 0.2)) : null}
				{fire > 0 ? beam(dm, BLUE, '50,90,235', 1) : null}
				{fire > 0 ? beam(pm, PINK, '225,70,170', 4) : null}
				{/* 交界处的电弧：蓝粉交替，每两帧换一次形 */}
				{crackle > 0
					? ARCS.map((a, i) => {
							const L = a.len * (0.6 + 0.4 * rnd(i + step * 3.1));
							const end = {x: meet.x + Math.cos(a.a + step * 0.7) * L, y: meet.y + Math.sin(a.a + step * 0.7) * L * 0.75};
							const line = Array.from({length: 8}, (_, k) => along(meet, end, k / 7, k === 0 || k === 7 ? 0 : (rnd(i * 9.1 + k * 3.3 + step) - 0.5) * 46));
							return <polyline key={i} points={pts(line)} fill="none" stroke={i % 2 ? `rgba(${PINK},${crackle})` : `rgba(${BLUE},${crackle})`} strokeWidth={4.5} strokeLinejoin="round" filter="url(#clashBlurT)" />;
						})
					: null}
				{hold ? flare(meet, '255,245,255', 300 + 50 * Math.sin(f * 0.9), 90 + 4 * Math.sin(f * 0.7)) : null}
			</svg>
			{hold ? orb(meet, '255,240,250', 130 + 35 * Math.sin(f * 1.3)) : null}
			{ball > 0 ? (
				<div
					style={{
						position: 'absolute',
						left: c.x - 340,
						top: c.y - 340,
						width: 680,
						height: 680,
						borderRadius: '50%',
						transform: `scale(${0.25 + 0.85 * ball})`,
						background: `conic-gradient(from ${f * 12}deg, rgba(${BLUE},0.9), rgba(${PINK},0.9), rgba(${BLUE},0.9), rgba(${PINK},0.9), rgba(${BLUE},0.9))`,
						WebkitMaskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.8) 25%, rgba(0,0,0,0) 62%)',
						maskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.8) 25%, rgba(0,0,0,0) 62%)',
						mixBlendMode: 'screen',
					}}
				/>
			) : null}
			{ball > 0 ? orb(c, '255,240,250', 80 + 170 * ball) : null}
		</AbsoluteFill>
	);
};

/** 身体撞在一起：一圈冲击波、蓝粉两半的光、四散的光丝 */
const SPARKS = Array.from({length: 26}, (_, i) => ({a: rnd(i * 2.7) * Math.PI * 2, len: 120 + rnd(i * 3.9) * 260, w: 1.5 + rnd(i * 5.3) * 3}));
const ImpactLayer: React.FC<{f: number; v: View}> = ({f, v}) => {
	if (f < T.impact - 2 || f > T.impact + 50) return null;
	const c = toScreen(v, IMPACT);
	const t = Math.max(0, f - T.impact);
	const ring = 1 - Math.exp(-t / 9);
	const fade = 1 - prog(f, T.impact + 8, T.impact + 50);
	const core = interpolate(f, [T.impact - 2, T.impact, T.impact + 22], [0, 1, 0], clamp);
	return (
		<AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen'}}>
			<div style={{position: 'absolute', left: c.x - 340, top: c.y - 340, width: 680, height: 680, borderRadius: '50%', opacity: core, background: `radial-gradient(circle at 42% 50%, rgba(255,255,255,1) 0%, rgba(${BLUE},0.75) 16%, rgba(${BLUE},0) 46%), radial-gradient(circle at 58% 50%, rgba(255,255,255,0.9) 0%, rgba(${PINK},0.75) 16%, rgba(${PINK},0) 46%)`}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<ellipse cx={c.x} cy={c.y} rx={60 + 900 * ring} ry={20 + 260 * ring} fill="none" stroke={`rgba(236,228,255,${0.85 * fade})`} strokeWidth={10 * (1 - ring) + 2} />
				<ellipse cx={c.x} cy={c.y} rx={40 + 560 * ring} ry={14 + 170 * ring} fill="none" stroke={`rgba(255,255,255,${0.6 * fade})`} strokeWidth={5 * (1 - ring) + 1} />
				{SPARKS.map((s, i) => {
					const k = Math.min(1, t / 10);
					const r0 = 40 + s.len * k * 0.5;
					const r1 = 40 + s.len * k;
					return (
						<line key={i} x1={c.x + Math.cos(s.a) * r0} y1={c.y + Math.sin(s.a) * r0 * 0.6} x2={c.x + Math.cos(s.a) * r1} y2={c.y + Math.sin(s.a) * r1 * 0.6} stroke={i % 2 ? `rgba(${BLUE},${fade})` : `rgba(${PINK},${fade})`} strokeWidth={s.w} strokeLinecap="round" />
					);
				})}
			</svg>
		</AbsoluteFill>
	);
};

/** 对撞后的烟尘：从屋脊往外翻滚、慢慢落下 */
const PUFFS = Array.from({length: 26}, (_, i) => ({a: rnd(i * 3.3) * Math.PI * 2, d: 0.4 + rnd(i * 1.9) * 0.6, r: 140 + rnd(i * 7.1) * 260, k: rnd(i * 2.2)}));
const DEBRIS = Array.from({length: 70}, (_, i) => ({a: Math.PI * (0.08 + rnd(i * 1.3) * 0.84), sp: 1.5 + rnd(i * 2.9) * 5, s: 2 + rnd(i * 4.1) * 5, life: 60 + rnd(i * 6.1) * 50}));

const DustLayer: React.FC<{f: number; v: View}> = ({f, v}) => {
	if (f < T.burst - 2 || f > T.ball + 30) return null;
	const c = toScreen(v, CLASH);
	const t = f - T.burst;
	const fade = 1 - prog(f, T.l57 + 40, T.ball + 30);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{PUFFS.map((p, i) => {
				const grow = 1 - Math.exp(-t / (18 + p.k * 20));
				const x = c.x + Math.cos(p.a) * p.d * 760 * grow;
				const y = c.y + Math.sin(p.a) * p.d * 260 * grow + t * 0.9 * p.k;
				const r = p.r * (0.25 + 0.7 * grow);
				const a = 0.26 * Math.min(1, t / 6) * fade * (1 - 0.5 * grow);
				return <div key={i} style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', opacity: a, background: 'radial-gradient(circle, rgba(150,138,160,0.75) 0%, rgba(110,100,124,0.4) 45%, rgba(80,72,92,0) 72%)', filter: 'blur(6px)'}} />;
			})}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{DEBRIS.map((d, i) => {
					const a = 1 - t / d.life;
					if (a <= 0 || t < 0) return null;
					const x = c.x + Math.cos(d.a) * d.sp * t * 1.3;
					const y = c.y + Math.sin(d.a) * d.sp * t + 0.12 * t * t;
					return <rect key={i} x={x} y={y} width={d.s} height={d.s * 0.7} fill="#1a1620" opacity={a} transform={`rotate(${i * 41 + t * 9} ${x} ${y})`} />;
				})}
			</svg>
		</AbsoluteFill>
	);
};

/** 神殿那几个 3D 镜头上的 2D 层 */
const TempleLayers: React.FC<{f: number; v: View}> = ({f, v}) => {
	// 那个人：从山坡走上台阶
	const w = ease(prog(f, T.l46 - 10, T.l46 + 95));
	const reiZ = REI_FROM[2] + (REI_TO[2] - REI_FROM[2]) * w;
	const rei: V3 = [REI_FROM[0] + (REI_TO[0] - REI_FROM[0]) * w, stepY(reiZ), reiZ];
	const reiO = interpolate(f, [T.end4 + 30, T.l46 + 10, T.l57 + 10, T.l57 + 50], [0, 1, 1, 0], clamp);
	// 马加木与讨伐组：从左边山坡上来；输了以后低头
	const kw = ease(prog(f, T.l47 - 5, T.l47 + 110));
	const kam: V3 = g(KAMADO_FROM[0] + (KAMADO_TO[0] - KAMADO_FROM[0]) * kw, KAMADO_FROM[2] + (KAMADO_TO[2] - KAMADO_FROM[2]) * kw);
	const kamO = interpolate(f, [T.l47 - 10, T.l47 + 20, T.l57 + 10, T.l57 + 50], [0, 1, 1, 0], clamp);
	const bow = 13 * ease(prog(f, T.bow, T.bow + 30)) * (1 - prog(f, T.l50, T.l50 + 40));
	const leadO = interpolate(f, [T.l48 - 20, T.l48 + 20, T.l57 + 10, T.l57 + 50], [0, 1, 1, 0], clamp);
	// 首领各自的光：l51 那个人和刚石同行，蓝光亮、珍珠白暗
	const adamanGlow = 0.35 + 0.65 * interpolate(f, [T.l51, T.l51 + 30, T.l52 + 30, T.l52 + 60], [0, 1, 1, 0.3], clamp);
	const iridaGlow = 0.35 - 0.15 * interpolate(f, [T.l51, T.l51 + 30, T.l52 + 30, T.l52 + 60], [0, 1, 1, 0], clamp);
	// 帝牙卢卡：从光核里降下，显色；收服时化成光
	const dIn = ease(prog(f, T.dialga, T.dialgaPeak));
	const dP: V3 = [DIALGA_FROM[0] + (DIALGA_AT[0] - DIALGA_FROM[0]) * dIn, DIALGA_FROM[1] + (DIALGA_AT[1] - DIALGA_FROM[1]) * dIn + Math.sin(f * 0.05) * 0.4 * dIn, DIALGA_FROM[2] + (DIALGA_AT[2] - DIALGA_FROM[2]) * dIn];
	const dO = interpolate(f, [T.dialga, T.dialga + 25, T.caught + 6, T.caught + 16], [0, 1, 1, 0], clamp);
	const dB = interpolate(f, [T.dialga + 10, T.dialgaPeak, T.caught, T.caught + 12], [0.04, 1, 1, 3.5], clamp);
	// 收服的光：飞进那个人手里
	const hand = toScreen(v, [rei[0], rei[1] + 1.1, rei[2]]);
	const dC = toScreen(v, DIALGA_AT);
	const streak = prog(f, T.caught + 12, T.caught + 34);
	const sx = dC.x + (hand.x - dC.x) * ease(streak);
	const sy = dC.y + (hand.y - dC.y) * ease(streak);
	// 警告：裂缝的光核一下下泛起粉光
	const riftS = toScreen(v, RIFT5);
	const warn = f >= T.warn && f < T.palkia ? Math.pow(Math.max(0, Math.sin((f - T.warn) * 0.16)), 3) * (0.4 + 0.6 * prog(f, T.warn, T.palkia)) : 0;
	// 起源帕路奇亚
	const pO = interpolate(f, [T.palkia - 2, T.palkia + 10, T.burst + 6, T.burst + 22], [0, 1, 1, 0], clamp);
	const pB = interpolate(f, [T.palkia, T.palkiaPeak], [0.15, 1], clamp);
	const pMove = ease(prog(f, T.dialga2 - 50, T.dialga2 + 20));
	const p2 = palkiaPos(f);
	const pP: V3 = [PALKIA_AT[0] + (p2[0] - PALKIA_AT[0]) * pMove, PALKIA_AT[1] + (p2[1] - PALKIA_AT[1]) * pMove + Math.sin(f * 0.045 + 1) * 0.5 * (1 - ramAt(f)), PALKIA_AT[2] + (p2[2] - PALKIA_AT[2]) * pMove];
	const pBox = PALKIA_BOX + (CLASH_BOX * 1.15 - PALKIA_BOX) * pMove;
	const pScale = 0.86 + 0.14 * ease(prog(f, T.palkia, T.palkia + 26));
	// 创造主的金光轮廓（只有一圈模糊的光，不显形）
	const ghost = interpolate(f, [T.l55 - 20, T.l55 + 25, T.dialga2 - 10, T.dialga2 + 25], [0, 1, 1, 0], clamp);
	const pFr = frameOf(v, pP, pBox * 1.7);
	// 帝牙卢卡第二次出来：那个人手里的蓝光飞到左边
	const d2 = prog(f, T.dialga2, T.dialga2 + 22);
	const d2O = interpolate(f, [T.dialga2 + 14, T.dialga2 + 34, T.burst + 6, T.burst + 22], [0, 1, 1, 0], clamp);
	const d2S = toScreen(v, DIALGA2);
	// 帕路奇亚退回裂缝里，只剩一团粉光；回山顶后落进那个人手里
	const pRift = interpolate(f, [T.burst + 20, T.burst + 60, T.l59 + 5, T.l59 + 20], [0, 0.55, 0.55, 0], clamp) * (0.85 + 0.15 * Math.sin(f * 0.12));
	const reiB: V3 = [1.4, 1.5, 20.3];
	const reiBO = interpolate(f, [T.summit - 20, T.summit + 10], [0, 1], clamp);
	const handB = toScreen(v, [reiB[0], reiB[1] + 1.1, reiB[2]]);
	const pc = prog(f, T.l59 + 8, T.l59 + 34);
	const riftC = toScreen(v, RIFT5);
	// 撤退：人们往左边山坡下走
	const retreat = prog(f, T.l57, T.l57 + 120);
	const retreatO = interpolate(f, [T.l57 - 10, T.l57 + 20, T.ball, T.ball + 20], [0, 1, 1, 0], clamp);
	return (
		<>
			<Glow v={v} p={RIFT5} r={340} rgb={PINK} a={warn * 0.8} />
			{/* 帝牙卢卡 / 帕路奇亚身后的光 */}
			<Glow v={v} p={dP} r={DIALGA_BOX * frameOf(v, dP, 1).size * 0.6} rgb={BLUE} a={0.22 * dO * Math.min(1, dB)} />
			<Glow v={v} p={pP} r={pBox * frameOf(v, pP, 1).size * 0.6} rgb={PINK} a={0.24 * pO} />
			{ghost > 0 && !pFr.behind ? (
				<Img
					src={staticFile('pokemon/arceus/art.png')}
					style={{position: 'absolute', left: pFr.x - pFr.size / 2, top: pFr.y - pFr.size / 2, width: pFr.size, height: pFr.size, opacity: 0.42 * ghost, filter: 'brightness(0) invert(0.95) sepia(0.8) saturate(1.8) blur(13px) drop-shadow(0 0 40px rgba(255,215,140,0.6))', mixBlendMode: 'screen'}}
				/>
			) : null}
			<Mon v={v} art={PALKIA_ART} p={pP} box={pBox} o={pO} bright={pB} light={PALKIA_LIGHT} flip={pMove > 0.5} scale={pScale} rot={-leanAt(f)} />
			<Mon v={v} art={DIALGA_ART} p={dP} box={DIALGA_BOX} o={dO} bright={dB} light={DIALGA_LIGHT} />
			<Mon v={v} art={DIALGA_ART} p={dialgaPos(f)} box={CLASH_BOX} o={d2O} bright={interpolate(f, [T.dialga2 + 14, T.dialga2 + 40], [2.5, 1], clamp)} light={DIALGA_LIGHT} rot={leanAt(f)} />
			{/* 收服 / 放出的光 */}
			{streak > 0 && streak < 1 ? <div style={{position: 'absolute', left: sx - 60, top: sy - 60, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,120,110,0.8) 25%, rgba(255,60,60,0) 70%)', mixBlendMode: 'screen'}} /> : null}
			{d2 > 0 && d2 < 1 ? (
				<div style={{position: 'absolute', left: hand.x + (d2S.x - hand.x) * ease(d2) - 70, top: hand.y + (d2S.y - hand.y) * ease(d2) - 70, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(${BLUE},0.85) 25%, rgba(${BLUE},0) 70%)`, mixBlendMode: 'screen'}} />
			) : null}
			<Glow v={v} p={[rei[0], rei[1] + 1.1, rei[2]]} r={60} rgb={RED} a={interpolate(f, [T.end4 + 20, T.l46, T.l52, T.l52 + 10], [0, 0.9, 0.9, 0], clamp) + interpolate(f, [T.caught + 32, T.caught + 36, T.caught + 70], [0, 0.9, 0], clamp)} />

			<Glow v={v} p={RIFT5} r={260} rgb={PINK} a={pRift} />
			{pc > 0 && pc < 1 ? (
				<div style={{position: 'absolute', left: riftC.x + (handB.x - riftC.x) * ease(pc) - 70, top: riftC.y + (handB.y - riftC.y) * ease(pc) - 70, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(${PINK},0.85) 25%, rgba(${PINK},0) 70%)`, mixBlendMode: 'screen'}} />
			) : null}
			<Glow v={v} p={[reiB[0], reiB[1] + 1.1, reiB[2]]} r={70} rgb={PINK} a={reiBO * interpolate(f, [T.l59 + 32, T.l59 + 36, T.l59 + 80], [0, 0.9, 0], clamp)} />
			<TrainerSil v={v} {...REI} foot={reiB} h={1.65} o={reiBO} from="right" rgb="230,200,255" lift={0.12} />
			{/* 人物 */}
			<Glow v={v} p={[ADAMAN[0], ADAMAN[1] + 1.2, ADAMAN[2]]} r={150} rgb={BLUE} a={0.3 * leadO * adamanGlow} />
			<Glow v={v} p={[IRIDA[0], IRIDA[1] + 1.2, IRIDA[2]]} r={150} rgb={PEARL} a={0.3 * leadO * iridaGlow} />
			<TrainerSil v={v} file="trainers/adaman/la.png" aspect={777 / 1600} foot={ADAMAN} h={1.8} o={leadO} from="left" rgb={BLUE} lift={0.1 + 0.06 * adamanGlow} />
			<TrainerSil v={v} file="trainers/irida/la.png" aspect={691 / 1600} foot={IRIDA} h={1.62} o={leadO} from="right" rgb={PEARL} lift={0.1 + 0.06 * iridaGlow} />
			{SQUAD.map(([dx, dz], i) => (
				<Folk key={i} v={v} foot={g(kam[0] + dx, kam[2] + dz)} pose={kw < 1 ? 'walk' : 'stand'} t={(f * 0.035 + i * 0.3) % 1} rimDir={[0, -1]} rimColor="#c8c0ff" rim={0.6} opacity={kamO * 0.9} />
			))}
			<TrainerSil v={v} file="trainers/kamado/la.png" aspect={1117 / 1600} foot={kam} h={1.9} o={kamO} from="left" rgb="200,190,255" lift={0.11} tilt={bow} />
			<TrainerSil v={v} {...REI} foot={rei} h={1.65} o={reiO} from="right" rgb="230,200,255" lift={0.12} />
			{/* 撤退 */}
			{Array.from({length: 7}, (_, i) => {
				const x = -2 - i * 1.6 - retreat * 22;
				const z = 25 + (i % 3) * 1.8 + retreat * 10;
				return <Folk key={i} v={v} foot={g(x, z)} pose="walk" t={(f * 0.05 + i * 0.37) % 1} flip rimDir={[0, -1]} rimColor="#d8c8ff" rim={0.5} opacity={retreatO * 0.85} />;
			})}
		</>
	);
};

// ── 3D：起源球（拉苯的工作台）──
// 照游戏图标：多面切割的红色晶体球，灰色金属箍、正面的扣、顶上一个小盖。锁链碎片（红）和起源矿石（淡紫的晶体）飞来合成。

const BALL = {r: 1};
const BallScene: React.FC<{f: number}> = ({f}) => {
	const mats = useMemo(
		() => ({
			crystal: new THREE.MeshPhysicalMaterial({color: '#c01820', roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, flatShading: true, emissive: new THREE.Color('#3a0204'), emissiveIntensity: 0.5}),
			metal: new THREE.MeshStandardMaterial({color: '#8d9096', roughness: 0.38, metalness: 0.85}),
			dark: new THREE.MeshStandardMaterial({color: '#4b4e55', roughness: 0.5, metalness: 0.7}),
			shard: new THREE.MeshPhysicalMaterial({color: '#e2332e', roughness: 0.2, flatShading: true, emissive: new THREE.Color('#ff2a1a'), emissiveIntensity: 0.9}),
			ore: new THREE.MeshPhysicalMaterial({color: '#c9b8ff', roughness: 0.15, transmission: 0.3, thickness: 0.5, flatShading: true, emissive: new THREE.Color('#7a5cff'), emissiveIntensity: 0.8}),
			wood: new THREE.MeshStandardMaterial({color: '#1e130b', roughness: 0.9}),
		}),
		[],
	);
	const geos = useMemo(() => {
		const crystal = new THREE.IcosahedronGeometry(BALL.r, 1);
		const shard = new THREE.TetrahedronGeometry(0.16, 0);
		const ore = new THREE.OctahedronGeometry(0.5, 0);
		ore.scale(0.7, 1.3, 0.7);
		return {crystal, shard, ore};
	}, []);
	const form = ease(prog(f, T.l58 + 20, T.l58 + 75));
	const done = prog(f, T.l58 + 70, T.l58 + 80);
	const spin = (f - T.l58) * 0.008;
	const pulse = interpolate(f, [T.l58 + 74, T.l58 + 80, T.l58 + 120], [0, 1, 0], clamp);
	const shards = Array.from({length: 14}, (_, i) => {
		const a = rnd(i * 2.1) * Math.PI * 2;
		const r0 = 2.6 + rnd(i * 3.7) * 1.6;
		const k = 1 - form;
		const ang = a + form * 3;
		return {p: [Math.cos(ang) * r0 * k - 0.9 * k, Math.sin(a * 1.7) * 1.2 * k + 0.1, Math.sin(ang) * r0 * k * 0.6] as V3, r: [i + f * 0.05, i * 2 + f * 0.04, 0] as V3};
	});
	const orePos: V3 = [2.4 * (1 - form), 0.3 * (1 - form), 0];
	return (
		<ThreeCanvas width={1920} height={1080} gl={{antialias: true}}>
			<CameraRig pos={[0.4, 1.3, 7.4]} target={[0, 0.05, 0]} fov={32} />
			<Env intensity={0.6} />
			<ambientLight intensity={0.25} color="#ffcf9e" />
			<pointLight position={[-3.5, 1.2, 2]} intensity={22} distance={12} decay={2} color="#ff9a4a" />
			<pointLight position={[2.8, 2.6, 2]} intensity={18} distance={12} decay={2} color="#c9b8ff" />
			<directionalLight position={[0, 4, 3]} intensity={0.9} color="#fff1e0" />
			{pulse > 0 ? <pointLight position={[0, 0.2, 1.4]} intensity={40 * pulse} distance={6} decay={2} color="#ff5a4a" /> : null}
			{/* 工作台 */}
			<mesh position={[0, -1.35, 0]} material={mats.wood}>
				<boxGeometry args={[14, 0.3, 6]} />
			</mesh>
			{done < 1
				? shards.map((s, i) => (
						<mesh key={i} geometry={geos.shard} material={mats.shard} position={s.p} rotation={s.r} scale={1 - done} />
					))
				: null}
			{done < 1 ? <mesh geometry={geos.ore} material={mats.ore} position={orePos} rotation={[0.2, f * 0.03, 0.1]} scale={1 - done} /> : null}
			{done > 0 ? (
				<group rotation={[0.18, -0.35 + spin, 0]} scale={0.6 + 0.4 * ease(done)}>
					<mesh geometry={geos.crystal} material={mats.crystal} />
					<mesh material={mats.metal} rotation={[Math.PI / 2, 0, 0]}>
						<torusGeometry args={[BALL.r * 0.9, 0.11, 12, 64]} />
					</mesh>
					{/* 正面的扣 */}
					<mesh material={mats.metal} position={[0, 0, BALL.r * 0.93]} rotation={[Math.PI / 2, 0, 0]}>
						<cylinderGeometry args={[0.36, 0.36, 0.14, 40]} />
					</mesh>
					<mesh material={mats.dark} position={[0, 0, BALL.r * 1.0]} rotation={[Math.PI / 2, 0, 0]}>
						<cylinderGeometry args={[0.26, 0.26, 0.06, 40]} />
					</mesh>
					<mesh material={mats.metal} position={[0, 0, BALL.r * 1.04]}>
						<boxGeometry args={[0.12, 0.3, 0.06]} />
					</mesh>
					{/* 顶上的小盖 */}
					<mesh material={mats.dark} position={[0, BALL.r * 0.9, 0]}>
						<cylinderGeometry args={[0.2, 0.24, 0.12, 24]} />
					</mesh>
				</group>
			) : null}
		</ThreeCanvas>
	);
};

const BallShot: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.ball, T.ball + 30, T.summit - 10, T.summit + 15], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const flick = 0.85 + 0.15 * Math.sin(f * 0.57) * Math.sin(f * 0.19 + 1);
	return (
		<AbsoluteFill style={{opacity: o, background: '#0d0805'}}>
			<div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 70% at 22% 60%, rgba(255,140,60,${0.28 * flick}) 0%, rgba(120,50,20,0.12) 40%, rgba(0,0,0,0) 75%)`}} />
			{/* 拉苯：在火光里俯身看 */}
			<ScreenSil file="trainers/laventon/la.png" aspect={717 / 1600} x={1560} y={560} h={980} rgb="255,170,90" lift={0.09} from="left" o={0.9} />
			<BallScene f={f} />
			<Flame x={170} y={1010} size={260} f={f} seed={5} opacity={0.5} glow={1.2} />
		</AbsoluteFill>
	);
};

// ── 2D：图鉴两页 ──

const DexPage: React.FC<{f: number; x: number; art: string; no: string; zh: string; en: string; rgb: string; flip?: boolean; delay: number}> = ({f, x, art, no, zh, en, rgb, flip, delay}) => {
	const a = interpolate(f, [T.l60 + delay, T.l60 + delay + 30], [0, 1], clamp);
	return (
		<div style={{position: 'absolute', left: x, top: 90, width: 640, height: 660, overflow: 'hidden'}}>
			<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #e9dcc0 0%, #dfcfae 100%)', boxShadow: 'inset 0 0 80px rgba(110,80,40,0.35)'}} />
			<div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(120,90,50,0.08) 0px, rgba(120,90,50,0.08) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 44px)'}} />
			<Img
				src={staticFile(art)}
				style={{position: 'absolute', left: 100, top: 40, width: 440, height: 440, opacity: a, transform: flip ? 'scaleX(-1)' : undefined, filter: 'grayscale(1) sepia(0.55) contrast(1.35) brightness(1.02)', mixBlendMode: 'multiply'}}
			/>
			<div style={{position: 'absolute', left: 0, right: 0, top: 498, textAlign: 'center', opacity: a, fontFamily: CINZEL, fontSize: 22, letterSpacing: 6, color: 'rgba(70,48,24,0.8)'}}>{no}</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 530, textAlign: 'center', opacity: a, fontFamily: SERIF, fontWeight: 700, fontSize: 46, letterSpacing: 10, paddingLeft: 10, color: '#3a2614'}}>{zh}</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 596, textAlign: 'center', opacity: a, fontFamily: CINZEL, fontSize: 18, letterSpacing: 5, color: 'rgba(70,48,24,0.7)'}}>{en}</div>
			<div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 70% at 50% 45%, rgba(${rgb},0.16) 0%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
		</div>
	);
};

const DexShot: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.dex, T.dex + 30, T.cogita, T.cogita + 30], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const meet = ease(prog(f, T.l60 + 60, T.l60 + 150));
	const push = 1 + 0.04 * prog(f, T.dex, T.cogita + 30);
	return (
		<AbsoluteFill style={{opacity: o, background: '#0b0a10', overflow: 'hidden'}}>
			<div style={{position: 'absolute', inset: 0, transform: `scale(${push})`}}>
				<DexPage f={f} x={318} art="pokemon/dialga/art.png" no="No.0483" zh="帝牙卢卡" en="DIALGA" rgb={BLUE} delay={0} />
				<DexPage f={f} x={962} art="pokemon/palkia/art-origin.png" no="No.0484" zh="帕路奇亚" en="PALKIA" rgb={PINK} delay={14} />
				<div style={{position: 'absolute', left: 952, top: 90, width: 16, height: 660, background: 'linear-gradient(90deg, rgba(60,40,20,0.5), rgba(0,0,0,0.15), rgba(60,40,20,0.5))'}} />
				{/* 两种光：从两边往中缝靠，叠成白光 */}
				<div style={{position: 'absolute', left: 200 + 560 * meet, top: 70, width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, rgba(${BLUE},0.4) 0%, rgba(${BLUE},0.12) 40%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen', transform: 'translateX(-350px)'}} />
				<div style={{position: 'absolute', left: 1720 - 560 * meet, top: 70, width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, rgba(${PINK},0.4) 0%, rgba(${PINK},0.12) 40%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen', transform: 'translateX(-350px)'}} />
				<div style={{position: 'absolute', left: 960 - 300, top: 120, width: 600, height: 600, borderRadius: '50%', opacity: meet, background: 'radial-gradient(circle, rgba(255,250,245,0.35) 0%, rgba(240,230,255,0.12) 40%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			</div>
		</AbsoluteFill>
	);
};

// ── 2D：吾思的小屋外，夜空里两道光的上方亮起一点金光 ──

const PINES_FAR = pines(41, 30, 760, 110, 210);
const PINES_NEAR = pines(57, 8, 1000, 420, 680);
const STARS = Array.from({length: 220}, (_, i) => ({x: rnd(i * 1.9) * 1920, y: rnd(i * 2.3) * 700, r: 0.6 + rnd(i * 4.4) * 1.5, tw: rnd(i * 6.6) * 6}));

/** noSky：不画天上的三点光（第 6 段仰镜头时由天空层接着画） */
export const CogitaShot: React.FC<{f: number; noSky?: boolean}> = ({f, noSky}) => {
	const o = interpolate(f, [T.cogita, T.cogita + 30], [0, 1], clamp);
	if (o <= 0) return null;
	const gold = interpolate(f, [T.l61 + 95, T.l61 + 150, T.end5], [0, 0.9, 1], clamp);
	const twin = 1 - 0.55 * prog(f, T.l62, T.end5);
	const rise = ease(prog(f, T.cogita, T.end5));
	const star = (x: number, y: number, rgb: string, a: number, r: number) => (
		<div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', opacity: a, background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(${rgb},0.85) 10%, rgba(${rgb},0.22) 32%, rgba(${rgb},0) 70%)`, mixBlendMode: 'screen'}} />
	);
	return (
		<AbsoluteFill style={{opacity: o, overflow: 'hidden'}}>
			<div style={{position: 'absolute', inset: 0, transform: `translateY(${-30 * rise}px) scale(${1.03 + 0.03 * rise})`}}>
				<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #050816 0%, #0d1430 45%, #1f2a4a 72%, #11172a 100%)'}} />
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					{STARS.map((s, i) => (
						<circle key={i} cx={s.x} cy={s.y} r={s.r} fill="rgba(230,236,255,0.85)" opacity={0.5 + 0.5 * Math.sin(f * 0.05 + s.tw)} />
					))}
					<defs>
						<linearGradient id="cgSnow" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="#5d6888" />
							<stop offset="1" stopColor="#2a3150" />
						</linearGradient>
					</defs>
					{/* 远处的天冠山：山尖上一点点断柱 */}
					<path d="M0,700 L260,640 L520,560 L700,470 L800,330 L845,300 L880,318 L940,410 L1120,540 L1400,610 L1700,660 L1920,650 L1920,780 L0,780 Z" fill="#141a33" />
					<path d="M800,330 L845,300 L880,318 L860,330 L845,322 L826,336 Z" fill="rgba(170,180,215,0.35)" />
					{[822, 832, 842, 852, 864].map((x, i) => (
						<rect key={x} x={x} y={300 - (i % 2 ? 6 : 10) - (i === 2 ? 4 : 0)} width={3} height={i % 2 ? 6 : 10} fill="rgba(170,180,215,0.45)" />
					))}
					<path d={PINES_FAR} fill="#0c1124" />
					<rect x={0} y={758} width={1920} height={330} fill="url(#cgSnow)" />
					<path d={PINES_NEAR} fill="#05070f" />
				</svg>
				{noSky ? null : star(735, 215, BLUE, 0.85 * twin, 100)}
				{noSky ? null : star(965, 225, PINK, 0.85 * twin, 100)}
				{noSky ? null : star(850, 70, '255,214,140', gold, 70 + 150 * gold)}
				<ScreenSil file="trainers/cogita/la.png" aspect={683 / 1600} x={1420} y={1080 - 280} h={600} rgb="200,210,255" lift={0.1} from="left" />
				<Snowfall f={f} o={0.6} />
			</div>
		</AbsoluteFill>
	);
};

// ── 合在一起 ──

export const GodsMaster: React.FC<{f: number}> = ({f}) => {
	const in3D = f < T.ball + 35 || (f >= T.summit - 25 && f < T.dex + 35);
	const v = viewAt(f);
	// 开头：云雾遗迹的画面往下沉、淡出，像镜头从雾里升上去
	const up = prog(f, T.end4, T.end4 + 85);
	const fl = flashOf(f);
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			{in3D ? <TempleWorld f={f} v={v} /> : null}
			{in3D ? <TempleLayers f={f} v={v} /> : null}
			{in3D ? <ChainLayer f={f} v={v} /> : null}
			{in3D ? <ImpactLayer f={f} v={v} /> : null}
			{in3D ? <ClashLayer f={f} v={v} /> : null}
			{in3D ? <DustLayer f={f} v={v} /> : null}
			{up < 1 ? (
				<AbsoluteFill style={{opacity: 1 - ease(up), transform: `translateY(${ease(up) * 420}px) scale(${1 + 0.12 * ease(up)})`}}>
					<Ruins2D f={f} />
				</AbsoluteFill>
			) : null}
			<BallShot f={f} />
			<DexShot f={f} />
			<CogitaShot f={f} />
			{fl.v > 0.003 ? <AbsoluteFill style={{background: `rgba(${fl.rgb},${fl.v})`, mixBlendMode: 'screen', pointerEvents: 'none'}} /> : null}
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.52) 100%)', pointerEvents: 'none'}} />
			<NameTag from={T.dialgaPeak + 4} x={150} y={560} no="No.0483" zh="帝牙卢卡" en="DIALGA" category="时间宝可梦" categoryEn="Temporal Pokémon" opacity={interpolate(f, [T.l51 + 80, T.l51 + 110], [1, 0], clamp)} />
			<NameTag from={T.palkiaPeak + 4} x={1770} y={560} align="right" no="No.0484" zh="帕路奇亚" en="PALKIA" category="空间宝可梦" categoryEn="Spatial Pokémon" opacity={interpolate(f, [T.l55 - 10, T.l55 + 20], [1, 0], clamp)} />
			<FormLine f={f} />
			{SUBS_GODS.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			<Cry name="dialga" at={T.dialgaPeak} />
			<Cry name="palkia-origin" at={T.palkiaPeak} />
			<Cry name="dialga" at={T.burst - 16} volume={0.75} />
			<Cry name="palkia-origin" at={T.burst - 10} volume={0.75} />
			<Grain opacity={0.11} />
		</AbsoluteFill>
	);
};

/** 帕路奇亚名称卡下面一行：起源形态 */
const FormLine: React.FC<{f: number}> = ({f}) => {
	const a = interpolate(f, [T.palkiaPeak + 40, T.palkiaPeak + 60], [0, 1], clamp) * interpolate(f, [T.l55 - 10, T.l55 + 20], [1, 0], clamp);
	if (a <= 0) return null;
	return (
		<div style={{position: 'absolute', right: 150, top: 560 + 205, opacity: a, textAlign: 'right', whiteSpace: 'nowrap'}}>
			<span style={{fontFamily: SERIF, fontSize: 24, letterSpacing: 8, color: 'rgba(240,214,150,0.9)'}}>起源形态</span>
			<span style={{fontFamily: CINZEL, fontSize: 16, letterSpacing: 5, marginLeft: 14, color: 'rgba(240,214,150,0.65)'}}>ORIGIN FORME</span>
		</div>
	);
};

export const SUBS_GODS: [number, number, string, string, SubtitleSource?][] = [
	[T.l46, T.l46 + 112, '带着红色锁链，你登上了天冠山顶的神殿。', 'Red Chain in hand, you climbed to the temple atop Mount Coronet.'],
	[T.l47, T.l47 + 120, '马加木也带着人上了山，要讨伐裂缝里出来的东西。', 'Kamado marched up the mountain too, to strike down whatever came out of the rift.'],
	[T.l48, T.l48 + 145, '他输给了被自己赶走的你，当着刚石和珠贝的面低头认错。', 'He lost to you, the very one he had cast out, and bowed in apology before Adaman and Irida.'],
	[T.l49, T.l49 + 120, '两位首领也来了。今天，他们要亲眼看看自己信的神。', 'The two clan leaders had come as well. Today, they would see their gods with their own eyes.'],
	[T.l50, T.l50 + 115, '裂缝终于失去平衡，一只宝可梦从里面降了下来。', 'At last the rift lost its balance, and a Pokémon descended from within.'],
	[T.l51, T.l51 + 115, '先来的是哪一只，取决于你和哪位首领同行。', 'Which one came first depended on which leader you walked with.'],
	[T.l52, T.l52 + 100, '红色锁链缠了上去，却被它挣成了碎片。', 'The Red Chain bound it—and shattered to pieces.'],
	[T.l53, T.l53 + 125, '你还是收服了它。可它像是在警告：还有另一只。', 'Still, you caught it. But it seemed to give a warning: there was another.'],
	[T.l54, T.l54 + 112, '另一只冲出了裂缝，变成了谁都没见过的样子。', 'The other burst from the rift, in a form no one had ever seen.'],
	[T.l56, T.l56 + 130, '两股力量在神殿上撞在一起，屋顶炸开，石像碎了一地。', 'Two powers collided over the temple. The roof burst apart, and the statues fell to pieces.'],
	[T.l57, T.summit - 12, '锁链碎了，众人只能撤下山，用锁链的碎片做出了一种新的球：起源球。', 'The chain was broken, and all retreated. From its fragments came a new kind of ball: the Origin Ball.'],
	[T.l59, T.l59 + 112, '回到山顶，你收服了第二只，裂缝合上了。', 'Back at the summit, you caught the second, and the rift closed.'],
	[T.l60, T.l60 + 165, '两只宝可梦都被记进了图鉴。金刚队和珍珠队终于承认，对方信的也是真的。', "Both Pokémon were recorded in the Pokédex. At last, each clan admitted the other's god was real."],
	[T.l61, T.l61 + 150, '可吾思后来说了一句更让人吃惊的话：「它们俩，都不是神奥大尊。」', 'But Cogita later said something more startling still: "Neither of them was almighty Sinnoh."'],
	[T.l62, T.l62 + 110, '两个部族争了几代人的神，原来都认错了。', 'For generations the two clans had fought over their gods—and both had been mistaken.'],
];
