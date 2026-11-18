import {useMemo} from 'react';
import * as THREE from 'three';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, BEAT, easeOutCubic, env, lerp, prog, rnd, smooth} from './common';
import {REND_AT} from './bend';
import {PEARL, PINK} from './hook';

/**
 * 第 6 段「折纸与捷径」（静段）：
 * 穿过裂口进入它的世界：空间被撕成一条一条的缎带（参考 React Bits 的 Ribbons / Threads），起源形态在远处；
 * 37.1 两条隔得很远的缎带之间一道珍珠色的细线接通，光点一步跳过去；
 * 39.1 两个端点落成一张白纸上的两点；41.1 纸慢慢对折，两点相对；42.1 中间长出一条管道（虫洞示意，标"假说"）；
 * 43.1 纸摊平、变暗，折痕留下一道红光，接第 7 段的红色锁链。
 */

// ════════ 纸与两点 ════════

/** 纸的中心（镜头穿过裂口后一路往前看到的地方） */
export const PAPER_C: V3 = [10, 13.5, -38];
const PAPER_W = 12;
const PAPER_H = 8;
/** 两点在纸上的局部 x */
const DOT_X = 4;
export const DOT_A: V3 = [PAPER_C[0] - DOT_X, PAPER_C[1], PAPER_C[2]];
export const DOT_B: V3 = [PAPER_C[0] + DOT_X, PAPER_C[1], PAPER_C[2]];
/** 对折：折到 180° 时弯成半径 R 的 U 形；折痕位置让右边那点正好落在左边那点的正前方 */
const FOLD_R = 2;
const CREASE_X = (-Math.PI * FOLD_R) / 2;

export const THREAD_AT = bf(37, 1);
export const PAPER_AT = bf(39, 1);
const FOLD_FROM = bf(41, 1);
const FOLD_TO = bf(42);
export const TUBE_AT = bf(42, 1);
const UNFOLD_AT = bf(43, 1);

export const foldAt = (f: number) => Math.PI * (smooth(prog(f, FOLD_FROM, FOLD_TO)) - smooth(prog(f, UNFOLD_AT, UNFOLD_AT + BEAT * 2)));
/** 纸有多亮（也用来降低胶片颗粒）：39.1 亮起，43.1 起变暗 */
export const paperBright = (f: number) => smooth(prog(f, PAPER_AT - 2, PAPER_AT + 12)) * (1 - smooth(prog(f, UNFOLD_AT, UNFOLD_AT + BEAT * 3)));
/** 第 44 小节第 3 拍起纸淡去，折痕的红光交给锁链（clash.tsx） */
const paperOn = (f: number) => smooth(prog(f, PAPER_AT - 2, PAPER_AT + 12)) * (1 - smooth(prog(f, bf(44, 2), bf(45, 2))));
/** 全息示意：管道长出来时，纸变成半透明的线框 */
const holoAt = (f: number) => smooth(prog(f, TUBE_AT - 6, TUBE_AT + 12)) * (1 - smooth(prog(f, UNFOLD_AT - 6, UNFOLD_AT + 8)));
/** 折痕的红光 */
export const creaseAt = (f: number) => smooth(prog(f, UNFOLD_AT + BEAT, UNFOLD_AT + BEAT * 3));

export const Paper: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => new THREE.PlaneGeometry(PAPER_W, PAPER_H, 240, 8), []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				uniforms: {uTh: {value: 0}, uA: {value: 0}, uBright: {value: 1}, uHolo: {value: 0}, uCrease: {value: 0}, uDots: {value: 1}},
				vertexShader: /* glsl */ `
					uniform float uTh;
					varying vec2 vL; varying vec3 vN; varying vec3 vW;
					const float R = ${FOLD_R.toFixed(4)};
					const float C = ${CREASE_X.toFixed(4)};
					void main() {
						vL = position.xy;
						vec3 p = position;
						vec3 n = vec3(0.0, 0.0, 1.0);
						if (p.x > C) {
							float u = p.x - C;
							float arc = uTh * R;
							if (u < arc) {
								float a = u / R;
								p.x = C + R * sin(a);
								p.z = R * (1.0 - cos(a));
								n = vec3(-sin(a), 0.0, cos(a));
							} else {
								float s = u - arc;
								p.x = C + R * sin(uTh) + s * cos(uTh);
								p.z = R * (1.0 - cos(uTh)) + s * sin(uTh);
								n = vec3(-sin(uTh), 0.0, cos(uTh));
							}
						}
						vN = n;
						vec4 w = modelMatrix * vec4(p, 1.0);
						vW = w.xyz;
						gl_Position = projectionMatrix * viewMatrix * w;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uBright; uniform float uHolo; uniform float uCrease; uniform float uDots; uniform float uTh;
					varying vec2 vL; varying vec3 vN; varying vec3 vW;
					float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
					float n2(vec2 x) { vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
					float gridLine(vec2 p, float w) { vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), 1e-4); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
					void main() {
						vec3 n = normalize(gl_FrontFacing ? vN : -vN);
						vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
						vec3 V = normalize(cameraPosition - vW);
						float lam = max(dot(n, L), 0.0);
						// 纸纹：细纤维 + 极淡的颗粒
						float fiber = n2(vL * vec2(40.0, 6.0)) * 0.5 + n2(vL * 90.0) * 0.5;
						vec3 paper = vec3(0.95, 0.93, 0.96) * (0.52 + 0.5 * lam) * (0.96 + 0.06 * fiber);
						// 背面略暗、略冷
						if (!gl_FrontFacing) paper *= vec3(0.86, 0.86, 0.92);
						paper *= uBright;
						// 两点与虚线（正反面都画，折过来后隔着半透明的纸也看得见）
						float dA = length(vL - vec2(-${DOT_X.toFixed(1)}, 0.0));
						float dB = length(vL - vec2(${DOT_X.toFixed(1)}, 0.0));
						float dot_ = smoothstep(0.24, 0.2, min(dA, dB));
						float ring = smoothstep(0.05, 0.0, abs(min(dA, dB) - 0.42)) * 0.8;
						float dash = step(0.5, fract(vL.x * 2.2)) * smoothstep(0.045, 0.02, abs(vL.y)) * step(abs(vL.x), ${DOT_X.toFixed(1)} - 0.45);
						vec3 pink = vec3(0.92, 0.32, 0.58);
						vec3 col = mix(paper, pink * max(uBright, 0.35), max(dot_, ring) * uDots);
						col = mix(col, vec3(0.55, 0.45, 0.6) * uBright, dash * 0.75 * uDots);
						// 全息示意：纸淡去，留珍珠色网格
						float grid = gridLine(vL / 0.5, 1.0) * 0.5 + gridLine(vL / 2.0, 1.4);
						vec3 holo = vec3(0.03, 0.026, 0.05) + vec3(0.86, 0.8, 1.0) * grid * 0.45 + pink * 1.4 * max(dot_, ring);
						col = mix(col, holo, uHolo);
						// 折痕的红光
						float cr = exp(-abs(vL.x) / 0.05) * 1.6 + exp(-abs(vL.x) / 0.5) * 0.35;
						col += vec3(1.0, 0.16, 0.12) * cr * uCrease;
						// 边缘柔一点
						vec2 e = ${(PAPER_W / 2).toFixed(1)} - abs(vL) * vec2(1.0, ${(PAPER_W / PAPER_H).toFixed(4)});
						float edge = smoothstep(0.0, 0.06, min(e.x, e.y));
						// 折过来以后半透明，看得见夹在里面的那一点
						float alpha = mix(1.0, 0.6, smoothstep(1.4, 3.0, uTh)) * mix(1.0, 0.75, uHolo);
						gl_FragColor = vec4(col, alpha * edge * uA);
					}`,
			}),
		[],
	);
	const on = paperOn(f);
	if (on <= 0) return null;
	const u = mat.uniforms;
	u.uTh.value = foldAt(f);
	u.uA.value = on;
	// 刚亮起时过曝一点，像一盏柔光灯打开；43.1 起暗到几乎看不见，只留折痕
	u.uBright.value = lerp(0.06, 1 + 0.35 * Math.exp(-Math.max(0, f - PAPER_AT) / 14), paperBright(f) / Math.max(on, 1e-3));
	u.uHolo.value = holoAt(f);
	u.uCrease.value = creaseAt(f);
	u.uDots.value = 1 - smooth(prog(f, UNFOLD_AT + BEAT, UNFOLD_AT + BEAT * 3));
	return <mesh geometry={geo} material={mat} position={PAPER_C} frustumCulled={false} />;
};

/** 管道（虫洞示意）：两点之间的沙漏形线框，从两头往中间长 */
export const Tube: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const pts: number[] = [];
		const kz: number[] = [];
		const L = FOLD_R * 2;
		const rad = (t: number) => 0.32 + 1.25 * Math.pow(Math.abs(2 * t - 1), 2.2);
		const RINGS = 14;
		const MER = 20;
		for (let i = 0; i <= RINGS; i++) {
			const t = i / RINGS;
			const r = rad(t);
			for (let j = 0; j < 48; j++) {
				const a0 = (j / 48) * Math.PI * 2;
				const a1 = ((j + 1) / 48) * Math.PI * 2;
				pts.push(Math.cos(a0) * r, Math.sin(a0) * r, t * L, Math.cos(a1) * r, Math.sin(a1) * r, t * L);
				kz.push(t, t);
			}
		}
		for (let j = 0; j < MER; j++) {
			const a = (j / MER) * Math.PI * 2;
			for (let i = 0; i < 40; i++) {
				const t0 = i / 40;
				const t1 = (i + 1) / 40;
				pts.push(Math.cos(a) * rad(t0), Math.sin(a) * rad(t0), t0 * L, Math.cos(a) * rad(t1), Math.sin(a) * rad(t1), t1 * L);
				kz.push(t0, t1);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
		g.setAttribute('aT', new THREE.Float32BufferAttribute(kz, 1));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uG: {value: 0}, uA: {value: 0}},
				vertexShader: /* glsl */ `attribute float aT; varying float vT; void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uG; uniform float uA; varying float vT;
					void main() {
						float d = abs(vT - 0.5);
						float vis = smoothstep(0.5 - uG * 0.5 - 0.02, 0.5 - uG * 0.5 + 0.02, d) ;
						float front = exp(-abs(d - (0.5 - uG * 0.5)) * 30.0) * (1.0 - uG);
						vec3 c = mix(vec3(1.0, 0.85, 0.95), vec3(0.85, 0.82, 1.0), 1.0 - d * 2.0);
						gl_FragColor = vec4(c * (0.55 * vis + front * 1.5) * uA, 1.0);
					}`,
			}),
		[],
	);
	const a = env(f, TUBE_AT - 2, UNFOLD_AT + 4, 4, 10);
	if (a <= 0) return null;
	mat.uniforms.uA.value = a;
	mat.uniforms.uG.value = 1 - easeOutCubic(prog(f, TUBE_AT, TUBE_AT + BEAT * 2));
	return <lineSegments geometry={geo} material={mat} position={DOT_A} frustumCulled={false} />;
};

/** 管道旁的标注 */
export const TubeLabel: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = env(f, TUBE_AT + 10, UNFOLD_AT + 4, 12, 10);
	if (a <= 0) return null;
	const p = project(c, [DOT_A[0] - 1.8, DOT_A[1] + 2.4, DOT_A[2] + FOLD_R]);
	return (
		<div style={{position: 'absolute', left: p.x - 300, top: p.y - 30, width: 300, textAlign: 'right', opacity: a, textShadow: `0 0 14px rgba(${PINK},0.6), 0 0 4px rgba(0,0,0,0.9)`}}>
			<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 36, color: '#fff2fa', letterSpacing: 4}}>虫洞 · 假说</div>
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 14, letterSpacing: 4, color: 'rgba(255,228,244,0.8)', marginTop: 4}}>WORMHOLE · HYPOTHESIS</div>
		</div>
	);
};

/** 纸亮起时身后一圈柔光 */
export const PaperGlow: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const b = paperBright(f);
	if (b <= 0.01) return null;
	const p = project(c, PAPER_C);
	const r = pxOf(c, p.depth, PAPER_W) * 0.95;
	return (
		<div
			style={{
				position: 'absolute',
				left: p.x - r,
				top: p.y - r * 0.8,
				width: r * 2,
				height: r * 1.6,
				mixBlendMode: 'screen',
				background: `radial-gradient(ellipse, rgba(236,228,255,${0.16 * b}) 0%, rgba(${PINK},${0.05 * b}) 45%, rgba(0,0,0,0) 70%)`,
			}}
		/>
	);
};

// ════════ 缎带：它的世界，空间被撕成一条一条 ════════

const RIB_N = 46;
const RIB_SEG = 90;
type Rib = {c: V3; t: V3; b: V3; len: number; w: number; amp: number; freq: number; ph: number; twist: number};

const norm = (v: V3): V3 => {
	const l = Math.hypot(...v);
	return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const RIBS: Rib[] = (() => {
	const out: Rib[] = [];
	// 接通的那两条：竖着穿过两个端点
	out.push({c: DOT_A, t: norm([0.18, 1, -0.1]), b: norm([1, -0.15, 0.3]), len: 24, w: 1.2, amp: 0.12, freq: 1.3, ph: 0.4, twist: 0.6});
	out.push({c: DOT_B, t: norm([-0.25, 1, 0.12]), b: norm([1, 0.2, -0.35]), len: 22, w: 1.0, amp: 0.12, freq: 1.1, ph: 2.1, twist: -0.5});
	for (let i = 0; i < RIB_N - 2; i++) {
		const s = i + 7;
		let c: V3 = [-18 + 56 * rnd(s * 1.3), -6 + 40 * rnd(s * 2.9), -14 - 80 * rnd(s * 4.1)];
		// 别挡住两个端点和镜头前进的路线
		if (Math.abs(c[0] - PAPER_C[0]) < 9 && Math.abs(c[1] - PAPER_C[1]) < 7) c = [c[0] + (c[0] > PAPER_C[0] ? 9 : -9), c[1], c[2]];
		const t = norm([rnd(s * 5.7) - 0.5, rnd(s * 6.1) - 0.5, (rnd(s * 7.3) - 0.5) * 0.6]);
		const b = norm(cross(t, norm([rnd(s * 8.9) - 0.5, rnd(s * 9.7) - 0.5, rnd(s * 3.3) - 0.5])));
		out.push({c, t, b, len: 10 + 22 * rnd(s * 2.2), w: 0.5 + 1.3 * rnd(s * 3.1), amp: 0.3 + 0.9 * rnd(s * 4.4), freq: 0.8 + 1.6 * rnd(s * 5.5), ph: rnd(s * 6.6) * 6.28, twist: (rnd(s * 7.7) - 0.5) * 3});
	}
	return out;
})();

const ribbonGeo = () => {
	const pos: number[] = [];
	const uv: number[] = [];
	const cA: number[] = [];
	const tA: number[] = [];
	const bA: number[] = [];
	const pA: number[] = [];
	const idx: number[] = [];
	let base = 0;
	RIBS.forEach((r, k) => {
		for (let i = 0; i <= RIB_SEG; i++)
			for (const v of [-1, 1]) {
				pos.push(0, 0, 0);
				uv.push(i / RIB_SEG, v);
				cA.push(...r.c);
				tA.push(...r.t, r.len);
				bA.push(...r.b, r.w);
				pA.push(r.amp, r.freq, r.ph, r.twist + k * 0.0);
			}
		for (let i = 0; i < RIB_SEG; i++) {
			const a = base + i * 2;
			idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
		}
		base += (RIB_SEG + 1) * 2;
	});
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
	g.setAttribute('aC', new THREE.Float32BufferAttribute(cA, 3));
	g.setAttribute('aT', new THREE.Float32BufferAttribute(tA, 4));
	g.setAttribute('aB', new THREE.Float32BufferAttribute(bA, 4));
	g.setAttribute('aP', new THREE.Float32BufferAttribute(pA, 4));
	g.setIndex(idx);
	return g;
};

const ribbonsOn = (f: number) => env(f, REND_AT, PAPER_AT + 8, 20, 18);

export const Ribbons: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(ribbonGeo, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				blending: THREE.AdditiveBlending,
				uniforms: {uT: {value: 0}, uA: {value: 0}},
				vertexShader: /* glsl */ `
					attribute vec2 aUv; attribute vec3 aC; attribute vec4 aT; attribute vec4 aB; attribute vec4 aP;
					uniform float uT;
					varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vSeed;
					void main() {
						vUv = aUv;
						vSeed = aP.z;
						vec3 T = aT.xyz; vec3 B = aB.xyz; vec3 N = normalize(cross(T, B));
						float s = (aUv.x - 0.5) * aT.w;
						float ang = aP.w * (aUv.x - 0.5) + 0.25 * sin(uT * 0.012 + aP.z);
						vec3 Bt = B * cos(ang) + N * sin(ang);
						vec3 Nt = normalize(cross(T, Bt));
						float wave = sin(aUv.x * 6.2831 * aP.y + uT * 0.02 + aP.z) * aP.x;
						vec3 drift = vec3(sin(uT * 0.004 + aP.z), cos(uT * 0.005 + aP.z * 1.3), 0.0) * 0.4 * step(0.3, aP.x);
						vec3 p = aC + T * s + Bt * aUv.y * aB.w * 0.5 + Nt * wave + drift;
						vN = Nt;
						vW = p;
						gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uT;
					varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vSeed;
					float h1(float x) { return fract(sin(x * 127.1 + vSeed * 31.7) * 43758.5453); }
					float n1(float x) { float i = floor(x); float f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
					vec3 nacre(float t) {
						vec3 a = vec3(1.0, 0.78, 0.9); vec3 b = vec3(0.78, 0.74, 1.0); vec3 c = vec3(0.72, 0.95, 1.0);
						t = fract(t);
						return t < 0.333 ? mix(a, b, t * 3.0) : t < 0.666 ? mix(b, c, t * 3.0 - 1.0) : mix(c, a, t * 3.0 - 2.0);
					}
					void main() {
						// 撕开的毛边：两侧与两端按噪声缺一块
						float rag = 0.72 + 0.28 * n1(vUv.x * 60.0) * n1(vUv.x * 13.0 + 4.0);
						if (abs(vUv.y) > rag) discard;
						float endRag = 0.04 + 0.06 * n1(vUv.y * 9.0 + 7.0);
						if (vUv.x < endRag || vUv.x > 1.0 - endRag) discard;
						vec3 V = normalize(cameraPosition - vW);
						float fres = pow(1.0 - abs(dot(V, normalize(vN))), 2.0);
						vec3 iri = nacre(vUv.x * 1.4 + fres * 0.7 + vSeed * 0.15 + uT * 0.001);
						float edge = smoothstep(rag - 0.12, rag, abs(vUv.y));
						float lines = smoothstep(0.08, 0.0, abs(fract(vUv.x * 18.0) - 0.5) - 0.42);
						float dist = length(cameraPosition - vW);
						float fog = exp(-max(dist - 18.0, 0.0) * 0.022);
						vec3 col = iri * (0.05 + 0.32 * fres + 0.55 * edge + 0.08 * lines);
						gl_FragColor = vec4(col * uA * fog, 1.0);
					}`,
			}),
		[],
	);
	const a = ribbonsOn(f);
	if (a <= 0) return null;
	mat.uniforms.uT.value = f;
	mat.uniforms.uA.value = a;
	return <mesh geometry={geo} material={mat} frustumCulled={false} />;
};

/** 远处安静的起源形态（第 36 小节起） */
const FAR_ORIGIN: V3 = [-26, 34, -150];
export const FarOrigin: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const o = env(f, bf(36), PAPER_AT, 30, 14) * 0.6;
	if (o <= 0) return null;
	const pr = project(c, FAR_ORIGIN);
	if (pr.depth <= 0) return null;
	const size = pxOf(c, pr.depth, 26);
	return (
		<PokemonArt3D
			dir="pokemon/palkia"
			variant="-origin"
			x={pr.x}
			y={pr.y}
			size={size}
			yaw={Math.sin((f - bf(36)) * 0.02) * 1.5}
			depthScale={0.5}
			ambient={[0.16, 0.14, 0.2]}
			rim={{dir: [-0.6, -0.7], color: [1.3, 0.85, 1.25], power: 2.2}}
			emissive={0.25}
			emissiveTint={[1.4, 0.8, 1.2]}
			emissiveKey={[0.5, 1, 0.12, 0.8]}
			opacity={o}
			resolution={Math.min(1.2, 2600 / Math.max(1, size * 1.12))}
		/>
	);
};

/** 37.1：两条缎带之间一道珍珠细线接通，光点一步跳过去 */
export const Thread: React.FC<{f: number; c: Cam; Glint: React.FC<{x: number; y: number; r: number; a: number; star: number}>}> = ({f, c, Glint}) => {
	const a = env(f, THREAD_AT - 1, PAPER_AT + 10, 1, 12);
	if (a <= 0) return null;
	const A = project(c, DOT_A);
	const B = project(c, DOT_B);
	const snap = Math.exp(-Math.max(0, f - THREAD_AT) / 6);
	const jumpFrom = THREAD_AT + BEAT;
	const j = easeOutCubic(prog(f, jumpFrom, jumpFrom + 7));
	const jx = lerp(A.x, B.x, j);
	const jy = lerp(A.y, B.y, j);
	const jumpA = f >= jumpFrom - 4 ? Math.max(0, 1 - Math.max(0, f - jumpFrom - 7) / 30) : 0;
	const land = f >= jumpFrom + 7 ? Math.exp(-(f - jumpFrom - 7) / 8) : 0;
	const tail = Math.max(0, j - 0.35);
	return (
		<>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: a}}>
				<defs>
					<filter id="sp-thread" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="6" />
					</filter>
				</defs>
				<line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={`rgba(${PINK},${0.4 + 0.6 * snap})`} strokeWidth={10} filter="url(#sp-thread)" />
				<line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={`rgba(${PEARL},${0.65 + 0.35 * snap})`} strokeWidth={1.8} />
				{jumpA > 0 && j > 0 && j < 1 ? <line x1={lerp(A.x, B.x, tail)} y1={lerp(A.y, B.y, tail)} x2={jx} y2={jy} stroke="rgba(255,250,252,0.9)" strokeWidth={4} strokeLinecap="round" /> : null}
			</svg>
			<Glint x={A.x} y={A.y} r={10} a={a * (0.7 + snap)} star={0.4 + snap} />
			<Glint x={B.x} y={B.y} r={10 * (1 + land)} a={a * (0.7 + snap + land)} star={0.4 + snap + land} />
			{jumpA > 0 ? <Glint x={jx} y={jy} r={12} a={jumpA} star={0.8} /> : null}
		</>
	);
};
