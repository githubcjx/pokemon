export const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
out vec4 outColor;

// Dave Hoskins 的无正弦哈希，避免规则纹理
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
	for (int i = 0; i < 6; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}
`;

/**
 * 远古星云：金棕色的域扭曲噪声 + 向中心旋转的漩涡 + 中心暖光 + 放射神光。
 * uCenter: 漩涡/光源中心（0–1，y 轴向下，与 CSS 坐标一致）
 * uConverge: 漩涡收紧程度 0–1
 * uWarm: 中心暖光强度
 * uRays: 放射光束强度
 * uBright: 整体亮度
 * uTintL / uTintR / uTintAmt: 左右两侧的色调偏移（乘色），默认不生效
 * uZoom: 画面缩放，>0 时星云向外扩张
 */
export const NEBULA_FRAG = `${COMMON}
uniform vec2 uCenter;
uniform float uConverge;
uniform float uWarm;
uniform float uRays;
uniform float uBright;
uniform vec3 uTintL;
uniform vec3 uTintR;
uniform float uTintAmt;
uniform float uZoom;

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 c = vec2(uCenter.x, 1.0 - uCenter.y);
	vec2 p = (gl_FragCoord.xy - c * uRes) / uRes.y;
	p /= 1.0 + uZoom;
	float r = length(p);

	// 漩涡：离中心越近旋转越多
	float swirl = uConverge * 2.2 / (r + 0.22) + uTime * 0.04;
	float s = sin(swirl), co = cos(swirl);
	vec2 q = mat2(co, -s, s, co) * p;
	q *= 1.0 + uConverge * 0.6;

	vec2 w = vec2(fbm(q * 2.0 + uTime * 0.025), fbm(q * 2.0 + vec2(5.2, 1.3) - uTime * 0.02));
	float n = fbm(q * 2.4 + 2.2 * w);

	vec3 col = mix(vec3(0.030, 0.019, 0.010), vec3(0.20, 0.115, 0.045), smoothstep(0.30, 0.78, n));
	col = mix(col, vec3(0.62, 0.42, 0.17), smoothstep(0.60, 0.95, n) * 0.55);
	// 细丝状的亮纹
	float wisp = pow(smoothstep(0.45, 1.0, n * (0.6 + w.x)), 3.0);
	col += vec3(0.95, 0.70, 0.34) * wisp * 0.38;

	// 中心暖光（外晕 + 内核）
	col += vec3(1.0, 0.72, 0.36) * uWarm * exp(-r * r * 5.0) * 0.8;
	col += vec3(1.0, 0.90, 0.70) * uWarm * exp(-r * r * 38.0) * 0.6;

	// 放射神光：沿角度方向的噪声条纹
	float a = atan(p.y, p.x);
	vec2 dir = vec2(cos(a), sin(a));
	float ray = fbm(dir * 3.5 + vec2(uTime * 0.03, -uTime * 0.02));
	ray = pow(smoothstep(0.35, 0.85, ray), 2.2);
	float fine = pow(noise(dir * 40.0 + uTime * 0.05), 4.0);
	col += vec3(1.0, 0.80, 0.48) * (ray * 0.55 + fine * 0.25) * uRays * exp(-r * 1.4) * smoothstep(0.02, 0.18, r);

	// 稀疏的暖色星点
	vec2 g = gl_FragCoord.xy / 2.0;
	vec2 id = floor(g);
	float h = hash(id);
	float star = step(0.9965, h) * (0.45 + 0.55 * sin(uTime * 1.5 + h * 60.0));
	col += vec3(1.0, 0.88, 0.65) * star * 0.7;

	// 左右色调偏移
	vec3 tint = mix(uTintL, uTintR, smoothstep(0.25, 0.75, uv.x));
	col = mix(col, col * tint, uTintAmt);

	// 暗角
	col *= mix(1.0, 0.28, smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.7, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/** 胶片颗粒 + 轻微闪烁，以 overlay 混合叠在最上层 */
export const GRAIN_FRAG = `${COMMON}
void main() {
	// 12Hz 刷新：颗粒在相邻几帧保持不变，编码器可复用，显著降低码率
	float t = floor(uTime * 12.0);
	float g = hash(gl_FragCoord.xy + vec2(t * 37.0, t * 91.0));
	float flicker = 0.015 * sin(uTime * 37.0) + 0.01 * sin(uTime * 13.0);
	outColor = vec4(vec3(0.5 + (g - 0.5) * 0.9 + flicker), 1.0);
}
`;

/**
 * 创世黎明：弧形星球地平线 + 地平线上升起的金色晨光 + 流动的光带与星辰。
 * uSun: 晨光中心（0–1，CSS 坐标）；uHorizon: 地平线顶点高度（0–1，自顶向下）
 * uGlow: 晨光强度；uRays: 放射光束强度；其余同星云。
 */
export const DAWN_FRAG = `${COMMON}
uniform vec2 uSun;
uniform float uHorizon;
uniform float uGlow;
uniform float uRays;
uniform float uBright;
uniform vec3 uTintL;
uniform vec3 uTintR;
uniform float uTintAmt;
uniform float uZoom;

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	// 以画面底边中点为原点、按高度归一化的坐标
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	vec2 sun = vec2((uSun.x - 0.5) * aspect, 1.0 - uSun.y);
	float t = uTime;

	// 巨大的星球：圆心在画面下方很远处，只露出一道弧形地平线
	float R = 3.2;
	vec2 pc = vec2(0.0, (1.0 - uHorizon) - R);
	float d = length(p - pc) - R; // >0 在大气中，<0 在地表

	// 天空：地平线附近琥珀色，向上过渡到深褐近黑
	float h = max(d, 0.0);
	vec3 sky = mix(vec3(0.42, 0.24, 0.09), vec3(0.028, 0.018, 0.010), smoothstep(0.0, 0.75, h));
	// 大气辉光带
	sky += vec3(1.0, 0.70, 0.34) * exp(-h * 10.0) * 0.55 * uGlow;

	// 流动的光带（横向拉伸的噪声，随高度分层、缓慢漂移）
	vec2 q = vec2(p.x / (1.0 + uZoom), h);
	float band = fbm(vec2(q.x * 1.6 + t * 0.018, q.y * 7.0 - t * 0.01) + fbm(q * 3.0 + t * 0.02));
	float bandMask = smoothstep(0.02, 0.18, h) * (1.0 - smoothstep(0.35, 0.85, h));
	sky += vec3(0.95, 0.66, 0.30) * pow(smoothstep(0.45, 0.95, band), 2.0) * bandMask * 0.45;

	// 高空的星辰
	vec2 g = gl_FragCoord.xy / 2.0;
	float hs = hash(floor(g));
	float star = step(0.9972, hs) * (0.45 + 0.55 * sin(t * 1.6 + hs * 60.0));
	sky += vec3(1.0, 0.9, 0.72) * star * 0.75 * smoothstep(0.25, 0.6, h);

	// 地表：暗褐色岩面 + 贴着边缘的一道亮金色轮廓光
	float surf = fbm(p * vec2(5.0, 14.0) + vec2(t * 0.005, 0.0));
	vec3 ground = vec3(0.07, 0.042, 0.02) * (0.55 + 0.9 * surf);
	ground += vec3(1.0, 0.76, 0.4) * exp(min(d, 0.0) * 70.0) * 0.7 * uGlow;
	// 边缘抗锯齿
	vec3 col = mix(ground, sky, smoothstep(-0.002, 0.002, d));

	// 晨光：柔和外晕 + 明亮内核（被地平线遮住下半部分）
	float ds = length(p - sun);
	float above = smoothstep(-0.01, 0.02, d);
	col += vec3(1.0, 0.72, 0.38) * exp(-ds * 3.2) * 0.75 * uGlow * mix(0.25, 1.0, above);
	col += vec3(1.0, 0.92, 0.74) * exp(-ds * 18.0) * 0.9 * uGlow * above;

	// 自晨光向上放射的光束
	vec2 v = p - sun;
	float a = atan(v.y, v.x);
	vec2 dir = vec2(cos(a), sin(a));
	float ray = fbm(dir * 3.2 + vec2(t * 0.025, -t * 0.02));
	ray = pow(smoothstep(0.35, 0.85, ray), 2.0);
	col += vec3(1.0, 0.8, 0.48) * ray * uRays * exp(-ds * 1.3) * smoothstep(0.0, 0.2, v.y + 0.05) * above * 0.6;

	// 左右色调偏移
	vec3 tint = mix(uTintL, uTintR, smoothstep(0.25, 0.75, uv.x));
	col = mix(col, col * tint, uTintAmt);

	// 暗角
	col *= mix(1.0, 0.3, smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.7, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 毁坏的世界：暗紫褐色的扭曲迷雾向上流动；原来的世界倒悬在画面顶部（弧形地平线 + 晨光）；
 * 以 uCenter 为中心向外蔓延的暗影触须。
 * uHorizonTop: 倒悬地平线顶点的高度（0–1，自底向上）
 * uGlow: 原世界光芒强度；uRays: 向下的光束；uShadow: 暗影蔓延程度 0–1
 */
export const DISTORTION_FRAG = `${COMMON}
uniform vec2 uCenter;
uniform float uHorizonTop;
uniform float uGlow;
uniform float uRays;
uniform float uShadow;
uniform float uBright;

void main() {
	vec2 uv = gl_FragCoord.xy / uRes;
	float aspect = uRes.x / uRes.y;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime;

	// 扭曲的空间：坐标被正弦波拧动
	vec2 w = p;
	w.x += sin(p.y * 3.0 + t * 0.22) * 0.05;
	w.y += sin(p.x * 2.4 - t * 0.17) * 0.04;

	// 向上流动的迷雾
	vec2 q = w * 2.2 + vec2(0.0, -t * 0.07);
	vec2 wq = vec2(fbm(q + t * 0.03), fbm(q + vec2(3.1, 7.7) - t * 0.02));
	float n = fbm(q * 1.2 + 2.0 * wq);
	vec3 col = vec3(0.020, 0.012, 0.022);
	col = mix(col, vec3(0.13, 0.065, 0.12), smoothstep(0.35, 0.82, n));
	col += vec3(0.55, 0.36, 0.18) * pow(smoothstep(0.55, 1.0, n * (0.5 + wq.y)), 3.0) * 0.32;

	// 倒悬的原世界：星球在画面上方，弧线向下凸
	float R = 3.2;
	vec2 pc = vec2(0.0, uHorizonTop + R);
	float d = length(p - pc) - R; // >0 在弧线下方（毁坏的世界一侧）
	float h = max(d, 0.0);
	col += vec3(1.0, 0.70, 0.34) * exp(-h * 9.0) * 0.45 * uGlow;
	vec3 ground = vec3(0.06, 0.036, 0.02) * (0.55 + 0.9 * fbm(p * vec2(5.0, 14.0)));
	ground += vec3(1.0, 0.76, 0.4) * exp(min(d, 0.0) * 70.0) * 0.7 * uGlow;
	col = mix(ground, col, smoothstep(-0.002, 0.002, d));

	// 原世界的晨光，以及向下照进毁坏的世界的光束
	vec2 sun = vec2(0.0, uHorizonTop - 0.09);
	vec2 v = p - sun;
	float ds = length(v);
	float below = smoothstep(-0.01, 0.02, d);
	col += vec3(1.0, 0.74, 0.40) * exp(-ds * 3.0) * 0.55 * uGlow * mix(0.25, 1.0, below);
	col += vec3(1.0, 0.92, 0.74) * exp(-ds * 18.0) * 0.8 * uGlow * below;
	float a = atan(v.y, v.x);
	vec2 dir = vec2(cos(a), sin(a));
	float ray = pow(smoothstep(0.35, 0.85, fbm(dir * 3.2 + vec2(t * 0.025, -t * 0.02))), 2.0);
	col += vec3(1.0, 0.8, 0.5) * ray * uRays * exp(-ds * 1.1) * smoothstep(0.0, 0.2, -v.y + 0.05) * below * 0.55;

	// 暗影触须：沿角度起伏的边界从中心向外蔓延
	vec2 c = vec2((uCenter.x - 0.5) * aspect, 1.0 - uCenter.y);
	vec2 e = p - c;
	float r = length(e);
	float ang = atan(e.y, e.x);
	float tend = fbm(vec2(cos(ang), sin(ang)) * 2.6 + vec2(t * 0.06, -t * 0.04));
	float reach = uShadow * (0.25 + 1.5 * tend * tend);
	float shade = smoothstep(reach, reach - 0.3, r) * uShadow;
	col = mix(col, vec3(0.008, 0.004, 0.01), shade * 0.88);
	col += vec3(0.55, 0.22, 0.5) * smoothstep(0.07, 0.0, abs(r - reach)) * uShadow * 0.3;

	col *= mix(1.0, 0.3, smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.7, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 晨雾中的湖：远近两层山脊剪影、地平线后的晨光、流动的雾带；
 * 湖面倒映天空并带波纹扰动，太阳下方有一条闪烁的波光带；支持三组涟漪。
 * uWater: 水岸线高度（0–1，自顶向下）；uSun: 晨光中心（0–1，CSS 坐标）
 * uRip0..2: (x, y, age) —— 涟漪中心（0–1，CSS 坐标）与已扩散时间（秒，<=0 表示无）
 */
export const LAKE_FRAG = `${COMMON}
uniform float uWater;
uniform vec2 uSun;
uniform float uGlow;
uniform float uBright;
uniform vec3 uRip0;
uniform vec3 uRip1;
uniform vec3 uRip2;
uniform float uMode; // 0 = 完整画面，1 = 只画水面（水岸线以上透明）

float aspect;

// 天空（含山脊与雾），p 为以底边中点为原点、按高度归一化的坐标
vec3 skyColor(vec2 p, float waterY, vec2 sun, float t) {
	float h = p.y - waterY; // 离水岸线的高度
	vec3 col = mix(vec3(0.46, 0.28, 0.11), vec3(0.035, 0.022, 0.012), smoothstep(0.0, 0.55, h));
	float ds = length(p - sun);
	col += vec3(1.0, 0.72, 0.38) * exp(-ds * 3.0) * 0.7 * uGlow;
	col += vec3(1.0, 0.92, 0.75) * exp(-ds * 20.0) * 0.8 * uGlow;
	// 稀疏星点（黎明将尽）
	float hs = hash(floor(gl_FragCoord.xy / 2.0));
	col += vec3(1.0, 0.9, 0.7) * step(0.998, hs) * smoothstep(0.3, 0.5, h) * 0.5;
	// 远山：受大气散射影响较亮
	float far = waterY + 0.07 + 0.09 * fbm(vec2(p.x * 1.4 + 3.0, 1.0)) + 0.03 * fbm(vec2(p.x * 5.0, 2.0));
	vec3 farCol = mix(vec3(0.20, 0.13, 0.08), col, 0.45);
	col = mix(farCol, col, smoothstep(-0.003, 0.003, p.y - far));
	// 近山：更暗
	float near = waterY + 0.02 + 0.07 * fbm(vec2(p.x * 2.2 - 7.0, 4.0)) + 0.02 * fbm(vec2(p.x * 9.0, 5.0));
	col = mix(vec3(0.06, 0.04, 0.03), col, smoothstep(-0.003, 0.003, p.y - near));
	// 雾带：贴着水岸线横向流动
	float mist = fbm(vec2(p.x * 1.8 - t * 0.03, h * 9.0 + t * 0.01));
	col = mix(col, vec3(0.62, 0.48, 0.32), smoothstep(0.4, 0.9, mist) * exp(-abs(h - 0.03) * 16.0) * 0.55);
	return col;
}

float ripple(vec3 r, vec2 p) {
	if (r.z <= 0.0) return 0.0;
	vec2 c = vec2((r.x - 0.5) * aspect, 1.0 - r.y);
	// 透视压扁的椭圆
	float d = length((p - c) * vec2(1.0, 4.2));
	float radius = r.z * 0.28;
	float ring = smoothstep(0.018, 0.0, abs(d - radius)) + 0.6 * smoothstep(0.014, 0.0, abs(d - radius * 0.62));
	return ring * exp(-r.z * 0.9);
}

void main() {
	aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime;
	float waterY = 1.0 - uWater;
	vec2 sun = vec2((uSun.x - 0.5) * aspect, 1.0 - uSun.y);

	vec3 col;
	if (p.y >= waterY) {
		if (uMode > 0.5) { outColor = vec4(0.0); return; }
		col = skyColor(p, waterY, sun, t);
	} else {
		float depth = waterY - p.y; // 离岸越远（越靠近镜头）波纹越大
		vec2 wave = vec2(
			fbm(vec2(p.x * 3.0, p.y * 40.0 + t * 0.6)) - 0.5,
			fbm(vec2(p.x * 6.0 + 9.0, p.y * 70.0 - t * 0.9)) - 0.5
		);
		vec2 rp = vec2(p.x + wave.x * 0.02 * (0.3 + depth * 4.0), waterY + depth + wave.y * 0.012 * (0.3 + depth * 5.0));
		col = skyColor(rp, waterY, sun, t) * 0.62;
		// 太阳下方的波光带
		float column = exp(-abs(p.x - sun.x) * (7.0 - depth * 6.0));
		float glint = pow(noise(vec2(p.x * 90.0, p.y * 260.0 + t * 3.0)), 14.0);
		col += vec3(1.0, 0.85, 0.55) * glint * column * 2.2 * uGlow;
		// 涟漪
		float rip = ripple(uRip0, p) + ripple(uRip1, p) + ripple(uRip2, p);
		col += vec3(1.0, 0.86, 0.6) * rip * 0.35;
		// 水岸线上的一道亮边
		col += vec3(1.0, 0.8, 0.5) * exp(-depth * 220.0) * 0.25 * uGlow;
	}

	col *= mix(1.0, 0.3, smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.7, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;


// 熔岩裂缝（第 2 期公用）
const CRACKS = `
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.31)); }

// Voronoi 的 F2 - F1：越接近 0 越在裂缝上
float cracks(vec2 p, float t) {
	vec2 i = floor(p), f = fract(p);
	float d1 = 8.0, d2 = 8.0;
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 g = vec2(x, y);
		vec2 o = 0.5 + 0.4 * sin(t * 0.12 + 6.2831 * hash2(i + g));
		float d = length(g + o - f);
		if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
	}
	return d2 - d1;
}
`;

// 海浪高度场（第 2 期公用）
const WAVES = `
float waveH(vec2 g, float t) {
	float h = 0.5 * sin(g.x * 0.8 + g.y * 1.2 - t * 1.4 + fbm(g * 0.25) * 4.0);
	h += 0.35 * fbm(g * 0.7 + vec2(t * 0.25, -t * 0.45));
	h += 0.15 * fbm(g * 2.2 + vec2(-t * 0.4, t * 0.6));
	return h;
}
`;

/**
 * 熔岩大地（第 2 期）：透视地面上 Voronoi 裂缝里流动的岩浆 + 被熔岩映红的烟云天空 + 远处火山脊。
 * uHorizon: 地平线高度（0–1，自下而上）
 * uHeat: 岩浆亮度
 * uBright: 整体亮度
 */
export const LAVA_FRAG = `${COMMON}
uniform float uHorizon;
uniform float uHeat;
uniform float uBright;

${CRACKS}
void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	float t = uTime;
	// 热浪扭曲：向上飘的细碎抖动
	uv += (vec2(noise(uv * vec2(7.0, 16.0) + vec2(0.0, -t * 1.6)), noise(uv * vec2(8.0, 13.0) + vec2(5.0, -t * 1.3))) - 0.5) * 0.004;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float h = uHorizon;
	vec3 col;

	if (p.y > h) {
		float y = p.y - h;
		float smoke = fbm(vec2(p.x * 1.4 + t * 0.02, y * 2.0 - t * 0.05));
		float smoke2 = fbm(vec2(p.x * 3.2 - t * 0.03, y * 3.6 - t * 0.09) + smoke * 1.5);
		col = mix(vec3(0.42, 0.12, 0.035), vec3(0.04, 0.018, 0.01), smoothstep(0.0, 0.5, y));
		col *= 0.45 + 1.0 * smoke2;
		col += vec3(1.0, 0.42, 0.1) * exp(-y * 8.0) * 0.55 * uHeat;
		// 远处火山脊：剪影，脊线被熔岩映出一道暗红
		float ridge = h + 0.025 + 0.07 * fbm(vec2(p.x * 1.2 + 11.0, 0.5)) + 0.02 * fbm(vec2(p.x * 6.0, 3.0));
		if (p.y < ridge) {
			col = vec3(0.035, 0.018, 0.012) + vec3(0.7, 0.2, 0.04) * exp(-(ridge - p.y) * 60.0) * 0.5 * uHeat;
			col += vec3(0.9, 0.3, 0.06) * exp(-(p.y - h) * 70.0) * 0.35 * uHeat;
		}
	} else {
		float y = h - p.y;
		float z = 0.32 / (y + 0.012);
		// 地面坐标放大：近处一屏约 8 个岩块
		vec2 g = vec2(p.x * z, z) * 6.0;
		// 域扭曲：打散 Voronoi 的规则感，裂缝变得弯曲、粗细不一
		vec2 w = vec2(fbm(g * 0.45 + 3.1), fbm(g * 0.45 + 8.7)) - 0.5;
		vec2 gw = g + w * 1.6;
		float c = cracks(gw * 0.9, t);
		float c2 = cracks(gw * 2.4 + 7.0, t * 1.3);
		float flow = fbm(g * 0.6 + vec2(t * 0.05, t * 0.14));
		float width = mix(5.0, 22.0, fbm(g * 0.9 + 1.7)); // 裂缝宽窄变化
		float alive = smoothstep(0.3, 0.65, fbm(g * 0.35 + 4.0)); // 部分裂缝冷却变暗
		float pulse = 0.75 + 0.25 * sin(t * 1.2 + flow * 7.0);
		float glow = exp(-c * width) * (0.35 + 1.1 * flow) * (0.25 + 0.75 * alive);
		glow += 0.35 * exp(-c2 * 26.0) * flow * alive;
		// 熔岩池：大块的流动岩浆
		float pool = smoothstep(0.6, 0.7, fbm(gw * 0.32 + vec2(0.0, t * 0.03)));
		glow = max(glow, pool * (0.9 + 0.5 * fbm(gw * 2.0 + t * 0.2)));
		glow *= pulse;
		vec3 rock = vec3(0.05, 0.034, 0.027) * (0.5 + 1.0 * fbm(g * 3.5));
		// 岩面被附近的熔岩照亮
		rock += vec3(0.4, 0.09, 0.02) * exp(-c * 4.0) * alive * 0.5;
		vec3 lava = mix(vec3(0.75, 0.12, 0.015), vec3(1.0, 0.72, 0.3), smoothstep(0.6, 1.4, glow));
		lava = mix(lava, vec3(1.0, 0.92, 0.65), smoothstep(1.3, 1.9, glow));
		col = rock + lava * glow * uHeat;
		// 近地平线处雾化，避免远处纹理闪烁
		float fog = 1.0 - exp(-z * 0.12);
		col = mix(col, vec3(0.42, 0.12, 0.03) * (0.5 + 0.6 * uHeat), fog);
	}

	col *= mix(1.0, 0.35, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 暴风雨海洋（第 2 期）：透视的浪涌（法线反光 + 浪尖白沫）+ 翻滚的风暴云 + 闪电照亮云层。
 * uHorizon: 海平线高度（0–1，自下而上）
 * uStorm: 浪高 / 风暴强度
 * uFlash: 闪电亮度，uFlashX: 闪电的横向位置（0–1）
 * uBright: 整体亮度
 */
export const STORMSEA_FRAG = `${COMMON}
uniform float uHorizon;
uniform float uStorm;
uniform float uFlash;
uniform float uFlashX;
uniform float uBright;

${WAVES}
vec3 sky(vec2 p, float y, float t, float fx) {
	float c1 = fbm(vec2(p.x * 1.1 + t * 0.05, y * 2.4 - t * 0.02));
	float c2 = fbm(vec2(p.x * 2.6 - t * 0.07, y * 4.5) + c1 * 2.0);
	vec3 col = mix(vec3(0.11, 0.15, 0.2), vec3(0.025, 0.035, 0.055), smoothstep(0.0, 0.55, y));
	col *= 0.5 + 1.0 * c2;
	// 闪电从云层内部照亮
	float lit = exp(-abs(p.x - fx) * 1.8) * (0.4 + 1.2 * c2);
	col += vec3(0.55, 0.65, 0.85) * lit * uFlash;
	return col;
}

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime;
	float h = uHorizon;
	float fx = (uFlashX - 0.5) * aspect;
	vec3 col;

	if (p.y > h) {
		col = sky(p, p.y - h, t, fx);
		col = mix(col, vec3(0.16, 0.2, 0.25) + vec3(0.3, 0.35, 0.45) * uFlash, exp(-(p.y - h) * 30.0) * 0.6);
	} else {
		float y = h - p.y;
		float z = 0.3 / (y + 0.01);
		vec2 g = vec2(p.x * z, z);
		float e = 0.06;
		float hc = waveH(g, t);
		float hx = waveH(g + vec2(e, 0.0), t);
		float hz = waveH(g + vec2(0.0, e), t);
		vec3 n = normalize(vec3(-(hx - hc) / e * uStorm, 1.0, -(hz - hc) / e * uStorm));
		// 掠射角下的菲涅尔反射：法线越朝向镜头，越多看到水体本身
		float fres = pow(1.0 - clamp(n.z * 0.9 + 0.1, 0.0, 1.0), 3.0);
		vec3 refl = sky(vec2(p.x + n.x * 0.3, 0.0), 0.15 + n.z * 0.3, t, fx);
		vec3 deep = vec3(0.008, 0.025, 0.05);
		col = mix(deep, refl * 1.1, clamp(fres + 0.25, 0.0, 1.0));
		// 浪尖白沫
		float foam = smoothstep(0.72, 0.95, hc * 0.9 + 0.35 * fbm(g * 3.0 + t * 0.3)) * uStorm;
		col = mix(col, vec3(0.55, 0.62, 0.68) + vec3(0.3) * uFlash, foam * 0.6);
		// 远处雾化
		float fog = 1.0 - exp(-z * 0.06);
		col = mix(col, vec3(0.12, 0.16, 0.21) + vec3(0.3, 0.35, 0.45) * uFlash, fog);
	}

	col *= mix(1.0, 0.35, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 海岸线航拍（第 2 期）：斜俯视的地面，左边熔岩大地、右边海洋，海岸线向远方延伸并来回拉锯。
 * 地面坐标 g（单位约为近处一屏的 1/5）：g.x = 屏幕横向 × 深度 + uScroll，g.y = 深度 + uDolly
 * uFront: 海岸线在地面坐标里的横向位置（< uScroll 时海洋占优，> uScroll 时大地占优）
 * uSun / uRain: 烈日与暴雨（0–1），uFlash / uFlashX: 闪电
 * uClash: 交界处的蒸汽强度；uHeat / uStorm: 岩浆亮度与浪高
 */
export const COAST_FRAG = `${COMMON}
uniform float uHorizon;
uniform float uFront;
uniform float uScroll;
uniform float uDolly;
uniform float uSun;
uniform float uRain;
uniform float uFlash;
uniform float uFlashX;
uniform float uClash;
uniform float uHeat;
uniform float uStorm;
uniform float uBright;
uniform float uCool;  // 熔岩冷却：0 = 炽热，1 = 冷却成黑色岩面
uniform vec3 uPool;   // 阳光光池：中心（0–1，y 向下）与半径（以画面高度为单位）
${CRACKS}
${WAVES}

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime;
	float h = uHorizon;
	float fx = (uFlashX - 0.5) * aspect;
	vec3 col;

	if (p.y > h) {
		// 天边：左侧烟尘、右侧风暴云
		float y = p.y - h;
		float side = smoothstep(-0.5, 0.5, p.x);
		float c = fbm(vec2(p.x * 2.0 + t * 0.03, y * 5.0 - t * 0.05));
		vec3 smoke = mix(vec3(0.5, 0.15, 0.04), vec3(0.08, 0.03, 0.015), smoothstep(0.0, 0.12, y)) * (0.6 + 0.8 * c);
		vec3 storm = mix(vec3(0.14, 0.18, 0.23), vec3(0.03, 0.04, 0.06), smoothstep(0.0, 0.12, y)) * (0.6 + 0.8 * c);
		col = mix(smoke, storm, side);
		col += vec3(1.0, 0.85, 0.55) * uSun * exp(-length(vec2(p.x + 0.5, y - 0.05)) * 6.0) * 1.2;
		col += vec3(0.5, 0.6, 0.8) * uFlash * exp(-abs(p.x - fx) * 2.0) * c;
	} else {
		float y = h - p.y;
		float z = 0.55 / (y + 0.02);
		vec2 g = vec2(p.x * z * 5.0 + uScroll, z * 5.0 + uDolly);

		// 海岸线：沿纵深蜿蜒，并随时间轻微起伏
		float front = uFront + (fbm(vec2(g.y * 0.12, t * 0.04)) - 0.5) * 5.0 + (noise(vec2(g.y * 0.9, t * 0.3)) - 0.5) * 0.8;
		float side = g.x - front; // < 0 大地，> 0 海洋

		// 大地：熔岩裂缝
		vec2 w = vec2(fbm(g * 0.45 + 3.1), fbm(g * 0.45 + 8.7)) - 0.5;
		vec2 gw = g + w * 1.6;
		float c = cracks(gw * 0.9, t);
		float c2 = cracks(gw * 2.4 + 7.0, t * 1.3);
		float flow = fbm(g * 0.6 + vec2(t * 0.05, t * 0.14));
		float width = mix(5.0, 22.0, fbm(g * 0.9 + 1.7));
		float alive = smoothstep(0.3, 0.65, fbm(g * 0.35 + 4.0));
		float glow = exp(-c * width) * (0.35 + 1.1 * flow) * (0.25 + 0.75 * alive) + 0.35 * exp(-c2 * 26.0) * flow * alive;
		// 推进中的熔岩前沿最热
		float edge = exp(-max(-side, 0.0) * 0.9);
		glow = max(glow, edge * (0.8 + 0.6 * fbm(gw * 1.5 + t * 0.3)) * (1.0 - uCool));
		vec3 rock = vec3(0.05, 0.034, 0.027) * (0.5 + 1.0 * fbm(g * 3.5)) + vec3(0.4, 0.09, 0.02) * exp(-c * 4.0) * alive * 0.5 * (1.0 - uCool);
		vec3 lavaC = mix(vec3(0.75, 0.12, 0.015), vec3(1.0, 0.72, 0.3), smoothstep(0.6, 1.4, glow));
		lavaC = mix(lavaC, vec3(1.0, 0.92, 0.65), smoothstep(1.3, 1.9, glow));
		// 冷却后：熔岩凝成灰黑的玄武岩，裂缝里只剩极暗的余温
		vec3 land = mix(rock, vec3(0.11, 0.095, 0.085) * (0.6 + 0.8 * fbm(g * 3.5)) * (0.7 + 0.3 * smoothstep(0.0, 0.3, c)), uCool) + lavaC * glow * uHeat * (1.0 - 0.96 * uCool);

		// 海洋：浪涌 + 近岸白沫
		vec2 gs = g * 0.7;
		float e = 0.06;
		float hc = waveH(gs, t);
		float hx = waveH(gs + vec2(e, 0.0), t);
		float hz = waveH(gs + vec2(0.0, e), t);
		vec3 n = normalize(vec3(-(hx - hc) / e * uStorm, 1.0, -(hz - hc) / e * uStorm));
		float fres = pow(1.0 - clamp(n.z * 0.6 + 0.4, 0.0, 1.0), 2.0);
		vec3 skyRefl = mix(vec3(0.12, 0.16, 0.21), vec3(0.6, 0.45, 0.3), uSun * 0.6) + vec3(0.4, 0.5, 0.7) * uFlash;
		vec3 sea = mix(vec3(0.01, 0.03, 0.055), skyRefl, clamp(fres + 0.2, 0.0, 1.0));
		float foam = smoothstep(0.7, 0.95, hc * 0.9 + 0.35 * fbm(gs * 3.0 + t * 0.3)) * uStorm * 0.6;
		foam += exp(-max(side, 0.0) * 1.1) * smoothstep(0.35, 0.75, fbm(g * 2.0 + vec2(t * 0.6, -t * 0.4)));
		sea = mix(sea, vec3(0.62, 0.68, 0.72) + vec3(0.25) * uFlash, clamp(foam, 0.0, 1.0) * 0.75);
		// 熔岩把近岸海水映红
		sea += vec3(0.6, 0.15, 0.03) * exp(-max(side, 0.0) * 1.5) * 0.5 * uHeat * (1.0 - uCool);

		col = mix(land, sea, smoothstep(-0.08, 0.08, side));

		// 交界处的蒸汽：向上翻腾
		float steam = exp(-abs(side) * 0.55) * smoothstep(0.35, 0.8, fbm(vec2(g.x * 0.5 - t * 0.2, g.y * 0.35 - t * 0.6)));
		col = mix(col, vec3(0.78, 0.74, 0.7) * (0.6 + 0.6 * uSun) + vec3(0.6, 0.18, 0.04) * 0.3 * uHeat, steam * uClash * 0.85);

		// 天气：烈日（暖、亮、海面耀斑）/ 暴雨（暗、冷）
		col *= 1.0 + 0.55 * uSun;
		col += vec3(1.0, 0.8, 0.5) * uSun * 0.05;
		col = mix(col, col * vec3(0.55, 0.62, 0.75), uRain * 0.7);
		col += vec3(0.35, 0.42, 0.55) * uFlash * 0.25;

		// 阳光光池：云层被冲开后洒下的金光，光池外仍在云影里
		vec2 pc = vec2((uPool.x - 0.5) * aspect, 1.0 - uPool.y);
		float pool = uPool.z > 0.0 ? smoothstep(uPool.z, uPool.z * 0.6, length((p - pc) * vec2(1.0, 1.8))) : 0.0;
		col = col * (1.0 + 0.45 * pool) + vec3(1.0, 0.8, 0.5) * pool * 0.06;
		col *= 1.0 - 0.3 * (1.0 - pool) * step(0.001, uPool.z);

		// 远处雾化
		float fog = 1.0 - exp(-z * 0.18);
		vec3 fogC = mix(vec3(0.4, 0.13, 0.04), vec3(0.13, 0.16, 0.21), smoothstep(-0.4, 0.4, p.x)) * (1.0 + 0.5 * uSun);
		col = mix(col, fogC, fog);
	}

	col *= mix(1.0, 0.35, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 穿云（第 2 期）：多层云雾朝镜头扑来。
 * uTravel: 已穿行的距离（每 +1 穿过一整轮云层）
 * uTint: 0 = 风暴云内部（灰蓝、暗），1 = 接近云顶（被阳光照亮的金白）
 * uFlash: 云层内部的闪电
 */
export const CLOUDS_FRAG = `${COMMON}
uniform float uTravel;
uniform float uTint;
uniform float uFlash;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
	vec3 dark = vec3(0.07, 0.085, 0.11);
	vec3 lit = vec3(0.95, 0.86, 0.7);
	vec3 base = mix(dark, lit * 0.8, uTint);
	vec3 col = base * (0.7 + 0.5 * fbm(p * 2.0 + uTravel));
	const int N = 7;
	for (int i = 0; i < N; i++) {
		float fi = float(i);
		float d = fract(fi / float(N) + uTravel); // 0 = 远，1 = 贴脸
		float scale = mix(3.2, 0.22, d * d);
		vec2 q = p * scale + vec2(fi * 7.3, fi * 3.1);
		float n = fbm(q * 1.3);
		float dens = smoothstep(0.42, 0.78, n);
		float fade = smoothstep(0.0, 0.3, d) * smoothstep(1.0, 0.8, d);
		vec3 c = mix(dark * 1.6, lit, uTint) * (0.55 + 0.7 * n);
		c += vec3(0.55, 0.65, 0.9) * uFlash * n * (1.0 - uTint);
		col = mix(col, c, dens * fade * 0.8);
	}
	col += vec3(0.5, 0.6, 0.85) * uFlash * 0.25 * (1.0 - uTint);
	col *= mix(1.0, 0.45, smoothstep(0.35, 1.0, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 平流层（第 2 期）：弧形地平线、下方云海、上方深空与星点、太阳神光，以及一条淡青色的臭氧层辉光带。
 * uSun: 太阳位置（0–1，y 向下）
 * uHorizon: 画面中央的地平线高度（0–1，自下而上），uCurve: 地平线弯曲程度
 * uRipple: 辉光带上涟漪的位置（0–1），uRippleAmt: 涟漪强度
 */
export const STRATO_FRAG = `${COMMON}
uniform vec2 uSun;
uniform float uHorizon;
uniform float uCurve;
uniform float uRipple;
uniform float uRippleAmt;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime;
	vec2 sun = vec2((uSun.x - 0.5) * aspect, 1.0 - uSun.y);
	float hy = uHorizon - uCurve * p.x * p.x;
	float above = p.y - hy;
	vec3 limb = vec3(0.32, 0.55, 0.85);
	vec3 col;

	if (above > 0.0) {
		col = mix(limb, vec3(0.025, 0.05, 0.12), smoothstep(0.0, 0.09, above));
		col = mix(col, vec3(0.004, 0.006, 0.016), smoothstep(0.09, 0.55, above));
		// 臭氧层辉光带：贴着地平线的一条细带，烈空坐经过时泛起涟漪
		float rx = (uRipple - 0.5) * aspect;
		float near = exp(-pow((p.x - rx) * 3.0, 2.0));
		float wob = uRippleAmt * near * sin((p.x - rx) * 38.0 - t * 7.0) * 0.006;
		float band = 0.045 + wob;
		float oz = exp(-pow((above - band) / 0.009, 2.0));
		col += vec3(0.3, 0.8, 0.62) * oz * (0.28 + 0.9 * uRippleAmt * near);
		// 星点：越高越多，缓慢闪烁
		vec2 cell = floor(gl_FragCoord.xy / 2.0);
		float hs = hash(cell);
		float tw = 0.6 + 0.4 * sin(t * 2.0 + hs * 40.0);
		col += vec3(1.0, 0.95, 0.85) * step(0.9965, hs) * smoothstep(0.08, 0.3, above) * tw * 0.8;
	} else {
		// 云海：透视的云顶，被侧面的阳光照亮
		float y = -above;
		float z = 0.12 / (y + 0.004);
		vec2 g = vec2(p.x * z, z) * 2.0;
		float c1 = fbm(g * 0.8 + vec2(t * 0.01, 0.0));
		float c2 = fbm(g * 2.4 + c1 * 1.5);
		float shade = 0.55 + 0.6 * c2;
		col = mix(vec3(0.5, 0.48, 0.5), vec3(1.0, 0.9, 0.74), c1) * shade;
		col *= 0.75 + 0.35 * exp(-abs(p.x - sun.x) * 1.2);
		col = mix(col, limb * 1.2, 1.0 - exp(-z * 0.08));
	}

	// 太阳：核心 + 光晕 + 放射神光
	vec2 d = p - sun;
	float ds = length(d);
	col += vec3(1.0, 0.86, 0.6) * exp(-ds * 4.5) * 0.7;
	col += vec3(1.0, 0.97, 0.9) * exp(-ds * 28.0) * 1.4;
	float ang = atan(d.y, d.x);
	float rays = pow(0.5 + 0.5 * sin(ang * 14.0 + sin(ang * 5.0 + t * 0.2) * 2.0), 6.0);
	col += vec3(1.0, 0.85, 0.55) * rays * exp(-ds * 2.6) * 0.35;

	// 金色调
	col = mix(col, col * vec3(1.08, 0.98, 0.85), 0.35);
	col *= mix(1.0, 0.45, smoothstep(0.45, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 地底岩浆房（第 2 期）：洞穴岩壁 + 底部透视的岩浆湖，暖光随呼吸起伏照亮洞顶。
 * uCenterX: 构图中心（0–1）；uPulse: 呼吸亮度 0–1；uBright: 整体亮度
 */
export const MAGMA_CAVE_FRAG = `${COMMON}
uniform float uCenterX;
uniform float uPulse;
uniform float uBright;
${CRACKS}

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - uCenterX) * aspect, uv.y);
	float t = uTime;
	float lake = 0.3; // 岩浆湖面高度
	vec3 col;
	float glowAmt = 0.65 + 0.35 * uPulse;

	if (p.y < lake) {
		float y = lake - p.y;
		float z = 0.25 / (y + 0.01);
		vec2 g = vec2(p.x * z, z) * 5.0;
		vec2 w = vec2(fbm(g * 0.4 + 3.1), fbm(g * 0.4 + 8.7)) - 0.5;
		float c = cracks((g + w * 1.4) * 0.8, t * 0.6);
		float flow = fbm(g * 0.5 + vec2(t * 0.04, t * 0.08));
		float glow = exp(-c * 9.0) * (0.5 + flow) + smoothstep(0.55, 0.75, flow) * 0.8;
		vec3 crust = vec3(0.06, 0.03, 0.02) * (0.6 + fbm(g * 3.0));
		vec3 lava = mix(vec3(0.8, 0.14, 0.02), vec3(1.0, 0.7, 0.28), smoothstep(0.6, 1.3, glow));
		col = crust + lava * glow * glowAmt;
		col = mix(col, vec3(0.55, 0.16, 0.04) * glowAmt, 1.0 - exp(-z * 0.12));
	} else {
		// 洞穴：越靠上越暗，被下方的岩浆映出暖光
		float y = p.y - lake;
		float rock = fbm(vec2(p.x * 3.0, p.y * 4.0)) * 0.7 + fbm(vec2(p.x * 9.0, p.y * 11.0)) * 0.3;
		vec3 wall = vec3(0.05, 0.03, 0.02) * (0.5 + rock);
		float lit = exp(-y * 5.0) * glowAmt;
		col = wall + vec3(0.75, 0.22, 0.05) * lit * (0.45 + 0.8 * rock);
		// 洞顶垂下的岩锥剪影
		float stal = 0.92 - 0.12 * pow(abs(sin(p.x * 7.0 + fbm(vec2(p.x * 3.0, 1.0)) * 3.0)), 6.0) - 0.05 * fbm(vec2(p.x * 12.0, 2.0));
		col = mix(col, vec3(0.02, 0.012, 0.01), smoothstep(-0.01, 0.01, p.y - stal));
		// 岩浆上方的热气
		float heat = fbm(vec2(p.x * 2.0, p.y * 3.0 - t * 0.3));
		col += vec3(0.5, 0.15, 0.03) * smoothstep(0.5, 0.9, heat) * exp(-y * 4.0) * 0.25 * glowAmt;
	}
	// 两侧岩壁收拢
	float side = smoothstep(0.55, 0.95, abs(p.x) + 0.15 * fbm(vec2(p.y * 4.0, 7.0)));
	col = mix(col, vec3(0.025, 0.015, 0.01) + col * 0.15, side);
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 海沟深渊（第 2 期）：从深青到全黑，顶部的焦散光纹渐弱，两侧海沟岩壁，海雪飘落、零星的生物荧光。
 * uCenterX: 构图中心（0–1）；uCaustic: 焦散光强度；uBright: 整体亮度
 */
export const ABYSS_FRAG = `${COMMON}
uniform float uCenterX;
uniform float uCaustic;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - uCenterX) * aspect, uv.y);
	float t = uTime;
	vec3 col = mix(vec3(0.0, 0.006, 0.014), vec3(0.02, 0.09, 0.13), smoothstep(0.0, 1.0, uv.y));
	// 自上方透下的焦散光纹，越深越弱
	vec2 q = p * 6.0 + vec2(t * 0.15, t * 0.1);
	float ca = pow(abs(sin(fbm(q) * 9.0 + t * 0.6)), 10.0);
	col += vec3(0.25, 0.6, 0.65) * ca * smoothstep(0.55, 1.0, uv.y) * uCaustic * 0.22;
	// 光柱
	float shaft = pow(0.5 + 0.5 * sin(p.x * 5.0 + fbm(vec2(p.x * 2.0, t * 0.1)) * 3.0), 8.0);
	col += vec3(0.1, 0.3, 0.35) * shaft * smoothstep(0.3, 1.0, uv.y) * uCaustic * 0.25;
	// 海雪：缓缓下落的细小颗粒
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		vec2 s = gl_FragCoord.xy / (5.0 + fi * 3.0);
		s.y += t * (6.0 + fi * 4.0);
		s.x += sin(s.y * 0.05 + fi) * 2.0;
		vec2 cell = floor(s);
		float h = hash(cell + fi * 13.0);
		vec2 f = fract(s) - 0.5;
		col += vec3(0.55, 0.7, 0.75) * step(0.985, h) * smoothstep(0.35, 0.0, length(f)) * (0.35 - fi * 0.08);
	}
	// 生物荧光：零星的冷光点，缓慢明灭
	vec2 bc = floor(gl_FragCoord.xy / 40.0);
	float bh = hash(bc + 71.0);
	vec2 bf = fract(gl_FragCoord.xy / 40.0) - 0.5;
	col += vec3(0.2, 0.9, 0.8) * step(0.993, bh) * smoothstep(0.25, 0.0, length(bf)) * (0.5 + 0.5 * sin(t * 1.5 + bh * 60.0)) * 0.6;
	// 海沟两侧岩壁
	float wall = smoothstep(0.5, 0.85, abs(p.x) + 0.18 * fbm(vec2(p.y * 3.0, 4.0)) - 0.06 * uv.y);
	col = mix(col, vec3(0.004, 0.01, 0.016) + col * 0.1, wall);
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 古地图大陆（第 2 期）：斜俯视的远古大地，金棕色陆地 + 雕版式海纹 + 描金海岸线 + 经纬网格；
 * 其中一块大陆可被拖动（uPull），身后留下航迹。地平线以上是暮色天空。
 * uHorizon: 地平线高度（0–1，自下而上）；uScale: 地面缩放（越大越"远"）；uOffset: 地面平移
 * uPull: 被拖动大陆的位移（地面坐标）；uGrid: 网格亮度；uBright: 整体亮度
 */
export const PANGAEA_FRAG = `${COMMON}
uniform float uHorizon;
uniform float uScale;
uniform vec2 uOffset;
uniform vec2 uPull;
uniform float uGrid;
uniform float uBright;

// 陆地高度场：> 0.5 为陆地
float landField(vec2 g) {
	return fbm(g * 0.22 + 11.0) * 0.85 + fbm(g * 0.9 + 3.0) * 0.15;
}

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime;
	float h = uHorizon;
	vec3 col;

	if (p.y > h) {
		// 暮色天空：贴近地平线是金色，往上渐暗
		float y = p.y - h;
		col = mix(vec3(0.85, 0.58, 0.28), vec3(0.18, 0.1, 0.06), smoothstep(0.0, 0.25, y));
		col = mix(col, vec3(0.04, 0.025, 0.02), smoothstep(0.25, 0.7, y));
		float cl = fbm(vec2(p.x * 1.5 + t * 0.01, y * 5.0));
		col *= 0.8 + 0.4 * cl;
	} else {
		float y = h - p.y;
		float z = 0.5 / (y + 0.02);
		vec2 g = vec2(p.x * z, z) * uScale + uOffset;

		// 静止的大陆 + 被拖动的大陆（以 c0 为中心的一大块，随 uPull 移动）
		float a = landField(g);
		vec2 gp = g - uPull;
		vec2 c0 = vec2(0.0, 6.0);
		float blob = smoothstep(5.5, 3.0, length((gp - c0) * vec2(0.8, 1.0)));
		float b = fbm(gp * 0.25 + 37.0) * 0.6 + 0.42 * blob;
		// 被拖动大陆四周（含它驶过的航道）空出一圈海，使它成为独立的一块
		vec2 rel = (g - c0) * vec2(0.8, 1.0);
		float lane = smoothstep(9.0, 4.0, abs(rel.x)) * step(-6.5, rel.y) * smoothstep(uPull.y + 16.0, uPull.y + 9.0, rel.y);
		float ring = max(smoothstep(8.5, 5.5, length(rel)), lane);
		float land = max(a * mix(1.0, 0.55, ring), b * blob);
		float mask = smoothstep(0.495, 0.505, land);

		// 海：深青褐色，刻着雕版式的波纹
		float hatch = smoothstep(0.82, 1.0, sin(g.y * 9.0 + fbm(g * 0.6) * 6.0 + t * 0.4));
		vec3 sea = vec3(0.04, 0.07, 0.075) + vec3(0.5, 0.4, 0.22) * hatch * 0.12;
		// 被拖动大陆身后的航迹
		float wake = exp(-abs((gp - c0).x) * 0.6) * smoothstep(0.0, -6.0, (gp - c0).y + 4.0) * step(0.001, length(uPull));
		sea += vec3(0.6, 0.5, 0.3) * wake * smoothstep(0.7, 1.0, sin(gp.y * 14.0 - t * 3.0)) * 0.25;

		// 陆：羊皮纸般的金棕色，带起伏的明暗
		float relief = fbm(g * 1.4 + 5.0);
		vec3 earth = mix(vec3(0.36, 0.25, 0.13), vec3(0.62, 0.47, 0.27), relief);
		earth *= 0.75 + 0.5 * smoothstep(0.5, 0.75, land);
		col = mix(sea, earth, mask);

		// 描金海岸线
		float coast = exp(-abs(land - 0.5) * 140.0);
		col += vec3(1.0, 0.78, 0.4) * coast * 0.55;

		// 经纬网格
		vec2 gl2 = abs(fract(g * 0.18) - 0.5);
		float grid = smoothstep(0.012, 0.0, min(gl2.x, gl2.y) / max(z * 0.12, 0.2));
		col += vec3(0.9, 0.7, 0.4) * grid * uGrid * 0.22;

		// 远处雾化成金色暮霭
		col = mix(col, vec3(0.7, 0.48, 0.24), 1.0 - exp(-z * 0.09));
	}

	col *= mix(1.0, 0.35, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 远古之海（第 2 期尾声）：深靛色的水体，中心一点粉金色的生命之光，放射光束与脉动的涟漪，漂浮的发光微粒。
 * uLight: 光源位置（0–1，y 向下）；uGlow: 光的强度 0–1；uBright: 整体亮度
 */
export const PRIMORDIAL_FRAG = `${COMMON}
uniform vec2 uLight;
uniform float uGlow;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
	vec2 lc = (vec2(uLight.x, 1.0 - uLight.y) - 0.5) * vec2(aspect, 1.0);
	float t = uTime;
	// 缓慢流动的深水
	vec2 flow = vec2(fbm(p * 1.5 + t * 0.03), fbm(p * 1.5 + 9.0 - t * 0.02));
	float water = fbm(p * 2.2 + flow * 1.2);
	vec3 col = mix(vec3(0.008, 0.012, 0.03), vec3(0.04, 0.05, 0.1), water);
	col += vec3(0.05, 0.08, 0.1) * smoothstep(0.4, 1.0, uv.y) * 0.5;

	vec2 d = p - lc;
	float r = length(d);
	float ang = atan(d.y, d.x);
	// 生命之光：粉色光核 + 金色光晕
	col += vec3(1.0, 0.62, 0.82) * exp(-r * 9.0) * 1.2 * uGlow;
	col += vec3(1.0, 0.8, 0.55) * exp(-r * 2.8) * 0.35 * uGlow;
	// 柔和的放射光束
	float rays = pow(0.5 + 0.5 * sin(ang * 11.0 + fbm(vec2(ang * 2.0, t * 0.15)) * 4.0), 5.0);
	col += vec3(1.0, 0.78, 0.7) * rays * exp(-r * 2.2) * 0.3 * uGlow;
	// 一圈圈向外扩散的脉动
	float pulse = smoothstep(0.85, 1.0, sin(r * 26.0 - t * 1.6)) * exp(-r * 2.5);
	col += vec3(1.0, 0.75, 0.6) * pulse * 0.12 * uGlow;
	// 漂浮的发光微粒
	for (int i = 0; i < 2; i++) {
		float fi = float(i);
		vec2 s = gl_FragCoord.xy / (14.0 + fi * 10.0) + vec2(t * (0.6 + fi * 0.3), t * (0.25 - fi * 0.4));
		vec2 cell = floor(s);
		float h = hash(cell + fi * 31.0);
		vec2 f = fract(s) - 0.5;
		float tw = 0.5 + 0.5 * sin(t * 2.0 + h * 50.0);
		col += vec3(1.0, 0.85, 0.6) * step(0.975, h) * smoothstep(0.3, 0.0, length(f)) * tw * (0.25 + 0.5 * uGlow * exp(-r * 1.2));
	}
	col *= mix(1.0, 0.3, smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;
