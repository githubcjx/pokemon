import {useMemo} from 'react';
import * as THREE from 'three';
import {rng} from '../pagodaGeometry';
import {Env, V3} from '../stage';

// ─── 天冠山山顶：地形、天穹、云海、风雪、布光（《神奥之名》）────────────────────
// 山顶平台在原点附近（y = 0），神殿建在上面；四周陡降到云海，远处一圈较低的群山。
// 神阖市镇在西南方山腰的一块台地上（TOWN），云海稀薄时才看得见。

// ── 噪声（确定性，地形与山下物件的摆放共用）──
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
const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** 神阖市镇所在的山腰台地（世界坐标），比山顶低一百多米 */
export const TOWN: V3 = [-95, -70, 190];

/** 脊状噪声：山脊尖、谷底圆 */
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

/** 地形高度：山顶平台（r < 23）四周是峭壁，往下是带山脊的陡坡，远处一圈低一些的雪山 */
export const heightAt = (x: number, z: number) => {
	const r = Math.hypot(x, z);
	// 平台沿神殿的长边（z）拉长成椭圆，边缘按方位角参差不齐（不是一个圆柱形的台子）
	const ang = Math.atan2(z, x);
	const edge = fbm(Math.cos(ang) * 1.6 + 7, Math.sin(ang) * 1.6 - 3, 4) - 0.5;
	const re = Math.hypot(x, z * 0.72) * (1 - 0.2 * edge);
	const drop = 26 + 16 * (fbm(Math.cos(ang) * 2.4 - 11, Math.sin(ang) * 2.4 + 5, 3) - 0.5);
	// 平台：雪面微微起伏
	const top = (fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.45;
	// 峭壁 + 陡坡：先在 26–40 米内骤降二三十米，再一路降到 -120
	const wid = 8 + 26 * (fbm(Math.cos(ang) * 2 + 21, Math.sin(ang) * 2 - 8, 3) - 0.2);
	const cliff = -drop * smooth(26, 26 + Math.max(6, wid), re) - (120 - drop) * smooth(34, 150, re);
	const ridge = ridged(x * 0.018 + 4.1, z * 0.018 - 2.3) * (14 + 30 * smooth(30, 140, r)) * smooth(27, 44, re);
	const crag = (ridged(x * 0.07 + 2, z * 0.07 - 6, 4) - 0.35) * 14 * smooth(26, 34, re) * (1 - smooth(70, 100, re));
	let h = top * (1 - smooth(25, 29, re)) + cliff + ridge + crag;
	// 远处的雪山（比天冠山低）
	const ring = smooth(230, 300, r) * (1 - smooth(470, 560, r));
	h += ring * (30 + 95 * ridged(x * 0.006 - 5.3, z * 0.006 + 2.2, 5));
	// 神阖市镇：远处山腰一片和缓隆起的山肩（大半径过渡，不是陡边的台子）
	const dt = Math.hypot(x - TOWN[0], z - TOWN[2]);
	const shelf = 1 - smooth(22, 90, dt);
	h = h * (1 - shelf) + (TOWN[1] + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 2) * shelf;
	return h;
};

/** 网格坐标 → 世界坐标：中心密、外围疏（山顶附近约 0.4 米一格，远处几米一格） */
const warp = (u: number) => Math.sign(u) * Math.pow(Math.abs(u), 1.9) * 620;

/** 岩石与雪面的细节：一张可平铺的灰度噪声（0.72–1），乘在顶点色上 */
const detailTexture = () => {
	const N = 256;
	const c = document.createElement('canvas');
	c.width = N;
	c.height = N;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(N, N);
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			// 周期为 N 的噪声：在环面上取样，保证无缝平铺
			const a = (x / N) * Math.PI * 2;
			const b = (y / N) * Math.PI * 2;
			const n = fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + Math.cos(b) * 3, 5) * 0.6 + fbm(Math.sin(b) * 6 + 4, Math.cos(a) * 6 - 2, 3) * 0.4;
			const v = Math.round(255 * (0.72 + 0.28 * Math.min(1, Math.max(0, (n - 0.25) * 1.8))));
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

/** 山体：陡坡露出深色岩石，平缓处积雪 */
export const Terrain: React.FC = () => {
	const geo = useMemo(() => {
		const g = new THREE.PlaneGeometry(2, 2, 460, 460);
		g.rotateX(-Math.PI / 2);
		const p = g.attributes.position as THREE.BufferAttribute;
		for (let i = 0; i < p.count; i++) {
			const x = warp(p.getX(i));
			const z = warp(p.getZ(i));
			p.setXYZ(i, x, heightAt(x, z), z);
		}
		g.computeVertexNormals();
		const n = g.attributes.normal as THREE.BufferAttribute;
		const col = new Float32Array(p.count * 3);
		const snow = new THREE.Color('#eef2f8');
		const snowShade = new THREE.Color('#c9d3e2');
		const rock = new THREE.Color('#41444c');
		const c = new THREE.Color();
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i);
			const z = p.getZ(i);
			const ny = n.getY(i);
			const patch = fbm(x * 0.05 + 9, z * 0.05 - 4, 3);
			const snowy = smooth(0.66 + (patch - 0.5) * 0.25, 0.8 + (patch - 0.5) * 0.25, ny);
			c.copy(rock).offsetHSL(0, 0, (hash2(x * 0.9, z * 0.9) - 0.5) * 0.06);
			c.lerp(snowShade.clone().lerp(snow, smooth(0.85, 0.98, ny)), snowy);
			col.set([c.r, c.g, c.b], i * 3);
		}
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		const uv = g.attributes.uv as THREE.BufferAttribute;
		for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 7, (p.getZ(i) + p.getY(i) * 0.6) / 7);
		return g;
	}, []);
	const mat = useMemo(() => new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.9, map: detailTexture()}), []);
	return <mesh geometry={geo} material={mat} receiveShadow castShadow />;
};

// ── 天穹 ──

const SKY_VERT = `
varying vec3 vWorld;
void main() {
	vec4 w = modelMatrix * vec4(position, 1.0);
	vWorld = w.xyz;
	gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SKY_FRAG = `
uniform vec3 uCam;
uniform float uDusk;     // 0 = 月夜，1 = 古代的黄昏
uniform float uStarRot;  // 星空绕天顶转过的角度（时间倒流时快速倒转）
uniform float uTrail;    // 星轨拖尾的弧度
uniform vec3 uMoonDir;
uniform vec3 uSunDir;
uniform vec3 uGoldDir;
uniform float uGold;     // 天上的金光（神奥大尊）
uniform float uDay;      // 白天（第 2 段海岸）
uniform float uRed;      // 异变的红天（第 3 段）
uniform float uRift;     // 时空裂缝张开的程度（第 3 段）
uniform float uCanopy;   // 裂缝四周紫灰的天幕
uniform vec3 uRiftDir;   // 从相机望向裂缝光核的方向
uniform float uTime;
varying vec3 vWorld;

float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float svn(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
float sfbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * svn(p); p *= 2.03; a *= 0.5; } return v; }

const float CELLS = 70.0;
// 星空：按纬度分成一圈圈的环带，每个经度格里一颗星。星空绕竖轴转，星轨就是沿环带的一段弧：
// 沿当前经度往回找 trail 弧度以内的格子，像素落在某颗星扫过的弧上就亮（越靠近星的当前位置越亮）。
vec3 stars(vec3 d, float rot, float trail) {
	float lat = asin(clamp(d.y, -1.0, 1.0));
	float row = floor(lat * CELLS);
	float ringN = max(6.0, floor(cos((row + 0.5) / CELLS) * CELLS * 6.2832));
	float lon = atan(d.z, d.x) - rot;
	lon = mod(lon, 6.2832);
	float cellW = 6.2832 / ringN;
	float ci = floor(lon / cellW);
	vec3 acc = vec3(0.0);
	int steps = int(min(90.0, trail / cellW + 2.0));
	for (int k = 0; k < 92; k++) {
		if (k > steps) break;
		float id = mod(ci - float(k), ringN);
		vec2 key = vec2(row, id);
		float r = h1(key);
		if (r < 0.62) continue;
		float sl = (id + 0.2 + 0.6 * h1(key + 3.7)) * cellW;
		float sLat = (row + 0.2 + 0.6 * h1(key + 9.1)) / CELLS;
		float dl = mod(lon - sl + 3.1416, 6.2832) - 3.1416; // 像素在星的当前位置之后多远（弧度）
		float w = (r - 0.62) / 0.38;
		float bright = 0.25 + 1.6 * pow(w, 6.0);
		float dLat = abs(lat - sLat) * 1100.0;
		float dotS = smoothstep(1.6, 0.0, length(vec2(dl * cos(lat) * 1100.0, dLat)));
		float arc = 0.0;
		if (trail > 0.002 && dl < 0.0 && dl > -trail) arc = smoothstep(1.1, 0.0, dLat) * (1.0 + dl / trail) * 0.7;
		vec3 tint = mix(vec3(0.75, 0.84, 1.0), vec3(1.0, 0.93, 0.82), h1(key + 1.3));
		acc += tint * bright * max(dotS, arc);
	}
	return acc;
}

void main() {
	vec3 d = normalize(vWorld - uCam);
	float up = clamp(d.y, -0.2, 1.0);
	// 月夜：地平线灰蓝，往上渐深
	vec3 night = mix(vec3(0.2, 0.25, 0.33), vec3(0.022, 0.034, 0.075), smoothstep(-0.05, 0.6, up));
	// 黄昏：天顶深蓝、中天淡紫，只在地平线留一窄条暖金
	vec3 dusk = mix(vec3(0.96, 0.7, 0.46), vec3(0.62, 0.5, 0.62), smoothstep(-0.02, 0.1, up));
	dusk = mix(dusk, vec3(0.3, 0.32, 0.52), smoothstep(0.08, 0.36, up));
	dusk = mix(dusk, vec3(0.1, 0.13, 0.27), smoothstep(0.3, 0.9, up));
	vec3 col = mix(night, dusk, uDusk);
	// 白天：地平线灰白，天顶清蓝
	vec3 day = mix(vec3(0.82, 0.86, 0.9), vec3(0.36, 0.53, 0.78), smoothstep(-0.02, 0.55, up));
	col = mix(col, day, uDay);
	// 异变的红天：紫红的天幕上一团团洋红、粉红的斑块，夹着几缕绿（照游戏截图）
	if (uRed > 0.001) {
		vec2 q = d.xz / max(d.y + 0.25, 0.08) * 1.4 + vec2(uTime * 0.02, uTime * 0.012);
		float n1 = sfbm(q * 1.3);
		float n2 = sfbm(q * 3.1 + 5.2 + uTime * 0.03);
		float n3 = sfbm(q * 0.7 - 3.1);
		vec3 red = mix(vec3(0.34, 0.12, 0.36), vec3(0.5, 0.16, 0.42), smoothstep(-0.05, 0.6, up));
		red = mix(red, vec3(0.18, 0.42, 0.3), smoothstep(0.55, 0.8, n3) * 0.75);
		red = mix(red, vec3(0.95, 0.28, 0.42), smoothstep(0.52, 0.72, n2) * smoothstep(0.35, 0.6, n1));
		red = mix(red, vec3(1.0, 0.5, 0.45), smoothstep(0.66, 0.8, n2) * 0.6);
		col = mix(col, red, uRed);
	}

	// 时空裂缝：紫灰天幕，正中一团白蓝的强光，向四周炸出闪电状的裂纹（照游戏截图）
	float riftLight = 0.0;
	if (uCanopy > 0.001 || uRift > 0.001) {
		vec3 rd = normalize(uRiftDir);
		vec3 ru = normalize(cross(rd, vec3(0.0, 1.0, 0.0)));
		vec3 rv = cross(ru, rd);
		float ang = acos(clamp(dot(d, rd), -1.0, 1.0));
		float phi = atan(dot(d, rv), dot(d, ru));
		// 天幕：翻涌的云，越靠近裂缝越浓
		vec2 cq = vec2(phi * 2.0, ang * 7.0 - uTime * 0.05);
		float cl = sfbm(cq * 1.6 + sfbm(cq * 0.8) * 1.2);
		float near = 1.0 - smoothstep(0.2, 1.4, ang);
		vec3 canopy = mix(vec3(0.17, 0.14, 0.22), vec3(0.42, 0.36, 0.5), smoothstep(0.3, 0.75, cl));
		float cov = uCanopy * smoothstep(-0.06, 0.12, up) * (0.55 + 0.45 * near);
		col = mix(col, canopy, cov);
		// 光核与裂纹
		float sz = 0.16 * uRift;
		float core = exp(-ang / max(sz * 0.55, 0.002)) * uRift;
		float cracks = 0.0;
		for (int k = 0; k < 16; k++) {
			float fk = float(k);
			float th = fk * 0.3927 + (h1(vec2(fk, 3.1)) - 0.5) * 0.3;
			float len = (1.2 + 2.4 * h1(vec2(fk, 7.7))) * sz;
			float rr = ang / max(len, 0.001);
			if (rr > 1.0) continue;
			float wig = (svn(vec2(ang * 22.0, fk * 4.0)) - 0.5) * 0.16 + (svn(vec2(ang * 120.0, fk * 9.0)) - 0.5) * 0.04;
			float dphi = abs(mod(phi - th - wig + 3.14159, 6.28318) - 3.14159);
			// 越靠近光核越粗，往外收成尖
			float w = 0.012 / max(ang, 0.012) * pow(1.0 - rr, 1.3) + 0.002;
			cracks += smoothstep(w, 0.0, dphi) * (1.0 - rr) * 1.6 + smoothstep(w * 4.0, 0.0, dphi) * (1.0 - rr) * 0.3;
		}
		riftLight = core * 2.2 + cracks * uRift;
		col += vec3(0.82, 0.88, 1.0) * riftLight + vec3(0.55, 0.45, 0.85) * core * 0.6 * smoothstep(0.0, 0.5, ang / max(sz, 0.001));
	}
	float starVis = (1.0 - uDusk * 0.8) * (1.0 - uDay) * (1.0 - uRed) * (1.0 - uCanopy) * smoothstep(-0.02, 0.22, up);
	if (starVis > 0.01) col += stars(d, uStarRot, uTrail) * starVis;

	// 月亮
	float m = dot(d, normalize(uMoonDir));
	col += (1.0 - uDusk) * (1.0 - uDay) * (1.0 - uCanopy) * (vec3(0.95, 0.97, 1.0) * smoothstep(0.99955, 0.99975, m) * 1.6 + vec3(0.45, 0.55, 0.75) * pow(max(m, 0.0), 220.0) * 0.55 + vec3(0.25, 0.32, 0.45) * pow(max(m, 0.0), 16.0) * 0.18);
	// 夕阳的光晕（太阳本身在地平线下）
	float s = dot(d, normalize(uSunDir));
	col += uDusk * (vec3(1.0, 0.76, 0.48) * pow(max(s, 0.0), 30.0) * 0.55 + vec3(1.0, 0.6, 0.4) * pow(max(s, 0.0), 4.0) * 0.16);
	// 神奥大尊的金光：一点白金的光核，外圈柔和的晕
	float gd = dot(d, normalize(uGoldDir));
	col += uGold * (vec3(1.0, 0.96, 0.84) * smoothstep(0.9993, 0.9998, gd) * 1.5 + vec3(1.0, 0.86, 0.55) * pow(max(gd, 0.0), 300.0) * 0.8 + vec3(1.0, 0.78, 0.45) * pow(max(gd, 0.0), 14.0) * 0.22);
	gl_FragColor = vec4(col, 1.0);
}`;

export type SkyState = {dusk: number; starRot: number; trail: number; gold: number; day?: number; red?: number; time?: number; rift?: number; canopy?: number; riftDir?: V3};

export const MOON_DIR: V3 = [0.18, 0.34, -1];
export const SUN_DIR: V3 = [-0.55, 0.1, 0.83];
export const GOLD_DIR: V3 = [0, 0.62, -1];

/** 天穹：跟着相机走的大球，永远画在最远处 */
export const Sky: React.FC<{cam: V3; s: SkyState}> = ({cam, s}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: SKY_VERT,
				fragmentShader: SKY_FRAG,
				side: THREE.BackSide,
				depthWrite: false,
				fog: false,
				uniforms: {
					uCam: {value: new THREE.Vector3()},
					uDusk: {value: 0},
					uStarRot: {value: 0},
					uTrail: {value: 0},
					uMoonDir: {value: new THREE.Vector3(...MOON_DIR)},
					uSunDir: {value: new THREE.Vector3(...SUN_DIR)},
					uGoldDir: {value: new THREE.Vector3(...GOLD_DIR)},
					uGold: {value: 0},
					uDay: {value: 0},
					uRed: {value: 0},
					uRift: {value: 0},
					uCanopy: {value: 0},
					uRiftDir: {value: new THREE.Vector3(0, 1, 0)},
					uTime: {value: 0},
				},
			}),
		[],
	);
	mat.uniforms.uCam.value.set(...cam);
	mat.uniforms.uDay.value = s.day ?? 0;
	mat.uniforms.uRed.value = s.red ?? 0;
	mat.uniforms.uRift.value = s.rift ?? 0;
	mat.uniforms.uCanopy.value = s.canopy ?? 0;
	if (s.riftDir) mat.uniforms.uRiftDir.value.set(...s.riftDir);
	mat.uniforms.uTime.value = s.time ?? 0;
	mat.uniforms.uDusk.value = s.dusk;
	mat.uniforms.uStarRot.value = s.starRot;
	mat.uniforms.uTrail.value = s.trail;
	mat.uniforms.uGold.value = s.gold;
	return (
		<mesh position={cam} material={mat} renderOrder={-10} frustumCulled={false}>
			<sphereGeometry args={[560, 64, 32]} />
		</mesh>
	);
};

// ── 云海 ──

const CLOUD_FRAG = `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uShade;
uniform vec3 uCam;
varying vec3 vWorld;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * vn(p); p *= 2.02; a *= 0.5; } return v; }
void main() {
	vec2 p = vWorld.xz * 0.012 + vec2(uTime * 0.004, uTime * 0.0015);
	float n = fbm(p + fbm(p * 0.7 + 3.0) * 0.8);
	float c = smoothstep(0.38, 0.72, n);
	float dist = length(vWorld.xz - uCam.xz);
	float fade = smoothstep(20.0, 60.0, dist) * (1.0 - smoothstep(380.0, 520.0, dist));
	vec3 col = mix(uShade, uColor, smoothstep(0.4, 0.85, n));
	gl_FragColor = vec4(col, c * uOpacity * fade);

}`;

export const CloudSea: React.FC<{y: number; opacity: number; time: number; color: string; shade: string; cam: V3}> = ({y, opacity, time, color, shade, cam}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: SKY_VERT,
				fragmentShader: CLOUD_FRAG,
				transparent: true,
				depthWrite: false,
				fog: false,
				uniforms: {
					uTime: {value: 0},
					uOpacity: {value: 1},
					uColor: {value: new THREE.Color()},
					uShade: {value: new THREE.Color()},
					uCam: {value: new THREE.Vector3()},
				},
			}),
		[],
	);
	mat.uniforms.uTime.value = time;
	mat.uniforms.uOpacity.value = opacity;
	mat.uniforms.uColor.value.set(color);
	mat.uniforms.uShade.value.set(shade);
	mat.uniforms.uCam.value.set(...cam);
	if (opacity <= 0.001) return null;
	return (
		<mesh position={[cam[0], y, cam[2]]} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={1}>
			<planeGeometry args={[1100, 1100]} />
		</mesh>
	);
};

// ── 风雪 ──

/** 飘落的雪：在相机周围一个盒子里循环下落、随风横移 */
let flakeTex: THREE.Texture | null = null;
const flakeTexture = () => {
	if (flakeTex) return flakeTex;
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
	g.addColorStop(0, 'rgba(255,255,255,1)');
	g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
	g.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 64, 64);
	flakeTex = new THREE.CanvasTexture(c);
	return flakeTex;
};

export const Snow: React.FC<{cam: V3; time: number; amount: number; wind?: number; color?: string}> = ({cam, time, amount, wind = 1, color = '#e8eef8'}) => {
	const N = 2600;
	const seeds = useMemo(() => {
		const r = rng(31);
		return Array.from({length: N}, () => [r(), r(), r(), r()]);
	}, []);
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
		return g;
	}, []);
	// 圆形柔边的雪片（不贴图时 PointsMaterial 画的是方块）
	const mat = useMemo(() => new THREE.PointsMaterial({size: 0.13, map: flakeTexture(), transparent: true, depthWrite: false, sizeAttenuation: true}), []);
	const B = 36;
	const p = geo.attributes.position as THREE.BufferAttribute;
	const wrap = (v: number) => ((v % B) + B) % B - B / 2;
	for (let i = 0; i < N; i++) {
		const [a, b, c, d] = seeds[i];
		const fall = time * (0.9 + d * 0.7);
		const drift = time * wind * (1.6 + c);
		p.setXYZ(
			i,
			cam[0] + wrap(a * B + drift + Math.sin(time * 0.6 + d * 9) * 0.6 - cam[0]),
			cam[1] + wrap(b * B - fall - cam[1]),
			cam[2] + wrap(c * B + drift * 0.3 - cam[2]),
		);
	}
	p.needsUpdate = true;
	mat.opacity = Math.min(1, amount);
	mat.color.set(color);
	if (amount <= 0.001) return null;
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

// ── 布光 ──

const lerpC = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 月夜（dusk = 0）↔ 古代的黄昏（dusk = 1）。月光从北方高处来，夕阳从西南方低处来（正对神殿正面偏左）。
 * gold：天上神奥大尊的金光，从北方高空洒下。
 */
export const CoronetLights: React.FC<{dusk: number; gold?: number; fogNear?: number; fogFar?: number}> = ({dusk, gold = 0, fogNear = 90, fogFar = 640}) => {
	const t = dusk;
	const key = new THREE.Vector3(...MOON_DIR).normalize().lerp(new THREE.Vector3(...SUN_DIR).normalize(), t).normalize().multiplyScalar(90);
	return (
		<>
			<Env intensity={lerp(0.12, 0.25, t)} />
			<fog attach="fog" args={[lerpC('#2a3445', '#a99aae', t), fogNear, fogFar]} />
			<ambientLight intensity={lerp(0.42, 0.4, t)} color={lerpC('#8193b5', '#e6d0dc', t)} />
			<hemisphereLight args={[lerpC('#90a4c8', '#c4b8d8', t), lerpC('#1e2026', '#3a3040', t), lerp(0.7, 0.6, t)]} />
			<directionalLight
				position={[key.x, key.y, key.z]}
				intensity={lerp(2.4, 3.1, t)}
				color={lerpC('#c4d3ee', '#ffc690', t)}
				castShadow
				shadow-mapSize={[4096, 4096]}
				shadow-camera-left={-34}
				shadow-camera-right={34}
				shadow-camera-top={34}
				shadow-camera-bottom={-34}
				shadow-camera-near={1}
				shadow-camera-far={220}
				shadow-bias={-0.0004}
				shadow-normalBias={0.04}
			/>
			{/* 背面的轮廓光：月夜偏冷，黄昏偏紫 */}
			<directionalLight position={[-40, 30, -60]} intensity={lerp(0.5, 0.45, t)} color={lerpC('#6f86b0', '#a77aa8', t)} />
			{gold > 0 ? <directionalLight position={[0, 80, -110]} intensity={2.2 * gold} color="#ffd98c" /> : null}
		</>
	);
};
