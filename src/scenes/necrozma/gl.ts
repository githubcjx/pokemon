/**
 * 《夺走的光辉》的着色器。画风「棱镜与光谱」：光一律按棱镜来画——白光被折成光谱，
 * 晶体有锐利的棱线与折射。远古的究极大都会是金光；失去光之后是漆黑的棱柱楼群，只剩棱线上的一线反光；
 * 高塔的人造光是冷白。阿罗拉的古书是烧焦的纸页。
 *
 * 屏幕坐标：左上角为原点，1920×1080（画布按 uRes 缩放）。景深层换算与 camera.ts 的 project / unproject 一致，
 * 着色器里的镜头（uCam = x, y, zoom；uRoll）与 DOM 层的 CamLayer 用同一组值。
 */

export const LIB = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;
uniform float uRoll;
out vec4 outColor;
const vec2 C = vec2(960.0, 540.0);

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 19.19)); }
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
float fbm3(vec2 p) {
	float v = 0.0, a = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}
vec2 rotv(vec2 v, float a) {
	float c = cos(a), s = sin(a);
	return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
// 屏幕 → 景深层 k 的局部坐标（camera.ts unproject）
vec2 toLayer(vec2 s, float k) {
	float sc = 1.0 + (uCam.z - 1.0) * k;
	vec2 r = rotv(s - C, -radians(uRoll));
	return r / sc + (uCam.xy - C) * k + C;
}
// 景深层 k → 屏幕（camera.ts project）
vec2 toScreen(vec2 p, float k) {
	float sc = 1.0 + (uCam.z - 1.0) * k;
	vec2 v = (p - C - (uCam.xy - C) * k) * sc;
	return rotv(v, radians(uRoll)) + C;
}
float layerScale(float k) { return 1.0 + (uCam.z - 1.0) * k; }
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
// 棱镜色：饱和色相掺一层白
vec3 prism(float h) { return mix(hue(h), vec3(1.0), 0.3); }
vec2 screenPos() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1920.0 / uRes.x); }
float segDist(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
	return length(pa - ba * h);
}
float segT(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	return clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────
// 究极大都会：天空 + 棱柱楼群（第 1–5、7–8 段）
// ─────────────────────────────────────────────────────────────────────────
export const CITY_FRAG =
	LIB +
	/* glsl */ `
uniform float uGold;      // 远古的金光（光辉大神照亮城市）
uniform vec4 uOrb;        // 天上的光：天空层 xy、半径、强度
uniform float uCrack;     // 光团出现裂纹、闪烁
uniform float uFlash;     // 全屏白闪
uniform float uSpire;     // 聚光塔升起 0–1
uniform float uBeam;      // 聚光塔从光团抽光的光束
uniform vec4 uCapt;       // 四座聚光塔里囚住的光
uniform float uDark;      // 黑暗
uniform vec4 uTower;      // 究极大都会塔：层内 x、升起 0–1、塔顶光、闪烁
uniform float uDim;       // 整体压暗（城市里的光被吸走）
uniform vec4 uLP[6];      // 光源（屏幕 xy、半径、强度），颜色见 uLC
uniform vec3 uLC[6];
uniform float uTowerCage; // 塔顶的光笼
uniform float uBright;

const float KS = 0.12;   // 天空层
const float KT = 0.5;    // 高塔与聚光塔所在层
const float YB = 1010.0; // 楼群底线（各层 y）

// 天空
vec3 sky(vec2 s) {
	vec2 p = toLayer(s, KS);
	float ee = clamp((760.0 - p.y) / 900.0, 0.0, 1.4);
	// 远古：琥珀金
	vec3 gold = mix(vec3(0.95, 0.66, 0.36), vec3(0.46, 0.24, 0.1), smoothstep(0.0, 1.0, ee));
	gold = mix(gold, vec3(0.18, 0.09, 0.04), smoothstep(0.8, 1.4, ee));
	// 失去光之后：近乎全黑的靛蓝
	vec3 dark = mix(vec3(0.028, 0.032, 0.05), vec3(0.006, 0.007, 0.012), smoothstep(0.0, 1.0, ee));
	vec3 col = mix(dark, gold * 0.95, uGold * (1.0 - uDark));
	// 黑暗中的微尘
	float dust = fbm(p * 0.004 + vec2(uTime * 0.01, 0.0));
	col += vec3(0.02, 0.022, 0.035) * dust * uDark;
	return col;
}

// 天上的光（光辉大神）：只画光，不画形体
vec3 orb(vec2 s) {
	if (uOrb.w <= 0.001) return vec3(0.0);
	vec2 o = toScreen(uOrb.xy, KS);
	float sc = layerScale(KS);
	float r = uOrb.z * sc;
	vec2 d = s - o;
	float dist = length(d);
	float a = atan(d.y, d.x);
	// 裂纹让光团不稳：半径抖动、闪烁
	float flick = 1.0 - uCrack * 0.35 * step(0.55, noise(vec2(uTime * 14.0, 3.0)));
	float rr = r * (1.0 + uCrack * 0.06 * sin(a * 7.0 + uTime * 9.0));
	float core = smoothstep(rr, rr * 0.55, dist);
	float halo = (exp(-dist / (r * 0.9)) * 0.85 + exp(-dist / (r * 3.2)) * 0.32) * (1.0 - 0.45 * uCrack);
	// 神光：按角度的放射条纹，缓慢转动
	float ray = pow(fbm3(vec2(a * 9.0 + uTime * 0.05, uTime * 0.12)), 3.2) * 2.6;
	float rays = ray * exp(-dist / (r * 4.5)) * smoothstep(r * 0.7, r * 1.3, dist);
	// 光谱色环：棱镜折出的一圈虹
	float ring = exp(-pow((dist - r * 1.75) / (r * 0.22), 2.0));
	vec3 spec = hue(fract(a / 6.2832 + uTime * 0.02)) * ring * 0.22;
	vec3 c = vec3(1.0, 0.97, 0.88) * core * (1.6 - 0.75 * uCrack) + vec3(1.0, 0.8, 0.45) * halo + vec3(1.0, 0.86, 0.6) * rays * (1.0 - 0.5 * uCrack) + spec;
	// 裂纹：光团核心里的暗色裂缝
	if (uCrack > 0.0) {
		vec2 q = d / max(r, 1.0);
		float n = abs(fbm(q * 2.4 + vec2(2.0, 7.0)) - 0.5);
		float n2 = abs(fbm(q * 5.0 + vec2(9.0, 1.0)) - 0.5);
		float reach = smoothstep(rr * (0.5 + 1.1 * uCrack), rr * 0.2, dist);
		float crack = (smoothstep(0.05, 0.0, n) + 0.7 * smoothstep(0.03, 0.0, n2)) * reach;
		float seam = smoothstep(0.09, 0.04, n) * reach;
		c = mix(c, vec3(0.04, 0.025, 0.02), clamp(crack * uCrack * 1.6, 0.0, 0.95));
		c += vec3(1.0, 0.55, 0.2) * (seam - crack * 0.6) * uCrack * 0.8;
	}
	return c * uOrb.w * flick;
}

// 光源照在一个朝向 side（-1 朝左、1 朝右）的面上
vec3 faceLight(vec2 s, float side, float height01, out vec3 edgeCol) {
	vec3 acc = vec3(0.0);
	edgeCol = vec3(0.0);
	for (int i = 0; i < 6; i++) {
		vec4 L = uLP[i];
		if (L.w <= 0.001) continue;
		vec2 d = L.xy - s;
		float dist = length(d);
		float att = 1.0 / (1.0 + pow(dist / max(L.z, 1.0), 2.0));
		float facing = clamp(side * d.x / (abs(d.x) + 220.0), 0.0, 1.0);
		// 黑色镜面：朝向光源的面上有一道纵向的反光
		float sheen = exp(-pow(d.x / (L.z * 0.55 + 60.0), 2.0)) * facing;
		acc += uLC[i] * L.w * att * (0.16 * facing + 0.55 * sheen * (0.5 + 0.5 * height01));
		edgeCol += uLC[i] * L.w * att;
	}
	return acc;
}

// 一层棱柱楼群：返回颜色与覆盖度
vec4 cityLayer(vec2 s, float k, float cw, vec2 hr, float seed, vec3 skyc) {
	float sc = layerScale(k);
	vec2 p = toLayer(s, k);
	float px = 1.0 / sc;
	vec4 res = vec4(0.0);
	for (int j = -1; j <= 1; j++) {
		float id = floor(p.x / cw) + float(j);
		float h1 = hash(vec2(id, seed));
		float h2 = hash(vec2(id, seed + 7.1));
		float h3 = hash(vec2(id, seed + 13.7));
		float h4 = hash(vec2(id, seed + 3.3));
		float h5 = hash(vec2(id, seed + 5.9));
		float hw = cw * (0.3 + 0.24 * h2);
		float cx = (id + 0.5) * cw + (h3 - 0.5) * cw * 0.3;
		float h = mix(hr.x, hr.y, pow(h1, 1.4));
		float u = (p.x - cx) / hw;
		if (abs(u) > 1.0) continue;
		float ridge = (h5 - 0.5) * 0.9;
		float top = YB - h;
		float roof = floor(h4 * 4.0);
		if (roof < 1.0) {
			top -= 0.0;
		} else if (roof < 2.0) {
			top -= (h3 > 0.5 ? (u * 0.5 + 0.5) : (0.5 - u * 0.5)) * hw * 0.9;
		} else if (roof < 3.0) {
			top -= max(0.0, 1.0 - abs(u - ridge) / (1.0 + abs(ridge))) * hw * 1.7;
		} else {
			top -= pow(max(0.0, 1.0 - abs(u - ridge) * 1.2), 3.0) * h * 0.45;
		}
		if (p.y < top - px) continue;
		float edgeX = (hw - abs(p.x - cx)) / px;
		float edgeT = (p.y - top) / px;
		float cov = clamp(min(edgeX, edgeT) + 0.5, 0.0, 1.0);
		if (cov <= res.a) continue;
		float side = u < ridge ? -1.0 : 1.0;
		float h01 = clamp(1.0 - (p.y - top) / max(h, 1.0), 0.0, 1.0);
		vec3 edgeL;
		vec3 lit = faceLight(s, side, h01, edgeL);
		// 镜面黑：反射一点天空
		vec3 base = vec3(0.012, 0.012, 0.016) + skyc * (0.08 + 0.1 * h01);
		// 远古时墙面是暖白的晶面
		base = mix(base, vec3(0.13, 0.085, 0.05) * (0.6 + 0.6 * h01), uGold * (1.0 - uDark));
		vec3 col = base + lit;
		// 棱线：墙边、屋顶、中间的棱，接住光
		float eRidge = abs(u - ridge) * hw / px;
		float e = min(min(edgeX, edgeT), eRidge);
		float edge = exp(-e / 1.3);
		vec3 tint = mix(vec3(1.0), prism(fract(p.y * 0.0012 + id * 0.17 + uTime * 0.01)), 0.35);
		col += (edgeL * 0.9 + skyc * 0.6 + uGold * vec3(0.5, 0.36, 0.2)) * edge * tint * 0.9;
		// 玻璃楼层线
		float fl = exp(-abs(fract(p.y / 34.0 + 0.5) - 0.5) * 34.0 / px / 0.8);
		col += (edgeL * 0.05 + uGold * vec3(0.06, 0.045, 0.02)) * fl;
		res = vec4(col, cov);
	}
	return res;
}

// 聚光塔：四座细针，带三道光环，塔顶囚住光
const vec2 SP0 = vec2(330.0, 1010.0);
const vec2 SP1 = vec2(760.0, 1010.0);
const vec2 SP2 = vec2(1210.0, 1010.0);
const vec2 SP3 = vec2(1640.0, 1010.0);
const float SPH = 760.0;

vec4 spire(vec2 s, vec2 base, float glow) {
	float k = KT;
	float sc = layerScale(k);
	vec2 p = toLayer(s, k);
	float px = 1.0 / sc;
	float H = SPH * uSpire;
	if (H < 2.0) return vec4(0.0);
	float t = clamp((base.y - p.y) / H, 0.0, 1.0);
	float w = mix(30.0, 2.0, pow(t, 0.7));
	float dx = abs(p.x - base.x);
	float inside = step(base.y - H, p.y) * step(dx, w + px);
	vec3 col = vec3(0.01) + vec3(1.0, 0.86, 0.6) * glow * 0.12;
	float edge = exp(-max(w - dx, 0.0) / px / 1.2);
	col += vec3(1.0, 0.88, 0.62) * edge * (0.25 + glow * 0.8 + uGold * 0.4);
	float a = inside * clamp((w + px - dx) / px, 0.0, 1.0);
	col *= a;
	// 光环
	vec3 add = vec3(0.0);
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float ry = base.y - H * (0.5 + 0.17 * fi);
		float rw = 70.0 - fi * 16.0;
		vec2 q = vec2((p.x - base.x) / rw, (p.y - ry + sin(uTime * 2.0 + fi) * 3.0) / (rw * 0.24));
		float ring = exp(-pow((length(q) - 1.0) / 0.07, 2.0));
		add += vec3(1.0, 0.85, 0.55) * ring * (0.25 + 1.2 * glow + 0.6 * uBeam) * uSpire;
	}
	// 塔顶的光核
	vec2 tp = vec2(base.x, base.y - H);
	float dd = length(p - tp);
	add += vec3(1.0, 0.92, 0.75) * (smoothstep(9.0, 4.0, dd) * 1.5 + exp(-dd / 26.0) * 0.8 + exp(-dd / 120.0) * 0.35) * (glow + uBeam * 0.6) * uSpire;
	return vec4(col + add, a);
}

// 抽光的光束：从光团连到塔顶，脉冲由光团流向塔
vec3 beams(vec2 s) {
	if (uBeam <= 0.001) return vec3(0.0);
	vec2 o = toScreen(uOrb.xy, KS);
	vec3 c = vec3(0.0);
	vec2 bases[4] = vec2[4](SP0, SP1, SP2, SP3);
	for (int i = 0; i < 4; i++) {
		vec2 tp = toScreen(vec2(bases[i].x, bases[i].y - SPH * uSpire), KT);
		float d = segDist(s, o, tp);
		float t = segT(s, o, tp);
		float pulse = (0.55 + 0.45 * sin(t * 40.0 - uTime * 22.0 + float(i))) * smoothstep(uOrb.z * 1.2, uOrb.z * 2.4, length(s - o));
		float w = 3.5 + 9.0 * (1.0 - t);
		c += vec3(1.0, 0.88, 0.62) * (exp(-pow(d / w, 2.0)) * 1.6 + exp(-d / (w * 6.0)) * 0.35) * pulse;
	}
	return c * uBeam;
}

// 究极大都会塔：城中央拔起的细高棱塔，塔顶是人造的太阳
vec4 tower(vec2 s) {
	if (uTower.y <= 0.001) return vec4(0.0);
	float k = KT;
	float sc = layerScale(k);
	vec2 p = toLayer(s, k);
	float px = 1.0 / sc;
	float H = 900.0 * uTower.y;
	float x0 = uTower.x;
	float t = clamp((YB - p.y) / max(H, 1.0), 0.0, 1.0);
	// 三段收分
	float w = t < 0.55 ? mix(70.0, 52.0, t / 0.55) : t < 0.86 ? mix(40.0, 30.0, (t - 0.55) / 0.31) : mix(22.0, 4.0, (t - 0.86) / 0.14);
	float dx = abs(p.x - x0);
	float inside = step(YB - H, p.y) * step(dx, w + px);
	float light = uTower.z * (1.0 - uTower.w * 0.6 * step(0.5, noise(vec2(uTime * 18.0, 5.0))));
	vec3 cold = vec3(0.78, 0.88, 1.0);
	vec3 col = vec3(0.01, 0.012, 0.018);
	// 竖向的光缝
	float slit = exp(-pow((p.x - x0) / (w * 0.12 + 0.5), 2.0)) * smoothstep(0.0, 0.2, t);
	col += cold * slit * light * 0.9;
	float edge = exp(-max(w - dx, 0.0) / px / 1.3);
	col += cold * edge * (0.25 + 0.75 * light);
	// 收分处的光带
	float band = exp(-pow((t - 0.55) * H / 3.0, 2.0)) + exp(-pow((t - 0.86) * H / 3.0, 2.0));
	col += cold * band * light * 1.2 * step(dx, w);
	float a = inside * clamp((w + px - dx) / px, 0.0, 1.0);
	col *= a;
	// 塔顶：人造太阳
	vec2 tp = vec2(x0, YB - H - 30.0);
	float dd = length(p - tp);
	vec3 add = cold * (smoothstep(26.0, 12.0, dd) * 2.0 + exp(-dd / 60.0) * 1.0 + exp(-dd / 320.0) * 0.5) * light;
	// 光笼：塔顶一圈圈的光环（第 5 段把它关进去）
	if (uTowerCage > 0.001) {
		for (int i = 0; i < 4; i++) {
			float fi = float(i);
			vec2 q = rotv(p - tp, 0.3 * fi + uTime * (0.25 + 0.1 * fi));
			q.y /= 0.32;
			float ring = exp(-pow((length(q) - (120.0 + 26.0 * fi)) / 2.6, 2.0));
			add += cold * ring * uTowerCage * 0.9;
		}
	}
	return vec4(col + add, a);
}

void main() {
	vec2 s = screenPos();
	vec3 col = sky(s);
	col += orb(s);
	// 光源在天空里的光晕
	for (int i = 0; i < 6; i++) {
		vec4 L = uLP[i];
		if (L.w <= 0.001) continue;
		float d = length(s - L.xy);
		col += uLC[i] * L.w * (exp(-d / (L.z * 0.35)) * 0.25 + exp(-d / L.z) * 0.08);
	}
	vec3 skyc = col;
	// 远景楼群
	vec4 far = cityLayer(s, 0.28, 120.0, vec2(260.0, 520.0), 1.0, skyc);
	vec3 hazeC = mix(vec3(0.03, 0.035, 0.055), vec3(0.75, 0.52, 0.3), uGold * (1.0 - uDark));
	far.rgb = mix(far.rgb, hazeC, 0.45);
	col = mix(col, far.rgb, far.a);
	vec4 mid = cityLayer(s, 0.4, 170.0, vec2(240.0, 640.0), 2.0, skyc);
	mid.rgb = mix(mid.rgb, hazeC, 0.22);
	col = mix(col, mid.rgb, mid.a);
	// 高塔、聚光塔
	vec4 tw = tower(s);
	col = col * (1.0 - tw.a) + tw.rgb;
	vec3 sp = vec3(0.0);
	vec2 bases[4] = vec2[4](SP0, SP1, SP2, SP3);
	for (int i = 0; i < 4; i++) {
		vec4 o = spire(s, bases[i], uCapt[i]);
		col = col * (1.0 - o.a) + o.rgb;
	}
	col += beams(s);
	vec4 near = cityLayer(s, 0.62, 240.0, vec2(160.0, 520.0), 3.0, skyc);
	col = mix(col, near.rgb, near.a);
	col *= uDim;
	col += vec3(1.0, 0.98, 0.94) * uFlash;
	outColor = vec4(col * uBright, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────
// 阿罗拉的古书：烧焦的书页（第 1、6 段）
// uMode 0：纸面（在插图下面）；uMode 1：烧焦 / 烧穿 / 曝白（在插图上面，带透明度）
// ─────────────────────────────────────────────────────────────────────────
export const PAGE_FRAG =
	LIB +
	/* glsl */ `
uniform float uMode;
uniform vec4 uPage;    // 书页（世界坐标）中心 xy、半宽、半高
uniform float uSpread; // 1 = 摊开的两页（中缝），0 = 单页
uniform float uLight;  // 整体照明
uniform vec4 uBeamA;   // 光束：起点 xy、终点 xy（世界坐标）
uniform vec2 uBeamW;   // 光束：宽度、强度
uniform vec4 uInk;     // 墨晕：中心 xy、半径、浓度
uniform vec4 uGoldP;   // 金光：中心 xy、半径、强度
uniform float uBurn;   // 从四周烧进来 0–1
uniform float uEmber;  // 焦边余烬的亮度
uniform float uWhite;  // 曝白
uniform float uText;   // 伪文字

float paperMask(vec2 p, out float edgeD, out float charW) {
	vec2 q = (p - uPage.xy);
	float dx = uPage.z - abs(q.x);
	float dy = uPage.w - abs(q.y);
	float d = min(dx, dy);
	float n = fbm(p * 0.012) * 0.7 + fbm(p * 0.05 + 3.0) * 0.3;
	// 原本就烧焦的边（残页）
	float w0 = 22.0 + 90.0 * n;
	// 往里烧
	float maxD = min(uPage.z, uPage.w);
	float w1 = uBurn * maxD * (1.15 + 0.5 * (n - 0.5));
	charW = 30.0 + 60.0 * fbm(p * 0.02 + 9.0);
	edgeD = d - (w0 + w1);
	return d;
}

vec3 paperColor(vec2 p) {
	vec2 q = p - uPage.xy;
	vec3 c = vec3(0.86, 0.77, 0.6);
	float fib = fbm(p * vec2(0.02, 0.09)) * 0.6 + fbm(p * 0.006) * 0.4;
	c *= 0.86 + 0.2 * fib;
	// 水渍、霉斑
	float st = smoothstep(0.58, 0.8, fbm(p * 0.0045 + 7.0));
	c = mix(c, c * vec3(0.78, 0.64, 0.46), st * 0.6);
	float spot = smoothstep(0.78, 0.86, fbm(p * 0.02 + 1.7));
	c = mix(c, vec3(0.45, 0.32, 0.2), spot * 0.35);
	// 页面四周泛黄发暗
	vec2 e = abs(q) / uPage.zw;
	c *= 1.0 - 0.32 * smoothstep(0.55, 1.0, max(e.x, e.y));
	// 中缝阴影与页面拱起
	if (uSpread > 0.5) {
		float g = abs(q.x);
		c *= 1.0 - 0.55 * exp(-g / 26.0) - 0.18 * exp(-g / 150.0);
		c *= 0.94 + 0.08 * smoothstep(0.0, 0.5, g / uPage.z) * (1.0 - smoothstep(0.6, 1.0, g / uPage.z));
	}
	return c;
}

// 伪文字：古书上的一排排手写墨迹（不是真字）：每格两三笔短画
float glyphs(vec2 p) {
	vec2 q = p - uPage.xy;
	float lineH = 34.0;
	float cell = 24.0;
	float row = floor(q.y / lineH);
	vec2 cid = vec2(floor(q.x / cell), row);
	vec2 local = vec2(fract(q.x / cell) * cell, fract(q.y / lineH) * lineH);
	// 行尾空格、段落
	if (hash(cid * 1.3) > 0.9 || hash(vec2(row, 4.0)) > 0.94) return 0.0;
	float ink = 0.0;
	for (int k = 0; k < 3; k++) {
		vec2 h = hash2(cid * 1.7 + float(k) * 3.1);
		vec2 h2 = hash2(cid * 2.3 + float(k) * 7.7);
		vec2 a = vec2(4.0 + h.x * 16.0, 8.0 + h.y * 16.0);
		vec2 b = a + (h2 - 0.5) * vec2(18.0, 16.0);
		float d = segDist(local, a, b);
		ink = max(ink, smoothstep(1.7, 0.5, d) * (0.6 + 0.4 * h2.x));
	}
	return ink;
}

// 伪文字的分布：两页的上部、下部各几行，避开插图
float textArea(vec2 p) {
	vec2 q = p - uPage.xy;
	vec2 e = q / uPage.zw;
	float inX = step(0.08, abs(e.x)) * step(abs(e.x), 0.86);
	float top = step(-0.82, e.y) * step(e.y, -0.58);
	float bot = step(0.66, e.y) * step(e.y, 0.82);
	return inX * (top + bot);
}

void main() {
	vec2 s = screenPos();
	vec2 p = toLayer(s, 1.0);
	float edgeD, charW;
	paperMask(p, edgeD, charW);
	// 纸外：黑暗
	vec3 bg = vec3(0.012, 0.009, 0.007);
	vec3 col = paperColor(p);
	// 伪文字
	col = mix(col, vec3(0.2, 0.12, 0.07), glyphs(p) * textArea(p) * uText * 0.8);
	// 墨晕：世界被黑暗包围
	if (uInk.w > 0.001) {
		vec2 d = p - uInk.xy;
		float a = atan(d.y, d.x);
		float r = uInk.z * (0.82 + 0.3 * fbm(vec2(a * 2.5, 1.0) + 3.0)) + 30.0 * fbm(p * 0.02);
		float m = smoothstep(r, r - 140.0, length(d));
		float gran = 0.75 + 0.25 * fbm(p * 0.05 + 2.0);
		col = mix(col, vec3(0.1, 0.075, 0.06) * gran, m * uInk.w * 0.82);
	}
	// 金光：年轻人与守护神放出的光（金箔）
	if (uGoldP.w > 0.001) {
		vec2 d = p - uGoldP.xy;
		float dist = length(d);
		float a = atan(d.y, d.x);
		float rays = pow(fbm3(vec2(a * 7.0, 2.0)), 2.0) * 2.2;
		float g = (exp(-dist / (uGoldP.z * 0.35)) + rays * exp(-dist / uGoldP.z)) * uGoldP.w;
		float leaf = 0.75 + 0.5 * fbm(p * 0.08);
		col = mix(col, vec3(0.95, 0.72, 0.3) * leaf, clamp(g, 0.0, 0.85));
		col += vec3(1.0, 0.8, 0.45) * g * 0.35;
	}
	// 照明：环境 + 光束
	float light = uLight;
	if (uBeamW.y > 0.001) {
		float d = segDist(p, uBeamA.xy, uBeamA.zw);
		float t = segT(p, uBeamA.xy, uBeamA.zw);
		light += uBeamW.y * (exp(-pow(d / uBeamW.x, 2.0)) * 1.1 + exp(-d / (uBeamW.x * 5.0)) * 0.35) * smoothstep(0.0, 0.08, t);
	}
	col *= light * vec3(1.0, 0.95, 0.86) + vec3(0.0);
	// 焦边
	float charM = smoothstep(charW, charW * 0.15, edgeD);
	float cg = smoothstep(charW, 0.0, edgeD);
	vec3 charC = mix(vec3(0.42, 0.26, 0.12) * col / max(lum(col), 0.05) * lum(col), vec3(0.03, 0.018, 0.01), pow(cg, 0.7)) ;
	charC = mix(charC, vec3(0.03, 0.018, 0.01), smoothstep(0.55, 1.0, cg));
	float flick = 0.65 + 0.35 * noise(p * 0.03 + vec2(uTime * 1.6, 0.0));
	// 余烬只在焦边上断断续续地亮
	float seg = smoothstep(0.45, 0.75, fbm(p * 0.012 + vec2(uTime * 0.05, 3.0)));
	float emb = exp(-pow((edgeD + 2.0) / 7.0, 2.0)) * uEmber * flick * seg;
	vec3 ember = vec3(1.0, 0.36, 0.06) * emb * 1.1 + vec3(1.0, 0.62, 0.25) * exp(-pow((edgeD + 1.0) / 2.2, 2.0)) * uEmber * flick * seg * 0.55;
	float gone = smoothstep(0.0, -3.0, edgeD);
	if (uMode < 0.5) {
		vec3 c = mix(col, charC, charM);
		c = mix(c, bg, gone);
		c += ember;
		c = mix(c, vec3(1.0, 0.99, 0.96), uWhite);
		outColor = vec4(c, 1.0);
	} else {
		// 上层：只画焦边、烧穿处与曝白，其余透明（让下面的插图透出来）
		float a = max(charM, gone);
		vec3 c = mix(charC, bg, gone);
		vec3 add = ember;
		float aa = clamp(a + lum(add), 0.0, 1.0);
		vec3 outc = (c * a + add) / max(aa, 1e-3);
		outc = mix(outc, vec3(1.0, 0.99, 0.96), uWhite);
		aa = max(aa, uWhite);
		outColor = vec4(outc, aa);
	}
}
`;

// ─────────────────────────────────────────────────────────────────────────
// 光效叠层（屏幕混合）：究极之洞、棱镜光谱扇
// ─────────────────────────────────────────────────────────────────────────
export const FX_FRAG =
	LIB +
	/* glsl */ `
uniform vec4 uR[6];     // 究极之洞：屏幕 xy、高度、张开程度
uniform float uRA[6];   // 究极之洞的倾角
uniform vec4 uFan;      // 光谱扇：起点 xy、方向（弧度）、张角（弧度）
uniform vec2 uFanL;     // 光谱扇：长度、强度
uniform vec4 uBeamS;    // 白光束：起点 xy、终点 xy（屏幕）
uniform vec2 uBeamSW;   // 白光束：宽度、强度
uniform vec4 uBeamG;    // 金色光柱（光子喷涌）：起点 xy、终点 xy
uniform vec2 uBeamGW;   // 金色光柱：宽度、强度
uniform vec4 uBeamZ;    // Ｚ力量的虹光：起点 xy、终点 xy
uniform vec2 uBeamZW;   // 虹光：宽度、强度
uniform vec4 uClash;    // 两道光的交汇点：屏幕 xy、尺寸、强度

vec3 rift(vec2 s, vec4 R, float ang) {
	if (R.w <= 0.001) return vec3(0.0);
	vec2 q = rotv(s - R.xy, -ang);
	float h = R.z * 0.5;
	float y = q.y / h;
	float wy = sqrt(max(0.0, 1.0 - y * y));
	// 洞口边缘不规则地抖动
	float jag = 1.0 + 0.18 * (fbm(vec2(q.y * 0.03, uTime * 0.8)) - 0.5);
	float w = (R.w * R.z * 0.11 * pow(wy, 0.75) + 0.5) * jag;
	float inside = smoothstep(w + 1.5, w - 1.5, abs(q.x)) * step(abs(y), 1.0);
	// 洞里：卷进去的光，中心最亮
	vec2 sq = vec2(q.x / max(w, 1.0), y);
	float sw = fbm(vec2(sq.x * 2.0 + sq.y * 3.0 - uTime * 0.9, sq.y * 4.0 + uTime * 0.4));
	float core = 1.0 - abs(sq.x);
	vec3 inner = mix(vec3(0.22, 0.32, 0.75), vec3(1.0), smoothstep(0.35, 1.0, core * 0.75 + sw * 0.45)) * 0.85;
	inner += prism(fract(sw * 1.5 + y * 0.3 + uTime * 0.05)) * 0.25 * (1.0 - core);
	// 洞口的光谱边：外红内紫
	float ed = abs(q.x) - w;
	vec3 fr = vec3(0.0);
	for (int i = 0; i < 5; i++) {
		float fi = float(i);
		fr += hue(fi / 6.0) * exp(-pow((ed - fi * 2.2 - 1.0) / 1.8, 2.0));
	}
	fr *= step(abs(y), 1.0) * smoothstep(1.0, 0.8, abs(y)) * 0.9;
	float glow = exp(-max(ed, 0.0) / (w * 1.5 + 30.0)) * smoothstep(1.3, 0.6, abs(y)) * 0.55;
	return inner * inside * 1.15 + fr * R.w + vec3(0.72, 0.82, 1.0) * glow * R.w;
}

vec3 fan(vec2 s) {
	if (uFanL.y <= 0.001) return vec3(0.0);
	vec2 d = s - uFan.xy;
	float dist = length(d);
	float a = atan(d.y, d.x) - uFan.z;
	a = mod(a + 3.14159, 6.28318) - 3.14159;
	float t = a / max(uFan.w, 1e-3) + 0.5;
	if (t < 0.0 || t > 1.0) return vec3(0.0);
	float edge = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
	float len = uFanL.x;
	float fall = smoothstep(len, len * 0.55, dist) * smoothstep(0.0, 30.0, dist);
	float streak = 0.8 + 0.4 * fbm(vec2(t * 30.0, dist * 0.003 - uTime * 0.3));
	// 离起点越近越接近白光，越远色散越开
	float sep = smoothstep(0.0, len * 0.45, dist);
	vec3 c = mix(vec3(1.0, 0.97, 0.9), mix(hue(t * 0.78), vec3(1.0), 0.18), sep);
	float soft = smoothstep(0.0, 0.3, t) * smoothstep(1.0, 0.7, t) * 0.6 + 0.4;
	return c * edge * soft * fall * streak * uFanL.y;
}

vec3 beam(vec2 s) {
	if (uBeamSW.y <= 0.001) return vec3(0.0);
	float d = segDist(s, uBeamS.xy, uBeamS.zw);
	float t = segT(s, uBeamS.xy, uBeamS.zw);
	float core = exp(-pow(d / uBeamSW.x, 2.0));
	float halo = exp(-d / (uBeamSW.x * 4.0)) * 0.35;
	float dust = 0.85 + 0.3 * fbm(s * 0.01 + vec2(uTime * 0.2, 0.0));
	return vec3(1.0, 0.97, 0.9) * (core + halo) * dust * uBeamSW.y * smoothstep(0.0, 0.05, t);
}

// 对撞的光柱：核心白、外圈带颜色；rainbow = 1 时外圈按位置流动成彩虹
vec3 pillar(vec2 s, vec4 B, vec2 W, vec3 tint, float rainbow) {
	if (W.y <= 0.001) return vec3(0.0);
	float d = segDist(s, B.xy, B.zw);
	float t = segT(s, B.xy, B.zw);
	float wob = 1.0 + 0.12 * sin(t * 30.0 - uTime * 40.0);
	float w = W.x * wob;
	float core = exp(-pow(d / (w * 0.35), 2.0));
	float body = exp(-pow(d / w, 2.0));
	float halo = exp(-d / (w * 3.0)) * 0.45;
	vec3 col = mix(tint, hue(fract(t * 1.5 - uTime * 0.8 + d * 0.004)), rainbow);
	return (vec3(1.0) * core * 1.4 + col * (body * 1.1 + halo)) * W.y;
}

vec3 clash(vec2 s) {
	if (uClash.w <= 0.001) return vec3(0.0);
	vec2 d = s - uClash.xy;
	float r = length(d);
	float a = atan(d.y, d.x);
	float core = exp(-pow(r / (uClash.z * 0.3), 2.0)) * 2.0;
	float glow = exp(-r / uClash.z) * 1.2 + exp(-r / (uClash.z * 4.0)) * 0.4;
	float spikes = pow(fbm3(vec2(a * 6.0, uTime * 3.0)), 3.0) * 3.0 * exp(-r / (uClash.z * 2.5));
	vec3 rim = hue(fract(a / 6.2832 + uTime * 0.3)) * exp(-pow((r - uClash.z * 0.9) / (uClash.z * 0.12), 2.0));
	return (vec3(1.0, 0.97, 0.9) * (core + glow) + vec3(1.0, 0.9, 0.7) * spikes + rim * 0.8) * uClash.w;
}

void main() {
	vec2 s = screenPos();
	vec3 c = vec3(0.0);
	for (int i = 0; i < 6; i++) c += rift(s, uR[i], uRA[i]);
	c += pillar(s, uBeamG, uBeamGW, vec3(1.0, 0.78, 0.35), 0.0);
	c += pillar(s, uBeamZ, uBeamZW, vec3(1.0), 1.0);
	c += clash(s);
	c += fan(s);
	c += beam(s);
	outColor = vec4(c, 1.0);
}
`;
