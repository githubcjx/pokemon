import {COMMON} from '../../gl/shaders';

/**
 * 《真实与理想》黑白剪影·三色的着色器。
 * 整片高反差黑白，画面里只留三种点睛色：白焰（暖白带橙）、蓝雷、冰青。
 * 坐标约定：屏幕坐标以 1920×1080 的像素计，y 向下（与 CSS 一致）。
 */

/** 把片元坐标换成 1920×1080、y 向下的屏幕坐标 */
const SCREEN = `
vec2 screenPx() {
	vec2 f = gl_FragCoord.xy / uRes;
	return vec2(f.x * 1920.0, (1.0 - f.y) * 1080.0);
}
`;

/**
 * 单只宝可梦的背景：底色 + 逆光 + 三种元素（可叠加）。
 * uBg 底色；uGlow / uGlowAmt / uGlowR 逆光（uC 为中心，屏幕像素）；uRays 放射光束；
 * uFlame 白焰从下往上卷（黑底）；uFrost 冰雾与霜点；uStorm 雷云（uInk 为云的颜色，可在白底上画深色云）。
 */
export const ELEMENT_FRAG = `${COMMON}
${SCREEN}
// 柔和的圆形光点（余烬 / 霜点）：每个格子里最多一颗，位置随机，大小 rad 像素，闪烁
float motes(vec2 s, float cell, float keep, float rad, float t) {
	vec2 g = floor(s / cell);
	float h = hash(g + 17.0);
	if (h < keep) return 0.0;
	vec2 o = vec2(hash(g + 3.1), hash(g + 7.7)) * (cell - 6.0) + 3.0;
	float d = length(s - g * cell - o);
	float tw = 0.55 + 0.45 * sin(t * 4.0 + h * 60.0);
	return smoothstep(rad + 1.2, rad * 0.2, d) * tw;
}
uniform vec2 uC;
uniform vec3 uBg;
uniform vec3 uGlow;
uniform float uGlowAmt;
uniform float uGlowR;
uniform float uRays;
uniform float uFlame;
uniform vec3 uFlameCol;
uniform float uFrost;
uniform vec3 uFrostCol;
uniform float uStorm;
uniform vec3 uInk;
uniform float uFlick;

void main() {
	vec2 s = screenPx();
	vec2 p = (s - uC) / 1080.0;
	float r = length(p);
	float t = uTime;
	vec3 col = uBg;

	// 雷云：横向拉长的云带，翻涌
	if (uStorm > 0.0) {
		vec2 q = vec2(s.x / 1080.0 * 1.2 + t * 0.03, s.y / 1080.0 * 3.2);
		float w = fbm(q * 1.3 + vec2(t * 0.05, 0.0));
		float cl = fbm(q * vec2(1.0, 1.4) + w * 1.6 - vec2(t * 0.04, 0.0));
		// 云压在画面上部，越往下越稀，地平线附近留出干净的亮底
		float vmask = smoothstep(0.78, 0.15, s.y / 1080.0);
		float band = smoothstep(0.5, 0.74, cl) * vmask;
		// 云团内部有更深的笔触
		float core = smoothstep(0.6, 0.86, cl + 0.12 * fbm(q * 4.0)) * vmask;
		col = mix(col, uInk, clamp(band * 0.5 + core * 0.5, 0.0, 1.0) * uStorm);
		// 闪电映亮云层
		col += uGlow * uFlick * band * 0.6;
	}

	// 逆光：一圈硬一点的核 + 宽的晕
	float glow = exp(-pow(r / max(uGlowR, 1e-3), 2.0)) * 0.9 + exp(-r / max(uGlowR * 1.8, 1e-3)) * 0.35;
	col += uGlow * glow * uGlowAmt;

	// 放射光束（版画式的硬光束）
	if (uRays > 0.0) {
		float a = atan(p.y, p.x);
		float ray = pow(noise(vec2(a * 9.0, t * 0.15)), 3.0) + 0.6 * pow(noise(vec2(a * 23.0 + 3.0, t * 0.1)), 6.0);
		col += uGlow * ray * smoothstep(1.2, 0.1, r) * smoothstep(0.02, 0.12, r) * uRays;
	}

	// 白焰：从画面下方卷上来，越往上越碎
	if (uFlame > 0.0) {
		vec2 q = vec2(s.x / 1080.0 * 2.4, s.y / 1080.0 * 1.6 + t * 0.55);
		float w = fbm(q * 0.9 - vec2(0.0, t * 0.2));
		float f = fbm(q + vec2(w * 1.4, 0.0));
		float h = s.y / 1080.0;                  // 0 顶 → 1 底
		float rise = smoothstep(0.05, 1.0, h) * (0.65 + 0.35 * smoothstep(0.9, 0.2, abs(p.x)));
		float tongue = smoothstep(0.62, 0.9, f * (0.55 + 0.75 * rise));
		float core = smoothstep(0.78, 0.98, f * (0.55 + 0.75 * rise));
		vec3 edge = vec3(1.0, 0.62, 0.32);
		col += mix(edge * 0.6, uFlameCol, core) * tongue * uFlame;
		// 余烬
		col += vec3(1.0, 0.72, 0.45) * motes(vec2(s.x + sin(s.y / 90.0 + t) * 12.0, s.y + t * 140.0), 26.0, 0.975, 2.2, t) * smoothstep(0.3, 1.0, h) * uFlame;
	}

	// 冰雾与霜点
	if (uFrost > 0.0) {
		vec2 q = s / 1080.0 * 2.0;
		float fog = fbm(q + vec2(t * 0.03, -t * 0.02) + fbm(q * 1.7 - t * 0.02));
		col += uFrostCol * smoothstep(0.35, 0.85, fog) * 0.45 * uFrost;
		col += uFrostCol * motes(s + vec2(t * 8.0, t * 18.0), 30.0, 0.95, 1.6, t) * uFrost;
	}

	outColor = vec4(col, 1.0);
}`;

/**
 * 远古合众的大地（第 2、3 段）：灰阶天空 + 地平线强逆光 + 三层黑色山脊 + 近处的台地。
 * 用与 camera.ts 一致的景深换算（uCam / uZoom，各层系数 k）做视差，在着色器里推拉以保持清晰。
 * uSun 为空洞（那条龙）的屏幕位置，天空的光从这里来；uSplit 让天空分成左暖右蓝；uFlick 闪电映亮。
 */
export const LAND_FRAG = `${COMMON}
${SCREEN}
uniform vec2 uCam;
uniform float uZoom;
uniform vec2 uSun;
uniform float uSunAmt;
uniform float uSplit;
uniform float uSplitX;
uniform vec3 uWarm;
uniform vec3 uBlue;
uniform float uFlick;
uniform float uHatch;
uniform float uDark;

// 屏幕点 → 景深层 k 的局部坐标（camera.ts 的 unproject，不含侧倾）
vec2 layer(vec2 s, float k) {
	float sc = 1.0 + (uZoom - 1.0) * k;
	return (s - vec2(960.0, 540.0)) / sc + (uCam - vec2(960.0, 540.0)) * k + vec2(960.0, 540.0);
}

float ridge(float x, float seed, float amp, float freq) {
	return (fbm(vec2(x * freq, seed)) - 0.5) * amp + (noise(vec2(x * freq * 4.0, seed + 3.0)) - 0.5) * amp * 0.25;
}

void main() {
	vec2 s = screenPx();
	float t = uTime;

	// ── 天空：地平线一道强逆光，往上迅速压暗（高反差） ──
	vec2 sk = layer(s, 0.12);
	float hz = 800.0;                                  // 地平线（局部坐标）
	float v = clamp((hz - sk.y) / 760.0, 0.0, 1.0);    // 0 地平线 → 1 天顶
	float L = mix(1.0, 0.02, pow(v, 0.42));
	// 长云：横向的暗带，边缘硬
	vec2 cq = vec2(sk.x / 900.0 + t * 0.01, sk.y / 140.0);
	float cl = fbm(cq + fbm(cq * 1.5 + 4.0) * 0.8);
	float cloud = smoothstep(0.5, 0.62, cl) * smoothstep(0.04, 0.3, v);
	L *= 1.0 - cloud * 0.75;
	// 云的下沿被逆光勾亮
	L += smoothstep(0.47, 0.5, cl) * (1.0 - smoothstep(0.5, 0.53, cl)) * 0.25 * (1.0 - v);
	// 那条龙的光
	vec2 dp = (s - uSun) / 1080.0;
	float dr = length(dp);
	float sunG = exp(-pow(dr / 0.16, 2.0)) * 0.6 + exp(-dr / 0.3) * 0.3;
	float a = atan(dp.y, dp.x);
	float rays = pow(noise(vec2(a * 10.0, t * 0.12)), 3.0) * smoothstep(0.9, 0.05, dr);
	L += (sunG + rays * 0.3) * uSunAmt * (1.0 - cloud * 0.5);
	L += uFlick * 0.4 * cloud;
	L = clamp(L, 0.0, 1.2);

	// 版画排线（可选，默认关闭）：中间调里刻出斜向细线
	float hatchW = (1.0 - clamp(L, 0.0, 1.0));
	float f = fract((sk.x * 0.5 + sk.y) / 9.0 + (noise(sk * 0.01) - 0.5) * 0.5);
	float d = abs(f - 0.5) * 2.0;
	float aa = fwidth((sk.x * 0.5 + sk.y) / 9.0) * 2.0;
	float lineInk = 1.0 - smoothstep(hatchW - aa, hatchW + aa, d);
	float mid = smoothstep(0.1, 0.3, L) * smoothstep(0.9, 0.6, L);
	L = mix(L, L * (1.0 - lineInk * 0.5), uHatch * mid);

	vec3 col = vec3(L);
	// 天空分成两半：左边白焰暖光，右边蓝雷
	float side = smoothstep(-80.0, 80.0, s.x - uSplitX + (fbm(vec2(s.y / 140.0, t * 0.3)) - 0.5) * 160.0);
	vec3 tint = mix(uWarm, uBlue, side);
	col = mix(col, col * tint * 1.25 + tint * 0.08 * L, uSplit);

	// ── 三层山脊（远 → 近），越远越亮（逆光里的空气透视），边缘有一线逆光 ──
	vec2 l1 = layer(s, 0.3);
	float y1 = 770.0 + ridge(l1.x / 1000.0, 1.0, 90.0, 1.6) - 10.0;
	vec2 l2 = layer(s, 0.55);
	float y2 = 818.0 + ridge(l2.x / 1000.0, 7.0, 90.0, 1.1);
	vec2 l3 = layer(s, 1.0);
	float y3 = 868.0 + ridge(l3.x / 1000.0, 13.0, 22.0, 2.0);

	float e1 = 1.0 - smoothstep(-1.2, 1.2, l1.y - y1);
	float e2 = 1.0 - smoothstep(-1.2, 1.2, l2.y - y2);
	float e3 = 1.0 - smoothstep(-1.2, 1.2, l3.y - y3);
	float rim1 = exp(-max(l1.y - y1, 0.0) / 2.5) * (1.0 - e1);
	float rim2 = exp(-max(l2.y - y2, 0.0) / 2.0) * (1.0 - e2);
	float rim3 = exp(-max(l3.y - y3, 0.0) / 1.8) * (1.0 - e3);
	vec3 ridgeTint = mix(vec3(1.0), tint, uSplit);
	// 远山被地平线的光吃掉一部分：越靠近山脊顶越亮
	float haze1 = 0.34 * exp(-max(l1.y - y1, 0.0) / 60.0) + 0.1;
	float haze2 = 0.14 * exp(-max(l2.y - y2, 0.0) / 40.0) + 0.03;
	col = mix(vec3(haze1) * ridgeTint + rim1 * 0.6 * ridgeTint, col, e1);
	col = mix(vec3(haze2) * ridgeTint + rim2 * 0.5 * ridgeTint, col, e2);
	col = mix(vec3(0.008) + rim3 * 0.5 * ridgeTint, col, e3);

	col *= 1.0 - uDark;
	outColor = vec4(col, 1.0);
}`;

/**
 * 那条龙：没有官方形象，用黑白两色光交缠出的一个"空洞"表示。
 * uP 中心、uR 半径（屏幕像素）；uSplit 0 = 一体，1 = 分成左右两团（左暖白、右蓝）；
 * uSep 分开后两团的间距；uTear 将裂未裂时中线上的光；uAmt 整体强度（0 = 不可见）。
 */
export const VOID_FRAG = `${COMMON}
${SCREEN}
uniform vec2 uP;
uniform float uR;
uniform float uSplit;
uniform float uSep;
uniform float uTear;
uniform float uAmt;
uniform vec3 uWarm;
uniform vec3 uBlue;
uniform vec3 uIce;
uniform float uHusk;

void main() {
	vec2 s = screenPx();
	float t = uTime;
	float sep = uSep * uSplit;
	vec2 c1 = uP - vec2(sep, 0.0);
	vec2 c2 = uP + vec2(sep, 0.0);
	float r1 = uR * mix(1.0, 0.72, uSplit);
	vec2 d1 = s - c1;
	vec2 d2 = s - c2;
	// 元球：一体时是一个圆，分开时拉长、断开成两团
	float fld = r1 * r1 / max(dot(d1, d1), 1.0) + r1 * r1 / max(dot(d2, d2), 1.0);
	float wob = (fbm(s / 90.0 + vec2(t * 0.2, -t * 0.15)) - 0.5) * 0.5;
	float body = smoothstep(0.92, 1.08, fld * mix(0.5, 1.0, smoothstep(0.0, 0.02, sep / uR)) + wob * 0.35);

	// 哪一边：左团还是右团
	float side = smoothstep(-0.25, 0.25, (s.x - uP.x) / max(uR, 1.0));
	vec2 cc = uSplit < 0.02 ? uP : (s.x < uP.x ? c1 : c2);
	vec2 q = (s - cc) / uR;
	float rr = length(q);
	float ang = atan(q.y, q.x);
	// 黑白交缠：两股螺旋，随时间缓缓旋转
	float sw = sin(ang * 2.0 + rr * 5.5 - t * 1.4 + fbm(q * 2.2 + t * 0.15) * 4.0);
	float white = smoothstep(-0.15, 0.25, sw);
	vec3 lightC = mix(vec3(1.0), mix(uWarm, uBlue, side), clamp(uSplit * 1.2 + 0.18, 0.0, 1.0));
	vec3 inside = mix(vec3(0.0), lightC, white * (0.55 + 0.45 * smoothstep(1.0, 0.2, rr)));

	// 边缘的光圈与外晕
	float corona = 0.55 + 0.75 * fbm(vec2(atan(s.y - uP.y, s.x - uP.x) * 3.0, t * 0.6) + fbm(s / 120.0 + t * 0.1));
	float edge = exp(-pow((fld - 1.0) / 0.22, 2.0)) * corona;
	float halo = clamp(fld, 0.0, 3.0) * 0.16 * (1.0 - body) * corona;
	vec3 haloC = mix(vec3(1.0), mix(uWarm, uBlue, side), uSplit);

	// 将裂：中线上一道竖光
	float tearLine = exp(-pow((s.x - uP.x) / (3.0 + 10.0 * uTear), 2.0)) * smoothstep(uR * 1.1, 0.0, abs(s.y - uP.y)) * uTear;

	vec3 col = inside * body + haloC * (edge * 0.9 + halo) + vec3(1.0) * tearLine;
	float alpha = clamp(body + edge * 0.9 + halo + tearLine, 0.0, 1.0);

	// 空壳：两团光离开后，原处留下一圈结冰的空壳（冰青色的环 + 内部的冰裂纹与冷雾）
	if (uHusk > 0.0) {
		vec2 hq = (s - uP) / uR;
		float hr = length(hq);
		float ringW = 0.05 + 0.03 * fbm(vec2(atan(hq.y, hq.x) * 4.0, t * 0.2));
		float ring = exp(-pow((hr - 1.0) / ringW, 2.0));
		float inside2 = smoothstep(1.02, 0.9, hr);
		float crack = smoothstep(0.035, 0.0, abs(fbm(hq * 3.0 + 11.0) - 0.5)) + smoothstep(0.03, 0.0, abs(fbm(hq * 6.0 + 2.0) - 0.5)) * 0.6;
		float fog = fbm(hq * 2.5 + vec2(t * 0.05, -t * 0.03));
		float h = (ring * 1.2 + crack * 0.6 * inside2 + fog * 0.25 * inside2 + exp(-max(hr - 1.0, 0.0) / 0.25) * 0.25) * uHusk;
		col = col * alpha + uIce * h;
		alpha = clamp(alpha + h, 0.0, 1.0);
		col /= max(alpha, 1e-3);
	}
	outColor = vec4(col / max(alpha, 1e-3), alpha * uAmt);
}`;

/**
 * 双龙对撞（第 4 段爆发点）：左边一道白焰、右边一道蓝雷，在 uC 处撞成一团黑白翻滚的光球（本是一体）。
 * uA / uB 光束起点，uC 撞击点（屏幕像素）；uPow 光束强度；uBall 光球半径；uShock 冲击波环的进度 0–1；uDust 烟尘。
 */
export const BEAMS_FRAG = `${COMMON}
${SCREEN}
uniform vec2 uA;
uniform vec2 uB;
uniform vec2 uC;
uniform float uPow;
uniform float uBall;
uniform float uShock;
uniform float uDust;
uniform vec3 uWarm;
uniform vec3 uBlue;

// 点到线段的距离与沿线参数
vec2 segDist(vec2 p, vec2 a, vec2 b) {
	vec2 ab = b - a;
	float u = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
	return vec2(length(p - a - ab * u), u);
}

void main() {
	vec2 s = screenPx();
	float t = uTime;
	vec3 col = vec3(0.0);

	// 光球的光照亮四周的烟尘
	vec2 dc = s - uC;
	float rc = length(dc);
	float lit = exp(-rc / 520.0);
	float smoke = fbm(s / 260.0 + vec2(t * 0.08, -t * 0.05) + fbm(s / 500.0 - t * 0.03));
	col += mix(uWarm, uBlue, smoothstep(-300.0, 300.0, dc.x)) * smoothstep(0.35, 0.9, smoke) * lit * 0.55 * uDust;

	// 白焰光束（左）：粗、翻卷
	vec2 dA = segDist(s, uA, uC);
	float wobA = (fbm(vec2(dA.y * 6.0 - t * 3.0, t * 0.7)) - 0.5) * 34.0;
	float wA = (26.0 + 18.0 * fbm(vec2(dA.y * 10.0 - t * 5.0, 1.3))) * (0.6 + 0.4 * dA.y);
	float dA2 = abs(dA.x + wobA * (1.0 - dA.y) * 0.0) ;
	float coreA = exp(-pow(dA.x / (wA * 0.45), 2.0));
	float glowA = exp(-dA.x / (wA * 2.6));
	col += (mix(uWarm, vec3(1.0), coreA) * coreA * 1.4 + uWarm * glowA * 0.6) * uPow;
	// 火舌：沿光束外缘翻出的碎焰
	float lick = smoothstep(0.62, 0.85, fbm(vec2(dA.y * 14.0 - t * 6.0, dA.x / 40.0))) * exp(-dA.x / (wA * 1.6));
	col += vec3(1.0, 0.7, 0.42) * lick * 0.6 * uPow;

	// 蓝雷光束（右）：锯齿状，几股电弧缠绕
	vec2 dB = segDist(s, uB, uC);
	float zig = 0.0;
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float off = (noise(vec2(dB.y * (18.0 + fi * 7.0) - t * 22.0, fi * 5.0)) - 0.5) * (40.0 + fi * 18.0);
		vec2 nrm = normalize(vec2(-(uC - uB).y, (uC - uB).x));
		float dd = abs(dot(s - uB, nrm) - off);
		zig += exp(-pow(dd / (2.5 + fi), 2.0)) * (1.0 - fi * 0.25) * step(dB.x, 140.0);
	}
	float coreB = exp(-pow(dB.x / 11.0, 2.0));
	float glowB = exp(-dB.x / 60.0);
	col += (vec3(1.0) * zig * 0.9 + uBlue * glowB * 0.75 + mix(uBlue, vec3(1.0), 0.6) * coreB * 0.9) * uPow * (0.85 + 0.15 * sin(t * 50.0));

	// 撞击点：黑白翻滚的光球，左半偏暖、右半偏蓝
	if (uBall > 1.0) {
		vec2 q = dc / uBall;
		float rr = length(q);
		float ang = atan(q.y, q.x);
		float sw = sin(ang * 2.0 + rr * 6.0 - t * 7.0 + fbm(q * 2.5 + t * 0.6) * 4.0);
		float white = smoothstep(-0.2, 0.3, sw);
		float body = smoothstep(1.05, 0.9, rr + (fbm(q * 3.0 + t) - 0.5) * 0.25);
		vec3 tint = mix(uWarm, uBlue, smoothstep(-0.4, 0.4, q.x));
		vec3 inner = mix(vec3(0.0), mix(tint, vec3(1.0), 0.5), white);
		float edge = exp(-pow((rr - 1.0) / 0.12, 2.0));
		float spikes = pow(noise(vec2(ang * 7.0, t * 2.0)), 4.0) * exp(-max(rr - 1.0, 0.0) * 1.6) * step(1.0, rr);
		col = mix(col, inner, body);
		col += (vec3(1.0) * edge * 1.2 + tint * spikes * 1.5 + tint * exp(-max(rr - 1.0, 0.0) * 2.5) * 0.5) ;
	}

	// 冲击波环
	if (uShock > 0.0 && uShock < 1.0) {
		float R = uShock * 1500.0;
		float ring = exp(-pow((rc - R) / (14.0 + 50.0 * uShock), 2.0)) * (1.0 - uShock);
		col += vec3(1.0) * ring * 1.3;
	}

	outColor = vec4(col, 1.0);
}`;
