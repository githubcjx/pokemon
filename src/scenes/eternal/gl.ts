/**
 * 《永恒之花》的油画背景着色器。
 *
 * 做法（两遍，见 PaintCanvas）：先算出"景"（scene：天空、远山、原野、城市……按 camera.ts 的景深层做视差）画进纹理，
 * 再用笔触把它画出来——世界坐标里撒一层大笔触、一层小笔触，每一笔取笔心处的景色，
 * 沿笔势拉长、边缘毛糙、带鬃毛纹与厚涂起伏；小笔触只落在和底色差别大的地方（细节处）。
 * 最后叠一层画布纹。笔触锚定在主体平面（k=1）的世界坐标上，镜头移动时笔触跟着画面走、不闪。
 *
 * 屏幕坐标：左上角为原点，1920×1080。景深层换算与 camera.ts 的 project / unproject 一致。
 */

const LIB = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCam;
uniform float uRoll;
uniform float uBrush;
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
	for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
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
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// 景里的"细节"标记：小而重要的形体（墓石等）置 1，笔触层在这里改用细笔触、粗笔触不从这里取色
float gDetail = 0.0;
`;

/** 第 1 遍的出口：把景与笔势写进纹理（a = 笔势角度 / π，笔触是对称的椭圆，角度取模 π；最高位为细节标记） */
const SCENE_MAIN = /* glsl */ `
void main() {
	vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1920.0 / uRes.x);
	gDetail = 0.0;
	vec3 c = scene(s);
	float det = gDetail;
	// a：低 7 位存笔势角度 / π（0..0.5），最高位存细节标记
	outColor = vec4(clamp(c, 0.0, 1.0), fract(flowAngle(s) / 3.14159265) * 0.498 + (det > 0.5 ? 0.5 : 0.0));
}
`;

/** 第 2 遍：笔触层，从第 1 遍的纹理里取笔心的颜色与笔势 */
export const PAINT_FRAG =
	LIB +
	/* glsl */ `
uniform sampler2D uScene;
vec4 S(vec2 s) {
	ivec2 ts = textureSize(uScene, 0);
	ivec2 ip = ivec2(s.x / 1920.0 * float(ts.x), (1.0 - s.y / 1080.0) * float(ts.y));
	return texelFetch(uScene, clamp(ip, ivec2(0), ts - 1), 0);
}

vec3 strokes(vec2 s, float cell, float seed, vec3 under, bool fine) {
	vec2 w = toLayer(s, 1.0);
	vec2 gi = floor(w / cell);
	float bestO = -1.0;
	vec3 res = under;
	for (int j = -1; j <= 1; j++)
		for (int i = -1; i <= 1; i++) {
			vec2 cid = gi + vec2(float(i), float(j));
			vec2 id = cid + seed * 101.0;
			vec2 cen = (cid + 0.15 + 0.7 * hash2(id)) * cell;
			vec4 sc = S(toScreen(cen, 1.0));
			if (!fine && seed < 0.5 && sc.a >= 0.5) continue;
			float ang = fract(sc.a * 2.0) * 3.14159265 + (hash(id + 5.3) - 0.5) * 0.6;
			vec2 d = rotv(w - cen, -ang);
			float len = cell * (0.85 + 0.7 * hash(id + 3.1));
			float wid = cell * (0.34 + 0.22 * hash(id + 7.7));
			vec2 q = d / vec2(len, wid);
			float e = length(q) + (noise(d / cell * 3.5 + id * 1.3) - 0.5) * 0.4;
			if (e >= 1.0) continue;
			float o = hash(id + 11.3);
			if (o <= bestO) continue;
			vec3 cc = sc.rgb;
			if (fine && length(cc - under) < 0.03 + 0.07 * hash(id + 9.1)) continue;
			bestO = o;
			// 鬃毛纹 + 厚涂起伏（光从左上）
			float br = noise(vec2(q.x * 1.6, q.y * 7.0) + id * 2.7);
			float br2 = noise(vec2(q.x * 1.6, (q.y + 0.14) * 7.0) + id * 2.7);
			vec3 c = cc * (0.93 + 0.13 * br) + (br2 - br) * 0.09 * (0.35 + cc);
			// 笔触边缘颜料薄，透出底色
			res = mix(c, under, smoothstep(0.6, 1.0, e) * 0.45);
		}
	return res;
}

// 细节区（屏幕矩形 x0, y0, x1, y1）：改用细笔触，免得细长的形体被大笔触抹糊
uniform vec4 uFine0;
uniform vec4 uFine1;
float rectMask(vec2 s, vec4 r) {
	if (r.z <= r.x) return 0.0;
	vec2 d = max(r.xy - s, s - r.zw);
	return 1.0 - smoothstep(0.0, 50.0, max(d.x, d.y));
}

void main() {
	vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1920.0 / uRes.x);
	vec4 me = S(s);
	vec3 base = me.rgb;
	float m = max(max(rectMask(s, uFine0), rectMask(s, uFine1)), step(0.5, me.a));
	vec3 col = base;
	if (m < 1.0) {
		col = strokes(s, 40.0 * uBrush, 0.0, base, false);
		col = strokes(s, 17.0 * uBrush, 1.0, col, true);
	}
	if (m > 0.0) col = mix(col, strokes(s, 9.0 * uBrush, 2.0, base, false), m);
	// 画布纹（屏幕空间、静止，不耗码率）
	float wv = sin(s.x * 1.7) * sin(s.y * 1.7);
	col *= 0.98 + 0.025 * wv;
	outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * 远古卡洛斯的原野（第 2–6 段）：落日、云、远山上的城堡、中景的山、开满花的原野。
 * 战争：地平线上升起烟柱与火光，画面褪色；焦土：原野烧成焦黑，只剩余烬。
 */
export const MEADOW_FRAG =
	LIB +
	/* glsl */ `
uniform vec3 uSkyTop;
uniform vec3 uSkyHor;
uniform vec3 uSunCol;
uniform vec2 uSun;      // 太阳在 k=0.05 层的位置
uniform float uSunAmt;
uniform vec3 uHill1;    // 远山
uniform vec3 uHill2;    // 中景
uniform vec3 uField;    // 原野
uniform float uFlowers;
uniform float uCastle;
uniform float uSmoke;
uniform float uFire;
uniform float uScorch;
uniform float uDesat;
uniform vec3 uTint;
uniform float uDim;
uniform vec4 uMach;   // 近处的机器（k=1）：x, 地面 y, 尺寸, 光
uniform vec4 uWeap;   // 远处的最终兵器（k=0.45）：x, 升起, 张开, 蓄能
uniform float uBeam;  // 光柱
uniform float uRain;  // 洒落的光
uniform float uRed;   // 天色发红（愤怒）
uniform float uWScale; // 兵器尺寸（k=0.45 层的像素）
uniform float uSnow;   // 积雪
uniform float uRoad;   // 通向地平线的土路
uniform float uStones; // 路旁的墓石（0..1 依次立起）

const float HOR = 600.0;

float ridgeFar(float x) { return 590.0 - 70.0 * fbm3(vec2(x * 0.0026, 1.7)) + 20.0; }
float ridgeMid(float x) { return 672.0 - 70.0 * fbm3(vec2(x * 0.0019 + 4.0, 5.3)); }
float ridgeNear(float x) { return 735.0 - 34.0 * fbm3(vec2(x * 0.0016 + 9.0, 2.1)); }

float box(vec2 p, vec2 c, vec2 hs) { vec2 d = abs(p - c) - hs; return max(d.x, d.y); }
float cone(vec2 q, vec2 top, float w, float h) {
	// 尖顶：top 为塔尖，向下 h 高、底宽 2w
	float t = (q.y - top.y) / h;
	if (t < 0.0 || t > 1.0) return 1.0;
	return abs(q.x - top.x) - w * t;
}
float castle(vec2 p) {
	// 远山上的城堡（左侧，避开落日）；形体放大、简化，免得被笔触画碎
	float bx = 470.0;
	float by = ridgeFar(bx) + 8.0;
	vec2 q = (p - vec2(bx, by)) / 1.45;
	float d = box(q, vec2(0.0, -24.0), vec2(80.0, 24.0));
	d = min(d, box(q, vec2(-70.0, -56.0), vec2(14.0, 56.0)));
	d = min(d, box(q, vec2(70.0, -48.0), vec2(13.0, 48.0)));
	d = min(d, box(q, vec2(4.0, -84.0), vec2(24.0, 84.0)));
	d = min(d, cone(q, vec2(-70.0, -150.0), 18.0, 38.0));
	d = min(d, cone(q, vec2(70.0, -136.0), 17.0, 40.0));
	d = min(d, cone(q, vec2(4.0, -210.0), 28.0, 44.0));
	return d;
}


// 水晶花（机器 / 最终兵器）：形状像永恒之花，五片尖瓣；q 为局部坐标（基座在原点，向上为 -y，花高约 1）
// 返回 rgb + 覆盖度；core 输出花心位置（局部坐标）
vec4 crystalFlower(vec2 q, float grow, float open, float charge, out vec2 core) {
	core = vec2(0.0, -0.5 * grow);
	if (grow <= 0.0) return vec4(0.0);
	vec3 crys = vec3(0.8, 0.83, 0.92);
	vec3 crysD = vec3(0.3, 0.33, 0.47);
	vec4 res = vec4(0.0);
	// 基座：水晶柱
	if (q.y < 0.0 && q.y > core.y && abs(q.x) < 0.07 + 0.05 * (q.y / core.y)) {
		float side = step(0.0, q.x);
		res = vec4(mix(crysD, crys, side * 0.7 + 0.15), 0.92);
	}
	// 花瓣
	float spread = mix(0.2, 0.62, open);
	float L = 0.62 * grow;
	float W = (0.17 + 0.04 * open) * grow;
	for (int i = 0; i < 5; i++) {
		float a = (float(i) - 2.0) * spread;
		vec2 d = rotv(q - core, -a);
		float u = -d.y;
		float v = d.x;
		if (u < 0.0 || u > L) continue;
		float prof = W * pow(sin(3.14159 * u / L), 0.75) * (1.0 - 0.25 * u / L);
		if (abs(v) > prof) continue;
		float facet = v > 0.0 ? 1.0 : 0.0;
		float ridge = exp(-abs(v) / (0.012 * grow + 1e-4));
		float edge = smoothstep(prof * 0.7, prof, abs(v));
		// 两个切面一明一暗，内部有沿瓣轴的折射纹，边缘亮
		float band = 0.5 + 0.5 * sin((abs(v) / prof) * 9.0 + u / L * 4.0 + float(i));
		vec3 col = mix(crysD, crys, 0.12 + 0.62 * facet - 0.18 * u / L);
		col = mix(col, col * vec3(0.85, 1.0, 1.08), 0.35 * band);
		col += vec3(0.9, 0.95, 1.0) * ridge * 0.3 + vec3(1.0) * edge * 0.18;
		// 蓄能：花瓣边缘泛红、透出金白的光
		col += vec3(1.0, 0.82, 0.55) * charge * (0.25 + 0.6 * (1.0 - u / L));
		col += vec3(1.0, 0.3, 0.25) * charge * edge * 0.8;
		// 中间的花瓣画在前面
		float layer = 1.0 - abs(float(i) - 2.0) * 0.1;
		if (layer >= res.a || res.a < 0.95) res = vec4(col, max(res.a, 0.9 * layer + 0.08));
	}
	// 花心
	float cd = length(q - core) / max(grow, 1e-3);
	res.rgb += vec3(1.0, 0.9, 0.7) * (0.1 + 1.6 * charge) * exp(-cd / 0.05);
	res.a = max(res.a, smoothstep(0.08, 0.04, cd) * (0.5 + 0.5 * charge));
	return res;
}

vec3 sky(vec2 s) {
	vec2 p = toLayer(s, 0.05);
	float t = clamp(p.y / HOR, 0.0, 1.0);
	vec3 c = mix(uSkyTop, uSkyHor, pow(t, 1.5));
	vec2 sd = p - uSun;
	float sdist = length(sd);
	// 横向的云
	float cl = fbm(vec2(p.x * 0.0022 + uTime * 0.006, p.y * 0.0085));
	float band = smoothstep(0.42, 0.72, cl) * smoothstep(40.0, 260.0, p.y) * (1.0 - smoothstep(470.0, 590.0, p.y));
	vec3 cloudC = mix(mix(uSkyTop, uSkyHor, 0.4) * 0.92, uSunCol * 1.05, 0.75 * exp(-sdist / 520.0));
	c = mix(c, cloudC * mix(0.85, 1.12, cl), band * 0.75);
	// 太阳
	c += uSunCol * uSunAmt * (0.85 * exp(-sdist / 85.0) + 0.38 * exp(-sdist / 430.0));
	c = mix(c, vec3(1.0, 0.95, 0.8), smoothstep(44.0, 36.0, sdist) * uSunAmt);
	return c;
}

vec3 smokeOver(vec3 c, vec2 p, float ridge) {
	if (uSmoke <= 0.0) return c;
	vec3 smokeC = vec3(0.2, 0.17, 0.15);
	// 烟柱：底部窄而浓，越往上越宽、越淡，最后散进天上的烟霾
	for (int i = 0; i < 4; i++) {
		float x0 = i == 0 ? 330.0 : i == 1 ? 820.0 : i == 2 ? 1180.0 : 1650.0;
		float rise = clamp(uSmoke * (1.25 - float(i) * 0.12), 0.0, 1.0);
		float hh = ridgeFar(x0) - p.y;
		float reach = 640.0 * rise;
		if (hh < -20.0 || hh > reach + 60.0) continue;
		float drift = hh * 0.3 + fbm3(vec2(hh * 0.008 - uTime * 0.2, float(i))) * 70.0;
		float w = 14.0 + hh * 0.2;
		float dx = abs(p.x - x0 - drift);
		float n = fbm(vec2((p.x - drift) * 0.012, p.y * 0.012 + uTime * 0.35 + float(i) * 7.0));
		float fadeTop = 1.0 - smoothstep(reach * 0.35, reach + 40.0, hh);
		float dens = smoothstep(w, w * 0.15, dx + (n - 0.5) * w * 1.1) * fadeTop * (0.5 + 0.5 * smoothstep(0.0, 60.0, hh + 20.0));
		c = mix(c, smokeC * (0.8 + 0.4 * n), dens * 0.8);
		// 烟柱底部的火光
		c += vec3(1.0, 0.42, 0.12) * uFire * exp(-max(hh, 0.0) / 45.0) * smoothstep(w * 1.6, 0.0, dx) * 0.9;
	}
	// 天上的烟霾
	float haze = smoothstep(ridge - 120.0, ridge - 520.0, p.y) * smoothstep(0.35, 0.75, fbm(vec2(p.x * 0.0025 + uTime * 0.01, p.y * 0.006)));
	c = mix(c, smokeC * 1.2, haze * uSmoke * 0.45);
	return c;
}

vec3 scene(vec2 s) {
	vec3 c = sky(s);
	vec2 sunS = toScreen(uSun, 0.05);

	// 远山（k=0.2）与城堡
	vec2 pf = toLayer(s, 0.2);
	float rf = ridgeFar(pf.x);
	vec3 hazeC = mix(uSkyHor, uSunCol, 0.25);
	if (uCastle > 0.0 && castle(pf) < 0.0) c = mix(c, mix(uHill1 * 0.8, hazeC, 0.45), uCastle);
	if (pf.y > rf) {
		vec3 hc = mix(uHill1, hazeC, 0.5);
		hc += uSunCol * 0.25 * exp(-(pf.y - rf) / 5.0) * exp(-abs(s.x - sunS.x) / 700.0);
		c = hc;
	}
	c = smokeOver(c, pf, rf);
	// 地平线上的火光
	c += vec3(1.0, 0.4, 0.12) * uFire * 0.35 * exp(-abs(pf.y - rf) / 60.0);

	// 中景（k=0.45）
	vec2 pm = toLayer(s, 0.45);
	float rm = ridgeMid(pm.x);
	if (pm.y > rm) {
		float n = fbm(pm * 0.01);
		vec3 mc = mix(uHill2, hazeC, 0.25) * (0.85 + 0.3 * n);
		mc += uSunCol * 0.3 * exp(-(pm.y - rm) / 7.0) * exp(-abs(s.x - sunS.x) / 600.0);
		c = mc;
	}

	// 远处的最终兵器（k=0.45）与光柱
	if (uWeap.y > 0.0) {
		float wb = ridgeMid(uWeap.x) + 30.0;
		vec2 core;
		vec4 wf = crystalFlower((pm - vec2(uWeap.x, wb)) / uWScale, uWeap.y, uWeap.z, uWeap.w, core);
		vec2 coreP = vec2(uWeap.x, wb) + core * uWScale;
		// 升起时被地面遮住的部分
		if (pm.y < wb) c = mix(c, wf.rgb, wf.a);
		float glowD = length(pm - coreP);
		c += vec3(1.0, 0.75, 0.5) * uWeap.w * (0.5 * exp(-glowD / (uWScale * 0.18)) + 0.25 * exp(-glowD / (uWScale * 0.7)));
		if (uBeam > 0.0) {
			float bw = uWScale * (0.05 + 0.1 * uBeam);
			float bx = abs(pm.x - coreP.x);
			float up = step(pm.y, coreP.y);
			c = mix(c, vec3(1.0, 0.97, 0.9), smoothstep(bw, bw * 0.3, bx) * up * min(1.0, uBeam * 1.5));
			c += vec3(1.0, 0.78, 0.5) * uBeam * exp(-bx / (bw * 3.0)) * (0.4 + 0.6 * up);
		}
	}

	// 原野（k=1）
	vec2 p = toLayer(s, 1.0);
	float rn = ridgeNear(p.x);
	if (p.y > rn) {
		float dy = max(p.y - 590.0, 6.0);
		vec2 g = vec2((p.x - 960.0) / dy, 1000.0 / dy) * 8.0;
		float n = fbm(vec2(g.x * 0.15, g.y * 0.5));
		float fore = smoothstep(rn, 1080.0, p.y);
		vec3 fc = uField * (0.78 + 0.4 * n) * mix(1.08, 0.72, fore);
		// 草叶：竖向的明暗纹，受阳光一侧更亮
		float blade = noise(vec2(p.x * 0.09, p.y * 0.012));
		fc *= 0.88 + 0.24 * blade * (0.4 + fore);
		fc += uSunCol * 0.18 * exp(-(p.y - rn) / 12.0);
		// 花：透视下的散点（红 / 黄 / 白 / 橙 / 蓝，花叶蒂的五种花色）
		vec2 gi = floor(g);
		for (int j = 0; j <= 1; j++)
			for (int i = 0; i <= 1; i++) {
				vec2 id = gi + vec2(float(i), float(j));
				if (hash(id + 2.0) > uFlowers * 0.55) continue;
				vec2 fp = id + 0.2 + 0.6 * hash2(id);
				float r = length((g - fp) * vec2(1.0, 1.6));
				float k = hash(id + 7.0);
				vec3 pc = k < 0.3 ? vec3(0.86, 0.22, 0.2) : k < 0.5 ? vec3(0.96, 0.82, 0.3) : k < 0.75 ? vec3(0.97, 0.94, 0.88) : k < 0.88 ? vec3(0.96, 0.55, 0.2) : vec3(0.4, 0.5, 0.88);
				pc *= 0.9 + 0.25 * (1.0 - fore);
				fc = mix(fc, pc, smoothstep(0.3, 0.18, r) * (1.0 - uScorch));
			}
		// 土路：从左下方的近处伸向地平线
		if (uRoad > 0.0) {
			float rt = clamp((1080.0 - p.y) / (1080.0 - rn), 0.0, 1.0);
			float rx = mix(380.0, 1180.0, pow(rt, 0.8));
			float rw = mix(210.0, 10.0, pow(rt, 0.6));
			float onRoad = smoothstep(rw, rw * 0.6, abs(p.x - rx + (n - 0.5) * rw * 0.4));
			fc = mix(fc, vec3(0.5, 0.45, 0.38) * (0.8 + 0.3 * n), onRoad * uRoad);
		}
		// 积雪
		if (uSnow > 0.0) {
			float sn = smoothstep(0.3, 0.6, n + 0.25 * uSnow) * uSnow;
			fc = mix(fc, vec3(0.86, 0.9, 0.96) * (0.85 + 0.2 * n), sn);
		}
		// 焦土
		if (uScorch > 0.0) {
			vec3 ch = vec3(0.11, 0.095, 0.085) * (0.7 + 0.6 * n);
			float ember = smoothstep(0.86, 0.95, noise(g * 0.9 + 3.0)) * (0.6 + 0.4 * sin(uTime * 2.0 + g.x * 3.0));
			ch += vec3(1.0, 0.38, 0.1) * ember * 0.6 * (1.0 - fore * 0.5);
			fc = mix(fc, ch, uScorch);
		}
		c = fc;
	}

	// 路旁的墓石：沿路两侧，一块块立起（透视：越远越小）
	if (uStones > 0.0) {
		for (int i = 0; i < 9; i++) {
			float fi = float(i);
			float vis = clamp(uStones * 9.0 - fi, 0.0, 1.0);
			if (vis <= 0.0) continue;
			float rt = 0.06 + fi * 0.1;
			float sy = mix(1080.0, 742.0, rt);
			float rx = mix(380.0, 1180.0, pow(rt, 0.8));
			float rw = mix(210.0, 10.0, pow(rt, 0.6));
			float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
			float sc = (sy - 600.0) / 480.0;
			vec2 base = vec2(rx + side * (rw + 50.0 * sc), sy);
			vec2 q = (p - base) / sc;
			float hgt = (150.0 + 34.0 * hash(vec2(fi, 4.0))) * vis;
			float wdt = 36.0 + 10.0 * hash(vec2(fi, 8.0));
			// 圆顶的立石
			float inS = step(-hgt, q.y) * step(q.y, 0.0) * step(abs(q.x), wdt * (1.0 - 0.25 * smoothstep(-hgt + 18.0, -hgt, q.y)));
			if (inS > 0.0) {
				gDetail = 1.0;
				float lit = 0.75 + 0.35 * smoothstep(-wdt, wdt, -q.x) + 0.15 * noise(q * 0.2);
				vec3 stone = vec3(0.62, 0.6, 0.57) * lit;
				stone = mix(stone, vec3(0.3, 0.36, 0.26), smoothstep(0.55, 0.8, noise(q * 0.08 + fi)) * 0.5 * (1.0 - uSnow));
				stone = mix(stone, vec3(0.9, 0.93, 0.97), uSnow * smoothstep(-hgt + 10.0, -hgt, q.y));
				c = stone;
			}
		}
	}

	// 近处的机器（k=1）：国王身前的水晶花苞
	if (uMach.z > 0.0) {
		vec2 core;
		vec4 mf = crystalFlower((p - uMach.xy) / uMach.z, 1.0, 0.0, uMach.w, core);
		c = mix(c, mf.rgb, mf.a);
		vec2 coreP = uMach.xy + core * uMach.z;
		float gd = length(p - coreP);
		c += vec3(1.0, 0.85, 0.6) * uMach.w * (0.3 * exp(-gd / (uMach.z * 0.15)) + 0.15 * exp(-gd / (uMach.z * 1.2)));
	}

	// 洒落的光：从天上落下的一道道光
	if (uRain > 0.0) {
		float col = floor(s.x / 22.0);
		float ph = hash(vec2(col, 3.0));
		float on = step(0.45, hash(vec2(col, 9.0)));
		float head = mod(uTime * 700.0 + ph * 1600.0, 1700.0) - 300.0;
		float tail = head - s.y;
		float streak = on * step(0.0, tail) * exp(-tail / 160.0) * smoothstep(9.0, 2.0, abs(fract(s.x / 22.0) - 0.5) * 22.0);
		c += vec3(1.0, 0.88, 0.65) * streak * uRain * 1.2;
		c += vec3(1.0, 0.7, 0.45) * uRain * 0.18;
	}

	c *= uDim;
	float L = lum(c);
	c = mix(c, vec3(L) * uTint, uDesat);
	// 愤怒：天色发红（在褪色之后上色）
	c = mix(c, c * vec3(1.35, 0.6, 0.48) + vec3(0.07, 0.0, 0.0), uRed * (1.0 - 0.6 * smoothstep(500.0, 1000.0, s.y)));
	return c;
}

float flowAngle(vec2 s) {
	vec2 p = toLayer(s, 1.0);
	// 水晶花：笔势从花心向外放射（顺着花瓣）
	if (uMach.z > 0.0) {
		vec2 core = uMach.xy + vec2(0.0, -0.5) * uMach.z;
		vec2 d = p - core;
		if (abs(d.x) < uMach.z * 0.5 && d.y < uMach.z * 0.55 && d.y > -uMach.z * 0.75) return d.y > 0.0 ? 1.5708 : atan(d.y, d.x);
	}
	if (uWeap.y > 0.0) {
		vec2 pm = toLayer(s, 0.45);
		float wb = ridgeMid(uWeap.x) + 30.0;
		vec2 core = vec2(uWeap.x, wb - 0.5 * uWeap.y * uWScale);
		vec2 d = pm - core;
		if (abs(d.x) < uWScale * 0.6 && pm.y < wb && d.y > -uWScale * 0.8) return d.y > 0.0 ? 1.5708 : atan(d.y, d.x);
	}
	float rn = ridgeNear(p.x);
	if (p.y > rn) {
		float fore = smoothstep(rn + 40.0, 1080.0, p.y);
		return mix(0.08, 1.35, fore * fore) + (noise(p * 0.01) - 0.5) * 0.5;
	}
	return 0.06 * sin(s.x * 0.004 + s.y * 0.01);
}
` +
	SCENE_MAIN;

/**
 * 今天的密阿雷（第 1、7 段）：夜晚的林荫大道。远处的天际线与高塔、湿漉漉的石板路、一排路灯。
 * uNight：1 = 深夜，0 = 黄昏。
 */
export const CITY_FRAG =
	LIB +
	/* glsl */ `
uniform float uNight;
uniform float uLamp;
uniform float uDesat;
uniform vec3 uTint;

const float BASE = 640.0;
const float LAMP_Y = 900.0;   // 路灯脚
const float LAMP_TOP = 410.0; // 灯头

float lampX(int i) { return i == 0 ? -210.0 : i == 1 ? 540.0 : i == 2 ? 1290.0 : 2040.0; }

vec3 citySky(vec2 s) {
	vec2 p = toLayer(s, 0.05);
	float t = clamp(p.y / BASE, 0.0, 1.0);
	vec3 nightC = mix(vec3(0.05, 0.07, 0.15), vec3(0.2, 0.21, 0.32), pow(t, 1.4));
	vec3 duskC = mix(vec3(0.36, 0.42, 0.66), vec3(1.0, 0.68, 0.42), pow(t, 1.3));
	vec3 c = mix(duskC, nightC, uNight);
	// 月光（左上）与被照亮的云
	float md = length(p - vec2(430.0, 170.0));
	c += vec3(0.75, 0.8, 0.95) * uNight * (0.45 * exp(-md / 40.0) + 0.16 * exp(-md / 260.0));
	c = mix(c, vec3(0.95, 0.95, 0.9), smoothstep(34.0, 29.0, md) * uNight);
	float cl = fbm(vec2(p.x * 0.0018 + uTime * 0.004, p.y * 0.007));
	float band = smoothstep(0.45, 0.75, cl) * (1.0 - smoothstep(380.0, 560.0, p.y));
	vec3 cloudC = mix(c * 1.35 + vec3(0.04, 0.045, 0.06), vec3(0.55, 0.58, 0.68), 0.5 * exp(-md / 380.0) * uNight);
	c = mix(c, cloudC, band * 0.6);
	return c;
}

// 一排楼：x 方向按随机宽度分栋，孟莎屋顶 + 烟囱；窗户按楼层成片发暖光（比笔触大，不会被画成碎点）
vec4 buildings(vec2 p, float base, float hMin, float hVar, float seed, vec3 bld, vec3 win, float winAmt) {
	float wB = 150.0;
	float bi = floor(p.x / wB + hash(vec2(floor(p.x / wB), seed)) * 0.0);
	float bx = fract(p.x / wB);
	float top = base - hMin - hVar * hash(vec2(bi, seed));
	float mans = 34.0;
	// 孟莎屋顶：两侧斜、上方平
	float roofEdge = top + mans * (1.0 - smoothstep(0.0, 0.14, min(bx, 1.0 - bx)));
	float chim = step(abs(bx - 0.3 - 0.4 * hash(vec2(bi, seed + 2.0))), 0.035) * 22.0;
	if (p.y < roofEdge - chim || p.y > base + 40.0) return vec4(0.0);
	vec3 c = bld * (0.85 + 0.3 * hash(vec2(bi, seed + 5.0)));
	// 屋顶稍亮（月光）
	c += vec3(0.05, 0.06, 0.09) * uNight * (1.0 - smoothstep(top, top + mans, p.y));
	if (p.y > top + mans + 8.0) {
		float fl = floor((p.y - top - mans) / 38.0);
		float fy = fract((p.y - top - mans) / 38.0);
		float on = step(0.52, hash(vec2(bi * 7.0 + fl, seed)));
		float strip = smoothstep(0.15, 0.35, fy) * smoothstep(0.85, 0.62, fy) * smoothstep(0.04, 0.12, bx) * smoothstep(0.96, 0.88, bx);
		c += win * winAmt * on * strip * (0.55 + 0.45 * noise(vec2(p.x * 0.03, fl)));
	}
	// 栋与栋之间的暗缝
	c *= 0.75 + 0.25 * smoothstep(0.0, 0.03, min(bx, 1.0 - bx));
	return vec4(c, 1.0);
}

vec3 scene(vec2 s) {
	vec3 c = citySky(s);
	vec3 bldN = vec3(0.06, 0.065, 0.1);
	vec3 bldD = vec3(0.32, 0.25, 0.3);
	vec3 bld = mix(bldD, bldN, uNight);
	vec3 win = vec3(1.0, 0.72, 0.38);

	// 远排楼（k=0.22，偏蓝、雾气重）
	vec2 pf = toLayer(s, 0.22);
	vec4 bf = buildings(pf, BASE - 10.0, 120.0, 140.0, 11.0, mix(bld, vec3(0.16, 0.18, 0.28), 0.5 * uNight), win, mix(0.1, 0.22, uNight));
	if (bf.a > 0.0) c = bf.rgb;

	// 高塔（k=0.2）：上细下宽的钢架塔，夜里亮着灯
	vec2 pt = toLayer(s, 0.2);
	float th = (BASE - pt.y) / 560.0;
	if (th > 0.0 && th < 1.0) {
		float w = mix(78.0, 6.0, pow(th, 0.65));
		float ax = abs(pt.x - 960.0);
		if (ax < w) {
			vec3 tc = bld * 0.8;
			float edge = smoothstep(w - 8.0, w - 2.0, ax);
			float lattice = smoothstep(0.75, 0.95, fract((pt.y + ax * 1.2) * 0.035)) + smoothstep(0.75, 0.95, fract((pt.y - ax * 1.2) * 0.035));
			tc += vec3(1.0, 0.86, 0.6) * (0.28 * edge + 0.1 * lattice) * uNight;
			c = tc;
		}
	}
	float beacon = length(pt - vec2(960.0, BASE - 565.0));
	c += vec3(1.0, 0.9, 0.72) * (0.9 * exp(-beacon / 10.0) + 0.3 * exp(-beacon / 90.0)) * mix(0.4, 1.0, uNight);

	// 近排楼（k=0.4）
	vec2 pb = toLayer(s, 0.4);
	vec4 bn = buildings(pb + vec2(60.0, 0.0), BASE + 20.0, 70.0, 120.0, 23.0, bld * 0.75, win, mix(0.15, 0.36, uNight));
	// 林荫道中间留出空隙，能望见远处的塔
	float gapMask = smoothstep(260.0, 330.0, abs(pb.x - 960.0));
	if (bn.a > 0.0 && gapMask > 0.5) c = bn.rgb;

	// 街道（k=1）：透视下的湿石板路
	vec2 p = toLayer(s, 1.0);
	if (p.y > BASE + 20.0) {
		float dy = max(p.y - 630.0, 4.0);
		vec2 g = vec2((p.x - 960.0) / dy * 9.0, 1600.0 / dy);
		float n = fbm(g * vec2(0.6, 0.4));
		vec3 gc = mix(vec3(0.42, 0.36, 0.34), vec3(0.075, 0.075, 0.1), uNight) * (0.75 + 0.45 * n);
		// 湿地面映出的天光
		gc += vec3(0.05, 0.06, 0.1) * uNight * (1.0 - smoothstep(BASE, 900.0, p.y));
		// 路灯的光池与倒影
		for (int i = 0; i < 4; i++) {
			float lx = lampX(i);
			float d = length((p - vec2(lx, LAMP_Y + 10.0)) * vec2(0.5, 1.5));
			gc += win * uLamp * 0.5 * exp(-d / 120.0);
			float refl = exp(-abs(p.x - lx) / (10.0 + (p.y - BASE) * 0.04)) * smoothstep(BASE + 20.0, LAMP_Y + 60.0, p.y);
			gc += win * uLamp * 0.3 * refl * (0.6 + 0.4 * noise(vec2(p.x * 0.04, p.y * 0.12)));
		}
		c = gc;
	}
	// 路灯：灯柱与灯头
	for (int i = 0; i < 4; i++) {
		float lx = lampX(i);
		if (abs(p.x - lx) < 6.0 && p.y > LAMP_TOP + 20.0 && p.y < LAMP_Y) c = vec3(0.03, 0.028, 0.03) + win * uLamp * 0.06;
		// 灯罩（上窄下宽的玻璃灯笼）与灯帽
		float ly = p.y - LAMP_TOP;
		if (ly > -24.0 && ly < 22.0 && abs(p.x - lx) < 12.0 + (ly + 24.0) * 0.12) c = vec3(1.0, 0.88, 0.64) * (0.9 + 0.2 * uLamp);
		if (ly > -34.0 && ly < -22.0 && abs(p.x - lx) < 20.0 - (ly + 34.0) * 0.4) c = vec3(0.04, 0.035, 0.035);
		float dl = length(p - vec2(lx, LAMP_TOP));
		c += win * uLamp * (0.55 * exp(-dl / 45.0) + 0.22 * exp(-dl / 260.0));
	}

	float L = lum(c);
	c = mix(c, vec3(L) * uTint, uDesat);
	return c;
}

float flowAngle(vec2 s) {
	vec2 p = toLayer(s, 1.0);
	// 灯头周围：放射状的笔触
	for (int i = 0; i < 4; i++) {
		vec2 d = p - vec2(lampX(i), LAMP_TOP);
		if (length(d) < 90.0) return atan(d.y, d.x);
	}
	vec2 pm = toLayer(s, 0.05);
	vec2 dm = pm - vec2(430.0, 170.0);
	if (length(dm) < 70.0) return atan(dm.y, dm.x) + 1.5708;
	if (p.y > BASE + 20.0) return 0.04 + (noise(p * 0.02) - 0.5) * 0.3;
	vec2 pb = toLayer(s, 0.32);
	if (pb.y > BASE - 280.0) return 1.5 + (noise(pb * 0.02) - 0.5) * 0.4;
	return 0.05 * sin(s.x * 0.004);
}
` +
	SCENE_MAIN;


/** 城市共用的天空与楼群（第 7–9 段的客厅窗外、墓地远景也用） */
const CITY_LIB = /* glsl */ `
uniform float uNight;
uniform float uLamp;
uniform float uDesat;
uniform vec3 uTint;

const float BASE = 640.0;
const float LAMP_Y = 900.0;   // 路灯脚
const float LAMP_TOP = 410.0; // 灯头

float lampX(int i) { return i == 0 ? -210.0 : i == 1 ? 540.0 : i == 2 ? 1290.0 : 2040.0; }

vec3 citySky(vec2 s) {
	vec2 p = toLayer(s, 0.05);
	float t = clamp(p.y / BASE, 0.0, 1.0);
	vec3 nightC = mix(vec3(0.05, 0.07, 0.15), vec3(0.2, 0.21, 0.32), pow(t, 1.4));
	vec3 duskC = mix(vec3(0.36, 0.42, 0.66), vec3(1.0, 0.68, 0.42), pow(t, 1.3));
	vec3 c = mix(duskC, nightC, uNight);
	// 月光（左上）与被照亮的云
	float md = length(p - vec2(430.0, 170.0));
	c += vec3(0.75, 0.8, 0.95) * uNight * (0.45 * exp(-md / 40.0) + 0.16 * exp(-md / 260.0));
	c = mix(c, vec3(0.95, 0.95, 0.9), smoothstep(34.0, 29.0, md) * uNight);
	float cl = fbm(vec2(p.x * 0.0018 + uTime * 0.004, p.y * 0.007));
	float band = smoothstep(0.45, 0.75, cl) * (1.0 - smoothstep(380.0, 560.0, p.y));
	vec3 cloudC = mix(c * 1.35 + vec3(0.04, 0.045, 0.06), vec3(0.55, 0.58, 0.68), 0.5 * exp(-md / 380.0) * uNight);
	c = mix(c, cloudC, band * 0.6);
	return c;
}

// 一排楼：x 方向按随机宽度分栋，孟莎屋顶 + 烟囱；窗户按楼层成片发暖光（比笔触大，不会被画成碎点）
vec4 buildings(vec2 p, float base, float hMin, float hVar, float seed, vec3 bld, vec3 win, float winAmt) {
	float wB = 150.0;
	float bi = floor(p.x / wB + hash(vec2(floor(p.x / wB), seed)) * 0.0);
	float bx = fract(p.x / wB);
	float top = base - hMin - hVar * hash(vec2(bi, seed));
	float mans = 34.0;
	// 孟莎屋顶：两侧斜、上方平
	float roofEdge = top + mans * (1.0 - smoothstep(0.0, 0.14, min(bx, 1.0 - bx)));
	float chim = step(abs(bx - 0.3 - 0.4 * hash(vec2(bi, seed + 2.0))), 0.035) * 22.0;
	if (p.y < roofEdge - chim || p.y > base + 40.0) return vec4(0.0);
	vec3 c = bld * (0.85 + 0.3 * hash(vec2(bi, seed + 5.0)));
	// 屋顶稍亮（月光）
	c += vec3(0.05, 0.06, 0.09) * uNight * (1.0 - smoothstep(top, top + mans, p.y));
	if (p.y > top + mans + 8.0) {
		float fl = floor((p.y - top - mans) / 38.0);
		float fy = fract((p.y - top - mans) / 38.0);
		float on = step(0.52, hash(vec2(bi * 7.0 + fl, seed)));
		float strip = smoothstep(0.15, 0.35, fy) * smoothstep(0.85, 0.62, fy) * smoothstep(0.04, 0.12, bx) * smoothstep(0.96, 0.88, bx);
		c += win * winAmt * on * strip * (0.55 + 0.45 * noise(vec2(p.x * 0.03, fl)));
	}
	// 栋与栋之间的暗缝
	c *= 0.75 + 0.25 * smoothstep(0.0, 0.03, min(bx, 1.0 - bx));
	return vec4(c, 1.0);
}

`;

/**
 * 旅馆 Z 的客厅（第 8–9 段）：暖色壁纸、护墙板、落地灯、木地板与地毯；右侧的窗外是夜里的密阿雷与亮着灯的高塔。
 * uLampAmt：落地灯亮度；uWarm：整体暖度。
 */
export const ROOM_FRAG =
	LIB +
	CITY_LIB +
	/* glsl */ `
uniform float uLampAmt;
uniform vec2 uLampP;   // 落地灯灯罩的位置（k=1）
uniform float uDim;

const vec4 WIN = vec4(1180.0, 210.0, 1640.0, 650.0);

vec3 scene(vec2 s) {
	vec2 p = toLayer(s, 0.85);
	vec3 c;
	// 壁纸：酒红底 + 竖条暗纹
	float stripe = smoothstep(0.42, 0.5, abs(fract(p.x / 64.0) - 0.5));
	float dam = noise(vec2(p.x * 0.05, p.y * 0.03)) * noise(vec2(p.x * 0.11 + 3.0, p.y * 0.07));
	c = mix(vec3(0.4, 0.2, 0.17), vec3(0.47, 0.27, 0.2), stripe * 0.6 + dam * 0.4);
	// 护墙板
	if (p.y > 700.0) {
		float panel = smoothstep(0.0, 6.0, abs(fract(p.x / 180.0) - 0.5) * 180.0 - 80.0);
		c = vec3(0.3, 0.18, 0.11) * (0.85 + 0.25 * noise(vec2(p.x * 0.02, p.y * 0.3))) * (0.8 + 0.2 * panel);
		if (p.y < 712.0) c = vec3(0.42, 0.28, 0.16);
	}
	// 窗：窗框、窗棂，窗外是夜里的城市
	if (p.x > WIN.x - 18.0 && p.x < WIN.z + 18.0 && p.y > WIN.y - 18.0 && p.y < WIN.w + 18.0) {
		c = vec3(0.24, 0.14, 0.08);
		if (p.x > WIN.x && p.x < WIN.z && p.y > WIN.y && p.y < WIN.w) {
			vec2 o = vec2((p.x - WIN.x) / (WIN.z - WIN.x) * 1920.0, (p.y - WIN.y) / (WIN.w - WIN.y) * 900.0 + 60.0);
			vec3 sky = mix(vec3(0.05, 0.07, 0.15), vec3(0.2, 0.2, 0.32), pow(clamp(o.y / 640.0, 0.0, 1.0), 1.4));
			vec3 w = sky;
			vec4 bf = buildings(o, 640.0, 120.0, 160.0, 31.0, vec3(0.07, 0.07, 0.11), vec3(1.0, 0.72, 0.38), 0.45);
			if (bf.a > 0.0) w = bf.rgb;
			float th = (640.0 - o.y) / 560.0;
			if (th > 0.0 && th < 1.0 && abs(o.x - 1100.0) < mix(70.0, 6.0, pow(th, 0.65))) w = vec3(0.12, 0.1, 0.1) + vec3(1.0, 0.85, 0.6) * 0.25;
			w += vec3(1.0, 0.88, 0.7) * exp(-length(o - vec2(1100.0, 75.0)) / 14.0);
			if (o.y > 680.0) w = vec3(0.05, 0.05, 0.07) + vec3(1.0, 0.72, 0.38) * 0.15 * noise(o * 0.05);
			float mull = step(abs(fract((p.x - WIN.x) / ((WIN.z - WIN.x) / 2.0)) - 0.5) * ((WIN.z - WIN.x) / 2.0), 3.0) + step(abs(fract((p.y - WIN.y) / ((WIN.w - WIN.y) / 3.0)) - 0.5) * ((WIN.w - WIN.y) / 3.0), 3.0);
			c = mix(w, vec3(0.24, 0.14, 0.08), clamp(mull, 0.0, 1.0));
		}
	}
	// 地板（k=1）：透视的木地板 + 地毯
	vec2 f = toLayer(s, 1.0);
	if (f.y > 800.0) {
		float dy = max(f.y - 640.0, 4.0);
		vec2 g = vec2((f.x - 960.0) / dy * 6.0, 900.0 / dy);
		float plank = smoothstep(0.0, 0.06, abs(fract(g.x) - 0.5) * 2.0);
		vec3 wood = vec3(0.36, 0.22, 0.12) * (0.75 + 0.35 * noise(vec2(floor(g.x) * 7.0, g.y * 0.6))) * (0.75 + 0.25 * plank);
		c = wood;
		vec2 rq = (f - vec2(880.0, 960.0)) / vec2(560.0, 120.0);
		float rr = length(rq);
		if (rr < 1.0) {
			vec3 rug = mix(vec3(0.45, 0.14, 0.12), vec3(0.6, 0.4, 0.2), smoothstep(0.82, 0.86, rr) * (1.0 - smoothstep(0.9, 0.94, rr)));
			rug *= 0.85 + 0.2 * noise(rq * 30.0);
			c = rug;
		}
	}
	// 落地灯（k=1）：灯柱 + 灯罩
	vec2 lp = uLampP;
	if (abs(f.x - lp.x) < 5.0 && f.y > lp.y + 40.0 && f.y < 880.0) c = vec3(0.12, 0.09, 0.06);
	float ly = f.y - lp.y;
	if (ly > -40.0 && ly < 40.0 && abs(f.x - lp.x) < 46.0 + ly * 0.4) {
		// 布灯罩：上窄下宽，下沿更亮
		c = vec3(1.0, 0.8, 0.52) * (0.55 + 0.35 * uLampAmt) * (0.85 + 0.25 * smoothstep(-40.0, 40.0, ly));
		gDetail = 1.0;
	}
	// 灯光
	float ld = length(f - lp);
	c *= 0.45 + uLampAmt * (0.75 * exp(-ld / 700.0) + 0.25);
	c += vec3(1.0, 0.75, 0.45) * uLampAmt * (0.22 * exp(-ld / 70.0) + 0.12 * exp(-ld / 380.0));
	c *= uDim;
	return c;
}

float flowAngle(vec2 s) {
	vec2 p = toLayer(s, 0.85);
	vec2 f = toLayer(s, 1.0);
	vec2 dl = f - uLampP;
	if (length(dl) > 60.0 && length(dl) < 150.0) return atan(dl.y, dl.x);
	if (f.y > 800.0) return 0.05 + (noise(f * 0.02) - 0.5) * 0.3;
	if (p.y > 700.0) return 0.02 + (noise(p * 0.02) - 0.5) * 0.15;
	if (p.x > WIN.x - 18.0 && p.x < WIN.z + 18.0 && p.y > WIN.y - 18.0 && p.y < WIN.w + 18.0) return 1.5708;
	return 1.5708 + (noise(p * 0.01) - 0.5) * 0.5;
}
` +
	SCENE_MAIN;

/**
 * 安息墓地（第 9 段）：清晨。远处是密阿雷的天际线与高塔，近处是草坪上一排排墓碑，正中是ＡＺ的墓碑（只画轮廓）。
 */
export const CEMETERY_FRAG =
	LIB +
	CITY_LIB +
	/* glsl */ `
uniform vec2 uSunM;
uniform float uDim;

vec3 scene(vec2 s) {
	vec2 ps = toLayer(s, 0.05);
	float t = clamp(ps.y / 640.0, 0.0, 1.0);
	vec3 c = mix(vec3(0.5, 0.6, 0.78), vec3(1.0, 0.86, 0.64), pow(t, 1.4));
	float sd = length(ps - uSunM);
	c += vec3(1.0, 0.8, 0.55) * (0.6 * exp(-sd / 90.0) + 0.3 * exp(-sd / 480.0));
	float cl = fbm(vec2(ps.x * 0.002 + uTime * 0.004, ps.y * 0.008));
	c = mix(c, mix(c * 1.1, vec3(1.0, 0.9, 0.8), 0.4), smoothstep(0.5, 0.78, cl) * 0.5 * (1.0 - smoothstep(360.0, 560.0, ps.y)));
	// 远处的城市（k=0.22，晨雾里偏蓝紫）
	vec2 pf = toLayer(s, 0.22);
	vec4 bf = buildings(pf, 650.0, 110.0, 140.0, 17.0, vec3(0.5, 0.48, 0.58), vec3(1.0, 0.8, 0.5), 0.0);
	if (bf.a > 0.0) c = mix(bf.rgb, c, 0.35);
	float th = (650.0 - pf.y) / 560.0;
	if (th > 0.0 && th < 1.0 && abs(pf.x - 760.0) < mix(78.0, 6.0, pow(th, 0.65))) c = mix(vec3(0.46, 0.44, 0.54), c, 0.3);
	// 草坪（k=1）
	vec2 p = toLayer(s, 1.0);
	if (p.y > 700.0) {
		float dy = max(p.y - 640.0, 4.0);
		vec2 g = vec2((p.x - 960.0) / dy * 8.0, 1000.0 / dy);
		float n = fbm(g * vec2(0.2, 0.6));
		vec3 gc = vec3(0.44, 0.5, 0.26) * (0.8 + 0.35 * n) * mix(1.1, 0.8, smoothstep(700.0, 1080.0, p.y));
		gc += vec3(1.0, 0.8, 0.5) * 0.12 * exp(-(p.y - 700.0) / 30.0);
		// 一排排墓碑
		for (int r = 0; r < 4; r++) {
			float ry = 712.0 + float(r) * float(r + 1) * 9.0;
			float sc = (ry - 640.0) / 300.0;
			float sp = 120.0 * sc;
			float xi = floor((p.x + float(r) * 37.0) / sp);
			float cx = (xi + 0.5) * sp - float(r) * 37.0;
			if (abs(cx - 960.0) < 160.0) continue;
			vec2 q = (p - vec2(cx, ry)) / sc;
			if (q.y < 0.0 && q.y > -46.0 && abs(q.x) < 15.0 * (1.0 - 0.3 * smoothstep(-36.0, -46.0, q.y))) gc = vec3(0.62, 0.62, 0.64) * (0.8 + 0.3 * step(0.0, -q.x));
		}
		c = gc;
	}
	// ＡＺ的墓碑（正中，只画圆顶石碑的轮廓），碑前几朵花
	vec2 q = p - vec2(960.0, 930.0);
	if (q.y < 0.0 && q.y > -280.0 && abs(q.x) < 104.0 * (1.0 - 0.4 * smoothstep(-200.0, -280.0, q.y))) {
		gDetail = 1.0;
		float lit = 0.75 + 0.35 * smoothstep(-104.0, 104.0, q.x);
		c = vec3(0.5, 0.5, 0.53) * lit * (0.9 + 0.15 * noise(q * 0.06));
		// 碑面（稍深的一块）
		if (abs(q.x) < 70.0 && q.y < -50.0 && q.y > -200.0) c *= 0.86;
		c += vec3(1.0, 0.8, 0.55) * 0.14 * smoothstep(70.0, 104.0, q.x);
	}
	for (int i = 0; i < 7; i++) {
		vec2 fp = vec2(960.0 - 150.0 + float(i) * 50.0 + hash(vec2(float(i), 2.0)) * 20.0, 950.0 + hash(vec2(float(i), 5.0)) * 30.0);
		float k = hash(vec2(float(i), 9.0));
		vec3 pc = k < 0.3 ? vec3(0.86, 0.22, 0.2) : k < 0.5 ? vec3(0.96, 0.82, 0.3) : k < 0.75 ? vec3(0.97, 0.94, 0.88) : k < 0.88 ? vec3(0.96, 0.55, 0.2) : vec3(0.4, 0.5, 0.88);
		if (length((p - fp) * vec2(1.0, 1.5)) < 16.0) { c = pc; gDetail = 1.0; }
	}
	return c * uDim;
}

float flowAngle(vec2 s) {
	vec2 p = toLayer(s, 1.0);
	if (p.y > 700.0) return 0.08 + (noise(p * 0.02) - 0.5) * 0.4;
	vec2 pf = toLayer(s, 0.22);
	if (pf.y > 400.0) return 1.5708;
	return 0.06 * sin(s.x * 0.004);
}
` +
	SCENE_MAIN;
