import {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, BEAT, easeInQuad, easeOutCubic, env, lerp, prog, rnd, smooth, track} from './common';
import {PAPER_C} from './fold';
import {PEARL, PINK} from './hook';

/**
 * 第 7 段「枪之柱」（全片最大爆发点）：
 * 折痕的红光长成一条红色锁链 → 镜头退开，锁链垂在天冠山顶枪之柱的祭坛上（断柱是代码线框，雪横着飞）
 * → 48.2 两条锁链甩上天空，各撕开一道口子：左边钴蓝（时间），右边珍珠粉（空间）
 * → 50–51 锁链收紧往回拽，时间的星图线和空间的网格越拉越近 → 52.0 帝牙卢卡显色 → 53.0 两股力量正面撞上
 * → 54.0 整个画面被撕开（Master 里把画面复制成两半错开）→ 55.0 裂口慢慢合拢。
 * 锁链与对撞的光参考 React Bits 的 Lightning / LaserFlow、PrismaticBurst 的做法；赤日不出形象。
 */

// ════════ 时间线与位置 ════════

export const CHAIN_AT = bf(44);
const DROP_FROM = bf(46);
export const PILLAR_AT = bf(47, 2);
export const WHIP_AT = bf(48, 2);
const TIGHT_FROM = bf(50);
const TIGHT_TO = bf(52);
export const DIALGA_AT = bf(52);
export const CLASH_AT = bf(53);
export const TEAR_AT = bf(54);
export const CALM_AT = bf(55);
/** 第 7 段的东西在第 55 小节第 2 拍起散去 */
const clashOut = (f: number) => 1 - smooth(prog(f, bf(55, 1), bf(56, 1)));
/** 口子和两位神跟着撕口一起合拢 */
const riftOut = (f: number) => 1 - smooth(prog(f, CALM_AT, bf(55, 2) + 6));

/** 枪之柱：祭坛在折痕的正下方 */
export const ALTAR: V3 = [PAPER_C[0], 0, PAPER_C[2]];
/** 时间与空间撞上的地方（也是第 8 段那块布的中心、第 9 段屏幕的位置） */
export const CC: V3 = [PAPER_C[0], 18, -52];

/** 两道口子的中心：锁链收紧时被往中间拽 */
export const riftPos = (f: number, side: -1 | 1): V3 => {
	const pull = smooth(prog(f, TIGHT_FROM, TIGHT_TO));
	const kick = Math.exp(-Math.max(0, f - CLASH_AT) / 10) * (f >= CLASH_AT ? 1 : 0);
	return [CC[0] + side * (lerp(15, 9, pull) + 1.2 * kick), CC[1] + 2.5 - 1.5 * pull, CC[2]];
};
/** 口子张开的程度 */
export const riftOpen = (f: number, side: -1 | 1) => {
	const at = WHIP_AT + (side === -1 ? 8 : 12);
	return easeOutCubic(prog(f, at, at + 14)) * (1 + 0.25 * smooth(prog(f, TIGHT_FROM, TIGHT_TO))) * riftOut(f);
};

// ════════ 红色锁链 ════════

const LINK_PITCH = 0.62;
const MAX_LINKS = 110;

type Curve = (s: number) => V3;

/** 锁链 1：折痕 → 垂直的锁链，往上下伸长，垂到祭坛上 → 48.2 起甩向左边的口子 */
const chain1 = (f: number): {curve: Curve; len: number} => {
	const top = lerp(PAPER_C[1] + 4.2, 48, easeInQuad(prog(f, DROP_FROM, PILLAR_AT)));
	const bot = lerp(PAPER_C[1] - 4.2, ALTAR[1] + 1.2, smooth(prog(f, DROP_FROM, PILLAR_AT)));
	const vert: Curve = (s) => [ALTAR[0] + 0.1 * Math.sin(s * 9 + f * 0.05) * prog(f, DROP_FROM, PILLAR_AT), lerp(bot, top, s), ALTAR[2]];
	if (f < WHIP_AT - 6) return {curve: vert, len: top - bot};
	return whip(f, -1, vert);
};

/** 锁链甩出去：尖端沿弧线飞到口子，中间先垂后绷直，绷直时带一点抖动 */
const whip = (f: number, side: -1 | 1, from?: Curve): {curve: Curve; len: number} => {
	const P0: V3 = [ALTAR[0], ALTAR[1] + 1.2, ALTAR[2]];
	const P1 = riftPos(f, side);
	const t0 = WHIP_AT - 6 + (side === 1 ? 4 : 0);
	const k = easeOutCubic(prog(f, t0, t0 + 18));
	const sag = lerp(6, 3.2, k) * (1 - smooth(prog(f, TIGHT_FROM, TIGHT_TO))) + 0.15;
	const shake = (f > TIGHT_FROM ? 0.12 + 0.5 * smooth(prog(f, bf(51), CLASH_AT)) : 0) * (f < CALM_AT ? 1 : 0);
	const curve: Curve = (s) => {
		const tip: V3 = [lerp(P0[0], P1[0], k), lerp(P0[1] + 30 * (side === -1 ? 1 : 0.4), P1[1], k), lerp(P0[2], P1[2], k)];
		const base: V3 = [lerp(P0[0], tip[0], s), lerp(P0[1], tip[1], s), lerp(P0[2], tip[2], s)];
		const w = 4 * s * (1 - s);
		const wav = Math.sin(s * 18 - f * 0.9) * w * shake;
		const b: V3 = [base[0] - side * w * sag * 0.25 + wav * 0.4, base[1] - w * sag + wav, base[2] + w * sag * 0.3];
		if (from && k < 1) {
			// 锁链 1 从竖直的样子甩过去
			const v = from(s);
			const m = smooth(prog(f, t0, t0 + 12));
			return [lerp(v[0], b[0], m), lerp(v[1], b[1], m), lerp(v[2], b[2], m)];
		}
		return b;
	};
	return {curve, len: 0};
};

const curveLength = (curve: Curve) => {
	let L = 0;
	let p = curve(0);
	for (let i = 1; i <= 64; i++) {
		const q = curve(i / 64);
		L += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
		p = q;
	}
	return L;
};

/** 沿曲线按等弧长放链环：返回每个环的位置与切线 */
const linksAlong = (curve: Curve, maxLen = Infinity) => {
	const N = 160;
	const pts: V3[] = [];
	const acc: number[] = [0];
	for (let i = 0; i <= N; i++) pts.push(curve(i / N));
	for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
	const L = Math.min(acc[N], maxLen);
	const out: {p: V3; t: V3}[] = [];
	let j = 1;
	for (let d = LINK_PITCH * 0.5; d < L && out.length < MAX_LINKS; d += LINK_PITCH) {
		while (j < N && acc[j] < d) j++;
		const u = (d - acc[j - 1]) / Math.max(acc[j] - acc[j - 1], 1e-6);
		const a = pts[j - 1];
		const b = pts[j];
		const t: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const l = Math.hypot(...t) || 1;
		out.push({p: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], t: [t[0] / l, t[1] / l, t[2] / l]});
	}
	return out;
};

export const chainCurves = (f: number): Curve[] => {
	const out: Curve[] = [];
	if (f >= CHAIN_AT && clashOut(f) > 0) out.push(chain1(f).curve);
	if (f >= WHIP_AT - 2 && clashOut(f) > 0) out.push(whip(f, 1).curve);
	return out;
};

/** 链环由细线变粗：44.0 起从折痕的红光里长出来 */
const linkScale = (f: number) => lerp(0.35, 1, smooth(prog(f, CHAIN_AT, bf(45, 2))));
const chainGlow = (f: number) => 0.6 + 0.6 * Math.exp(-Math.max(0, f - WHIP_AT) / 10) * (f >= WHIP_AT ? 1 : 0) + 0.9 * smooth(prog(f, bf(51), CLASH_AT));

export const Chains: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const g = new THREE.TorusGeometry(0.27, 0.075, 8, 22);
		g.scale(1.38, 1, 1);
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uGlow: {value: 1}, uA: {value: 1}},
				transparent: true,
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV;
					void main() {
						vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
						vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
						vV = normalize(-mv.xyz);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uGlow; uniform float uA;
					varying vec3 vN; varying vec3 vV;
					void main() {
						float mu = abs(dot(normalize(vN), vV));
						float fres = pow(1.0 - mu, 2.0);
						vec3 L = normalize(vec3(-0.4, 0.8, 0.5));
						float spec = pow(max(dot(reflect(-L, normalize(vN)), vV), 0.0), 30.0);
						vec3 c = vec3(0.32, 0.02, 0.03) + vec3(1.0, 0.12, 0.08) * (0.35 + fres) * uGlow + vec3(1.0, 0.75, 0.7) * spec * 0.7;
						gl_FragColor = vec4(c, uA);
					}`,
			}),
		[],
	);
	const meshes = useMemo(() => [0, 1].map(() => new THREE.InstancedMesh(geo, mat, MAX_LINKS)), [geo, mat]);
	const curves = chainCurves(f);
	if (!curves.length) return null;
	mat.uniforms.uGlow.value = chainGlow(f);
	mat.uniforms.uA.value = clashOut(f);
	const sc = linkScale(f);
	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const qr = new THREE.Quaternion();
	const X = new THREE.Vector3(1, 0, 0);
	curves.forEach((curve, ci) => {
		const links = linksAlong(curve);
		const mesh = meshes[ci];
		links.forEach((l, i) => {
			q.setFromUnitVectors(X, new THREE.Vector3(...l.t));
			qr.setFromAxisAngle(X, (i % 2) * (Math.PI / 2) + 0.3);
			q.multiply(qr);
			m4.compose(new THREE.Vector3(...l.p), q, new THREE.Vector3(sc, sc, sc));
			mesh.setMatrixAt(i, m4);
		});
		mesh.count = links.length;
		mesh.instanceMatrix.needsUpdate = true;
	});
	return (
		<>
			{curves.map((_, i) => (
				<primitive key={i} object={meshes[i]} frustumCulled={false} />
			))}
		</>
	);
};

/** 锁链的 2D 辉光（沿投影后的锁链画一条模糊的红光） */
export const ChainBloom: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const curves = chainCurves(f);
	if (!curves.length) return null;
	const g = chainGlow(f) * clashOut(f);
	const paths = curves.map((curve) => {
		const pts: string[] = [];
		for (let i = 0; i <= 48; i++) {
			const p = project(c, curve(i / 48));
			if (p.depth > 0.5) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
		}
		return pts.join(' ');
	});
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
			<defs>
				<filter id="sp-chain-w" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="18" />
				</filter>
				<filter id="sp-chain-n" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="4" />
				</filter>
			</defs>
			{paths.map((d, i) => (
				<g key={i}>
					<polyline points={d} fill="none" stroke={`rgba(255,40,30,${0.35 * g})`} strokeWidth={34} filter="url(#sp-chain-w)" />
					<polyline points={d} fill="none" stroke={`rgba(255,90,70,${0.4 * g})`} strokeWidth={6} filter="url(#sp-chain-n)" />
				</g>
			))}
		</svg>
	);
};

// ════════ 枪之柱：断柱、地面、雪、远山 ════════

const PILLARS = Array.from({length: 9}, (_, i) => {
	const a = (i / 9) * Math.PI * 2 + 0.35;
	const x = ALTAR[0] + Math.cos(a) * 12.5;
	const z = ALTAR[2] + Math.sin(a) * 12.5;
	// 靠镜头的几根断得很矮，后面的高
	const back = (ALTAR[2] - z) / 12.5;
	const h = back > 0.2 ? 10 + 5 * rnd(i * 3.3) : 2.5 + 3 * rnd(i * 5.1);
	return {x, z, h, r: 0.85 + 0.15 * rnd(i * 7.7)};
});

const pillarGeo = () => {
	const pos: number[] = [];
	const hh: number[] = [];
	const seg = (a: V3, b: V3, ha: number, hb: number) => {
		pos.push(...a, ...b);
		hh.push(ha, hb);
	};
	for (const [pi, P] of PILLARS.entries()) {
		const F = 16;
		const tops: number[] = [];
		for (let k = 0; k < F; k++) {
			// 断口：每条凹槽的顶端高度不同
			const top = P.h - (P.h > 8 ? 1.4 : 0.9) * rnd(pi * 31 + k * 1.7) * (0.6 + 0.4 * Math.sin(k * 1.3 + pi));
			tops.push(top);
			const a = (k / F) * Math.PI * 2;
			const x = P.x + Math.cos(a) * P.r;
			const z = P.z + Math.sin(a) * P.r;
			seg([x, 0.9, z], [x, top, z], 0.9 / P.h, top / P.h);
		}
		// 每隔一段一圈（断口以下）
		for (let y = 0.9; y < P.h - 1; y += 1.6) {
			for (let k = 0; k < 32; k++) {
				const a0 = (k / 32) * Math.PI * 2;
				const a1 = ((k + 1) / 32) * Math.PI * 2;
				if (y > Math.min(tops[Math.floor((k / 32) * F)], tops[Math.floor(((k + 1) / 32) * F) % F])) continue;
				seg([P.x + Math.cos(a0) * P.r, y, P.z + Math.sin(a0) * P.r], [P.x + Math.cos(a1) * P.r, y, P.z + Math.sin(a1) * P.r], y / P.h, y / P.h);
			}
		}
		// 方形柱础
		const b = P.r * 1.35;
		const c: V3[] = [
			[P.x - b, 0, P.z - b],
			[P.x + b, 0, P.z - b],
			[P.x + b, 0, P.z + b],
			[P.x - b, 0, P.z + b],
		];
		for (let k = 0; k < 4; k++) {
			const p = c[k];
			const q = c[(k + 1) % 4];
			seg(p, q, 0, 0);
			seg([p[0], 0.9, p[2]], [q[0], 0.9, q[2]], 0.9 / P.h, 0.9 / P.h);
			seg(p, [p[0], 0.9, p[2]], 0, 0.9 / P.h);
		}
	}
	// 地面：同心圆 + 放射线 + 外圈台阶
	const ring = (r: number, y: number) => {
		for (let k = 0; k < 96; k++) {
			const a0 = (k / 96) * Math.PI * 2;
			const a1 = ((k + 1) / 96) * Math.PI * 2;
			seg([ALTAR[0] + Math.cos(a0) * r, y, ALTAR[2] + Math.sin(a0) * r], [ALTAR[0] + Math.cos(a1) * r, y, ALTAR[2] + Math.sin(a1) * r], -1, -1);
		}
	};
	for (const r of [2.2, 3.0, 6, 9, 15, 16.2]) ring(r, r > 15 ? -0.6 * (r - 15) : 0.01);
	for (let k = 0; k < 24; k++) {
		const a = (k / 24) * Math.PI * 2;
		seg([ALTAR[0] + Math.cos(a) * 3, 0.01, ALTAR[2] + Math.sin(a) * 3], [ALTAR[0] + Math.cos(a) * 15, 0.01, ALTAR[2] + Math.sin(a) * 15], -1, -1);
	}
	// 祭坛
	for (const y of [0.4, 0.8]) ring(2.2, y);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
	return g;
};

export const pillarsOn = (f: number) => smooth(prog(f, bf(46, 2), PILLAR_AT + 10)) * clashOut(f);

export const SpearPillar: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(pillarGeo, []);
	const mats = useMemo(
		() => ({
			lines: new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uA: {value: 0}, uBend: {value: 0}, uC: {value: new THREE.Vector2(CC[0], CC[2])}, uRed: {value: 0}},
				vertexShader: /* glsl */ `
					attribute float aH;
					uniform float uBend; uniform vec2 uC;
					varying float vH; varying float vD;
					void main() {
						vec3 p = position;
						// 对撞时断柱被扭弯：越高弯得越多，背着撞击点
						if (aH > 0.0) {
							vec2 d = p.xz - uC;
							vec2 dir = normalize(d + 1e-3);
							p.xz += dir * uBend * aH * aH * 2.2;
							p.y -= uBend * aH * aH * 0.6;
						}
						vH = aH;
						vec4 mv = modelViewMatrix * vec4(p, 1.0);
						vD = -mv.z;
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uRed;
					varying float vH; varying float vD;
					void main() {
						float fog = exp(-max(vD - 14.0, 0.0) * 0.035);
						vec3 c = vH < 0.0 ? vec3(0.5, 0.48, 0.7) * 0.5 : mix(vec3(0.62, 0.7, 0.95), vec3(0.95, 0.92, 1.0), vH);
						// 祭坛附近映着锁链的红光
						c += vec3(1.0, 0.12, 0.08) * uRed * (vH < 0.0 ? 0.25 : 0.0);
						gl_FragColor = vec4(c * uA * (0.35 + 0.65 * fog), 1.0);
					}`,
			}),
			occ: new THREE.MeshBasicMaterial({color: '#06050c'}),
		}),
		[],
	);
	const a = pillarsOn(f);
	if (a <= 0) return null;
	mats.lines.uniforms.uA.value = a;
	mats.lines.uniforms.uBend.value = easeOutCubic(prog(f, CLASH_AT, CLASH_AT + 14)) * 0.9;
	mats.lines.uniforms.uRed.value = chainGlow(f) * 0.6;
	const bend = mats.lines.uniforms.uBend.value;
	return (
		<>
			{/* 柱身与地面的暗色实体，挡住后面的线 */}
			{bend < 0.05
				? PILLARS.map((P, i) => (
						<mesh key={i} material={mats.occ} position={[P.x, P.h / 2, P.z]}>
							<cylinderGeometry args={[P.r * 0.97, P.r * 0.97, P.h - 1, 20]} />
						</mesh>
					))
				: null}
			<mesh material={mats.occ} position={[ALTAR[0], -0.02, ALTAR[2]]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[16, 64]} />
			</mesh>
			<lineSegments geometry={geo} material={mats.lines} frustumCulled={false} />
		</>
	);
};

/** 横着飞的雪（第 50 小节起风更大） */
const SNOW_N = 2600;
export const Snow: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const p = new Float32Array(SNOW_N * 3);
		const s = new Float32Array(SNOW_N);
		for (let i = 0; i < SNOW_N; i++) {
			p.set([rnd(i * 1.1) * 90, rnd(i * 2.3) * 45, rnd(i * 3.7) * 90], i * 3);
			s[i] = rnd(i * 4.9);
		}
		g.setAttribute('position', new THREE.BufferAttribute(p, 3));
		g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uX: {value: 0}, uY: {value: 0}, uA: {value: 0}, uO: {value: new THREE.Vector3(ALTAR[0] - 45, -3, ALTAR[2] - 55)}, uStreak: {value: 1}},
				vertexShader: /* glsl */ `
					attribute float aS;
					uniform float uX; uniform float uY; uniform vec3 uO; uniform float uStreak;
					varying float vB;
					void main() {
						vec3 p = position;
						p.x = mod(p.x + uX * (0.6 + 0.8 * aS), 90.0);
						p.y = mod(p.y - uY * (0.5 + aS), 45.0);
						p.z += sin(uX * 0.05 + aS * 20.0) * 0.6;
						vec4 mv = viewMatrix * vec4(uO + p, 1.0);
						vB = (0.35 + 0.65 * aS) * smoothstep(1.0, 5.0, -mv.z);
						gl_PointSize = clamp((1.2 + 2.2 * aS) * 34.0 / -mv.z, 1.0, 6.0) * uStreak;
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uStreak; varying float vB;
					void main() {
						vec2 q = gl_PointCoord - 0.5;
						// 风大时拉成横向的细条
						q.y *= uStreak;
						float d = length(q);
						gl_FragColor = vec4(vec3(0.86, 0.9, 1.0) * smoothstep(0.5, 0.05, d) * vB * uA * 0.8, 1.0);
					}`,
			}),
		[],
	);
	const a = pillarsOn(f);
	if (a <= 0) return null;
	// 风速随时间积分（逐段线性，保证位置连续）
	const w0 = 0.32;
	const w1 = 0.75;
	const t0 = TIGHT_FROM;
	const t1 = CLASH_AT;
	const x = f < t0 ? f * w0 : f < t1 ? t0 * w0 + (f - t0) * lerp(w0, w1, (f - t0) / (t1 - t0) / 2) : t0 * w0 + (t1 - t0) * (w0 + w1) / 2 + (f - t1) * w1;
	mat.uniforms.uX.value = x;
	mat.uniforms.uY.value = f * 0.045;
	mat.uniforms.uA.value = a;
	mat.uniforms.uStreak.value = 1 + 1.5 * smooth(prog(f, t0, t1));
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

/** 远山（天冠山顶望出去的群峰剪影，峰顶一线冷光） */
export const Mountains: React.FC<{f: number}> = ({f}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				uniforms: {uA: {value: 0}},
				vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec2 vP;
					float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
					float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
					float ridge(float x) {
						float v = 0.0; float a = 0.5; float fr = 0.012;
						for (int i = 0; i < 6; i++) { v += a * (1.0 - abs(n1(x * fr) * 2.0 - 1.0)); fr *= 2.1; a *= 0.5; }
						return v;
					}
					void main() {
						float far = ridge(vP.x + 300.0) * 34.0 + 10.0;
						float near = ridge(vP.x * 1.3 + 77.0) * 26.0 - 2.0;
						vec4 col = vec4(0.0);
						if (vP.y < far) { float e = exp(-(far - vP.y) / 2.5); col = vec4(vec3(0.03, 0.03, 0.055) + vec3(0.4, 0.45, 0.7) * e * 0.12, 1.0); }
						if (vP.y < near) { float e = exp(-(near - vP.y) / 2.0); col = vec4(vec3(0.014, 0.013, 0.024) + vec3(0.6, 0.62, 0.85) * e * 0.14, 1.0); }
						gl_FragColor = vec4(col.rgb, col.a * uA);
					}`,
			}),
		[],
	);
	const a = pillarsOn(f);
	if (a <= 0) return null;
	mat.uniforms.uA.value = a;
	return (
		<mesh material={mat} position={[ALTAR[0], -6, -280]}>
			<planeGeometry args={[1400, 140, 1, 1]} />
		</mesh>
	);
};

// ════════ 两道口子 ════════

const RIFT_H = 7.5;

export const Rifts: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				side: THREE.DoubleSide,
				uniforms: {uOpen: {value: 0}, uT: {value: 0}, uCore: {value: new THREE.Vector3()}, uEdge: {value: new THREE.Vector3()}, uSeed: {value: 0}, uHot: {value: 0}},
				vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uOpen; uniform float uT; uniform vec3 uCore; uniform vec3 uEdge; uniform float uSeed; uniform float uHot;
					varying vec2 vP;
					float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
					float n2(vec2 x) { vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
					float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
					void main() {
						float H = ${RIFT_H.toFixed(2)};
						float y = vP.y / H;
						if (abs(y) > 1.25) discard;
						// 口子的形状：上下尖、中间宽的一道斜裂缝，边缘锯齿
						float tilt = vP.x - vP.y * 0.22;
						float w = uOpen * 2.6 * pow(max(1.0 - y * y, 0.0), 0.6);
						w += (fbm(vec2(vP.y * 2.2, uT * 0.02)) - 0.5) * 1.1 * uOpen + (n2(vec2(vP.y * 9.0, 3.0)) - 0.5) * 0.35 * uOpen;
						float d = abs(tilt) - w;
						// 里面：翻涌的漩涡
						vec2 q = vec2(tilt, vP.y) * 0.6;
						float sw = fbm(q * 1.6 + vec2(uT * 0.015, -uT * 0.02) + fbm(q * 2.4 - uT * 0.01) * 1.5);
						float star = step(0.985, h2(floor(vP * 9.0))) * 0.8;
						vec3 inside = uCore * (0.35 + 1.1 * sw) + vec3(1.0) * pow(max(1.0 - abs(tilt) / max(w, 1e-3), 0.0), 3.0) * 0.6 + star;
						float rim = exp(-abs(d) / 0.07) * 2.2 + exp(-max(d, 0.0) / 0.9) * 0.35 + exp(-max(d, 0.0) / 3.0) * 0.12;
						vec3 col = (d < 0.0 ? inside : vec3(0.0)) + uEdge * rim * smoothstep(1.25, 0.95, abs(y));
						col *= 1.0 + uHot * 1.5;
						gl_FragColor = vec4(col * min(1.0, uOpen * 4.0), 1.0);
					}`,
			}),
		[],
	);
	const mats = useMemo(() => [mat.clone(), mat.clone()], [mat]);
	const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...c.pos), new THREE.Vector3(...c.tgt), new THREE.Vector3(0, 1, 0));
	const q = new THREE.Quaternion().setFromRotationMatrix(m);
	const hot = Math.exp(-Math.max(0, f - CLASH_AT) / 12) * (f >= CLASH_AT ? 1 : 0);
	return (
		<>
			{([-1, 1] as const).map((side, i) => {
				const o = riftOpen(f, side);
				if (o <= 0) return null;
				const u = mats[i].uniforms;
				u.uOpen.value = o;
				u.uT.value = f;
				u.uSeed.value = side * 3.1;
				u.uHot.value = hot + (side === -1 ? Math.exp(-Math.abs(f - DIALGA_AT) / 8) : 0);
				u.uCore.value.set(...(side === -1 ? [0.25, 0.45, 1.0] : [1.0, 0.45, 0.75]));
				u.uEdge.value.set(...(side === -1 ? [0.55, 0.8, 1.0] : [1.0, 0.75, 0.92]));
				return (
					<mesh key={side} material={mats[i]} position={riftPos(f, side)} quaternion={q} scale={[side, 1, 1]}>
						<planeGeometry args={[22, RIFT_H * 2.6]} />
					</mesh>
				);
			})}
		</>
	);
};

// ════════ 时间的星图线 / 空间的网格：被拽向中间 ════════

/** 两边的线往中间伸出去的长度（到第 53 小节正好在中间相遇） */
const reachAt = (f: number) => track(f, [[WHIP_AT + 10, 0], [TIGHT_FROM, 0.3], [CLASH_AT, 1]]);

const timeChartGeo = () => {
	const pos: number[] = [];
	const k: number[] = [];
	const seg = (a: V3, b: V3, ka: number, kb: number) => {
		pos.push(...a, ...b);
		k.push(ka, kb);
	};
	// 同心圆（星图仪）+ 刻度 + 放射线
	for (const r of [1.6, 2.6, 3.8, 5.2, 6.8]) {
		for (let i = 0; i < 128; i++) {
			const a0 = (i / 128) * Math.PI * 2;
			const a1 = ((i + 1) / 128) * Math.PI * 2;
			seg([Math.cos(a0) * r, Math.sin(a0) * r, 0], [Math.cos(a1) * r, Math.sin(a1) * r, 0], -1, -1);
		}
		const n = Math.round(r * 12);
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2;
			const l = i % 5 === 0 ? 0.35 : 0.16;
			seg([Math.cos(a) * r, Math.sin(a) * r, 0], [Math.cos(a) * (r + l), Math.sin(a) * (r + l), 0], -1, -1);
		}
	}
	for (let i = 0; i < 24; i++) {
		const a = (i / 24) * Math.PI * 2;
		seg([Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0], [Math.cos(a) * 6.8, Math.sin(a) * 6.8, 0], -1, -1);
	}
	return {pos, k, seg};
};

const LINE_YS = [-3.2, -2.2, -1.3, -0.5, 0.3, 1.1, 2.0, 3.0];

export const Forces: React.FC<{f: number}> = ({f}) => {
	const geos = useMemo(() => {
		const tc = timeChartGeo();
		const chart = new THREE.BufferGeometry();
		chart.setAttribute('position', new THREE.Float32BufferAttribute(tc.pos, 3));
		chart.setAttribute('aK', new THREE.Float32BufferAttribute(tc.k, 1));
		// 网格块
		const gp: number[] = [];
		const gk: number[] = [];
		for (let i = -6; i <= 6; i++) {
			gp.push(i, -6, 0, i, 6, 0, -6, i, 0, 6, i, 0);
			gk.push(-1, -1, -1, -1);
		}
		const grid = new THREE.BufferGeometry();
		grid.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
		grid.setAttribute('aK', new THREE.Float32BufferAttribute(gk, 1));
		// 伸向中间的长线：沿 x 从 0 到 1（按 reach 缩放），aK 记录沿线的位置
		const lp: number[] = [];
		const lk: number[] = [];
		for (const y of LINE_YS)
			for (let i = 0; i < 40; i++) {
				lp.push(i / 40, y, 0, (i + 1) / 40, y, 0);
				lk.push(i / 40, (i + 1) / 40);
			}
		const lines = new THREE.BufferGeometry();
		lines.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
		lines.setAttribute('aK', new THREE.Float32BufferAttribute(lk, 1));
		return {chart, grid, lines};
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uA: {value: 0}, uCol: {value: new THREE.Vector3()}, uT: {value: 0}, uRot: {value: 0}},
				vertexShader: /* glsl */ `
					attribute float aK;
					uniform float uRot;
					varying float vK;
					void main() {
						vK = aK;
						vec3 p = position;
						if (aK < 0.0) { float c = cos(uRot), s = sin(uRot); p.xy = mat2(c, s, -s, c) * p.xy; }
						gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform vec3 uCol; uniform float uT;
					varying float vK;
					void main() {
						float a = 0.55;
						if (vK >= 0.0) {
							// 沿线跑的光脉冲（一拍一个）+ 线头最亮
							float pulse = exp(-pow(fract(vK * 3.0 - uT / ${(BEAT * 2).toFixed(3)}) - 0.5, 2.0) * 60.0);
							a = 0.35 + 0.9 * pulse + 1.6 * smoothstep(0.9, 1.0, vK);
						}
						gl_FragColor = vec4(uCol * a * uA, 1.0);
					}`,
			}),
		[],
	);
	const mats = useMemo(() => Array.from({length: 4}, () => mat.clone()), [mat]);
	const on = env(f, WHIP_AT + 8, CALM_AT + 4, 16, 8);
	if (on <= 0) return null;
	const L = riftPos(f, -1);
	const R = riftPos(f, 1);
	const reach = reachAt(f);
	const half = (R[0] - L[0]) / 2;
	const cobalt: [number, number, number] = [0.35, 0.6, 1.0];
	const pearl: [number, number, number] = [1.0, 0.82, 0.95];
	const set = (m: THREE.ShaderMaterial, col: [number, number, number], a: number, rot = 0) => {
		m.uniforms.uA.value = a * on;
		m.uniforms.uCol.value.set(...col);
		m.uniforms.uT.value = f;
		m.uniforms.uRot.value = rot;
	};
	const ro = riftOpen(f, -1);
	const rr = riftOpen(f, 1);
	set(mats[0], cobalt, 0.6 * ro, (f - WHIP_AT) * 0.004);
	set(mats[1], pearl, 0.45 * rr);
	set(mats[2], cobalt, ro);
	set(mats[3], pearl, rr);
	return (
		<>
			<lineSegments geometry={geos.chart} material={mats[0]} position={[L[0], L[1], L[2] - 0.3]} frustumCulled={false} />
			<lineSegments geometry={geos.grid} material={mats[1]} position={[R[0], R[1], R[2] - 0.3]} rotation={[0, 0, 0.12]} frustumCulled={false} />
			<lineSegments geometry={geos.lines} material={mats[2]} position={[L[0], L[1] - 0.3, L[2]]} scale={[Math.max(1e-3, half * reach), 1, 1]} frustumCulled={false} />
			<lineSegments geometry={geos.lines} material={mats[3]} position={[R[0], R[1] - 0.3, R[2]]} scale={[-Math.max(1e-3, half * reach), 0.9, 1]} frustumCulled={false} />
		</>
	);
};

// ════════ 帝牙卢卡与帕路奇亚 ════════

const DIALGA_SIZE = 15;
const PALKIA_SIZE = 15;
/** 立绘里钻石 / 珍珠的位置 */
const DIAMOND_UV: [number, number] = [0.81, 0.58];
const PALKIA_PEARL_UV: [number, number] = [0.527, 0.255];

const godPos = (f: number, side: -1 | 1): V3 => {
	const r = riftPos(f, side);
	return [r[0] + side * 1.5, r[1] - 0.6, r[2] + 1.5];
};

const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];

/** 显色前在口子里只是一团剪影（49.2 召来），帝牙卢卡 52.0、帕路奇亚 53.0 完全显出 */
export const Gods: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const out = riftOut(f);
	const items = [
		{side: -1 as const, dir: 'pokemon/dialga', at: DIALGA_AT, size: DIALGA_SIZE, uv: DIAMOND_UV, tint: [0.45, 0.65, 1.0], rimDir: [0.7, -0.6] as [number, number], emTint: [0.8, 1.1, 1.6] as [number, number, number]},
		{side: 1 as const, dir: 'pokemon/palkia', at: CLASH_AT, size: PALKIA_SIZE, uv: PALKIA_PEARL_UV, tint: [1.0, 0.6, 0.85], rimDir: [-0.7, -0.6] as [number, number], emTint: [1.5, 0.75, 1.15] as [number, number, number]},
	];
	return (
		<>
			{items.map((it) => {
				const appear = smooth(prog(f, bf(49, 2), bf(50, 2))) * riftOpen(f, it.side) * out;
				if (appear <= 0) return null;
				const pr = project(c, godPos(f, it.side));
				if (pr.depth <= 0) return null;
				const k = smooth(prog(f, it.at - 1, it.at + 9));
				const flash = f >= it.at - 1 ? Math.exp(-(f - it.at) / 8) : 0;
				const size = pxOf(c, pr.depth, it.size) * lerp(0.85, 1, k);
				return (
					<PokemonArt3D
						key={it.dir}
						dir={it.dir}
						x={pr.x}
						y={pr.y}
						size={size}
						yaw={Math.sin((f - it.at) * 0.03) * 1.5 * k}
						depthScale={0.5}
						ambient={mix3([0.02, 0.02, 0.035], [0.5, 0.5, 0.58], k)}
						dirLights={[
							{dir: [-0.4, -0.7, 0.6], color: mix3([0, 0, 0], [0.42, 0.42, 0.5], k), wrap: 0.45},
							{dir: [0, 0.8, 0.4], color: mix3([0, 0, 0], [0.5, 0.1, 0.08], k), wrap: 0.5},
						]}
						pointLights={[{pos: [it.uv[0] - 0.5, it.uv[1] - 0.5, 0.3], color: mix3(it.tint.map((v) => v * 0.4), it.tint.map((v) => v * 1.2), k), radius: 0.3}]}
						rim={{dir: it.rimDir, color: mix3(it.tint.map((v) => v * 1.3), it.tint, k), power: 2.4}}
						emissive={0.3 * (1 - k) + 0.12 * k + 0.6 * flash}
						emissiveTint={it.emTint}
						emissiveKey={[0.5, 1, 0.12, 0.8]}
						brightness={1 + 1.6 * flash}
						opacity={appear * lerp(0.6, 1, k)}
						resolution={Math.min(1.3, 2600 / Math.max(1, size * 1.12))}
					/>
				);
			})}
		</>
	);
};

export const dialgaNameOpacity = (f: number) => 1 - smooth(prog(f, bf(53, 2), bf(54)));

// ════════ 对撞：冲击波、色散环、放射光条 ════════

export const ClashBurst: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const t = f - CLASH_AT;
	if (t < -BEAT * 2 || t > 70) return null;
	const p = project(c, [CC[0], CC[1] + 1.2, CC[2]]);
	// 撞上之前：中间越来越亮
	const pre = smooth(prog(t, -BEAT * 2, 0));
	const flash = t >= 0 ? Math.exp(-t / 7) : 0;
	const ringR = t >= 0 ? 40 + 1500 * easeOutCubic(t / 34) : 0;
	const ringA = t >= 0 ? Math.exp(-t / 16) : 0;
	const rays = Array.from({length: 40}, (_, i) => {
		const a = rnd(i * 3.1) * Math.PI * 2;
		const l0 = 60 + 200 * rnd(i * 5.7);
		const l1 = l0 + (300 + 900 * rnd(i * 7.3)) * easeOutCubic(Math.max(0, t) / 20);
		return {a, l0: l0 + (l1 - l0) * 0.4 * easeOutCubic(Math.max(0, t) / 30), l1, w: 1 + 3 * rnd(i * 9.1)};
	});
	return (
		<>
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					background: `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(255,255,255,${0.35 * pre + 0.95 * flash}) 0%, rgba(200,215,255,${0.2 * pre + 0.5 * flash}) 10%, rgba(${PINK},${0.1 * pre + 0.35 * flash}) 28%, rgba(0,0,0,0) ${55 + 30 * flash}%)`,
				}}
			/>
			{t >= 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
					<defs>
						<filter id="sp-ring" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					{/* 色散：红、绿、蓝三圈略微错开 */}
					<circle cx={p.x} cy={p.y} r={ringR * 1.02} fill="none" stroke={`rgba(255,80,120,${0.75 * ringA})`} strokeWidth={10 * ringA + 2} filter="url(#sp-ring)" />
					<circle cx={p.x} cy={p.y} r={ringR} fill="none" stroke={`rgba(220,255,230,${0.6 * ringA})`} strokeWidth={8 * ringA + 2} filter="url(#sp-ring)" />
					<circle cx={p.x} cy={p.y} r={ringR * 0.98} fill="none" stroke={`rgba(90,140,255,${0.75 * ringA})`} strokeWidth={10 * ringA + 2} filter="url(#sp-ring)" />
					<ellipse cx={p.x} cy={p.y} rx={ringR * 1.6} ry={ringR * 0.22} fill="none" stroke={`rgba(${PEARL},${0.5 * ringA})`} strokeWidth={3} filter="url(#sp-ring)" />
					{rays.map((r, i) => (
						<line
							key={i}
							x1={p.x + Math.cos(r.a) * r.l0}
							y1={p.y + Math.sin(r.a) * r.l0}
							x2={p.x + Math.cos(r.a) * r.l1}
							y2={p.y + Math.sin(r.a) * r.l1}
							stroke={i % 2 ? `rgba(150,190,255,${0.8 * Math.exp(-t / 14)})` : `rgba(255,200,230,${0.8 * Math.exp(-t / 14)})`}
							strokeWidth={r.w}
							strokeLinecap="round"
						/>
					))}
				</svg>
			) : null}
		</>
	);
};

/** 召来那一下与帝牙卢卡显色时口子里冲出的光 */
export const RiftFlash: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const items: [number, -1 | 1, string][] = [
		[DIALGA_AT, -1, '120,170,255'],
		[WHIP_AT + 8, -1, '120,170,255'],
		[WHIP_AT + 12, 1, PINK],
	];
	return (
		<>
			{items.map(([at, side, rgb], i) => {
				const t = f - at;
				if (t < -1 || t > 40) return null;
				const a = Math.exp(-Math.max(0, t) / 8) * (i === 0 ? 1 : 0.6);
				const p = project(c, riftPos(f, side));
				const r = 700;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: p.x - r,
							top: p.y - r,
							width: r * 2,
							height: r * 2,
							mixBlendMode: 'screen',
							background: `radial-gradient(circle, rgba(255,255,255,${0.6 * a}) 0%, rgba(${rgb},${0.4 * a}) 18%, rgba(0,0,0,0) 60%)`,
						}}
					/>
				);
			})}
		</>
	);
};

// ════════ 整个画面被撕开（第 54 小节） ════════

/** 撕口：从右上斜到左下（和开场那一斩同一个方向），按固定种子抖成锯齿 */
const TEAR_P1: [number, number] = [1560, -60];
const TEAR_P2: [number, number] = [300, 1140];
export const TEAR_PTS: [number, number][] = (() => {
	const n = 30;
	const dx = TEAR_P2[0] - TEAR_P1[0];
	const dy = TEAR_P2[1] - TEAR_P1[1];
	const l = Math.hypot(dx, dy);
	const nx = -dy / l;
	const ny = dx / l;
	return Array.from({length: n + 1}, (_, i) => {
		const t = i / n;
		const j = i === 0 || i === n ? 0 : (rnd(i * 7.3 + 1) - 0.5) * 46 + (rnd(i * 2.1) - 0.5) * 20;
		return [TEAR_P1[0] + dx * t + nx * j, TEAR_P1[1] + dy * t + ny * j] as [number, number];
	});
})();
export const TEAR_N: [number, number] = (() => {
	const dx = TEAR_P2[0] - TEAR_P1[0];
	const dy = TEAR_P2[1] - TEAR_P1[1];
	const l = Math.hypot(dx, dy);
	return [-dy / l, dx / l];
})();

/** 撕开的宽度（像素）：一下撕开，停在撕开一半的样子，第 55 小节起慢慢合拢 */
export const tearAt = (f: number) => {
	const open = easeOutCubic(prog(f, TEAR_AT, TEAR_AT + 7)) * 150 + 18 * smooth(prog(f, TEAR_AT + 7, CALM_AT));
	return open * (1 - smooth(prog(f, CALM_AT, bf(55, 3))));
};

/** 半边画面的裁切多边形（side = 1 在撕口的法线一侧） */
export const tearClip = (side: 1 | -1) => {
	const far = 4000;
	const pts = TEAR_PTS.map(([x, y]) => `${x}px ${y}px`);
	const e1 = `${TEAR_PTS[TEAR_PTS.length - 1][0] + side * TEAR_N[0] * far}px ${TEAR_PTS[TEAR_PTS.length - 1][1] + side * TEAR_N[1] * far}px`;
	const e0 = `${TEAR_PTS[0][0] + side * TEAR_N[0] * far}px ${TEAR_PTS[0][1] + side * TEAR_N[1] * far}px`;
	return `polygon(${[...pts, e1, e0].join(', ')})`;
};

/** 撕口里面：白热的空隙、时间与空间两色的光条，边缘一圈虹彩 */
export const TearGap: React.FC<{f: number; w: number}> = ({f, w}) => {
	const t = f - TEAR_AT;
	const hot = Math.exp(-Math.max(0, t) / 10);
	const pts = TEAR_PTS;
	const off = (s: number) => pts.map(([x, y]) => `${x + TEAR_N[0] * s},${y + TEAR_N[1] * s}`).join(' ');
	const gap = [...pts.map(([x, y]) => `${x + TEAR_N[0] * w * 0.5},${y + TEAR_N[1] * w * 0.5}`), ...[...pts].reverse().map(([x, y]) => `${x - TEAR_N[0] * w * 0.5},${y - TEAR_N[1] * w * 0.5}`)].join(' ');
	const streaks = Array.from({length: 26}, (_, i) => {
		const u = rnd(i * 4.1);
		const a = pts[Math.floor(u * (pts.length - 1))];
		const s = (rnd(i * 6.3) - 0.5) * w * 0.8;
		const len = 80 + 220 * rnd(i * 8.9);
		const d = [TEAR_P2[0] - TEAR_P1[0], TEAR_P2[1] - TEAR_P1[1]];
		const l = Math.hypot(d[0], d[1]);
		const shift = ((f * (6 + 10 * rnd(i * 2.7))) % 400) - 200;
		const x = a[0] + TEAR_N[0] * s + (d[0] / l) * shift;
		const y = a[1] + TEAR_N[1] * s + (d[1] / l) * shift;
		return {x1: x, y1: y, x2: x + (d[0] / l) * len, y2: y + (d[1] / l) * len, c: i % 2 ? '130,175,255' : '255,170,215'};
	});
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
			<defs>
				<filter id="sp-tear-w" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="16" />
				</filter>
				<filter id="sp-tear-n" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="2.5" />
				</filter>
				<linearGradient id="sp-tear-g" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#fff2fa" />
					<stop offset="0.5" stopColor="#f2e8ff" />
					<stop offset="1" stopColor="#e6f0ff" />
				</linearGradient>
			</defs>
			<polygon points={gap} fill="url(#sp-tear-g)" opacity={0.4 + 0.5 * hot} />
			<g style={{mixBlendMode: 'screen'}}>
				{streaks.map((s, i) => (
					<line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={`rgba(${s.c},0.7)`} strokeWidth={3} strokeLinecap="round" />
				))}
				<polyline points={off(w * 0.5)} fill="none" stroke={`rgba(${PINK},0.9)`} strokeWidth={22} filter="url(#sp-tear-w)" />
				<polyline points={off(-w * 0.5)} fill="none" stroke="rgba(120,170,255,0.9)" strokeWidth={22} filter="url(#sp-tear-w)" />
				<polyline points={off(w * 0.5)} fill="none" stroke="rgba(255,240,250,1)" strokeWidth={3} filter="url(#sp-tear-n)" />
				<polyline points={off(-w * 0.5)} fill="none" stroke="rgba(235,245,255,1)" strokeWidth={3} filter="url(#sp-tear-n)" />
			</g>
		</svg>
	);
};
