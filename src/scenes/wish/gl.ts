// ─── 《迎着流星》大气层剖面的着色器背景 ───────────────────────────────
// 整期一台连续镜头：镜头一路穿过大气层的各层，下一层从当前层里慢慢过渡出来。

import {COMMON} from '../../gl/shaders';

/** 云层：分层云幕，前景透视、远处淡薄；uTravel 为镜头穿过云层的进度 0–1 */
export const CLOUDLAYER_FRAG = `${COMMON}
uniform float uTravel;
uniform float uTint;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
	vec3 deep = vec3(0.043, 0.063, 0.125);      // #0b1020 夜空地平线
	vec3 mid = vec3(0.086, 0.137, 0.247);       // #16233f 深蓝
	vec3 cloudDark = vec3(0.373, 0.455, 0.533); // #5f7488 灰蓝云海
	vec3 cloudLit = vec3(0.804, 0.847, 0.890);  // #cdd8e3 冷白亮部
	vec3 col = mix(deep, mid, smoothstep(0.85, 0.2, uv.y));
	// 分层云带
	float band = 0.0;
	for (int i = 0; i < 5; i++) {
		float fi = float(i);
		float yy = 0.25 + fi * 0.12 + 0.05 * sin(uTime * 0.13 + fi);
		float d = abs(uv.y - yy);
		float layer = fbm(vec2(p.x * (1.2 + fi * 0.35), uv.y * 3.0 + fi + uTime * 0.008));
		band += smoothstep(0.09, 0.0, d) * smoothstep(0.35, 0.75, layer);
	}
	band = min(band, 1.0);
	vec3 cloud = mix(cloudDark, cloudLit, fbm(p * 2.5 + uTime * 0.01));
	col = mix(col, cloud, band * 0.85);
	// 镜头穿云：高光从中心往外冲
	float dive = uTravel * uTravel * 1.4;
	col += vec3(0.72, 0.80, 0.90) * exp(-length(p) * 2.2) * dive * 0.8;
	// 星点：越往越高越密
	vec2 cell = floor(gl_FragCoord.xy / 3.0);
	float hs = hash(cell);
	float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hs * 40.0);
	col += vec3(1.0, 0.95, 0.85) * step(0.997, hs) * smoothstep(0.75, 0.25, uv.y) * tw * 0.7;
	col *= mix(1.0, 0.45, smoothstep(0.45, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/** 臭氧层光幕：淡青紫与薄荷绿交叠的薄层光幕，陨石成串掠过 */
export const OZONE_FRAG = `${COMMON}
uniform float uFlow;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime * 0.6;
	vec3 lilac = vec3(0.553, 0.525, 0.788);   // #8d86c9 淡青紫
	vec3 mint = vec3(0.498, 0.839, 0.722);    // #7fd6b8 薄荷绿
	vec3 col = vec3(0.043, 0.047, 0.137) * 0.6;
	// 两层光幕错位流动
	float w1 = fbm(vec2(p.x * 1.4, p.y * 3.2 - t * 0.35));
	float w2 = fbm(vec2(p.x * 1.1 + 7.0, p.y * 2.4 + t * 0.28));
	float band = smoothstep(0.25, 0.85, w1 * 0.65 + w2 * 0.35);
	col = mix(col, lilac * 0.55, band * smoothstep(0.85, 0.3, uv.y));
	float band2 = smoothstep(0.3, 0.8, w2);
	col = mix(col, mint * 0.5, band2 * smoothstep(0.35, 0.75, uv.y) * 0.7);
	// 陨石流（成串的亮点，自左上向右下）
	float speed = uFlow;
	for (int i = 0; i < 6; i++) {
		float fi = float(i);
		float phase = fract(fi / 6.0 + t * 0.02 * speed);
		float px = mix(-0.1, 1.1, phase);
		float py = mix(0.05, 0.6, phase) + fi * 0.06;
		vec2 d = vec2((uv.x - px) * aspect, uv.y - py);
		float dist = length(d);
		float head = exp(-dist * dist * 90.0);
		float trail = exp(-length(d + vec2(0.25, -0.18)) * 6.0) * step(0.0, d.x) * step(d.x, 0.3);
		col += (vec3(1.0, 0.85, 0.6) * head * 1.6 + vec3(0.9, 0.6, 0.4) * trail * 0.5) * (1.0 - phase);
	}
	// 星尘浮动
	vec2 cell = floor(gl_FragCoord.xy / 2.5);
	float hs = hash(cell);
	float tw = 0.5 + 0.5 * sin(t * 3.0 + hs * 50.0);
	col += vec3(0.85, 0.9, 1.0) * step(0.995, hs) * tw * 0.6;
	col *= mix(1.0, 0.5, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/** 高空俯瞰：下方半边熔红的大地、半边深蓝的海洋，上方是云层之上的夜空 */
export const CLASH_FRAG = `${COMMON}
uniform float uHorizon;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime * 0.4;
	vec3 top = vec3(0.043, 0.063, 0.125);  // 夜空
	vec3 col = mix(top, vec3(0.02, 0.03, 0.08), smoothstep(0.9, 0.45, uv.y));
	// 大地（左，熔红）与海洋（右，深蓝），分界是一条对角线
	float seam = p.x + (uv.y - uHorizon) * 1.2;
	vec3 land = vec3(0.45, 0.12, 0.05) + vec3(0.5, 0.25, 0.08) * fbm(vec2(p.x * 3.0, uv.y * 3.0 + t * 0.05));
	vec3 sea = vec3(0.03, 0.08, 0.25) + vec3(0.05, 0.15, 0.35) * fbm(vec2(p.x * 2.0 + 9.0, uv.y * 2.0 - t * 0.03));
	float below = smoothstep(uHorizon, uHorizon - 0.06, uv.y);
	vec3 ground = mix(land, sea, smoothstep(-0.3, 0.3, seam));
	col = mix(col, ground, below * 0.9);
	// 分界线透出的光
	col += vec3(0.9, 0.6, 0.3) * exp(-abs(seam) * 28.0) * below * 0.5;
	// 云层之上的星尘
	vec2 cell = floor(gl_FragCoord.xy / 3.0);
	float hs = hash(cell);
	col += vec3(0.9, 0.95, 1.0) * step(0.996, hs) * smoothstep(0.1, 0.6, uv.y) * 0.7;
	col *= mix(1.0, 0.5, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/** 丰缘夜（壁画段）：琥珀火光的洞窟与天空之柱，暖色是全片唯一的暖段 */
export const AMBER_FRAG = `${COMMON}
uniform float uGlow;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime * 0.5;
	vec3 dark = vec3(0.06, 0.045, 0.03);
	vec3 amber = vec3(0.85, 0.54, 0.23);  // #d98a3a 暖琥珀
	// 洞窟岩壁：矿物质感
	float stone = fbm(p * vec2(6.0, 9.0));
	vec3 col = mix(dark, dark * 1.6 + vec3(0.12, 0.08, 0.03), stone);
	// 火光中心
	vec2 fire = vec2((0.5 - 0.5) * aspect, 0.72 - 0.5);
	float flick = 0.85 + 0.15 * sin(t * 9.0) * sin(t * 13.7);
	float gl = exp(-dot(p - fire, p - fire) * 2.6);
	col += amber * gl * uGlow * flick * 0.9;
	// 壁画的刻线：随火光浮现
	float lines = smoothstep(0.62, 0.68, fbm(vec2(uv.x * 3.0, uv.y * 5.0 + 2.0)));
	float li = abs(fract(uv.y * 9.0 + stone * 3.0) - 0.5);
	col += vec3(0.75, 0.62, 0.38) * smoothstep(0.42, 0.5, li) * lines * gl * uGlow * 1.4;
	// 向上开放的夜空（壁画段上部）
	col = mix(col, vec3(0.04, 0.06, 0.13), smoothstep(0.25, 0.05, uv.y) * 0.85);
	vec2 cell = floor(gl_FragCoord.xy / 3.0);
	float hs = hash(cell);
	col += vec3(1.0, 0.9, 0.7) * step(0.995, hs) * smoothstep(0.3, 0.05, uv.y) * 0.8;
	col *= mix(1.0, 0.45, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/** 大气层剖面示意：细线标出陨石能量流向烈空坐体内 */
export const SECTION_FRAG = `${COMMON}
uniform float uDraw;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime * 0.5;
	// 背景：剖面分层的夜空
	vec3 col = mix(vec3(0.043, 0.063, 0.125), vec3(0.086, 0.137, 0.247), smoothstep(0.9, 0.2, uv.y));
	// 分层细线
	for (int i = 0; i < 4; i++) {
		float fi = float(i);
		float yy = 0.8 - fi * 0.18;
		float li = abs(uv.y - yy + 0.02 * sin(p.x * 3.0 + t));
		col += vec3(0.5, 0.6, 0.75) * exp(-li * 45.0) * 0.35;
	}
	// 陨石能量流向：三条细流汇入中心
	vec2 c = vec2(0.0, 0.45);
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float ang = fi * 2.1 + 0.6;
		float r = length(p - c);
		float a = atan(p.y - c.y, p.x - c.x);
		float gate = step(abs(a - ang), 0.25) * step(1.35, r) * step(r, 0.4 + 0.9 * uDraw);
		float flow = smoothstep(0.4, 0.9, fbm(vec2(r * 8.0 - t * 1.4, fi * 3.0)));
		vec3 streamCol = mix(vec3(0.55, 0.84, 0.72), vec3(0.75, 0.75, 0.55), fi / 2.0);
		col += streamCol * gate * flow * 1.1;
	}
	// 中心的翠绿核
	float core = exp(-length(p - c) * 5.5);
	col += vec3(0.18, 0.75, 0.44) * core * (0.5 + 0.5 * uDraw);
	// 星尘
	vec2 cell = floor(gl_FragCoord.xy / 3.0);
	float hs = hash(cell);
	col += vec3(0.9, 0.95, 1.0) * step(0.996, hs) * 0.7;
	col *= mix(1.0, 0.45, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	outColor = vec4(col * uBright, 1.0);
}
`;

/** 太空：近黑、冰蓝弧光、星尘 */
export const SPACE_FRAG = `${COMMON}
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
	float t = uTime * 0.3;
	vec3 col = vec3(0.016, 0.024, 0.051);  // #04060d 近黑
	// 地球弧光（画面下部，冰蓝）
	float arc = exp(-pow((uv.y - 1.12) * 2.2, 2.0));
	col += vec3(0.35, 0.65, 1.0) * arc * 0.7;
	float glow = exp(-pow((uv.y - 1.02) * 4.0, 2.0));
	col += vec3(0.62, 0.82, 1.0) * glow * 0.5;
	// 星尘：两层
	vec2 cell = floor(gl_FragCoord.xy / 2.0);
	float hs = hash(cell);
	float tw = 0.5 + 0.5 * sin(t * 2.5 + hs * 60.0);
	col += vec3(1.0, 0.98, 0.92) * step(0.995, hs) * tw * 0.9;
	vec2 cell2 = floor(gl_FragCoord.xy / 5.0);
	float hs2 = hash(cell2 + 7.0);
	col += vec3(0.7, 0.85, 1.0) * step(0.99, hs2) * 0.5;
	// 远处微小的翠绿光点（烈空坐的轮廓光，极远）
	float dx = length(p - vec2(0.35, -0.25));
	col += vec3(0.18, 0.75, 0.44) * exp(-dx * 18.0) * 0.5;
	outColor = vec4(col * uBright, 1.0);
}
`;

/** 第 1 段：云层之上的夜空俯瞰（陨石坠落 → 镜头降到天空之柱顶层）
 *  uDive：0 = 高空远景，1 = 贴近塔顶；uDim：压暗（光没亮起的停顿） */
export const SKYTOP_FRAG = `${COMMON}
uniform float uDive;
uniform float uDim;
uniform float uBright;

void main() {
	float aspect = uRes.x / uRes.y;
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
	float t = uTime * 0.35;
	vec3 ink = vec3(0.024, 0.035, 0.075);   // #060913 靛黑夜空
	vec3 deep = vec3(0.067, 0.098, 0.180); // #11192e
	vec3 col = mix(ink, deep, smoothstep(0.92, 0.12, uv.y));
	// 淡青紫 / 薄荷绿的大气薄幕（全片的两色）
	float w1 = fbm(vec2(p.x * 1.3, p.y * 2.6 - t * 0.25));
	float w2 = fbm(vec2(p.x * 1.05 + 7.0, p.y * 2.0 + t * 0.2));
	float band = smoothstep(0.52, 0.95, w1 * 0.6 + w2 * 0.4);
	col = mix(col, vec3(0.553, 0.525, 0.788) * 0.30, band * smoothstep(0.66, 0.10, uv.y) * 0.55);
	col = mix(col, vec3(0.498, 0.839, 0.722) * 0.26, smoothstep(0.60, 0.98, w2) * smoothstep(0.28, 0.72, uv.y) * 0.45);
	// 云海：随 uDive 从画面下缘涌上来（塔顶在云层之上）
	float seaY = mix(0.52, 1.30, uDive);
	float sea = smoothstep(seaY - 0.10, seaY + 0.14, uv.y);
	float cl = fbm(vec2(p.x * 2.1, (uv.y - seaY) * 5.5 + t * 0.05));
	float cl2 = fbm(vec2(p.x * 4.3 + 3.0, (uv.y - seaY) * 9.0 - t * 0.04));
	vec3 cloud = mix(vec3(0.209, 0.259, 0.329), vec3(0.623, 0.694, 0.792), cl * 0.72 + cl2 * 0.28);
	col = mix(col, cloud, sea * 0.92);
	// 云海下缘、丰缘的暖光（唯一的一点暖色）
	col += vec3(0.85, 0.55, 0.26) * exp(-abs(uv.y - seaY) * 34.0) * 0.30 * (1.0 - uDive * 0.45);
	// 星点
	vec2 cell = floor(gl_FragCoord.xy / 3.0);
	float hs = hash(cell);
	float tw = 0.6 + 0.4 * sin(t * 2.0 + hs * 40.0);
	col += vec3(1.0, 0.96, 0.90) * step(0.997, hs) * smoothstep(0.86, 0.18, uv.y) * tw * 0.85 * (1.0 - uDive * 0.8);
	col *= mix(1.0, 0.5, smoothstep(0.4, 1.1, length((uv - 0.5) * vec2(1.6, 1.0))));
	col = mix(col, col * 0.16 + vec3(0.012, 0.010, 0.014), uDim);
	outColor = vec4(col * uBright, 1.0);
}
`;
