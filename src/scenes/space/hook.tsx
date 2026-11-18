import {useEffect, useMemo, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {continueRender, delayRender} from 'remotion';
import * as THREE from 'three';
import {SERIF} from '../../fonts';
import {V3} from '../../three/stage';
import {Cam, CAM0_Z, camVel, FOV0} from './cam';
import {BEAT, bf, easeOutCubic, env, prog, rnd, smooth, track} from './common';

/**
 * 第 1 段「钩子」的 3D 物体（画风 A「全息维度」）：
 * 深空天穹、地面网格、星点与流光、被亚空裂斩斩开的屏幕面板、片名针板墙。
 * 参考 React Bits 的 GridScan（地面扫描网格）、Hyperspeed（流光）、Galaxy（星海）的做法重写，
 * 时间全部由整期时间轴驱动（不用 requestAnimationFrame），随机数用固定种子。
 */

// ════════ 颜色与公共 GLSL ════════

export const PEARL = '255,226,240';
export const PINK = '255,150,200';

const NOISE3 = /* glsl */ `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) {
	vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise3(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

/** 珍珠母贝的虹彩：按角度与位置在粉、淡紫、青之间流转 */
const NACRE = /* glsl */ `
vec3 nacre(float t) {
	vec3 a = vec3(1.0, 0.78, 0.9);
	vec3 b = vec3(0.78, 0.74, 1.0);
	vec3 c = vec3(0.72, 0.95, 1.0);
	t = fract(t);
	return t < 0.333 ? mix(a, b, t * 3.0) : t < 0.666 ? mix(b, c, t * 3.0 - 1.0) : mix(c, a, t * 3.0 - 2.0);
}
`;

// ════════ 时间线 ════════

/** 裂痕：第 0 小节强拍（第 3 帧）闪出，3 帧内从右上划到左下 */
export const CRACK_AT = bf(0);
/** 裂开：第 0 小节第 3 拍，两半往后翻开 */
export const OPEN_AT = bf(0, 2);
/** 片名：第 4 小节起逐字凸出（每字隔半拍），第 5 小节起缩回 */
export const TITLE_AT = bf(4);
export const RETRACT_AT = bf(5);

export const crackDraw = (f: number) => smooth(prog(f, CRACK_AT, CRACK_AT + 3));
/** 裂痕亮度：闪出时最亮，等待时微微闪烁，裂开时再冲一下，之后留在切口上慢慢暗下去 */
export const crackGlow = (f: number) => {
	if (f < CRACK_AT) return 0;
	const flick = 0.85 + 0.15 * Math.sin(f * 2.3) * Math.sin(f * 0.71 + 1);
	const base = f < OPEN_AT ? 0.9 * flick : track(f, [[OPEN_AT, 1.6], [OPEN_AT + 14, 0.9], [OPEN_AT + 60, 0.7]]);
	return base + 1.2 * Math.exp(-(f - CRACK_AT) / 3);
};

// ════════ 天穹 ════════

export const SkyDome: React.FC<{f: number; cam: Cam}> = ({f, cam}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				side: THREE.BackSide,
				depthWrite: false,
				uniforms: {uTime: {value: 0}},
				vertexShader: /* glsl */ `
					varying vec3 vDir;
					void main() {
						vDir = normalize(position);
						vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
						gl_Position = p.xyww;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uTime;
					varying vec3 vDir;
					${NOISE3}
					vec3 starLayer(vec3 d, float scale, float density, float seed) {
						vec3 p = d * scale + seed;
						vec3 c = floor(p);
						vec3 r = fract(p) - 0.5;
						float h = hash3(c + seed);
						if (h < 1.0 - density) return vec3(0.0);
						vec3 o = vec3(hash3(c + 3.1), hash3(c + 7.7), hash3(c + 1.3)) - 0.5;
						float dd = length(r - o * 0.55);
						float k = (h - (1.0 - density)) / density;
						float tw = 0.7 + 0.3 * sin(uTime * (0.03 + 0.05 * k) + h * 60.0);
						vec3 tint = mix(vec3(0.85, 0.88, 1.0), vec3(1.0, 0.86, 0.94), hash3(c + 9.9));
						return tint * smoothstep(0.16, 0.0, dd) * (0.35 + 0.65 * k) * tw;
					}
					void main() {
						vec3 d = normalize(vDir);
						float h = d.y;
						vec3 col = mix(vec3(0.010, 0.008, 0.020), vec3(0.016, 0.012, 0.030), smoothstep(-0.3, 0.6, h));
						// 地平线一圈极淡的珍珠紫
						col += vec3(0.05, 0.034, 0.07) * exp(-abs(h + 0.01) * 14.0);
						// 星云：珍珠粉与钴蓝两层
						float n = fbm3(d * 2.4 + vec3(0.0, 0.0, uTime * 0.0006));
						float n2 = fbm3(d * 4.0 + 31.0);
						col += vec3(0.07, 0.035, 0.075) * smoothstep(0.52, 0.86, n) * 0.85;
						col += vec3(0.02, 0.035, 0.08) * smoothstep(0.55, 0.9, n2) * 0.6;
						col += starLayer(d, 150.0, 0.012, 0.0) * 0.9;
						col += starLayer(d, 260.0, 0.02, 41.0) * 0.45;
						gl_FragColor = vec4(col, 1.0);
					}`,
			}),
		[],
	);
	mat.uniforms.uTime.value = f;
	return (
		<mesh material={mat} position={cam.pos} renderOrder={-10} frustumCulled={false}>
			<sphereGeometry args={[900, 48, 32]} />
		</mesh>
	);
};

// ════════ 地面网格（GridScan 的思路：远处渐隐，一道扫描光沿 −z 推进） ════════

export const FLOOR_Y = -2.2;

export const Floor: React.FC<{f: number; cam: Cam; on: number; dissolve?: number}> = ({f, cam, on, dissolve = 0}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uCam: {value: new THREE.Vector3()}, uScan: {value: 0}, uOn: {value: 0}, uDis: {value: 0}},
				vertexShader: /* glsl */ `
					varying vec3 vW;
					void main() {
						vec4 w = modelMatrix * vec4(position, 1.0);
						vW = w.xyz;
						gl_Position = projectionMatrix * viewMatrix * w;
					}`,
				fragmentShader: /* glsl */ `
					uniform vec3 uCam;
					uniform float uScan;
					uniform float uOn;
					uniform float uDis;
					varying vec3 vW;
					${NOISE3}
					float gridLine(vec2 p, float w) {
						vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), 1e-4);
						return 1.0 - min(min(g.x, g.y) / w, 1.0);
					}
					void main() {
						vec2 p = vW.xz;
						float minor = gridLine(p / 1.2, 1.0);
						float major = gridLine(p / 6.0, 1.3);
						float dist = length(vW.xz - uCam.xz);
						float fade = exp(-dist * 0.016) * smoothstep(0.0, 6.0, dist);
						// 远处密网格的摩尔纹：按屏幕密度压掉细线
						float dens = clamp(1.0 - length(fwidth(p / 1.2)) * 2.2, 0.0, 1.0);
						vec3 lc = vec3(0.78, 0.72, 0.96);
						float scan = exp(-pow((vW.z - uScan) * 0.22, 2.0));
						vec3 col = lc * (minor * 0.16 * dens + major * 0.3) * fade;
						col += vec3(1.0, 0.7, 0.88) * scan * (0.25 + major * 0.9 + minor * 0.4 * dens) * fade * 1.4;
						// 消散：按格子随机先后熄灭，熄灭前的一刻边缘发亮（第 17 小节第 3 拍"隔开世界的墙消失了"）
						if (uDis > 0.0) {
							float h = hash3(vec3(floor(p / 1.2), 3.0)) * 0.7 + noise3(vec3(p * 0.05, 1.0)) * 0.3;
							float edge = smoothstep(0.12, 0.0, abs(h - uDis * 1.15 + 0.05));
							col = col * step(uDis * 1.15 - 0.05, h) + vec3(1.0, 0.72, 0.9) * edge * (minor + major) * fade * 1.6;
						}
						gl_FragColor = vec4(col * uOn, 1.0);
					}`,
			}),
		[],
	);
	mat.uniforms.uCam.value.set(...cam.pos);
	// 扫描光：每 4 拍从镜头前方推向远处一次
	const period = BEAT * 4;
	const ph = ((f % period) + period) % period / period;
	mat.uniforms.uScan.value = cam.pos[2] - 4 - ph * 140;
	mat.uniforms.uOn.value = on;
	mat.uniforms.uDis.value = dissolve;
	if (on <= 0 || dissolve >= 1) return null;
	return (
		<mesh material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, -0.4 - 280]} frustumCulled={false}>
			<planeGeometry args={[700, 560]} />
		</mesh>
	);
};

// ════════ 星点与流光（Galaxy / Hyperspeed 的思路） ════════

const STAR_N = 2600;
const TRAIL_N = 380;

export const StarField: React.FC<{f: number; on: number}> = ({f, on}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const pos = new Float32Array(STAR_N * 3);
		const col = new Float32Array(STAR_N * 3);
		const size = new Float32Array(STAR_N);
		const tints = [
			[1, 0.95, 0.98],
			[1, 0.78, 0.9],
			[0.8, 0.78, 1],
			[0.72, 0.85, 1],
		];
		for (let i = 0; i < STAR_N; i++) {
			pos[i * 3] = (rnd(i * 3.1 + 0.5) - 0.5) * 110;
			pos[i * 3 + 1] = FLOOR_Y + 0.6 + Math.pow(rnd(i * 5.3 + 1.7), 1.6) * 34;
			pos[i * 3 + 2] = -4 - rnd(i * 7.9 + 2.3) * 260;
			const t = tints[Math.floor(rnd(i * 2.2 + 9) * 4)];
			const b = 0.35 + 0.65 * Math.pow(rnd(i * 4.4 + 3), 2);
			col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
			size[i] = 0.6 + 1.6 * rnd(i * 6.6 + 5);
		}
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexColors: true,
				uniforms: {uOn: {value: 0}, uTime: {value: 0}},
				vertexShader: /* glsl */ `
					attribute float aSize;
					uniform float uTime;
					varying vec3 vC;
					void main() {
						vec4 mv = modelViewMatrix * vec4(position, 1.0);
						float tw = 0.75 + 0.25 * sin(uTime * 0.08 + position.x * 3.0 + position.z);
						vC = color * tw;
						gl_PointSize = clamp(aSize * 260.0 / -mv.z, 1.2, 7.0);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uOn;
					varying vec3 vC;
					void main() {
						float d = length(gl_PointCoord - 0.5);
						float a = smoothstep(0.5, 0.0, d);
						gl_FragColor = vec4(vC * a * a * uOn, 1.0);
					}`,
			}),
		[],
	);
	mat.uniforms.uOn.value = on;
	mat.uniforms.uTime.value = f;
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

/** 流光：沿镜头前进方向拉长的光条，速度越快越长越亮（只在俯冲时出现） */
export const Trails: React.FC<{f: number; cam: Cam}> = ({f, cam}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const start = new Float32Array(TRAIL_N * 4 * 3);
		const corner = new Float32Array(TRAIL_N * 4 * 2);
		const col = new Float32Array(TRAIL_N * 4 * 3);
		const idx: number[] = [];
		for (let i = 0; i < TRAIL_N; i++) {
			const a = rnd(i * 1.7 + 0.3) * Math.PI * 2;
			const r = 2.2 + Math.pow(rnd(i * 2.9 + 4), 0.7) * 9;
			const x = Math.cos(a) * r * 1.5;
			const y = Math.max(FLOOR_Y + 0.15, Math.sin(a) * r * 0.8 + 0.8);
			const z = 2 - rnd(i * 3.7 + 8) * 90;
			const pink = rnd(i * 9.1 + 2) < 0.62;
			const c = pink ? [1, 0.62, 0.84] : [0.55, 0.7, 1];
			const b = 0.4 + 0.6 * rnd(i * 5.5);
			for (let k = 0; k < 4; k++) {
				start.set([x, y, z], (i * 4 + k) * 3);
				corner.set([k < 2 ? 0 : 1, k % 2 === 0 ? -1 : 1], (i * 4 + k) * 2);
				col.set([c[0] * b, c[1] * b, c[2] * b], (i * 4 + k) * 3);
			}
			const o = i * 4;
			idx.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
		}
		g.setAttribute('position', new THREE.BufferAttribute(start, 3));
		g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.setIndex(idx);
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexColors: true,
				uniforms: {uVel: {value: new THREE.Vector3()}, uLen: {value: 0}, uA: {value: 0}},
				vertexShader: /* glsl */ `
					attribute vec2 aCorner;
					uniform vec3 uVel;
					uniform float uLen;
					varying vec3 vC;
					varying vec2 vK;
					void main() {
						vec3 dir = normalize(uVel + vec3(0.0, 0.0, -1e-4));
						vec3 p = position + dir * aCorner.x * uLen;
						vec3 toCam = normalize(cameraPosition - p);
						vec3 side = normalize(cross(dir, toCam));
						p += side * aCorner.y * 0.05;
						vC = color;
						vK = aCorner;
						gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA;
					varying vec3 vC;
					varying vec2 vK;
					void main() {
						float along = sin(vK.x * 3.14159);
						float across = 1.0 - abs(vK.y);
						gl_FragColor = vec4(vC * along * across * uA, 1.0);
					}`,
			}),
		[],
	);
	const v = camVel(f);
	const speed = Math.hypot(...v);
	mat.uniforms.uVel.value.set(...v);
	mat.uniforms.uLen.value = Math.min(9, speed * 7);
	// 只在俯冲（第 1 段穿过裂缝）和急退（第 16 小节墙炸开）时出现；其余镜头移动不拉流光
	const win = Math.max(
		smooth(prog(f, bf(0, 3), bf(1))) * (1 - smooth(prog(f, bf(2), bf(2, 3)))),
		smooth(prog(f, bf(15, 3), bf(16))) * (1 - smooth(prog(f, bf(16, 3), bf(17, 2)))),
	);
	mat.uniforms.uA.value = smooth(Math.min(1, Math.max(0, (speed - 0.15) / 0.5))) * 1.3 * win;
	if (speed < 0.12 || win <= 0) return null;
	// 光条跟着镜头横向走（z 不跟），镜头离开中轴时两侧仍有流光
	return <mesh geometry={geo} material={mat} position={[cam.pos[0], cam.pos[1] - 0.8, 0]} frustumCulled={false} />;
};

// ════════ 被斩开的屏幕 ════════

/** 面板正好铺满起始画面（略放大一点，防止边缘露缝） */
export const PANEL_H = 2 * CAM0_Z * Math.tan((FOV0 * Math.PI) / 360) * 1.01;
export const PANEL_W = (PANEL_H * 16) / 9;
const THICK = 0.14;
/** 斩痕：从右上划到左边（面板坐标，两端伸出面板外；左端落在字幕区上方） */
export const CUT_P1: [number, number] = [3.4, 3.95];
export const CUT_P2: [number, number] = [-7.3, -1.55];
const CUT_D = (() => {
	const dx = CUT_P2[0] - CUT_P1[0];
	const dy = CUT_P2[1] - CUT_P1[1];
	const l = Math.hypot(dx, dy);
	return [dx / l, dy / l] as [number, number];
})();
/** 斩痕法线（指向右下那一半） */
const CUT_N: [number, number] = [-CUT_D[1], CUT_D[0]];

/** 矩形被直线切开后，取法线 side 一侧的多边形（Sutherland–Hodgman） */
const halfPolygon = (side: 1 | -1): [number, number][] => {
	const w = PANEL_W / 2;
	const h = PANEL_H / 2;
	const rect: [number, number][] = [
		[-w, -h],
		[w, -h],
		[w, h],
		[-w, h],
	];
	const sd = (p: [number, number]) => side * ((p[0] - CUT_P1[0]) * CUT_N[0] + (p[1] - CUT_P1[1]) * CUT_N[1]);
	const out: [number, number][] = [];
	for (let i = 0; i < rect.length; i++) {
		const a = rect[i];
		const b = rect[(i + 1) % rect.length];
		const da = sd(a);
		const db = sd(b);
		if (da >= 0) out.push(a);
		if (da * db < 0) {
			const t = da / (da - db);
			out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
	}
	return out;
};

const panelMaterials = () => {
	const shared = {
		uTime: {value: 0},
		uCrack: {value: 0},
		uGlow: {value: 0},
		uP1: {value: new THREE.Vector2(...CUT_P1)},
		uP2: {value: new THREE.Vector2(...CUT_P2)},
	};
	const vert = /* glsl */ `
		varying vec3 vP;
		varying vec3 vN;
		varying vec3 vWN;
		varying vec3 vWP;
		void main() {
			vP = position;
			vN = normal;
			vWN = normalize(mat3(modelMatrix) * normal);
			vec4 w = modelMatrix * vec4(position, 1.0);
			vWP = w.xyz;
			gl_Position = projectionMatrix * viewMatrix * w;
		}`;
	const crackFn = /* glsl */ `
		uniform float uCrack;
		uniform float uGlow;
		uniform vec2 uP1;
		uniform vec2 uP2;
		float segDist(vec2 p, vec2 a, vec2 b) {
			vec2 pa = p - a, ba = b - a;
			float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
			return length(pa - ba * h);
		}
		vec3 crackLight(vec2 p) {
			if (uCrack <= 0.0) return vec3(0.0);
			vec2 b = mix(uP1, uP2, uCrack);
			float d = segDist(p, uP1, b);
			float core = exp(-pow(d / 0.012, 2.0));
			float glow = exp(-d / 0.16) * 0.55 + exp(-d / 0.6) * 0.18;
			return (vec3(1.0, 0.95, 0.98) * core * 1.6 + vec3(1.0, 0.5, 0.76) * glow) * uGlow;
		}`;
	const cap = new THREE.ShaderMaterial({
		uniforms: shared,
		vertexShader: vert,
		fragmentShader: /* glsl */ `
			uniform float uTime;
			varying vec3 vP;
			varying vec3 vN;
			${crackFn}
			float gridLine(vec2 p, float w) {
				vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), 1e-4);
				return 1.0 - min(min(g.x, g.y) / w, 1.0);
			}
			void main() {
				vec2 p = vP.xy;
				bool front = vN.z > 0.5;
				vec2 q = p + vec2(uTime * 0.0042, uTime * 0.0016);
				float cell = 0.4315;
				float minor = gridLine(q / cell, 1.1);
				float major = gridLine(q / (cell * 4.0), 1.5);
				float r = length(p / vec2(6.5, 3.7));
				vec3 base = mix(vec3(0.034, 0.03, 0.054), vec3(0.016, 0.014, 0.028), smoothstep(0.0, 1.3, r));
				vec3 lc = vec3(0.86, 0.83, 0.94);
				vec3 col = base + lc * (minor * 0.2 + major * 0.32);
				// 一道斜向的柔光，像屏幕的反光
				col += vec3(0.05, 0.045, 0.07) * smoothstep(0.9, 0.0, abs(p.x * 0.35 + p.y * 0.9 - 1.2));
				if (!front) col = vec3(0.014, 0.012, 0.024) + lc * major * 0.08;
				col += crackLight(p) * (front ? 1.0 : 0.4);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
	const side = new THREE.ShaderMaterial({
		uniforms: shared,
		vertexShader: vert,
		fragmentShader: /* glsl */ `
			varying vec3 vP;
			varying vec3 vWN;
			varying vec3 vWP;
			${crackFn}
			${NACRE}
			void main() {
				// 切口：离斩痕近的侧面是虹彩发光的，面板外框只是暗边
				vec2 a = uP1, b = uP2;
				float d = segDist(vP.xy, a, b);
				float onCut = 1.0 - smoothstep(0.02, 0.06, d);
				vec3 v = normalize(cameraPosition - vWP);
				float fres = pow(1.0 - abs(dot(v, vWN)), 2.0);
				vec3 iri = nacre(vP.x * 0.07 + vP.y * 0.05 + vP.z * 2.0 + fres * 0.6);
				vec3 col = mix(vec3(0.05, 0.045, 0.08), iri * (0.9 + 0.8 * uGlow) + vec3(1.0, 0.6, 0.85) * 0.35 * uGlow, onCut);
				gl_FragColor = vec4(col, 1.0);
			}`,
	});
	return {cap, side, shared};
};

/** 两半面板的运动：绕平行于斩痕、在外侧的铰链往后翻，同时向两侧散开 */
const halfTransform = (f: number, side: 1 | -1) => {
	const t = f - OPEN_AT;
	if (t <= 0) return {pos: [0, 0, 0] as V3, angle: 0};
	const phi = (82 * Math.PI) / 180 * easeOutCubic(t / 42) + 0.002 * t;
	const out = 1.3 * easeOutCubic(t / 48) + 0.012 * t;
	const back = 0.6 * easeOutCubic(t / 60);
	return {pos: [CUT_N[0] * side * out, CUT_N[1] * side * out, -back] as V3, angle: side * phi};
};

/** 铰链：斩痕上离原点最近的点，沿法线往外 HINGE */
const HINGE = 6.2;
const CUT_Q: [number, number] = (() => {
	const t = -(CUT_P1[0] * CUT_D[0] + CUT_P1[1] * CUT_D[1]);
	return [CUT_P1[0] + CUT_D[0] * t, CUT_P1[1] + CUT_D[1] * t];
})();

export const ScreenHalves: React.FC<{f: number}> = ({f}) => {
	const geos = useMemo(
		() =>
			([1, -1] as const).map((s) => {
				const shape = new THREE.Shape(halfPolygon(s).map(([x, y]) => new THREE.Vector2(x, y)));
				const g = new THREE.ExtrudeGeometry(shape, {depth: THICK, bevelEnabled: false});
				g.translate(0, 0, -THICK);
				return g;
			}),
		[],
	);
	const mats = useMemo(panelMaterials, []);
	if (f > bf(2)) return null;
	mats.shared.uTime.value = f;
	mats.shared.uCrack.value = crackDraw(f);
	mats.shared.uGlow.value = crackGlow(f);
	const axis = new THREE.Vector3(CUT_D[0], CUT_D[1], 0);
	return (
		<>
			{([1, -1] as const).map((s, i) => {
				const {pos, angle} = halfTransform(f, s);
				const h: V3 = [CUT_Q[0] + CUT_N[0] * s * HINGE, CUT_Q[1] + CUT_N[1] * s * HINGE, 0];
				const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
				return (
					<group key={s} position={[h[0] + pos[0], h[1] + pos[1], h[2] + pos[2]]} quaternion={q}>
						<mesh geometry={geos[i]} material={[mats.cap, mats.side]} position={[-h[0], -h[1], -h[2]]} />
					</group>
				);
			})}
		</>
	);
};

/** 面板上斩痕两端（3D 世界坐标，裂开前），给 2D 光晕定位用 */
export const CUT_WORLD: [V3, V3] = [
	[CUT_P1[0], CUT_P1[1], 0.01],
	[CUT_P2[0], CUT_P2[1], 0.01],
];
export const CUT_NORMAL = CUT_N;

// ════════ 片名针板墙 ════════

/** 墙：立在地面上、面朝 +z 的一面方柱阵列；字形范围内的柱子朝镜头凸出 */
export const WALL = {z: -80, cell: 0.14, nx: 430, ny: 200};
const WALL_X0 = (-WALL.nx * WALL.cell) / 2;
const WALL_Y0 = FLOOR_Y;
export const TITLE_TEXT = '空间的形状';
const CHAR_CELLS = 40;
const CHAR_GAP = 7;
/** 片名中心高度（世界 y） */
export const TITLE_Y = 4.4;
const TITLE_COL0 = Math.round((WALL.nx - (TITLE_TEXT.length * CHAR_CELLS + (TITLE_TEXT.length - 1) * CHAR_GAP)) / 2);
const TITLE_ROW0 = Math.round((TITLE_Y - WALL_Y0) / WALL.cell - CHAR_CELLS / 2);
/** 片名底边、顶边的世界 y */
export const TITLE_BOTTOM = WALL_Y0 + TITLE_ROW0 * WALL.cell;
export const TITLE_TOP = TITLE_BOTTOM + CHAR_CELLS * WALL.cell;

/** 把一个字画到画布上，采样成 CHAR_CELLS × CHAR_CELLS 的覆盖率（行 0 在下） */
const sampleGlyph = (ch: string): Float32Array => {
	const S = CHAR_CELLS * 8;
	const cv = document.createElement('canvas');
	cv.width = S;
	cv.height = S;
	const ctx = cv.getContext('2d')!;
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `800 ${Math.round(S * 0.9)}px ${SERIF}`;
	ctx.fillText(ch, S / 2, S * 0.53);
	const data = ctx.getImageData(0, 0, S, S).data;
	const out = new Float32Array(CHAR_CELLS * CHAR_CELLS);
	for (let r = 0; r < CHAR_CELLS; r++) {
		for (let c = 0; c < CHAR_CELLS; c++) {
			let acc = 0;
			for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) acc += data[((r * 8 + y) * S + c * 8 + x) * 4 + 3];
			out[(CHAR_CELLS - 1 - r) * CHAR_CELLS + c] = acc / (64 * 255);
		}
	}
	return out;
};

/**
 * 字形采样要等思源宋体加载完。渲染时 R3F 只在帧号变化时重画（ThreeCanvas 调 advance），
 * 所以字形准备好、墙挂上之后要自己 advance 一次，再放行截图。
 */
const useGlyphs = () => {
	const [glyphs, setGlyphs] = useState<Float32Array[] | null>(null);
	const [handle] = useState(() => delayRender('Sampling title glyphs'));
	useEffect(() => {
		document.fonts
			.load(`800 100px ${SERIF}`)
			.then(() => setGlyphs(Array.from(TITLE_TEXT).map(sampleGlyph)))
			.catch((e) => {
				console.error(e);
				continueRender(handle);
			});
	}, [handle]);
	return {glyphs, handle};
};

/** 每个字凸出的进度（带一点回弹），第 5 小节起一起缩回 */
const riseAt = (f: number, i: number) => {
	const t0 = TITLE_AT + i * BEAT * 0.5;
	const x = Math.min(1, Math.max(0, (f - t0) / 15));
	const s = 1.70158;
	const back = x <= 0 ? 0 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
	const retract = 1 - smooth(prog(f, RETRACT_AT, RETRACT_AT + BEAT * 3));
	return back * retract;
};

/** 墙从地面往上"长"出来的高度（世界 y）：第 3 小节第 2 拍起扫上去 */
export const wallScanAt = (f: number) => track(f, [[bf(3, 1), FLOOR_Y - 0.3], [bf(4), WALL_Y0 + WALL.ny * WALL.cell + 0.5]]);

export const PinWall: React.FC<{f: number}> = ({f}) => {
	const {glyphs, handle} = useGlyphs();
	const {advance} = useThree();
	const geo = useMemo(() => {
		if (!glyphs) return null;
		const box = new THREE.BoxGeometry(1, 1, 1);
		box.translate(0, 0, 0.5);
		const g = new THREE.InstancedBufferGeometry();
		g.index = box.index;
		g.setAttribute('position', box.getAttribute('position'));
		g.setAttribute('normal', box.getAttribute('normal'));
		const n = WALL.nx * WALL.ny;
		const cell = new Float32Array(n * 2);
		const hgt = new Float32Array(n);
		const chr = new Float32Array(n);
		const rr = new Float32Array(n);
		let k = 0;
		for (let j = 0; j < WALL.ny; j++) {
			for (let i = 0; i < WALL.nx; i++) {
				cell[k * 2] = i;
				cell[k * 2 + 1] = j;
				chr[k] = -1;
				const lr = j - TITLE_ROW0;
				const lc = i - TITLE_COL0;
				if (lr >= 0 && lr < CHAR_CELLS && lc >= 0) {
					const ci = Math.floor(lc / (CHAR_CELLS + CHAR_GAP));
					const cc = lc - ci * (CHAR_CELLS + CHAR_GAP);
					if (ci < glyphs.length && cc < CHAR_CELLS) {
						const v = glyphs[ci][lr * CHAR_CELLS + cc];
						hgt[k] = smooth(Math.min(1, Math.max(0, (v - 0.18) / 0.5)));
						chr[k] = ci;
					}
				}
				rr[k] = rnd(k * 0.731 + 0.2);
				k++;
			}
		}
		g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
		g.setAttribute('aH', new THREE.InstancedBufferAttribute(hgt, 1));
		g.setAttribute('aChar', new THREE.InstancedBufferAttribute(chr, 1));
		g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rr, 1));
		g.instanceCount = n;
		return g;
	}, [glyphs]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uRise: {value: [0, 0, 0, 0, 0]},
					uScan: {value: -10},
					uTremble: {value: 0},
					uTime: {value: 0},
					uGlyphGlow: {value: 1},
					uScale: {value: 1},
					uCenter: {value: new THREE.Vector3()},
					uWave: {value: -1},
					uWaveC: {value: new THREE.Vector2()},
				},
				vertexShader: /* glsl */ `
					attribute vec2 aCell;
					attribute float aH;
					attribute float aChar;
					attribute float aRand;
					uniform float uRise[5];
					uniform float uTremble;
					uniform float uTime;
					uniform float uScale;
					uniform vec3 uCenter;
					varying vec3 vN;
					varying vec3 vL;
					varying vec3 vW;
					varying float vH;
					varying float vG;
					${NOISE3}
					void main() {
						float rise = 0.0;
						for (int k = 0; k < 5; k++) if (abs(float(k) - aChar) < 0.5) rise = uRise[k];
						float h = aH * rise;
						float tr = uTremble * (noise3(vec3(aCell * 0.06, uTime * 0.045)) - 0.5) * 0.9;
						float depth = 0.05 + h * 1.6 + max(tr, -0.04) + (aRand - 0.5) * 0.012;
						vec3 p = position;
						vec3 w = vec3(${WALL_X0.toFixed(4)} + (aCell.x + 0.5) * ${WALL.cell.toFixed(4)} + p.x * ${WALL.cell.toFixed(4)},
							${WALL_Y0.toFixed(4)} + (aCell.y + 0.5) * ${WALL.cell.toFixed(4)} + p.y * ${WALL.cell.toFixed(4)},
							${WALL.z.toFixed(4)} + p.z * depth);
						vN = normal;
						vL = p;
						vW = w;
						w = uCenter + (w - uCenter) * uScale;
						vH = h;
						vG = aH * step(-0.5, aChar);
						gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
					}`,
				fragmentShader: /* glsl */ `
					uniform float uScan;
					uniform float uGlyphGlow;
					uniform float uWave;
					uniform vec2 uWaveC;
					varying vec3 vN;
					varying vec3 vL;
					varying vec3 vW;
					varying float vH;
					varying float vG;
					${NACRE}
					float gridLine(vec2 p, float w) {
						vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), 1e-4);
						return 1.0 - min(min(g.x, g.y) / w, 1.0);
					}
					void main() {
						if (vW.y > uScan) discard;
						bool top = vN.z > 0.5;
						// 墙面网格线：每 4 根柱一格（单根柱太细，画面上会闪）
						vec2 gp = (vW.xy - vec2(${WALL_X0.toFixed(4)}, ${WALL_Y0.toFixed(4)})) / ${(WALL.cell * 4).toFixed(4)};
						float line = gridLine(gp, 1.1);
						float major = gridLine(gp / 5.0, 1.4);
						float band = exp(-abs(vW.y - uScan) * 1.4);
						vec3 lc = vec3(0.82, 0.77, 0.96);
						vec3 col = vec3(0.016, 0.014, 0.028) + lc * (line * 0.2 + major * 0.22) + vec3(1.0, 0.72, 0.88) * band * (0.25 + line * 1.2);
						// 帕路奇亚显色时，从它身上扩开的一圈冲击波（网格被一下子绷直）
						if (uWave >= 0.0) {
							float r = length(vW.xy - uWaveC);
							float ring = exp(-pow((r - uWave * 26.0) / 1.2, 2.0)) * (1.0 - uWave);
							col += vec3(1.0, 0.78, 0.92) * ring * (0.35 + line * 1.6 + major);
						}
						// 凸出来的字
						float g = smoothstep(0.03, 0.3, vH);
						if (g > 0.0) {
							vec3 v = normalize(cameraPosition - vW);
							if (top) {
								// 字面：珍珠白，带一层很淡的虹彩流光
								float sheen = 0.5 + 0.5 * sin(vW.x * 0.35 - vW.y * 0.6);
								vec3 pearl = mix(vec3(1.0, 0.95, 0.98), vec3(1.0, 0.88, 0.95), sheen);
								vec3 face = mix(pearl, nacre(vW.x * 0.045 + vW.y * 0.03), 0.28) * (1.0 + 0.25 * uGlyphGlow);
								col = mix(col, face, g);
							} else {
								vec3 n = normalize(vN);
								vec3 L = normalize(vec3(-0.45, 0.6, 0.65));
								float lit = 0.35 + 0.65 * max(dot(n, L), 0.0);
								float fres = pow(1.0 - abs(dot(v, n)), 1.5);
								vec3 iri = nacre(vW.x * 0.05 + vW.y * 0.08 + vL.z * 0.6 + fres * 0.5) * (0.45 + 0.85 * lit);
								col = mix(col, iri * (0.7 + 0.55 * vL.z), g);
							}
						}
						gl_FragColor = vec4(col, 1.0);
					}`,
			}),
		[],
	);
	useEffect(() => {
		if (!geo) return;
		advance(performance.now());
		continueRender(handle);
	}, [geo, advance, handle]);
	if (!geo || f < bf(3, 1) || shrinkAt(f) <= 0.001) return null;
	mat.uniforms.uRise.value = Array.from(TITLE_TEXT).map((_, i) => riseAt(f, i));
	mat.uniforms.uScan.value = wallScanAt(f);
	// 不安定的空间：第 5 小节后半起抖起来；第 6–7 小节每呼一次（每小节后半）抖动小一截，第 8 小节显色时一下绷直
	mat.uniforms.uTremble.value = track(f, [
		[RETRACT_AT + BEAT * 2, 0],
		[bf(6), 1],
		[bf(6, 2), 1],
		[bf(7), 0.62],
		[bf(7, 2), 0.62],
		[bf(8) - 2, 0.32],
		[bf(8), 0],
	]);
	mat.uniforms.uWave.value = f < bf(8) ? -1 : prog(f, bf(8), bf(9, 2));
	mat.uniforms.uWaveC.value.set(WAVE_C[0], WAVE_C[1]);
	mat.uniforms.uScale.value = shrinkAt(f);
	mat.uniforms.uCenter.value.set(...SHRINK_C);
	mat.uniforms.uTime.value = f;
	mat.uniforms.uGlyphGlow.value = env(f, TITLE_AT, bf(5, 2), 6, 20);
	return <mesh geometry={geo} material={mat} frustumCulled={false} />;
};

/** 第 2 段末尾：所有东西缩向一个点（片名中心附近，帕路奇亚的位置） */
export const SHRINK_C: V3 = [0, 4.5, -76.7];
export const shrinkAt = (f: number) => 1 - Math.pow(smooth(prog(f, bf(12, 2), bf(13, 2))), 1.6);
/** 显色冲击波的中心（墙面上，帕路奇亚身后） */
const WAVE_C: [number, number] = [0.3, 5.5];

/** 两颗珍珠光（帕路奇亚肩上两颗珍珠的排布）：片名上方，第 2 小节第 3、4 拍各闪一下 */
export const PEARLS: [V3, V3] = [
	[-1.75, TITLE_TOP + 2.4, WALL.z + 1.5],
	[1.75, TITLE_TOP + 2.4, WALL.z + 1.5],
];
