import {useMemo} from 'react';
import * as THREE from 'three';
import {CINZEL, SERIF} from '../../fonts';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, BEAT, easeInQuad, easeOutCubic, env, lerp, prog, rnd, smooth, track} from './common';
import {PEARL, PINK} from './hook';

/**
 * 第 4 段「胀大与弯曲」：
 * 银河缩成一个半透明的面团，葡萄干嵌在里面；面团胀大，葡萄干之间越来越远、葡萄干自己不动
 * → 面团溶成宇宙网，葡萄干变成星系，网继续被撑开 → 网压成一张网格蹦床（RippleGrid / GridDistortion 的思路做成 3D 网面）：
 * 保龄球落下压出坑、弹珠绕坑滚、保龄球变成太阳、星光沿弯下去的网格绕过太阳，坑底越来越亮。
 * 这张网格（SpaceSheet）一直用到第 5、6 段：翻成珍珠母贝、扭曲 / 打碎 / 再造、被亚空裂斩斩开。
 */

// ════════ 时间线 ════════

export const DOUGH_AT = bf(22, 3);
const SWELL_FROM = bf(23, 1);
const SWELL_TO = bf(27);
export const WEB_AT = bf(25, 2);
export const SHEET_AT = bf(26, 2);
const DROP_AT = bf(26, 3);
export const LAND_AT = bf(27);
export const MARBLE_AT = bf(28);
export const SUN_AT = bf(29);
/** 第 30 小节落拍：坑底的光爆开，起源形态显色 */
export const ORIGIN_AT = bf(30);
const FLIP_TO = bf(30, 3);
export const TWIST_AT = bf(32, 2);
export const SHATTER_AT = bf(32, 3);
export const REMAKE_AT = bf(33);
/** 第 35 小节强拍：亚空裂斩 */
export const REND_AT = bf(35);

/** 面团 / 宇宙网的胀大倍数：匀速的指数增长（和真实的膨胀一样，越大长得越快） */
export const swellAt = (f: number) => Math.pow(3.2, prog(f, SWELL_FROM, SWELL_TO));

// ════════ 面团与葡萄干 ════════

/** 面团中心：第 22 小节镜头的视线上（银河就缩在这里） */
export const DOUGH_C: V3 = [0, 5.16, 0];
const R0 = 3.3;
/** 网格节点间距（面团半径为 1 的局部单位） */
const G = 0.62;
const NODE_R = 3;

/** 节点 (i,j,k) 的局部坐标（带固定的小抖动）；中间 3×3×3 去掉八个角就是葡萄干 */
const nodeLocal = (i: number, j: number, k: number): V3 => {
	const s = i * 49 + j * 7 + k;
	return [(i + (rnd(s * 1.7 + 0.3) - 0.5) * 0.24) * G, (j + (rnd(s * 2.9 + 1.1) - 0.5) * 0.24) * G, (k + (rnd(s * 4.3 + 2.7) - 0.5) * 0.24) * G];
};
const isRaisin = (i: number, j: number, k: number) => Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) <= 1 && Math.abs(i) + Math.abs(j) + Math.abs(k) < 3;
const RAISINS: V3[] = [];
for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) if (isRaisin(i, j, k)) RAISINS.push(nodeLocal(i, j, k));

const toWorld = (l: V3, s: number): V3 => [DOUGH_C[0] + l[0] * R0 * s, DOUGH_C[1] + l[1] * R0 * s, DOUGH_C[2] + l[2] * R0 * s];

const doughOn = (f: number) => env(f, DOUGH_AT - 4, WEB_AT + 22, 18, 22);

export const Dough: React.FC<{f: number}> = ({f}) => {
	const mats = useMemo(
		() => ({
			dough: new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				uniforms: {uA: {value: 0}, uT: {value: 0}},
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV; varying vec3 vL;
					void main() {
						vL = position;
						vec4 mv = modelViewMatrix * vec4(position, 1.0);
						vN = normalize(normalMatrix * normal);
						vV = normalize(-mv.xyz);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uT;
					varying vec3 vN; varying vec3 vV; varying vec3 vL;
					float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
					float n3(vec3 x) {
						vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
						return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
							mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z);
					}
					void main() {
						float mu = abs(dot(vN, vV));
						float fres = pow(1.0 - mu, 2.2);
						// 面团的气孔纹理：局部坐标上的噪声，跟着面团一起胀大
						float pores = n3(vL * 5.0 + uT * 0.002) * 0.6 + n3(vL * 11.0) * 0.4;
						vec3 base = mix(vec3(1.0, 0.88, 0.84), vec3(0.9, 0.82, 1.0), pores);
						vec3 col = base * (0.16 + 0.85 * fres) + vec3(1.0, 0.9, 0.95) * pow(max(dot(vN, normalize(vec3(-0.5, 0.7, 0.6))), 0.0), 12.0) * 0.35;
						float a = (0.24 + 0.6 * fres + 0.08 * pores) * uA;
						gl_FragColor = vec4(col, a);
					}`,
			}),
			raisin: new THREE.ShaderMaterial({
				uniforms: {uA: {value: 0}},
				transparent: true,
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV; varying vec3 vL;
					void main() {
						vL = position;
						vec4 mv = modelViewMatrix * vec4(position, 1.0);
						vN = normalize(normalMatrix * normal);
						vV = normalize(-mv.xyz);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vL;
					void main() {
						float fres = pow(1.0 - abs(dot(vN, vV)), 2.0);
						// 皱褶：沿表面的条纹
						float wr = 0.5 + 0.5 * sin(vL.x * 9.0 + vL.y * 13.0 + sin(vL.z * 7.0) * 2.0);
						vec3 col = vec3(0.09, 0.045, 0.07) * (0.7 + 0.5 * wr) + vec3(1.0, 0.6, 0.82) * fres * 0.55;
						gl_FragColor = vec4(col, uA);
					}`,
			}),
		}),
		[],
	);
	const on = doughOn(f);
	if (on <= 0) return null;
	const s = swellAt(f);
	// 从银河缩进来的那一下：先小一点再到位
	const grow = lerp(0.55, 1, easeOutCubic(prog(f, DOUGH_AT - 4, DOUGH_AT + 22)));
	mats.dough.uniforms.uA.value = on * (1 - smooth(prog(f, WEB_AT, WEB_AT + 20)));
	mats.dough.uniforms.uT.value = f;
	// 葡萄干变成星系：先缩小再交给宇宙网的星点
	const rk = 1 - smooth(prog(f, WEB_AT + 4, WEB_AT + 18));
	mats.raisin.uniforms.uA.value = Math.min(1, on * 1.4) * rk;
	return (
		<>
			{rk > 0
				? RAISINS.map((l, i) => (
						<mesh key={i} material={mats.raisin} position={toWorld(l, s * grow)} scale={0.32 * rk} rotation={[i, i * 1.7, i * 0.3]} renderOrder={1}>
							<sphereGeometry args={[1, 20, 14]} />
						</mesh>
					))
				: null}
			<mesh material={mats.dough} position={DOUGH_C} scale={R0 * s * grow} renderOrder={2}>
				<sphereGeometry args={[1, 64, 48]} />
			</mesh>
		</>
	);
};

/** 两对葡萄干之间的距离标注与读数 */
const PAIRS: [number, number][] = [
	[RAISINS.findIndex((p) => p[0] < -0.3 && Math.abs(p[1]) < 0.3 && p[2] > 0.3), RAISINS.findIndex((p) => Math.abs(p[0]) < 0.3 && Math.abs(p[1]) < 0.3 && p[2] > 0.3)],
	[RAISINS.findIndex((p) => Math.abs(p[0]) < 0.3 && p[1] > 0.3 && p[2] > 0.3), RAISINS.findIndex((p) => p[0] > 0.3 && p[1] < -0.3 && Math.abs(p[2]) < 0.3)],
];

export const DoughLabels: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = env(f, SWELL_FROM + 4, WEB_AT + 26, 14, 16);
	if (a <= 0) return null;
	const s = swellAt(f);
	const grow = lerp(0.55, 1, easeOutCubic(prog(f, DOUGH_AT - 4, DOUGH_AT + 22)));
	return (
		<>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: a}}>
				{PAIRS.map(([i, j], k) => {
					const p = project(c, toWorld(RAISINS[i], s * grow));
					const q = project(c, toWorld(RAISINS[j], s * grow));
					return (
						<g key={k}>
							<line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={`rgba(${PEARL},0.85)`} strokeWidth={2} strokeDasharray="7 7" />
							<circle cx={p.x} cy={p.y} r={4} fill={`rgb(${PEARL})`} />
							<circle cx={q.x} cy={q.y} r={4} fill={`rgb(${PEARL})`} />
						</g>
					);
				})}
			</svg>
			<div style={{position: 'absolute', right: 130, top: 96, textAlign: 'right', opacity: a, textShadow: `0 0 14px rgba(${PINK},0.6), 0 0 4px rgba(0,0,0,0.95)`}}>
				<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 52, color: '#fff2fa', letterSpacing: 2, fontVariantNumeric: 'tabular-nums'}}>距离 ×{s.toFixed(2)}</div>
				<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 15, letterSpacing: 4, color: 'rgba(255,228,244,0.75)', marginTop: 4}}>DISTANCE ×{s.toFixed(2)} · RAISIN SIZE ×1.00</div>
			</div>
		</>
	);
};

// ════════ 宇宙网：面团溶掉后，葡萄干变成星系，网继续被撑开 ════════

const webOn = (f: number) => env(f, WEB_AT - 4, SHEET_AT + 26, 16, 20);
/** 第 26 小节第 3 拍起，整张网压平成蹦床 */
const flatAt = (f: number) => smooth(prog(f, SHEET_AT, SHEET_AT + 24));
export const SH_Y = 1.0;

export const CosmicWeb: React.FC<{f: number}> = ({f}) => {
	const geos = useMemo(() => {
		const node = (i: number, j: number, k: number) => nodeLocal(i, j, k);
		const lp: number[] = [];
		const lr: number[] = [];
		const np: number[] = [];
		const nr: number[] = [];
		for (let i = -NODE_R; i <= NODE_R; i++)
			for (let j = -NODE_R; j <= NODE_R; j++)
				for (let k = -NODE_R; k <= NODE_R; k++) {
					const p = node(i, j, k);
					const ring = Math.max(Math.abs(i), Math.abs(j), Math.abs(k));
					np.push(...p);
					nr.push(ring, rnd(i * 31 + j * 7 + k * 3 + 5));
					if (i < NODE_R) lp.push(...p, ...node(i + 1, j, k)), lr.push(ring, ring);
					if (j < NODE_R) lp.push(...p, ...node(i, j + 1, k)), lr.push(ring, ring);
					if (k < NODE_R) lp.push(...p, ...node(i, j, k + 1)), lr.push(ring, ring);
				}
		const lines = new THREE.BufferGeometry();
		lines.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
		lines.setAttribute('aRing', new THREE.Float32BufferAttribute(lr, 1));
		const nodes = new THREE.BufferGeometry();
		nodes.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
		nodes.setAttribute('aInfo', new THREE.Float32BufferAttribute(nr, 2));
		return {lines, nodes};
	}, []);
	const mats = useMemo(() => {
		const common = /* glsl */ `
			uniform vec3 uC; uniform float uS; uniform float uFlat; uniform float uY; uniform float uGrow;
			vec3 place(vec3 l) {
				vec3 w = uC + l * uS;
				w.y = mix(w.y, uY, uFlat);
				return w;
			}`;
		const uniforms = () => ({uC: {value: new THREE.Vector3(...DOUGH_C)}, uS: {value: 1}, uFlat: {value: 0}, uY: {value: SH_Y}, uGrow: {value: 0}, uA: {value: 0}});
		return {
			lines: new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: uniforms(),
				vertexShader: /* glsl */ `
					attribute float aRing;
					varying float vA; varying float vD;
					${common}
					void main() {
						vA = clamp(uGrow - aRing + 1.0, 0.0, 1.0);
						vec4 mv = viewMatrix * vec4(place(position), 1.0);
						vD = -mv.z;
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying float vA; varying float vD;
					void main() { float fog = exp(-max(vD - 20.0, 0.0) * 0.02); gl_FragColor = vec4(vec3(0.75, 0.68, 1.0) * 0.32 * vA * uA * fog, 1.0); }`,
			}),
			nodes: new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: uniforms(),
				vertexShader: /* glsl */ `
					attribute vec2 aInfo;
					varying float vA; varying float vR;
					${common}
					void main() {
						vA = clamp(uGrow - aInfo.x + 1.0, 0.0, 1.0);
						vR = aInfo.y;
						vec4 mv = viewMatrix * vec4(place(position), 1.0);
						gl_PointSize = clamp((18.0 + 22.0 * aInfo.y) * 30.0 / -mv.z, 3.0, 40.0);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying float vA; varying float vR;
					void main() {
						vec2 q = gl_PointCoord - 0.5;
						float d = length(q);
						// 小星系：亮核 + 一点点十字星芒
						float core = exp(-d * d * 120.0);
						float halo = exp(-d * 9.0) * 0.35;
						float star = (exp(-abs(q.x) * 60.0) * exp(-abs(q.y) * 7.0) + exp(-abs(q.y) * 60.0) * exp(-abs(q.x) * 7.0)) * 0.35;
						vec3 tint = mix(vec3(1.0, 0.8, 0.92), vec3(0.82, 0.8, 1.0), vR);
						gl_FragColor = vec4(tint * (core + halo + star) * vA * uA, 1.0);
					}`,
			}),
		};
	}, []);
	const on = webOn(f);
	if (on <= 0) return null;
	const s = swellAt(f) * R0;
	// 网从面团里往外长：先是面团里那一圈，随后外面几圈
	const grow = track(f, [
		[WEB_AT - 2, 1],
		[WEB_AT + BEAT * 2, 2.2],
		[SHEET_AT, 3.2],
	]);
	for (const m of [mats.lines, mats.nodes]) {
		m.uniforms.uS.value = s;
		m.uniforms.uFlat.value = flatAt(f);
		m.uniforms.uGrow.value = grow;
		m.uniforms.uA.value = on;
	}
	return (
		<>
			<lineSegments geometry={geos.lines} material={mats.lines} frustumCulled={false} />
			<points geometry={geos.nodes} material={mats.nodes} frustumCulled={false} />
		</>
	);
};

// ════════ 网格蹦床 / 珍珠母贝网 ════════

/** 网面边长（世界单位）与格子数；每格再细分 M×M，打碎时以格为单位飞散 */
const SHEET_N = 56;
const SHEET_M = 4;
export const SHEET_HALF = SHEET_N / 2;
/** 坑的宽度 */
const SIG = 3.6;

/** 坑深：保龄球落下压出来，带一点回弹；起源形态显色时弹回平面 */
export const pitAt = (f: number) => {
	const a = track(f, [
		[LAND_AT - 1, 0],
		[LAND_AT + 6, 3.5],
		[LAND_AT + 16, 2.9],
		[LAND_AT + 28, 3.1],
		[SUN_AT, 3.2],
		[ORIGIN_AT - 2, 3.6],
	]);
	return a * (1 - easeOutCubic(prog(f, ORIGIN_AT, ORIGIN_AT + 9)));
};
/** 网面在半径 r 处的高度（相对网面） */
export const surfAt = (r: number, a: number) => -a * Math.exp(-Math.pow(r / SIG, 1.6));

/** 翻起：第 30 小节起从水平翻成竖直，立在起源形态身后 */
export const flipAt = (f: number) => smooth(prog(f, ORIGIN_AT + 2, FLIP_TO));
const SHEET_V_POS: V3 = [0, 6, -7];
export const sheetPose = (f: number) => {
	const k = flipAt(f);
	return {pos: [0, lerp(SH_Y, SHEET_V_POS[1], k), lerp(0, SHEET_V_POS[2], k)] as V3, rot: (Math.PI / 2) * k};
};
/** 竖起来的网面上一点（局部 x, z）→ 世界坐标（竖直时 z 朝下） */
export const sheetLocalToWorldV = (x: number, z: number): V3 => [x, SHEET_V_POS[1] - z, SHEET_V_POS[2]];

/** 亚空裂斩的斩痕（竖直网面的局部坐标）：过世界 (10, 14)，从右上斩向左下 */
const CUT_DIR_W: [number, number] = [-0.77, -0.64];
export const CUT_P: [number, number] = [10, SHEET_V_POS[1] - 14];
export const CUT_D: [number, number] = (() => {
	const l = Math.hypot(CUT_DIR_W[0], CUT_DIR_W[1]);
	return [CUT_DIR_W[0] / l, -CUT_DIR_W[1] / l];
})();
const CUT_N: [number, number] = [-CUT_D[1], CUT_D[0]];
/** 斩痕两端（沿 CUT_D 的参数），画斩痕的 2D 光用 */
export const CUT_T: [number, number] = [-14, 26];
/** 斩痕从右上往左下划开（3 帧），随后裂口张开 */
export const slashDraw = (f: number) => smooth(prog(f, REND_AT - 3, REND_AT));
export const cutOpen = (f: number) => easeOutCubic(prog(f, REND_AT + 1, REND_AT + 26));

const NACRE = /* glsl */ `
vec3 nacre(float t) {
	vec3 a = vec3(1.0, 0.78, 0.9);
	vec3 b = vec3(0.78, 0.74, 1.0);
	vec3 c = vec3(0.72, 0.95, 1.0);
	t = fract(t);
	return t < 0.333 ? mix(a, b, t * 3.0) : t < 0.666 ? mix(b, c, t * 3.0 - 1.0) : mix(c, a, t * 3.0 - 2.0);
}
`;

const sheetGeo = () => {
	const pos: number[] = [];
	const tile: number[] = [];
	const rd: number[] = [];
	const idx: number[] = [];
	const step = 1 / SHEET_M;
	let base = 0;
	for (let ti = 0; ti < SHEET_N; ti++)
		for (let tj = 0; tj < SHEET_N; tj++) {
			const x0 = ti - SHEET_HALF;
			const z0 = tj - SHEET_HALF;
			const r = [rnd(ti * 91 + tj * 7 + 0.5), rnd(ti * 13 + tj * 57 + 1.5), rnd(ti * 37 + tj * 11 + 2.5)];
			for (let a = 0; a <= SHEET_M; a++)
				for (let b = 0; b <= SHEET_M; b++) {
					pos.push(x0 + a * step, 0, z0 + b * step);
					tile.push(x0 + 0.5, z0 + 0.5);
					rd.push(...r);
				}
			for (let a = 0; a < SHEET_M; a++)
				for (let b = 0; b < SHEET_M; b++) {
					const i0 = base + a * (SHEET_M + 1) + b;
					const i1 = i0 + SHEET_M + 1;
					idx.push(i0, i0 + 1, i1, i1, i0 + 1, i1 + 1);
				}
			base += (SHEET_M + 1) * (SHEET_M + 1);
		}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aTile', new THREE.Float32BufferAttribute(tile, 2));
	g.setAttribute('aRnd', new THREE.Float32BufferAttribute(rd, 3));
	g.setIndex(idx);
	return g;
};

export const sheetOn = (f: number) => env(f, SHEET_AT, bf(37, 2), 22, 30);

export const SpaceSheet: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(sheetGeo, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				side: THREE.DoubleSide,
				uniforms: {
					uOn: {value: 0},
					uA: {value: 0},
					uSig: {value: SIG},
					uRip: {value: 0},
					uRipT: {value: 0},
					uTwist: {value: 0},
					uShat: {value: 0},
					uOpen: {value: 0},
					uSlash: {value: 0},
					uSlashT: {value: 0},
					uCutP: {value: new THREE.Vector2(...CUT_P)},
					uCutD: {value: new THREE.Vector2(...CUT_D)},
					uCutN: {value: new THREE.Vector2(...CUT_N)},
					uCutT: {value: new THREE.Vector2(...CUT_T)},
					uNacre: {value: 0},
					uGlowPit: {value: 0},
					uFlat: {value: 0},
					uGold: {value: 0},
					uFlash: {value: 0},
					uTime: {value: 0},
				},
				vertexShader: /* glsl */ `
					attribute vec2 aTile;
					attribute vec3 aRnd;
					uniform float uA; uniform float uSig; uniform float uRip; uniform float uRipT;
					uniform float uTwist; uniform float uShat; uniform float uOpen;
					uniform vec2 uCutP; uniform vec2 uCutN;
					varying vec2 vP; varying vec3 vW; varying float vH; varying float vSd;
					float surf(float r) { return -uA * exp(-pow(r / uSig, 1.6)); }
					vec3 rotAx(vec3 p, vec3 ax, float a) { return p * cos(a) + cross(ax, p) * sin(a) + ax * dot(ax, p) * (1.0 - cos(a)); }
					vec2 twist(vec2 p) {
						float ang = uTwist * 2.6 * exp(-length(p) / 9.0);
						float c = cos(ang), s = sin(ang);
						return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
					}
					void main() {
						vec2 p = position.xz;
						vP = p;
						float r = length(p);
						vec3 q = vec3(twist(p), 0.0).xzy;
						q.y += surf(r);
						q.y += uRip * sin(r * 0.9 - uRipT * 0.45) * exp(-r / 14.0) * smoothstep(0.0, 4.0, uRipT * 0.45 - r * 0.9 + 3.0);
						if (uShat > 0.0) {
							vec2 tc2 = twist(aTile);
							vec3 tc = vec3(tc2.x, 0.0, tc2.y);
							vec3 ax = normalize(aRnd - 0.5 + 1e-3);
							vec3 local = rotAx(q - tc, ax, uShat * (0.5 + 1.8 * aRnd.x));
							vec3 off = vec3(tc.x * 0.16, 1.2 + 4.5 * aRnd.y, tc.z * 0.16) * uShat * (0.35 + aRnd.z);
							q = tc + local + off;
						}
						float sd = dot(p - uCutP, uCutN);
						vSd = sd;
						if (uOpen > 0.0) {
							float side = sign(sd);
							q.xz += uCutN * side * uOpen * 2.6;
							q.y -= uOpen * (0.4 + 1.6 * exp(-abs(sd) / 2.0));
						}
						vH = q.y;
						vec4 w = modelMatrix * vec4(q, 1.0);
						vW = w.xyz;
						gl_Position = projectionMatrix * viewMatrix * w;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uOn; uniform float uA; uniform float uOpen; uniform float uSlash; uniform float uSlashT;
					uniform vec2 uCutP; uniform vec2 uCutD; uniform vec2 uCutT;
					uniform float uNacre; uniform float uGlowPit; uniform float uFlat; uniform float uGold; uniform float uFlash; uniform float uTime;
					varying vec2 vP; varying vec3 vW; varying float vH; varying float vSd;
					${NACRE}
					float gridLine(vec2 p, float w) {
						vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), 1e-4);
						return 1.0 - min(min(g.x, g.y) / w, 1.0);
					}
					void main() {
						float thr = uOpen > 0.0 ? 0.36 : 0.0;
						if (abs(vSd) < thr) discard;
						float r = length(vP);
						float dens = clamp(1.0 - length(fwidth(vP)) * 1.6, 0.0, 1.0);
						float minor = gridLine(vP, 1.0) * dens;
						float major = gridLine(vP / 4.0, 1.4);
						vec3 iri = nacre(vP.x * 0.035 + vP.y * 0.05 + uTime * 0.003 + vH * 0.06);
						vec3 lc = mix(vec3(0.8, 0.74, 0.98), iri * 1.15, uNacre);
						float depth = clamp(-vH / max(uA, 0.01), 0.0, 1.0);
						vec3 col = vec3(0.016, 0.014, 0.03) + iri * 0.045 * uNacre;
						col += lc * (minor * 0.2 + major * 0.38) * (1.0 + 2.2 * uGlowPit * depth * depth);
						col += vec3(1.0, 0.75, 0.9) * uGlowPit * exp(-r / 2.0) * 0.7;
						col += vec3(1.0, 0.83, 0.56) * uGold * (minor * 0.5 + major * 0.7 + 0.04);
						col += vec3(1.0, 0.9, 0.96) * uFlash * exp(-r / 6.0);
						// 斩痕：沿斩痕从右上往左下划开
						float t = dot(vP - uCutP, uCutD);
						float drawn = step(t, mix(uCutT.x, uCutT.y, uSlashT)) * step(uCutT.x, t);
						float sl = exp(-abs(vSd) / 0.05) * 1.4 + exp(-abs(vSd) / 0.4) * 0.3;
						col += vec3(1.0, 0.62, 0.86) * sl * uSlash * drawn;
						// 裂口边缘：虹彩高光
						if (uOpen > 0.0) {
							float e = exp(-(abs(vSd) - thr) / 0.12);
							col += (iri * 0.9 + vec3(1.0, 0.5, 0.8) * 0.3) * e * min(1.0, uOpen * 3.0);
						}
						float alpha = mix(1.0 - smoothstep(11.0, 21.0, r), 1.0, uFlat);
						gl_FragColor = vec4(col, alpha * uOn);
					}`,
			}),
		[],
	);
	const on = sheetOn(f);
	if (on <= 0) return null;
	const u = mat.uniforms;
	u.uOn.value = on;
	u.uA.value = pitAt(f);
	const tr = f - ORIGIN_AT;
	u.uRip.value = tr > 0 ? 1.1 * Math.exp(-tr / 40) : 0;
	u.uRipT.value = Math.max(0, tr);
	u.uTwist.value = smooth(prog(f, TWIST_AT, TWIST_AT + 10)) * (1 - smooth(prog(f, REMAKE_AT - 2, REMAKE_AT + 12)));
	u.uShat.value = easeOutCubic(prog(f, SHATTER_AT, SHATTER_AT + 10)) * (1 - smooth(prog(f, REMAKE_AT - 3, REMAKE_AT + 10)));
	u.uOpen.value = cutOpen(f);
	u.uSlash.value = env(f, REND_AT - 3, REND_AT + 22, 1, 18) * 1.4;
	u.uSlashT.value = slashDraw(f);
	u.uNacre.value = smooth(prog(f, ORIGIN_AT, ORIGIN_AT + 16));
	// 坑底越来越亮（第 28–29 小节的上扬）
	u.uGlowPit.value = smooth(prog(f, MARBLE_AT, ORIGIN_AT)) * (1 - smooth(prog(f, ORIGIN_AT, ORIGIN_AT + 12)));
	u.uFlat.value = flipAt(f);
	u.uGold.value = Math.exp(-Math.max(0, f - REMAKE_AT) / 10) * (f >= REMAKE_AT - 1 ? 1 : 0) * 0.9 + 0.12 * smooth(prog(f, ORIGIN_AT, ORIGIN_AT + 20));
	u.uFlash.value = f >= ORIGIN_AT - 1 ? 2.2 * Math.exp(-Math.max(0, tr) / 7) : 0;
	u.uTime.value = f;
	const {pos, rot} = sheetPose(f);
	return <mesh geometry={geo} material={mat} position={pos} rotation={[rot, 0, 0]} frustumCulled={false} renderOrder={-1} />;
};

// ════════ 保龄球 → 太阳，弹珠，星光 ════════

const RB = 1.2;
const RM = 0.38;
const ballY = (f: number) => {
	const rest = SH_Y + surfAt(0, pitAt(f)) + RB;
	if (f >= LAND_AT) return rest;
	return lerp(SH_Y + 13, SH_Y + RB, easeInQuad(prog(f, DROP_AT, LAND_AT)));
};
export const sunK = (f: number) => smooth(prog(f, SUN_AT - 4, SUN_AT + 10));
export const BALL_POS = (f: number): V3 => [0, ballY(f), 0];

/** 弹珠绕坑滚：半径慢慢收小，越往里越快（逐帧积分，固定步长） */
const marbleAt = (f: number): V3 => {
	const t = Math.max(0, f - MARBLE_AT + 8);
	let th = 2.75;
	let r = 9;
	for (let k = 0; k < t; k++) {
		r = 4.4 + 4.6 * Math.exp(-k / 46);
		th += 0.085 * Math.pow(6 / r, 1.5);
	}
	const a = pitAt(f);
	return [Math.cos(th) * r, SH_Y + surfAt(r, a) + RM, Math.sin(th) * r];
};
const marbleOn = (f: number) => env(f, MARBLE_AT - 8, ORIGIN_AT + 2, 6, 4);

export const BallSun: React.FC<{f: number}> = ({f}) => {
	const mats = useMemo(
		() => ({
			ball: new THREE.ShaderMaterial({
				uniforms: {uSun: {value: 0}, uA: {value: 1}},
				transparent: true,
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV;
					void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
				fragmentShader: /* glsl */ `
					uniform float uSun; uniform float uA;
					varying vec3 vN; varying vec3 vV;
					void main() {
						float mu = max(dot(vN, vV), 0.0);
						float fres = pow(1.0 - mu, 2.5);
						vec3 L = normalize(vec3(-0.5, 0.8, 0.5));
						float spec = pow(max(dot(reflect(-L, vN), vV), 0.0), 40.0);
						vec3 ball = vec3(0.06, 0.05, 0.09) + vec3(0.4, 0.36, 0.5) * max(dot(vN, L), 0.0) * 0.4 + vec3(1.0, 0.7, 0.88) * fres * 0.7 + vec3(1.0) * spec * 0.8;
						vec3 sun = vec3(1.0, 0.93, 0.82) * (0.75 + 0.45 * pow(mu, 0.6)) * 1.25;
						gl_FragColor = vec4(mix(ball, sun, uSun), uA);
					}`,
			}),
			marble: new THREE.ShaderMaterial({
				uniforms: {uA: {value: 1}},
				transparent: true,
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV;
					void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec3 vN; varying vec3 vV;
					void main() {
						float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.0);
						vec3 L = normalize(vec3(-0.5, 0.8, 0.5));
						float spec = pow(max(dot(reflect(-L, vN), vV), 0.0), 60.0);
						vec3 c = vec3(0.55, 0.62, 0.95) * (0.25 + 0.6 * max(dot(vN, L), 0.0)) + vec3(1.0, 0.85, 0.95) * fres * 0.6 + spec;
						gl_FragColor = vec4(c, uA);
					}`,
			}),
			trail: new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uA: {value: 1}},
				vertexShader: /* glsl */ `attribute float aK; varying float vK; void main() { vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `uniform float uA; varying float vK; void main() { gl_FragColor = vec4(vec3(0.7, 0.78, 1.0) * vK * vK * uA, 1.0); }`,
			}),
		}),
		[],
	);
	const trailGeo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 2 * 3), 3));
		g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(48 * 2), 1));
		return g;
	}, []);
	const ballOn = f >= DROP_AT && f < ORIGIN_AT + 3;
	const mOn = marbleOn(f);
	mats.ball.uniforms.uSun.value = sunK(f);
	mats.ball.uniforms.uA.value = 1 - smooth(prog(f, ORIGIN_AT - 1, ORIGIN_AT + 3));
	mats.marble.uniforms.uA.value = mOn;
	mats.trail.uniforms.uA.value = mOn;
	if (mOn > 0) {
		const pos = trailGeo.getAttribute('position') as THREE.BufferAttribute;
		const kk = trailGeo.getAttribute('aK') as THREE.BufferAttribute;
		const N = 48;
		for (let i = 0; i < N; i++) {
			const p = marbleAt(f - i);
			const q = marbleAt(f - i - 1);
			const lift = -RM + 0.06;
			pos.setXYZ(i * 2, p[0], p[1] + lift, p[2]);
			pos.setXYZ(i * 2 + 1, q[0], q[1] + lift, q[2]);
			const k = Math.max(0, 1 - i / N) * (f - i >= MARBLE_AT - 8 ? 1 : 0);
			kk.setX(i * 2, k);
			kk.setX(i * 2 + 1, Math.max(0, k - 1 / N));
		}
		pos.needsUpdate = true;
		kk.needsUpdate = true;
	}
	return (
		<>
			{ballOn ? (
				<mesh material={mats.ball} position={BALL_POS(f)} scale={RB * (1 + 0.25 * sunK(f))}>
					<sphereGeometry args={[1, 48, 32]} />
				</mesh>
			) : null}
			{mOn > 0 ? (
				<>
					<mesh material={mats.marble} position={marbleAt(f)} scale={RM}>
						<sphereGeometry args={[1, 24, 16]} />
					</mesh>
					<lineSegments geometry={trailGeo} material={mats.trail} frustumCulled={false} />
				</>
			) : null}
		</>
	);
};

/** 第 28–29 小节的上扬：星光越聚越多，沿网格螺旋流向坑底 */
const STREAM_N = 900;
export const Streams: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const info = new Float32Array(STREAM_N * 4);
		for (let i = 0; i < STREAM_N; i++) info.set([rnd(i * 1.3 + 0.2) * Math.PI * 2, rnd(i * 2.7 + 1.1), rnd(i * 3.9 + 2.3), rnd(i * 5.1 + 3.7)], i * 4);
		g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAM_N * 3), 3));
		g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uT: {value: 0}, uA: {value: 0}, uPit: {value: 0}, uRamp: {value: 0}, uY: {value: SH_Y}, uSig: {value: SIG}},
				vertexShader: /* glsl */ `
					attribute vec4 aInfo;
					uniform float uT; uniform float uPit; uniform float uRamp; uniform float uY; uniform float uSig;
					varying float vB;
					void main() {
						float ph = fract(uT * (0.010 + 0.012 * aInfo.z) + aInfo.y);
						float r = 0.6 + 17.0 * pow(1.0 - ph, 1.4);
						float th = aInfo.x + 9.0 / (r + 1.5);
						float y = uY - uPit * exp(-pow(r / uSig, 1.6)) + 0.08;
						vec3 p = vec3(cos(th) * r, y, sin(th) * r);
						vB = step(aInfo.w, uRamp) * smoothstep(0.0, 0.15, ph) * (1.0 - smoothstep(0.9, 1.0, ph)) * (0.4 + 1.2 * (1.0 - r / 17.6));
						vec4 mv = viewMatrix * vec4(p, 1.0);
						gl_PointSize = clamp(70.0 / -mv.z, 1.5, 5.0);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying float vB;
					void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.9, 0.97) * smoothstep(0.5, 0.0, d) * vB * uA, 1.0); }`,
			}),
		[],
	);
	const a = env(f, MARBLE_AT, ORIGIN_AT + 4, 10, 4);
	if (a <= 0) return null;
	mat.uniforms.uT.value = f;
	mat.uniforms.uA.value = a;
	mat.uniforms.uPit.value = pitAt(f);
	mat.uniforms.uRamp.value = 0.15 + 0.85 * smooth(prog(f, MARBLE_AT, ORIGIN_AT));
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

// ════════ 2D 叠层 ════════

/** 太阳的光晕 */
export const SunGlow: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const k = sunK(f) * (1 - smooth(prog(f, ORIGIN_AT - 1, ORIGIN_AT + 3)));
	if (k <= 0.01) return null;
	const p = project(c, BALL_POS(f));
	const r = pxOf(c, p.depth, RB) * 5.5;
	return (
		<div
			style={{
				position: 'absolute',
				left: p.x - r,
				top: p.y - r,
				width: r * 2,
				height: r * 2,
				mixBlendMode: 'screen',
				background: `radial-gradient(circle, rgba(255,246,228,${0.75 * k}) 0%, rgba(255,214,180,${0.32 * k}) 18%, rgba(${PINK},${0.08 * k}) 45%, rgba(0,0,0,0) 72%)`,
			}}
		/>
	);
};

/** 一束星光沿弯下去的网格绕过太阳（虚线是它原本的直线） */
const BEAM_B = 3.2;
const BEAM_D = 1.25;
const beamPt = (x: number, a: number): V3 => {
	const z = -BEAM_B + BEAM_D * (1 + x / Math.hypot(x, BEAM_B));
	const r = Math.hypot(x, z);
	return [x, SH_Y + surfAt(r, a) + 0.12, z];
};
export const StarBeam: React.FC<{f: number; c: Cam; Glint: React.FC<{x: number; y: number; r: number; a: number; star: number}>}> = ({f, c, Glint}) => {
	const a = env(f, SUN_AT, ORIGIN_AT + 2, 4, 6);
	if (a <= 0) return null;
	const pit = pitAt(f);
	const head = lerp(-19, 19, smooth(prog(f, SUN_AT + 2, SUN_AT + BEAT * 3.2)));
	const pts: string[] = [];
	for (let x = -19; x <= head; x += 0.5) {
		const s = project(c, beamPt(x, pit));
		pts.push(`${s.x},${s.y}`);
	}
	const h = project(c, beamPt(head, pit));
	// 原本的直线（只画太阳附近往后那段）
	const s0 = project(c, [-2, SH_Y + 0.12, -BEAM_B]);
	const s1 = project(c, [19, SH_Y + 0.12, -BEAM_B]);
	const dashA = smooth(prog(head, -2, 6)) * a;
	return (
		<>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: a}}>
				<defs>
					<filter id="sp-beam" x="-10%" y="-10%" width="120%" height="120%">
						<feGaussianBlur stdDeviation="5" />
					</filter>
				</defs>
				<polyline points={pts.join(' ')} fill="none" stroke="rgba(255,240,220,0.8)" strokeWidth={9} filter="url(#sp-beam)" />
				<polyline points={pts.join(' ')} fill="none" stroke="rgba(255,250,240,1)" strokeWidth={2.4} />
				<line x1={s0.x} y1={s0.y} x2={s1.x} y2={s1.y} stroke={`rgba(${PEARL},${0.55 * dashA})`} strokeWidth={1.6} strokeDasharray="8 10" />
			</svg>
			<Glint x={h.x} y={h.y} r={9} a={a} star={0.6} />
		</>
	);
};

/** 角落小字：1919 年日全食的实测 */
export const EclipseNote: React.FC<{f: number}> = ({f}) => {
	const a = env(f, SUN_AT + BEAT, ORIGIN_AT, 14, 6) * 0.85;
	if (a <= 0) return null;
	return (
		<div style={{position: 'absolute', left: 120, top: 96, opacity: a, textShadow: '0 0 10px rgba(0,0,0,0.9)'}}>
			<div style={{fontFamily: SERIF, fontSize: 24, letterSpacing: 4, color: 'rgba(255,236,246,0.92)'}}>1919 年日全食 · 实测星光偏折</div>
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 14, letterSpacing: 4, color: 'rgba(255,228,244,0.7)', marginTop: 6}}>1919 SOLAR ECLIPSE · STARLIGHT BENDING MEASURED</div>
		</div>
	);
};
