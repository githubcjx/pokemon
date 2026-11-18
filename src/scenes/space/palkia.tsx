import {useMemo} from 'react';
import * as THREE from 'three';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, BEAT, env, lerp, prog, smooth} from './common';
import {PEARLS, shrinkAt, SHRINK_C} from './hook';

/**
 * 第 2 段「呼吸与登场」：两颗珍珠光随呼吸明暗，网格一呼一稳 → 第 8 小节帕路奇亚显色（叫声、名称卡）
 * → 墙面分出一叠平行的玻璃层，像书页，帕路奇亚在其中两层之间的缝里 → 第 12 小节后半一切缩成一个点。
 * 玻璃层参考 React Bits 的 GlassSurface / FluidGlass，在帕路奇亚前面的几层画在另一张透明画布上。
 */

// ════════ 帕路奇亚 ════════

/** 官方立绘 art.png（面朝左），在世界里的锚点与边长 */
export const PALKIA = {pos: SHRINK_C, size: 12};
/** 显色：第 8 小节强拍 */
export const REVEAL = bf(8);
/** 立绘里珍珠的位置：近侧肩上的那颗看得见；远侧那颗藏在身后 */
const PEARL_NEAR_UV: [number, number] = [0.527, 0.255];
const PEARL_FAR_UV: [number, number] = [0.24, 0.27];
const uvToWorld = (uv: [number, number], dz: number): V3 => [
	PALKIA.pos[0] + (uv[0] - 0.5) * PALKIA.size,
	PALKIA.pos[1] - (uv[1] - 0.5) * PALKIA.size,
	PALKIA.pos[2] + dz,
];

/** 呼吸：一小节一呼一吸（前半吸、后半呼），0–1 */
export const breathAt = (f: number) => 0.5 - 0.5 * Math.cos(((f - bf(6)) / (BEAT * 4)) * Math.PI * 2);

const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];

export const Palkia: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const sh = shrinkAt(f);
	const o = env(f, bf(7, 1), bf(13, 2), 30, 4) * Math.min(1, sh * 3);
	if (o <= 0) return null;
	const pr = project(c, PALKIA.pos);
	if (pr.depth <= 0) return null;
	const size = pxOf(c, pr.depth, PALKIA.size) * sh;
	const k = smooth(prog(f, REVEAL - 1, REVEAL + 9));
	// 剪影阶段只露出一点轮廓
	const sil = 1 - k;
	const br = breathAt(f);
	// 镜头绕到侧面时，立绘只跟着转一点点（不超过 ±6°）
	const az = (Math.atan2(c.pos[0] - PALKIA.pos[0], c.pos[2] - PALKIA.pos[2]) * 180) / Math.PI;
	const yaw = Math.max(-6, Math.min(6, az * 0.12)) + k * Math.sin((f - REVEAL) * 0.025) * 1.5;
	return (
		<PokemonArt3D
			dir="pokemon/palkia"
			x={pr.x}
			y={pr.y}
			size={size}
			yaw={yaw}
			pitch={-1.2 * k}
			depthScale={0.5}
			ambient={mix3([0.02, 0.018, 0.03], [0.6, 0.58, 0.66], k)}
			dirLights={[
				{dir: [-0.5, -0.8, 0.6], color: mix3([0, 0, 0], [0.5, 0.48, 0.58], k), wrap: 0.45},
				{dir: [0.8, 0.2, 0.4], color: mix3([0, 0, 0], [0.32, 0.22, 0.3], k), wrap: 0.5},
			]}
			pointLights={[
				{pos: [PEARL_NEAR_UV[0] - 0.5, PEARL_NEAR_UV[1] - 0.5, 0.3], color: mix3([0.5, 0.2, 0.35], [0.5 + 0.6 * br, 0.28 + 0.3 * br, 0.4 + 0.45 * br], k), radius: 0.3},
			]}
			rim={{dir: [0.75, -0.55], color: mix3([1.0, 0.55, 0.8], [0.62, 0.5, 0.62], k), power: 3}}
			emissive={0.12 * k + 0.25 * sil}
			emissiveTint={[1.5, 0.75, 1.1]}
			emissiveKey={[0.55, 1, 0.12, 0.7]}
			brightness={1 + 0.9 * Math.exp(-Math.max(0, f - REVEAL) / 8) * k}
			opacity={o * (0.55 + 0.45 * k)}
			resolution={Math.min(1.3, 2600 / Math.max(1, size * 1.12))}
		/>
	);
};

// ════════ 珍珠光 ════════

/** 两颗珍珠光的世界位置：第 7 小节从片名上方移到它两肩的位置；缩成一个点时汇到中心 */
export const pearlPos = (f: number, i: number): V3 => {
	const from = PEARLS[i];
	const to = i === 1 ? uvToWorld(PEARL_NEAR_UV, 0.4) : uvToWorld(PEARL_FAR_UV, -0.3);
	const m = smooth(prog(f, bf(7), REVEAL));
	const p: V3 = [lerp(from[0], to[0], m), lerp(from[1], to[1], m), lerp(from[2], to[2], m)];
	const sh = shrinkAt(f);
	const C = PALKIA.pos;
	return [C[0] + (p[0] - C[0]) * sh, C[1] + (p[1] - C[1]) * sh, C[2] + (p[2] - C[2]) * sh];
};

/** 珍珠光亮度：第 2 小节第 3、4 拍各闪一下，第 3 小节变亮，第 6 小节起随呼吸明暗；远侧那颗显色后藏到身后 */
export const pearlGlow = (f: number, i: number) => {
	const at = bf(2, 2 + i);
	if (f < at) return {a: 0, flash: 0};
	const flash = Math.exp(-(f - at) / 9);
	const grow = smooth(prog(f, bf(3), bf(4)));
	const pre = f < bf(6) ? 0.12 * Math.sin(((f - bf(4)) / (BEAT * 4)) * Math.PI * 2) * prog(f, bf(4), bf(4, 2)) : 0;
	const br = f >= bf(6) ? 0.25 * (breathAt(f) - 0.5) : 0;
	let a = 0.28 + 0.42 * grow + pre + br;
	if (i === 0) a *= 1 - smooth(prog(f, REVEAL - 6, REVEAL + 6));
	// 显色那一下从珍珠里爆出来
	const pop = Math.exp(-Math.abs(f - REVEAL) / 6) * 0.9;
	return {a: Math.min(1.2, a + flash + (i === 1 ? pop : 0)), flash: flash + (i === 1 ? pop : 0)};
};

// ════════ 名称卡 ════════

export const NAME_FROM = bf(8, 1);
export const nameOpacity = (f: number) => 1 - smooth(prog(f, bf(10), bf(10, 3)));

// ════════ 书页一样的玻璃层 ════════

const PAGE_N = 6;
const PAGE_W = 22;
const PAGE_H = 15;
const PAGE_Y = 5.0;
/** 各层最终的 z：帕路奇亚（−76.7）在第 1、2 层之间 */
const pageZ = (k: number) => -79.4 + k * 1.8;
/** 帕路奇亚前面的层（画在前景画布上） */
export const FRONT_PAGES = [2, 3, 4, 5];
export const BACK_PAGES = [0, 1];

/** 第 k 层的出现：第 10 小节起从墙面依次往前滑出（每层隔四分之一拍） */
const pageAt = (f: number, k: number) => smooth(prog(f, bf(10) + k * BEAT * 0.25, bf(10) + k * BEAT * 0.25 + BEAT * 1.5));
export const pagesOn = (f: number) => f >= bf(10) && f < bf(13, 2);

/**
 * front：画在帕路奇亚前面的透明画布上。叠加混合会把画布的 alpha 也加到 1、把后面整个盖住，
 * 所以前景这几层只加颜色、不动 alpha（浏览器按预乘 alpha 合成，等于纯叠加）。
 */
export const GlassPages: React.FC<{f: number; pages: number[]; front?: boolean}> = ({f, pages, front = false}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				blending: THREE.AdditiveBlending,
				uniforms: {uA: {value: 0}, uSeed: {value: 0}},
				vertexShader: /* glsl */ `
					varying vec2 vUv;
					varying vec3 vW;
					varying vec3 vNw;
					void main() {
						vUv = uv;
						vec4 w = modelMatrix * vec4(position, 1.0);
						vW = w.xyz;
						vNw = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
						gl_Position = projectionMatrix * viewMatrix * w;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA;
					uniform float uSeed;
					varying vec2 vUv;
					varying vec3 vW;
					varying vec3 vNw;
					float gridLine(vec2 p, float w) {
						vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), 1e-4);
						return 1.0 - min(min(g.x, g.y) / w, 1.0);
					}
					void main() {
						vec2 q = vUv * vec2(${PAGE_W.toFixed(1)}, ${PAGE_H.toFixed(1)});
						float line = gridLine(q / 1.1, 1.0);
						vec2 e = min(vUv, 1.0 - vUv) * vec2(${PAGE_W.toFixed(1)}, ${PAGE_H.toFixed(1)});
						float edge = exp(-min(e.x, e.y) / 0.08);
						float edgeSoft = exp(-min(e.x, e.y) / 1.2);
						vec3 v = normalize(cameraPosition - vW);
						float cosT = abs(dot(v, vNw));
						float fres = pow(1.0 - cosT, 3.0);
						// 斜看时像玻璃一样反光；一道斜向的高光扫过
						float sweep = exp(-pow((vUv.x * 1.3 + vUv.y * 0.6 - 0.35 - uSeed * 0.25) * 4.0, 2.0));
						vec3 tint = mix(vec3(0.85, 0.8, 1.0), vec3(1.0, 0.75, 0.9), vUv.x);
						vec3 col = tint * (0.008 + 0.12 * fres + 0.05 * sweep) + vec3(0.86, 0.82, 0.96) * line * 0.08;
						col += vec3(1.0, 0.82, 0.94) * (edge * 0.9 + edgeSoft * 0.05);
						gl_FragColor = vec4(col * uA, 1.0);
					}`,
			}),
		[],
	);
	const mats = useMemo(
		() =>
			Array.from({length: PAGE_N}, () => {
				const m = mat.clone();
				if (front) {
					m.blending = THREE.CustomBlending;
					m.blendEquation = THREE.AddEquation;
					m.blendSrc = THREE.OneFactor;
					m.blendDst = THREE.OneFactor;
					m.blendSrcAlpha = THREE.ZeroFactor;
					m.blendDstAlpha = THREE.OneFactor;
				}
				return m;
			}),
		[mat, front],
	);
	if (!pagesOn(f)) return null;
	const sh = shrinkAt(f);
	const C = SHRINK_C;
	const fade = env(f, bf(10), bf(13, 2), 6, 10);
	return (
		<>
			{pages.map((k) => {
				const t = pageAt(f, k);
				const z = lerp(-80.05, pageZ(k), t);
				mats[k].uniforms.uA.value = t * fade;
				mats[k].uniforms.uSeed.value = k + (f - bf(10)) * 0.02;
				const p: V3 = [C[0] + (0 - C[0]) * sh, C[1] + (PAGE_Y - C[1]) * sh, C[2] + (z - C[2]) * sh];
				return (
					<mesh key={k} material={mats[k]} position={p} scale={[sh, sh, 1]} frustumCulled={false}>
						<planeGeometry args={[PAGE_W, PAGE_H]} />
					</mesh>
				);
			})}
		</>
	);
};

/** 2D 珍珠光（与第 1 段的 Glint 同一个画法） */
export const PearlGlints: React.FC<{f: number; c: Cam; Glint: React.FC<{x: number; y: number; r: number; a: number; star: number}>}> = ({f, c, Glint}) => {
	if (f < bf(2, 1) || f > bf(14)) return null;
	return (
		<>
			{[0, 1].map((i) => {
				const p = pearlPos(f, i);
				const pr = project(c, p);
				if (pr.depth <= 0) return null;
				const {a, flash} = pearlGlow(f, i);
				const grow = smooth(prog(f, bf(3), bf(4)));
				const r = Math.min(70, Math.max(5, pxOf(c, pr.depth, 0.55))) * (f > REVEAL ? 0.8 : 1);
				// 缩成一个点时两颗光一起收拢、变暗（第 3 段的点由 infinite.tsx 接手）
				const fade = 1 - smooth(prog(f, bf(13), bf(13, 2)));
				return <Glint key={i} x={pr.x} y={pr.y} r={r * (1 + 0.6 * Math.min(1, flash))} a={Math.min(1, a) * fade} star={(Math.min(1, flash) + 0.25 * grow) * fade} />;
			})}
		</>
	);
};

