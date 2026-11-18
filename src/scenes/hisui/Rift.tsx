import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Grain} from '../../components/Grain';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {CAMP_P, coastHeight, SUMMIT} from '../../three/hisui/coast';
import {V3} from '../../three/stage';
import {CoastEnv, CoastWorld, ThreeLights, TrainerSil} from './Clans';
import {flow, prog, SUB, T, track} from './common';
import {Glow, PartCard, toScreen, View} from './Overlays';

// ─── 第 3 段「裂缝」（中篇开头）──────────────────────────────────────────────
// 3D 海岸（夜 → 红天）和几段 2D 画面交替：坠落、跨越时空的地方、王的剪影。段内的切换都用有动机的过渡
// （钻进裂缝的白光、落地的冲击光、闪光收成裂缝的光核、落雷的闪光、叠化）。

/** 时空裂缝的光核：天冠山尖上空 */
const RIFT_P: V3 = [SUMMIT[0] - 20, SUMMIT[1] + 140, SUMMIT[2] + 40];
export const riftDir = (cam: V3): V3 => {
	const d = [RIFT_P[0] - cam[0], RIFT_P[1] - cam[1], RIFT_P[2] - cam[2]];
	const l = Math.hypot(d[0], d[1], d[2]);
	return [d[0] / l, d[1] / l, d[2] / l];
};
const ground = (x: number, z: number, up = 0): V3 => [x, coastHeight(x, z) + up, z];

/** 那个人落地的地方：祝庆村外的海滩 */
const LAND: V3 = ground(6, -5);
/** 珠贝站在珍珠队营地外 */
const IRIDA: V3 = ground(CAMP_P[0] - 13, CAMP_P[2] + 28);
/** 马加木站在村里，面朝西门；那个人被赶出门外 */
const KAMADO2: V3 = ground(60, -33);
export const OUTSIDE: V3 = ground(41, -33.2);

// ── 3D 镜头：每个 3D 镜头一组关键帧，镜头之间由 2D 画面或闪光隔开 ──

type Shot = {from: number; to: number; keys: [number, number[]][]};
const SHOTS: Shot[] = [
	// 夜空里转向天冠山，篇章卡，裂缝撕开，镜头推进光核
	{
		from: T.end2,
		to: T.fall + 8,
		keys: [
			[T.end2, [-12.5, 114, 66, 0, 0, -109, 48]],
			[T.card2 + 80, [-6, 96, 50, 230, 470, -470, 50]],
			[T.tear + 70, [-3, 92, 44, RIFT_P[0], RIFT_P[1] - 60, RIFT_P[2], 48]],
			[T.fall + 8, [4, 100, 34, RIFT_P[0], RIFT_P[1], RIFT_P[2], 18]],
		],
	},
	// 夜里的海滩：落地的光散开，那个人站起来
	{
		from: T.beach - 4,
		to: T.voidIn + 50,
		keys: [
			[T.beach, [-8, 1.3, 7, 40, 16, -36, 58]],
			[T.voidIn + 50, [-7, 1.35, 6, 40, 17, -36, 56]],
		],
	},
	// 落雷
	{
		from: T.voidOut - 45,
		to: T.frenzy + 8,
		keys: [
			[T.voidOut - 45, [-6, 6, 4, 220, 300, -470, 50]],
			[T.frenzy + 8, [-5, 6.4, 1, 220, 292, -470, 47]],
		],
	},
	// 珍珠队营地：珠贝（机位高度按机位处的地面算，雪原在营地外是往下斜的）
	{
		from: T.irida - 6,
		to: T.calm + 30,
		keys: [
			[T.irida - 6, [...ground(CAMP_P[0] - 20, CAMP_P[2] + 37, 1.7), CAMP_P[0] + 60, IRIDA[1] + 16, CAMP_P[2] - 120, 50]],
			[T.calm + 30, [...ground(CAMP_P[0] - 19.2, CAMP_P[2] + 35.6, 1.7), CAMP_P[0] + 60, IRIDA[1] + 17, CAMP_P[2] - 120, 48]],
		],
	},
	// 村里：裂缝还在 → 第二天的红天 → 马加木 → 退出西门，门关上
	{
		from: T.still - 25,
		to: T.end3,
		keys: [
			[T.still - 25, [51, 2.4, -29.5, RIFT_P[0], RIFT_P[1], RIFT_P[2], 44]],
			[T.redsky + 20, [51.2, 2.2, -29.8, RIFT_P[0], RIFT_P[1] - 40, RIFT_P[2], 48]],
			[T.redsky + 150, [51.5, 1.9, -30.2, 100, 60, -110, 64]],
			[T.kamado + 60, [53.5, 2.0, -31.2, 60, 2.8, -32.8, 44]],
			[T.cast + 10, [52.6, 2.0, -31.0, 60, 2.8, -32.8, 44]],
			[T.end3 - 30, [34, 2.2, -30.6, 60, 3.0, -32.6, 46]],
			[T.end3, [33.5, 2.2, -30.6, 60, 3.0, -32.6, 46]],
		],
	},
];

const shotAt = (f: number) => SHOTS.find((s) => f >= s.from && f < s.to) ?? null;
const viewOf = (s: Shot, f: number): View => {
	const c = flow(f, s.keys);
	return {pos: [c[0], c[1], c[2]], target: [c[3], c[4], c[5]], fov: c[6]};
};

// ── 2D 画面的不透明度 ──

const fallO = (f: number) => interpolate(f, [T.fall - 2, T.fall + 3, T.beach - 3, T.beach + 2], [0, 1, 1, 0], clamp);
const voidO = (f: number) => interpolate(f, [T.voidIn, T.voidIn + 45, T.voidOut - 40, T.voidOut], [0, 1, 1, 0], clamp);
const noblesO = (f: number) =>
	Math.max(interpolate(f, [T.frenzy - 2, T.frenzy + 3, T.irida - 3, T.irida + 2], [0, 1, 1, 0], clamp), interpolate(f, [T.calm - 15, T.calm + 25, T.still - 20, T.still + 20], [0, 1, 1, 0], clamp));

/** 白光：钻进裂缝、落地、落雷 */
const FLASHES: [number, number, number][] = [
	[T.fall, 1, 14],
	[T.beach, 0.85, 22],
	[T.frenzy, 0.9, 16],
	[T.irida, 0.7, 14],
];
const flashAt = (f: number) => FLASHES.reduce((m, [t, a, w]) => Math.max(m, f < t - 4 ? 0 : f < t ? (a * (f - t + 4)) / 4 : a * Math.exp(-(f - t) / (w * 0.45))), 0);

// ── 落雷：从裂缝的光核劈向雪原 ──

const BOLTS: {t: number; to: V3; seed: number}[] = [
	{t: T.bolt, to: ground(120, -220), seed: 1},
	{t: T.bolt + 16, to: ground(40, -150), seed: 2},
	{t: T.bolt + 27, to: ground(205, -300), seed: 3},
	{t: T.bolt + 40, to: ground(-30, -200), seed: 4},
	// 珠贝那一镜：远处还在落雷
	{t: T.irida + 40, to: ground(230, -420), seed: 5},
	{t: T.irida + 110, to: ground(150, -380), seed: 6},
	{t: T.l31 + 175, to: ground(260, -400), seed: 7},
];
const boltFlash = (f: number) => BOLTS.reduce((m, b) => Math.max(m, f >= b.t && f < b.t + 18 ? Math.exp(-(f - b.t) / 4) : 0), 0);

const rnd = (s: number) => {
	const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
/** 一道闪电的折线（屏幕坐标），带两条分叉 */
const boltPath = (x0: number, y0: number, x1: number, y1: number, seed: number) => {
	const n = 16;
	const len = Math.hypot(x1 - x0, y1 - y0);
	const nx = -(y1 - y0) / len;
	const ny = (x1 - x0) / len;
	const pts: [number, number][] = [];
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const j = i === 0 || i === n ? 0 : (rnd(seed * 31 + i) - 0.5) * len * 0.09;
		pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
	}
	const main = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
	const branches = [5, 10].map((k, bi) => {
		const [bx, by] = pts[k];
		const a = (rnd(seed * 7 + bi) - 0.5) * 1.6;
		const bl = len * (0.12 + rnd(seed * 3 + bi) * 0.1);
		const dx = (x1 - x0) / len;
		const dy = (y1 - y0) / len;
		const ex = bx + (dx * Math.cos(a) - dy * Math.sin(a)) * bl;
		const ey = by + (dx * Math.sin(a) + dy * Math.cos(a)) * bl;
		const mx = (bx + ex) / 2 + nx * bl * 0.12 * (rnd(seed + bi * 5) - 0.5);
		const my = (by + ey) / 2 + ny * bl * 0.12;
		return `M${bx.toFixed(1)},${by.toFixed(1)} L${mx.toFixed(1)},${my.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`;
	});
	return {main, branches};
};

export const BoltSvg: React.FC<{x0: number; y0: number; x1: number; y1: number; seed: number; a: number; width?: number}> = ({x0, y0, x1, y1, seed, a, width = 3}) => {
	if (a <= 0.01) return null;
	const {main, branches} = boltPath(x0, y0, x1, y1, seed);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: a, filter: 'drop-shadow(0 0 6px rgba(200,215,255,1)) drop-shadow(0 0 22px rgba(160,180,255,0.8))'}}>
			<path d={main} stroke="#f4f6ff" strokeWidth={width} fill="none" strokeLinejoin="round" />
			{branches.map((d, i) => (
				<path key={i} d={d} stroke="#e8ecff" strokeWidth={width * 0.5} fill="none" />
			))}
		</svg>
	);
};

const Bolts3D: React.FC<{f: number; v: View}> = ({f, v}) => {
	const c = toScreen(v, RIFT_P);
	return (
		<>
			{BOLTS.map((b) => {
				if (f < b.t || f > b.t + 14) return null;
				const e = toScreen(v, b.to);
				if (e.behind) return null;
				const a = f < b.t + 2 ? 1 : Math.exp(-(f - b.t - 2) / 3.5);
				return (
					<div key={b.seed}>
						<BoltSvg x0={c.x} y0={c.y} x1={e.x} y1={e.y} seed={b.seed} a={a} width={5} />
						<Glow v={v} p={[b.to[0], b.to[1] + 4, b.to[2]]} r={160} rgb="200,215,255" a={a * 0.7} />
					</div>
				);
			})}
		</>
	);
};

// ── 2D：坠落 ──

const FALL_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLight;
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
	vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
	// 往上掠过的云（人在往下掉）
	float n = fbm(vec2(p.x * 2.2, p.y * 1.1 - uTime * 1.6) + fbm(p * 1.3 + uTime * 0.1) * 0.8);
	float n2 = fbm(vec2(p.x * 5.0 + 3.0, p.y * 2.0 - uTime * 3.2));
	vec3 col = mix(vec3(0.08, 0.06, 0.13), vec3(0.4, 0.34, 0.5), smoothstep(0.35, 0.8, n));
	col += vec3(0.25, 0.22, 0.32) * smoothstep(0.6, 0.85, n2) * 0.6;
	// 速度线
	float streak = smoothstep(0.92, 1.0, vn(vec2(p.x * 90.0, floor(p.y * 2.0 - uTime * 9.0)))) * smoothstep(0.0, 0.5, vn(vec2(p.x * 40.0, p.y * 3.0 - uTime * 12.0)));
	col += vec3(0.7, 0.75, 0.95) * streak * 0.35;
	// 头顶裂缝的白光，越掉越远
	float d = length((uv - vec2(0.5, 1.12)) * vec2(uRes.x / uRes.y, 1.0));
	col += vec3(0.8, 0.86, 1.0) * uLight * (exp(-d * 2.6) * 1.4 + exp(-d * 9.0) * 1.2);
	outColor = vec4(col, 1.0);
}`;

/** 屏幕坐标里的人物剪影（可旋转），做法同 TrainerSil */
export const ScreenSil: React.FC<{file: string; aspect: number; x: number; y: number; h: number; rot?: number; rgb: string; lift?: number; o?: number; from?: 'top' | 'left' | 'right'}> = ({file, aspect, x, y, h, rot = 0, rgb, lift = 0.14, o = 1, from = 'top'}) => {
	if (o <= 0.001) return null;
	const w = h * aspect;
	const url = `url(${staticFile(file)})`;
	const deg = from === 'top' ? 180 : from === 'left' ? 100 : 260;
	return (
		<div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: o, transform: `rotate(${rot}deg)`}}>
			<Img src={staticFile(file)} style={{position: 'absolute', inset: 0, width: w, height: h, filter: `brightness(${lift}) saturate(0.18) contrast(1.15) drop-shadow(0 -2px 2px rgba(${rgb},0.6)) drop-shadow(0 0 16px rgba(0,0,0,0.6))`}} />
			<div
				style={{
					position: 'absolute',
					inset: 0,
					WebkitMaskImage: url,
					WebkitMaskSize: '100% 100%',
					maskImage: url,
					maskSize: '100% 100%',
					mixBlendMode: 'screen',
					background: `linear-gradient(${deg}deg, rgba(${rgb},${0.26 + lift * 0.5}) 0%, rgba(${rgb},0.07) 34%, rgba(0,0,0,0) 60%)`,
				}}
			/>
		</div>
	);
};

export const REI = {file: 'trainers/rei/la.png', aspect: 961 / 1600};

const FallShot: React.FC<{f: number}> = ({f}) => {
	const o = fallO(f);
	if (o <= 0) return null;
	const t = prog(f, T.fall, T.beach);
	return (
		<AbsoluteFill style={{opacity: o}}>
			<ShaderCanvas frag={FALL_FRAG} width={1920} height={1080} scale={0.5} uniforms={{uTime: f / 30, uLight: 1 - t * 0.7}} style={{position: 'absolute', inset: 0}} />
			<ScreenSil {...REI} x={960 + Math.sin(t * 2.2) * 60} y={520 + t * 30} h={260 + t * 380} rot={-24 + t * 58} rgb="200,215,255" lift={0.12} />
		</AbsoluteFill>
	);
};

// ── 2D：跨越时空的地方（只是光，不显形、不报名）──

const VOID_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uGlow;
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
	vec2 p = (uv - vec2(0.5, 0.56)) * vec2(uRes.x / uRes.y, 1.0);
	float r = length(p);
	float a = atan(p.y, p.x);
	// 深靛色的虚空，缓缓旋转的金色、青色星云
	vec2 q = vec2(cos(a + uTime * 0.02), sin(a + uTime * 0.02)) * r * 2.4;
	float n = fbm(q * 1.6 + fbm(q * 2.0 + uTime * 0.03) * 1.4);
	vec3 col = mix(vec3(0.01, 0.015, 0.05), vec3(0.06, 0.07, 0.16), smoothstep(0.0, 1.2, 1.0 - r));
	col += vec3(0.85, 0.66, 0.3) * smoothstep(0.55, 0.85, n) * 0.35 * smoothstep(1.1, 0.2, r);
	col += vec3(0.2, 0.45, 0.6) * smoothstep(0.6, 0.9, fbm(q * 3.0 - 4.0)) * 0.18;
	// 星尘
	vec2 g = floor(gl_FragCoord.xy / 3.0);
	float s = step(0.996, h1(g)) * (0.5 + 0.5 * sin(uTime * 2.0 + h1(g + 3.0) * 20.0));
	col += vec3(0.9, 0.92, 1.0) * s * 0.8;
	// 一圈光环与中心的金白光
	float ring = exp(-pow((r - 0.36) / 0.006, 2.0)) * (0.6 + 0.4 * vn(vec2(a * 6.0, uTime * 0.4)));
	col += vec3(1.0, 0.88, 0.6) * ring * uGlow * 0.9;
	col += vec3(1.0, 0.9, 0.7) * uGlow * (exp(-r * 4.5) * 0.9 + exp(-r * 14.0) * 0.6);
	outColor = vec4(col, 1.0);
}`;

const VoidShot: React.FC<{f: number; to: {x: number; y: number}}> = ({f, to}) => {
	const o = voidO(f);
	if (o <= 0) return null;
	const glow = interpolate(f, [T.voidIn + 10, T.voidIn + 80], [0.2, 1], clamp);
	const shape = interpolate(f, [T.voidIn + 50, T.l28 - 20, T.voidOut - 50, T.voidOut - 25], [0, 0.85, 0.85, 0], clamp);
	const breath = 0.9 + 0.1 * Math.sin(f * 0.07);
	// 收拢：整个光团缩向下一镜裂缝光核的位置
	const k = prog(f, T.voidOut - 45, T.voidOut);
	const e = k * k * (3 - 2 * k);
	const cx = 960;
	const cy = 1080 * 0.44;
	const sc = 1 - 0.85 * e;
	const tx = (to.x - cx) * e;
	const ty = (to.y - cy) * e;
	const H = 860;
	const W = H;
	return (
		<AbsoluteFill style={{opacity: o}}>
			<div style={{position: 'absolute', inset: 0, transform: `translate(${tx}px,${ty}px) scale(${sc})`, transformOrigin: `${cx}px ${cy}px`}}>
				<ShaderCanvas frag={VOID_FRAG} width={1920} height={1080} scale={0.5} uniforms={{uTime: f / 30, uGlow: glow * breath}} style={{position: 'absolute', inset: 0}} />
				{/* 一团光里模糊的巨大轮廓：只取立绘的外形，压成金白的光，大幅模糊 */}
				<Img
					src={staticFile('pokemon/arceus/art.png')}
					style={{position: 'absolute', left: cx - W / 2, top: cy - H * 0.52, width: W, height: H, opacity: shape * breath, filter: 'brightness(0) invert(1) sepia(0.6) saturate(1.6) blur(18px)', mixBlendMode: 'screen'}}
				/>
				<Img
					src={staticFile('pokemon/arceus/art.png')}
					style={{position: 'absolute', left: cx - W / 2, top: cy - H * 0.52, width: W, height: H, opacity: shape * 0.6, filter: 'brightness(0) invert(1) sepia(1) saturate(2) blur(70px)', mixBlendMode: 'screen'}}
				/>
				{/* 那个人：仰望着光 */}
				<ScreenSil {...REI} x={960} y={1080 - 150} h={250} rgb="255,226,170" lift={0.1} />
			</div>
		</AbsoluteFill>
	);
};

// ── 2D：五只王的剪影（狂暴 → 平静）──

const STORM_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uCalm;
uniform float uFlash;
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
	vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
	float sp = mix(0.12, 0.03, uCalm);
	float n = fbm(p * 1.8 + vec2(uTime * sp, -uTime * sp * 0.4) + fbm(p * 1.2 - uTime * sp * 0.5) * 1.3);
	vec3 storm = mix(vec3(0.05, 0.01, 0.015), vec3(0.42, 0.08, 0.06), smoothstep(0.4, 0.85, n));
	storm += vec3(0.9, 0.35, 0.15) * smoothstep(0.75, 0.95, n) * 0.25;
	vec3 calm = mix(vec3(0.01, 0.02, 0.05), vec3(0.1, 0.16, 0.28), smoothstep(0.4, 0.85, n));
	vec3 col = mix(storm, calm, uCalm);
	// 地平线：下方压暗
	col *= mix(0.35, 1.0, smoothstep(0.05, 0.45, uv.y));
	col += vec3(0.85, 0.85, 1.0) * uFlash * 0.5;
	outColor = vec4(col, 1.0);
}`;

/** 五只王（52poke「王」：劈斧螳螂、洗翠裙儿小姐、洗翠风速狗、洗翠顽皮雷弹、洗翠冰岩怪），按游戏里镇抚的顺序 */
const NOBLES: {src: string; x: number; h: number; base: number}[] = [
	{src: 'pokemon/kleavor/art.png', x: 250, h: 470, base: 980},
	{src: 'pokemon/lilligant-hisui/art.png', x: 610, h: 360, base: 940},
	{src: 'pokemon/arcanine-hisui/art.png', x: 965, h: 470, base: 990},
	{src: 'pokemon/electrode-hisui/art.png', x: 1315, h: 290, base: 945},
	{src: 'pokemon/avalugg-hisui/art.png', x: 1665, h: 470, base: 1000},
];

const NoblesShot: React.FC<{f: number}> = ({f}) => {
	const o = noblesO(f);
	if (o <= 0) return null;
	const calm = prog(f, T.calm, T.calm + 130);
	let flash = 0;
	const nodes = NOBLES.map((n, i) => {
		const strike = T.frenzy + 6 + i * 16;
		const quell = T.calm + 10 + i * 24;
		const hit = f >= strike && f < strike + 12 ? Math.exp(-(f - strike) / 3) : 0;
		flash = Math.max(flash, hit * 0.6);
		const rage = prog(f, strike, strike + 6) * (1 - prog(f, quell, quell + 30));
		const peace = prog(f, quell, quell + 30);
		const pulse = 0.75 + 0.25 * Math.sin(f * 0.5 + i * 1.9);
		const ra = rage * pulse;
		const pa = peace * (0.85 + 0.15 * Math.sin(f * 0.08 + i));
		const top = n.base - n.h;
		const glowRed = ra > 0.01 ? `drop-shadow(0 0 ${6 + 6 * ra}px rgba(255,90,40,${0.9 * ra})) drop-shadow(0 0 ${26 + 20 * ra}px rgba(255,50,20,${0.65 * ra}))` : '';
		const glowCalm = pa > 0.01 ? `drop-shadow(0 0 5px rgba(170,205,255,${0.75 * pa})) drop-shadow(0 0 22px rgba(120,170,255,${0.4 * pa}))` : '';
		return (
			<div key={n.src}>
				<Img src={staticFile(n.src)} style={{position: 'absolute', left: n.x - n.h / 2, top, width: n.h, height: n.h, filter: `brightness(0) ${glowRed} ${glowCalm}`.trim()}} />
				<BoltSvg x0={n.x + (rnd(i) - 0.5) * 300} y0={-20} x1={n.x} y1={top + n.h * 0.25} seed={i + 20} a={hit} width={4} />
			</div>
		);
	});
	return (
		<AbsoluteFill style={{opacity: o}}>
			<ShaderCanvas frag={STORM_FRAG} width={1920} height={1080} scale={0.5} uniforms={{uTime: f / 30, uCalm: calm, uFlash: flash}} style={{position: 'absolute', inset: 0}} />
			{nodes}
			{/* 镇抚：那个人的剪影在前景 */}
			<ScreenSil {...REI} x={190} y={1080 - 175} h={330} rgb="170,205,255" lift={0.12} from="right" o={prog(f, T.calm - 10, T.calm + 30)} />
		</AbsoluteFill>
	);
};

// ── 合在一起 ──

export const RiftMaster: React.FC<{f: number}> = ({f}) => {
	const shot = shotAt(f);
	const v = shot ? viewOf(shot, f) : null;
	const red = track(f, [
		[T.redsky + 20, 0],
		[T.redsky + 150, 1],
	]);
	const day = track(f, [
		[T.redsky + 10, 0],
		[T.redsky + 120, 0.32],
	]);
	const rift = track(f, [
		[T.tear, 0],
		[T.tear + 80, 1],
	]);
	const canopy = track(f, [
		[T.tear - 20, 0],
		[T.tear + 60, 0.85],
		[T.redsky + 20, 0.85],
		[T.redsky + 140, 0.25],
	]);
	const env: CoastEnv | null = v ? {dusk: 0, day, red, rift, canopy, riftDir: riftDir(v.pos), flash: boltFlash(f), gate: prog(f, T.cast + 58, T.cast + 110)} : null;
	// 2D 画面完全盖住时不画 3D
	const cover = Math.max(fallO(f), voidO(f), noblesO(f));
	// 跨越时空的光收拢时，对准落雷那一镜里裂缝光核的位置
	const eView = viewOf(SHOTS[2], T.voidOut - 45);
	const core = toScreen(eView, RIFT_P);
	const lights = 1 - red;
	const beachLand = interpolate(f, [T.beach, T.beach + 6, T.beach + 70], [0, 1, 0], clamp);
	const rei = interpolate(f, [T.beach + 10, T.beach + 40], [0, 1], clamp);
	const lum = Math.max(day, red * 0.6);
	const flash = flashAt(f);
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			{v && env && cover < 0.999 ? (
				<>
					<CoastWorld f={f} view={v} env={env} />
					<ThreeLights f={f} v={v} k={lights} />
					<Bolts3D f={f} v={v} />
					{/* 落地：海滩上一团散开的光，那个人站起来 */}
					<Glow v={v} p={[LAND[0], LAND[1] + 0.6, LAND[2]]} r={260} rgb="200,215,255" a={beachLand * 0.8} />
					{f < T.voidOut ? <TrainerSil v={v} {...REI} foot={LAND} h={1.65} o={rei} from="right" rgb="200,215,255" lift={0.12} /> : null}
					<TrainerSil v={v} file="trainers/irida/la.png" aspect={691 / 1600} foot={IRIDA} h={1.7} o={interpolate(f, [T.irida + 4, T.irida + 30, T.calm, T.calm + 20], [0, 1, 1, 0], clamp)} from="left" rgb="255,215,232" lift={0.14} />
					<TrainerSil v={v} file="trainers/kamado/la.png" aspect={1117 / 1600} foot={KAMADO2} h={1.92} o={interpolate(f, [T.kamado - 20, T.kamado + 20, T.cast + 62, T.cast + 96], [0, 1, 1, 0], clamp)} from="left" rgb="255,150,190" lift={0.15} />
					<TrainerSil v={v} {...REI} foot={OUTSIDE} h={1.65} o={interpolate(f, [T.cast + 30, T.cast + 60], [0, 1], clamp)} from="right" rgb="255,150,190" lift={0.12} />
				</>
			) : null}
			<FallShot f={f} />
			<VoidShot f={f} to={core} />
			<NoblesShot f={f} />
			{f < T.l25 ? <PartCard f={f} from={T.card2} to={T.card2 + 100} zh="中篇 · 裂缝" en="PART TWO · THE RIFT" /> : null}
			{flash > 0.003 ? <AbsoluteFill style={{background: `rgba(232,238,255,${Math.min(1, flash)})`}} /> : null}
			<AbsoluteFill style={{background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${0.55 - 0.15 * lum}) 100%)`, pointerEvents: 'none'}} />
			{SUBS_RIFT.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			<Grain opacity={0.12 - 0.05 * lum} />
		</AbsoluteFill>
	);
};

export const SUBS_RIFT: [number, number, string, string, SubtitleSource?][] = [
	[T.l25, T.l25 + 108, '直到有一天，天冠山的上空，裂开了一道口子。', 'Until one day, the sky above Mount Coronet split open.'],
	[T.l26, T.l26 + 125, '你从裂缝里掉了下来，落在祝庆村外的海滩上。', 'You fell through the rift, onto the beach outside Jubilife Village.'],
	[T.l27, T.l27 + 150, '坠落之前，你在一片跨越了时间和空间的地方，见过一只宝可梦。', 'Before the fall, you had met a Pokémon, in a realm beyond both time and space.'],
	[
		T.l28,
		T.l28 + 135,
		'「与所有的宝可梦相遇吧。在那时，我会再次出现在你面前。」',
		'"Seek out all Pokémon, and thou shalt find me once more."',
		{zh: '《传说 阿尔宙斯》开场台词', en: 'Bulbapedia, Arceus (game)/Quotes'},
	],
	[T.l29, T.l29 + 100, '就在那天夜里，一道雷从裂缝里劈了下来。', 'That very night, a bolt of lightning fell from the rift.'],
	[T.l30, T.l30 + 98, '被雷击中的王，一只接一只狂暴起来。', 'One by one, the nobles it struck fell into a frenzy.'],
	[T.l31, T.l31 + 198, '珍珠队的首领珠贝说：「真正的神奥大尊不会这样，降雷的一定是金刚队那个冒牌货。」', "Irida of the Pearl Clan said: \"The true almighty Sinnoh would never do this—the bolts must come from the Diamond Clan's false god.\""],
	[T.l32, T.l32 + 165, '你接下了镇抚王的任务。王一只只平静了下来。', 'You took on the task of quelling the nobles, and one by one, they calmed.'],
	[T.l33, T.l33 + 62, '可裂缝还在。', 'But the rift remained.'],
	[T.l34, T.l34 + 185, '最后一只王平静下来的第二天，裂缝涌出了说不清的力量，把整片天空染成了红色。', 'The day after the last noble was calmed, an unknowable power poured from the rift and stained the whole sky red.'],
	[T.l35, T.l35 + 168, '马加木说：「从天上掉下来的人，和从天上劈下来的雷，怎么可能没有关系？」', 'Kamado said: "A stranger falls from the rift, and so does the lightning—how could the two not be connected?"'],
	[T.l36, T.l36 + 85, '你被赶出了祝庆村。', 'And so you were cast out of Jubilife Village.'],
];

