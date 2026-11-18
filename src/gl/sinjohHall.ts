// ─── 《为彼而去》神都遗迹的殿内：三幻舞台（光线步进）→ 墙与穹顶裂开成宇宙 ──────────────────
// 世界坐标以米计，y 向上；入口在 z = 0，殿堂向 -z 延伸到 z = -34，宽 ±8，高 10。
// 布局参照心金魂银的殿内地图：两侧列柱、通道两旁的石灯座、尽头的三角形舞台（三个圆 + 中央的圆）。
// 相机与 gl/sinjoh.ts、components/unown/SinjohSnow.tsx 的 projectSnow 一致。

export const HALL_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform float uYaw;
uniform float uPitch;
uniform float uFov;
uniform float uFade;     // 黑场
uniform float uLight;    // 舞台中央（阿尔宙斯）的金光
uniform float uShaft;    // 穹顶裂缝里漏下的冷光
uniform float uCosmos;   // 墙、柱、穹顶裂开成宇宙（0..1）
uniform float uFloorGone;// 地面也散去，只留舞台
uniform float uEarth;    // 宇宙深处浮现的星球
uniform float uPattern;  // 舞台图案亮起的金光

const vec3 STAGE = vec3(0.0, 0.8, -24.0);

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float hash3(vec3 p) { return hash(p.xy + p.z * 17.13); }
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

float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
// 等边三角形（r = 半边长，顶点朝 +y）
float sdTri(vec2 p, float r) {
	const float k = 1.7320508;
	p.x = abs(p.x) - r;
	p.y = p.y + r / k;
	if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
	p.x -= clamp(p.x, -2.0 * r, 0.0);
	return -length(p) * sign(p.y);
}
// 舞台平面坐标：原点在三角形中心，+y 指向尽头的顶点
vec2 stageUV(vec3 p) { return vec2(p.x, -(p.z - STAGE.z)); }

// 材质：1 地面 2 墙 / 穹顶 3 柱 4 灯座 5 舞台
vec2 map(vec3 p) {
	vec2 r = vec2(p.y, 1.0);
	// 舞台：三角形台座，高 0.8；正面（靠入口的底边）中间有台阶
	vec2 su = stageUV(p);
	float st = max(sdTri(su, 6.5), abs(p.y - 0.4) - 0.4);
	st = min(st, sdBox(p - vec3(0.0, 0.2, STAGE.z + 3.75 + 0.5), vec3(1.4, 0.2, 0.5)));
	st = min(st, sdBox(p - vec3(0.0, 0.5, STAGE.z + 3.75 + 0.15), vec3(1.4, 0.12, 0.2)));
	if (st < r.x) r = vec2(st, 5.0);
	// 墙与穹顶（盒子内部）
	float room = -sdBox(p - vec3(0.0, 5.0, -16.0), vec3(8.0, 5.0, 18.0));
	if (room < r.x) r = vec2(room, 2.0);
	// 列柱
	vec3 q = p;
	q.x = abs(q.x) - 6.6;
	q.z = mod(q.z + 2.0, 4.0) - 2.0;
	float col = sdBox(q - vec3(0.0, 5.0, 0.0), vec3(0.38, 5.0, 0.38));
	col = min(col, sdBox(q - vec3(0.0, 0.3, 0.0), vec3(0.55, 0.3, 0.55)));
	col = min(col, sdBox(q - vec3(0.0, 8.6, 0.0), vec3(0.6, 0.25, 0.6)));
	col = max(col, p.z - 0.0);
	col = max(col, -p.z - 33.0);
	if (col < r.x) r = vec2(col, 3.0);
	// 通道两旁的石灯座
	vec3 l = p;
	l.x = abs(l.x) - 2.4;
	float lz = clamp(floor((-l.z - 4.0) / 4.0 + 0.5), 0.0, 2.0);
	l.z = l.z + 4.0 + lz * 4.0;
	float lamp = sdBox(l - vec3(0.0, 0.5, 0.0), vec3(0.22, 0.5, 0.22));
	lamp = min(lamp, sdBox(l - vec3(0.0, 1.05, 0.0), vec3(0.36, 0.08, 0.36)));
	if (lamp < r.x) r = vec2(lamp, 4.0);
	return r;
}

vec3 calcNormal(vec3 p) {
	vec2 e = vec2(0.01, 0.0);
	return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x));
}
float ao(vec3 p, vec3 n) {
	float o = 0.0, s = 1.0;
	for (int i = 1; i <= 4; i++) {
		float h = 0.2 * float(i);
		o += (h - map(p + n * h).x) * s;
		s *= 0.6;
	}
	return clamp(1.0 - 1.4 * o, 0.0, 1.0);
}

// 舞台上的图案：三角形内框、三个圆（三个角）、中央的大圆、圆之间的菱形。返回刻线的强度
float ring(vec2 p, float r, float w) { return smoothstep(w, 0.0, abs(length(p) - r)); }
float pattern(vec2 su) {
	float m = smoothstep(0.06, 0.0, abs(sdTri(su, 5.9)));
	m = max(m, smoothstep(0.04, 0.0, abs(sdTri(su, 5.5))));
	m = max(m, ring(su, 2.0, 0.06));
	m = max(m, ring(su, 1.55, 0.05));
	m = max(m, ring(su, 0.7, 0.05));
	for (int i = 0; i < 3; i++) {
		float a = 1.5707963 + float(i) * 2.0943951;
		vec2 c = vec2(cos(a), sin(a)) * 3.65;
		vec2 d = su - c;
		m = max(m, ring(d, 1.25, 0.06));
		m = max(m, ring(d, 0.85, 0.045));
		// 圆里的放射纹
		float ang = atan(d.y, d.x);
		float spoke = smoothstep(0.08, 0.0, abs(sin(ang * 3.0 + float(i))) * length(d)) * step(length(d), 0.85) * step(0.3, length(d));
		m = max(m, spoke);
		// 两圆之间的菱形
		float a2 = a + 1.0471976;
		vec2 dm = su - vec2(cos(a2), sin(a2)) * 2.75;
		vec2 dr = vec2(dot(dm, vec2(cos(a2), sin(a2))), dot(dm, vec2(-sin(a2), cos(a2))));
		float dia = abs(dr.x) / 0.5 + abs(dr.y) / 0.22;
		m = max(m, smoothstep(0.12, 0.0, abs(dia - 1.0)));
	}
	return m;
}

// 宇宙：星点、银蓝星云、一点金尘；星球
vec3 cosmos(vec3 rd) {
	vec3 c = vec3(0.004, 0.006, 0.014);
	vec2 sp = vec2(atan(rd.x, -rd.z), asin(clamp(rd.y, -1.0, 1.0)));
	float neb = fbm(sp * 2.2 + 3.0);
	float neb2 = fbm(sp * 5.0 - neb * 1.5 + 11.0);
	c += vec3(0.18, 0.24, 0.36) * pow(neb * neb2, 2.2) * 1.4;
	c += vec3(0.5, 0.36, 0.16) * pow(max(neb2 - 0.45, 0.0) * 2.0, 3.0) * 0.6;
	for (int i = 0; i < 3; i++) {
		float sc = 160.0 + float(i) * 190.0;
		vec2 g = sp * sc;
		vec2 cell = floor(g);
		vec2 f = fract(g) - vec2(hash(cell + float(i)), hash(cell + 7.0 + float(i)));
		float h = hash(cell + 3.1 * float(i));
		float star = smoothstep(0.08 + 0.04 * float(i), 0.0, length(f)) * step(0.9, h);
		c += star * mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), hash(cell + 9.0)) * (0.6 + 0.4 * sin(uTime * 2.0 + h * 40.0));
	}
	// 星球：从下方的深处升起
	if (uEarth > 0.0) {
		vec3 C = vec3(0.0, -95.0 + 35.0 * uEarth, -150.0) - uCamPos;
		float R = 62.0;
		float b = dot(rd, C);
		float disc = b * b - dot(C, C) + R * R;
		vec3 sun = normalize(vec3(-0.8, 0.35, 0.4));
		if (disc > 0.0) {
			float t = b - sqrt(disc);
			vec3 n = normalize(rd * t - C);
			vec2 ll = vec2(atan(n.x, n.z) + uTime * 0.02, asin(n.y));
			float land = smoothstep(0.52, 0.56, fbm(ll * 3.0 + 5.0));
			vec3 sur = mix(vec3(0.03, 0.12, 0.3), vec3(0.2, 0.3, 0.12), land);
			float cloud = smoothstep(0.5, 0.75, fbm(ll * 4.0 + vec2(uTime * 0.03, 0.0) + 20.0));
			sur = mix(sur, vec3(0.9), cloud * 0.8);
			float dif = max(dot(n, sun), 0.0);
			vec3 pc = sur * (0.04 + 1.1 * dif);
			float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
			pc += vec3(0.35, 0.55, 1.0) * rim * (0.2 + dif);
			c = mix(c, pc, uEarth);
		} else {
			// 大气的光晕
			float d = sqrt(max(dot(C, C) - b * b, 0.0)) - R;
			c += vec3(0.3, 0.5, 1.0) * exp(-d * 0.35) * 0.5 * uEarth * max(b, 0.0) / length(C);
		}
	}
	return c;
}

// 穹顶裂缝漏下的冷光柱（沿视线取样）
const vec3 SH_DIR = normalize(vec3(0.22, -1.0, 0.12));
float beamAt(vec3 p) {
	float s = 0.0;
	vec3 o0 = vec3(-3.5, 10.0, -8.0), o1 = vec3(2.8, 10.0, -15.0), o2 = vec3(-1.5, 10.0, -20.5);
	vec3 d;
	d = p - o0; s += smoothstep(0.75, 0.2, length(d - SH_DIR * dot(d, SH_DIR)));
	d = p - o1; s += smoothstep(0.65, 0.15, length(d - SH_DIR * dot(d, SH_DIR)));
	d = p - o2; s += smoothstep(0.55, 0.15, length(d - SH_DIR * dot(d, SH_DIR)));
	return s;
}

void main() {
	vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	float yaw = radians(uYaw), pit = radians(uPitch);
	vec3 fw = vec3(sin(yaw) * cos(pit), -sin(pit), -cos(yaw) * cos(pit));
	vec3 rt = vec3(cos(yaw), 0.0, sin(yaw));
	vec3 up = vec3(sin(yaw) * sin(pit), cos(pit), -cos(yaw) * sin(pit));
	float F = 540.0 / tan(radians(uFov) * 0.5);
	vec3 rd = normalize(fw + rt * (s.x - 960.0) / F - up * (s.y - 540.0) / F);
	vec3 ro = uCamPos;

	float t = 0.02;
	vec2 hit = vec2(-1.0);
	for (int i = 0; i < 160; i++) {
		vec3 p = ro + rd * t;
		vec2 h = map(p);
		if (h.x < 0.001 * t) { hit = vec2(t, h.y); break; }
		t += h.x;
		if (t > 90.0) break;
	}

	vec3 bg = cosmos(rd);
	vec3 col = vec3(0.0);
	float keep = 1.0; // 1 = 殿内的表面，0 = 已裂开成宇宙
	float edge = 0.0;
	if (hit.x > 0.0) {
		vec3 p = ro + rd * hit.x;
		vec3 n = calcNormal(p);
		float m = hit.y;
		vec2 su = stageUV(p);
		// 石头：灰青色的石块，冷
		vec2 bq = abs(n.y) > 0.6 ? p.xz : (abs(n.x) > 0.6 ? p.zy : p.xy);
		vec2 b = vec2(bq.x / 1.4 + floor(bq.y / 0.7) * 0.5, bq.y / 0.7);
		vec2 f = fract(b);
		float mortar = smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x) * 1.4, min(f.y, 1.0 - f.y) * 2.0));
		vec3 alb = vec3(0.15, 0.17, 0.2) * (0.7 + 0.45 * fbm(bq * 1.7)) * mix(0.5, 1.0, mortar);
		if (m == 5.0) alb = vec3(0.2, 0.22, 0.25) * (0.8 + 0.3 * fbm(su * 2.0));
		// 地上薄薄的积雪与霜
		alb = mix(alb, vec3(0.7, 0.76, 0.84), smoothstep(0.6, 0.95, n.y) * smoothstep(0.55, 0.8, fbm(p.xz * 0.6 + 4.0)) * 0.6);

		// 光：环境（冷、暗）+ 舞台中央的金光 + 冷光柱照到地上的光斑
		vec3 L = vec3(0.0, 3.0, STAGE.z) - p;
		float dl = length(L);
		float gold = uLight * pow(1.0 / (1.0 + pow(dl / 4.8, 2.0)), 2.0) * max(dot(n, L / dl), 0.0);
		float pool = beamAt(p + n * 0.05) * uShaft;
		float occ = ao(p, n);
		col = alb * (vec3(0.022, 0.028, 0.04) * occ + vec3(1.0, 0.7, 0.36) * gold * 2.4 + vec3(0.55, 0.65, 0.8) * pool * 1.1);
		// 舞台的刻线：暗处是深槽，亮起时灌满金光
		if (m == 5.0 && p.y > 0.79) {
			float pt = pattern(su);
			col *= 1.0 - 0.6 * pt;
			float sweep = smoothstep(uPattern * 9.0 - 1.0, uPattern * 9.0 - 3.0, length(su));
			col += vec3(1.0, 0.68, 0.28) * pt * (uPattern * 2.6 * sweep + uLight * 0.1);
		}
		// 裂开：从舞台上方往外，墙、柱、穹顶碎成宇宙，裂口带金边
		if (m != 5.0) {
			float dist = length(p - vec3(0.0, 6.0, STAGE.z));
			float crack = fbm(vec2(p.x + p.z, p.y + p.z) * 0.35) * 14.0;
			float k = m == 1.0 ? uFloorGone : uCosmos;
			float front = k * 40.0 - dist - crack;
			keep = smoothstep(0.0, -0.6, front);
			edge = smoothstep(0.45, 0.0, abs(front)) * step(0.001, k);
		}
		col = mix(bg, col, keep);
		col += vec3(1.0, 0.72, 0.34) * edge * 1.3;
	} else {
		col = bg;
	}
	// 冷光柱（体积）：在视线上取样
	if (uShaft > 0.0) {
		float acc = 0.0;
		float tm = hit.x > 0.0 ? hit.x : 40.0;
		for (int i = 0; i < 20; i++) {
			float ti = tm * (float(i) + hash(s + float(i))) / 20.0;
			vec3 q = ro + rd * ti;
			if (q.y < 10.0 && q.y > 0.0) acc += beamAt(q) * (0.8 + 0.6 * noise(q.xz * 1.5 + q.y + uTime * 0.2));
		}
		col += vec3(0.6, 0.7, 0.85) * acc / 20.0 * tm * 0.035 * uShaft * (1.0 - uCosmos);
	}
	col = mix(col, vec3(0.0), uFade);
	outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
`;
