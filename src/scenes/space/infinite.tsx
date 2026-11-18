import {useMemo} from 'react';
import * as THREE from 'three';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, easeOutCubic, env, lerp, prog, rnd, smooth, track} from './common';
import {PEARL, PINK, SHRINK_C} from './hook';

/**
 * 第 3 段「长宽高与无边无际」：
 * 一个点 → 拉成线（长）→ 扫成面（宽）→ 立成立方体（高）→ 沿三个方向复制成晶格（参考 React Bits 的 Cubes）
 * → 第 16 小节晶格外层的玻璃墙炸开，星海涌进来（Galaxy / Particles）→ 第 17 小节第 3 拍地面消散
 * → 第 19 小节第 3 拍起尺度飞行：你 → 地球（光一秒绕七圈半）→ 太阳 → 银河系（光要跑十万年）。
 */

// ════════ 点 → 线 → 面 → 体 ════════

/** 立方体边长与晶格中心；第一个立方体占 x、z ±E/2，y 从地面上方 4.4 到 6.6 */
const E = 2.2;
export const LAT_C: V3 = [0, 5.5, -76.7];
const X0 = -E / 2;
const X1 = E / 2;
const Y0 = LAT_C[1] - E / 2;
const ZF = LAT_C[2] + E / 2;
const ZB = LAT_C[2] - E / 2;
/** 点出现的位置：立方体前下边的中点 */
const POINT_AT: V3 = [0, Y0, ZF];

const LINE_AT = bf(14);
const PLANE_AT = bf(14, 2);
const RISE_AT = bf(15);
export const BURST_AT = bf(16);

/** 晶格往外长了几圈（0 = 只有一个立方体，3 = 7×7×7） */
const shellAt = (f: number) => track(f, [[bf(15, 1) - 3, 0], [bf(15, 1) + 6, 1], [bf(15, 2) - 2, 1], [bf(15, 2) + 6, 2], [bf(15, 3) - 2, 2], [bf(15, 3) + 6, 3]]);
/** 晶格线条整体亮度：炸开后迅速散去 */
const latticeOn = (f: number) => env(f, bf(15, 1) - 4, BURST_AT + 10, 4, 10);

/** 一个点（第 13 小节第 3 拍起）：从缩成的那一点移到立方体前下边 */
export const pointAt = (f: number): {p: V3; a: number} => {
	const m = smooth(prog(f, bf(13, 2), LINE_AT));
	const p: V3 = [lerp(SHRINK_C[0], POINT_AT[0], m), lerp(SHRINK_C[1], POINT_AT[1], m), lerp(SHRINK_C[2], POINT_AT[2], m)];
	return {p, a: env(f, bf(13, 1), LINE_AT + 6, 8, 6)};
};

const P = (c: Cam, p: V3) => project(c, p);

/** 正在长出来的第一个立方体（2D 发光线，按 3D 投影画） */
export const BuildCube: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const on = env(f, LINE_AT - 1, BURST_AT + 8, 2, 8);
	if (on <= 0) return null;
	const a = easeOutCubic(prog(f, LINE_AT, LINE_AT + 12));
	const b = easeOutCubic(prog(f, PLANE_AT, PLANE_AT + 14));
	const h = easeOutCubic(prog(f, RISE_AT, RISE_AT + 14));
	const xl = X0 * a;
	const xr = X1 * a;
	const zb = lerp(ZF, ZB, b);
	const yt = lerp(Y0, Y0 + E, h);
	const lines: [V3, V3][] = [[[xl, Y0, ZF], [xr, Y0, ZF]]];
	const faces: V3[][] = [];
	if (b > 0) {
		lines.push([[xl, Y0, zb], [xr, Y0, zb]], [[xl, Y0, ZF], [xl, Y0, zb]], [[xr, Y0, ZF], [xr, Y0, zb]]);
		faces.push([[xl, Y0, ZF], [xr, Y0, ZF], [xr, Y0, zb], [xl, Y0, zb]]);
	}
	if (h > 0) {
		const top: V3[] = [[xl, yt, ZF], [xr, yt, ZF], [xr, yt, zb], [xl, yt, zb]];
		const bot: V3[] = [[xl, Y0, ZF], [xr, Y0, ZF], [xr, Y0, zb], [xl, Y0, zb]];
		for (let i = 0; i < 4; i++) {
			lines.push([top[i], top[(i + 1) % 4]], [bot[i], top[i]]);
			faces.push([bot[i], bot[(i + 1) % 4], top[(i + 1) % 4], top[i]]);
		}
		faces.push(top);
	}
	const pulse = Math.max(Math.exp(-Math.max(0, f - LINE_AT) / 8), Math.exp(-Math.abs(f - PLANE_AT) / 8), Math.exp(-Math.abs(f - RISE_AT) / 8)) * (f >= LINE_AT ? 1 : 0);
	const sw = 2.4 + 2 * pulse;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: on}}>
			<defs>
				<filter id="sp-cube-glow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="7" />
				</filter>
			</defs>
			{faces.map((fc, i) => (
				<polygon key={i} points={fc.map((p) => `${P(c, p).x},${P(c, p).y}`).join(' ')} fill={`rgba(${PINK},${0.07 + 0.05 * pulse})`} />
			))}
			<g filter="url(#sp-cube-glow)">
				{lines.map(([p, q], i) => {
					const A = P(c, p);
					const B = P(c, q);
					return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={`rgba(${PINK},0.9)`} strokeWidth={sw * 4} strokeLinecap="round" />;
				})}
			</g>
			{lines.map(([p, q], i) => {
				const A = P(c, p);
				const B = P(c, q);
				return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={`rgb(${PEARL})`} strokeWidth={sw} strokeLinecap="round" />;
			})}
		</svg>
	);
};

/** 长 / 宽 / 高 的标注 */
export const DimLabels: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const items: [string, string, V3, number, number][] = [
		['长', 'LENGTH', [0, Y0 - 0.55, ZF], LINE_AT + 4, 0],
		['宽', 'WIDTH', [X1 + 0.5, Y0 - 0.2, (ZF + ZB) / 2], PLANE_AT + 6, 0],
		['高', 'HEIGHT', [X1 + 0.55, Y0 + E / 2, ZF], RISE_AT + 6, 0],
	];
	const out = env(f, LINE_AT, bf(15, 2), 1, 14);
	if (out <= 0) return null;
	return (
		<>
			{items.map(([zh, en, p, at]) => {
				const a = smooth(prog(f, at, at + 10)) * out;
				if (a <= 0) return null;
				const s = P(c, p);
				return (
					<div key={zh} style={{position: 'absolute', left: s.x - 120, top: s.y - 10, width: 240, textAlign: 'center', opacity: a, textShadow: `0 0 14px rgba(${PINK},0.8), 0 0 4px rgba(0,0,0,0.9)`}}>
						<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 40, color: '#fff3fa', letterSpacing: 4}}>{zh}</div>
						<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 15, letterSpacing: 6, color: 'rgba(255,228,244,0.8)', marginTop: 2}}>{en}</div>
					</div>
				);
			})}
		</>
	);
};

// ════════ 晶格（3D 线框） ════════

const R = 3;

export const Lattice: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const pos: number[] = [];
		const shell: number[] = [];
		for (let i = -R; i <= R; i++)
			for (let j = -R; j <= R; j++)
				for (let k = -R; k <= R; k++) {
					const sh = Math.max(Math.abs(i), Math.abs(j), Math.abs(k));
					if (sh === 0) continue;
					const x0 = LAT_C[0] + (i - 0.5) * E;
					const y0 = LAT_C[1] + (j - 0.5) * E;
					const z0 = LAT_C[2] + (k - 0.5) * E;
					const v = (a: number, b: number, cc: number): V3 => [x0 + a * E, y0 + b * E, z0 + cc * E];
					const edges: [V3, V3][] = [];
					for (const b of [0, 1])
						for (const cc of [0, 1]) {
							edges.push([v(0, b, cc), v(1, b, cc)], [v(b, 0, cc), v(b, 1, cc)], [v(b, cc, 0), v(b, cc, 1)]);
						}
					for (const [p, q] of edges) {
						pos.push(...p, ...q);
						shell.push(sh, sh);
					}
				}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('aShell', new THREE.Float32BufferAttribute(shell, 1));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uR: {value: 0}, uA: {value: 0}},
				vertexShader: /* glsl */ `
					attribute float aShell;
					uniform float uR;
					varying float vA;
					varying float vD;
					void main() {
						float vis = clamp(uR - aShell + 1.0, 0.0, 1.0);
						// 刚长出来的一圈亮一下
						float fresh = exp(-pow((uR - aShell) * 2.2, 2.0));
						vA = vis * (0.55 + 0.9 * fresh);
						vec4 mv = modelViewMatrix * vec4(position, 1.0);
						vD = -mv.z;
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA;
					varying float vA;
					varying float vD;
					void main() {
						float fog = exp(-max(vD - 12.0, 0.0) * 0.03);
						gl_FragColor = vec4(vec3(1.0, 0.8, 0.93) * vA * uA * (0.35 + 0.65 * fog), 1.0);
					}`,
			}),
		[],
	);
	const on = latticeOn(f);
	if (on <= 0) return null;
	mat.uniforms.uR.value = shellAt(f);
	mat.uniforms.uA.value = on;
	return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
};

// ════════ 外层的玻璃墙：第 16 小节炸开 ════════

const WALL_D = (R + 0.5) * E;

export const Shards: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const pos: number[] = [];
		const ctr: number[] = [];
		const nrm: number[] = [];
		const rd: number[] = [];
		// 五面墙（地面那一面不算）：每面切成 7×7 个抖动过的格子、每格两个三角
		const faces: {o: V3; u: V3; v: V3; n: V3}[] = [
			{o: [-WALL_D, -WALL_D, WALL_D], u: [2 * WALL_D, 0, 0], v: [0, 2 * WALL_D, 0], n: [0, 0, 1]},
			{o: [-WALL_D, -WALL_D, -WALL_D], u: [2 * WALL_D, 0, 0], v: [0, 2 * WALL_D, 0], n: [0, 0, -1]},
			{o: [-WALL_D, -WALL_D, -WALL_D], u: [0, 0, 2 * WALL_D], v: [0, 2 * WALL_D, 0], n: [-1, 0, 0]},
			{o: [WALL_D, -WALL_D, -WALL_D], u: [0, 0, 2 * WALL_D], v: [0, 2 * WALL_D, 0], n: [1, 0, 0]},
			{o: [-WALL_D, WALL_D, -WALL_D], u: [2 * WALL_D, 0, 0], v: [0, 0, 2 * WALL_D], n: [0, 1, 0]},
		];
		const N = 7;
		let seed = 0;
		faces.forEach((fc, fi) => {
			const jit = (i: number, j: number): V3 => {
				const edge = i === 0 || j === 0 || i === N || j === N;
				const ju = edge ? 0 : (rnd(fi * 97 + i * 13 + j * 7) - 0.5) * 0.7;
				const jv = edge ? 0 : (rnd(fi * 53 + i * 5 + j * 17 + 3) - 0.5) * 0.7;
				const s = (i + ju) / N;
				const t = (j + jv) / N;
				return [LAT_C[0] + fc.o[0] + fc.u[0] * s + fc.v[0] * t, LAT_C[1] + fc.o[1] + fc.u[1] * s + fc.v[1] * t, LAT_C[2] + fc.o[2] + fc.u[2] * s + fc.v[2] * t];
			};
			for (let i = 0; i < N; i++)
				for (let j = 0; j < N; j++) {
					const a = jit(i, j);
					const b = jit(i + 1, j);
					const cc = jit(i + 1, j + 1);
					const d = jit(i, j + 1);
					for (const tri of [
						[a, b, cc],
						[a, cc, d],
					]) {
						const m: V3 = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3, (tri[0][2] + tri[1][2] + tri[2][2]) / 3];
						const r = [rnd(seed * 1.3 + 1), rnd(seed * 2.1 + 2), rnd(seed * 3.7 + 3), rnd(seed * 4.9 + 4)];
						seed++;
						for (const p of tri) {
							pos.push(...p);
							ctr.push(...m);
							nrm.push(...fc.n);
							rd.push(...r);
						}
					}
				}
		});
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('aCtr', new THREE.Float32BufferAttribute(ctr, 3));
		g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 3));
		g.setAttribute('aR', new THREE.Float32BufferAttribute(rd, 4));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				blending: THREE.AdditiveBlending,
				uniforms: {uT: {value: 0}, uA: {value: 0}, uC: {value: new THREE.Vector3(...LAT_C)}},
				vertexShader: /* glsl */ `
					attribute vec3 aCtr;
					attribute vec3 aN;
					attribute vec4 aR;
					uniform float uT;
					uniform vec3 uC;
					varying float vEdge;
					varying vec3 vW;
					varying vec3 vNw;
					varying float vR;
					vec3 rot(vec3 p, vec3 ax, float a) { return p * cos(a) + cross(ax, p) * sin(a) + ax * dot(ax, p) * (1.0 - cos(a)); }
					void main() {
						vec3 local = position - aCtr;
						float t = uT;
						vec3 out_ = normalize(aCtr - uC + aN * 3.0);
						vec3 vel = out_ * (0.5 + 0.9 * aR.x) + aN * 0.3;
						vec3 ax = normalize(aR.yzw - 0.5 + 1e-3);
						float ang = t * (0.05 + 0.12 * aR.y);
						vec3 p = aCtr + vel * t * (1.0 - exp(-t / 28.0)) * 1.4 + rot(local, ax, ang);
						vW = p;
						vNw = rot(aN, ax, ang);
						vR = aR.x;
						vEdge = 0.0;
						gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA;
					uniform float uT;
					varying vec3 vW;
					varying vec3 vNw;
					varying float vR;
					void main() {
						vec3 v = normalize(cameraPosition - vW);
						float fres = pow(1.0 - abs(dot(v, normalize(vNw))), 2.5);
						vec3 tint = mix(vec3(0.85, 0.8, 1.0), vec3(1.0, 0.7, 0.88), vR);
						float flash = uT > 0.0 ? exp(-uT / 6.0) * 1.5 : 0.0;
						gl_FragColor = vec4(tint * (0.03 + 0.4 * fres + flash * 0.25) * uA, 1.0);
					}`,
			}),
		[],
	);
	const a = env(f, bf(15, 3), BURST_AT + 45, 10, 30);
	if (a <= 0) return null;
	mat.uniforms.uT.value = Math.max(0, f - BURST_AT);
	mat.uniforms.uA.value = a;
	return <mesh geometry={geo} material={mat} frustumCulled={false} />;
};

/** 炸开那一下的闪光（2D） */
export const BurstFlash: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const t = f - BURST_AT;
	if (t < -2 || t > 30) return null;
	const a = Math.exp(-Math.max(0, t) / 6) * smooth(prog(t, -2, 0));
	const s = P(c, LAT_C);
	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				mixBlendMode: 'screen',
				background: `radial-gradient(circle at ${s.x}px ${s.y}px, rgba(255,240,248,${0.75 * a}) 0%, rgba(${PINK},${0.4 * a}) 22%, rgba(120,110,255,${0.12 * a}) 50%, rgba(0,0,0,0) 80%)`,
			}}
		/>
	);
};

/** 地面消散：第 17 小节第 3 拍起（"隔开世界的墙消失了"） */
export const floorDissolveAt = (f: number) => smooth(prog(f, bf(17, 2), bf(18, 2)));

/** 远处隐约的帕路奇亚剪影（第 16–18 小节） */
const FAR_PALKIA: V3 = [0, 20, -270];
export const FarPalkia: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const o = env(f, BURST_AT + 8, bf(19), 40, 30) * 0.6;
	if (o <= 0) return null;
	const pr = P(c, FAR_PALKIA);
	if (pr.depth <= 0) return null;
	const size = pxOf(c, pr.depth, 90);
	return (
		<PokemonArt3D
			dir="pokemon/palkia"
			x={pr.x}
			y={pr.y}
			size={size}
			yaw={Math.sin((f - BURST_AT) * 0.02) * 2}
			depthScale={0.5}
			ambient={[0.09, 0.075, 0.12]}
			rim={{dir: [0.7, -0.6], color: [1.4, 0.85, 1.2], power: 2.2}}
			emissive={0.3}
			emissiveTint={[1.5, 0.8, 1.2]}
			emissiveKey={[0.55, 1, 0.12, 0.7]}
			opacity={o}
			resolution={Math.min(1.2, 2600 / Math.max(1, size * 1.12))}
		/>
	);
};

// ════════ 尺度飞行（第 19–22 小节） ════════

/** 舞台挂在镜头前 D 处，与镜头同向；舞台单位：视野高 10^Z 米对应画面高 U */
const D = 14;
const U = 2 * D * Math.tan((40 * Math.PI) / 360);
const R_EARTH = 6.371e6;
const AU = 1.496e11;
const R_SUN = 6.96e8;
const GAL_R = 4.73e20;
const SUN_FROM_CENTER = 2.46e20;
/** 舞台坐标（米，x 右、y 上、z 朝镜头），原点是"你" */
const EARTH_C: V3 = [0, -R_EARTH - 0.85, 0];
const SUN_C: V3 = [EARTH_C[0] - AU, EARTH_C[1], 0];
const GAL_C: V3 = [SUN_C[0] + SUN_FROM_CENTER, SUN_C[1], 0];

export const SCALE_FROM = bf(18, 3);
export const SCALE_TO = bf(22, 3);
/** 地球上的光绕七圈半：从第 20 小节第 3 拍起整整 1 秒（30 帧） */
export const ORBIT_AT = bf(20, 2);
/** 光横穿银河：银河第 21 小节第 3 拍到位后起，第 22 小节第 3 拍（第 19 句结束）正好跑完 */
export const CROSS_AT = bf(21, 2) + 6;
export const CROSS_TO = bf(22, 2);

/**
 * 视野高度的数量级（log10 米）。三站停稳、站与站之间一拍左右快速拉远（ScaleWhoosh 给流光）：
 * 你（到第 19 小节第 4 拍）→ 地球（第 20 小节到第 21 小节，光绕七圈半）→ 一口气飞过太阳 → 银河（第 21 小节第 3 拍起，光横穿）
 */
export const zoomAt = (f: number) =>
	track(f, [
		[SCALE_FROM, 0.25],
		[bf(19, 3), 0.42],
		[bf(20), 7.4],
		[bf(21), 7.55],
		[bf(21, 2), 21.05],
		[bf(22, 2), 21.2],
		[bf(22, 3), 21.25],
		// 第 4 段：银河往里缩，缩成面团（bend.tsx）
		[bf(23, 1), 21.62],
	]);

const sstep = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));
const centerAt = (Z: number): V3 => {
	// 地球装进画面之后（视野 ≳ 10⁶ 米）才把中心移向地心，否则镜头会跑进球里
	const a = sstep(6.4, 7.3, Z);
	const b = sstep(8.6, 11.0, Z);
	const g = sstep(14.5, 20.0, Z);
	const mixv = (p: V3, q: V3, t: number): V3 => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
	return mixv(mixv(mixv([0, 0, 0], EARTH_C, a), SUN_C, b), GAL_C, g);
};

export const scaleOn = (f: number) => env(f, SCALE_FROM, SCALE_TO + 60, 14, 2);

/** 舞台坐标（米）→ 舞台局部（世界单位） */
const toLocal = (Z: number, p: V3): V3 => {
	const c = centerAt(Z);
	const k = U / Math.pow(10, Z);
	return [(p[0] - c[0]) * k, (p[1] - c[1]) * k, (p[2] - c[2]) * k];
};

const stageFrame = (c: Cam) => {
	const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...c.pos), new THREE.Vector3(...c.tgt), new THREE.Vector3(0, 1, 0));
	const q = new THREE.Quaternion().setFromRotationMatrix(m);
	const fwd = new THREE.Vector3(...c.tgt).sub(new THREE.Vector3(...c.pos)).normalize();
	const pos = new THREE.Vector3(...c.pos).add(fwd.multiplyScalar(D));
	return {q, pos};
};

/** 舞台点（米）→ 画面 */
export const stageToScreen = (c: Cam, Z: number, p: V3) => {
	const {q, pos} = stageFrame(c);
	const l = new THREE.Vector3(...toLocal(Z, p)).applyQuaternion(q).add(pos);
	return project(c, [l.x, l.y, l.z]);
};

const lineMat = (rgb: [number, number, number]) =>
	new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		uniforms: {uA: {value: 1}, uCol: {value: new THREE.Vector3(...rgb)}},
		vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: /* glsl */ `uniform float uA; uniform vec3 uCol; void main() { gl_FragColor = vec4(uCol * uA, 1.0); }`,
	});

/** 线框人形（1.7 米，脚底在 y = −0.85）：不代表任何角色 */
const humanGeo = () => {
	const pts: number[] = [];
	const seg = (a: V3, b: V3) => pts.push(...a, ...b);
	const head = 0.12;
	const hc: V3 = [0, 0.85 - head, 0];
	for (let i = 0; i < 20; i++) {
		const a0 = (i / 20) * Math.PI * 2;
		const a1 = ((i + 1) / 20) * Math.PI * 2;
		seg([hc[0] + Math.cos(a0) * head, hc[1] + Math.sin(a0) * head, 0], [hc[0] + Math.cos(a1) * head, hc[1] + Math.sin(a1) * head, 0]);
	}
	const neck: V3 = [0, 0.85 - head * 2, 0];
	const hip: V3 = [0, -0.05, 0];
	seg(neck, hip);
	seg([-0.2, 0.5, 0], [0.2, 0.5, 0]);
	seg([-0.2, 0.5, 0], [-0.27, 0.12, 0]);
	seg([-0.27, 0.12, 0], [-0.3, -0.18, 0]);
	seg([0.2, 0.5, 0], [0.27, 0.12, 0]);
	seg([0.27, 0.12, 0], [0.3, -0.18, 0]);
	seg(hip, [-0.13, -0.45, 0]);
	seg([-0.13, -0.45, 0], [-0.15, -0.85, 0]);
	seg(hip, [0.13, -0.45, 0]);
	seg([0.13, -0.45, 0], [0.15, -0.85, 0]);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
	return g;
};

/** 经纬线球（半径 1） */
const graticuleGeo = (step = 15) => {
	const pts: number[] = [];
	for (let lat = -90 + step; lat < 90; lat += step) {
		const y = Math.sin((lat * Math.PI) / 180);
		const r = Math.cos((lat * Math.PI) / 180);
		for (let i = 0; i < 64; i++) {
			const a0 = (i / 64) * Math.PI * 2;
			const a1 = ((i + 1) / 64) * Math.PI * 2;
			pts.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r);
		}
	}
	for (let lon = 0; lon < 180; lon += step) {
		const a = (lon * Math.PI) / 180;
		for (let i = 0; i < 64; i++) {
			const t0 = (i / 64) * Math.PI * 2;
			const t1 = ((i + 1) / 64) * Math.PI * 2;
			pts.push(Math.cos(a) * Math.cos(t0), Math.sin(t0), Math.sin(a) * Math.cos(t0), Math.cos(a) * Math.cos(t1), Math.sin(t1), Math.sin(a) * Math.cos(t1));
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
	return g;
};

const ringGeo = (n = 256) => {
	const pts: number[] = [];
	const ang: number[] = [];
	for (let i = 0; i < n; i++) {
		const a0 = (i / n) * Math.PI * 2;
		const a1 = ((i + 1) / n) * Math.PI * 2;
		pts.push(Math.cos(a0), 0, Math.sin(a0), Math.cos(a1), 0, Math.sin(a1));
		ang.push(a0, a1);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
	g.setAttribute('aAng', new THREE.Float32BufferAttribute(ang, 1));
	return g;
};

/** 银河：四条旋臂的粒子盘（半径 1） */
const GAL_N = 42000;
const galaxyGeo = () => {
	const pos = new Float32Array(GAL_N * 3);
	const col = new Float32Array(GAL_N * 3);
	for (let i = 0; i < GAL_N; i++) {
		const u = rnd(i * 1.37 + 0.11);
		const bulge = i < GAL_N * 0.16;
		let x: number;
		let y: number;
		let z: number;
		if (bulge) {
			const r = Math.pow(u, 1.8) * 0.2;
			const a = rnd(i * 2.9) * Math.PI * 2;
			const b = (rnd(i * 4.1) - 0.5) * Math.PI;
			x = Math.cos(a) * Math.cos(b) * r;
			z = Math.sin(a) * Math.cos(b) * r;
			y = Math.sin(b) * r * 0.55;
		} else {
			const r = 0.08 + Math.pow(u, 0.75) * 0.95;
			const arm = Math.floor(rnd(i * 3.3) * 4);
			const spread = (rnd(i * 5.7) - 0.5) * (0.5 - 0.25 * r);
			const a = arm * (Math.PI / 2) + Math.log(r + 0.05) * 2.6 + spread;
			x = Math.cos(a) * r + (rnd(i * 7.1) - 0.5) * 0.04;
			z = Math.sin(a) * r + (rnd(i * 8.3) - 0.5) * 0.04;
			y = (rnd(i * 9.7) - 0.5) * 0.025;
		}
		pos.set([x, y, z], i * 3);
		const rr = Math.hypot(x, z);
		const warm = Math.exp(-rr * 6);
		const b = 0.35 + 0.65 * rnd(i * 6.6);
		const tint = rnd(i * 2.2) < 0.5 ? [0.82, 0.78, 1] : [1, 0.74, 0.9];
		col.set([(tint[0] * (1 - warm) + 1.0 * warm) * b, (tint[1] * (1 - warm) + 0.9 * warm) * b, (tint[2] * (1 - warm) + 0.85 * warm) * b], i * 3);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	return g;
};

/** 银河盘倾斜：绕 x 轴转约 62°，让它在画面里呈一个椭圆 */
const GAL_TILT = new THREE.Euler(0.52, 0, -0.18);
const EARTH_TILT = new THREE.Euler(0.42, 0, 0.2);
const ORBIT_TILT = new THREE.Euler(0.38, 0, 0);

export const ScaleStage: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const geos = useMemo(() => ({human: humanGeo(), grat: graticuleGeo(), ring: ringGeo(), gal: galaxyGeo()}), []);
	const mats = useMemo(() => {
		const ringMat = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			uniforms: {uA: {value: 1}, uHead: {value: 0}, uTrail: {value: 1}, uCol: {value: new THREE.Vector3(1, 0.85, 0.95)}},
			vertexShader: /* glsl */ `
				attribute float aAng;
				varying float vAng;
				void main() { vAng = aAng; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */ `
				uniform float uA; uniform float uHead; uniform float uTrail; uniform vec3 uCol;
				varying float vAng;
				void main() {
					float d = mod(uHead - vAng, 6.2831853);
					float a = uTrail > 0.0 ? exp(-d / uTrail) : 1.0;
					gl_FragColor = vec4(uCol * a * uA, 1.0);
				}`,
		});
		return {
			human: lineMat([1, 0.85, 0.95]),
			grat: lineMat([0.55, 0.7, 1.0]),
			occ: new THREE.MeshBasicMaterial({color: '#05040a'}),
			// 大气：只画背面、只在球的轮廓外发光；地球大过画面时不会铺满一层灰蓝
			atmo: new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				side: THREE.BackSide,
				blending: THREE.AdditiveBlending,
				uniforms: {uA: {value: 1}},
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV;
					void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec3 vN; varying vec3 vV;
					void main() { float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.45, 0.62, 1.0) * f * 1.6 * uA, 1.0); }`,
			}),
			orbit: ringMat,
			earthOrbit: ringMat.clone(),
			sun: new THREE.ShaderMaterial({
				uniforms: {uA: {value: 1}},
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV;
					void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec3 vN; varying vec3 vV;
					void main() { float mu = max(dot(vN, vV), 0.0); vec3 c = vec3(1.0, 0.93, 0.86) * (0.55 + 0.45 * pow(mu, 0.5)); gl_FragColor = vec4(c * uA, 1.0); }`,
			}),
			gal: new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexColors: true,
				uniforms: {uA: {value: 1}, uPx: {value: 1}},
				vertexShader: /* glsl */ `
					uniform float uPx;
					varying vec3 vC;
					void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(uPx, 1.0, 3.2); gl_Position = projectionMatrix * mv; }`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec3 vC;
					void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vC * a * uA * 0.55, 1.0); }`,
			}),
		};
	}, []);
	const on = scaleOn(f);
	if (on <= 0) return null;
	const Z = zoomAt(f);
	const k = U / Math.pow(10, Z);
	const {q, pos} = stageFrame(c);
	// 每样东西按画面里的大小渐显渐隐
	const pxPerUnit = 1080 / U;
	const vis = (sizeM: number, minPx: number, maxPx: number) => {
		const px = sizeM * k * pxPerUnit;
		return sstep(minPx * 0.5, minPx, px) * (1 - sstep(maxPx, maxPx * 2.5, px));
	};
	const hA = vis(1.7, 6, 1600) * on * smooth(prog(f, SCALE_FROM, SCALE_FROM + 20));
	// 地球大过画面时也留着（脚下一道弧形的地平线），接住人形缩没之后的那几帧
	// （视野小于约 100 米时不画：球太大，float 精度会让地平线抖）
	const eA = vis(2 * R_EARTH, 3, 1e12) * sstep(1.7, 2.5, Z) * on;
	const sA = vis(2 * AU, 30, 6000) * on;
	const gA = vis(2 * GAL_R, 40, 9000) * on;
	mats.human.uniforms.uA.value = hA;
	mats.grat.uniforms.uA.value = eA * 0.55;
	// 镜头贴着地面时在大气层里面，背面会把整片天空染蓝：地球装进画面后才画大气
	mats.atmo.uniforms.uA.value = eA * (1 - sstep(2500, 6000, 2 * R_EARTH * k * pxPerUnit));
	// 光绕地球：七圈半，正好 1 秒
	const op = prog(f, ORBIT_AT, ORBIT_AT + 30);
	const orbitOn = env(f, ORBIT_AT - 6, ORBIT_AT + 40, 6, 10) * eA;
	mats.orbit.uniforms.uA.value = orbitOn;
	mats.orbit.uniforms.uHead.value = op * Math.PI * 2 * 7.5;
	mats.orbit.uniforms.uTrail.value = 1.4;
	mats.earthOrbit.uniforms.uA.value = sA * 0.5;
	mats.earthOrbit.uniforms.uTrail.value = 0;
	mats.sun.uniforms.uA.value = sA + vis(2 * R_SUN, 1, 9000) * on;
	// 缩成面团时淡出（第 22 小节第 4 拍起，只影响第 4 段）
	mats.gal.uniforms.uA.value = gA * (1 - smooth(prog(f, bf(22, 3) + 4, bf(23, 1))));
	mats.gal.uniforms.uPx.value = 1.4 + 1.6 * smooth(prog(Z, 20.6, 21.2));
	const at = (p: V3) => toLocal(Z, p);
	return (
		<group position={pos} quaternion={q}>
			{hA > 0 ? <lineSegments geometry={geos.human} material={mats.human} position={at([0, 0, 0])} scale={k} /> : null}
			{eA > 0 ? (
				<group position={at(EARTH_C)} scale={R_EARTH * k} rotation={EARTH_TILT}>
					<mesh material={mats.occ}>
						<sphereGeometry args={[0.992, 128, 96]} />
					</mesh>
					<lineSegments geometry={geos.grat} material={mats.grat} />
					<mesh material={mats.atmo}>
						<sphereGeometry args={[1.06, 48, 32]} />
					</mesh>
					{orbitOn > 0 ? <lineSegments geometry={geos.ring} material={mats.orbit} scale={1.14} /> : null}
				</group>
			) : null}
			{sA > 0 || mats.sun.uniforms.uA.value > 0 ? (
				<group position={at(SUN_C)}>
					<mesh material={mats.sun} scale={R_SUN * k}>
						<sphereGeometry args={[1, 32, 24]} />
					</mesh>
					<lineSegments geometry={geos.ring} material={mats.earthOrbit} scale={AU * k} rotation={ORBIT_TILT} />
				</group>
			) : null}
			{gA > 0 ? <points geometry={geos.gal} material={mats.gal} position={at(GAL_C)} scale={GAL_R * k} rotation={GAL_TILT} /> : null}
		</group>
	);
};

/** 光绕地球那一圈的光点（3D 舞台里的位置 → 画面） */
const orbitDot = (f: number, c: Cam, Z: number) => {
	const op = prog(f, ORBIT_AT, ORBIT_AT + 30);
	const a = op * Math.PI * 2 * 7.5;
	const local = new THREE.Vector3(Math.cos(a) * 1.14, 0, Math.sin(a) * 1.14).applyEuler(EARTH_TILT).multiplyScalar(R_EARTH);
	const p: V3 = [EARTH_C[0] + local.x, EARTH_C[1] + local.y, EARTH_C[2] + local.z];
	return {s: stageToScreen(c, Z, p), behind: local.z < -0.2 * R_EARTH};
};

const Label: React.FC<{x: number; y: number; zh: string; en: string; a: number; align?: 'left' | 'right'}> = ({x, y, zh, en, a, align = 'left'}) =>
	a > 0 ? (
		<div
			style={{
				position: 'absolute',
				left: align === 'left' ? x : x - 600,
				top: y,
				width: 600,
				textAlign: align,
				opacity: a,
				textShadow: `0 0 12px rgba(${PINK},0.6), 0 0 4px rgba(0,0,0,0.95)`,
			}}
		>
			<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 32, color: '#fff2fa', letterSpacing: 3}}>{zh}</div>
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 14, letterSpacing: 4, color: 'rgba(255,228,244,0.78)', marginTop: 4}}>{en}</div>
		</div>
	) : null;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** 尺度飞行的 2D 标注、读数与光点 */
export const ScaleOverlay: React.FC<{f: number; c: Cam; Glint: React.FC<{x: number; y: number; r: number; a: number; star: number}>}> = ({f, c, Glint}) => {
	const on = scaleOn(f);
	if (on <= 0) return null;
	const Z = zoomAt(f);
	const you = stageToScreen(c, Z, [0, 0, 0]);
	const earthTop = stageToScreen(c, Z, [EARTH_C[0] + R_EARTH * 0.75, EARTH_C[1] + R_EARTH * 0.75, 0]);
	const sun = stageToScreen(c, Z, SUN_C);
	const earthDot = stageToScreen(c, Z, EARTH_C);
	const galEdge = stageToScreen(c, Z, [GAL_C[0] + GAL_R * 0.55, GAL_C[1] + GAL_R * 0.35, 0]);
	const lYou = env(f, bf(19, 2) - 6, bf(19, 3) + 4, 8, 6);
	const lEarth = env(f, bf(20) + 2, bf(21) + 4, 8, 6);
	// 太阳不停站：飞过时只闪一下
	const lSun = Math.exp(-Math.abs(f - bf(21, 1)) / 5) * on;
	const lGal = env(f, bf(21, 2), SCALE_TO + 40, 8, 20);
	// 光绕地球
	const op = prog(f, ORBIT_AT, ORBIT_AT + 30);
	const od = orbitDot(f, c, Z);
	const orbitA = env(f, ORBIT_AT - 4, ORBIT_AT + 40, 4, 10);
	// 光横穿银河
	const cp = smooth(prog(f, CROSS_AT, CROSS_TO));
	const crossA = env(f, CROSS_AT - 4, SCALE_TO + 50, 6, 20);
	const c0 = stageToScreen(c, Z, [GAL_C[0] - GAL_R, GAL_C[1], 0]);
	const c1 = stageToScreen(c, Z, [GAL_C[0] + GAL_R, GAL_C[1], 0]);
	const cx = lerp(c0.x, c1.x, cp);
	const cy = lerp(c0.y, c1.y, cp);
	const n = Math.round(Z);
	const readA = env(f, bf(19, 1), SCALE_TO + 40, 10, 20);
	return (
		<>
			{od && orbitA > 0 && !od.behind ? <Glint x={od.s.x} y={od.s.y} r={7} a={orbitA} star={0.4} /> : null}
			{crossA > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: crossA}}>
					<line x1={c0.x} y1={c0.y} x2={cx} y2={cy} stroke={`rgba(${PEARL},0.75)`} strokeWidth={2} />
				</svg>
			) : null}
			{crossA > 0 ? <Glint x={cx} y={cy} r={9} a={crossA} star={0.5} /> : null}
			{lSun > 0 ? <Glint x={sun.x} y={sun.y} r={14} a={lSun} star={0.6} /> : null}
			{lSun > 0 ? <Glint x={earthDot.x} y={earthDot.y} r={5} a={lSun * 0.8} star={0} /> : null}
			<Label x={you.x + 120} y={you.y - 70} zh="你 · 约 1.7 米" en="YOU · ABOUT 1.7 M" a={lYou} />
			<Label x={earthTop.x + 20} y={earthTop.y - 40} zh="地球 · 直径约 1.27 万公里" en="EARTH · ABOUT 12,700 KM ACROSS" a={lEarth} />
			<Label x={galEdge.x + 10} y={galEdge.y - 60} zh="银河系 · 宽约 10 万光年" en="THE MILKY WAY · ABOUT 100,000 LIGHT-YEARS" a={lGal} />
			{orbitA > 0 ? (
				<Counter a={orbitA} big={`${(7.5 * op).toFixed(1)} 圈`} small={`${op.toFixed(2)} 秒 · ${(7.5 * op).toFixed(1)} LAPS`} />
			) : null}
			{crossA > 0 ? <Counter a={crossA} big={`${fmt(100000 * cp)} 年`} small={`LIGHT · ${fmt(100000 * cp)} YEARS`} /> : null}
			{readA > 0 ? (
				<div style={{position: 'absolute', left: 120, top: 96, opacity: readA * 0.85, fontFamily: CINZEL, color: 'rgba(255,236,246,0.9)', textShadow: '0 0 10px rgba(0,0,0,0.9)'}}>
					<div style={{fontFamily: SERIF, fontSize: 22, letterSpacing: 4}}>视野</div>
					<div style={{fontSize: 34, letterSpacing: 2, marginTop: 2}}>
						10<sup style={{fontSize: 20}}>{n}</sup> M
					</div>
				</div>
			) : null}
		</>
	);
};

/** 站与站之间拉远时的速度（每帧几个数量级） */
const flyAt = (f: number) => Math.abs(zoomAt(f + 0.5) - zoomAt(f - 0.5));

/** 快速拉远：往中心收的放射流光，到站那一拍轻闪一下 */
export const ScaleWhoosh: React.FC<{f: number}> = ({f}) => {
	const on = scaleOn(f);
	if (on <= 0) return null;
	const s = smooth(Math.min(1, flyAt(f) / 0.35)) * on;
	const arrive = Math.max(...[bf(20), bf(21, 2)].map((t) => (f >= t - 2 ? Math.exp(-Math.max(0, f - t) / 6) * smooth(prog(f, t - 2, t)) : 0)));
	if (s <= 0.01 && arrive <= 0.01) return null;
	const lines = Array.from({length: 70}, (_, i) => {
		const a = rnd(i * 2.3 + 0.4) * Math.PI * 2;
		const ph = ((f * (0.05 + 0.04 * rnd(i * 5.1)) + rnd(i * 7.9)) % 1 + 1) % 1;
		const r = 1150 * (1 - ph) + 60;
		const len = (60 + 260 * rnd(i * 3.7)) * s;
		return {x1: 960 + Math.cos(a) * r, y1: 540 + Math.sin(a) * r * 0.62, x2: 960 + Math.cos(a) * (r + len), y2: 540 + Math.sin(a) * (r + len) * 0.62, w: 1 + 2 * rnd(i * 9.3), a: s * smooth(Math.min(1, (1 - ph) * 4))};
	});
	return (
		<>
			{s > 0.01 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
					{lines.map((l, i) => (
						<line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={i % 3 ? `rgba(${PEARL},${0.55 * l.a})` : `rgba(150,180,255,${0.5 * l.a})`} strokeWidth={l.w} strokeLinecap="round" />
					))}
				</svg>
			) : null}
			{arrive > 0.01 ? <div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', background: `radial-gradient(circle at 960px 540px, rgba(255,240,250,${0.22 * arrive}) 0%, rgba(${PINK},${0.08 * arrive}) 40%, rgba(0,0,0,0) 75%)`}} /> : null}
		</>
	);
};

const Counter: React.FC<{a: number; big: string; small: string}> = ({a, big, small}) => (
	<div style={{position: 'absolute', right: 130, top: 96, textAlign: 'right', opacity: a, textShadow: `0 0 14px rgba(${PINK},0.6), 0 0 4px rgba(0,0,0,0.95)`}}>
		<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 52, color: '#fff2fa', letterSpacing: 2, fontVariantNumeric: 'tabular-nums'}}>{big}</div>
		<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 15, letterSpacing: 4, color: 'rgba(255,228,244,0.75)', marginTop: 4}}>{small}</div>
	</div>
);

