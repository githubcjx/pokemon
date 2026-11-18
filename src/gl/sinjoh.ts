// ─── 《为彼而去》神都遗迹：雪墙围住的雪原 + 冰封的神殿（光线步进）────────────────────
// 世界坐标以米计，y 向上；雪径沿 -z 方向往北，神殿正面在 z = -59（门洞居中）。
// 布局参照心金魂银的地图：雪原 → 两侧雪墙夹着的雪径 → 尽头的院子与积雪的神殿，门前两侧是冰晶。
// 相机：位置 uCamPos，yaw（度，0 = 朝 -z，正值向右转）、pitch（度，向下为正）、垂直视角 uFov。
// 与 components/unown/SinjohSnow.tsx 的 projectSnow 用同一套换算。

export const SINJOH_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform float uYaw;
uniform float uPitch;
uniform float uFov;
uniform float uWhite;    // 白场（从眼白接过来）
uniform float uHaze;     // 风雪的浓度（远处融进白雾）
uniform float uSnow;     // 飘雪
uniform float uDoorGlow; // 门洞深处的一点金光

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
	for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}

// 雪墙：雪径两侧（z 在 -50..6）、院子两侧（z < -50）、院子后面（z < -73）
float wallMask(vec2 xz) {
	float ax = abs(xz.x) + (noise(xz * 0.35) - 0.5) * 1.6;
	float corridor = smoothstep(4.4, 7.6, ax) * smoothstep(9.0, 4.0, xz.y);
	float yard = smoothstep(11.0, 14.2, ax) * smoothstep(-47.0, -52.0, xz.y);
	float inYard = smoothstep(-48.0, -51.0, xz.y);
	float w = mix(corridor, yard, inYard);
	w = max(w, smoothstep(-73.0, -76.0, xz.y + (noise(xz * 0.3) - 0.5) * 2.0));
	return w;
}
float groundH(vec2 xz) {
	float h = 0.3 * fbm(xz * 0.07) + 0.35 * fbm(vec2(xz.x * 0.025, xz.y * 0.1));
	h += 0.05 * noise(xz * 0.9);
	float w = wallMask(xz);
	float H = 6.0 + 2.4 * fbm(xz * 0.12 + 7.0);
	return h + w * H;
}

float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
// 冰晶：略微倾斜的六棱柱，顶端收尖
float sdCrystal(vec3 p, float h, float r) {
	vec3 k = vec3(-0.8660254, 0.5, 0.57735);
	vec2 q = abs(p.xz);
	q -= 2.0 * min(dot(k.xy, q), 0.0) * k.xy;
	float rr = r * clamp(1.0 - max(p.y - h * 0.7, 0.0) / (h * 0.3), 0.0, 1.0);
	float side = length(q - vec2(clamp(q.x, -k.z * rr, k.z * rr), rr)) * sign(q.y - rr);
	return max(side, max(-p.y, p.y - h)) * 0.7;
}
vec3 tilt(vec3 p, float a, float b) {
	float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
	p.xy = mat2(ca, sa, -sa, ca) * p.xy;
	p.zy = mat2(cb, sb, -sb, cb) * p.zy;
	return p;
}

// 神殿与冰晶：返回 (距离, 材质)  3 石 4 积雪 5 冰晶 6 门洞里
vec2 temple(vec3 p) {
	vec3 c = p - vec3(0.0, 0.0, -62.0);
	float body = sdBox(c - vec3(0.0, 2.1, 0.0), vec3(5.0, 2.1, 3.0));
	// 檐口
	body = min(body, sdBox(c - vec3(0.0, 4.15, 0.0), vec3(5.35, 0.18, 3.3)));
	// 门洞
	float door = sdBox(c - vec3(0.0, 1.35, 2.4), vec3(1.05, 1.35, 2.6));
	body = max(body, -door);
	// 门前的台阶
	float steps = min(sdBox(c - vec3(0.0, 0.18, 3.6), vec3(2.0, 0.18, 0.6)), sdBox(c - vec3(0.0, 0.42, 3.15), vec3(1.7, 0.12, 0.35)));
	vec2 r = vec2(min(body, steps), 3.0);
	// 屋顶的厚雪（不规则的雪团）
	float roof = sdRoundBox(c - vec3(0.0, 4.65, 0.0), vec3(5.55, 0.42, 3.5), 0.45) - 0.35 * fbm(c.xz * 0.9) + 0.1;
	if (roof < r.x) r = vec2(roof, 4.0);
	// 门两侧的冰晶
	float cr = 1e5;
	cr = min(cr, sdCrystal(tilt(c - vec3(-3.0, 0.0, 6.0), 0.12, 0.05), 3.0, 0.55));
	cr = min(cr, sdCrystal(tilt(c - vec3(3.0, 0.0, 6.0), -0.1, 0.06), 3.3, 0.6));
	cr = min(cr, sdCrystal(tilt(c - vec3(-3.9, 0.0, 9.2), 0.2, -0.05), 2.4, 0.5));
	cr = min(cr, sdCrystal(tilt(c - vec3(3.8, 0.0, 9.0), -0.18, 0.08), 2.6, 0.5));
	cr = min(cr, sdCrystal(tilt(c - vec3(-2.4, 0.0, 6.6), -0.3, 0.1), 1.6, 0.35));
	cr = min(cr, sdCrystal(tilt(c - vec3(2.5, 0.0, 6.7), 0.32, -0.1), 1.4, 0.32));
	if (cr < r.x) r = vec2(cr, 5.0);
	return r;
}

vec2 map(vec3 p) {
	vec2 t = temple(p);
	float g = (p.y - groundH(p.xz)) * 0.28;
	return g < t.x ? vec2(g, 1.0) : t;
}

vec3 calcNormal(vec3 p) {
	vec2 e = vec2(0.02, 0.0);
	return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x));
}
float softShadow(vec3 ro, vec3 rd) {
	float res = 1.0, t = 0.15;
	for (int i = 0; i < 22; i++) {
		float h = map(ro + rd * t).x;
		res = min(res, 10.0 * h / t);
		t += clamp(h, 0.2, 2.5);
		if (res < 0.02 || t > 40.0) break;
	}
	return clamp(res, 0.0, 1.0);
}
float ao(vec3 p, vec3 n) {
	float o = 0.0, s = 1.0;
	for (int i = 1; i <= 4; i++) {
		float h = 0.25 * float(i);
		o += (h - map(p + n * h).x) * s;
		s *= 0.6;
	}
	return clamp(1.0 - 1.2 * o, 0.0, 1.0);
}

vec3 skyCol(vec3 d) {
	float up = clamp(d.y, 0.0, 1.0);
	vec3 c = mix(vec3(0.86, 0.89, 0.93), vec3(0.58, 0.65, 0.76), pow(up, 0.55));
	vec3 sun = normalize(vec3(-0.55, 0.32, -0.6));
	c += vec3(1.0, 0.97, 0.9) * pow(max(dot(d, sun), 0.0), 12.0) * 0.25;
	return c;
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

	float t = 0.05;
	vec2 hit = vec2(-1.0);
	for (int i = 0; i < 260; i++) {
		vec3 p = ro + rd * t;
		vec2 h = map(p);
		if (h.x < 0.0015 * t) { hit = vec2(t, h.y); break; }
		t += max(h.x, 0.004 * t);
		if (t > 220.0 || (p.y > 16.0 && rd.y > 0.0)) break;
	}

	vec3 sky = skyCol(rd);
	vec3 col = sky;
	vec3 sunD = normalize(vec3(-0.55, 0.32, -0.6));
	if (hit.x > 0.0) {
		vec3 p = ro + rd * hit.x;
		vec3 n = calcNormal(p);
		float m = hit.y;
		vec3 c = p - vec3(0.0, 0.0, -62.0);
		bool inDoor = m == 3.0 && abs(c.x) < 1.06 && c.y < 2.71 && c.z < 3.02 && c.z > -3.0 && p.y > 0.0;
		vec3 alb;
		float spec = 0.0;
		if (m == 1.0) {
			// 雪；陡的地方是冰崖
			float steep = smoothstep(0.75, 0.45, n.y);
			vec3 cliff = mix(vec3(0.6, 0.67, 0.75), vec3(0.78, 0.84, 0.9), noise(vec2(p.x * 2.5 + p.z * 2.5, p.y * 0.4)));
			alb = mix(vec3(0.93, 0.95, 0.98), cliff, steep);
			spec = 0.15;
		} else if (m == 3.0) {
			// 灰石：石块纹理 + 风化
			vec2 bq = abs(n.z) > 0.6 ? p.xy : p.zy;
			vec2 b = vec2(bq.x / 1.1 + floor(bq.y / 0.55) * 0.5, bq.y / 0.55);
			vec2 f = fract(b);
			float mortar = smoothstep(0.0, 0.06, min(min(f.x, 1.0 - f.x) * 1.1, min(f.y, 1.0 - f.y) * 2.0));
			alb = vec3(0.36, 0.37, 0.39) * (0.75 + 0.35 * fbm(p.xy * 3.0 + p.z)) * mix(0.55, 1.0, mortar);
			// 石缝里积的雪
			alb = mix(alb, vec3(0.85, 0.88, 0.92), smoothstep(0.55, 0.9, n.y) * 0.9 + (1.0 - mortar) * 0.25 * smoothstep(0.4, 0.7, noise(p.xy * 4.0)));
		} else if (m == 4.0) {
			alb = vec3(0.94, 0.96, 0.99);
			spec = 0.15;
		} else {
			alb = vec3(0.62, 0.78, 0.88);
			spec = 0.6;
		}
		float dif = max(dot(n, sunD), 0.0) * softShadow(p + n * 0.05, sunD);
		float occ = ao(p, n);
		vec3 amb = mix(vec3(0.52, 0.6, 0.74), vec3(0.78, 0.83, 0.9), n.y * 0.5 + 0.5);
		col = alb * (amb * 0.88 * occ + vec3(1.0, 0.96, 0.9) * dif * 0.7);
		// 雪面的细小闪光
		if (m == 1.0 || m == 4.0) col += step(0.996, hash(floor(s * 0.75) + floor(p.xz * 40.0))) * 0.35 * dif;
		vec3 H = normalize(sunD - rd);
		col += spec * pow(max(dot(n, H), 0.0), 40.0) * dif;
		if (m == 5.0) {
			// 冰晶：边缘透亮，内部带一点青色
			float fr = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
			col = mix(col, vec3(0.92, 0.97, 1.0), fr * 0.7) + vec3(0.05, 0.12, 0.16) * (0.5 + 0.5 * sin(p.y * 5.0 + p.x * 3.0));
		}
		if (inDoor) {
			// 门洞里：黑暗，深处一点金光
			float depth = clamp((3.02 - c.z) / 3.2, 0.0, 1.0);
			col = mix(col * 0.12, vec3(0.008, 0.008, 0.01), smoothstep(0.0, 0.2, depth));
			col += vec3(1.0, 0.66, 0.26) * uDoorGlow * smoothstep(0.7, 1.0, depth) * smoothstep(1.3, 0.0, length(c.xy - vec2(0.0, 1.0)));
		}
		// 远处融进风雪
		float fog = 1.0 - exp(-hit.x * (0.008 + 0.04 * uHaze));
		col = mix(col, vec3(0.88, 0.9, 0.93), fog);
	} else {
		col = mix(col, vec3(0.88, 0.9, 0.93), uHaze * 0.6);
	}

	// 飘雪：三层，近大远小，随相机转向有视差
	if (uSnow > 0.0) {
		for (int i = 0; i < 3; i++) {
			float fi = float(i);
			float sc = 9.0 + fi * 9.0;
			vec2 uv = s / 1080.0 * sc + vec2(uYaw * 0.12 * (3.0 - fi) - uTime * (0.25 + 0.1 * fi), -uTime * (1.1 - fi * 0.25) * sc / 9.0 - uPitch * 0.05 * (3.0 - fi));
			uv.x += sin(uv.y * 0.7 + fi * 3.0 + uTime * 0.6) * 0.25;
			vec2 cell = floor(uv);
			vec2 fp = fract(uv) - (0.25 + 0.5 * vec2(hash(cell + fi * 7.1), hash(cell + fi * 3.3)));
			float sz = (0.05 + 0.05 * hash(cell + 9.0)) * (1.25 - fi * 0.3);
			float flake = smoothstep(sz, sz * 0.3, length(fp)) * step(0.35, hash(cell + fi * 1.7));
			col = mix(col, vec3(0.97, 0.98, 1.0), flake * uSnow * (0.9 - fi * 0.2));
		}
	}
	col = mix(col, vec3(1.0), uWhite);
	outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
