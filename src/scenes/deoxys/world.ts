import {Camera, cameraBasis, Env, FrameData, Post, STRIDE} from './engine';
import {complement, GLYPH} from './glyphs';

// 《坠落的序列》整期画面：一切都是整期时间轴 t（30fps 帧号）的纯函数，各段只是同一条时间轴上的窗口。
// 场景：太空（陨石逼近行星）→ 显微（DNA 螺旋）→ 黑暗里诞生 → 行星轨道上（边缘极光）→ 夜海里的诞生之岛 → 太空（巨大陨石、烈空坐）→ 冰原上的极光

export type FigureSet = {
	n: number;
	cell: number;
	crystal: [number, number];
	x: Float32Array;
	y: Float32Array;
	z: Float32Array;
	r: Float32Array;
	g: Float32Array;
	b: Float32Array;
	lum: Float32Array;
	cr: Uint8Array;
};
export type Assets = {normal: FigureSet; attack: FigureSet; defense: FigureSet; speed: FigureSet; ray: FigureSet};

export const parseFigure = (j: {n: number; stride: number; cell: number; crystal: [number, number] | null; data: number[]}): FigureSet => {
	const n = j.n;
	const s = j.stride;
	const f = (k: number) => Float32Array.from({length: n}, (_, i) => j.data[i * s + k]);
	return {
		n,
		cell: j.cell,
		crystal: j.crystal ?? [0, 0],
		x: f(0),
		y: f(1),
		z: f(2),
		r: f(3),
		g: f(4),
		b: f(5),
		lum: f(6),
		cr: Uint8Array.from({length: n}, (_, i) => j.data[i * s + 8]),
	};
};

// ---------- 工具 ----------
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ss = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eout = (t: number) => 1 - Math.pow(1 - t, 3);
const ein = (t: number) => t * t * t;
const hash = (i: number, k = 0) => {
	let h = Math.imul(i | 0, 374761393) ^ Math.imul((k | 0) + 1, 668265263);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
};
const DEG = Math.PI / 180;
type V3 = [number, number, number];
const v3lerp = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const norm = (v: V3): V3 => {
	const l = Math.hypot(...v) || 1;
	return [v[0] / l, v[1] / l, v[2] / l];
};

/** Catmull-Rom 关键帧曲线（各段速度连续，镜头不会在关键帧处顿一下） */
const spline = (keys: [number, number][], t: number) => {
	if (t <= keys[0][0]) return keys[0][1];
	const last = keys[keys.length - 1];
	if (t >= last[0]) return last[1];
	let i = 0;
	while (keys[i + 1][0] < t) i++;
	const [t1, p1] = keys[i];
	const [t2, p2] = keys[i + 1];
	const p0 = i > 0 ? keys[i - 1][1] : p1;
	const p3 = i + 2 < keys.length ? keys[i + 2][1] : p2;
	const t0 = i > 0 ? keys[i - 1][0] : t1 - (t2 - t1);
	const t3 = i + 2 < keys.length ? keys[i + 2][0] : t2 + (t2 - t1);
	const u = (t - t1) / (t2 - t1);
	const m1 = ((p2 - p0) / (t2 - t0)) * (t2 - t1);
	const m2 = ((p3 - p1) / (t3 - t1)) * (t2 - t1);
	const u2 = u * u;
	const u3 = u2 * u;
	return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
};

// ---------- 颜色 ----------
const COLD_DIM: V3 = [0.337, 0.392, 0.435];
const COLD_HI: V3 = [0.624, 0.706, 0.749];
const TEXT: V3 = [0.745, 0.773, 0.812];
const AMBER: V3 = [0.8, 0.69, 0.52];
const ROSE: V3 = [0.86, 0.45, 0.6];
const RED: V3 = [0.86, 0.36, 0.32];
const GOLD: V3 = [0.95, 0.77, 0.42];
const CREAM: V3 = [0.95, 0.92, 0.92];
const JADE: V3 = [0.42, 0.62, 0.55];
const mixCol = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------- 关键时间（整期 30fps 帧号） ----------
export const T = {
	zoom: 300, // 推近陨石表面
	swap: 401, // 从陨石表面连续深入到显微世界
	hit: 580, // 激光击中螺旋
	unravel: 760,
	ignite: 1010, // 水晶体亮起（叫声）
	orbit: 1400, // 行星从下方浮现
	mA: 1510,
	mD: 1660,
	mS: 1810,
	meteors: 2095, // 行星上的陨石逐处亮起，每亮一处变换一次形态
	contract: 2575, // 收缩成一点光
	fall: 2620, // 坠向行星
	swap2: 2665, // 坠入大气，切到夜海
	land: 2715, // 落在诞生之岛上，成为黑色的三角形石头
	crack: 3235,
	islandFade: 3345,
	chart: 3385, // 夜空里铺开星图：巨大的陨石，半路改变轨道
	bend: 3625,
	swap3: 3865, // 镜头仰着，切到太空
	impact: 4205,
	burst: 4445,
	battle: 4600, // 宇宙之战
	laser: 4730,
	cosmic: 4835,
	strike: 4920, // 烈空坐撞上代欧奇希斯，身体被打散
	recover: 4945,
	clash: 5040,
	cool: 5050,
	swap5: 5230, // 镜头俯向行星，切到丰缘的夜海（流星雨）
	swap4: 5800, // 仰望夜空时切到冰原（只见星空的一帧两边一致）
	end: 6120,
};
// 第 4 段的形态变换之后，各地陨石让它依次变成：普通 → 攻击 → 防御 → 速度 → 普通 → 攻击（朱紫陨石的切换顺序）
const METEOR_GAP = 48;
const meteorAt = (k: number) => T.meteors + k * METEOR_GAP;

// ---------- 场景布局 ----------
const PLANET_R = 300;
const PLANET_S1: V3 = [0, -306, 60];
const PLANET_S4: V3 = [0, 0.3 - 305, 30];
const PLANET_S6: V3 = [0, -1.6 - 302, 40];
const SEA_Y = -3.1;
const ICE_Y = -2.6;
const FIG_C: V3 = [0, 0, 9.5];
const FIG_H = 5.0;
const ISL: V3 = [0, SEA_Y, 14];
const ISL_R = 3.2;
const ISL_H = 0.55;
const ISL_FIG: V3 = [0, 0.05, 14];
const ISL_FIG_H = 4.2;
const HELIX_C: V3 = [0, 0.15, 9];
const HELIX_L = 30;
const HELIX_R = 0.95;
const NB = 140;
const HD: V3 = norm([Math.cos(20 * DEG), 0.05, Math.sin(20 * DEG)]);
const HN1: V3 = (() => {
	const d = HD[1];
	return norm([-d * HD[0], 1 - d * HD[1], -d * HD[2]]);
})();
const HN2: V3 = [HD[1] * HN1[2] - HD[2] * HN1[1], HD[2] * HN1[0] - HD[0] * HN1[2], HD[0] * HN1[1] - HD[1] * HN1[0]];
const S_HIT = 0.56;
const helixAxis = (s: number): V3 => [HELIX_C[0] + HD[0] * (s - 0.5) * HELIX_L, HELIX_C[1] + HD[1] * (s - 0.5) * HELIX_L, HELIX_C[2] + HD[2] * (s - 0.5) * HELIX_L];
const HIT_POS = helixAxis(S_HIT);
const LASER_FROM: V3 = [HIT_POS[0] - 18, HIT_POS[1] + 10, HIT_POS[2] + 6];

const METEOR_C: V3 = [0, 12.4, 47];
const METEOR_R = 10;
const PM0: V3 = [8, 34, 160];
const TO_CAM: V3 = norm([0 - METEOR_C[0], -1.4 - METEOR_C[1], 1.6 - METEOR_C[2]]);
const WARM_H = 21;
const RAY_H = 17;

// 第 1 段的陨石：从左上方远处朝镜头与行星飞来
const M1_A: V3 = [75, 30, 170];
const M1_B: V3 = [8, 1.5, 24];
const M1_R = 4;
export const meteor1 = (t: number): V3 => {
	const u = clamp01(t / 330);
	const e = eout(u) * 0.55 + u * 0.45;
	const p = v3lerp(M1_A, M1_B, e);
	const extra = Math.max(0, t - 330) * 0.02;
	return [p[0] + extra * 0.5, p[1] - extra * 0.2, p[2] - extra];
};
const M1_DIR: V3 = norm([M1_B[0] - M1_A[0], M1_B[1] - M1_A[1], M1_B[2] - M1_A[2]]);

// ---------- 镜头 ----------
// 每行：[时间, x, y, z, pitch, yaw]，fov 除第一段外都是 40（显微段 38）
const CAM_ROWS: [number, number, number, number, number, number][] = [
	[401, 0, 0, -2.0, 0, -2],
	[900, 0, 0, -0.4, 0, 1.5],
	[1380, 0.2, 0.05, 1.0, 0, -1.5],
	[1520, 0, 0.3, -0.8, -1, 0],
	// 各地陨石：略微后退、俯一点，让行星表面的光点进画
	[2100, 0.1, 0.3, -1.3, -2, 0.4],
	[2400, 0.1, 0.4, -1.9, -3, 0.5],
	[2565, 0.1, 0.3, -1.7, -2.8, 0.5],
	[2620, 0.1, 0.1, -1.2, -6, 0.5],
	[2664.5, 0.1, -0.4, -0.4, -16, 0.5],
	// 夜海与小岛
	[2665, 0, -1.6, -1.0, 24, 0],
	[2720, 0, -1.6, -1.0, 3, 0],
	[2900, 0, -1.6, -0.6, 3.5, 0],
	// 追石头：升高、俯看岛顶，看清 L 形的路线
	[3010, 0, 0.9, 5.2, -15, 0],
	[3200, 0, 0.7, 6.0, -14, 0.4],
	[3250, 0, -0.6, 3.6, -4, 0.2],
	[3330, 0, -1.6, 0.8, 6, 0],
	[3390, 0, -1.6, 0.8, 17, 0],
	[3440, 0, -1.6, 0.8, 22, 0],
	[3700, 0, -1.6, 0.8, 22.5, 0.3],
	[3864.5, 0, -1.6, 0.8, 22, 0],
	// 太空：巨大陨石、烈空坐、宇宙之战
	[3865, 0, -1.6, 0.8, 22, 0],
	[3945, 0, -1.6, 1.0, 11, 0],
	[4045, 0, -1.6, 1.2, 13, 0],
	[4205, 0, -1.6, 1.6, 18.5, 0],
	[4315, 0, -1.4, 2.0, 17, 0],
	[4600, 0, -1.2, 2.5, 17, -0.4],
	[4760, 0, -1.2, 2.5, 16.5, 1.2],
	[4900, 0, -1.2, 2.4, 16.5, 0.8],
	[5050, 0, -1.2, 2.6, 17, 0],
	[5150, 0, -1.2, 2.8, 4, 0],
	[5229.5, 0, -1.3, 3.0, -4, 0],
	// 丰缘的夜海，流星雨；最后仰望星空
	[5230, 0, -1.4, 2.0, 20, 0],
	[5300, 0, -1.4, 2.2, 8, 0],
	[5600, 0, -1.4, 2.6, 11, -1.5],
	[5700, 0, -1.4, 2.8, 16, -0.8],
	[5799.5, 0, -1.4, 3.0, 30, 0],
	// 冰原上的极光
	[5800, 0, -1.4, 3.0, 30, 0],
	[5900, 0, -1.4, 3.2, 10, 0],
	[6120, 0, -1.4, 4.2, 12, 0.4],
];
type Track = 'x' | 'y' | 'z' | 'pitch' | 'yaw' | 'fov';
const COL: Record<Track, number> = {x: 1, y: 2, z: 3, pitch: 4, yaw: 5, fov: -1};
const CAM_KEYS = Object.fromEntries(
	(['x', 'y', 'z', 'pitch', 'yaw', 'fov'] as const).map((n) => [n, CAM_ROWS.map((r) => [r[0], n === 'fov' ? (r[0] < 1400 ? 38 : 40) : r[COL[n]]] as [number, number])]),
) as Record<Track, [number, number][]>;
// 切场处把曲线断开，避免样条跨过切点
const SPLITS = [T.swap2, T.swap3, T.swap5, T.swap4];
const track = (name: Track, t: number) => {
	const keys = CAM_KEYS[name];
	let lo = 0;
	let hi = keys.length;
	for (const s of SPLITS) {
		const idx = keys.findIndex(([k]) => k === s);
		if (t >= s) lo = idx;
		else {
			hi = idx;
			break;
		}
	}
	return spline(keys.slice(lo, hi), t);
};

const exteriorCamera = (t: number): Camera => {
	const base: Camera = {pos: [0, 0, t * 0.003], yaw: 0, pitch: -3 * DEG, fov: 40 * DEG};
	if (t < T.zoom) return base;
	// 推近陨石：镜头转向它，视野收窄，表面的字越来越大
	const m = meteor1(t);
	const p = base.pos;
	const dx = m[0] - p[0];
	const dy = m[1] - p[1];
	const dz = m[2] - p[2];
	const a = eio(clamp01((t - T.zoom) / (T.swap - T.zoom)));
	return {pos: p, yaw: lerp(0, Math.atan2(dx, dz), a), pitch: lerp(-3 * DEG, Math.atan2(dy, Math.hypot(dx, dz)), a), fov: 40 * DEG * Math.pow(10 / 40, a)};
};
const MICRO_READY = 520;
// 同一个岩体随显微倍率放大；镜头、表层、内层共用这个中心，不再切换两套坐标。
const meteorInterior = (t: number) => ({
	c: v3lerp(meteor1(t), HELIX_C, ss(T.swap, MICRO_READY, t)),
	r: M1_R * lerp(1, 4, ss(T.swap, 485, t)),
});
export const cameraAt = (t: number): Camera => {
	if (t < T.swap) return exteriorCamera(t);
	const cam: Camera = {pos: [track('x', t), track('y', t), track('z', t)], yaw: track('yaw', t) * DEG, pitch: track('pitch', t) * DEG, fov: track('fov', t) * DEG};
	if (t < MICRO_READY) {
		const start = exteriorCamera(T.swap);
		const u = ss(T.swap, MICRO_READY, t);
		return {pos: v3lerp(start.pos, cam.pos, u), yaw: lerp(start.yaw, cam.yaw, u), pitch: lerp(start.pitch, cam.pitch, u), fov: lerp(start.fov, cam.fov, ss(425, MICRO_READY, t))};
	}
	// 留在战场看清消散与退场，再俯向行星；只改第十段内的镜头。
	if (t >= T.cool && t < T.swap5) cam.pitch = lerp(track('pitch', T.cool), track('pitch', T.swap5 - 0.5), ss(5140, T.swap5 - 0.5, t)) * DEG;
	return cam;
};

// ---------- 粒子输出 ----------
type P = {x: number; y: number; z: number; s: number; g: number; r: number; gg: number; b: number; a: number; blur: number; vx: number; vy: number; vz: number; st: number};
const mkP = (): P => ({x: 0, y: 0, z: 0, s: 0, g: 0, r: 0, gg: 0, b: 0, a: 0, blur: 0, vx: 0, vy: 0, vz: 0, st: 0});
const setCol = (p: P, c: V3, k: number) => {
	p.r = c[0] * k;
	p.gg = c[1] * k;
	p.b = c[2] * k;
};
const still = (p: P) => {
	p.vx = p.vy = p.vz = 0;
	p.st = 0;
	p.blur = 0;
	p.a = 1;
};

class Writer {
	buf: Float32Array;
	n = 0;
	constructor(cap: number) {
		this.buf = new Float32Array(cap * STRIDE);
	}
	push(p: P) {
		if (p.a <= 0.002) return;
		const o = this.n * STRIDE;
		const b = this.buf;
		b[o] = p.x;
		b[o + 1] = p.y;
		b[o + 2] = p.z;
		b[o + 3] = p.s;
		b[o + 4] = p.vx;
		b[o + 5] = p.vy;
		b[o + 6] = p.vz;
		b[o + 7] = p.g;
		b[o + 8] = p.r;
		b[o + 9] = p.gg;
		b[o + 10] = p.b;
		b[o + 11] = p.a;
		b[o + 12] = p.blur;
		b[o + 13] = p.st;
		this.n++;
	}
}

// 构成宝可梦和陨石的字：碱基字母为主，夹一点碱基中文与片假名
const figGlyph = (i: number, t: number) => {
	const ep = Math.floor(t / (40 + hash(i, 91) * 90) + hash(i, 92) * 9);
	const r = hash(i, 93 + ep);
	if (r < 0.74) return Math.floor((r / 0.74) * 4);
	if (r < 0.9) return 4 + Math.floor(((r - 0.74) / 0.16) * 4);
	return 8 + Math.floor(((r - 0.9) / 0.1) * 5);
};

// ---------- 宝可梦（字的雕塑） ----------
const figPoint = (f: FigureSet, i: number, c: V3, h: number, t: number, out: P) => {
	const sway = 0.045 * Math.sin(t / 95);
	const x = f.x[i] * h;
	const z = f.z[i] * h * 0.5;
	const cs = Math.cos(sway);
	const sn = Math.sin(sway);
	const breathe = 1 + 0.006 * Math.sin(t / 22);
	out.x = c[0] + x * cs + z * sn;
	out.y = c[1] + f.y[i] * h * breathe + 0.01 * h * Math.sin(t / 48);
	out.z = c[2] - x * sn + z * cs;
	out.s = f.cell * h * (1.15 + 0.35 * hash(i, 5));
};
const crystalWorld = (f: FigureSet, c: V3, h: number, t: number): V3 => {
	const sway = 0.045 * Math.sin(t / 95);
	const x = f.crystal[0] * h;
	return [c[0] + x * Math.cos(sway), c[1] + f.crystal[1] * h + 0.01 * h * Math.sin(t / 48), c[2] - x * Math.sin(sway) - 0.08];
};

const coldFigColor = (f: FigureSet, i: number, glow: number, out: P) => {
	if (f.cr[i]) {
		setCol(out, AMBER, glow);
		return;
	}
	const l = f.lum[i];
	const b = 0.1 + 0.95 * Math.pow(l, 1.15);
	setCol(out, mixCol(COLD_DIM, COLD_HI, clamp01(l * 1.2)), b * 1.55);
};

const warmFigColor = (f: FigureSet, i: number, glow: number, out: P) => {
	if (f.cr[i]) {
		setCol(out, GOLD, glow);
		return;
	}
	const r = f.r[i];
	const g = f.g[i];
	const b = f.b[i];
	const l = f.lum[i];
	const orange = clamp01((r - b - 0.12) * 3);
	const teal = clamp01((b - r) * 4);
	const peach: V3 = [0.86, 0.79, 0.75];
	const edge: V3 = [0.97, 0.6, 0.5];
	let c = mixCol(CREAM, mixCol(peach, edge, 0.5), orange);
	c = mixCol(c, [0.62, 0.82, 0.86], teal);
	setCol(out, c, 0.4 + 1.9 * Math.pow(l, 0.9) * (0.7 + 0.3 * g));
	if (l < 0.2) setCol(out, [0.5, 0.26, 0.36], 0.55);
};

const figGlow = (t: number) => {
	const ign = ss(T.ignite - 40, T.ignite, t);
	const peak = Math.exp(-Math.max(0, t - T.ignite) / 40) * 2.5;
	return ign * (2.2 + peak + 0.35 * Math.sin(t / 14));
};

const sphereDir = (i: number, n: number): V3 => {
	const y = 1 - ((i + 0.5) / n) * 2;
	const r = Math.sqrt(1 - y * y);
	const th = i * 2.399963229728653;
	return [Math.cos(th) * r, y, Math.sin(th) * r];
};
const rotAxis = (v: V3, ang: number): V3 => {
	const k: V3 = [0.284, 0.946, 0.189];
	const c = Math.cos(ang);
	const s = Math.sin(ang);
	const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
	const cx = k[1] * v[2] - k[2] * v[1];
	const cy = k[2] * v[0] - k[0] * v[2];
	const cz = k[0] * v[1] - k[1] * v[0];
	return [v[0] * c + cx * s + k[0] * d * (1 - c), v[1] * c + cy * s + k[1] * d * (1 - c), v[2] * c + cz * s + k[2] * d * (1 - c)];
};
// 凹凸不平的岩块轮廓
const lump = (d: V3) =>
	1 + 0.14 * Math.sin(d[0] * 3.1 + 1.3) * Math.sin(d[1] * 2.7 + 0.4) + 0.09 * Math.sin(d[2] * 5.3 + d[0] * 2.1) + 0.05 * Math.sin(d[1] * 9.7 - d[2] * 4.4);

let frameCam: Camera = {pos: [0, 0, 0], yaw: 0, pitch: 0, fov: 1};
const KEY_LIGHT: V3 = norm([-0.6, 0.55, -0.55]);

/** 字堆成的岩块：迎光面冷灰、背面暗；heat 为琥珀色的灼热（前缘与边缘） */
const rockState = (i: number, n: number, c: V3, r: number, t: number, heat: number, moveDir: V3, out: P, inner = 1) => {
	const d = rotAxis(sphereDir(i, n), t * 0.004 + 1.7);
	const rr = r * inner * lump(d) * (0.94 + 0.06 * hash(i, 81));
	out.x = c[0] + d[0] * rr;
	out.y = c[1] + d[1] * rr;
	out.z = c[2] + d[2] * rr;
	out.s = Math.max(0.08 * r * Math.sqrt(2600 / n), 0.05) * (0.9 + 0.4 * hash(i, 82));
	out.g = figGlyph(i, t);
	const cam = frameCam.pos;
	const v = norm([cam[0] - c[0], cam[1] - c[1], cam[2] - c[2]]);
	const facing = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
	const lam = Math.max(0, d[0] * KEY_LIGHT[0] + d[1] * KEY_LIGHT[1] + d[2] * KEY_LIGHT[2]);
	const limb = Math.pow(1 - Math.abs(facing), 3);
	const lead = Math.pow(Math.max(0, d[0] * moveDir[0] + d[1] * moveDir[1] + d[2] * moveDir[2]), 2);
	const small = 1 - ss(0.2, 1.2, r);
	const rock = facing > 0 ? 0.12 + 0.75 * lam : 0.06;
	const crater = 0.75 + 0.5 * hash(i, 83);
	const hot = heat * (limb * 0.9 + lead * 0.55) + small * 1.4;
	out.r = COLD_HI[0] * rock * crater * 0.8 + AMBER[0] * hot;
	out.gg = COLD_HI[1] * rock * crater * 0.8 + AMBER[1] * hot;
	out.b = COLD_HI[2] * rock * crater * 0.8 + AMBER[2] * hot;
	out.vx = out.vy = out.vz = 0;
	out.st = 0;
	out.blur = 0;
	out.a = inner;
};

// ---------- 主角粒子 ----------
const HERO_N = 2600;

const helixState = (i: number, t: number, p: P) => {
	const spin = t * 0.01 + Math.max(0, t - (T.unravel - 70)) ** 2 * 0.00004;
	if (i < NB * 6) {
		const k = Math.floor(i / 6);
		const j = i % 6;
		const s = k / (NB - 1);
		const ax = helixAxis(s);
		const th = s * HELIX_L * 1.9 + spin;
		const th2 = th + 2.4;
		const u = j / 5;
		const c1 = Math.cos(th);
		const s1 = Math.sin(th);
		const c2 = Math.cos(th2);
		const s2 = Math.sin(th2);
		p.x = ax[0] + HELIX_R * lerp(c1 * HN1[0] + s1 * HN2[0], c2 * HN1[0] + s2 * HN2[0], u);
		p.y = ax[1] + HELIX_R * lerp(c1 * HN1[1] + s1 * HN2[1], c2 * HN1[1] + s2 * HN2[1], u);
		p.z = ax[2] + HELIX_R * lerp(c1 * HN1[2] + s1 * HN2[2], c2 * HN1[2] + s2 * HN2[2], u);
		const base = Math.floor(hash(k, 11) * 4);
		const backbone = j === 0 || j === 5;
		const front = Math.max(0, t - T.hit) * 0.0055;
		const dist = Math.abs(s - S_HIT);
		const mutated = t > T.hit && dist < front;
		let g = backbone ? (j === 0 ? base : complement(base)) : hash(i, 3) < 0.5 ? GLYPH.DOT : GLYPH.DASH;
		if (mutated && backbone) {
			const r = hash(i, 17 + Math.floor((t - T.hit) / 25));
			g = r < 0.6 ? 4 + (j === 0 ? base : complement(base) % 4) : 8 + Math.floor(hash(i, 21) * 5);
		}
		p.g = g;
		p.s = backbone ? 0.2 : 0.11;
		setCol(p, COLD_HI, backbone ? 0.95 : 0.35);
		const band = mutated ? Math.exp(-Math.pow((front - dist) / 0.025, 2)) : 0;
		if (band > 0.01) {
			const c = mixCol(COLD_HI, AMBER, 0.7);
			p.r += c[0] * band * 2.2;
			p.gg += c[1] * band * 2.2;
			p.b += c[2] * band * 2.2;
			p.x += (hash(i, 31 + Math.floor(t)) - 0.5) * band * 0.08;
			p.y += (hash(i, 37 + Math.floor(t)) - 0.5) * band * 0.08;
		}
	} else {
		const m = i - NB * 6;
		const rr = 1.35 + 5.5 * Math.pow(hash(m, 2), 1.5);
		const ang = hash(m, 3) * Math.PI * 2 + t * 0.006 * (2 / rr);
		const ax = helixAxis(0.5 + (hash(m, 1) - 0.5) * 1.1);
		p.x = ax[0] + rr * (Math.cos(ang) * HN1[0] + Math.sin(ang) * HN2[0]);
		p.y = ax[1] + rr * (Math.cos(ang) * HN1[1] + Math.sin(ang) * HN2[1]);
		p.z = ax[2] + rr * (Math.cos(ang) * HN1[2] + Math.sin(ang) * HN2[2]);
		p.g = figGlyph(i, t);
		p.s = 0.05 + 0.07 * hash(m, 4);
		const tw = 0.6 + 0.4 * Math.sin(t / (12 + hash(m, 6) * 30) + hash(m, 7) * 40);
		setCol(p, COLD_HI, (0.08 + 0.32 * hash(m, 5) ** 2) * tw);
	}
	p.vx = p.vy = p.vz = 0;
	p.st = 0;
	p.blur = 0;
	p.a = 1;
};

// 两个状态之间飞行：沿一条鼓起的弧线，途中字符翻动、略微提亮
const flyBetween = (i: number, a: P, b: P, u: number, bulge: number, out: P) => {
	const e = eio(u);
	const k = Math.sin(Math.PI * e) * bulge;
	out.x = lerp(a.x, b.x, e) + (hash(i, 61) - 0.5) * 2 * k;
	out.y = lerp(a.y, b.y, e) + (hash(i, 62) - 0.5) * 2 * k;
	out.z = lerp(a.z, b.z, e) + (hash(i, 63) - 0.5) * 2 * k;
	out.s = lerp(a.s, b.s, e);
	const fl = Math.sin(Math.PI * e) * 0.5;
	out.r = lerp(a.r, b.r, e) + COLD_HI[0] * fl;
	out.gg = lerp(a.gg, b.gg, e) + COLD_HI[1] * fl;
	out.b = lerp(a.b, b.b, e) + COLD_HI[2] * fl;
	out.a = lerp(a.a, b.a, e);
	out.g = u > 0 && u < 1 ? figGlyph(i, Math.floor(e * 9) * 50 + i) : u >= 1 ? b.g : a.g;
	out.blur = 0;
	out.vx = out.vy = out.vz = 0;
	out.st = 0;
};

const sA = mkP();
const sB = mkP();
const cfA = mkP();
const cfB = mkP();

/** 冷色的代欧奇希斯；force 指定形态（诞生之岛上是普通形态），否则按第 4 段的变换时序 */
const coldFigure = (a: Assets, i: number, t: number, p: P, c: V3 = FIG_C, h = FIG_H, force?: FigureSet) => {
	let cur = force ?? a.normal;
	if (!force) {
		const seq: [number, FigureSet, number, number][] = [
			[T.mA, a.attack, 30, 42],
			[T.mD, a.defense, 30, 42],
			[T.mS, a.speed, 30, 42],
			...[a.normal, a.attack, a.defense, a.speed, a.normal, a.attack].map((f, k) => [meteorAt(k) + 4, f, 14, 28] as [number, FigureSet, number, number]),
		];
		for (const [t0, next, jit, dur] of seq) {
			const u = clamp01((t - t0 - hash(i, 71) * jit) / dur);
			if (u <= 0) break;
			if (u < 1) {
				figPoint(cur, i, c, h, t, cfA);
				coldFigColor(cur, i, figGlow(t), cfA);
				cfA.g = figGlyph(i, t);
				cfA.a = 1;
				figPoint(next, i, c, h, t, cfB);
				coldFigColor(next, i, figGlow(t), cfB);
				cfB.g = figGlyph(i, t);
				cfB.a = 1;
				flyBetween(i, cfA, cfB, u, 0.35, p);
				return;
			}
			cur = next;
		}
	}
	figPoint(cur, i, c, h, t, p);
	coldFigColor(cur, i, figGlow(t), p);
	p.g = figGlyph(i, t);
	p.vx = p.vy = p.vz = 0;
	p.st = 0;
	p.blur = 0;
	p.a = 1;
};

/** 一点光：所有字挤在一个小球里 */
const pointState = (i: number, c: V3, t: number, p: P, glow = 1) => {
	const d = sphereDir(i, HERO_N);
	const r = 0.12 * (0.5 + 0.5 * hash(i, 3));
	p.x = c[0] + d[0] * r;
	p.y = c[1] + d[1] * r;
	p.z = c[2] + d[2] * r;
	p.s = 0.06;
	p.g = figGlyph(i, t);
	setCol(p, AMBER, 0.9 * glow);
	p.vx = p.vy = p.vz = 0;
	p.st = 0;
	p.blur = 0;
	p.a = 1;
};

// 第 4 段末：光点从水晶体处坠向行星
const FALL_END: V3 = [0, -6, 34];
// 第 6 段：从夜空落到岛上，成为黑色的三角形石头；每调查一次就移到别处，沿最短（L 形）路线追上它，它就红一分
const islandTop = (x: number, z: number) => {
	const e = Math.hypot((x - ISL[0]) / 1.35, (z - ISL[2]) / 0.7) / ISL_R;
	return ISL[1] + ISL_H * Math.max(0, 1 - e * e);
};
const STOPS: [number, number][] = [
	[0, 0],
	[-1.7, 0.45],
	[1.1, -0.5],
	[2.2, 0.55],
	[-0.9, 0.85],
	[0, 0.4],
];
const stopPos = (k: number): V3 => {
	const x = ISL[0] + STOPS[k][0];
	const z = ISL[2] + STOPS[k][1];
	return [x, islandTop(x, z) + 0.42, z];
};
const SLIDE_T = [3010, 3050, 3090, 3130, 3170];
const SKY_START: V3 = [0, 16, 40];
const triStone = (t: number): V3 => {
	if (t < T.land) return v3lerp(SKY_START, stopPos(0), eio(clamp01((t - T.swap2) / (T.land - T.swap2))));
	let pos = stopPos(0);
	SLIDE_T.forEach((t0, k) => {
		const u = eio(clamp01((t - t0) / 12));
		if (u > 0) pos = v3lerp(stopPos(k), stopPos(k + 1), u);
	});
	return pos;
};
const pathDone = (k: number) => SLIDE_T[k] + 40;
const redness = (t: number) => SLIDE_T.reduce((s, _, k) => s + ss(pathDone(k) - 6, pathDone(k) + 4, t), 0) / SLIDE_T.length;
// 走过的路：先横后纵的 L 形脚印
const islandPaths = (t: number, w: Writer, p: P) => {
	if (t < SLIDE_T[0] + 14 || t > T.crack + 40) return;
	const fade = 1 - ss(T.crack, T.crack + 30, t);
	SLIDE_T.forEach((t0, k) => {
		const walk = clamp01((t - t0 - 14) / 24);
		if (walk <= 0) return;
		const [x0, z0] = STOPS[k];
		const [x1, z1] = STOPS[k + 1];
		const lx = Math.abs(x1 - x0);
		const lz = Math.abs(z1 - z0);
		const N = Math.ceil((lx + lz) / 0.11);
		const age = 1 - 0.5 * ss(t0 + 40, t0 + 120, t);
		for (let j = 0; j <= N; j++) {
			const s = (j / N) * (lx + lz);
			if (j / N > walk) break;
			const x = s < lx ? x0 + Math.sign(x1 - x0) * s : x1;
			const z = s < lx ? z0 : z0 + Math.sign(z1 - z0) * (s - lx);
			p.x = ISL[0] + x;
			p.z = ISL[2] + z;
			p.y = islandTop(p.x, p.z) + 0.04;
			p.s = 0.12;
			p.g = GLYPH.DOT;
			const head = Math.exp(-Math.abs(j / N - walk) * 14) * (walk < 1 ? 1 : 0);
			setCol(p, mixCol(TEXT, CREAM, 0.4), (1.0 + 2.2 * head) * age * fade);
			still(p);
			w.push(p);
		}
	});
};
// 去小岛的船：海面上一道尾迹
const shipWake = (t: number, w: Writer, p: P) => {
	const t0 = 2805;
	const t1 = 2965;
	if (t < t0 || t > t1 + 60) return;
	const A: V3 = [-8.5, SEA_Y, 6.5];
	const B: V3 = [-2.6, SEA_Y, 12.4];
	const u = clamp01((t - t0) / (t1 - t0));
	const head = v3lerp(A, B, eio(u) * 0.7 + u * 0.3);
	const dir = norm([B[0] - A[0], 0, B[2] - A[2]]);
	const side: V3 = [-dir[2], 0, dir[0]];
	const fade = ss(t0, t0 + 25, t) * (1 - ss(t1, t1 + 60, t));
	const N = 260;
	for (let k = 0; k < N; k++) {
		const back = (k / N) * 7 * clamp01((t - t0) / 50 + 0.2);
		const arm = k % 2 === 0 ? 1 : -1;
		const spread = back * 0.2 + 0.05;
		const jit = (hash(k, 3) - 0.5) * 0.25 * back * 0.3;
		p.x = head[0] - dir[0] * back + side[0] * arm * spread + jit;
		p.y = SEA_Y + 0.02;
		p.z = head[2] - dir[2] * back + side[2] * arm * spread + jit;
		p.s = 0.06 + 0.03 * hash(k, 4);
		p.g = Math.floor(hash(k, 5 + Math.floor(t / 9)) * 4);
		setCol(p, mixCol(COLD_HI, TEXT, 0.5), 1.1 * Math.exp(-back / 3) * fade * (0.6 + 0.4 * hash(k, 6)));
		still(p);
		w.push(p);
	}
	for (let k = 0; k < 24; k++) {
		const d = sphereDir(k, 24);
		p.x = head[0] + d[0] * 0.16;
		p.y = SEA_Y + 0.12 + Math.abs(d[1]) * 0.1;
		p.z = head[2] + d[2] * 0.16;
		p.s = 0.06;
		p.g = figGlyph(k + 900, t);
		setCol(p, TEXT, 1.3 * fade);
		still(p);
		w.push(p);
	}
};const STONE_N = 300;
const stoneState = (i: number, t: number, p: P) => {
	const c = triStone(t);
	const R = 0.42;
	if (i >= STONE_N) {
		pointState(i, c, t, p);
		p.a = 0;
		return;
	}
	let x: number;
	let y: number;
	if (i < 120) {
		const per = i / 120;
		const side = Math.floor(per * 3);
		const u = per * 3 - side;
		const a0 = (side * 2 * Math.PI) / 3 + Math.PI / 2;
		const a1 = a0 + (2 * Math.PI) / 3;
		x = lerp(Math.cos(a0), Math.cos(a1), u) * R;
		y = lerp(Math.sin(a0), Math.sin(a1), u) * R;
	} else {
		// 三角形内均匀取点
		let u = hash(i, 4);
		let v = hash(i, 5);
		if (u + v > 1) {
			u = 1 - u;
			v = 1 - v;
		}
		const A: [number, number] = [0, R];
		const B: [number, number] = [Math.cos((7 * Math.PI) / 6) * R, Math.sin((7 * Math.PI) / 6) * R];
		const C: [number, number] = [Math.cos((11 * Math.PI) / 6) * R, Math.sin((11 * Math.PI) / 6) * R];
		x = A[0] + u * (B[0] - A[0]) + v * (C[0] - A[0]);
		y = A[1] + u * (B[1] - A[1]) + v * (C[1] - A[1]);
	}
	p.x = c[0] + x;
	p.y = c[1] + y;
	p.z = c[2] + (hash(i, 6) - 0.5) * 0.05;
	p.s = i < 120 ? 0.075 : 0.06;
	p.g = i < 120 && hash(i, 7) < 0.3 ? GLYPH.DELTA : figGlyph(i, t);
	// 起初是一块黑石，只有边缘一丝琥珀色；每追上一次红一分
	const rd = redness(t);
	const pulse = 1 + 0.25 * Math.sin(t / 7) * rd;
	const edge = i < 120;
	const col = mixCol(mixCol(COLD_DIM, AMBER, edge ? 0.5 : 0.1), RED, ss(0, 0.6, rd));
	setCol(p, col, (edge ? 0.45 + 1.2 * rd : 0.1 + 0.8 * rd) * pulse);
	p.vx = p.vy = p.vz = 0;
	p.st = 0;
	p.blur = 0;
	p.a = 1;
};
const crackState = (i: number, t: number, p: P) => {
	const c = triStone(T.crack);
	const d = sphereDir(i, HERO_N);
	const dt = Math.max(0, t - T.crack);
	const v = 1.2 + 4 * hash(i, 8);
	const ex = Math.exp(-dt / 9);
	p.x = c[0] + d[0] * v * (1 - ex);
	p.y = c[1] + Math.abs(d[1]) * v * (1 - ex) * 0.9;
	p.z = c[2] + d[2] * v * (1 - ex);
	p.vx = d[0] * v * ex * 0.3;
	p.vy = Math.abs(d[1]) * v * ex * 0.3;
	p.vz = d[2] * v * ex * 0.3;
	p.st = 1;
	p.s = 0.08;
	p.g = figGlyph(i, t);
	setCol(p, mixCol(RED, [1, 0.9, 0.85], Math.exp(-dt / 5)), 0.6 + 1.6 * ex);
	p.blur = 0;
	p.a = 1;
};

// 巨大陨石：先是远处一点琥珀光，越来越近、越来越大
export const meteoroid = (t: number): {c: V3; r: number} => {
	const u = clamp01((t - T.swap3) / (T.impact - T.swap3));
	const e = u * 0.6 + ein(u) * 0.4;
	return {c: v3lerp(PM0, METEOR_C, e), r: lerp(4, METEOR_R, u * 0.6 + ein(u) * 0.4)};
};
const MOVE6: V3 = norm([METEOR_C[0] - PM0[0], METEOR_C[1] - PM0[1], METEOR_C[2] - PM0[2]]);
const meteoroidHeat = (t: number) => 0.5 + 1.4 * ss(T.impact - 210, T.impact, t);

const shatterState = (i: number, t: number, p: P, n = HERO_N, speed = 1) => {
	const m = meteoroid(T.impact);
	const d0 = rotAxis(sphereDir(i, n), T.impact * 0.004 + 1.7);
	// 朝镜头飞的分量压扁，碎片向四周和后方散开，不糊到镜头上
	const k = d0[0] * TO_CAM[0] + d0[1] * TO_CAM[1] + d0[2] * TO_CAM[2];
	const d: V3 = k > 0 ? [d0[0] - TO_CAM[0] * k * 0.9, d0[1] - TO_CAM[1] * k * 0.9, d0[2] - TO_CAM[2] * k * 0.9] : d0;
	const dt = Math.max(0, t - T.impact);
	const v = (8 + 30 * hash(i, 84) ** 2) * speed;
	const tau = 26;
	const ex = Math.exp(-dt / tau);
	const dist = m.r * lump(d0) + v * (1 - ex) + dt * 0.012 * v;
	p.x = m.c[0] + d[0] * dist + 0.4 * Math.sin(dt * 0.03 + hash(i, 85) * 6);
	p.y = m.c[1] + d[1] * dist;
	p.z = m.c[2] + d[2] * dist;
	const vel = (v / tau) * ex + 0.012 * v;
	p.vx = d[0] * vel * 1.5;
	p.vy = d[1] * vel * 1.5;
	p.vz = d[2] * vel * 1.5;
	p.st = 1;
	p.s = 0.14 + 0.24 * hash(i, 86);
	p.g = figGlyph(i, t);
	const hot = Math.exp(-dt / 7);
	const sparkle = hash(i, 87) < 0.16 ? ss(T.impact + 60, T.impact + 150, t) : 0;
	let c = mixCol(ROSE, GOLD, sparkle);
	c = mixCol(c, [1, 0.95, 0.9], hot);
	setCol(p, c, 0.95 * Math.exp(-dt / 60) + 0.16 + hot * 0.45);
	p.blur = 0;
	p.a = 1;
};

const TRI_T0 = T.impact + 50;
const triCenter = (t: number): V3 => {
	const dt = t - TRI_T0;
	const amp = 1 - ss(T.burst - 65, T.burst - 5, t);
	return [METEOR_C[0] + amp * 6 * Math.sin(dt * 0.11 + 0.5), METEOR_C[1] + amp * 3.8 * Math.sin(dt * 0.17 + 1.3), METEOR_C[2] + amp * 3 * Math.sin(dt * 0.07)];
};
const TRI_N = 180;
const triPoint = (k: number, t: number, p: P) => {
	const c = triCenter(t);
	const per = k / TRI_N;
	const side = Math.floor(per * 3);
	const u = per * 3 - side;
	const R = 2.0;
	const rot = t * 0.035;
	const a0 = rot + (side * 2 * Math.PI) / 3 + Math.PI / 2;
	const a1 = a0 + (2 * Math.PI) / 3;
	p.x = c[0] + lerp(Math.cos(a0) * R, Math.cos(a1) * R, u);
	p.y = c[1] + lerp(Math.sin(a0) * R, Math.sin(a1) * R, u);
	p.z = c[2] + 0.3 * Math.sin(per * 12 + t * 0.1);
	p.s = 0.3;
	p.g = hash(k, 3) < 0.3 ? GLYPH.DELTA : figGlyph(k, t);
	setCol(p, mixCol(ROSE, GOLD, 0.45), 2.2);
	still(p);
};
const TEN_N = 240;
const tendrilPoint = (k: number, t: number, p: P) => {
	const ten = Math.floor(k / 40);
	const j = k % 40;
	const c = triCenter(t);
	const rot = t * 0.035;
	const a0 = rot + ((ten % 3) * 2 * Math.PI) / 3 + Math.PI / 2 + (ten < 3 ? -0.35 : 0.35);
	const L = 10 * eout(clamp01((t - (T.burst - 65)) / 60));
	const s = j / 39;
	const R = 2.0;
	const dx = Math.cos(a0);
	const dy = Math.sin(a0);
	const wave = Math.sin(s * 7 - t * 0.25 + ten) * 0.9 * s;
	p.x = c[0] + dx * (R + s * L) - dy * wave;
	p.y = c[1] + dy * (R + s * L) + dx * wave;
	p.z = c[2] + Math.sin(s * 5 + ten) * 0.6 * s;
	p.s = 0.26 * (1 - s * 0.5);
	p.g = figGlyph(k + 500, t);
	setCol(p, mixCol(ROSE, CREAM, 0.3), 1.6 * (1 - s * 0.4));
	still(p);
};

const sC = mkP();
const debrisPhase = (i: number, t: number, p: P) => {
	shatterState(i, t, p);
	if (i < TRI_N && t > TRI_T0) {
		triPoint(i, t, sC);
		const u = clamp01((t - TRI_T0 - hash(i, 88) * 20) / 40);
		flyBetween(i, {...p}, sC, u, 0.8, p);
	} else if (i >= TRI_N && i < TRI_N + TEN_N && t > T.burst - 80) {
		tendrilPoint(i - TRI_N, t, sC);
		const u = clamp01((t - (T.burst - 80) - (i % 40) * 0.4) / 22);
		flyBetween(i, {...p}, sC, u, 0.5, p);
	} else if (i >= TRI_N + TEN_N) {
		const k = 1 - 0.75 * ss(T.impact + 70, T.impact + 190, t);
		p.r *= k;
		p.gg *= k;
		p.b *= k;
	}
};

const warmFigure = (a: Assets, i: number, t: number, p: P) => {
	const laserOn = t > T.laser - 10 && t < T.laser + 140 ? 3 * ss(T.laser - 10, T.laser + 10, t) * (1 - ss(T.laser + 100, T.laser + 140, t)) : 0;
	figPoint(a.normal, i, METEOR_C, WARM_H, t, p);
	warmFigColor(a.normal, i, 3 + 0.6 * Math.sin(t / 10) + laserOn, p);
	if (hash(i, 300 + Math.floor(t / 5)) < 0.035) {
		p.r += GOLD[0] * 1.6;
		p.gg += GOLD[1] * 1.6;
		p.b += GOLD[2] * 1.6;
	}
	p.g = figGlyph(i, t);
	p.vx = p.vy = p.vz = 0;
	p.st = 0;
	p.blur = 0;
	p.a = 1;
	const cool = ss(T.cool, T.cool + 130, t);
	if (cool > 0) {
		coldFigColor(a.normal, i, 1.2, sC);
		p.r = lerp(p.r, sC.r, cool);
		p.gg = lerp(p.gg, sC.gg, cool);
		p.b = lerp(p.b, sC.b, cool);
	}
};

const sD = mkP();
const heroState = (a: Assets, i: number, t: number, p: P) => {
	p.a = 0;
	if (t < T.swap) return;
	if (t < T.unravel) {
		helixState(i, t, p);
		p.a = ss(465, 510, t);
		if (t < MICRO_READY) {
			const m = meteorInterior(t);
			const zoom = m.r / 16;
			p.x = m.c[0] + (p.x - HELIX_C[0]) * zoom;
			p.y = m.c[1] + (p.y - HELIX_C[1]) * zoom;
			p.z = m.c[2] + (p.z - HELIX_C[2]) * zoom;
			p.s *= zoom;
		}
		return;
	}
	if (t < T.ignite) {
		// 螺旋解体，字飞向代欧奇希斯的轮廓
		const start = T.unravel + hash(i, 41) * 70 + (i < NB * 6 ? 0 : 20);
		helixState(i, Math.min(t, start), sA);
		coldFigure(a, i, t, sB);
		flyBetween(i, sA, sB, clamp01((t - start) / 90), 1.6, p);
		return;
	}
	if (t < T.contract) {
		coldFigure(a, i, t, p);
		return;
	}
	if (t < T.fall) {
		coldFigure(a, i, t, sA);
		pointState(i, crystalWorld(a.attack, FIG_C, FIG_H, t), t, sB, 1.4);
		const u = clamp01((t - T.contract - hash(i, 42) * 14) / 34);
		flyBetween(i, sA, sB, ein(u) * 0.6 + u * 0.4, 0.2, p);
		return;
	}
	if (t < T.swap2) {
		pointState(i, v3lerp(crystalWorld(a.attack, FIG_C, FIG_H, T.fall), FALL_END, ein(clamp01((t - T.fall) / (T.swap2 - T.fall)))), t, p, 1.6);
		return;
	}
	if (t < T.crack) {
		if (t < T.land + 12) {
			pointState(i, triStone(t), t, sA, 1.6);
			stoneState(i, t, sB);
			const u = clamp01((t - T.land + 4) / 16);
			flyBetween(i, sA, sB, u, 0.1, p);
			if (i >= STONE_N) p.a = 1 - u;
			return;
		}
		stoneState(i, t, p);
		return;
	}
	if (t < T.islandFade + 50) {
		// 陨石碎裂，碎片聚成代欧奇希斯
		const start = T.crack + 16 + hash(i, 43) * 24;
		const u = clamp01((t - start) / 46);
		crackState(i, Math.min(t, start), sA);
		coldFigure(a, i, t, sB, ISL_FIG, ISL_FIG_H, a.normal);
		if (u < 1) {
			if (t < start) crackState(i, t, p);
			else flyBetween(i, sA, sB, u, 0.6, p);
		} else Object.assign(p, sB);
		const fade = 1 - ss(T.islandFade, T.islandFade + 50, t);
		p.y += (1 - fade) * 1.5;
		p.a *= fade;
		return;
	}
	if (t < T.swap3) return;
	if (t < T.impact) {
		const m = meteoroid(t);
		rockState(i, HERO_N, m.c, m.r, t, meteoroidHeat(t), MOVE6, p);
		p.a = ss(T.swap3 + 5, T.swap3 + 40, t);
		return;
	}
	if (t < T.burst) {
		debrisPhase(i, t, p);
		return;
	}
	if (t < T.swap5) {
		// 爆开：所有的字聚成暖色的代欧奇希斯
		const start = T.burst + hash(i, 43) * 25;
		const u = clamp01((t - start) / 50);
		if (u < 1) {
			debrisPhase(i, T.burst, sD);
			warmFigure(a, i, t, sB);
			const e = eout(u);
			const fl = Math.sin(Math.PI * u) * 1.2;
			p.x = lerp(sD.x, sB.x, e);
			p.y = lerp(sD.y, sB.y, e);
			p.z = lerp(sD.z, sB.z, e);
			p.s = lerp(sD.s, sB.s, e);
			p.r = lerp(sD.r, sB.r, e) + GOLD[0] * fl;
			p.gg = lerp(sD.gg, sB.gg, e) + GOLD[1] * fl;
			p.b = lerp(sD.b, sB.b, e) + GOLD[2] * fl;
			p.g = u > 0.85 ? sB.g : sD.g;
			p.a = 1;
			p.blur = 0;
			const k = (1 - e) * 0.08;
			p.vx = (sB.x - sD.x) * k;
			p.vy = (sB.y - sD.y) * k;
			p.vz = (sB.z - sD.z) * k;
			p.st = 1;
			return;
		}
		warmFigure(a, i, Math.min(t, T.clash), p);
		battleBody(i, t, p);
		// 镜头俯向行星时，在速度线里隐去
		p.a *= 1 - ss(T.swap5 - 40, T.swap5 - 6, t);
	}
};

// 宇宙之战里身体的变化：宇宙力量时更亮；被烈空坐撞散，用自我再生重新拼回
const BODY_C: V3 = [METEOR_C[0], METEOR_C[1] + 1.5, METEOR_C[2]];
const battleBody = (i: number, t: number, p: P) => {
	if (t < T.cosmic) return;
	if (t >= T.clash) {
		// 最后一击从右侧传过身体；字符被冲向左侧，逐粒熄灭，不再重组。
		const delay = clamp01((5 - (p.x - BODY_C[0])) / 16) * 10 + hash(i, 52) * 8;
		const age = Math.max(0, t - T.clash - delay);
		const d = sphereDir(i, HERO_N);
		const speed = 0.1 + 0.16 * hash(i, 53);
		const travel = age * speed;
		p.x += (d[0] * 0.65 - 1.2) * travel;
		p.y += d[1] * travel * 0.85;
		p.z += d[2] * travel * 0.4;
		p.vx = (d[0] * 0.65 - 1.2) * speed;
		p.vy = d[1] * speed * 0.85;
		p.vz = d[2] * speed * 0.4;
		p.st = ss(0, 6, age) * (1 - ss(18, 42, age));
		p.a *= 1 - ss(14, 48, age);
		p.s *= lerp(1, 0.45, ss(10, 48, age));
		const flare = ss(0, 3, age) * Math.exp(-age / 12);
		p.r += GOLD[0] * flare * 1.4;
		p.gg += GOLD[1] * flare * 1.4;
		p.b += GOLD[2] * flare * 1.4;
		return;
	}
	const boost = ss(T.cosmic + 10, T.cosmic + 50, t) * (1 - ss(T.cosmic + 70, T.cosmic + 130, t)) + 0.8 * pulse(t, T.clash, 18);
	if (boost > 0.001) {
		p.r += GOLD[0] * boost * 0.9;
		p.gg += GOLD[1] * boost * 0.9;
		p.b += GOLD[2] * boost * 0.9;
	}
	const sc = ss(T.strike - 2, T.strike + 5, t) * (1 - eio(clamp01((t - T.recover - hash(i, 48) * 20) / 45)));
	if (sc <= 0.001) return;
	const d = norm([p.x - BODY_C[0] + (hash(i, 49) - 0.5) * 4, p.y - BODY_C[1] + (hash(i, 50) - 0.5) * 4, p.z - BODY_C[2] + (hash(i, 51) - 0.5) * 4]);
	const r = sc * (3 + 9 * hash(i, 47));
	// 被撞的一侧（右边）散得更远
	const side = 1 + 0.8 * Math.max(0, d[0]);
	p.x += d[0] * r * side - 2.5 * sc;
	p.y += d[1] * r;
	p.z += d[2] * r;
	const reform = t > T.recover ? 1 : 0;
	p.vx = -d[0] * 0.25 * reform * sc;
	p.vy = -d[1] * 0.25 * reform * sc;
	p.vz = -d[2] * 0.25 * reform * sc;
	p.st = reform;
	const k = 1 - 0.35 * sc;
	p.r *= k;
	p.gg *= k;
	p.b *= k;
};

// ---------- 其他粒子群 ----------
/** 速度线隧道：字拉成线，从视线中心向四周冲出（三处切场都用它遮住） */
const tunnel = (t: number, cam: Camera, w: Writer, p: P, t0: number, tPeak: number, t1: number, seed: number) => {
	const amt = ss(t0, tPeak, t) * (1 - ss(tPeak + 30, t1, t));
	if (amt <= 0) return;
	const b = cameraBasis(cam);
	const N = 650;
	const speed = 0.05 + 0.9 * ss(t0, tPeak, t);
	const travel = (t - t0) * 0.05 + 0.45 * Math.max(0, t - t0 - 30) * ss(t0, tPeak, t);
	for (let k = 0; k < N; k++) {
		const ang = hash(k, 1 + seed) * Math.PI * 2;
		const rr = (0.15 + 1.9 * Math.pow(hash(k, 2 + seed), 0.7)) * b.tanH * 6;
		const z = 30 - ((hash(k, 3 + seed) * 30 + travel) % 30) + 2.5;
		const ox = Math.cos(ang) * rr * b.aspect;
		const oy = Math.sin(ang) * rr;
		p.x = cam.pos[0] + b.f[0] * z + b.r[0] * ox + b.u[0] * oy;
		p.y = cam.pos[1] + b.f[1] * z + b.r[1] * ox + b.u[1] * oy;
		p.z = cam.pos[2] + b.f[2] * z + b.r[2] * ox + b.u[2] * oy;
		p.vx = -b.f[0] * speed * 0.9;
		p.vy = -b.f[1] * speed * 0.9;
		p.vz = -b.f[2] * speed * 0.9;
		p.st = 1;
		p.s = 0.03 * b.tanH * 6;
		p.g = hash(k, 4) < 0.6 ? Math.floor(hash(k, 5) * 4) : GLYPH.digit(Math.floor(hash(k, 6) * 10));
		setCol(p, mixCol(COLD_HI, TEXT, 0.6), amt * (0.7 + 1.6 * hash(k, 7)) * Math.min(1, (32.5 - z) / 6) * ss(2.5, 6, z));
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
};

/** 陨石的尾迹：从岩块表面向后拉出的字 */
const trail = (c: V3, r: number, dir: V3, amt: number, n: number, t: number, w: Writer, p: P, seed: number) => {
	if (amt <= 0) return;
	for (let k = 0; k < n; k++) {
		const back = (0.6 + 6 * Math.pow(hash(k, 1 + seed), 1.5)) * r;
		const ang = hash(k, 2 + seed) * Math.PI * 2;
		const off = r * (0.2 + 0.85 * hash(k, 3 + seed)) * (1 - (back / (7 * r)) * 0.5);
		const u = norm([-dir[2], 0, dir[0]]);
		const v: V3 = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
		p.x = c[0] - dir[0] * back + (u[0] * Math.cos(ang) + v[0] * Math.sin(ang)) * off;
		p.y = c[1] - dir[1] * back + (u[1] * Math.cos(ang) + v[1] * Math.sin(ang)) * off;
		p.z = c[2] - dir[2] * back + (u[2] * Math.cos(ang) + v[2] * Math.sin(ang)) * off;
		p.vx = dir[0] * r * 0.8;
		p.vy = dir[1] * r * 0.8;
		p.vz = dir[2] * r * 0.8;
		p.st = 1;
		p.s = 0.06 * r * (1 - back / (8 * r));
		p.g = Math.floor(hash(k, 5 + seed + Math.floor(t / 12)) * 4);
		const fade = Math.exp(-back / (2.2 * r));
		setCol(p, mixCol(AMBER, COLD_HI, clamp01(back / (3 * r))), amt * 1.6 * fade);
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
};

const laserS2 = (t: number, w: Writer, p: P) => {
	if (t < T.hit - 15 || t > T.hit + 85) return;
	const reach = eout(clamp01((t - (T.hit - 14)) / 14));
	const fade = 1 - ss(T.hit + 45, T.hit + 82, t);
	const N = 170;
	const dx = HIT_POS[0] - LASER_FROM[0];
	const dy = HIT_POS[1] - LASER_FROM[1];
	const dz = HIT_POS[2] - LASER_FROM[2];
	for (let k = 0; k < N; k++) {
		const u = (k / N) * reach;
		p.x = LASER_FROM[0] + dx * u;
		p.y = LASER_FROM[1] + dy * u;
		p.z = LASER_FROM[2] + dz * u;
		p.vx = (dx / N) * 2.5;
		p.vy = (dy / N) * 2.5;
		p.vz = (dz / N) * 2.5;
		p.st = 1;
		p.s = 0.07;
		p.g = GLYPH.DASH;
		setCol(p, [0.86, 0.9, 1.0], 2.4 * fade * (0.8 + 0.4 * hash(k, Math.floor(t))));
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
	if (t > T.hit - 2) {
		const dt = t - T.hit + 2;
		for (let k = 0; k < 60; k++) {
			const d = sphereDir(k, 60);
			const r = (0.4 + 2.2 * hash(k, 2)) * eout(clamp01(dt / 30));
			p.x = HIT_POS[0] + d[0] * r;
			p.y = HIT_POS[1] + d[1] * r;
			p.z = HIT_POS[2] + d[2] * r;
			p.vx = d[0] * 0.3;
			p.vy = d[1] * 0.3;
			p.vz = d[2] * 0.3;
			p.st = 1;
			p.s = 0.09;
			p.g = Math.floor(hash(k, 4) * 8);
			setCol(p, AMBER, 2.5 * Math.exp(-dt / 18));
			p.a = 1;
			p.blur = 0;
			w.push(p);
		}
	}
};

/** 一行字（世界空间里的公告板字符）；right 为行的方向 */
const textLine = (text: string, c: V3, right: V3, size: number, col: V3, k: number, w: Writer, p: P, reveal = 1, track = 1.05) => {
	const chars = [...text];
	const n = chars.length;
	const shown = Math.floor(reveal * n + 1e-6);
	chars.forEach((ch, j) => {
		if (ch === ' ' || j >= shown) return;
		const o = (j - (n - 1) / 2) * size * track;
		p.x = c[0] + right[0] * o;
		p.y = c[1] + right[1] * o;
		p.z = c[2] + right[2] * o;
		p.s = size;
		p.g = GLYPH.index(ch);
		setCol(p, col, k);
		still(p);
		w.push(p);
	});
};

// ---------- 第 5 段：行星上的各地陨石 ----------
const SITES: [string, string, number, number][] = [
	['神奥', 'VEILSTONE CITY', -12, 22],
	['关都', 'ROUTE 3', 13, 24],
	['合众', 'NACRENE MUSEUM', -20, 36],
	['卡洛斯', 'AMBRETTE TOWN', 19, 37],
	['丰缘', 'FALLARBOR TOWN', -15, 46],
	['阿罗拉', 'HOKULANI OBSERVATORY', 16, 47],
];
const siteGround = (x: number, z: number): V3 => {
	const dz = z - PLANET_S4[2];
	return [x, PLANET_S4[1] + Math.sqrt(PLANET_R * PLANET_R - x * x - dz * dz), z];
};
const X_AXIS: V3 = [1, 0, 0];
const meteorSites = (a: Assets, t: number, w: Writer, p: P) => {
	if (t < T.meteors - 40 || t > T.contract + 30) return;
	const all = ss(T.meteors - 40, T.meteors, t) * (1 - ss(T.contract - 30, T.contract + 20, t));
	const cam = frameCam.pos;
	SITES.forEach(([zh, en, x, z], k) => {
		const t0 = meteorAt(k);
		const g = siteGround(x, z);
		const on = ss(t0 - 6, t0 + 4, t);
		const flare = pulse(t, t0, 24);
		const dist = Math.hypot(g[0] - cam[0], g[1] - cam[1], g[2] - cam[2]);
		const unit = dist * 0.02;
		// 地面上的一小团琥珀色字
		for (let j = 0; j < 16; j++) {
			const d = sphereDir(j, 16);
			p.x = g[0] + d[0] * unit * 0.55;
			p.y = g[1] + Math.abs(d[1]) * unit * 0.3 + 0.05;
			p.z = g[2] + d[2] * unit * 0.55;
			p.s = unit * (j === 0 ? 0.9 : 0.45);
			p.g = figGlyph(j + k * 40 + 4000, t);
			setCol(p, AMBER, all * (0.35 + 1.1 * on + 3.5 * flare) * (j === 0 ? 1.6 : 0.8));
			still(p);
			w.push(p);
		}
		// 光柱
		for (let j = 0; j < 22; j++) {
			const s = j / 21;
			p.x = g[0];
			p.y = g[1] + s * unit * 7 * on;
			p.z = g[2];
			p.s = unit * 0.28 * (1 - s * 0.6);
			p.g = GLYPH.DOT;
			setCol(p, mixCol(AMBER, CREAM, 0.3), all * on * (0.5 + 2.5 * flare) * (1 - s) * 0.9);
			still(p);
			w.push(p);
		}
		// 从陨石到水晶体的一道光：亮起时代欧奇希斯随之变换形态
		if (t > t0 - 4 && t < t0 + 40) {
			const cw = crystalWorld(a.normal, FIG_C, FIG_H, t);
			const u = clamp01((t - t0 + 4) / 16);
			const fade = 1 - ss(t0 + 14, t0 + 40, t);
			for (let j = 0; j < 46; j++) {
				const s = j / 45;
				if (s > u) break;
				const q = v3lerp(g, cw, s);
				p.x = q[0];
				p.y = q[1] + Math.sin(Math.PI * s) * 2.5;
				p.z = q[2];
				p.s = 0.05 + 0.12 * (1 - s);
				p.g = j % 3 === 0 ? GLYPH.DOT : Math.floor(hash(j, k + 9) * 4);
				setCol(p, AMBER, all * fade * (0.8 + 2.2 * Math.exp(-Math.abs(s - u) * 10)));
				still(p);
				w.push(p);
			}
		}
		// 地名：中文地区名 + 英文地点名
		const lab: V3 = [g[0], g[1] + unit * 5.2, g[2]];
		const la = all * ss(t0 - 2, t0 + 18, t) * (0.7 + 0.6 * flare);
		textLine(zh, lab, X_AXIS, unit * 1.25, TEXT, la * 1.1, w, p, ss(t0 - 2, t0 + 14, t));
		textLine(en, [lab[0], lab[1] - unit * 1.35, lab[2]], X_AXIS, unit * 0.5, COLD_HI, la * 0.8, w, p, ss(t0 + 4, t0 + 26, t), 1.2);
	});
};

// ---------- 第 7 段：夜空里的星图（绿岭宇宙中心的观测） ----------
const CHART_CAM: V3 = [0, -1.6, 0.8];
const CHART_PITCH = 22 * DEG;
const CH_F: V3 = [0, Math.sin(CHART_PITCH), Math.cos(CHART_PITCH)];
const CH_R: V3 = [1, 0, 0];
const CH_U: V3 = [0, Math.cos(CHART_PITCH), -Math.sin(CHART_PITCH)];
const CH_D = 140;
const PM0_DIST = Math.hypot(PM0[0] - CHART_CAM[0], PM0[1] - CHART_CAM[1], PM0[2] - CHART_CAM[2]);
const skyPoint = (X: number, Y: number, R = PM0_DIST + 12): V3 => {
	const d = norm([CH_F[0] * CH_D + CH_R[0] * X + CH_U[0] * Y, CH_F[1] * CH_D + CH_R[1] * X + CH_U[1] * Y, CH_F[2] * CH_D + CH_R[2] * X + CH_U[2] * Y]);
	return [CHART_CAM[0] + d[0] * R, CHART_CAM[1] + d[1] * R, CHART_CAM[2] + d[2] * R];
};
// 巨大陨石在星图上的位置：先沿预测轨道走，到 T.bend 突然转向，最后停在太空段开场的位置
const PM0_XY = (() => {
	const d = norm([PM0[0] - CHART_CAM[0], PM0[1] - CHART_CAM[1], PM0[2] - CHART_CAM[2]]);
	const s = CH_D / (d[0] * CH_F[0] + d[1] * CH_F[1] + d[2] * CH_F[2]);
	return [(d[0] * CH_R[0] + d[1] * CH_R[1] + d[2] * CH_R[2]) * s, (d[0] * CH_U[0] + d[1] * CH_U[1] + d[2] * CH_U[2]) * s] as [number, number];
})();
const DOT_S: [number, number] = [-62, 14];
const DOT_V: [number, number] = [0.19, -0.035];
const DOT_B: [number, number] = [DOT_S[0] + DOT_V[0] * (T.bend - T.chart), DOT_S[1] + DOT_V[1] * (T.bend - T.chart)];
const DOT_C: [number, number] = [DOT_B[0] + DOT_V[0] * 70, DOT_B[1] + DOT_V[1] * 70];
const dotXY = (t: number): [number, number] => {
	if (t < T.bend) {
		const dt = Math.max(0, t - T.chart);
		return [DOT_S[0] + DOT_V[0] * dt, DOT_S[1] + DOT_V[1] * dt];
	}
	const u = clamp01((t - T.bend) / (T.swap3 - T.bend));
	const k = 1 - u;
	return [k * k * DOT_B[0] + 2 * k * u * DOT_C[0] + u * u * PM0_XY[0], k * k * DOT_B[1] + 2 * k * u * DOT_C[1] + u * u * PM0_XY[1]];
};
/** 夜空里那一点琥珀光的位置（跨过切场与太空段的 PM0 一致） */
const skyDot = (t: number): V3 => {
	if (t >= T.swap3) return PM0;
	const [X, Y] = dotXY(t);
	const q = skyPoint(X, Y, PM0_DIST);
	const e = ss(T.swap3 - 40, T.swap3, t);
	return v3lerp(q, PM0, e);
};
const chartAmt = (t: number) => ss(T.chart, T.chart + 40, t) * (1 - ss(T.swap3 - 75, T.swap3 - 20, t));
const starChart = (t: number, w: Writer, p: P) => {
	const amt = chartAmt(t);
	if (amt <= 0.001) return;
	// 自左向右扫出来
	const scan = lerp(-140, 140, ss(T.chart, T.chart + 50, t));
	const vis = (X: number) => ss(X - 8, X, scan);
	// 网格与刻度
	for (let gx = -120; gx <= 120; gx += 20) {
		for (let gy = -45; gy <= 45; gy += 15) {
			p.g = GLYPH.index('+');
			const q = skyPoint(gx, gy);
			p.x = q[0];
			p.y = q[1];
			p.z = q[2];
			p.s = 2.4;
			setCol(p, COLD_HI, 0.5 * amt * vis(gx));
			still(p);
			w.push(p);
		}
		const num = String(Math.round(((gx + 120) / 20) * 15 + 105)).padStart(3, '0');
		textLine(num, skyPoint(gx, 41), CH_R, 2.3, COLD_HI, 0.75 * amt * vis(gx), w, p);
	}
	for (let gy = -45; gy <= 45; gy += 15) {
		const num = (gy >= 0 ? '+' : '—') + String(Math.abs(Math.round(gy * 0.6))).padStart(2, '0');
		textLine(num, skyPoint(-110, gy + 2.5), CH_R, 2.1, COLD_HI, 0.65 * amt * vis(-110), w, p);
	}
	const [dx, dy] = dotXY(t);
	// 预测轨道（会擦过去）：转向后闪烁着熄灭
	const pred = ss(T.chart + 110, T.chart + 170, t) * (1 - ss(T.bend + 8, T.bend + 40, t));
	const flick = t > T.bend ? 0.5 + 0.5 * Math.sign(Math.sin(t * 1.7)) : 1;
	if (pred > 0.001) {
		const len = 190 * ss(T.chart + 110, T.chart + 170, t);
		for (let s = 3; s < len; s += 2.4) {
			const q = skyPoint(dx + DOT_V[0] * (s / 0.193), dy + DOT_V[1] * (s / 0.193));
			p.x = q[0];
			p.y = q[1];
			p.z = q[2];
			p.s = 2.0;
			p.g = GLYPH.DASH;
			setCol(p, COLD_HI, 0.9 * pred * amt * flick);
			still(p);
			w.push(p);
		}
	}
	// 新轨道：朝这颗星球弯下来
	const neu = ss(T.bend + 6, T.bend + 40, t);
	if (neu > 0.001) {
		const u0 = clamp01((t - T.bend) / (T.swap3 - T.bend));
		for (let j = 0; j < 60; j++) {
			const u = u0 + (1 - u0) * (j / 60) * neu;
			const k = 1 - u;
			const X = k * k * DOT_B[0] + 2 * k * u * DOT_C[0] + u * u * PM0_XY[0];
			const Y = k * k * DOT_B[1] + 2 * k * u * DOT_C[1] + u * u * PM0_XY[1];
			const q = skyPoint(X, Y);
			p.x = q[0];
			p.y = q[1];
			p.z = q[2];
			p.s = 2.0;
			p.g = j % 2 ? GLYPH.DASH : GLYPH.DOT;
			setCol(p, AMBER, 0.9 * neu * amt);
			still(p);
			w.push(p);
		}
		// 再往下指向画外（这颗星球）
		for (let j = 1; j < 14; j++) {
			const q = skyPoint(PM0_XY[0] + j * 0.6, PM0_XY[1] - j * 2.6);
			p.x = q[0];
			p.y = q[1];
			p.z = q[2];
			p.s = 2.0;
			p.g = GLYPH.DASH;
			setCol(p, AMBER, 0.7 * neu * amt * (1 - j / 14));
			still(p);
			w.push(p);
		}
	}
	// 走过的轨迹
	for (let j = 1; j < 40; j++) {
		const tb = t - j * 6;
		if (tb < T.chart) break;
		const [hx, hy] = dotXY(tb);
		const q = skyPoint(hx, hy);
		p.x = q[0];
		p.y = q[1];
		p.z = q[2];
		p.s = 1.6;
		p.g = GLYPH.DOT;
		setCol(p, AMBER, 0.6 * amt * (1 - j / 40));
		still(p);
		w.push(p);
	}
	// 准星：发现它的那一刻起闪烁报警
	const alarm = ss(T.chart + 100, T.chart + 120, t);
	const blink = 0.55 + 0.45 * Math.sign(Math.sin((t - T.chart) * 0.42));
	const rr = 8.5 + 1.5 * pulse(t, T.bend, 20);
	for (let j = 0; j < 40; j++) {
		const ang = (j / 40) * Math.PI * 2 + t * 0.01;
		const q = skyPoint(dx + Math.cos(ang) * rr, dy + Math.sin(ang) * rr);
		p.x = q[0];
		p.y = q[1];
		p.z = q[2];
		p.s = j % 10 === 0 ? 2.8 : 1.7;
		p.g = j % 10 === 0 ? GLYPH.DASH : GLYPH.DOT;
		setCol(p, mixCol(AMBER, RED, 0.35 * alarm), (0.5 + 1.0 * alarm * blink) * amt);
		still(p);
		w.push(p);
	}
	const lab = ss(T.chart + 115, T.chart + 140, t);
	textLine('10KM+', skyPoint(dx + 21, dy + 5), CH_R, 3.0, TEXT, 1.3 * lab * amt, w, p, lab);
	textLine('NEW COURSE', skyPoint(dx + 24, dy - 0.5), CH_R, 1.9, AMBER, 1.2 * ss(T.bend, T.bend + 20, t) * amt * flick, w, p);
	textLine('MOSSDEEP SPACE CENTER', skyPoint(-80, 33), CH_R, 2.2, COLD_HI, 0.8 * amt * vis(-80), w, p, ss(T.chart + 5, T.chart + 45, t), 1.2);
};

// ---------- 第 10 段：宇宙之战 ----------
const RAY_POS: V3 = [27, 15.5, 55];
const RAY_B_H = 15;
// 画龙点睛（第二次撞击）：周身泛起绿光 → 身体拉直 → 沿直线高速贯穿代欧奇希斯 → 从左侧出画。T.clash 是头部撞上的那一帧。
const DA_T0 = T.clash - 56; // 绿光开始亮起
const DA_GO = T.clash - 7; // 冲出
const DA_OUT = T.clash + 30; // 整个身体已经出画
const DA_LEN = 26; // 拉直后的身长
const DA_FROM: V3 = [29, 16.2, 53.5];
const DA_THRU: V3 = [BODY_C[0], BODY_C[1] + 0.2, BODY_C[2] + 2.5];
const DA_REACH = Math.hypot(DA_THRU[0] - DA_FROM[0], DA_THRU[1] - DA_FROM[1], DA_THRU[2] - DA_FROM[2]);
const DA_DIR: V3 = norm([DA_THRU[0] - DA_FROM[0], DA_THRU[1] - DA_FROM[1], DA_THRU[2] - DA_FROM[2]]);
const DA_UP: V3 = norm([-DA_DIR[1] * DA_DIR[0], 1 - DA_DIR[1] * DA_DIR[1], -DA_DIR[1] * DA_DIR[2]]);
const DA_SIDE: V3 = [DA_DIR[1] * DA_UP[2] - DA_DIR[2] * DA_UP[1], DA_DIR[2] * DA_UP[0] - DA_DIR[0] * DA_UP[2], DA_DIR[0] * DA_UP[1] - DA_DIR[1] * DA_UP[0]];
const DA_GREEN: V3 = [0.3, 0.95, 0.5];
// 冲出后沿直线走过的距离：很快加到全速，之后一直保持；全速按“头部在 T.clash 正好到达代欧奇希斯”反推。
const DA_TAU = 6;
const daRun = (q: number) => (q <= 0 ? 0 : q - DA_TAU * (1 - Math.exp(-q / DA_TAU)));
const DA_SPEED = (DA_REACH - DA_LEN / 2) / daRun(T.clash - DA_GO);
const daDist = (t: number) => DA_SPEED * daRun(t - DA_GO);
// 拉直后的身体粗细：u = 0 是头，1 是尾。头部最宽，颈后收细，尾巴渐尖。
const daRadius = (u: number) => 1.9 * ss(0, 0.05, u) * (0.55 + 0.45 * (1 - ss(0.07, 0.2, u))) * (1 - 0.75 * ss(0.55, 1, u));
// 每个字在直线身体上的位置：按原图从左（头）到右排出前后次序，原图的上下位置换成截面上的偏移。
type RayPose = {u: Float32Array; v: Float32Array};
const rayPoses = new WeakMap<FigureSet, RayPose>();
const rayPose = (f: FigureSet): RayPose => {
	let pose = rayPoses.get(f);
	if (pose) return pose;
	const order = Array.from({length: f.n}, (_, i) => i).sort((i, j) => f.x[i] - f.x[j]);
	const u = new Float32Array(f.n);
	order.forEach((i, k) => (u[i] = (k + 0.5) / f.n));
	let lo = Infinity;
	let hi = -Infinity;
	for (let i = 0; i < f.n; i++) {
		lo = Math.min(lo, f.y[i]);
		hi = Math.max(hi, f.y[i]);
	}
	const half = Math.max((hi - lo) / 2, 1e-6);
	const v = Float32Array.from({length: f.n}, (_, i) => (f.y[i] - (lo + hi) / 2) / half);
	pose = {u, v};
	rayPoses.set(f, pose);
	return pose;
};
const battleRayCenter = (t: number): V3 => {
	const enter = eout(clamp01((t - T.battle + 10) / 70));
	let c = v3lerp([62, 26, 78], RAY_POS, enter);
	// 第一次撞击：冲向代欧奇希斯再弹开
	const go = clamp01((t - (T.strike - 38)) / 38);
	const back = eio(clamp01((t - T.strike) / 60));
	const hitP: V3 = [9, 14, 49];
	if (go > 0) c = v3lerp(c, hitP, ein(go) * (1 - back));
	// 最后一击「画龙点睛」：先退到右侧蓄势，临冲出前再往后一收，然后沿直线贯穿过去，不减速、不折返，直接从左侧出画。
	const wind = eio(clamp01((t - (DA_T0 + 8)) / (DA_GO - DA_T0 - 8)));
	if (wind > 0) c = v3lerp(c, DA_FROM, wind);
	const d = daDist(t) - 2.5 * ss(DA_GO - 14, DA_GO - 2, t) * (1 - ss(DA_GO, DA_GO + 4, t));
	return [c[0] + DA_DIR[0] * d, c[1] + DA_DIR[1] * d, c[2] + DA_DIR[2] * d];
};
// 烈空坐身上第 i 个字的位置：平时是原图的盘绕姿态；画龙点睛冲出前从头到尾依次拉直成一条直线。
const battleRayPoint = (f: FigureSet, i: number, t: number, c: V3, out: V3) => {
	const rot = -0.18;
	const cs = Math.cos(rot);
	const sn = Math.sin(rot);
	// 原图朝左。入场仍是散粒时纠正旧镜像，保留第九段交界的粒子位置。
	const x0 = f.x[i] * RAY_B_H * lerp(-1, 1, ss(T.battle, T.battle + 20, t));
	const y0 = f.y[i] * RAY_B_H;
	const gather = 1 - ss(T.battle - 10 + hash(i, 8) * 30, T.battle + 40 + hash(i, 8) * 30, t);
	const g = sphereDir(i, f.n);
	out[0] = c[0] + x0 * cs - y0 * sn + g[0] * gather * 25;
	out[1] = c[1] + x0 * sn + y0 * cs + g[1] * gather * 25;
	out[2] = c[2] + f.z[i] * RAY_B_H * 0.5 + g[2] * gather * 25;
	if (t <= DA_GO - 21) return 0;
	const pose = rayPose(f);
	const u = pose.u[i];
	const k = eio(clamp01((t - (DA_GO - 21) - 6 * u) / 14));
	const yellow = f.r[i] > 0.55 && f.g[i] > 0.45 && f.b[i] < 0.4;
	const along = (0.5 - u) * DA_LEN;
	// 黄色的纹路与飘带贴在身体外缘
	const r = daRadius(u) * (yellow ? 1.7 : 1);
	const up = pose.v[i] * r;
	const side = (hash(i, 61) * 2 - 1) * r * 0.6;
	out[0] = lerp(out[0], c[0] + DA_DIR[0] * along + DA_UP[0] * up + DA_SIDE[0] * side, k);
	out[1] = lerp(out[1], c[1] + DA_DIR[1] * along + DA_UP[1] * up + DA_SIDE[1] * side, k);
	out[2] = lerp(out[2], c[2] + DA_DIR[2] * along + DA_UP[2] * up + DA_SIDE[2] * side, k);
	return k;
};
const battleRay = (a: Assets, t: number, w: Writer, p: P) => {
	// 画龙点睛冲出画面左侧之后就不再画它
	if (t < T.battle - 10 || t > DA_OUT) return;
	const c = battleRayCenter(t);
	const c2 = battleRayCenter(t + 1);
	const vel: V3 = [c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]];
	const appear = ss(T.battle - 10, T.battle + 50, t);
	const hitFlash = pulse(t, T.laser + 10, 20) + pulse(t, T.strike, 16) + pulse(t, T.clash, 18);
	// 画龙点睛：蓄势时整个身体由青转成明亮的绿色并微微脉动；冲出后更亮，抵掉拖尾摊薄的亮度。
	const charge = ss(DA_T0, DA_T0 + 30, t);
	const dash = ss(DA_GO - 2, DA_GO + 4, t);
	const glow = charge * (0.9 + 0.15 * Math.sin(t * 0.7)) + 1.2 * dash;
	const pose = rayPose(a.ray);
	const f = a.ray;
	const q: V3 = [0, 0, 0];
	for (let i = 0; i < f.n; i++) {
		const straight = battleRayPoint(f, i, t, c, q);
		p.x = q[0];
		p.y = q[1];
		p.z = q[2];
		p.s = f.cell * RAY_B_H * (1.2 + 0.3 * hash(i, 5));
		p.g = figGlyph(i + 3000, t);
		const yellow = f.r[i] > 0.55 && f.g[i] > 0.45 && f.b[i] < 0.4;
		// 拉直后头部最亮，像一枚绿色的箭头
		const head = straight * (1 - ss(0, 0.14, pose.u[i]));
		const col = yellow ? mixCol([0.82, 0.78, 0.62], [0.95, 0.95, 0.6], 0.5 * charge) : mixCol(mixCol(JADE, DA_GREEN, 0.7 * charge), CREAM, 0.45 * head);
		setCol(p, col, (0.18 + 1.1 * Math.pow(f.lum[i], 1.05)) * 1.5 * appear * (1 + 0.8 * hitFlash + glow + 1.4 * head));
		p.a = 1;
		p.blur = 0;
		// 冲刺时拖尾只沿身体方向拉开，倍数收小，保住笔直的轮廓
		const smear = lerp(2, 0.7, dash);
		p.vx = vel[0] * smear;
		p.vy = vel[1] * smear;
		p.vz = vel[2] * smear;
		p.st = 1;
		w.push(p);
	}
};
// 画龙点睛的绿光：身体周围向外升腾的绿色字焰、一层柔和的光晕，以及冲过之后留在路径上慢慢熄灭的余光。
const dragonAscent = (a: Assets, t: number, w: Writer, p: P) => {
	if (t < DA_T0 || t > T.clash + 120) return;
	const f = a.ray;
	const charge = ss(DA_T0, DA_T0 + 30, t);
	const dash = ss(DA_GO - 2, DA_GO + 4, t);
	if (t <= DA_OUT) {
		const c = battleRayCenter(t);
		const c2 = battleRayCenter(t + 1);
		const vel: V3 = [c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]];
		const q: V3 = [0, 0, 0];
		// 字焰：从身体各处冒出，向外、向上飘散；冲刺时被甩向身后。
		const FLAMES = 520;
		for (let k = 0; k < FLAMES; k++) {
			battleRayPoint(f, Math.floor(hash(k, 71) * f.n), t, c, q);
			const period = 20 + 22 * hash(k, 72);
			const life = ((t + hash(k, 73) * period) % period) / period;
			const out = norm([q[0] - c[0], q[1] - c[1] + 0.01, 0]);
			const push = (0.3 + 2.4 * life) * (1 - 0.6 * dash);
			const rise = 3.2 * life * life * (1 - dash);
			const sweep = 10 * life * dash;
			p.x = q[0] + out[0] * push - DA_DIR[0] * sweep;
			p.y = q[1] + out[1] * push + rise - DA_DIR[1] * sweep;
			p.z = q[2] + (hash(k, 74) - 0.5) * 1.5 - DA_DIR[2] * sweep;
			p.vx = out[0] * 0.35 * (1 - dash) + vel[0] * dash;
			p.vy = (out[1] * 0.35 + 0.3) * (1 - dash) + vel[1] * dash;
			p.vz = vel[2] * dash;
			p.st = 1;
			p.s = 0.22 + 0.3 * hash(k, 75);
			p.g = Math.floor(hash(k, 76 + Math.floor(t / 6)) * 8);
			setCol(p, mixCol(DA_GREEN, JADE, life), charge * ss(0, 0.12, life) * Math.pow(1 - life, 1.5) * (1.3 + 0.9 * hash(k, 77)) * (1 + 0.6 * dash));
			p.a = 1;
			p.blur = 0;
			w.push(p);
		}
		// 光晕：贴着身体的一层失焦的大字，叠成柔和的绿色辉光。
		const HALO = 80;
		for (let k = 0; k < HALO; k++) {
			battleRayPoint(f, Math.floor(hash(k, 78) * f.n), t, c, q);
			p.x = q[0];
			p.y = q[1];
			p.z = q[2];
			p.vx = vel[0];
			p.vy = vel[1];
			p.vz = vel[2];
			p.st = dash;
			p.s = 1.4 + 1.2 * hash(k, 79);
			p.g = Math.floor(hash(k, 80) * 4);
			setCol(p, DA_GREEN, 0.55 * charge * (0.7 + 0.3 * Math.sin(t * 0.3 + k)) * (1 + dash));
			p.a = 1;
			p.blur = 7;
			w.push(p);
		}
	}
	// 余光：身体掠过的地方留下一道绿色的字迹，顺着去向再滑出一小段，由亮绿褪回青色后熄灭。
	if (t <= DA_GO) return;
	const TRAIL = 460;
	for (let k = 0; k < TRAIL; k++) {
		// 只在身体还在画面里的那十几帧留下余光
		const born = DA_GO + 1 + 18 * hash(k, 81);
		const age = t - born;
		const life = 36 + 70 * hash(k, 82);
		if (age <= 0 || age >= life) continue;
		const cb = battleRayCenter(born);
		const carry = 1.4 * Math.exp(-age / 9);
		const along = (hash(k, 83) - 0.5) * DA_LEN * 0.9 + 9 * (1.4 - carry);
		const up = (hash(k, 84) - 0.5) * 3.2 + 0.02 * age;
		const side = (hash(k, 85) - 0.5) * 2;
		p.x = cb[0] + DA_DIR[0] * along + DA_UP[0] * up + DA_SIDE[0] * side;
		p.y = cb[1] + DA_DIR[1] * along + DA_UP[1] * up + DA_SIDE[1] * side;
		p.z = cb[2] + DA_DIR[2] * along + DA_UP[2] * up + DA_SIDE[2] * side;
		p.vx = DA_DIR[0] * (carry * 2 + 0.15);
		p.vy = DA_DIR[1] * (carry * 2 + 0.15);
		p.vz = DA_DIR[2] * (carry * 2 + 0.15);
		p.st = 1;
		p.s = 0.2 + 0.25 * hash(k, 86);
		p.g = hash(k, 87) < 0.4 ? GLYPH.DASH : Math.floor(hash(k, 88) * 8);
		const fade = ss(0, 2, age) * Math.pow(1 - age / life, 2);
		setCol(p, mixCol(DA_GREEN, JADE, age / life), 1.8 * fade * (0.6 + 0.8 * hash(k, 89)));
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
};
// 代欧奇希斯的招式名在左上、金色；烈空坐的画龙点睛在它自己那一侧（右上）、绿色。
const MOVE_NAMES: [string, string, number, V3, V3][] = [
	['精神增强', 'PSYCHO BOOST', T.laser, [-15.5, 22.5, 46], GOLD],
	['宇宙力量', 'COSMIC POWER', T.cosmic, [-15.5, 22.5, 46], GOLD],
	['自我再生', 'RECOVER', T.recover, [-15.5, 22.5, 46], GOLD],
	['画龙点睛', 'DRAGON ASCENT', DA_T0 + 6, [13, 24, 46], DA_GREEN],
];
const moveNames = (t: number, w: Writer, p: P) => {
	MOVE_NAMES.forEach(([zh, en, t0, c, col]) => {
		if (t < t0 - 5 || t > t0 + 85) return;
		const amt = ss(t0 - 5, t0 + 10, t) * (1 - ss(t0 + 55, t0 + 85, t));
		const fl = 1 + 0.15 * Math.sin(t * 0.9);
		textLine(zh, c, X_AXIS, 1.55, col, 2.0 * amt * fl, w, p, ss(t0 - 5, t0 + 12, t), 1.08);
		textLine(en, [c[0], c[1] - 1.6, c[2]], X_AXIS, 0.6, mixCol(col, CREAM, 0.4), 1.2 * amt, w, p, ss(t0, t0 + 20, t), 1.25);
	});
};
// 宇宙力量：四面八方的字汇入它的身体
const cosmicGather = (t: number, w: Writer, p: P) => {
	if (t < T.cosmic - 5 || t > T.cosmic + 80) return;
	const N = 420;
	for (let k = 0; k < N; k++) {
		const t0 = T.cosmic + hash(k, 1) * 30;
		const u = clamp01((t - t0) / 40);
		if (u <= 0 || u >= 1) continue;
		const d = sphereDir(k, N);
		const r = lerp(34 + 10 * hash(k, 2), 1.5, ein(u));
		p.x = BODY_C[0] + d[0] * r;
		p.y = BODY_C[1] + d[1] * r * 0.8;
		p.z = BODY_C[2] + d[2] * r * 0.6;
		const sp = (34 / 40) * 3 * u * u;
		p.vx = -d[0] * sp;
		p.vy = -d[1] * sp * 0.8;
		p.vz = -d[2] * sp * 0.6;
		p.st = 1;
		p.s = 0.22 + 0.2 * hash(k, 3);
		p.g = Math.floor(hash(k, 4) * 8);
		setCol(p, mixCol(GOLD, CREAM, 0.4), 1.6 * Math.sin(Math.PI * u));
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
};

// ---------- 第 11 段：丰缘的夜海，绿岭宇宙中心与流星雨 ----------
const ROCKET_C: V3 = [-13, SEA_Y, 58];
const SHORE_N = 900;
const mossdeep = (t: number, w: Writer, p: P) => {
	if (t < T.swap5 || t >= T.swap4) return;
	const amt = ss(T.swap5, T.swap5 + 20, t);
	// 远处一道低低的岸线
	for (let k = 0; k < SHORE_N; k++) {
		const x = -30 + hash(k, 1) * 34;
		const h = (0.35 + 0.5 * Math.sin((x + 30) * 0.21) * Math.sin((x + 30) * 0.07 + 1)) * hash(k, 2);
		p.x = x;
		p.y = SEA_Y + Math.max(0, h);
		p.z = 60 + (hash(k, 3) - 0.5) * 3;
		p.s = 0.22 + 0.1 * hash(k, 4);
		p.g = figGlyph(k + 11000, t);
		setCol(p, COLD_DIM, (0.18 + 0.25 * hash(k, 5)) * amt);
		still(p);
		w.push(p);
	}
	// 发射台上的火箭
	const H = 6.2;
	for (let k = 0; k < 520; k++) {
		const part = k < 320 ? 0 : k < 420 ? 1 : 2;
		let x: number;
		let y: number;
		if (part === 0) {
			const s = hash(k, 1);
			const nose = s > 0.82 ? 1 - (s - 0.82) / 0.18 : 1;
			x = (hash(k, 2) - 0.5) * 0.9 * nose;
			y = s * H;
		} else {
			const s = hash(k, 1);
			x = (part === 1 ? -0.75 : 0.75) + (hash(k, 2) - 0.5) * 0.4 * (s > 0.85 ? (1 - s) / 0.15 : 1);
			y = s * H * 0.42;
		}
		p.x = ROCKET_C[0] + x;
		p.y = ROCKET_C[1] + y;
		p.z = ROCKET_C[2] + (hash(k, 3) - 0.5) * 0.3;
		p.s = 0.17;
		p.g = figGlyph(k + 12000, t);
		const side = clamp01(0.5 + x);
		setCol(p, mixCol(COLD_DIM, COLD_HI, 0.3), (0.25 + 0.45 * side) * amt);
		still(p);
		w.push(p);
	}
	// 宇宙中心的几点灯
	for (let k = 0; k < 7; k++) {
		p.x = ROCKET_C[0] + 2.2 + k * 0.7;
		p.y = SEA_Y + 0.45 + (k % 3) * 0.18;
		p.z = ROCKET_C[2] - 0.5;
		p.s = 0.2;
		p.g = GLYPH.DOT;
		setCol(p, TEXT, (0.9 + 0.3 * Math.sin(t / 20 + k)) * amt);
		still(p);
		w.push(p);
	}
};
// 流星雨：从辐射点向外划过的短线；跨过切场延续到冰原，慢慢稀疏
const RADIANT: V3 = norm([-0.24, 0.5, 0.83]);
const SHOWER_O: V3 = [0, -1.4, 3.0];
const meteorShower = (t: number, w: Writer, p: P) => {
	if (t < T.swap5) return;
	const rate = ss(T.swap5 + 10, T.swap5 + 160, t) * (1 - 0.65 * ss(T.swap4 + 40, T.end - 40, t));
	const N = 400;
	const u0: V3 = norm([RADIANT[2], 0, -RADIANT[0]]);
	const v0: V3 = [RADIANT[1] * u0[2] - RADIANT[2] * u0[1], RADIANT[2] * u0[0] - RADIANT[0] * u0[2], RADIANT[0] * u0[1] - RADIANT[1] * u0[0]];
	for (let k = 0; k < N; k++) {
		const ts = T.swap5 + 15 + k * 2.2 + hash(k, 1) * 2;
		const life = 16 + 16 * hash(k, 2);
		const age = t - ts;
		if (age < 0 || age > life) continue;
		if (hash(k, 3) > rate) continue;
		const ang = hash(k, 4) * Math.PI * 2;
		const off = 0.08 + 0.5 * hash(k, 5);
		const dir0 = norm([RADIANT[0] + (u0[0] * Math.cos(ang) + v0[0] * Math.sin(ang)) * off, RADIANT[1] + (u0[1] * Math.cos(ang) + v0[1] * Math.sin(ang)) * off, RADIANT[2] + (u0[2] * Math.cos(ang) + v0[2] * Math.sin(ang)) * off]);
		if (dir0[1] < 0.06) continue;
		const mv: V3 = norm([dir0[0] - RADIANT[0], dir0[1] - RADIANT[1], dir0[2] - RADIANT[2]]);
		// 放在焦点附近（远处的粒子会被景深虚化掉）
		const R = 46;
		const speed = (0.006 + 0.006 * hash(k, 6)) * R;
		const env = Math.sin(Math.PI * (age / life)) * (0.6 + 0.8 * hash(k, 7));
		for (let j = 0; j < 4; j++) {
			const back = j * speed * 3;
			const a2 = age * speed - back;
			p.x = SHOWER_O[0] + dir0[0] * R + mv[0] * a2;
			p.y = SHOWER_O[1] + dir0[1] * R + mv[1] * a2;
			p.z = SHOWER_O[2] + dir0[2] * R + mv[2] * a2;
			p.vx = mv[0] * speed;
			p.vy = mv[1] * speed;
			p.vz = mv[2] * speed;
			p.st = j === 0 ? 6 : 3;
			p.s = (j === 0 ? 0.42 : 0.26) * (1 - j * 0.15);
			p.g = j === 0 ? GLYPH.DOT : Math.floor(hash(k * 4 + j, 8) * 4);
			// 落到海平线附近就熄灭，不划进海面
			const sky = ss(SHOWER_O[1] + 1, SHOWER_O[1] + 4, p.y);
			setCol(p, mixCol(TEXT, COLD_HI, 0.35 + 0.15 * j), env * (j === 0 ? 6.5 : 2.6) * (1 - j * 0.2) * sky);
			p.a = 1;
			p.blur = 0;
			w.push(p);
		}
	}
	// 夜空高处的一点琥珀光：代欧奇希斯还在那里
	if (t < T.swap4 + 200) {
		const amb = ss(T.swap5 + 120, T.swap5 + 220, t) * (1 - ss(T.swap4 + 80, T.swap4 + 200, t));
		const tw = 0.75 + 0.25 * Math.sin(t / 9) * Math.sin(t / 23);
		const cd = norm([52, 40, 120]);
		const c: V3 = [SHOWER_O[0] + cd[0] * 44, SHOWER_O[1] + cd[1] * 44, SHOWER_O[2] + cd[2] * 44];
		for (let k = 0; k < 6; k++) {
			p.x = c[0] + (hash(k, 1) - 0.5) * 0.28;
			p.y = c[1] + (hash(k, 2) - 0.5) * 0.28;
			p.z = c[2];
			p.s = k === 0 ? 0.3 : 0.17;
			p.g = Math.floor(hash(k, 3 + Math.floor(t / 25)) * 4);
			setCol(p, AMBER, (k === 0 ? 2.2 : 0.9) * amb * tw);
			still(p);
			w.push(p);
		}
	}
};

// 诞生之岛：海面上一座字堆成的小岛
const ISLAND_N = 1600;
const island = (t: number, w: Writer, p: P) => {
	if (t < T.swap2 || t > T.swap3) return;
	const amt = ss(T.swap2, T.swap2 + 20, t);
	for (let k = 0; k < ISLAND_N; k++) {
		const rr = Math.sqrt(hash(k, 1)) * ISL_R;
		const ang = hash(k, 2) * Math.PI * 2;
		const edge = rr / ISL_R;
		const hgt = ISL_H * (1 - edge * edge) * (0.85 + 0.3 * hash(k, 3));
		p.x = ISL[0] + Math.cos(ang) * rr * 1.35;
		p.y = ISL[1] + hgt;
		p.z = ISL[2] + Math.sin(ang) * rr * 0.7;
		p.s = 0.085 + 0.04 * hash(k, 4);
		p.g = figGlyph(k + 7000, t);
		// 靠近三角形陨石的一圈被它的光照亮
		const tc = triStone(t);
		const dl = Math.hypot(p.x - tc[0], p.z - tc[2]);
		const lit = t < T.crack + 30 && t > T.land ? Math.exp(-dl / 0.9) * (1 - ss(T.crack, T.crack + 30, t)) : 0;
		const c = mixCol(AMBER, RED, redness(t));
		p.r = COLD_DIM[0] * (0.25 + 0.3 * (1 - edge)) + c[0] * lit * 0.9;
		p.gg = COLD_DIM[1] * (0.25 + 0.3 * (1 - edge)) + c[1] * lit * 0.9;
		p.b = COLD_DIM[2] * (0.25 + 0.3 * (1 - edge)) + c[2] * lit * 0.9;
		p.vx = p.vy = p.vz = 0;
		p.st = 0;
		p.blur = 0;
		p.a = amt;
		w.push(p);
	}
};

const rayquaza = (a: Assets, t: number, w: Writer, p: P) => {
	const T0 = T.impact - 165;
	if (t < T0 || t > T.impact + 45) return;
	const s = clamp01((t - T0 - 10) / (T.impact - T0 - 10));
	const e = s * 0.4 + eio(s) * 0.6;
	const P0: V3 = [36, -2.5, 62];
	const P1: V3 = [18, 4, 52];
	const P2: V3 = [METEOR_C[0] + 1, METEOR_C[1] - 1, METEOR_C[2] + 3];
	const bez = (u: number): V3 => {
		const k = 1 - u;
		return [k * k * P0[0] + 2 * k * u * P1[0] + u * u * P2[0], k * k * P0[1] + 2 * k * u * P1[1] + u * u * P2[1], k * k * P0[2] + 2 * k * u * P1[2] + u * u * P2[2]];
	};
	const c = bez(e);
	const c2 = bez(Math.min(1, e + 0.01));
	const tan: V3 = [c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]];
	const appear = ss(T0, T0 + 45, t);
	const pass = ss(T.impact, T.impact + 40, t);
	const f = a.ray;
	const rot = 0.32;
	const cs = Math.cos(rot);
	const sn = Math.sin(rot);
	for (let i = 0; i < f.n; i++) {
		const x0 = f.x[i] * RAY_H;
		const y0 = f.y[i] * RAY_H;
		const scatter = pass * (8 + 20 * hash(i, 3));
		const d = sphereDir(i, f.n);
		p.x = c[0] + x0 * cs - y0 * sn + d[0] * scatter + tan[0] * pass * 40;
		p.y = c[1] + x0 * sn + y0 * cs + d[1] * scatter + tan[1] * pass * 40;
		p.z = c[2] + f.z[i] * RAY_H * 0.5 + d[2] * scatter;
		p.s = f.cell * RAY_H * (1.2 + 0.3 * hash(i, 5));
		p.g = figGlyph(i + 3000, t);
		const yellow = f.r[i] > 0.55 && f.g[i] > 0.45 && f.b[i] < 0.4;
		setCol(p, yellow ? [0.82, 0.78, 0.62] : JADE, (0.18 + 1.1 * Math.pow(f.lum[i], 1.05)) * 1.5 * appear * (1 - pass));
		p.a = 1;
		p.blur = 0;
		p.vx = tan[0] * 3;
		p.vy = tan[1] * 3;
		p.vz = tan[2] * 3;
		p.st = 0.6 * (0.3 + s);
		w.push(p);
	}
	for (let k = 0; k < 320; k++) {
		const eb = Math.max(0, e - (k / 320) * 0.18);
		const cb = bez(eb);
		const sc = 1.5 + 3 * hash(k, 2);
		p.x = cb[0] + (hash(k, 3) - 0.5) * sc;
		p.y = cb[1] + (hash(k, 4) - 0.5) * sc;
		p.z = cb[2] + (hash(k, 5) - 0.5) * sc;
		p.vx = tan[0] * 4;
		p.vy = tan[1] * 4;
		p.vz = tan[2] * 4;
		p.st = 1;
		p.s = 0.3;
		p.g = Math.floor(hash(k, 6 + Math.floor(t / 10)) * 4);
		setCol(p, mixCol(JADE, COLD_HI, 0.4), 0.9 * (1 - k / 320) * appear * (1 - pass) * (eb > 0 ? 1 : 0));
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
};

// 碎屑池：第 1 段的陨石本体、第 6 段陨石的内层、击碎后的碎片
const DEBRIS_N = 3000;
const debris = (t: number, w: Writer, p: P) => {
	if (t < 540) {
		const fade = ss(0, 30, t);
		const m = t < T.swap ? {c: meteor1(t), r: M1_R} : meteorInterior(t);
		const rockTime = t < T.swap ? t : T.swap + 18 * (1 - Math.exp(-(t - T.swap) / 18));
		const b = cameraBasis(frameCam);
		for (let i = 0; i < DEBRIS_N; i++) {
			rockState(i, DEBRIS_N, m.c, m.r, rockTime * 0.6, 0.35 + 0.5 * ss(150, 330, t), M1_DIR, p);
			p.a *= fade * (1 - ss(455, 500, t));
			if (t >= T.swap) {
				const depth = (p.x - frameCam.pos[0]) * b.f[0] + (p.y - frameCam.pos[1]) * b.f[1] + (p.z - frameCam.pos[2]) * b.f[2];
				p.a *= ss(0.5, 3, depth);
			}
			w.push(p);
		}
		// 岩壳下的三层矿物纹理：穿过镜头近面时柔和隐去，中心裂隙逐步露出 DNA。
		if (t >= T.swap) {
			const reveal = ss(410, 448, t) * (1 - ss(495, 540, t));
			for (let layer = 0; layer < 3; layer++) {
				const radius = m.r * (0.85 - layer * 0.18);
				for (let i = 0; i < 1100; i++) {
					rockState(i, 1100, m.c, radius, (T.swap + layer * 155) * 0.6, 0.3, M1_DIR, p);
					const dx = p.x - frameCam.pos[0];
					const dy = p.y - frameCam.pos[1];
					const dz = p.z - frameCam.pos[2];
					const depth = dx * b.f[0] + dy * b.f[1] + dz * b.f[2];
					const side = Math.hypot(dx * b.r[0] + dy * b.r[1] + dz * b.r[2], dx * b.u[0] + dy * b.u[1] + dz * b.u[2]);
					const opening = ss(440, 495, t) * 0.85;
					p.a = reveal * ss(0.5, 2.5, depth) * ss(opening, opening + 0.22, side / Math.max(depth, 0.5));
					p.s *= 0.55;
					setCol(p, mixCol(COLD_HI, AMBER, 0.25 + layer * 0.15), 0.4 + 0.45 * hash(i, 95));
					w.push(p);
				}
			}
		}
		return;
	}
	if (t < T.swap3 + 20 || t > T.cool + 100) return;
	for (let i = 0; i < DEBRIS_N; i++) {
		if (t < T.impact) {
			const m = meteoroid(t);
			rockState(i, DEBRIS_N, m.c, m.r, t, meteoroidHeat(t), MOVE6, p, 0.9);
			p.a = ss(T.swap3 + 20, T.swap3 + 120, t) * 0.8;
		} else {
			shatterState(i, t, p, DEBRIS_N, 1.4);
			p.s *= 0.7;
			const k = (0.15 + 0.85 * (1 - ss(T.impact + 120, T.impact + 320, t))) * 0.5;
			p.r *= k;
			p.gg *= k;
			p.b *= k;
			p.a = 1 - ss(T.cool - 50, T.cool + 100, t);
		}
		w.push(p);
	}
};

const godRays = (t: number, cam: Camera, w: Writer, p: P) => {
	const b = cameraBasis(cam);
	const ray = (t0: number, t1: number, c: V3, n: number, len: number, col0: V3, col1: V3, k0: number) => {
		if (t < t0 || t > t1) return;
		const u = (t - t0) / (t1 - t0);
		const amt = ss(0, 0.08, u) * (1 - ss(0.45, 1, u));
		for (let k = 0; k < n; k++) {
			const ang = hash(k, 1 + k0) * Math.PI * 2;
			const dx = Math.cos(ang);
			const dy = Math.sin(ang);
			const r0 = 2 + 4 * hash(k, 2 + k0) + u * 12;
			const L = len * (0.3 + 0.7 * hash(k, 3 + k0)) * eout(clamp01(u * 3));
			const ox = b.r[0] * dx + b.u[0] * dy;
			const oy = b.r[1] * dx + b.u[1] * dy;
			const oz = b.r[2] * dx + b.u[2] * dy;
			p.x = c[0] + ox * r0;
			p.y = c[1] + oy * r0;
			p.z = c[2] + oz * r0;
			p.vx = ox * L;
			p.vy = oy * L;
			p.vz = oz * L;
			p.st = 1;
			p.s = 0.14 + 0.14 * hash(k, 4 + k0);
			p.g = hash(k, 5) < 0.5 ? GLYPH.DASH : Math.floor(hash(k, 6 + k0) * 8);
			setCol(p, mixCol(col0, col1, u), amt * (0.5 + 1.3 * hash(k, 7 + k0)));
			p.a = 1;
			p.blur = 0;
			w.push(p);
		}
	};
	ray(T.impact, T.impact + 170, METEOR_C, 380, 18, ROSE, GOLD, 0);
	ray(T.burst + 20, T.burst + 180, METEOR_C, 260, 14, GOLD, ROSE, 50);
	ray(T.strike, T.strike + 110, [9, 15, 49], 220, 12, CREAM, GOLD, 90);
	ray(T.clash, T.clash + 75, BODY_C, 320, 12, CREAM, GOLD, 130);
};

const laserS6 = (a: Assets, t: number, w: Writer, p: P) => {
	if (t < T.laser - 5 || t > T.laser + 140) return;
	const cw = crystalWorld(a.normal, METEOR_C, WARM_H, t);
	cw[2] -= 0.3;
	// 射向右边的烈空坐
	const rc = battleRayCenter(t);
	const to: V3 = [rc[0] - 2 - cw[0], rc[1] + 1 - cw[1], rc[2] - cw[2]];
	const dist = Math.hypot(...to);
	const dir = norm(to);
	const reach = eout(clamp01((t - T.laser) / 12)) * dist;
	const fade = 1 - ss(T.laser + 70, T.laser + 110, t);
	const N = 260;
	for (let k = 0; k < N; k++) {
		const u = (k / N) * reach;
		const jit = (hash(k, Math.floor(t)) - 0.5) * 0.12;
		p.x = cw[0] + dir[0] * u + jit;
		p.y = cw[1] + dir[1] * u + jit;
		p.z = cw[2] + dir[2] * u;
		p.vx = dir[0] * (reach / N) * 2.5;
		p.vy = dir[1] * (reach / N) * 2.5;
		p.vz = dir[2] * (reach / N) * 2.5;
		p.st = 1;
		p.s = 0.22 + 0.15 * Math.exp(-u / 6);
		p.g = hash(k, 2) < 0.6 ? GLYPH.DASH : Math.floor(hash(k, 3) * 4);
		setCol(p, mixCol(GOLD, CREAM, 0.35), 3.2 * fade * (0.8 + 0.4 * hash(k, Math.floor(t) + 1)));
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
	for (let k = 0; k < 90; k++) {
		const d = sphereDir(k, 90);
		const life = ((t - T.laser + hash(k, 4) * 40) % 40) / 40;
		const r = 0.5 + life * 4;
		p.x = cw[0] + d[0] * r;
		p.y = cw[1] + d[1] * r;
		p.z = cw[2] + d[2] * r;
		p.vx = d[0] * 0.4;
		p.vy = d[1] * 0.4;
		p.vz = d[2] * 0.4;
		p.st = 1;
		p.s = 0.14;
		p.g = Math.floor(hash(k, 5) * 8);
		setCol(p, GOLD, 1.8 * (1 - life) * fade);
		p.a = 1;
		p.blur = 0;
		w.push(p);
	}
	// 打在烈空坐身上的火花
	if (t > T.laser + 10) {
		const hp: V3 = [cw[0] + dir[0] * reach, cw[1] + dir[1] * reach, cw[2] + dir[2] * reach];
		for (let k = 0; k < 120; k++) {
			const d = sphereDir(k, 120);
			const life = ((t - T.laser + hash(k, 6) * 24) % 24) / 24;
			const r = 0.4 + life * (3 + 3 * hash(k, 7));
			p.x = hp[0] + d[0] * r;
			p.y = hp[1] + d[1] * r;
			p.z = hp[2] + d[2] * r;
			p.vx = d[0] * 0.6;
			p.vy = d[1] * 0.6;
			p.vz = d[2] * 0.6;
			p.st = 1;
			p.s = 0.16;
			p.g = Math.floor(hash(k, 8) * 8);
			setCol(p, mixCol(GOLD, CREAM, 0.5), 2.2 * (1 - life) * fade);
			p.a = 1;
			p.blur = 0;
			w.push(p);
		}
	}
};

// ---------- 环境与后期 ----------
const pulse = (t: number, t0: number, k = 55) => ss(t0 - 8, t0 + 14, t) * Math.exp(-Math.max(0, t - t0 - 14) / k);
const ZERO: V3 = [0, 0, 0];
const scale = (c: V3, k: number): V3 => [c[0] * k, c[1] * k, c[2] * k];

const envAt = (t: number, cam: Camera, a: Assets): Env => {
	const inS1 = t < MICRO_READY;
	const exterior = 1 - ss(T.swap, 480, t);
	const inMicro = t >= T.swap && t < T.orbit;
	const inOrbit = t >= T.orbit && t < T.swap2;
	const inIsland = t >= T.swap2 && t < T.swap3;
	const inSpace = t >= T.swap3 && t < T.swap5;
	const inShower = t >= T.swap5 && t < T.swap4;
	const inIce = t >= T.swap4;
	const planetAmt = inS1 ? exterior : inOrbit ? ss(T.orbit, T.orbit + 120, t) : inSpace ? ss(T.swap3, T.swap3 + 50, t) : 0;
	const planetC = inS1 ? PLANET_S1 : inOrbit ? PLANET_S4 : PLANET_S6;
	const seaAmt = inIsland || inShower || inIce ? 1 : 0;
	const starAmt = inS1 ? 0.9 * exterior : inMicro ? 0 : inOrbit ? 0.75 * ss(T.orbit, T.orbit + 120, t) : inIsland ? 0.65 + 0.15 * ss(T.islandFade, T.chart, t) : inSpace ? lerp(0.8, 1, ss(T.swap3, T.swap3 + 70, t)) : 0.8;
	// 切进太空时星云慢慢浮现，切点前后的夜空一致
	const spaceAmt = inS1 ? 0.6 * exterior : inOrbit ? 0.6 * ss(T.orbit, T.orbit + 120, t) : inSpace ? ss(T.swap3, T.swap3 + 80, t) : 0;
	let morphs = pulse(t, T.mA + 35) + pulse(t, T.mD + 35) + pulse(t, T.mS + 35);
	for (let k = 0; k < SITES.length; k++) morphs += 0.35 * pulse(t, meteorAt(k) + 18, 20);
	const limbAurora = inOrbit ? (0.9 * ss(T.orbit + 40, T.orbit + 140, t) + 2.0 * morphs) * (1 - ss(T.contract, T.swap2, t)) : inSpace ? 0.6 * ss(T.cool, T.cool + 120, t) : 0;
	const skyAurora = inIsland ? 0.9 * pulse(t, 2850, 50) + 1.2 * pulse(t, T.crack + 70, 45) : inIce ? 2.0 * ss(T.swap4, T.swap4 + 80, t) * (1 - ss(T.end - 50, T.end - 2, t)) : 0;
	// 对齐 coldFigure：整片极光用 0.4 秒统一变色，段间及变色期间保持亮起。
	const morphStarts = [T.mA, T.mD, T.mS, ...SITES.map((_, k) => meteorAt(k) + 4)];
	const morphIndex = inOrbit ? morphStarts.reduce((last, start, k) => t >= start ? k : last, -1) : -1;
	const morphAurora = morphIndex >= 0 ? 2.8 * ss(T.mA, T.mA + 10, t) * (1 - ss(T.contract, T.fall, t)) : 0;
	const morphViolet = morphIndex > 0 ? lerp((morphIndex - 1) % 2, morphIndex % 2, ss(morphStarts[morphIndex], morphStarts[morphIndex] + 12, t)) : 0;
	const dustAmt = inMicro ? ss(465, MICRO_READY, t) : inOrbit ? lerp(1, 0.2, ss(T.orbit, T.orbit + 120, t)) : inSpace ? (t < T.impact ? 0.15 * ss(T.swap3, T.swap3 + 60, t) : 0.45) : inShower || inIce ? 0.1 : 0;
	const skyWarm = t < T.impact - 110 ? 0 : t < T.impact ? 0.45 * ss(T.impact - 110, T.impact, t) : t < T.impact + 60 ? lerp(0.45, 1, ss(T.impact, T.impact + 60, t)) : t < T.cool ? lerp(1, 2, ss(T.impact + 60, T.impact + 270, t)) * (1 - 0.3 * ss(T.battle, T.laser, t)) * (1 + 0.25 * pulse(t, T.clash, 30)) : 1.4 * (1 + 0.25 * pulse(t, T.clash, 30)) * (1 - ss(T.cool, T.cool + 140, t));
	const flash1 = t < T.swap ? Math.pow(ss(T.swap - 40, T.swap - 1, t), 2) * 0.14 : 0.14 * Math.exp(-(t - T.swap) / 14);
	const flashS = (t0: number, k: number) => (t >= t0 - 8 ? ss(t0 - 8, t0, t) * k * Math.exp(-Math.max(0, t - t0) / 12) : 0);
	const flash =
		flash1 * (t < T.swap + 120 ? 1 : 0) +
		flashS(T.swap2, 0.12) +
		flashS(T.crack, 0.07) +
		flashS(T.impact + 4, 0.16) +
		flashS(T.laser, 0.08) +
		flashS(T.strike, 0.12) +
		flashS(T.clash, 0.14) +
		flashS(T.swap5, 0.1);
	let l0Pos: V3 = [0, 50, 200];
	let l0Col: V3 = ZERO;
	let l1Pos: V3 = [0, 50, 200];
	let l1Col: V3 = ZERO;
	if (inIsland) {
		l0Pos = triStone(Math.min(t, T.crack));
		l0Col = scale(mixCol(AMBER, RED, redness(t)), (0.15 + 0.75 * redness(t)) * ss(T.land - 10, T.land + 10, t) * (1 - ss(T.crack, T.crack + 30, t)) + 0.9 * (1 - ss(T.land - 10, T.land + 10, t)));
		if (t > T.crack) {
			l1Pos = crystalWorld(a.normal, ISL_FIG, ISL_FIG_H, t);
			l1Col = scale(AMBER, 0.6 * ss(T.crack + 40, T.crack + 90, t) * (1 - ss(T.islandFade, T.islandFade + 50, t)));
		}
	}
	return {
		time: t / 30,
		seaAmt,
		seaY: inIce ? ICE_Y : SEA_Y,
		starAmt,
		spaceAmt,
		auroraAmt: skyAurora,
		auroraWarm: 0,
		morphAurora,
		morphViolet,
		dustAmt,
		dustOff: [cam.yaw * 0.9 + cam.pos[0] * 0.03, -cam.pitch * 0.9 - cam.pos[1] * 0.03],
		skyWarm,
		flash,
		l0Pos,
		l0Col,
		l1Pos,
		l1Col,
		planetAmt,
		planetC,
		planetR: PLANET_R,
		limbAurora,
		wave: inIce ? 0 : 1,
	};
};

const postAt = (t: number): Post => {
	const blip = (t0: number, k: number) => k * ss(t0 - 2, t0 + 2, t) * (1 - ss(t0 + 6, t0 + 16, t));
	const glitch = ss(T.hit - 4, T.hit + 4, t) * (1 - ss(T.hit + 10, T.hit + 26, t)) + blip(T.impact, 0.5) + blip(T.bend, 0.3) + blip(T.strike, 0.4);
	const flashy = Math.exp(-Math.abs(t - T.swap) / 10) + Math.exp(-Math.abs(t - T.impact) / 12) + 0.6 * Math.exp(-Math.abs(t - T.strike) / 10) + 0.6 * Math.exp(-Math.abs(t - T.clash) / 10);
	// 小岛段末仰望夜空时，焦点推到远处的星图上
	const cp = cameraAt(t).pos;
	const islandFocus = lerp(Math.hypot(cp[0] - ISL[0], cp[1] - ISL[1] - 0.5, cp[2] - ISL[2]), 130, ss(T.islandFade + 10, T.chart + 30, t));
	const focus = t < MICRO_READY ? lerp(26, 11, ss(T.swap, MICRO_READY, t)) : t < T.orbit ? 11 : t < T.swap2 ? 10.5 : t < T.swap3 ? lerp(islandFocus, 46, ss(T.swap3 - 70, T.swap3 - 10, t)) : t < T.swap5 ? 46 : 40;
	return {
		threshold: 0.28,
		bloom: lerp(0.9, 1.15, ss(T.impact - 60, T.impact, t) * (1 - ss(T.cool + 100, T.cool + 200, t))),
		exposure: 1.15,
		glitch,
		aberr: 0.0018 + flashy * 0.004,
		vignette: 0.7,
		fade: ss(0, 30, t) * (1 - ss(T.end - 35, T.end - 2, t)),
		focus,
		dofK: t < MICRO_READY ? lerp(6, 26, ss(T.swap, MICRO_READY, t)) : t < T.swap3 ? 26 : 40,
	};
};

// ---------- 入口 ----------
const writer = new Writer(40000);
const tmp = mkP();

export const buildFrame = (t: number, a: Assets): FrameData => {
	const cam = cameraAt(t);
	frameCam = cam;
	writer.n = 0;
	for (let i = 0; i < HERO_N; i++) {
		heroState(a, i, t, tmp);
		writer.push(tmp);
	}
	debris(t, writer, tmp);
	if (t < 435) {
		const m = t < T.swap ? {c: meteor1(t), r: M1_R} : meteorInterior(t);
		trail(m.c, m.r, M1_DIR, ss(0, 40, t) * (0.6 + 0.6 * ss(150, 330, t)) * (1 - ss(T.swap, 435, t)), 420, t, writer, tmp, 0);
	}
	// 夜空里那一点：巨大的陨石，在星图上走着、转向，最后停在太空段开场的位置（跨过切场，位置不变）
	if (t > T.islandFade && t < T.swap3 + 50) {
		const m = skyDot(t);
		const amt = ss(T.islandFade + 10, T.islandFade + 50, t) * (1 - ss(T.swap3 + 10, T.swap3 + 50, t));
		for (let k = 0; k < 14; k++) {
			tmp.x = m[0] + (hash(k, 1) - 0.5) * 1.6;
			tmp.y = m[1] + (hash(k, 2) - 0.5) * 1.6;
			tmp.z = m[2] + (hash(k, 3) - 0.5) * 1.6;
			tmp.s = 1.1;
			tmp.g = Math.floor(hash(k, 4 + Math.floor(t / 20)) * 4);
			setCol(tmp, AMBER, (k === 0 ? 4 : 2) * amt * (1 + 0.6 * pulse(t, T.bend, 25)));
			still(tmp);
			writer.push(tmp);
		}
	}
	if (t > T.swap3 && t < T.impact) {
		const m = meteoroid(t);
		trail(m.c, m.r, MOVE6, ss(T.swap3 + 20, T.swap3 + 100, t) * meteoroidHeat(t) * 0.6, 520, t, writer, tmp, 9);
	}
	tunnel(t, cam, writer, tmp, T.zoom + 20, T.swap - 15, t < T.swap ? T.swap + 80 : 440, 0);
	tunnel(t, cam, writer, tmp, T.fall, T.swap2 - 10, T.swap2 + 60, 3);
	tunnel(t, cam, writer, tmp, T.swap5 - 70, T.swap5 - 8, T.swap5 + 60, 6);
	laserS2(t, writer, tmp);
	meteorSites(a, t, writer, tmp);
	island(t, writer, tmp);
	shipWake(t, writer, tmp);
	islandPaths(t, writer, tmp);
	starChart(t, writer, tmp);
	rayquaza(a, t, writer, tmp);
	godRays(t, cam, writer, tmp);
	battleRay(a, t, writer, tmp);
	dragonAscent(a, t, writer, tmp);
	laserS6(a, t, writer, tmp);
	cosmicGather(t, writer, tmp);
	moveNames(t, writer, tmp);
	mossdeep(t, writer, tmp);
	meteorShower(t, writer, tmp);
	return {cam, env: envAt(t, cam, a), post: postAt(t), particles: writer.buf, count: writer.n};
};
