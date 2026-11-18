// ─── 《为彼而去》阿露福石室：玄武岩石墙 + 刻在墙上的未知图腾 ───────────────────────────
// 石墙与所有未知图腾画在同一个 WebGL 画布里（未知图腾成群出现，不能每只占一个 WebGL 上下文）。
// 坐标：世界坐标以像素计，y 向下，与 camera.ts 的 2.5D 摄像机一致；光源 z = 离墙面的距离（朝向观众）。
// 未知图腾的两种状态：carve = 0 时是凹刻在石头里的浮雕（形状来自立绘轮廓与法线），
// carve = 1 时就是原立绘（只受打光影响）。eye 控制眼睑从中线张开，只在睁眼过程中做遮罩。

export const MAX_LIGHTS = 3;

const HEADER = `#version 300 es
precision highp float;
uniform vec4 uCam;      // x, y, zoom, roll（度）
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform float uLightRad[${MAX_LIGHTS}];
uniform vec3 uAmbient;
uniform float uGold;     // 墙上刻线里流动的金光
uniform float uGoldPhase;
uniform float uFloorOn;  // 是否画地面（第 1 段看不到地面，关着）
uniform float uBase;     // 墙脚 / 地面的世界 y
uniform float uDc;       // 针孔相机到墙面的距离（世界像素），墙面上的缩放 = zoom
uniform float uPitch;    // 相机俯角（度，向下为正）；0 时与纯 2.5D 的墙面完全一致
uniform float uCamZ;     // 相机离墙的距离（推轨）；= uDc 时墙面上的缩放正好是 zoom
uniform vec4 uDoor;      // 通往外面的门洞：中心 x、半宽、拱脚 y、是否有门洞
uniform float uOutside;  // 门外夜色的亮度（月光）
uniform float uDay;      // 门外的白天（第 4 段的延时摄影）：0 夜 1 昼
uniform vec4 uGoldWave;  // 墙上金光的扩散：中心 x、y、半径、是否启用（不启用时整面墙一起亮）
`;

const NOISE = `
float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
	float v = 0.0, a = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}
`;

/** 石墙：错缝砌成的玄武岩石块，凿痕、风化坑、灰缝；返回高度（像素） */
const STONE = `
const vec2 BLOCK = vec2(430.0, 250.0);
vec3 blockInfo(vec2 w) {
	float row = floor(w.y / BLOCK.y);
	float off = fract(row * 0.618) * BLOCK.x;
	vec2 b = vec2((w.x + off) / BLOCK.x, w.y / BLOCK.y);
	vec2 id = floor(b);
	vec2 f = fract(b);
	vec2 dpx = min(f, 1.0 - f) * BLOCK;
	// 石块边缘不规整：风化、崩角
	float rough = (noise(w * 0.035) - 0.5) * 16.0 + (noise(w * 0.12) - 0.5) * 5.0;
	return vec3(min(dpx.x, dpx.y) + rough, hash(id + 7.3), hash(id + 1.9));
}
float stoneHeight(vec2 w) {
	vec3 bi = blockInfo(w);
	// 石块边缘的倒角与灰缝
	float bevel = smoothstep(3.0, 26.0, bi.x);
	float h = bevel * 14.0;
	// 每块石头略有起伏，表面风化
	h += (fbm(w * 0.004 + bi.y * 17.0) - 0.5) * 10.0 * bevel;
	h += (fbm(w * 0.03 + bi.z * 9.0) - 0.5) * 3.2;
	h += (noise(w * 0.16) - 0.5) * 0.7;
	// 风化坑
	float pit = smoothstep(0.72, 0.86, fbm(w * 0.012 + 3.1));
	h -= pit * 4.0;
	// 斜向凿痕
	float chisel = sin((w.x * 0.7 + w.y) * 0.22 + fbm(w * 0.02) * 6.0);
	h += chisel * 0.15 * bevel;
	return h;
}
vec3 stoneAlbedo(vec2 w) {
	vec3 bi = blockInfo(w);
	float v = 0.75 + 0.5 * fbm(w * 0.01 + bi.y * 5.0);
	vec3 base = vec3(0.046, 0.044, 0.043) * v * (0.8 + 0.4 * bi.z);
	// 烟熏与水渍：大片的明暗变化
	base *= 0.55 + 0.75 * smoothstep(0.25, 0.75, fbm(w * 0.0016 + 4.0));
	// 少量浅色矿物斑点
	float fleck = smoothstep(0.93, 0.99, hash(floor(w * 0.5)));
	base += fleck * vec3(0.05, 0.045, 0.04);
	// 灰缝更暗
	base *= mix(0.45, 1.0, smoothstep(2.0, 12.0, bi.x));
	return base;
}
vec3 stoneNormal(vec2 w) {
	float e = 1.5;
	float hx = stoneHeight(w + vec2(e, 0.0)) - stoneHeight(w - vec2(e, 0.0));
	float hy = stoneHeight(w + vec2(0.0, e)) - stoneHeight(w - vec2(0.0, e));
	return normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));
}
`;

const LIGHT = `
vec3 lightAt(vec3 p, vec3 n, float specAmt) {
	vec3 c = uAmbient;
	for (int i = 0; i < ${MAX_LIGHTS}; i++) {
		vec3 d = uLightPos[i] - p;
		float dist = length(d);
		vec3 L = d / dist;
		float att = pow(1.0 / (1.0 + pow(dist / uLightRad[i], 2.0)), 3.0);
		float diff = max(dot(n, L), 0.0);
		vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
		float spec = pow(max(dot(n, H), 0.0), 36.0) * specAmt;
		c += uLightCol[i] * att * (diff + spec);
	}
	return c;
}
vec2 rot2(vec2 v, float deg) {
	float a = radians(deg);
	return vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a));
}
// 门洞：矩形下半 + 半圆拱顶。返回到门洞边缘的距离（门洞外为正）
float doorDist(vec2 w) {
	vec2 d = w - vec2(uDoor.x, uDoor.z);
	float hw = uDoor.y;
	float arch = length(d) - hw;
	float box = max(abs(d.x) - hw, -d.y);
	return d.y < 0.0 ? arch : max(box, d.y - (uBase - uDoor.z));
}
float insideDoor(vec2 w) { return step(doorDist(w), 0.0); }
// 地面的石纹坐标：(x, 离墙距离 z)，石板比墙砖大，与墙面纹理错开
vec2 floorSurf(vec2 xz) { return xz * 0.72 + vec2(311.0, 9137.0); }
// 相机：位于 (cam.x, cam.y, Dc)，焦距 = zoom × Dc，绕 x 轴俯仰
vec3 camToWorld(vec3 v, float pitch) {
	float a = radians(pitch);
	return vec3(v.x, v.y * cos(a) - v.z * sin(a), v.y * sin(a) + v.z * cos(a));
}
vec3 worldToCam(vec3 v, float pitch) {
	float a = radians(pitch);
	return vec3(v.x, v.y * cos(a) + v.z * sin(a), -v.y * sin(a) + v.z * cos(a));
}
`;

export const WALL_FRAG = `${HEADER}
out vec4 outColor;
${NOISE}
${STONE}
${LIGHT}
void main() {
	// 屏幕 → 墙面世界坐标（camera.ts 的 unproject，k = 1）
	vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec2 rel = rot2(s - vec2(960.0, 540.0), -uCam.w);
	// 射线与墙面（z = 0）、地面（y = uBase）求交
	vec3 O = vec3(uCam.xy, uCamZ);
	vec3 dir = camToWorld(vec3(rel / (uCam.z * uDc), -1.0), uPitch);
	vec2 w = (O + dir * (-O.z / dir.z)).xy;
	vec3 col;
	if (uFloorOn > 0.5 && w.y > uBase && dir.y > 0.0) {
		vec3 hit = O + dir * ((uBase - O.y) / dir.y);
		float z = hit.z;
		float x = hit.x;
		vec2 fs = floorSurf(vec2(x, z));
		float e = 1.5;
		float h = stoneHeight(fs);
		float hx = (stoneHeight(fs + vec2(e, 0.0)) - stoneHeight(fs - vec2(e, 0.0))) / (2.0 * e) * 0.72;
		float hz = (stoneHeight(fs + vec2(0.0, e)) - stoneHeight(fs - vec2(0.0, e))) / (2.0 * e) * 0.72;
		vec3 n = normalize(vec3(-hx, -1.0, -hz));
		vec3 p = vec3(x, uBase - h, z);
		col = stoneAlbedo(fs) * 1.15 * lightAt(p, n, 0.3);
		// 墙脚的阴影
		col *= 0.55 + 0.45 * smoothstep(0.0, 140.0, z);
	} else if (uDoor.w > 0.5 && insideDoor(w) > 0.5) {
		// 门洞外：夜里的地面与天空（射线穿过门洞继续向外）
		if (dir.y > 0.0) {
			vec3 hit = O + dir * ((uBase - O.y) / dir.y);
			vec2 gs = hit.xz * 0.6 + vec2(57.0, 311.0);
			float g = fbm(gs * 0.01) * 0.7 + fbm(gs * 0.05) * 0.3;
			vec3 earth = vec3(0.035, 0.034, 0.036) * (0.6 + 0.8 * g);
			col = earth * (lightAt(hit, vec3(0.0, -1.0, 0.0), 0.0) + vec3(0.09, 0.11, 0.18) * uOutside);
			// 远处融进夜雾
			float fog = smoothstep(300.0, 2600.0, -hit.z);
			col = mix(col, vec3(0.005, 0.0065, 0.012) * uOutside, fog);
			if (uDay > 0.0) {
				vec3 dayG = vec3(0.32, 0.29, 0.22) * (0.6 + 0.8 * g);
				col = mix(col, mix(dayG, vec3(0.55, 0.62, 0.72), fog), uDay);
			}
		} else {
			float up = clamp(-dir.y * 2.0, 0.0, 1.0);
			col = mix(vec3(0.03, 0.04, 0.075), vec3(0.004, 0.006, 0.016), pow(up, 0.6)) * uOutside * 1.5;
			vec2 st = floor(dir.xy * 900.0);
			col += step(0.997, hash(st)) * vec3(0.5, 0.55, 0.7) * uOutside * smoothstep(0.02, 0.12, -dir.y);
			// 远山与树林的剪影
			float hill = 0.018 + 0.03 * fbm(vec2(dir.x * 7.0, 3.1)) + 0.012 * fbm(vec2(dir.x * 40.0, 7.7));
			col = mix(col, vec3(0.002, 0.0025, 0.004) * uOutside, smoothstep(hill + 0.002, hill - 0.002, -dir.y));
			if (uDay > 0.0) {
				vec3 sky = mix(vec3(0.85, 0.9, 0.95), vec3(0.35, 0.5, 0.8), pow(up, 0.6));
				sky = mix(sky, vec3(0.2, 0.24, 0.22), smoothstep(hill + 0.002, hill - 0.002, -dir.y));
				col = mix(col, sky, uDay);
			}
		}
	} else {
		float h = stoneHeight(w);
		vec3 n = stoneNormal(w);
		col = stoneAlbedo(w) * lightAt(vec3(w, h), n, 0.25);
		if (uDoor.w > 0.5) {
			// 门框：门洞边缘一圈凿出的石框，内侧是门洞的厚度（暗）
			float dd = doorDist(w);
			col *= mix(1.0, 0.35, smoothstep(40.0, 0.0, dd));
			col += stoneAlbedo(w) * 0.6 * smoothstep(46.0, 30.0, dd) * smoothstep(18.0, 30.0, dd) * lightAt(vec3(w, h + 20.0), vec3(0.0, 0.0, 1.0), 0.0);
		}
		// 刻线里的金光：沿石块上下边缘的细槽流动
		if (uGold > 0.0) {
			vec3 bi = blockInfo(w);
			float groove = 1.0 - smoothstep(0.0, 5.0, abs(bi.x - 20.0));
			float flow = 0.5 + 0.5 * sin(w.x * 0.012 - uGoldPhase + bi.y * 6.0);
			float wave = uGoldWave.w > 0.5 ? smoothstep(uGoldWave.z, uGoldWave.z - 500.0, length(w - uGoldWave.xy)) * (1.0 + 1.6 * smoothstep(260.0, 0.0, abs(length(w - uGoldWave.xy) - uGoldWave.z + 130.0))) : 1.0;
			col += vec3(1.0, 0.68, 0.28) * groove * flow * uGold * 0.35 * wave;
		}
	}
	outColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}
`;

export const UNOWN_VERT = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec4 aA; // x, y, size, rot（地面上：x, z, size, rot）
in vec4 aB; // form, carve, eye, gold
in vec4 aC; // alpha, k（景深，只用于墙面层）, eyeGlow, plane（0 墙面 1 地面 2 空中）
in vec4 aD; // z（空中的离墙距离）, atlas（0 未知图腾 1 拼图浮雕）, tiles（拼图分块缝）, daylight（外面的天光）
uniform vec4 uCam;
uniform float uBase;
uniform float uDc;
uniform float uPitch;
uniform float uCamZ;
const float PAD = 1.18;
out vec2 vUV;
out vec3 vPos;
out vec4 vB;
out vec4 vC;
out vec4 vD;
out float vRot;
out float vSize;
vec2 rot2(vec2 v, float deg) {
	float a = radians(deg);
	return vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a));
}
vec3 worldToCam(vec3 v, float pitch) {
	float a = radians(pitch);
	return vec3(v.x, v.y * cos(a) + v.z * sin(a), -v.y * sin(a) + v.z * cos(a));
}
void main() {
	float pad = aD.z > 1.75 ? 1.6 : aD.z > 0.5 ? 1.14 : PAD;
	vec2 local = rot2(aCorner * aA.z * pad, aA.w);
	float plane = aC.w;
	vec2 C = vec2(960.0, 540.0);
	if (plane < 0.5 && abs(aC.y - 1.0) > 1e-4) {
		vec2 w = aA.xy + local;
		float k = aC.y;
		float s = 1.0 + (uCam.z - 1.0) * k;
		vec2 v = (w - C - (uCam.xy - C) * k) * s;
		vec2 scr = rot2(v, uCam.w) + C;
		gl_Position = vec4(scr.x / 960.0 - 1.0, 1.0 - scr.y / 540.0, 0.0, 1.0);
		vPos = vec3(w, 0.0);
	} else {
		// 针孔透视：墙面、地面或空中的点
		vec3 p = plane < 0.5 ? vec3(aA.xy + local, 0.0) : plane < 1.5 ? vec3(aA.x + local.x, uBase, aA.y + local.y) : vec3(aA.xy + local, aD.x);
		vec3 v = worldToCam(p - vec3(uCam.xy, uCamZ), uPitch);
		float wq = -v.z / uDc;
		vec2 scr = rot2(v.xy * uCam.z / wq, uCam.w) + C;
		gl_Position = vec4((scr.x / 960.0 - 1.0) * wq, (1.0 - scr.y / 540.0) * wq, 0.0, wq);
		vPos = p;
	}
	vUV = aCorner * pad + 0.5;
	vB = aB;
	vC = aC;
	vD = aD;
	vRot = aA.w;
	vSize = aA.z;
}
`;

export const UNOWN_FRAG = `${HEADER}
in vec2 vUV;
in vec3 vPos;
in vec4 vB;
in vec4 vC;
in vec4 vD;
in float vRot;
in float vSize;
out vec4 outColor;
uniform sampler2D uArt;
uniform sampler2D uNormal;
uniform sampler2D uRelief;
uniform sampler2D uReliefN;
uniform vec2 uGrid;            // 图集列数、行数
uniform vec3 uEyes[28];        // 每种形态的眼睛中心与半径（格子内 0..1）
${NOISE}
${STONE}
${LIGHT}
vec2 cellUV(vec2 uv, float form, vec2 grid) {
	vec2 cell = vec2(mod(form, grid.x), floor(form / grid.x));
	return (cell + clamp(uv, 0.002, 0.998)) / grid;
}
vec4 artAt(vec2 uv, float form, bool relief, float lod) {
	return relief ? textureLod(uRelief, cellUV(uv, form, vec2(2.0)), lod) : textureLod(uArt, cellUV(uv, form, uGrid), lod);
}
// 图像空间（x 右、y 下、z 朝外）→ 世界空间（地面上：图像的下方 = 朝向观众，朝外 = 向上）
vec3 toWorld(vec3 n, float plane) {
	return plane > 0.5 && plane < 1.5 ? vec3(n.x, -n.z, n.y) : n;
}
void main() {
	float form = vB.x, carve = vB.y, eye = vB.z, gold = vB.w;
	float alpha = vC.x, eyeGlow = vC.z, plane = vC.w;
	bool relief = vD.y > 0.5;
	bool floorP = plane > 0.5 && plane < 1.5;
	// 拼图石板：tiles = 1 整块；1.5 空的石槽（拼块全掉了时露出来）；>= 2 单独一块拼块（编号 tiles - 2，4×4 按行）
	vec2 uv = vUV;
	bool board = vD.z > 1.25 && vD.z < 1.75;
	if (vD.z > 1.75) {
		float t = floor(vD.z - 2.0 + 0.5);
		vec2 tp = vec2(mod(t, 4.0), floor(t / 4.0));
		vec2 lo = vec2(tp.x < 0.5 ? -0.28 : 0.0, tp.y < 0.5 ? -0.28 : 0.0);
		vec2 hi = vec2(tp.x > 2.5 ? 1.28 : 1.0, tp.y > 2.5 ? 1.28 : 1.0);
		if (any(lessThan(vUV, lo)) || any(greaterThan(vUV, hi))) discard;
		uv = (tp + vUV) / 4.0;
	}
	bool inside = !board && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
	vec2 grid = relief ? vec2(2.0) : uGrid;
	vec2 auv = cellUV(uv, form, grid);
	vec4 art = inside ? (relief ? texture(uRelief, auv) : texture(uArt, auv)) : vec4(0.0);
	// 轮廓外的柔光圈（金光）：取模糊的 alpha
	float blurA = artAt(uv, form, relief, 3.5).a * (inside ? 1.0 : smoothstep(0.12, 0.0, max(max(-uv.x, uv.x - 1.0), max(-uv.y, uv.y - 1.0))));
	float ring = clamp(blurA * 1.6 - art.a, 0.0, 1.0);

	vec3 nArt = (relief ? texture(uReliefN, auv).xyz : texture(uNormal, auv).xyz) * 2.0 - 1.0;
	nArt.xy *= 0.55;
	if (relief) {
		// 浮雕：立绘的描线刻成细槽（取明度的梯度）
		float de = 1.5 / 1600.0;
		float l0 = dot(texture(uRelief, auv).rgb, vec3(0.333));
		float lx = dot(texture(uRelief, auv + vec2(de, 0.0)).rgb, vec3(0.333)) - l0;
		float ly = dot(texture(uRelief, auv + vec2(0.0, de)).rgb, vec3(0.333)) - l0;
		nArt.xy += vec2(lx, ly) * 3.0;
	}
	nArt = normalize(vec3(rot2(nArt.xy, vRot), nArt.z));

	// 所在表面的石纹坐标与基准点
	vec2 surf = floorP ? floorSurf(vPos.xz) : vPos.xy;
	float h0 = plane > 1.5 ? 0.0 : stoneHeight(surf);
	vec3 base3 = floorP ? vec3(vPos.x, uBase - h0, vPos.z) : vec3(vPos.xy, plane > 1.5 ? vPos.z : h0);
	vec3 inward = floorP ? vec3(0.0, 6.0, 0.0) : vec3(0.0, 0.0, -6.0);

	// ① 凹刻状态：形状凹进石头，法线反向，颜色是石头本身；朝光一侧的槽壁投下阴影
	vec3 nCarve = normalize(vec3(-nArt.xy * 0.9, nArt.z));
	vec2 toL = floorP ? uLightPos[0].xz - vPos.xz : uLightPos[0].xy - vPos.xy;
	vec2 toLLocal = rot2(normalize(toL + 1e-3), -vRot);
	float lip = 1.0 - artAt(uv + toLLocal * 0.03, form, relief, 1.0).a;
	vec3 stoneCol = stoneAlbedo(surf) * (floorP ? 1.15 : 1.0);
	vec3 carved = stoneCol * 0.7 * lightAt(base3 + inward, toWorld(nCarve, plane), 0.15) * (1.0 - 0.8 * lip);
	// 地面上的刻字：浅浅刻在石板表面（与地面齐平的暗色字迹），不做深凹槽，免得看着像沉在地底
	if (floorP) carved = stoneCol * 0.55 * lightAt(base3, vec3(0.0, -1.0, 0.0), 0.05);

	// ② 原立绘：只受打光影响
	vec3 albedo = pow(art.rgb / max(art.a, 1e-4), vec3(2.2));
	vec3 lit = albedo * lightAt(base3 - inward * vSize * 0.01, toWorld(nArt, plane), 0.35);
	float white = smoothstep(0.55, 0.85, dot(albedo, vec3(0.333)));
	lit += albedo * white * eyeGlow;

	// 眼睑：从眼睛中线向上下张开（只有未知图腾有）
	vec3 e = relief ? vec3(-9.0, -9.0, 0.01) : uEyes[int(form + 0.5)];
	vec2 d = uv - e.xy;
	float dx = d.x / e.z;
	float halfOpen = eye * e.z * 1.06 * sqrt(max(0.0, 1.0 - dx * dx));
	float open = smoothstep(halfOpen + 0.006, halfOpen - 0.006, abs(d.y)) * step(length(d), e.z * 1.12) * smoothstep(0.0, 0.06, eye);
	float m = max(carve, open);

	// 金光：从眼睛处渗出（浮雕从中心渗出），沿着刻槽流向笔画末端，像熔金灌进刻痕
	vec2 dc = relief ? uv - 0.5 : d;
	float reach = length(dc) * 1.6 + fbm(uv * 5.0 + vB.x) * 0.35;
	float fill = smoothstep(reach - 0.08, reach + 0.04, gold * 1.5) * art.a * (1.0 - m);
	float shimmer = 0.75 + 0.25 * sin(uTime * 3.0 - reach * 14.0);
	vec3 molten = vec3(1.0, 0.66, 0.26) * (floorP ? 0.95 : 0.55 + 0.6 * max(nCarve.z, 0.0)) * shimmer;
	vec3 col = mix(carved, lit, m);
	col = mix(col, molten * 0.95, fill * 0.9);
	vec3 goldCol = vec3(1.0, 0.62, 0.22) * ring * gold * gold * 0.45;

	if (relief) {
		// 拼图浮雕（凸起）：石头的颜色，起伏来自立绘的法线；立绘的描线刻成细槽，金光沿描线亮起
		// 只取细的描线（明度的高通），大块的深色区域不算
		float lumS = dot(art.rgb / max(art.a, 1e-4), vec3(0.299, 0.587, 0.114));
		vec4 blurArt = textureLod(uRelief, auv, 3.0);
		float lumB = dot(blurArt.rgb / max(blurArt.a, 1e-4), vec3(0.299, 0.587, 0.114));
		float line = smoothstep(0.06, 0.22, lumB - lumS) * art.a;
		col = stoneCol * 1.6 * lightAt(base3 + vec3(0.0, 0.0, 10.0), toWorld(nArt, plane), 0.3) * (1.0 - 0.65 * line);
		col += vec3(1.0, 0.66, 0.26) * line * gold * 1.1;
		goldCol *= 0.25;
	}
	float a = art.a;
	if (vD.z > 0.5) {
		// 拼图石板：微微凸起的方形石板，4×4 分块缝；浮雕凹刻在石板里
		vec2 q = uv;
		float slab = smoothstep(-0.07, -0.05, q.x) * smoothstep(1.07, 1.05, q.x) * smoothstep(-0.07, -0.05, q.y) * smoothstep(1.07, 1.05, q.y);
		vec2 edge = min(q + 0.07, 1.07 - q);
		float bev = smoothstep(0.0, 0.03, min(edge.x, edge.y));
		vec2 tq = fract(clamp(q, 0.0, 0.9999) * 4.0);
		float seam = (1.0 - smoothstep(0.0, 0.025, min(min(tq.x, 1.0 - tq.x), min(tq.y, 1.0 - tq.y)))) * step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
		vec2 tile = floor(clamp(q, 0.0, 0.9999) * 4.0);
		vec2 gq = vec2(edge.x < edge.y ? sign(q.x - 0.5) : 0.0, edge.y <= edge.x ? sign(q.y - 0.5) : 0.0);
		vec3 nSlab = normalize(vec3(gq * (1.0 - bev) * 1.5, 1.0));
		vec3 slabCol = stoneCol * 1.35 * (0.9 + 0.2 * hash(tile + vB.x)) * lightAt(base3 + vec3(0.0, 0.0, 10.0), toWorld(nSlab, plane), 0.2);
		slabCol *= 1.0 - 0.75 * seam;
		if (board) slabCol = stoneCol * 0.3 * lightAt(base3 - vec3(0.0, 0.0, 14.0), vec3(0.0, 0.0, 1.0), 0.0) * (1.0 - 0.5 * seam) * mix(0.35, 1.0, bev);
		col = mix(slabCol, col * (1.0 - 0.75 * seam), a);
		a = max(a, slab);
	}
	// 外面的天光：冷白的光从前上方洒在浮雕上（顺着浮雕的起伏，明暗分明）
	if (vD.w > 0.0) {
		vec3 sky = normalize(vec3(-0.25, -0.75, 0.6));
		vec3 nSky = relief && art.a > 0.5 ? toWorld(nArt, plane) : vec3(0.0, 0.0, 1.0);
		float sd = max(dot(nSky, sky), 0.0);
		float onRelief = relief ? mix(0.45, 1.0, art.a) : 1.0;
		col += (vD.z > 0.5 ? stoneCol * 2.2 : albedo) * vec3(0.55, 0.72, 1.0) * vD.w * (0.2 + 1.1 * sd * sd) * onRelief;
	}

	// 预乘 alpha 输出（混合方式 ONE, ONE_MINUS_SRC_ALPHA）：金光只加颜色
	vec3 cs = pow(max(col, 0.0), vec3(1.0 / 2.2));
	vec4 outc = vec4(cs * a, a);
	outc.rgb += goldCol;
	outColor = outc * alpha;
}
`;
