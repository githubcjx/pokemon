import {useMemo} from 'react';
import * as THREE from 'three';
import {agedTexture, rng} from '../pagodaGeometry';
import {Env, V3} from '../stage';
import {MOON_DIR, SUN_DIR} from './coronet';

// ─── 洗翠的海岸（《神奥之名》第 2 段）──────────────────────────────────────────
// 海在南（+z），海岸线大致沿 x 轴；往北是缓缓抬升的雪原和丘陵，远处是天冠山，山顶平台上立着完好的神殿。
// 两个部族的营地分在雪原的西、东两边（金刚队 CAMP_D、珍珠队 CAMP_P），祝庆村建在海边（VILLAGE）。
// 只是一个示意的舞台，不对应游戏地图上的具体位置。

const hash2 = (x: number, y: number) => {
	const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
	return s - Math.floor(s);
};
const vnoise = (x: number, y: number) => {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * (3 - 2 * fx);
	const uy = fy * fy * (3 - 2 * fy);
	const a = hash2(ix, iy);
	const b = hash2(ix + 1, iy);
	const c = hash2(ix, iy + 1);
	const d = hash2(ix + 1, iy + 1);
	return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};
const fbm = (x: number, y: number, oct = 5) => {
	let v = 0;
	let amp = 0.5;
	let fr = 1;
	for (let i = 0; i < oct; i++) {
		v += amp * vnoise(x * fr, y * fr);
		fr *= 2.03;
		amp *= 0.5;
	}
	return v;
};
const ridged = (x: number, y: number, oct = 5) => {
	let v = 0;
	let amp = 0.5;
	let fr = 1;
	let w = 1;
	for (let i = 0; i < oct; i++) {
		const n = 1 - Math.abs(2 * vnoise(x * fr, y * fr) - 1);
		const r = n * n * w;
		v += r * amp;
		w = Math.min(1, r * 1.6);
		fr *= 2.07;
		amp *= 0.5;
	}
	return v;
};
const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** 海岸线（z 坐标）：几道正弦叠加，海面着色器里用同一个公式画浪花 */
export const shoreZ = (x: number) => -10 + 14 * Math.sin(0.011 * x + 1) + 6 * Math.sin(0.037 * x + 2.3);

/** 天冠山的山顶（在东北方远处） */
const SUMMIT_XZ = [300, -560] as const;

const rawHeight = (x: number, z: number) => {
	const d = shoreZ(x) - z; // 离岸多远（往内陆为正）
	if (d < 0) return Math.max(-14, d * 0.12);
	const beach = (Math.min(d, 26) / 26) * 1.6;
	const plain = smooth(20, 260, d) * (8 + 18 * (fbm(x * 0.008 + 3, z * 0.008 - 7, 4) - 0.3));
	const hills = smooth(80, 380, d) * ridged(x * 0.006 + 3, z * 0.006 - 1, 4) * 46;
	// 北边的群山与天冠山
	const range = smooth(-260, -440, z) * (25 + 70 * ridged(x * 0.005 + 7, z * 0.005, 5));
	const rc = Math.hypot(x - SUMMIT_XZ[0], (z - SUMMIT_XZ[1]) / 0.8);
	// 山尖附近不加脊状噪声，保证削平的山顶是最高处
	const peak = 360 * Math.exp(-Math.pow(rc / 175, 2)) + ridged(x * 0.014 + 1, z * 0.014 - 4, 4) * 80 * Math.exp(-Math.pow(rc / 240, 2)) * smooth(30, 110, rc);
	return beach + plain + hills + range + peak;
};
/** 山顶削平成神殿的平台 */
const SUMMIT_Y = rawHeight(SUMMIT_XZ[0], SUMMIT_XZ[1]) - 14;
export const SUMMIT: V3 = [SUMMIT_XZ[0], SUMMIT_Y, SUMMIT_XZ[1]];

export const coastHeight = (x: number, z: number) => {
	const h = rawHeight(x, z);
	const rc = Math.hypot(x - SUMMIT_XZ[0], z - SUMMIT_XZ[1]);
	// 山顶是一座陡峭的尖峰，神殿的平台就在峰尖上，从山下仰望也看得见
	const cap = SUMMIT_Y - Math.max(0, rc - 24) * 2;
	const k = smooth(140, 60, rc);
	return h * (1 - k) + Math.min(h, cap) * k;
};

export const CAMP_D: V3 = [-110, coastHeight(-110, -150), -150];
export const CAMP_P: V3 = [110, coastHeight(110, -175), -175];
export const VILLAGE: V3 = [70, coastHeight(70, -32), -32];
/** 村子西门北边的门柱：新做的精灵球就放在柱顶 */
export const GATE: V3 = [VILLAGE[0] - 22, coastHeight(VILLAGE[0] - 22, VILLAGE[2]), VILLAGE[2]];
const POST: V3 = [GATE[0], GATE[1], GATE[2] - 3.2];
export const BALL: V3 = [POST[0], POST[1] + 4.6 + 0.32, POST[2]];
/** 部族的船靠岸的地方 */
export const LANDING: V3 = [-30, 0.4, shoreZ(-30) + 2];

const detailTexture = () => {
	const N = 256;
	const c = document.createElement('canvas');
	c.width = N;
	c.height = N;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(N, N);
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			const a = (x / N) * Math.PI * 2;
			const b = (y / N) * Math.PI * 2;
			const n = fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + Math.cos(b) * 3, 5) * 0.6 + fbm(Math.sin(b) * 6 + 4, Math.cos(a) * 6 - 2, 3) * 0.4;
			const v = Math.round(255 * (0.74 + 0.26 * Math.min(1, Math.max(0, (n - 0.25) * 1.8))));
			const k = (y * N + x) * 4;
			img.data[k] = v;
			img.data[k + 1] = v;
			img.data[k + 2] = v;
			img.data[k + 3] = 255;
		}
	ctx.putImageData(img, 0, 0);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
};

/** 网格坐标 → 世界坐标：海岸、营地附近密，远处疏 */
const warpX = (u: number) => Math.sign(u) * Math.pow(Math.abs(u), 1.5) * 760;
const warpZ = (v: number) => (v < 0 ? -Math.pow(-v, 1.35) * 900 : Math.pow(v, 1.6) * 360);

export const CoastTerrain: React.FC = () => {
	const geo = useMemo(() => {
		const g = new THREE.PlaneGeometry(2, 2, 520, 420);
		g.rotateX(-Math.PI / 2);
		const p = g.attributes.position as THREE.BufferAttribute;
		for (let i = 0; i < p.count; i++) {
			const x = warpX(p.getX(i));
			const z = warpZ(p.getZ(i));
			p.setXYZ(i, x, coastHeight(x, z), z);
		}
		g.computeVertexNormals();
		const n = g.attributes.normal as THREE.BufferAttribute;
		const col = new Float32Array(p.count * 3);
		const snow = new THREE.Color('#dde3ec');
		const snowShade = new THREE.Color('#a9b4c6');
		const rock = new THREE.Color('#43464e');
		const sand = new THREE.Color('#b9ab94');
		const wet = new THREE.Color('#6d6a62');
		const c = new THREE.Color();
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i);
			const y = p.getY(i);
			const z = p.getZ(i);
			const ny = n.getY(i);
			const d = shoreZ(x) - z;
			const patch = fbm(x * 0.03 + 9, z * 0.03 - 4, 3);
			const snowy = smooth(0.7 + (patch - 0.5) * 0.25, 0.84 + (patch - 0.5) * 0.25, ny) * smooth(10 + patch * 16, 34 + patch * 20, d);
			c.copy(rock).offsetHSL(0, 0, (hash2(x * 0.9, z * 0.9) - 0.5) * 0.06);
			// 海滩：湿沙 → 干沙
			const beach = 1 - smooth(18, 34 + patch * 10, d);
			c.lerp(wet.clone().lerp(sand, smooth(0.2, 1.4, y)), beach * smooth(0.55, 0.8, ny));
			c.lerp(snowShade.clone().lerp(snow, smooth(0.86, 0.98, ny)), snowy);
			col.set([c.r, c.g, c.b], i * 3);
		}
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		const uv = g.attributes.uv as THREE.BufferAttribute;
		for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 9, (p.getZ(i) + p.getY(i) * 0.6) / 9);
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				vertexColors: true,
				roughness: 0.92,
				map: detailTexture(),
			}),
		[],
	);
	return <mesh geometry={geo} material={mat} receiveShadow />;
};

// ── 海面 ──

const SEA_VERT = `
varying vec3 vWorld;
void main() {
	vec4 w = modelMatrix * vec4(position, 1.0);
	vWorld = w.xyz;
	gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SEA_FRAG = `
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uFog;
uniform float uFogFar;
varying vec3 vWorld;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
float waves(vec2 p, float t) {
	float v = 0.0, a = 0.5;
	vec2 dir = vec2(0.0, -1.0);
	for (int i = 0; i < 5; i++) {
		v += a * vn(p + dir * t * (0.6 + float(i) * 0.25));
		p = mat2(1.6, 1.2, -1.2, 1.6) * p;
		a *= 0.5;
	}
	return v;
}
float shoreZ(float x) { return -10.0 + 14.0 * sin(0.011 * x + 1.0) + 6.0 * sin(0.037 * x + 2.3); }
void main() {
	vec2 p = vWorld.xz * 0.35;
	float t = uTime;
	float e = 0.6;
	float h0 = waves(p, t);
	vec3 n = normalize(vec3(waves(p + vec2(e, 0.0), t) - h0, 1.6, waves(p + vec2(0.0, e), t) - h0));
	// 远处的波纹逐渐抹平，避免成块的明暗
	float far = smoothstep(25.0, 260.0, length(vWorld - uCam));
	n = normalize(mix(n, vec3(0.0, 1.0, 0.0), far * 0.85));
	vec3 v = normalize(uCam - vWorld);
	float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
	vec3 r = reflect(-v, n);
	float spec = pow(max(dot(r, normalize(uSunDir)), 0.0), 220.0);
	float sheen = pow(max(dot(r, normalize(uSunDir)), 0.0), 12.0);
	vec3 col = mix(uDeep, uSky * 0.62, clamp(fres, 0.0, 0.7));
	col += uSunCol * (spec * 3.0 + sheen * 0.18);
	// 岸边的浪花：离海岸线越近越白，随时间一道道推上来
	float d = vWorld.z - shoreZ(vWorld.x);
	float surf = smoothstep(7.0, 0.0, d) * (0.55 + 0.45 * sin(d * 1.6 - t * 1.4 + vn(vWorld.xz * 0.2) * 4.0));
	col = mix(col, vec3(0.86, 0.9, 0.93) * (0.5 + 0.5 * length(uSunCol)), clamp(surf * (0.4 + 0.6 * vn(vWorld.xz * 0.6 + t * 0.3)), 0.0, 0.9));
	// 雾
	float dist = length(vWorld - uCam);
	col = mix(col, uFog, smoothstep(uFogFar * 0.12, uFogFar, dist));
	gl_FragColor = vec4(col, 1.0);
}`;

export const Sea: React.FC<{
	time: number;
	cam: V3;
	deep: string;
	sky: string;
	sunDir: V3;
	sunCol: string;
	fog: string;
	fogFar: number;
}> = ({time, cam, deep, sky, sunDir, sunCol, fog, fogFar}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: SEA_VERT,
				fragmentShader: SEA_FRAG,
				fog: false,
				uniforms: {
					uTime: {value: 0},
					uCam: {value: new THREE.Vector3()},
					uDeep: {value: new THREE.Color()},
					uSky: {value: new THREE.Color()},
					uSunDir: {value: new THREE.Vector3()},
					uSunCol: {value: new THREE.Color()},
					uFog: {value: new THREE.Color()},
					uFogFar: {value: 1000},
				},
			}),
		[],
	);
	mat.uniforms.uTime.value = time;
	mat.uniforms.uCam.value.set(...cam);
	mat.uniforms.uDeep.value.set(deep);
	mat.uniforms.uSky.value.set(sky);
	mat.uniforms.uSunDir.value.set(...sunDir);
	mat.uniforms.uSunCol.value.set(sunCol);
	mat.uniforms.uFog.value.set(fog);
	mat.uniforms.uFogFar.value = fogFar;
	return (
		<mesh position={[cam[0], 0, cam[2]]} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
			<planeGeometry args={[2600, 2600]} />
		</mesh>
	);
};

// ── 船：木船身、一根桅杆、一面帆（船头朝 -z，heading 为绕 y 轴转角）──

const hullGeo = () => {
	const g = new THREE.BoxGeometry(3.4, 1.8, 13, 4, 2, 12);
	const p = g.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const y = p.getY(i);
		const z = p.getZ(i);
		const along = z / 6.5; // -1 船头 … 1 船尾
		const taper = 1 - Math.pow(Math.max(0, -along), 1.6) * 0.92 - Math.pow(Math.max(0, along), 3) * 0.35;
		const keel = y < 0 ? 0.35 + 0.65 * (1 - Math.abs(along) * 0.3) : 1;
		const lift = Math.pow(Math.abs(along), 2.4) * 0.9;
		p.setXYZ(i, x * taper * keel, y + lift, z);
	}
	g.computeVertexNormals();
	return g;
};
const sailGeo = () => {
	const g = new THREE.PlaneGeometry(7, 6.2, 10, 8);
	const p = g.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const y = p.getY(i);
		p.setZ(i, -(1 - Math.pow(x / 3.5, 2)) * 1.5 * (0.6 + 0.4 * (y / 3.1 + 1) * 0.5));
	}
	g.computeVertexNormals();
	return g;
};

export const useShipParts = () =>
	useMemo(
		() => ({
			hull: hullGeo(),
			sail: sailGeo(),
			wood: new THREE.MeshStandardMaterial({
				map: agedTexture('#5a4030', 'rgba(20,12,6,0.5)', {
					seed: 4,
					grain: true,
					grimeH: 0.5,
				}),
				roughness: 0.85,
			}),
			cloth: new THREE.MeshStandardMaterial({
				color: '#d2c5ad',
				roughness: 0.95,
				side: THREE.DoubleSide,
			}),
		}),
		[],
	);

export const Ship: React.FC<{
	p: V3;
	heading: number;
	time: number;
	seed?: number;
	scale?: number;
	opacity?: number;
}> = ({p, heading, time, seed = 0, scale = 1}) => {
	const parts = useShipParts();
	const roll = Math.sin(time * 0.9 + seed * 2.1) * 0.04;
	const pitch = Math.sin(time * 0.7 + seed * 1.3) * 0.025;
	const bob = Math.sin(time * 1.1 + seed) * 0.15;
	return (
		<group position={[p[0], p[1] + bob + 0.4, p[2]]} rotation={new THREE.Euler(pitch, heading, roll, 'YXZ')} scale={scale}>
			<mesh geometry={parts.hull} material={parts.wood} />
			<mesh position={[0, 5.6, -0.6]} material={parts.wood}>
				<cylinderGeometry args={[0.14, 0.2, 10, 8]} />
			</mesh>
			<mesh position={[0, 7.4, -0.6]} rotation={[0, 0, Math.PI / 2]} material={parts.wood}>
				<cylinderGeometry args={[0.09, 0.09, 7.6, 6]} />
			</mesh>
			<mesh geometry={parts.sail} material={parts.cloth} position={[0, 4.3, -0.5]} />
		</group>
	);
};

// ── 营地：一圈帐篷（金刚队深蓝、珍珠队珍珠白）──

export type Tent = {p: V3; r: number; h: number};
export const campTents = (c: V3, seed: number, n = 30): Tent[] => {
	const r = rng(seed);
	return Array.from({length: n}, (_, i) => {
		const a = i * 2.39996 + r() * 0.4;
		const d = 5 + Math.sqrt(i) * 5.2 + r() * 2;
		const x = c[0] + Math.cos(a) * d;
		const z = c[2] + Math.sin(a) * d * 0.8;
		return {
			p: [x, coastHeight(x, z), z] as V3,
			r: 2.4 + r() * 1,
			h: 3.8 + r() * 1.6,
		};
	});
};

export const Camp: React.FC<{
	tents: Tent[];
	color: string;
	trim: string;
	grow?: number;
}> = ({tents, color, trim, grow = 1}) => {
	const mats = useMemo(
		() => ({
			cloth: new THREE.MeshStandardMaterial({
				color,
				roughness: 0.9,
				flatShading: true,
			}),
			trim: new THREE.MeshStandardMaterial({
				color: trim,
				roughness: 0.6,
				metalness: 0.3,
			}),
		}),
		[color, trim],
	);
	const shown = Math.round(tents.length * grow);
	return (
		<group>
			{tents.slice(0, shown).map((t, i) => (
				<group key={i} position={t.p}>
					<mesh position={[0, t.h / 2 - 0.1, 0]} material={mats.cloth}>
						<coneGeometry args={[t.r, t.h, 7]} />
					</mesh>
					<mesh position={[0, t.h + 0.2, 0]} material={mats.trim}>
						<cylinderGeometry args={[0.06, 0.06, 1.2, 5]} />
					</mesh>
				</group>
			))}
		</group>
	);
};

// ── 祝庆村：一圈木栅、门、几排木屋和一座高一点的银河队本部；build 0 → 1 按顺序立起来 ──

type VPiece = {
	kind: 'log' | 'house' | 'roof' | 'hall' | 'hallRoof' | 'post' | 'lintel';
	p: V3;
	ry: number;
	s: V3;
	order: number;
};

const VILLAGE_PIECES: VPiece[] = (() => {
	const r = rng(23);
	const out: VPiece[] = [];
	const [cx, , cz] = VILLAGE;
	const R = 22;
	// 木栅：北门留一个口
	for (let i = 0; i < 96; i++) {
		const a = (i / 96) * Math.PI * 2;
		const x = cx + Math.cos(a) * R;
		const z = cz + Math.sin(a) * R * 0.95;
		if (Math.abs(z - cz) < 3 && x < cx) continue;
		const h = 3.6 + r() * 0.7;
		out.push({
			kind: 'log',
			p: [x, coastHeight(x, z) + h / 2 - 0.3, z],
			ry: 0,
			s: [1, h, 1],
			order: 0.05 + (i / 96) * 0.35 + r() * 0.04,
		});
	}
	// 门
	for (const s of [-1, 1])
		out.push({
			kind: 'post',
			p: [GATE[0], GATE[1] + 2.3, GATE[2] + s * 3.2],
			ry: 0,
			s: [1, 1, 1],
			order: 0.42,
		});
	out.push({
		kind: 'lintel',
		p: [GATE[0], GATE[1] + 4.2, cz],
		ry: Math.PI / 2,
		s: [1, 1, 1],
		order: 0.46,
	});
	// 木屋
	for (let i = 0; i < 14; i++) {
		const a = i * 2.39996 + 0.7;
		const d = 7 + Math.sqrt(i) * 3.3;
		const x = cx + Math.cos(a) * d;
		const z = cz + Math.sin(a) * d * 0.9;
		if (Math.abs(z - cz) < 5 && x < cx - 6) continue;
		const ry = Math.round((Math.atan2(z - cz, x - cx) / (Math.PI / 2)) * 1) * (Math.PI / 2) + (r() - 0.5) * 0.2;
		const w = 4 + r() * 1.5;
		const dd = 3.5 + r();
		const h = 2.6 + r() * 0.6;
		const y = coastHeight(x, z);
		const o = 0.45 + r() * 0.35;
		out.push({
			kind: 'house',
			p: [x, y + h / 2, z],
			ry,
			s: [w, h, dd],
			order: o,
		});
		out.push({
			kind: 'roof',
			p: [x, y + h, z],
			ry,
			s: [w + 0.6, 1.6, dd + 0.6],
			order: o + 0.06,
		});
	}
	// 银河队本部
	const hy = coastHeight(cx + 2, cz + 4);
	out.push({
		kind: 'hall',
		p: [cx + 2, hy + 5, cz + 4],
		ry: 0,
		s: [7, 10, 6],
		order: 0.62,
	});
	out.push({
		kind: 'hallRoof',
		p: [cx + 2, hy + 10, cz + 4],
		ry: 0,
		s: [7.8, 2.6, 6.8],
		order: 0.72,
	});
	return out;
})();

const gableGeo = () => {
	const s = new THREE.Shape();
	s.moveTo(-0.5, 0);
	s.lineTo(0.5, 0);
	s.lineTo(0, 1);
	s.closePath();
	const g = new THREE.ExtrudeGeometry(s, {depth: 1, bevelEnabled: false});
	g.translate(0, 0, -0.5);
	return g;
};

/** build：0 → 1 立起来；gate：西门两扇门，0 敞开（推向村内）→ 1 关上 */
export const Village: React.FC<{build: number; gate?: number}> = ({build, gate = 0}) => {
	const parts = useMemo(() => {
		const wood = agedTexture('#6b5038', 'rgba(25,15,8,0.45)', {
			seed: 12,
			grain: true,
			grimeH: 0.5,
		});
		return {
			log: new THREE.CylinderGeometry(0.28, 0.32, 1, 7),
			box: new THREE.BoxGeometry(1, 1, 1),
			gable: gableGeo(),
			post: new THREE.CylinderGeometry(0.42, 0.46, 4.6, 8),
			lintel: new THREE.BoxGeometry(7.6, 0.6, 0.7),
			door: (() => {
				const g = new THREE.BoxGeometry(3.05, 3.5, 0.22);
				g.translate(1.52, 1.75, 0);
				return g;
			})(),
			wood: new THREE.MeshStandardMaterial({map: wood, roughness: 0.85}),
			wall: new THREE.MeshStandardMaterial({
				color: '#b49a78',
				roughness: 0.9,
			}),
			roof: new THREE.MeshStandardMaterial({
				color: '#4c3a30',
				roughness: 0.8,
				flatShading: true,
			}),
			hall: new THREE.MeshStandardMaterial({
				color: '#cdbfa6',
				roughness: 0.85,
			}),
		};
	}, []);
	return (
		<group>
			{VILLAGE_PIECES.map((pc, i) => {
				const v = Math.min(1, Math.max(0, (build - pc.order) / 0.08));
				if (v <= 0.01) return null;
				const k = 1 - Math.pow(1 - v, 3);
				const geo = pc.kind === 'log' ? parts.log : pc.kind === 'roof' || pc.kind === 'hallRoof' ? parts.gable : pc.kind === 'post' ? parts.post : pc.kind === 'lintel' ? parts.lintel : parts.box;
				const mat = pc.kind === 'house' ? parts.wall : pc.kind === 'hall' ? parts.hall : pc.kind === 'roof' || pc.kind === 'hallRoof' ? parts.roof : parts.wood;
				const grounded = pc.kind === 'log' || pc.kind === 'house' || pc.kind === 'hall' || pc.kind === 'post';
				// 立起来：从地面往上长（屋顶、门楣从上方落下）
				const sy = grounded ? pc.s[1] * k : pc.s[1];
				const y = grounded ? pc.p[1] - (pc.s[1] * (1 - k)) / 2 : pc.p[1] + (1 - k) * 3;
				const scale: V3 = pc.kind === 'post' || pc.kind === 'lintel' ? [1, grounded ? k : 1, 1] : [pc.s[0], sy, pc.s[2]];
				return <mesh key={i} geometry={geo} material={mat} position={[pc.p[0], y, pc.p[2]]} rotation={[0, pc.ry, 0]} scale={scale} castShadow receiveShadow />;
			})}
			{build >= 1
				? [-1, 1].map((sd) => (
						<mesh
							key={sd}
							geometry={parts.door}
							material={parts.wood}
							position={[GATE[0], GATE[1] - 0.2, GATE[2] + sd * 3.05]}
							rotation={[0, (sd * Math.PI * gate) / 2, 0]}
							castShadow
							receiveShadow
						/>
					))
				: null}
		</group>
	);
};

// ── 精灵球（洗翠的样式：上半红色、金属箍，下半木色，中间一道黑带和按钮）──

export const PokeBall: React.FC<{p: V3; ry?: number; r?: number}> = ({p, ry = 0, r = 0.32}) => {
	const m = useMemo(
		() => ({
			red: new THREE.MeshStandardMaterial({
				color: '#b3291f',
				roughness: 0.38,
				metalness: 0.05,
			}),
			wood: new THREE.MeshStandardMaterial({
				map: agedTexture('#8a6a46', 'rgba(40,24,10,0.35)', {
					seed: 33,
					grain: true,
					grimeH: 0.3,
					streaks: 0,
				}),
				roughness: 0.7,
			}),
			band: new THREE.MeshStandardMaterial({
				color: '#2a2622',
				roughness: 0.55,
				metalness: 0.4,
			}),
			metal: new THREE.MeshStandardMaterial({
				color: '#b9b2a2',
				roughness: 0.3,
				metalness: 0.85,
			}),
		}),
		[],
	);
	return (
		<group position={p} rotation={[0.18, ry, 0]}>
			<mesh material={m.red}>
				<sphereGeometry args={[r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
			</mesh>
			<mesh material={m.wood}>
				<sphereGeometry args={[r * 0.995, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
			</mesh>
			{/* 上半的金属箍：一圈横的、一道竖的 */}
			<mesh material={m.metal} position={[0, r * 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[r * 0.84, r * 0.04, 8, 48]} />
			</mesh>
			<mesh material={m.metal} rotation={[0, Math.PI / 2, 0]}>
				<torusGeometry args={[r * 1.01, r * 0.035, 8, 48, Math.PI]} />
			</mesh>
			<mesh material={m.band} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[r * 1.0, r * 0.07, 10, 64]} />
			</mesh>
			<mesh material={m.band} position={[0, 0, r * 0.98]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[r * 0.3, r * 0.3, r * 0.14, 32]} />
			</mesh>
			<mesh material={m.metal} position={[0, 0, r * 1.06]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[r * 0.17, r * 0.17, r * 0.08, 32]} />
			</mesh>
		</group>
	);
};

// ── 布光 ──

const lerpC = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 海岸的天光：夜（dusk 0, day 0）→ 晨昏（dusk 1）→ 白天（day 1）。返回颜色供海面、雾使用 */
export const coastLook = (dusk: number, day: number, red = 0) => {
	const fog = lerpC('#232c3c', '#b597a0', dusk).lerp(new THREE.Color('#aebccc'), day).lerp(new THREE.Color('#5a2a56'), red);
	const sky = lerpC('#33405a', '#d7a59a', dusk).lerp(new THREE.Color('#9fb6d0'), day).lerp(new THREE.Color('#8a3a74'), red);
	const deep = lerpC('#060b14', '#203046', dusk).lerp(new THREE.Color('#1d3a52'), day).lerp(new THREE.Color('#1e0c22'), red);
	const sunCol = lerpC('#8ea2c8', '#ffb27a', dusk).lerp(new THREE.Color('#fff2dc'), day).lerp(new THREE.Color('#f08cb4'), red);
	const sunDir = new THREE.Vector3(...MOON_DIR)
		.normalize()
		.lerp(new THREE.Vector3(...SUN_DIR).normalize(), dusk)
		.lerp(new THREE.Vector3(-0.35, 0.75, 0.55).normalize(), day)
		.normalize();
	return {
		fog: `#${fog.getHexString()}`,
		sky: `#${sky.getHexString()}`,
		deep: `#${deep.getHexString()}`,
		sunCol: `#${sunCol.getHexString()}`,
		sunDir: [sunDir.x, sunDir.y, sunDir.z] as V3,
	};
};

export const CoastLights: React.FC<{
	dusk: number;
	day: number;
	red?: number;
	/** 落雷时一瞬的白光（从裂缝方向来） */
	flash?: number;
	fogNear?: number;
	fogFar?: number;
}> = ({dusk, day, red = 0, flash = 0, fogNear = 160, fogFar = 1300}) => {
	const look = coastLook(dusk, day, red);
	const key = new THREE.Vector3(...look.sunDir).multiplyScalar(400);
	const lum = Math.max(dusk, day);
	return (
		<>
			<Env intensity={lerp(0.06, 0.2, lum)} />
			<fog attach="fog" args={[look.fog, fogNear, fogFar]} />
			<ambientLight intensity={lerp(0.16, 0.26, lum) + 0.08 * red} color={lerpC('#7d8fb2', '#e8d2d6', dusk).lerp(new THREE.Color('#e8eef6'), day).lerp(new THREE.Color('#d48ab8'), red)} />
			<hemisphereLight args={[lerpC('#8ea2c6', '#c8b6d0', dusk).lerp(new THREE.Color('#cfdcec'), day), lerpC('#14161c', '#3a3040', dusk).lerp(new THREE.Color('#5a5650'), day), lerp(0.3, 0.5, lum)]} />
			<directionalLight position={[key.x, key.y, key.z]} intensity={lerp(1.1, 2.2, lum)} color={look.sunCol} />
			<directionalLight position={[60, 80, 300]} intensity={0.3} color={lerpC('#6f86b0', '#a77aa8', dusk)} />
			{flash > 0.001 ? <directionalLight position={[260, 760, -520]} intensity={6 * flash} color="#dfe6ff" /> : null}
		</>
	);
};

// ── 针叶林：一片片散在雪原和山脚，避开海滩、营地、村子和两条路 ──

const avoid: [number, number, number][] = [
	[CAMP_D[0], CAMP_D[2], 48],
	[CAMP_P[0], CAMP_P[2], 48],
	[VILLAGE[0], VILLAGE[2], 40],
	// 对峙的雪地和镜头降下来的路
	[-18, -42, 36],
	[-10, -18, 32],
];
export const TREES: {p: V3; s: number}[] = (() => {
	const r = rng(88);
	const out: {p: V3; s: number}[] = [];
	for (let i = 0; i < 26000 && out.length < 2600; i++) {
		const x = (r() - 0.5) * 1100;
		const z = 20 - r() * 520;
		const d = shoreZ(x) - z;
		if (d < 40) continue;
		if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
		// 两条路（靠岸处 → 营地）附近不长树
		if (Math.abs(x + 30) < 26 && z > -60) continue;
		const patch = fbm(x * 0.012 + 40, z * 0.012 - 13, 3);
		if (patch < 0.56 || r() > (patch - 0.56) * 4) continue;
		out.push({p: [x, coastHeight(x, z) - 0.3, z], s: 0.7 + r() * 0.8});
	}
	return out;
})();

export const Forest: React.FC = () => {
	const mesh = useMemo(() => {
		const g = new THREE.ConeGeometry(1.8, 7.5, 7);
		g.translate(0, 3.75, 0);
		const m = new THREE.MeshStandardMaterial({
			color: '#2f3d37',
			roughness: 0.95,
			flatShading: true,
		});
		const im = new THREE.InstancedMesh(g, m, TREES.length);
		const o = new THREE.Object3D();
		TREES.forEach((t, i) => {
			o.position.set(...t.p);
			o.scale.set(t.s, t.s * (0.9 + (i % 5) * 0.08), t.s);
			o.rotation.y = i;
			o.updateMatrix();
			im.setMatrixAt(i, o.matrix);
		});
		im.instanceMatrix.needsUpdate = true;
		return im;
	}, []);
	return <primitive object={mesh} />;
};
