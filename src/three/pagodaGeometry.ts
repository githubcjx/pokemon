import * as THREE from 'three';

// ─── 程序化九重塔：纯代码生成的几何，不用外部模型 ─────────────────────────────
// 方形平面、九层逐层收分；每层 = 塔身（柱、梁、壁、门）+ 斗栱带 + 翘角屋檐，顶上是相轮。
// 尺寸单位约等于米：塔基宽约 13.5，塔高（含相轮）约 44。

/** 可复现的伪随机数（mulberry32），保证每帧渲染结果一致 */
export const rng = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Tier = {
	i: number;
	/** 本层地面高度 */
	y0: number;
	/** 塔身宽 */
	w: number;
	/** 塔身高 */
	h: number;
	/** 屋檐外缘高度 */
	roofOut: number;
	/** 屋面内缘（接上一层）高度 */
	roofIn: number;
	/** 屋面内缘半宽 */
	a: number;
	/** 屋檐外缘半宽（出檐） */
	R: number;
};

export const PODIUM_TOP = 1.4;
export const TIER_COUNT = 9;

export const TIERS: Tier[] = (() => {
	const tiers: Tier[] = [];
	let y = PODIUM_TOP;
	const width = (i: number) => 8.4 - i * 0.4;
	for (let i = 0; i < TIER_COUNT; i++) {
		const w = width(i);
		const h = i === 0 ? 3.8 : 2.1;
		const wNext = i < TIER_COUNT - 1 ? width(i + 1) : w * 0.45;
		const R = w / 2 + 2.3 - i * 0.08;
		const a = wNext / 2 + 0.2;
		const roofOut = y + h + 0.32;
		const drop = 1.0 + (R - a) * 0.14;
		const roofIn = roofOut + drop;
		tiers.push({i, y0: y, w, h, roofOut, roofIn, a, R});
		y = roofIn - 0.12;
	}
	return tiers;
})();

/** 最上层屋面内缘高度（相轮的底座） */
export const PAGODA_TOP = TIERS[TIER_COUNT - 1].roofIn;

type RoofOpts = {
	/** 翘角高度 */
	lift?: number;
	/** 烧穿的破洞：返回 true 的格子不生成 */
	hole?: (side: number, v: number, s: number) => boolean;
	/** 屋面整体下沉（废墟里塌陷的屋檐），按到中心的距离加权 */
	sag?: (side: number, v: number, s: number) => number;
};

const squarePoint = (side: number, d: number, s: number) => {
	const ang = (side * Math.PI) / 2;
	const c = Math.cos(ang);
	const sn = Math.sin(ang);
	const lx = d;
	const lz = s * d;
	return [lx * c - lz * sn, lx * sn + lz * c] as const;
};

/**
 * 翘角屋面：从内缘 a（高 yIn）到外缘 R（高 yOut）的方形曲面。
 * 剖面上陡下缓（日式屋檐的反曲），四角随离中心线的距离向上翘起。
 * 法线朝上；屋檐底面用同一几何体下移、渲染背面。
 */
export const roofGeometry = (tier: Tier, opts: RoofOpts = {}) => {
	const {a, R, roofIn: yIn, roofOut: yOut} = tier;
	const lift = opts.lift ?? 0.75;
	const NS = 28;
	const NV = 12;
	const pos: number[] = [];
	const uv: number[] = [];
	const idx: number[] = [];
	for (let side = 0; side < 4; side++) {
		const base = pos.length / 3;
		for (let iv = 0; iv <= NV; iv++) {
			const v = iv / NV;
			const d = a + (R - a) * v;
			const yv = yIn - (yIn - yOut) * (1 - Math.pow(1 - v, 1.7));
			for (let is = 0; is <= NS; is++) {
				const s = -1 + (2 * is) / NS;
				const [x, z] = squarePoint(side, d, s);
				const y = yv + lift * Math.pow(v, 3) * Math.pow(Math.abs(s), 5) - (opts.sag ? opts.sag(side, v, s) : 0);
				pos.push(x, y, z);
				uv.push((s * d) / 2.4, (v * (R - a)) / 2.4);
			}
		}
		for (let iv = 0; iv < NV; iv++) {
			for (let is = 0; is < NS; is++) {
				const vc = (iv + 0.5) / NV;
				const sc = -1 + (2 * (is + 0.5)) / NS;
				if (opts.hole && opts.hole(side, vc, sc)) continue;
				const p00 = base + iv * (NS + 1) + is;
				const p01 = p00 + 1;
				const p10 = p00 + (NS + 1);
				const p11 = p10 + 1;
				idx.push(p00, p01, p10, p10, p01, p11);
			}
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
};

/** 屋檐外缘的封檐板（一圈竖向窄带，金色描边） */
export const fasciaGeometry = (tier: Tier, opts: RoofOpts & {depth?: number} = {}) => {
	const {R, roofOut: yOut} = tier;
	const lift = opts.lift ?? 0.75;
	const depth = opts.depth ?? 0.3;
	const NS = 28;
	const pos: number[] = [];
	const idx: number[] = [];
	for (let side = 0; side < 4; side++) {
		const base = pos.length / 3;
		for (let is = 0; is <= NS; is++) {
			const s = -1 + (2 * is) / NS;
			const [x, z] = squarePoint(side, R, s);
			const y = yOut + lift * Math.pow(Math.abs(s), 5) - (opts.sag ? opts.sag(side, 1, s) : 0);
			pos.push(x, y, z, x, y - depth, z);
		}
		for (let is = 0; is < NS; is++) {
			const sc = -1 + (2 * (is + 0.5)) / NS;
			if (opts.hole && opts.hole(side, 0.99, sc)) continue;
			const t0 = base + is * 2;
			const b0 = t0 + 1;
			const t1 = t0 + 2;
			const b1 = t0 + 3;
			idx.push(t0, t1, b0, b0, t1, b1);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
};

/** 塔身一圈的柱位（每面 4 根，含转角，共 12 根） */
export const pillarSpots = (w: number) => {
	const half = w / 2 - 0.17;
	const ts = [-1, -1 / 3, 1 / 3, 1];
	const spots: [number, number][] = [];
	for (const tx of ts) {
		for (const tz of ts) {
			if (Math.abs(tx) === 1 || Math.abs(tz) === 1) spots.push([tx * half, tz * half]);
		}
	}
	return spots;
};

/** 瓦面纹理：一道道筒瓦的凹凸条纹 */
export const tileTexture = (base: string, groove: string, ridge: string) => {
	const c = document.createElement('canvas');
	c.width = 256;
	c.height = 256;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, 256, 256);
	for (let x = 0; x < 256; x += 32) {
		ctx.fillStyle = groove;
		ctx.fillRect(x, 0, 7, 256);
		ctx.fillStyle = ridge;
		ctx.fillRect(x + 14, 0, 6, 256);
	}
	ctx.globalAlpha = 0.25;
	ctx.fillStyle = groove;
	for (let y = 0; y < 256; y += 40) ctx.fillRect(0, y, 256, 2);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = THREE.RepeatWrapping;
	t.wrapT = THREE.RepeatWrapping;
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
};

/**
 * 做旧的表面纹理：底色 + 斑驳的明暗 + 从下往上泛起的污渍 + 竖向雨痕。
 * 盒子每个面的 UV 是 0–1，v=0 在下，所以污渍正好落在每面的下半截。
 */
export const agedTexture = (
	base: string,
	grime: string,
	opts: {seed?: number; size?: number; grimeH?: number; streaks?: number; mottle?: number; grain?: boolean} = {},
) => {
	const size = opts.size ?? 256;
	const r = rng(opts.seed ?? 3);
	const c = document.createElement('canvas');
	c.width = size;
	c.height = size;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, size, size);
	// 斑驳
	const mottle = opts.mottle ?? 0.18;
	for (let i = 0; i < 90; i++) {
		const x = r() * size;
		const y = r() * size;
		const rad = size * (0.04 + r() * 0.16);
		const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
		const dark = r() < 0.6;
		g.addColorStop(0, dark ? `rgba(40,26,12,${mottle * r()})` : `rgba(255,244,214,${mottle * 0.7 * r()})`);
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
	}
	// 木纹 / 细颗粒
	if (opts.grain) {
		ctx.globalAlpha = 0.12;
		for (let x = 0; x < size; x += 2) {
			ctx.fillStyle = r() < 0.5 ? grime : base;
			ctx.fillRect(x, 0, 1, size);
		}
		ctx.globalAlpha = 1;
	}
	// 下半截的污渍（canvas 上 y 越大越靠下）
	const gh = opts.grimeH ?? 0.45;
	const g = ctx.createLinearGradient(0, size * (1 - gh), 0, size);
	g.addColorStop(0, 'rgba(0,0,0,0)');
	g.addColorStop(1, grime);
	ctx.fillStyle = g;
	ctx.fillRect(0, size * (1 - gh), size, size * gh);
	// 雨痕
	const streaks = opts.streaks ?? 26;
	for (let i = 0; i < streaks; i++) {
		const x = r() * size;
		const len = size * (0.2 + r() * 0.7);
		const w = 1 + r() * 3;
		const sg = ctx.createLinearGradient(0, 0, 0, len);
		sg.addColorStop(0, 'rgba(50,34,18,0.32)');
		sg.addColorStop(1, 'rgba(50,34,18,0)');
		ctx.fillStyle = sg;
		ctx.fillRect(x, 0, w, len);
	}
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
};

/** 在瓦面纹理上叠青苔与绿锈斑 */
export const mossyTileTexture = (base: string, groove: string, ridge: string, moss: string, seed = 9) => {
	const t = tileTexture(base, groove, ridge);
	const c = t.image as HTMLCanvasElement;
	const ctx = c.getContext('2d')!;
	const r = rng(seed);
	for (let i = 0; i < 40; i++) {
		const x = r() * 256;
		const y = r() * 256;
		const rad = 10 + r() * 46;
		const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
		g.addColorStop(0, moss);
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.globalAlpha = 0.35 + r() * 0.4;
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 256, 256);
	}
	ctx.globalAlpha = 1;
	t.needsUpdate = true;
	return t;
};
