import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Grain} from '../../components/Grain';
import {Flame} from '../../components/unown/Silhouette';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {coastHeight} from '../../three/hisui/coast';
import {V3} from '../../three/stage';
import {CoastWorld, TrainerSil} from './Clans';
import {flow, prog, SUB, T} from './common';
import {View} from './Overlays';
import {OUTSIDE, REI, riftDir, ScreenSil} from './Rift';

// ─── 第 4 段「宇与宙」────────────────────────────────────────────────────────
// 西门外的红天（3D，接上一段）→ 雪林里的小屋、屋里的火光（2D 剪影插画）→ 星空：星轨是"宙"、纵深是"宇"
// → 交织成旋涡"宇宙"、分屏各看见一半 → 三座湖（三联画）→ 云雾遗迹里三道光合成红色锁链。

const ease = (t: number) => t * t * (3 - 2 * t);

// ── 3D：望罗走来 ──

const VOLO_TO: V3 = [42.6, coastHeight(42.6, -29.8), -29.8];
const VOLO_FROM: V3 = [44.6, coastHeight(44.6, -25.8), -25.8];
const CAM4: [number, number[]][] = [
	[T.end3, [33.5, 2.2, -30.6, 60, 3.0, -32.6, 46]],
	[T.hut + 30, [35.0, 2.05, -31.0, 42, 2.5, -31.4, 40]],
];

const Gate3D: React.FC<{f: number}> = ({f}) => {
	const c = flow(f, CAM4);
	const v: View = {pos: [c[0], c[1], c[2]], target: [c[3], c[4], c[5]], fov: c[6]};
	const w = ease(prog(f, T.volo, T.volo + 50));
	const volo: V3 = [VOLO_FROM[0] + (VOLO_TO[0] - VOLO_FROM[0]) * w, 0, VOLO_FROM[2] + (VOLO_TO[2] - VOLO_FROM[2]) * w];
	volo[1] = coastHeight(volo[0], volo[2]);
	return (
		<>
			<CoastWorld f={f} view={v} env={{dusk: 0, day: 0.32, red: 1, rift: 1, canopy: 0.25, riftDir: riftDir(v.pos), flash: 0, gate: 1}} />
			<TrainerSil v={v} {...REI} foot={OUTSIDE} h={1.65} o={1} from="right" rgb="255,150,190" lift={0.12} />
			<TrainerSil v={v} file="trainers/volo/la.png" aspect={630 / 1600} foot={volo} h={1.78} o={prog(f, T.volo, T.volo + 30)} from="left" rgb="255,170,200" lift={0.15} />
		</>
	);
};

// ── 2D：雪林里的小屋 ──

const rnd = (s: number) => {
	const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
export const pines = (seed: number, n: number, y: number, hMin: number, hMax: number) =>
	Array.from({length: n}, (_, i) => {
		const x = (i / n) * 2100 - 90 + rnd(seed + i) * 60;
		const h = hMin + rnd(seed * 3 + i) * (hMax - hMin);
		const w = h * (0.34 + rnd(seed * 7 + i) * 0.1);
		return `M${x - w / 2},${y} L${x},${y - h} L${x + w / 2},${y} Z M${x - w * 0.38},${y - h * 0.35} L${x},${y - h * 0.82} L${x + w * 0.38},${y - h * 0.35} Z`;
	}).join(' ');
const PINES_FAR = pines(3, 34, 690, 120, 220);
const PINES_MID = pines(11, 22, 760, 220, 380);
const PINES_NEAR = pines(29, 9, 900, 420, 700);
const FLAKES = Array.from({length: 160}, (_, i) => ({x: rnd(i * 1.3) * 1920, y: rnd(i * 2.7) * 1080, s: 1 + rnd(i * 5.1) * 2.6, v: 0.6 + rnd(i * 3.3) * 1.4}));

export const Snowfall: React.FC<{f: number; o?: number}> = ({f, o = 1}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: o}}>
		{FLAKES.map((p, i) => {
			const y = (p.y + f * p.v * 2.2) % 1100;
			const x = (p.x + Math.sin(f * 0.02 + i) * 18 + f * 0.6) % 1940;
			return <circle key={i} cx={x} cy={y} r={p.s} fill="rgba(240,232,245,0.75)" />;
		})}
	</svg>
);

const WIN = {x: 1020, y: 640};

const HutOutside: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.hut - 10, T.hut + 25, T.inside, T.inside + 14], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	// 慢推，最后推进窗里的火光
	const push = 1 + 0.08 * prog(f, T.hut, T.inside - 20) + 2.6 * ease(prog(f, T.inside - 22, T.inside + 10));
	const flicker = 0.85 + 0.15 * Math.sin(f * 0.6) * Math.sin(f * 0.23 + 1);
	return (
		<AbsoluteFill style={{opacity: o, overflow: 'hidden'}}>
			<div style={{position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: `${WIN.x}px ${WIN.y}px`}}>
				{/* 红紫的夜空 */}
				<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #2a0f2c 0%, #4a1844 38%, #6d2a52 62%, #3a1a34 100%)'}} />
				<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 30% 18% at 30% 22%, rgba(230,90,120,0.35), rgba(0,0,0,0) 70%), radial-gradient(ellipse 26% 14% at 72% 16%, rgba(240,110,130,0.3), rgba(0,0,0,0) 70%), radial-gradient(ellipse 24% 12% at 55% 30%, rgba(80,160,120,0.18), rgba(0,0,0,0) 70%)'}} />
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					<path d={PINES_FAR} fill="#3b2440" />
					<rect x={0} y={688} width={1920} height={400} fill="#cbb9cf" />
					<path d={PINES_MID} fill="#24152a" />
					<rect x={0} y={758} width={1920} height={330} fill="#b9a7bf" />
					{/* 小屋：积雪的屋顶、烟囱、一扇亮着的窗 */}
					<g>
						<rect x={880} y={560} width={300} height={200} fill="#1a0f18" />
						<path d="M850,570 L1030,450 L1210,570 Z" fill="#160c14" />
						<path d="M850,570 L1030,450 L1210,570 L1196,578 L1030,470 L864,578 Z" fill="#d8cad8" />
						<rect x={1110} y={470} width={30} height={70} fill="#160c14" />
						<rect x={WIN.x - 38} y={WIN.y - 34} width={76} height={62} fill={`rgba(255,${170 + 30 * flicker},90,1)`} />
						<path d={`M${WIN.x},${WIN.y - 34} L${WIN.x},${WIN.y + 28} M${WIN.x - 38},${WIN.y - 3} L${WIN.x + 38},${WIN.y - 3}`} stroke="#1a0f18" strokeWidth={6} />
					</g>
					<path d={PINES_NEAR} fill="#0f0810" />
				</svg>
				<div style={{position: 'absolute', left: WIN.x - 260, top: WIN.y - 200, width: 520, height: 400, background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,170,80,${0.45 * flicker}) 0%, rgba(255,120,50,0.12) 40%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
				{/* 烟 */}
				<div style={{position: 'absolute', left: 1080, top: 300 - (f % 120) * 0.4, width: 120, height: 200, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(200,180,200,0.18), rgba(0,0,0,0) 70%)', filter: 'blur(10px)'}} />
				<Snowfall f={f} />
			</div>
		</AbsoluteFill>
	);
};

// ── 2D：屋里的火光 ──

const HutInside: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.inside - 6, T.inside + 12, T.l40 - 10, T.l40 + 30], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const flicker = 0.82 + 0.18 * Math.sin(f * 0.53) * Math.sin(f * 0.21 + 2);
	const drift = prog(f, T.inside, T.l40 + 30);
	return (
		<AbsoluteFill style={{opacity: o, overflow: 'hidden'}}>
			<div style={{position: 'absolute', inset: 0, transform: `scale(${1.04 + 0.04 * drift}) translateX(${-12 * drift}px)`}}>
				<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #120a07 0%, #1e120b 55%, #0c0705 100%)'}} />
				{/* 木墙的竖纹 */}
				<div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(60,36,20,0.25) 0px, rgba(60,36,20,0.25) 3px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 86px)', opacity: 0.7}} />
				<div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 55% 60% at 50% 78%, rgba(255,150,70,${0.55 * flicker}) 0%, rgba(200,90,40,${0.25 * flicker}) 35%, rgba(0,0,0,0) 72%)`, mixBlendMode: 'screen'}} />
				{/* 火塘 */}
				<div style={{position: 'absolute', left: 860, top: 900, width: 200, height: 36, borderRadius: 18, background: '#0a0503'}} />
				<Flame x={960} y={912} size={170} f={f} seed={3} opacity={0.95} glow={1.4} />
				<Flame x={925} y={918} size={110} f={f} seed={9} opacity={0.8} glow={0.8} />
				<Flame x={1000} y={918} size={120} f={f} seed={17} opacity={0.8} glow={0.8} />
				{/* 吾思（讲）、望罗和那个人（听） */}
				<ScreenSil file="trainers/cogita/la.png" aspect={683 / 1600} x={600} y={1080 - 330} h={700} rgb="255,170,90" lift={0.14} from="right" />
				<ScreenSil file="trainers/volo/la.png" aspect={630 / 1600} x={1330} y={1080 - 320} h={660} rgb="255,170,90" lift={0.14} from="left" />
				<ScreenSil {...REI} x={1560} y={1080 - 300} h={600} rgb="255,170,90" lift={0.13} from="left" />
				{/* 火星 */}
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					{Array.from({length: 26}, (_, i) => {
						const t = ((f * (0.5 + rnd(i) * 0.6) + rnd(i * 3) * 300) % 300) / 300;
						const x = 960 + (rnd(i * 7) - 0.5) * 160 + Math.sin(t * 6 + i) * 30;
						const y = 880 - t * 600;
						return <circle key={i} cx={x} cy={y} r={1.6 + rnd(i * 9) * 1.6} fill={`rgba(255,${150 + rnd(i) * 80},80,${(1 - t) * 0.9})`} />;
					})}
				</svg>
			</div>
		</AbsoluteFill>
	);
};

// ── 2D：宙与宇（星空：星轨 = 时间，纵深 = 空间，旋涡 = 宇宙；分屏各看见一半）──

const BLUE = '120,165,255';
const PEARL = '255,214,234';

const STARS_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uPhi;    // 星空绕天极转过的角度（时间）
uniform float uTrail;  // 星轨拖尾的弧度
uniform float uTrails; // 星轨的显现程度
uniform float uFly;    // 往星海深处飞过的距离（空间）
uniform float uDepth;  // 纵深星场的显现程度
uniform float uSpin;   // 纵深星场跟着转（交织成旋涡）
uniform float uSplit;  // 分屏：左只有纵深，右只有星轨
uniform float uGap;    // 分屏中间暗缝的半宽（0–1 画面宽）
out vec4 outColor;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p *= 2.03; a *= 0.5; } return v; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// 星轨：每颗星在一圈圈同心环上，绕天极转；像素落在星扫过的弧上就亮
vec3 trails(vec2 p, float phi, float trail) {
	float r = length(p);
	float th = atan(p.y, p.x);
	const float W = 0.0105;
	float ri = floor(r / W);
	vec3 acc = vec3(0.0);
	for (int dr = -1; dr <= 1; dr++) {
		float rr = ri + float(dr);
		if (rr < 1.0) continue;
		for (int k = 0; k < 3; k++) {
			float fk = float(k);
			float h = h1(vec2(rr, fk));
			if (h < 0.35) continue;
			float sr = (rr + 0.5 + (h1(vec2(rr, fk + 7.0)) - 0.5) * 0.7) * W;
			float st = h1(vec2(rr, fk + 3.0)) * 6.2832 + phi;
			float dth = mod(st - th, 6.2832);
			float dr2 = abs(r - sr);
			float bright = 0.35 + 1.3 * pow((h - 0.35) / 0.65, 3.0);
			vec3 tint = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.9, 0.75), h1(vec2(rr, fk + 11.0)));
			float arc = dth < trail ? smoothstep(0.0022, 0.0, dr2) * pow(1.0 - dth / max(trail, 1e-4), 1.4) : 0.0;
			float head = smoothstep(0.0045, 0.0, length(p - sr * vec2(cos(st), sin(st))));
			acc += tint * bright * (arc * 0.85 + head * 1.4);
		}
	}
	return acc;
}

// 纵深星场：一层层星从远处迎面散开；spin 让近处的层转得多，交织成旋涡
vec3 depthStars(vec2 p, float fly, float spin) {
	vec3 acc = vec3(0.0);
	for (int L = 0; L < 7; L++) {
		float fl = float(L);
		float z = fract(fl / 7.0 - fly);
		float fade = smoothstep(0.0, 0.25, z) * smoothstep(1.0, 0.75, z);
		vec2 q = rot(spin * (1.0 - z) * 2.2 + fl) * p * mix(0.6, 9.0, z);
		vec2 c = floor(q);
		vec2 o = q - c;
		float h = h1(c + fl * 13.1);
		if (h < 0.55) continue;
		vec2 sp = vec2(h1(c + 3.7 + fl), h1(c + 9.1 + fl)) * 0.8 + 0.1;
		float size = mix(0.09, 0.012, z);
		float d = length(o - sp);
		vec3 tint = mix(vec3(1.0, 0.86, 0.92), vec3(0.85, 0.9, 1.0), h1(c + 5.5));
		acc += tint * smoothstep(size, 0.0, d) * fade * (0.5 + 1.2 * (h - 0.55) / 0.45) * mix(2.0, 0.6, z);
	}
	return acc;
}

vec3 nebula(vec2 p, float t) {
	float n = fbm(p * 1.6 + vec2(t * 0.01, -t * 0.006) + fbm(p * 2.2 - t * 0.01));
	return mix(vec3(0.008, 0.01, 0.03), vec3(0.06, 0.05, 0.12), smoothstep(0.35, 0.85, n)) + vec3(0.18, 0.12, 0.05) * smoothstep(0.7, 0.95, n) * 0.4;
}

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float asp = uRes.x / uRes.y;
	vec2 p = (uv - 0.5) * vec2(asp, 1.0);
	vec3 base = nebula(p, uTime);
	// 合在一起：星轨 + 纵深
	vec3 tr = trails(p, uPhi, uTrail);
	vec3 dp = depthStars(p, uFly, uSpin);
	vec3 full = base + tr * uTrails + dp * uDepth;
	// 分屏：左半只有纵深（静止，不转）——珍珠队 · 空间；右半只有星轨（平面）——金刚队 · 时间
	vec2 pl = (uv - vec2(0.25, 0.5)) * vec2(asp, 1.0);
	vec3 left = base * vec3(1.0, 0.9, 0.95) + depthStars(pl, uFly, 0.0) * vec3(1.0, 0.86, 0.94) * 1.2 + vec3(0.14, 0.08, 0.12) * (1.0 - smoothstep(0.0, 0.7, length(pl)));
	vec3 right = base * vec3(0.85, 0.92, 1.1) + trails(p, uPhi, uTrail) * vec3(0.7, 0.85, 1.25) + vec3(0.05, 0.08, 0.18) * (1.0 - smoothstep(0.0, 0.7, length((uv - vec2(0.75, 0.5)) * vec2(asp, 1.0))));
	vec3 sp = uv.x < 0.5 ? left : right;
	float seam = 1.0 - smoothstep(uGap * 0.6, uGap, abs(uv.x - 0.5));
	sp *= 1.0 - seam;
	vec3 col = mix(full, sp, uSplit);
	outColor = vec4(col, 1.0);
}`;

/** 点题的字：从模糊里浮出来，细金色 */
const Word: React.FC<{ch: string; x: number; y: number; size: number; a: number; rgb: string; spacing?: number}> = ({ch, x, y, size, a, rgb, spacing = 0}) => {
	if (a <= 0.01) return null;
	return (
		<div
			style={{
				position: 'absolute',
				left: x - 400,
				top: y - size * 0.62,
				width: 800,
				textAlign: 'center',
				fontFamily: SERIF,
				fontWeight: 600,
				fontSize: size,
				letterSpacing: spacing,
				paddingLeft: spacing,
				lineHeight: 1.2,
				opacity: a,
				color: '#f6e6bb',
				filter: `blur(${(1 - a) * 12}px)`,
				textShadow: `0 0 18px rgba(${rgb},0.85), 0 0 60px rgba(${rgb},0.45), 0 2px 10px rgba(0,0,0,0.6)`,
			}}
		>
			{ch}
		</div>
	);
};

/** 速度对帧积分，得到累计的转角 / 飞行距离（各帧确定，不依赖渲染顺序） */
const integrate = (f: number, from: number, speed: (t: number) => number) => {
	let s = 0;
	for (let t = from; t < f; t++) s += speed(t);
	return s;
};

const Cosmos2D: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.l40 - 20, T.l40 + 15, T.lakes + 10, T.lakes + 45], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const merge = ease(prog(f, T.l41, T.l41 + 70));
	const split = ease(prog(f, T.l42 + 5, T.l42 + 45));
	// 时间：先慢后快地转起来，星轨越拖越长
	const spinSpeed = (t: number) => 0.0035 + 0.0045 * prog(t, T.zhou, T.zhou + 60);
	const phi = integrate(f, T.l40 - 20, spinSpeed);
	const trail = 0.08 + 2.4 * ease(prog(f, T.zhou, T.yu + 30)) - 1.2 * merge * (1 - split);
	const trails = interpolate(f, [T.l40 - 10, T.zhou + 20], [0.15, 1], clamp) * (1 - 0.45 * merge * (1 - split));
	// 空间：往深处飞
	const flySpeed = (t: number) => 0.0012 + 0.0042 * prog(t, T.yu - 10, T.yu + 50) + 0.0018 * prog(t, T.l41, T.l41 + 60);
	const fly = integrate(f, T.l40 - 20, flySpeed);
	const depth = interpolate(f, [T.yu - 10, T.yu + 40], [0, 1], clamp);
	const spin = 1.6 * merge;
	const zhouA = interpolate(f, [T.zhou + 6, T.zhou + 36], [0, 1], clamp);
	const yuA = interpolate(f, [T.yu + 6, T.yu + 36], [0, 1], clamp);
	// 字的位置：宙在右、宇在左 → 合成"宇宙" → 分屏各回一边
	const xYu = 640 + 210 * merge - 370 * split;
	const xZhou = 1280 - 210 * merge + 370 * split;
	const y = 470 - 30 * merge * (1 - split);
	const size = 150 + 30 * merge * (1 - split);
	return (
		<AbsoluteFill style={{opacity: o, overflow: 'hidden', background: '#020206'}}>
			<ShaderCanvas
				frag={STARS_FRAG}
				width={1920}
				height={1080}
				scale={0.75}
				uniforms={{uTime: f / 30, uPhi: phi, uTrail: trail, uTrails: trails, uFly: fly, uDepth: depth, uSpin: spin, uSplit: split, uGap: 0.006 + 0.018 * split}}
				style={{position: 'absolute', inset: 0}}
			/>
			<Word ch="宇" x={xYu} y={y} size={size} a={yuA} rgb={PEARL} />
			<Word ch="宙" x={xZhou} y={y} size={size} a={zhouA} rgb={BLUE} />
			<div style={{position: 'absolute', left: 0, width: 960, top: 640, textAlign: 'center', opacity: split, fontFamily: SERIF, fontSize: 38, letterSpacing: 12, paddingLeft: 12, color: `rgb(${PEARL})`, textShadow: `0 0 18px rgba(${PEARL},0.8), 0 2px 8px rgba(0,0,0,0.8)`}}>珍珠队 · 空间</div>
			<div style={{position: 'absolute', left: 960, width: 960, top: 640, textAlign: 'center', opacity: split, fontFamily: SERIF, fontSize: 38, letterSpacing: 12, paddingLeft: 12, color: `rgb(${BLUE})`, textShadow: `0 0 18px rgba(${BLUE},0.8), 0 2px 8px rgba(0,0,0,0.8)`}}>金刚队 · 时间</div>
		</AbsoluteFill>
	);
};

// ── 2D：三座湖 ──

/** 心齐湖 · 艾姆利多、立志湖 · 亚克诺姆、睿智湖 · 由克希（52poke「心齐湖」「立志湖」「睿智湖」） */
const LAKES = [
	{name: '心齐湖', en: 'LAKE VERITY', src: 'pokemon/mesprit/art.png', rgb: '255,140,190'},
	{name: '立志湖', en: 'LAKE VALOR', src: 'pokemon/azelf/art.png', rgb: '120,170,255'},
	{name: '睿智湖', en: 'LAKE ACUITY', src: 'pokemon/uxie/art.png', rgb: '255,214,110'},
];
const PANEL_W = 560;
const PANEL_X = [960 - PANEL_W * 1.5 - 30, 960 - PANEL_W / 2, 960 + PANEL_W / 2 + 30];
/** 三只的光点在画面上的位置（三联画里的位置 → 云雾遗迹里飞向中间） */
const orbStart = (i: number) => ({x: PANEL_X[i] + PANEL_W / 2, y: 410});

const LakePanel: React.FC<{f: number; i: number}> = ({f, i}) => {
	const L = LAKES[i];
	const t0 = T.lakes - 8 + i * 16;
	const a = interpolate(f, [t0, t0 + 24], [0, 1], clamp);
	const rise = ease(prog(f, t0 + 10, t0 + 60));
	const bob = Math.sin(f * 0.05 + i * 2) * 8;
	const shrink = prog(f, T.ruins - 10, T.ruins + 30);
	const x = PANEL_X[i];
	const H = 300;
	const cy = 560 - 90 * rise + bob;
	return (
		<div style={{position: 'absolute', left: x, top: 90, width: PANEL_W, height: 740, opacity: a, overflow: 'hidden', borderRadius: 4, boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.6)'}}>
			{/* 夜空、远山、湖面 */}
			<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #120a1e 0%, #2a1638 45%, #4a2a4e 58%, #160c1c 60%, #0b0712 100%)'}} />
			<svg width={PANEL_W} height={780} style={{position: 'absolute', inset: 0}}>
				<path d={`M0,470 L${PANEL_W * 0.2},${420 + i * 8} L${PANEL_W * 0.38},450 L${PANEL_W * 0.6},${400 - i * 6} L${PANEL_W * 0.82},445 L${PANEL_W},430 L${PANEL_W},470 Z`} fill="#140a1a" />
				{Array.from({length: 14}, (_, k) => {
					const y = 480 + k * k * 1.7 + ((f * 0.4 + k * 9) % 12);
					return <line key={k} x1={(rnd(k + i * 7) * 0.4) * PANEL_W} y1={y} x2={(0.6 + rnd(k * 3 + i) * 0.4) * PANEL_W} y2={y} stroke={`rgba(${L.rgb},${0.08 + 0.1 * (1 - k / 14)})`} strokeWidth={1.2} />;
				})}
			</svg>
			{/* 湖面上的倒影光 */}
			<div style={{position: 'absolute', left: PANEL_W / 2 - 60, top: 470, width: 120, height: 300, background: `linear-gradient(180deg, rgba(${L.rgb},${0.35 * rise}) 0%, rgba(${L.rgb},0) 100%)`, filter: 'blur(14px)'}} />
			{/* 剪影：只露轮廓和自身的光 */}
			<Img
				src={staticFile(L.src)}
				style={{position: 'absolute', left: PANEL_W / 2 - H / 2, top: cy - H / 2, width: H, height: H, opacity: 1 - shrink, filter: `brightness(0) drop-shadow(0 0 4px rgba(${L.rgb},0.95)) drop-shadow(0 0 26px rgba(${L.rgb},0.65))`}}
			/>
			<div style={{position: 'absolute', left: 0, right: 0, top: 636, textAlign: 'center', fontFamily: SERIF, fontSize: 34, letterSpacing: 10, color: 'rgba(240,236,246,0.9)', textShadow: `0 0 14px rgba(${L.rgb},0.7)`}}>{L.name}</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: 682, textAlign: 'center', fontFamily: CINZEL, fontSize: 16, letterSpacing: 6, color: 'rgba(230,226,240,0.6)'}}>{L.en}</div>
		</div>
	);
};

const Lakes2D: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.lakes - 10, T.lakes + 10, T.ruins, T.ruins + 40], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	return (
		<AbsoluteFill style={{opacity: o}}>
			{LAKES.map((_, i) => (
				<LakePanel key={i} f={f} i={i} />
			))}
		</AbsoluteFill>
	);
};

// ── 2D：云雾遗迹，三道光合成红色锁链 ──

const FOG_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uRed;
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
	float n = fbm(p * 1.4 + vec2(uTime * 0.03, uTime * 0.01) + fbm(p * 0.9 - uTime * 0.02) * 1.1);
	vec3 col = mix(vec3(0.07, 0.06, 0.1), vec3(0.36, 0.33, 0.42), smoothstep(0.3, 0.85, n));
	col = mix(col, col * vec3(1.0, 0.86, 0.9) + vec3(0.25, 0.02, 0.04) * smoothstep(0.7, 0.0, length((uv - vec2(0.5, 0.5)) * vec2(1.6, 1.0))), uRed);
	outColor = vec4(col, 1.0);
}`;

const STONES = 'M120,1080 L150,560 L250,540 L280,1080 Z M330,1080 L345,700 L420,690 L440,1080 Z M1520,1080 L1540,600 L1650,585 L1690,1080 Z M1730,1080 L1760,720 L1830,700 L1850,1080 Z M0,1080 L0,880 L180,900 L420,960 L700,1000 L960,1010 L1240,1000 L1520,960 L1760,900 L1920,870 L1920,1080 Z';
const STONES_FAR = 'M560,1000 L575,740 L620,735 L630,1000 Z M1280,1000 L1292,760 L1335,752 L1345,1000 Z M760,1000 L770,830 L800,826 L806,1000 Z';

/** 锁链：沿一条下垂的弧线排开的环，一环横一环竖 */
const CHAIN_N = 17;
const chainPt = (k: number, sway: number) => {
	const t = k / (CHAIN_N - 1);
	const x = 400 + t * 1120;
	const y = 450 + Math.sin(t * Math.PI) * 130 + Math.sin(t * Math.PI * 2 + sway) * 10;
	return {x, y, ang: Math.atan2(Math.cos(t * Math.PI) * 130 * Math.PI / 1120, 1) * (180 / Math.PI)};
};

export const Ruins2D: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.ruins - 10, T.ruins + 30], [0, 1], clamp);
	if (o <= 0) return null;
	const form = prog(f, T.chain, T.chain + 50);
	const red = prog(f, T.chain - 10, T.chain + 40);
	const sway = f * 0.03;
	const pulse = 0.8 + 0.2 * Math.sin(f * 0.09);
	// 三道光：从三座湖的位置飞向中间，绕一圈后合在一起
	const orbs = LAKES.map((L, i) => {
		const s = orbStart(i);
		const t = ease(prog(f, T.ruins - 10, T.chain));
		const ang = i * 2.094 + t * 7;
		const r = 260 * (1 - t) + 20;
		const cx = 960;
		const cy = 520;
		const x = s.x * (1 - t) + (cx + Math.cos(ang) * r) * t;
		const y = s.y * (1 - t) + (cy + Math.sin(ang) * r * 0.5) * t;
		return {x, y, rgb: L.rgb, a: 1 - prog(f, T.chain, T.chain + 10)};
	});
	return (
		<AbsoluteFill style={{opacity: o}}>
			<ShaderCanvas frag={FOG_FRAG} width={1920} height={1080} scale={0.5} uniforms={{uTime: f / 30, uRed: red}} style={{position: 'absolute', inset: 0}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<path d={STONES_FAR} fill="rgba(20,16,26,0.55)" />
				<path d={STONES} fill="#0b090f" />
			</svg>
			{orbs.map((p, i) =>
				p.a > 0.01 ? (
					<div key={i} style={{position: 'absolute', left: p.x - 70, top: p.y - 70, width: 140, height: 140, borderRadius: '50%', opacity: p.a, background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(${p.rgb},0.8) 18%, rgba(${p.rgb},0.25) 45%, rgba(0,0,0,0) 70%)`, mixBlendMode: 'screen'}} />
				) : null,
			)}
			{/* 合在一起时一闪红光 */}
			<div style={{position: 'absolute', left: 960 - 420, top: 520 - 420, width: 840, height: 840, borderRadius: '50%', opacity: interpolate(f, [T.chain - 4, T.chain + 4, T.chain + 40], [0, 1, 0], clamp), background: 'radial-gradient(circle, rgba(255,230,220,1) 0%, rgba(255,60,50,0.7) 20%, rgba(200,20,30,0.25) 45%, rgba(0,0,0,0) 70%)', mixBlendMode: 'screen'}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 0 6px rgba(255,70,60,${0.95 * pulse})) drop-shadow(0 0 26px rgba(220,30,40,${0.6 * pulse}))`}}>
				{Array.from({length: CHAIN_N}, (_, k) => {
					// 从中间往两头一环环长出来
					const d = Math.abs(k - (CHAIN_N - 1) / 2) / ((CHAIN_N - 1) / 2);
					const v = prog(form, d * 0.75, d * 0.75 + 0.25);
					if (v <= 0) return null;
					const p = chainPt(k, sway);
					const flat = k % 2 === 0;
					return (
						<g key={k} transform={`translate(${p.x},${p.y}) rotate(${p.ang}) scale(${v})`}>
							{flat ? <ellipse rx={44} ry={22} fill="none" stroke="#ff4a3e" strokeWidth={12} /> : <rect x={-42} y={-6} width={84} height={12} rx={6} fill="#d9282a" />}
							{flat ? <ellipse rx={44} ry={22} fill="none" stroke="rgba(255,210,200,0.85)" strokeWidth={3} /> : <rect x={-38} y={-1.5} width={76} height={3} rx={1.5} fill="rgba(255,190,180,0.8)" />}
						</g>
					);
				})}
			</svg>
		</AbsoluteFill>
	);
};

// ── 合在一起 ──

export const CosmosMaster: React.FC<{f: number}> = ({f}) => {
	const show3D = f < T.hut + 40;
	const lum = show3D ? 0.6 : 0.2;
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			{show3D ? <Gate3D f={f} /> : null}
			<HutOutside f={f} />
			<HutInside f={f} />
			<Cosmos2D f={f} />
			<Lakes2D f={f} />
			<Ruins2D f={f} />
			<AbsoluteFill style={{background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${0.55 - 0.15 * lum}) 100%)`, pointerEvents: 'none'}} />
			{SUBS_COSMOS.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			<Grain opacity={0.12 - 0.05 * lum} />
		</AbsoluteFill>
	);
};

export const SUBS_COSMOS: [number, number, string, string, SubtitleSource?][] = [
	[T.l37, T.l37 + 112, '收留你的，是银杏商会的旅行商人望罗。', 'The one who took you in was Volo, a traveling merchant of the Ginkgo Guild.'],
	[T.l38, T.l38 + 115, '望罗总是笑着出现，对神话和遗迹好奇得不得了。', 'Volo was always smiling, always endlessly curious about myths and ruins.'],
	[T.l39, T.l39 + 160, '他把你带到一间隐居的小屋。屋主叫吾思，守着祖先传下来的传说。', 'He led you to a secluded hut, home to Cogita, keeper of the legends her ancestors passed down.'],
	[
		T.l40,
		T.l40 + 132,
		'「往古来今谓之宙，四方上下谓之宇。」',
		'"The expanse from antiquity to eternity and the expanse to all sides, above, and below..."',
		{zh: '《传说 阿尔宙斯》吾思台词', en: 'Bulbapedia, Cogita/Quotes'},
	],
	[T.l41, T.l41 + 112, '吾思说：「时间和空间交织在一起，才叫宇宙。」', 'Cogita said: "Time and space woven together—that is what makes the universe."'],
	[T.l42, T.l42 + 148, '金刚队只认时间，珍珠队只认空间——两边都只看见了一半。', 'The Diamond Clan saw only time, the Pearl Clan only space. Each saw only half.'],
	[T.l43, T.l43 + 132, '按照古老的传说，要先去三座湖，见湖里的三只宝可梦。', 'The old legends said to visit the three lakes, and the three Pokémon who dwell there.'],
	[T.l44, T.l44 + 125, '它们给的东西，在云雾遗迹里合成了一条红色锁链。', 'Their gifts, brought to the Shrouded Ruins, became a Red Chain.'],
	[T.l45, T.l45 + 210, '吾思说：「正因为有心，时间和空间才能被认知。红色锁链，是为了正确地『看待』世界。」', 'Cogita said: "Time and space exist only because minds perceive them. The Red Chain lets one see creation as it truly is."'],
];

