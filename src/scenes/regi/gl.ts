import {GLSL_CAM} from './common';

export const HEAD = `#version 300 es
precision highp float;
precision highp usampler2D;
uniform vec2 uRes;
uniform float uTime;
out vec4 outColor;
${GLSL_CAM}

float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
	p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
	p3 += dot(p3, p3.yxz + 33.33);
	return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p, int oct) {
	float v = 0.0, a = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 8; i++) { if (i >= oct) break; v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}
// 水下焦散（经典的迭代干涉图样，周期 1）
float caustic(vec2 uv, float t) {
	vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
	vec2 i = p;
	float c = 1.0;
	float inten = 0.005;
	for (int n = 0; n < 4; n++) {
		float tt = t * (1.0 - (3.5 / float(n + 1)));
		i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
		c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
	}
	c /= 4.0;
	c = 1.17 - pow(c, 1.4);
	return pow(abs(c), 8.0);
}
vec3 aces(vec3 x) {
	return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
// 出入水面的水花：画面一圈圈荡开、发白
vec2 splashWarp(vec2 frag, float s) {
	if (s <= 0.0) return frag;
	vec2 c = uRes * 0.5;
	vec2 d = frag - c;
	float r = length(d) / uRes.y;
	float w = sin(r * 38.0 - uTime * 9.0) * 0.5 + sin(r * 17.0 + uTime * 5.0 + noise(frag * 0.01) * 6.0) * 0.5;
	return frag + normalize(d + 1e-3) * w * s * 26.0 + vec2(noise(frag * 0.006 + uTime), noise(frag * 0.006 - uTime)) * s * 30.0;
}
vec3 finish(vec3 col, vec2 frag, float exposure, float vig, float fade) {
	col = aces(col * exposure);
	vec2 q = frag / uRes - 0.5;
	col *= 1.0 - vig * smoothstep(0.25, 0.85, length(q * vec2(1.25, 1.0)));
	col = pow(col, vec3(1.0 / 2.2));
	col += (hash12(frag + fract(uTime) * 91.7) - 0.5) / 255.0;
	return col * (1.0 - fade);
}
`;

/**
 * 深海：海面在 y = 0，海底在 y = -60；海底正中 (0, -60, 0) 有一道透着青光的岩缝（石室的入口）。
 * 海雪是真正的 3D 粒子（沿视线逐格遍历），镜头怎么动都有正确的视差。
 */
export const SEA_FRAG = `${HEAD}
uniform float uCrack;   // 岩缝的光
uniform float uRays;    // 海面透下来的光束
uniform float uSnow;    // 海雪
uniform float uSplash;
uniform float uExposure;
uniform float uFade;

const float FLOOR = -60.0;
const vec3 TEAL = vec3(0.16, 0.85, 0.9);

float crackShape(vec2 xz) {
	float e = length(vec2(xz.x / 2.6, xz.y / 0.85));
	e += (fbm(xz * 1.4 + 3.1, 4) - 0.5) * 0.55;
	return e;
}

vec3 snow(vec3 C, vec3 D, float light) {
	float cs = 0.85;
	vec3 p = C / cs;
	vec3 cell = floor(p);
	vec3 st = sign(D);
	vec3 tDelta = abs(1.0 / max(abs(D), vec3(1e-4)));
	vec3 tMax = (st * (cell - p) + st * 0.5 + 0.5) * tDelta;
	float acc = 0.0;
	for (int i = 0; i < 40; i++) {
		vec3 h = hash33(cell + 17.0);
		if (h.x < 0.26) {
			vec3 o = hash33(cell * 1.37 + 5.3);
			vec3 q = (cell + 0.2 + 0.6 * o) * cs;
			// 慢慢下沉、微微摆动（幅度不出格子）
			q.y += sin(uTime * 0.35 + h.y * 6.28) * 0.08;
			q.x += sin(uTime * 0.27 + h.z * 6.28) * 0.06;
			vec3 v = q - C;
			float al = dot(v, D);
			if (al > 0.2) {
				float ang = length(v - D * al) / al;
				float sz = 0.0013 + 0.0013 * h.y;
				acc += smoothstep(sz, sz * 0.25, ang) * exp(-al * 0.14) * (0.45 + 0.55 * h.z);
			}
		}
		if (tMax.x < tMax.y) {
			if (tMax.x < tMax.z) { cell.x += st.x; tMax.x += tDelta.x; } else { cell.z += st.z; tMax.z += tDelta.z; }
		} else {
			if (tMax.y < tMax.z) { cell.y += st.y; tMax.y += tDelta.y; } else { cell.z += st.z; tMax.z += tDelta.z; }
		}
	}
	return vec3(0.55, 0.8, 0.85) * acc * light;
}

void main() {
	vec2 frag = splashWarp(gl_FragCoord.xy, uSplash);
	vec3 C = uCamPos;
	vec3 D = camRay(frag);
	float depth = max(-C.y, 0.0);
	float sunAt = exp(-depth * 0.05);

	// 水体：向上偏亮，向下沉入墨绿
	vec3 deep = vec3(0.0015, 0.008, 0.016);
	vec3 mid = vec3(0.008, 0.05, 0.075);
	vec3 shallow = vec3(0.035, 0.19, 0.25);
	vec3 col = mix(deep, mix(mid, shallow, sunAt), smoothstep(-0.7, 1.0, D.y));
	col *= 0.3 + 0.9 * sunAt;

	// 海面：从下往上看是一片晃动的亮
	if (D.y > 0.0) {
		float t = -C.y / D.y;
		vec3 S = C + D * t;
		float rip = caustic(S.xz * 0.08, uTime * 0.6);
		float win = smoothstep(0.55, 0.95, D.y);
		col += vec3(0.25, 0.55, 0.6) * (0.25 + rip * 0.9) * win * exp(-t * 0.04) * 1.6;
	}

	// 光束：从海面往下斜插
	vec2 sp = D.xz / (D.y + 1.35);
	float shafts = noise(vec2(sp.x * 7.0 + uTime * 0.08, sp.y * 2.0)) * noise(vec2(sp.x * 13.0 - uTime * 0.05, sp.y * 3.0 + 4.0));
	shafts = pow(shafts, 1.6) * smoothstep(-0.35, 0.6, D.y);
	col += vec3(0.12, 0.4, 0.45) * shafts * uRays * sunAt * 1.4;

	// 海底与岩缝
	vec3 Q = vec3(0.0, FLOOR + 0.6, 0.0);
	if (D.y < 0.0) {
		float t = (FLOOR - C.y) / D.y;
		vec3 P = C + D * t;
		float e = crackShape(P.xz);
		// 岩石：明暗起伏 + 法线
		float hb = fbm(P.xz * 0.35, 5);
		float hx = fbm((P.xz + vec2(0.05, 0.0)) * 0.35, 5);
		float hz = fbm((P.xz + vec2(0.0, 0.05)) * 0.35, 5);
		vec3 N = normalize(vec3((hb - hx) * 9.0, 1.0, (hb - hz) * 9.0));
		vec3 alb = mix(vec3(0.06, 0.07, 0.07), vec3(0.14, 0.15, 0.13), fbm(P.xz * 1.7, 4));
		// 岩缝的光照亮四周
		vec3 L = Q - P;
		float dl = length(L);
		float glow = uCrack * 6.0 / (1.0 + dl * dl * 0.18);
		vec3 lit = alb * (TEAL * glow * max(dot(N, L / dl), 0.0) + vec3(0.02, 0.06, 0.07) * sunAt * (0.4 + caustic(P.xz * 0.1, uTime * 0.5)));
		// 越靠近缝口越暗（往下陷）
		lit *= smoothstep(0.75, 1.25, e);
		// 缝口边缘是碎石的硬边，里面越深越亮
		float inside = smoothstep(1.0, 0.94, e) * (0.45 + 0.55 * smoothstep(0.95, 0.2, e + (fbm(P.xz * 4.0, 3) - 0.5) * 0.3));
		vec3 em = TEAL * uCrack * inside * (0.9 + 1.1 * smoothstep(0.75, 0.0, e) + 0.5 * noise(P.xz * 3.0 + uTime));
		vec3 sea = lit + em;
		col = mix(col, sea, exp(-t * 0.035));
	}
	// 岩缝在水里的辉光
	float tc = max(dot(Q - C, D), 0.0);
	float dc = length(C + D * tc - Q);
	col += TEAL * uCrack * 0.35 * exp(-dc * 0.32) * exp(-tc * 0.02);

	col += snow(C, D, uSnow * (0.35 + 1.2 * sunAt + uCrack * 0.6 * exp(-length(C - Q) * 0.08)));
	col = mix(col, vec3(0.03, 0.12, 0.14), uSplash * 0.55) + vec3(0.06, 0.16, 0.18) * uSplash * uSplash;

	outColor = vec4(finish(col, gl_FragCoord.xy, uExposure, 0.55, uFade), 1.0);
}
`;

/**
 * 石室（关键之厅）：墙面在 z = 0（y 向上），水潭的水面在 y = 0、伸向镜头。
 * 墙上嵌着 7 块石板（uPanel：中心 x、y，宽、高），每块的点字从 uCells 读：
 *   texelFetch(uCells, ivec2(列, 石板 × 4 + 行)) → R 点位掩码、G 阅读序号、B 本行字数、A 有格
 * uRead[i]：第 i 块读到第几格（小数）；uHot[i]：读过的格子保持的亮度
 */
export const HALL_FRAG = `${HEAD}
uniform usampler2D uCells;
uniform vec4 uPanel[7];
uniform float uLines[7];
uniform float uRead[7];
uniform float uHot[7];
uniform vec4 uLamp;     // 暖色读字光：位置 xyz、强度
uniform float uPool;    // 水潭的光
uniform float uZone;    // 1 = 第 5 段的三座遗迹：按 x 分区打不同颜色的光，中间沉入黑暗
uniform float uSplash;
uniform float uExposure;
uniform float uFade;

const float PX = 0.16, PY = 0.27, GAP = 0.056, DR = 0.021;
const vec3 TEAL = vec3(0.2, 0.78, 0.82);
const vec3 GOLD = vec3(1.0, 0.68, 0.28);

// 石板的凸起：边缘有 5cm 的斜角
float slabH(vec2 p, out int id) {
	id = -1;
	float h = 0.0;
	for (int i = 0; i < 7; i++) {
		vec4 b = uPanel[i];
		vec2 d = abs(p - b.xy) - b.zw * 0.5;
		float e = -max(d.x, d.y);
		if (e > -0.02) {
			float s = smoothstep(-0.02, 0.06, e);
			if (s > h) { h = s; id = i; }
		}
	}
	return h * 0.04;
}
float rockH(vec2 p) {
	return fbm(p * 1.6, 5) * 0.09 + fbm(p * 9.0, 3) * 0.012;
}
float surfH(vec2 p, out int id) {
	float s = slabH(p, id);
	float r = rockH(p);
	// 石板表面打磨过：岩石起伏压得很低
	return s + r * mix(1.0, 0.12, step(0.0, float(id)) * smoothstep(0.0, 0.04, s));
}

struct Dots { vec3 n; float on; float glow; float halo; };

Dots dotsAt(vec2 p, int id) {
	Dots o = Dots(vec3(0.0, 0.0, 1.0), 0.0, 0.0, 0.0);
	if (id < 0) return o;
	vec4 b = uPanel[id];
	float n = uLines[id];
	int line = int(floor((n - 1.0) * 0.5 - (p.y - b.y) / PY + 0.5));
	if (line < 0 || float(line) >= n) return o;
	uvec4 first = texelFetch(uCells, ivec2(0, id * 4 + line), 0);
	float len = float(first.b);
	int col = int(floor((p.x - b.x) / PX + (len - 1.0) * 0.5 + 0.5));
	if (col < 0 || float(col) >= len) return o;
	uvec4 c = texelFetch(uCells, ivec2(col, id * 4 + line), 0);
	uint bits = c.r;
	float order = float(c.g);
	vec2 cc = vec2(b.x + (float(col) - (len - 1.0) * 0.5) * PX, b.y + ((n - 1.0) * 0.5 - float(line)) * PY);
	vec2 d = p - cc;
	float lit = clamp(uRead[id] - order, 0.0, 1.0);
	// 读到这一格时亮一下，然后回落到 uHot
	float since = max(uRead[id] - order - 1.0, 0.0);
	float g = smoothstep(0.0, 1.0, lit) * (uHot[id] + 1.6 * exp(-since * 0.45));
	for (int k = 0; k < 6; k++) {
		if ((bits & (1u << uint(k))) == 0u) continue;
		vec2 s = vec2(k < 3 ? -GAP * 0.5 : GAP * 0.5, GAP * (1.0 - float(k % 3)));
		vec2 q = d - s;
		float r = length(q);
		o.halo += exp(-r * r / (2.0 * 0.03 * 0.03)) * g;
		if (r < DR) {
			float hz = sqrt(DR * DR - r * r);
			o.n = normalize(vec3(q, hz));
			o.on = 1.0;
			o.glow = g * (0.6 + 0.4 * hz / DR);
		}
	}
	return o;
}

vec3 shadeWall(vec3 P, vec3 V) {
	vec2 p = P.xy;
	int id;
	float h0 = surfH(p, id);
	int tmp;
	float hx = surfH(p + vec2(0.004, 0.0), tmp);
	float hy = surfH(p + vec2(0.0, 0.004), tmp);
	vec3 N = normalize(vec3(-(hx - h0) / 0.004, -(hy - h0) / 0.004, 1.0));
	bool onSlab = id >= 0 && h0 > 0.02;
	Dots dt = dotsAt(p, onSlab ? id : -1);
	if (dt.on > 0.0) N = normalize(dt.n * vec3(1.0, 1.0, 0.8));
	bool isDot = dt.on > 0.0;

	float grain = fbm(p * 14.0, 3);
	vec3 alb = mix(vec3(0.06, 0.055, 0.05), vec3(0.2, 0.18, 0.155), fbm(p * 2.3 + 7.0, 4)) * (0.7 + 0.6 * grain);
	if (onSlab) alb = mix(vec3(0.17, 0.16, 0.145), vec3(0.3, 0.28, 0.25), grain) * (0.85 + 0.3 * fbm(p * 5.0 + 2.0, 3));

	// 水潭反上来的光：越低越亮，带焦散
	vec3 Lp = normalize(vec3(0.0, -max(P.y, 0.3), 1.8));
	float pool = uPool * 1.6 / (1.0 + P.y * P.y * 0.45);
	float cau = caustic(P.xy * 0.42 + vec2(0.0, -uTime * 0.015), uTime * 0.45);
	// 遗迹：沙漠暖黄、小岛冷蓝、古墓（和另一份记载）发白
	vec3 zc = mix(mix(vec3(1.0, 0.6, 0.28), vec3(0.32, 0.58, 1.0), smoothstep(-4.0, -2.0, P.x)), vec3(0.85, 0.88, 0.95), smoothstep(2.0, 4.0, P.x));
	float zl = max(max(exp(-pow(P.x + 6.0, 2.0) / 8.0), exp(-pow(P.x, 2.0) / 8.0)), max(exp(-pow(P.x - 6.0, 2.0) / 8.0), exp(-pow(P.x - 10.0, 2.0) / 5.0)));
	vec3 poolCol = mix(TEAL, zc, uZone);
	vec3 col = alb * poolCol * pool * max(dot(N, Lp), 0.0) * mix(0.55 + 0.7 * cau, 0.8 + 0.25 * fbm(P.xy * 0.8 + uTime * 0.05, 3), uZone);
	// 火光一样的暖色环境光，让岩石的起伏看得见
	col += alb * vec3(0.09, 0.06, 0.04) * (0.6 + 0.4 * N.z);
	// 暖色读字光
	vec3 Lv = uLamp.xyz - P;
	float dl = length(Lv);
	Lv /= dl;
	float lamp = uLamp.w / (1.0 + dl * dl * 0.9);
	float dif = max(dot(N, Lv), 0.0);
	vec3 Hh = normalize(Lv + V);
	// 凸点被摸得发亮：反光更强
	if (isDot) alb *= 1.35;
	float spec = pow(max(dot(N, Hh), 0.0), isDot ? 60.0 : onSlab ? 40.0 : 14.0) * (isDot ? 0.9 : onSlab ? 0.35 : 0.08);
	col += (alb * dif + spec) * GOLD * lamp;
	col += alb * vec3(0.012, 0.02, 0.022);

	// 点字的光
	col += GOLD * (dt.glow * 2.6 + dt.halo * 0.22);

	// 洞顶和两侧沉入黑暗
	col *= smoothstep(6.0, 4.2, P.y) * mix(smoothstep(7.5, 5.5, abs(P.x)), 0.15 + 0.85 * zl, uZone);
	return col;
}

void main() {
	vec2 frag = splashWarp(gl_FragCoord.xy, uSplash);
	vec3 C = uCamPos;
	vec3 D = camRay(frag);
	vec3 fog = vec3(0.003, 0.009, 0.01);
	vec3 col = fog;
	float tw = D.z < 0.0 ? -C.z / D.z : 1e9;
	float tf = D.y < 0.0 ? -C.y / D.y : 1e9;
	if (tf < tw) {
		// 水面
		vec3 F = C + D * tf;
		vec2 g = vec2(noise(F.xz * 2.2 + uTime * 0.35) - noise(F.xz * 2.2 + vec2(0.13, 0.0) + uTime * 0.35),
		              noise(F.xz * 2.2 - uTime * 0.3) - noise(F.xz * 2.2 + vec2(0.0, 0.13) - uTime * 0.3));
		vec3 Nw = normalize(vec3(g.x * 0.5, 1.0, g.y * 0.5));
		vec3 R = reflect(D, Nw);
		vec3 refl = fog;
		if (R.z < 0.0) {
			vec3 P2 = F + R * (-F.z / R.z);
			refl = shadeWall(P2, -R);
		}
		float fr = 0.04 + 0.96 * pow(1.0 - max(dot(-D, Nw), 0.0), 5.0);
		vec3 body = vec3(0.008, 0.05, 0.058) * uPool * (0.7 + 0.5 * caustic(F.xz * 0.3, uTime * 0.6));
		col = refl * (0.18 + 0.6 * fr) + body * (1.0 - fr);
		col = mix(fog, col, exp(-tf * 0.04));
	} else if (tw < 1e8) {
		vec3 P = C + D * tw;
		col = mix(fog, shadeWall(P, -D), exp(-tw * 0.035));
	}
	col = mix(col, vec3(0.03, 0.12, 0.14), uSplash * 0.55) + vec3(0.06, 0.16, 0.18) * uSplash * uSplash;
	outColor = vec4(finish(col, gl_FragCoord.xy, uExposure, 0.6, uFade), 1.0);
}
`;

/**
 * 地层剖面（侧视）：深度 y 向下为正，海床在 y = 0，上面是海水。
 * uView：画面中心的 x、深度，以及画面纵向看到多少米；uDim 把剖面压暗（叠地图时当背景）
 * uHL：高亮第几层、亮度（金色描边）
 */
export const STRATA_FRAG = `${HEAD}
uniform vec3 uView;
uniform float uDim;
uniform vec2 uHL;
uniform float uIce;   // 海床上方的海水冻成冰川（0–1）
uniform float uTri;   // 三联画：左岩层、中冰河、右地幔（0–1，从中间向两边推开）
uniform float uExposure;
uniform float uFade;

vec2 vor(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	float d1 = 9.0, d2 = 9.0;
	float id = 0.0;
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 g = vec2(x, y);
		vec2 o = vec2(hash12(i + g), hash12(i + g + 17.3));
		float d = length(g + o - f);
		if (d < d1) { d2 = d1; d1 = d; id = hash12(i + g + 3.1); } else if (d < d2) d2 = d;
	}
	return vec2(d2 - d1, id);
}

// 各层的底部深度（米），层号 0 起：沙、页岩、石灰岩、红砂岩、砾岩、花岗岩
float bound(int i, float x) {
	float b = i == 0 ? 0.9 : i == 1 ? 2.1 : i == 2 ? 3.5 : i == 3 ? 4.8 : i == 4 ? 6.1 : 99.0;
	return b + (fbm(vec2(x * 0.18, float(i) * 3.7), 3) - 0.5) * 0.7 + sin(x * 0.11 + float(i)) * 0.25;
}

vec3 layerCol(int L, vec2 p, out float lineDark) {
	lineDark = 0.0;
	float n = fbm(p * 6.0, 4);
	if (L == 0) { // 沙
		return vec3(0.42, 0.34, 0.22) * (0.75 + 0.5 * hash12(floor(p * 140.0))) * (0.85 + 0.3 * n);
	}
	if (L == 1) { // 页岩：细密的纹层
		float lam = 0.5 + 0.5 * sin(p.y * 70.0 + fbm(p * vec2(1.5, 8.0), 3) * 6.0);
		return mix(vec3(0.16, 0.15, 0.15), vec3(0.27, 0.25, 0.23), lam) * (0.85 + 0.3 * n);
	}
	if (L == 2) { // 石灰岩：浅灰，嵌着贝壳化石
		vec3 c = vec3(0.5, 0.48, 0.42) * (0.8 + 0.35 * n);
		vec2 cell = floor(p * 1.6);
		vec2 q = fract(p * 1.6) - 0.5;
		if (hash12(cell + 9.0) < 0.35) {
			vec2 o = (vec2(hash12(cell), hash12(cell + 4.0)) - 0.5) * 0.4;
			vec2 d = q - o;
			float r = length(d) / 0.16;
			float a = atan(d.y, d.x);
			float spiral = abs(fract(r * 3.0 - a / 6.2832) - 0.5);
			if (r < 1.0) c *= mix(0.55, 1.15, smoothstep(0.05, 0.25, spiral));
		}
		return c;
	}
	if (L == 3) { // 红砂岩：斜层理
		float cross = 0.5 + 0.5 * sin((p.x * 0.6 + p.y) * 26.0 + floor(p.y * 2.5) * 2.0 + n * 3.0);
		return mix(vec3(0.38, 0.17, 0.1), vec3(0.55, 0.27, 0.16), cross) * (0.85 + 0.3 * n);
	}
	if (L == 4) { // 砾岩：大小卵石
		vec2 v = vor(p * 4.5);
		vec3 peb = mix(vec3(0.3, 0.27, 0.24), vec3(0.55, 0.5, 0.42), v.y);
		peb = mix(peb, vec3(0.42, 0.3, 0.22), step(0.7, v.y));
		return mix(vec3(0.12, 0.1, 0.09), peb, smoothstep(0.02, 0.09, v.x));
	}
	// 花岗岩：粉、灰、黑的斑晶
	float h = hash12(floor(p * 55.0));
	vec3 c = h < 0.15 ? vec3(0.06, 0.06, 0.06) : h < 0.55 ? vec3(0.55, 0.42, 0.4) : vec3(0.42, 0.42, 0.42);
	return c * (0.8 + 0.3 * n);
}

vec3 iceCol(vec2 p) {
	// 冰河：一年一层的纹理、气泡、裂纹，越深越蓝
	float band = 0.5 + 0.5 * sin(p.y * 22.0 + fbm(p * vec2(0.6, 3.0), 3) * 4.0);
	vec3 c = mix(vec3(0.42, 0.62, 0.72), vec3(0.62, 0.8, 0.88), band * 0.6 + 0.2);
	c = mix(c, vec3(0.18, 0.38, 0.55), smoothstep(-1.0, -6.0, p.y) * 0.0 + smoothstep(0.0, -5.0, -p.y - 5.0));
	vec2 cell = floor(p * 9.0);
	vec2 q = fract(p * 9.0) - 0.5;
	if (hash12(cell + 2.0) < 0.12) c += vec3(0.25, 0.3, 0.32) * smoothstep(0.12, 0.05, length(q - (vec2(hash12(cell), hash12(cell + 5.0)) - 0.5) * 0.5));
	float crack = vor(p * vec2(1.2, 0.8)).x;
	c = mix(c * 1.25, c, smoothstep(0.0, 0.03, crack));
	return c * (0.75 + 0.25 * fbm(p * 3.0, 3));
}
vec3 mantleCol(vec2 p, float t) {
	float n = fbm(p * 0.35 + vec2(t * 0.02, -t * 0.05), 5);
	float m = fbm(p * 0.8 + n * 2.0 - vec2(0.0, t * 0.08), 4);
	vec3 c = mix(vec3(0.22, 0.025, 0.01), vec3(0.95, 0.3, 0.06), smoothstep(0.4, 0.85, m));
	return c * (0.7 + 0.4 * smoothstep(10.5, 16.0, p.y));
}

vec3 section(vec2 p, int mode) {
	// mode 0：正常剖面（海床上方是海水 / 冰）；1：只要岩层；2：只要冰；3：只要地幔
	if (mode == 2) return iceCol(p);
	if (mode == 3) return mantleCol(p, uTime);
	vec3 col;
	float seabed = (fbm(vec2(p.x * 0.4, 1.0), 3) - 0.5) * 0.25;
	if (mode == 0 && p.y < seabed) {
		vec3 water = vec3(0.004, 0.022, 0.03) * (1.0 + 0.6 * smoothstep(-6.0, 0.0, p.y));
		// 结冰的锋面从上往下推进
		float front = mix(-30.0, 0.5, uIce) + (fbm(vec2(p.x * 1.3, 2.0), 3) - 0.5) * 1.2;
		col = p.y < front ? iceCol(p) * 0.85 : water;
		col += vec3(0.5, 0.8, 0.9) * exp(-abs(p.y - front) * 14.0) * step(0.001, uIce) * step(uIce, 0.999) * 0.6;
		return col;
	}
	// 地幔：在花岗岩之下（示意）
	float moho = 10.5 + (fbm(vec2(p.x * 0.15, 9.0), 3) - 0.5) * 1.5;
	if (mode == 0 && p.y > moho) return mix(vec3(0.1, 0.03, 0.02), mantleCol(p, uTime), smoothstep(moho, moho + 1.2, p.y));
	int L = 5;
	float edge = 9.0;
	for (int i = 0; i < 5; i++) {
		float b = bound(i, p.x);
		edge = min(edge, abs(p.y - b));
		if (p.y < b) { L = i; break; }
	}
	float ld;
	col = layerCol(L, p, ld);
	col *= mix(0.45, 1.0, smoothstep(0.0, 0.045, edge));
	float depthDark = exp(-max(p.y, 0.0) * 0.06);
	col *= (0.55 + 0.45 * depthDark);
	// 靠近地幔的岩石被烤红
	col += vec3(0.5, 0.12, 0.03) * smoothstep(moho - 3.0, moho, p.y);
	if (uHL.y > 0.0 && float(L) == uHL.x) col += vec3(1.0, 0.68, 0.28) * uHL.y * (0.12 + 0.5 * exp(-edge * 18.0));
	return col;
}

void main() {
	vec2 frag = gl_FragCoord.xy;
	vec2 uv = (frag - uRes * 0.5) / uRes.y;
	vec2 p = vec2(uView.x + uv.x * uView.z, uView.y - uv.y * uView.z);
	vec3 col = section(p, 0);
	if (uTri > 0.0) {
		// 三联画：三块竖条，各自的取景
		float x = frag.x / uRes.x;
		float open = uTri;
		float edgeL = 0.5 - open / 6.0, edgeR = 0.5 + open / 6.0;
		vec2 q = vec2(uv.x * 5.0, 2.8 - uv.y * 5.0);
		vec3 tri;
		if (x < edgeL) tri = section(q + vec2(3.0, 0.0), 1);
		else if (x > edgeR) tri = section(q + vec2(-2.0, 14.0), 3) * 0.55;
		else tri = section(q + vec2(0.0, -4.0), 2) * 0.8;
		float seam = min(abs(x - edgeL), abs(x - edgeR)) * uRes.x;
		tri *= smoothstep(0.0, 3.0, seam);
		col = mix(col, tri, smoothstep(0.0, 0.15, open));
	}
	col *= 1.0 - uDim;
	outColor = vec4(finish(col * 0.42, frag, uExposure, 0.75, uFade), 1.0);
}
`;

/**
 * 海岸剖面（示意，竖向夸张）：横向单位任意（缩放 450 时画面横跨 ±10），纵向是米，今天的海面在 0。
 * 左边是陆地，往右是海滩、大陆架、陡坡。大陆架上 −70 米处有一个小洞穴：露出水面时透出火光，被淹后透出青光。
 * uView：画面中心 x、海拔（米），画面纵向看到多少米；uSea：海面高度（米）；uGlacier：陆地上的冰川
 */
export const COAST_FRAG = `${HEAD}
uniform vec3 uView;
uniform float uSea;
uniform float uGlacier;
uniform float uExposure;
uniform float uFade;

const float CAVE_X = 2.8;
float terrain(float x) {
	float e;
	if (x < -3.0) e = 40.0 + (-3.0 - x) * 7.0;
	else if (x < 0.0) e = mix(40.0, 0.0, smoothstep(-3.0, 0.0, x));
	else if (x < 6.0) e = -x * 25.0;
	else e = -150.0 - (x - 6.0) * 90.0;
	e += (fbm(vec2(x * 1.7, 3.0), 4) - 0.5) * 12.0;
	return e;
}

void main() {
	vec2 frag = gl_FragCoord.xy;
	vec2 uv = (frag - uRes * 0.5) / uRes.y;
	float X = uView.x + uv.x * uView.z / 450.0 * 11.25;
	float Y = uView.y + uv.y * uView.z;
	float pxm = uView.z / uRes.y; // 每像素多少米
	float e = terrain(X);
	float ce = terrain(CAVE_X);
	// 洞穴：大陆架上的半椭圆洞口
	vec2 cq = vec2((X - CAVE_X) / 0.32, (Y - (ce + 2.0)) / 13.0);
	float cave = length(cq);
	bool inCave = cave < 1.0 && Y > ce - 4.0;
	float glacierTop = e + uGlacier * 95.0 * sqrt(clamp((-0.6 - X) / 4.0, 0.0, 1.0));
	vec3 col;
	if (Y > max(e, uSea) && !(Y < glacierTop && X < -0.6)) {
		// 天空：深蓝到黑
		col = mix(vec3(0.02, 0.035, 0.06), vec3(0.004, 0.006, 0.012), smoothstep(0.0, 200.0, Y));
	} else if (Y > e && X < -0.6 && Y < glacierTop) {
		// 冰川
		float band = 0.5 + 0.5 * sin((Y - e) * 0.35 + fbm(vec2(X * 3.0, Y * 0.05), 3) * 3.0);
		col = mix(vec3(0.42, 0.6, 0.7), vec3(0.7, 0.85, 0.92), band);
		col *= 0.8 + 0.2 * smoothstep(glacierTop - 2.0 * pxm, glacierTop - 6.0 * pxm, Y);
	} else if (Y > e || inCave) {
		// 海水（洞里没进水时是空气）
		if (Y > uSea) {
			col = vec3(0.012, 0.01, 0.009);
		} else {
			float d = uSea - Y;
			col = mix(vec3(0.03, 0.17, 0.2), vec3(0.004, 0.02, 0.035), smoothstep(0.0, 260.0, d));
			col *= 0.85 + 0.3 * caustic(vec2(X * 0.35, Y * 0.01), uTime * 0.4) * exp(-d * 0.02);
		}
	} else {
		// 地层：沿地表起伏的条带
		float d = e - Y;
		float band = floor(d / 22.0 + fbm(vec2(X * 0.8, d * 0.02), 3) * 1.2);
		float h = hash12(vec2(band, 3.0));
		col = mix(vec3(0.16, 0.12, 0.09), vec3(0.3, 0.24, 0.18), h);
		col = mix(vec3(0.22, 0.17, 0.1), col, smoothstep(0.0, 10.0, d));
		col *= 0.8 + 0.3 * fbm(vec2(X * 6.0, Y * 0.2), 4);
		col *= mix(0.5, 1.0, smoothstep(0.0, 2.5 * pxm, abs(fract(d / 22.0 + fbm(vec2(X * 0.8, d * 0.02), 3) * 1.2) - 0.5) * 22.0));
	}
	// 洞穴的光：露出水面是暖色火光，被淹以后是青光（和第 1 段海底石室的岩缝一样）
	float caveTop = ce + 15.0;
	float submerged = smoothstep(caveTop - 6.0, caveTop + 4.0, uSea);
	vec3 glowCol = mix(vec3(1.0, 0.55, 0.2), vec3(0.16, 0.85, 0.9), submerged);
	float r = length(vec2((X - CAVE_X) / 0.32 * 13.0, Y - (ce + 4.0)));
	col += glowCol * (inCave ? 0.9 : 0.0) * (0.6 + 0.4 * noise(vec2(uTime * 3.0, 1.0)));
	col += glowCol * 0.5 * exp(-r * 0.12);
	// 海面：一道亮线
	float sl = abs(Y - uSea) / pxm;
	if (Y > e || inCave) col += vec3(0.4, 0.75, 0.8) * exp(-sl * 0.6) * 0.8;
	outColor = vec4(finish(col, frag, uExposure, 0.7, uFade), 1.0);
}
`;
