import {INK_LIB} from './ink';

/** 水墨洞窟的公共部分（第 6、7 段共用）：钟乳石层、深处微光、水面倒影。需要 INK_LIB 在前 */
export const CAVE_LIB = `
uniform float uWaterY;
const vec3 INK = vec3(0.045, 0.036, 0.03);
const vec3 MIST = vec3(0.80, 0.73, 0.59);

// 景深层坐标 → 屏幕坐标（toLayer 的逆运算）
vec2 fromLayer(vec2 L, float k) {
	vec2 C = vec2(960.0, 540.0);
	float s = 1.0 + (uCam.z - 1.0) * k;
	float a = uRoll * 3.14159265 / 180.0;
	vec2 d = (L - C - (uCam.xy - C) * k) * s;
	return vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a)) + C;
}

// 一排钟乳石：返回 x 处的长度。冰柱状（根部粗、尖端细），粗细长短不一，有的位置空着
float spikes(float x, float len, float cell, float seed) {
	float u = x / cell;
	float id = floor(u);
	float h = 0.0;
	for (int i = -2; i <= 2; i++) {
		float cid = id + float(i);
		float r1 = hash(vec2(cid, seed));
		float r2 = hash(vec2(cid, seed + 3.7));
		float r3 = hash(vec2(cid, seed + 8.1));
		if (r3 < 0.3) continue;
		float cx = cid + 0.5 + (r2 - 0.5) * 0.8;
		float w = 0.12 + 0.45 * r2 * r2 + 0.25 * r1;
		float t = clamp(1.0 - abs(u - cx) / w, 0.0, 1.0);
		float l = len * (0.2 + 0.8 * pow(r1, 1.5));
		h = max(h, l * (1.0 - pow(1.0 - t, 1.6 + r3)));
	}
	return h;
}

// 一层岩石：洞顶垂下的钟乳石 + 洞底的石笋。返回墨浓度，occ 为是否在岩石内
float rock(vec2 L, float top, float len, float bottom, float blen, float cell, float seed, out float occ) {
	float x = L.x + (fbm4(vec2(L.y * 0.008, seed)) - 0.5) * cell * 0.25;   // 石柱的边不是直的
	float ceilY = top + len * 0.3 * fbm4(vec2(x * 0.003, seed)) + spikes(x, len, cell, seed);
	float floorY = bottom - blen * 0.35 * fbm4(vec2(x * 0.003, seed + 9.0)) - spikes(x + 37.0 * seed, blen, cell * 1.3, seed + 5.0);
	float d = max(ceilY - L.y, L.y - floorY);   // > 0 在岩石内
	occ = smoothstep(0.0, 2.5, d);
	// 边缘积墨勾勒，内部淡墨 + 竖向皴擦与飞白，靠近根部更浓
	float edge = occ * exp(-max(d, 0.0) / 5.0);
	float cun = fbm4(vec2(L.x * 0.02, L.y * 0.004) + seed * 3.0);
	float dry = smoothstep(0.4, 0.8, fbm4(vec2(L.x * 0.05, L.y * 0.005) + seed));
	float root = max(smoothstep(top + len * 0.4, top - 40.0, L.y), smoothstep(bottom - blen * 0.4, bottom + 40.0, L.y));
	float body = occ * (0.3 + 0.35 * smoothstep(0.3, 0.8, cun) + 0.35 * root) * (1.0 - 0.4 * dry);
	return clamp(body + edge * 0.7, 0.0, 1.0);
}

// 洞窟本身（不含水面）；inkAmt 返回该处墨的浓度（墨越浓受火光越少）
vec3 cave(vec2 p, out float inkAmt) {
	vec3 col = paper(toLayer(p, 0.5) / 1080.0);
	// 深处：一团团墨雾，中间偏亮，像洞窟深处透进来的微光
	vec2 L0 = toLayer(p, 0.2);
	float glow = exp(-pow(length((L0 - vec2(900.0, 430.0)) / vec2(980.0, 560.0)), 2.0) * 1.5);
	float fog = fbm4(L0 * 0.0018 + vec2(uTime * 0.012, 0.0));
	float back = clamp(0.8 - glow * 0.55 + (fog - 0.5) * 0.6, 0.0, 1.0);
	col = mix(col, mix(vec3(0.46, 0.43, 0.39), INK, smoothstep(0.4, 1.0, back)), back * 0.9);
	inkAmt = back;
	// 洞顶与两壁压在阴影里，只有中间深处透着微光
	float shade = smoothstep(520.0, -60.0, L0.y) * 0.6 + smoothstep(560.0, 1150.0, abs(L0.x - 900.0)) * 0.5;
	col = mix(col, vec3(0.16, 0.14, 0.12), clamp(shade, 0.0, 0.8) * (1.0 - glow * 0.5));
	inkAmt = max(inkAmt, shade);

	float ks[4] = float[4](0.32, 0.52, 0.76, 1.3);
	float tops[4] = float[4](150.0, 70.0, -30.0, -170.0);
	float lens[4] = float[4](300.0, 380.0, 470.0, 520.0);
	float bots[4] = float[4](900.0, 960.0, 1040.0, 1220.0);
	float blens[4] = float[4](120.0, 150.0, 170.0, 160.0);
	float cells[4] = float[4](110.0, 170.0, 240.0, 380.0);
	vec3 inks[4] = vec3[4](vec3(0.46, 0.43, 0.39), vec3(0.29, 0.26, 0.23), vec3(0.14, 0.12, 0.1), INK);
	float strength[4] = float[4](0.65, 0.8, 0.9, 0.97);
	float mists[4] = float[4](0.35, 0.4, 0.45, 0.2);
	for (int i = 0; i < 4; i++) {
		vec2 L = toLayer(p, ks[i]);
		float occ;
		float d = rock(L, tops[i], lens[i], bots[i], blens[i], cells[i], float(i) * 5.3 + 2.0, occ);
		// 最近的一层只在画面两侧，免得挡住主体
		if (i == 3) {
			float side = smoothstep(420.0, 820.0, abs(p.x - 960.0) + 160.0 * fbm4(vec2(p.y * 0.004, 3.0)));
			occ *= side;
			d *= side;
		}
		col = mix(col, MIST * (0.92 + 0.08 * noise(L * 0.02)), occ * mists[i]);
		col = mix(col, inks[i], d * strength[i]);
		inkAmt = mix(inkAmt, d, occ);
		// 层间的墨雾，缓缓横移
		float band = fbm4(vec2(L.x * 0.0018 - uTime * 0.01 * (0.5 + ks[i]), L.y * 0.006 + float(i) * 3.0));
		col = mix(col, MIST * 0.9, smoothstep(0.45, 0.75, band) * 0.35 * (1.0 - float(i) * 0.25));
	}
	return col;
}

// 洞窟 + 水面：水面倒映洞窟（带波纹），越往近处越暗，有横向的留白水纹；wet 返回靠近水面的程度
vec3 caveScene(vec2 p, out float inkAmt, out float wet) {
	vec2 L1 = toLayer(p, 1.0);
	float depth = L1.y - uWaterY;
	bool under = depth > 0.0;
	// 水面以下取倒影的位置（只调用一次 cave，着色器编译时展开的代码少一半）
	vec2 m = vec2(L1.x, 2.0 * uWaterY - L1.y);
	m.x += (noise(vec2(L1.y * 0.06, uTime * 0.7)) - 0.5) * 16.0 * (0.4 + depth / 160.0);
	m.y += (noise(vec2(L1.x * 0.01, L1.y * 0.05 + uTime * 0.4)) - 0.5) * 10.0;
	vec3 rc = cave(under ? fromLayer(m, 1.0) : p, inkAmt);
	wet = 0.0;
	if (!under) return rc;
	vec3 col = mix(rc * 0.6, INK, 0.3 + 0.45 * smoothstep(0.0, 260.0, depth));
	float rl = smoothstep(0.78, 0.95, noise(vec2(L1.x * 0.004 + uTime * 0.03, L1.y * 0.08)));
	col = mix(col, MIST, rl * 0.3 * (1.0 - smoothstep(0.0, 220.0, depth)));
	// 岸线：一道淡墨
	col = mix(col, vec3(0.2, 0.18, 0.16), exp(-depth / 4.0) * 0.6);
	wet = 1.0 - smoothstep(0.0, 300.0, depth);
	inkAmt = 0.6;
	return col;
}

`;

/**
 * 水墨洞窟（第 3 期第 6 段）：四层钟乳石 / 石笋按景深产生视差，深处有微光与墨雾，下方是幽暗的水面（倒映洞窟）。
 * uFire: 火光 (x, y, 强度)，主体层（k = 1）坐标；uPsyC: 念力的扭曲 (x, y, 强度)，屏幕坐标；
 * uWaterY: 水面在主体层上的 y；uDark: 整体被墨盖住的程度。
 */
export const INK_CAVE_FRAG = `${INK_LIB}
uniform vec3 uFire;
uniform vec3 uPsyC;
uniform float uDark;
${CAVE_LIB}
void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	// 念力：洞窟以超梦为中心被扭动
	vec2 dp = p - uPsyC.xy;
	p = uPsyC.xy + rot(uPsyC.z * 0.5 * exp(-length(dp) / 520.0)) * dp;

	float flick = 0.85 + 0.1 * sin(uTime * 13.0) + 0.05 * sin(uTime * 29.0 + 1.3);
	vec2 L1 = toLayer(p, 1.0);
	float inkAmt;
	vec3 col;
	float wet = 0.0;
	col = caveScene(p, inkAmt, wet);

	// 火光：朱红泥金的暖光，墨浓处受光少；水面上拉出一道摇晃的倒影
	if (uFire.z > 0.0) {
		vec2 df = (L1 - uFire.xy) * vec2(1.0, 1.25);
		float fl = exp(-length(df) / 560.0) * uFire.z * flick;
		float lit = 1.0 - smoothstep(0.3, 1.0, inkAmt) * 0.55;
		col = mix(col, col * vec3(1.18, 0.92, 0.7), clamp(fl, 0.0, 1.0) * 0.6);
		col += vec3(0.95, 0.4, 0.1) * fl * 0.42 * lit;
		float streak = exp(-abs(L1.x - uFire.x) / 70.0) * smoothstep(0.55, 0.9, noise(vec2(L1.x * 0.02, L1.y * 0.12 - uTime * 1.5)));
		col += vec3(1.0, 0.55, 0.18) * streak * wet * uFire.z * flick * 0.6;
	}

	vec2 q1 = L1 / 1080.0;
	col = gold(toLayer(p, 0.5) / 1080.0, col, inkAmt);

	col = mix(col, INK, uDark);
	float fl = flood(q1);
	col = mix(col, INK, smoothstep(0.4, 0.95, fl));
	col = mix(col, gold(q1 * 1.3 + 3.0, col, fl), smoothstep(0.3, 0.8, fl));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 战斗特效层（第 3 期第 6 段，透明叠在宝可梦之上）：喷火龙的火墨、超梦的念力浓墨、超梦周身翻卷的墨云、对撞时的墨爆与火星。
 * 坐标都在主体层（k = 1）上。气流 A → B：uXxxA = (起点, 宽度)，uXxxB = (终点, 强度)，uXxxT = 显示的一段 (尾, 头)，0–1。
 */
export const INK_CLASH_FRAG = `${INK_LIB}
uniform vec3 uFireA;
uniform vec3 uFireB;
uniform vec2 uFireT;
uniform vec3 uPsyA;
uniform vec3 uPsyB;
uniform vec2 uPsyT;
uniform vec3 uAura;
uniform float uAuraR;
uniform vec3 uBoom;
uniform float uBoomSize;
uniform float uEmber;

const vec3 INK = vec3(0.045, 0.036, 0.03);

// 一道气流：返回 (浓度, 沿线位置 0–1, 横向距离 / 半宽)
// taper：起点处的宽度比例（火焰从嘴边一道细火开始，越往前越粗，呈锥形）
vec3 stream(vec2 L, vec2 A, vec2 B, vec2 T, float width, float taper, float seed, float speed) {
	vec2 ab = B - A;
	float len = length(ab);
	vec2 dir = ab / len;
	vec2 nrm = vec2(-dir.y, dir.x);
	vec2 d = L - A;
	float s = dot(d, dir);
	float sn = s / len;
	// 气流整体扭动，离起点越远摆得越大
	float t = dot(d, nrm) - (fbm4(vec2(s * 0.003 - uTime * speed * 0.4, seed)) - 0.5) * 140.0 * clamp(sn, 0.0, 1.0);
	float w = width * (taper + (1.0 - taper) * pow(smoothstep(-0.02, 0.85, sn), 1.2));
	float calm = 0.25 + 0.75 * smoothstep(0.0, 0.35, sn);   // 起点附近的细火更凝聚
	float turb = fbm4(vec2(s * 0.007 - uTime * speed, t * 0.014) + seed);
	float tongue = fbm4(vec2(s * 0.02 - uTime * speed * 3.0, t * 0.03) + seed * 2.0);
	float across = abs(t) / w + ((turb - 0.5) * 1.1 + (tongue - 0.5) * 0.6) * calm;
	float hs = T.y * len, ts = T.x * len;
	float along = smoothstep(ts - 50.0, ts + 50.0, s) * smoothstep(hs + 20.0, hs - 60.0, s);
	float body = smoothstep(1.0, 0.5, across) * along;
	// 头部：一团翻卷的球
	float hd = length(vec2(s - hs, t)) / (w * 1.25) + (turb - 0.5) * 0.8;
	float head = smoothstep(1.0, 0.45, hd) * step(0.002, T.y - T.x) * step(T.y, 0.999);
	return vec3(max(body, head), sn, min(across, hd));
}

// 墨爆 / 火爆：快速炸开的不规则团 + 放射的墨迹 + 飞溅的点
float burst(vec2 L, vec3 S, float size, float seed) {
	float tau = uTime - S.z;
	if (tau <= 0.0 || size <= 0.0) return 0.0;
	vec2 d = L - S.xy;
	float r = length(d);
	vec2 dir = d / max(r, 1e-3);
	float g = 1.0 - exp(-tau / 0.14);
	float R = size * g * (1.0 + 0.08 * tau);
	float edge = 0.7 + 0.6 * fbm4(dir * 2.5 + seed);
	float body = smoothstep(R * 0.55 * edge, R * 0.3 * edge, r);
	vec2 wd = normalize(dir + 0.18 * (vec2(noise(vec2(r * 0.008, seed)), noise(vec2(r * 0.008, seed + 5.0))) - 0.5));
	float ray = pow(noise(wd * 9.0 + seed) * 0.6 + noise(wd * 23.0 + seed + 4.0) * 0.4, 3.0);
	float rays = smoothstep(0.18, 0.5, ray) * smoothstep(R * (0.6 + 0.9 * ray), R * 0.3, r);
	float drops = 0.0;
	for (int i = 0; i < 22; i++) {
		float fi = float(i);
		float a = hash(vec2(fi, seed + 3.3)) * 6.2831;
		vec2 c = S.xy + vec2(cos(a), sin(a)) * R * (0.45 + 0.9 * hash(vec2(fi, seed + 7.1)));
		float rad = size * (0.008 + 0.02 * hash(vec2(fi, seed + 1.7))) * g;
		drops = max(drops, smoothstep(rad, rad * 0.6, length(L - c) * (0.85 + 0.3 * noise((L - c) * 0.1 + fi))));
	}
	return clamp(max(body, max(rays * 0.9, drops)), 0.0, 1.0);
}

// 叠加到前景上（acc 为预乘颜色）
void over(inout vec4 acc, vec3 c, float a) {
	a = clamp(a, 0.0, 1.0);
	acc.rgb = c * a + acc.rgb * (1.0 - a);
	acc.a = a + acc.a * (1.0 - a);
}

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec2 L = toLayer(p, 1.0);
	vec4 acc = vec4(0.0);
	float flick = 0.85 + 0.1 * sin(uTime * 13.0) + 0.05 * sin(uTime * 31.0 + 1.3);

	// 超梦周身的墨云：绕身体旋转的一圈浓淡墨
	if (uAura.z > 0.0) {
		vec2 d = (L - uAura.xy) / uAuraR;
		float r = length(d);
		vec2 rd = rot(uTime * 0.7 + 1.2 / (r + 0.35)) * d;
		float cl = fbm4(rd * 2.2 + vec2(uTime * 0.2, -uTime * 0.15));
		float rr = r + (cl - 0.5) * 0.5;
		float band = smoothstep(0.6, 0.85, rr) * smoothstep(1.3, 0.92, rr);
		float wisp = pow(1.0 - abs(2.0 * fbm4(rd * 4.0 + 7.0) - 1.0), 8.0) * smoothstep(1.5, 0.8, rr) * smoothstep(0.5, 0.75, rr);
		float a = (band * smoothstep(0.3, 0.7, cl) * 0.8 + wisp * 0.5) * uAura.z;
		over(acc, mix(vec3(0.3, 0.28, 0.27), INK, smoothstep(0.4, 0.8, cl)), a);
	}

	// 念力：一道翻卷的浓墨，带顺着流向的飞白
	if (uPsyB.z > 0.0) {
		vec3 s = stream(L, uPsyA.xy, uPsyB.xy, uPsyT, uPsyA.z, 0.45, 11.0, 1.3);
		float cl = fbm4(vec2(s.y * 6.0 - uTime * 1.6, s.z * 1.5) + 4.0);
		float fb = pow(1.0 - abs(2.0 * fbm4(vec2(s.y * 4.0 - uTime * 2.2, s.z * 2.5) + 9.0) - 1.0), 8.0) * smoothstep(0.05, 0.6, s.z);
		vec3 c = mix(mix(vec3(0.3, 0.28, 0.26), INK, smoothstep(0.3, 0.7, cl)), vec3(0.62, 0.58, 0.53), fb * 0.8);
		over(acc, c, s.x * uPsyB.z * (0.75 + 0.25 * smoothstep(0.3, 0.6, cl)));
	}

	// 火焰：中心泥金、外层朱红，边缘焦黑的烟墨
	if (uFireB.z > 0.0) {
		vec3 s = stream(L, uFireA.xy, uFireB.xy, uFireT, uFireA.z, 0.07, 3.0, 1.8);
		vec3 c = mix(vec3(0.6, 0.12, 0.05), vec3(0.93, 0.36, 0.08), smoothstep(0.95, 0.35, s.z));
		c = mix(c, vec3(1.0, 0.86, 0.52), smoothstep(0.45, 0.0, s.z) * flick);
		c = mix(c, vec3(0.12, 0.07, 0.045), smoothstep(0.6, 1.0, s.z) * 0.85);
		over(acc, c, s.x * uFireB.z);
	}

	// 对撞：浓墨与火同时炸开，墨团随后慢慢化开变淡
	if (uBoomSize > 0.0) {
		float tau = uTime - uBoom.z;
		float fade = 1.0 - smoothstep(1.2, 5.0, tau);
		float ink = burst(L, uBoom, uBoomSize, 2.0);
		float fire = burst(L, vec3(uBoom.xy, uBoom.z + 0.04), uBoomSize * 0.5, 9.0);
		float cl = fbm4(L * 0.005 + uTime * 0.15);
		// 冲击波：一圈向外扩散的淡墨
		if (tau > 0.0) {
			float rr = length(L - uBoom.xy);
			float R = uBoomSize * 1.6 * (1.0 - exp(-tau / 0.35));
			float ring = exp(-pow((rr - R + (cl - 0.5) * 120.0) / 40.0, 2.0)) * (1.0 - smoothstep(0.2, 1.4, tau));
			over(acc, vec3(0.2, 0.18, 0.16), ring * 0.55);
		}
		// 墨团里翻卷着浓淡，中间留出被火照亮的部分
		vec3 ic = mix(vec3(0.3, 0.27, 0.24), INK, smoothstep(0.3, 0.7, cl));
		over(acc, ic, ink * fade * 0.95);
		float ft = 1.0 - smoothstep(0.15, 1.0, tau);
		float fd = fire * smoothstep(0.35, 0.65, fbm4(L * 0.012 - uTime * 0.6 + 3.0) + 0.25 * ft);
		vec3 fc = mix(vec3(0.75, 0.2, 0.06), vec3(1.0, 0.82, 0.45), smoothstep(0.5, 0.85, cl));
		over(acc, fc, fd * ft);
	}

	// 火星：向上飘的余烬
	if (uEmber > 0.0) {
		vec2 q = L / 1080.0;
		for (int k = 0; k < 2; k++) {
			float sc = 30.0 + float(k) * 20.0;
			vec2 eq = q * sc + vec2(sin(q.y * 6.0 + uTime + float(k)) * 0.6, uTime * (2.0 + float(k)));
			vec2 id = floor(eq);
			vec2 f = fract(eq) - 0.5;
			float h = hash(id + float(k) * 13.0);
			if (h > 1.0 - 0.08 * uEmber) {
				vec2 o = vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5;
				float e = smoothstep(0.13, 0.0, length(f - o * 0.6)) * (0.6 + 0.4 * sin(uTime * 9.0 + h * 50.0));
				over(acc, vec3(1.0, 0.62, 0.22), e);
			}
		}
	}

	// 画布是非预乘 alpha
	outColor = vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}
`;
