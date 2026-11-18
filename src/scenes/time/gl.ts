/**
 * 《时间的心跳》着色器。画风 A「星图仪」：深海军蓝的底，极淡的钴蓝星云与星点，随镜头视差移动。
 */

const NOISE = `
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
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
}`;

/**
 * 星图仪的底。
 * uCam：镜头中心（世界坐标）；uZoom：镜头倍率；uTime：流动时间 τ（秒）；
 * uGlow：屏幕上的一团光（x, y 像素，半径像素，强度）；uGlowCol：光的颜色；uDim：整体压暗 0–1。
 */
export const BG_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uCam;
uniform float uZoom;
uniform float uTime;
uniform vec4 uGlow;
uniform vec3 uGlowCol;
uniform float uDim;
out vec4 outColor;
${NOISE}

vec3 stars(vec2 p, float cell, float seed) {
	vec2 g = floor(p / cell);
	vec2 f = fract(p / cell) - 0.5;
	float h = hash(g + seed);
	vec2 o = vec2(hash(g + seed + 7.1), hash(g + seed + 3.7)) - 0.5;
	float d = length(f - o * 0.8);
	float s = smoothstep(0.08, 0.0, d) * step(0.82, h);
	float tw = 0.65 + 0.35 * sin(uTime * (0.6 + h * 1.4) + h * 40.0);
	return vec3(0.75, 0.85, 1.0) * s * tw * (0.4 + h * 0.6);
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1920.0 / uRes.x);
	vec2 q = px / vec2(1920.0, 1080.0);
	// 世界坐标（视差：星云 0.18，星点 0.32）
	vec2 w = (px - vec2(960.0, 540.0)) / uZoom;
	vec2 pNeb = w * pow(uZoom, 0.82) * 0.18 / 900.0 + uCam * 0.18 / 900.0;
	vec2 pStar = w * pow(uZoom, 0.68) * 0.32 + uCam * 0.32;

	vec3 col = mix(vec3(0.012, 0.024, 0.06), vec3(0.03, 0.06, 0.13), smoothstep(1.1, 0.0, length(q - vec2(0.5, 0.42)) * 1.25));
	float n = fbm(pNeb * 2.2 + vec2(uTime * 0.004, 0.0));
	float n2 = fbm(pNeb * 5.0 - vec2(0.0, uTime * 0.006) + 11.0);
	col += vec3(0.03, 0.07, 0.17) * smoothstep(0.42, 0.85, n) * 0.9;
	col += vec3(0.05, 0.05, 0.12) * smoothstep(0.55, 0.9, n2) * 0.5;
	col += stars(pStar, 46.0, 1.0) * 0.55;
	col += stars(pStar * 0.61 + 300.0, 46.0, 9.0) * 0.35;

	// 一团光
	float gd = length(px - uGlow.xy) / max(uGlow.z, 1.0);
	col += uGlowCol * uGlow.w * (exp(-gd * gd * 2.2) * 0.8 + exp(-gd * 1.4) * 0.25);

	// 暗角
	float v = smoothstep(1.25, 0.35, length((q - 0.5) * vec2(1.25, 1.0)));
	col *= mix(0.45, 1.0, v);
	col *= 1.0 - uDim;
	outColor = vec4(col, 1.0);
}`;
