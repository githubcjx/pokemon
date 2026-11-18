import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {SubtitleSource} from '../../components/BiSubtitle';
import {Flame} from '../../components/unown/Silhouette';
import {SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {
	BALL,
	Camp,
	CAMP_D,
	CAMP_P,
	campTents,
	coastHeight,
	coastLook,
	CoastLights,
	CoastTerrain,
	Forest,
	GATE,
	LANDING,
	PokeBall,
	Sea,
	shoreZ,
	Ship,
	SUMMIT,
	Village,
	VILLAGE,
} from '../../three/hisui/coast';
import {Sky} from '../../three/hisui/coronet';
import {Temple} from '../../three/hisui/temple';
import {CameraRig, V3} from '../../three/stage';
import {flow, prog, T, track} from './common';
import {Folk, Glow, toScreen, View} from './Overlays';

// ─── 第 2 段「两个神」：洗翠的海岸（场景见 three/hisui/coast.tsx）────────────────

// ── 镜头（海岸的坐标）──

/** 对峙的地方：两个营地之间的雪原，镜头朝东北望，远处是天冠山 */
const FEUD_CAM: V3 = [-25, 2.4, -30];
const FEUD_F = (() => {
	const dx = SUMMIT[0] - FEUD_CAM[0];
	const dz = SUMMIT[2] - FEUD_CAM[2];
	const l = Math.hypot(dx, dz);
	return [dx / l, dz / l] as const;
})();
const FEUD_R = [-FEUD_F[1], FEUD_F[0]] as const; // 画面右方
const FEUD_M: V3 = [FEUD_CAM[0] + FEUD_F[0] * 12, 0, FEUD_CAM[2] + FEUD_F[1] * 12];
const FEUD_LOOK: V3 = [FEUD_CAM[0] + FEUD_F[0] * 100, 8, FEUD_CAM[2] + FEUD_F[1] * 100];

/** 马加木站在海滩上，望着海那边（故乡的方向） */
const KAMADO: V3 = [36, coastHeight(36, -10), -10];
/** 马加木望去的方向：东南的海面 */
const SEAWARD: V3 = [92, 3, 16];

const CAM2: [number, number[]][] = [
	// 云里：慢慢降到云底，看见晨光里的海和船
	[T.swap2, [-10, 190, 330, -20, 30, 0, 40]],
	[T.clear, [-18, 110, 210, -30, 0, -10, 40]],
	[T.land - 5, [-28, 34, 80, -32, 2, -20, 42]],
	// 升高：两队灯火分开
	[T.l14 + 5, [-20, 100, 90, -15, 0, -110, 46]],
	// 金刚队 → 珍珠队
	[T.l15 - 15, [-62, 58, -30, CAMP_D[0], CAMP_D[1] + 8, CAMP_D[2], 42]],
	[T.l17 - 75, [60, 58, -45, CAMP_P[0], CAMP_P[1] + 8, CAMP_P[2], 42]],
	// 两边一起看：口头禅
	[T.l17 + 30, [0, 60, 10, 0, 14, -160, 52]],
	[T.l18 - 20, [0, 50, -8, 0, 14, -165, 50]],
	// 降到地面：对峙
	[T.l19 - 40, [FEUD_CAM[0] - 1.5, FEUD_CAM[1] + 0.3, FEUD_CAM[2] + 2.5, FEUD_LOOK[0], FEUD_LOOK[1], FEUD_LOOK[2], 44]],
	[T.l19 + 5, [...FEUD_CAM, FEUD_LOOK[0], FEUD_LOOK[1] + 0.5, FEUD_LOOK[2], 44]],
	// 抬头、拉近：远处山顶的神殿
	[T.l19 + 90, [FEUD_CAM[0] + 0.5, FEUD_CAM[1] + 0.8, FEUD_CAM[2] - 1.5, SUMMIT[0], SUMMIT[1] + 7, SUMMIT[2], 9]],
	// 升起、向右转到东南的海岸：第三群人的船从各个方向驶来
	[T.l21 + 10, [-20, 40, -40, 60, 0, 10, 44]],
	// 降到马加木身后，和他一起望着海
	[T.l22 + 10, [24, 3.3, -19, SEAWARD[0], SEAWARD[1], SEAWARD[2], 40]],
	[T.l23, [23.4, 3.35, -19.4, SEAWARD[0], SEAWARD[1] + 0.3, SEAWARD[2], 40]],
	// 转向左边：村子立起来；推向西门门柱上的精灵球
	[T.vbuilt - 25, [33, 5.2, -27, GATE[0], GATE[1] + 3.5, GATE[2], 40]],
	[T.l24 - 15, [BALL[0] - 1.9, BALL[1] + 0.32, BALL[2] + 1.3, BALL[0], BALL[1], BALL[2], 32]],
	// 拉远、升高：夜里三处灯火
	[T.l24 + 35, [BALL[0] - 8, BALL[1] + 2.4, BALL[2] + 4.5, BALL[0], BALL[1] - 1, BALL[2], 38]],
	[T.end2 - 30, [-12, 110, 62, 0, 0, -108, 48]],
	[T.end2, [-12.5, 114, 66, 0, 0, -109, 48]],
];

// ── 天光：晨 → 白天 → 黄昏（营地）→ 蓝调 → 对峙时日夜轮换 → 夜（山顶）→ 黎明（第三群人）→ 白天（建村）→ 夜 ──
export const coastDusk = (f: number) =>
	track(f, [
		[T.swap2, 1],
		[T.l14, 1],
		[T.l15, 0.9],
		[T.l17 - 20, 1],
		[T.l17 + 60, 0.6],
		[T.l18 + 120, 0.45],
		[T.l19 + 40, 0],
		[T.l19 + 110, 0],
		[T.l20 + 80, 1],
		[T.l21 + 40, 0.85],
		[T.l22 + 40, 0.6],
		[T.vbuild, 0.75],
		[T.l24, 0.3],
		[T.end2 - 40, 0],
	]);
export const coastDay = (f: number) => {
	const base = track(f, [
		[T.swap2, 0],
		[T.l13 + 40, 0.15],
		[T.l14 + 40, 0.4],
		[T.l15 + 60, 0.3],
		[T.l17 - 20, 0],
		[T.vbuild - 10, 0],
		[T.vbuild + 40, 0.4],
		[T.l24 - 10, 0.3],
		[T.l24 + 80, 0],
	]);
	// 对峙：日夜轮换两次（一代传一代）
	const w = prog(f, T.l18, T.l18 + 20) * (1 - prog(f, T.l19 - 30, T.l19));
	const cyc = Math.max(0, Math.sin(((f - T.l18) / 70) * Math.PI));
	return base + 0.45 * w * cyc;
};

// ── 船：部族的船（晨）和第三群人的船（各个方向来）──

type Voyage = {from: V3; to: V3; t0: number; t1: number; seed: number};
const CLAN_SHIPS: Voyage[] = [-1, 0, 1, 2].map((k) => ({
	from: [LANDING[0] + k * 22 - 10, 0, 300 + Math.abs(k) * 30],
	to: [LANDING[0] + k * 9 - 4, 0, LANDING[2] + 9 + Math.abs(k - 0.5) * 5],
	t0: T.rise,
	t1: T.land + k * 8,
	seed: k + 2,
}));
const V_LAND: V3 = [VILLAGE[0] - 6, 0, shoreZ(VILLAGE[0] - 6) + 24];
/** 第三群人：从南、东南、东边沿海各个方向来（角度从正南往东量） */
const NEW_SHIPS: Voyage[] = [12, 34, 55, 72, 86].map((deg, k) => {
	const a = (deg * Math.PI) / 180;
	return {
		from: [V_LAND[0] + Math.sin(a) * 320, 0, V_LAND[2] + Math.cos(a) * 320],
		to: [V_LAND[0] + (k - 2) * 12, 0, V_LAND[2] + 8 + (k % 2) * 7],
		t0: T.ships2 - 60,
		t1: T.l22 + k * 14,
		seed: k * 3 + 1,
	};
});
const voyageAt = (v: Voyage, f: number) => {
	const t = 1 - Math.pow(1 - prog(f, v.t0, v.t1), 2.2);
	const p: V3 = [v.from[0] + (v.to[0] - v.from[0]) * t, 0, v.from[2] + (v.to[2] - v.from[2]) * t];
	const heading = Math.atan2(-(v.to[0] - v.from[0]), -(v.to[2] - v.from[2]));
	return {p, heading};
};

const TENTS_D = campTents(CAMP_D, 41);
const TENTS_P = campTents(CAMP_P, 57);

/** 3D 场景 */
/** 第 3 段起由外面传入的天光与裂缝 */
export type CoastEnv = {dusk: number; day: number; red: number; rift: number; canopy: number; riftDir: V3; flash: number; gate: number};

/** ruined：山顶的神殿已经塌了（第 9 段） */
export const CoastWorld: React.FC<{f: number; view: View; env?: CoastEnv; ruined?: boolean}> = ({f, view, env, ruined}) => {
	const dusk = env ? env.dusk : coastDusk(f);
	const day = env ? env.day : coastDay(f);
	const red = env?.red ?? 0;
	const look = coastLook(dusk, day, red);
	const time = f / 30;
	const campGrow = prog(f, T.l14 - 40, T.l15);
	const fogFar = 1500;
	// 山顶神殿里的暖光：古人的心已不在，光慢慢熄灭（第 19 句）
	const templeLight = 2600 * interpolate(f, [T.l19 - 30, T.l19 + 20, T.l19 + 80, T.l20 + 10], [0, 1, 1, 0], clamp);
	return (
		<ThreeCanvas width={1920} height={1080} gl={{antialias: true}}>
			<CameraRig pos={view.pos} target={view.target} fov={view.fov} far={2000} />
			<CoastLights dusk={dusk} day={day} red={red} flash={env?.flash ?? 0} fogNear={200} fogFar={fogFar} />
			<Sky cam={view.pos} s={{dusk, day, red, time: f / 30, rift: env?.rift ?? 0, canopy: env?.canopy ?? 0, riftDir: env?.riftDir, starRot: f * 0.0006, trail: 0, gold: 0}} />
			<CoastTerrain />
			<Forest />
			<Sea time={time} cam={view.pos} deep={look.deep} sky={look.sky} sunDir={look.sunDir} sunCol={look.sunCol} fog={look.fog} fogFar={fogFar} />
			{f < T.l14 + 60
				? CLAN_SHIPS.map((v, i) => {
						const s = voyageAt(v, f);
						return <Ship key={i} p={s.p} heading={s.heading} time={time} seed={v.seed} />;
					})
				: null}
			{f > T.l19
				? NEW_SHIPS.map((v, i) => {
						const s = voyageAt(v, f);
						return <Ship key={i} p={s.p} heading={s.heading} time={time} seed={v.seed} scale={1.15} />;
					})
				: null}
			<Camp tents={TENTS_D} color="#26407e" trim="#c9a24a" grow={campGrow} />
			<Camp tents={TENTS_P} color="#ece4e6" trim="#dba3bd" grow={campGrow} />
			<group position={[SUMMIT[0], SUMMIT[1] - 1.5, SUMMIT[2]]} rotation={[0, -0.6, 0]}>
				{ruined ? <Temple ruin={0.25} build={1} blast={1} early={1} /> : <Temple ruin={0} build={1} />}
			</group>
			{templeLight > 0 ? <pointLight position={[SUMMIT[0], SUMMIT[1] + 9, SUMMIT[2] + 4]} intensity={templeLight} distance={0} decay={2} color="#ffc878" /> : null}
			<Village build={prog(f, T.vbuild, T.vbuilt)} gate={env?.gate ?? 0} />
			{f > T.vbuild ? <PokeBall p={BALL} ry={-0.35} /> : null}
		</ThreeCanvas>
	);
};

export const coastView = (f: number): View => {
	const c = flow(f, CAM2);
	return {pos: [c[0], c[1], c[2]], target: [c[3], c[4], c[5]], fov: c[6]};
};

// ── 2D 层 ──

/** 云海涨上来、吞没镜头，再在海岸上空散开（全屏云雾） */
const CLOUD_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDensity;
uniform float uRise;
uniform vec3 uLight;
uniform vec3 uShade;
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
	vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y) * 2.2;
	// 两层云：近的大而快，远的细而慢；整体随 uRise 往上掠过
	float n1 = fbm(p * 0.8 + vec2(uTime * 0.03, -uRise * 1.6));
	float n2 = fbm(p * 1.7 + vec2(-uTime * 0.02, -uRise * 0.9) + 7.0);
	float n = n1 * 0.62 + n2 * 0.38;
	// 稀薄时只在画面下方，浓时铺满
	float edge = mix(-0.45, 1.2, uDensity) - (1.0 - uv.y) * 0.0 + (uv.y - 0.5) * (1.0 - uDensity) * -1.2;
	float a = smoothstep(0.32, 0.62, n + edge * 0.6) * smoothstep(0.0, 0.25, uDensity);
	a = max(a, smoothstep(0.75, 1.0, uDensity));
	vec3 col = mix(uShade, uLight, smoothstep(0.35, 0.8, n));
	outColor = vec4(col * a, a);
}`;

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

export const CloudPass: React.FC<{f: number}> = ({f}) => {
	const density = track(f, [
		[T.rise + 40, 0],
		[T.swap2 - 12, 1],
		[T.swap2 + 12, 1],
		[T.clear, 0],
	]);
	if (density <= 0.001) return null;
	const warm = prog(f, T.swap2, T.clear);
	const light = warm > 0 ? '#e9d4d0' : '#8e9ab0';
	const shade = warm > 0 ? '#9a8496' : '#39424f';
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<ShaderCanvas
				frag={CLOUD_FRAG}
				width={1920}
				height={1080}
				scale={0.5}
				uniforms={{
					uTime: f / 30,
					uDensity: density,
					uRise: (f - T.rise) / 30,
					uLight: hex(light),
					uShade: hex(shade),
				}}
				style={{position: 'absolute', inset: 0}}
			/>
		</AbsoluteFill>
	);
};

/** 有官方形象的人物：官方立绘压暗去饱和，侧面一层弱光 + 一圈细轮廓光（同《敬畏》的 TrainerSilhouette），脚底对齐 3D 点 */
export const TrainerSil: React.FC<{
	v: View;
	file: string;
	aspect: number;
	foot: V3;
	h: number;
	o: number;
	from: 'left' | 'right';
	rgb: string;
	lift?: number;
	/** 绕脚底前倾的角度（度），如低头认错 */
	tilt?: number;
}> = ({v, file, aspect, foot, h, o, from, rgb, lift = 0.14, tilt = 0}) => {
	if (o <= 0.001) return null;
	const p = toScreen(v, foot);
	if (p.behind) return null;
	const hp = h * p.s;
	const w = hp * aspect;
	const url = `url(${staticFile(file)})`;
	const dx = from === 'left' ? -2 : 2;
	return (
		<div
			style={{
				position: 'absolute',
				left: p.x - w / 2,
				top: p.y - hp,
				width: w,
				height: hp,
				opacity: o,
				transform: tilt ? `rotate(${tilt}deg)` : undefined,
				transformOrigin: '50% 100%',
			}}
		>
			<Img
				src={staticFile(file)}
				style={{
					position: 'absolute',
					inset: 0,
					width: w,
					height: hp,
					filter: `brightness(${lift}) saturate(0.18) contrast(1.15) drop-shadow(${dx}px -1px 1.5px rgba(${rgb},0.55)) drop-shadow(0 0 14px rgba(0,0,0,0.65))`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					WebkitMaskImage: url,
					WebkitMaskSize: '100% 100%',
					maskImage: url,
					maskSize: '100% 100%',
					mixBlendMode: 'screen',
					background: `linear-gradient(${from === 'left' ? 100 : 260}deg, rgba(${rgb},${0.2 + lift * 0.5}) 0%, rgba(${rgb},0.06) 32%, rgba(0,0,0,0) 58%), linear-gradient(180deg, rgba(${rgb},0.05) 0%, rgba(0,0,0,0) 40%)`,
				}}
			/>
		</div>
	);
};

const BLUE = '120,160,255';
const PEARL = '255,214,232';
const WARM = '255,172,96';

/** 二次贝塞尔：从靠岸处分往营地的路 */
const bez = (a: V3, c: V3, b: V3, t: number): V3 => {
	const u = 1 - t;
	const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
	const z = u * u * a[2] + 2 * u * t * c[2] + t * t * b[2];
	return [x, coastHeight(x, z) + 1.4, z];
};
const ROUTE_D: [V3, V3, V3] = [LANDING, [-60, 0, -40], CAMP_D];
const ROUTE_P: [V3, V3, V3] = [LANDING, [30, 0, -60], CAMP_P];
const LANTERNS = 16;

/** 一盏盏灯从靠岸处走出来，在雪原上分成两路 */
const Lanterns: React.FC<{f: number; v: View}> = ({f, v}) => {
	const out: React.ReactNode[] = [];
	const fade = 1 - prog(f, T.l17 - 90, T.l17 - 40);
	if (fade <= 0) return null;
	for (const [k, route, rgb] of [
		[0, ROUTE_D, BLUE],
		[1, ROUTE_P, PEARL],
	] as const) {
		for (let i = 0; i < LANTERNS; i++) {
			const t0 = T.land + 6 + i * 7 + k * 3;
			const s = Math.min(1, Math.max(0, (f - t0) / 230));
			if (s <= 0) continue;
			const ease = 1 - Math.pow(1 - s, 1.6);
			const p = bez(route[0], route[1], route[2], ease * (1 - i * 0.012));
			const tint = prog(s, 0.08, 0.3);
			const a = Math.min(1, s * 12) * fade * (0.55 + 0.25 * Math.sin(f * 0.3 + i * 2.1));
			out.push(<Glow key={`${k}-${i}`} v={v} p={p} r={10 + 4 * (1 - s)} rgb={tint > 0.5 ? rgb : '255,226,180'} a={a} />);
		}
	}
	return <>{out}</>;
};

/** "神阖"两个字：在靠岸处浮起，随两路人分成两份，一蓝一白 */
const ClaimWord: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.l13, T.l13 + 25, T.l14 - 10, T.l14 + 20], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	const split = prog(f, T.land + 10, T.l14);
	const e = split * split * (3 - 2 * split);
	const word = (rgb: string, t: number, key: string, op: number) => {
		const p = bez(key === 'd' ? ROUTE_D[0] : ROUTE_P[0], key === 'd' ? ROUTE_D[1] : ROUTE_P[1], key === 'd' ? ROUTE_D[2] : ROUTE_P[2], t * 0.6);
		const s = toScreen(v, [p[0], p[1] + 22, p[2]]);
		if (s.behind) return null;
		return (
			<div
				key={key}
				style={{
					position: 'absolute',
					left: s.x - 140,
					top: s.y - 50,
					width: 280,
					textAlign: 'center',
					fontFamily: SERIF,
					fontWeight: 700,
					fontSize: 64,
					letterSpacing: 14,
					color: `rgba(${rgb},${0.92 * op})`,
					textShadow: `0 0 18px rgba(${rgb},${0.7 * op}), 0 0 50px rgba(${rgb},${0.4 * op})`,
				}}
			>
				神阖
			</div>
		);
	};
	const gold = '255,222,150';
	return (
		<div style={{position: 'absolute', inset: 0, opacity: a}}>
			{e < 0.02 ? word(gold, 0, 'd', 1) : null}
			{e >= 0.02 ? word(e > 0.4 ? BLUE : gold, e, 'd', 1) : null}
			{e >= 0.02 ? word(e > 0.4 ? PEARL : gold, e, 'p', 1) : null}
		</div>
	);
};

/** 金刚队：营地上空的时间之环（刻度 + 转动的指针） */
const TimeDial: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.l14 + 15, T.l14 + 50, T.l15 + 10, T.l15 + 45], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	const c = toScreen(v, [CAMP_D[0], CAMP_D[1] + 30, CAMP_D[2]]);
	if (c.behind) return null;
	const R = 15 * c.s;
	const grow = 0.85 + 0.15 * prog(f, T.l14 + 15, T.l14 + 70);
	const hand = ((f - T.l14) / 30) * 50;
	const ticks = Array.from({length: 12}, (_, i) => i * 30);
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: c.x - R * 2.2,
					top: c.y - R * 2.2,
					width: R * 4.4,
					height: R * 4.4,
					opacity: a,
					background: 'radial-gradient(circle, rgba(6,10,26,0.5) 0%, rgba(6,10,26,0.28) 40%, rgba(0,0,0,0) 70%)',
				}}
			/>
			<svg
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					overflow: 'visible',
					opacity: a,
					filter: `drop-shadow(0 0 6px rgba(${BLUE},1)) drop-shadow(0 0 22px rgba(${BLUE},0.6))`,
				}}
				width={1920}
				height={1080}
			>
				<g transform={`translate(${c.x},${c.y}) scale(${grow})`} fill="none" stroke={`rgba(${BLUE},1)`}>
					<circle r={R} strokeWidth={4} />
					<circle r={R * 0.82} strokeWidth={1.6} strokeOpacity={0.7} />
					{ticks.map((d) => (
						<line key={d} x1={0} y1={-R} x2={0} y2={-R * (d % 90 === 0 ? 0.76 : 0.87)} strokeWidth={d % 90 === 0 ? 4.5 : 2.6} transform={`rotate(${d})`} stroke="rgba(240,214,140,1)" />
					))}
					<line x1={0} y1={0} x2={0} y2={-R * 0.7} strokeWidth={3.6} transform={`rotate(${hand})`} stroke="rgba(240,214,140,1)" />
					<line x1={0} y1={0} x2={0} y2={-R * 0.48} strokeWidth={4.6} transform={`rotate(${hand / 12})`} />
					<circle r={5} fill="rgba(240,214,140,1)" stroke="none" />
				</g>
			</svg>
		</>
	);
};

/** 珍珠队：营地上空的空间之格（立体的格子，缓缓转动、向外展开） */
const SpaceLattice: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.l15 + 15, T.l15 + 50, T.l17 - 50, T.l17 - 15], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	const c: V3 = [CAMP_P[0], CAMP_P[1] + 30, CAMP_P[2]];
	const S = 9 * (0.7 + 0.3 * prog(f, T.l15 + 15, T.l15 + 90));
	const rot = ((f - T.l15) / 30) * 0.25;
	const P = (x: number, y: number, z: number) => {
		const cx = Math.cos(rot);
		const sx = Math.sin(rot);
		const p = toScreen(v, [c[0] + (x * cx - z * sx) * S, c[1] + y * S, c[2] + (x * sx + z * cx) * S]);
		return p;
	};
	const lines: [number, number, number, number][] = [];
	const g = [-1, 0, 1];
	for (const i of g)
		for (const j of g) {
			const a1 = P(i, j, -1);
			const b1 = P(i, j, 1);
			const a2 = P(i, -1, j);
			const b2 = P(i, 1, j);
			const a3 = P(-1, i, j);
			const b3 = P(1, i, j);
			lines.push([a1.x, a1.y, b1.x, b1.y], [a2.x, a2.y, b2.x, b2.y], [a3.x, a3.y, b3.x, b3.y]);
		}
	const mid = toScreen(v, c);
	const R = 9 * 2.4 * mid.s;
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: mid.x - R * 1.6,
					top: mid.y - R * 1.6,
					width: R * 3.2,
					height: R * 3.2,
					opacity: a,
					background: 'radial-gradient(circle, rgba(30,10,24,0.5) 0%, rgba(30,10,24,0.26) 42%, rgba(0,0,0,0) 70%)',
				}}
			/>
			<svg
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					opacity: a,
					filter: 'drop-shadow(0 0 5px rgba(255,170,215,1)) drop-shadow(0 0 20px rgba(255,150,200,0.6))',
				}}
				width={1920}
				height={1080}
			>
				{lines.map(([x1, y1, x2, y2], i) => (
					<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,200,228,1)" strokeWidth={i % 3 === 0 ? 3 : 2} />
				))}
			</svg>
		</>
	);
};

/** 两句口头禅：只差一个字，"时"与"地"叠化（官方中文原句） */
const Motto: React.FC<{f: number}> = ({f}) => {
	const a = interpolate(f, [T.l17 + 5, T.l17 + 30, T.l18 - 10, T.l18 + 15], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	const k = interpolate(f, [T.l17 + 95, T.l17 + 120], [0, 1], clamp);
	const glyph = (ch: string, rgb: string, o: number) => (
		<span
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				opacity: o,
				fontWeight: 700,
				color: `rgb(${rgb})`,
				textShadow: `0 0 10px rgba(${rgb},1), 0 0 26px rgba(${rgb},0.85), 0 0 60px rgba(${rgb},0.5)`,
			}}
		>
			{ch}
		</span>
	);
	const base: React.CSSProperties = {
		fontFamily: SERIF,
		fontWeight: 600,
		fontSize: 58,
		letterSpacing: 10,
		color: 'rgba(242,240,234,0.96)',
		textShadow: '0 0 14px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.85)',
	};
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: 250,
				height: 200,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				opacity: a,
				background: 'radial-gradient(ellipse 42% 50% at 50% 50%, rgba(8,10,18,0.55) 0%, rgba(8,10,18,0.25) 55%, rgba(0,0,0,0) 80%)',
			}}
		>
			<div style={{...base, display: 'flex'}}>
				<span>与大家共存的此</span>
				<span
					style={{
						position: 'relative',
						display: 'inline-block',
						width: '1.18em',
					}}
				>
					<span style={{visibility: 'hidden'}}>时</span>
					{glyph('时', '140,180,255', 1 - k)}
					{glyph('地', '255,190,220', k)}
				</span>
				<span>最为重要</span>
			</div>
		</div>
	);
};

/** 对峙：两群人隔着一段雪地，各自身后一片光；日夜轮换，人换了一代又一代 */
const Feud: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.l18 - 30, T.l18 + 10, T.l19 + 40, T.l19 + 90], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	const at = (side: number, along: number, depth: number): V3 => {
		const x = FEUD_M[0] + FEUD_R[0] * side * along + FEUD_F[0] * depth;
		const z = FEUD_M[2] + FEUD_R[1] * side * along + FEUD_F[1] * depth;
		return [x, coastHeight(x, z), z];
	};
	const gens = [T.l18, T.l18 + 55, T.l18 + 110];
	const people: React.ReactNode[] = [];
	gens.forEach((g0, gi) => {
		const o = interpolate(f, [g0 - 10, g0 + 12, gi < 2 ? gens[gi + 1] - 6 : T.l19 + 40, gi < 2 ? gens[gi + 1] + 14 : T.l19 + 90], [0, 1, 1, 0], clamp) * a;
		if (o <= 0) return;
		for (const side of [-1, 1]) {
			for (let i = 0; i < 5; i++) {
				const along = 2.4 + (i % 3) * 1.0 + gi * 0.2;
				const depth = (i - 2) * 1.5 + (gi - 1) * 0.6;
				const p = at(side, along, depth);
				people.push(
					<Folk
						key={`${gi}-${side}-${i}`}
						v={v}
						foot={p}
						pose={i === 1 ? 'raise' : i === 3 ? 'look' : 'stand'}
						t={(f * 0.02 + i) % 1}
						flip={side > 0}
						rimDir={[side > 0 ? 1 : -1, -0.3]}
						rimColor={side < 0 ? '#8fb0ff' : '#ffd6e6'}
						rim={0.9}
						opacity={o}
					/>,
				);
			}
		}
	});
	const back = (side: number) => at(side, 14, 6);
	const pd = back(-1);
	const pp = back(1);
	return (
		<>
			<Glow v={v} p={[pd[0], pd[1] + 3, pd[2]]} r={520} rgb={BLUE} a={a * 0.32} />
			<Glow v={v} p={[pp[0], pp[1] + 3, pp[2]]} r={520} rgb={PEARL} a={a * 0.3} />
			{people}
		</>
	);
};

/** 马加木的回忆：故乡被狂暴的宝可梦烧毁——海那边的天际烧起火光，烟里亮起一双双红眼 */
const FireMemory: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.l21 + 20, T.l21 + 80, T.l23 - 10, T.l23 + 35], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	const dir = (b: number, d: number, y: number): V3 => {
		const r = (b * Math.PI) / 180;
		return [KAMADO[0] + Math.sin(r) * d, y, KAMADO[2] - Math.cos(r) * d];
	};
	// 海平线上连成一片的火
	const flames = Array.from({length: 30}, (_, i) => ({
		p: toScreen(v, dir(96 + i * 1.55 + Math.sin(i * 5.1) * 0.9, 480 - (i % 3) * 25, 0)),
		i,
	}));
	const glow = toScreen(v, dir(118, 480, 8));
	const eyes = Array.from({length: 6}, (_, i) => {
		const t0 = T.l22 + 4 + i * 10;
		return {
			p: toScreen(v, dir(104 + i * 5.5, 260 + (i % 3) * 60, 14 + (i % 2) * 9)),
			o: interpolate(f, [t0, t0 + 14, T.l23 - 10, T.l23 + 20], [0, 1, 1, 0], clamp) * (0.75 + 0.25 * Math.sin(f * 0.4 + i)),
			i,
		};
	});
	return (
		<div style={{position: 'absolute', inset: 0, opacity: a}}>
			{/* 天际的火光与烟 */}
			{glow.behind ? null : (
				<>
					<div
						style={{
							position: 'absolute',
							left: glow.x - 900,
							top: glow.y - 260,
							width: 1800,
							height: 420,
							background: 'radial-gradient(ellipse 50% 42% at 50% 62%, rgba(255,120,40,0.42) 0%, rgba(200,50,20,0.22) 45%, rgba(0,0,0,0) 75%)',
							mixBlendMode: 'screen',
						}}
					/>
					<div
						style={{
							position: 'absolute',
							left: glow.x - 900,
							top: glow.y - 420,
							width: 1800,
							height: 420,
							background: 'radial-gradient(ellipse 46% 50% at 50% 80%, rgba(24,12,12,0.32) 0%, rgba(24,12,12,0.14) 50%, rgba(0,0,0,0) 78%)',
						}}
					/>
				</>
			)}
			{flames.map(({p, i}) => (p.behind ? null : <Flame key={i} x={p.x} y={p.y + 2} size={34 + ((i * 7) % 5) * 11 + 14 * Math.sin(i * 1.7) ** 2} f={f} seed={i * 13} opacity={0.85} glow={1.2} />))}
			{eyes.map(({p, o, i}) =>
				p.behind || o <= 0 ? null : (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: p.x - 9,
							top: p.y - 3,
							opacity: o,
						}}
					>
						{[0, 13].map((dx) => (
							<div
								key={dx}
								style={{
									position: 'absolute',
									left: dx,
									top: 0,
									width: 7,
									height: 3,
									borderRadius: 3,
									background: '#ff4a2e',
									boxShadow: '0 0 6px 2px rgba(255,70,30,0.9), 0 0 20px 7px rgba(255,40,20,0.35)',
								}}
							/>
						))}
					</div>
				),
			)}
		</div>
	);
};

/** 夜里三处灯火：金刚队（蓝）、珍珠队（白）、祝庆村（暖） */
export const ThreeLights: React.FC<{f: number; v: View; k?: number}> = ({f, v, k = 1}) => {
	const camps = k * interpolate(f, [T.l23 + 60, T.l24 + 40], [0, 1], clamp);
	const vill = k * interpolate(f, [T.vbuilt - 20, T.l24], [0, 1], clamp);
	const out: React.ReactNode[] = [];
	const ring = (c: V3, n: number, rgb: string, a: number, key: string, spread: number) => {
		for (let i = 0; i < n; i++) {
			const ang = i * 2.39996;
			const d = 3 + Math.sqrt(i) * spread;
			const x = c[0] + Math.cos(ang) * d;
			const z = c[2] + Math.sin(ang) * d * 0.8;
			out.push(<Glow key={`${key}${i}`} v={v} p={[x, coastHeight(x, z) + 1.5, z]} r={9 + (i % 3) * 3} rgb={rgb} a={a * (0.7 + 0.3 * Math.sin(f * 0.17 + i * 1.9))} />);
		}
	};
	if (camps > 0) {
		ring(CAMP_D, 18, BLUE, camps, 'd', 5);
		ring(CAMP_P, 18, PEARL, camps, 'p', 5);
	}
	if (vill > 0) ring(VILLAGE, 16, WARM, vill * 0.9, 'v', 4.4);
	// 营地中央的大火堆
	if (camps > 0) {
		out.push(<Glow key="dc" v={v} p={[CAMP_D[0], CAMP_D[1] + 2, CAMP_D[2]]} r={60} rgb={BLUE} a={camps * 0.5} />);
		out.push(<Glow key="pc" v={v} p={[CAMP_P[0], CAMP_P[1] + 2, CAMP_P[2]]} r={60} rgb={PEARL} a={camps * 0.45} />);
	}
	if (vill > 0) out.push(<Glow key="vc" v={v} p={[VILLAGE[0], VILLAGE[1] + 2, VILLAGE[2]]} r={60} rgb={WARM} a={vill * 0.5} />);
	return <>{out}</>;
};

/** 营地的灯（白天弱、傍晚亮） */
const CampGlow: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.l14 - 20, T.l14 + 40, T.l19 + 40, T.l19 + 90], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	return (
		<>
			<Glow v={v} p={[CAMP_D[0], CAMP_D[1] + 2, CAMP_D[2]]} r={70} rgb={BLUE} a={a * 0.45} />
			<Glow v={v} p={[CAMP_P[0], CAMP_P[1] + 2, CAMP_P[2]]} r={70} rgb={PEARL} a={a * 0.4} />
		</>
	);
};

/** 山顶神殿的一点金光：古人的心已不在，金光慢慢熄灭 */
const TempleGlint: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.l19 - 30, T.l19 + 20, T.l19 + 70, T.l20 - 10], [0, 0.55, 0.55, 0], clamp);
	if (a <= 0) return null;
	return <Glow v={v} p={[SUMMIT[0], SUMMIT[1] + 10, SUMMIT[2]]} r={90} rgb="255,214,140" a={a} />;
};

/** 第三群人：船上的灯 */
const ShipLights: React.FC<{f: number; v: View}> = ({f, v}) => {
	const a = interpolate(f, [T.ships2 - 40, T.ships2, T.l22, T.l22 + 40], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	return (
		<>
			{NEW_SHIPS.map((s, i) => {
				const p = voyageAt(s, f).p;
				return <Glow key={i} v={v} p={[p[0], 3.6, p[2]]} r={14} rgb={WARM} a={a * 0.7} />;
			})}
		</>
	);
};

export const ClansLayers: React.FC<{f: number; v: View}> = ({f, v}) => {
	const kamado = interpolate(f, [T.l21 - 10, T.l21 + 40, T.vbuild + 20, T.vbuild + 50], [0, 1, 1, 0], clamp);
	return (
		<>
			<TempleGlint f={f} v={v} />
			<CampGlow f={f} v={v} />
			<Lanterns f={f} v={v} />
			<ClaimWord f={f} v={v} />
			<TimeDial f={f} v={v} />
			<SpaceLattice f={f} v={v} />
			<Feud f={f} v={v} />
			<ShipLights f={f} v={v} />
			<FireMemory f={f} v={v} />
			<TrainerSil v={v} file="trainers/kamado/la.png" aspect={1117 / 1600} foot={KAMADO} h={1.9} o={kamado} from="right" rgb="255,180,130" lift={0.15} />
			<ThreeLights f={f} v={v} />
			<Motto f={f} />
		</>
	);
};

export const SUBS_CLANS: [number, number, string, string, SubtitleSource?][] = [
	[T.l12, T.l12 + 128, '不知过了多久，一群崇拜神奥大尊的人渡海来到这里。', 'Ages later, people who revered almighty Sinnoh came sailing across the sea.'],
	[T.l13, T.l13 + 98, '他们分成两派，都自称是神阖之民。', 'They split into two clans, and both claimed to be the people of Celestica.'],
	[T.l14, T.l14 + 122, '一派叫金刚队。他们说，神奥大尊创造了时间。', 'One was the Diamond Clan. Almighty Sinnoh, they said, created time.'],
	[T.l15, T.l15 + 122, '一派叫珍珠队。他们说，神奥大尊创造了空间。', 'The other was the Pearl Clan. Almighty Sinnoh, they said, created space.'],
	[T.l17, T.l17 + 178, '连口头禅都只差一个字：一边说「此时」最重要，一边说「此地」最重要。', 'Even their sayings differ by a single word: one prizes "this time," the other "this place."'],
	[T.l18, T.l18 + 148, '两边都说，对方信的神是冒牌货。纷争就这样一代传一代。', "Each called the other's god a fake, and the feud passed from one generation to the next."],
	[T.l19, T.l19 + 135, '神阖的名字重现世间，古人的心却已不复在。', 'But even if the name endures, its heart does not live on.', {zh: '《传说 阿尔宙斯》古老诗文５', en: 'Bulbapedia, Old Verse 5'}],
	[T.l20, T.l20 + 138, '后来，又有第三群人从各地渡海而来。他们也叫银河队。', 'Later, a third group crossed the sea from many lands. They, too, were called the Galaxy Team.'],
	[T.l21, T.l21 + 122, '他们的队长马加木，故乡被狂暴的宝可梦烧毁过。', 'Their commander, Kamado, had seen his homeland burned by frenzied Pokémon.'],
	[T.l22, T.l22 + 100, '在他看来，宝可梦是很可怕的生物。', 'To him, Pokémon were terrifying creatures.'],
	[T.l23, T.l23 + 135, '他们在海边建起祝庆村，带来了一样新东西：精灵球。', 'They built Jubilife Village by the shore, and brought something new: the Poké Ball.'],
	[T.l24, T.l24 + 168, '两个部族，一个外来的村子，各自守着自己的神，也守着彼此的距离。', 'Two clans and one village of outsiders—each keeping to its own god, and to its own distance.'],
];
