import {useMemo} from 'react';
import * as THREE from 'three';
import {V3} from '../../three/stage';
import {bf, prog, rnd, smooth} from './common';

/**
 * 第 5–6 段：毁坏的世界（白金）。在枪之柱地面的背面（y < 0）：头顶是地面的背面——同一张地纹刻成金线、
 * 断柱的倒影倒挂着（pillar.tsx）；下面浮着一块块岩岛，方向各不相同（有的倒挂、有的侧立），
 * 岛上的树又高又尖、像巨藻，瀑布倒挂着、横着流；最底下是缓缓旋转的云涡。
 * 全部是金色线框 + 暗色实体（挡住后面的线），和正面世界的珍珠白线框对应。
 */

/** 毁坏的世界出现：钻过口子的那一刻 */
export const dwA = (f: number) => smooth(prog(f, bf(30, 2), bf(31, 1)));

const GOLD = new THREE.Color(1.0, 0.72, 0.34);

type Island = {p: V3; up: V3; r: number; trees: number; fall?: V3; pool?: boolean; seed: number};

/** 岩岛：p 位置、up 岛面朝向（重力的反方向）、r 半径；fall 瀑布流向（世界方向） */
export const ISLES: Island[] = [
	// 第 37 小节贴近的那块：倒挂着，树往下长，瀑布往上流
	{p: [26, -40, -10], up: [0, -1, 0], r: 4.2, trees: 7, fall: [0.15, 1, 0.1], seed: 1},
	// 第 38–39 小节：侧立的岛（横滚 90° 后像正常的地面）
	{p: [38, -44, -21], up: [-1, 0, 0.1], r: 4.6, trees: 8, fall: [0.1, -0.2, 1], seed: 2},
	// 第 40 小节：岛上一汪水，什么也钓不到
	{p: [45, -61, -25], up: [0, 1, 0], r: 5.2, trees: 3, pool: true, seed: 3},
	// 其余：远近散布，方向各异
	{p: [-12, -20, -16], up: [0, 1, 0], r: 3.6, trees: 5, fall: [1, 0.1, 0], seed: 4},
	{p: [10, -27, -32], up: [0.35, 0.88, 0.3], r: 3.2, trees: 4, seed: 5},
	{p: [-22, -38, -30], up: [0, -1, 0], r: 4.4, trees: 6, fall: [0, 1, 0.2], seed: 6},
	{p: [2, -52, -42], up: [1, 0.15, 0], r: 3.8, trees: 5, seed: 7},
	{p: [-30, -28, 8], up: [0.2, 0.95, -0.2], r: 3.0, trees: 3, seed: 8},
	{p: [-20, -66, -84], up: [0, 1, 0], r: 6.0, trees: 2, fall: [-1, 0, 0.2], seed: 9},
	{p: [26, -26, -58], up: [-0.4, -0.9, 0.1], r: 3.4, trees: 4, seed: 10},
	{p: [-38, -56, -46], up: [0.9, 0.3, 0], r: 4.0, trees: 5, seed: 11},
	{p: [18, -74, -46], up: [0, 1, 0], r: 4.8, trees: 5, fall: [0, 0, 1], seed: 12},
	{p: [-48, -40, -86], up: [0, -1, 0], r: 5.2, trees: 6, seed: 13},
	{p: [52, -38, -70], up: [0, 1, 0], r: 4.0, trees: 4, seed: 14},
	{p: [-18, -84, -20], up: [0.5, 0.8, 0.3], r: 3.6, trees: 4, seed: 15},
	// 最深处：赤日站在这块岛上（不浮动，顶面在 y = -78）
	{p: [-16, -78.3, -30], up: [0, 1, 0], r: 7, trees: 0, seed: 16},
];

const norm = (v: V3): V3 => {
	const l = Math.hypot(...v) || 1;
	return [v[0] / l, v[1] / l, v[2] / l];
};
const islandQuat = (up: V3) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...norm(up)));

/** 岛的形状（局部坐标，半径 1、顶面在 y = 0）：上面一圈参差的边，下面收成尖 */
const isleGeo = (seed: number) => {
	const N = 9;
	const top: V3[] = [];
	const mid: V3[] = [];
	for (let i = 0; i < N; i++) {
		const a = (i / N) * Math.PI * 2 + rnd(seed * 7 + i) * 0.3;
		const rr = 0.8 + 0.3 * rnd(seed * 3 + i * 1.7);
		top.push([Math.cos(a) * rr, (rnd(seed + i * 2.3) - 0.5) * 0.12, Math.sin(a) * rr]);
		mid.push([Math.cos(a + 0.2) * rr * 0.72, -0.42 - 0.15 * rnd(seed * 5 + i), Math.sin(a + 0.2) * rr * 0.72]);
	}
	const apex: V3 = [(rnd(seed * 11) - 0.5) * 0.4, -1.5 - 0.4 * rnd(seed * 13), (rnd(seed * 17) - 0.5) * 0.4];
	const c: V3 = [0, 0.04, 0];
	const pos: number[] = [];
	const tri = (a: V3, b: V3, d: V3) => pos.push(...a, ...b, ...d);
	for (let i = 0; i < N; i++) {
		const j = (i + 1) % N;
		tri(c, top[j], top[i]);
		tri(top[i], top[j], mid[i]);
		tri(top[j], mid[j], mid[i]);
		tri(mid[i], mid[j], apex);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
};

/** 树：又高又尖的巨藻，一节一节折着往上，每节两根短刺（局部坐标，岛半径 1） */
const treeGeo = (seed: number, count: number, ring = 0) => {
	const pos: number[] = [];
	const hh: number[] = [];
	for (let t = 0; t < count; t++) {
		const a = rnd(seed * 31 + t * 3.1) * Math.PI * 2;
		const rr = ring ? ring + rnd(seed * 37 + t * 5.3) * 0.15 : Math.sqrt(rnd(seed * 37 + t * 5.3)) * 0.7;
		let x = Math.cos(a) * rr;
		let z = Math.sin(a) * rr;
		let y = 0;
		const H = 1.3 + 1.3 * rnd(seed * 41 + t * 7.7);
		const segs = 7;
		for (let k = 0; k < segs; k++) {
			const nx = x + (rnd(seed + t * 11 + k * 1.3) - 0.5) * 0.25;
			const nz = z + (rnd(seed + t * 13 + k * 2.1) - 0.5) * 0.25;
			const ny = y + H / segs;
			pos.push(x, y, z, nx, ny, nz);
			hh.push(y / H, ny / H);
			// 两根短刺
			const L = 0.22 * (1 - k / segs) + 0.06;
			for (const s of k % 2 ? [-1] : [1]) {
				const sa = a + s * 1.6 + rnd(seed + k * 3 + t) * 0.6;
				pos.push(nx, ny, nz, nx + Math.cos(sa) * L, ny + L * 0.55, nz + Math.sin(sa) * L);
				hh.push(ny / H, ny / H);
			}
			x = nx;
			y = ny;
			z = nz;
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
	return g;
};

const LINE_VERT = /* glsl */ `
	attribute float aH;
	uniform float uT;
	varying float vD; varying float vH;
	void main() {
		vec3 p = position;
		// 树梢慢慢摆动（越高摆得越多）
		p.x += sin(uT * 0.03 + p.y * 1.3 + p.z) * 0.12 * aH * aH;
		p.z += cos(uT * 0.027 + p.y * 1.1 + p.x) * 0.12 * aH * aH;
		vH = aH;
		vec4 mv = modelViewMatrix * vec4(p, 1.0);
		vD = -mv.z;
		gl_Position = projectionMatrix * mv;
	}`;
const LINE_FRAG = /* glsl */ `
	uniform float uA; uniform vec3 uCol;
	varying float vD; varying float vH;
	void main() {
		float fog = exp(-max(vD - 20.0, 0.0) * 0.012);
		gl_FragColor = vec4(uCol * (0.45 + 0.55 * fog) * uA * (0.55 + 0.45 * vH), 1.0);
	}`;

/** 瀑布：一道道短线沿流向不停地淌（世界坐标里的方向，和岛的重力无关） */
const fallGeo = (seed: number) => {
	const n = 140;
	const pos: number[] = [];
	const k: number[] = [];
	const ph: number[] = [];
	const off: number[] = [];
	for (let i = 0; i < n; i++) {
		const p = rnd(seed * 3 + i * 1.7);
		const o = [(rnd(seed * 5 + i * 2.3) - 0.5) * 2.6, (rnd(seed * 7 + i * 3.1) - 0.5) * 0.8];
		for (const e of [0, 1]) {
			pos.push(0, 0, 0);
			k.push(e);
			ph.push(p);
			off.push(...o);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aE', new THREE.Float32BufferAttribute(k, 1));
	g.setAttribute('aP', new THREE.Float32BufferAttribute(ph, 1));
	g.setAttribute('aO', new THREE.Float32BufferAttribute(off, 2));
	return g;
};

const Isle: React.FC<{it: Island; f: number; mats: Mats}> = ({it, f, mats}) => {
	const geos = useMemo(() => {
		const body = isleGeo(it.seed);
		return {body, edges: new THREE.EdgesGeometry(body, 1), trees: treeGeo(it.seed, it.trees, it.pool ? 0.7 : 0), fall: it.fall ? fallGeo(it.seed) : null};
	}, [it]);
	const q = useMemo(() => islandQuat(it.up), [it]);
	const bob = it.seed === 16 ? 0 : Math.sin(f * 0.02 + it.seed) * 0.35;
	const p: V3 = [it.p[0], it.p[1] + bob, it.p[2]];
	// 瀑布：从岛边缘出发
	const fall = it.fall ? norm(it.fall) : null;
	const fallStart = useMemo(() => {
		const v = new THREE.Vector3(it.r * 0.85, 0.02, 0).applyQuaternion(q);
		return v;
	}, [it, q]);
	return (
		<>
			<group position={p} quaternion={q} scale={[it.r, it.r, it.r]}>
				<mesh geometry={geos.body} material={mats.occ} />
				<lineSegments geometry={geos.edges} material={mats.edge} />
				<lineSegments geometry={geos.trees} material={mats.tree} />
				{it.pool ? (
					<mesh material={mats.pool} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
						<circleGeometry args={[0.62, 48]} />
					</mesh>
				) : null}
			</group>
			{fall && geos.fall ? (
				<lineSegments
					geometry={geos.fall}
					material={mats.fall}
					position={[p[0] + fallStart.x, p[1] + fallStart.y, p[2] + fallStart.z]}
					quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...fall))}
					frustumCulled={false}
				/>
			) : null}
		</>
	);
};

type Mats = {occ: THREE.Material; edge: THREE.ShaderMaterial; tree: THREE.ShaderMaterial; fall: THREE.ShaderMaterial; pool: THREE.ShaderMaterial};

export const DistortionWorld: React.FC<{f: number}> = ({f}) => {
	const mats = useMemo<Mats>(() => {
		const mk = (col: THREE.Color) =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uA: {value: 0}, uT: {value: 0}, uCol: {value: col}},
				vertexShader: LINE_VERT,
				fragmentShader: LINE_FRAG,
			});
		const edge = mk(GOLD.clone().multiplyScalar(0.95));
		// 岛的边没有 aH 属性：着色器里当作 0，用一个常数补亮
		edge.vertexShader = LINE_VERT.replace('attribute float aH;', 'const float aH = 1.0;');
		const tree = mk(new THREE.Color(0.75, 0.48, 0.24));
		const fall = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			uniforms: {uA: {value: 0}, uT: {value: 0}, uL: {value: 18}},
			vertexShader: /* glsl */ `
				attribute float aE; attribute float aP; attribute vec2 aO;
				uniform float uT; uniform float uL;
				varying float vS;
				void main() {
					float s = fract(aP + uT * 0.012);
					vS = s;
					vec3 p = vec3(aO.x, (s * uL) + aE * 0.9, aO.y);
					gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
				}`,
			fragmentShader: /* glsl */ `
				uniform float uA; varying float vS;
				void main() { gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * uA * sin(vS * 3.14159) * 0.55, 1.0); }`,
		});
		const pool = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			uniforms: {uA: {value: 0}, uT: {value: 0}},
			vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */ `
				uniform float uA; uniform float uT; varying vec2 vP;
				void main() {
					float r = length(vP) / 0.62;
					float ring = 0.0;
					for (int i = 0; i < 3; i++) {
						float rr = fract(uT * 0.006 + float(i) / 3.0);
						float aa = fwidth(r) * 1.5;
						ring += (1.0 - smoothstep(0.0, aa + 0.01, abs(r - rr))) * (1.0 - rr);
					}
					float rim = 1.0 - smoothstep(0.0, fwidth(r) * 1.5 + 0.01, abs(r - 0.98));
					vec3 c = vec3(0.04, 0.035, 0.06) + vec3(1.0, 0.82, 0.55) * (ring * 0.6 + rim * 0.7);
					gl_FragColor = vec4(c * uA * smoothstep(1.0, 0.95, r), 1.0);
				}`,
		});
		return {occ: new THREE.MeshBasicMaterial({color: '#0b0811'}), edge, tree, fall, pool};
	}, []);
	const a = dwA(f);
	if (a <= 0) return null;
	for (const m of [mats.edge, mats.tree, mats.fall, mats.pool]) {
		m.uniforms.uA.value = a;
		m.uniforms.uT.value = f;
	}
	return (
		<>
			{ISLES.map((it) => (
				<Isle key={it.seed} it={it} f={f} mats={mats} />
			))}
			<Vortex f={f} a={a} />
			<Dust f={f} a={a} />
		</>
	);
};

/** 最底下的云涡：缓缓旋转的空间云 */
const Vortex: React.FC<{f: number; a: number}> = ({f, a}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				uniforms: {uA: {value: 0}, uT: {value: 0}},
				vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uT; varying vec2 vP;
					float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
					float n2(vec2 x) { vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
					float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
					void main() {
						float r = length(vP) / 300.0;
						float ang = atan(vP.y, vP.x);
						// 旋臂：角度随半径扭转，整体慢慢转
						// 角度只经由 cos / sin 进入，绕一圈不会在负 x 轴上断开
						float sw = 2.0 * ang + log(r + 0.02) * 2.6 - uT * 0.0025;
						float arms = fbm(vec2(cos(sw), sin(sw)) * 1.6 + vec2(r * 7.0, r * 3.0));
						float cloud = smoothstep(0.35, 0.85, arms + 0.25 * fbm(vP * 0.03 + uT * 0.002));
						vec3 c = mix(vec3(0.06, 0.045, 0.08), vec3(0.2, 0.15, 0.2), cloud);
						c += vec3(1.0, 0.7, 0.35) * pow(cloud, 3.0) * 0.18 * (1.0 - r);
						c += vec3(0.9, 0.65, 0.4) * exp(-r * 9.0) * 0.25;
						float edge = smoothstep(1.0, 0.55, r);
						gl_FragColor = vec4(c, uA * edge);
					}`,
			}),
		[],
	);
	mat.uniforms.uA.value = a;
	mat.uniforms.uT.value = f;
	return (
		<mesh material={mat} position={[10, -150, -30]} rotation={[-Math.PI / 2, 0, 0]}>
			<planeGeometry args={[620, 620]} />
		</mesh>
	);
};

/** 浮尘：一点点金色的光尘，给远近一点层次 */
const DUST_N = 900;
const Dust: React.FC<{f: number; a: number}> = ({f, a}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const p = new Float32Array(DUST_N * 3);
		const s = new Float32Array(DUST_N);
		for (let i = 0; i < DUST_N; i++) {
			p.set([(rnd(i * 1.3) - 0.5) * 160, -4 - rnd(i * 2.9) * 100, (rnd(i * 4.1) - 0.5) * 160 - 20], i * 3);
			s[i] = rnd(i * 5.7);
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
				uniforms: {uA: {value: 0}, uT: {value: 0}},
				vertexShader: /* glsl */ `
					attribute float aS; uniform float uT; varying float vB;
					void main() {
						vec3 p = position;
						p.y += sin(uT * 0.01 + aS * 30.0) * 1.5;
						p.x += cos(uT * 0.008 + aS * 20.0) * 1.5;
						vec4 mv = modelViewMatrix * vec4(p, 1.0);
						vB = (0.3 + 0.7 * aS) * smoothstep(2.0, 8.0, -mv.z);
						gl_PointSize = clamp((1.0 + 2.0 * aS) * 40.0 / -mv.z, 1.0, 5.0);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying float vB;
					void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * smoothstep(0.5, 0.0, d) * vB * uA * 0.6, 1.0); }`,
			}),
		[],
	);
	mat.uniforms.uA.value = a;
	mat.uniforms.uT.value = f;
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

/** 毁坏的世界的天色：灰紫，越往下越暖（画在一个包住镜头的大球内侧） */
export const DwSky: React.FC<{f: number}> = ({f}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				side: THREE.BackSide,
				uniforms: {uA: {value: 0}},
				vertexShader: /* glsl */ `varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec3 vD;
					void main() {
						float y = vD.y;
						vec3 c = mix(vec3(0.075, 0.058, 0.09), vec3(0.03, 0.022, 0.035), smoothstep(-0.1, 0.8, y));
						c = mix(c, vec3(0.1, 0.07, 0.08), smoothstep(-0.2, -0.9, y));
						gl_FragColor = vec4(c, uA);
					}`,
			}),
		[],
	);
	const a = dwA(f);
	if (a <= 0) return null;
	mat.uniforms.uA.value = a;
	return (
		<mesh material={mat} renderOrder={-10} position={[0, -40, 0]}>
			<sphereGeometry args={[1400, 32, 16]} />
		</mesh>
	);
};
